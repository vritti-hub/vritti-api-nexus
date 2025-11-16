import {
  Controller,
  Get,
  Logger,
  Param,
  Query,
  Redirect,
  Request,
  Res,
} from '@nestjs/common';
import { BadRequestException } from '@vritti/api-sdk';
import { OAuthProviderType } from '@prisma/client';
import { Onboarding, Public } from '@vritti/api-sdk';
import type { FastifyReply } from 'fastify';
import { OAuthResponseDto } from '../dto/oauth-response.dto';
import { OAuthService } from '../services/oauth.service';

/**
 * OAuth Controller
 * Handles OAuth authentication flows for all providers
 */
@Controller('onboarding/oauth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(private readonly oauthService: OAuthService) {}

  /**
   * Initiate OAuth flow
   * GET /onboarding/oauth/:provider
   * Public endpoint - redirects to OAuth provider
   */
  @Get(':provider')
  @Public()
  @Redirect()
  async initiateOAuth(
    @Param('provider') providerStr: string,
  ): Promise<{ url: string }> {
    const provider = this.validateProvider(providerStr);

    this.logger.log(`Initiating OAuth flow for provider: ${provider}`);

    const { url } = await this.oauthService.initiateOAuth(provider);

    return { url };
  }

  /**
   * Link OAuth provider to existing user
   * GET /onboarding/oauth/:provider/link
   * Requires onboarding token - user must be authenticated
   */
  @Get(':provider/link')
  @Onboarding()
  @Redirect()
  async linkOAuthProvider(
    @Param('provider') providerStr: string,
    @Request() req,
  ): Promise<{ url: string }> {
    const provider = this.validateProvider(providerStr);
    const userId = req.user.id;

    this.logger.log(`Linking OAuth provider: ${provider} for user: ${userId}`);

    const { url } = await this.oauthService.initiateOAuth(provider, userId);

    return { url };
  }

  /**
   * Handle OAuth callback
   * GET /onboarding/oauth/:provider/callback
   * Public endpoint - receives authorization code from provider
   */
  @Get(':provider/callback')
  @Public()
  async handleOAuthCallback(
    @Param('provider') providerStr: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: FastifyReply,
  ): Promise<void> {
    const provider = this.validateProvider(providerStr);

    if (!code || !state) {
      throw new BadRequestException(
        'Missing code or state parameter',
        'The authentication request is incomplete. Please try logging in again.'
      );
    }

    this.logger.log(`Handling OAuth callback for provider: ${provider}`);

    try {
      const response: OAuthResponseDto = await this.oauthService.handleCallback(
        provider,
        code,
        state,
      );

      // Redirect to frontend with onboarding token
      const frontendUrl = this.getFrontendRedirectUrl(response);
      res.redirect(frontendUrl, 302);
    } catch (error) {
      this.logger.error('OAuth callback error', error);

      // Redirect to frontend error page
      const errorUrl = this.getFrontendErrorUrl(error.message);
      res.redirect(errorUrl, 302);
    }
  }

  /**
   * Validate and parse OAuth provider
   */
  private validateProvider(providerStr: string): OAuthProviderType {
    const upperProvider = providerStr.toUpperCase();

    if (!Object.values(OAuthProviderType).includes(upperProvider as any)) {
      throw new BadRequestException(
        'provider',
        `Invalid OAuth provider: ${providerStr}`,
        'The selected login method is not supported. Please choose a different option.'
      );
    }

    return upperProvider as OAuthProviderType;
  }

  /**
   * Get frontend redirect URL after successful OAuth
   */
  private getFrontendRedirectUrl(response: OAuthResponseDto): string {
    const baseUrl = 'http://cloud.localhost:3001'; // TODO: Get from config
    const params = new URLSearchParams({
      token: response.onboardingToken,
      isNewUser: String(response.isNewUser),
      requiresPassword: String(response.requiresPasswordSetup),
      step: response.user.onboardingStep,
    });

    return `${baseUrl}/onboarding/oauth-success?${params.toString()}`;
  }

  /**
   * Get frontend error URL
   */
  private getFrontendErrorUrl(errorMessage: string): string {
    const baseUrl = 'http://localhost:5173'; // TODO: Get from config
    const params = new URLSearchParams({
      error: errorMessage,
    });

    return `${baseUrl}/onboarding/oauth-error?${params.toString()}`;
  }
}
