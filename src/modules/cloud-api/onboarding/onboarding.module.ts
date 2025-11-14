import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ServicesModule } from '../../../services';
import { OnboardingController } from './controllers/onboarding.controller';
import { OAuthController } from './controllers/oauth.controller';
import { OnboardingService } from './services/onboarding.service';
import { EmailVerificationService } from './services/email-verification.service';
import { OtpService } from './services/otp.service';
import { OAuthService } from './services/oauth.service';
import { OAuthStateService } from './services/oauth-state.service';
import { EmailVerificationRepository } from './repositories/email-verification.repository';
import { OAuthProviderRepository } from './repositories/oauth-provider.repository';
import { OAuthStateRepository } from './repositories/oauth-state.repository';
import { GoogleOAuthProvider } from './providers/google-oauth.provider';
import { MicrosoftOAuthProvider } from './providers/microsoft-oauth.provider';
import { AppleOAuthProvider } from './providers/apple-oauth.provider';
import { FacebookOAuthProvider } from './providers/facebook-oauth.provider';
import { TwitterOAuthProvider } from './providers/twitter-oauth.provider';
import { UserModule } from '../user/user.module';
import { jwtConfigFactory } from '../../../config/jwt.config';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: jwtConfigFactory,
    }),
    ServicesModule,
    UserModule, // Import UserModule to use UserService
  ],
  controllers: [OnboardingController, OAuthController],
  providers: [
    // Core services
    OnboardingService,
    EmailVerificationService,
    OtpService,

    // OAuth services
    OAuthService,
    OAuthStateService,

    // Repositories
    EmailVerificationRepository,
    OAuthProviderRepository,
    OAuthStateRepository,

    // OAuth provider implementations
    GoogleOAuthProvider,
    MicrosoftOAuthProvider,
    AppleOAuthProvider,
    FacebookOAuthProvider,
    TwitterOAuthProvider,
  ],
  exports: [OnboardingService, EmailVerificationService, OAuthService],
})
export class OnboardingModule {}
