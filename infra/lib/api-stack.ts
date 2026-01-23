import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
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
  public readonly lambdaFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { envName, sessionBucket } = props;

    // Lambda execution role with least privilege
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Execution role for Claude E-Mart API Lambda',
    });

    // Basic Lambda execution permissions
    lambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
    );

    // Bedrock permissions for Claude model invocation
    // Required for using Claude Agent SDK with Bedrock provider
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'BedrockInvokeModel',
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        // Allow all Claude models on Bedrock
        'arn:aws:bedrock:*::foundation-model/anthropic.claude-*',
      ],
    }));

    // S3 permissions for session storage
    sessionBucket.grantReadWrite(lambdaRole);

    // CloudWatch Logs for the Lambda function
    const logGroup = new logs.LogGroup(this, 'LambdaLogGroup', {
      logGroupName: `/aws/lambda/claude-e-mart-api-${envName}`,
      retention: envName === 'prod'
        ? logs.RetentionDays.THREE_MONTHS
        : logs.RetentionDays.ONE_WEEK,
      removalPolicy: envName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // Lambda function with Lambda Web Adapter for FastAPI
    // Uses Docker bundling for cross-platform compatibility
    this.lambdaFunction = new lambda.Function(this, 'ApiFunction', {
      functionName: `claude-e-mart-api-${envName}`,
      runtime: lambda.Runtime.PYTHON_3_12, // 3.12 is the latest stable with good Lambda support
      handler: 'run.sh', // Lambda Web Adapter uses this
      code: lambda.Code.fromAsset(path.join(__dirname, '../../agent'), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: [
            'bash', '-c', [
              // Install dependencies
              'pip install -r requirements.txt -t /asset-output --no-cache-dir',
              // Copy Python source files
              'cp -r *.py /asset-output/',
              // Copy run.sh for Lambda Web Adapter
              'cp run.sh /asset-output/ 2>/dev/null || echo "#!/bin/bash\\nexec uvicorn server:app --host 0.0.0.0 --port \\${PORT:-8000}" > /asset-output/run.sh',
              // Make run.sh executable
              'chmod +x /asset-output/run.sh',
            ].join(' && '),
          ],
          // Use local bundling if available (faster)
          local: {
            tryBundle(outputDir: string): boolean {
              try {
                const { execSync } = require('child_process');
                const agentDir = path.join(__dirname, '../../agent');

                // Check if pip is available
                execSync('pip3 --version', { stdio: 'ignore' });

                // Install requirements
                execSync(`pip3 install -r ${agentDir}/requirements.txt -t ${outputDir} --no-cache-dir`, {
                  stdio: 'inherit',
                });

                // Copy source files
                const fs = require('fs');
                const files = fs.readdirSync(agentDir);
                for (const file of files) {
                  if (file.endsWith('.py') || file === 'run.sh') {
                    fs.copyFileSync(
                      path.join(agentDir, file),
                      path.join(outputDir, file)
                    );
                  }
                }

                // Ensure run.sh exists and is executable
                const runShPath = path.join(outputDir, 'run.sh');
                if (!fs.existsSync(runShPath)) {
                  fs.writeFileSync(runShPath, '#!/bin/bash\nexec uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}\n');
                }
                fs.chmodSync(runShPath, 0o755);

                return true;
              } catch {
                // Fall back to Docker bundling
                return false;
              }
            },
          },
        },
      }),
      role: lambdaRole,
      timeout: cdk.Duration.seconds(300), // 5 minutes for long-running agent tasks
      memorySize: 1024,
      architecture: lambda.Architecture.ARM_64,

      environment: {
        // Lambda Web Adapter configuration
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/bootstrap',
        AWS_LWA_INVOKE_MODE: 'response_stream', // Enable streaming for SSE
        PORT: '8000',

        // Application configuration
        ENV_NAME: envName,
        SESSION_BUCKET_NAME: sessionBucket.bucketName,
        LOG_LEVEL: envName === 'prod' ? 'INFO' : 'DEBUG',

        // Claude Agent SDK - Use Bedrock as the LLM provider
        // This eliminates the need for ANTHROPIC_API_KEY
        CLAUDE_CODE_USE_BEDROCK: '1',
        // AWS_REGION is automatically set by Lambda runtime

        // Disable OpenTelemetry in Lambda (can use X-Ray instead)
        OTEL_SDK_DISABLED: 'true',

        // CORS origins - will be updated after CloudFront is created
        CORS_ORIGINS: envName === 'prod'
          ? 'https://*.cloudfront.net'
          : 'http://localhost:5173,http://localhost:3000',
      },

      // Add Lambda Web Adapter layer
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(
          this,
          'LambdaWebAdapter',
          `arn:aws:lambda:${this.region}:753240598075:layer:LambdaAdapterLayerArm64:24`
        ),
      ],

      logGroup,
    });

    // HTTP API Gateway with CORS
    const httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `claude-e-mart-api-${envName}`,
      description: 'HTTP API for Claude E-Mart agent',

      corsPreflight: {
        allowOrigins: envName === 'prod'
          ? ['https://*.cloudfront.net']
          : ['*'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Requested-With',
          'Accept',
          'Origin',
          'Cache-Control',
        ],
        allowCredentials: false, // Set to false to allow wildcard origins
        maxAge: cdk.Duration.hours(1),
      },
    });

    // Lambda integration
    const lambdaIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'LambdaIntegration',
      this.lambdaFunction,
    );

    // Add routes - catch-all for the FastAPI app
    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: lambdaIntegration,
    });

    // Root path
    httpApi.addRoutes({
      path: '/',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: lambdaIntegration,
    });

    this.apiUrl = httpApi.apiEndpoint;

    // Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.apiUrl,
      description: 'API Gateway endpoint URL',
      exportName: `${envName}-claude-e-mart-api-url`,
    });

    new cdk.CfnOutput(this, 'LambdaFunctionArn', {
      value: this.lambdaFunction.functionArn,
      description: 'Lambda function ARN',
      exportName: `${envName}-claude-e-mart-lambda-arn`,
    });

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: this.lambdaFunction.functionName,
      description: 'Lambda function name',
    });
  }
}
