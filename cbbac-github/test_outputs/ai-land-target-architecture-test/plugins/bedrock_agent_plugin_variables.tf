# =============================================================================
# Bedrock Agent Plugin - Variables
# =============================================================================
# Shared variables are defined in shared_variables.tf

# -----------------------------------------------------------------------------
# Agent-Specific Variables
# -----------------------------------------------------------------------------

variable "agent_config" {
  description = "Configuration for the Bedrock agent"
  type = object({
    name                = string
    description         = string
    foundation_model    = string
    instruction         = string
    alias_name          = optional(string)
    
    # Optional advanced configurations
    idle_session_ttl_in_seconds = optional(number, 900)
    prepare_agent               = optional(bool, true)
    skip_resource_in_use_check  = optional(bool, false)
    
    # Action Groups
    action_groups = optional(map(object({
      name                = string
      description         = string
      lambda_function_arn = optional(string)
      
      # API Schema configuration
      api_schema = optional(object({
        s3_bucket_name = optional(string)
        s3_object_key  = optional(string)
        payload        = optional(string)
      }))
      
      # Function Schema configuration
      function_schema = optional(object({
        functions = optional(list(object({
          name        = string
          description = string
          parameters = optional(list(object({
            name        = string
            description = string
            required    = bool
            type        = string
          })))
        })))
      }))
    })))
    
    # Prompt Override Configuration
    prompt_override_configuration = optional(object({
      base_prompt_template = string
      inference_configuration = object({
        maximum_length = number
        stop_sequences = list(string)
        temperature    = number
        top_k         = number
        top_p         = number
      })
      parser_mode          = string
      prompt_creation_mode = string
      prompt_state         = string
      prompt_type          = string
    }))
    
    # Routing Configuration for Alias
    routing_configuration = optional(object({
      agent_version = string
    }))
  })
  
  validation {
    condition     = length(var.agent_config.name) > 0
    error_message = "Agent name cannot be empty."
  }
  
  validation {
    condition = contains([
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
    ], var.agent_config.foundation_model)
    error_message = "Foundation model must be a valid Bedrock model ID."
  }
  
  validation {
    condition     = length(var.agent_config.instruction) > 0
    error_message = "Agent instruction cannot be empty."
  }
}

# -----------------------------------------------------------------------------
# Optional Variables
# -----------------------------------------------------------------------------

variable "knowledge_base_associations" {
  description = "Knowledge base associations for the agent"
  type = map(object({
    knowledge_base_id    = string
    description          = string
    knowledge_base_state = string
  }))
  default = null
  
  validation {
    condition = var.knowledge_base_associations == null ? true : alltrue([
      for kb in var.knowledge_base_associations : contains(["ENABLED", "DISABLED"], kb.knowledge_base_state)
    ])
    error_message = "Knowledge base state must be either 'ENABLED' or 'DISABLED'."
  }
}

variable "create_agent_alias" {
  description = "Whether to create an agent alias"
  type        = bool
  default     = true
}

# Permissions Variables section continues...

variable "guardrail_identifier" {
  description = "Identifier of the guardrail to associate with the agent"
  type        = string
  default     = null
}

variable "guardrail_version" {
  description = "Version of the guardrail"
  type        = string
  default     = "DRAFT"
}

# -----------------------------------------------------------------------------
# Permissions Variables
# -----------------------------------------------------------------------------

variable "knowledge_base_arns" {
  description = "ARNs of knowledge bases that the agent can access"
  type        = list(string)
  default     = null
}

variable "lambda_function_arns" {
  description = "ARNs of Lambda functions that the agent can invoke"
  type        = list(string)
  default     = null
}

variable "s3_bucket_arns" {
  description = "ARNs of S3 buckets that the agent can access"
  type        = list(string)
  default     = null
}

# Monitoring variables are defined in shared_variables.tf
