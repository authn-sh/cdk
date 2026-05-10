import { Construct } from 'constructs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  InstanceClass,
  InstanceSize,
  InstanceType,
  IVpc,
  Port,
  SecurityGroup,
  SubnetType,
} from 'aws-cdk-lib/aws-ec2';
import { Key } from 'aws-cdk-lib/aws-kms';
import {
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine,
  ParameterGroup,
  PostgresEngineVersion,
  StorageType,
} from 'aws-cdk-lib/aws-rds';
import { ISecret, Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { ResolvedAuthnAwsConfig } from '../config/types';

export interface AuthnDatabaseProps {
  readonly vpc: IVpc;
  readonly config: ResolvedAuthnAwsConfig;
  readonly kmsKey?: Key;
}

export class AuthnDatabase extends Construct {
  public readonly host: string;
  public readonly port: number;
  public readonly databaseName: string;
  public readonly username: string;
  public readonly passwordSecret: ISecret;
  public readonly securityGroup?: SecurityGroup;

  constructor(scope: Construct, id: string, props: AuthnDatabaseProps) {
    super(scope, id);

    const { config, vpc } = props;

    if (config.database.enabled === false) {
      const ext = config.externalDatabase;
      if (!ext) {
        throw new Error('database.enabled=false requires externalDatabase to be set');
      }
      if (!config.secrets.existingSecretArn && !config.secrets.values?.DB_PASSWORD) {
        throw new Error('externalDatabase requires DB_PASSWORD in secrets.values or secrets.existingSecretArn');
      }
      this.host = ext.host;
      this.port = ext.port ?? 5432;
      this.databaseName = ext.database ?? 'authn';
      this.username = ext.username ?? 'authn';
      this.passwordSecret = config.secrets.existingSecretArn
        ? Secret.fromSecretCompleteArn(this, 'ExistingSecret', config.secrets.existingSecretArn)
        : Secret.fromSecretNameV2(this, 'GeneratedSecret', 'authn-db-external');
      return;
    }

    const sg = new SecurityGroup(this, 'DbSg', {
      vpc,
      description: 'Authn RDS security group',
      allowAllOutbound: false,
    });

    const credentials = Credentials.fromGeneratedSecret(config.database.auth.username, {
      secretName: 'authn/db',
    });

    const instance = new DatabaseInstance(this, 'Postgres', {
      vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      engine: DatabaseInstanceEngine.postgres({ version: PostgresEngineVersion.VER_16_4 }),
      instanceType: InstanceType.of(
        toInstanceClass(config.database.instanceClass),
        toInstanceSize(config.database.instanceSize),
      ),
      multiAz: config.database.multiAz,
      allocatedStorage: config.database.storageGb,
      storageType: StorageType.GP3,
      storageEncrypted: true,
      storageEncryptionKey: props.kmsKey,
      databaseName: config.database.auth.database,
      credentials,
      backupRetention: Duration.days(config.database.backupRetentionDays),
      deletionProtection: true,
      removalPolicy: RemovalPolicy.SNAPSHOT,
      securityGroups: [sg],
      parameterGroup: new ParameterGroup(this, 'Pg', {
        engine: DatabaseInstanceEngine.postgres({ version: PostgresEngineVersion.VER_16_4 }),
        parameters: {
          'log_statement': 'ddl',
          'log_connections': 'on',
          'log_disconnections': 'on',
        },
      }),
      enablePerformanceInsights: true,
      cloudwatchLogsExports: ['postgresql'],
    });

    this.host = instance.dbInstanceEndpointAddress;
    this.port = 5432;
    this.databaseName = config.database.auth.database;
    this.username = config.database.auth.username;
    this.passwordSecret = instance.secret!;
    this.securityGroup = sg;
  }

  public allowFrom(other: SecurityGroup): void {
    if (this.securityGroup) {
      this.securityGroup.addIngressRule(other, Port.tcp(this.port), 'authn app -> rds');
    }
  }
}

function toInstanceClass(input: string): InstanceClass {
  const key = input.toUpperCase().replace('.', '_').replace('-', '_');
  const ic = (InstanceClass as unknown as Record<string, InstanceClass>)[key];
  if (!ic) {
    throw new Error(`Unknown database.instanceClass: ${input}`);
  }
  return ic;
}

function toInstanceSize(input: string): InstanceSize {
  const key = input.toUpperCase();
  const is = (InstanceSize as unknown as Record<string, InstanceSize>)[key];
  if (!is) {
    throw new Error(`Unknown database.instanceSize: ${input}`);
  }
  return is;
}
