/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app/app.module';
import { API } from './../src/app/routes/route.constants';
import { CustomValidationPipe } from './../src/contexts/shared/domain/exceptions/ia-validation.pipe';
import { FoodaExceptionFilter } from './../src/contexts/shared/domain/exceptions/ia-exception.filter';
import { ApiResponseInterceptor } from './../src/contexts/shared/interceptors/api.response.interceptor';
import {
  AgentExecutionTrace,
  AgentExecutionTraceInput,
  IAgentExecutionTraceRepository,
  ISessionMemoryRepository,
  SessionMemoryTurn,
  IUsageMetricsRepository,
  TenantUsageSummary,
  UsageMetricInput,
} from './../src/contexts/ia/domain/repositories';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const traceRepositoryMock: IAgentExecutionTraceRepository = {
    create: jest.fn(
      async (trace: AgentExecutionTraceInput): Promise<AgentExecutionTrace> => {
        const now = new Date();
        return {
          ...trace,
          id: 'trace-e2e-1',
          createdAt: now,
          updatedAt: now,
        };
      },
    ),
  };
  const sessionMemoryStore = new Map<string, SessionMemoryTurn[]>();
  const sessionMemoryRepositoryMock: ISessionMemoryRepository = {
    getRecentTurns: jest.fn(
      async (tenantId: string, sessionId: string, limit: number) => {
        const key = `${tenantId}:${sessionId}`;
        const values = sessionMemoryStore.get(key) ?? [];
        return values.slice(-Math.max(1, limit));
      },
    ),
    appendTurn: jest.fn(async ({ tenantId, sessionId, turn }) => {
      const key = `${tenantId}:${sessionId}`;
      const values = sessionMemoryStore.get(key) ?? [];
      values.push(turn);
      sessionMemoryStore.set(key, values);
    }),
  };
  const usageMetricsStore: UsageMetricInput[] = [];
  const usageMetricsRepositoryMock: IUsageMetricsRepository = {
    record: jest.fn(async (metric: UsageMetricInput) => {
      usageMetricsStore.push(metric);
    }),
    getTenantSummary: jest.fn(
      async (
        tenantId: string,
        from: Date,
        to: Date,
      ): Promise<TenantUsageSummary> => {
        const rows = usageMetricsStore.filter(
          (row) =>
            row.tenantId === tenantId &&
            row.createdAt.getTime() >= from.getTime() &&
            row.createdAt.getTime() <= to.getTime(),
        );

        return {
          tenantId,
          from: from.toISOString(),
          to: to.toISOString(),
          executions: rows.length,
          estimatedInputTokens: rows.reduce(
            (accumulator, row) => accumulator + row.estimatedInputTokens,
            0,
          ),
          estimatedOutputTokens: rows.reduce(
            (accumulator, row) => accumulator + row.estimatedOutputTokens,
            0,
          ),
          estimatedCostUsd: rows.reduce(
            (accumulator, row) => accumulator + row.estimatedCostUsd,
            0,
          ),
          byProvider: [],
        };
      },
    ),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(IAgentExecutionTraceRepository)
      .useValue(traceRepositoryMock)
      .overrideProvider(ISessionMemoryRepository)
      .useValue(sessionMemoryRepositoryMock)
      .overrideProvider(IUsageMetricsRepository)
      .useValue(usageMetricsRepositoryMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API);
    app.useGlobalPipes(new CustomValidationPipe());
    app.useGlobalFilters(new FoodaExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });

  it('/api/v1/ia/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/ia/health')
      .expect(200)
      .expect((response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual({
          service: 'ia-service',
          status: 'ok',
        });
      });
  });

  it('/api/v1/ia/execute (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/ia/execute')
      .send({
        tenantId: 'acme',
        agentId: 'incident-summarizer',
        goal: 'Resume el estado del incidente de pagos.',
        context: {
          severity: 'high',
          region: 'us-east-1',
        },
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.data.tenantId).toBe('acme');
        expect(response.body.data.agentId).toBe('incident-summarizer');
        expect(response.body.data.sessionId).toBeDefined();
        expect(response.body.data.provider).toBe('openai-compatible');
        expect(response.body.data.model).toBe('gpt-4.1-mini');
        expect(Array.isArray(response.body.data.toolsExecuted)).toBe(true);
      });
  });

  it('/api/v1/ia/execute/stream (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/ia/execute/stream')
      .send({
        tenantId: 'acme',
        agentId: 'incident-summarizer',
        sessionId: 'session-stream-1',
        goal: 'Dame un estado breve del incidente.',
        context: {
          service: 'payments',
        },
      })
      .expect(200)
      .expect((response) => {
        expect(response.headers['content-type']).toContain('text/event-stream');
        expect(response.text).toContain('event: meta');
        expect(response.text).toContain('event: chunk');
        expect(response.text).toContain('event: done');
      });
  });

  it('/api/v1/ia/execute (POST) validation error', () => {
    return request(app.getHttpServer())
      .post('/api/v1/ia/execute')
      .send({
        tenantId: '',
        agentId: 'incident-summarizer',
        goal: 'x',
      })
      .expect(400)
      .expect((response) => {
        expect(response.body.code).toBe('IA-1005');
      });
  });

  it('/api/v1/ia/metrics/:tenantId (GET)', async () => {
    await request(app.getHttpServer()).post('/api/v1/ia/execute').send({
      tenantId: 'acme',
      agentId: 'incident-summarizer',
      goal: 'Genera resumen de estado.',
    });

    return request(app.getHttpServer())
      .get('/api/v1/ia/metrics/acme')
      .expect(200)
      .expect((response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.data.tenantId).toBe('acme');
        expect(response.body.data.executions).toBeGreaterThanOrEqual(1);
      });
  });

  afterEach(() => {
    jest.clearAllMocks();
    sessionMemoryStore.clear();
    usageMetricsStore.length = 0;
  });
});
