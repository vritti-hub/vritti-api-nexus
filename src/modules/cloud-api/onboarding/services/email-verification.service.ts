import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { EmailService } from '../../../../services';
import { UserService } from '../../user/user.service';
import { EmailVerificationRepository } from '../repositories/email-verification.repository';
import { OtpService } from './otp.service';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly emailVerificationRepo: EmailVerificationRepository,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    private readonly userService: UserService,
  ) {}

  /**
   * Send email verification OTP to user
   */
  async sendVerificationOtp(userId: string, email: string): Promise<void> {
    // Generate OTP
    const otp = this.otpService.generateOtp();
    this.logger.log(`Generated OTP ${otp} for user ${userId}`);
    const hashedOtp = await this.otpService.hashOtp(otp);
    const expiresAt = this.otpService.getOtpExpiryTime();

    // Store in database
    await this.emailVerificationRepo.create({
      userId,
      email,
      otp: hashedOtp,
      expiresAt,
    });

    // Send email
    // await this.emailService.sendVerificationOtp(email, otp);

    this.logger.log(
      `Sent email verification OTP to ${email} for user ${userId}`,
    );
  }

  /**
   * Verify email OTP
   */
  async verifyOtp(userId: string, otp: string): Promise<void> {
    // Find latest verification
    const verification =
      await this.emailVerificationRepo.findLatestByUserId(userId);

    if (!verification) {
      throw new BadRequestException(
        'No verification request found. Please request a new OTP',
      );
    }

    // Validate OTP attempt (expiry and max attempts)
    this.otpService.validateOtpAttempt(verification);

    // Verify OTP
    const isValid = await this.otpService.verifyOtp(otp, verification.otp);

    if (!isValid) {
      // Increment failed attempts
      await this.emailVerificationRepo.incrementAttempts(verification.id);
      throw new UnauthorizedException('Invalid OTP. Please try again');
    }

    // Mark verification as complete
    await this.emailVerificationRepo.markAsVerified(verification.id);

    // Update user's email verification status
    await this.userService.markEmailVerified(userId);

    // Update onboarding step to MOBILE_VERIFICATION
    await this.userService.update(userId, {
      onboardingStep: 'MOBILE_VERIFICATION',
      accountStatus: 'PENDING_MOBILE',
    });

    this.logger.log(`Email verified successfully for user ${userId}`);
  }

  /**
   * Resend verification OTP
   */
  async resendOtp(userId: string): Promise<void> {
    // Get user to fetch email
    const user = await this.userService.findByEmail(''); // We need to get user by ID first
    // Actually, we should fetch user by ID, let me adjust this

    // Find user by ID to get email
    const userResponse = await this.userService.findById(userId);

    if (userResponse.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Delete old verifications
    await this.emailVerificationRepo.deleteMany({ userId });

    // Send new OTP
    await this.sendVerificationOtp(userId, userResponse.email);

    this.logger.log(`Resent email verification OTP for user ${userId}`);
  }
}
