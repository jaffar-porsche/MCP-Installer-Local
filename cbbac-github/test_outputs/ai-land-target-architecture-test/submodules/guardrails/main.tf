# =============================================================================
# Guardrails Submodule
# AI-Land Target Architecture - Bedrock Guardrails Implementation
# =============================================================================

# This submodule provides comprehensive Bedrock Guardrails functionality
# for responsible AI implementation across the architecture.

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
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
    Component   = "bedrock-guardrails"
    ManagedBy   = "terraform"
    Submodule   = "guardrails"
  })
}

# -----------------------------------------------------------------------------
# Data Sources
# -----------------------------------------------------------------------------

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# -----------------------------------------------------------------------------
# Bedrock Guardrails
# -----------------------------------------------------------------------------

resource "aws_bedrock_guardrail" "main" {
  for_each = var.guardrails_config

  name                      = "${local.name_prefix}-${each.key}"
  description              = each.value.description
  blocked_input_messaging  = each.value.blocked_input_messaging
  blocked_outputs_messaging = each.value.blocked_outputs_messaging

  # Content Policy Configuration
  dynamic "content_policy_config" {
    for_each = each.value.content_policy_config != null ? [each.value.content_policy_config] : []
    
    content {
      dynamic "filters_config" {
        for_each = content_policy_config.value.filters_config
        
        content {
          input_strength  = filters_config.value.input_strength
          output_strength = filters_config.value.output_strength
          type           = filters_config.value.type
        }
      }
    }
  }

  # Topic Policy Configuration
  dynamic "topic_policy_config" {
    for_each = each.value.topic_policy_config != null ? [each.value.topic_policy_config] : []
    
    content {
      dynamic "topics_config" {
        for_each = topic_policy_config.value.topics_config
        
        content {
          definition = topics_config.value.definition
          examples   = topics_config.value.examples
          name       = topics_config.value.name
          type       = topics_config.value.type
        }
      }
    }
  }

  # Word Policy Configuration
  dynamic "word_policy_config" {
    for_each = each.value.word_policy_config != null ? [each.value.word_policy_config] : []
    
    content {
      dynamic "managed_word_lists_config" {
        for_each = word_policy_config.value.managed_word_lists_config != null ? word_policy_config.value.managed_word_lists_config : []
        
        content {
          type = managed_word_lists_config.value.type
        }
      }
      
      dynamic "words_config" {
        for_each = word_policy_config.value.words_config != null ? word_policy_config.value.words_config : []
        
        content {
          text = words_config.value.text
        }
      }
    }
  }

  # Sensitive Information Policy Configuration
  dynamic "sensitive_information_policy_config" {
    for_each = each.value.sensitive_information_policy_config != null ? [each.value.sensitive_information_policy_config] : []
    
    content {
      dynamic "pii_entities_config" {
        for_each = sensitive_information_policy_config.value.pii_entities_config != null ? sensitive_information_policy_config.value.pii_entities_config : []
        
        content {
          action = pii_entities_config.value.action
          type   = pii_entities_config.value.type
        }
      }
      
      dynamic "regexes_config" {
        for_each = sensitive_information_policy_config.value.regexes_config != null ? sensitive_information_policy_config.value.regexes_config : []
        
        content {
          action      = regexes_config.value.action
          description = regexes_config.value.description
          name        = regexes_config.value.name
          pattern     = regexes_config.value.pattern
        }
      }
    }
  }

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Guardrail Versions
# -----------------------------------------------------------------------------

resource "aws_bedrock_guardrail_version" "main" {
  for_each = var.create_guardrail_versions ? var.guardrails_config : {}

  guardrail_arn = aws_bedrock_guardrail.main[each.key].guardrail_arn
  description   = "Version ${each.value.version_description != null ? each.value.version_description : "1.0"} of ${each.key} guardrail"
}

# -----------------------------------------------------------------------------
# CloudWatch Log Groups for Guardrails
# -----------------------------------------------------------------------------
# CloudWatch Log Groups for Guardrails using CBBaC module
# -----------------------------------------------------------------------------

module "guardrails_logs" {
  for_each = var.guardrails_config
  source = "git::https://github.com/porsche-code/aws-cbbac-management_and_governance-cloudwatch.git//terraform"

  create_log_group             = true
  log_group_name              = "/aws/bedrock/guardrails/${each.key}"
  log_group_retention_period  = var.log_retention_days
  log_group_kms_key_id        = var.kms_key_arn
  create_log_stream           = false

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms for Guardrails Monitoring
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "guardrail_violations" {
  for_each = var.enable_monitoring ? var.guardrails_config : {}

  alarm_name          = "${local.name_prefix}-${each.key}-violations"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "GuardrailViolations"
  namespace           = "AWS/BedrockGuardrail"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.violation_threshold
  alarm_description   = "This metric monitors guardrail violations for ${each.key}"
  alarm_actions       = var.alarm_topic_arn != null ? [var.alarm_topic_arn] : []

  dimensions = {
    GuardrailId = aws_bedrock_guardrail.main[each.key].guardrail_id
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "guardrail_latency" {
  for_each = var.enable_monitoring ? var.guardrails_config : {}

  alarm_name          = "${local.name_prefix}-${each.key}-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "GuardrailLatency"
  namespace           = "AWS/BedrockGuardrail"
  period              = "300"
  statistic           = "Average"
  threshold           = var.latency_threshold
  alarm_description   = "This metric monitors guardrail latency for ${each.key}"
  alarm_actions       = var.alarm_topic_arn != null ? [var.alarm_topic_arn] : []

  dimensions = {
    GuardrailId = aws_bedrock_guardrail.main[each.key].guardrail_id
  }

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# Guardrails Dashboard
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_dashboard" "guardrails" {
  count = var.create_dashboard ? 1 : 0

  dashboard_name = "${local.name_prefix}-guardrails-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            for k, v in var.guardrails_config : [
              "AWS/BedrockGuardrail", "GuardrailViolations", "GuardrailId", aws_bedrock_guardrail.main[k].guardrail_id
            ]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Guardrail Violations"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            for k, v in var.guardrails_config : [
              "AWS/BedrockGuardrail", "GuardrailLatency", "GuardrailId", aws_bedrock_guardrail.main[k].guardrail_id
            ]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Guardrail Latency"
          period  = 300
        }
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Custom Metrics for Guardrails Analytics
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_metric_filter" "content_violations" {
  for_each = var.enable_custom_metrics ? var.guardrails_config : {}

  name           = "${local.name_prefix}-${each.key}-content-violations"
  log_group_name = module.guardrails_logs[each.key].log_group.name
  pattern        = "[timestamp, request_id, guardrail_id, violation_type=\"CONTENT\", ...]"

  metric_transformation {
    name      = "ContentViolations"
    namespace = "Custom/BedrockGuardrails"
    value     = "1"
    default_value = 0
    
    dimensions = {
      GuardrailName = each.key
      ViolationType = "CONTENT"
    }
  }
}

resource "aws_cloudwatch_log_metric_filter" "topic_violations" {
  for_each = var.enable_custom_metrics ? var.guardrails_config : {}

  name           = "${local.name_prefix}-${each.key}-topic-violations"
  log_group_name = module.guardrails_logs[each.key].log_group.name
  pattern        = "[timestamp, request_id, guardrail_id, violation_type=\"TOPIC\", ...]"

  metric_transformation {
    name      = "TopicViolations"
    namespace = "Custom/BedrockGuardrails"
    value     = "1"
    default_value = 0
    
    dimensions = {
      GuardrailName = each.key
      ViolationType = "TOPIC"
    }
  }
}

resource "aws_cloudwatch_log_metric_filter" "pii_violations" {
  for_each = var.enable_custom_metrics ? var.guardrails_config : {}

  name           = "${local.name_prefix}-${each.key}-pii-violations"
  log_group_name = module.guardrails_logs[each.key].log_group.name
  pattern        = "[timestamp, request_id, guardrail_id, violation_type=\"PII\", ...]"

  metric_transformation {
    name      = "PIIViolations"
    namespace = "Custom/BedrockGuardrails"
    value     = "1"
    default_value = 0
    
    dimensions = {
      GuardrailName = each.key
      ViolationType = "PII"
    }
  }
}
