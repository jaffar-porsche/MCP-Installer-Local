# =============================================================================
# Guardrails Submodule - Variables
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

variable "guardrails_config" {
  description = "Configuration for Bedrock guardrails"
  type = map(object({
    description                = string
    blocked_input_messaging   = string
    blocked_outputs_messaging = string
    version_description       = optional(string)
    
    # Content Policy Configuration
    content_policy_config = optional(object({
      filters_config = list(object({
        input_strength  = string
        output_strength = string
        type           = string
      }))
    }))
    
    # Topic Policy Configuration
    topic_policy_config = optional(object({
      topics_config = list(object({
        definition = string
        examples   = list(string)
        name       = string
        type       = string
      }))
    }))
    
    # Word Policy Configuration
    word_policy_config = optional(object({
      managed_word_lists_config = optional(list(object({
        type = string
      })))
      words_config = optional(list(object({
        text = string
      })))
    }))
    
    # Sensitive Information Policy Configuration
    sensitive_information_policy_config = optional(object({
      pii_entities_config = optional(list(object({
        action = string
        type   = string
      })))
      regexes_config = optional(list(object({
        action      = string
        description = string
        name        = string
        pattern     = string
      })))
    }))
  }))
  
  validation {
    condition = alltrue([
      for k, v in var.guardrails_config : length(v.description) > 0
    ])
    error_message = "All guardrails must have a description."
  }
  
  validation {
    condition = alltrue([
      for k, v in var.guardrails_config : v.content_policy_config == null ? true : alltrue([
        for filter in v.content_policy_config.filters_config : contains([
          "HATE", "INSULTS", "SEXUAL", "VIOLENCE", "MISCONDUCT", "PROMPT_ATTACK"
        ], filter.type)
      ])
    ])
    error_message = "Content policy filter types must be valid Bedrock content filter types."
  }
  
  validation {
    condition = alltrue([
      for k, v in var.guardrails_config : v.content_policy_config == null ? true : alltrue([
        for filter in v.content_policy_config.filters_config : contains([
          "NONE", "LOW", "MEDIUM", "HIGH"
        ], filter.input_strength) && contains([
          "NONE", "LOW", "MEDIUM", "HIGH"
        ], filter.output_strength)
      ])
    ])
    error_message = "Content policy filter strengths must be NONE, LOW, MEDIUM, or HIGH."
  }
}

# -----------------------------------------------------------------------------
# Optional Variables
# -----------------------------------------------------------------------------

variable "create_guardrail_versions" {
  description = "Whether to create versioned guardrails"
  type        = bool
  default     = true
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

variable "violation_threshold" {
  description = "Threshold for guardrail violation alarms"
  type        = number
  default     = 10
}

variable "latency_threshold" {
  description = "Threshold for guardrail latency alarms (in milliseconds)"
  type        = number
  default     = 5000
}

# -----------------------------------------------------------------------------
# Dashboard and Analytics Variables
# -----------------------------------------------------------------------------

variable "create_dashboard" {
  description = "Whether to create a CloudWatch dashboard for guardrails"
  type        = bool
  default     = true
}

variable "enable_custom_metrics" {
  description = "Enable custom CloudWatch metrics for detailed analytics"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Tagging Variables
# -----------------------------------------------------------------------------

variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
