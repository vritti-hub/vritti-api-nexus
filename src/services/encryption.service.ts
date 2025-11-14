import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

/**
 * Encryption Service for password and OTP hashing
 * Uses bcrypt for secure one-way hashing
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly saltRounds = 10;

  /**
   * Hash a password using bcrypt
   * @param password - Plain text password to hash
   * @returns Hashed password
   */
  async hashPassword(password: string): Promise<string> {
    try {
      const hash = await bcrypt.hash(password, this.saltRounds);
      return hash;
    } catch (error) {
      this.logger.error('Failed to hash password:', error);
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Compare plain text password with hashed password
   * @param password - Plain text password
   * @param hash - Hashed password to compare against
   * @returns True if passwords match, false otherwise
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    try {
      const isMatch = await bcrypt.compare(password, hash);
      return isMatch;
    } catch (error) {
      this.logger.error('Failed to compare password:', error);
      throw new Error('Password comparison failed');
    }
  }

  /**
   * Hash an OTP using bcrypt
   * @param otp - Plain text OTP to hash
   * @returns Hashed OTP
   */
  async hashOtp(otp: string): Promise<string> {
    try {
      const hash = await bcrypt.hash(otp, this.saltRounds);
      return hash;
    } catch (error) {
      this.logger.error('Failed to hash OTP:', error);
      throw new Error('OTP hashing failed');
    }
  }

  /**
   * Compare plain text OTP with hashed OTP
   * @param otp - Plain text OTP
   * @param hash - Hashed OTP to compare against
   * @returns True if OTPs match, false otherwise
   */
  async compareOtp(otp: string, hash: string): Promise<boolean> {
    try {
      const isMatch = await bcrypt.compare(otp, hash);
      return isMatch;
    } catch (error) {
      this.logger.error('Failed to compare OTP:', error);
      throw new Error('OTP comparison failed');
    }
  }

  /**
   * Generate a random 6-digit OTP
   * @returns 6-digit OTP string
   */
  generateOtp(): string {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    return otp;
  }
}
