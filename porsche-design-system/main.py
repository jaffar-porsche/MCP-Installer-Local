import os
import logging
from fastmcp import FastMCP
from fastapi import FastAPI
import uvicorn
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app_name = "porschedesignsystemmcp"

mcp = FastMCP(app_name, stateless_http=True)


@mcp.tool()
async def angular_template():
    """
    Returns all the necessary information to recreate the Angular website template given in 'data/templates',
    including pre-requirements for project setup & installations, file contents, and instructions on how to run it.
    """
    templates_dir = "data/templates"

    # Get the template files content
    template_files = {}
    for filename in [
        "app.component.html",
        "app.component.scss",
        "app.component.ts",
    ]:
        file_path = os.path.join(templates_dir, filename)
        if os.path.exists(file_path):
            with open(file_path, "r") as file:
                template_files[filename] = file.read()

    # Pre-requirements and setup instructions
    setup_instructions = """
# Porsche Design System Angular Template Setup

## Pre-requirements
- Node.js (v14 or later)
- npm (v6 or later)
- Angular CLI (v12 or later)

## Project Setup
1. Install Angular CLI if you haven't already:
   ```bash
   npm install -g @angular/cli
   ```

2. Create a new Angular project:
   ```bash
   ng new porsche-design-demo --style=scss --routing=true
   cd porsche-design-demo
   ```

3. Install the Porsche Design System Angular components:
   ```bash
   npm install @porsche-design-system/components-angular
   ```

4. Replace the content of the following files with the provided template files:
   - src/app/app.component.html
   - src/app/app.component.scss
   - src/app/app.component.ts

## How to Run
1. Start the development server:
   ```bash
   ng serve
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:4200
   ```

## Notes
- This template uses the Porsche Design System Angular components.
- The template includes various components like accordion, carousel, tabs, and more.
- You can customize the template to fit your needs by modifying the provided files.
"""

    # Return all the information
    return {
        "setup_instructions": setup_instructions,
        "template_files": template_files,
    }


@mcp.tool()
async def list_components():
    """
    Lists all components in 'data/components' with their name, id and description.
    """
    components_dir = "data/components"
    components_list = []

    # Get all JSON files in the components directory
    for filename in os.listdir(components_dir):
        if filename.endswith(".json"):
            file_path = os.path.join(components_dir, filename)
            with open(file_path, "r") as file:
                component_data = json.load(file)
                # Extract only name, id, and description
                components_list.append(
                    {
                        "name": component_data.get("name", ""),
                        "id": component_data.get("id", ""),
                        "description": component_data.get("description", ""),
                    }
                )

    return components_list


@mcp.tool()
async def list_styles():
    """
    Lists all styles in 'data/styles' with their name, id and description.
    Also includes an introduction to styles from the styles.md guide file.
    """
    styles_dir = "data/styles"
    styles_list = []

    # Get all JSON files in the styles directory
    for filename in os.listdir(styles_dir):
        if filename.endswith(".json"):
            file_path = os.path.join(styles_dir, filename)
            with open(file_path, "r") as file:
                style_data = json.load(file)
                # Extract only name, id, and description
                styles_list.append(
                    {
                        "name": style_data.get("name", ""),
                        "id": style_data.get("id", ""),
                        "description": style_data.get("description", ""),
                    }
                )

    # Get the styles introduction content
    guide_path = "data/guides/styles.md"
    introduction = ""
    if os.path.exists(guide_path):
        with open(guide_path, "r") as file:
            introduction = file.read()

    # Return both the styles list and the introduction
    return {"styles": styles_list, "introduction": introduction}


@mcp.tool()
async def introduction():
    """
    Returns the contents of the introduction.md guide file.
    """
    guide_path = "data/guides/introduction.md"

    with open(guide_path, "r") as file:
        content = file.read()
    return content


@mcp.tool()
async def quickstart(framework: str):
    """
    Returns the quickstart guide for the specified framework (angular or react).
    """
    if framework.lower() not in ["angular", "react"]:
        return f"Framework '{framework}' is not supported. Please choose either 'angular' or 'react'."

    guide_path = f"data/guides/{framework.lower()}.md"

    with open(guide_path, "r") as file:
        content = file.read()
    return content


