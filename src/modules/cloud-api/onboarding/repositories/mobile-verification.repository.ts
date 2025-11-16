import { Injectable } from '@nestjs/common';
import { MobileVerification } from '@prisma/client';
import { PrimaryDatabaseService, PrimaryBaseRepository } from '@vritti/api-sdk';

@Injectable()
export class MobileVerificationRepository extends PrimaryBaseRepository<
  MobileVerification,
  any,
  any
> {
  constructor(database: PrimaryDatabaseService) {
    super(database, (prisma) => prisma.mobileVerification);
  }

  /**
   * Find the most recent non-verified mobile verification for a user
   */
  async findLatestByUserId(userId: string): Promise<MobileVerification | null> {
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
   * Find mobile verification by QR verification ID (token)
   */
  async findByVerificationId(
    qrVerificationId: string,
  ): Promise<MobileVerification | null> {
    return await this.model.findUnique({
      where: {
        qrVerificationId,
      },
    });
  }

  /**
   * Increment failed verification attempts
   */
  async incrementAttempts(id: string): Promise<MobileVerification> {
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
   * Mark mobile verification as verified and store phone number
   */
  async markAsVerified(
    id: string,
    phone: string,
    phoneCountry: string,
  ): Promise<MobileVerification> {
    return await this.model.update({
      where: { id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        phone,
        phoneCountry,
        qrScannedAt: new Date(),
      },
    });
  }

  /**
   * Delete expired mobile verifications
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

  /**
   * Check if a phone number is already verified by another user
   */
  async isPhoneVerifiedByOtherUser(
    phone: string,
    excludeUserId?: string,
  ): Promise<boolean> {
    const whereCondition: any = {
      phone,
      isVerified: true,
    };

    if (excludeUserId) {
      whereCondition.userId = {
        not: excludeUserId,
      };
    }

    const count = await this.model.count({
      where: whereCondition,
    });

    return count > 0;
  }
}
