#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { AuthnSingleAccountStack, loadConfig } from '@authn-sh/cdk';

const app = new App();

const account = app.node.tryGetContext('account') ?? process.env.CDK_DEFAULT_ACCOUNT;
const region = app.node.tryGetContext('region') ?? process.env.CDK_DEFAULT_REGION;

new AuthnSingleAccountStack(app, 'Authn', {
  ...(account && region ? { env: { account, region } } : {}),
  config: loadConfig('./authn.config.yaml'),
});
