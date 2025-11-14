import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../services/auth.service';
import { UserResponseDto } from '../../user/dto/user-response.dto';
import { TokenType } from '../../../../config/jwt.config';

/**
 * JWT Strategy for Passport
 * Validates access tokens and attaches user to request
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Validate JWT payload
   * This method is called automatically by Passport after token verification
   */
  async validate(payload: any): Promise<UserResponseDto> {
    // Check token type
    if (payload.type !== TokenType.ACCESS) {
      throw new UnauthorizedException(
        'Invalid token type. Expected access token',
      );
    }

    // Validate user exists and is active
    const user = await this.authService.validateUser(payload.userId);

    this.logger.debug(`JWT validated for user: ${user.id}`);

    return user;
  }
}
