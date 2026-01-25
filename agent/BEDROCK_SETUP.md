# AWS Bedrock Configuration for Claude Agent SDK

This document describes how to configure the Claude E-Mart agent to use AWS Bedrock as the LLM provider instead of the direct Anthropic API.

## Prerequisites

1. An AWS account with Bedrock access enabled
2. Claude models enabled in your AWS Bedrock console
3. AWS credentials configured (IAM user, role, or instance profile)

## Quick Start

1. Copy `.env.example` to `.env`
2. Enable Bedrock:
   ```bash
   CLAUDE_CODE_USE_BEDROCK=1
   AWS_REGION=us-east-1
   ```
3. Configure AWS credentials (see options below)
4. Run the server: `uv run uvicorn server:app --reload --port 8000`

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLAUDE_CODE_USE_BEDROCK` | Yes | - | Set to `1` to enable Bedrock |
| `AWS_REGION` | Yes | `us-east-1` | AWS region with Bedrock access |
| `AWS_ACCESS_KEY_ID` | No* | - | Explicit AWS access key |
| `AWS_SECRET_ACCESS_KEY` | No* | - | Explicit AWS secret key |
| `AWS_PROFILE` | No* | - | AWS CLI profile name |
| `BEDROCK_MODEL_ID` | No | `anthropic.claude-3-5-sonnet-20241022-v2:0` | Model ID to use |

*At least one authentication method is required.

## Authentication Methods

### Method 1: Environment Variables (Development)

```bash
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=us-east-1
export CLAUDE_CODE_USE_BEDROCK=1
```

### Method 2: AWS Profile (Local Development)

```bash
export AWS_PROFILE=my-dev-profile
export AWS_REGION=us-east-1
export CLAUDE_CODE_USE_BEDROCK=1
```

### Method 3: IAM Role (Production - EC2/Lambda/ECS)

No credentials needed - uses instance profile or task role automatically.

```bash
export AWS_REGION=us-east-1
export CLAUDE_CODE_USE_BEDROCK=1
```

## Required IAM Permissions

The minimum IAM permissions needed for Bedrock access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInvokeModel",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-*"
      ]
    }
  ]
}
```

See `iam-policies/bedrock-access-policy.json` for the complete policy.

### For Lambda Deployments

If deploying to AWS Lambda, the execution role needs additional permissions:

- CloudWatch Logs (for logging)
- S3 (if using S3 session storage)
- X-Ray (if using distributed tracing)

See `iam-policies/lambda-execution-policy.json` for a complete Lambda execution policy.

## Supported Regions

Claude models on Bedrock are available in:

- `us-east-1` (N. Virginia)
- `us-west-2` (Oregon)
- `eu-west-1` (Ireland)
- `eu-central-1` (Frankfurt)
- `ap-northeast-1` (Tokyo)
- `ap-southeast-2` (Sydney)

## Available Models

| Model ID | Description |
|----------|-------------|
| `anthropic.claude-3-5-sonnet-20241022-v2:0` | Claude 3.5 Sonnet (Latest) |
| `anthropic.claude-3-opus-20240229-v1:0` | Claude 3 Opus |
| `anthropic.claude-3-sonnet-20240229-v1:0` | Claude 3 Sonnet |
| `anthropic.claude-3-haiku-20240307-v1:0` | Claude 3 Haiku |

## Verifying Configuration

After starting the server, check the `/health` endpoint:

```bash
curl http://localhost:8000/health | jq
```

Expected response for Bedrock:

```json
{
  "status": "ok",
  "tracing": "enabled",
  "llm_provider": {
    "provider": "bedrock",
    "aws_region": "us-east-1",
    "model_id": "anthropic.claude-3-5-sonnet-20241022-v2:0",
    "credentials_source": "environment_variables"
  }
}
```

## Troubleshooting

### "Access Denied" Error

1. Verify your IAM user/role has the required Bedrock permissions
2. Check that Claude models are enabled in your Bedrock console
3. Ensure you're using a supported region

### "Model Not Found" Error

1. Check that the model ID is correct
2. Verify the model is available in your region
3. Confirm model access is enabled in AWS Bedrock console

### Credentials Not Working

1. For environment variables: ensure both `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set
2. For profiles: verify the profile exists in `~/.aws/credentials`
3. For IAM roles: check the instance metadata service is accessible

## Session Storage with S3

When using Bedrock, you can also use S3 for session storage:

```bash
SESSION_BUCKET_NAME=my-sessions-bucket
SESSION_BUCKET_PREFIX=sessions/
```

This uses the same AWS credentials as Bedrock. Add S3 permissions to your IAM policy:

```json
{
  "Sid": "S3SessionStorage",
  "Effect": "Allow",
  "Action": [
    "s3:GetObject",
    "s3:PutObject",
    "s3:DeleteObject",
    "s3:ListBucket"
  ],
  "Resource": [
    "arn:aws:s3:::my-sessions-bucket",
    "arn:aws:s3:::my-sessions-bucket/*"
  ]
}
```
