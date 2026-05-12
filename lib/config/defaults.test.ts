import { applyDefaults } from './defaults';
import { AuthnAwsConfig } from './types';

describe('applyDefaults', () => {
  const minimal: AuthnAwsConfig = {
    appUrl: 'https://authn.example.com',
    defaultFromEmail: 'no-reply@example.com',
  };

  it('throws when appUrl is missing', () => {
    expect(() => applyDefaults({ defaultFromEmail: 'x@y' } as unknown as AuthnAwsConfig))
      .toThrow(/appUrl is required/);
  });

  it('throws when defaultFromEmail is missing', () => {
    expect(() => applyDefaults({ appUrl: 'https://x' } as unknown as AuthnAwsConfig))
      .toThrow(/defaultFromEmail is required/);
  });

  it('fills sensible defaults', () => {
    const c = applyDefaults(minimal);
    expect(c.routingMode).toBe('subdomain');
    expect(c.image.repository).toBe('ghcr.io/authn-sh/authn');
    expect(c.image.tag).toBe('0.6.0');
    expect(c.replicaCount.web).toBe(2);
    expect(c.replicaCount.worker).toBe(1);
    expect(c.cache.nodeType).toBe('cache.t4g.micro');
    expect(c.cache.multiAz).toBe(true);
    expect(c.database.enabled).toBe(true);
    expect(c.database.multiAz).toBe(true);
    expect(c.bootstrap.enabled).toBe(true);
    expect(c.scheduler.enabled).toBe(true);
    expect(c.edge.cloudFront).toBe(true);
    expect(c.edge.customDomainDriver).toBe('manual');
    expect(c.edge.waf).toBe(true);
    expect(c.observability.logRetentionDays).toBe(90);
  });

  it('uses defaultFromEmail as MAIL_FROM_ADDRESS when env.MAIL_FROM_ADDRESS not set', () => {
    const c = applyDefaults(minimal);
    expect(c.env.MAIL_FROM_ADDRESS).toBe('no-reply@example.com');
  });

  it('preserves user-provided env overrides', () => {
    const c = applyDefaults({
      ...minimal,
      env: { LOG_LEVEL: 'debug', MAIL_HOST: 'smtp.example.com' },
    });
    expect(c.env.LOG_LEVEL).toBe('debug');
    expect(c.env.MAIL_HOST).toBe('smtp.example.com');
    expect(c.env.LOG_CHANNEL).toBe('stderr');
  });

  it('routing mode override takes effect', () => {
    const c = applyDefaults({ ...minimal, routingMode: 'path' });
    expect(c.routingMode).toBe('path');
  });

  it('disables managed database when enabled=false', () => {
    const c = applyDefaults({
      ...minimal,
      database: { enabled: false },
      externalDatabase: { host: 'rds.example.com' },
    });
    expect(c.database.enabled).toBe(false);
    expect(c.externalDatabase?.host).toBe('rds.example.com');
  });

  it('autoscaling defaults to disabled', () => {
    const c = applyDefaults(minimal);
    expect(c.autoscaling.enabled).toBe(false);
    expect(c.autoscaling.minReplicas).toBe(2);
    expect(c.autoscaling.maxReplicas).toBe(10);
    expect(c.autoscaling.targetCpuUtilization).toBe(70);
  });

  it('enterpriseSso defaults to an empty block', () => {
    const c = applyDefaults(minimal);
    expect(c.enterpriseSso.samlSpSigningKeySecretArn).toBeUndefined();
  });

  it('enterpriseSso.samlSpSigningKeySecretArn passes through', () => {
    const arn =
      'arn:aws:secretsmanager:us-east-1:123456789012:secret:authn-saml-sp-signing-AbCdEf';
    const c = applyDefaults({
      ...minimal,
      enterpriseSso: { samlSpSigningKeySecretArn: arn },
    });
    expect(c.enterpriseSso.samlSpSigningKeySecretArn).toBe(arn);
  });
});
