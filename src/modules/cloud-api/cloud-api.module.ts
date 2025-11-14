import { Module } from '@nestjs/common';
import { TenantModule } from './tenant/tenant.module';
import { UserModule } from './user/user.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    TenantModule,
    UserModule,
    OnboardingModule,
    AuthModule,
  ],
  exports: [
    TenantModule,
    UserModule,
    OnboardingModule,
    AuthModule,
  ],
})
export class CloudApiModule {}
