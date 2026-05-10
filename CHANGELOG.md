# Changelog

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
