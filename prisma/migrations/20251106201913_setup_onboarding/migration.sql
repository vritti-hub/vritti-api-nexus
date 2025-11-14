-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OAuthProviderType" ADD VALUE 'FACEBOOK';
ALTER TYPE "OAuthProviderType" ADD VALUE 'X';

-- AlterEnum
ALTER TYPE "OnboardingStep" ADD VALUE 'SET_PASSWORD';

-- CreateTable
CREATE TABLE "oauth_states" (
    "id" TEXT NOT NULL,
    "state_token" TEXT NOT NULL,
    "provider" "OAuthProviderType" NOT NULL,
    "user_id" TEXT,
    "code_verifier" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_states_state_token_key" ON "oauth_states"("state_token");

-- CreateIndex
CREATE INDEX "oauth_states_state_token_idx" ON "oauth_states"("state_token");

-- CreateIndex
CREATE INDEX "oauth_states_expires_at_idx" ON "oauth_states"("expires_at");
