# Changelog

## 0.6.0

Tracks the v0.6 authn application surface (Enterprise SSO — unified SAML + OIDC connection model, SCIM 2.0 directory sync, verified-domain sign-in routing).

### Added

- Typed `enterpriseSso` config block on `AuthnAwsConfig`:
  ```typescript
  export interface EnterpriseSsoConfig {
    samlSpSigningKeySecretArn?: string;
  }
  ```
  When set, the construct wires the SecretsManager secret into every ECS task definition as the `AUTHN_SAML_SP_SIGNING_KEY_B64` env via `Secret.fromSecretsManager`. The secret value is a base64-encoded PEM private key the server uses to sign outbound SAML AuthnRequests. Both the block and its single field are optional — connections without a configured SP signing key skip signing, which most IdPs accept. Per-connection `EnterpriseConnection.saml_signing_key` (encrypted on the application-side row) takes precedence over the env-var fallback when both are set.
- README **Enterprise SSO** section documents the `enterpriseSso.samlSpSigningKeySecretArn` config block alongside the existing SMS section and explains the precedence rule.

### Changed

- `package.json` `version` bumped to `0.6.0`.
- Default container image tag (`CHART_VERSION` in `lib/config/defaults.ts`) rolled forward to `0.6.0` — `ghcr.io/authn-sh/authn:0.6.0` ships alongside this release.
- README "Compatibility" table now includes a row for `0.6.x`.
- `examples/single-account-minimal/authn.config.yaml` `image.tag` bumped to `"0.6.0"` so a clean `cdk synth` from the example pulls the v0.6 server image. The `@authn-sh/cdk` dep in the example stays on the most recent published version (`0.5.0`) until the release-dance tag publishes `0.6.0` — a follow-up bumps the example dep after CK-1 tags.

### Notes

The new v0.6 BAPI / FAPI / SCIM endpoint surfaces (enterprise-connections CRUD + dry-run probe, scim/v2/Users + Groups, scim/v2/ServiceProviderConfig, organization-scoped scim/tokens + attribute-mappings, SAML ACS + metadata + OIDC callback) all reuse the existing FAPI ingress — no new ALB target groups, listener rules, or DNS records required. Existing 0.5.x deployments upgrade cleanly with just the image tag bump.

## 0.5.0

Tracks the v0.5 authn application surface (Passkeys / WebAuthn, server-side Appearance + Localization, six new OAuth presets: Discord / Facebook / LinkedIn / X / GitLab / Slack).

### Changed

- `package.json` `version` bumped to `0.5.0`.
- Default container image tag (`CHART_VERSION` in `lib/config/defaults.ts`) rolled forward to `0.5.0` — `ghcr.io/authn-sh/authn:0.5.0` ships alongside this release.
- README "Compatibility" table now includes a row for `0.5.x`.
- `examples/single-account-minimal/authn.config.yaml` `image.tag` bumped to `"0.5.0"` so a clean `cdk synth` from the example pulls the v0.5 server image. The `@authn-sh/cdk` dep in the example stays on the most recent published version until the release-dance tag publishes `0.5.0`.

### Notes

No `AuthnAwsConfig` / `AuthnCompute` API changes. v0.5 needs no new env vars to surface from the construct:

- Passkeys derive the WebAuthn RP-ID from each environment's FAPI host at request time — no synth-time configuration required.
- Appearance and localization blobs are stored in Postgres and edited from the dashboard — they're not provisioned through CDK.
- The six new OAuth presets are configured per-environment through the BAPI `/v1/oauth-providers` surface (same wiring as the v0.4 presets) — no construct change.

## 0.4.1

Fix: `CHART_VERSION` (the default container image tag emitted by `AuthnCompute`) rolls forward to `0.4.0`. The published `@authn-sh/cdk@0.4.0` tarball was cut from an older commit and shipped with `CHART_VERSION = '0.3.0'` baked in; this patch ships the bumped value.

## 0.4.0

