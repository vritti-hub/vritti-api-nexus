import { OAuthTokens } from './oauth-tokens.interface';
import { OAuthUserProfile } from './oauth-user-profile.interface';

/**
 * Common interface for all OAuth providers
 * Each provider (Google, Microsoft, Apple, Facebook, X) implements this
 */
export interface IOAuthProvider {
  /**
   * Get authorization URL for OAuth flow
   * @param state - CSRF state token
   * @param codeChallenge - PKCE code challenge (optional, for OAuth 2.1)
   * @returns Authorization URL to redirect user to
   */
  getAuthorizationUrl(state: string, codeChallenge?: string): string;

  /**
   * Exchange authorization code for access tokens
   * @param code - Authorization code from callback
   * @param codeVerifier - PKCE code verifier (optional, for OAuth 2.1)
   * @returns OAuth tokens (access, refresh, etc.)
   */
  exchangeCodeForToken(
    code: string,
    codeVerifier?: string,
  ): Promise<OAuthTokens>;

  /**
   * Get user profile using access token
   * @param accessToken - OAuth access token
   * @returns Normalized user profile
   */
  getUserProfile(accessToken: string): Promise<OAuthUserProfile>;
}
