/*
  Warnings:

  - You are about to drop the column `slug` on the `tenants` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "cloud"."tenants_slug_key";

-- AlterTable
ALTER TABLE "tenants" DROP COLUMN "slug";
