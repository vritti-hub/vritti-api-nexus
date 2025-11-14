import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EncryptionService } from '../../../../services';

/**
 * OTP Service
 * Handles OTP generation and validation logic
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly OTP_EXPIRY_MINUTES = 5;
  private readonly MAX_ATTEMPTS = 3;

  constructor(private readonly encryptionService: EncryptionService) {}

  /**
   * Generate a new 6-digit OTP
   */
  generateOtp(): string {
    return this.encryptionService.generateOtp();
  }

  /**
   * Hash an OTP for storage
   */
  async hashOtp(otp: string): Promise<string> {
    return await this.encryptionService.hashOtp(otp);
  }

  /**
   * Verify an OTP against a hashed OTP
   */
  async verifyOtp(plainOtp: string, hashedOtp: string): Promise<boolean> {
    return await this.encryptionService.compareOtp(plainOtp, hashedOtp);
  }

  /**
   * Calculate OTP expiry time
   */
  getOtpExpiryTime(): Date {
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + this.OTP_EXPIRY_MINUTES);
    return expiryTime;
  }

  /**
   * Check if OTP has expired
   */
  isOtpExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  /**
   * Check if max attempts exceeded
   */
  isMaxAttemptsExceeded(attempts: number): boolean {
    return attempts >= this.MAX_ATTEMPTS;
  }

  /**
   * Validate OTP attempts and expiry
   * Throws BadRequestException if validation fails
   */
  validateOtpAttempt(verification: {
    attempts: number;
    expiresAt: Date;
    isVerified: boolean;
  }): void {
    // Check if already verified
    if (verification.isVerified) {
      throw new BadRequestException('OTP already verified');
    }

    // Check if expired
    if (this.isOtpExpired(verification.expiresAt)) {
      throw new BadRequestException(
        'OTP has expired. Please request a new one',
      );
    }

    // Check if max attempts exceeded
    if (this.isMaxAttemptsExceeded(verification.attempts)) {
      throw new BadRequestException(
        'Maximum verification attempts exceeded. Please request a new OTP',
      );
    }
  }
}
