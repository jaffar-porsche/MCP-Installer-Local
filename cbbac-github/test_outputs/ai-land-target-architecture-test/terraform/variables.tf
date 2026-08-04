# AI-Land Target Architecture Variables
# This file defines all input variables for the AI-Land target architecture

#################################
# Core Configuration Variables
#################################

variable "application_name" {
  description = "The name of the application. This will be used as a prefix for all resources."
  type        = string
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]*$", var.application_name))
    error_message = "Application name must start with a letter and contain only alphanumeric characters and hyphens."
  }
}

variable "environment" {
  description = "The environment name (e.g., dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod", "test"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod, test."
  }
}

variable "region" {
  description = "The AWS region where resources will be created"
  type        = string
  default     = "us-east-1"
}

variable "availability_zones" {
  description = "List of availability zones to use"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "A map of tags to assign to all resources"
  type        = map(string)
  default     = {}
}

#################################
# Networking Configuration
#################################

variable "vpc_enabled" {
  description = "Whether to create a VPC for the AI-Land architecture"
  type        = bool
  default     = true
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
}

#################################
# Security Configuration
#################################

variable "kms_key_deletion_window_in_days" {
  description = "The waiting period, specified in number of days, after which the KMS key is deleted"
  type        = number
  default     = 7
  validation {
    condition     = var.kms_key_deletion_window_in_days >= 7 && var.kms_key_deletion_window_in_days <= 30
    error_message = "KMS key deletion window must be between 7 and 30 days."
  }
}

variable "enable_kms_key_rotation" {
  description = "Whether to enable automatic KMS key rotation"
  type        = bool
  default     = true
}

#################################
# S3 Configuration
#################################

variable "s3_bucket_name" {
  description = "Name for the S3 bucket. If not provided, will be auto-generated"
  type        = string
  default     = null
}

variable "s3_versioning_enabled" {
  description = "Whether to enable S3 bucket versioning"
  type        = bool
  default     = true
}

variable "s3_lifecycle_enabled" {
  description = "Whether to enable S3 lifecycle management"
  type        = bool
  default     = true
}

variable "s3_transition_to_ia_days" {
  description = "Number of days before transitioning objects to IA storage class"
  type        = number
  default     = 30
}

variable "s3_transition_to_glacier_days" {
  description = "Number of days before transitioning objects to Glacier storage class"
  type        = number
  default     = 90
}

#################################
# Bedrock Agent Configuration
#################################

variable "bedrock_agent_enabled" {
  description = "Whether to create a Bedrock agent"
  type        = bool
  default     = true
}

variable "agent_name" {
  description = "Name for the Bedrock agent"
  type        = string
  default     = null
}

variable "agent_foundation_model" {
  description = "The foundation model for the Bedrock agent"
  type        = string
  default     = "anthropic.claude-3-5-sonnet-20241022-v2:0"
}

variable "agent_instruction" {
  description = "Instructions for the Bedrock agent"
  type        = string
  default     = "You are an AI assistant designed to help users with various tasks using available knowledge bases and tools."
  validation {
    condition     = length(var.agent_instruction) >= 40
    error_message = "Agent instruction must be at least 40 characters long."
  }
}

variable "agent_description" {
  description = "Description of the Bedrock agent"
  type        = string
  default     = "AI-Land Bedrock Agent for intelligent assistance"
}

variable "agent_idle_session_ttl" {
  description = "How long sessions should be kept open for the agent (in seconds)"
  type        = number
  default     = 600
}

variable "agent_temperature" {
  description = "Temperature setting for the agent model (0.0 to 1.0)"
  type        = number
  default     = 0.1
  validation {
    condition     = var.agent_temperature >= 0 && var.agent_temperature <= 1
    error_message = "Agent temperature must be between 0 and 1."
  }
}

variable "agent_top_p" {
  description = "Top-p setting for the agent model (0.0 to 1.0)"
  type        = number
  default     = 0.9
  validation {
    condition     = var.agent_top_p >= 0 && var.agent_top_p <= 1
    error_message = "Agent top_p must be between 0 and 1."
  }
}

