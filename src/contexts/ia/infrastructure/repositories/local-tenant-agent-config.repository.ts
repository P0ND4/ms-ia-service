import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import {
  AgentTemplateConfig,
  IaProvider,
  ITenantAgentConfigRepository,
  TenantAgentConfig,
} from 'src/contexts/ia/domain/repositories';
import { FoodaException } from 'src/contexts/shared/domain/exceptions/ia.exception';
import { FoodaExceptionCodes } from 'src/contexts/shared/domain/exceptions/ia-exception.codes';

interface TenantAgentConfigSource {
  templates?: Record<
    string,
    {
      systemPrompt?: string;
      enabledTools?: string[];
      model?: {
        provider?: string;
        fallbackProviders?: string[];
        providerModels?: Record<string, string>;
        name?: string;
        temperature?: number;
        maxTokens?: number;
      };
    }
  >;
  tenants?: Record<
    string,
    {
      agents?: Record<
        string,
        {
          templateId?: string;
          systemPrompt?: string;
          enabledTools?: string[];
          model?: {
            provider?: string;
            fallbackProviders?: string[];
            providerModels?: Record<string, string>;
            name?: string;
            temperature?: number;
            maxTokens?: number;
          };
        }
      >;
    }
  >;
}

@Injectable()
export class LocalTenantAgentConfigRepository implements ITenantAgentConfigRepository {
  constructor(private readonly configService: ConfigService) {}

  async getTenantAgentConfig(
    tenantId: string,
    agentId: string,
  ): Promise<TenantAgentConfig | null> {
    const source = await this.readConfigSource();
    const tenant = source.tenants?.[tenantId];
    const agent = tenant?.agents?.[agentId];

    if (!agent) return null;

    const template = this.resolveTemplate(source, agent.templateId);

    return {
      tenantId,
      agentId,
      templateId: agent.templateId,
      systemPrompt: agent.systemPrompt ?? template?.systemPrompt,
      enabledTools: this.resolveTools(
        agent.enabledTools,
        template?.enabledTools,
      ),
      model: this.resolveModel(agent.model, template?.model),
    };
  }

  private resolveTemplate(
    source: TenantAgentConfigSource,
    templateId: string | undefined,
  ): AgentTemplateConfig | undefined {
    if (!templateId) return undefined;

    const template = source.templates?.[templateId];
    if (!template) {
      throw new FoodaException(
        FoodaExceptionCodes.Ex4001,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      id: templateId,
      systemPrompt: template.systemPrompt,
      enabledTools: this.resolveTools(template.enabledTools, []),
      model: this.resolveModel(template.model, undefined),
    };
  }

  private resolveTools(
    agentTools: string[] | undefined,
    templateTools: string[] | undefined,
  ): string[] {
    const source = agentTools ?? templateTools ?? [];
    return source.filter((toolName) => typeof toolName === 'string');
  }

  private resolveModel(
    agentModel:
      | {
          provider?: string;
          fallbackProviders?: string[];
          providerModels?: Record<string, string>;
          name?: string;
          temperature?: number;
          maxTokens?: number;
        }
      | undefined,
    templateModel: AgentTemplateConfig['model'] | undefined,
  ): TenantAgentConfig['model'] {
    const provider = this.normalizeProvider(
      agentModel?.provider ?? templateModel?.provider,
    );
    const fallbackProviders = this.normalizeProviderList(
      agentModel?.fallbackProviders ?? templateModel?.fallbackProviders ?? [],
    );
    const providerModelsRaw =
      agentModel?.providerModels ?? templateModel?.providerModels ?? {};
    const providerModels = this.normalizeProviderModels(providerModelsRaw);

    return {
      provider,
      fallbackProviders,
      providerModels,
      model:
        agentModel?.name ??
        templateModel?.model ??
        providerModels[provider] ??
        'mock-local-v1',
      temperature:
        typeof agentModel?.temperature === 'number'
          ? agentModel.temperature
          : (templateModel?.temperature ?? 0.2),
      maxTokens:
        typeof agentModel?.maxTokens === 'number'
          ? agentModel.maxTokens
          : templateModel?.maxTokens,
    };
  }

  private normalizeProvider(provider: string | undefined): IaProvider {
    const value = (provider ?? 'mock-local').trim();
    if (this.isValidProvider(value)) return value;
    return 'mock-local';
  }

  private normalizeProviderList(providers: string[]): IaProvider[] {
    const result: IaProvider[] = [];
    for (const provider of providers) {
      const normalized = provider.trim();
      if (!this.isValidProvider(normalized)) continue;
      if (!result.includes(normalized)) result.push(normalized);
    }
    return result;
  }

  private normalizeProviderModels(
    providerModels: Record<string, string>,
  ): Partial<Record<IaProvider, string>> {
    const result: Partial<Record<IaProvider, string>> = {};

    for (const [provider, model] of Object.entries(providerModels ?? {})) {
      if (!this.isValidProvider(provider)) continue;
      if (typeof model !== 'string' || model.trim().length === 0) continue;
      result[provider] = model.trim();
    }

    return result;
  }

  private isValidProvider(value: string): value is IaProvider {
    return (
      value === 'mock-local' ||
      value === 'openai-compatible' ||
      value === 'deepseek-compatible' ||
      value === 'cloud-generic'
    );
  }

  private async readConfigSource(): Promise<TenantAgentConfigSource> {
    const configPath = this.configService.get<string>('IA_TENANT_CONFIG_PATH');

    let fileContent: string;
    try {
      fileContent = await readFile(configPath ?? '', 'utf8');
    } catch {
      throw new FoodaException(
        FoodaExceptionCodes.Ex2001,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const parsed = JSON.parse(fileContent) as TenantAgentConfigSource;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('invalid json root');
      }
      return parsed;
    } catch {
      throw new FoodaException(
        FoodaExceptionCodes.Ex2002,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
