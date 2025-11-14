import { JwtModuleOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * JWT Configuration Factory
 * Creates JWT module options using ConfigService
 * Used for both onboarding tokens and auth tokens
 */
export const jwtConfigFactory = (
  configService: ConfigService,
): JwtModuleOptions => ({
  secret: configService.getOrThrow<string>('JWT_SECRET'),
  signOptions: {
    issuer: 'vritti-api',
  },
});

/**
 * Get token expiry durations from environment variables
 */
export const getTokenExpiry = (configService: ConfigService) => ({
  // Onboarding token: default 24 hours
  ONBOARDING: '24h' as string,

  // Access token: from env, default 15 minutes
  ACCESS: configService.get<string>('JWT_ACCESS_EXPIRY', '15m'),

  // Refresh token: from env, default 30 days
  REFRESH: configService.get<string>('JWT_REFRESH_EXPIRY', '30d'),

  // Password reset token: default 15 minutes
  PASSWORD_RESET: '15m' as string,
});

/**
 * Token types
 */
export enum TokenType {
  ONBOARDING = 'onboarding',
  ACCESS = 'access',
  REFRESH = 'refresh',
  PASSWORD_RESET = 'password_reset',
}
