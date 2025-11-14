import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { getTokenExpiry, TokenType } from '../../../../config/jwt.config';
import { EncryptionService } from '../../../../services';
import { UserService } from '../../user/user.service';
import { OnboardingStatusResponseDto } from '../dto/onboarding-status-response.dto';
import { RegisterDto } from '../dto/register.dto';
import { EmailVerificationService } from './email-verification.service';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);
  private readonly tokenExpiry: ReturnType<typeof getTokenExpiry>;

  constructor(
    private readonly userService: UserService,
    private readonly encryptionService: EncryptionService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.tokenExpiry = getTokenExpiry(configService);
  }

  /**
   * Smart register endpoint - handles both new registration and resume
   * This is the main entry point for onboarding
   */
  async register(dto: RegisterDto): Promise<OnboardingStatusResponseDto> {
    const existingUser = await this.userService.findByEmail(dto.email);

    // Case 1: Onboarding complete → error
    if (existingUser?.onboardingComplete) {
      throw new BadRequestException('User Already Exists. Please login.');
    }

    // Case 2: Resume onboarding
    if (existingUser && !existingUser.onboardingComplete) {
      return await this.resumeOnboarding(existingUser, dto.password);
    }

    // Case 3: New user
    return await this.createNewUser(dto);
  }

  /**
   * Resume existing onboarding
   */
  private async resumeOnboarding(
    user: User,
    password: string,
  ): Promise<OnboardingStatusResponseDto> {
    // Skip password check if BOTH email AND mobile not verified
    const shouldSkipPasswordCheck = !user.emailVerified && !user.phoneVerified;

    if (!shouldSkipPasswordCheck && user.passwordHash) {
      const isPasswordValid = await this.encryptionService.comparePassword(
        password,
        user.passwordHash,
      );
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid password');
      }
    }

    // Generate onboarding token
    const onboardingToken = this.generateOnboardingToken(user.id);

    // Resend OTP if needed (based on current step)
    await this.resendOtpIfNeeded(user);

    this.logger.log(`Resuming onboarding for user: ${user.email} (${user.id})`);

    return OnboardingStatusResponseDto.fromUser(user, onboardingToken);
  }

  /**
   * Create new user and start onboarding
   */
  private async createNewUser(
    dto: RegisterDto,
  ): Promise<OnboardingStatusResponseDto> {
    // Hash password
    const passwordHash = await this.encryptionService.hashPassword(
      dto.password,
    );

    // Create user
    const userResponse = await this.userService.create(
      {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
      passwordHash,
    );

    // Send email verification OTP
    await this.emailVerificationService.sendVerificationOtp(
      userResponse.id,
      userResponse.email,
    );

    // Generate onboarding token
    const onboardingToken = this.generateOnboardingToken(userResponse.id);

    this.logger.log(
      `Created new user and started onboarding: ${userResponse.email} (${userResponse.id})`,
    );

    // Get fresh user data to return
    const user = await this.userService.findByEmail(dto.email);
    return OnboardingStatusResponseDto.fromUser(user!, onboardingToken);
  }

  /**
   * Generate onboarding JWT token
   */
  private generateOnboardingToken(userId: string): string {
    return this.jwtService.sign(
      {
        userId,
        type: TokenType.ONBOARDING,
      },
      {
        expiresIn: this.tokenExpiry.ONBOARDING as any,
      },
    );
  }

  /**
   * Resend OTP if needed based on current onboarding step
   */
  private async resendOtpIfNeeded(user: User): Promise<void> {
    switch (user.onboardingStep) {
      case 'EMAIL_VERIFICATION':
        if (!user.emailVerified) {
          await this.emailVerificationService.resendOtp(user.id);
        }
        break;
      case 'MOBILE_VERIFICATION':
        // TODO: Implement mobile verification resend in Phase 2
        this.logger.debug(`Mobile verification resend not yet implemented`);
        break;
      default:
        // No OTP needed for other steps
        break;
    }
  }

  /**
   * Get current onboarding status for a user
   */
  async getStatus(userId: string): Promise<OnboardingStatusResponseDto> {
    const userResponse = await this.userService.findById(userId);

    // Convert UserResponseDto back to User-like object for fromUser method
    const user = await this.userService.findByEmail(userResponse.email);

    return OnboardingStatusResponseDto.fromUser(user!);
  }

  /**
   * Set password for OAuth users
   * This is called after OAuth signup to set a password for the account
   */
  async setPassword(userId: string, password: string): Promise<void> {
    const user = await this.userService.findById(userId);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify user is on SET_PASSWORD step
    if (user.onboardingStep !== 'SET_PASSWORD') {
      throw new BadRequestException(
        'User is not on SET_PASSWORD onboarding step',
      );
    }

    // Verify user doesn't already have a password
    const fullUser = await this.userService.findByEmail(user.email);
    if (fullUser?.passwordHash) {
      throw new BadRequestException('User already has a password');
    }

    // Hash password
    const passwordHash = await this.encryptionService.hashPassword(password);

    // Update user with password and move to next onboarding step
    // await this.userService.updatePassword(userId, passwordHash);
    // await this.userService.updateOnboardingStep(
    //   userId,
    //   'MOBILE_VERIFICATION',
    // );

    this.logger.log(`Password set for OAuth user: ${user.email} (${userId})`);
  }
}
