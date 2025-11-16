import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EncryptionService } from './encryption.service';
import { SmsService } from './sms.service';
import { WhatsAppService } from './whatsapp.service';

/**
 * Services Module
 * Provides common services for email, encryption, SMS, and WhatsApp functionality
 */
@Module({
  providers: [EmailService, EncryptionService, SmsService, WhatsAppService],
  exports: [EmailService, EncryptionService, SmsService, WhatsAppService],
})
export class ServicesModule {}
