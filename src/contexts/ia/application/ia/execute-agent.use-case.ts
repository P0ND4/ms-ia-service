import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  GenerateModelResponseInput,
  GenerateModelResponseOutput,
  GuardrailEvaluation,
  IGuardrailPolicy,
  IModelAdapter,
  IToolRegistry,
  ModelTarget,
} from 'src/contexts/ia/domain/ports';
import {
  IAgentExecutionTraceRepository,
  IaProvider,
  ISessionMemoryRepository,
  ITenantAgentConfigRepository,
  IUsageMetricsRepository,
} from 'src/contexts/ia/domain/repositories';
import type {
  ExecuteAgentInput,
  ExecuteAgentOutput,
  ExecuteAgentStreamEvent,
  GetTenantMetricsOutput,
} from 'src/contexts/ia/domain/use-cases/ia/execute-agent.use-case.interface';
import { IExecuteAgentUseCase } from 'src/contexts/ia/domain/use-cases/ia/execute-agent.use-case.interface';
import { FoodaExceptionCodes } from 'src/contexts/shared/domain/exceptions/ia-exception.codes';
import { FoodaException } from 'src/contexts/shared/domain/exceptions/ia.exception';

interface PreparedExecution {
  toolResults: Array<{
    name: string;
    status: 'success' | 'error';
    output: string;
    durationMs: number;
  }>;
  modelInput: GenerateModelResponseInput;
}

interface ResolvedProviderModel {
  provider: IaProvider;
  model: string;
}

@Injectable()
export class ExecuteAgentUseCase implements IExecuteAgentUseCase {
  constructor(
    private readonly configService: ConfigService,
    private readonly tenantAgentConfigRepository: ITenantAgentConfigRepository,
    private readonly toolRegistry: IToolRegistry,
    private readonly modelAdapter: IModelAdapter,
    private readonly guardrailPolicy: IGuardrailPolicy,
    private readonly sessionMemoryRepository: ISessionMemoryRepository,
    private readonly traceRepository: IAgentExecutionTraceRepository,
    private readonly usageMetricsRepository: IUsageMetricsRepository,
  ) {}

  async execute(input: ExecuteAgentInput): Promise<ExecuteAgentOutput> {
    const executionId = randomUUID();
    const sessionId = this.resolveSessionId(input);
    const startedAt = new Date();

    const prepared = await this.prepareExecution(input, sessionId);
    const modelResult = await this.generateWithFallback(prepared.modelInput);
    await this.assertOutputAllowed(input, modelResult.response);

    const finishedAt = new Date();

    const trace = await this.persistSuccessfulExecution({
      executionId,
      executionMode: 'sync',
      input,
      sessionId,
      prepared,
      startedAt,
      finishedAt,
      response: modelResult.response,
      provider: modelResult.provider,
      model: modelResult.model,
      assistantMetadata: {
        provider: modelResult.provider,
        model: modelResult.model,
      },
    });

    return {
      executionId,
      traceId: trace.id,
      tenantId: input.tenantId,
      agentId: input.agentId,
      sessionId,
      response: modelResult.response,
      provider: modelResult.provider,
      model: modelResult.model,
      toolsExecuted: prepared.toolResults.map((tool) => tool.name),
      createdAt: finishedAt.toISOString(),
    };
  }

