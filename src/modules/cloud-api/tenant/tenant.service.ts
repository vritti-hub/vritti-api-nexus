import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantResponseDto } from './dto/tenant-response.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantRepository } from './tenant.repository';
import { TenantDatabaseConfigService } from './tenant-database-config.service';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly configService: TenantDatabaseConfigService,
  ) {}

  /**
   * Create a new tenant
   */
  async create(createTenantDto: CreateTenantDto): Promise<TenantResponseDto> {
    // Validate subdomain uniqueness
    const existingBySubdomain = await this.tenantRepository.findBySubdomain(
      createTenantDto.subdomain,
    );
    if (existingBySubdomain) {
      throw new ConflictException(
        `Tenant with subdomain '${createTenantDto.subdomain}' already exists`,
      );
    }

    // Validate database configuration based on dbType
    this.validateDatabaseConfig(createTenantDto);

    // Create tenant (business data only)
    const tenant = await this.tenantRepository.create(createTenantDto);

    // Create database configuration if DEDICATED type
    if (createTenantDto.dbType === 'DEDICATED') {
      await this.configService.create(tenant.id, {
        dbHost: createTenantDto.dbHost!,
        dbPort: createTenantDto.dbPort!,
        dbUsername: createTenantDto.dbUsername!,
        dbPassword: createTenantDto.dbPassword!,
        dbName: createTenantDto.dbName!,
        dbSchema: createTenantDto.dbSchema,
        dbSslMode: createTenantDto.dbSslMode,
        connectionPoolSize: createTenantDto.connectionPoolSize,
      });
    }

    this.logger.log(`Created tenant: ${tenant.subdomain} (${tenant.id})`);

    // Return tenant with config (if exists)
    return this.findById(tenant.id);
  }

  /**
   * Get all tenants
   */
  async findAll(): Promise<TenantResponseDto[]> {
    const tenants = await this.tenantRepository.findAll();
    return tenants.map((tenant) => TenantResponseDto.fromPrisma(tenant));
  }

  /**
   * Get tenant by ID
   */
  async findById(id: string): Promise<TenantResponseDto> {
    const tenant = await this.tenantRepository.findByIdWithConfig(id);

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID '${id}' not found`);
    }

    return TenantResponseDto.fromPrisma(tenant);
  }

  /**
   * Get tenant by subdomain
   */
  async findBySubdomain(subdomain: string): Promise<TenantResponseDto> {
    const tenant = await this.tenantRepository.findBySubdomain(subdomain, true); // Include config

    if (!tenant) {
      throw new NotFoundException(
        `Tenant with subdomain '${subdomain}' not found`,
      );
    }

    return TenantResponseDto.fromPrisma(tenant);
  }

  /**
   * Update tenant
   */
  async update(
    id: string,
    updateTenantDto: UpdateTenantDto,
  ): Promise<TenantResponseDto> {
    // Check if tenant exists
    const existing = await this.tenantRepository.findByIdWithConfig(id);
    if (!existing) {
      throw new NotFoundException(`Tenant with ID '${id}' not found`);
    }

    // Validate subdomain uniqueness (if changing)
    if (
      updateTenantDto.subdomain &&
      updateTenantDto.subdomain !== existing.subdomain
    ) {
      const existingBySubdomain = await this.tenantRepository.findBySubdomain(
        updateTenantDto.subdomain,
      );
      if (existingBySubdomain) {
        throw new ConflictException(
          `Tenant with subdomain '${updateTenantDto.subdomain}' already exists`,
        );
      }
    }

    // Extract database config fields from update DTO
    const {
      dbHost,
      dbPort,
      dbUsername,
      dbPassword,
      dbName,
      dbSchema,
      dbSslMode,
      connectionPoolSize,
      ...tenantData
    } = updateTenantDto;

    // Update tenant (business data only)
    const tenant = await this.tenantRepository.update(id, tenantData);

    // Update database configuration if any DB fields are provided
    const hasDbConfigFields =
      dbHost ||
      dbPort ||
      dbUsername ||
      dbPassword ||
      dbName ||
      dbSchema ||
      dbSslMode ||
      connectionPoolSize;

    if (hasDbConfigFields) {
      const configExists = await this.configService.exists(id);

      if (configExists) {
        // Update existing config
        await this.configService.update(id, {
          dbHost,
          dbPort,
          dbUsername,
          dbPassword,
          dbName,
          dbSchema,
          dbSslMode,
          connectionPoolSize,
        });
      } else if (tenant.dbType === 'DEDICATED') {
        // Create new config if tenant is DEDICATED and config doesn't exist
        await this.configService.create(id, {
          dbHost: dbHost!,
          dbPort: dbPort!,
          dbUsername: dbUsername!,
          dbPassword: dbPassword!,
          dbName: dbName!,
          dbSchema,
          dbSslMode,
          connectionPoolSize,
        });
      }
    }

    this.logger.log(`Updated tenant: ${tenant.subdomain} (${tenant.id})`);

    // Return tenant with updated config
    return this.findById(id);
  }

  /**
   * Archive tenant (soft delete)
   */
  async archive(id: string): Promise<TenantResponseDto> {
    // Check if tenant exists
    const existing = await this.tenantRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Tenant with ID '${id}' not found`);
    }

    const tenant = await this.tenantRepository.delete(id);

    this.logger.log(`Archived tenant: ${tenant.subdomain} (${tenant.id})`);

    return TenantResponseDto.fromPrisma(tenant);
  }

  /**
   * Validate database configuration based on tenant type
   */
  private validateDatabaseConfig(dto: CreateTenantDto): void {
    if (dto.dbType === 'SHARED') {
      // For SHARED, dbSchema is required
      if (!dto.dbSchema) {
        throw new BadRequestException(
          'dbSchema is required for SHARED database type',
        );
      }
    } else if (dto.dbType === 'DEDICATED') {
      // For DEDICATED, full database connection details are required
      if (!dto.dbHost || !dto.dbName || !dto.dbUsername || !dto.dbPassword) {
        throw new BadRequestException(
          'dbHost, dbName, dbUsername, and dbPassword are required for DEDICATED database type',
        );
      }
    }
  }
}
