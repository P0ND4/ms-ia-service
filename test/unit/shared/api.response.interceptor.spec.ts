import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { ApiResponseInterceptor } from 'src/contexts/shared/interceptors/api.response.interceptor';

describe('ApiResponseInterceptor', () => {
  it('wraps successful response with default message', async () => {
    const interceptor = new ApiResponseInterceptor();
    const context = {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;

    const next = {
      handle: () => of({ ok: true }),
    } as unknown as CallHandler;

    const output = await lastValueFrom(interceptor.intercept(context, next));

    expect(output).toEqual({
      success: true,
      data: { ok: true },
      message: 'Request successful',
      statusCode: 200,
    });
  });

  it('uses response statusMessage when available', async () => {
    const interceptor = new ApiResponseInterceptor();
    const context = {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode: 202, statusMessage: 'Accepted' }),
      }),
    } as unknown as ExecutionContext;

    const next = {
      handle: () => of({ queued: true }),
    } as unknown as CallHandler;

    const output = await lastValueFrom(interceptor.intercept(context, next));

    expect(output).toEqual({
      success: true,
      data: { queued: true },
      message: 'Accepted',
      statusCode: 202,
    });
  });
});
