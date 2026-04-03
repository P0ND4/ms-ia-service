import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { FoodaException } from './ia.exception';
import { FoodaExceptionCodes } from './ia-exception.codes';

@Catch()
export class FoodaExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    if (exception instanceof FoodaException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as {
        code: string;
        message: string;
        service?: string;
      };

      (response as any).errorCode = exceptionResponse.code;
      response.status(status).json(
        this.buildErrorEnvelope({
          statusCode: status,
          code: exceptionResponse.code,
          message: exceptionResponse.message,
          service: exceptionResponse.service ?? 'ia-service',
          path: request.originalUrl,
        }),
      );
      return;
    }

    if (exception instanceof NotFoundException) {
      const errorInfo = FoodaExceptionCodes.Ex0001;
      (response as any).errorCode = errorInfo.code;
      response.status(HttpStatus.NOT_FOUND).json(
        this.buildErrorEnvelope({
          statusCode: HttpStatus.NOT_FOUND,
          message: errorInfo.message,
          code: errorInfo.code,
          service: errorInfo.service,
          path: request.originalUrl,
        }),
      );
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const originalResponse = exception.getResponse() as
        | string
        | { message?: string | string[] };
      const originalMessage =
        typeof originalResponse === 'string'
          ? originalResponse
          : originalResponse.message;

      const message = Array.isArray(originalMessage)
        ? originalMessage.join(', ')
        : (originalMessage ?? FoodaExceptionCodes.Ex0000.message);

      const errorInfo = FoodaExceptionCodes.Ex0000;
      (response as any).errorCode = errorInfo.code;
      response.status(status).json(
        this.buildErrorEnvelope({
          statusCode: status,
          message,
          code: errorInfo.code,
          service: errorInfo.service,
          path: request.originalUrl,
        }),
      );
      return;
    }

    const errorInfo = FoodaExceptionCodes.Ex9999;
    (response as any).errorCode = errorInfo.code;
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      this.buildErrorEnvelope({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: errorInfo.message,
        code: errorInfo.code,
        service: errorInfo.service,
        path: request.originalUrl,
      }),
    );
  }

  private buildErrorEnvelope(input: {
    statusCode: number;
    message: string;
    code: string;
    service: string;
    path: string;
  }) {
    return {
      success: false,
      statusCode: input.statusCode,
      message: input.message,
      code: input.code,
      service: input.service,
      timestamp: new Date().toISOString(),
      path: input.path,
      error: {
        statusCode: input.statusCode,
        message: input.message,
        code: input.code,
        service: input.service,
      },
    };
  }
}
