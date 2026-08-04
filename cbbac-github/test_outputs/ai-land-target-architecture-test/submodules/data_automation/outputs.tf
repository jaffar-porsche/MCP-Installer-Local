# =============================================================================
# Data Automation Submodule - Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# Flow Execution Role Outputs
# -----------------------------------------------------------------------------

output "flow_execution_role_arns" {
  description = "ARNs of flow execution roles"
  value = {
    for k, v in aws_iam_role.flow_execution_role : k => v.arn
  }
}

output "flow_execution_role_names" {
  description = "Names of flow execution roles"
  value = {
    for k, v in aws_iam_role.flow_execution_role : k => v.name
  }
}

# -----------------------------------------------------------------------------
# Lambda Function Outputs
# -----------------------------------------------------------------------------

output "flow_orchestrator_arns" {
  description = "ARNs of flow orchestrator Lambda functions"
  value = {
    for k, v in aws_lambda_function.flow_orchestrator : k => v.arn
  }
}

output "flow_orchestrator_names" {
  description = "Names of flow orchestrator Lambda functions"
  value = {
    for k, v in aws_lambda_function.flow_orchestrator : k => v.function_name
  }
}

output "flow_orchestrator_invoke_arns" {
  description = "Invoke ARNs of flow orchestrator Lambda functions"
  value = {
    for k, v in aws_lambda_function.flow_orchestrator : k => v.invoke_arn
  }
}

# -----------------------------------------------------------------------------
# Step Functions Outputs
# -----------------------------------------------------------------------------

output "step_function_arns" {
  description = "ARNs of Step Functions state machines"
  value = {
    for k, v in aws_sfn_state_machine.flow_state_machine : k => v.arn
  }
}

output "step_function_names" {
  description = "Names of Step Functions state machines"
  value = {
    for k, v in aws_sfn_state_machine.flow_state_machine : k => v.name
  }
}

# -----------------------------------------------------------------------------
# EventBridge Outputs
# -----------------------------------------------------------------------------

output "scheduled_flow_rules" {
  description = "EventBridge rules for scheduled flows"
  value = {
    for k, v in aws_cloudwatch_event_rule.flow_schedule : k => {
      name                = v.name
      arn                = v.arn
      schedule_expression = v.schedule_expression
    }
  }
}

# -----------------------------------------------------------------------------
# Monitoring Outputs
# -----------------------------------------------------------------------------

output "flow_log_group_names" {
  description = "Names of CloudWatch log groups for flows"
  value = {
    for k, v in module.flow_logs : k => v.log_group.name
  }
}

output "flow_log_group_arns" {
  description = "ARNs of CloudWatch log groups for flows"
  value = {
    for k, v in module.flow_logs : k => v.log_group.arn
  }
}

output "flow_alarm_arns" {
  description = "ARNs of CloudWatch alarms for flows"
  value = {
    error_alarms = {
      for k, v in aws_cloudwatch_metric_alarm.flow_errors : k => v.arn
    }
    duration_alarms = {
      for k, v in aws_cloudwatch_metric_alarm.flow_duration : k => v.arn
    }
  }
}

# -----------------------------------------------------------------------------
# S3 Artifacts Bucket Outputs
# -----------------------------------------------------------------------------

output "artifacts_bucket_id" {
  description = "ID of the S3 bucket for flow artifacts"
  value       = var.create_artifacts_bucket ? aws_s3_bucket.flow_artifacts[0].id : null
}

output "artifacts_bucket_arn" {
  description = "ARN of the S3 bucket for flow artifacts"
  value       = var.create_artifacts_bucket ? aws_s3_bucket.flow_artifacts[0].arn : null
}

output "artifacts_bucket_domain_name" {
  description = "Domain name of the S3 bucket for flow artifacts"
  value       = var.create_artifacts_bucket ? aws_s3_bucket.flow_artifacts[0].bucket_domain_name : null
}

# -----------------------------------------------------------------------------
# Flow Configuration Outputs
# -----------------------------------------------------------------------------

output "flow_configurations" {
  description = "Detailed configuration of each flow"
  value = {
    for k, v in var.flows_config : k => {
      description         = v.description
      foundation_models   = v.foundation_models
      timeout            = v.timeout
      memory_size        = v.memory_size
      schedule_expression = v.schedule_expression
      step_functions_enabled = var.enable_step_functions
      has_schedule       = v.schedule_expression != null
      flow_steps_count   = v.flow_steps != null ? length(v.flow_steps) : 0
    }
  }
}

