import { ConfigService } from '@nestjs/config';
import * as mongodb from 'mongodb';
import { MongoUsageMetricsRepository } from 'src/contexts/ia/infrastructure/repositories/mongo-usage-metrics.repository';
import { FoodaExceptionCodes } from 'src/contexts/shared/domain/exceptions/ia-exception.codes';

describe('MongoUsageMetricsRepository', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'MONGO_URI') return 'mongodb://fake-host:27017';
      if (key === 'MONGO_DB_NAME') return 'ia-test';
      return undefined;
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records a metric successfully', async () => {
    const repository = new MongoUsageMetricsRepository(configService);
    const insertOne = jest.fn().mockResolvedValue(undefined);

    jest
      .spyOn(repository as any, 'getCollection')
      .mockResolvedValue({ insertOne } as any);

    await repository.record({
      executionId: 'ex-1',
      tenantId: 'acme',
      agentId: 'ops-agent',
      sessionId: 's1',
      executionMode: 'sync',
      provider: 'openai-compatible',
      model: 'gpt-4.1-mini',
      latencyMs: 10,
      promptChars: 10,
      responseChars: 20,
      estimatedInputTokens: 3,
      estimatedOutputTokens: 5,
      estimatedCostUsd: 0.01,
      createdAt: new Date(),
    });

    expect(insertOne).toHaveBeenCalledTimes(1);
  });

  it('aggregates tenant usage summary by provider', async () => {
    const repository = new MongoUsageMetricsRepository(configService);

    const toArray = jest.fn().mockResolvedValue([
      {
        provider: 'openai-compatible',
        tenantId: 'acme',
        estimatedInputTokens: 10,
        estimatedOutputTokens: 20,
        estimatedCostUsd: 0.1,
      },
      {
        provider: 'openai-compatible',
        tenantId: 'acme',
        estimatedInputTokens: 5,
        estimatedOutputTokens: 10,
        estimatedCostUsd: 0.05,
      },
      {
        provider: 'mock-local',
        tenantId: 'acme',
        estimatedInputTokens: 2,
        estimatedOutputTokens: 3,
        estimatedCostUsd: 0.01,
      },
    ]);

    const find = jest.fn().mockReturnValue({ toArray });

    jest
      .spyOn(repository as any, 'getCollection')
      .mockResolvedValue({ find } as any);

    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-02T00:00:00.000Z');

    const summary = await repository.getTenantSummary('acme', from, to);

    expect(summary.executions).toBe(3);
    expect(summary.estimatedInputTokens).toBe(17);
    expect(summary.byProvider).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'openai-compatible',
          executions: 2,
        }),
        expect.objectContaining({ provider: 'mock-local', executions: 1 }),
      ]),
    );
  });

  it('throws IA-4002 on repository failures', async () => {
    const repository = new MongoUsageMetricsRepository(configService);

    jest
      .spyOn(repository as any, 'getCollection')
      .mockRejectedValue(new Error('db down'));

    await expect(
      repository.record({
        executionId: 'ex-1',
        tenantId: 'acme',
        agentId: 'ops-agent',
        sessionId: 's1',
        executionMode: 'sync',
        provider: 'openai-compatible',
        model: 'gpt-4.1-mini',
        latencyMs: 10,
        promptChars: 10,
        responseChars: 20,
        estimatedInputTokens: 3,
        estimatedOutputTokens: 5,
        estimatedCostUsd: 0.01,
        createdAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: FoodaExceptionCodes.Ex4002.code });

    await expect(
      repository.getTenantSummary(
        'acme',
        new Date('2026-01-01T00:00:00.000Z'),
        new Date('2026-01-02T00:00:00.000Z'),
      ),
    ).rejects.toMatchObject({ code: FoodaExceptionCodes.Ex4002.code });
  });

  it('throws IA-2003 when MONGO_URI is missing', async () => {
    const emptyConfig = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;

    const repository = new MongoUsageMetricsRepository(emptyConfig);

    await expect((repository as any).getCollection()).rejects.toMatchObject({
      code: FoodaExceptionCodes.Ex2003.code,
    });
  });

  it('initializes indexes and closes client on destroy', async () => {
    const createIndex = jest.fn().mockResolvedValue(undefined);
    const collection = { createIndex };
    const db = {
      collection: jest.fn().mockReturnValue(collection),
    };

    const close = jest.fn().mockResolvedValue(undefined);
    const client = {
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn().mockReturnValue(db),
      close,
    };

    jest.spyOn(mongodb as any, 'MongoClient').mockImplementation(() => client);

    const repository = new MongoUsageMetricsRepository(configService);

    await (repository as any).getCollection();
    await repository.onModuleDestroy();

    expect(createIndex).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledWith(true);
  });
});
