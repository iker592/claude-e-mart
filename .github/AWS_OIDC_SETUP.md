# AWS OIDC Setup for GitHub Actions

This document describes how to configure AWS IAM for GitHub Actions OIDC authentication.

## Overview

GitHub Actions can authenticate with AWS using OpenID Connect (OIDC), eliminating the need for long-lived AWS credentials stored as secrets. This is the recommended approach for production deployments.

## Prerequisites

- AWS CLI configured with admin access
- Your GitHub repository: `<owner>/<repo>` (e.g., `iker592/claude-e-mart`)

## Setup Steps

### 1. Create the OIDC Identity Provider

First, create the GitHub OIDC provider in your AWS account (you only need to do this once per AWS account):

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

> Note: The thumbprint may change. Check GitHub's documentation for the current value.

### 2. Create the IAM Role Trust Policy

Create a file named `trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_ORG/YOUR_REPO:*"
        }
      }
    }
  ]
}
```

Replace:
- `YOUR_ACCOUNT_ID` with your AWS account ID
- `YOUR_GITHUB_ORG/YOUR_REPO` with your GitHub repository (e.g., `iker592/claude-e-mart`)

### 3. Create the IAM Role Permissions Policy

Create a file named `permissions-policy.json` with the permissions needed for CDK deployment:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CDKDeployPermissions",
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "iam:*",
        "lambda:*",
        "apigateway:*",
        "cloudfront:*",
        "route53:*",
        "acm:*",
        "logs:*",
        "ssm:GetParameter",
        "ssm:PutParameter",
        "ecr:*",
        "ecs:*",
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeAvailabilityZones"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CDKBootstrapBucket",
      "Effect": "Allow",
      "Action": [
        "s3:*"
      ],
      "Resource": [
        "arn:aws:s3:::cdk-*",
        "arn:aws:s3:::cdk-*/*"
      ]
    },
    {
      "Sid": "AssumeRoleForCDK",
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::*:role/cdk-*"
    }
  ]
}
```

> **Security Note**: This policy is intentionally permissive for CDK deployments. For production, you should scope down the permissions to only what's needed for your specific resources.

### 4. Create the IAM Role

```bash
# Create the role with the trust policy
aws iam create-role \
  --role-name GitHubActionsDeployRole \
  --assume-role-policy-document file://trust-policy.json \
  --description "Role for GitHub Actions to deploy via CDK"

# Attach the permissions policy
aws iam put-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-name CDKDeployPolicy \
  --policy-document file://permissions-policy.json
```

### 5. Configure GitHub Secrets

Add the following secrets to your GitHub repository:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `AWS_ROLE_TO_ASSUME` | `arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActionsDeployRole` | ARN of the IAM role |
| `AWS_ACCOUNT_ID` | `YOUR_ACCOUNT_ID` | Your AWS account ID |

Add the following variables to your GitHub repository:

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `AWS_REGION` | `us-east-1` | AWS region for deployment |
| `PRODUCTION_API_URL` | `https://api.your-domain.com` | Production API URL |

## Environment Protection Rules

For production deployments, configure environment protection rules in GitHub:

1. Go to **Settings** > **Environments** > **production**
2. Enable **Required reviewers** and add appropriate team members
3. Optionally enable **Wait timer** (e.g., 5 minutes)
4. Add **Deployment branch rules** to restrict to `main` branch only

For staging:
1. Go to **Settings** > **Environments** > **staging**
2. Add **Deployment branch rules** to restrict to `main` branch only

## Troubleshooting

### "Not authorized to perform sts:AssumeRoleWithWebIdentity"

- Verify the OIDC provider is created correctly
- Check the trust policy conditions match your repository exactly
- Ensure the repository name in the trust policy matches the GitHub Actions workflow location

### "Role cannot be assumed"

- Check the role ARN is correct in GitHub secrets
- Verify the thumbprint in the OIDC provider is current
- Ensure the `id-token: write` permission is set in the workflow

### CDK Permission Errors

- The IAM role needs permissions for all AWS services your CDK stack creates
- Add missing permissions to the `permissions-policy.json` and update the role policy

## Security Best Practices

1. **Scope down permissions**: The example policy is broad. Review and restrict to only needed services.

2. **Use separate roles per environment**: Create separate roles for staging and production with different permissions.

3. **Enable CloudTrail**: Monitor all API calls from the GitHub Actions role.

4. **Regular audits**: Periodically review the role permissions and trust policy.

5. **Branch protection**: Use GitHub branch protection rules alongside environment protection.

## Example: Restricted Trust Policy for Production

For stricter security, restrict the role to only the main branch and production environment:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_ORG/YOUR_REPO:environment:production"
        }
      }
    }
  ]
}
```

## Quick Setup Script

Here's a complete script to set up everything:

```bash
#!/bin/bash
set -e

# Configuration
AWS_ACCOUNT_ID="YOUR_ACCOUNT_ID"
GITHUB_REPO="YOUR_GITHUB_ORG/YOUR_REPO"
ROLE_NAME="GitHubActionsDeployRole"

# Create OIDC provider (skip if exists)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  2>/dev/null || echo "OIDC provider already exists"

# Create trust policy
cat > /tmp/trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_REPO}:*"
        }
      }
    }
  ]
}
EOF

# Create permissions policy
cat > /tmp/permissions-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "iam:*",
        "lambda:*",
        "apigateway:*",
        "cloudfront:*",
        "route53:*",
        "acm:*",
        "logs:*",
        "ssm:GetParameter",
        "ssm:PutParameter",
        "ecr:*",
        "ecs:*",
        "ec2:Describe*"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::*:role/cdk-*"
    }
  ]
}
EOF

# Create or update role
aws iam create-role \
  --role-name ${ROLE_NAME} \
  --assume-role-policy-document file:///tmp/trust-policy.json \
  --description "Role for GitHub Actions to deploy via CDK" \
  2>/dev/null || aws iam update-assume-role-policy \
  --role-name ${ROLE_NAME} \
  --policy-document file:///tmp/trust-policy.json

# Attach policy
aws iam put-role-policy \
  --role-name ${ROLE_NAME} \
  --policy-name CDKDeployPolicy \
  --policy-document file:///tmp/permissions-policy.json

echo "Setup complete!"
echo "Role ARN: arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ROLE_NAME}"
echo ""
echo "Add these secrets to your GitHub repository:"
echo "  AWS_ROLE_TO_ASSUME: arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ROLE_NAME}"
echo "  AWS_ACCOUNT_ID: ${AWS_ACCOUNT_ID}"
```

## References

- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS IAM OIDC Provider](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
- [configure-aws-credentials Action](https://github.com/aws-actions/configure-aws-credentials)
