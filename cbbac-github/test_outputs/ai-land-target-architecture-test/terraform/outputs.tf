# =============================================================================
# AI-Land Target Architecture - Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Core Infrastructure Outputs
# -----------------------------------------------------------------------------

output "account_id" {
  description = "AWS Account ID"
  value       = local.account_id
}

output "region" {
  description = "AWS Region"
  value       = local.region
}

output "vpc_id" {
  description = "VPC ID used for resources"
  value       = local.vpc_id
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}

# -----------------------------------------------------------------------------
# KMS Key Outputs
# -----------------------------------------------------------------------------

output "kms_key_id" {
  description = "ID of the KMS key for AI/ML workloads"
  value       = var.enable_ai_kms_key ? module.ai_kms_key[0].kms_key.key_id : null
}

output "kms_key_arn" {
  description = "ARN of the KMS key for AI/ML workloads"
  value       = var.enable_ai_kms_key ? module.ai_kms_key[0].kms_key.arn : null
}

output "kms_key_alias" {
  description = "Alias of the KMS key for AI/ML workloads"
  value       = var.enable_ai_kms_key ? module.ai_kms_key[0].kms_alias.name : null
}

# -----------------------------------------------------------------------------
# S3 Bucket Outputs
# -----------------------------------------------------------------------------

output "ai_data_bucket_id" {
  description = "ID of the S3 bucket for AI/ML data"
  value       = var.enable_s3_bucket ? module.ai_data_bucket[0].bucket.id : null
}

output "ai_data_bucket_arn" {
  description = "ARN of the S3 bucket for AI/ML data"
  value       = var.enable_s3_bucket ? module.ai_data_bucket[0].bucket.arn : null
}

output "ai_data_bucket_domain_name" {
  description = "Bucket domain name for S3 bucket"
  value       = var.enable_s3_bucket ? module.ai_data_bucket[0].bucket.bucket_domain_name : null
}

output "ai_data_bucket_hosted_zone_id" {
  description = "Hosted zone ID for S3 bucket"
  value       = var.enable_s3_bucket ? module.ai_data_bucket[0].bucket.hosted_zone_id : null
}

# -----------------------------------------------------------------------------
# Secrets Manager Outputs
# -----------------------------------------------------------------------------

output "secrets_arns" {
  description = "ARNs of created secrets"
  value = {
    for k, v in module.ai_secrets : k => v.secret_arn
  }
}

output "secrets_names" {
  description = "Names of created secrets"
  value = {
    for k, v in module.ai_secrets : k => v.secret_name
  }
}

# -----------------------------------------------------------------------------
# CloudWatch Log Groups Outputs
# -----------------------------------------------------------------------------

output "log_groups_arns" {
  description = "ARNs of CloudWatch log groups"
  value = {
    for k, v in module.ai_logs : k => v.log_group.arn
  }
}

output "log_groups_names" {
  description = "Names of CloudWatch log groups"
  value = {
    for k, v in module.ai_logs : k => v.log_group.name
  }
}

# -----------------------------------------------------------------------------
# IAM Role Outputs
# -----------------------------------------------------------------------------

output "bedrock_service_role_arn" {
  description = "ARN of the Bedrock service role"
  value       = var.enable_bedrock ? aws_iam_role.bedrock_service_role[0].arn : null
}

output "bedrock_service_role_name" {
  description = "Name of the Bedrock service role"
  value       = var.enable_bedrock ? aws_iam_role.bedrock_service_role[0].name : null
}

output "agent_execution_role_arn" {
  description = "ARN of the agent execution role"
  value       = var.enable_agent_module ? aws_iam_role.agent_execution_role[0].arn : null
}

output "agent_execution_role_name" {
  description = "Name of the agent execution role"
  value       = var.enable_agent_module ? aws_iam_role.agent_execution_role[0].name : null
}

output "lambda_execution_roles" {
  description = "ARNs of Lambda execution roles"
  value = {
    for k, v in aws_iam_role.lambda_execution_role : k => v.arn
  }
}

# -----------------------------------------------------------------------------
# Bedrock Direct Resource Outputs
# -----------------------------------------------------------------------------

output "bedrock_knowledge_base_id" {
  description = "ID of the Bedrock knowledge base"
  value       = var.enable_knowledge_base_module ? aws_bedrockagent_knowledge_base.main[0].id : null
}

