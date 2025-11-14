import { Injectable } from '@nestjs/common';
import { TenantDatabaseConfig } from '@prisma/client';
import { PrimaryBaseRepository, PrimaryDatabaseService } from '@vritti/api-sdk';

/**
 * Repository for managing tenant database configuration data access
 * Handles CRUD operations for tenant database connection details
 */
@Injectable()
export class TenantDatabaseConfigRepository extends PrimaryBaseRepository<
  TenantDatabaseConfig,
  any,
  any
> {
  constructor(database: PrimaryDatabaseService) {
    super(database, (prisma) => prisma.tenantDatabaseConfig);
  }

  /**
   * Updates a tenant database configuration by tenant ID
   * Note: This method is necessary because the schema uses tenantId (unique) not id as the primary lookup
   * @param tenantId - ID of the tenant
   * @param data - Data to update
   * @returns Updated configuration
   */
  async updateByTenantId(
    tenantId: string,
    data: any,
  ): Promise<TenantDatabaseConfig> {
    this.logger.log(
      `Updating ${this.constructor.name} for tenant: ${tenantId}`,
    );
    return await this.model.update({ where: { tenantId }, data });
  }

  /**
   * Deletes a tenant database configuration by tenant ID
   * Note: This method is necessary because the schema uses tenantId (unique) not id as the primary lookup
   * @param tenantId - ID of the tenant
   * @returns Deleted configuration
   */
  async deleteByTenantId(tenantId: string): Promise<TenantDatabaseConfig> {
    this.logger.log(
      `Deleting ${this.constructor.name} for tenant: ${tenantId}`,
    );
    return await this.model.delete({ where: { tenantId } });
  }
}
