#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/storage-stack';
import { ApiStack } from '../lib/api-stack';
import { UiStack } from '../lib/ui-stack';

const app = new cdk.App();

// Get environment from context or use defaults
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1',
};

// Environment name for resource naming
const envName = app.node.tryGetContext('envName') || process.env.ENV_NAME || 'dev';

// Storage Stack - S3 bucket for session storage
const storageStack = new StorageStack(app, 'ClaudeEMartStorageStack', {
  env,
  envName,
  description: 'Claude E-Mart Storage Stack - S3 bucket for session storage',
});

// API Stack - Lambda + API Gateway for FastAPI backend
const apiStack = new ApiStack(app, 'ClaudeEMartApiStack', {
  env,
  envName,
  sessionBucket: storageStack.sessionBucket,
  description: 'Claude E-Mart API Stack - Lambda function with API Gateway',
});
apiStack.addDependency(storageStack);

// UI Stack - S3 + CloudFront for React frontend
const uiStack = new UiStack(app, 'ClaudeEMartUiStack', {
  env,
  envName,
  apiUrl: apiStack.apiUrl,
  description: 'Claude E-Mart UI Stack - S3 bucket with CloudFront distribution',
});
uiStack.addDependency(apiStack);

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'claude-e-mart');
cdk.Tags.of(app).add('Environment', envName);
cdk.Tags.of(app).add('ManagedBy', 'CDK');
