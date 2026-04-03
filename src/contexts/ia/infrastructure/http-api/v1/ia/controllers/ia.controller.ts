import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { V1_API } from 'src/contexts/ia/infrastructure/http-api/route.constants';
import { ExecuteAgentDto } from '../dtos/execute-agent.dto';
import { IExecuteAgentUseCase } from 'src/contexts/ia/domain/use-cases/ia/execute-agent.use-case.interface';
import { FoodaException } from 'src/contexts/shared/domain/exceptions/ia.exception';
import { FoodaExceptionCodes } from 'src/contexts/shared/domain/exceptions/ia-exception.codes';

const EXECUTE_REQUEST_EXAMPLE = {
  tenantId: 'tenant-demo',
  agentId: 'support-agent',
  sessionId: 'session-001',
  goal: 'Resume el estado del ticket TCK-1243 y sugiere siguiente accion.',
  context: {
    ticketId: 'TCK-1243',
    priority: 'high',
    customerSegment: 'enterprise',
  },
  options: {
    provider: 'openai-compatible',
    fallbackProviders: ['deepseek-compatible', 'mock-local'],
    temperature: 0.2,
    tools: ['ticket-search', 'knowledge-base'],
  },
};

const EXECUTE_RESPONSE_EXAMPLE = {
  executionId: '6eb5f2ba-1ad5-49af-b784-c0c8ef8f4bd7',
  traceId: '67ee82a87d67544f6f3f5da9',
  tenantId: 'tenant-demo',
  agentId: 'support-agent',
  sessionId: 'session-001',
  response:
    'El ticket TCK-1243 sigue en estado pendiente del proveedor. Siguiente accion: escalar a nivel 2 y notificar ETA al cliente.',
  provider: 'openai-compatible',
  model: 'gpt-4.1-mini',
  toolsExecuted: ['ticket-search', 'knowledge-base'],
  createdAt: '2026-04-02T14:28:16.417Z',
};

const STREAM_EVENT_EXAMPLE = `event: meta
data: {"type":"meta","executionId":"6eb5f2ba-1ad5-49af-b784-c0c8ef8f4bd7","sessionId":"session-001","data":{"tenantId":"tenant-demo","agentId":"support-agent","provider":"openai-compatible","model":"gpt-4.1-mini","fallbackChain":["openai-compatible","deepseek-compatible","mock-local"]}}

event: chunk
data: {"type":"chunk","executionId":"6eb5f2ba-1ad5-49af-b784-c0c8ef8f4bd7","sessionId":"session-001","data":{"content":"El ticket sigue pendiente...","index":0}}

event: done
data: {"type":"done","executionId":"6eb5f2ba-1ad5-49af-b784-c0c8ef8f4bd7","sessionId":"session-001","data":{"provider":"openai-compatible","model":"gpt-4.1-mini","latencyMs":842}}
`;

const TENANT_METRICS_RESPONSE_EXAMPLE = {
  tenantId: 'tenant-demo',
  from: '2026-04-01T00:00:00.000Z',
  to: '2026-04-02T23:59:59.999Z',
  executions: 42,
  estimatedInputTokens: 18900,
  estimatedOutputTokens: 14210,
  estimatedCostUsd: 1.287,
  byProvider: [
    {
      provider: 'openai-compatible',
      executions: 30,
      estimatedCostUsd: 1.019,
    },
    {
      provider: 'deepseek-compatible',
      executions: 12,
      estimatedCostUsd: 0.268,
    },
  ],
};

@ApiTags('IA Agent')
@Controller(V1_API)
export class IaController {
  constructor(private readonly executeAgentUseCase: IExecuteAgentUseCase) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check del servicio IA' })
  @ApiOkResponse({
    description: 'Servicio IA operativo.',
    schema: {
      example: {
        service: 'ia-service',
        status: 'ok',
      },
    },
  })
  getHealth() {
    return {
      service: 'ia-service',
      status: 'ok',
    };
  }

  @Post('execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ejecutar agente IA generico',
    description:
      'Recibe un objetivo y contexto opcional para ejecutar el agente con configuracion personalizable.',
  })
  @ApiBody({
    type: ExecuteAgentDto,
    examples: {
      ticketAssistant: {
        summary: 'Solicitud de ejecucion para asistente de soporte',
        value: EXECUTE_REQUEST_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'Ejecucion aceptada.',
    schema: {
      example: EXECUTE_RESPONSE_EXAMPLE,
    },
  })
  @ApiBadRequestResponse({
    description: 'Payload invalido. Posibles codigos: IA-1000..IA-1010.',
  })
  async execute(@Body() body: ExecuteAgentDto) {
    return this.executeAgentUseCase.execute({
      tenantId: body.tenantId,
      agentId: body.agentId,
      sessionId: body.sessionId,
      goal: body.goal,
      context: body.context,
      options: body.options,
    });
  }

  @Post('execute/stream')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ejecutar agente IA con streaming',
    description:
      'Transmite la respuesta como eventos tipo SSE en formato event-stream.',
  })
  @ApiBody({
    type: ExecuteAgentDto,
    examples: {
      streamTicketAssistant: {
        summary: 'Solicitud de ejecucion en modo streaming',
        value: EXECUTE_REQUEST_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'Streaming iniciado. Respuesta en formato text/event-stream.',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
        },
        example: STREAM_EVENT_EXAMPLE,
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Payload invalido o bloqueado por politicas.',
  })
  async executeStream(@Body() body: ExecuteAgentDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const event of this.executeAgentUseCase.executeStream({
        tenantId: body.tenantId,
        agentId: body.agentId,
        sessionId: body.sessionId,
        goal: body.goal,
        context: body.context,
        options: body.options,
      })) {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      const code =
        error instanceof FoodaException
          ? error.code
          : FoodaExceptionCodes.Ex3002.code;
      const message =
        error instanceof Error
          ? error.message
          : FoodaExceptionCodes.Ex3002.message;

      res.write('event: error\n');
      res.write(
        `data: ${JSON.stringify({ code, message, statusCode: HttpStatus.BAD_REQUEST })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  @Get('metrics/:tenantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener metricas y costo estimado por tenant',
  })
  @ApiParam({
    name: 'tenantId',
    example: 'tenant-demo',
    description: 'Identificador del tenant a consultar.',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    example: '2026-04-01T00:00:00.000Z',
    description: 'Fecha inicial en ISO-8601.',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    example: '2026-04-02T23:59:59.999Z',
    description: 'Fecha final en ISO-8601.',
  })
  @ApiOkResponse({
    description: 'Metricas agregadas del tenant.',
    schema: {
      example: TENANT_METRICS_RESPONSE_EXAMPLE,
    },
  })
  async getTenantMetrics(
    @Param('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.executeAgentUseCase.getTenantMetrics({
      tenantId,
      from,
      to,
    });
  }
}
