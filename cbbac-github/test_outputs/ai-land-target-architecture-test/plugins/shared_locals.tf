# =============================================================================
# Shared Locals for Bedrock Plugins
# AI-Land Target Architecture - Plugin Module
# =============================================================================

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  
  common_tags = merge(var.additional_tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}
