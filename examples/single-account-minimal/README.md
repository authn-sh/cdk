# single-account-minimal

Smallest runnable example of `@authn-sh/cdk`. Deploys authn.sh into a single AWS account with managed RDS Postgres + ElastiCache Redis behind CloudFront + ALB.

## Use

```bash
npm install
npx cdk bootstrap aws://<account>/<region>     # one-time per account/region
npx cdk synth
npx cdk deploy
```

Edit `authn.config.yaml` first to set:

- `appUrl` — the URL operators will hit (e.g. `https://authn.example.com`)
- `defaultFromEmail` — sender for transactional email
- `edge.hostedZoneId` / `edge.hostedZoneName` — your Route 53 hosted zone for the domain
- `secrets.values.APP_KEY` — generate with `openssl rand -base64 32 | sed 's/^/base64:/'`
- `secrets.values.AUTHN_BOOTSTRAP_ADMIN_EMAIL` / `AUTHN_BOOTSTRAP_ADMIN_PASSWORD` — first operator credentials

For routing modes, custom domains, autoscaling, and bring-your-own database/cache see the top-level [README](../../README.md).

After `cdk deploy` finishes, run the bootstrap one-shot task:

```bash
aws ecs run-task \
  --cluster <ClusterNameOutput> \
  --task-definition <BootstrapTaskDefinitionArn> \
  --launch-type FARGATE \
  --network-configuration '{ "awsvpcConfiguration": { "subnets": [<private-subnet-ids>], "securityGroups": [<task-sg-id>] } }'
```

Tail logs in `/aws/ecs/<stack>/bootstrap`. The first operator's `pk_live_…` and `sk_live_…` keys print once.
