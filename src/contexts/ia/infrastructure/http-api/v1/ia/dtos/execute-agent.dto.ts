import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { FoodaExceptionCodes } from 'src/contexts/shared/domain/exceptions/ia-exception.codes';

class ExecuteAgentOptionsDto {
  @ApiPropertyOptional({
    example: 'openai-compatible',
    description: 'Override opcional del proveedor primario a utilizar.',
  })
  @IsOptional()
  @IsString({ message: FoodaExceptionCodes.Ex1013.message })
  provider?: string;

  @ApiPropertyOptional({
    example: ['deepseek-compatible', 'mock-local'],
    description: 'Cadena opcional de fallback de proveedores.',
  })
  @IsOptional()
  @IsArray({ message: FoodaExceptionCodes.Ex1014.message })
  @IsString({ each: true, message: FoodaExceptionCodes.Ex1014.message })
  fallbackProviders?: string[];

  @ApiPropertyOptional({
    example: 'mock-local-v1',
    description: 'Override opcional del modelo a utilizar.',
  })
  @IsOptional()
  @IsString({ message: FoodaExceptionCodes.Ex1008.message })
  model?: string;

  @ApiPropertyOptional({
    example: 0.2,
    description: 'Override opcional de temperatura para el modelo.',
  })
  @IsOptional()
  @IsNumber({}, { message: FoodaExceptionCodes.Ex1009.message })
  temperature?: number;

  @ApiPropertyOptional({
    example: ['clock.now', 'context.echo'],
    description: 'Lista opcional de tools a ejecutar en esta solicitud.',
  })
  @IsOptional()
  @IsArray({ message: FoodaExceptionCodes.Ex1010.message })
  @IsString({ each: true, message: FoodaExceptionCodes.Ex1010.message })
  tools?: string[];
}

export class ExecuteAgentDto {
  @ApiProperty({
    example: 'acme',
    description: 'Identificador del tenant que ejecuta el agente.',
  })
  @IsString({ message: FoodaExceptionCodes.Ex1004.message })
  @IsNotEmpty({ message: FoodaExceptionCodes.Ex1005.message })
  tenantId!: string;

  @ApiProperty({
    example: 'incident-summarizer',
    description: 'Identificador del agente configurado para el tenant.',
  })
  @IsString({ message: FoodaExceptionCodes.Ex1006.message })
  @IsNotEmpty({ message: FoodaExceptionCodes.Ex1007.message })
  agentId!: string;

  @ApiPropertyOptional({
    example: 'session-acme-001',
    description:
      'Identificador opcional de sesion para continuidad conversacional.',
  })
  @IsOptional()
  @IsString({ message: FoodaExceptionCodes.Ex1011.message })
  @IsNotEmpty({ message: FoodaExceptionCodes.Ex1012.message })
  sessionId?: string;

  @ApiProperty({
    example: 'Genera un resumen tecnico del incidente de ayer',
    description: 'Objetivo principal que el agente debe resolver.',
  })
  @IsString({ message: FoodaExceptionCodes.Ex1000.message })
  @IsNotEmpty({ message: FoodaExceptionCodes.Ex1001.message })
  goal!: string;

  @ApiPropertyOptional({
    example: {
      tenant: 'acme',
      userRole: 'developer',
    },
    description: 'Contexto opcional para enriquecer la ejecucion del agente.',
  })
  @IsOptional()
  @IsObject({ message: FoodaExceptionCodes.Ex1002.message })
  context?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: {
      model: 'mock-local-v1',
      temperature: 0.2,
      tools: ['clock.now'],
    },
    description:
      'Opciones opcionales de ejecucion (modelo, temperatura, politicas, etc).',
  })
  @IsOptional()
  @IsObject({ message: FoodaExceptionCodes.Ex1003.message })
  @ValidateNested()
  @Type(() => ExecuteAgentOptionsDto)
  options?: ExecuteAgentOptionsDto;
}
