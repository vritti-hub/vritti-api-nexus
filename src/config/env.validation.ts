import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  validateSync,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Staging = 'staging',
}

/**
 * Environment variables validation schema
 *
 * This class defines and validates all required environment variables
 * at application startup. If any required variable is missing or invalid,
 * the application will fail to start with a detailed error message.
 */
class EnvironmentVariables {
  // Application environment
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  // Application port
  @IsNumber()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  // Primary Database Configuration (Tenant Registry)
  @IsString()
  PRIMARY_DB_HOST: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PRIMARY_DB_PORT: number = 5432;

  @IsString()
  PRIMARY_DB_USERNAME: string;

  @IsString()
  PRIMARY_DB_PASSWORD: string;

  @IsString()
  PRIMARY_DB_DATABASE: string;

  @IsString()
  @IsOptional()
  PRIMARY_DB_SCHEMA: string = 'public';

  @IsEnum(['require', 'prefer', 'disable'])
  @IsOptional()
  PRIMARY_DB_SSL_MODE: 'require' | 'prefer' | 'disable' = 'require';

  // Prisma CLI Connection URLs (ONLY used by Prisma CLI tools, NOT by app runtime)
  @IsString()
  PRISMA_CLI_DATABASE_URL: string;

  @IsString()
  @IsOptional()
  PRISMA_CLI_DIRECT_URL: string;

  // JWT Configuration
  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRY: string = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRY: string = '30d';

  @IsString()
  @IsOptional()
  JWT_SIGNUP_EXPIRY: string = '2h';

  // Bcrypt Configuration
  @IsNumber()
  @Min(4)
  @Max(31)
  @IsOptional()
  BCRYPT_SALT_ROUNDS: number = 10;

  // Token Rotation
  @IsNumber()
  @Min(1)
  @IsOptional()
  REFRESH_TOKEN_ROTATION_DAYS: number = 7;

  // Optional: Encryption key for database credentials
  @IsString()
  @IsOptional()
  ENCRYPTION_KEY: string;
}

/**
 * Validates environment variables at application startup
 *
 * @param config Raw environment variables from process.env
 * @returns The original config object if validation passes
 * @throws Error if validation fails
 */
export function validate(
  config: Record<string, unknown>,
): Record<string, unknown> {
  // Convert numeric string values to numbers for validation
  const processedConfig = {
    ...config,
    PORT: config.PORT ? parseInt(config.PORT as string, 10) : undefined,
    PRIMARY_DB_PORT: config.PRIMARY_DB_PORT
      ? parseInt(config.PRIMARY_DB_PORT as string, 10)
      : undefined,
    BCRYPT_SALT_ROUNDS: config.BCRYPT_SALT_ROUNDS
      ? parseInt(config.BCRYPT_SALT_ROUNDS as string, 10)
      : undefined,
    REFRESH_TOKEN_ROTATION_DAYS: config.REFRESH_TOKEN_ROTATION_DAYS
      ? parseInt(config.REFRESH_TOKEN_ROTATION_DAYS as string, 10)
      : undefined,
  };

  const validatedConfig = plainToInstance(
    EnvironmentVariables,
    processedConfig,
    {
      enableImplicitConversion: true,
    },
  );

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error) => {
        const constraints = error.constraints
          ? Object.values(error.constraints).join(', ')
          : 'Unknown error';
        return `  - ${error.property}: ${constraints}`;
      })
      .join('\n');

    throw new Error(
      `❌ Environment validation failed:\n\n${errorMessages}\n\nPlease check your .env file and ensure all required variables are set correctly.`,
    );
  }

  // Return the processed config with converted numeric values
  return processedConfig;
}
