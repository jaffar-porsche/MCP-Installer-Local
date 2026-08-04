# =============================================================================
# Bedrock Agent Plugin
# AI-Land Target Architecture - Plugin Module
# =============================================================================

# This plugin provides Bedrock Agent functionality as a reusable component
# that can be included in other architectures or used standalone.

# Terraform configuration is defined in shared.tf

# -----------------------------------------------------------------------------
# Local Values
# -----------------------------------------------------------------------------

locals {
  # Component-specific tags for agent plugin
  agent_tags = merge(local.common_tags, {
    Component = "bedrock-agent"
    Plugin    = "bedrock-agent-plugin"
  })
  
  # Agent configuration with defaults
  agent_config = merge({
    idle_session_ttl_in_seconds = 900
    prepare_agent               = true
    skip_resource_in_use_check  = false
  }, var.agent_config)
}

# Data sources are defined in shared.tf

# -----------------------------------------------------------------------------
# IAM Role for Agent Execution
# -----------------------------------------------------------------------------

resource "aws_iam_role" "agent_execution_role" {
  name = "${local.name_prefix}-agent-execution-role"

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

  tags = local.agent_tags
}

# IAM Policy for Agent Execution
resource "aws_iam_role_policy" "agent_execution_policy" {
  name = "${local.name_prefix}-agent-execution-policy"
  role = aws_iam_role.agent_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:RetrieveAndGenerate",
          "bedrock:Retrieve"
        ]
        Resource = "*"
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
    ], var.knowledge_base_arns != null ? [
      {
        Effect = "Allow"
        Action = [
          "bedrock:Retrieve",
          "bedrock:RetrieveAndGenerate"
        ]
        Resource = var.knowledge_base_arns
      }
    ] : [], var.lambda_function_arns != null ? [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = var.lambda_function_arns
      }
    ] : [], var.s3_bucket_arns != null ? [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = flatten([
          var.s3_bucket_arns,
          [for arn in var.s3_bucket_arns : "${arn}/*"]
        ])
      }
    ] : [])
  })
}

# -----------------------------------------------------------------------------
# Bedrock Agent
# -----------------------------------------------------------------------------

resource "aws_bedrockagent_agent" "main" {
  agent_name                  = local.agent_config.name
  agent_resource_role_arn     = aws_iam_role.agent_execution_role.arn
  description                 = local.agent_config.description
  foundation_model            = local.agent_config.foundation_model
  instruction                 = local.agent_config.instruction
  idle_session_ttl_in_seconds = local.agent_config.idle_session_ttl_in_seconds
  prepare_agent               = local.agent_config.prepare_agent
  skip_resource_in_use_check  = local.agent_config.skip_resource_in_use_check

  # Prompt Override Configuration
  dynamic "prompt_override_configuration" {
    for_each = local.agent_config.prompt_override_configuration != null ? [local.agent_config.prompt_override_configuration] : []
    
    content {
      prompt_configurations {
        base_prompt_template = prompt_override_configuration.value.base_prompt_template
        inference_configuration {
          # maximum_length     = prompt_override_configuration.value.inference_configuration.maximum_length
          stop_sequences     = prompt_override_configuration.value.inference_configuration.stop_sequences
          temperature        = prompt_override_configuration.value.inference_configuration.temperature
          top_k             = prompt_override_configuration.value.inference_configuration.top_k
          top_p             = prompt_override_configuration.value.inference_configuration.top_p
        }
        parser_mode          = prompt_override_configuration.value.parser_mode
        prompt_creation_mode = prompt_override_configuration.value.prompt_creation_mode
        prompt_state         = prompt_override_configuration.value.prompt_state
        prompt_type          = prompt_override_configuration.value.prompt_type
      }
    }
  }

  # Customer Encryption Configuration
  customer_encryption_key_arn = var.kms_key_arn

  # Guardrail Configuration
  dynamic "guardrail_configuration" {
    for_each = var.guardrail_identifier != null ? [1] : []
    
    content {
      guardrail_identifier = var.guardrail_identifier
      guardrail_version    = var.guardrail_version
    }
  }

  tags = local.agent_tags
}

# -----------------------------------------------------------------------------
# Agent Action Groups
# -----------------------------------------------------------------------------

