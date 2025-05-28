-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ADMIN_BILLING';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "trial_ends_at" TIMESTAMP(3),
ADD COLUMN     "trial_started_at" TIMESTAMP(3);
