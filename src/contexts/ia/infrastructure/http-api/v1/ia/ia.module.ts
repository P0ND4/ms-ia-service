import { Module } from '@nestjs/common';
import { ExecuteAgentUseCase } from '../../../../application/ia/execute-agent.use-case';
import {
  IGuardrailPolicy,
  MODEL_PROVIDER_SET,
  IModelAdapter,
  IModelProviderAdapter,
  IToolRegistry,
} from 'src/contexts/ia/domain/ports';
import {
  IAgentExecutionTraceRepository,
  ISessionMemoryRepository,
  ITenantAgentConfigRepository,
  IUsageMetricsRepository,
} from 'src/contexts/ia/domain/repositories';
import { IExecuteAgentUseCase } from 'src/contexts/ia/domain/use-cases/ia/execute-agent.use-case.interface';
import { CloudGenericProviderAdapter } from 'src/contexts/ia/infrastructure/adapters/cloud-generic.provider.adapter';
import { DeepseekCompatibleProviderAdapter } from 'src/contexts/ia/infrastructure/adapters/deepseek-compatible.provider.adapter';
import { FallbackModelRouterAdapter } from 'src/contexts/ia/infrastructure/adapters/fallback-model-router.adapter';
import { MockLocalProviderAdapter } from 'src/contexts/ia/infrastructure/adapters/mock-model.adapter';
import { OpenAiCompatibleProviderAdapter } from 'src/contexts/ia/infrastructure/adapters/openai-compatible.provider.adapter';
import { DefaultGuardrailPolicy } from 'src/contexts/ia/infrastructure/policies/default-guardrail.policy';
import {
  LocalTenantAgentConfigRepository,
  MongoAgentExecutionTraceRepository,
  MongoSessionMemoryRepository,
  MongoUsageMetricsRepository,
} from 'src/contexts/ia/infrastructure/repositories';
import { DefaultToolRegistry } from 'src/contexts/ia/infrastructure/tools/default-tool.registry';
import { IaController } from './controllers/ia.controller';

const PROVIDER_ADAPTERS = [
  MockLocalProviderAdapter,
  OpenAiCompatibleProviderAdapter,
  DeepseekCompatibleProviderAdapter,
  CloudGenericProviderAdapter,
];

const providers = [
  {
    provide: IExecuteAgentUseCase,
    useClass: ExecuteAgentUseCase,
  },
  {
    provide: ITenantAgentConfigRepository,
    useClass: LocalTenantAgentConfigRepository,
  },
  {
    provide: IToolRegistry,
    useClass: DefaultToolRegistry,
  },
  ...PROVIDER_ADAPTERS,
  {
    provide: MODEL_PROVIDER_SET,
    useFactory: (...providerAdapters: IModelProviderAdapter[]) =>
      providerAdapters,
    inject: [...PROVIDER_ADAPTERS],
  },
  {
    provide: IModelAdapter,
    useClass: FallbackModelRouterAdapter,
  },
  {
    provide: IGuardrailPolicy,
    useClass: DefaultGuardrailPolicy,
  },
  {
    provide: ISessionMemoryRepository,
    useClass: MongoSessionMemoryRepository,
  },
  {
    provide: IAgentExecutionTraceRepository,
    useClass: MongoAgentExecutionTraceRepository,
  },
  {
    provide: IUsageMetricsRepository,
    useClass: MongoUsageMetricsRepository,
  },
];

@Module({
  imports: [],
  controllers: [IaController],
  providers: [...providers],
  exports: [...providers],
})
export class IaModule {}