# -----------------------------------------------------------------------------
# Integration Outputs
# -----------------------------------------------------------------------------

output "flow_integration_endpoints" {
  description = "Integration endpoints for external systems"
  value = {
    lambda_functions = {
      for k, v in aws_lambda_function.flow_orchestrator : k => {
        function_name = v.function_name
        invoke_arn   = v.invoke_arn
        arn          = v.arn
      }
    }
    step_functions = var.enable_step_functions ? {
      for k, v in aws_sfn_state_machine.flow_state_machine : k => {
        state_machine_name = v.name
        arn               = v.arn
      }
    } : {}
  }
}

# -----------------------------------------------------------------------------
# Execution Triggers Outputs
# -----------------------------------------------------------------------------

output "execution_triggers" {
  description = "Available triggers for flow execution"
  value = {
    scheduled_flows = {
      for k, v in aws_cloudwatch_event_rule.flow_schedule : k => {
        rule_name           = v.name
        schedule_expression = v.schedule_expression
        target_arn         = var.enable_step_functions ? aws_sfn_state_machine.flow_state_machine[k].arn : aws_lambda_function.flow_orchestrator[k].arn
      }
    }
    manual_triggers = {
      for k, v in aws_lambda_function.flow_orchestrator : k => {
        function_name = v.function_name
        invoke_command = "aws lambda invoke --function-name ${v.function_name} --payload '{\"operation\":\"execute\"}' response.json"
      }
    }
  }
}

# -----------------------------------------------------------------------------
# Permissions Summary
# -----------------------------------------------------------------------------

output "permissions_summary" {
  description = "Summary of permissions granted to each flow"
  value = {
    for k, v in var.flows_config : k => {
      s3_access         = v.s3_bucket_arns != null ? length(v.s3_bucket_arns) : 0
      lambda_access     = v.lambda_function_arns != null ? length(v.lambda_function_arns) : 0
      knowledge_base_access = v.knowledge_base_arns != null ? length(v.knowledge_base_arns) : 0
      foundation_models = length(v.foundation_models)
    }
  }
}

# -----------------------------------------------------------------------------
# Cost Optimization Info
# -----------------------------------------------------------------------------

output "cost_optimization_info" {
  description = "Information about cost optimization features"
  value = {
    lambda_timeout_configs = {
      for k, v in var.flows_config : k => {
        timeout_seconds = v.timeout
        memory_mb      = v.memory_size
      }
    }
    scheduled_flows_count = length([
      for k, v in var.flows_config : k if v.schedule_expression != null
    ])
    step_functions_enabled = var.enable_step_functions
    artifacts_bucket_created = var.create_artifacts_bucket
  }
}

# -----------------------------------------------------------------------------
# Submodule Information
# -----------------------------------------------------------------------------

output "submodule_info" {
  description = "Submodule information and metadata"
  value = {
    submodule_name    = "data-automation"
    submodule_version = "1.0.0"
    terraform_version = ">= 1.0"
    aws_provider_version = ">= 5.0"
    total_flows = length(var.flows_config)
    created_resources = [
      "aws_iam_role (flow_execution_role)",
      "aws_iam_role_policy (flow_execution_policy)",
      "aws_lambda_function (flow_orchestrator)",
      "aws_iam_role (flow_lambda_role)",
      "aws_iam_role_policy (flow_lambda_policy)",
      "module.flow_logs (CBBaC CloudWatch)",
      "aws_cloudwatch_metric_alarm (flow_errors, flow_duration)"
    ]
    conditional_resources = {
      step_functions = var.enable_step_functions ? [
        "aws_sfn_state_machine",
        "aws_iam_role (step_functions_role)",
        "aws_iam_role_policy (step_functions_policy)"
      ] : []
      scheduled_flows = [
        "aws_cloudwatch_event_rule",
        "aws_cloudwatch_event_target"
      ]
      artifacts_bucket = var.create_artifacts_bucket ? [
        "aws_s3_bucket",
        "aws_s3_bucket_versioning",
        "aws_s3_bucket_server_side_encryption_configuration"
      ] : []
    }
    capabilities = [
      "Automated data processing workflows",
      "Foundation model integration",
      "Scheduled execution",
      "Step Functions orchestration",
      "Real-time monitoring",
      "Error handling and alerting",
      "Artifact storage",
      "Custom flow steps"
    ]
  }
}
