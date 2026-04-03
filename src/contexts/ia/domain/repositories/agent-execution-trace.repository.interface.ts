import { ToolExecutionResult } from 'src/contexts/ia/domain/ports';

export interface AgentExecutionTraceInput {
  executionId: string;
  executionMode: 'sync' | 'stream';
  tenantId: string;
  agentId: string;
  goal: string;
  context?: Record<string, unknown>;
  options?: Record<string, unknown>;
  provider: string;
  model: string;
  response: string;
  toolsExecuted: ToolExecutionResult[];
  startedAt: Date;
  finishedAt: Date;
  status: 'completed' | 'failed';
  errorMessage?: string;
}

export interface AgentExecutionTrace extends AgentExecutionTraceInput {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export abstract class IAgentExecutionTraceRepository {
  abstract create(
    trace: AgentExecutionTraceInput,
  ): Promise<AgentExecutionTrace>;
}
