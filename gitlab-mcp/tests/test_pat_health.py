import importlib
import os
import sys
import types
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient


class _FakeAuthError(Exception):
    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.response = types.SimpleNamespace(status_code=status_code)


class _FakeGitlabClient:
    def __init__(self, *args, **kwargs):
        self.session = types.SimpleNamespace(get=lambda *a, **k: None, proxies={})
        self.user = types.SimpleNamespace(name="Test User", username="testuser")

    def auth(self):
        raise _FakeAuthError("401 Unauthorized", 401)


class TestGitLabPatHealth(unittest.TestCase):
    def test_health_pat_returns_401_after_startup_auth_failure(self):
        fake_gitlab = types.SimpleNamespace(
            Gitlab=_FakeGitlabClient,
            GitlabGetError=Exception,
        )

        original_gitlab = sys.modules.get("gitlab")
        original_module = sys.modules.pop("mcp_server", None)
        try:
            with patch.dict(os.environ, {
                "GITLAB_BASE_URL": "https://gitlab.example.com",
                "GITLAB_TOKEN": "bad-token",
            }, clear=False):
                sys.modules["gitlab"] = fake_gitlab
                module = importlib.import_module("mcp_server")
                client = TestClient(module.app)

                response = client.get("/health/pat")

                self.assertEqual(response.status_code, 401)
                data = response.json()
                self.assertEqual(data["pat"]["state"], "INVALID")
                self.assertEqual(data["pat"]["last_status_code"], 401)
        finally:
            sys.modules.pop("mcp_server", None)
            if original_module is not None:
                sys.modules["mcp_server"] = original_module
            if original_gitlab is not None:
                sys.modules["gitlab"] = original_gitlab
            else:
                sys.modules.pop("gitlab", None)


if __name__ == "__main__":
    unittest.main()