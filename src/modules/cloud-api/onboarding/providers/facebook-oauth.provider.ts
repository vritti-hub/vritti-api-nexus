import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthProviderType } from '@prisma/client';
import axios from 'axios';
import { IOAuthProvider } from '../interfaces/oauth-provider.interface';
import { OAuthTokens } from '../interfaces/oauth-tokens.interface';
import { OAuthUserProfile } from '../interfaces/oauth-user-profile.interface';

/**
 * Facebook OAuth 2.0 Provider
 * Implements OAuth flow for Facebook authentication
 */
@Injectable()
export class FacebookOAuthProvider implements IOAuthProvider {
  private readonly logger = new Logger(FacebookOAuthProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  private readonly AUTHORIZATION_URL =
    'https://www.facebook.com/v18.0/dialog/oauth';
  private readonly TOKEN_URL =
    'https://graph.facebook.com/v18.0/oauth/access_token';
  private readonly USER_INFO_URL = 'https://graph.facebook.com/v18.0/me';

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.getOrThrow<string>('FACEBOOK_CLIENT_ID');
    this.clientSecret = this.configService.getOrThrow<string>(
      'FACEBOOK_CLIENT_SECRET',
    );
    this.redirectUri = this.configService.getOrThrow<string>(
      'FACEBOOK_CALLBACK_URL',
    );
  }

  /**
   * Get Facebook authorization URL
   */
  getAuthorizationUrl(state: string, codeChallenge?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'email public_profile',
      state,
    });

    // Add PKCE if code challenge provided
    if (codeChallenge) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    const url = `${this.AUTHORIZATION_URL}?${params.toString()}`;
    this.logger.debug('Generated Facebook authorization URL');
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
      const params: any = {
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
      };

      // Add PKCE verifier if provided
      if (codeVerifier) {
        params.code_verifier = codeVerifier;
      }

      const response = await axios.get(this.TOKEN_URL, { params });

      this.logger.log('Successfully exchanged Facebook authorization code');

      return {
        accessToken: response.data.access_token,
        tokenType: response.data.token_type || 'bearer',
        expiresIn: response.data.expires_in,
      };
    } catch (error) {
      this.logger.error(
        'Failed to exchange Facebook authorization code',
        error,
      );
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Get user profile from Facebook Graph API
   */
  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      const response = await axios.get(this.USER_INFO_URL, {
        params: {
          fields: 'id,email,first_name,last_name,name,picture',
          access_token: accessToken,
        },
      });

      const data = response.data;

      this.logger.log(`Retrieved Facebook profile for user: ${data.email}`);

      return {
        provider: OAuthProviderType.FACEBOOK,
        providerId: data.id,
        email: data.email,
        displayName: data.name,
        firstName: data.first_name,
        lastName: data.last_name,
        profilePictureUrl: data.picture?.data?.url,
      };
    } catch (error) {
      this.logger.error('Failed to get Facebook user profile', error);
      throw new Error('Failed to get user profile');
    }
  }
}