output "bedrock_knowledge_base_arn" {
  description = "ARN of the Bedrock knowledge base"
  value       = var.enable_knowledge_base_module ? aws_bedrockagent_knowledge_base.main[0].arn : null
}

output "bedrock_knowledge_base_name" {
  description = "Name of the Bedrock knowledge base"
  value       = var.enable_knowledge_base_module ? aws_bedrockagent_knowledge_base.main[0].name : null
}

output "bedrock_data_source_id" {
  description = "ID of the Bedrock data source"
  value       = var.enable_knowledge_base_module ? aws_bedrockagent_data_source.s3_source[0].data_source_id : null
}

output "bedrock_agent_id" {
  description = "ID of the Bedrock agent"
  value       = var.enable_agent_module ? aws_bedrockagent_agent.main[0].id : null
}

output "bedrock_agent_arn" {
  description = "ARN of the Bedrock agent"
  value       = var.enable_agent_module ? aws_bedrockagent_agent.main[0].agent_arn : null
}

output "bedrock_agent_name" {
  description = "Name of the Bedrock agent"
  value       = var.enable_agent_module ? aws_bedrockagent_agent.main[0].agent_name : null
}

output "bedrock_agent_alias_id" {
  description = "ID of the Bedrock agent alias"
  value       = var.enable_agent_module ? aws_bedrockagent_agent_alias.main[0].id : null
}

output "bedrock_agent_alias_arn" {
  description = "ARN of the Bedrock agent alias"
  value       = var.enable_agent_module ? aws_bedrockagent_agent_alias.main[0].agent_alias_arn : null
}

# -----------------------------------------------------------------------------
# Aurora Serverless PostgreSQL Outputs
# -----------------------------------------------------------------------------

output "aurora_cluster_id" {
  description = "ID of the Aurora Serverless cluster"
  value       = var.enable_knowledge_base_module && var.knowledge_base_config.storage_type == "aurora_serverless" ? module.aurora_serverless_postgres[0].rds_cluster_identifier : null
}

output "aurora_cluster_arn" {
  description = "ARN of the Aurora Serverless cluster"
  value       = var.enable_knowledge_base_module && var.knowledge_base_config.storage_type == "aurora_serverless" ? module.aurora_serverless_postgres[0].rds_cluster.arn : null
}

output "aurora_cluster_endpoint" {
  description = "Endpoint of the Aurora Serverless cluster"
  value       = var.enable_knowledge_base_module && var.knowledge_base_config.storage_type == "aurora_serverless" ? module.aurora_serverless_postgres[0].rds_cluster_writer_endpoint : null
}

output "aurora_cluster_reader_endpoint" {
  description = "Reader endpoint of the Aurora Serverless cluster"
  value       = var.enable_knowledge_base_module && var.knowledge_base_config.storage_type == "aurora_serverless" ? module.aurora_serverless_postgres[0].rds_cluster_reader_endpoint : null
}

output "aurora_cluster_port" {
  description = "Port of the Aurora Serverless cluster"
  value       = var.enable_knowledge_base_module && var.knowledge_base_config.storage_type == "aurora_serverless" ? module.aurora_serverless_postgres[0].rds_cluster_port : null
}

output "aurora_cluster_database_name" {
  description = "Database name of the Aurora Serverless cluster"
  value       = var.enable_knowledge_base_module && var.knowledge_base_config.storage_type == "aurora_serverless" ? module.aurora_serverless_postgres[0].rds_cluster.database_name : null
}

output "aurora_cluster_master_username" {
  description = "Master username of the Aurora Serverless cluster"
  value       = var.enable_knowledge_base_module && var.knowledge_base_config.storage_type == "aurora_serverless" ? module.aurora_serverless_postgres[0].rds_cluster.master_username : null
  sensitive   = true
}

