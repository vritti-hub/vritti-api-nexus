/**
 * OAuth token response from provider
 */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn?: number;
  idToken?: string; // For OpenID Connect providers
}

/**
 * OAuth token exchange request
 */
export interface OAuthTokenRequest {
  code: string;
  clientId: string;
  clientSecret?: string; // Not used for PKCE flow
  redirectUri: string;
  grantType: 'authorization_code';
  codeVerifier?: string; // For PKCE
}
