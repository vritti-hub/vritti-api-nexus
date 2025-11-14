import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Request,
} from '@nestjs/common';
import { Onboarding, Public } from '@vritti/api-sdk';
import { OnboardingStatusResponseDto } from '../dto/onboarding-status-response.dto';
import { RegisterDto } from '../dto/register.dto';
import { SetPasswordDto } from '../dto/set-password.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { EmailVerificationService } from '../services/email-verification.service';
import { OnboardingService } from '../services/onboarding.service';

/**
 * Onboarding Controller
 * Handles user registration and email verification
 */
@Controller('onboarding')
export class OnboardingController {
  private readonly logger = new Logger(OnboardingController.name);

  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  /**
   * Register or resume onboarding (smart endpoint)
   * POST /onboarding/register
   * Requires CSRF token in X-CSRF-Token header
   */
  @Post('register')
  @Public()
  @HttpCode(HttpStatus.OK)
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<OnboardingStatusResponseDto> {
    this.logger.log(`POST /onboarding/register - Email: ${registerDto.email}`);
    return await this.onboardingService.register(registerDto);
  }

  /**
   * Verify email OTP
   * POST /onboarding/verify-email
   * Requires: Onboarding token in Authorization header + CSRF token
   */
  @Post('verify-email')
  @Onboarding()
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Request() req,
    @Body() verifyEmailDto: VerifyEmailDto,
  ): Promise<{ success: boolean; message: string }> {
    const userId = req.user.id;
    this.logger.log(`POST /onboarding/verify-email - User: ${userId}`);

    await this.emailVerificationService.verifyOtp(userId, verifyEmailDto.otp);

    return {
      success: true,
      message: 'Email verified successfully',
    };
  }

  /**
   * Resend email verification OTP
   * POST /onboarding/resend-email-otp
   * Requires: Onboarding token in Authorization header + CSRF token
   */
  @Post('resend-email-otp')
  @Onboarding()
  @HttpCode(HttpStatus.OK)
  async resendEmailOtp(
    @Request() req,
  ): Promise<{ success: boolean; message: string }> {
    const userId = req.user.id;
    this.logger.log(`POST /onboarding/resend-email-otp - User: ${userId}`);

    await this.emailVerificationService.resendOtp(userId);

    return {
      success: true,
      message: 'OTP sent successfully',
    };
  }

  /**
   * Get current onboarding status
   * GET /onboarding/status
   * Requires: Onboarding token in Authorization header
   */
  @Get('status')
  @Onboarding()
  async getStatus(@Request() req): Promise<OnboardingStatusResponseDto> {
    const userId = req.user.id;
    this.logger.log(`GET /onboarding/status - User: ${userId}`);

    return await this.onboardingService.getStatus(userId);
  }

  /**
   * Set password (OAuth users only)
   * POST /onboarding/set-password
   * Requires: Onboarding token in Authorization header + CSRF token
   */
  @Post('set-password')
  @Onboarding()
  @HttpCode(HttpStatus.OK)
  async setPassword(
    @Request() req,
    @Body() setPasswordDto: SetPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    const userId = req.user.id;
    this.logger.log(`POST /onboarding/set-password - User: ${userId}`);

    await this.onboardingService.setPassword(userId, setPasswordDto.password);

    return {
      success: true,
      message: 'Password set successfully',
    };
  }
}
