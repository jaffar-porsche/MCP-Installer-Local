# =============================================================================
# Bedrock Knowledge Base Plugin - Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Knowledge Base Outputs
# -----------------------------------------------------------------------------

output "knowledge_base_id" {
  description = "ID of the Bedrock knowledge base"
  value       = aws_bedrockagent_knowledge_base.main.id
}

output "knowledge_base_arn" {
  description = "ARN of the Bedrock knowledge base"
  value       = aws_bedrockagent_knowledge_base.main.arn
}

output "knowledge_base_name" {
  description = "Name of the Bedrock knowledge base"
  value       = aws_bedrockagent_knowledge_base.main.name
}

output "knowledge_base_status" {
  description = "Status of the Bedrock knowledge base"
  value       = "ACTIVE"  # Static value since status attribute is not available
}

# -----------------------------------------------------------------------------
# Data Source Outputs
# -----------------------------------------------------------------------------

output "data_source_id" {
  description = "ID of the knowledge base data source"
  value       = aws_bedrockagent_data_source.main.data_source_id
}

output "data_source_name" {
  description = "Name of the knowledge base data source"
  value       = aws_bedrockagent_data_source.main.name
}

output "data_source_status" {
  description = "Status of the knowledge base data source"
  value       = "AVAILABLE"  # Static value since status attribute is not available
}

# -----------------------------------------------------------------------------
# IAM Role Outputs
# -----------------------------------------------------------------------------

output "knowledge_base_role_arn" {
  description = "ARN of the knowledge base IAM role"
  value       = aws_iam_role.knowledge_base_role.arn
}

output "knowledge_base_role_name" {
  description = "Name of the knowledge base IAM role"
  value       = aws_iam_role.knowledge_base_role.name
}

# -----------------------------------------------------------------------------
# Aurora Serverless Outputs
# -----------------------------------------------------------------------------

output "aurora_cluster_id" {
  description = "ID of the Aurora Serverless cluster"
  value       = aws_rds_cluster.aurora_kb_cluster.id
}

output "aurora_cluster_arn" {
  description = "ARN of the Aurora Serverless cluster"
  value       = aws_rds_cluster.aurora_kb_cluster.arn
}

output "aurora_cluster_endpoint" {
  description = "Endpoint of the Aurora Serverless cluster"
  value       = aws_rds_cluster.aurora_kb_cluster.endpoint
}

output "aurora_cluster_reader_endpoint" {
  description = "Reader endpoint of the Aurora Serverless cluster"
  value       = aws_rds_cluster.aurora_kb_cluster.reader_endpoint
}

output "aurora_cluster_port" {
  description = "Port of the Aurora Serverless cluster"
  value       = aws_rds_cluster.aurora_kb_cluster.port
}

output "aurora_database_name" {
  description = "Database name of the Aurora Serverless cluster"
  value       = aws_rds_cluster.aurora_kb_cluster.database_name
}

output "aurora_master_user_secret_arn" {
  description = "ARN of the Aurora master user secret"
  value       = aws_rds_cluster.aurora_kb_cluster.master_user_secret[0].secret_arn
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Storage Configuration Outputs
# -----------------------------------------------------------------------------

output "storage_configuration" {
  description = "Storage configuration details"
  value = {
    storage_type = var.storage_type
    vector_field   = var.aurora_config.vector_field
    text_field     = var.aurora_config.text_field
    metadata_field = var.aurora_config.metadata_field
  }
}

# -----------------------------------------------------------------------------
# Monitoring Outputs
# -----------------------------------------------------------------------------

output "kb_log_group_name" {
  description = "Name of the knowledge base CloudWatch log group"
  value       = module.knowledge_base_logs.log_group.name
}

output "kb_log_group_arn" {
  description = "ARN of the knowledge base CloudWatch log group"
  value       = module.knowledge_base_logs.log_group.arn
}

output "kb_alarm_arns" {
  description = "ARNs of CloudWatch alarms"
  value = {
    ingestion_errors   = var.enable_monitoring ? aws_cloudwatch_metric_alarm.kb_ingestion_errors[0].arn : null
    retrieval_latency = var.enable_monitoring ? aws_cloudwatch_metric_alarm.kb_retrieval_latency[0].arn : null
  }
}

# -----------------------------------------------------------------------------
# Configuration Outputs
# -----------------------------------------------------------------------------

output "knowledge_base_configuration" {
  description = "Knowledge base configuration details"
  value = {
    embedding_model   = local.kb_config.embedding_model
    chunking_strategy = local.kb_config.chunking_strategy
    max_tokens       = local.kb_config.max_tokens
    overlap_percentage = local.kb_config.overlap_percentage
  }
}

output "vector_ingestion_configuration" {
  description = "Vector ingestion configuration details"
  value = {
    chunking_strategy    = local.kb_config.chunking_strategy
    max_tokens          = local.kb_config.max_tokens
    overlap_percentage  = local.kb_config.overlap_percentage
    custom_transformation_enabled = var.custom_transformation_config != null
    parsing_strategy_enabled     = var.parsing_config != null
  }
}

# -----------------------------------------------------------------------------
# Connection Information
# -----------------------------------------------------------------------------

output "connection_info" {
  description = "Connection information for external integrations"
  value = {
    knowledge_base_id = aws_bedrockagent_knowledge_base.main.id
    storage_type     = var.storage_type
    
    # Aurora connection info (excluding sensitive data)
    aurora_endpoint = aws_rds_cluster.aurora_kb_cluster.endpoint
    aurora_port     = aws_rds_cluster.aurora_kb_cluster.port
    aurora_database = aws_rds_cluster.aurora_kb_cluster.database_name
    aurora_table    = var.aurora_config.table_name
  }
  sensitive = false
}

# -----------------------------------------------------------------------------
# Plugin Information
# -----------------------------------------------------------------------------

output "kb_plugin_info" {
  description = "Plugin information and metadata"
  value = {
    plugin_name    = "bedrock-knowledge-base-plugin"
    plugin_version = "1.0.0"
    terraform_version = ">= 1.0"
    aws_provider_version = ">= 5.0"
    storage_backends_supported = [
      "aurora_serverless"
    ]
    created_resources = [
      "aws_bedrockagent_knowledge_base",
      "aws_bedrockagent_data_source",
      "aws_iam_role",
      "aws_iam_role_policy",
      "module.knowledge_base_logs (CBBaC CloudWatch)",
      "aws_cloudwatch_metric_alarm",
      "aws_rds_cluster"
    ]
  }
}
