import { Module } from '@nestjs/common';
import { TenantModule } from './tenant/tenant.module';

@Module({
  imports: [TenantModule],
  exports: [TenantModule],
})
export class CloudApiModule {}
