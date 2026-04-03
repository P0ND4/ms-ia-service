import { IaServiceClient } from 'src/sdk/ia-service.client';

describe('IaServiceClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = fetchMock;
  });

  it('calls execute endpoint and returns parsed response', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        statusCode: 200,
        data: { executionId: 'ex-1' },
      }),
    });

    const client = new IaServiceClient({ baseUrl: 'http://localhost:3000/' });

    const result = await client.execute({
      tenantId: 'acme',
      agentId: 'ops-agent',
      goal: 'resume',
    });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/ia/execute',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('streams chunks from executeStream endpoint', async () => {
    const chunks = [
      new TextEncoder().encode('event: chunk\n'),
      new TextEncoder().encode('data: {"x":1}\n\n'),
    ];

    const reader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({ done: false, value: chunks[0] })
        .mockResolvedValueOnce({ done: false, value: chunks[1] })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };

    fetchMock.mockResolvedValueOnce({
      body: {
        getReader: () => reader,
      },
    });

    const client = new IaServiceClient({ baseUrl: 'http://localhost:3000' });

    const received: string[] = [];
    for await (const chunk of client.executeStream({
      tenantId: 'acme',
      agentId: 'ops-agent',
      goal: 'stream',
    })) {
      received.push(chunk);
    }

    expect(received.join('')).toContain('event: chunk');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/ia/execute/stream',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns no chunks when stream response has no body', async () => {
    fetchMock.mockResolvedValueOnce({ body: null });

    const client = new IaServiceClient({ baseUrl: 'http://localhost:3000' });

    const received: string[] = [];
    for await (const chunk of client.executeStream({
      tenantId: 'acme',
      agentId: 'ops-agent',
      goal: 'stream',
    })) {
      received.push(chunk);
    }

    expect(received).toEqual([]);
  });

  it('calls metrics endpoint with query params', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        success: true,
        statusCode: 200,
        data: { executions: 2 },
      }),
    });

    const client = new IaServiceClient({
      baseUrl: 'http://localhost:3000',
      headers: { authorization: 'Bearer token' },
    });

    const result = await client.getTenantMetrics('acme', {
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
    });

    expect(result.data).toEqual({ executions: 2 });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/ia/metrics/acme?from=2026-01-01T00%3A00%3A00.000Z&to=2026-01-02T00%3A00%3A00.000Z',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
