import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import environment from 'src/config/environment.config';
import { IaContextModule } from 'src/contexts/ia/infrastructure/ia.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [environment] }),
    IaContextModule,
  ],
})
export class AppModule {}
