import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthProviderType } from '@prisma/client';
import axios from 'axios';
import { IOAuthProvider } from '../interfaces/oauth-provider.interface';
import { OAuthTokens } from '../interfaces/oauth-tokens.interface';
import { OAuthUserProfile } from '../interfaces/oauth-user-profile.interface';

/**
 * X (Twitter) OAuth 2.0 Provider
 * Implements OAuth flow for X/Twitter authentication
 * Uses OAuth 2.0 with PKCE (Twitter API v2)
 */
@Injectable()
export class TwitterOAuthProvider implements IOAuthProvider {
  private readonly logger = new Logger(TwitterOAuthProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  private readonly AUTHORIZATION_URL = 'https://twitter.com/i/oauth2/authorize';
  private readonly TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
  private readonly USER_INFO_URL = 'https://api.twitter.com/2/users/me';

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.getOrThrow<string>('X_CLIENT_ID');
    this.clientSecret =
      this.configService.getOrThrow<string>('X_CLIENT_SECRET');
    this.redirectUri = this.configService.getOrThrow<string>('X_CALLBACK_URL');
  }

  /**
   * Get X (Twitter) authorization URL
   */
  getAuthorizationUrl(state: string, codeChallenge?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'tweet.read users.read offline.access',
      state,
    });

    // Twitter OAuth 2.0 requires PKCE
    if (codeChallenge) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    } else {
      this.logger.warn(
        'Twitter OAuth 2.0 requires PKCE, but no code challenge provided',
      );
    }

    const url = `${this.AUTHORIZATION_URL}?${params.toString()}`;
    this.logger.debug('Generated X (Twitter) authorization URL');
    return url;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForToken(
    code: string,
    codeVerifier?: string,
  ): Promise<OAuthTokens> {
    try {
      const data: any = {
        code,
        grant_type: 'authorization_code',
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
      };

      // Twitter OAuth 2.0 requires PKCE
      if (codeVerifier) {
        data.code_verifier = codeVerifier;
      } else {
        this.logger.warn(
          'Twitter OAuth 2.0 requires PKCE, but no code verifier provided',
        );
      }

      // Create Basic Auth header
      const authHeader = Buffer.from(
        `${this.clientId}:${this.clientSecret}`,
      ).toString('base64');

      const response = await axios.post(this.TOKEN_URL, data, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${authHeader}`,
        },
      });

      this.logger.log('Successfully exchanged X (Twitter) authorization code');

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        tokenType: response.data.token_type,
        expiresIn: response.data.expires_in,
      };
    } catch (error) {
      this.logger.error(
        'Failed to exchange X (Twitter) authorization code',
        error,
      );
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Get user profile from X (Twitter) API v2
   */
  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      const response = await axios.get(this.USER_INFO_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          'user.fields': 'profile_image_url,name,username',
        },
      });

      const data = response.data.data;

      this.logger.log(
        `Retrieved X (Twitter) profile for user: ${data.username}`,
      );

      // Twitter doesn't provide email by default (requires additional permissions)
      // We'll use username@twitter.com as fallback
      const email = data.email || `${data.username}@twitter.com`;

      return {
        provider: OAuthProviderType.X,
        providerId: data.id,
        email,
        displayName: data.name,
        firstName: data.name?.split(' ')[0],
        lastName: data.name?.split(' ').slice(1).join(' '),
        profilePictureUrl: data.profile_image_url,
      };
    } catch (error) {
      this.logger.error('Failed to get X (Twitter) user profile', error);
      throw new Error('Failed to get user profile');
    }
  }
}
