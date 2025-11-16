import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * WhatsApp Cloud API webhook payload structure
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
 */

export class WhatsAppProfileDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class WhatsAppContactDto {
  @ValidateNested()
  @Type(() => WhatsAppProfileDto)
  profile: WhatsAppProfileDto;

  @IsString()
  @IsNotEmpty()
  wa_id: string; // WhatsApp ID (phone number)
}

export class WhatsAppTextDto {
  @IsString()
  @IsNotEmpty()
  body: string; // Message content
}

export class WhatsAppMessageDto {
  @IsString()
  @IsNotEmpty()
  from: string; // Sender's phone number (E.164 without +)

  @IsString()
  @IsNotEmpty()
  id: string; // WhatsApp message ID

  @IsString()
  @IsNotEmpty()
  timestamp: string;

  @IsString()
  @IsNotEmpty()
  type: string; // "text", "image", etc.

  @ValidateNested()
  @Type(() => WhatsAppTextDto)
  @IsOptional()
  text?: WhatsAppTextDto;
}

export class WhatsAppMetadataDto {
  @IsString()
  @IsNotEmpty()
  display_phone_number: string;

  @IsString()
  @IsNotEmpty()
  phone_number_id: string;
}

export class WhatsAppValueDto {
  @IsString()
  @IsNotEmpty()
  messaging_product: string; // "whatsapp"

  @ValidateNested()
  @Type(() => WhatsAppMetadataDto)
  metadata: WhatsAppMetadataDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppContactDto)
  @IsOptional()
  contacts?: WhatsAppContactDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppMessageDto)
  @IsOptional()
  messages?: WhatsAppMessageDto[];
}

export class WhatsAppChangeDto {
  @ValidateNested()
  @Type(() => WhatsAppValueDto)
  value: WhatsAppValueDto;

  @IsString()
  @IsNotEmpty()
  field: string; // "messages"
}

export class WhatsAppEntryDto {
  @IsString()
  @IsNotEmpty()
  id: string; // WhatsApp Business Account ID

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppChangeDto)
  changes: WhatsAppChangeDto[];
}

export class WhatsAppWebhookDto {
  @IsString()
  @IsNotEmpty()
  object: string; // "whatsapp_business_account"

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppEntryDto)
  entry: WhatsAppEntryDto[];
}
