FROM ghcr.io/sooperset/mcp-atlassian:latest

COPY PAG-Interception-CA-ROOT-01.crt /usr/local/share/ca-certificates/PAG-Interception-CA-ROOT-01.crt

USER root
RUN update-ca-certificates

ENV REQUESTS_CA_BUNDLE=/usr/local/share/ca-certificates/PAG-Interception-CA-ROOT-01.crt

# Optionally switch back to the original user (replace 'appuser' with the actual user if needed)
# USER appuser
