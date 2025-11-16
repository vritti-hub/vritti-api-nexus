import { Injectable, Logger } from '@nestjs/common';
import {
  NotFoundException,
  BadRequestException,
} from '@vritti/api-sdk';
import { TenantDatabaseConfigRepository } from './tenant-database-config.repository';
import { CreateTenantDatabaseConfigDto } from './dto/create-tenant-database-config.dto';
import { UpdateTenantDatabaseConfigDto } from './dto/update-tenant-database-config.dto';
import { TenantDatabaseConfigResponseDto } from './dto/tenant-database-config-response.dto';

/**
 * Service for handling tenant database configuration operations
 * Manages database connection details for DEDICATED tenants
 */
@Injectable()
export class TenantDatabaseConfigService {
  private readonly logger = new Logger(TenantDatabaseConfigService.name);

  constructor(
    private readonly configRepository: TenantDatabaseConfigRepository,
  ) {}

  /**
   * Creates a new database configuration for a tenant
   * @param tenantId - ID of the tenant
   * @param dto - Database configuration data
   * @returns Created configuration
   */
  async create(
    tenantId: string,
    dto: CreateTenantDatabaseConfigDto,
  ): Promise<TenantDatabaseConfigResponseDto> {
    this.logger.log(`Creating database config for tenant: ${tenantId}`);

    // Check if config already exists
    const existing = await this.configRepository.findOne({
      where: { tenantId },
    });
    if (existing) {
      throw new BadRequestException(
        `Database configuration already exists for tenant: ${tenantId}`,
        'A database configuration already exists for this organization. Please update the existing configuration instead.'
      );
    }

    // Validate configuration
    this.validateDatabaseConfig(dto);

    // Create configuration
    // TODO: Encrypt dbPassword before storing
    const config = await this.configRepository.create({
      tenantId,
      dbHost: dto.dbHost,
      dbPort: dto.dbPort,
      dbUsername: dto.dbUsername,
      dbPassword: dto.dbPassword,
      dbName: dto.dbName,
      dbSchema: dto.dbSchema,
      dbSslMode: dto.dbSslMode,
      connectionPoolSize: dto.connectionPoolSize,
    });

    this.logger.log(`Database config created for tenant: ${tenantId}`);
    return TenantDatabaseConfigResponseDto.fromPrisma(config);
  }

  /**
   * Gets database configuration for a tenant
   * @param tenantId - ID of the tenant
   * @returns Configuration if found
   * @throws NotFoundException if config not found
   */
  async getByTenantId(
    tenantId: string,
  ): Promise<TenantDatabaseConfigResponseDto> {
    const config = await this.configRepository.findOne({ where: { tenantId } });
    if (!config) {
      throw new NotFoundException(
        `Database configuration not found for tenant: ${tenantId}`,
        'No database configuration exists for this organization. Please create one first.'
      );
    }

    return TenantDatabaseConfigResponseDto.fromPrisma(config);
  }

  /**
   * Updates database configuration for a tenant
   * @param tenantId - ID of the tenant
   * @param dto - Partial database configuration data
   * @returns Updated configuration
   * @throws NotFoundException if config not found
   */
  async update(
    tenantId: string,
    dto: UpdateTenantDatabaseConfigDto,
  ): Promise<TenantDatabaseConfigResponseDto> {
    this.logger.log(`Updating database config for tenant: ${tenantId}`);

    // Check if config exists
    const existing = await this.configRepository.findOne({
      where: { tenantId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Database configuration not found for tenant: ${tenantId}`,
        'No database configuration exists for this organization. Please create one first.'
      );
    }

    // Validate updated configuration
    if (Object.keys(dto).length > 0) {
      // Convert null to undefined for validation (Prisma returns null, DTO expects undefined)
      const existingForValidation = {
        ...existing,
        dbSchema: existing.dbSchema ?? undefined,
      };
      this.validateDatabaseConfig({ ...existingForValidation, ...dto });
    }

    // TODO: Encrypt dbPassword if provided in update
    const config = await this.configRepository.updateByTenantId(tenantId, dto);

    this.logger.log(`Database config updated for tenant: ${tenantId}`);
    return TenantDatabaseConfigResponseDto.fromPrisma(config);
  }

  /**
   * Deletes database configuration for a tenant
   * @param tenantId - ID of the tenant
   * @throws NotFoundException if config not found
   */
  async delete(tenantId: string): Promise<void> {
    this.logger.log(`Deleting database config for tenant: ${tenantId}`);

    // Check if config exists
    const existing = await this.configRepository.findOne({
      where: { tenantId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Database configuration not found for tenant: ${tenantId}`,
        'No database configuration exists for this organization. There is nothing to delete.'
      );
    }

    await this.configRepository.deleteByTenantId(tenantId);
    this.logger.log(`Database config deleted for tenant: ${tenantId}`);
  }

  /**
   * Checks if a tenant has a database configuration
   * @param tenantId - ID of the tenant
   * @returns True if config exists
   */
  async exists(tenantId: string): Promise<boolean> {
    return this.configRepository.exists({ tenantId });
  }

  /**
   * Validates database configuration
   * @param dto - Database configuration to validate
   * @throws BadRequestException if validation fails
   */
  private validateDatabaseConfig(
    dto: Partial<CreateTenantDatabaseConfigDto>,
  ): void {
    // Validate host
    if (dto.dbHost && !this.isValidHost(dto.dbHost)) {
      throw new BadRequestException(
        'dbHost',
        'Invalid database host format',
        'The database host format is invalid. Please provide a valid hostname, IP address, or localhost.'
      );
    }

    // Validate port
    if (dto.dbPort && (dto.dbPort < 1 || dto.dbPort > 65535)) {
      throw new BadRequestException(
        'dbPort',
        'Database port must be between 1 and 65535',
        'The database port must be a valid port number between 1 and 65535.'
      );
    }

    // Validate connection pool size
    if (
      dto.connectionPoolSize &&
      (dto.connectionPoolSize < 1 || dto.connectionPoolSize > 100)
    ) {
      throw new BadRequestException(
        'connectionPoolSize',
        'Connection pool size must be between 1 and 100',
        'The connection pool size must be between 1 and 100 connections.'
      );
    }

    // TODO: Add connection testing logic here
    // - Test if database is reachable
    // - Test if credentials are valid
    // - Test if database/schema exists
  }

  /**
   * Validates hostname format
   * @param host - Hostname to validate
   * @returns True if valid
   */
  private isValidHost(host: string): boolean {
    // Basic hostname validation (allows localhost, IP addresses, domain names)
    const hostPattern =
      /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    return (
      hostPattern.test(host) || ipPattern.test(host) || host === 'localhost'
    );
  }
}