Tracks the v0.4 authn application surface (OAuth social sign-in, phone numbers, SMS engine + drivers, `phone_code` second factor, BAPI `/v1/sms-templates`).

### Added

- `AuthnAwsConfig.sms` — typed configuration block for the SMS engine. Fields:
  - `driver`: `"twilio" | "vonage" | "null"` (default `"null"`).
  - `fromNumber`: optional global default originator.
  - `twilio`: `{ accountSid, authTokenSecretArn, fromNumber, messagingServiceSid }` — `authTokenSecretArn` references a Secrets Manager secret.
  - `vonage`: `{ apiKey, apiSecretSecretArn, fromNumber }` — `apiSecretSecretArn` references a Secrets Manager secret.
- `AuthnCompute` now emits the matching `AUTHN_SMS_*` env vars + Secrets Manager-backed secrets onto the `web` + `worker` task definitions. The `scheduler` task definition is left alone (it doesn't dispatch SMS).
- Same `sms` block accepted by the YAML loader (`loadConfig`); see `examples/single-account-minimal/authn.config.yaml`.

### Changed

- `package.json` `version` bumped to `0.4.0`.
- Default container image tag rolled forward to `0.4.0` — `ghcr.io/authn-sh/authn:0.4.0` ships alongside this release.

## 0.3.1

### Added

- First test suite (`lib/**/*.test.ts`) — defaults validation, stack synth assertions covering Valkey engine, ARM64 task runtime, RDS encryption / Multi-AZ defaults, autoscaling toggle, bring-your-own database/cache, and bootstrap/scheduler enablement.
- Release workflow now drops a GitHub Release per tag with the matching `CHANGELOG.md` section as the release notes.
- Release workflow uses **npm trusted publishing** (OIDC) — no `NPM_TOKEN` required after the trusted publisher is configured on npmjs.com.

### Notes

- `npm audit` reports a high-severity advisory in `fast-uri@3.1.0` reachable via `aws-cdk-lib > table > ajv > fast-uri`. The vulnerable package is **bundled** inside the published `aws-cdk-lib` tarball (`bundleDependencies`), so npm `overrides` cannot replace it. We're already on the latest `aws-cdk-lib` (2.253.1); the fix has to come from upstream. Operationally the advisory does not apply to our usage — `fast-uri` is reachable only from `table`'s CLI output formatting, not from any user-input URL parsing path at runtime.

## 0.3.0

Initial release. Feature parity with the [authn.sh Helm chart](https://github.com/authn-sh/helm) 0.3.0 for the AWS deployment target.

### Added

- `AuthnSingleAccountStack` reference stack composing the constructs into a turn-key single-account deployment.
- Constructs:
  - `AuthnNetwork` — VPC across 3 AZs with public / private / isolated subnets and Interface + Gateway VPC endpoints.
  - `AuthnDatabase` — RDS PostgreSQL 16 (Multi-AZ encrypted) or external endpoint.
  - `AuthnCache` — ElastiCache for Valkey 8.0 (replication group with encryption + AUTH; Redis-protocol-compatible so `phpredis` and `REDIS_*` env vars work unchanged) or external endpoint.
  - `AuthnCompute` — ECS Fargate (ARM64) with `web` / `worker` / `scheduler` services and a one-shot `bootstrap` task; internal ALB target.
  - `AuthnEdge` — internal ALB, ACM cert, optional CloudFront, optional WAF; driver-aware (`cloudfront-saas`, `cloudflare-saas`, `manual`, `null`).
  - `AuthnObservability` — CloudWatch log groups, baseline alarms.
- Configuration: strongly-typed `AuthnAwsConfig` interface and a YAML loader (`loadConfig`) for operators who prefer YAML.
- Bootstrap task driven by `AUTHN_BOOTSTRAP_*` (mirrors the chart's post-install hook).
- Routing modes: `subdomain` and `path`.
- Subdomain mode wildcard ACM cert auto-provisioned.
- Optional autoscaling for the `web` service.
