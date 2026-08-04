# Atlassian Jira and Confluence MCP Server

This project uses the [mcp-atlassian](https://github.com/sooperset/mcp-atlassian) integration to provide an MCP server for Atlassian Jira and Confluence.

## People 

- Tobias Grosse-Puppendahl
- Luis Neumeier
- Maximilian Fuesslin
- Florian Sellmayr

## Known Problems

Seems like there is no whitelisting for the Atlassian APIs and doesn't work with Global Protect. If you run into networking issues (`api.skyway.porsche.com` only works if either your Network is whitelisted (typically Porsche-internal Networks or specific applications) or you have a client certificate), try using the DevX CLI Proxy functionality as a workaround (see below).

## 🛠️ Configuration Example

Add the following to your MCP configuration:

```json
{
  "mcp": {
    "servers": {
      "Atlassian Porsche": {
        "command": "docker",
        "args": [
          "run",
          "-i",
          "--rm",
          "-e", "CONFLUENCE_URL",
          "-e", "CONFLUENCE_USERNAME",
          "-e", "CONFLUENCE_PERSONAL_TOKEN",
          "-e", "JIRA_URL",
          "-e", "JIRA_USERNAME",
          "-e", "JIRA_PERSONAL_TOKEN",
          "porsche/mcp-atlassian-porsche:latest"
        ],
        "env": {
          "CONFLUENCE_URL": "https://api.skyway.porsche.com/confluence/",
          "CONFLUENCE_USERNAME": "<vwkonzernid>",
          "CONFLUENCE_PERSONAL_TOKEN": "<your-confluence-api-token>",
          "JIRA_URL": "https://api.skyway.porsche.com/jira/",
          "JIRA_USERNAME": "<vwkonzernid>",
          "JIRA_PERSONAL_TOKEN": "<your-jira-api-token>"
        }
      }
    }
  }
}
```

## Use DevX CLI to handle user sessions and allow API access from any network

Accessing the Skyway API as an end-user can be somewhat complicated at the moment (IP Whitelisting, Client Certificate, API Gateway, ...). While the team is working on a permanent solution, you can work around this issue. 

The [DevX CLI](https://cicd.skyway.porsche.com/porsche/devx-cli) contains a proxying functionality originally [designed for SonarLint](https://skyway.porsche.com/confluence/spaces/CUD/pages/1516168526/Setting+up+SonarLint+in+VSCode+with+the+help+of+DevX-CLI). It logs into Skyway as a user, captures the session then spins up a proxy that attaches this session on every request, therefore giving you a way to call Skyway APIs as this user, without any restrictions. Note that this is a workaround not officially supported by the Skyway Team. 

Here's what you'll need to do: 

1) Download the DevX CLI: https://cicd.skyway.porsche.com/porsche/devx-cli/-/releases
2) Make the CLI executable and (on Mac) allow unsigned code (see [here](https://skyway.porsche.com/confluence/spaces/CUD/pages/1516168526/Setting+up+SonarLint+in+VSCode+with+the+help+of+DevX-CLI) for details how this works)
3) Download [devx-cli-proxy-config.yaml](./devx-cli-proxy-config.yaml)
4) Call `./devx-cli proxy --config devx-cli-proxy-config.yaml` (change filenames if needed)
   This opens a browser to log into skyway and afterwards starts the proxy listening on localhost:2222

An MCP config like this one should work: 

```json
{
  "mcp": {
    "servers": {
      "atlassian-local": {
        "command": "docker",
        "args": [
          "run",
          "--rm",
          "-i",
          "ghcr.io/sooperset/mcp-atlassian:latest",
          "--jira-url",
          "http://host.docker.internal:2222/jira",
          "--read-only",
          "--jira-username", "unknown",
          "--jira-personal-token", "unknown",
          "--verbose"
        ]
      }
    }
  }
}
```

Notes: 
- you don't need a Jira username or PAT - it uses the user session you used in the DevX CLI
- depending on how your docker setup (this one has been tested with Colima) works, you might need to change how you reach the DevX CLI running on the host.
- this spins up the MCP Server in read-only mode by default. Remove the argument if you want MCP server to also make changes - proceed with caution though
