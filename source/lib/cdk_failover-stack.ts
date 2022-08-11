import { Stack, StackProps, aws_lambda as lambda, aws_apigateway as apigateway, aws_certificatemanager as acm, aws_route53_targets as targets, aws_route53 as route53, aws_cloudfront as cloudfront, aws_cloudfront_origins as origins, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { EndpointType } from 'aws-cdk-lib/aws-apigateway';

var originName = 'origin';
var failoverRole = 'PRIMARY';

export class CdkRegionStack extends Stack {
    constructor(scope: Construct, id: string, props: StackProps & {hostedZoneId: string, domainName: string})  {
      super(scope, id, props);
     
      // initialize parameters
      if (!props.env?.region) {
        throw Error('Region not set. Please pass it with the AWS_REGION environment variable.');
       }
      if (!props.hostedZoneId) {
        throw Error('hostedZoneId not set. Please pass it with the HOSTED_ZONE_ID environment variable.');
      }
      if (!props.domainName) {
        throw Error('domainName not set. Please pass it with the DOMAIN_NAME environment variable.');
      }

      const {hostedZoneId, domainName} = props;
      originName = this.node.tryGetContext('application-name') || originName;
      failoverRole = this.node.tryGetContext('failover') || failoverRole;
      const originFQDN = `${originName}.${domainName}`;
      const statusCode = '200';
      const myHostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'hosted-zone', {
        zoneName: domainName,
        hostedZoneId,
      });


      // Create Lambda to be used by the API endpoint
      const AppContent = new lambda.Function(this, `${failoverRole}-appContentHandler`, {
        environment: {
            region: cdk.Stack.of(this).region,
            failoverVariable: failoverRole,
            statusCodeVariable: statusCode,
        },
        runtime: lambda.Runtime.NODEJS_14_X,   
        code: lambda.Code.fromAsset('source/lambda'),  
        handler: 'app_content.handler'             
  
      });
      // Create a certificate for the custom domain that will be used by API Gateway (API Endpoint)
      const AppCertificate = new acm.Certificate(this, `${failoverRole}-Certificate`, {
        domainName: originFQDN,
        validation: acm.CertificateValidation.fromDns(myHostedZone),
      });

      // Create an API Endpoint on API Gateway
      const appEndpoint = new apigateway.LambdaRestApi(this, `${failoverRole}-appEndpoint`, {
        handler: AppContent,
        domainName: {
          certificate: AppCertificate,
          domainName: originFQDN,
        },
        endpointConfiguration: {
          types: [ apigateway.EndpointType.REGIONAL ]
        }
      });
      const EndpointFQDN = `${appEndpoint.restApiId}.execute-api.${this.region}.amazonaws.com`;
      
      // Create an Amazon Route53 HealthCheck to monitori the API endpoint
      const HealthCheck = new route53.CfnHealthCheck(this, `${failoverRole}-HealthCheck`, {
        healthCheckConfig: {
          type: 'HTTPS',
          failureThreshold: 3,
          fullyQualifiedDomainName: EndpointFQDN,
          port: 443,
          requestInterval: 10,
          resourcePath: `/${appEndpoint.deploymentStage.stageName}/health`,
        },
      });

      // Create R53 Failover recordset
      const appRecord = new route53.ARecord(this, `appRecord`, {
        zone: myHostedZone,
        target: route53.RecordTarget.fromAlias(new targets.ApiGateway(appEndpoint)),
        recordName: originName,
      });
      const appRecordSet = appRecord.node.defaultChild as route53.CfnRecordSet;
      appRecordSet.healthCheckId = HealthCheck.attrHealthCheckId;
      appRecordSet.setIdentifier = `${failoverRole}-appRecord`;
      appRecordSet.failover = failoverRole;

      // Create a condition to allow only cloudfront to be created during Secondary Region deployment
      const createDistribCondition = new cdk.CfnCondition(
        this,
        'createDistribCondition',
        {
          expression: cdk.Fn.conditionEquals(failoverRole, 'SECONDARY')
        }
      )

      // Create Cloudfront Distributions
      /* Setup 1: Cloudfront with Route 53 failover DNS record, as an Origin */
      const R53failoverDistrib = new cloudfront.Distribution(this, 'CF-R53-failover', {
        defaultBehavior: {
          origin: new origins.HttpOrigin(originFQDN),
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        },
      });
      (R53failoverDistrib.node.defaultChild as cloudfront.CfnDistribution).cfnOptions.condition = createDistribCondition;

      /* Setup 2: Cloudfront with Origin Failover combination with Route53 failover */
      const HybridFailoverDistrib = new cloudfront.Distribution(this, 'CF-hybrid-failover', {
        defaultBehavior: {
          origin: new origins.OriginGroup({
            primaryOrigin: new origins.HttpOrigin(originFQDN),
            fallbackOrigin: new origins.HttpOrigin(EndpointFQDN),
          }),
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        },
      });
      (HybridFailoverDistrib.node.defaultChild as cloudfront.CfnDistribution).cfnOptions.condition = createDistribCondition

      // Export Cloudfront Distributions domain names
      if (failoverRole === 'SECONDARY') {
        new cdk.CfnOutput(this, 'R53-Failover-Distrib-Domain', {
          value: `https://${R53failoverDistrib.distributionDomainName}/prod`,
          description: 'Cloudfront Distribution configured with R53 failover origin',
          exportName: 'R53-Failover-Distrib-Domain',
        });
        new cdk.CfnOutput(this, 'Hybrid-Failover-Distrib-Domain', {
            value: `https://${HybridFailoverDistrib.distributionDomainName}/prod`,
            description: 'Cloudfront Distribution configured with Hybrid failover origin group',
            exportName: 'Hybrid-Failover-Distrib-Domain',
          });
       }

    }
}