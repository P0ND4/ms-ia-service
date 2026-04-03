import { HttpStatus, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Collection, MongoClient } from 'mongodb';
import {
  IUsageMetricsRepository,
  TenantUsageSummary,
  UsageMetricInput,
} from 'src/contexts/ia/domain/repositories';
import { FoodaExceptionCodes } from 'src/contexts/shared/domain/exceptions/ia-exception.codes';
import { FoodaException } from 'src/contexts/shared/domain/exceptions/ia.exception';

type UsageMetricDocument = UsageMetricInput;

@Injectable()
export class MongoUsageMetricsRepository
  implements IUsageMetricsRepository, OnModuleDestroy
{
  private client: MongoClient | null = null;
  private collection: Collection<UsageMetricDocument> | null = null;
  private indexesEnsured = false;

  constructor(private readonly configService: ConfigService) {}

  async record(metric: UsageMetricInput): Promise<void> {
    try {
      const collection = await this.getCollection();
      await collection.insertOne(metric);
    } catch {
      throw new FoodaException(
        FoodaExceptionCodes.Ex4002,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getTenantSummary(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<TenantUsageSummary> {
    try {
      const collection = await this.getCollection();
      const rows = await collection
        .find({
          tenantId,
          createdAt: { $gte: from, $lte: to },
        })
        .toArray();

      const summaryByProvider = new Map<
        string,
        { executions: number; estimatedCostUsd: number }
      >();

      for (const row of rows) {
        const current = summaryByProvider.get(row.provider) ?? {
          executions: 0,
          estimatedCostUsd: 0,
        };
        current.executions += 1;
        current.estimatedCostUsd += row.estimatedCostUsd;
        summaryByProvider.set(row.provider, current);
      }

      return {
        tenantId,
        from: from.toISOString(),
        to: to.toISOString(),
        executions: rows.length,
        estimatedInputTokens: rows.reduce(
          (accumulator, row) => accumulator + row.estimatedInputTokens,
          0,
        ),
        estimatedOutputTokens: rows.reduce(
          (accumulator, row) => accumulator + row.estimatedOutputTokens,
          0,
        ),
        estimatedCostUsd: rows.reduce(
          (accumulator, row) => accumulator + row.estimatedCostUsd,
          0,
        ),
        byProvider: Array.from(summaryByProvider.entries()).map(
          ([provider, values]) => ({
            provider:
              provider as TenantUsageSummary['byProvider'][number]['provider'],
            executions: values.executions,
            estimatedCostUsd: values.estimatedCostUsd,
          }),
        ),
      };
    } catch {
      throw new FoodaException(
        FoodaExceptionCodes.Ex4002,
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

  private async getCollection(): Promise<Collection<UsageMetricDocument>> {
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
      .collection<UsageMetricDocument>('ia_usage_metrics');

    if (!this.indexesEnsured) {
      await this.collection.createIndex({ tenantId: 1, createdAt: -1 });
      await this.collection.createIndex({ provider: 1, createdAt: -1 });
      this.indexesEnsured = true;
    }

    return this.collection;
  }
}
