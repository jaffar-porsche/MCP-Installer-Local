# =============================================================================
# Data Automation Submodule - Variables
# =============================================================================

# -----------------------------------------------------------------------------
# Required Variables
# -----------------------------------------------------------------------------

variable "project_name" {
  description = "Name of the project"
  type        = string
  validation {
    condition     = length(var.project_name) > 0
    error_message = "Project name cannot be empty."
  }
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod", "test"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod, test."
  }
}

variable "flows_config" {
  description = "Configuration for data automation flows"
  type = map(object({
    description         = string
    foundation_models   = list(string)
    agent_id           = optional(string)
    timeout            = optional(number, 300)
    memory_size        = optional(number, 512)
    schedule_expression = optional(string)
    duration_threshold = optional(number, 300000)
    
    # Resource permissions
    s3_bucket_arns        = optional(list(string))
    lambda_function_arns  = optional(list(string))
    knowledge_base_arns   = optional(list(string))
    
    # Flow configuration
    flow_steps = optional(map(object({
      type        = string
      description = string
      parameters  = optional(map(any), {})
    })))
    
    # Environment variables for Lambda
    environment_variables = optional(map(string), {})
    
    # EventBridge configuration
    sqs_target = optional(object({
      message_group_id = string
    }))
    
    # Flow settings
    store_results      = optional(bool, false)
    send_notifications = optional(bool, false)
  }))
  
  validation {
    condition = alltrue([
      for k, v in var.flows_config : length(v.description) > 0
    ])
    error_message = "All flows must have a description."
  }
  
  validation {
    condition = alltrue([
      for k, v in var.flows_config : length(v.foundation_models) > 0
    ])
    error_message = "All flows must specify at least one foundation model."
  }
  
  validation {
    condition = alltrue([
      for k, v in var.flows_config : alltrue([
        for model in v.foundation_models : contains([
          "anthropic.claude-3-sonnet-20240229-v1:0",
          "anthropic.claude-3-haiku-20240307-v1:0",
          "anthropic.claude-v2",
          "anthropic.claude-v2:1",
          "anthropic.claude-instant-v1",
          "amazon.titan-text-express-v1",
          "amazon.titan-text-lite-v1",
          "ai21.j2-ultra-v1",
          "ai21.j2-mid-v1",
          "cohere.command-text-v14",
          "cohere.command-light-text-v14"
        ], model)
      ])
    ])
    error_message = "All foundation models must be valid Bedrock model IDs."
  }
}

# -----------------------------------------------------------------------------
# Optional Variables
# -----------------------------------------------------------------------------

variable "enable_step_functions" {
  description = "Enable AWS Step Functions for complex flow orchestration"
  type        = bool
  default     = false
}

variable "create_artifacts_bucket" {
  description = "Create an S3 bucket for storing flow artifacts"
  type        = bool
  default     = false
}

variable "kms_key_arn" {
  description = "ARN of the KMS key for encryption"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# Monitoring Variables
# -----------------------------------------------------------------------------

variable "enable_monitoring" {
  description = "Enable CloudWatch monitoring and alarms"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 30
  
  validation {
    condition = contains([
      1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653
    ], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch Logs retention period."
  }
}

variable "alarm_topic_arn" {
  description = "ARN of SNS topic for CloudWatch alarms"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# Tagging Variables
# -----------------------------------------------------------------------------

variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
