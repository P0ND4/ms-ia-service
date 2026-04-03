import { HttpStatus } from '@nestjs/common';
import { FoodaExceptionCodes } from 'src/contexts/shared/domain/exceptions/ia-exception.codes';
import { FoodaException } from 'src/contexts/shared/domain/exceptions/ia.exception';

describe('FoodaException', () => {
  it('builds HttpException response using exception info', () => {
    const error = new FoodaException(
      FoodaExceptionCodes.Ex3001,
      HttpStatus.FORBIDDEN,
    );

    expect(error.code).toBe(FoodaExceptionCodes.Ex3001.code);
    expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(error.getResponse()).toEqual({
      statusCode: HttpStatus.FORBIDDEN,
      message: FoodaExceptionCodes.Ex3001.message,
      code: FoodaExceptionCodes.Ex3001.code,
      service: 'ia-service',
    });
  });
});
