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

describe('AuthnCompute enterprise-SSO wiring', () => {
  test('omits AUTHN_SAML_SP_SIGNING_KEY_B64 secret by default', () => {
    const tmpl = synth({});

    const tds = tmpl.findResources('AWS::ECS::TaskDefinition');
    for (const td of Object.values(tds)) {
      const containers = (td as {
        Properties: {
          ContainerDefinitions: {
            Secrets?: { Name: string }[];
          }[];
        };
      }).Properties.ContainerDefinitions;
      for (const c of containers) {
        const secretNames = (c.Secrets ?? []).map((s) => s.Name);
        expect(secretNames).not.toContain('AUTHN_SAML_SP_SIGNING_KEY_B64');
      }
    }
  });

  test('wires AUTHN_SAML_SP_SIGNING_KEY_B64 as an ECS secret on every task when samlSpSigningKeySecretArn is set', () => {
    const arn =
      'arn:aws:secretsmanager:us-east-1:123456789012:secret:authn-saml-sp-signing-AbCdEf';
    const tmpl = synth({
      enterpriseSso: { samlSpSigningKeySecretArn: arn },
    });

    tmpl.hasResource('AWS::ECS::TaskDefinition', {
      Properties: {
        ContainerDefinitions: Match.arrayWith([
          Match.objectLike({
            Secrets: Match.arrayWith([
              Match.objectLike({ Name: 'AUTHN_SAML_SP_SIGNING_KEY_B64' }),
            ]),
          }),
        ]),
      },
    });
  });
});
