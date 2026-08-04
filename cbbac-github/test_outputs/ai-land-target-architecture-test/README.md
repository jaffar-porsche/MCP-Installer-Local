# AI-Land Target Architecture

This target architecture provides a comprehensive AI infrastructure using Amazon Bedrock, OpenSearch Serverless, and supporting AWS services. It includes knowledge bases, agents, guardrails, and data automation capabilities optimized for generative AI workloads.

## Architecture Overview

The AI-Land target architecture consists of:

### Core Components
- **Bedrock Base Architecture**: S3 bucket, AI KMS key, base AaC components (Secrets Manager, CloudWatch)
- **Bedrock Agent**: Configurable AI agent with custom instructions and models
- **Knowledge Base**: Vector search using OpenSearch Serverless or Aurora PostgreSQL with pgvector
- **Guardrails**: Content filtering and safety controls

### Submodules
- **Guardrails**: Content policy, word filtering, topic controls
- **Data Automation**: Bedrock Data Automation for document processing
- **Model Evaluation**: Framework for model performance assessment
- **RAG Evaluation**: Retrieval-Augmented Generation evaluation tools

### Plugins
- **Agent Plugin**: Bedrock agent configuration with action groups and knowledge base integration
- **Knowledge Base Plugin**: Aurora Serverless + Vector Store, Bedrock Knowledge Base, S3 bucket integration

## Module Usage

### Basic Usage

```hcl
module "ai_land" {
  source = "./ai-land-target-architecture-2"
  
  # Core Configuration
  application_name    = "my-ai-app"
  environment        = "dev"
  region            = "us-east-1"
  
  # Bedrock Configuration
  bedrock_agent_enabled = true
  agent_foundation_model = "anthropic.claude-3-5-sonnet-20241022-v2:0"
  agent_instruction = "You are an AI assistant specialized in helping with customer support inquiries."
  
  # Knowledge Base Configuration
  knowledge_base_enabled = true
  knowledge_base_type    = "opensearch" # or "aurora"
  
  # Security Configuration
  guardrails_enabled = true
  
  # Tags
  tags = {
    Project = "AI-Land"
    Owner   = "AI-Team"
  }
}
```

### Advanced Configuration

```hcl
module "ai_land" {
  source = "./ai-land-target-architecture-2"
  
  # Core Configuration
  application_name = "enterprise-ai"
  environment     = "prod"
  region         = "us-east-1"
  
  # Bedrock Agent Configuration
  bedrock_agent_enabled = true
  agent_name = "enterprise-ai-agent"
  agent_foundation_model = "anthropic.claude-3-5-sonnet-20241022-v2:0"
  agent_instruction = "You are an enterprise AI assistant with access to company knowledge bases and specialized in providing accurate, contextual responses."
  agent_idle_session_ttl = 900
  
  # Knowledge Base Configuration
  knowledge_base_enabled = true
  knowledge_base_type = "opensearch"
  kb_embedding_model_arn = "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0"
  
  # OpenSearch Configuration
  opensearch_create_vector_index = true
  opensearch_allow_public_access = false
  
  # Aurora Configuration (if using aurora type)
  aurora_instance_class = "db.serverless"
  aurora_engine_version = "13.7"
  
  # Guardrails Configuration
  guardrails_enabled = true
  guardrail_name = "enterprise-guardrails"
  blocked_input_messaging = "This content violates our enterprise policies."
  blocked_outputs_messaging = "I cannot provide that information due to enterprise policies."
  
  # Data Automation
  data_automation_enabled = true
  bda_project_name = "enterprise-document-processing"
  
  # Security
  kms_key_deletion_window_in_days = 30
  
  # Monitoring
  cloudwatch_log_retention_days = 90
  
  # Tags
  tags = {
    Project     = "Enterprise-AI"
    Environment = "production"
    Owner       = "AI-Platform-Team"
    CostCenter  = "AI-Innovation"
  }
}
```

## Architecture Components

### 1. Base Architecture
- **S3 Bucket**: Secure storage for AI data, documents, and model artifacts
- **KMS Key**: Dedicated encryption key for AI services
- **Secrets Manager**: Secure storage for API keys and credentials
- **CloudWatch**: Monitoring and logging for AI services

### 2. Bedrock Services
- **Agent**: Conversational AI with custom instructions and capabilities
- **Knowledge Base**: Vector search and retrieval system
- **Guardrails**: Content safety and policy enforcement
- **Data Automation**: Automated document processing and extraction

### 3. Vector Storage Options
- **OpenSearch Serverless**: Managed vector search service
- **Aurora PostgreSQL**: Serverless database with pgvector extension

### 4. Security Features
- End-to-end encryption using AWS KMS
- IAM roles with least privilege access
- VPC integration for network isolation
- Audit logging via CloudTrail

## File Structure

```
ai-land-target-architecture-2/
├── README.md
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── versions.tf
│   ├── data.tf
│   └── locals.tf
├── plugins/
│   ├── bedrock_agent_plugin.tf
│   ├── bedrock_knowledge_base_plugin.tf
│   ├── variables.tf
│   └── outputs.tf
├── submodules/
│   ├── guardrails/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── data_automation/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── model_evaluation/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── rag_evaluation/
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
└── examples/
    ├── basic/
    │   ├── main.tf
    │   ├── variables.tf
    │   ├── outputs.tf
    │   └── versions.tf
    └── advanced/
        ├── main.tf
        ├── variables.tf
        ├── outputs.tf
        └── versions.tf
```

## Prerequisites

1. AWS CLI configured with appropriate permissions
2. Terraform >= 1.5.0
3. Access to Amazon Bedrock service
4. OpenSearch provider (if using OpenSearch Serverless)

## Outputs

The module provides comprehensive outputs including:
- Bedrock agent ARN and configuration
- Knowledge base identifiers and endpoints
- S3 bucket details
- KMS key information
- IAM role ARNs
- Monitoring resources

## Contributing

This target architecture follows CBBaC (Cloud Building Blocks as Code) patterns and integrates with the broader AWS AAC (AWS Application Architecture Components) ecosystem.

## License

This target architecture is provided under the standard AWS customer agreement terms.
