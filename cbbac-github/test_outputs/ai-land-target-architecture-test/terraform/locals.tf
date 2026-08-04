# Local values for the AI-Land Target Architecture

locals {
  # Name prefix for all resources
  name_prefix = "${var.application_name}-${var.environment}"

  # Common tags applied to all resources
  common_tags = merge(var.tags, {
    Application = var.application_name
    Environment = var.environment
    Region      = var.region
    CreatedBy   = "AI-Land-Target-Architecture"
    Timestamp   = timestamp()
  })

  # Availability zones
  azs = length(var.availability_zones) > 0 ? var.availability_zones : slice(data.aws_availability_zones.available.names, 0, 2)

  # Network configuration
  vpc_id = var.vpc_enabled ? module.vpc[0].vpc_id : data.aws_vpc.existing[0].id

  private_subnet_ids = var.vpc_enabled ? module.vpc[0].private_subnets : (
    length(data.aws_subnets.existing_private) > 0 ? data.aws_subnets.existing_private[0].ids : []
  )

  public_subnet_ids = var.vpc_enabled ? module.vpc[0].public_subnets : (
    length(data.aws_subnets.existing_public) > 0 ? data.aws_subnets.existing_public[0].ids : []
  )

  # Account and region information
  region     = data.aws_region.current.name
  account_id = data.aws_caller_identity.current.account_id

  # VPC CIDR for security group rules
  vpc_cidr = var.vpc_enabled ? var.vpc_cidr : data.aws_vpc.existing[0].cidr_block

  # Database subnet IDs
  database_subnet_ids = var.vpc_enabled ? module.vpc[0].database_subnets : local.private_subnet_ids

  # Resource names
  s3_bucket_name = var.s3_bucket_name != null ? var.s3_bucket_name : "${local.name_prefix}-ai-data-${random_string.bucket_suffix.result}"

  agent_name = var.agent_name != null ? var.agent_name : "${local.name_prefix}-agent"

  agent_alias_name = var.agent_alias_name != null ? var.agent_alias_name : "${local.agent_name}-alias"

  kb_name = var.kb_name != null ? var.kb_name : "${local.name_prefix}-kb"

  guardrail_name = var.guardrail_name != null ? var.guardrail_name : "${local.name_prefix}-guardrails"

  bda_project_name = var.bda_project_name != null ? var.bda_project_name : "${local.name_prefix}-bda"

  # KMS key alias
  kms_key_alias = "alias/${local.name_prefix}-ai-key"

  # CloudWatch log group names
  bedrock_log_group_name = "/aws/bedrock/${local.name_prefix}"
  lambda_log_group_name  = "/aws/lambda/${local.name_prefix}"

  # Aurora configuration
  aurora_cluster_identifier = "${local.name_prefix}-aurora"
  aurora_database_name      = var.aurora_database_name
  aurora_master_username    = var.aurora_master_username

  # SNS topic name for notifications
  sns_topic_name = "${local.name_prefix}-notifications"

  # Content filter configuration
  content_filters = var.content_filter_strength != "NONE" ? [
    {
      input_strength  = var.content_filter_strength
      output_strength = var.content_filter_strength
      type            = "SEXUAL"
    },
    {
      input_strength  = var.content_filter_strength
      output_strength = var.content_filter_strength
      type            = "VIOLENCE"
    },
    {
      input_strength  = var.content_filter_strength
      output_strength = var.content_filter_strength
      type            = "HATE"
    },
    {
      input_strength  = var.content_filter_strength
      output_strength = var.content_filter_strength
      type            = "INSULTS"
    },
    {
      input_strength  = var.content_filter_strength
      output_strength = var.content_filter_strength
      type            = "MISCONDUCT"
    }
  ] : []

  # Lambda function configurations
  lambda_functions = var.lambda_functions_enabled ? {
    for action_group in var.action_groups : action_group.name => {
      name        = "${local.name_prefix}-${action_group.name}"
      description = action_group.description
      runtime     = var.lambda_runtime
      timeout     = var.lambda_timeout
      memory_size = var.lambda_memory_size
    }
  } : {}

  # Monitoring configuration
  enable_monitoring = var.enable_detailed_monitoring || var.sns_notifications_enabled

  # Cost optimization settings
  s3_lifecycle_rules = var.s3_lifecycle_enabled ? [
    {
      id     = "ai_data_lifecycle"
      status = "Enabled"

      transition = [
        {
          days          = var.s3_transition_to_ia_days
          storage_class = "STANDARD_IA"
        },
        {
          days          = var.s3_transition_to_glacier_days
          storage_class = "GLACIER"
        }
      ]
    }
  ] : []

  # Backup configuration
  backup_vault_name = "${local.name_prefix}-backup-vault"
  backup_plan_name  = "${local.name_prefix}-backup-plan"

  # Security group configurations
  aurora_security_group_rules = var.aurora_enabled ? {
    ingress_rules = [
      {
        from_port   = 5432
        to_port     = 5432
        protocol    = "tcp"
        cidr_blocks = [var.vpc_cidr]
        description = "PostgreSQL access from VPC"
      }
    ]
    egress_rules = [
      {
        from_port   = 0
        to_port     = 0
        protocol    = "-1"
        cidr_blocks = ["0.0.0.0/0"]
        description = "All outbound traffic"
      }
    ]
  } : {}

  # Model configuration
  bedrock_model_config = {
    foundation_model = var.agent_foundation_model
    temperature      = var.agent_temperature
    top_p            = var.agent_top_p
    max_tokens       = var.agent_max_tokens
    instruction      = var.agent_instruction
    idle_session_ttl = var.agent_idle_session_ttl
  }

  # Knowledge base configuration
  kb_config = var.knowledge_base_enabled ? {
    name              = local.kb_name
    description       = var.kb_description
    embedding_model   = var.kb_embedding_model_arn
    chunking_strategy = var.chunking_strategy
    chunk_max_tokens  = var.chunk_max_tokens
    chunk_overlap     = var.chunk_overlap_percentage
    storage_type      = var.knowledge_base_type
  } : null

  # Action groups configuration
  action_groups_config = var.action_groups_enabled ? [
    for ag in var.action_groups : {
      name        = ag.name
      description = ag.description
      lambda_arn  = var.lambda_functions_enabled ? try(var.lambda_functions[ag.name].function_name, null) : null
      schema      = ag.schema
    }
  ] : []
}
