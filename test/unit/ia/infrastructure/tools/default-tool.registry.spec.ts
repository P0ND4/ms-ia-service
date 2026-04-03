import { DefaultToolRegistry } from 'src/contexts/ia/infrastructure/tools/default-tool.registry';

describe('DefaultToolRegistry', () => {
  it('returns empty array when no tools are requested', async () => {
    const registry = new DefaultToolRegistry();

    const result = await registry.executeTools({
      tenantId: 'acme',
      agentId: 'agent-a',
      goal: 'test',
      toolNames: [],
    });

    expect(result).toEqual([]);
  });

  it('executes registered tools and reports unknown tools', async () => {
    const registry = new DefaultToolRegistry();

    const result = await registry.executeTools({
      tenantId: 'acme',
      agentId: 'agent-a',
      goal: 'test',
      context: { region: 'mx' },
      toolNames: ['clock.now', 'context.echo', 'unknown.tool', 'clock.now'],
    });

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('clock.now');
    expect(result[0].status).toBe('success');
    expect(typeof result[0].output).toBe('string');

    expect(result[1]).toEqual(
      expect.objectContaining({
        name: 'context.echo',
        status: 'success',
        output: '{"region":"mx"}',
      }),
    );

    expect(result[2]).toEqual(
      expect.objectContaining({
        name: 'unknown.tool',
        status: 'error',
        output: 'Tool no registrada: unknown.tool',
      }),
    );
  });

  it('reports handler failures as error status', async () => {
    const registry = new DefaultToolRegistry();
    const handlers = (
      registry as unknown as {
        handlers: Record<string, (input: unknown) => Promise<string>>;
      }
    ).handlers;

    handlers.boom = async () => {
      throw new Error('tool exploded');
    };

    const result = await registry.executeTools({
      tenantId: 'acme',
      agentId: 'agent-a',
      goal: 'test',
      toolNames: ['boom'],
    });

    expect(result).toEqual([
      expect.objectContaining({
        name: 'boom',
        status: 'error',
        output: 'tool exploded',
      }),
    ]);
  });
});
