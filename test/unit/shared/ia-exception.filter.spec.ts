import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { FoodaExceptionCodes } from 'src/contexts/shared/domain/exceptions/ia-exception.codes';
import { FoodaExceptionFilter } from 'src/contexts/shared/domain/exceptions/ia-exception.filter';
import { FoodaException } from 'src/contexts/shared/domain/exceptions/ia.exception';

describe('FoodaExceptionFilter', () => {
  function createHost() {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });

    const response = { status, json } as any;
    const request = { originalUrl: '/api/v1/ia/execute' } as any;

    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;

    return { host, response, status, json };
  }

  it('handles FoodaException', () => {
    const filter = new FoodaExceptionFilter();
    const { host, status, json, response } = createHost();

    filter.catch(
      new FoodaException(FoodaExceptionCodes.Ex3000, HttpStatus.FORBIDDEN),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: FoodaExceptionCodes.Ex3000.code,
      }),
    );
    expect(response.errorCode).toBe(FoodaExceptionCodes.Ex3000.code);
  });

  it('handles NotFoundException with IA-0001', () => {
    const filter = new FoodaExceptionFilter();
    const { host, status, json, response } = createHost();

    filter.catch(new NotFoundException(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: FoodaExceptionCodes.Ex0001.code }),
    );
    expect(response.errorCode).toBe(FoodaExceptionCodes.Ex0001.code);
  });

  it('handles generic HttpException preserving message', () => {
    const filter = new FoodaExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new HttpException('bad', HttpStatus.BAD_REQUEST), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: FoodaExceptionCodes.Ex0000.code,
        message: 'bad',
      }),
    );
  });

  it('handles unknown errors with IA-9999', () => {
    const filter = new FoodaExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new Error('unexpected'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: FoodaExceptionCodes.Ex9999.code }),
    );
  });
});
