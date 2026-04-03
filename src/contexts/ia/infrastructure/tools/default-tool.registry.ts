import { Injectable } from '@nestjs/common';
import {
  ExecuteToolsInput,
  IToolRegistry,
  ToolExecutionResult,
} from 'src/contexts/ia/domain/ports';

type ToolHandler = (input: ExecuteToolsInput) => Promise<string>;

@Injectable()
export class DefaultToolRegistry implements IToolRegistry {
  private readonly handlers: Record<string, ToolHandler> = {
    'clock.now': async () => new Date().toISOString(),
    'context.echo': async (input) =>
      JSON.stringify(input.context ?? {}, null, 0),
  };

  async executeTools(input: ExecuteToolsInput): Promise<ToolExecutionResult[]> {
    const tools = [...new Set(input.toolNames ?? [])];
    if (tools.length === 0) return [];

    const results: ToolExecutionResult[] = [];

    for (const toolName of tools) {
      const startedAt = Date.now();
      const handler = this.handlers[toolName];

      if (!handler) {
        results.push({
          name: toolName,
          status: 'error',
          output: `Tool no registrada: ${toolName}`,
          durationMs: Date.now() - startedAt,
        });
        continue;
      }

      try {
        const output = await handler(input);
        results.push({
          name: toolName,
          status: 'success',
          output,
          durationMs: Date.now() - startedAt,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error desconocido de tool';
        results.push({
          name: toolName,
          status: 'error',
          output: message,
          durationMs: Date.now() - startedAt,
        });
      }
    }

    return results;
  }
}
