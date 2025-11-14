import { Injectable } from '@nestjs/common';
import { OAuthProvider } from '@prisma/client';
import { PrimaryDatabaseService, PrimaryBaseRepository } from '@vritti/api-sdk';
import { OAuthUserProfile } from '../interfaces/oauth-user-profile.interface';

/**
 * OAuth Provider Repository
 * CRUD operations for OAuthProvider model
 *
 * For simple queries, use inherited methods from PrimaryBaseRepository:
 * - findOne({ where: { provider, userId } })
 * - findMany({ where: { userId } })
 * - delete(id)
 * - deleteMany({ where: { provider, userId } })
 */
@Injectable()
export class OAuthProviderRepository extends PrimaryBaseRepository<
  OAuthProvider,
  any,
  any
> {
  constructor(database: PrimaryDatabaseService) {
    super(database, (prisma) => prisma.oAuthProvider);
  }

  /**
   * Create or update OAuth provider
   * If provider already exists (by provider + providerId), update tokens and metadata
   * Otherwise, create a new OAuth provider record
   *
   * @param userId - The user ID to link the OAuth provider to
   * @param profile - OAuth user profile data from the provider
   * @param accessToken - OAuth access token
   * @param refreshToken - Optional OAuth refresh token
   * @param tokenExpiresAt - Optional token expiration date
   * @returns The created or updated OAuthProvider record
   */
  async upsert(
    userId: string,
    profile: OAuthUserProfile,
    accessToken: string,
    refreshToken?: string,
    tokenExpiresAt?: Date,
  ): Promise<OAuthProvider> {
    // Find existing OAuth provider by unique constraint (provider + providerId)
    const existing = await this.findOne({
      where: {
        provider_providerId: {
          provider: profile.provider,
          providerId: profile.providerId,
        },
      },
    });

    if (existing) {
      // Update existing provider with new tokens and profile data
      return this.model.update({
        where: { id: existing.id },
        data: {
          email: profile.email,
          displayName: profile.displayName,
          profilePictureUrl: profile.profilePictureUrl,
          accessToken,
          refreshToken,
          tokenExpiresAt,
          updatedAt: new Date(),
        },
      });
    }

    // Create new provider
    return this.model.create({
      data: {
        userId,
        provider: profile.provider,
        providerId: profile.providerId,
        email: profile.email,
        displayName: profile.displayName,
        profilePictureUrl: profile.profilePictureUrl,
        accessToken,
        refreshToken,
        tokenExpiresAt,
      },
    });
  }
}
