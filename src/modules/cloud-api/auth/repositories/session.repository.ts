import { Injectable } from '@nestjs/common';
import { Session } from '@prisma/client';
import { PrimaryBaseRepository, PrimaryDatabaseService } from '@vritti/api-sdk';

@Injectable()
export class SessionRepository extends PrimaryBaseRepository<
  Session,
  any,
  any
> {
  constructor(database: PrimaryDatabaseService) {
    super(database, (prisma) => prisma.session);
  }

  /**
   * Find all active sessions for a user
   */
  async findActiveByUserId(userId: string): Promise<Session[]> {
    return await this.model.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Update session access token
   */
  async updateAccessToken(
    id: string,
    accessToken: string,
    accessTokenExpiresAt: Date,
  ): Promise<Session> {
    return await this.model.update({
      where: { id },
      data: {
        accessToken,
        accessTokenExpiresAt,
      },
    });
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllByUserId(userId: string): Promise<number> {
    const result = await this.model.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: { isActive: false },
    });

    return result.count;
  }

  /**
   * Delete expired sessions
   */
  async deleteExpired(): Promise<number> {
    const result = await this.model.deleteMany({
      where: {
        refreshTokenExpiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }
}
