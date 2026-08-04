# =============================================================================
# AI-Land Target Architecture - Basic Example Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Core Infrastructure Outputs
# -----------------------------------------------------------------------------

output "aws_region" {
  description = "AWS region where resources are deployed"
  value       = var.aws_region
}

output "project_name" {
  description = "Project name"
  value       = var.project_name
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}

# -----------------------------------------------------------------------------
# AI-Land Module Outputs
# -----------------------------------------------------------------------------

output "kms_key_id" {
  description = "ID of the KMS key for AI/ML workloads"
  value       = module.ai_land.kms_key_id
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket for AI/ML data"
  value       = module.ai_land.ai_data_bucket_id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket for AI/ML data"
  value       = module.ai_land.ai_data_bucket_arn
}

# -----------------------------------------------------------------------------
# Bedrock Agent Outputs
# -----------------------------------------------------------------------------

output "agent_id" {
  description = "ID of the Bedrock agent"
  value       = module.ai_land.bedrock_agent_id
}

output "agent_arn" {
  description = "ARN of the Bedrock agent"
  value       = module.ai_land.bedrock_agent_arn
}

# -----------------------------------------------------------------------------
# Knowledge Base Outputs
# -----------------------------------------------------------------------------

output "knowledge_base_id" {
  description = "ID of the Bedrock knowledge base"
  value       = module.ai_land.bedrock_knowledge_base_id
}

output "knowledge_base_arn" {
  description = "ARN of the Bedrock knowledge base"
  value       = module.ai_land.bedrock_knowledge_base_arn
}

output "aurora_cluster_endpoint" {
  description = "Endpoint of the Aurora Serverless cluster"
  value       = module.ai_land.aurora_cluster_endpoint
}

# -----------------------------------------------------------------------------
# Monitoring Outputs
# -----------------------------------------------------------------------------

output "cloudwatch_alarms" {
  description = "CloudWatch alarms created"
  value       = module.ai_land.cloudwatch_alarms
}

output "log_groups" {
  description = "CloudWatch log groups created"
  value       = module.ai_land.log_groups_names
}

# -----------------------------------------------------------------------------
# Connection Information
# -----------------------------------------------------------------------------

output "connection_info" {
  description = "Connection information for the AI assistant"
  value = {
    agent_id              = module.ai_land.bedrock_agent_id
    knowledge_base_id     = module.ai_land.bedrock_knowledge_base_id
    s3_bucket            = module.ai_land.ai_data_bucket_id
    aurora_endpoint      = module.ai_land.aurora_cluster_endpoint
    region              = var.aws_region
  }
}

# -----------------------------------------------------------------------------
# Usage Instructions
# -----------------------------------------------------------------------------

output "usage_instructions" {
  description = "Instructions for using the deployed AI assistant"
  value = {
    setup_steps = [
      "1. Upload documents to S3 bucket: ${module.ai_land.ai_data_bucket_id}/documents/",
      "2. Wait for knowledge base indexing to complete",
      "3. Test the agent using AWS CLI or SDK",
      "4. Monitor performance using CloudWatch dashboards"
    ]
    
    test_command = "aws bedrock-agent-runtime invoke-agent --agent-id <AGENT_ID> --agent-alias-id <AGENT_ALIAS_ID> --session-id test-session --input-text 'Hello, how can you help me?'"
    
    monitoring_links = {
      cloudwatch_logs = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#logsV2:log-groups"
      bedrock_console = "https://${var.aws_region}.console.aws.amazon.com/bedrock/home?region=${var.aws_region}"
    }
  }
}

# -----------------------------------------------------------------------------
# Cost Estimation
# -----------------------------------------------------------------------------

output "estimated_monthly_costs" {
  description = "Estimated monthly costs for the basic configuration"
  value = {
    notice = "Costs are estimates and may vary based on usage"
    components = {
      aurora_serverless    = "~$10-50/month (depends on usage)"
      s3_storage           = "~$1-5/month (first 50TB)"
      cloudwatch_logs      = "~$0.50-2/month"
      kms_key             = "~$1/month"
      bedrock_usage       = "Pay per request (varies by model and usage)"
    }
    optimization_tips = [
      "Use lifecycle policies to transition old data to cheaper storage classes",
      "Set appropriate log retention periods",
      "Monitor and optimize Bedrock model usage",
      "Configure Aurora Serverless v2 scaling appropriately for your workload"
    ]
  }
}