output "aurora_cluster_master_user_secret_arn" {
  description = "ARN of the master user secret"
  value       = var.enable_knowledge_base_module && var.knowledge_base_config.storage_type == "aurora_serverless" ? module.aurora_serverless_postgres[0].database_secret_arn : null
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Security Group Outputs
# -----------------------------------------------------------------------------

output "aurora_security_group_id" {
  description = "ID of the Aurora security group"
  value       = var.aurora_enabled ? module.aurora_security_group[0].security_group_id : null
}

output "aurora_security_group_arn" {
  description = "ARN of the Aurora security group"
  value       = var.aurora_enabled ? module.aurora_security_group[0].security_group_arn : null
}

# -----------------------------------------------------------------------------
# Lambda Function Outputs
# -----------------------------------------------------------------------------

output "lambda_functions" {
  description = "Lambda functions created for agent action groups"
  value = {
    for k, v in aws_lambda_function.agent_action_function : k => {
      function_name = v.function_name
      function_arn  = v.arn
      invoke_arn    = v.invoke_arn
      qualified_arn = v.qualified_arn
      version       = v.version
      last_modified = v.last_modified
    }
  }
}

output "lambda_function_arns" {
  description = "ARNs of Lambda functions"
  value = {
    for k, v in aws_lambda_function.agent_action_function : k => v.arn
  }
}

output "lambda_function_invoke_arns" {
  description = "Invoke ARNs of Lambda functions"
  value = {
    for k, v in aws_lambda_function.agent_action_function : k => v.invoke_arn
  }
}

# -----------------------------------------------------------------------------
# CloudWatch Monitoring Outputs
# -----------------------------------------------------------------------------

output "cloudwatch_alarms" {
  description = "CloudWatch alarms created"
  value = {
    bedrock_throttling = var.enable_bedrock && var.monitoring_config.enable_alarms ? aws_cloudwatch_metric_alarm.bedrock_throttling[0].arn : null
    agent_errors       = var.enable_agent_module && var.monitoring_config.enable_alarms ? aws_cloudwatch_metric_alarm.agent_errors[0].arn : null
  }
}

# -----------------------------------------------------------------------------
# Computed Values Outputs
# -----------------------------------------------------------------------------

output "name_prefix" {
  description = "Name prefix used for resources"
  value       = local.name_prefix
}

output "common_tags" {
  description = "Common tags applied to resources"
  value       = local.common_tags
}

# -----------------------------------------------------------------------------
# Module Information Outputs
# -----------------------------------------------------------------------------

output "enabled_modules" {
  description = "List of enabled modules and submodules"
  value = {
    bedrock                    = var.enable_bedrock
    agent_module               = var.enable_agent_module
    knowledge_base_module      = var.enable_knowledge_base_module
    guardrails_submodule       = var.enable_guardrails_submodule
    data_automation_submodule  = var.enable_data_automation_submodule
    model_evaluation_submodule = var.enable_model_evaluation_submodule
    rag_evaluation_submodule   = var.enable_rag_evaluation_submodule
  }
}

output "storage_configuration" {
  description = "Storage configuration details"
  value = {
    s3_bucket_enabled      = var.enable_s3_bucket
    knowledge_base_storage = var.enable_knowledge_base_module ? var.knowledge_base_config.storage_type : null
    kms_encryption_enabled = var.enable_ai_kms_key
  }
}

# -----------------------------------------------------------------------------
# Connection Information (for external integrations)
# -----------------------------------------------------------------------------

output "connection_info" {
  description = "Connection information for external integrations"
  value = {
    bedrock_region = local.region
    s3_bucket_name = var.enable_s3_bucket ? module.ai_data_bucket[0].bucket.id : null

    # Aurora connection info (excluding sensitive data)
    aurora_endpoint = var.aurora_enabled ? module.aurora_serverless_postgres[0].rds_cluster_writer_endpoint : null
    aurora_port     = var.aurora_enabled ? module.aurora_serverless_postgres[0].rds_cluster_port : null
    aurora_database = var.aurora_enabled ? module.aurora_serverless_postgres[0].rds_cluster.database_name : null
  }
  sensitive = false
}

# -----------------------------------------------------------------------------
# Cost Optimization Information
# -----------------------------------------------------------------------------

output "cost_optimization_info" {
  description = "Information about cost optimization features"
  value = {
    lifecycle_policies_enabled = var.enable_s3_bucket && var.lifecycle_config.enable_lifecycle
    aurora_serverless_scaling = var.aurora_enabled ? {
      min_capacity = var.aurora_config.min_capacity
      max_capacity = var.aurora_config.max_capacity
    } : null
  }
}
