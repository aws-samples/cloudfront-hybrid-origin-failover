#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as core from 'aws-cdk-lib';
import { CdkRegionStack } from '../lib/cdk_failover-stack';

const app = new cdk.App();
new CdkRegionStack(app, 'CdkRegionStack', {
  env: {
    region: process.env.AWS_REGION ?? process.env.CDK_DEFAULT_REGION,
  },
  hostedZoneId: process.env.HOSTED_ZONE_ID!,
  domainName: process.env.DOMAIN_NAME!,
});