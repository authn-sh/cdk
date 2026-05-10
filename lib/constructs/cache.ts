import { Construct } from 'constructs';
import { Stack } from 'aws-cdk-lib';
import {
  IVpc,
  Port,
  SecurityGroup,
  SubnetType,
} from 'aws-cdk-lib/aws-ec2';
import {
  CfnReplicationGroup,
  CfnSubnetGroup,
} from 'aws-cdk-lib/aws-elasticache';
import { ISecret, Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { ResolvedAuthnAwsConfig } from '../config/types';

export interface AuthnCacheProps {
  readonly vpc: IVpc;
  readonly config: ResolvedAuthnAwsConfig;
}

export class AuthnCache extends Construct {
  public readonly host: string;
  public readonly port: number;
  public readonly authTokenSecret: ISecret;
  public readonly securityGroup?: SecurityGroup;

  constructor(scope: Construct, id: string, props: AuthnCacheProps) {
    super(scope, id);

    const { config, vpc } = props;

    if (config.cache.enabled === false) {
      const ext = config.externalRedis;
      if (!ext) {
        throw new Error('cache.enabled=false requires externalRedis to be set');
      }
      this.host = ext.host;
      this.port = ext.port ?? 6379;
      this.authTokenSecret = config.secrets.existingSecretArn
        ? Secret.fromSecretCompleteArn(this, 'ExistingSecret', config.secrets.existingSecretArn)
        : Secret.fromSecretNameV2(this, 'GeneratedSecret', 'authn-redis-external');
      return;
    }

    const sg = new SecurityGroup(this, 'CacheSg', {
      vpc,
      description: 'Authn ElastiCache security group',
      allowAllOutbound: false,
    });

    const subnetGroup = new CfnSubnetGroup(this, 'SubnetGroup', {
      description: 'Authn cache subnets',
      subnetIds: vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_ISOLATED }).subnetIds,
    });

    const authToken = new Secret(this, 'AuthToken', {
      secretName: 'authn/redis-auth',
      generateSecretString: {
        passwordLength: 32,
        excludePunctuation: true,
        includeSpace: false,
      },
    });

    const replication = new CfnReplicationGroup(this, 'Redis', {
      replicationGroupDescription: 'Authn Redis',
      engine: 'redis',
      engineVersion: '7.1',
      cacheNodeType: config.cache.nodeType,
      numNodeGroups: 1,
      replicasPerNodeGroup: config.cache.multiAz ? 1 : 0,
      automaticFailoverEnabled: config.cache.multiAz,
      multiAzEnabled: config.cache.multiAz,
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      authToken: authToken.secretValue.unsafeUnwrap(),
      cacheSubnetGroupName: subnetGroup.ref,
      securityGroupIds: [sg.securityGroupId],
      port: 6379,
    });

    this.host = replication.attrPrimaryEndPointAddress;
    this.port = 6379;
    this.authTokenSecret = authToken;
    this.securityGroup = sg;

    const _stack = Stack.of(this);
    void _stack;
  }

  public allowFrom(other: SecurityGroup): void {
    if (this.securityGroup) {
      this.securityGroup.addIngressRule(other, Port.tcp(this.port), 'authn app -> redis');
    }
  }
}
