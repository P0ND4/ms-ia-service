import {
  BadRequestException,
  Injectable,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { FoodaException } from './ia.exception';
import { FoodaExceptionCodes } from './ia-exception.codes';

@Injectable()
export class CustomValidationPipe extends ValidationPipe {
  constructor() {
    super({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        const collectConstraintMessages = (
          validationErrors: ValidationError[],
        ): string[] => {
          const messages: string[] = [];

          for (const validationError of validationErrors) {
            if (validationError.constraints) {
              messages.push(...Object.values(validationError.constraints));
            }

            if (validationError.children?.length) {
              messages.push(
                ...collectConstraintMessages(validationError.children),
              );
            }
          }

          return messages;
        };

        const firstValidationMessage = collectConstraintMessages(errors)[0];

        if (!firstValidationMessage) {
          return new BadRequestException();
        }

        const codeByMessage = Object.values(FoodaExceptionCodes).find(
          (errorCode) => errorCode.message === firstValidationMessage,
        );
        if (codeByMessage) {
          return new FoodaException(codeByMessage, 400);
        }

        const codeByKey =
          FoodaExceptionCodes[
            firstValidationMessage as keyof typeof FoodaExceptionCodes
          ];
        if (codeByKey) {
          return new FoodaException(codeByKey, 400);
        }

        return new BadRequestException([firstValidationMessage]);
      },
    });
  }
}
