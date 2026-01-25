import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface StorageStackProps extends cdk.StackProps {
  envName: string;
}

export class StorageStack extends cdk.Stack {
  public readonly sessionBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { envName } = props;

    // S3 bucket for session storage
    this.sessionBucket = new s3.Bucket(this, 'SessionBucket', {
      bucketName: `claude-e-mart-sessions-${envName}-${this.account}`,
      removalPolicy: envName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: envName !== 'prod',

      // Security settings
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,

      // Versioning for data protection
      versioned: envName === 'prod',

      // Lifecycle rules for cost optimization
      lifecycleRules: [
        {
          id: 'ExpireOldSessions',
          expiration: cdk.Duration.days(envName === 'prod' ? 90 : 30),
          noncurrentVersionExpiration: cdk.Duration.days(7),
        },
      ],

      // CORS configuration for browser uploads (if needed)
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: ['*'], // Will be restricted by CloudFront
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'SessionBucketName', {
      value: this.sessionBucket.bucketName,
      description: 'Name of the S3 bucket for session storage',
      exportName: `${envName}-claude-e-mart-session-bucket-name`,
    });

    new cdk.CfnOutput(this, 'SessionBucketArn', {
      value: this.sessionBucket.bucketArn,
      description: 'ARN of the S3 bucket for session storage',
      exportName: `${envName}-claude-e-mart-session-bucket-arn`,
    });
  }
}