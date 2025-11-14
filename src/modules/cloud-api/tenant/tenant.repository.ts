import { Injectable } from '@nestjs/common';

import { Tenant } from '@prisma/client';
import { PrimaryBaseRepository, PrimaryDatabaseService } from '@vritti/api-sdk';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantRepository extends PrimaryBaseRepository<
  Tenant,
  CreateTenantDto,
  UpdateTenantDto
> {
  constructor(database: PrimaryDatabaseService) {
    super(database, (prisma) => prisma.tenant);
  }

  /**
   * Find all tenants ordered by creation date
   */
  async findAll(): Promise<Tenant[]> {
    return this.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find tenant by ID with database configuration included
   */
  async findByIdWithConfig(id: string): Promise<Tenant | null> {
    return this.findOne({
      where: { id },
      include: { databaseConfig: true },
    });
  }

  /**
   * Find tenant by subdomain
   * @param includeConfig - Whether to include database configuration
   */
  async findBySubdomain(
    subdomain: string,
    includeConfig = false,
  ): Promise<Tenant | null> {
    return this.findOne({
      where: { subdomain },
      include: {
        databaseConfig: includeConfig,
      },
    });
  }
}
