export interface ExecuteToolsInput {
  tenantId: string;
  agentId: string;
  goal: string;
  context?: Record<string, unknown>;
  toolNames: string[];
}

export interface ToolExecutionResult {
  name: string;
  status: 'success' | 'error';
  output: string;
  durationMs: number;
}

export abstract class IToolRegistry {
  abstract executeTools(
    input: ExecuteToolsInput,
  ): Promise<ToolExecutionResult[]>;
}
