import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Port } from 'aws-cdk-lib/aws-ec2';
import { ISecret, Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { AuthnAwsConfig, ResolvedAuthnAwsConfig } from '../config/types';
import { applyDefaults } from '../config/defaults';
import { AuthnNetwork } from '../constructs/network';
import { AuthnDatabase } from '../constructs/database';
import { AuthnCache } from '../constructs/cache';
import { AuthnCompute } from '../constructs/compute';
import { AuthnEdge } from '../constructs/edge';
import { AuthnObservability } from '../constructs/observability';

export interface AuthnSingleAccountStackProps extends StackProps {
  readonly config: AuthnAwsConfig;
}

export class AuthnSingleAccountStack extends Stack {
  public readonly resolvedConfig: ResolvedAuthnAwsConfig;

  constructor(scope: Construct, id: string, props: AuthnSingleAccountStackProps) {
    super(scope, id, props);

    const config = applyDefaults(props.config);
    this.resolvedConfig = config;

    const network = new AuthnNetwork(this, 'Network', {
      cidr: config.network.vpcCidr,
      maxAzs: config.network.maxAzs,
      natGateways: config.network.natGateways,
    });

    const appSecret = this.materializeAppSecret(config);

    const database = new AuthnDatabase(this, 'Db', {
      vpc: network.vpc,
      config,
    });

    const cache = new AuthnCache(this, 'Cache', {
      vpc: network.vpc,
      config,
    });

    const compute = new AuthnCompute(this, 'Compute', {
      vpc: network.vpc,
      config,
      appSecret,
      databaseHost: database.host,
      databasePort: database.port,
      databaseName: database.databaseName,
      databaseUsername: database.username,
      databasePasswordSecret: database.passwordSecret,
      redisHost: cache.host,
      redisPort: cache.port,
      redisAuthSecret: cache.authTokenSecret,
    });

    if (database.securityGroup) {
      database.securityGroup.addIngressRule(compute.serviceSecurityGroup, Port.tcp(database.port), 'authn app -> rds');
    }
    if (cache.securityGroup) {
      cache.securityGroup.addIngressRule(compute.serviceSecurityGroup, Port.tcp(cache.port), 'authn app -> valkey');
    }

    const edge = new AuthnEdge(this, 'Edge', {
      vpc: network.vpc,
      config,
      webService: compute.webService,
      serviceSecurityGroup: compute.serviceSecurityGroup,
    });

    new AuthnObservability(this, 'Observability', {
      config,
      alb: edge.alb,
    });

    new CfnOutput(this, 'AlbDnsName',     { value: edge.alb.loadBalancerDnsName });
    new CfnOutput(this, 'AppUrl',         { value: config.appUrl });
    if (edge.distribution) {
      new CfnOutput(this, 'DistributionDomain',     { value: edge.distribution.distributionDomainName });
      new CfnOutput(this, 'DistributionId',         { value: edge.distribution.distributionId });
    }
    new CfnOutput(this, 'AppSecretArn',   { value: appSecret.secretArn });
    new CfnOutput(this, 'EcsClusterName', { value: compute.cluster.clusterName });
  }

  private materializeAppSecret(config: ResolvedAuthnAwsConfig): ISecret {
    if (config.secrets.existingSecretArn) {
      return Secret.fromSecretCompleteArn(this, 'AppSecretImport', config.secrets.existingSecretArn);
    }

    const v = config.secrets.values;
    return new Secret(this, 'AppSecret', {
      secretName: 'authn/app',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          APP_KEY: v?.APP_KEY ?? '',
          AUTHN_BOOTSTRAP_ADMIN_EMAIL: v?.AUTHN_BOOTSTRAP_ADMIN_EMAIL ?? '',
          AUTHN_BOOTSTRAP_ADMIN_PASSWORD: v?.AUTHN_BOOTSTRAP_ADMIN_PASSWORD ?? '',
          AUTHN_BOOTSTRAP_WORKSPACE_NAME: v?.AUTHN_BOOTSTRAP_WORKSPACE_NAME ?? 'My workspace',
          MAIL_PASSWORD: v?.MAIL_PASSWORD ?? '',
        }),
        generateStringKey: '__unused',
        passwordLength: 16,
      },
    });
  }
}
