#!/bin/bash
set -e

# Claude E-Mart CDK Destroy Script
# Usage: ./scripts/destroy.sh [dev|staging|prod]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

# Default environment
ENV_NAME="${1:-dev}"

echo "==> Destroying Claude E-Mart stacks in environment: $ENV_NAME"

# Validate environment
if [[ ! "$ENV_NAME" =~ ^(dev|staging|prod)$ ]]; then
    echo "Error: Invalid environment. Use: dev, staging, or prod"
    exit 1
fi

# Safety check for production
if [[ "$ENV_NAME" == "prod" ]]; then
    echo ""
    echo "WARNING: You are about to destroy PRODUCTION resources!"
    read -p "Are you sure? Type 'yes' to confirm: " confirm
    if [[ "$confirm" != "yes" ]]; then
        echo "Aborted."
        exit 1
    fi
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

# Install CDK dependencies
cd "$INFRA_DIR"
npm install

# Destroy stacks
echo "==> Destroying CDK stacks..."
npx cdk destroy --all \
    --context envName="$ENV_NAME" \
    --force

echo ""
echo "==> Destroy complete!"
