import { HttpStatus, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Collection, MongoClient } from 'mongodb';
import {
  AppendSessionMemoryInput,
  ISessionMemoryRepository,
  SessionMemoryTurn,
} from 'src/contexts/ia/domain/repositories';
import { FoodaExceptionCodes } from 'src/contexts/shared/domain/exceptions/ia-exception.codes';
import { FoodaException } from 'src/contexts/shared/domain/exceptions/ia.exception';

interface SessionMemoryDocument {
  tenantId: string;
  sessionId: string;
  role: SessionMemoryTurn['role'];
  content: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class MongoSessionMemoryRepository
  implements ISessionMemoryRepository, OnModuleDestroy
{
  private client: MongoClient | null = null;
  private collection: Collection<SessionMemoryDocument> | null = null;
  private indexesEnsured = false;

  constructor(private readonly configService: ConfigService) {}

  async getRecentTurns(
    tenantId: string,
    sessionId: string,
    limit: number,
  ): Promise<SessionMemoryTurn[]> {
    try {
      const collection = await this.getCollection();
      const rows = await collection
        .find({ tenantId, sessionId })
        .sort({ createdAt: -1 })
        .limit(Math.max(1, limit))
        .toArray();

      return rows
        .map((row) => ({
          role: row.role,
          content: row.content,
          createdAt: row.createdAt,
          metadata: row.metadata,
        }))
        .reverse();
    } catch {
      throw new FoodaException(
        FoodaExceptionCodes.Ex3003,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async appendTurn(input: AppendSessionMemoryInput): Promise<void> {
    try {
      const collection = await this.getCollection();
      await collection.insertOne({
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        role: input.turn.role,
        content: input.turn.content,
        createdAt: input.turn.createdAt,
        metadata: input.turn.metadata,
      });
    } catch {
      throw new FoodaException(
        FoodaExceptionCodes.Ex3003,
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

  private async getCollection(): Promise<Collection<SessionMemoryDocument>> {
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
      .collection<SessionMemoryDocument>('ia_session_memory');

    if (!this.indexesEnsured) {
      await this.collection.createIndex({
        tenantId: 1,
        sessionId: 1,
        createdAt: -1,
      });
      this.indexesEnsured = true;
    }

    return this.collection;
  }
}