resource "aws_bedrockagent_agent_action_group" "action_groups" {
  for_each = local.agent_config.action_groups != null ? local.agent_config.action_groups : {}

  action_group_name          = each.value.name
  agent_id                  = aws_bedrockagent_agent.main.agent_id
  agent_version             = "DRAFT"
  description               = each.value.description
  skip_resource_in_use_check = true

  # Action Group Executor
  dynamic "action_group_executor" {
    for_each = each.value.lambda_function_arn != null ? [each.value.lambda_function_arn] : []
    
    content {
      lambda = action_group_executor.value
    }
  }

  # API Schema
  dynamic "api_schema" {
    for_each = each.value.api_schema != null ? [each.value.api_schema] : []
    
    content {
      dynamic "s3" {
        for_each = api_schema.value.s3_bucket_name != null ? [1] : []
        
        content {
          s3_bucket_name = api_schema.value.s3_bucket_name
          s3_object_key  = api_schema.value.s3_object_key
        }
      }
      
      # Payload configuration
      payload = api_schema.value.payload
    }
  }

  # Function Schema
  dynamic "function_schema" {
    for_each = each.value.function_schema != null ? [each.value.function_schema] : []
    
    content {
      dynamic "member_functions" {
        for_each = function_schema.value.functions != null ? function_schema.value.functions : []
        
        content {
          dynamic "functions" {
            for_each = [member_functions.value]
            
            content {
              name        = functions.value.name
              description = functions.value.description
              
              dynamic "parameters" {
                for_each = functions.value.parameters != null ? functions.value.parameters : []
                
                content {
                  map_block_key = parameters.value.name
                  description   = parameters.value.description
                  required      = parameters.value.required
                  type          = parameters.value.type
                }
              }
            }
          }
        }
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Agent Knowledge Base Associations
# -----------------------------------------------------------------------------

resource "aws_bedrockagent_agent_knowledge_base_association" "knowledge_bases" {
  for_each = var.knowledge_base_associations != null ? var.knowledge_base_associations : {}

  agent_id             = aws_bedrockagent_agent.main.agent_id
  agent_version        = "DRAFT"
  description          = each.value.description
  knowledge_base_id    = each.value.knowledge_base_id
  knowledge_base_state = each.value.knowledge_base_state
}

# -----------------------------------------------------------------------------
# Agent Alias
# -----------------------------------------------------------------------------

resource "aws_bedrockagent_agent_alias" "main" {
  count = var.create_agent_alias ? 1 : 0

  agent_alias_name = local.agent_config.alias_name != null ? local.agent_config.alias_name : "${local.agent_config.name}-alias"
  agent_id         = aws_bedrockagent_agent.main.agent_id
  description      = "Production alias for ${local.agent_config.name}"

  # Routing Configuration
  dynamic "routing_configuration" {
    for_each = local.agent_config.routing_configuration != null ? [local.agent_config.routing_configuration] : []
    
    content {
      agent_version = routing_configuration.value.agent_version
    }
  }

  tags = local.agent_tags
}

# -----------------------------------------------------------------------------
# CloudWatch Log Group for Agent using CBBaC module
# -----------------------------------------------------------------------------

module "agent_logs" {
  source = "git::https://github.com/porsche-code/aws-cbbac-management_and_governance-cloudwatch.git//terraform"

  create_log_group             = true
  log_group_name              = "/aws/bedrock/agent/${aws_bedrockagent_agent.main.agent_name}"
  log_group_retention_period  = var.log_retention_days
  log_group_kms_key_id        = var.kms_key_arn
  create_log_stream           = false

  tags = local.agent_tags
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms for Monitoring
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "agent_invocation_errors" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${local.name_prefix}-agent-invocation-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "InvocationErrors"
  namespace           = "AWS/BedrockAgent"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors Bedrock Agent invocation errors"
  alarm_actions       = var.alarm_topic_arn != null ? [var.alarm_topic_arn] : []

  dimensions = {
    AgentId = aws_bedrockagent_agent.main.agent_id
  }

  tags = local.agent_tags
}

resource "aws_cloudwatch_metric_alarm" "agent_latency" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${local.name_prefix}-agent-high-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "InvocationLatency"
  namespace           = "AWS/BedrockAgent"
  period              = "300"
  statistic           = "Average"
  threshold           = "30000" # 30 seconds in milliseconds
  alarm_description   = "This metric monitors Bedrock Agent high latency"
  alarm_actions       = var.alarm_topic_arn != null ? [var.alarm_topic_arn] : []

  dimensions = {
    AgentId = aws_bedrockagent_agent.main.agent_id
  }

  tags = local.agent_tags
}
