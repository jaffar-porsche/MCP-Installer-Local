# =============================================================================
# Guardrails Submodule - Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Guardrail Outputs
# -----------------------------------------------------------------------------

output "guardrail_ids" {
  description = "IDs of the created guardrails"
  value = {
    for k, v in aws_bedrock_guardrail.main : k => v.guardrail_id
  }
}

output "guardrail_arns" {
  description = "ARNs of the created guardrails"
  value = {
    for k, v in aws_bedrock_guardrail.main : k => v.guardrail_arn
  }
}

output "guardrail_names" {
  description = "Names of the created guardrails"
  value = {
    for k, v in aws_bedrock_guardrail.main : k => v.name
  }
}

output "guardrail_status" {
  description = "Status of the created guardrails"
  value = {
    for k, v in aws_bedrock_guardrail.main : k => v.status
  }
}

output "guardrail_versions" {
  description = "Versions of the created guardrails"
  value = {
    for k, v in aws_bedrock_guardrail.main : k => v.version
  }
}

# -----------------------------------------------------------------------------
# Guardrail Version Outputs
# -----------------------------------------------------------------------------

output "guardrail_version_arns" {
  description = "ARNs of the guardrail versions"
  value = {
    for k, v in aws_bedrock_guardrail_version.main : k => v.guardrail_arn
  }
}

output "guardrail_version_numbers" {
  description = "Version numbers of the guardrail versions"
  value = {
    for k, v in aws_bedrock_guardrail_version.main : k => v.version
  }
}

# -----------------------------------------------------------------------------
# Configuration Outputs
# -----------------------------------------------------------------------------

output "guardrail_configurations" {
  description = "Detailed configuration of each guardrail"
  value = {
    for k, v in aws_bedrock_guardrail.main : k => {
      name                       = v.name
      description               = v.description
      blocked_input_messaging   = v.blocked_input_messaging
      blocked_outputs_messaging = v.blocked_outputs_messaging
      status                    = v.status
      version                   = v.version
      created_at                = v.created_at
      failure_reasons           = v.failure_reasons
    }
  }
  sensitive = true
}

# -----------------------------------------------------------------------------
# Monitoring Outputs
# -----------------------------------------------------------------------------

output "log_group_names" {
  description = "Names of the CloudWatch log groups"
  value = {
    for k, v in module.guardrails_logs : k => v.log_group.name
  }
}

output "log_group_arns" {
  description = "ARNs of the CloudWatch log groups"
  value = {
    for k, v in module.guardrails_logs : k => v.log_group.arn
  }
}

output "alarm_arns" {
  description = "ARNs of CloudWatch alarms"
  value = {
    violation_alarms = {
      for k, v in aws_cloudwatch_metric_alarm.guardrail_violations : k => v.arn
    }
    latency_alarms = {
      for k, v in aws_cloudwatch_metric_alarm.guardrail_latency : k => v.arn
    }
  }
}

output "dashboard_arn" {
  description = "ARN of the CloudWatch dashboard"
  value       = var.create_dashboard ? aws_cloudwatch_dashboard.guardrails[0].dashboard_arn : null
}

output "dashboard_url" {
  description = "URL of the CloudWatch dashboard"
  value       = var.create_dashboard ? "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.guardrails[0].dashboard_name}" : null
}

# -----------------------------------------------------------------------------
# Custom Metrics Outputs
# -----------------------------------------------------------------------------

output "custom_metric_filters" {
  description = "Custom metric filters for detailed analytics"
  value = var.enable_custom_metrics ? {
    content_violations = {
      for k, v in aws_cloudwatch_log_metric_filter.content_violations : k => v.name
    }
    topic_violations = {
      for k, v in aws_cloudwatch_log_metric_filter.topic_violations : k => v.name
    }
    pii_violations = {
      for k, v in aws_cloudwatch_log_metric_filter.pii_violations : k => v.name
    }
  } : {}
}

# -----------------------------------------------------------------------------
# Integration Outputs
# -----------------------------------------------------------------------------

output "guardrail_identifiers_for_agents" {
  description = "Guardrail identifiers formatted for Bedrock Agent integration"
  value = {
    for k, v in aws_bedrock_guardrail.main : k => {
      guardrail_identifier = v.guardrail_id
      guardrail_version   = var.create_guardrail_versions ? aws_bedrock_guardrail_version.main[k].version : "DRAFT"
    }
  }
}

output "guardrail_identifiers_for_knowledge_bases" {
  description = "Guardrail identifiers formatted for Knowledge Base integration"
  value = {
    for k, v in aws_bedrock_guardrail.main : k => v.guardrail_id
  }
}

# -----------------------------------------------------------------------------
# Summary Outputs
# -----------------------------------------------------------------------------

output "guardrails_summary" {
  description = "Summary of created guardrails and their capabilities"
  value = {
    total_guardrails = length(var.guardrails_config)
    guardrail_names = keys(var.guardrails_config)
    
    # Count of different policy types
    content_policies = length([
      for k, v in var.guardrails_config : k if v.content_policy_config != null
    ])
    topic_policies = length([
      for k, v in var.guardrails_config : k if v.topic_policy_config != null
    ])
    word_policies = length([
      for k, v in var.guardrails_config : k if v.word_policy_config != null
    ])
    pii_policies = length([
      for k, v in var.guardrails_config : k if v.sensitive_information_policy_config != null
    ])
    
    # Monitoring status
    monitoring_enabled = var.enable_monitoring
    dashboard_created = var.create_dashboard
    custom_metrics_enabled = var.enable_custom_metrics
  }
}

# -----------------------------------------------------------------------------
# Submodule Information
# -----------------------------------------------------------------------------

output "submodule_info" {
  description = "Submodule information and metadata"
  value = {
    submodule_name    = "guardrails"
    submodule_version = "1.0.0"
    terraform_version = ">= 1.0"
    aws_provider_version = ">= 5.0"
    created_resources = [
      "aws_bedrock_guardrail",
      "aws_bedrock_guardrail_version",
      "module.guardrails_logs (CBBaC CloudWatch)",
      "aws_cloudwatch_metric_alarm",
      "aws_cloudwatch_dashboard",
      "aws_cloudwatch_log_metric_filter"
    ]
    capabilities = [
      "Content filtering",
      "Topic-based filtering", 
      "Word-based filtering",
      "PII detection and filtering",
      "Custom regex patterns",
      "Real-time monitoring",
      "Custom analytics",
      "Dashboard visualization"
    ]
  }
}
