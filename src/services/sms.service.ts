import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * SMS Service for sending SMS and WhatsApp messages
 * Currently mocked - ready to integrate with Twilio or other providers
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly configService: ConfigService) {
    this.logger.warn('SMS service is currently in mock mode');
  }

  /**
   * Send SMS verification OTP
   * @param phoneNumber - Phone number with country code (e.g., +1234567890)
   * @param otp - 6-digit OTP code
   * @param firstName - Optional user's first name for personalization
   */
  async sendVerificationSms(
    phoneNumber: string,
    otp: string,
    firstName?: string,
  ): Promise<void> {
    try {
      const message = `Hello${firstName ? ` ${firstName}` : ''}, your Vritti AI Cloud verification code is: ${otp}. This code will expire in 10 minutes.`;

      // TODO: Integrate with Twilio or other SMS provider
      // const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
      // const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
      // const fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');
      //
      // const client = twilio(accountSid, authToken);
      // await client.messages.create({
      //   body: message,
      //   from: fromNumber,
      //   to: phoneNumber,
      // });

      // Security: Never log OTP values in production - GDPR/PCI compliance
      this.logger.warn(
        `[MOCK] SMS verification would be sent to ${phoneNumber}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${phoneNumber}:`, error);
      throw new Error('Failed to send SMS');
    }
  }

  /**
   * Send WhatsApp verification OTP
   * @param phoneNumber - Phone number with country code (e.g., +1234567890)
   * @param otp - 6-digit OTP code
   * @param firstName - Optional user's first name for personalization
   */
  async sendVerificationWhatsApp(
    phoneNumber: string,
    otp: string,
    firstName?: string,
  ): Promise<void> {
    try {
      const message = `Hello${firstName ? ` ${firstName}` : ''}, your Vritti AI Cloud verification code is: ${otp}. This code will expire in 10 minutes.`;

      // TODO: Integrate with Twilio WhatsApp API
      // const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
      // const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
      // const fromNumber = this.configService.get<string>('TWILIO_WHATSAPP_NUMBER'); // e.g., 'whatsapp:+14155238886'
      //
      // const client = twilio(accountSid, authToken);
      // await client.messages.create({
      //   body: message,
      //   from: fromNumber,
      //   to: `whatsapp:${phoneNumber}`,
      // });

      // Security: Never log OTP values in production - GDPR/PCI compliance
      this.logger.warn(
        `[MOCK] WhatsApp verification would be sent to ${phoneNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp message to ${phoneNumber}:`,
        error,
      );
      throw new Error('Failed to send WhatsApp message');
    }
  }

  /**
   * Verify phone number format
   * @param phoneNumber - Phone number to verify
   * @returns True if format is valid, false otherwise
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    // Basic E.164 format validation: +[country code][number]
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }
}
