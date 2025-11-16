import { IsEnum, IsOptional } from 'class-validator';

/**
 * Mobile verification method enum
 * Matches the Prisma VerificationMethod enum
 */
export enum MobileVerificationMethod {
  WHATSAPP_QR = 'WHATSAPP_QR',
  SMS_QR = 'SMS_QR',
  MANUAL_OTP = 'MANUAL_OTP',
}

/**
 * DTO for initiating mobile verification
 * User can choose verification method
 */
export class InitiateMobileVerificationDto {
  @IsEnum(MobileVerificationMethod)
  @IsOptional()
  method?: MobileVerificationMethod = MobileVerificationMethod.WHATSAPP_QR;
}
