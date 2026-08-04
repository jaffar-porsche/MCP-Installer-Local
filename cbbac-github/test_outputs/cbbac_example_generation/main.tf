# Container Land - ECS Architecture with CBBaC Modules
# This architecture provides a complete ECS setup with all required services for compliance

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Local values for common configurations
locals {
  project_name = "container-land"
  common_tags = {
    Project     = local.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    Owner       = "Platform-Team"
  }
}

# KMS Key for encryption compliance
module "kms" {
  source = "git::https://github.com/porsche-code/aws-cbbac-security_identity_compliance-kms.git//terraform"
  
  name        = "${local.project_name}-encryption-key"
  description = "KMS key for Container Land ECS encryption"
  
  enable_key_rotation = true
  multi_region       = false
  
  tags = local.common_tags
}

# CloudWatch Log Group for VPC Flow Logs
resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  name              = "/aws/vpc/flowlogs/${local.project_name}"
  retention_in_days = 30
  kms_key_id        = module.kms.kms_key.arn
  
  tags = local.common_tags
}

# VPC with private subnets for ECS
module "vpc" {
  source = "git::https://github.com/porsche-code/aws-cbbac-networking_and_content_delivery-vpc.git//terraform"
  
  project_name              = local.project_name
  flow_logs_log_group_arn   = aws_cloudwatch_log_group.vpc_flow_logs.arn
  
  vpc_cidr                           = var.vpc_cidr
  public_subnet_cidr                 = var.public_subnet_cidrs
  private_application_subnet_cidr    = var.private_app_subnet_cidrs
  private_database_subnet_cidr       = var.private_db_subnet_cidrs
  
  create_nat_gateways = true
  
  common_tags = local.common_tags
}

# Security Group for ECS Tasks
module "ecs_security_group" {
  source = "git::https://github.com/porsche-code/aws-cbbac-security_identity_compliance-security_group.git//terraform"
  
  security_group_name_prefix = "${local.project_name}-ecs"
  security_group_description = "Security group for ECS tasks"
  vpc_id                     = module.vpc.vpc.id
  
  security_group_rules = {
    ingress_http = {
      type        = "ingress"
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = [var.vpc_cidr]
      description = "HTTP from VPC"
    }
    ingress_https = {
      type        = "ingress"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = [var.vpc_cidr]
      description = "HTTPS from VPC"
    }
    egress_all = {
      type        = "egress"
      from_port   = 0
      to_port     = 0
      protocol    = "-1"
      cidr_blocks = ["0.0.0.0/0"]
      description = "All outbound traffic"
    }
  }
  
  tags = local.common_tags
}

# Security Group for ALB
module "alb_security_group" {
  source = "git::https://github.com/porsche-code/aws-cbbac-security_identity_compliance-security_group.git//terraform"
  
  security_group_name_prefix = "${local.project_name}-alb"
  security_group_description = "Security group for Application Load Balancer"
  vpc_id                     = module.vpc.vpc.id
  
  security_group_rules = {
    ingress_http = {
      type        = "ingress"
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTP from internet"
    }
    ingress_https = {
      type        = "ingress"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      description = "HTTPS from internet"
    }
    egress_all = {
      type        = "egress"
      from_port   = 0
      to_port     = 0
      protocol    = "-1"
      cidr_blocks = ["0.0.0.0/0"]
      description = "All outbound traffic"
    }
  }
  
  tags = local.common_tags
}

# ECR Repository for container images
module "ecr" {
  source = "git::https://github.com/porsche-code/aws-cbbac-containers-ecr.git//terraform"
  
  repository_name = "${local.project_name}-app"
  
  repository_image_tag_mutability = "MUTABLE"
  repository_image_scan_on_push   = true
  
  repository_encryption_type = "KMS"
  repository_kms_key        = module.kms.kms_key.arn
  
  repository_lifecycle_policy = {
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  }
  
  tags = local.common_tags
}

# CloudWatch Log Group for ECS Cluster
resource "aws_cloudwatch_log_group" "ecs_cluster" {
  name              = "/aws/ecs/cluster/${local.project_name}"
  retention_in_days = 30
  kms_key_id        = module.kms.kms_key.arn
  
  tags = local.common_tags
}

# CloudWatch Log Group for ECS Tasks
resource "aws_cloudwatch_log_group" "ecs_tasks" {
  name              = "/aws/ecs/tasks/${local.project_name}"
  retention_in_days = 30
  kms_key_id        = module.kms.kms_key.arn
  
  tags = local.common_tags
}

# Service Discovery Namespace
resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "${local.project_name}.local"
  description = "Service discovery namespace for Container Land"
  vpc         = module.vpc.vpc.id
  
  tags = local.common_tags
}

# ECS Cluster
module "ecs_cluster" {
  source = "git::https://github.com/porsche-code/aws-cbbac-containers-ecs.git//terraform/ecs-cluster"
  
  cluster_name                = "${local.project_name}-cluster"
  namespace_name              = aws_service_discovery_private_dns_namespace.main.name
  cluster_log_group_name      = aws_cloudwatch_log_group.ecs_cluster.name
  cluster_log_group_key_arn   = module.kms.kms_key.arn
  
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
  
  default_capacity_provider = {
    capacity_provider = "FARGATE"
    weight           = 1
    base             = 1
  }
  
  container_insight_setting = "enabled"
  
