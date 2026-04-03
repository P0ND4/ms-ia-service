import { HttpException, HttpStatus } from '@nestjs/common';
import { FoodaExceptionInfo } from './ia-exception.codes';

export class FoodaException extends HttpException {
  public readonly code: string;

  constructor(exceptionInfo: FoodaExceptionInfo, status: HttpStatus) {
    const response = {
      statusCode: status,
      message: exceptionInfo.message,
      code: exceptionInfo.code,
      service: exceptionInfo.service,
    };
    super(response, status);
    this.code = exceptionInfo.code;
  }
}
