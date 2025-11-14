import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnboardingStep, OAuthProviderType } from '@prisma/client';
import * as crypto from 'crypto';
import { getTokenExpiry, TokenType } from '../../../../config/jwt.config';
import { UserRepository } from '../../user/user.repository';
import { UserService } from '../../user/user.service';
import { OAuthResponseDto } from '../dto/oauth-response.dto';
import { IOAuthProvider } from '../interfaces/oauth-provider.interface';
import { AppleOAuthProvider } from '../providers/apple-oauth.provider';
import { FacebookOAuthProvider } from '../providers/facebook-oauth.provider';
import { GoogleOAuthProvider } from '../providers/google-oauth.provider';
import { MicrosoftOAuthProvider } from '../providers/microsoft-oauth.provider';
import { TwitterOAuthProvider } from '../providers/twitter-oauth.provider';
import { OAuthProviderRepository } from '../repositories/oauth-provider.repository';
import { OAuthStateService } from './oauth-state.service';

/**
 * Main OAuth Service
 * Orchestrates OAuth authentication flow for all providers
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly tokenExpiry: ReturnType<typeof getTokenExpiry>;
  private readonly providers: Map<OAuthProviderType, IOAuthProvider>;

  constructor(
    private readonly userService: UserService,
    private readonly userRepository: UserRepository,
    private readonly oauthStateService: OAuthStateService,
    private readonly oauthProviderRepository: OAuthProviderRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    // Inject all OAuth providers
    private readonly googleProvider: GoogleOAuthProvider,
    private readonly microsoftProvider: MicrosoftOAuthProvider,
    private readonly appleProvider: AppleOAuthProvider,
    private readonly facebookProvider: FacebookOAuthProvider,
    private readonly twitterProvider: TwitterOAuthProvider,
  ) {
    this.tokenExpiry = getTokenExpiry(configService);

    // Map provider types to implementations
    // Use type assertion to bypass structural typing issues with private logger properties
    this.providers = new Map([
      [OAuthProviderType.GOOGLE, this.googleProvider],
      [OAuthProviderType.MICROSOFT, this.microsoftProvider],
      [OAuthProviderType.APPLE, this.appleProvider],
      [OAuthProviderType.FACEBOOK, this.facebookProvider],
      [OAuthProviderType.X, this.twitterProvider],
    ] as [OAuthProviderType, IOAuthProvider][]);
  }

  /**
   * Initiate OAuth flow
   * @param provider - OAuth provider type
   * @param userId - Optional user ID (for linking OAuth to existing user)
   * @returns Authorization URL and state token
   */
  async initiateOAuth(
    provider: OAuthProviderType,
    userId?: string,
  ): Promise<{ url: string; state: string }> {
    const oauthProvider = this.getProvider(provider);

    // Generate PKCE code verifier and challenge
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    // Generate and store state token
    const state = await this.oauthStateService.generateState(
      provider,
      userId,
      codeVerifier,
    );

    // Get authorization URL from provider
    const url = oauthProvider.getAuthorizationUrl(state, codeChallenge);

    this.logger.log(
      `Initiated OAuth flow for provider: ${provider}, userId: ${userId || 'none'}`,
    );

    return { url, state };
  }

  /**
   * Handle OAuth callback
   * @param provider - OAuth provider type
   * @param code - Authorization code from provider
   * @param state - State token from OAuth flow
   * @returns OAuth response with onboarding token
   */
  async handleCallback(
    provider: OAuthProviderType,
    code: string,
    state: string,
  ): Promise<OAuthResponseDto> {
    // Validate and consume state token
    const stateData =
      await this.oauthStateService.validateAndConsumeState(state);

    // Verify provider matches
    if (stateData.provider !== provider) {
      throw new UnauthorizedException('Provider mismatch');
    }

    const oauthProvider = this.getProvider(provider);

    // Exchange code for tokens
    const tokens = await oauthProvider.exchangeCodeForToken(
      code,
      stateData.codeVerifier,
    );

    // Get user profile from provider
    const profile = await oauthProvider.getUserProfile(tokens.accessToken);

    // Find or create user
    const { user, isNewUser } = await this.findOrCreateUser(
      profile,
      stateData.userId,
    );

    // Link OAuth provider to user
    await this.linkOAuthProvider(user.id, profile, tokens);

    // Generate onboarding token
    const onboardingToken = this.generateOnboardingToken(user.id);

    this.logger.log(
      `OAuth callback completed for provider: ${provider}, user: ${user.email}, isNewUser: ${isNewUser}`,
    );

    return OAuthResponseDto.create(onboardingToken, user, isNewUser);
  }

  /**
   * Find or create user from OAuth profile
   */
  private async findOrCreateUser(
    profile: any,
    linkToUserId?: string,
  ): Promise<{ user: any; isNewUser: boolean }> {
    // If linkToUserId provided, link to existing user
    if (linkToUserId) {
      const user = await this.userService.findById(linkToUserId);
      if (!user) {
        throw new BadRequestException('User not found');
      }
      return { user, isNewUser: false };
    }

    // Check if user with email exists
    const existingUser = await this.userService.findByEmail(profile.email);

    if (existingUser) {
      // Check if onboarding is complete
      if (existingUser.onboardingComplete) {
        throw new ConflictException(
          'User already exists with this email. Please login with password.',
        );
      }

      // Return existing incomplete user
      this.logger.log(
        `Found existing incomplete user for email: ${profile.email}`,
      );
      return { user: existingUser, isNewUser: false };
    }

    // Create new user
    this.logger.log(`Creating new user from OAuth profile: ${profile.email}`);

    // For OAuth users, we use a dedicated repository method
    // since CreateUserDto requires a password field that OAuth users don't have
    const newUser = await this.userRepository.createFromOAuth({
      email: profile.email,
      firstName: profile.firstName || null,
      lastName: profile.lastName || null,
      emailVerified: true, // Email verified by OAuth provider
      onboardingStep: OnboardingStep.SET_PASSWORD,
      profilePictureUrl: profile.profilePictureUrl || null,
    });

    return { user: newUser, isNewUser: true };
  }

  /**
   * Link OAuth provider to user account
   */
  private async linkOAuthProvider(
    userId: string,
    profile: any,
    tokens: any,
  ): Promise<void> {
    // Calculate token expiry
    const tokenExpiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : undefined;

    await this.oauthProviderRepository.upsert(
      userId,
      profile,
      tokens.accessToken,
      tokens.refreshToken,
      tokenExpiresAt,
    );

    this.logger.log(
      `Linked OAuth provider: ${profile.provider} to user: ${userId}`,
    );
  }

  /**
   * Generate onboarding JWT token
   */
  private generateOnboardingToken(userId: string): string {
    return this.jwtService.sign(
      {
        userId,
        type: TokenType.ONBOARDING,
      },
      {
        expiresIn: this.tokenExpiry.ONBOARDING as any,
      },
    );
  }

  /**
   * Get OAuth provider implementation
   */
  private getProvider(provider: OAuthProviderType): IOAuthProvider {
    const oauthProvider = this.providers.get(provider);
    if (!oauthProvider) {
      throw new BadRequestException(`Unsupported OAuth provider: ${provider}`);
    }
    return oauthProvider;
  }

  /**
   * Generate PKCE code verifier (random string)
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate PKCE code challenge from verifier
   */
  private generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }
}
