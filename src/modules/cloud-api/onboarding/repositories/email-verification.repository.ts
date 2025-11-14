import { Injectable } from '@nestjs/common';
import { EmailVerification } from '@prisma/client';
import { PrimaryDatabaseService, PrimaryBaseRepository } from '@vritti/api-sdk';

@Injectable()
export class EmailVerificationRepository extends PrimaryBaseRepository<
  EmailVerification,
  any,
  any
> {
  constructor(database: PrimaryDatabaseService) {
    super(database, (prisma) => prisma.emailVerification);
  }

  /**
   * Find the most recent non-verified email verification for a user
   */
  async findLatestByUserId(userId: string): Promise<EmailVerification | null> {
    return await this.model.findFirst({
      where: {
        userId,
        isVerified: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Increment failed verification attempts
   */
  async incrementAttempts(id: string): Promise<EmailVerification> {
    return await this.model.update({
      where: { id },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Mark email verification as verified
   */
  async markAsVerified(id: string): Promise<EmailVerification> {
    return await this.model.update({
      where: { id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
  }

  /**
   * Delete expired email verifications
   */
  async deleteExpired(): Promise<number> {
    const result = await this.model.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        isVerified: false,
      },
    });

    return result.count;
  }
}
