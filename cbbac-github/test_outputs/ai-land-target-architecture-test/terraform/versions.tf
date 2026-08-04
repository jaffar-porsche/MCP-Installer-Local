terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    awscc = {
      source  = "hashicorp/awscc"
      version = ">= 1.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.6.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.6"
    }
  }
}

# Configure the AWS Provider
provider "aws" {
  region = var.region

  default_tags {
    tags = merge(local.common_tags, {
      ManagedBy = "Terraform"
      Module    = "AI-Land-Target-Architecture"
    })
  }
}

# Configure the AWS Cloud Control Provider
provider "awscc" {
  region = var.region
}
