import { Inject, Injectable } from '@nestjs/common';
import {
  GenerateModelProviderInput,
  GenerateModelResponseInput,
  GenerateModelResponseOutput,
  IModelAdapter,
  IModelProviderAdapter,
  MODEL_PROVIDER_SET,
  StreamModelResponseChunk,
} from 'src/contexts/ia/domain/ports';

@Injectable()
export class FallbackModelRouterAdapter implements IModelAdapter {
  constructor(
    @Inject(MODEL_PROVIDER_SET)
    private readonly providers: IModelProviderAdapter[],
  ) {}

  async generateResponse(
    input: GenerateModelResponseInput,
  ): Promise<GenerateModelResponseOutput> {
    const attempts: string[] = [];

    for (const target of input.modelTargets) {
      const provider = this.providers.find(
        (item) => item.provider === target.provider,
      );
      if (!provider) {
        attempts.push(`${target.provider}: adapter no configurado`);
        continue;
      }

      try {
        return await provider.generateResponse(
          this.toProviderInput(input, target.provider),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown';
        attempts.push(`${target.provider}: ${message}`);
      }
    }

    throw new Error(`Fallback agotado: ${attempts.join(' | ')}`);
  }

  async *streamResponse(
    input: GenerateModelResponseInput,
  ): AsyncIterable<StreamModelResponseChunk> {
    const attempts: string[] = [];

    for (const target of input.modelTargets) {
      const provider = this.providers.find(
        (item) => item.provider === target.provider,
      );
      if (!provider) {
        attempts.push(`${target.provider}: adapter no configurado`);
        continue;
      }

      try {
        for await (const chunk of provider.streamResponse(
          this.toProviderInput(input, target.provider),
        )) {
          yield chunk;
        }
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown';
        attempts.push(`${target.provider}: ${message}`);
      }
    }

    throw new Error(`Fallback streaming agotado: ${attempts.join(' | ')}`);
  }

  private toProviderInput(
    input: GenerateModelResponseInput,
    providerId: string,
  ): GenerateModelProviderInput {
    const target = input.modelTargets.find(
      (item) => item.provider === providerId,
    );
    if (!target) {
      throw new Error(
        `No existe target de modelo para proveedor ${providerId}`,
      );
    }

    return {
      tenantId: input.tenantId,
      agentId: input.agentId,
      goal: input.goal,
      context: input.context,
      systemPrompt: input.systemPrompt,
      toolResults: input.toolResults,
      sessionMemory: input.sessionMemory,
      target,
    };
  }
}
