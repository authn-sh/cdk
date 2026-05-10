export type RoutingMode = 'subdomain' | 'path';

export type CustomDomainDriver = 'cloudfront-saas' | 'cloudflare-saas' | 'manual' | 'null';

export interface TaskResources {
  readonly cpu?: number;
  readonly memoryMib?: number;
}

export interface ImageConfig {
  readonly repository?: string;
  readonly tag?: string;
  readonly pullSecretArn?: string;
}

export interface ReplicaCount {
  readonly web?: number;
  readonly worker?: number;
}

export interface ResourcesConfig {
  readonly web?: TaskResources;
  readonly worker?: TaskResources;
  readonly scheduler?: TaskResources;
  readonly bootstrap?: TaskResources;
}

export interface EnvVars {
  readonly APP_ENV?: string;
  readonly APP_DEBUG?: string;
  readonly LOG_CHANNEL?: string;
  readonly LOG_LEVEL?: string;
  readonly CACHE_STORE?: string;
  readonly QUEUE_CONNECTION?: string;
  readonly SESSION_DRIVER?: string;
  readonly MAIL_MAILER?: string;
  readonly MAIL_HOST?: string;
  readonly MAIL_PORT?: string;
  readonly MAIL_FROM_ADDRESS?: string;
  readonly MAIL_FROM_NAME?: string;
}

export interface SecretValues {
  readonly APP_KEY?: string;
  readonly AUTHN_BOOTSTRAP_ADMIN_EMAIL?: string;
  readonly AUTHN_BOOTSTRAP_ADMIN_PASSWORD?: string;
  readonly AUTHN_BOOTSTRAP_WORKSPACE_NAME?: string;
  readonly DB_PASSWORD?: string;
  readonly REDIS_PASSWORD?: string;
  readonly MAIL_PASSWORD?: string;
}

export interface SecretsConfig {
  readonly existingSecretArn?: string;
  readonly values?: SecretValues;
}

export interface DatabaseConfig {
  readonly enabled?: boolean;
  readonly instanceClass?: string;
  readonly instanceSize?: string;
  readonly multiAz?: boolean;
  readonly storageGb?: number;
  readonly backupRetentionDays?: number;
  readonly auth?: {
    readonly database?: string;
    readonly username?: string;
  };
}

export interface ExternalDatabaseConfig {
  readonly host: string;
  readonly port?: number;
  readonly database?: string;
  readonly username?: string;
}

export interface CacheConfig {
  readonly enabled?: boolean;
  readonly nodeType?: string;
  readonly multiAz?: boolean;
}

export interface ExternalRedisConfig {
  readonly host: string;
  readonly port?: number;
}

export interface EdgeConfig {
  readonly hostedZoneId?: string;
  readonly hostedZoneName?: string;
  readonly cloudFront?: boolean;
  readonly customDomainDriver?: CustomDomainDriver;
  readonly waf?: boolean;
}

export interface SesConfig {
  readonly senderDomain?: string;
}

export interface BootstrapConfig {
  readonly enabled?: boolean;
}

export interface SchedulerConfig {
  readonly enabled?: boolean;
}

export interface AutoscalingConfig {
  readonly enabled?: boolean;
  readonly minReplicas?: number;
  readonly maxReplicas?: number;
  readonly targetCpuUtilization?: number;
}

export interface ObservabilityConfig {
  readonly logRetentionDays?: number;
  readonly alarmEmail?: string;
}

export interface NetworkConfig {
  readonly vpcCidr?: string;
  readonly maxAzs?: number;
  readonly natGateways?: number;
}

export interface ProbesConfig {
  readonly livenessPath?: string;
  readonly readinessPath?: string;
}

export interface AuthnAwsConfig {
  readonly appUrl: string;
  readonly routingMode?: RoutingMode;
  readonly defaultFromEmail: string;
  readonly image?: ImageConfig;
  readonly replicaCount?: ReplicaCount;
  readonly resources?: ResourcesConfig;
  readonly env?: EnvVars;
  readonly extraEnv?: Record<string, string>;
  readonly secrets?: SecretsConfig;
  readonly database?: DatabaseConfig;
  readonly externalDatabase?: ExternalDatabaseConfig;
  readonly cache?: CacheConfig;
  readonly externalRedis?: ExternalRedisConfig;
  readonly edge?: EdgeConfig;
  readonly ses?: SesConfig;
  readonly bootstrap?: BootstrapConfig;
  readonly scheduler?: SchedulerConfig;
  readonly autoscaling?: AutoscalingConfig;
  readonly observability?: ObservabilityConfig;
  readonly network?: NetworkConfig;
  readonly probes?: ProbesConfig;
}

export interface ResolvedAuthnAwsConfig extends Required<Omit<AuthnAwsConfig, 'image' | 'externalDatabase' | 'externalRedis' | 'ses'>> {
  readonly image: Required<ImageConfig> & { readonly pullSecretArn?: string };
  readonly externalDatabase?: ExternalDatabaseConfig;
  readonly externalRedis?: ExternalRedisConfig;
  readonly ses?: SesConfig;
}
