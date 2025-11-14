import { AccountStatus, OnboardingStep } from '@prisma/client';

export class OnboardingStatusResponseDto {
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;

  // Onboarding progress
  currentStep: OnboardingStep;
  onboardingComplete: boolean;
  accountStatus: AccountStatus;

  // Verification status
  emailVerified: boolean;
  phoneVerified: boolean;

  // Token for continuing onboarding
  onboardingToken?: string;

  constructor(partial: Partial<OnboardingStatusResponseDto>) {
    Object.assign(this, partial);
  }

  /**
   * Create from Prisma User model
   */
  static fromUser(
    user: any,
    onboardingToken?: string,
  ): OnboardingStatusResponseDto {
    return new OnboardingStatusResponseDto({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      currentStep: user.onboardingStep,
      onboardingComplete: user.onboardingComplete,
      accountStatus: user.accountStatus,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      onboardingToken,
    });
  }
}
