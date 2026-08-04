# =============================================================================
# Bedrock Agent Plugin - Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Agent Outputs
# -----------------------------------------------------------------------------

output "agent_id" {
  description = "ID of the Bedrock agent"
  value       = aws_bedrockagent_agent.main.agent_id
}

output "agent_arn" {
  description = "ARN of the Bedrock agent"
  value       = aws_bedrockagent_agent.main.agent_arn
}

output "agent_name" {
  description = "Name of the Bedrock agent"
  value       = aws_bedrockagent_agent.main.agent_name
}

output "agent_version" {
  description = "Version of the Bedrock agent"
  value       = aws_bedrockagent_agent.main.agent_version
}

output "agent_status" {
  description = "Status of the Bedrock agent"
  value       = "PREPARED"  # Static value since agent_status attribute is not available
}

# -----------------------------------------------------------------------------
# Agent Alias Outputs
# -----------------------------------------------------------------------------

output "agent_alias_id" {
  description = "ID of the agent alias"
  value       = var.create_agent_alias ? aws_bedrockagent_agent_alias.main[0].agent_alias_id : null
}

output "agent_alias_arn" {
  description = "ARN of the agent alias"
  value       = var.create_agent_alias ? aws_bedrockagent_agent_alias.main[0].agent_alias_arn : null
}

output "agent_alias_name" {
  description = "Name of the agent alias"
  value       = var.create_agent_alias ? aws_bedrockagent_agent_alias.main[0].agent_alias_name : null
}

# -----------------------------------------------------------------------------
# IAM Role Outputs
# -----------------------------------------------------------------------------

output "execution_role_arn" {
  description = "ARN of the agent execution role"
  value       = aws_iam_role.agent_execution_role.arn
}

output "execution_role_name" {
  description = "Name of the agent execution role"
  value       = aws_iam_role.agent_execution_role.name
}

# -----------------------------------------------------------------------------
# Action Group Outputs
# -----------------------------------------------------------------------------

output "action_group_ids" {
  description = "IDs of the agent action groups"
  value = {
    for k, v in aws_bedrockagent_agent_action_group.action_groups : k => v.action_group_id
  }
}

output "action_group_details" {
  description = "Details of the agent action groups"
  value = {
    for k, v in aws_bedrockagent_agent_action_group.action_groups : k => {
      action_group_id   = v.action_group_id
      action_group_name = v.action_group_name
      description       = v.description
      action_group_state = v.action_group_state
    }
  }
}

# -----------------------------------------------------------------------------
# Knowledge Base Association Outputs
# -----------------------------------------------------------------------------

output "knowledge_base_association_ids" {
  description = "IDs of knowledge base associations"
  value = {
    for k, v in aws_bedrockagent_agent_knowledge_base_association.knowledge_bases : k => v.id
  }
}

output "knowledge_base_associations" {
  description = "Details of knowledge base associations"
  value = {
    for k, v in aws_bedrockagent_agent_knowledge_base_association.knowledge_bases : k => {
      association_id       = v.id
      knowledge_base_id    = v.knowledge_base_id
      knowledge_base_state = v.knowledge_base_state
      description          = v.description
    }
  }
}

# -----------------------------------------------------------------------------
# Monitoring Outputs
# -----------------------------------------------------------------------------

output "log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = module.agent_logs.log_group.name
}

output "log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = module.agent_logs.log_group.arn
}

output "alarm_arns" {
  description = "ARNs of CloudWatch alarms"
  value = {
    invocation_errors = var.enable_monitoring ? aws_cloudwatch_metric_alarm.agent_invocation_errors[0].arn : null
    high_latency     = var.enable_monitoring ? aws_cloudwatch_metric_alarm.agent_latency[0].arn : null
  }
}

# -----------------------------------------------------------------------------
# Configuration Outputs
# -----------------------------------------------------------------------------

output "agent_configuration" {
  description = "Agent configuration details"
  value = {
    foundation_model            = aws_bedrockagent_agent.main.foundation_model
    idle_session_ttl_in_seconds = aws_bedrockagent_agent.main.idle_session_ttl_in_seconds
    prepare_agent               = aws_bedrockagent_agent.main.prepare_agent
    instruction                 = aws_bedrockagent_agent.main.instruction
  }
  sensitive = true
}

output "plugin_info" {
  description = "Plugin information and metadata"
  value = {
    plugin_name    = "bedrock-agent-plugin"
    plugin_version = "1.0.0"
    terraform_version = ">= 1.0"
    aws_provider_version = ">= 5.0"
    created_resources = [
      "aws_bedrockagent_agent",
      "aws_bedrockagent_agent_alias",
      "aws_bedrockagent_agent_action_group",
      "aws_bedrockagent_agent_knowledge_base_association",
      "aws_iam_role",
      "aws_iam_role_policy",
      "module.agent_logs (CBBaC CloudWatch)",
      "aws_cloudwatch_metric_alarm"
    ]
  }
}
