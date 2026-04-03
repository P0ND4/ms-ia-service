export interface IaExecutePayload {
  tenantId: string;
  agentId: string;
  sessionId?: string;
  goal: string;
  context?: Record<string, unknown>;
  options?: {
    provider?: string;
    fallbackProviders?: string[];
    model?: string;
    temperature?: number;
    tools?: string[];
    metadata?: Record<string, unknown>;
  };
}

export interface IaClientOptions {
  baseUrl: string;
  apiPrefix?: string;
  headers?: Record<string, string>;
}

export interface IaSdkResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  statusCode: number;
}

export class IaServiceClient {
  private readonly baseUrl: string;
  private readonly apiPrefix: string;
  private readonly headers: Record<string, string>;

  constructor(options: IaClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiPrefix = options.apiPrefix ?? '/api/v1/ia';
    this.headers = {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    };
  }

  async execute<T = Record<string, unknown>>(
    payload: IaExecutePayload,
  ): Promise<IaSdkResponse<T>> {
    const response = await fetch(`${this.baseUrl}${this.apiPrefix}/execute`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    return (await response.json()) as IaSdkResponse<T>;
  }

  async *executeStream(payload: IaExecutePayload): AsyncIterable<string> {
    const response = await fetch(
      `${this.baseUrl}${this.apiPrefix}/execute/stream`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
      },
    );

    if (!response.body) return;

    const decoder = new TextDecoder();
    const reader = response.body.getReader();

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      yield decoder.decode(chunk.value, { stream: true });
    }
  }

  async getTenantMetrics<T = Record<string, unknown>>(
    tenantId: string,
    query?: { from?: string; to?: string },
  ): Promise<IaSdkResponse<T>> {
    const params = new URLSearchParams();
    if (query?.from) params.set('from', query.from);
    if (query?.to) params.set('to', query.to);

    const queryString = params.toString();
    const suffix = queryString.length > 0 ? `?${queryString}` : '';

    const response = await fetch(
      `${this.baseUrl}${this.apiPrefix}/metrics/${tenantId}${suffix}`,
      {
        method: 'GET',
        headers: this.headers,
      },
    );

    return (await response.json()) as IaSdkResponse<T>;
  }
}
