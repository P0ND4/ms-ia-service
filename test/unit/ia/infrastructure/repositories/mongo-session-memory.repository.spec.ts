import { ConfigService } from '@nestjs/config';
import * as mongodb from 'mongodb';
import { MongoSessionMemoryRepository } from 'src/contexts/ia/infrastructure/repositories/mongo-session-memory.repository';
import { FoodaExceptionCodes } from 'src/contexts/shared/domain/exceptions/ia-exception.codes';

describe('MongoSessionMemoryRepository', () => {
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

  it('appends and reads turns using collection', async () => {
    const repository = new MongoSessionMemoryRepository(configService);

    const toArray = jest.fn().mockResolvedValue([
      {
        role: 'assistant',
        content: 'segundo',
        createdAt: new Date('2026-01-01T00:00:02.000Z'),
      },
      {
        role: 'user',
        content: 'primero',
        createdAt: new Date('2026-01-01T00:00:01.000Z'),
      },
    ]);

    const limit = jest.fn().mockReturnValue({ toArray });
    const sort = jest.fn().mockReturnValue({ limit });
    const find = jest.fn().mockReturnValue({ sort });
    const insertOne = jest.fn().mockResolvedValue(undefined);

    jest
      .spyOn(repository as any, 'getCollection')
      .mockResolvedValue({ find, insertOne } as any);

    await repository.appendTurn({
      tenantId: 'acme',
      sessionId: 's1',
      turn: {
        role: 'user',
        content: 'hola',
        createdAt: new Date(),
      },
    });

    const turns = await repository.getRecentTurns('acme', 's1', 3);

    expect(insertOne).toHaveBeenCalledTimes(1);
    expect(turns.map((turn) => turn.content)).toEqual(['primero', 'segundo']);
  });

  it('throws IA-3003 when collection operations fail', async () => {
    const repository = new MongoSessionMemoryRepository(configService);

    jest
      .spyOn(repository as any, 'getCollection')
      .mockRejectedValue(new Error('db down'));

    await expect(
      repository.getRecentTurns('acme', 's1', 1),
    ).rejects.toMatchObject({
      code: FoodaExceptionCodes.Ex3003.code,
    });
    await expect(
      repository.appendTurn({
        tenantId: 'acme',
        sessionId: 's1',
        turn: { role: 'user', content: 'hola', createdAt: new Date() },
      }),
    ).rejects.toMatchObject({ code: FoodaExceptionCodes.Ex3003.code });
  });

  it('throws IA-2003 when MONGO_URI is missing', async () => {
    const emptyConfig = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;

    const repository = new MongoSessionMemoryRepository(emptyConfig);

    await expect((repository as any).getCollection()).rejects.toMatchObject({
      code: FoodaExceptionCodes.Ex2003.code,
    });
  });

  it('initializes collection/index and closes client on destroy', async () => {
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

    const repository = new MongoSessionMemoryRepository(configService);

    await (repository as any).getCollection();
    await repository.onModuleDestroy();

    expect(createIndex).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith(true);
  });
});
