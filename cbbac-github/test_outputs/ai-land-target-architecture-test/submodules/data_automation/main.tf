# =============================================================================
# Data Automation Submodule
# AI-Land Target Architecture - Bedrock Data Automation Implementation
# =============================================================================

# This submodule provides Bedrock Data Automation (Flows) functionality
# for automated data processing and transformation workflows.

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.1"
    }
  }
}

# -----------------------------------------------------------------------------
# Local Values
# -----------------------------------------------------------------------------

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  
  common_tags = merge(var.additional_tags, {
    Project     = var.project_name
    Environment = var.environment
    Component   = "bedrock-data-automation"
    ManagedBy   = "terraform"
    Submodule   = "data-automation"
  })
}

# -----------------------------------------------------------------------------
# Data Sources
# -----------------------------------------------------------------------------

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Generate random suffix for unique naming
resource "random_id" "suffix" {
  byte_length = 4
}

# -----------------------------------------------------------------------------
# IAM Role for Data Automation Flows
# -----------------------------------------------------------------------------

resource "aws_iam_role" "flow_execution_role" {
  for_each = var.flows_config

  name = "${local.name_prefix}-flow-${each.key}-role"

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

  tags = local.common_tags
}

# IAM Policy for Flow Execution
resource "aws_iam_role_policy" "flow_execution_policy" {
  for_each = var.flows_config

  name = "${local.name_prefix}-flow-${each.key}-policy"
  role = aws_iam_role.flow_execution_role[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = [
          for model in each.value.foundation_models : 
          "arn:aws:bedrock:${data.aws_region.current.name}::foundation-model/${model}"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
      }
    ], each.value.s3_bucket_arns != null ? [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = flatten([
          each.value.s3_bucket_arns,
          [for arn in each.value.s3_bucket_arns : "${arn}/*"]
        ])
      }
    ] : [], each.value.lambda_function_arns != null ? [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = each.value.lambda_function_arns
      }
    ] : [], each.value.knowledge_base_arns != null ? [
      {
        Effect = "Allow"
        Action = [
          "bedrock:Retrieve",
          "bedrock:RetrieveAndGenerate"
        ]
        Resource = each.value.knowledge_base_arns
      }
    ] : [])
  })
}

# -----------------------------------------------------------------------------
# Bedrock Data Automation Flows
# -----------------------------------------------------------------------------

resource "aws_bedrockagent_agent_alias" "flow_alias" {
  for_each = var.flows_config

  agent_alias_name = "${local.name_prefix}-flow-${each.key}"
  agent_id         = each.value.agent_id
  description      = "Flow alias for ${each.key} data automation"

  tags = local.common_tags
}

# Note: Bedrock Flows are currently not fully supported in Terraform AWS Provider
# This is a placeholder implementation that would be implemented once the provider supports it
# TODO: Replace with actual aws_bedrock_flow resource when available

resource "aws_lambda_function" "flow_orchestrator" {
  for_each = var.flows_config

  filename         = data.archive_file.flow_orchestrator_zip[each.key].output_path
  function_name    = "${local.name_prefix}-flow-${each.key}-orchestrator"
  role            = aws_iam_role.flow_lambda_role[each.key].arn
  handler         = "index.handler"
  runtime         = "python3.11"
  timeout         = each.value.timeout
  memory_size     = each.value.memory_size

  environment {
    variables = merge(each.value.environment_variables, {
      ENVIRONMENT = var.environment
      FLOW_NAME   = each.key
      REGION      = data.aws_region.current.name
    })
  }

  tags = local.common_tags
}

# Lambda function code for flow orchestration
data "archive_file" "flow_orchestrator_zip" {
  for_each = var.flows_config

  type        = "zip"
  output_path = "/tmp/${each.key}_flow_orchestrator.zip"
  
  source {
    content = templatefile("${path.module}/templates/flow_orchestrator.py.tpl", {
      flow_name = each.key
      flow_config = each.value
    })
    filename = "index.py"
  }
}