variable "agent_max_tokens" {
  description = "Maximum number of tokens for agent responses"
  type        = number
  default     = 2048
}

variable "create_agent_alias" {
  description = "Whether to create an agent alias"
  type        = bool
  default     = true
}

variable "agent_alias_name" {
  description = "Name for the agent alias"
  type        = string
  default     = null
}

#################################
# Knowledge Base Configuration
#################################

variable "knowledge_base_enabled" {
  description = "Whether to create a knowledge base"
  type        = bool
  default     = true
}

variable "knowledge_base_type" {
  description = "Type of knowledge base storage (aurora only supported)"
  type        = string
  default     = "aurora"
  validation {
    condition     = var.knowledge_base_type == "aurora"
    error_message = "Knowledge base type must be 'aurora'. OpenSearch is no longer supported."
  }
}

variable "kb_name" {
  description = "Name for the knowledge base"
  type        = string
  default     = null
}

variable "kb_description" {
  description = "Description for the knowledge base"
  type        = string
  default     = "AI-Land Knowledge Base for vector search and retrieval"
}

variable "kb_embedding_model_arn" {
  description = "ARN of the embedding model for the knowledge base"
  type        = string
  default     = "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0"
}

variable "create_s3_data_source" {
  description = "Whether to create an S3 data source for the knowledge base"
  type        = bool
  default     = true
}

variable "chunking_strategy" {
  description = "Chunking strategy for data processing (FIXED_SIZE, NONE, HIERARCHICAL, SEMANTIC)"
  type        = string
  default     = "FIXED_SIZE"
  validation {
    condition     = contains(["FIXED_SIZE", "NONE", "HIERARCHICAL", "SEMANTIC"], var.chunking_strategy)
    error_message = "Chunking strategy must be one of: FIXED_SIZE, NONE, HIERARCHICAL, SEMANTIC."
  }
}

variable "chunk_max_tokens" {
  description = "Maximum number of tokens per chunk"
  type        = number
  default     = 300
}

variable "chunk_overlap_percentage" {
  description = "Percentage of overlap between chunks"
  type        = number
  default     = 20
}

#################################
# Aurora Configuration
#################################

variable "aurora_enabled" {
  description = "Whether to create Aurora PostgreSQL cluster (when knowledge_base_type is aurora)"
  type        = bool
  default     = true
}

variable "aurora_engine_version" {
  description = "Aurora PostgreSQL engine version"
  type        = string
  default     = "13.7"
}

variable "aurora_instance_class" {
  description = "Aurora instance class"
  type        = string
  default     = "db.serverless"
}

variable "aurora_database_name" {
  description = "Name of the database to create in Aurora"
  type        = string
  default     = "ailand"
}

variable "aurora_master_username" {
  description = "Master username for Aurora"
  type        = string
  default     = "ailandadmin"
}

variable "aurora_backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 7
}

variable "aurora_preferred_backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "aurora_preferred_maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

#################################
# Guardrails Configuration
#################################

variable "guardrails_enabled" {
  description = "Whether to create Bedrock guardrails"
  type        = bool
  default     = true
}

variable "guardrail_name" {
  description = "Name for the guardrail"
  type        = string
  default     = null
}

variable "guardrail_description" {
  description = "Description for the guardrail"
  type        = string
  default     = "AI-Land content safety guardrails"
}

variable "blocked_input_messaging" {
  description = "Message when input is blocked by guardrails"
  type        = string
  default     = "I cannot process this request as it violates our content policy."
}

variable "blocked_outputs_messaging" {
  description = "Message when output is blocked by guardrails"
  type        = string
  default     = "I cannot provide that information as it violates our content policy."
}

