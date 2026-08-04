# =============================================================================
# Bedrock Knowledge Base Plugin
# AI-Land Target Architecture - Plugin Module
# =============================================================================

# This plugin provides Bedrock Knowledge Base functionality as a reusable component
# that can be included in other architectures or used standalone.

# Terraform configuration is defined in shared.tf

# -----------------------------------------------------------------------------
# Local Values
# -----------------------------------------------------------------------------

locals {
  # Component-specific tags for knowledge base plugin
  kb_tags = merge(local.common_tags, {
    Component = "bedrock-knowledge-base"
    Plugin    = "bedrock-knowledge-base-plugin"
  })
  
  # Knowledge base configuration with defaults
  kb_config = merge({
    embedding_model = "amazon.titan-embed-text-v1"
    chunking_strategy = "FIXED_SIZE"
    max_tokens = 300
    overlap_percentage = 20
  }, var.knowledge_base_config)
}

# Data sources are defined in shared.tf

# Generate random suffix for unique naming
resource "random_id" "suffix" {
  byte_length = 4
}

# -----------------------------------------------------------------------------
# IAM Role for Knowledge Base
# -----------------------------------------------------------------------------

resource "aws_iam_role" "knowledge_base_role" {
  name = "${local.name_prefix}-kb-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "bedrock.amazonaws.com"
        }
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })

  tags = local.kb_tags
}

# IAM Policy for Knowledge Base
resource "aws_iam_role_policy" "knowledge_base_policy" {
  name = "${local.name_prefix}-kb-policy"
  role = aws_iam_role.knowledge_base_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel"
        ]
        Resource = "arn:aws:bedrock:${data.aws_region.current.name}::foundation-model/${local.kb_config.embedding_model}"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          var.s3_bucket_arn,
          "${var.s3_bucket_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "rds-data:BatchExecuteStatement",
          "rds-data:BeginTransaction",
          "rds-data:CommitTransaction",
          "rds-data:ExecuteStatement",
          "rds-data:RollbackTransaction"
        ]
        Resource = var.aurora_cluster_arn
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Aurora Serverless PostgreSQL Components
# -----------------------------------------------------------------------------

# Aurora Serverless PostgreSQL Cluster
resource "aws_rds_cluster" "aurora_kb_cluster" {
  cluster_identifier     = "${local.name_prefix}-kb-aurora-${random_id.suffix.hex}"
  engine                = "aurora-postgresql"
  engine_mode           = "serverless"
  engine_version        = var.aurora_config.engine_version
  database_name         = var.aurora_config.database_name
  master_username       = var.aurora_config.master_username
  manage_master_user_password = true
  master_user_secret_kms_key_id = var.kms_key_arn
  
  # Serverless V2 Scaling
  serverlessv2_scaling_configuration {
    max_capacity = var.aurora_config.max_capacity
    min_capacity = var.aurora_config.min_capacity
  }
  
  # Network Configuration
  db_subnet_group_name   = var.aurora_config.subnet_group_name
  vpc_security_group_ids = var.aurora_config.security_group_ids
  
  # Backup Configuration
  backup_retention_period = var.aurora_config.backup_retention_period
  preferred_backup_window = var.aurora_config.backup_window
  
  # Encryption
  storage_encrypted = true
  kms_key_id       = var.kms_key_arn
  
  # Enable pgvector extension
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  skip_final_snapshot = var.aurora_config.skip_final_snapshot
  
  tags = local.kb_tags
}

# -----------------------------------------------------------------------------
# Bedrock Knowledge Base
# -----------------------------------------------------------------------------

resource "aws_bedrockagent_knowledge_base" "main" {
  name        = local.kb_config.name
  description = local.kb_config.description
  role_arn    = aws_iam_role.knowledge_base_role.arn

  # Knowledge Base Configuration
  knowledge_base_configuration {
    type = "VECTOR"
    vector_knowledge_base_configuration {
      embedding_model_arn = "arn:aws:bedrock:${data.aws_region.current.name}::foundation-model/${local.kb_config.embedding_model}"
    }
  }

  # Storage Configuration - Aurora Serverless
  storage_configuration {
    type = "RDS"
    rds_configuration {
      resource_arn    = aws_rds_cluster.aurora_kb_cluster.arn
      database_name   = var.aurora_config.database_name
      table_name      = var.aurora_config.table_name
      credentials_secret_arn = aws_rds_cluster.aurora_kb_cluster.master_user_secret[0].secret_arn
      field_mapping {
        vector_field          = var.aurora_config.vector_field
        text_field           = var.aurora_config.text_field
        metadata_field       = var.aurora_config.metadata_field
        primary_key_field    = var.aurora_config.primary_key_field
      }
    }
  }

  tags = local.kb_tags
}

# -----------------------------------------------------------------------------
# Knowledge Base Data Source
# -----------------------------------------------------------------------------

resource "aws_bedrockagent_data_source" "main" {
  knowledge_base_id = aws_bedrockagent_knowledge_base.main.id
  name              = "${local.kb_config.name}-datasource"
  description       = local.kb_config.data_source_description

  # Data Source Configuration
  data_source_configuration {
    type = "S3"
    s3_configuration {
      bucket_arn = var.s3_bucket_arn
      inclusion_prefixes = var.s3_config.inclusion_prefixes
    }
  }

  # Vector Ingestion Configuration
  vector_ingestion_configuration {
    chunking_configuration {
      chunking_strategy = local.kb_config.chunking_strategy
      
      dynamic "fixed_size_chunking_configuration" {
        for_each = local.kb_config.chunking_strategy == "FIXED_SIZE" ? [1] : []
        
        content {
          max_tokens         = local.kb_config.max_tokens
          overlap_percentage = local.kb_config.overlap_percentage
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# CloudWatch Log Group for Knowledge Base using CBBaC module
# -----------------------------------------------------------------------------

module "knowledge_base_logs" {
  source = "git::https://github.com/porsche-code/aws-cbbac-management_and_governance-cloudwatch.git//terraform"

  create_log_group             = true
  log_group_name              = "/aws/bedrock/knowledge-base/${aws_bedrockagent_knowledge_base.main.name}"
  log_group_retention_period  = var.log_retention_days
  log_group_kms_key_id        = var.kms_key_arn
  create_log_stream           = false

  tags = local.kb_tags
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms for Monitoring
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "kb_ingestion_errors" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${local.name_prefix}-kb-ingestion-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "IngestionErrors"
  namespace           = "AWS/BedrockKnowledgeBase"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors knowledge base ingestion errors"
  alarm_actions       = var.alarm_topic_arn != null ? [var.alarm_topic_arn] : []

  dimensions = {
    KnowledgeBaseId = aws_bedrockagent_knowledge_base.main.id
  }

  tags = local.kb_tags
}

resource "aws_cloudwatch_metric_alarm" "kb_retrieval_latency" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${local.name_prefix}-kb-retrieval-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "RetrievalLatency"
  namespace           = "AWS/BedrockKnowledgeBase"
  period              = "300"
  statistic           = "Average"
  threshold           = "5000" # 5 seconds in milliseconds
  alarm_description   = "This metric monitors knowledge base retrieval latency"
  alarm_actions       = var.alarm_topic_arn != null ? [var.alarm_topic_arn] : []

  dimensions = {
    KnowledgeBaseId = aws_bedrockagent_knowledge_base.main.id
  }

  tags = local.kb_tags
}
