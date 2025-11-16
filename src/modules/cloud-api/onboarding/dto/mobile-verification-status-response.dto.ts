import { MobileVerificationMethod } from './initiate-mobile-verification.dto';

/**
 * Response DTO for mobile verification status
 * Contains verification details and current status
 */
export class MobileVerificationStatusResponseDto {
  /**
   * Unique verification ID
   */
  verificationId: string;

  /**
   * Verification method being used
   */
  method: MobileVerificationMethod;

  /**
   * Verification token to be sent via WhatsApp
   * User should reply with this token
   */
  verificationToken?: string;

  /**
   * Whether the verification is complete
   */
  isVerified: boolean;

  /**
   * Verified phone number (only after verification)
   */
  phone?: string;

  /**
   * Verification expiration timestamp
   */
  expiresAt: Date;

  /**
   * Current status message
   */
  message: string;

  /**
   * Instructions for the user
   */
  instructions?: string;
}
