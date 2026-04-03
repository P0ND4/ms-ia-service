import { resolve } from 'node:path';
import environmentFactory from 'src/config/environment.config';

describe('environment.config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('loads defaults when env vars are missing', async () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.MONGO_URI;
    delete process.env.MONGO_DB_NAME;
    delete process.env.IA_TENANT_CONFIG_PATH;

    const config = await environmentFactory();

    expect(config.PORT).toBe(3000);
    expect(config.NODE_ENV).toBe('development');
    expect(config.MONGO_URI).toBe('mongodb://localhost:27017/ia-service-local');
    expect(config.MONGO_DB_NAME).toBe('ia-service');
    expect(config.IA_TENANT_CONFIG_PATH).toBe(
      resolve(process.cwd(), 'src/app/bootstrap/tenant-agents.config.json'),
    );
  });

  it('parses and returns custom env vars', async () => {
    process.env.PORT = '4001';
    process.env.NODE_ENV = 'production';
    process.env.MONGO_URI = 'mongodb://mongo:27017';
    process.env.MONGO_DB_NAME = 'ia-prod';
    process.env.IA_SESSION_MEMORY_LIMIT = '20';
    process.env.IA_DEFAULT_INPUT_COST_PER_1K_TOKENS_USD = '0.01';
    process.env.IA_DEFAULT_OUTPUT_COST_PER_1K_TOKENS_USD = '0.02';

    const config = await environmentFactory();

    expect(config.PORT).toBe(4001);
    expect(config.NODE_ENV).toBe('production');
    expect(config.MONGO_URI).toBe('mongodb://mongo:27017');
    expect(config.MONGO_DB_NAME).toBe('ia-prod');
    expect(config.IA_SESSION_MEMORY_LIMIT).toBe(20);
    expect(config.IA_DEFAULT_INPUT_COST_PER_1K_TOKENS_USD).toBe(0.01);
    expect(config.IA_DEFAULT_OUTPUT_COST_PER_1K_TOKENS_USD).toBe(0.02);
  });
});
