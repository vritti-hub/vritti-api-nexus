import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Headers,
  Logger,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import { Public } from '@vritti/api-sdk';
import { WhatsAppService } from '../../../../services';
import { WhatsAppWebhookDto } from '../dto/whatsapp-webhook.dto';
import { MobileVerificationService } from '../services/mobile-verification.service';

/**
 * WhatsApp Webhook Controller
 * Handles webhook verification and incoming message events from WhatsApp Cloud API
 *
 * Webhook URL: https://your-domain.com/cloud-api/onboarding/webhooks/whatsapp
 */
@Controller('cloud-api/onboarding/webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);
  private readonly verifyToken: string;

  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly mobileVerificationService: MobileVerificationService,
    private readonly configService: ConfigService,
  ) {
    this.verifyToken = this.configService.get<string>(
      'WHATSAPP_VERIFY_TOKEN',
    ) || '';

    if (!this.verifyToken) {
      this.logger.warn(
        'WHATSAPP_VERIFY_TOKEN is not configured. Webhook verification will fail.',
      );
    }
  }

  /**
   * Webhook verification endpoint (GET)
   * Meta sends a GET request to verify the webhook URL
   *
   * Query Parameters:
   * - hub.mode: "subscribe"
   * - hub.challenge: Random string to echo back
   * - hub.verify_token: Verification token configured in Meta dashboard
   *
   * @returns The challenge string if verification successful
   */
  @Get()
  @Public()
  async verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') token: string,
  ): Promise<string> {
    this.logger.log('Received webhook verification request from Meta');

    // Verify mode and token
    if (mode === 'subscribe' && token === this.verifyToken) {
      this.logger.log('Webhook verification successful');
      return challenge; // Return as plain text
    }

    this.logger.warn(
      `Webhook verification failed. Mode: ${mode}, Token match: ${token === this.verifyToken}`,
    );
    throw new UnauthorizedException('Invalid verification token');
  }

  /**
   * Webhook event handler (POST)
   * Receives incoming WhatsApp messages
   *
   * Headers:
   * - X-Hub-Signature-256: HMAC-SHA256 signature for payload verification
   *
   * @param request Fastify request object (contains rawBody)
   * @param signature Webhook signature from header
   * @param payload WhatsApp webhook payload
   * @returns Success response
   */
  @Post()
  @Public()
  async handleWebhook(
    @Req() request: FastifyRequest,
    @Headers('x-hub-signature-256') signature: string,
    @Body() payload: WhatsAppWebhookDto,
  ): Promise<{ status: string }> {
    this.logger.log('Received WhatsApp webhook event');

    // Validate webhook signature using raw body
    // rawBody is added by fastify-raw-body plugin
    const rawBody = (request as any).rawBody as string;

    if (!rawBody) {
      this.logger.error('Raw body not available for signature validation');
      throw new UnauthorizedException('Unable to validate webhook signature');
    }

    const isValid = this.whatsappService.validateWebhookSignature(
      rawBody,
      signature,
    );

    if (!isValid) {
      this.logger.error('Invalid webhook signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.log('Webhook signature validated successfully');

    // Process webhook asynchronously
    // Important: Respond immediately to Meta (within 20 seconds)
    this.processWebhookAsync(payload).catch((error) => {

      this.logger.error(`Error processing webhook: ${error.message}`, error.stack);
    });

    // Return success immediately
    return { status: 'ok' };
  }

  /**
   * Process webhook payload asynchronously
   * Extracts phone number and verification token from incoming messages
   */
  private async processWebhookAsync(payload: WhatsAppWebhookDto): Promise<void> {
    try {
      // WhatsApp webhook structure:
      // payload.entry[].changes[].value.messages[]

      for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
          // Only process message events
          if (change.field !== 'messages') {
            continue;
          }

          const value = change.value;
          const messages = value.messages || [];
          const contacts = value.contacts || [];

          for (const message of messages) {
            // Only process text messages
            if (message.type !== 'text' || !message.text?.body) {
              this.logger.log(`Skipping non-text message type: ${message.type}`);
              continue;
            }

            const phoneNumber = message.from; // E.164 without + prefix
            const messageText = message.text.body.trim();
            const senderName = contacts.find((c) => c.wa_id === phoneNumber)
              ?.profile?.name || 'Unknown';

            this.logger.log(
              `Processing message from ${senderName} (${phoneNumber}): "${messageText}"`,
            );

            // Extract verification token from message
            const verificationToken = this.extractVerificationToken(messageText);

            if (!verificationToken) {
              this.logger.warn(
                `No verification token found in message: "${messageText}"`,
              );
              continue;
            }

            this.logger.log(
              `Found verification token: ${verificationToken} from phone: ${phoneNumber}`,
            );

            // Verify the token
            const success = await this.mobileVerificationService.verifyFromWebhook(
              verificationToken,
              phoneNumber,
            );

            if (success) {
              this.logger.log(
                `Successfully verified phone ${phoneNumber} with token ${verificationToken}`,
              );

              // TODO: Send confirmation message back to user
              // await this.whatsappService.sendConfirmationMessage(phoneNumber);
            } else {
              this.logger.warn(
                `Verification failed for token ${verificationToken} and phone ${phoneNumber}`,
              );

              // TODO: Send error message back to user
              // await this.whatsappService.sendErrorMessage(phoneNumber);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Error in webhook processing: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Extract verification token from message text
   * Supports formats:
   * - "VERABC123"
   * - "VER-ABC123"
   * - "My code is VERABC123"
   * - "VERABC123 is my verification code"
   *
   * @param messageText Raw message text
   * @returns Verification token or null if not found
   */
  private extractVerificationToken(messageText: string): string | null {
    // Pattern: VER followed by 6 alphanumeric characters (with optional hyphen)
    const regex = /VER-?([A-Z0-9]{6})/i;
    const match = messageText.match(regex);

    if (match) {
      // Return normalized token (without hyphen)
      return `VER${match[1].toUpperCase()}`;
    }

    return null;
  }
}
