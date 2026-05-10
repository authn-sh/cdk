import {
  AuthnAwsConfig,
  ResolvedAuthnAwsConfig,
} from './types';

// Default container image tag. Stays at 0.3.0 (the most recent stable) until
// the cross-repo v0.4.0 stable cut publishes ghcr.io/authn-sh/authn:0.4.0.
// Operators wanting an alpha can pass image.tag = '0.4.0-alpha.N' explicitly.
export const CHART_VERSION = '0.3.0';

export function applyDefaults(input: AuthnAwsConfig): ResolvedAuthnAwsConfig {
  if (!input.appUrl) {
    throw new Error('AuthnAwsConfig.appUrl is required (e.g. https://authn.example.com)');
  }
  if (!input.defaultFromEmail) {
    throw new Error('AuthnAwsConfig.defaultFromEmail is required');
  }

  return {
    appUrl: input.appUrl,
    routingMode: input.routingMode ?? 'subdomain',
    defaultFromEmail: input.defaultFromEmail,

    image: {
      repository: input.image?.repository ?? 'ghcr.io/authn-sh/authn',
      tag: input.image?.tag ?? CHART_VERSION,
      pullSecretArn: input.image?.pullSecretArn,
    },

    replicaCount: {
      web: input.replicaCount?.web ?? 2,
      worker: input.replicaCount?.worker ?? 1,
    },

    resources: {
      web: {
        cpu: input.resources?.web?.cpu ?? 512,
        memoryMib: input.resources?.web?.memoryMib ?? 1024,
      },
      worker: {
        cpu: input.resources?.worker?.cpu ?? 512,
        memoryMib: input.resources?.worker?.memoryMib ?? 1024,
      },
      scheduler: {
        cpu: input.resources?.scheduler?.cpu ?? 256,
        memoryMib: input.resources?.scheduler?.memoryMib ?? 512,
      },
      bootstrap: {
        cpu: input.resources?.bootstrap?.cpu ?? 512,
        memoryMib: input.resources?.bootstrap?.memoryMib ?? 1024,
      },
    },

    env: {
      APP_ENV: input.env?.APP_ENV ?? 'production',
      APP_DEBUG: input.env?.APP_DEBUG ?? 'false',
      LOG_CHANNEL: input.env?.LOG_CHANNEL ?? 'stderr',
      LOG_LEVEL: input.env?.LOG_LEVEL ?? 'info',
      CACHE_STORE: input.env?.CACHE_STORE ?? 'redis',
      QUEUE_CONNECTION: input.env?.QUEUE_CONNECTION ?? 'redis',
      SESSION_DRIVER: input.env?.SESSION_DRIVER ?? 'cookie',
      MAIL_MAILER: input.env?.MAIL_MAILER ?? 'smtp',
      MAIL_HOST: input.env?.MAIL_HOST ?? '',
      MAIL_PORT: input.env?.MAIL_PORT ?? '587',
      MAIL_FROM_ADDRESS: input.env?.MAIL_FROM_ADDRESS ?? input.defaultFromEmail,
      MAIL_FROM_NAME: input.env?.MAIL_FROM_NAME ?? 'authn.sh',
    },

    extraEnv: input.extraEnv ?? {},

    secrets: {
      existingSecretArn: input.secrets?.existingSecretArn,
      values: input.secrets?.values ?? {},
    },

    database: {
      enabled: input.database?.enabled ?? true,
      instanceClass: input.database?.instanceClass ?? 't4g',
      instanceSize: input.database?.instanceSize ?? 'small',
      multiAz: input.database?.multiAz ?? true,
      storageGb: input.database?.storageGb ?? 20,
      backupRetentionDays: input.database?.backupRetentionDays ?? 7,
      auth: {
        database: input.database?.auth?.database ?? 'authn',
        username: input.database?.auth?.username ?? 'authn',
      },
    },

    externalDatabase: input.externalDatabase,

    cache: {
      enabled: input.cache?.enabled ?? true,
      nodeType: input.cache?.nodeType ?? 'cache.t4g.micro',
      multiAz: input.cache?.multiAz ?? true,
    },

    externalRedis: input.externalRedis,

    edge: {
      hostedZoneId: input.edge?.hostedZoneId,
      hostedZoneName: input.edge?.hostedZoneName,
      cloudFront: input.edge?.cloudFront ?? true,
      customDomainDriver: input.edge?.customDomainDriver ?? 'manual',
      waf: input.edge?.waf ?? true,
    },

    ses: input.ses,

    bootstrap: {
      enabled: input.bootstrap?.enabled ?? true,
    },

    scheduler: {
      enabled: input.scheduler?.enabled ?? true,
    },

    autoscaling: {
      enabled: input.autoscaling?.enabled ?? false,
      minReplicas: input.autoscaling?.minReplicas ?? 2,
      maxReplicas: input.autoscaling?.maxReplicas ?? 10,
      targetCpuUtilization: input.autoscaling?.targetCpuUtilization ?? 70,
    },

    observability: {
      logRetentionDays: input.observability?.logRetentionDays ?? 90,
      alarmEmail: input.observability?.alarmEmail ?? '',
    },

    network: {
      vpcCidr: input.network?.vpcCidr ?? '10.0.0.0/16',
      maxAzs: input.network?.maxAzs ?? 3,
      natGateways: input.network?.natGateways ?? (input.network?.maxAzs ?? 3),
    },

    probes: {
      livenessPath: input.probes?.livenessPath ?? '/up',
      readinessPath: input.probes?.readinessPath ?? '/up',
    },

    sms: {
      driver: input.sms?.driver ?? 'null',
      fromNumber: input.sms?.fromNumber,
      twilio: input.sms?.twilio,
      vonage: input.sms?.vonage,
    },
  };
}
