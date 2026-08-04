# =============================================================================
# Bedrock Knowledge Base Plugin - Variables
# =============================================================================
# Shared variables are defined in shared_variables.tf

# -----------------------------------------------------------------------------
# Knowledge Base-Specific Variables
# -----------------------------------------------------------------------------

variable "knowledge_base_config" {
  description = "Configuration for the Bedrock knowledge base"
  type = object({
    name                      = string
    description               = string
    data_source_description   = optional(string, "Primary data source for knowledge base")
    embedding_model          = optional(string, "amazon.titan-embed-text-v1")
    chunking_strategy        = optional(string, "FIXED_SIZE")
    max_tokens              = optional(number, 300)
    overlap_percentage      = optional(number, 20)
    
    # Hierarchical chunking configuration
    level_1_max_tokens             = optional(number, 1500)
    level_2_max_tokens             = optional(number, 300)
    hierarchical_overlap_tokens    = optional(number, 60)
    
    # Semantic chunking configuration
    semantic_max_tokens                 = optional(number, 300)
    semantic_buffer_size               = optional(number, 1)
    breakpoint_percentile_threshold    = optional(number, 95)
  })
  
  validation {
    condition     = length(var.knowledge_base_config.name) > 0
    error_message = "Knowledge base name cannot be empty."
  }
  
  validation {
    condition = contains([
      "amazon.titan-embed-text-v1",
      "amazon.titan-embed-text-v2:0",
      "cohere.embed-english-v3",
      "cohere.embed-multilingual-v3"
    ], var.knowledge_base_config.embedding_model)
    error_message = "Embedding model must be a valid Bedrock embedding model."
  }
  
  validation {
    condition = contains([
      "FIXED_SIZE",
      "HIERARCHICAL",
      "SEMANTIC",
      "NONE"
    ], var.knowledge_base_config.chunking_strategy)
    error_message = "Chunking strategy must be one of: FIXED_SIZE, HIERARCHICAL, SEMANTIC, NONE."
  }
}

variable "storage_type" {
  description = "Type of vector storage backend (only Aurora Serverless supported)"
  type        = string
  default     = "aurora_serverless"
  validation {
    condition = var.storage_type == "aurora_serverless"
    error_message = "Only aurora_serverless storage type is supported."
  }
}

variable "s3_bucket_arn" {
  description = "ARN of the S3 bucket containing knowledge base data"
  type        = string
  validation {
    condition     = can(regex("^arn:aws:s3:::", var.s3_bucket_arn))
    error_message = "S3 bucket ARN must be a valid S3 bucket ARN."
  }
}

# -----------------------------------------------------------------------------
# S3 Configuration
# -----------------------------------------------------------------------------

variable "s3_config" {
  description = "S3 data source configuration"
  type = object({
    inclusion_prefixes = optional(list(string), [])
  })
  default = {}
}

# -----------------------------------------------------------------------------
# Aurora Serverless Configuration
# -----------------------------------------------------------------------------

variable "aurora_config" {
  description = "Aurora Serverless PostgreSQL configuration"
  type = object({
    engine_version          = optional(string, "15.4")
    database_name          = string
    table_name             = string
    master_username        = optional(string, "postgres")
    min_capacity           = optional(number, 0.5)
    max_capacity           = optional(number, 16)
    backup_retention_period = optional(number, 7)
    backup_window          = optional(string, "03:00-04:00")
    skip_final_snapshot    = optional(bool, false)
    subnet_group_name      = string
    security_group_ids     = list(string)
    vector_field           = optional(string, "embedding")
    text_field             = optional(string, "chunks")
    metadata_field         = optional(string, "metadata")
    primary_key_field      = optional(string, "id")
  })
}

variable "aurora_cluster_arn" {
  description = "ARN of existing Aurora cluster (if not creating new one)"
  type        = string
  default     = null
}

# -----------------------------------------------------------------------------
# Advanced Processing Configuration
# -----------------------------------------------------------------------------

variable "custom_transformation_config" {
  description = "Custom transformation configuration for data processing"
  type = object({
    intermediate_storage_s3_uri = string
    step_to_apply              = string
    lambda_arn                 = string
  })
  default = null
}

variable "parsing_config" {
  description = "Document parsing configuration"
  type = object({
    parsing_strategy = string
    foundation_model_config = optional(object({
      model_arn           = string
      parsing_prompt_text = string
    }))
  })
  default = null
  
  validation {
    condition = var.parsing_config == null ? true : contains([
      "BEDROCK_FOUNDATION_MODEL"
    ], var.parsing_config.parsing_strategy)
    error_message = "Parsing strategy must be 'BEDROCK_FOUNDATION_MODEL'."
  }
}

# Security, monitoring, and tagging variables are defined in shared_variables.tf
