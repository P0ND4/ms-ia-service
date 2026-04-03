import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecuteAgentUseCase } from 'src/contexts/ia/application/ia/execute-agent.use-case';
import { FoodaExceptionCodes } from 'src/contexts/shared/domain/exceptions/ia-exception.codes';
import { FoodaException } from 'src/contexts/shared/domain/exceptions/ia.exception';

function createStreamChunks(chunks: Array<{ content: string; index: number }>) {
  return (async function* () {
    for (const chunk of chunks) {
      yield {
        ...chunk,
        provider: 'openai-compatible' as const,
        model: 'gpt-4.1-mini',
      };
    }
  })();
}

describe('ExecuteAgentUseCase', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'IA_SESSION_MEMORY_LIMIT') return 4;
      if (key === 'IA_DEFAULT_INPUT_COST_PER_1K_TOKENS_USD') return 0.0015;
      if (key === 'IA_DEFAULT_OUTPUT_COST_PER_1K_TOKENS_USD') return 0.002;
      return undefined;
    }),
  } as unknown as ConfigService;

  const tenantAgentConfigRepository = {
    getTenantAgentConfig: jest.fn(),
  };

  const toolRegistry = {
    executeTools: jest.fn(),
  };

  const modelAdapter = {
    generateResponse: jest.fn(),
    streamResponse: jest.fn(),
  };

  const guardrailPolicy = {
    evaluateInput: jest.fn(),
    evaluateOutput: jest.fn(),
  };

  const sessionMemoryRepository = {
    getRecentTurns: jest.fn(),
    appendTurn: jest.fn(),
  };

  const traceRepository = {
    create: jest.fn(),
  };

  const usageMetricsRepository = {
    record: jest.fn(),
    getTenantSummary: jest.fn(),
  };

  let useCase: ExecuteAgentUseCase;

  beforeEach(() => {
    jest.clearAllMocks();

    tenantAgentConfigRepository.getTenantAgentConfig.mockResolvedValue({
      tenantId: 'acme',
      agentId: 'ops-agent',
      systemPrompt: 'Responde breve',
      enabledTools: ['clock.now'],
      model: {
        provider: 'openai-compatible',
        model: 'gpt-4.1-mini',
        temperature: 0.2,
        fallbackProviders: ['mock-local'],
        providerModels: {
          'mock-local': 'mock-local-v1',
        },
      },
    });

    toolRegistry.executeTools.mockResolvedValue([
      {
        name: 'clock.now',
        status: 'success',
        output: '2026-01-01T00:00:00.000Z',
        durationMs: 1,
      },
    ]);

    modelAdapter.generateResponse.mockResolvedValue({
      provider: 'openai-compatible',
      model: 'gpt-4.1-mini',
      response: '{"ok":true}',
      latencyMs: 10,
    });

    modelAdapter.streamResponse.mockImplementation(() =>
      createStreamChunks([
        { content: '{"ok":', index: 0 },
        { content: 'true}', index: 1 },
      ]),
    );

    guardrailPolicy.evaluateInput.mockResolvedValue({
      allowed: true,
      reasons: [],
      policyVersion: 'v2-default-guardrail',
    });
    guardrailPolicy.evaluateOutput.mockResolvedValue({
      allowed: true,
      reasons: [],
      policyVersion: 'v2-default-guardrail',
    });

    sessionMemoryRepository.getRecentTurns.mockResolvedValue([]);
    sessionMemoryRepository.appendTurn.mockResolvedValue(undefined);

    traceRepository.create.mockImplementation(async (trace: any) => ({
      id: 'trace-1',
      ...trace,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    usageMetricsRepository.record.mockResolvedValue(undefined);
    usageMetricsRepository.getTenantSummary.mockResolvedValue({
      tenantId: 'acme',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
      executions: 3,
      estimatedInputTokens: 100,
      estimatedOutputTokens: 200,
      estimatedCostUsd: 0.33,
      byProvider: [
        {
          provider: 'openai-compatible',
          executions: 3,
          estimatedCostUsd: 0.33,
        },
      ],
    });

    useCase = new ExecuteAgentUseCase(
      configService,
      tenantAgentConfigRepository as any,
      toolRegistry as any,
      modelAdapter as any,
      guardrailPolicy as any,
      sessionMemoryRepository as any,
      traceRepository as any,
      usageMetricsRepository as any,
    );
  });

  it('executes sync flow and persists trace and metrics', async () => {
    const output = await useCase.execute({
      tenantId: 'acme',
      agentId: 'ops-agent',
      goal: 'Resume estado del incidente',
      context: { region: 'mx' },
    });

    expect(output.tenantId).toBe('acme');
    expect(output.provider).toBe('openai-compatible');
    expect(output.toolsExecuted).toEqual(['clock.now']);
    expect(sessionMemoryRepository.appendTurn).toHaveBeenCalledTimes(2);
    expect(traceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        executionMode: 'sync',
        status: 'completed',
      }),
    );
    expect(usageMetricsRepository.record).toHaveBeenCalledTimes(1);
  });

  it('applies options override for providers, model, temperature and tools', async () => {
    await useCase.execute({
      tenantId: 'acme',
      agentId: 'ops-agent',
      goal: 'Resumen',
      options: {
        provider: 'deepseek-compatible',
        fallbackProviders: ['mock-local', 'deepseek-compatible', 'unknown'],
        model: 'x-model',
        temperature: 0.7,
        tools: ['context.echo', '  '],
      },
    });

    const modelInput = modelAdapter.generateResponse.mock.calls[0][0];
    expect(modelInput.modelTargets).toEqual([
      {
        provider: 'deepseek-compatible',
        model: 'x-model',
        temperature: 0.7,
      },
      {
        provider: 'mock-local',
        model: 'mock-local-v1',
        temperature: 0.7,
      },
    ]);

    expect(toolRegistry.executeTools).toHaveBeenCalledWith(
      expect.objectContaining({ toolNames: ['context.echo'] }),
    );
  });

  it('throws IA-2000 when tenant config does not exist', async () => {
    tenantAgentConfigRepository.getTenantAgentConfig.mockResolvedValueOnce(
      null,
    );

    await expect(
      useCase.execute({
        tenantId: 'acme',
        agentId: 'missing-agent',
        goal: 'test',
      }),
    ).rejects.toMatchObject({ code: FoodaExceptionCodes.Ex2000.code });
  });

  it('throws IA-3000 when input guardrail blocks request', async () => {
    guardrailPolicy.evaluateInput.mockResolvedValueOnce({
      allowed: false,
      reasons: ['password'],
      policyVersion: 'v2-default-guardrail',
    });

    await expect(
      useCase.execute({
        tenantId: 'acme',
        agentId: 'ops-agent',
        goal: 'mi password es 123',
      }),
    ).rejects.toMatchObject({ code: FoodaExceptionCodes.Ex3000.code });
  });

  it('maps provider errors to IA-4000', async () => {
    modelAdapter.generateResponse.mockRejectedValueOnce(
      new Error('provider down'),
    );

    await expect(
      useCase.execute({
        tenantId: 'acme',
        agentId: 'ops-agent',
        goal: 'test',
      }),
    ).rejects.toMatchObject({ code: FoodaExceptionCodes.Ex4000.code });
  });

  it('streams events and emits done event', async () => {
    const events = [] as any[];

    for await (const event of useCase.executeStream({
      tenantId: 'acme',
      agentId: 'ops-agent',
      goal: 'stream',
    })) {
      events.push(event);
    }

    expect(events[0].type).toBe('meta');
    expect(events.some((event) => event.type === 'chunk')).toBe(true);
    expect(events[events.length - 1].type).toBe('done');
    expect(traceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        executionMode: 'stream',
        status: 'completed',
      }),
    );
  });

  it('creates failed trace and throws IA-4000 when stream provider fails', async () => {
    modelAdapter.streamResponse.mockImplementationOnce(
      (): AsyncIterable<any> => {
        throw new Error('stream down');
      },
    );

    const collect = async () => {
      for await (const event of useCase.executeStream({
        tenantId: 'acme',
        agentId: 'ops-agent',
        goal: 'stream',
      })) {
        void event;
        // consume
      }
    };

    await expect(collect()).rejects.toMatchObject({
      code: FoodaExceptionCodes.Ex4000.code,
      getStatus: expect.any(Function),
    });

    const traceCall = traceRepository.create.mock.calls.find(
      ([payload]: any[]) => payload.status === 'failed',
    );
    expect(traceCall).toBeDefined();
  });

  it('throws IA-1015 when metrics from date is invalid', async () => {
    await expect(
      useCase.getTenantMetrics({ tenantId: 'acme', from: 'invalid-date' }),
    ).rejects.toMatchObject({
      code: FoodaExceptionCodes.Ex1015.code,
      getStatus: expect.any(Function),
    });
  });

  it('returns tenant metrics summary', async () => {
    const summary = await useCase.getTenantMetrics({
      tenantId: 'acme',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
    });

    expect(summary).toEqual(
      expect.objectContaining({
        tenantId: 'acme',
        executions: 3,
        estimatedCostUsd: 0.33,
      }),
    );
  });

  it('keeps original FoodaException from provider errors', async () => {
    const providerError = new FoodaException(
      FoodaExceptionCodes.Ex3002,
      HttpStatus.BAD_REQUEST,
    );

    modelAdapter.generateResponse.mockRejectedValueOnce(providerError);

    await expect(
      useCase.execute({
        tenantId: 'acme',
        agentId: 'ops-agent',
        goal: 'test',
      }),
    ).rejects.toBe(providerError);
  });
});
