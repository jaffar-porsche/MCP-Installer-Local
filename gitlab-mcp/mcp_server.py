from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import gitlab
from fastapi_mcp import FastApiMCP
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import os
import tempfile
import base64

load_dotenv()

# Configuration
GITLAB_BASE_URL = os.getenv("GITLAB_BASE_URL", "https://cicd.skyway.porsche.com")
GITLAB_TOKEN = os.getenv("GITLAB_TOKEN")
if not GITLAB_TOKEN:
    raise RuntimeError("GITLAB_TOKEN environment variable is not set")

# Proxy settings
HTTP_PROXY = os.getenv("HTTP_PROXY")
HTTPS_PROXY = os.getenv("HTTPS_PROXY")

# MCP transport mode: "http" (default) or "stdio"
MCP_TRANSPORT = os.getenv("MCP_TRANSPORT", "http").lower()

# Create GitLab client
gl = gitlab.Gitlab(
    url=GITLAB_BASE_URL,
    private_token=GITLAB_TOKEN,
    ssl_verify=True,
)

# Configure proxy if needed
if HTTP_PROXY or HTTPS_PROXY:
    import requests
    proxies = {}
    if HTTP_PROXY:
        proxies['http'] = HTTP_PROXY
    if HTTPS_PROXY:
        proxies['https'] = HTTPS_PROXY

    # Apply proxy to the GitLab client session
    if proxies:
        gl.session.proxies.update(proxies)

# Test connection
try:
    gl.auth()  # This returns None on success, raises exception on failure
    current_user = gl.user
    print(f"Connected to GitLab as: {current_user.name} ({current_user.username})")
except Exception as e:
    print(f"Failed to connect to GitLab: {e}")
    raise

app = FastAPI(title="GitLab MCP Server", version="1.0.0")


# --------------------------------------------------------------------------- #
# MCPorsche health endpoints — polled by the Control Panel & tray icon
# --------------------------------------------------------------------------- #

import pat_status  # noqa: E402


@app.get("/health", summary="Liveness probe", operation_id="health_liveness")
async def health() -> dict:
    """Cheap liveness probe. Always returns 200 while the process is up."""
    return {"status": "ok", "service": "gitlab-mcp"}


@app.get(
    "/health/pat",
    summary="PAT status for MCPorsche tray & clients",
    operation_id="health_pat",
)
async def health_pat():
    """Return the current GitLab PAT state.

    If the state is UNKNOWN (no call made yet), we do a cheap authenticated
    lookup against ``/api/v4/user`` to flip it to OK or INVALID. Returns
    HTTP 401 when the PAT is bad so the MCPorsche Control Panel turns red.
    """
    from fastapi.responses import JSONResponse

    status = pat_status.get()
    if status.state is pat_status.PATState.UNKNOWN:
        _probe_gitlab_pat()
        status = pat_status.get()

    payload = {
        "server": "gitlab-mcp",
        "base_url": GITLAB_BASE_URL,
        "pat": status.as_dict(),
    }
    if status.state is pat_status.PATState.INVALID:
        payload["hint"] = (
            "Your GitLab token is invalid or expired. In the MCPorsche "
            "Control Panel choose 'Rotate PAT' → 'GitLab'."
        )
        return JSONResponse(status_code=401, content=payload)
    return JSONResponse(status_code=200, content=payload)


def _probe_gitlab_pat() -> None:
    """One-shot authenticated call to determine PAT validity."""
    try:
        resp = gl.session.get(
            f"{GITLAB_BASE_URL}/api/v4/user",
            headers={"PRIVATE-TOKEN": GITLAB_TOKEN},
            timeout=6,
        )
        if resp.status_code == 200:
            pat_status.record_success(200)
        elif resp.status_code in (401, 403):
            pat_status.record_unauthorized(resp.status_code, resp.text or "")
    except Exception as e:  # pragma: no cover — probe must never crash /health
        print(f"[gitlab-mcp] PAT probe failed: {e}")

# Pydantic models for request validation
class CreateProjectRequest(BaseModel):
    name: str
    path: Optional[str] = None
    namespace_id: Optional[int] = None
    description: Optional[str] = None
    visibility: Optional[str] = "private"
    default_branch: Optional[str] = "main"
    issues_enabled: Optional[bool] = True
    merge_requests_enabled: Optional[bool] = True
    builds_enabled: Optional[bool] = True
    wiki_enabled: Optional[bool] = True
    initialize_with_readme: Optional[bool] = False

