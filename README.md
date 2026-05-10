# @authn-sh/cdk

AWS CDK constructs for deploying [authn.sh](https://authn.sh) on AWS. Sibling project to the [Helm chart](https://github.com/authn-sh/helm).

Pulls `ghcr.io/authn-sh/authn:0.3.0` by default and ships with a reference single-account stack — VPC, RDS Postgres (Multi-AZ), ElastiCache for Valkey (Redis-protocol-compatible), ECS Fargate (ARM64) for `web` / `worker` / `scheduler`, internal ALB, ACM, optional CloudFront + WAF. The default tag rolls forward to `0.4.0` once the stable v0.4.0 application image is cut; pass `image.tag` explicitly to pin a specific (e.g. alpha) build.

## Install

```bash
npm install @authn-sh/cdk aws-cdk-lib constructs
```

## Quickstart — TypeScript

```ts
import { App } from 'aws-cdk-lib';
import { InstanceClass, InstanceSize } from 'aws-cdk-lib/aws-ec2';
import { AuthnSingleAccountStack } from '@authn-sh/cdk';

const app = new App();

new AuthnSingleAccountStack(app, 'Authn', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
  config: {
    appUrl: 'https://authn.example.com',
    routingMode: 'subdomain',
    defaultFromEmail: 'no-reply@authn.example.com',
    edge: { hostedZoneId: 'Z0123456789ABCDEFGHIJ' },
    database: { instanceClass: InstanceClass.T4G, instanceSize: InstanceSize.SMALL, multiAz: true },
  },
});
```

`cdk deploy` and the stack provisions everything.

## Quickstart — YAML config

For operators who don't want to write TypeScript, point the reference stack at a YAML file:

```yaml
# authn.config.yaml
appUrl: https://authn.example.com
routingMode: subdomain
defaultFromEmail: no-reply@authn.example.com

edge:
  hostedZoneId: Z0123456789ABCDEFGHIJ
  customDomainDriver: manual

database:
  instanceClass: t4g
  instanceSize: small
  multiAz: true

cache:
  enabled: true
  multiAz: true
```

```ts
import { App } from 'aws-cdk-lib';
import { AuthnSingleAccountStack, loadConfig } from '@authn-sh/cdk';

const app = new App();
new AuthnSingleAccountStack(app, 'Authn', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
  config: loadConfig('./authn.config.yaml'),
});
```

See [`examples/single-account-minimal/`](./examples/single-account-minimal) for a runnable starter.

## Routing modes

- `subdomain` (default) — wildcard DNS + TLS required. Each tenant environment lives at `<routing_label>.<APP_HOST>`. Wildcard ACM cert auto-provisioned in `us-east-1` with DNS-01 validation against the configured hosted zone.
- `path` — single host. Tenant envs live at `<APP_HOST>/<routing_label>`. Simpler — no wildcard cert.

## Bring-your-own database / cache

Either provision managed RDS + ElastiCache (default) or point at existing endpoints:

```yaml
database:
  enabled: false
externalDatabase:
  host: postgres.internal
  port: 5432
  database: authn
  username: authn

cache:
  enabled: false
externalRedis:
  host: redis.internal
  port: 6379
```

Passwords go through the same `secrets` map as inline credentials — see below.

## Secrets

Secrets live in AWS Secrets Manager. Either inject inline values (creates a new secret in your account) or pass an existing Secrets Manager ARN:

```yaml
secrets:
  existingSecretArn: arn:aws:secretsmanager:us-east-1:123456789012:secret:authn-prod-AbCdEf
  # or:
  values:
    APP_KEY: "base64:..."          # `openssl rand -base64 32 | sed 's/^/base64:/'`
    AUTHN_BOOTSTRAP_ADMIN_EMAIL: op@example.com
    AUTHN_BOOTSTRAP_ADMIN_PASSWORD: change-me-please
    AUTHN_BOOTSTRAP_WORKSPACE_NAME: My workspace
    DB_PASSWORD: ...
    REDIS_PASSWORD: ...
    MAIL_PASSWORD: ...
```

ECS task definitions reference the secret via the `secrets:` block — values never appear in env vars or stack outputs.

## SMS

v0.4 introduces an SMS engine for phone-number verification and the `phone_code` second factor. The construct exposes a typed `sms` block:

```yaml
sms:
  driver: twilio   # or "vonage" / "null" (default)
  fromNumber: "+15551234567"
  twilio:
    accountSid: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    authTokenSecretArn: arn:aws:secretsmanager:us-east-1:123456789012:secret:authn-twilio-AbCdEf
    messagingServiceSid: MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The `*SecretArn` fields point at AWS Secrets Manager secrets — the construct wires them onto the `web` + `worker` task definitions as ECS secrets. The `scheduler` doesn't dispatch SMS, so it's left out. Per-environment overrides still go through the BAPI `Environment.sms.*` config at runtime.

## Custom domains

The `authn` app supports customer-provided domains (e.g., `auth.customer.com`) via a pluggable driver. The CDK construct provisions the AWS-side resources each driver needs:

| `customDomainDriver` | Provisions |
|---|---|
| `cloudfront-saas` | CloudFront multi-tenant distribution + IAM permissions on the task role for `cloudfront:*DistributionTenant*` and `acm:*` |
| `cloudflare-saas` | No AWS-side provisioning; expects `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ZONE_ID` to be set on the app |
| `manual` (default) | Nothing — operator manages the edge themselves |
| `null` | Tests only |

## Custom domains: one CNAME for customers

When you choose `cloudfront-saas`, the construct provisions the multi-tenant distribution and exports its domain. Point a stable CNAME (e.g., `cname.authn.example.com`) at it and tell your customers to CNAME their own domains there.

## After install

The bootstrap one-shot task runs on first deploy. Tail it via the CloudWatch log group `/aws/ecs/<stack>/bootstrap`. The first operator's `pk_live_…` and `sk_live_…` keys are printed once. Save them.

## Upgrade

Bump `image.tag` and `cdk deploy`. Migrations run as part of the bootstrap task on each deploy (idempotent).

## License

[AGPL-3.0-only](./LICENSE).
