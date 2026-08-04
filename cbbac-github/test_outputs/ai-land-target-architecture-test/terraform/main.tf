# =============================================================================
# AI-Land Target Architecture - Main Configuration
# =============================================================================

# -----------------------------------------------------------------------------
# Core Infrastructure Resources
# -----------------------------------------------------------------------------

# KMS Key for AI/ML workloads using CBBaC module
module "ai_kms_key" {
  count  = var.enable_ai_kms_key ? 1 : 0
  source = "git::https://github.com/porsche-code/aws-cbbac-security_identity_compliance-kms.git//terraform"

  name                    = "${local.name_prefix}-ai-key"
  description             = "KMS key for AI/ML workloads in ${var.environment}"
  deletion_window_in_days = var.kms_deletion_window
  enable_key_rotation     = true
  multi_region            = false

  additional_key_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Allow Bedrock Service"
        Effect = "Allow"
        Principal = {
          Service = "bedrock.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags
}

# S3 Bucket for AI/ML data and artifacts using CBBaC module
module "ai_data_bucket" {
  count  = var.enable_s3_bucket ? 1 : 0
  source = "git::https://github.com/porsche-code/aws-cbbac-database_and_storage-s3.git//terraform"

  name                                   = "${local.name_prefix}-ai-data-${random_id.bucket_suffix.hex}"
  encryption_kms_key_arn                 = var.enable_ai_kms_key ? module.ai_kms_key[0].kms_key.arn : null
  bucket_versioning                      = true
  force_destroy                          = false
  deny_unencrypted_uploads               = true
  enable_default_intelligent_tiering     = true
  enable_bucket_lifecycle_policy         = true
  retention_period                       = 30
  abort_incomplete_multipart_upload_days = 7

  tags = local.common_tags
}

# Random ID for bucket suffix
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# -----------------------------------------------------------------------------
# Secrets Manager for AI/ML Secrets using CBBaC module
# -----------------------------------------------------------------------------

module "ai_secrets" {
  for_each = var.secrets_config
  source   = "git::https://github.com/porsche-code/aws-cbbac-security_identity_compliance-secrets_manager.git//terraform"

  name                    = "${local.name_prefix}-${each.key}"
  description             = each.value.description
  kms_key_id              = var.enable_ai_kms_key ? module.ai_kms_key[0].kms_key.arn : null
  recovery_window_in_days = each.value.recovery_window_days

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# CloudWatch Log Groups for AI/ML Services using CBBaC module
# -----------------------------------------------------------------------------

module "ai_logs" {
  for_each = var.log_groups
  source   = "git::https://github.com/porsche-code/aws-cbbac-management_and_governance-cloudwatch.git//terraform"

  create_log_group           = true
  log_group_name             = "/aws/ai-land/${var.environment}/${each.key}"
  log_group_retention_period = each.value.retention_days
  log_group_kms_key_id       = var.enable_ai_kms_key ? module.ai_kms_key[0].kms_key.arn : null

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# IAM Roles for AI/ML Services
# -----------------------------------------------------------------------------

# Bedrock Service Role
resource "aws_iam_role" "bedrock_service_role" {
  count = var.enable_bedrock ? 1 : 0
  name  = "${local.name_prefix}-bedrock-service-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "bedrock.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "bedrock_service_policy" {
  count = var.enable_bedrock ? 1 : 0
  name  = "${local.name_prefix}-bedrock-service-policy"
  role  = aws_iam_role.bedrock_service_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = var.enable_s3_bucket ? [
          module.ai_data_bucket[0].bucket.arn,
          "${module.ai_data_bucket[0].bucket.arn}/*"
        ] : []
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${local.region}:${local.account_id}:*"
      }
    ]
  })
}

