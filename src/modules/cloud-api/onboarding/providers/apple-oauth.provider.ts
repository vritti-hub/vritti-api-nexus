import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuthProviderType } from '@prisma/client';
import axios from 'axios';
import * as crypto from 'crypto';
import { IOAuthProvider } from '../interfaces/oauth-provider.interface';
import { OAuthTokens } from '../interfaces/oauth-tokens.interface';
import { OAuthUserProfile } from '../interfaces/oauth-user-profile.interface';

/**
 * Apple OAuth 2.0 Provider (Sign in with Apple)
 * Implements OAuth flow for Apple authentication
 * Note: Apple uses JWT-based client secret instead of static secret
 */
@Injectable()
export class AppleOAuthProvider implements IOAuthProvider {
  private readonly logger = new Logger(AppleOAuthProvider.name);
  private readonly clientId: string;
  private readonly teamId: string;
  private readonly keyId: string;
  private readonly privateKey: string;
  private readonly redirectUri: string;

  private readonly AUTHORIZATION_URL =
    'https://appleid.apple.com/auth/authorize';
  private readonly TOKEN_URL = 'https://appleid.apple.com/auth/token';

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.clientId = this.configService.getOrThrow<string>('APPLE_CLIENT_ID');
    this.teamId = this.configService.getOrThrow<string>('APPLE_TEAM_ID');
    this.keyId = this.configService.getOrThrow<string>('APPLE_KEY_ID');
    this.privateKey =
      this.configService.getOrThrow<string>('APPLE_PRIVATE_KEY');
    this.redirectUri =
      this.configService.getOrThrow<string>('APPLE_CALLBACK_URL');
  }

  /**
   * Get Apple authorization URL
   */
  getAuthorizationUrl(state: string, codeChallenge?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'name email',
      response_mode: 'form_post', // Apple recommends form_post
      state,
    });

    // Add PKCE if code challenge provided
    if (codeChallenge) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    const url = `${this.AUTHORIZATION_URL}?${params.toString()}`;
    this.logger.debug('Generated Apple authorization URL');
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
      // Generate client secret JWT
      const clientSecret = this.generateClientSecret();

      const data: any = {
        code,
        client_id: this.clientId,
        client_secret: clientSecret,
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

      this.logger.log('Successfully exchanged Apple authorization code');

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        tokenType: response.data.token_type,
        expiresIn: response.data.expires_in,
        idToken: response.data.id_token,
      };
    } catch (error) {
      this.logger.error('Failed to exchange Apple authorization code', error);
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Get user profile from Apple ID token
   * Apple does not provide a user info endpoint, so we decode the ID token
   */
  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      // Apple doesn't have a user info endpoint
      // We need to decode the ID token from the initial response
      // In practice, the ID token is passed separately in the OAuth flow
      // For now, we'll assume the accessToken is the ID token

      const decoded: any = this.jwtService.decode(accessToken);

      if (!decoded) {
        throw new Error('Failed to decode Apple ID token');
      }

      this.logger.log(`Retrieved Apple profile for user: ${decoded.email}`);

      // Apple doesn't provide first/last name in subsequent logins
      // They're only provided in the initial authorization response
      return {
        provider: OAuthProviderType.APPLE,
        providerId: decoded.sub,
        email: decoded.email,
        displayName: decoded.email, // Apple doesn't provide name after first auth
        firstName: undefined,
        lastName: undefined,
        profilePictureUrl: undefined,
      };
    } catch (error) {
      this.logger.error('Failed to get Apple user profile', error);
      throw new Error('Failed to get user profile');
    }
  }

  /**
   * Generate Apple client secret JWT
   * Apple requires a signed JWT as client secret with ES256 algorithm
   * We manually create the JWT since NestJS JwtService doesn't support ES256
   */
  private generateClientSecret(): string {
    const now = Math.floor(Date.now() / 1000);

    // Create JWT header
    const header = {
      alg: 'ES256',
      kid: this.keyId,
    };

    // Create JWT payload
    const payload = {
      iss: this.teamId,
      iat: now,
      exp: now + 15777000, // 6 months (max allowed)
      aud: 'https://appleid.apple.com',
      sub: this.clientId,
    };

    // Base64URL encode header and payload
    const headerB64 = this.base64URLEncode(JSON.stringify(header));
    const payloadB64 = this.base64URLEncode(JSON.stringify(payload));
    const token = `${headerB64}.${payloadB64}`;

    // Sign with ES256 (ECDSA with SHA-256)
    const sign = crypto.createSign('SHA256');
    sign.update(token);
    sign.end();

    const signature = sign.sign(this.privateKey, 'base64');
    const signatureB64 = this.base64URLEncode(Buffer.from(signature, 'base64'));

    return `${token}.${signatureB64}`;
  }

  /**
   * Base64URL encode (RFC 4648)
   */
  private base64URLEncode(data: string | Buffer): string {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
