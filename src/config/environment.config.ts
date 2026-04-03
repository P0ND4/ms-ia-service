import { resolve } from 'node:path';

interface Environment {
  MONGO_URI: string;
  MONGO_DB_NAME: string;
  IA_TENANT_CONFIG_PATH: string;
  IA_SESSION_MEMORY_LIMIT: number;
  IA_GUARDRAIL_INPUT_BLOCKLIST: string;
  IA_GUARDRAIL_OUTPUT_BLOCKLIST: string;
  IA_SIMULATE_PROVIDER_FAILURES: string;
  IA_DEFAULT_INPUT_COST_PER_1K_TOKENS_USD: number;
  IA_DEFAULT_OUTPUT_COST_PER_1K_TOKENS_USD: number;

  PORT: number;
  NODE_ENV: string;
}

export default async (): Promise<Environment> => {
  // Here you can use the ms-config-service and change the environment.
  // Compatible with async await by default.
  // If you're going to use asynchronous requests for environment variables, remember to use caching or ms-cache-service.

  return {
    // Server
    PORT: parseInt(process.env.PORT ?? '3000', 10),
    NODE_ENV: process.env.NODE_ENV ?? 'development',

    // IA
    MONGO_URI:
      process.env.MONGO_URI ?? 'mongodb://localhost:27017/ia-service-local',
    MONGO_DB_NAME: process.env.MONGO_DB_NAME ?? 'ia-service',
    IA_TENANT_CONFIG_PATH:
      process.env.IA_TENANT_CONFIG_PATH ??
      resolve(process.cwd(), 'src/app/bootstrap/tenant-agents.config.json'),
    IA_SESSION_MEMORY_LIMIT: parseInt(
      process.env.IA_SESSION_MEMORY_LIMIT ?? '12',
      10,
    ),
    IA_GUARDRAIL_INPUT_BLOCKLIST:
      process.env.IA_GUARDRAIL_INPUT_BLOCKLIST ??
      'credit card,tarjeta de credito,password,contraseña',
    IA_GUARDRAIL_OUTPUT_BLOCKLIST:
      process.env.IA_GUARDRAIL_OUTPUT_BLOCKLIST ??
      'ssn,security code,cvv,token secreto',
    IA_SIMULATE_PROVIDER_FAILURES:
      process.env.IA_SIMULATE_PROVIDER_FAILURES ?? '',
    IA_DEFAULT_INPUT_COST_PER_1K_TOKENS_USD: parseFloat(
      process.env.IA_DEFAULT_INPUT_COST_PER_1K_TOKENS_USD ?? '0.0015',
    ),
    IA_DEFAULT_OUTPUT_COST_PER_1K_TOKENS_USD: parseFloat(
      process.env.IA_DEFAULT_OUTPUT_COST_PER_1K_TOKENS_USD ?? '0.0020',
    ),
  };
};
