import { IsString, MinLength, Matches } from 'class-validator';

/**
 * DTO for setting password (OAuth users only)
 */
export class SetPasswordDto {
  @IsString()
  @MinLength(8, {
    message: 'Password must be at least 8 characters long',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one lowercase letter, one uppercase letter, and one number',
  })
  password: string;
}
