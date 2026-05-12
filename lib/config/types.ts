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

export type SmsDriver = 'twilio' | 'vonage' | 'null';

export interface SmsTwilioConfig {
  readonly accountSid?: string;
  readonly authTokenSecretArn?: string;
  readonly fromNumber?: string;
  readonly messagingServiceSid?: string;
}

export interface SmsVonageConfig {
  readonly apiKey?: string;
  readonly apiSecretSecretArn?: string;
  readonly fromNumber?: string;
}

export interface SmsConfig {
  readonly driver?: SmsDriver;
  readonly fromNumber?: string;
  readonly twilio?: SmsTwilioConfig;
  readonly vonage?: SmsVonageConfig;
}

export interface EnterpriseSsoConfig {
  /**
   * SecretsManager ARN for the SAML SP signing key (PEM, base64-encoded).
   * Optional — required only if you'll create signed-AuthnRequest connections
   * on a SAML enterprise IdP that rejects unsigned requests (some Azure AD /
   * ADFS configurations). When set, the secret is wired into the ECS task
   * definition as the `AUTHN_SAML_SP_SIGNING_KEY_B64` env (via
   * `Secret.fromSecretsManager`). Per-connection
   * `EnterpriseConnection.saml_signing_key` takes precedence over this
   * instance-wide fallback when both are set.
   */
  readonly samlSpSigningKeySecretArn?: string;
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
  readonly sms?: SmsConfig;
  readonly enterpriseSso?: EnterpriseSsoConfig;
}

export interface ResolvedTaskResources {
  readonly cpu: number;
  readonly memoryMib: number;
}

export interface ResolvedImageConfig {
  readonly repository: string;
  readonly tag: string;
  readonly pullSecretArn?: string;
}

export interface ResolvedReplicaCount {
  readonly web: number;
  readonly worker: number;
}

export interface ResolvedResourcesConfig {
  readonly web: ResolvedTaskResources;
  readonly worker: ResolvedTaskResources;
  readonly scheduler: ResolvedTaskResources;
  readonly bootstrap: ResolvedTaskResources;
}

export interface ResolvedEnvVars {
  readonly APP_ENV: string;
  readonly APP_DEBUG: string;
  readonly LOG_CHANNEL: string;
  readonly LOG_LEVEL: string;
  readonly CACHE_STORE: string;
  readonly QUEUE_CONNECTION: string;
  readonly SESSION_DRIVER: string;
  readonly MAIL_MAILER: string;
  readonly MAIL_HOST: string;
  readonly MAIL_PORT: string;
  readonly MAIL_FROM_ADDRESS: string;
  readonly MAIL_FROM_NAME: string;
}

export interface ResolvedSecretsConfig {
  readonly existingSecretArn?: string;
  readonly values: SecretValues;
}

export interface ResolvedDatabaseAuth {
  readonly database: string;
  readonly username: string;
}

export interface ResolvedDatabaseConfig {
  readonly enabled: boolean;
  readonly instanceClass: string;
  readonly instanceSize: string;
  readonly multiAz: boolean;
  readonly storageGb: number;
  readonly backupRetentionDays: number;
  readonly auth: ResolvedDatabaseAuth;
}

export interface ResolvedCacheConfig {
  readonly enabled: boolean;
  readonly nodeType: string;
  readonly multiAz: boolean;
}

export interface ResolvedEdgeConfig {
  readonly hostedZoneId?: string;
  readonly hostedZoneName?: string;
  readonly cloudFront: boolean;
  readonly customDomainDriver: CustomDomainDriver;
  readonly waf: boolean;
}

export interface ResolvedBootstrapConfig {
  readonly enabled: boolean;
}

export interface ResolvedSchedulerConfig {
  readonly enabled: boolean;
}

export interface ResolvedAutoscalingConfig {
  readonly enabled: boolean;
  readonly minReplicas: number;
  readonly maxReplicas: number;
  readonly targetCpuUtilization: number;
}

export interface ResolvedObservabilityConfig {
  readonly logRetentionDays: number;
  readonly alarmEmail: string;
}

export interface ResolvedNetworkConfig {
  readonly vpcCidr: string;
  readonly maxAzs: number;
  readonly natGateways: number;
}

export interface ResolvedProbesConfig {
  readonly livenessPath: string;
  readonly readinessPath: string;
}

export interface ResolvedSmsConfig {
  readonly driver: SmsDriver;
  readonly fromNumber?: string;
  readonly twilio?: SmsTwilioConfig;
  readonly vonage?: SmsVonageConfig;
}

export interface ResolvedEnterpriseSsoConfig {
  readonly samlSpSigningKeySecretArn?: string;
}

export interface ResolvedAuthnAwsConfig {
  readonly appUrl: string;
  readonly routingMode: RoutingMode;
  readonly defaultFromEmail: string;
  readonly image: ResolvedImageConfig;
  readonly replicaCount: ResolvedReplicaCount;
  readonly resources: ResolvedResourcesConfig;
  readonly env: ResolvedEnvVars;
  readonly extraEnv: Record<string, string>;
  readonly secrets: ResolvedSecretsConfig;
  readonly database: ResolvedDatabaseConfig;
  readonly externalDatabase?: ExternalDatabaseConfig;
  readonly cache: ResolvedCacheConfig;
  readonly externalRedis?: ExternalRedisConfig;
  readonly edge: ResolvedEdgeConfig;
  readonly ses?: SesConfig;
  readonly bootstrap: ResolvedBootstrapConfig;
  readonly scheduler: ResolvedSchedulerConfig;
  readonly autoscaling: ResolvedAutoscalingConfig;
  readonly observability: ResolvedObservabilityConfig;
  readonly network: ResolvedNetworkConfig;
  readonly probes: ResolvedProbesConfig;
  readonly sms: ResolvedSmsConfig;
  readonly enterpriseSso: ResolvedEnterpriseSsoConfig;
}