  async *executeStream(
    input: ExecuteAgentInput,
  ): AsyncIterable<ExecuteAgentStreamEvent> {
    const executionId = randomUUID();
    const sessionId = this.resolveSessionId(input);
    const startedAt = new Date();
    const prepared = await this.prepareExecution(input, sessionId);

    const fallbackChain = prepared.modelInput.modelTargets.map((target) => {
      return target.provider;
    });

    yield {
      type: 'meta',
      executionId,
      sessionId,
      data: {
        tenantId: input.tenantId,
        agentId: input.agentId,
        provider: prepared.modelInput.modelTargets[0]?.provider,
        model: prepared.modelInput.modelTargets[0]?.model,
        fallbackChain,
      },
    };

    let fullResponse = '';
    let selectedProvider = prepared.modelInput.modelTargets[0]?.provider;
    let selectedModel = prepared.modelInput.modelTargets[0]?.model;

    try {
      for await (const chunk of this.modelAdapter.streamResponse(
        prepared.modelInput,
      )) {
        fullResponse += chunk.content;
        selectedProvider = chunk.provider;
        selectedModel = chunk.model;

        yield {
          type: 'chunk',
          executionId,
          sessionId,
          data: {
            index: chunk.index,
            content: chunk.content,
            provider: chunk.provider,
            model: chunk.model,
          },
        };
      }

      await this.assertOutputAllowed(input, fullResponse);
      const finishedAt = new Date();

      const resolved = this.resolveProviderAndModel(
        selectedProvider,
        selectedModel,
        prepared,
      );

      const trace = await this.persistSuccessfulExecution({
        executionId,
        executionMode: 'stream',
        input,
        sessionId,
        prepared,
        startedAt,
        finishedAt,
        response: fullResponse,
        provider: resolved.provider,
        model: resolved.model,
        assistantMetadata: {
          provider: selectedProvider,
          model: selectedModel,
          mode: 'stream',
        },
      });

      yield {
        type: 'done',
        executionId,
        sessionId,
        data: {
          traceId: trace.id,
          toolsExecuted: prepared.toolResults.map((tool) => tool.name),
          createdAt: finishedAt.toISOString(),
          provider: selectedProvider,
          model: selectedModel,
        },
      };
    } catch (error) {
      const finishedAt = new Date();
      const normalizedError = this.normalizeProviderError(error);
      const message = normalizedError.message;

      const resolved = this.resolveProviderAndModel(
        selectedProvider,
        selectedModel,
        prepared,
      );

      await this.createTrace({
        executionId,
        executionMode: 'stream',
        input,
        prepared,
        provider: resolved.provider,
        model: resolved.model,
        response: fullResponse,
        startedAt,
        finishedAt,
        status: 'failed',
        errorMessage: message,
      });

      throw normalizedError;
    }
  }

  async getTenantMetrics(input: {
    tenantId: string;
    from?: string;
    to?: string;
  }): Promise<GetTenantMetricsOutput> {
    const now = new Date();
    const to = input.to
      ? this.parseDate(input.to, FoodaExceptionCodes.Ex1016)
      : now;
    const from = input.from
      ? this.parseDate(input.from, FoodaExceptionCodes.Ex1015)
      : new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const summary = await this.usageMetricsRepository.getTenantSummary(
      input.tenantId,
      from,
      to,
    );

    return {
      tenantId: summary.tenantId,
      from: summary.from,
      to: summary.to,
      executions: summary.executions,
      estimatedInputTokens: summary.estimatedInputTokens,
      estimatedOutputTokens: summary.estimatedOutputTokens,
      estimatedCostUsd: summary.estimatedCostUsd,
      byProvider: summary.byProvider,
    };
  }

