import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AuthnSingleAccountStack } from '../stacks/single-account-stack';

const baseConfig = {
  appUrl: 'https://authn.example.com',
  defaultFromEmail: 'no-reply@authn.example.com',
  edge: { cloudFront: false, waf: false },
};

function synth(config: Record<string, unknown>): Template {
  const app = new App();
  const stack = new AuthnSingleAccountStack(app, 'Authn', {
    env: { account: '123456789012', region: 'us-east-1' },
    config: { ...baseConfig, ...config } as never,
  });
  return Template.fromStack(stack);
}

describe('AuthnCompute SMS wiring', () => {
  test('null driver leaves AUTHN_SMS_DRIVER=null and adds no driver-specific env or secrets', () => {
    const tmpl = synth({});

    tmpl.hasResource('AWS::ECS::TaskDefinition', {
      Properties: {
        ContainerDefinitions: Match.arrayWith([
          Match.objectLike({
            Environment: Match.arrayWith([{ Name: 'AUTHN_SMS_DRIVER', Value: 'null' }]),
          }),
        ]),
      },
    });

    const tds = tmpl.findResources('AWS::ECS::TaskDefinition');
    for (const td of Object.values(tds)) {
      const containers = (td as { Properties: { ContainerDefinitions: { Environment?: { Name: string }[]; Secrets?: { Name: string }[] }[] } })
        .Properties.ContainerDefinitions;
      for (const c of containers) {
        const envNames = (c.Environment ?? []).map((e) => e.Name);
        const secretNames = (c.Secrets ?? []).map((s) => s.Name);
        expect(envNames.some((n) => n.startsWith('AUTHN_SMS_TWILIO_') || n.startsWith('AUTHN_SMS_VONAGE_'))).toBe(false);
        expect(secretNames.some((n) => n.startsWith('AUTHN_SMS_TWILIO_') || n.startsWith('AUTHN_SMS_VONAGE_'))).toBe(false);
      }
    }
  });

  test('twilio driver wires env vars + auth-token secret on web + worker, not scheduler', () => {
    const authTokenArn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:authn-twilio-AbCdEf';
    const tmpl = synth({
      sms: {
        driver: 'twilio',
        fromNumber: '+15551234567',
        twilio: {
          accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          authTokenSecretArn: authTokenArn,
          messagingServiceSid: 'MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        },
      },
    });

    const tds = tmpl.findResources('AWS::ECS::TaskDefinition');
    type Container = { Name?: string; Environment?: { Name: string; Value: string }[]; Secrets?: { Name: string; ValueFrom: unknown }[] };
    const containers: Container[] = [];
    for (const td of Object.values(tds)) {
      containers.push(...(td as { Properties: { ContainerDefinitions: Container[] } }).Properties.ContainerDefinitions);
    }

    const web = containers.find((c) => c.Name === 'app');
    const worker = containers.find((c) => c.Name === 'worker');
    const scheduler = containers.find((c) => c.Name === 'scheduler');
    const bootstrap = containers.find((c) => c.Name === 'bootstrap');
    expect(web).toBeDefined();
    expect(worker).toBeDefined();
    expect(scheduler).toBeDefined();
    expect(bootstrap).toBeDefined();

    for (const c of [web!, worker!]) {
      const envByName = Object.fromEntries((c.Environment ?? []).map((e) => [e.Name, e.Value]));
      expect(envByName.AUTHN_SMS_DRIVER).toBe('twilio');
      expect(envByName.AUTHN_SMS_FROM_NUMBER).toBe('+15551234567');
      expect(envByName.AUTHN_SMS_TWILIO_ACCOUNT_SID).toBe('ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
      expect(envByName.AUTHN_SMS_TWILIO_MESSAGING_SERVICE_SID).toBe('MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
      const secretNames = (c.Secrets ?? []).map((s) => s.Name);
      expect(secretNames).toContain('AUTHN_SMS_TWILIO_AUTH_TOKEN');
    }

    const schedEnv = (scheduler!.Environment ?? []).map((e) => e.Name);
    const schedSec = (scheduler!.Secrets ?? []).map((s) => s.Name);
    expect(schedEnv.some((n) => n.startsWith('AUTHN_SMS_'))).toBe(false);
    expect(schedSec.some((n) => n.startsWith('AUTHN_SMS_'))).toBe(false);

    const bootEnv = (bootstrap!.Environment ?? []).map((e) => e.Name);
    const bootSec = (bootstrap!.Secrets ?? []).map((s) => s.Name);
    expect(bootEnv.some((n) => n.startsWith('AUTHN_SMS_'))).toBe(false);
    expect(bootSec.some((n) => n.startsWith('AUTHN_SMS_'))).toBe(false);
  });

  test('vonage driver wires env vars + api-secret secret on web + worker', () => {
    const apiSecretArn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:authn-vonage-AbCdEf';
    const tmpl = synth({
      sms: {
        driver: 'vonage',
        vonage: {
          apiKey: 'abc123',
          apiSecretSecretArn: apiSecretArn,
          fromNumber: 'AuthnSh',
        },
      },
    });

    const tds = tmpl.findResources('AWS::ECS::TaskDefinition');
    type Container = { Name?: string; Environment?: { Name: string; Value: string }[]; Secrets?: { Name: string }[] };
    const containers: Container[] = [];
    for (const td of Object.values(tds)) {
      containers.push(...(td as { Properties: { ContainerDefinitions: Container[] } }).Properties.ContainerDefinitions);
    }

    for (const name of ['app', 'worker']) {
      const c = containers.find((x) => x.Name === name)!;
      const envByName = Object.fromEntries((c.Environment ?? []).map((e) => [e.Name, e.Value]));
      expect(envByName.AUTHN_SMS_DRIVER).toBe('vonage');
      expect(envByName.AUTHN_SMS_VONAGE_API_KEY).toBe('abc123');
      expect(envByName.AUTHN_SMS_VONAGE_FROM_NUMBER).toBe('AuthnSh');
      const secretNames = (c.Secrets ?? []).map((s) => s.Name);
      expect(secretNames).toContain('AUTHN_SMS_VONAGE_API_SECRET');
    }
  });
});
