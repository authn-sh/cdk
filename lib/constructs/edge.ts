import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import {
  IVpc,
  Port,
  SecurityGroup,
  SubnetType,
} from 'aws-cdk-lib/aws-ec2';
import { FargateService } from 'aws-cdk-lib/aws-ecs';
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  ListenerCertificate,
  Protocol,
  TargetType,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  HttpVersion,
  OriginProtocolPolicy,
  OriginRequestPolicy,
  PriceClass,
  ResponseHeadersPolicy,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { LoadBalancerV2Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import {
  Certificate,
  CertificateValidation,
  ICertificate,
} from 'aws-cdk-lib/aws-certificatemanager';
import {
  ARecord,
  HostedZone,
  IHostedZone,
  RecordTarget,
} from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget, LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets';
import { CfnWebACL, CfnWebACLAssociation } from 'aws-cdk-lib/aws-wafv2';
import { ResolvedAuthnAwsConfig } from '../config/types';

export interface AuthnEdgeProps {
  readonly vpc: IVpc;
  readonly config: ResolvedAuthnAwsConfig;
  readonly webService: FargateService;
  readonly serviceSecurityGroup: SecurityGroup;
}

export class AuthnEdge extends Construct {
  public readonly alb: ApplicationLoadBalancer;
  public readonly distribution?: Distribution;
  public readonly certificate?: ICertificate;
  public readonly hostedZone?: IHostedZone;

  constructor(scope: Construct, id: string, props: AuthnEdgeProps) {
    super(scope, id);

    const { vpc, config, webService, serviceSecurityGroup } = props;

    const albSg = new SecurityGroup(this, 'AlbSg', {
      vpc,
      description: 'Authn internal ALB',
      allowAllOutbound: true,
    });

    serviceSecurityGroup.addIngressRule(albSg, Port.tcp(8080), 'alb -> tasks');

    this.alb = new ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      internetFacing: !config.edge.cloudFront,
      vpcSubnets: config.edge.cloudFront
        ? { subnetType: SubnetType.PRIVATE_WITH_EGRESS }
        : { subnetType: SubnetType.PUBLIC },
      securityGroup: albSg,
    });

    const targetGroup = new ApplicationTargetGroup(this, 'WebTg', {
      vpc,
      targetType: TargetType.IP,
      port: 8080,
      protocol: ApplicationProtocol.HTTP,
      healthCheck: {
        path: config.probes.readinessPath,
        protocol: Protocol.HTTP,
        port: '8080',
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: Duration.seconds(20),
    });
    targetGroup.addTarget(webService);

    const url = new URL(config.appUrl);
    const hostname = url.hostname;
    const wantsTls = url.protocol === 'https:';
    const subdomainMode = config.routingMode === 'subdomain';

    if (config.edge.hostedZoneId && config.edge.hostedZoneName) {
      this.hostedZone = HostedZone.fromHostedZoneAttributes(this, 'Zone', {
        hostedZoneId: config.edge.hostedZoneId,
        zoneName: config.edge.hostedZoneName,
      });
    } else if (config.edge.hostedZoneId) {
      this.hostedZone = HostedZone.fromHostedZoneId(this, 'Zone', config.edge.hostedZoneId);
    }

    if (wantsTls && this.hostedZone) {
      const sans = subdomainMode ? [`*.${hostname}`] : undefined;
      this.certificate = new Certificate(this, 'Cert', {
        domainName: hostname,
        subjectAlternativeNames: sans,
        validation: CertificateValidation.fromDns(this.hostedZone),
      });
    }

    if (!config.edge.cloudFront) {
      this.alb.addListener('Http', {
        port: 80,
        protocol: ApplicationProtocol.HTTP,
        defaultTargetGroups: [targetGroup],
      });

      if (this.certificate) {
        this.alb.addListener('Https', {
          port: 443,
          protocol: ApplicationProtocol.HTTPS,
          certificates: [ListenerCertificate.fromCertificateManager(this.certificate)],
          defaultTargetGroups: [targetGroup],
        });
      }

      if (this.hostedZone) {
        new ARecord(this, 'AlbAlias', {
          zone: this.hostedZone,
          recordName: hostname,
          target: RecordTarget.fromAlias(new LoadBalancerTarget(this.alb)),
        });
      }
      return;
    }

    this.alb.addListener('Origin', {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      defaultTargetGroups: [targetGroup],
    });

    if (!this.certificate) {
      throw new Error(
        'edge.cloudFront=true requires edge.hostedZoneId and an https:// appUrl so an ACM cert can be issued for the distribution.',
      );
    }

    const aliases = subdomainMode ? [hostname, `*.${hostname}`] : [hostname];

    this.distribution = new Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new LoadBalancerV2Origin(this.alb, {
          protocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
          httpPort: 80,
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_ALL,
        cachePolicy: CachePolicy.CACHING_DISABLED,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
        responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      certificate: this.certificate,
      domainNames: aliases,
      httpVersion: HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      priceClass: PriceClass.PRICE_CLASS_100,
    });

    if (config.edge.waf) {
      const acl = new CfnWebACL(this, 'WebAcl', {
        scope: 'CLOUDFRONT',
        defaultAction: { allow: {} },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: 'authn-waf',
          sampledRequestsEnabled: true,
        },
        rules: [
          {
            name: 'AWSManagedCommon',
            priority: 0,
            overrideAction: { none: {} },
            statement: { managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesCommonRuleSet' } },
            visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'AWSManagedCommon', sampledRequestsEnabled: true },
          },
          {
            name: 'AWSManagedKnownBadInputs',
            priority: 1,
            overrideAction: { none: {} },
            statement: { managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesKnownBadInputsRuleSet' } },
            visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'AWSManagedKnownBadInputs', sampledRequestsEnabled: true },
          },
          {
            name: 'AWSManagedAmazonIpReputation',
            priority: 2,
            overrideAction: { none: {} },
            statement: { managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesAmazonIpReputationList' } },
            visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'AWSManagedAmazonIpReputation', sampledRequestsEnabled: true },
          },
          {
            name: 'RateLimitPerIp',
            priority: 3,
            action: { block: {} },
            statement: {
              rateBasedStatement: { limit: 5000, aggregateKeyType: 'IP' },
            },
            visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'RateLimitPerIp', sampledRequestsEnabled: true },
          },
        ],
      });

      new CfnWebACLAssociation(this, 'WebAclAssoc', {
        resourceArn: `arn:aws:cloudfront::${this.distribution.stack.account}:distribution/${this.distribution.distributionId}`,
        webAclArn: acl.attrArn,
      });
    }

    if (this.hostedZone) {
      new ARecord(this, 'CfAlias', {
        zone: this.hostedZone,
        recordName: hostname,
        target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
      });
      if (subdomainMode) {
        new ARecord(this, 'CfWildcardAlias', {
          zone: this.hostedZone,
          recordName: `*.${hostname}`,
          target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
        });
      }
    }
  }
}
