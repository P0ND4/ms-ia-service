import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GenerateModelProviderInput,
  GenerateModelResponseOutput,
  IModelProviderAdapter,
  StreamModelResponseChunk,
} from 'src/contexts/ia/domain/ports';
import { IaProvider } from 'src/contexts/ia/domain/repositories';

@Injectable()
export class OpenAiCompatibleProviderAdapter implements IModelProviderAdapter {
  readonly provider: IaProvider = 'openai-compatible';

  constructor(private readonly configService: ConfigService) {}

  async generateResponse(
    input: GenerateModelProviderInput,
  ): Promise<GenerateModelResponseOutput> {
    this.assertProviderAvailability(this.provider);

    const startedAt = Date.now();
    const summary = [
      `Provider: ${this.provider}`,
      `Modelo: ${input.target.model}`,
      `Objetivo: ${input.goal}`,
      `Memoria: ${input.sessionMemory.length} turnos`,
      'Respuesta sintetica orientada a operaciones internas.',
    ].join(' | ');

    return {
      provider: this.provider,
      model: input.target.model,
      response: summary,
      latencyMs: Date.now() - startedAt,
    };
  }

  async *streamResponse(
    input: GenerateModelProviderInput,
  ): AsyncIterable<StreamModelResponseChunk> {
    const full = await this.generateResponse(input);
    const chunks = full.response.split(' ');

    for (let index = 0; index < chunks.length; index += 1) {
      yield {
        content: `${chunks[index]}${index === chunks.length - 1 ? '' : ' '}`,
        index,
        provider: this.provider,
        model: input.target.model,
      };
    }
  }

  private assertProviderAvailability(provider: IaProvider): void {
    const failureListRaw =
      this.configService.get<string>('IA_SIMULATE_PROVIDER_FAILURES') ?? '';
    const failureList = failureListRaw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (failureList.includes(provider)) {
      throw new Error(`Proveedor ${provider} simulado como no disponible`);
    }
  }
}
