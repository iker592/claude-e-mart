import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface UiStackProps extends cdk.StackProps {
  envName: string;
  apiUrl: string;
}

export class UiStack extends cdk.Stack {
  public readonly distributionUrl: string;
  public readonly websiteBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: UiStackProps) {
    super(scope, id, props);

    const { envName, apiUrl } = props;

    // S3 bucket for static website hosting
    this.websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `claude-e-mart-ui-${envName}-${this.account}`,
      removalPolicy: envName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: envName !== 'prod',

      // Security - block public access (CloudFront will access via OAC)
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // Origin Access Control for CloudFront
    const oac = new cloudfront.S3OriginAccessControl(this, 'OAC', {
      originAccessControlName: `claude-e-mart-oac-${envName}`,
      signing: cloudfront.Signing.SIGV4_ALWAYS,
    });

    // Build additional behaviors to proxy API requests through CloudFront
    // This solves mixed content issues (HTTPS CloudFront -> HTTP ALB)
    const additionalBehaviors: Record<string, cloudfront.BehaviorOptions> = {};

    // Parse the ALB URL to get the domain
    if (apiUrl) {
      const albDomain = apiUrl.replace(/^https?:\/\//, '');

      // Create HTTP origin for the ALB
      const apiOrigin = new cloudfrontOrigins.HttpOrigin(albDomain, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        httpPort: 80,
      });

      // Add behavior for /api/* paths - no caching for SSE streaming
      additionalBehaviors['/api/*'] = {
        origin: apiOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        compress: false, // Don't compress SSE streams
      };

      // Add behavior for /health endpoint
      additionalBehaviors['/health'] = {
        origin: apiOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      };
    }

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `Claude E-Mart UI Distribution (${envName})`,
      defaultRootObject: 'index.html',

      defaultBehavior: {
        origin: cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(this.websiteBucket, {
          originAccessControl: oac,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        compress: true,
      },

      // API behavior - proxy to API Gateway (only if API URL provided)
      additionalBehaviors,

      // Error pages - redirect to index.html for SPA routing
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],

      // Price class - use edge locations in North America and Europe
      priceClass: envName === 'prod'
        ? cloudfront.PriceClass.PRICE_CLASS_ALL
        : cloudfront.PriceClass.PRICE_CLASS_100,

      // Enable logging in production
      enableLogging: envName === 'prod',

      // HTTP version
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });

    // Grant CloudFront access to the S3 bucket
    this.websiteBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [this.websiteBucket.arnForObjects('*')],
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
        },
      },
    }));

    // Deploy the built UI to S3
    // Note: The UI must be built before running cdk deploy
    // Run: cd ui && npm run build
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../ui/dist'))],
      destinationBucket: this.websiteBucket,
      distribution,
      distributionPaths: ['/*'], // Invalidate CloudFront cache on deploy

      // Don't delete old files to prevent race conditions
      prune: true,

      // Memory for the deployment Lambda
      memoryLimit: 512,
    });

    this.distributionUrl = `https://${distribution.distributionDomainName}`;

    // Outputs
    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: this.distributionUrl,
      description: 'CloudFront distribution URL',
      exportName: `${envName}-claude-e-mart-distribution-url`,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID',
      exportName: `${envName}-claude-e-mart-distribution-id`,
    });

    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: this.websiteBucket.bucketName,
      description: 'S3 bucket name for UI static files',
      exportName: `${envName}-claude-e-mart-ui-bucket-name`,
    });

    new cdk.CfnOutput(this, 'ApiProxyUrl', {
      value: `${this.distributionUrl}/api`,
      description: 'API endpoint through CloudFront (use this in the UI)',
    });
  }
}