@mcp.tool()
async def get_component(component_id: str, framework: str = "react"):
    """
    Takes a string as input argument (the id of the component) and lists all available information about that component.
    Instead of returning the "code" property, it returns applicable code examples from 'data/examples/react/components/'
    or 'data/examples/angular/components' based on the framework parameter.
    """
    components_dir = "data/components"

    # Validate framework parameter
    if framework.lower() not in ["angular", "react"]:
        return {"error": "Framework must be either 'angular' or 'react'"}

    # Set examples directory based on framework
    examples_dir = f"data/examples/{framework.lower()}/components"

    try:
        # Search for the component with the given ID in all JSON files
        for filename in os.listdir(components_dir):
            if filename.endswith(".json"):
                file_path = os.path.join(components_dir, filename)
                with open(file_path, "r") as file:
                    component_data = json.load(file)
                    # Check if this is the component we're looking for
                    if component_data.get("id", "").lower() == component_id.lower():
                        # Extract component name from ID (remove 'p-' prefix if present)
                        component_name = component_id.replace("p-", "", 1).capitalize()

                        # Look for example files with matching name
                        examples = []

                        # Different file patterns based on framework
                        if framework.lower() == "react":
                            # React uses PascalCase filenames with .tsx extension
                            file_pattern = f"{component_name}Example"
                            file_ext = ".tsx"
                        else:
                            # Angular uses kebab-case filenames with .component.ts extension
                            file_pattern = f"{component_name.lower()}-example"
                            file_ext = ".component.ts"

                        # Check if examples directory exists
                        if os.path.exists(examples_dir):
                            for example_file in os.listdir(examples_dir):
                                if (
                                    file_pattern.lower() in example_file.lower()
                                    and example_file.endswith(file_ext)
                                ):
                                    example_path = os.path.join(
                                        examples_dir, example_file
                                    )
                                    with open(example_path, "r") as example_f:
                                        example_content = example_f.read()
                                        examples.append(
                                            {
                                                "filename": example_file,
                                                "content": example_content,
                                            }
                                        )

                        # Replace the "code" property with examples
                        if examples:
                            component_data["examples"] = examples
                            # Keep the original code property for backward compatibility
                            # component_data.pop("code", None)

                        return component_data

        # If component not found
        return {"error": f"Component with ID '{component_id}' not found"}
    except Exception as e:
        return {"error": f"Error retrieving component: {str(e)}"}


@mcp.tool()
async def get_style(style_id: str, framework: str = "react"):
    """
    Takes a string as input argument (the id of the style) and lists all available information about that style.
    Returns applicable code examples from 'data/examples/react/styles/'
    or 'data/examples/angular/styles' based on the framework parameter.
    """
    styles_dir = "data/styles"

    # Validate framework parameter
    if framework.lower() not in ["angular", "react"]:
        return {"error": "Framework must be either 'angular' or 'react'"}

    # Set examples directory based on framework
    examples_dir = f"data/examples/{framework.lower()}/styles"

    try:
        # Search for the style with the given ID in all JSON files
        for filename in os.listdir(styles_dir):
            if filename.endswith(".json"):
                file_path = os.path.join(styles_dir, filename)
                with open(file_path, "r") as file:
                    style_data = json.load(file)
                    # Check if this is the style we're looking for
                    if style_data.get("id", "").lower() == style_id.lower():
                        # Get example filename from the style data if available
                        example_filename = None
                        if "examples" in style_data:
                            if (
                                framework.lower() == "react"
                                and "react" in style_data["examples"]
                            ):
                                example_filename = style_data["examples"]["react"]
                            elif (
                                framework.lower() == "angular"
                                and "angular" in style_data["examples"]
                            ):
                                example_filename = style_data["examples"]["angular"]

                        # If no specific example filename is provided, try to find a matching one
                        if not example_filename:
                            # Convert style-id to StyleId format for React or style-id-example for Angular
                            if framework.lower() == "react":
                                # React uses PascalCase filenames with .tsx extension
                                style_name = "".join(
                                    word.capitalize() for word in style_id.split("-")
                                )
                                example_filename = f"Styles{style_name}Example.tsx"
                            else:
                                # Angular uses kebab-case filenames with .component.ts extension
                                example_filename = (
                                    f"styles-{style_id}-example.component.ts"
                                )

                        # Look for example files
                        examples = []

                        # Check if examples directory exists
                        if os.path.exists(examples_dir):
                            if example_filename:
                                example_path = os.path.join(
                                    examples_dir, example_filename
                                )
                                if os.path.exists(example_path):
                                    with open(example_path, "r") as example_f:
                                        example_content = example_f.read()
                                        examples.append(
                                            {
                                                "filename": example_filename,
                                                "content": example_content,
                                            }
                                        )
                            else:
                                # If no specific example filename is found, look for any matching examples
                                for example_file in os.listdir(examples_dir):
                                    if style_id.lower() in example_file.lower():
                                        example_path = os.path.join(
                                            examples_dir, example_file
                                        )
                                        with open(example_path, "r") as example_f:
                                            example_content = example_f.read()
                                            examples.append(
                                                {
                                                    "filename": example_file,
                                                    "content": example_content,
                                                }
                                            )

                        # Add examples to the style data
                        if examples:
                            style_data["examples"] = examples

                        return style_data

        # If style not found
        return {"error": f"Style with ID '{style_id}' not found"}
    except Exception as e:
        return {"error": f"Error retrieving style: {str(e)}"}


if __name__ == "__main__":
    host = os.getenv("MCP_HOST", "127.0.0.1")
    port = int(os.getenv("MCP_PORT", "8001"))

    # Check if OAuth is configured
    oauth_tenant_id = os.getenv("OAUTH_TENANT_ID")
    oauth_client_id = os.getenv(
        "OAUTH_CLIENT_ID"
    )  # Build official HTTP ASGI app (handles /mcp) with proper lifespan
    mcp_app = mcp.http_app()

    wrapper = FastAPI(lifespan=mcp_app.lifespan)

    # Mount MCP app at root (it serves /mcp internally)
    wrapper.mount("/", mcp_app)

    @wrapper.get("/health")
    async def health():
        return {"status": "ok"}

    uvicorn.run(wrapper, host=host, port=port)
