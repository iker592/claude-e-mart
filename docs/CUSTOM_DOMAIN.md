# Custom Domain Setup for Claude E-Mart

This guide explains how to configure a custom domain for your CloudFront distribution instead of using the default `*.cloudfront.net` subdomain.

## Overview

To use a custom domain (e.g., `claude-e-mart.example.com`), you need:
1. A registered domain name
2. An SSL/TLS certificate in AWS Certificate Manager (ACM)
3. DNS records pointing to CloudFront

## Option 1: Manual Setup (AWS Console)

### Step 1: Register a Domain (if you don't have one)

1. Go to **Route 53** in the AWS Console
2. Click **Registered domains** → **Register domains**
3. Search for your desired domain name
4. Complete the registration process (~$12-15/year for `.com`)
5. AWS automatically creates a hosted zone for your domain

### Step 2: Request an SSL Certificate

1. Go to **AWS Certificate Manager (ACM)** in the AWS Console
2. **Important**: Switch to **us-east-1 (N. Virginia)** region - CloudFront only accepts certificates from this region
3. Click **Request a certificate** → **Request a public certificate**
4. Enter your domain name (e.g., `claude-e-mart.example.com`)
5. Choose **DNS validation**
6. Click **Request**
7. On the certificate details page, click **Create records in Route 53** to automatically add the validation CNAME records
8. Wait for the certificate status to change to **Issued** (usually 5-30 minutes)

### Step 3: Configure CloudFront

1. Go to **CloudFront** in the AWS Console
2. Select your distribution
3. Click **Edit** under **General** settings
4. In **Alternate domain name (CNAME)**, add your domain (e.g., `claude-e-mart.example.com`)
5. In **Custom SSL certificate**, select the certificate you created in ACM
6. Click **Save changes**

### Step 4: Configure DNS

1. Go to **Route 53** → **Hosted zones** → your domain
2. Click **Create record**
3. Configure:
   - **Record name**: your subdomain (e.g., `claude-e-mart`) or leave empty for apex domain
   - **Record type**: A
   - **Alias**: Yes
   - **Route traffic to**: Alias to CloudFront distribution
   - Select your CloudFront distribution from the dropdown
4. Click **Create records**

Your custom domain should be active within a few minutes.

## Option 2: CDK Infrastructure as Code

Add the following to your CDK stack to automate custom domain setup:

### Prerequisites

Add to `infra/lib/ui-stack.ts`:

```typescript
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
```

### Updated UiStackProps

```typescript
export interface UiStackProps extends cdk.StackProps {
  envName: string;
  apiUrl: string;
  // Custom domain configuration (optional)
  domainName?: string;      // e.g., 'example.com'
  subdomain?: string;       // e.g., 'claude-e-mart' → claude-e-mart.example.com
  certificateArn?: string;  // ACM certificate ARN (must be in us-east-1)
}
```

### CDK Code for Custom Domain

```typescript
// Look up existing hosted zone (domain must already be registered)
const hostedZone = props.domainName
  ? route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.domainName,
    })
  : undefined;

// Import existing certificate or create validation (certificate must be in us-east-1)
const certificate = props.certificateArn
  ? acm.Certificate.fromCertificateArn(this, 'Certificate', props.certificateArn)
  : undefined;

// Full domain name
const fullDomainName = props.subdomain && props.domainName
  ? `${props.subdomain}.${props.domainName}`
  : undefined;

// CloudFront distribution with custom domain
const distribution = new cloudfront.Distribution(this, 'Distribution', {
  comment: `Claude E-Mart UI Distribution (${envName})`,
  defaultRootObject: 'index.html',

  // Custom domain configuration
  domainNames: fullDomainName ? [fullDomainName] : undefined,
  certificate: certificate,

  defaultBehavior: {
    origin: cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(
      this.websiteBucket,
      { originAccessControl: oac }
    ),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
    compress: true,
  },

  // ... rest of configuration
});

// Create DNS record pointing to CloudFront
if (hostedZone && fullDomainName) {
  new route53.ARecord(this, 'AliasRecord', {
    zone: hostedZone,
    recordName: props.subdomain,
    target: route53.RecordTarget.fromAlias(
      new route53Targets.CloudFrontTarget(distribution)
    ),
  });
}
```

### Deployment

1. First, manually create the ACM certificate in us-east-1 (CloudFront requirement)
2. Deploy with custom domain parameters:

```bash
cd infra
npx cdk deploy UiStack \
  --context domainName=example.com \
  --context subdomain=claude-e-mart \
  --context certificateArn=arn:aws:acm:us-east-1:123456789:certificate/abc-123
```

## Cost Considerations

- **Domain registration**: ~$12-15/year for `.com`
- **Route 53 hosted zone**: $0.50/month
- **Route 53 queries**: $0.40 per million queries
- **ACM certificates**: Free for public certificates
- **CloudFront**: No additional cost for custom domains

## Troubleshooting

### Certificate not showing in CloudFront
- Ensure the certificate is in **us-east-1** region
- Verify the certificate status is **Issued**

### DNS not resolving
- Wait 5-10 minutes for DNS propagation
- Verify the A record is an alias to CloudFront (not a CNAME)
- Check the hosted zone matches your registered domain

### SSL errors
- Ensure the certificate covers your exact domain name
- For wildcard certificates (`*.example.com`), they don't cover the apex domain (`example.com`)
