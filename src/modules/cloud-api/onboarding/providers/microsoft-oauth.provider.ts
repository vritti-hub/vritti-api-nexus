import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthProviderType } from '@prisma/client';
import axios from 'axios';
import { IOAuthProvider } from '../interfaces/oauth-provider.interface';
import { OAuthTokens } from '../interfaces/oauth-tokens.interface';
import { OAuthUserProfile } from '../interfaces/oauth-user-profile.interface';

/**
 * Microsoft OAuth 2.0 Provider (Azure AD / Microsoft Account)
 * Implements OAuth flow for Microsoft authentication
 */
@Injectable()
export class MicrosoftOAuthProvider implements IOAuthProvider {
  private readonly logger = new Logger(MicrosoftOAuthProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  private readonly AUTHORIZATION_URL =
    'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
  private readonly TOKEN_URL =
    'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  private readonly USER_INFO_URL = 'https://graph.microsoft.com/v1.0/me';

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.getOrThrow<string>(
      'MICROSOFT_CLIENT_ID',
    );
    this.clientSecret = this.configService.getOrThrow<string>(
      'MICROSOFT_CLIENT_SECRET',
    );
    this.redirectUri = this.configService.getOrThrow<string>(
      'MICROSOFT_CALLBACK_URL',
    );
  }

  /**
   * Get Microsoft authorization URL
   */
  getAuthorizationUrl(state: string, codeChallenge?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile User.Read',
      state,
      response_mode: 'query',
    });

    // Add PKCE if code challenge provided
    if (codeChallenge) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    const url = `${this.AUTHORIZATION_URL}?${params.toString()}`;
    this.logger.debug('Generated Microsoft authorization URL');
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

      this.logger.log('Successfully exchanged Microsoft authorization code');

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        tokenType: response.data.token_type,
        expiresIn: response.data.expires_in,
        idToken: response.data.id_token,
      };
    } catch (error) {
      this.logger.error(
        'Failed to exchange Microsoft authorization code',
        error,
      );
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Get user profile from Microsoft Graph API
   */
  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      const response = await axios.get(this.USER_INFO_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = response.data;

      this.logger.log(
        `Retrieved Microsoft profile for user: ${data.userPrincipalName}`,
      );

      return {
        provider: OAuthProviderType.MICROSOFT,
        providerId: data.id,
        email: data.userPrincipalName || data.mail,
        displayName: data.displayName,
        firstName: data.givenName,
        lastName: data.surname,
        profilePictureUrl: undefined, // Microsoft Graph API requires separate call for photo
      };
    } catch (error) {
      this.logger.error('Failed to get Microsoft user profile', error);
      throw new Error('Failed to get user profile');
    }
  }
}
