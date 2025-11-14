import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EncryptionService } from './encryption.service';
import { SmsService } from './sms.service';

/**
 * Services Module
 * Provides common services for email, encryption, and SMS functionality
 */
@Module({
  providers: [EmailService, EncryptionService, SmsService],
  exports: [EmailService, EncryptionService, SmsService],
})
export class ServicesModule {}
