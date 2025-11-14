import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthProviderType } from '@prisma/client';
import * as crypto from 'crypto';
import { OAuthStateData } from '../interfaces/oauth-state.interface';
import { OAuthStateRepository } from '../repositories/oauth-state.repository';

/**
 * OAuth State Service
 * Manages OAuth state tokens using Prisma database (not Redis)
 * Provides CSRF protection for OAuth flows
 */
@Injectable()
export class OAuthStateService {
  private readonly logger = new Logger(OAuthStateService.name);
  private readonly hmacSecret: string;
  private readonly STATE_EXPIRY_MINUTES = 10;

  constructor(
    private readonly stateRepository: OAuthStateRepository,
    private readonly configService: ConfigService,
  ) {
    this.hmacSecret = this.configService.getOrThrow<string>('CSRF_HMAC_KEY');
  }

  /**
   * Generate and store OAuth state token
   * @param provider - OAuth provider
   * @param userId - Optional user ID (for link OAuth flow)
   * @param codeVerifier - PKCE code verifier
   * @returns Signed state token
   */
  async generateState(
    provider: OAuthProviderType,
    userId: string | undefined,
    codeVerifier: string,
  ): Promise<string> {
    // Generate cryptographically secure random state token
    const stateToken = crypto.randomBytes(32).toString('hex');

    // Sign state token with HMAC
    const signedStateToken = this.signStateToken(stateToken);

    // Calculate expiry time (10 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.STATE_EXPIRY_MINUTES);

    // Store in database
    await this.stateRepository.create({
      stateToken: signedStateToken,
      provider,
      userId,
      codeVerifier,
      expiresAt,
    });

    this.logger.log(
      `Generated OAuth state for provider: ${provider}, userId: ${userId || 'none'}`,
    );

    return signedStateToken;
  }

  /**
   * Validate and consume OAuth state token (one-time use)
   * @param stateToken - State token from OAuth callback
   * @returns OAuth state data
   * @throws UnauthorizedException if state is invalid or expired
   */
  async validateAndConsumeState(stateToken: string): Promise<OAuthStateData> {
    // Verify HMAC signature
    if (!this.verifyStateToken(stateToken)) {
      this.logger.warn('Invalid OAuth state token signature');
      throw new UnauthorizedException('Invalid state token');
    }

    // Query database for state record
    const stateRecord = await this.stateRepository.findByToken(stateToken);

    if (!stateRecord) {
      this.logger.warn('OAuth state token not found in database');
      throw new UnauthorizedException('Invalid or expired state token');
    }

    // Check expiry
    if (new Date() > stateRecord.expiresAt) {
      // Delete expired state
      await this.stateRepository.delete(stateRecord.id);
      this.logger.warn('OAuth state token expired');
      throw new UnauthorizedException('State token expired');
    }

    // Delete state (one-time use)
    await this.stateRepository.delete(stateRecord.id);

    this.logger.log(
      `Validated and consumed OAuth state for provider: ${stateRecord.provider}`,
    );

    // Return state data
    return {
      provider: stateRecord.provider,
      userId: stateRecord.userId || undefined,
      codeVerifier: stateRecord.codeVerifier,
    };
  }

  /**
   * Cleanup expired OAuth states
   * This should be called periodically (e.g., via cron job)
   * @returns Number of deleted states
   */
  async cleanupExpiredStates(): Promise<number> {
    const result = await this.stateRepository.deleteExpired();

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired OAuth states`);
    }

    return result.count;
  }

  /**
   * Sign state token with HMAC
   */
  private signStateToken(stateToken: string): string {
    const hmac = crypto.createHmac('sha256', this.hmacSecret);
    hmac.update(stateToken);
    const signature = hmac.digest('hex');
    return `${stateToken}.${signature}`;
  }

  /**
   * Verify state token HMAC signature
   */
  private verifyStateToken(signedStateToken: string): boolean {
    const parts = signedStateToken.split('.');
    if (parts.length !== 2) {
      return false;
    }

    const [stateToken, providedSignature] = parts;
    const hmac = crypto.createHmac('sha256', this.hmacSecret);
    hmac.update(stateToken);
    const expectedSignature = hmac.digest('hex');

    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(providedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  }
}
