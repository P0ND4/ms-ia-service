import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../api.response';

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        const res: any = context.switchToHttp().getResponse();
        const statusCode: number = res?.statusCode ?? 200;
        const statusMessage: string | undefined = res?.statusMessage;
        const defaultMessage =
          statusCode >= 200 && statusCode < 300
            ? 'Request successful'
            : 'Request failed';

        return {
          success: true,
          data,
          message: statusMessage || defaultMessage,
          statusCode,
        };
      }),
    );
  }
}
