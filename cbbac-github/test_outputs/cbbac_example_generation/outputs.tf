# Outputs for Container Land ECS Architecture

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc.id
}

output "private_subnet_ids" {
  description = "IDs of the private application subnets"
  value       = module.vpc.private_application_subnets[*].id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnets[*].id
}

output "ecs_cluster_id" {
  description = "ID of the ECS cluster"
  value       = module.ecs_cluster.ecs_cluster_id
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = "${local.project_name}-cluster"
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = module.ecs_service.ecs_service_name
}

output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = module.ecr.repository_url
}

output "load_balancer_dns_name" {
  description = "DNS name of the load balancer"
  value       = module.alb.dns_name
}

output "load_balancer_zone_id" {
  description = "Zone ID of the load balancer"
  value       = module.alb.zone_id
}

output "kms_key_id" {
  description = "The ID of the KMS key"
  value       = module.kms.kms_key.id
}

output "kms_key_arn" {
  description = "The ARN of the KMS key"
  value       = module.kms.kms_key.arn
}

output "service_discovery_namespace_id" {
  description = "ID of the service discovery namespace"
  value       = aws_service_discovery_private_dns_namespace.main.id
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = aws_lb_target_group.ecs_app.arn
}
