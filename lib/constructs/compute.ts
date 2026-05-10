import { Construct } from 'constructs';
import { Duration, Stack } from 'aws-cdk-lib';
import {
  IVpc,
  Port,
  SecurityGroup,
  SubnetType,
} from 'aws-cdk-lib/aws-ec2';
import {
  ContainerImage,
  CpuArchitecture,
  FargateService,
  FargateTaskDefinition,
  LogDriver,
  OperatingSystemFamily,
  Cluster,
  ICluster,
  Secret as EcsSecret,
} from 'aws-cdk-lib/aws-ecs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { ResolvedAuthnAwsConfig } from '../config/types';

export interface AuthnComputeProps {
  readonly vpc: IVpc;
  readonly config: ResolvedAuthnAwsConfig;
  readonly appSecret: ISecret;
  readonly databaseHost: string;
  readonly databasePort: number;
  readonly databaseName: string;
  readonly databaseUsername: string;
  readonly databasePasswordSecret: ISecret;
  readonly redisHost: string;
  readonly redisPort: number;
  readonly redisAuthSecret: ISecret;
}

export class AuthnCompute extends Construct {
  public readonly cluster: ICluster;
  public readonly webService: FargateService;
  public readonly workerService: FargateService;
  public readonly schedulerService?: FargateService;
  public readonly bootstrapTaskDefinition?: FargateTaskDefinition;
  public readonly serviceSecurityGroup: SecurityGroup;

