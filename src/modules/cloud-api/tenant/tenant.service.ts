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

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(private readonly tenantRepository: TenantRepository) {}

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

    // Create tenant
    const tenant = await this.tenantRepository.create(createTenantDto);

    this.logger.log(`Created tenant: ${tenant.subdomain} (${tenant.id})`);

    return TenantResponseDto.fromPrisma(tenant);
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
    const tenant = await this.tenantRepository.findById(id);

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID '${id}' not found`);
    }

    return TenantResponseDto.fromPrisma(tenant);
  }

  /**
   * Get tenant by subdomain
   */
  async findBySubdomain(subdomain: string): Promise<TenantResponseDto> {
    const tenant = await this.tenantRepository.findBySubdomain(subdomain);

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
    const existing = await this.tenantRepository.findById(id);
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

    // Validate database configuration if dbType is being changed
    if (updateTenantDto.dbType) {
      this.validateDatabaseConfig({
        ...existing,
        ...updateTenantDto,
      } as CreateTenantDto);
    }

    // Update tenant
    const tenant = await this.tenantRepository.update(id, updateTenantDto);

    this.logger.log(`Updated tenant: ${tenant.subdomain} (${tenant.id})`);

    return TenantResponseDto.fromPrisma(tenant);
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
