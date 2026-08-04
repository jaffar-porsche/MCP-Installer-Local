# AI-Land Target Architecture - Basic Example

This example demonstrates a basic implementation of the AI-Land target architecture with minimal configuration to help you get started quickly with AWS Bedrock AI services.

## Architecture Overview

This basic example deploys:

- **Core Infrastructure**: KMS key, S3 bucket, IAM roles, CloudWatch logging
- **Bedrock Agent**: AI assistant with Claude 3 Haiku model
- **Knowledge Base**: Document storage and retrieval with OpenSearch Serverless
- **Guardrails**: Basic content filtering for responsible AI
- **Monitoring**: CloudWatch alarms and logging

## Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **Terraform** >= 1.0 installed
3. **AWS Account** with Bedrock model access enabled
4. **Bedrock Model Access**: Ensure you have requested access to:
   - `anthropic.claude-3-haiku-20240307-v1:0`
   - `amazon.titan-embed-text-v1`

## Quick Start

### 1. Enable Bedrock Model Access

Before deploying, ensure you have access to the required models:

```bash
# Check model access in AWS Console
# Go to: Bedrock Console > Model Access > Request Access
```

### 2. Clone and Deploy

```bash
# Clone the repository
git clone <repository-url>
cd ai-land-target-architecture-2/examples/basic

# Initialize Terraform
terraform init

# Plan the deployment
terraform plan

# Deploy the infrastructure
terraform apply
```

### 3. Upload Test Documents

After deployment, upload some documents to test the knowledge base:

```bash
# Get the S3 bucket name from output
BUCKET_NAME=$(terraform output -raw s3_bucket_name)

# Upload test documents
aws s3 cp ./test-documents/ s3://$BUCKET_NAME/documents/ --recursive
```

### 4. Test the AI Assistant

```bash
# Get agent details
AGENT_ID=$(terraform output -json agent_id | jq -r '.["main_agent"]')
AGENT_ALIAS_ID=$(terraform output -json connection_info | jq -r '.agent_alias_id')

# Test the agent
aws bedrock-agent-runtime invoke-agent \
  --agent-id $AGENT_ID \
  --agent-alias-id $AGENT_ALIAS_ID \
  --session-id "test-session-$(date +%s)" \
  --input-text "Hello, what can you help me with?" \
  response.json

# View the response
cat response.json
```

## Configuration

### Variables

Key variables you can customize:

| Variable | Description | Default |
|----------|-------------|---------|
| `aws_region` | AWS region for deployment | `us-east-1` |
| `project_name` | Name prefix for resources | `ai-land-basic` |
| `environment` | Environment name | `dev` |
| `owner` | Resource owner tag | `ai-team` |

### Customization

Create a `terraform.tfvars` file to customize your deployment:

```hcl
# terraform.tfvars
aws_region   = "us-west-2"
project_name = "my-ai-assistant"
environment  = "dev"
owner        = "my-team"
```

## Architecture Components

### 1. Bedrock Agent
- **Model**: Claude 3 Haiku (cost-effective and fast)
- **Purpose**: General-purpose AI assistant
- **Capabilities**: Question answering, document analysis

### 2. Knowledge Base
- **Storage**: OpenSearch Serverless
- **Embedding**: Amazon Titan Embed Text v1
- **Chunking**: Fixed-size (300 tokens, 20% overlap)
- **Content**: Documents from S3 `/documents/` prefix

### 3. Guardrails
- **Content Filtering**: Hate speech and violence detection
- **Strength**: Medium filtering for input/output
- **Purpose**: Ensure responsible AI behavior

### 4. Monitoring
- **Logs**: CloudWatch log groups with 14-day retention
- **Alarms**: Error monitoring for agent and knowledge base
- **Metrics**: Performance and usage tracking

## Usage Patterns

### Document Upload
Upload documents to enable Q&A capabilities:

```bash
# Upload PDF, TXT, or DOC files
aws s3 cp document.pdf s3://$BUCKET_NAME/documents/
```

### Agent Interaction
Interact with the agent programmatically:

```python
import boto3

client = boto3.client('bedrock-agent-runtime')

response = client.invoke_agent(
    agentId='your-agent-id',
    agentAliasId='your-agent-alias-id',
    sessionId='unique-session-id',
    inputText='What is the main topic of the uploaded documents?'
)
```

### Knowledge Base Querying
Query the knowledge base directly:

```python
import boto3

client = boto3.client('bedrock-agent-runtime')

response = client.retrieve(
    knowledgeBaseId='your-kb-id',
    retrievalQuery={
        'text': 'machine learning best practices'
    }
)
```

## Monitoring and Troubleshooting

### CloudWatch Logs
Monitor application logs:
- `/aws/bedrock/agent/basic-ai-assistant`
- `/aws/bedrock/knowledge-base/basic-knowledge-base`

### CloudWatch Alarms
Check for alerts on:
- Agent invocation errors
- Knowledge base ingestion failures
- High latency warnings

### Common Issues

1. **Model Access Denied**
   - Solution: Request model access in Bedrock console

2. **Knowledge Base Empty**
   - Solution: Upload documents to S3 `/documents/` folder
   - Wait for indexing to complete (5-10 minutes)

3. **Agent Timeout**
   - Solution: Check CloudWatch logs for specific errors
   - Verify IAM permissions

## Cost Optimization

### Expected Monthly Costs
- **OpenSearch Serverless**: $5-20 (based on data volume)
- **S3 Storage**: $1-5 (first 50TB)
- **CloudWatch**: $0.50-2
- **KMS**: $1
- **Bedrock Usage**: Pay-per-request (varies by usage)

### Optimization Tips
1. Use S3 lifecycle policies for old documents
2. Set appropriate log retention periods
3. Monitor Bedrock usage patterns
4. Use development/testing schedules to reduce costs

## Security Features

- **Encryption**: KMS encryption for all data at rest
- **IAM**: Least-privilege access controls
- **VPC**: Uses default VPC (customizable)
- **Guardrails**: Content filtering enabled
- **Audit**: CloudTrail logging enabled

## Next Steps

After deploying the basic example:

1. **Explore Advanced Features**: Check the `/examples/advanced/` folder
2. **Customize Guardrails**: Add more sophisticated content policies
3. **Add Data Automation**: Implement automated document processing
4. **Scale Up**: Move to production-ready configurations

## Support and Troubleshooting

### Getting Help
- Check CloudWatch logs for detailed error messages
- Review AWS Bedrock documentation
- Consult the main README for architecture details

### Clean Up
To remove all resources:

```bash
terraform destroy
```

**Note**: This will delete all resources including S3 buckets and their contents. Ensure you have backups of important data.

## Contributing

To improve this example:
1. Fork the repository
2. Make your changes
3. Test thoroughly
4. Submit a pull request

For issues or questions, please open an issue in the main repository.
