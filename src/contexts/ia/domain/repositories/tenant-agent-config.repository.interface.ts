export type IaProvider =
  | 'mock-local'
  | 'openai-compatible'
  | 'deepseek-compatible'
  | 'cloud-generic';

export interface TenantAgentModelConfig {
  provider: IaProvider;
  model: string;
  temperature: number;
  maxTokens?: number;
  fallbackProviders: IaProvider[];
  providerModels?: Partial<Record<IaProvider, string>>;
}

export interface AgentTemplateConfig {
  id: string;
  systemPrompt?: string;
  enabledTools: string[];
  model: TenantAgentModelConfig;
}

export interface TenantAgentConfig {
  tenantId: string;
  agentId: string;
  templateId?: string;
  systemPrompt?: string;
  enabledTools: string[];
  model: TenantAgentModelConfig;
}

export abstract class ITenantAgentConfigRepository {
  abstract getTenantAgentConfig(
    tenantId: string,
    agentId: string,
  ): Promise<TenantAgentConfig | null>;
}
