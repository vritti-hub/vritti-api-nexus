import { Injectable, Logger } from '@nestjs/common';
import { UnauthorizedException } from '@vritti/api-sdk';
import { Session } from '@prisma/client';
import { SessionRepository } from '../repositories/session.repository';
import { JwtAuthService } from './jwt.service';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly jwtService: JwtAuthService,
  ) {}

  /**
   * Create a new session
   */
  async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    session: Session;
    accessToken: string;
    refreshToken: string;
  }> {
    // Generate tokens
    const accessToken = this.jwtService.generateAccessToken(userId);
    const refreshToken = this.jwtService.generateRefreshToken(userId);

    // Calculate expiry times
    const accessTokenExpiresAt = this.jwtService.getAccessTokenExpiryTime();
    const refreshTokenExpiresAt = this.jwtService.getRefreshTokenExpiryTime();

    // Create session
    const session = await this.sessionRepository.create({
      userId,
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      ipAddress,
      userAgent,
    });

    this.logger.log(`Created session for user: ${userId}`);

    return {
      session,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // Verify refresh token
    const payload = this.jwtService.verifyRefreshToken(refreshToken);

    // Find session by refresh token
    const session = await this.sessionRepository.findOne({
      where: { refreshToken },
    });

    if (!session || !session.isActive) {
      throw new UnauthorizedException(
        'Invalid or expired refresh token',
        'Your session has expired. Please log in again.'
      );
    }

    // Check if refresh token is expired
    if (new Date() > session.refreshTokenExpiresAt) {
      await this.sessionRepository.update(session.id, { isActive: false });
      throw new UnauthorizedException(
        'Refresh token expired. Please login again',
        'Your session has expired. Please log in again.'
      );
    }

    // Generate new access token
    const newAccessToken = this.jwtService.generateAccessToken(payload.userId);
    const newAccessTokenExpiresAt = this.jwtService.getAccessTokenExpiryTime();

    // Update session
    await this.sessionRepository.updateAccessToken(
      session.id,
      newAccessToken,
      newAccessTokenExpiresAt,
    );

    this.logger.log(`Refreshed access token for user: ${payload.userId}`);

    return {
      accessToken: newAccessToken,
      refreshToken: session.refreshToken, // Return same refresh token
    };
  }

  /**
   * Invalidate a session (logout)
   */
  async invalidateSession(accessToken: string): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { accessToken },
    });

    if (session) {
      await this.sessionRepository.update(session.id, { isActive: false });
      this.logger.log(`Invalidated session: ${session.id}`);
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllUserSessions(userId: string): Promise<number> {
    const count = await this.sessionRepository.invalidateAllByUserId(userId);
    this.logger.log(`Invalidated ${count} sessions for user: ${userId}`);
    return count;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserActiveSessions(userId: string): Promise<Session[]> {
    return await this.sessionRepository.findActiveByUserId(userId);
  }

  /**
   * Validate access token
   */
  async validateAccessToken(accessToken: string): Promise<Session> {
    const session = await this.sessionRepository.findOne({
      where: { accessToken },
    });

    if (!session || !session.isActive) {
      throw new UnauthorizedException(
        'Invalid or expired access token',
        'Your session is invalid or has expired. Please log in again.'
      );
    }

    // Check if access token is expired
    if (new Date() > session.accessTokenExpiresAt) {
      throw new UnauthorizedException(
        'Access token expired. Please refresh',
        'Your session has expired. Please refresh your access token.'
      );
    }

    return session;
  }
}
