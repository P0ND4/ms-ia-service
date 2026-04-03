import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { ExecuteAgentDto } from 'src/contexts/ia/infrastructure/http-api/v1/ia/dtos/execute-agent.dto';
import { FoodaExceptionCodes } from 'src/contexts/shared/domain/exceptions/ia-exception.codes';
import { FoodaException } from 'src/contexts/shared/domain/exceptions/ia.exception';
import { CustomValidationPipe } from 'src/contexts/shared/domain/exceptions/ia-validation.pipe';

describe('CustomValidationPipe', () => {
  it('throws FoodaException mapped by validation message', async () => {
    const pipe = new CustomValidationPipe();

    await expect(
      pipe.transform(
        { tenantId: '', agentId: 'ops-agent', goal: 'resumen' },
        {
          type: 'body',
          metatype: ExecuteAgentDto,
          data: '',
        },
      ),
    ).rejects.toMatchObject({ code: FoodaExceptionCodes.Ex1005.code });
  });

  it('returns FoodaException when code key comes directly in validation message', () => {
    const pipe = new CustomValidationPipe() as CustomValidationPipe & {
      exceptionFactory: (errors: ValidationError[]) => Error;
    };

    const validationError: ValidationError = {
      property: 'tenantId',
      constraints: {
        custom: 'Ex1005',
      },
      children: [],
    };

    const error = pipe.exceptionFactory([validationError]);

    expect(error).toBeInstanceOf(FoodaException);
    expect((error as FoodaException).code).toBe(
      FoodaExceptionCodes.Ex1005.code,
    );
  });

  it('falls back to BadRequestException for unknown messages', () => {
    const pipe = new CustomValidationPipe() as CustomValidationPipe & {
      exceptionFactory: (errors: ValidationError[]) => Error;
    };

    const validationError: ValidationError = {
      property: 'tenantId',
      constraints: {
        custom: 'mensaje-no-mapeado',
      },
      children: [],
    };

    const error = pipe.exceptionFactory([validationError]);

    expect(error).toBeInstanceOf(BadRequestException);
  });
});
