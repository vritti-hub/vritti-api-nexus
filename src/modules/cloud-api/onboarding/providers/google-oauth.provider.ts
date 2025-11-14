import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthProviderType } from '@prisma/client';
import axios from 'axios';
import { IOAuthProvider } from '../interfaces/oauth-provider.interface';
import { OAuthTokens } from '../interfaces/oauth-tokens.interface';
import { OAuthUserProfile } from '../interfaces/oauth-user-profile.interface';

/**
 * Google OAuth 2.0 Provider
 * Implements OAuth flow for Google authentication
 */
@Injectable()
export class GoogleOAuthProvider implements IOAuthProvider {
  private readonly logger = new Logger(GoogleOAuthProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  private readonly AUTHORIZATION_URL =
    'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly TOKEN_URL = 'https://oauth2.googleapis.com/token';
  private readonly USER_INFO_URL =
    'https://www.googleapis.com/oauth2/v2/userinfo';

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    this.clientSecret = this.configService.getOrThrow<string>(
      'GOOGLE_CLIENT_SECRET',
    );
    this.redirectUri = this.configService.getOrThrow<string>(
      'GOOGLE_CALLBACK_URL',
    );
  }

  /**
   * Get Google authorization URL
   */
  getAuthorizationUrl(state: string, codeChallenge?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline', // Get refresh token
      prompt: 'consent', // Force consent screen for refresh token
    });

    // Add PKCE if code challenge provided
    if (codeChallenge) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    const url = `${this.AUTHORIZATION_URL}?${params.toString()}`;
    this.logger.debug('Generated Google authorization URL');
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
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      };

      // Add PKCE verifier if provided
      if (codeVerifier) {
        data.code_verifier = codeVerifier;
      }

      const response = await axios.post(this.TOKEN_URL, data, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.logger.log('Successfully exchanged Google authorization code');

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        tokenType: response.data.token_type,
        expiresIn: response.data.expires_in,
        idToken: response.data.id_token,
      };
    } catch (error) {
      this.logger.error('Failed to exchange Google authorization code', error);
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Get user profile from Google
   */
  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      const response = await axios.get(this.USER_INFO_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = response.data;

      this.logger.log(`Retrieved Google profile for user: ${data.email}`);

      return {
        provider: OAuthProviderType.GOOGLE,
        providerId: data.id,
        email: data.email,
        displayName: data.name,
        firstName: data.given_name,
        lastName: data.family_name,
        profilePictureUrl: data.picture,
      };
    } catch (error) {
      this.logger.error('Failed to get Google user profile', error);
      throw new Error('Failed to get user profile');
    }
  }
}