  managed_storage_configuration = {
    kms_key_id                           = module.kms.kms_key.id
    fargate_ephemeral_storage_kms_key_id = module.kms.kms_key.id
  }
  
  common_tags = local.common_tags
}

# Application Load Balancer
module "alb" {
  source = "git::https://github.com/porsche-code/aws-cbbac-networking_and_content_delivery-application_load_balancer.git//terraform"
  
  name = "${local.project_name}-alb"
  
  vpc_id  = module.vpc.vpc.id
  subnets = module.vpc.public_subnets[*].id
  
  security_groups = [module.alb_security_group.security_group_id]
  
  enable_deletion_protection = false
  internal                  = false
  
  tags = local.common_tags
}

# Target Group for ECS Service
resource "aws_lb_target_group" "ecs_app" {
  name        = "${local.project_name}-ecs-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc.id
  target_type = "ip"
  
  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }
  
  tags = local.common_tags
}

# ALB Listener
resource "aws_lb_listener" "main" {
  load_balancer_arn = module.alb.arn
  port              = "80"
  protocol          = "HTTP"
  
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ecs_app.arn
  }
  
  tags = local.common_tags
}

# IAM Role for ECS Task Execution
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "${local.project_name}-ecs-task-execution-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Additional policy for KMS access
resource "aws_iam_role_policy" "ecs_task_execution_kms" {
  name = "${local.project_name}-ecs-task-execution-kms"
  role = aws_iam_role.ecs_task_execution_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [module.kms.kms_key.arn]
      }
    ]
  })
}

# IAM Role for ECS Task
resource "aws_iam_role" "ecs_task_role" {
  name = "${local.project_name}-ecs-task-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.common_tags
}

# ECS Service and Task Definition
module "ecs_service" {
  source = "git::https://github.com/porsche-code/aws-cbbac-containers-ecs.git//terraform/ecs-service-and-task"
  
  # Task Definition
  task_family        = "${local.project_name}-app"
  execution_role_arn = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn      = aws_iam_role.ecs_task_role.arn
  
  task_cpu    = 1024
  task_memory = 2048
  
  required_compatibities = ["FARGATE"]
  
  # Container Configuration
  container_name  = "${local.project_name}-app"
  container_image = "${module.ecr.repository_url}:latest"
  container_cpu   = 512
  container_memory = 1024
  
  container_port_mappings = [
    {
      name           = "http"
      container_port = 80
      host_port      = 80
      protocol       = "tcp"
    }
  ]
  
  container_environment_variables = [
    {
      name  = "ENVIRONMENT"
      value = var.environment
    },
    {
      name  = "LOG_LEVEL"
      value = "INFO"
    }
  ]
  
  # Logging Configuration
  log_group         = aws_cloudwatch_log_group.ecs_tasks.name
  log_stream_prefix = "${local.project_name}-app"
  
  # Service Configuration
  service_name    = "${local.project_name}-service"
  ecs_cluster_id  = module.ecs_cluster.ecs_cluster_id
  desired_count   = var.desired_count
  
  launch_type = "FARGATE"
  
  # Network Configuration
  private_subnets  = module.vpc.private_application_subnets[*].id
  security_groups  = [module.ecs_security_group.security_group_id]
  
  # Load Balancer Configuration
  load_balancers = [
    {
      target_group_arn = aws_lb_target_group.ecs_app.arn
      container_name   = "${local.project_name}-app"
      container_port   = 80
    }
  ]
  
  # Deployment Configuration
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100
  health_check_grace_period_seconds  = 60
  
  enable_deployment_circuit_breaker         = true
  rollback_deployment_circuit_breaker       = true
  
  # Service Discovery
  service_registries = {
    registry_arn   = aws_service_discovery_service.app.arn
    container_name = "${local.project_name}-app"
    container_port = 80
  }
  
  # Auto Scaling
  enable_ecs_managed_tags = true
  propagate_tags         = "SERVICE"
  
  common_tags = local.common_tags
}

# Service Discovery Service
resource "aws_service_discovery_service" "app" {
  name = "${local.project_name}-app"
  
  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id
    
    dns_records {
      ttl  = 10
      type = "A"
    }
    
    routing_policy = "MULTIVALUE"
  }
  
  tags = local.common_tags
}

# CloudWatch Monitoring Log Group
module "cloudwatch" {
  source = "git::https://github.com/porsche-code/aws-cbbac-management_and_governance-cloudwatch.git//terraform"
  
  log_group_name = "/aws/containerland/monitoring"
  
  create_log_group             = true
  log_group_retention_period   = 30
  log_group_kms_key_id        = module.kms.kms_key.arn
  
  tags = local.common_tags
}

# CloudWatch Metric Filter for ECS Task Errors
resource "aws_cloudwatch_log_metric_filter" "ecs_task_errors" {
  name           = "ECSTaskErrors"
  log_group_name = aws_cloudwatch_log_group.ecs_tasks.name
  pattern        = "[timestamp, request_id, level=\"ERROR\", ...]"

  metric_transformation {
    name      = "ECSTaskErrors"
    namespace = "ContainerLand/ECS"
    value     = "1"
  }
}

# CloudWatch Alarm for High CPU Utilization
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "${local.project_name}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS CPU utilization"
  
  dimensions = {
    ServiceName = module.ecs_service.ecs_service_name
    ClusterName = "${local.project_name}-cluster"
  }
  
  tags = local.common_tags
}
