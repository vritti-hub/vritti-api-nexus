import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { WhatsAppService } from '../../../../services';
import { UserService } from '../../user/user.service';
import {
  InitiateMobileVerificationDto,
  MobileVerificationMethod,
} from '../dto/initiate-mobile-verification.dto';
import { MobileVerificationStatusResponseDto } from '../dto/mobile-verification-status-response.dto';
import { MobileVerificationRepository } from '../repositories/mobile-verification.repository';

/**
 * Mobile Verification Service
 * Handles WhatsApp-based phone number verification
 */
@Injectable()
export class MobileVerificationService {
  private readonly logger = new Logger(MobileVerificationService.name);
  private readonly verificationExpiryMinutes = 10; // 10 minutes
  private readonly maxAttempts = 5;

  constructor(
    private readonly mobileVerificationRepository: MobileVerificationRepository,
    private readonly whatsappService: WhatsAppService,
    private readonly userService: UserService,
  ) {}

  /**
   * Initiate mobile verification for a user
   * Generates a verification token and sends it via WhatsApp
   *
   * @param userId User ID
   * @param method Verification method (default: WHATSAPP_QR)
   * @returns Verification status with token
   */
  async initiateVerification(
    userId: string,
    dto: InitiateMobileVerificationDto,
  ): Promise<MobileVerificationStatusResponseDto> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if already verified
    if (user.phoneVerified) {
      throw new BadRequestException('Phone number already verified');
    }

    // Check for existing pending verification
    const existingVerification =
      await this.mobileVerificationRepository.findLatestByUserId(userId);

    // If exists and not expired, return existing token
    if (
      existingVerification &&
      !existingVerification.isVerified &&
      existingVerification.expiresAt > new Date()
    ) {
      this.logger.log(
        `Reusing existing verification for user ${userId}: ${existingVerification.qrVerificationId}`,
      );

      return this.buildStatusResponse(existingVerification);
    }

    // Generate verification token
    const verificationToken = this.generateVerificationToken();

    // Create verification record
    const verification = await this.mobileVerificationRepository.create({
      userId,
      phone: '', // Will be populated from webhook
      phoneCountry: '', // Will be populated from webhook
      method: dto.method || MobileVerificationMethod.WHATSAPP_QR,
      qrVerificationId: verificationToken,
      isVerified: false,
      attempts: 0,
      expiresAt: new Date(
        Date.now() + this.verificationExpiryMinutes * 60 * 1000,
      ),
    });

    this.logger.log(
      `Created mobile verification for user ${userId} with token ${verificationToken}`,
    );

    // Send WhatsApp message
    // Note: For testing, use the user's WhatsApp number if provided
    // In production, you'll need to collect the phone number first
    // For now, we'll skip sending and just return the token
    // The user will manually send the token to your WhatsApp Business number

    /*
    // Uncomment when you have the user's phone number
    if (user.phone) {
      try {
        await this.whatsappService.sendVerificationMessage(
          user.phone,
          verificationToken,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send WhatsApp message: ${error.message}`,
        );
        // Don't throw - user can still verify manually
      }
    }
    */

    return this.buildStatusResponse(verification);
  }

  /**
   * Verify mobile number from WhatsApp webhook
   * Called when user sends verification token via WhatsApp
   *
   * @param verificationToken Token sent by user
   * @param phoneNumber Phone number from webhook (E.164 format)
   * @returns true if verification successful
   */
  async verifyFromWebhook(
    verificationToken: string,
    phoneNumber: string,
  ): Promise<boolean> {
    // Find verification by token
    const verification =
      await this.mobileVerificationRepository.findByVerificationId(
        verificationToken,
      );

    if (!verification) {
      this.logger.warn(`Verification not found for token: ${verificationToken}`);
      return false;
    }

    // Check if already verified
    if (verification.isVerified) {
      this.logger.warn(
        `Verification already completed for token: ${verificationToken}`,
      );
      return false;
    }

    // Check expiry
    if (verification.expiresAt < new Date()) {
      this.logger.warn(`Verification expired for token: ${verificationToken}`);
      return false;
    }

    // Check max attempts
    if (verification.attempts >= this.maxAttempts) {
      this.logger.warn(
        `Max attempts exceeded for verification: ${verification.id}`,
      );
      return false;
    }

    // Check if phone is already verified by another user
    const phoneAlreadyUsed =
      await this.mobileVerificationRepository.isPhoneVerifiedByOtherUser(
        phoneNumber,
        verification.userId,
      );

    if (phoneAlreadyUsed) {
      this.logger.warn(
        `Phone number ${phoneNumber} already verified by another user`,
      );
      return false;
    }

    // Normalize phone number
    const normalizedPhone = this.whatsappService.normalizePhoneNumber(phoneNumber);

    // Extract country code
    const phoneCountry =
      this.whatsappService.extractCountryCode(normalizedPhone);

    // Mark as verified
    await this.mobileVerificationRepository.markAsVerified(
      verification.id,
      normalizedPhone,
      phoneCountry,
    );

    // Update user
    await this.userService.markPhoneVerified(
      verification.userId,
      normalizedPhone,
      phoneCountry,
    );

    this.logger.log(
      `Successfully verified phone ${normalizedPhone} for user ${verification.userId}`,
    );

    return true;
  }

  /**
   * Get verification status for a user
   *
   * @param userId User ID
   * @returns Verification status
   */
  async getVerificationStatus(
    userId: string,
  ): Promise<MobileVerificationStatusResponseDto> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const verification =
      await this.mobileVerificationRepository.findLatestByUserId(userId);

    if (!verification) {
      throw new NotFoundException(
        'No mobile verification found. Please initiate verification first.',
      );
    }

    return this.buildStatusResponse(verification);
  }

  /**
   * Resend verification (generate new token and send)
   *
   * @param userId User ID
   * @returns New verification status
   */
  async resendVerification(
    userId: string,
  ): Promise<MobileVerificationStatusResponseDto> {
    // Delete existing pending verification
    const existing =
      await this.mobileVerificationRepository.findLatestByUserId(userId);
    if (existing && !existing.isVerified) {
      await this.mobileVerificationRepository.delete(existing.id);
    }

    // Create new verification
    return this.initiateVerification(userId, {
      method: MobileVerificationMethod.WHATSAPP_QR,
    });
  }

  /**
   * Generate a short, easy-to-type verification token
   * Format: VER-XXXXXX (6 alphanumeric characters)
   */
  private generateVerificationToken(): string {
    const randomBytes = crypto.randomBytes(3);
    const token = randomBytes.toString('hex').toUpperCase();
    return `VER${token}`;
  }

  /**
   * Build status response DTO
   */
  private buildStatusResponse(
    verification: any,
  ): MobileVerificationStatusResponseDto {
    const isExpired = verification.expiresAt < new Date();

    return {
      verificationId: verification.id,
      method: verification.method,
      verificationToken: verification.qrVerificationId,
      isVerified: verification.isVerified,
      phone: verification.isVerified ? verification.phone : undefined,
      expiresAt: verification.expiresAt,
      message: verification.isVerified
        ? 'Phone number verified successfully'
        : isExpired
          ? 'Verification expired. Please request a new verification.'
          : 'Waiting for verification',
      instructions: verification.isVerified
        ? undefined
        : `Send the verification code "${verification.qrVerificationId}" to our WhatsApp Business number to verify your phone.`,
    };
  }
}
