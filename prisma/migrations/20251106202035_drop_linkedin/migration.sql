/*
  Warnings:

  - The values [LINKEDIN] on the enum `OAuthProviderType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OAuthProviderType_new" AS ENUM ('GOOGLE', 'MICROSOFT', 'APPLE', 'FACEBOOK', 'X');
ALTER TABLE "oauth_providers" ALTER COLUMN "provider" TYPE "OAuthProviderType_new" USING ("provider"::text::"OAuthProviderType_new");
ALTER TABLE "oauth_states" ALTER COLUMN "provider" TYPE "OAuthProviderType_new" USING ("provider"::text::"OAuthProviderType_new");
ALTER TYPE "OAuthProviderType" RENAME TO "OAuthProviderType_old";
ALTER TYPE "OAuthProviderType_new" RENAME TO "OAuthProviderType";
DROP TYPE "cloud"."OAuthProviderType_old";
COMMIT;
