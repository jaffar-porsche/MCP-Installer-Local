# DATONA Glossary MCP Server
# Official Python runtime as base image
FROM python:3.11-alpine

# Metadata labels for better container management
LABEL name="mcporsche-glossary-mcp"

# Set working directory
WORKDIR /app

# Install system dependencies (curl for health checks, ca-certificates for HTTPS)
RUN apk add --no-cache curl ca-certificates

# Copy requirements and install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python application files and data directory
COPY main.py ./
COPY data/ ./data/

# Set permissions and create non-root user for security
RUN addgroup -g 1001 -S mcpuser && \
    adduser -S mcpuser -u 1001 -G mcpuser && \
    chown -R mcpuser:mcpuser /app
USER mcpuser

# Environment variables will be passed from docker-compose
ENV MCP_HOST=0.0.0.0
ENV MCP_PORT=8002

EXPOSE 8002

# Health check - using curl to check FastAPI health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:"$MCP_PORT"/health || exit 1

# Start the MCP server using Python directly (glossary-mcp uses different pattern)
CMD ["python", "main.py"]