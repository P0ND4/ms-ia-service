import { ConfigService } from '@nestjs/config';
import * as mongodb from 'mongodb';
import { MongoAgentExecutionTraceRepository } from 'src/contexts/ia/infrastructure/repositories/mongo-agent-execution-trace.repository';
import { FoodaExceptionCodes } from 'src/contexts/shared/domain/exceptions/ia-exception.codes';

describe('MongoAgentExecutionTraceRepository', () => {
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

  it('creates trace document successfully', async () => {
    const repository = new MongoAgentExecutionTraceRepository(configService);

    const insertOne = jest.fn().mockResolvedValue({
      insertedId: { toHexString: () => 'abc123' },
    });

    jest
      .spyOn(repository as any, 'getCollection')
      .mockResolvedValue({ insertOne } as any);

    const trace = await repository.create({
      executionId: 'ex-1',
      executionMode: 'sync',
      tenantId: 'acme',
      agentId: 'ops-agent',
      goal: 'resumen',
      provider: 'openai-compatible',
      model: 'gpt-4.1-mini',
      response: 'ok',
      toolsExecuted: [],
      startedAt: new Date(),
      finishedAt: new Date(),
      status: 'completed',
    });

    expect(trace.id).toBe('abc123');
    expect(insertOne).toHaveBeenCalledTimes(1);
  });

  it('throws IA-2004 when insert fails', async () => {
    const repository = new MongoAgentExecutionTraceRepository(configService);

    jest
      .spyOn(repository as any, 'getCollection')
      .mockRejectedValue(new Error('db down'));

    await expect(
      repository.create({
        executionId: 'ex-1',
        executionMode: 'sync',
        tenantId: 'acme',
        agentId: 'ops-agent',
        goal: 'resumen',
        provider: 'openai-compatible',
        model: 'gpt-4.1-mini',
        response: 'ok',
        toolsExecuted: [],
        startedAt: new Date(),
        finishedAt: new Date(),
        status: 'completed',
      }),
    ).rejects.toMatchObject({ code: FoodaExceptionCodes.Ex2004.code });
  });

  it('throws IA-2003 when MONGO_URI is missing', async () => {
    const emptyConfig = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;

    const repository = new MongoAgentExecutionTraceRepository(emptyConfig);

    await expect((repository as any).getCollection()).rejects.toMatchObject({
      code: FoodaExceptionCodes.Ex2003.code,
    });
  });

  it('initializes collection and indexes once when connection is available', async () => {
    const createIndex = jest.fn().mockResolvedValue(undefined);
    const collection = {
      createIndex,
    };

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

    const repository = new MongoAgentExecutionTraceRepository(configService);

    const first = await (repository as any).getCollection();
    const second = await (repository as any).getCollection();

    expect(first).toBe(collection);
    expect(second).toBe(collection);
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(createIndex).toHaveBeenCalledTimes(3);

    await repository.onModuleDestroy();
    expect(close).toHaveBeenCalledWith(true);
  });
});
