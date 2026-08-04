#!/bin/sh
set -e
exec uvicorn mcp_server:app --host 0.0.0.0 --port "${PORT}"