# IAM Role for Flow Lambda Functions
resource "aws_iam_role" "flow_lambda_role" {
  for_each = var.flows_config

  name = "${local.name_prefix}-flow-${each.key}-lambda-role"

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

resource "aws_iam_role_policy_attachment" "flow_lambda_basic" {
  for_each = var.flows_config

  role       = aws_iam_role.flow_lambda_role[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "flow_lambda_policy" {
  for_each = var.flows_config

  name = "${local.name_prefix}-flow-${each.key}-lambda-policy"
  role = aws_iam_role.flow_lambda_role[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = each.value.s3_bucket_arns != null ? flatten([
          each.value.s3_bucket_arns,
          [for arn in each.value.s3_bucket_arns : "${arn}/*"]
        ]) : []
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Step Functions State Machine for Complex Flows
# -----------------------------------------------------------------------------

resource "aws_sfn_state_machine" "flow_state_machine" {
  for_each = var.enable_step_functions ? var.flows_config : {}

  name     = "${local.name_prefix}-flow-${each.key}"
  role_arn = aws_iam_role.step_functions_role[each.key].arn

  definition = jsonencode({
    Comment = "Data automation flow for ${each.key}"
    StartAt = "StartFlow"
    States = {
      StartFlow = {
        Type = "Task"
        Resource = aws_lambda_function.flow_orchestrator[each.key].arn
        Parameters = {
          "operation": "start",
          "input.$": "$"
        }
        Next = each.value.flow_steps != null ? keys(each.value.flow_steps)[0] : "EndFlow"
      }
      
      # Dynamic flow steps would be generated here based on each.value.flow_steps
      # This is a simplified implementation
      
      EndFlow = {
        Type = "Task"
        Resource = aws_lambda_function.flow_orchestrator[each.key].arn
        Parameters = {
          "operation": "complete",
          "input.$": "$"
        }
        End = true
      }
    }
  })

  tags = local.common_tags
}

# IAM Role for Step Functions
resource "aws_iam_role" "step_functions_role" {
  for_each = var.enable_step_functions ? var.flows_config : {}

  name = "${local.name_prefix}-flow-${each.key}-sfn-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "step_functions_policy" {
  for_each = var.enable_step_functions ? var.flows_config : {}

  name = "${local.name_prefix}-flow-${each.key}-sfn-policy"
  role = aws_iam_role.step_functions_role[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = aws_lambda_function.flow_orchestrator[each.key].arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# EventBridge Rules for Scheduled Flows
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_event_rule" "flow_schedule" {
  for_each = { for k, v in var.flows_config : k => v if v.schedule_expression != null }

  name                = "${local.name_prefix}-flow-${each.key}-schedule"
  description         = "Schedule for ${each.key} data automation flow"
  schedule_expression = each.value.schedule_expression

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "flow_schedule_target" {
  for_each = { for k, v in var.flows_config : k => v if v.schedule_expression != null }

  rule      = aws_cloudwatch_event_rule.flow_schedule[each.key].name
  target_id = "FlowTarget"
  arn       = var.enable_step_functions ? aws_sfn_state_machine.flow_state_machine[each.key].arn : aws_lambda_function.flow_orchestrator[each.key].arn
  
  # Role ARN for EventBridge to invoke the target
  role_arn = var.enable_step_functions ? aws_iam_role.step_functions_role[each.key].arn : aws_iam_role.flow_lambda_role[each.key].arn
}

# -----------------------------------------------------------------------------
# CloudWatch Log Groups for Flow Monitoring using CBBaC module
# -----------------------------------------------------------------------------

module "flow_logs" {
  for_each = var.flows_config
  source = "git::https://github.com/porsche-code/aws-cbbac-management_and_governance-cloudwatch.git//terraform"

  create_log_group             = true
  log_group_name              = "/aws/bedrock/flows/${each.key}"
  log_group_retention_period  = var.log_retention_days
  log_group_kms_key_id        = var.kms_key_arn
  create_log_stream           = false

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms for Flow Monitoring
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "flow_errors" {
  for_each = var.enable_monitoring ? var.flows_config : {}

  alarm_name          = "${local.name_prefix}-flow-${each.key}-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors errors in ${each.key} flow"
  alarm_actions       = var.alarm_topic_arn != null ? [var.alarm_topic_arn] : []

  dimensions = {
    FunctionName = aws_lambda_function.flow_orchestrator[each.key].function_name
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "flow_duration" {
  for_each = var.enable_monitoring ? var.flows_config : {}

  alarm_name          = "${local.name_prefix}-flow-${each.key}-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = each.value.duration_threshold != null ? each.value.duration_threshold : 300000 # 5 minutes
  alarm_description   = "This metric monitors execution duration of ${each.key} flow"
  alarm_actions       = var.alarm_topic_arn != null ? [var.alarm_topic_arn] : []

  dimensions = {
    FunctionName = aws_lambda_function.flow_orchestrator[each.key].function_name
  }

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# S3 Bucket for Flow Artifacts (Optional)
# -----------------------------------------------------------------------------

resource "aws_s3_bucket" "flow_artifacts" {
  count = var.create_artifacts_bucket ? 1 : 0

  bucket = "${local.name_prefix}-flow-artifacts-${random_id.suffix.hex}"

  tags = local.common_tags
}

resource "aws_s3_bucket_versioning" "flow_artifacts_versioning" {
  count = var.create_artifacts_bucket ? 1 : 0

  bucket = aws_s3_bucket.flow_artifacts[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "flow_artifacts_encryption" {
  count = var.create_artifacts_bucket ? 1 : 0

  bucket = aws_s3_bucket.flow_artifacts[0].id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = var.kms_key_arn
      sse_algorithm     = var.kms_key_arn != null ? "aws:kms" : "AES256"
    }
  }
}
