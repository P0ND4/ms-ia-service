import { Module } from '@nestjs/common';
import { IaModule } from './http-api/v1/ia/ia.module';

@Module({
  imports: [IaModule],
})
export class IaContextModule {}
