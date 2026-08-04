# Data sources for the AI-Land Target Architecture

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_partition" "current" {}

# Get existing VPC if not creating one
data "aws_vpc" "existing" {
  count = var.vpc_enabled ? 0 : 1

  default = true
}

# Get existing subnets if not creating VPC
data "aws_subnets" "existing_private" {
  count = var.vpc_enabled ? 0 : 1

  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.existing[0].id]
  }

  filter {
    name   = "default-for-az"
    values = ["false"]
  }

  tags = {
    Tier = "Private"
  }
}

data "aws_subnets" "existing_public" {
  count = var.vpc_enabled ? 0 : 1

  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.existing[0].id]
  }

  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

# IAM policy documents
data "aws_iam_policy_document" "bedrock_agent_trust" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["bedrock.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

data "aws_iam_policy_document" "bedrock_agent_permissions" {
  # Bedrock model access
  statement {
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream"
    ]
    resources = [
      "arn:${data.aws_partition.current.partition}:bedrock:${data.aws_region.current.name}::foundation-model/*"
    ]
  }

  # Knowledge base access
  dynamic "statement" {
    for_each = var.knowledge_base_enabled ? [1] : []
    content {
      effect = "Allow"
      actions = [
        "bedrock:Retrieve",
        "bedrock:RetrieveAndGenerate"
      ]
      resources = [
        "arn:${data.aws_partition.current.partition}:bedrock:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:knowledge-base/*"
      ]
    }
  }

  # S3 access for knowledge base data source
  dynamic "statement" {
    for_each = var.create_s3_data_source ? [1] : []
    content {
      effect = "Allow"
      actions = [
        "s3:GetObject",
        "s3:ListBucket"
      ]
      resources = [
        try(module.ai_data_bucket[0].bucket_arn, ""),
        "${try(module.ai_data_bucket[0].bucket_arn, "")}/*"
      ]
    }
  }
}

data "aws_iam_policy_document" "knowledge_base_trust" {
  count = var.knowledge_base_enabled ? 1 : 0

  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["bedrock.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

data "aws_iam_policy_document" "knowledge_base_permissions" {
  count = var.knowledge_base_enabled ? 1 : 0

  # Bedrock foundation model access
  statement {
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel"
    ]
    resources = [
      var.kb_embedding_model_arn
    ]
  }

  # RDS access for Aurora
  dynamic "statement" {
    for_each = var.aurora_enabled ? [1] : []
    content {
      effect = "Allow"
      actions = [
        "rds-data:BatchExecuteStatement",
        "rds-data:BeginTransaction",
        "rds-data:CommitTransaction",
        "rds-data:ExecuteStatement",
        "rds-data:RollbackTransaction"
      ]
      resources = [
        try(module.aurora_serverless_postgres[0].cluster_arn, "")
      ]
    }
  }

  # Secrets Manager access for Aurora credentials
  dynamic "statement" {
    for_each = var.knowledge_base_type == "aurora" && var.aurora_enabled ? [1] : []
    content {
      effect = "Allow"
      actions = [
        "secretsmanager:GetSecretValue"
      ]
      resources = [
        try(module.aurora_serverless_postgres[0].cluster_master_user_secret[0].secret_arn, "")
      ]
    }
  }

  # S3 access for data source
  dynamic "statement" {
    for_each = var.create_s3_data_source ? [1] : []
    content {
      effect = "Allow"
      actions = [
        "s3:GetObject",
        "s3:ListBucket"
      ]
      resources = [
        try(module.ai_data_bucket[0].bucket_arn, ""),
        "${try(module.ai_data_bucket[0].bucket_arn, "")}/*"
      ]
    }
  }
}

# Lambda execution role trust policy
data "aws_iam_policy_document" "lambda_trust" {
  count = var.lambda_functions_enabled ? 1 : 0

  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

# Aurora master password
data "aws_secretsmanager_secret" "aurora_master_password" {
  count = var.knowledge_base_type == "aurora" && var.aurora_enabled ? 1 : 0

  name = "${local.name_prefix}-aurora-master-password"

  depends_on = [module.aurora_serverless_postgres]
}
