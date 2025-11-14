/**
 * Response DTO for OAuth authentication
 */
export class OAuthResponseDto {
  /** Onboarding JWT token for continuing onboarding */
  onboardingToken: string;

  /** User information */
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    onboardingStep: string;
    emailVerified: boolean;
  };

  /** Whether this is a new user or returning user */
  isNewUser: boolean;

  /** Whether user needs to set password (OAuth users) */
  requiresPasswordSetup: boolean;

  /**
   * Factory method to create OAuthResponseDto
   */
  static create(
    onboardingToken: string,
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      onboardingStep: string;
      emailVerified: boolean;
      passwordHash: string | null;
    },
    isNewUser: boolean,
  ): OAuthResponseDto {
    return {
      onboardingToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        onboardingStep: user.onboardingStep,
        emailVerified: user.emailVerified,
      },
      isNewUser,
      requiresPasswordSetup: !user.passwordHash,
    };
  }
}
