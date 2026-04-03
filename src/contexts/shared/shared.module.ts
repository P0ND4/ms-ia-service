import { Module } from '@nestjs/common';

const REPOSITORY_PROVIDERS = [];

@Module({
  imports: [],
  providers: [...REPOSITORY_PROVIDERS],
  exports: [...REPOSITORY_PROVIDERS],
})
export class SharedModule {}
