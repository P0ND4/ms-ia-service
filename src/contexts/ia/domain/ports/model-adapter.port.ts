import { ToolExecutionResult } from './tool-registry.port';
import type { SessionMemoryTurn } from 'src/contexts/ia/domain/repositories';
import type { IaProvider } from 'src/contexts/ia/domain/repositories';

export const MODEL_PROVIDER_SET = 'MODEL_PROVIDER_SET';

export interface ModelTarget {
  provider: IaProvider;
  model: string;
  temperature: number;
}

export interface GenerateModelResponseInput {
  tenantId: string;
  agentId: string;
  goal: string;
  context?: Record<string, unknown>;
  systemPrompt?: string;
  modelTargets: ModelTarget[];
  toolResults: ToolExecutionResult[];
  sessionMemory: SessionMemoryTurn[];
}

export interface GenerateModelResponseOutput {
  provider: IaProvider;
  model: string;
  response: string;
  latencyMs: number;
}

export interface StreamModelResponseChunk {
  content: string;
  index: number;
  provider: IaProvider;
  model: string;
}

export interface GenerateModelProviderInput {
  tenantId: string;
  agentId: string;
  goal: string;
  context?: Record<string, unknown>;
  systemPrompt?: string;
  toolResults: ToolExecutionResult[];
  sessionMemory: SessionMemoryTurn[];
  target: ModelTarget;
}

export abstract class IModelProviderAdapter {
  abstract readonly provider: IaProvider;
  abstract generateResponse(
    input: GenerateModelProviderInput,
  ): Promise<GenerateModelResponseOutput>;
  abstract streamResponse(
    input: GenerateModelProviderInput,
  ): AsyncIterable<StreamModelResponseChunk>;
}

export abstract class IModelAdapter {
  abstract generateResponse(
    input: GenerateModelResponseInput,
  ): Promise<GenerateModelResponseOutput>;

  abstract streamResponse(
    input: GenerateModelResponseInput,
  ): AsyncIterable<StreamModelResponseChunk>;
}
