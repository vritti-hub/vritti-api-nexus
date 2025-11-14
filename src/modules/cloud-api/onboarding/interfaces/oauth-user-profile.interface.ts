import { OAuthProviderType } from '@prisma/client';

/**
 * Normalized user profile from OAuth providers
 */
export interface OAuthUserProfile {
  /** Provider type */
  provider: OAuthProviderType;

  /** Unique ID from provider */
  providerId: string;

  /** User's email (verified by provider) */
  email: string;

  /** User's display name */
  displayName?: string;

  /** User's first name */
  firstName?: string;

  /** User's last name */
  lastName?: string;

  /** Profile picture URL */
  profilePictureUrl?: string;
}
