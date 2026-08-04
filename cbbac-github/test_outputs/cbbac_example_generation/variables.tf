# Variables for Container Land ECS Architecture

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "192.168.0.0/20"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["192.168.0.0/24", "192.168.1.0/24", "192.168.2.0/24"]
}

variable "private_app_subnet_cidrs" {
  description = "CIDR blocks for private application subnets"
  type        = list(string)
  default     = ["192.168.3.0/24", "192.168.4.0/24", "192.168.5.0/24"]
}

variable "private_db_subnet_cidrs" {
  description = "CIDR blocks for private database subnets"
  type        = list(string)
  default     = ["192.168.6.0/24", "192.168.7.0/24", "192.168.8.0/24"]
}

variable "desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}
