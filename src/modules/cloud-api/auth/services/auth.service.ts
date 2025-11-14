import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { UserService } from '../../user/user.service';
import { UserResponseDto } from '../../user/dto/user-response.dto';
import { EncryptionService } from '../../../../services';
import { SessionService } from './session.service';
import { JwtAuthService } from './jwt.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly encryptionService: EncryptionService,
    private readonly sessionService: SessionService,
    private readonly jwtService: JwtAuthService,
  ) {}

  /**
   * User login
   * Only ACTIVE users can login
   */
  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    // Find user by email
    const user = await this.userService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if onboarding is complete
    if (!user.onboardingComplete) {
      throw new BadRequestException(
        'Please complete onboarding first. Use /onboarding/register to continue',
      );
    }

    // Only ACTIVE users can login
    if (user.accountStatus !== 'ACTIVE') {
      throw new UnauthorizedException(
        `Account is ${user.accountStatus.toLowerCase()}. Please contact support`,
      );
    }

    // Verify password
    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.encryptionService.comparePassword(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Create session and generate tokens
    const { accessToken, refreshToken } =
      await this.sessionService.createSession(user.id, ipAddress, userAgent);

    // Update last login timestamp
    await this.userService.updateLastLogin(user.id);

    this.logger.log(`User logged in: ${user.email} (${user.id})`);

    // Return auth response
    return new AuthResponseDto({
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.jwtService.getAccessTokenExpiryInSeconds(),
      user: UserResponseDto.fromPrisma(user),
    });
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    // Refresh access token
    const tokens = await this.sessionService.refreshAccessToken(refreshToken);

    // Verify token to get userId
    const payload = this.jwtService.verifyRefreshToken(refreshToken);

    // Get user
    const user = await this.userService.findByEmail(''); // We need user by ID
    const userResponse = await this.userService.findById(payload.userId);

    // Get fresh user data
    const freshUser = await this.userService.findByEmail(userResponse.email);

    this.logger.log(`Token refreshed for user: ${payload.userId}`);

    return new AuthResponseDto({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.jwtService.getAccessTokenExpiryInSeconds(),
      user: UserResponseDto.fromPrisma(freshUser!),
    });
  }

  /**
   * Logout - invalidate session
   */
  async logout(accessToken: string): Promise<void> {
    await this.sessionService.invalidateSession(accessToken);
    this.logger.log('User logged out');
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId: string): Promise<number> {
    const count = await this.sessionService.invalidateAllUserSessions(userId);
    this.logger.log(`User logged out from all devices: ${userId}`);
    return count;
  }

  /**
   * Validate user from JWT payload
   * Used by JWT strategy
   */
  async validateUser(userId: string): Promise<UserResponseDto> {
    const user = await this.userService.findById(userId);

    // Check if account is active
    if (user.accountStatus !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    return user;
  }
}
