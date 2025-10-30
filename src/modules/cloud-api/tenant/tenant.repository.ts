import { Injectable, Logger } from '@nestjs/common';

import { PrismaClient, Tenant } from '@prisma/client';
import { PrimaryDatabaseService } from '@vritti/api-sdk';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantRepository {
  private readonly logger = new Logger(TenantRepository.name);

  constructor(private readonly database: PrimaryDatabaseService) {}

  /**
   * Get Prisma client for tenant registry database
   */
  private async getPrisma(): Promise<PrismaClient> {
    return await this.database.getPrimaryDbClient<PrismaClient>();
  }

  /**
   * Create a new tenant
   */
  async create(data: CreateTenantDto): Promise<Tenant> {
    const prisma = await this.getPrisma();
    this.logger.log(`Creating tenant: ${data.subdomain}`);

    return await prisma.tenant.create({
      data: {
        subdomain: data.subdomain,

        name: data.name,
        description: data.description,
        dbType: data.dbType,
        status: data.status || 'ACTIVE',
        dbHost: data.dbHost,
        dbPort: data.dbPort,
        dbUsername: data.dbUsername,
        dbPassword: data.dbPassword, // TODO: Encrypt before storing
        dbName: data.dbName,
        dbSchema: data.dbSchema,
        dbSslMode: data.dbSslMode,
        connectionPoolSize: data.connectionPoolSize,
      },
    });
  }

  /**
   * Find all tenants
   */
  async findAll(): Promise<Tenant[]> {
    const prisma = await this.getPrisma();
    this.logger.debug('Finding all tenants');

    return await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find tenant by ID
   */
  async findById(id: string): Promise<Tenant | null> {
    const prisma = await this.getPrisma();
    this.logger.debug(`Finding tenant by ID: ${id}`);

    return await prisma.tenant.findUnique({
      where: { id },
    });
  }

  /**
   * Find tenant by subdomain
   */
  async findBySubdomain(subdomain: string): Promise<Tenant | null> {
    const prisma = await this.getPrisma();
    this.logger.debug(`Finding tenant by subdomain: ${subdomain}`);

    return await prisma.tenant.findUnique({
      where: { subdomain },
    });
  }

  /**
   * Update tenant
   */
  async update(id: string, data: UpdateTenantDto): Promise<Tenant> {
    const prisma = await this.getPrisma();
    this.logger.log(`Updating tenant: ${id}`);

    return await prisma.tenant.update({
      where: { id },
      data: {
        subdomain: data.subdomain,

        name: data.name,
        description: data.description,
        dbType: data.dbType,
        status: data.status,
        dbHost: data.dbHost,
        dbPort: data.dbPort,
        dbUsername: data.dbUsername,
        dbPassword: data.dbPassword, // TODO: Encrypt before storing
        dbName: data.dbName,
        dbSchema: data.dbSchema,
        dbSslMode: data.dbSslMode,
        connectionPoolSize: data.connectionPoolSize,
      },
    });
  }

  /**
   * Delete tenant (soft delete by setting status to ARCHIVED)
   */
  async delete(id: string): Promise<Tenant> {
    const prisma = await this.getPrisma();
    this.logger.log(`Archiving tenant: ${id}`);

    return await prisma.tenant.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  /**
   * Hard delete tenant (permanently remove from database)
   * Use with caution!
   */
  async hardDelete(id: string): Promise<Tenant> {
    const prisma = await this.getPrisma();
    this.logger.warn(`Hard deleting tenant: ${id}`);

    return await prisma.tenant.delete({
      where: { id },
    });
  }
}
