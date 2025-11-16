import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

/**
 * WhatsApp Service for sending messages via WhatsApp Cloud API
 * Handles verification messages and webhook signature validation
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly whatsappClient: AxiosInstance;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly appSecret: string;
  private readonly apiVersion: string;

  constructor(private readonly configService: ConfigService) {
    // Get WhatsApp configuration
    this.phoneNumberId =
      this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '';
    this.accessToken =
      this.configService.get<string>('WHATSAPP_ACCESS_TOKEN') || '';
    this.appSecret =
      this.configService.get<string>('WHATSAPP_APP_SECRET') || '';
    this.apiVersion =
      this.configService.get<string>('WHATSAPP_API_VERSION') || 'v18.0';

    // Validate configuration
    if (!this.phoneNumberId || !this.accessToken || !this.appSecret) {
      this.logger.warn(
        'WhatsApp configuration is incomplete. WhatsApp verification will not work.',
      );
    }

    // Initialize WhatsApp Cloud API client
    this.whatsappClient = axios.create({
      baseURL: `https://graph.facebook.com/${this.apiVersion}`,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 seconds
    });
  }

  /**
   * Send verification message via WhatsApp
   * @param toPhone Phone number in E.164 format (with + prefix)
   * @param verificationToken Verification token to send
   * @returns Message ID if successful
   */
  async sendVerificationMessage(
    toPhone: string,
    verificationToken: string,
  ): Promise<string> {
    try {
      // Remove + prefix for WhatsApp API
      const formattedPhone = toPhone.startsWith('+')
        ? toPhone.substring(1)
        : toPhone;

      // For now, send as text message
      // In production, you should use approved message templates
      const payload = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: {
          body: `Your Vritti verification code is: ${verificationToken}\n\nReply with this code to verify your phone number.\n\nThis code expires in 10 minutes.`,
        },
      };

      this.logger.log(
        `Sending WhatsApp verification to ${formattedPhone} with token ${verificationToken}`,
      );

      const response = await this.whatsappClient.post(
        `/${this.phoneNumberId}/messages`,
        payload,
      );

      const messageId = response.data.messages?.[0]?.id;
      this.logger.log(
        `WhatsApp message sent successfully. Message ID: ${messageId}`,
      );

      return messageId;
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp message: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to send WhatsApp verification: ${error.message}`);
    }
  }

  /**
   * Send verification message using template (for production)
   * Requires pre-approved message template in Meta Business Manager
   *
   * @param toPhone Phone number in E.164 format
   * @param verificationToken Verification token
   * @param templateName Template name (must be approved)
   * @returns Message ID if successful
   */
  async sendVerificationTemplate(
    toPhone: string,
    verificationToken: string,
    templateName: string = 'verification_code',
  ): Promise<string> {
    try {
      const formattedPhone = toPhone.startsWith('+')
        ? toPhone.substring(1)
        : toPhone;

      const payload = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'en_US',
          },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: verificationToken,
                },
              ],
            },
          ],
        },
      };

      this.logger.log(
        `Sending WhatsApp template ${templateName} to ${formattedPhone}`,
      );

      const response = await this.whatsappClient.post(
        `/${this.phoneNumberId}/messages`,
        payload,
      );

      const messageId = response.data.messages?.[0]?.id;
      this.logger.log(
        `WhatsApp template message sent successfully. Message ID: ${messageId}`,
      );

      return messageId;
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp template: ${error.message}`,
        error.stack,
      );

      // Fallback to text message if template fails
      this.logger.warn('Falling back to text message');
      return this.sendVerificationMessage(toPhone, verificationToken);
    }
  }

  /**
   * Validate webhook signature from WhatsApp
   * Uses HMAC-SHA256 to verify the request came from Meta
   *
   * @param payload Raw request body as string
   * @param signature Signature from X-Hub-Signature-256 header
   * @returns true if signature is valid
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    try {
      if (!signature) {
        this.logger.warn('No signature provided in webhook request');
        return false;
      }
      
      this.logger.log(`Validating webhook signature: ${signature}`,payload);

      // Signature format: "sha256=<hash>"
      const parts = signature.split('=');
      if (parts.length !== 2 || parts[0] !== 'sha256') {
        this.logger.warn(`Invalid signature format: ${signature}`);
        return false;
      }

      const expectedSignature = parts[1];

      // Compute HMAC-SHA256 hash
      const hmac = crypto.createHmac('sha256', this.appSecret);
      hmac.update(payload, 'utf8');
      const computedSignature = hmac.digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      const isValid = crypto.timingSafeEqual(
        Buffer.from(computedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      );

      if (!isValid) {
        this.logger.warn('Webhook signature validation failed');
      }

      return isValid;
    } catch (error) {
      this.logger.error(
        `Error validating webhook signature: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Normalize phone number to E.164 format with + prefix
   * @param phone Phone number (with or without + prefix)
   * @returns Phone number in E.164 format
   */
  normalizePhoneNumber(phone: string): string {
    return phone.startsWith('+') ? phone : `+${phone}`;
  }

  /**
   * Extract country code from phone number
   * Simple extraction - for production use a library like libphonenumber
   *
   * @param phone Phone number in E.164 format
   * @returns ISO country code (best guess)
   */
  extractCountryCode(phone: string): string {
    // Remove + prefix
    const normalized = phone.startsWith('+') ? phone.substring(1) : phone;

    // Simple country code extraction (first 1-3 digits)
    // This is a simplified version - use libphonenumber-js in production
    const countryCodeMap: Record<string, string> = {
      '1': 'US', // USA/Canada
      '91': 'IN', // India
      '44': 'GB', // UK
      '33': 'FR', // France
      '49': 'DE', // Germany
      '39': 'IT', // Italy
      '34': 'ES', // Spain
      '7': 'RU', // Russia
      '86': 'CN', // China
      '81': 'JP', // Japan
      '82': 'KR', // South Korea
      '55': 'BR', // Brazil
      '61': 'AU', // Australia
      '27': 'ZA', // South Africa
      // Add more as needed
    };

    // Try matching 2-digit codes first, then 1-digit
    for (let i = 3; i >= 1; i--) {
      const prefix = normalized.substring(0, i);
      if (countryCodeMap[prefix]) {
        return countryCodeMap[prefix];
      }
    }

    // Default to Unknown
    this.logger.warn(`Could not determine country code for phone: ${phone}`);
    return 'UN'; // Unknown
  }
}