  private async prepareExecution(
    input: ExecuteAgentInput,
    sessionId: string,
  ): Promise<PreparedExecution> {
    await this.assertInputAllowed(input);

    const tenantAgentConfig =
      await this.tenantAgentConfigRepository.getTenantAgentConfig(
        input.tenantId,
        input.agentId,
      );

    if (!tenantAgentConfig) {
      throw new FoodaException(
        FoodaExceptionCodes.Ex2000,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.sessionMemoryRepository.appendTurn({
      tenantId: input.tenantId,
      sessionId,
      turn: {
        role: 'user',
        content: input.goal,
        createdAt: new Date(),
        metadata: {
          context: input.context,
        },
      },
    });

    const memoryLimit =
      this.configService.get<number>('IA_SESSION_MEMORY_LIMIT') ?? 12;
    const sessionMemory = await this.sessionMemoryRepository.getRecentTurns(
      input.tenantId,
      sessionId,
      memoryLimit,
    );

    const selectedModel =
      this.resolveStringOption(input.options, 'model') ??
      tenantAgentConfig.model.model;
    const selectedTemperature =
      this.resolveNumberOption(input.options, 'temperature') ??
      tenantAgentConfig.model.temperature;
    const selectedProvider =
      this.resolveProviderOption(input.options?.provider) ??
      tenantAgentConfig.model.provider;
    const selectedFallbackProviders =
      this.resolveProviderListOption(input.options?.fallbackProviders) ??
      tenantAgentConfig.model.fallbackProviders;

    const providerChain = [
      selectedProvider,
      ...selectedFallbackProviders,
    ].filter((provider, index, self) => self.indexOf(provider) === index);

    const modelTargets: ModelTarget[] = providerChain.map((provider) => {
      const providerModel =
        tenantAgentConfig.model.providerModels?.[provider] ?? selectedModel;

      return {
        provider,
        model: providerModel,
        temperature: selectedTemperature,
      };
    });

    const requestedTools =
      this.resolveToolsOption(input.options) ?? tenantAgentConfig.enabledTools;

    const toolResults = await this.toolRegistry.executeTools({
      tenantId: input.tenantId,
      agentId: input.agentId,
      goal: input.goal,
      context: input.context,
      toolNames: requestedTools,
    });

    return {
      toolResults,
      modelInput: {
        tenantId: input.tenantId,
        agentId: input.agentId,
        goal: input.goal,
        context: input.context,
        systemPrompt: tenantAgentConfig.systemPrompt,
        modelTargets,
        toolResults,
        sessionMemory,
      },
    };
  }

  private async generateWithFallback(
    modelInput: GenerateModelResponseInput,
  ): Promise<GenerateModelResponseOutput> {
    try {
      return await this.modelAdapter.generateResponse(modelInput);
    } catch (error) {
      throw this.normalizeProviderError(error);
    }
  }

  private async assertInputAllowed(input: ExecuteAgentInput): Promise<void> {
    const evaluation = await this.guardrailPolicy.evaluateInput({
      tenantId: input.tenantId,
      agentId: input.agentId,
      goal: input.goal,
      context: input.context,
    });

    this.throwIfGuardrailBlocked(evaluation, FoodaExceptionCodes.Ex3000);
  }

  private async assertOutputAllowed(
    input: ExecuteAgentInput,
    response: string,
  ): Promise<void> {
    const evaluation = await this.guardrailPolicy.evaluateOutput({
      tenantId: input.tenantId,
      agentId: input.agentId,
      goal: input.goal,
      context: input.context,
      response,
    });

    this.throwIfGuardrailBlocked(evaluation, FoodaExceptionCodes.Ex3001);
  }

  private throwIfGuardrailBlocked(
    evaluation: GuardrailEvaluation,
    code: typeof FoodaExceptionCodes.Ex3000,
  ): void {
    if (evaluation.allowed) return;

    throw new FoodaException(code, HttpStatus.FORBIDDEN);
  }

  private resolveSessionId(input: ExecuteAgentInput): string {
    if (input.sessionId && input.sessionId.trim().length > 0) {
      return input.sessionId.trim();
    }

    return `${input.tenantId}:${input.agentId}:default`;
  }

  private resolveStringOption(
    options: ExecuteAgentInput['options'],
    key: 'model',
  ): string | undefined {
    const value = options?.[key];
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined;
  }

  private resolveNumberOption(
    options: ExecuteAgentInput['options'],
    key: 'temperature',
  ): number | undefined {
    const value = options?.[key];
    return typeof value === 'number' ? value : undefined;
  }

  private resolveToolsOption(
    options: ExecuteAgentInput['options'],
  ): string[] | undefined {
    if (!Array.isArray(options?.tools)) return undefined;

    const normalized = options.tools
      .filter((toolName): toolName is string => typeof toolName === 'string')
      .map((toolName) => toolName.trim())
      .filter((toolName) => toolName.length > 0);

    return normalized;
  }

  private resolveProviderOption(
    provider: string | undefined,
  ): IaProvider | undefined {
    if (!provider) return undefined;
    return this.isProvider(provider) ? provider : undefined;
  }

  private resolveProviderListOption(
    providers: string[] | undefined,
  ): IaProvider[] | undefined {
    if (!Array.isArray(providers)) return undefined;

    return providers
      .filter((provider): provider is IaProvider => this.isProvider(provider))
      .filter((provider, index, self) => self.indexOf(provider) === index);
  }

  private isProvider(value: string): value is IaProvider {
    return (
      value === 'mock-local' ||
      value === 'openai-compatible' ||
      value === 'deepseek-compatible' ||
      value === 'cloud-generic'
    );
  }

  private ensureProvider(provider: IaProvider | undefined): IaProvider {
    return provider ?? 'mock-local';
  }

  private normalizeProviderError(error: unknown): FoodaException {
    if (error instanceof FoodaException) return error;
    return new FoodaException(
      FoodaExceptionCodes.Ex4000,
      HttpStatus.BAD_GATEWAY,
    );
  }

  private parseDate(
    value: string,
    code: typeof FoodaExceptionCodes.Ex1015,
  ): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new FoodaException(code, HttpStatus.BAD_REQUEST);
    }
    return parsed;
  }

