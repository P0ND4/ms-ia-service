import {
  GenerateModelProviderInput,
  GenerateModelResponseInput,
  IModelProviderAdapter,
} from 'src/contexts/ia/domain/ports';
import { FallbackModelRouterAdapter } from 'src/contexts/ia/infrastructure/adapters/fallback-model-router.adapter';

function stream(values: string[]) {
  return (async function* () {
    for (let index = 0; index < values.length; index += 1) {
      yield {
        content: values[index],
        index,
        provider: 'mock-local' as const,
        model: 'm1',
      };
    }
  })();
}

describe('FallbackModelRouterAdapter', () => {
  const baseInput: GenerateModelResponseInput = {
    tenantId: 'acme',
    agentId: 'ops-agent',
    goal: 'resumir incidente',
    context: { severity: 'high' },
    systemPrompt: 'sistema',
    modelTargets: [
      {
        provider: 'openai-compatible',
        model: 'gpt-4.1-mini',
        temperature: 0.1,
      },
      { provider: 'mock-local', model: 'mock-local-v1', temperature: 0.1 },
    ],
    toolResults: [],
    sessionMemory: [],
  };

  it('returns first successful provider response', async () => {
    const failingProvider: IModelProviderAdapter = {
      provider: 'openai-compatible',
      generateResponse: jest.fn(async () => {
        throw new Error('down');
      }),
      streamResponse: jest.fn(() => stream(['x'])),
    };

    const successProvider: IModelProviderAdapter = {
      provider: 'mock-local',
      generateResponse: jest.fn(async (input: GenerateModelProviderInput) => ({
        provider: 'mock-local' as const,
        model: input.target.model,
        response: 'ok',
        latencyMs: 10,
      })),
      streamResponse: jest.fn(() => stream(['a', 'b'])),
    };

    const adapter = new FallbackModelRouterAdapter([
      failingProvider,
      successProvider,
    ]);

    const output = await adapter.generateResponse(baseInput);

    expect(output.provider).toBe('mock-local');
    expect(output.response).toBe('ok');
    expect(successProvider.generateResponse).toHaveBeenCalledTimes(1);
  });

  it('throws aggregated error when all providers fail in sync mode', async () => {
    const adapter = new FallbackModelRouterAdapter([
      {
        provider: 'openai-compatible',
        generateResponse: jest.fn(async () => {
          throw new Error('timeout');
        }),
        streamResponse: jest.fn(() => stream(['x'])),
      },
    ]);

    await expect(adapter.generateResponse(baseInput)).rejects.toThrow(
      'Fallback agotado',
    );
  });

  it('streams chunks from successful fallback provider', async () => {
    const adapter = new FallbackModelRouterAdapter([
      {
        provider: 'openai-compatible',
        generateResponse: jest.fn(async () => ({
          provider: 'openai-compatible' as const,
          model: 'gpt',
          response: 'ok',
          latencyMs: 1,
        })),
        streamResponse: jest.fn((): AsyncIterable<any> => {
          throw new Error('down');
        }),
      },
      {
        provider: 'mock-local',
        generateResponse: jest.fn(async () => ({
          provider: 'mock-local' as const,
          model: 'm1',
          response: 'ok',
          latencyMs: 1,
        })),
        streamResponse: jest.fn(() => stream(['uno ', 'dos'])),
      },
    ]);

    const chunks: string[] = [];
    for await (const chunk of adapter.streamResponse(baseInput)) {
      chunks.push(chunk.content);
    }

    expect(chunks.join('')).toBe('uno dos');
  });

  it('throws aggregated error when all providers fail in stream mode', async () => {
    const adapter = new FallbackModelRouterAdapter([
      {
        provider: 'openai-compatible',
        generateResponse: jest.fn(async () => ({
          provider: 'openai-compatible' as const,
          model: 'gpt',
          response: 'ok',
          latencyMs: 1,
        })),
        streamResponse: jest.fn((): AsyncIterable<any> => {
          throw new Error('down');
        }),
      },
    ]);

    const run = async () => {
      for await (const chunk of adapter.streamResponse(baseInput)) {
        void chunk;
        // consume
      }
    };

    await expect(run()).rejects.toThrow('Fallback streaming agotado');
  });
});
