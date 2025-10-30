import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
  Matches,
  IsIn,
} from 'class-validator';
import { DatabaseType, TenantStatus } from '@prisma/client';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'Subdomain must contain only lowercase letters, numbers, and hyphens',
  })
  subdomain: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsEnum(DatabaseType)
  dbType: DatabaseType;

  @IsEnum(TenantStatus)
  @IsOptional()
  status?: TenantStatus;

  // Database connection details
  @IsString()
  @IsOptional()
  dbHost?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  dbPort?: number;

  @IsString()
  @IsOptional()
  dbUsername?: string;

  @IsString()
  @IsOptional()
  dbPassword?: string;

  @IsString()
  @IsOptional()
  dbName?: string;

  @IsString()
  @IsOptional()
  dbSchema?: string;

  @IsString()
  @IsOptional()
  @IsIn(['require', 'prefer', 'disable'])
  dbSslMode?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  connectionPoolSize?: number;
}
