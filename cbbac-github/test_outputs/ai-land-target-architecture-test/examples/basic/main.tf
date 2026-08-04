# =============================================================================
# AI-Land Target Architecture - Basic Example
# =============================================================================

# This example demonstrates a basic implementation of the AI-Land target architecture
# with minimal configuration for getting started quickly.

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    awscc = {
      source  = "hashicorp/awscc"
      version = ">= 1.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.6.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.6"
    }
  }
}

# Configure the AWS Provider
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "ai-land-basic-example"
      Environment = var.environment
      ManagedBy   = "terraform"
      Example     = "basic"
    }
  }
}

provider "awscc" {
  region = var.aws_region
}

# -----------------------------------------------------------------------------
# Data Sources
# -----------------------------------------------------------------------------

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# -----------------------------------------------------------------------------
# AI-Land Target Architecture Module
# -----------------------------------------------------------------------------

module "ai_land" {
  source = "../../terraform"

  # Core Configuration
  application_name = var.project_name
  environment      = var.environment
  region          = var.aws_region

  # Enable/disable features
  enable_bedrock                     = true
  enable_ai_kms_key                 = true
  enable_s3_bucket                  = true
  enable_agent_module               = true
  enable_knowledge_base_module      = true
  enable_guardrails_submodule       = true
  enable_data_automation_submodule  = false
  enable_model_evaluation_submodule = false

  # VPC Configuration (using existing default VPC)
  vpc_enabled = false

  # Aurora Configuration
  aurora_enabled = true

  # Knowledge Base Configuration
  knowledge_base_config = {
    name                = "basic-knowledge-base"
    description         = "Basic knowledge base for AI assistant"
    storage_type        = "aurora_serverless"
    embedding_model_arn = "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0"
    embedding_dimensions = 1024
    inclusion_prefixes  = ["documents/"]
    chunking_strategy   = "FIXED_SIZE"
    max_tokens         = 300
    overlap_percentage = 20
  }

  # Agent Configuration
  agent_config = {
    name             = "basic-ai-assistant"
    description      = "A basic AI assistant for demonstration"
    foundation_model = "anthropic.claude-3-haiku-20240307-v1:0"
    instruction      = "You are a helpful AI assistant. Be concise and accurate in your responses."
    alias_name       = "basic-assistant"
    action_groups    = []
  }

  # Aurora Configuration
  aurora_config = {
    engine_version          = "15.4"
    database_name          = "ai_knowledge_base"
    table_name             = "bedrock_kb_vectors"
    master_username        = "postgres"
    min_capacity           = 0.5
    max_capacity           = 16
    backup_retention_period = 7
    skip_final_snapshot    = true
    vector_field           = "embedding"
    text_field             = "chunks"
    metadata_field         = "metadata"
    primary_key_field      = "id"
  }

  # Guardrails Configuration
  guardrails_config = {
    name        = "basic-guardrails"
    description = "Basic content filtering guardrails"
    
    content_policy = [
      {
        filters_config = [
          {
            input_strength  = "MEDIUM"
            output_strength = "MEDIUM"
            type           = "HATE"
          },
          {
            input_strength  = "MEDIUM"
            output_strength = "MEDIUM"
            type           = "VIOLENCE"
          }
        ]
      }
    ]
  }

  # Monitoring Configuration
  monitoring_config = {
    enable_alarms = true
    sns_topic_arn = null  # Set to your SNS topic ARN if you want notifications
  }

  # Log Configuration
  log_groups = {
    agent = {
      retention_days = 14
    }
    knowledge_base = {
      retention_days = 14
    }
  }

  # Secrets Configuration
  secrets_config = {
    api_keys = {
      description           = "API keys for external integrations"
      recovery_window_days = 7
    }
  }

  # Lifecycle Configuration
  lifecycle_config = {
    enable_lifecycle                    = true
    transition_to_ia_days              = 30
    transition_to_glacier_days         = 90
    transition_to_deep_archive_days    = 180
    expiration_days                    = 365
    noncurrent_version_expiration_days = 30
  }

  # Tagging
  tags = {
    CostCenter = "AI-ML"
    Owner      = var.owner
    Purpose    = "Basic AI Assistant Demo"
  }
}