  constructor(scope: Construct, id: string, props: AuthnComputeProps) {
    super(scope, id);

    const { vpc, config, appSecret } = props;

    this.cluster = new Cluster(this, 'Cluster', {
      vpc,
      containerInsights: true,
      enableFargateCapacityProviders: true,
    });

    this.serviceSecurityGroup = new SecurityGroup(this, 'TaskSg', {
      vpc,
      description: 'Authn ECS tasks',
      allowAllOutbound: true,
    });

    const image = ContainerImage.fromRegistry(
      `${config.image.repository}:${config.image.tag}`,
    );

    const baseEnv: Record<string, string> = {
      AUTHN_APP_URL: config.appUrl,
      APP_URL: config.appUrl,
      AUTHN_ROUTING_MODE: config.routingMode,
      AUTHN_DEFAULT_FROM_EMAIL: config.defaultFromEmail,
      DB_CONNECTION: 'pgsql',
      DB_HOST: props.databaseHost,
      DB_PORT: String(props.databasePort),
      DB_DATABASE: props.databaseName,
      DB_USERNAME: props.databaseUsername,
      REDIS_CLIENT: 'phpredis',
      REDIS_HOST: props.redisHost,
      REDIS_PORT: String(props.redisPort),
      ...(config.env as Record<string, string>),
      ...config.extraEnv,
    };

    const baseSecrets: Record<string, EcsSecret> = {
      APP_KEY: EcsSecret.fromSecretsManager(appSecret, 'APP_KEY'),
      DB_PASSWORD: EcsSecret.fromSecretsManager(props.databasePasswordSecret, 'password'),
      REDIS_PASSWORD: EcsSecret.fromSecretsManager(props.redisAuthSecret),
      MAIL_PASSWORD: EcsSecret.fromSecretsManager(appSecret, 'MAIL_PASSWORD'),
    };

    const retention = this.toLogRetention(config.observability.logRetentionDays);
    const stackName = Stack.of(this).stackName;

    const webLog = new LogGroup(this, 'WebLogs', { logGroupName: `/aws/ecs/${stackName}/web`, retention });
    const workerLog = new LogGroup(this, 'WorkerLogs', { logGroupName: `/aws/ecs/${stackName}/worker`, retention });
    const schedulerLog = new LogGroup(this, 'SchedulerLogs', { logGroupName: `/aws/ecs/${stackName}/scheduler`, retention });
    const bootstrapLog = new LogGroup(this, 'BootstrapLogs', { logGroupName: `/aws/ecs/${stackName}/bootstrap`, retention });

    const runtime = {
      cpuArchitecture: CpuArchitecture.ARM64,
      operatingSystemFamily: OperatingSystemFamily.LINUX,
    };

    const webTd = new FargateTaskDefinition(this, 'WebTd', {
      cpu: config.resources.web.cpu!,
      memoryLimitMiB: config.resources.web.memoryMib!,
      runtimePlatform: runtime,
    });
    webTd.addContainer('app', {
      image,
      essential: true,
      environment: { ...baseEnv, AUTHN_RUN_MIGRATIONS: 'true' },
      secrets: baseSecrets,
      portMappings: [{ containerPort: 8080 }],
      logging: LogDriver.awsLogs({ streamPrefix: 'web', logGroup: webLog }),
      healthCheck: {
        command: ['CMD-SHELL', `curl -fsS http://127.0.0.1:8080${config.probes.livenessPath} || exit 1`],
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        retries: 3,
        startPeriod: Duration.seconds(20),
      },
    });
    this.webService = new FargateService(this, 'WebSvc', {
      cluster: this.cluster,
      taskDefinition: webTd,
      desiredCount: config.replicaCount.web,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [this.serviceSecurityGroup],
      assignPublicIp: false,
      enableExecuteCommand: true,
      circuitBreaker: { rollback: true },
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
    });

    if (config.autoscaling.enabled) {
      const scaling = this.webService.autoScaleTaskCount({
        minCapacity: config.autoscaling.minReplicas!,
        maxCapacity: config.autoscaling.maxReplicas!,
      });
      scaling.scaleOnCpuUtilization('CpuScaling', {
        targetUtilizationPercent: config.autoscaling.targetCpuUtilization!,
      });
    }

    const workerTd = new FargateTaskDefinition(this, 'WorkerTd', {
      cpu: config.resources.worker.cpu!,
      memoryLimitMiB: config.resources.worker.memoryMib!,
      runtimePlatform: runtime,
    });
    workerTd.addContainer('worker', {
      image,
      essential: true,
      command: ['php', 'artisan', 'queue:work',
        '--queue=default,webhooks,mail',
        '--tries=3', '--max-time=3600', '--sleep=1', '--backoff=10'],
      environment: baseEnv,
      secrets: baseSecrets,
      logging: LogDriver.awsLogs({ streamPrefix: 'worker', logGroup: workerLog }),
    });
    this.workerService = new FargateService(this, 'WorkerSvc', {
      cluster: this.cluster,
      taskDefinition: workerTd,
      desiredCount: config.replicaCount.worker,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [this.serviceSecurityGroup],
      assignPublicIp: false,
      enableExecuteCommand: true,
      circuitBreaker: { rollback: true },
    });

    if (config.scheduler.enabled) {
      const schedulerTd = new FargateTaskDefinition(this, 'SchedulerTd', {
        cpu: config.resources.scheduler.cpu!,
        memoryLimitMiB: config.resources.scheduler.memoryMib!,
        runtimePlatform: runtime,
      });
      schedulerTd.addContainer('scheduler', {
        image,
        essential: true,
        command: ['php', 'artisan', 'schedule:work'],
        environment: baseEnv,
        secrets: baseSecrets,
        logging: LogDriver.awsLogs({ streamPrefix: 'scheduler', logGroup: schedulerLog }),
      });
      this.schedulerService = new FargateService(this, 'SchedulerSvc', {
        cluster: this.cluster,
        taskDefinition: schedulerTd,
        desiredCount: 1,
        vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [this.serviceSecurityGroup],
        assignPublicIp: false,
        enableExecuteCommand: true,
        minHealthyPercent: 0,
        maxHealthyPercent: 100,
      });
    }

    if (config.bootstrap.enabled) {
      const td = new FargateTaskDefinition(this, 'BootstrapTd', {
        cpu: config.resources.bootstrap.cpu!,
        memoryLimitMiB: config.resources.bootstrap.memoryMib!,
        runtimePlatform: runtime,
      });
      td.addContainer('bootstrap', {
        image,
        essential: true,
        command: ['sh', '-c',
          'php artisan migrate --force && ' +
          'php artisan authn:bootstrap ' +
          '--email="$AUTHN_BOOTSTRAP_ADMIN_EMAIL" ' +
          '--password="$AUTHN_BOOTSTRAP_ADMIN_PASSWORD" ' +
          '--workspace="$AUTHN_BOOTSTRAP_WORKSPACE_NAME"',
        ],
        environment: baseEnv,
        secrets: {
          ...baseSecrets,
          AUTHN_BOOTSTRAP_ADMIN_EMAIL: EcsSecret.fromSecretsManager(appSecret, 'AUTHN_BOOTSTRAP_ADMIN_EMAIL'),
          AUTHN_BOOTSTRAP_ADMIN_PASSWORD: EcsSecret.fromSecretsManager(appSecret, 'AUTHN_BOOTSTRAP_ADMIN_PASSWORD'),
          AUTHN_BOOTSTRAP_WORKSPACE_NAME: EcsSecret.fromSecretsManager(appSecret, 'AUTHN_BOOTSTRAP_WORKSPACE_NAME'),
        },
        logging: LogDriver.awsLogs({ streamPrefix: 'bootstrap', logGroup: bootstrapLog }),
      });
      this.bootstrapTaskDefinition = td;
    }
  }

  public allowEgressToPort(target: SecurityGroup, port: Port, description: string): void {
    this.serviceSecurityGroup.addEgressRule(target, port, description);
  }

  private toLogRetention(days: number): RetentionDays {
    const map: Record<number, RetentionDays> = {
      1: RetentionDays.ONE_DAY,
      3: RetentionDays.THREE_DAYS,
      5: RetentionDays.FIVE_DAYS,
      7: RetentionDays.ONE_WEEK,
      14: RetentionDays.TWO_WEEKS,
      30: RetentionDays.ONE_MONTH,
      60: RetentionDays.TWO_MONTHS,
      90: RetentionDays.THREE_MONTHS,
      120: RetentionDays.FOUR_MONTHS,
      150: RetentionDays.FIVE_MONTHS,
      180: RetentionDays.SIX_MONTHS,
      365: RetentionDays.ONE_YEAR,
      400: RetentionDays.THIRTEEN_MONTHS,
      545: RetentionDays.EIGHTEEN_MONTHS,
      731: RetentionDays.TWO_YEARS,
      1827: RetentionDays.FIVE_YEARS,
      3653: RetentionDays.TEN_YEARS,
    };
    return map[days] ?? RetentionDays.THREE_MONTHS;
  }
}