# Agent Execution Role
resource "aws_iam_role" "agent_execution_role" {
  count = var.enable_agent_module ? 1 : 0
  name  = "${local.name_prefix}-agent-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "bedrock.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "agent_execution_policy" {
  count = var.enable_agent_module ? 1 : 0
  name  = "${local.name_prefix}-agent-execution-policy"
  role  = aws_iam_role.agent_execution_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:RetrieveAndGenerate",
          "bedrock:Retrieve",
          "bedrock:InvokeModel"
        ]
        Resource = "*"
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Bedrock Knowledge Base (Direct Resources)
# -----------------------------------------------------------------------------

# Bedrock Knowledge Base
resource "aws_bedrockagent_knowledge_base" "main" {
  count    = var.enable_knowledge_base_module ? 1 : 0
  name     = var.knowledge_base_config.name
  role_arn = aws_iam_role.bedrock_service_role[0].arn

  description = var.knowledge_base_config.description

  knowledge_base_configuration {
    vector_knowledge_base_configuration {
      embedding_model_arn = var.knowledge_base_config.embedding_model_arn

      embedding_model_configuration {
        bedrock_embedding_model_configuration {
          dimensions = var.knowledge_base_config.embedding_dimensions
        }
      }
    }
    type = "VECTOR"
  }

  storage_configuration {
    type = "RDS"
    rds_configuration {
      resource_arn           = module.aurora_serverless_postgres[0].rds_cluster.arn
      database_name          = var.aurora_config.database_name
      table_name             = var.aurora_config.table_name
      credentials_secret_arn = module.aurora_serverless_postgres[0].database_secret_arn

      field_mapping {
        vector_field      = var.aurora_config.vector_field
        text_field        = var.aurora_config.text_field
        metadata_field    = var.aurora_config.metadata_field
        primary_key_field = var.aurora_config.primary_key_field
      }
    }
  }

  tags = local.common_tags
}

# Bedrock Data Source
resource "aws_bedrockagent_data_source" "s3_source" {
  count             = var.enable_knowledge_base_module ? 1 : 0
  knowledge_base_id = aws_bedrockagent_knowledge_base.main[0].id
  name              = "${var.knowledge_base_config.name}-datasource"
  description       = "Primary S3 data source for knowledge base"

  data_source_configuration {
    type = "S3"
    s3_configuration {
      bucket_arn         = var.enable_s3_bucket ? module.ai_data_bucket[0].bucket.arn : var.knowledge_base_config.s3_bucket_arn
      inclusion_prefixes = var.knowledge_base_config.inclusion_prefixes
    }
  }

  vector_ingestion_configuration {
    chunking_configuration {
      chunking_strategy = var.knowledge_base_config.chunking_strategy

      dynamic "fixed_size_chunking_configuration" {
        for_each = var.knowledge_base_config.chunking_strategy == "FIXED_SIZE" ? [1] : []
        content {
          max_tokens         = var.knowledge_base_config.max_tokens
          overlap_percentage = var.knowledge_base_config.overlap_percentage
        }
      }
    }
  }

  server_side_encryption_configuration {
    kms_key_arn = var.enable_ai_kms_key ? module.ai_kms_key[0].kms_key.arn : null
  }
}

# Bedrock Agent (Optional)
resource "aws_bedrockagent_agent" "main" {
  count                   = var.enable_agent_module ? 1 : 0
  agent_name              = var.agent_config.name
  agent_resource_role_arn = aws_iam_role.agent_execution_role[0].arn
  foundation_model        = var.agent_config.foundation_model
  instruction             = var.agent_config.instruction
  description             = var.agent_config.description

  tags = local.common_tags
}

# Bedrock Agent Alias (Optional)
resource "aws_bedrockagent_agent_alias" "main" {
  count            = var.enable_agent_module ? 1 : 0
  agent_alias_name = var.agent_config.alias_name
  agent_id         = aws_bedrockagent_agent.main[0].id
  description      = "Production alias for ${var.agent_config.name}"

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Aurora Serverless PostgreSQL (Knowledge Base Storage)
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# Aurora Serverless PostgreSQL using CBBaC module
# -----------------------------------------------------------------------------

module "aurora_serverless_postgres" {
  count  = var.aurora_enabled ? 1 : 0
  source = "git::https://github.com/porsche-code/aws-cbbac-database_and_storage-aurora_serverless_v2.git//terraform"

  project_name                = local.name_prefix
  vpc_id                      = local.vpc_id
  kms_key_id                  = var.enable_ai_kms_key ? module.ai_kms_key[0].kms_key.arn : null
  private_database_subnet_ids = local.database_subnet_ids
  security_group_ids          = [module.aurora_security_group[0].security_group_id]
  sns_arn                     = "arn:aws:sns:${local.region}:${local.account_id}:${local.name_prefix}-aurora-notifications"

  database_engine                     = "aurora-postgresql"
  database_version                    = var.aurora_config.engine_version
  database_name                       = var.aurora_config.database_name
  database_master_username            = var.aurora_config.master_username
  iam_database_authentication_enabled = true
  database_backup_retention           = var.aurora_config.backup_retention_period
  database_deletion_protection        = false
  database_skip_final_snapshot        = var.aurora_config.skip_final_snapshot
  database_instance_count             = 2
  database_instance_class             = "db.serverless"
  database_monitoring_interval        = 10
  database_copy_tags_to_snapshot      = true

  serverless_v2_scaling = [{
    max_capacity             = var.aurora_config.max_capacity
    min_capacity             = var.aurora_config.min_capacity
    seconds_until_auto_pause = null
  }]

  common_tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Security Groups using CBBaC module
# -----------------------------------------------------------------------------

module "aurora_security_group" {
  count  = var.enable_knowledge_base_module && var.knowledge_base_config.storage_type == "aurora_serverless" ? 1 : 0
  source = "git::https://github.com/porsche-code/aws-cbbac-security_identity_compliance-security_group.git//terraform"

  security_group_name        = "${local.name_prefix}-aurora-sg"
  security_group_description = "Security group for Aurora Serverless PostgreSQL"
  vpc_id                     = local.vpc_id

  security_group_rules = {
    ingress_postgres = {
      type        = "ingress"
      from_port   = 5432
      to_port     = 5432
      protocol    = "tcp"
      cidr_blocks = [local.vpc_cidr]
      description = "PostgreSQL access from VPC"
    }
    egress_all = {
      type        = "egress"
      from_port   = 0
      to_port     = 0
      protocol    = "-1"
      cidr_blocks = ["0.0.0.0/0"]
      description = "All outbound traffic"
    }
  }

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# CloudWatch Monitoring and Alarms
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "bedrock_throttling" {
  count = var.enable_bedrock && var.monitoring_config.enable_alarms ? 1 : 0

  alarm_name          = "${local.name_prefix}-bedrock-throttling"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "UserErrorCount"
  namespace           = "AWS/Bedrock"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors Bedrock throttling"
  alarm_actions       = var.monitoring_config.sns_topic_arn != null ? [var.monitoring_config.sns_topic_arn] : []

  dimensions = {
    ModelId = var.agent_config.foundation_model
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "agent_errors" {
  count = var.enable_agent_module && var.monitoring_config.enable_alarms ? 1 : 0

  alarm_name          = "${local.name_prefix}-agent-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "InvocationErrors"
  namespace           = "AWS/BedrockAgent"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors Bedrock Agent errors"
  alarm_actions       = var.monitoring_config.sns_topic_arn != null ? [var.monitoring_config.sns_topic_arn] : []

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Lambda Functions for Agent Action Groups (if needed)
# -----------------------------------------------------------------------------

resource "aws_lambda_function" "agent_action_function" {
  for_each = var.enable_agent_module ? var.lambda_functions : {}

  filename      = each.value.filename
  function_name = "${local.name_prefix}-${each.key}"
  role          = aws_iam_role.lambda_execution_role[each.key].arn
  handler       = each.value.handler
  runtime       = each.value.runtime
  timeout       = each.value.timeout
  memory_size   = each.value.memory_size

  environment {
    variables = merge(each.value.environment_variables, {
      ENVIRONMENT = var.environment
      KMS_KEY_ID  = var.enable_ai_kms_key ? module.ai_kms_key[0].kms_key.arn : ""
    })
  }

  # VPC Configuration
  dynamic "vpc_config" {
    for_each = each.value.vpc_config != null ? [each.value.vpc_config] : []
    content {
      subnet_ids         = vpc_config.value.subnet_ids
      security_group_ids = vpc_config.value.security_group_ids
    }
  }

  tags = local.common_tags
}

resource "aws_iam_role" "lambda_execution_role" {
  for_each = var.enable_agent_module ? var.lambda_functions : {}

  name = "${local.name_prefix}-lambda-${each.key}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  for_each = var.enable_agent_module ? var.lambda_functions : {}

  role       = aws_iam_role.lambda_execution_role[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# -----------------------------------------------------------------------------
# Cost Optimization - Scheduled Scaling (TODO: Implement with Lambda)
# -----------------------------------------------------------------------------

# TODO: Implement Lambda-based cost optimization for:
# - Aurora Serverless scaling schedules
# - Aurora PostgreSQL connection pooling
# - Bedrock model usage optimization

# -----------------------------------------------------------------------------
# Backup Configuration (TODO: Implement with AWS Backup)
# -----------------------------------------------------------------------------

# TODO: Implement AWS Backup for:
# - S3 bucket cross-region replication
# - Aurora Serverless automated backups
# - Secrets Manager backup

# -----------------------------------------------------------------------------
# Data Lifecycle Management
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_lifecycle_configuration" "ai_data_lifecycle" {
  count  = var.enable_s3_bucket && var.lifecycle_config.enable_lifecycle ? 1 : 0
  bucket = module.ai_data_bucket[0].bucket.id

  rule {
    id     = "ai_data_lifecycle_rule"
    status = "Enabled"

    filter {
      prefix = ""
    }

    transition {
      days          = var.lifecycle_config.transition_to_ia_days
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = var.lifecycle_config.transition_to_glacier_days
      storage_class = "GLACIER"
    }

    transition {
      days          = var.lifecycle_config.transition_to_deep_archive_days
      storage_class = "DEEP_ARCHIVE"
    }

    expiration {
      days = var.lifecycle_config.expiration_days
    }

    noncurrent_version_expiration {
      noncurrent_days = var.lifecycle_config.noncurrent_version_expiration_days
    }
  }
}

# -----------------------------------------------------------------------------
# VPC Module (when vpc_enabled is true)
# -----------------------------------------------------------------------------

module "vpc" {
  count  = var.vpc_enabled ? 1 : 0
  source = "terraform-aws-modules/vpc/aws"

  name = local.name_prefix
  cidr = var.vpc_cidr

  azs              = local.azs
  private_subnets  = var.private_subnet_cidrs
  public_subnets   = var.public_subnet_cidrs
  database_subnets = [for i, cidr in var.private_subnet_cidrs : cidrsubnet(var.vpc_cidr, 8, 200 + i)]

  enable_nat_gateway = true
  enable_vpn_gateway = false

  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = local.common_tags
}

# Random string for unique resource names
resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}
