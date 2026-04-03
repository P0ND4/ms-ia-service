export interface ExecuteAgentOptions {
  provider?: string;
  fallbackProviders?: string[];
  model?: string;
  temperature?: number;
  tools?: string[];
  metadata?: Record<string, unknown>;
}

export interface ExecuteAgentInput {
  tenantId: string;
  agentId: string;
  sessionId?: string;
  goal: string;
  context?: Record<string, unknown>;
  options?: ExecuteAgentOptions;
}

export interface ExecuteAgentOutput {
  executionId: string;
  traceId: string;
  tenantId: string;
  agentId: string;
  sessionId: string;
  response: string;
  provider: string;
  model: string;
  toolsExecuted: string[];
  createdAt: string;
}

export interface ExecuteAgentStreamEvent {
  type: 'meta' | 'chunk' | 'done';
  executionId: string;
  sessionId: string;
  data: Record<string, unknown>;
}

export interface GetTenantMetricsOutput {
  tenantId: string;
  from: string;
  to: string;
  executions: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  byProvider: Array<{
    provider: string;
    executions: number;
    estimatedCostUsd: number;
  }>;
}

export abstract class IExecuteAgentUseCase {
  abstract execute(input: ExecuteAgentInput): Promise<ExecuteAgentOutput>;
  abstract executeStream(
    input: ExecuteAgentInput,
  ): AsyncIterable<ExecuteAgentStreamEvent>;
  abstract getTenantMetrics(input: {
    tenantId: string;
    from?: string;
    to?: string;
  }): Promise<GetTenantMetricsOutput>;
}
