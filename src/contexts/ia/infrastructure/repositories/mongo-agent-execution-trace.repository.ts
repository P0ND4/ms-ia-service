import { HttpStatus, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Collection, MongoClient } from 'mongodb';
import {
  AgentExecutionTrace,
  AgentExecutionTraceInput,
  IAgentExecutionTraceRepository,
} from 'src/contexts/ia/domain/repositories';
import { FoodaExceptionCodes } from 'src/contexts/shared/domain/exceptions/ia-exception.codes';
import { FoodaException } from 'src/contexts/shared/domain/exceptions/ia.exception';

type TraceDocument = Omit<AgentExecutionTrace, 'id'>;

@Injectable()
export class MongoAgentExecutionTraceRepository
  implements IAgentExecutionTraceRepository, OnModuleDestroy
{
  private client: MongoClient | null = null;
  private collection: Collection<TraceDocument> | null = null;
  private indexesEnsured = false;

  constructor(private readonly configService: ConfigService) {}

  async create(trace: AgentExecutionTraceInput): Promise<AgentExecutionTrace> {
    const now = new Date();
    const documentToInsert: TraceDocument = {
      ...trace,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const collection = await this.getCollection();
      const insertResult = await collection.insertOne(documentToInsert);

      return {
        id: insertResult.insertedId.toHexString(),
        ...documentToInsert,
      };
    } catch {
      throw new FoodaException(
        FoodaExceptionCodes.Ex2004,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;

    await this.client.close(true);
    this.client = null;
    this.collection = null;
    this.indexesEnsured = false;
  }

  private async getCollection(): Promise<Collection<TraceDocument>> {
    if (this.collection) return this.collection;

    const uri = this.configService.get<string>('MONGO_URI');
    const dbName = this.configService.get<string>('MONGO_DB_NAME');

    if (!uri) {
      throw new FoodaException(
        FoodaExceptionCodes.Ex2003,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 30000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      serverSelectionTimeoutMS: 5000,
    });

    await this.client.connect();
    this.collection = this.client
      .db(dbName ?? 'ia-service')
      .collection<TraceDocument>('ia_execution_traces');

    if (!this.indexesEnsured) {
      await this.collection.createIndex({ executionId: 1 }, { unique: true });
      await this.collection.createIndex({ tenantId: 1, createdAt: -1 });
      await this.collection.createIndex({ agentId: 1, createdAt: -1 });
      this.indexesEnsured = true;
    }

    return this.collection;
  }
}
