import { Stack, StackProps, aws_lambda as lambda, aws_apigateway as apigateway, aws_certificatemanager as acm, aws_route53_targets as targets, aws_route53 as route53, aws_cloudfront as cloudfront, aws_cloudfront_origins as origins, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { EndpointType } from 'aws-cdk-lib/aws-apigateway';

var AppName = 'myapp';
var Failover = 'PRIMARY';
var statusCode = '200';

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
      AppName = this.node.tryGetContext('application-name') || AppName;
      Failover = this.node.tryGetContext('failover') || Failover;
      const AppFQDN = `${AppName}.${domainName}`;
      const myHostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'hosted-zone', {
        zoneName: domainName,
        hostedZoneId,
      });


      // Create Lambda to be used by the API endpoint
      const AppContent = new lambda.Function(this, `${Failover}-AppContentHandler`, {
        environment: {
            region: cdk.Stack.of(this).region,
            FailoverVariable: Failover,
            StatusCodeVar: statusCode,
        },
        runtime: lambda.Runtime.NODEJS_14_X,   
        code: lambda.Code.fromAsset('lambda'),  
        handler: 'app_content.handler'             
  
      });
      // Create a certificate for the custom domain that will be used by API Gateway (API Endpoint)
      const AppCertificate = new acm.Certificate(this, `${Failover}-Certificate`, {
        domainName: AppFQDN,
        validation: acm.CertificateValidation.fromDns(myHostedZone),
      });

      // Create an API Endpoint on API Gateway
      const AppEndpoint = new apigateway.LambdaRestApi(this, `${Failover}-AppEndpoint`, {
        handler: AppContent,
        domainName: {
          certificate: AppCertificate,
          domainName: AppFQDN,
        },
        endpointConfiguration: {
          types: [ apigateway.EndpointType.REGIONAL ]
        }
      });
      const EndpointFQDN = `${AppEndpoint.restApiId}.execute-api.${this.region}.amazonaws.com`;
      
      // Create an Amazon Route53 HealthCheck to monitori the API endpoint
      const HealthCheck = new route53.CfnHealthCheck(this, `${Failover}-HealthCheck`, {
        healthCheckConfig: {
          type: 'HTTPS',
          failureThreshold: 3,
          fullyQualifiedDomainName: EndpointFQDN,
          port: 443,
          requestInterval: 10,
          resourcePath: `/${AppEndpoint.deploymentStage.stageName}/health`,
        },
      });

      // Create R53 Failover recordset
      const AppRecord = new route53.ARecord(this, `AppRecord`, {
        zone: myHostedZone,
        target: route53.RecordTarget.fromAlias(new targets.ApiGateway(AppEndpoint)),
        recordName: AppName,
      });
      const AppRecordSet = AppRecord.node.defaultChild as route53.CfnRecordSet;
      AppRecordSet.healthCheckId = HealthCheck.attrHealthCheckId;
      AppRecordSet.setIdentifier = `${Failover}-AppRecord`;
      AppRecordSet.failover = Failover;

      // Create a condition to allow only cloudfront to be created during Secondary Region deployment
      const createDistribCondition = new cdk.CfnCondition(
        this,
        'createDistribCondition',
        {
          expression: cdk.Fn.conditionEquals(Failover, 'SECONDARY')
        }
      )

      // Create Cloudfront Distributions
      /* Setup 1: Cloudfront with Route 53 failover DNS record, as an Origin */
      const R53FailoverDistrib = new cloudfront.Distribution(this, 'CF-R53-failover', {
        defaultBehavior: {
          origin: new origins.HttpOrigin(AppFQDN),
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        },
      });
      (R53FailoverDistrib.node.defaultChild as cloudfront.CfnDistribution).cfnOptions.condition = createDistribCondition;

      /* Setup 2: Cloudfront with Origin Failover combination with Route53 failover */
      const CombinedDistrib = new cloudfront.Distribution(this, 'CF-combined-failover', {
        defaultBehavior: {
          origin: new origins.OriginGroup({
            primaryOrigin: new origins.HttpOrigin(AppFQDN),
            fallbackOrigin: new origins.HttpOrigin(EndpointFQDN),
            // optional, defaults to: 500, 502, 503 and 504
            fallbackStatusCodes: [502],
          }),
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        },
      });
      (CombinedDistrib.node.defaultChild as cloudfront.CfnDistribution).cfnOptions.condition = createDistribCondition

      // Export Cloudfront Distributions domain names
      if (Failover === 'SECONDARY') {
        new cdk.CfnOutput(this, 'R53-Failover-Distrib-Domain', {
          value: `https://${R53FailoverDistrib.distributionDomainName}/prod`,
          description: 'Cloudfront Distribution configured with R53 failover origin',
          exportName: 'R53-Failover-Distrib-Domain',
        });
        new cdk.CfnOutput(this, 'Combined-Failover-Distrib-Domain', {
            value: `https://${CombinedDistrib.distributionDomainName}/prod`,
            description: 'Cloudfront Distribution configured with Combined failover origin group',
            exportName: 'Combined-Failover-Distrib-Domain',
          });
       }

    }
}