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
import { FastifyRequest } from 'fastify';
import { Onboarding, Public } from '@vritti/api-sdk';
import { InitiateMobileVerificationDto } from '../dto/initiate-mobile-verification.dto';
import { MobileVerificationStatusResponseDto } from '../dto/mobile-verification-status-response.dto';
import { OnboardingStatusResponseDto } from '../dto/onboarding-status-response.dto';
import { RegisterDto } from '../dto/register.dto';
import { SetPasswordDto } from '../dto/set-password.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { EmailVerificationService } from '../services/email-verification.service';
import { MobileVerificationService } from '../services/mobile-verification.service';
import { OnboardingService } from '../services/onboarding.service';

/**
 * Authenticated request interface with user information
 */
interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    email: string;
    type: string;
  };
}

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
    private readonly mobileVerificationService: MobileVerificationService,
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
    @Request() req: AuthenticatedRequest,
    @Body() verifyEmailDto: VerifyEmailDto,
  ): Promise<{ success: boolean; message: string }> {
    const userId: string = req.user.id;
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
    @Request() req: AuthenticatedRequest,
  ): Promise<{ success: boolean; message: string }> {
    const userId: string = req.user.id;
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
  async getStatus(
    @Request() req: AuthenticatedRequest,
  ): Promise<OnboardingStatusResponseDto> {
    const userId: string = req.user.id;
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
    @Request() req: AuthenticatedRequest,
    @Body() setPasswordDto: SetPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    const userId: string = req.user.id;
    const password: string = setPasswordDto.password;
    this.logger.log(`POST /onboarding/set-password - User: ${userId}`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await this.onboardingService.setPassword(userId, password);

    return {
      success: true,
      message: 'Password set successfully',
    };
  }

  /**
   * Initiate mobile verification
   * POST /onboarding/mobile-verification/initiate
   * Requires: Onboarding token in Authorization header + CSRF token
   */
  @Post('mobile-verification/initiate')
  @Onboarding()
  @HttpCode(HttpStatus.OK)
  async initiateMobileVerification(
    @Request() req: AuthenticatedRequest,
    @Body() dto: InitiateMobileVerificationDto,
  ): Promise<MobileVerificationStatusResponseDto> {
    const userId: string = req.user.id;
    this.logger.log(
      `POST /onboarding/mobile-verification/initiate - User: ${userId}`,
    );

    return await this.mobileVerificationService.initiateVerification(
      userId,
      dto,
    );
  }

  /**
   * Get mobile verification status
   * GET /onboarding/mobile-verification/status
   * Requires: Onboarding token in Authorization header
   */
  @Get('mobile-verification/status')
  @Onboarding()
  async getMobileVerificationStatus(
    @Request() req: AuthenticatedRequest,
  ): Promise<MobileVerificationStatusResponseDto> {
    const userId: string = req.user.id;
    this.logger.log(
      `GET /onboarding/mobile-verification/status - User: ${userId}`,
    );

    return await this.mobileVerificationService.getVerificationStatus(userId);
  }

  /**
   * Resend mobile verification
   * POST /onboarding/mobile-verification/resend
   * Requires: Onboarding token in Authorization header + CSRF token
   */
  @Post('mobile-verification/resend')
  @Onboarding()
  @HttpCode(HttpStatus.OK)
  async resendMobileVerification(
    @Request() req: AuthenticatedRequest,
  ): Promise<MobileVerificationStatusResponseDto> {
    const userId: string = req.user.id;
    this.logger.log(
      `POST /onboarding/mobile-verification/resend - User: ${userId}`,
    );

    return await this.mobileVerificationService.resendVerification(userId);
  }
}
