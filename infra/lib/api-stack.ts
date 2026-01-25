import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ApiStackProps extends cdk.StackProps {
  envName: string;
  sessionBucket: s3.Bucket;
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { envName, sessionBucket } = props;

    // VPC for Fargate
    const vpc = new ec2.Vpc(this, 'ApiVpc', {
      maxAzs: 2,
      natGateways: envName === 'prod' ? 2 : 1,
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'ApiCluster', {
      vpc,
      clusterName: `claude-e-mart-${envName}`,
      containerInsights: envName === 'prod',
    });

    // CloudWatch Logs for the Fargate service
    const logGroup = new logs.LogGroup(this, 'ServiceLogGroup', {
      logGroupName: `/ecs/claude-e-mart-api-${envName}`,
      retention: envName === 'prod'
        ? logs.RetentionDays.THREE_MONTHS
        : logs.RetentionDays.ONE_WEEK,
      removalPolicy: envName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // Build the Docker image
    const dockerImage = new ecr_assets.DockerImageAsset(this, 'ApiImage', {
      directory: path.join(__dirname, '../../agent'),
      platform: ecr_assets.Platform.LINUX_AMD64,
    });

    // Create the Fargate service with ALB
    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'ApiService', {
      cluster,
      serviceName: `claude-e-mart-api-${envName}`,
      cpu: 2048,
      memoryLimitMiB: 4096,
      desiredCount: envName === 'prod' ? 2 : 1,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
      taskImageOptions: {
        image: ecs.ContainerImage.fromDockerImageAsset(dockerImage),
        containerPort: 8000,
        environment: {
          ENV_NAME: envName,
          SESSION_BUCKET_NAME: sessionBucket.bucketName,
          LOG_LEVEL: envName === 'prod' ? 'INFO' : 'DEBUG',
          CLAUDE_CODE_USE_BEDROCK: '1',
          OTEL_SDK_DISABLED: 'true',
          CORS_ORIGINS: envName === 'prod'
            ? 'https://*.cloudfront.net'
            : 'http://localhost:5173,http://localhost:3000,https://*.cloudfront.net,*',
        },
        logDriver: ecs.LogDrivers.awsLogs({
          logGroup,
          streamPrefix: 'api',
        }),
      },
      publicLoadBalancer: true,
      // Enable idle timeout for long SSE connections
      idleTimeout: cdk.Duration.minutes(5),
    });

    // Configure health check
    fargateService.targetGroup.configureHealthCheck({
      path: '/health',
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
    });

    // Grant Bedrock permissions to the task role
    fargateService.taskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
      sid: 'BedrockInvokeModel',
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        // Foundation models (direct invocation)
        'arn:aws:bedrock:*::foundation-model/anthropic.claude-*',
        // Inference profiles (required for newer models)
        'arn:aws:bedrock:*:*:inference-profile/us.anthropic.claude-*',
        'arn:aws:bedrock:*:*:inference-profile/global.anthropic.claude-*',
      ],
    }));

    // Grant S3 permissions for session storage
    sessionBucket.grantReadWrite(fargateService.taskDefinition.taskRole);

    this.apiUrl = `http://${fargateService.loadBalancer.loadBalancerDnsName}`;

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
      description: 'ALB endpoint URL for the API',
      exportName: `${envName}-claude-e-mart-api-url`,
    });

    new cdk.CfnOutput(this, 'ClusterArn', {
      value: cluster.clusterArn,
      description: 'ECS Cluster ARN',
    });

    new cdk.CfnOutput(this, 'ServiceArn', {
      value: fargateService.service.serviceArn,
      description: 'ECS Service ARN',
    });
  }
}