variable "content_filter_strength" {
  description = "Strength level for content filtering (NONE, LOW, MEDIUM, HIGH)"
  type        = string
  default     = "MEDIUM"
  validation {
    condition     = contains(["NONE", "LOW", "MEDIUM", "HIGH"], var.content_filter_strength)
    error_message = "Content filter strength must be one of: NONE, LOW, MEDIUM, HIGH."
  }
}

#################################
# Data Automation Configuration
#################################

variable "data_automation_enabled" {
  description = "Whether to enable Bedrock Data Automation"
  type        = bool
  default     = false
}

variable "bda_project_name" {
  description = "Name for the Bedrock Data Automation project"
  type        = string
  default     = null
}

variable "bda_project_description" {
  description = "Description for the BDA project"
  type        = string
  default     = "AI-Land data automation project for document processing"
}

#################################
# CloudWatch Configuration
#################################

variable "cloudwatch_log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 30
  validation {
    condition = contains([
      1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653
    ], var.cloudwatch_log_retention_days)
    error_message = "CloudWatch log retention days must be a valid value."
  }
}

variable "enable_detailed_monitoring" {
  description = "Whether to enable detailed monitoring for resources"
  type        = bool
  default     = true
}

#################################
# Lambda Configuration (for Action Groups)
#################################

variable "lambda_functions_enabled" {
  description = "Whether to create Lambda functions for agent action groups"
  type        = bool
  default     = false
}

variable "lambda_runtime" {
  description = "Runtime for Lambda functions"
  type        = string
  default     = "python3.11"
}

variable "lambda_timeout" {
  description = "Timeout for Lambda functions in seconds"
  type        = number
  default     = 60
}

variable "lambda_memory_size" {
  description = "Memory size for Lambda functions in MB"
  type        = number
  default     = 256
}

#################################
# Action Groups Configuration
#################################

variable "action_groups_enabled" {
  description = "Whether to create action groups for the agent"
  type        = bool
  default     = false
}

variable "action_groups" {
  description = "List of action groups to create"
  type = list(object({
    name        = string
    description = string
    lambda_name = optional(string)
    schema      = optional(string)
  }))
  default = []
}

#################################
# Monitoring and Alerting
#################################

variable "sns_notifications_enabled" {
  description = "Whether to enable SNS notifications for monitoring"
  type        = bool
  default     = false
}

variable "notification_email" {
  description = "Email address for notifications"
  type        = string
  default     = null
}

variable "alarm_evaluation_periods" {
  description = "Number of periods to evaluate for alarms"
  type        = number
  default     = 2
}

variable "alarm_threshold_error_rate" {
  description = "Error rate threshold for alarms (percentage)"
  type        = number
  default     = 5
}

#################################
# Evaluation and Testing
#################################

variable "model_evaluation_enabled" {
  description = "Whether to enable model evaluation capabilities"
  type        = bool
  default     = false
}

variable "rag_evaluation_enabled" {
  description = "Whether to enable RAG evaluation capabilities"
  type        = bool
  default     = false
}

variable "evaluation_s3_bucket" {
  description = "S3 bucket for storing evaluation results"
  type        = string
  default     = null
}

#################################
# Cost Optimization
#################################

variable "enable_cost_optimization" {
  description = "Whether to enable cost optimization features"
  type        = bool
  default     = true
}

variable "s3_intelligent_tiering" {
  description = "Whether to enable S3 Intelligent Tiering"
  type        = bool
  default     = true
}

variable "aurora_auto_pause" {
  description = "Whether to enable Aurora auto-pause for serverless"
  type        = bool
  default     = true
}

variable "aurora_auto_pause_delay" {
  description = "Auto-pause delay in minutes for Aurora serverless"
  type        = number
  default     = 5
}

#################################
# Backup and Disaster Recovery
#################################

variable "backup_enabled" {
  description = "Whether to enable automated backups"
  type        = bool
  default     = true
}

variable "backup_schedule" {
  description = "Cron expression for backup schedule"
  type        = string
  default     = "cron(0 2 * * ? *)" # Daily at 2 AM
}

