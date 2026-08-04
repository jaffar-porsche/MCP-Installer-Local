# DATONA GitLab MCP Server
# Official Python runtime as base image
FROM python:3.11-alpine

# Metadata labels for better container management
LABEL name="mcporsche-gitlab-mcp"

# Set working directory
WORKDIR /app

# Install system dependencies (curl for health checks, ca-certificates for HTTPS)
#RUN apk add --no-cache curl ca-certificates

# Copy requirements and install dependencies
COPY gitlab-mcp/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python application files and shared startup script
COPY gitlab-mcp/mcp_server.py ./
COPY docker/start.sh ./

# Set permissions and create non-root user for security
RUN chmod +x start.sh && \
    addgroup -g 1001 -S mcpuser && \
    adduser -S mcpuser -u 1001 -G mcpuser && \
    chown -R mcpuser:mcpuser /app
USER mcpuser

# Environment variables will be passed from docker-compose
ENV PORT=8003

EXPOSE 8003

# Health check - using curl to check FastAPI health endpoint
# Note: Port will be set by environment variable at runtime
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:"$PORT"/docs || exit 1

# Start the MCP server using uvicorn
# Port will be read from PORT environment variable
CMD ["./start.sh"]