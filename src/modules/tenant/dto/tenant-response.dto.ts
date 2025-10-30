import { DatabaseType, TenantStatus } from '@prisma/client';

export class TenantResponseDto {
  id: string;
  subdomain: string;
  slug: string;
  name: string;
  description?: string | null;
  dbType: DatabaseType;
  status: TenantStatus;

  // Database connection details (sanitized - no sensitive data)
  dbHost?: string | null;
  dbPort?: number | null;
  dbName?: string | null;
  dbSchema?: string | null;
  dbSslMode?: string | null;
  connectionPoolSize?: number | null;

  // Metadata
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<TenantResponseDto>) {
    Object.assign(this, partial);
  }

  /**
   * Create from Prisma Tenant model, excluding sensitive fields
   */
  static fromPrisma(tenant: any): TenantResponseDto {
    return new TenantResponseDto({
      id: tenant.id,
      subdomain: tenant.subdomain,
      slug: tenant.slug,
      name: tenant.name,
      description: tenant.description,
      dbType: tenant.dbType,
      status: tenant.status,
      dbHost: tenant.dbHost,
      dbPort: tenant.dbPort,
      dbName: tenant.dbName,
      dbSchema: tenant.dbSchema,
      dbSslMode: tenant.dbSslMode,
      connectionPoolSize: tenant.connectionPoolSize,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      // Explicitly exclude: dbUsername, dbPassword
    });
  }
}
