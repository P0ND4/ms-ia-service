import type { IaProvider } from './tenant-agent-config.repository.interface';

export interface UsageMetricInput {
  executionId: string;
  tenantId: string;
  agentId: string;
  sessionId: string;
  executionMode: 'sync' | 'stream';
  provider: IaProvider;
  model: string;
  latencyMs: number;
  promptChars: number;
  responseChars: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  createdAt: Date;
}

export interface TenantUsageSummary {
  tenantId: string;
  from: string;
  to: string;
  executions: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  byProvider: Array<{
    provider: IaProvider;
    executions: number;
    estimatedCostUsd: number;
  }>;
}

export abstract class IUsageMetricsRepository {
  abstract record(metric: UsageMetricInput): Promise<void>;
  abstract getTenantSummary(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<TenantUsageSummary>;
}
