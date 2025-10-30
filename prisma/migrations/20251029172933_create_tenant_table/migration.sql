-- CreateEnum
CREATE TYPE "DatabaseType" AS ENUM ('SHARED', 'DEDICATED');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "db_type" "DatabaseType" NOT NULL DEFAULT 'SHARED',
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "db_host" TEXT,
    "db_port" INTEGER,
    "db_username" TEXT,
    "db_password" TEXT,
    "db_name" TEXT,
    "db_schema" TEXT,
    "db_ssl_mode" TEXT DEFAULT 'require',
    "connection_pool_size" INTEGER DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_subdomain_key" ON "tenants"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
