# Blog - Improve web application's availability with hybrid failover using CloudFront and Route 53 🚀

## Introduction

Earlier this year, we released technical guidance regarding [Three advanced design patterns for highly available applications using Amazon CloudFront](https://aws.amazon.com/fr/blogs/networking-and-content-delivery/three-advanced-design-patterns-for-high-available-applications-using-amazon-cloudfront/) using [Amazon CloudFront](https://aws.amazon.com/cloudfront/) and [Amazon Route 53](https://aws.amazon.com/route53/). In this post, we dive deeper into CloudFront origin failover, Amazon Route 53 DNS failover, and the hybrid origin failover approach to further enhance the availability of your web applications. We also provide an [AWS Cloud Development Kit (AWS CDK)](https://aws.amazon.com/cdk/) solution that you can use to implement and test different high-availability patterns.


## Solution's objectives

The objective of this code, is to allow you to quickly test the benefits of using a hybrid failover solution using Cloudfront Origin Failover and Route53.

The solution will achieve the following:
* Create an API Endpoint using [Amazon API Gateway](https://aws.amazon.com/api-gateway/) and [AWS Lambda](https://aws.amazon.com/lambda/) on both the Primary and Backup Regions (with custom domain name + certificate)
* Create a Route53 healthcheck for both API Endpoints
* Create a Route53 DNS entry, with an Alias for both the Primary and Secondary API Endpoint
* Create two (02) Cloudfront Distributions with the following setup:
  * Setup 1: Configured with Route53 failover dns record as Origin
  * Setup 2: Configured with Origin failover group. Route 53 failover dns record as primary and secondary API gateway as a fallback.
* Export both Cloudfront distrbutions' domain names to let you to test both solutions.


## Architecture

![image](/source/images/architecture.png "Architecture")

## Solution Requirements
* An AWS Account
* Public domain hosted on Amazon Route53
* Permissions to create origin records and health checks in Route 53 
* Permissions to create or update [AWS Identity and Access Management (IAM)](https://aws.amazon.com/iam/) roles, [AWS Certificate Manager (ACM)](https://aws.amazon.com/certificate-manager/) public certificates, CloudFront distributions, API Gateway configurations, and Lambda functions in two different regions
* Node.JS installed (as AWS CDK uses Node.js). Visit https://nodejs.org/ to install.
* AWS CDK Toolkit installed `npm install -g aws-cdk`

## Deploy the solution

The deployment of the solution will take approximately 10 minutes.
1. We start by downloading the CDK template from our GitHub repository.
```
git clone https://gitlab.aws.dev/chakibsa/cloudfront-hybrid-origin-failover.git
cd cloudfront-hybrid-origin-failover
```
2. Install CDK and required dependencies.
```
npm install -g aws-cdk
npm install
```
3. Deploy the stack to your Primary and Fallback Region.
```
./deployment/deploy.sh AWS_REGION AWS_BACKUP_REGION DOMAIN_NAME HOSTED_ZONE_ID
```

You must input the following required arguments:
* AWS_REGION: Allow you to specify your Primary Region
* AWS_BACKUP_REGION: Allow you to specify your Fallback Region
* DOMAIN_NAME: This stack requires you to have a public domain name hosted on Amazon Route53. Provide your domain name
* HOSTED_ZONE_ID: This stack requires you to have a public domain name hosted on Amazon Route53. Provide your Hosted Zone ID

Deployment example
```
./deployment/deploy.sh eu-west-1 us-east-1 example.com Z0XXXXXXXXXXXX
```

4. At the end of the deployment, the FQDN of the two created CloudFront distributions will be exported as an [AWS CloudFormation](https://aws.amazon.com/cloudformation/) output:
* CloudFront Distribution with Route53 failover DNS record as origin
** Export Name = R53-Failover-Distrib-Domain
* CloudFront Distribution with Hybrid Route53 Failover with CloudFront Origin
Failover
** Export Name = Hybrid-Failover-Distrib-Domain

```
Outputs:
CdkRegionStack.HybridFailoverDistribDomain = https://XXXXXXX.cloudfront.net/prod
CdkRegionStack.R53FailoverDistribDomain = https://YYYYYYYY.cloudfront.net/prod
```

## Testing
In order to test both failover solutions, you could use the following bash script. You will need to provide the previously exported Cloudfront Distribution URL 

```
./testing/test.sh https://xxxxxxxx.cloudfront.net/prod
```

## Clean Up
To destroy the stack from your Primary and Fallback Region:
```
./deployment/destroy.sh AWS_REGION AWS_BACKUP_REGION DOMAIN_NAME HOSTED_ZONE_ID
```

Destroy example
```
./deployment/destroy.sh eu-west-1 us-east-1 example.com Z0XXXXXXXXXXXX
```

## File Structure
<pre>
|-deployment/    [folder containing build scripts]
|-source/
  |-lib/         [library files including the main typescript stack]
  |-bin/         [main cdk application typescript]
  |-lambda/      [nodejs lambda script that generates HTTP content]
|-testing/       [folder containing testing scripts]
</pre>

## License
This library is licensed under the MIT-0 License. See the LICENSE file.

