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
export class MockLocalProviderAdapter implements IModelProviderAdapter {
  readonly provider: IaProvider = 'mock-local';

  constructor(private readonly configService: ConfigService) {}

  async generateResponse(
    input: GenerateModelProviderInput,
  ): Promise<GenerateModelResponseOutput> {
    this.assertProviderAvailability(this.provider);

    const startedAt = Date.now();

    const contextKeys = Object.keys(input.context ?? {});
    const memorySize = input.sessionMemory.length;
    const successfulTools = input.toolResults
      .filter((tool) => tool.status === 'success')
      .map((tool) => tool.name);

    const responseSections: string[] = [];
    responseSections.push(`Objetivo: ${input.goal}`);

    if (input.systemPrompt)
      responseSections.push(`Directiva del agente: ${input.systemPrompt}`);

    responseSections.push(
      `Contexto recibido: ${contextKeys.length > 0 ? contextKeys.join(', ') : 'sin contexto'}`,
    );
    responseSections.push(`Memoria de sesion: ${memorySize} turnos recientes`);

    responseSections.push(
      `Tools ejecutadas: ${successfulTools.length > 0 ? successfulTools.join(', ') : 'ninguna'}`,
    );

    responseSections.push(
      'Respuesta mock-local: esta salida valida el pipeline de orquestacion Phase 1.',
    );

    return {
      provider: this.provider,
      model: input.target.model,
      response: responseSections.join(' | '),
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
