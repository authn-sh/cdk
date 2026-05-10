import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AuthnAwsConfig } from '../config/types';
import { AuthnSingleAccountStack } from './single-account-stack';

const baseEnv = { account: '111111111111', region: 'us-east-1' };

function synth(configOverrides: Partial<AuthnAwsConfig> = {}): Template {
  const app = new App();
  const stack = new AuthnSingleAccountStack(app, 'Test', {
    env: baseEnv,
    config: {
      appUrl: 'https://authn.example.com',
      defaultFromEmail: 'no-reply@example.com',
      edge: { cloudFront: false, waf: false },
      ...configOverrides,
    },
  });
  return Template.fromStack(stack);
}

describe('AuthnSingleAccountStack', () => {
  it('synthesizes with managed database + cache', () => {
    const t = synth();
    t.resourceCountIs('AWS::ECS::Cluster', 1);
    t.resourceCountIs('AWS::RDS::DBInstance', 1);
    t.resourceCountIs('AWS::ElastiCache::ReplicationGroup', 1);
    t.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);
  });

  it('creates web + worker + scheduler ECS services by default', () => {
    const t = synth();
    t.resourceCountIs('AWS::ECS::Service', 3);
  });

  it('omits scheduler when scheduler.enabled=false', () => {
    const t = synth({ scheduler: { enabled: false } });
    t.resourceCountIs('AWS::ECS::Service', 2);
  });

  it('uses Valkey 8.0 as the ElastiCache engine', () => {
    const t = synth();
    t.hasResourceProperties('AWS::ElastiCache::ReplicationGroup', {
      Engine: 'valkey',
      EngineVersion: '8.0',
    });
  });

  it('runs Fargate tasks on ARM64', () => {
    const t = synth();
    t.hasResourceProperties('AWS::ECS::TaskDefinition', Match.objectLike({
      RuntimePlatform: { CpuArchitecture: 'ARM64' },
    }));
  });

  it('encrypts RDS storage and runs Multi-AZ by default', () => {
    const t = synth();
    t.hasResourceProperties('AWS::RDS::DBInstance', Match.objectLike({
      StorageEncrypted: true,
      MultiAZ: true,
    }));
  });

  it('skips managed RDS when database.enabled=false', () => {
    const t = synth({
      database: { enabled: false },
      externalDatabase: { host: 'rds.external', port: 5432 },
      secrets: { values: { DB_PASSWORD: 'x' } },
    });
    t.resourceCountIs('AWS::RDS::DBInstance', 0);
  });

  it('skips managed Valkey when cache.enabled=false', () => {
    const t = synth({
      cache: { enabled: false },
      externalRedis: { host: 'redis.external', port: 6379 },
      secrets: { values: { REDIS_PASSWORD: 'x' } },
    });
    t.resourceCountIs('AWS::ElastiCache::ReplicationGroup', 0);
  });

  it('exposes the bootstrap one-shot task definition', () => {
    const t = synth();
    t.hasResource('AWS::ECS::TaskDefinition', {
      Properties: Match.objectLike({
        ContainerDefinitions: Match.arrayWith([
          Match.objectLike({ Name: 'bootstrap' }),
        ]),
      }),
    });
  });

  it('skips bootstrap when bootstrap.enabled=false', () => {
    const t = synth({ bootstrap: { enabled: false } });
    const tds = t.findResources('AWS::ECS::TaskDefinition');
    const bootstrapTds = Object.values(tds).filter(td => {
      const containers = td.Properties?.ContainerDefinitions as Array<{ Name?: string }> | undefined;
      return containers?.some(c => c.Name === 'bootstrap');
    });
    expect(bootstrapTds).toHaveLength(0);
  });

  it('autoscales the web service when autoscaling.enabled=true', () => {
    const t = synth({ autoscaling: { enabled: true, minReplicas: 3, maxReplicas: 12 } });
    t.hasResourceProperties('AWS::ApplicationAutoScaling::ScalableTarget', Match.objectLike({
      MinCapacity: 3,
      MaxCapacity: 12,
    }));
  });
});