variable "cross_region_backup_enabled" {
  description = "Whether to enable cross-region backups"
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

#################################
# Development and Testing
#################################

variable "create_test_resources" {
  description = "Whether to create additional resources for testing"
  type        = bool
  default     = false
}

variable "enable_debug_logging" {
  description = "Whether to enable debug-level logging"
  type        = bool
  default     = false
}

variable "allow_experimental_features" {
  description = "Whether to allow experimental features"
  type        = bool
  default     = false
}

#################################
# AI/ML and Bedrock Configuration
#################################

variable "enable_bedrock" {
  description = "Whether to enable Amazon Bedrock services"
  type        = bool
  default     = true
}

variable "enable_ai_kms_key" {
  description = "Whether to create a dedicated KMS key for AI services"
  type        = bool
  default     = true
}

variable "enable_s3_bucket" {
  description = "Whether to create an S3 bucket for AI data storage"
  type        = bool
  default     = true
}

variable "enable_agent_module" {
  description = "Whether to enable Bedrock agent module"
  type        = bool
  default     = true
}

variable "enable_knowledge_base_module" {
  description = "Whether to enable Bedrock knowledge base module"
  type        = bool
  default     = true
}

variable "enable_guardrails_submodule" {
  description = "Whether to enable Bedrock guardrails submodule"
  type        = bool
  default     = false
}

variable "enable_data_automation_submodule" {
  description = "Whether to enable Bedrock data automation submodule"
  type        = bool
  default     = false
}

variable "enable_model_evaluation_submodule" {
  description = "Whether to enable Bedrock model evaluation submodule"
  type        = bool
  default     = false
}

variable "enable_rag_evaluation_submodule" {
  description = "Whether to enable RAG evaluation submodule"
  type        = bool
  default     = false
}

# Bedrock Foundation Models
variable "bedrock_foundation_models" {
  description = "List of Bedrock foundation models to enable"
  type        = list(string)
  default = [
    "amazon.titan-embed-text-v2:0",
    "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "anthropic.claude-3-haiku-20240307-v1:0"
  ]
}

# Agent Configuration
variable "agent_config" {
  description = "Configuration for Bedrock agent"
  type = object({
    name             = string
    description      = string
    foundation_model = string
    instruction      = string
    alias_name       = string
    action_groups    = optional(list(any), [])
  })
  default = {
    name             = "ai-land-agent"
    description      = "AI Land primary assistant agent"
    foundation_model = "anthropic.claude-3-5-sonnet-20241022-v2:0"
    instruction      = "You are an AI assistant helping users with enterprise data and knowledge management tasks."
    alias_name       = "production"
    action_groups    = []
  }
}

# Knowledge Base Configuration
variable "knowledge_base_config" {
  description = "Configuration for Bedrock knowledge base"
  type = object({
    name                 = string
    description          = string
    storage_type         = string
    embedding_model_arn  = string
    embedding_dimensions = number
    s3_bucket_arn        = optional(string)
    inclusion_prefixes   = optional(list(string))
    chunking_strategy    = string
    max_tokens           = optional(number)
    overlap_percentage   = optional(number)
  })
  default = {
    name                 = "ai-land-knowledge-base"
    description          = "Primary knowledge base for AI Land"
    storage_type         = "aurora"
    embedding_model_arn  = "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0"
    embedding_dimensions = 1024
    inclusion_prefixes   = ["documents/", "knowledge/"]
    chunking_strategy    = "FIXED_SIZE"
    max_tokens           = 512
    overlap_percentage   = 20
  }
}

# Aurora Configuration for Knowledge Base
variable "aurora_config" {
  description = "Aurora Serverless configuration for knowledge base storage"
  type = object({
    engine_version          = string
    database_name           = string
    master_username         = string
    backup_retention_period = number
    skip_final_snapshot     = bool
    max_capacity            = number
    min_capacity            = number
    table_name              = string
    vector_field            = string
    text_field              = string
    metadata_field          = string
    primary_key_field       = string
  })
  default = {
    engine_version          = "15.4"
    database_name           = "ai_knowledge_base"
    master_username         = "postgres"
    backup_retention_period = 7
    skip_final_snapshot     = true
    max_capacity            = 2.0
    min_capacity            = 0.5
    table_name              = "bedrock_kb"
    vector_field            = "embedding"
    text_field              = "text_chunk"
    metadata_field          = "metadata"
    primary_key_field       = "id"
  }
}

# Secrets Configuration
variable "secrets_config" {
  description = "Configuration for secrets stored in AWS Secrets Manager"
  type = map(object({
    description          = string
    recovery_window_days = number
  }))
  default = {
    bedrock_api_keys = {
      description          = "API keys for Bedrock services"
      recovery_window_days = 7
    }
    database_credentials = {
      description          = "Database connection credentials"
      recovery_window_days = 7
    }
  }
}

# Log Groups Configuration
variable "log_groups" {
  description = "Configuration for CloudWatch log groups"
  type = map(object({
    retention_days = number
  }))
  default = {
    bedrock = {
      retention_days = 30
    }
    agent = {
      retention_days = 14
    }
    knowledge_base = {
      retention_days = 14
    }
  }
}

# Guardrails Configuration (Optional)
variable "guardrails_config" {
  description = "Configuration for Bedrock guardrails"
  type = object({
    name                         = string
    description                  = string
    content_policy               = optional(any)
    topic_policy                 = optional(any)
    word_policy                  = optional(any)
    sensitive_information_policy = optional(any)
    pii_entities                 = optional(any)
    regexes                      = optional(any)
  })
  default = {
    name        = "ai-land-guardrails"
    description = "Safety guardrails for AI Land"
  }
}

# Data Automation Configuration (Optional)
variable "data_automation_config" {
  description = "Configuration for Bedrock data automation"
  type = object({
    flows        = optional(any)
    flow_aliases = optional(any)
  })
  default = {}
}

# Model Evaluation Configuration (Optional)
variable "model_evaluation_config" {
  description = "Configuration for Bedrock model evaluation"
  type        = any
  default     = {}
}

# Prompt Management Configuration (Optional)
variable "prompt_management_config" {
  description = "Configuration for Bedrock prompt management"
  type        = any
  default     = {}
}

# Lambda Functions Configuration
variable "lambda_functions" {
  description = "Configuration for Lambda functions"
  type = map(object({
    filename         = string
    function_name    = string
    runtime          = string
    handler          = string
    memory_size      = number
    timeout          = number
    environment_vars = optional(map(string), {})
  }))
  default = {}
}

# KMS Key Deletion Window
variable "kms_deletion_window" {
  description = "Number of days after which the KMS key is deleted (7-30 days)"
  type        = number
  default     = 7
  validation {
    condition     = var.kms_deletion_window >= 7 && var.kms_deletion_window <= 30
    error_message = "KMS deletion window must be between 7 and 30 days."
  }
}

# Monitoring Configuration
variable "monitoring_config" {
  description = "Configuration for CloudWatch monitoring and alarms"
  type = object({
    enable_alarms  = optional(bool, false)
    sns_topic_arn  = optional(string)
  })
  default = {
    enable_alarms = false
    sns_topic_arn = null
  }
}

# S3 Lifecycle Configuration
variable "lifecycle_config" {
  description = "Configuration for S3 bucket lifecycle policies"
  type = object({
    enable_lifecycle                    = optional(bool, false)
    transition_to_ia_days              = optional(number, 30)
    transition_to_glacier_days         = optional(number, 90)
    transition_to_deep_archive_days    = optional(number, 365)
    expiration_days                    = optional(number, 2555) # 7 years
    noncurrent_version_expiration_days = optional(number, 90)
  })
  default = {
    enable_lifecycle                    = false
    transition_to_ia_days              = 30
    transition_to_glacier_days         = 90
    transition_to_deep_archive_days    = 365
    expiration_days                    = 2555
    noncurrent_version_expiration_days = 90
  }
}
