#!/bin/bash
set -e

# Claude E-Mart CDK Deployment Script
# Usage: ./scripts/deploy.sh [dev|staging|prod] [--build-ui]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$INFRA_DIR")"

# Default environment
ENV_NAME="${1:-dev}"
BUILD_UI="${2:-}"

echo "==> Deploying Claude E-Mart to environment: $ENV_NAME"

# Validate environment
if [[ ! "$ENV_NAME" =~ ^(dev|staging|prod)$ ]]; then
    echo "Error: Invalid environment. Use: dev, staging, or prod"
    exit 1
fi

# Check for required tools
command -v npm >/dev/null 2>&1 || { echo "Error: npm is required"; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "Error: AWS CLI is required"; exit 1; }

# Verify AWS credentials
echo "==> Checking AWS credentials..."
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "Error: AWS credentials not configured"
    exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-$(aws configure get region || echo "us-east-1")}
echo "    Account: $AWS_ACCOUNT"
echo "    Region: $AWS_REGION"

# Install CDK dependencies
echo "==> Installing CDK dependencies..."
cd "$INFRA_DIR"
npm install

# Build UI if requested or if dist doesn't exist
if [[ "$BUILD_UI" == "--build-ui" ]] || [[ ! -d "$ROOT_DIR/ui/dist" ]]; then
    echo "==> Building UI..."
    cd "$ROOT_DIR/ui"
    npm install
    npm run build
fi

# Bootstrap CDK if needed
echo "==> Checking CDK bootstrap..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit >/dev/null 2>&1; then
    echo "    Bootstrapping CDK..."
    cd "$INFRA_DIR"
    npx cdk bootstrap aws://$AWS_ACCOUNT/$AWS_REGION
fi

# Deploy stacks
echo "==> Deploying CDK stacks..."
cd "$INFRA_DIR"
npx cdk deploy --all \
    --context envName="$ENV_NAME" \
    --require-approval never \
    --outputs-file cdk-outputs.json

# Show outputs
echo ""
echo "==> Deployment complete!"
echo ""
if [[ -f "$INFRA_DIR/cdk-outputs.json" ]]; then
    echo "Stack outputs:"
    cat "$INFRA_DIR/cdk-outputs.json" | jq '.'
fi
