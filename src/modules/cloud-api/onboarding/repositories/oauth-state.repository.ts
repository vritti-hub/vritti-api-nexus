import { Injectable } from '@nestjs/common';
import { OAuthState, Prisma } from '@prisma/client';
import { PrimaryDatabaseService, PrimaryBaseRepository } from '@vritti/api-sdk';

/**
 * OAuth State Repository
 * CRUD operations for OAuthState model
 *
 * Manages OAuth state tokens stored in the primary database
 * Used for CSRF protection during OAuth flows
 */
@Injectable()
export class OAuthStateRepository extends PrimaryBaseRepository<
  OAuthState,
  Prisma.OAuthStateCreateInput,
  Prisma.OAuthStateUpdateInput
> {
  constructor(database: PrimaryDatabaseService) {
    super(database, (prisma) => prisma.oAuthState);
  }

  /**
   * Find OAuth state by state token
   * @param token - The signed state token
   * @returns OAuthState record or null if not found
   */
  async findByToken(token: string): Promise<OAuthState | null> {
    return this.findOne({
      where: { stateToken: token },
    });
  }

  /**
   * Delete expired OAuth states
   * @returns Object containing count of deleted records
   */
  async deleteExpired(): Promise<{ count: number }> {
    return this.model.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }
}
