import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';
import { AuthnAwsConfig } from './types';

export function loadConfig(path: string): AuthnAwsConfig {
  const text = readFileSync(resolve(path), 'utf8');
  const data = parse(text);
  if (!data || typeof data !== 'object') {
    throw new Error(`Config at ${path} did not parse to an object`);
  }
  return data as AuthnAwsConfig;
}