class CreateIssueRequest(BaseModel):
    title: str
    description: Optional[str] = None
    confidential: Optional[bool] = False
    assignee_ids: Optional[str] = Field(default=None, description="Comma-separated list of assignee user IDs (e.g., '123,456')")
    milestone_id: Optional[int] = None
    labels: Optional[str] = None
    due_date: Optional[str] = None
    weight: Optional[int] = None

class CreateMergeRequestRequest(BaseModel):
    source_branch: str
    target_branch: str
    title: str
    description: Optional[str] = None
    assignee_ids: Optional[str] = Field(default=None, description="Comma-separated list of assignee user IDs (e.g., '123,456')")
    labels: Optional[str] = None
    milestone_id: Optional[int] = None
    remove_source_branch: Optional[bool] = False
    squash: Optional[bool] = False

class CreateFileRequest(BaseModel):
    file_path: str
    content: str
    branch: str
    commit_message: str
    author_email: Optional[str] = None
    author_name: Optional[str] = None
    encoding: Optional[str] = "text"

class TriggerPipelineRequest(BaseModel):
    ref: str
    variables: Optional[Dict[str, str]] = None
    inputs: Optional[Dict[str, str]] = None

# PROJECT ENDPOINTS

@app.get("/list_projects", summary="List GitLab projects", operation_id="list_projects")
async def list_projects(
    visibility: Optional[str] = None,
    owned: Optional[bool] = None,
    starred: Optional[bool] = None,
    archived: Optional[bool] = None,
    search: Optional[str] = None,
    order_by: Optional[str] = "created_at",
    sort: Optional[str] = "desc",
    per_page: Optional[int] = 20,
    page: Optional[int] = 1
):
    """
    List GitLab projects with optional filtering.

    Parameters:
    - visibility: Project visibility (public, internal, private)
    - owned: Show only owned projects
    - starred: Show only starred projects
    - archived: Include archived projects
    - search: Search term for project name/description
    - order_by: Order by field (id, name, path, created_at, updated_at, last_activity_at)
    - sort: Sort order (asc, desc)
    - per_page: Number of projects per page (1-100)
    - page: Page number
    """
    try:
        kwargs = {
            'all': True,
            'order_by': order_by,
            'sort': sort,
            'per_page': per_page,
            'page': page
        }

        if visibility:
            kwargs['visibility'] = visibility
        if owned is not None:
            kwargs['owned'] = owned
        if starred is not None:
            kwargs['starred'] = starred
        if archived is not None:
            kwargs['archived'] = archived
        if search:
            kwargs['search'] = search

        projects = gl.projects.list(**kwargs)
        return {"projects": [project.asdict() for project in projects]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list projects: {str(e)}")

@app.get("/get_project", summary="Get a specific project", operation_id="get_project")
async def get_project(project_id: str):
    """
    Get detailed information about a specific project.

    Parameters:
    - project_id: Project ID or path with namespace (e.g., "group/project-name")
    """
    try:
        project = gl.projects.get(project_id)
        return {"project": project.asdict()}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Project not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get project: {str(e)}")

@app.post("/create_project", summary="Create a new project", operation_id="create_project")
async def create_project(request: CreateProjectRequest):
    """
    Create a new GitLab project.
    """
    try:
        project_data = request.dict(exclude_none=True)
        project = gl.projects.create(project_data)
        return {"project": project.asdict()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")

@app.get("/search_projects", summary="Search projects", operation_id="search_projects")
async def search_projects(
    query: str,
    visibility: Optional[str] = None,
    order_by: Optional[str] = "created_at",
    sort: Optional[str] = "desc",
    per_page: Optional[int] = 20,
    page: Optional[int] = 1
):
    """
    Search for projects by name or description.
    """
    try:
        kwargs = {
            'search': query,
            'order_by': order_by,
            'sort': sort,
            'per_page': per_page,
            'page': page
        }

        if visibility:
            kwargs['visibility'] = visibility

        projects = gl.projects.list(**kwargs)
        return {"projects": [project.asdict() for project in projects]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search projects: {str(e)}")

# ISSUE ENDPOINTS

@app.get("/list_issues", summary="List issues for a project", operation_id="list_issues")
async def list_issues(
    project_id: str,
    state: Optional[str] = "opened",
    labels: Optional[str] = None,
    milestone: Optional[str] = None,
    assignee_id: Optional[int] = None,
    author_id: Optional[int] = None,
    search: Optional[str] = None,
    order_by: Optional[str] = "created_at",
    sort: Optional[str] = "desc",
    per_page: Optional[int] = 20,
    page: Optional[int] = 1
):
    """
    List issues for a project with filtering options.
    """
    try:
        project = gl.projects.get(project_id)

        kwargs = {
            'state': state,
            'order_by': order_by,
            'sort': sort,
            'per_page': per_page,
            'page': page,
            'all': True
        }

        if labels:
            kwargs['labels'] = labels
        if milestone:
            kwargs['milestone'] = milestone
        if assignee_id:
            kwargs['assignee_id'] = assignee_id
        if author_id:
            kwargs['author_id'] = author_id
        if search:
            kwargs['search'] = search

        issues = project.issues.list(**kwargs)
        return {"issues": [issue.asdict() for issue in issues]}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Project not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list issues: {str(e)}")

@app.get("/get_issue", summary="Get a specific issue", operation_id="get_issue")
async def get_issue(project_id: str, issue_iid: int):
    """
    Get detailed information about a specific issue.
    """
    try:
        project = gl.projects.get(project_id)
        issue = project.issues.get(issue_iid)
        return {"issue": issue.asdict()}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Issue not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get issue: {str(e)}")

@app.post("/create_issue", summary="Create a new issue", operation_id="create_issue")
async def create_issue(project_id: str, request: CreateIssueRequest):
    """
    Create a new issue in a project.
    """
    try:
        project = gl.projects.get(project_id)
        issue_data = request.dict(exclude_none=True)
        # Convert comma-separated assignee_ids to list of integers
        if 'assignee_ids' in issue_data and issue_data['assignee_ids']:
            issue_data['assignee_ids'] = [int(x.strip()) for x in issue_data['assignee_ids'].split(',') if x.strip()]
        issue = project.issues.create(issue_data)
        return {"issue": issue.asdict()}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Project not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create issue: {str(e)}")

@app.put("/update_issue", summary="Update an issue", operation_id="update_issue")
async def update_issue(
    project_id: str,
    issue_iid: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    state_event: Optional[str] = None,
    labels: Optional[str] = None,
    assignee_ids: Optional[str] = None
):
    """
    Update an existing issue.
    """
    try:
        project = gl.projects.get(project_id)
        issue = project.issues.get(issue_iid)

        if title:
            issue.title = title
        if description:
            issue.description = description
        if state_event:
            issue.state_event = state_event
        if labels:
            issue.labels = labels.split(',')
        if assignee_ids:
            issue.assignee_ids = [int(x.strip()) for x in assignee_ids.split(',') if x.strip()]

        issue.save()
        return {"issue": issue.asdict()}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Issue not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update issue: {str(e)}")

# MERGE REQUEST ENDPOINTS

@app.get("/list_merge_requests", summary="List merge requests for a project", operation_id="list_merge_requests")
async def list_merge_requests(
    project_id: str,
    state: Optional[str] = "opened",
    source_branch: Optional[str] = None,
    target_branch: Optional[str] = None,
    author_id: Optional[int] = None,
    assignee_id: Optional[int] = None,
    per_page: Optional[int] = 20,
    page: Optional[int] = 1
):
    """
    List merge requests for a project.
    """
    try:
        project = gl.projects.get(project_id)

        kwargs = {
            'state': state,
            'per_page': per_page,
            'page': page,
            'all': True
        }

        if source_branch:
            kwargs['source_branch'] = source_branch
        if target_branch:
            kwargs['target_branch'] = target_branch
        if author_id:
            kwargs['author_id'] = author_id
        if assignee_id:
            kwargs['assignee_id'] = assignee_id

        merge_requests = project.mergerequests.list(**kwargs)
        return {"merge_requests": [mr.asdict() for mr in merge_requests]}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Project not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list merge requests: {str(e)}")

@app.post("/create_merge_request", summary="Create a new merge request", operation_id="create_merge_request")
async def create_merge_request(project_id: str, request: CreateMergeRequestRequest):
    """
    Create a new merge request in a project.
    """
    try:
        project = gl.projects.get(project_id)
        mr_data = request.dict(exclude_none=True)
        # Convert comma-separated assignee_ids to list of integers
        if 'assignee_ids' in mr_data and mr_data['assignee_ids']:
            mr_data['assignee_ids'] = [int(x.strip()) for x in mr_data['assignee_ids'].split(',') if x.strip()]
        merge_request = project.mergerequests.create(mr_data)
        return {"merge_request": merge_request.asdict()}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Project not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create merge request: {str(e)}")

@app.post("/merge_merge_request", summary="Accept and merge a merge request", operation_id="merge_merge_request")
async def merge_merge_request(
    project_id: str,
    merge_request_iid: int,
    merge_commit_message: Optional[str] = None,
    squash: Optional[bool] = None,
    should_remove_source_branch: Optional[bool] = None
):
    """
    Accept and merge a merge request.
    """
    try:
        project = gl.projects.get(project_id)
        merge_request = project.mergerequests.get(merge_request_iid)

        kwargs = {}
        if merge_commit_message:
            kwargs['merge_commit_message'] = merge_commit_message
        if squash is not None:
            kwargs['squash'] = squash
        if should_remove_source_branch is not None:
            kwargs['should_remove_source_branch'] = should_remove_source_branch

        result = merge_request.merge(**kwargs)
        return {"result": result}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Merge request not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to merge merge request: {str(e)}")

# PIPELINE ENDPOINTS

@app.get("/list_pipelines", summary="List pipelines for a project", operation_id="list_pipelines")
async def list_pipelines(
    project_id: str,
    status: Optional[str] = None,
    ref: Optional[str] = None,
    sha: Optional[str] = None,
    per_page: Optional[int] = 20,
    page: Optional[int] = 1
):
    """
    List pipelines for a project.
    """
    try:
        project = gl.projects.get(project_id)

        kwargs = {
            'per_page': per_page,
            'page': page,
            'all': True
        }

        if status:
            kwargs['status'] = status
        if ref:
            kwargs['ref'] = ref
        if sha:
            kwargs['sha'] = sha

        pipelines = project.pipelines.list(**kwargs)
        return {"pipelines": [pipeline.asdict() for pipeline in pipelines]}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Project not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list pipelines: {str(e)}")

@app.post("/trigger_pipeline", summary="Trigger a new pipeline", operation_id="trigger_pipeline")
async def trigger_pipeline(
    project_id: str,
    request: TriggerPipelineRequest
):
    """
    Trigger a new pipeline for a branch or tag.
    """
    try:
        project = gl.projects.get(project_id)

        pipeline_data = {'ref': request.ref}
        if request.variables:
            pipeline_data['variables'] = [
                {'key': k, 'value': v, 'variable_type': 'env_var'}
                for k, v in request.variables.items()
            ]
        if request.inputs:
            pipeline_data['inputs'] = request.inputs

        pipeline = project.pipelines.create(pipeline_data)
        return {"pipeline": pipeline.asdict()}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Project not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to trigger pipeline: {str(e)}")

@app.get("/get_pipeline_jobs", summary="Get jobs for a pipeline", operation_id="get_pipeline_jobs")
async def get_pipeline_jobs(project_id: str, pipeline_id: int):
    """
    Get all jobs in a pipeline.
    """
    try:
        project = gl.projects.get(project_id)
        pipeline = project.pipelines.get(pipeline_id)
        jobs = pipeline.jobs.list(all=True)
        return {"jobs": [job.asdict() for job in jobs]}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Pipeline not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get pipeline jobs: {str(e)}")

@app.get("/get_job_trace", summary="Get job trace/logs", operation_id="get_job_trace")
async def get_job_trace(project_id: str, job_id: int):
    """
    Get the trace (logs) of a job.
    """
    try:
        project = gl.projects.get(project_id)
        job = project.jobs.get(job_id)
        trace = job.trace()
        return {"trace": trace.decode('utf-8') if isinstance(trace, bytes) else trace}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Job not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job trace: {str(e)}")

# REPOSITORY ENDPOINTS

@app.get("/get_repository_tree", summary="Get repository tree", operation_id="get_repository_tree")
async def get_repository_tree(
    project_id: str,
    path: Optional[str] = "",
    ref: Optional[str] = None,
    recursive: Optional[bool] = False
):
    """
    Get repository tree (list files and directories).
    """
    try:
        project = gl.projects.get(project_id)

        kwargs = {'path': path, 'recursive': recursive}
        if ref:
            kwargs['ref'] = ref

        tree = project.repository_tree(**kwargs)
        return {"tree": tree}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Project not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get repository tree: {str(e)}")

@app.get("/get_file_content", summary="Get file content", operation_id="get_file_content")
async def get_file_content(
    project_id: str,
    file_path: str,
    ref: Optional[str] = None
):
    """
    Get file content as raw string.
    """
    try:
        project = gl.projects.get(project_id)

        kwargs = {'file_path': file_path}
        if ref:
            kwargs['ref'] = ref

        file_info = project.files.get(**kwargs)
        content = file_info.decode()
        return {"content": content, "file_info": file_info.asdict()}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"File not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get file content: {str(e)}")

@app.post("/create_file", summary="Create a new file", operation_id="create_file")
async def create_file(project_id: str, request: CreateFileRequest):
    """
    Create a new file in the repository.
    """
    try:
        project = gl.projects.get(project_id)

        file_data = {
            'file_path': request.file_path,
            'branch': request.branch,
            'content': request.content,
            'commit_message': request.commit_message,
            'encoding': request.encoding
        }

        if request.author_email:
            file_data['author_email'] = request.author_email
        if request.author_name:
            file_data['author_name'] = request.author_name

        file_info = project.files.create(file_data)
        return {"file": file_info}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Project not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create file: {str(e)}")

@app.get("/list_branches", summary="List repository branches", operation_id="list_branches")
async def list_branches(project_id: str, search: Optional[str] = None):
    """
    List all branches in a repository.
    """
    try:
        project = gl.projects.get(project_id)

        kwargs = {'all': True}
        if search:
            kwargs['search'] = search

        branches = project.branches.list(**kwargs)
        return {"branches": [branch.asdict() for branch in branches]}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Project not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list branches: {str(e)}")

@app.post("/create_branch", summary="Create a new branch", operation_id="create_branch")
async def create_branch(project_id: str, branch_name: str, ref: str):
    """
    Create a new branch.
    """
    try:
        project = gl.projects.get(project_id)
        branch = project.branches.create({'branch': branch_name, 'ref': ref})
        return {"branch": branch.asdict()}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Project not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create branch: {str(e)}")

@app.get("/list_commits", summary="List repository commits", operation_id="list_commits")
async def list_commits(
    project_id: str,
    ref_name: Optional[str] = None,
    since: Optional[str] = None,
    until: Optional[str] = None,
    path: Optional[str] = None,
    author: Optional[str] = None,
    per_page: Optional[int] = 20,
    page: Optional[int] = 1
):
    """
    List commits in a repository.
    """
    try:
        project = gl.projects.get(project_id)

        kwargs = {
            'per_page': per_page,
            'page': page,
        }

        if ref_name:
            kwargs['ref_name'] = ref_name
        if since:
            kwargs['since'] = since
        if until:
            kwargs['until'] = until
        if path:
            kwargs['path'] = path
        if author:
            kwargs['author'] = author

        commits = project.commits.list(**kwargs)
        return {"commits": [commit.asdict() for commit in commits]}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Project not found: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list commits: {str(e)}")

# COMMENT ENDPOINTS

@app.get("/get_comments", summary="Get comments on an issue or merge request", operation_id="get_comments")
async def get_comments(
    project_id: str,
    issue_iid: Optional[int] = None,
    merge_request_iid: Optional[int] = None,
    per_page: Optional[int] = 20,
    page: Optional[int] = 1
):
    """
    Get comments (notes) on an issue or merge request. Provide either issue_iid or merge_request_iid.
    """
    try:
        if not issue_iid and not merge_request_iid:
            raise HTTPException(status_code=400, detail="Provide either issue_iid or merge_request_iid")

        project = gl.projects.get(project_id)

        if issue_iid:
            item = project.issues.get(issue_iid)
        else:
            item = project.mergerequests.get(merge_request_iid)

        notes = item.notes.list(per_page=per_page, page=page)
        return {"comments": [note.asdict() for note in notes]}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Not found: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get comments: {str(e)}")

@app.post("/add_comment", summary="Add a comment to an issue or merge request", operation_id="add_comment")
async def add_comment(
    project_id: str,
    body: str,
    issue_iid: Optional[int] = None,
    merge_request_iid: Optional[int] = None
):
    """
    Add a comment (note) to an issue or merge request. Provide either issue_iid or merge_request_iid.
    """
    try:
        if not issue_iid and not merge_request_iid:
            raise HTTPException(status_code=400, detail="Provide either issue_iid or merge_request_iid")

        project = gl.projects.get(project_id)

        if issue_iid:
            item = project.issues.get(issue_iid)
        else:
            item = project.mergerequests.get(merge_request_iid)

        note = item.notes.create({'body': body})
        return {"comment": note.asdict()}
    except gitlab.GitlabGetError as e:
        raise HTTPException(status_code=404, detail=f"Not found: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add comment: {str(e)}")

# Mount MCP protocol
mcp = FastApiMCP(app)
if MCP_TRANSPORT == "stdio":
    mcp.mount()  # Use stdio transport (e.g. for VS Code Copilot)
else:
    mcp.mount_http()  # Use HTTP transport (default, e.g. for Claude Code)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("MCP_PORT", 8003))
    print(f"🚀 Starting GitLab MCP Server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)