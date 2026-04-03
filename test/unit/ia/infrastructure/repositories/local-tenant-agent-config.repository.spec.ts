import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { LocalTenantAgentConfigRepository } from 'src/contexts/ia/infrastructure/repositories/local-tenant-agent-config.repository';
import { FoodaExceptionCodes } from 'src/contexts/shared/domain/exceptions/ia-exception.codes';

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
}));

describe('LocalTenantAgentConfigRepository', () => {
  const readFileMock = readFile as jest.MockedFunction<typeof readFile>;

  const configService = {
    get: jest.fn().mockReturnValue('/tmp/tenant-config.json'),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when tenant/agent is not found', async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify({
        tenants: {
          acme: {
            agents: {},
          },
        },
      }),
    );

    const repository = new LocalTenantAgentConfigRepository(configService);
    const result = await repository.getTenantAgentConfig(
      'acme',
      'missing-agent',
    );

    expect(result).toBeNull();
  });

  it('merges template and agent overrides', async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify({
        templates: {
          support: {
            systemPrompt: 'Template prompt',
            enabledTools: ['clock.now'],
            model: {
              provider: 'openai-compatible',
              fallbackProviders: ['mock-local'],
              providerModels: {
                'mock-local': 'mock-local-v1',
              },
              name: 'gpt-4.1-mini',
              temperature: 0.2,
              maxTokens: 800,
            },
          },
        },
        tenants: {
          acme: {
            agents: {
              'ops-agent': {
                templateId: 'support',
                enabledTools: ['context.echo'],
                model: {
                  provider: 'deepseek-compatible',
                  fallbackProviders: ['cloud-generic', 'invalid-provider'],
                  providerModels: {
                    'deepseek-compatible': 'deepseek-chat',
                    invalid: 'invalid-model',
                  },
                  temperature: 0.7,
                },
              },
            },
          },
        },
      }),
    );

    const repository = new LocalTenantAgentConfigRepository(configService);
    const result = await repository.getTenantAgentConfig('acme', 'ops-agent');

    expect(result).toEqual(
      expect.objectContaining({
        tenantId: 'acme',
        agentId: 'ops-agent',
        templateId: 'support',
        systemPrompt: 'Template prompt',
        enabledTools: ['context.echo'],
      }),
    );

    expect(result?.model).toEqual(
      expect.objectContaining({
        provider: 'deepseek-compatible',
        fallbackProviders: ['cloud-generic'],
        model: 'gpt-4.1-mini',
        temperature: 0.7,
      }),
    );
  });

  it('throws IA-4001 when template does not exist', async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify({
        templates: {},
        tenants: {
          acme: {
            agents: {
              'ops-agent': {
                templateId: 'missing-template',
              },
            },
          },
        },
      }),
    );

    const repository = new LocalTenantAgentConfigRepository(configService);

    await expect(
      repository.getTenantAgentConfig('acme', 'ops-agent'),
    ).rejects.toMatchObject({ code: FoodaExceptionCodes.Ex4001.code });
  });

  it('throws IA-2001 when config file cannot be read', async () => {
    readFileMock.mockRejectedValueOnce(new Error('missing file'));

    const repository = new LocalTenantAgentConfigRepository(configService);

    await expect(
      repository.getTenantAgentConfig('acme', 'ops-agent'),
    ).rejects.toMatchObject({ code: FoodaExceptionCodes.Ex2001.code });
  });

  it('throws IA-2002 when config JSON is invalid', async () => {
    readFileMock.mockResolvedValueOnce('[]');

    const repository = new LocalTenantAgentConfigRepository(configService);

    await expect(
      repository.getTenantAgentConfig('acme', 'ops-agent'),
    ).rejects.toMatchObject({ code: FoodaExceptionCodes.Ex2002.code });
  });
});