  private async recordUsageMetric(input: {
    executionId: string;
    tenantId: string;
    agentId: string;
    sessionId: string;
    executionMode: 'sync' | 'stream';
    provider: IaProvider;
    model: string;
    goal: string;
    response: string;
    startedAt: Date;
    finishedAt: Date;
  }): Promise<void> {
    const promptChars = input.goal.length;
    const responseChars = input.response.length;
    const estimatedInputTokens = this.estimateTokens(promptChars);
    const estimatedOutputTokens = this.estimateTokens(responseChars);
    const estimatedCostUsd = this.estimateCostUsd(
      estimatedInputTokens,
      estimatedOutputTokens,
    );

    await this.usageMetricsRepository.record({
      executionId: input.executionId,
      tenantId: input.tenantId,
      agentId: input.agentId,
      sessionId: input.sessionId,
      executionMode: input.executionMode,
      provider: input.provider,
      model: input.model,
      latencyMs: input.finishedAt.getTime() - input.startedAt.getTime(),
      promptChars,
      responseChars,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCostUsd,
      createdAt: input.finishedAt,
    });
  }

  private resolveProviderAndModel(
    selectedProvider: IaProvider | undefined,
    selectedModel: string | undefined,
    prepared: PreparedExecution,
  ): ResolvedProviderModel {
    return {
      provider: this.ensureProvider(selectedProvider),
      model:
        selectedModel ??
        prepared.modelInput.modelTargets[0]?.model ??
        'unknown',
    };
  }

  private async appendAssistantTurn(input: {
    tenantId: string;
    sessionId: string;
    content: string;
    createdAt: Date;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    await this.sessionMemoryRepository.appendTurn({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      turn: {
        role: 'assistant',
        content: input.content,
        createdAt: input.createdAt,
        metadata: input.metadata,
      },
    });
  }

  private async createTrace(input: {
    executionId: string;
    executionMode: 'sync' | 'stream';
    input: ExecuteAgentInput;
    prepared: PreparedExecution;
    provider: IaProvider;
    model: string;
    response: string;
    startedAt: Date;
    finishedAt: Date;
    status: 'completed' | 'failed';
    errorMessage?: string;
  }) {
    return this.traceRepository.create({
      executionId: input.executionId,
      executionMode: input.executionMode,
      tenantId: input.input.tenantId,
      agentId: input.input.agentId,
      goal: input.input.goal,
      context: input.input.context,
      options: input.input.options as Record<string, unknown> | undefined,
      provider: input.provider,
      model: input.model,
      response: input.response,
      toolsExecuted: input.prepared.toolResults,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      status: input.status,
      errorMessage: input.errorMessage,
    });
  }

  private async persistSuccessfulExecution(input: {
    executionId: string;
    executionMode: 'sync' | 'stream';
    input: ExecuteAgentInput;
    sessionId: string;
    prepared: PreparedExecution;
    startedAt: Date;
    finishedAt: Date;
    response: string;
    provider: IaProvider;
    model: string;
    assistantMetadata: Record<string, unknown>;
  }) {
    await this.appendAssistantTurn({
      tenantId: input.input.tenantId,
      sessionId: input.sessionId,
      content: input.response,
      createdAt: input.finishedAt,
      metadata: input.assistantMetadata,
    });

    const trace = await this.createTrace({
      executionId: input.executionId,
      executionMode: input.executionMode,
      input: input.input,
      prepared: input.prepared,
      provider: input.provider,
      model: input.model,
      response: input.response,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      status: 'completed',
    });

    await this.recordUsageMetric({
      executionId: input.executionId,
      tenantId: input.input.tenantId,
      agentId: input.input.agentId,
      sessionId: input.sessionId,
      executionMode: input.executionMode,
      provider: input.provider,
      model: input.model,
      goal: input.input.goal,
      response: input.response,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
    });

    return trace;
  }

  private estimateTokens(charCount: number): number {
    return Math.max(1, Math.ceil(charCount / 4));
  }

  private estimateCostUsd(inputTokens: number, outputTokens: number): number {
    const inputRate =
      this.configService.get<number>(
        'IA_DEFAULT_INPUT_COST_PER_1K_TOKENS_USD',
      ) ?? 0.0015;
    const outputRate =
      this.configService.get<number>(
        'IA_DEFAULT_OUTPUT_COST_PER_1K_TOKENS_USD',
      ) ?? 0.002;

    return (
      (inputTokens / 1000) * inputRate + (outputTokens / 1000) * outputRate
    );
  }
}
