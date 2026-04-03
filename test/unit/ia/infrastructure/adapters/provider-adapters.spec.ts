import { ConfigService } from '@nestjs/config';
import { GenerateModelProviderInput } from 'src/contexts/ia/domain/ports';
import { CloudGenericProviderAdapter } from 'src/contexts/ia/infrastructure/adapters/cloud-generic.provider.adapter';
import { DeepseekCompatibleProviderAdapter } from 'src/contexts/ia/infrastructure/adapters/deepseek-compatible.provider.adapter';
import { MockLocalProviderAdapter } from 'src/contexts/ia/infrastructure/adapters/mock-model.adapter';
import { OpenAiCompatibleProviderAdapter } from 'src/contexts/ia/infrastructure/adapters/openai-compatible.provider.adapter';

const baseInput: GenerateModelProviderInput = {
  tenantId: 'acme',
  agentId: 'ops',
  goal: 'resumir incidente',
  context: { region: 'mx' },
  systemPrompt: 'contesta breve',
  toolResults: [
    { name: 'clock.now', status: 'success', output: 'ok', durationMs: 1 },
  ],
  sessionMemory: [{ role: 'user', content: 'hola', createdAt: new Date() }],
  target: { provider: 'mock-local', model: 'mock-local-v1', temperature: 0.2 },
};

describe('Provider adapters', () => {
  let configGet: jest.Mock;
  let configService: ConfigService;

  beforeEach(() => {
    configGet = jest.fn().mockReturnValue('');
    configService = { get: configGet } as unknown as ConfigService;
  });

  it('openai-compatible generates and streams content', async () => {
    const adapter = new OpenAiCompatibleProviderAdapter(configService);
    const full = await adapter.generateResponse({
      ...baseInput,
      target: {
        provider: 'openai-compatible',
        model: 'gpt-4.1-mini',
        temperature: 0.1,
      },
    });

    expect(full.provider).toBe('openai-compatible');
    expect(full.response).toContain('Provider: openai-compatible');

    const chunks: string[] = [];
    for await (const chunk of adapter.streamResponse({
      ...baseInput,
      target: {
        provider: 'openai-compatible',
        model: 'gpt-4.1-mini',
        temperature: 0.1,
      },
    })) {
      chunks.push(chunk.content);
    }

    expect(chunks.join('')).toContain('Provider: openai-compatible');
  });

  it('deepseek-compatible generates content', async () => {
    const adapter = new DeepseekCompatibleProviderAdapter(configService);
    const full = await adapter.generateResponse({
      ...baseInput,
      target: {
        provider: 'deepseek-compatible',
        model: 'deepseek-chat',
        temperature: 0.1,
      },
    });

    expect(full.provider).toBe('deepseek-compatible');
    expect(full.response).toContain('DeepSeek');
  });

  it('cloud-generic generates content', async () => {
    const adapter = new CloudGenericProviderAdapter(configService);
    const full = await adapter.generateResponse({
      ...baseInput,
      target: {
        provider: 'cloud-generic',
        model: 'cloud-model-v1',
        temperature: 0.1,
      },
    });

    expect(full.provider).toBe('cloud-generic');
    expect(full.response).toContain('cloud-generic');
  });

  it('mock-local includes context, tools and memory in response', async () => {
    const adapter = new MockLocalProviderAdapter(configService);
    const full = await adapter.generateResponse(baseInput);

    expect(full.provider).toBe('mock-local');
    expect(full.response).toContain('Contexto recibido');
    expect(full.response).toContain('Tools ejecutadas');
    expect(full.response).toContain('Memoria de sesion');
  });

  it('throws when provider is configured as unavailable', async () => {
    configGet.mockReturnValue('openai-compatible,mock-local');

    const openai = new OpenAiCompatibleProviderAdapter(configService);
    const mock = new MockLocalProviderAdapter(configService);

    await expect(
      openai.generateResponse({
        ...baseInput,
        target: {
          provider: 'openai-compatible',
          model: 'gpt-4.1-mini',
          temperature: 0.1,
        },
      }),
    ).rejects.toThrow('simulado como no disponible');

    await expect(mock.generateResponse(baseInput)).rejects.toThrow(
      'simulado como no disponible',
    );
  });
});
