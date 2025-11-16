import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { ForbiddenException } from '@vritti/api-sdk';
import { Reflector } from '@nestjs/core';
import { AccountStatus } from '@prisma/client';

/**
 * Account Status Guard
 * Checks if user's account status matches required status
 * Use with @RequireAccountStatus decorator
 */
@Injectable()
export class AccountStatusGuard implements CanActivate {
  private readonly logger = new Logger(AccountStatusGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required statuses from decorator
    const requiredStatuses = this.reflector.get<AccountStatus[]>(
      'accountStatuses',
      context.getHandler(),
    );

    // If no required statuses specified, allow access
    if (!requiredStatuses || requiredStatuses.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // Set by JwtAuthGuard

    if (!user) {
      throw new ForbiddenException(
        'User not authenticated',
        'You must be logged in to access this resource.'
      );
    }

    // Check if user's account status matches required status
    if (!requiredStatuses.includes(user.accountStatus)) {
      this.logger.warn(
        `Access denied for user ${user.id}. Required: ${requiredStatuses.join(', ')}, Actual: ${user.accountStatus}`,
      );
      throw new ForbiddenException(
        `Account status must be ${requiredStatuses.join(' or ')}. Current status: ${user.accountStatus}`,
        `You don't have permission to access this resource. Your account status is ${user.accountStatus}.`
      );
    }

    return true;
  }
}
