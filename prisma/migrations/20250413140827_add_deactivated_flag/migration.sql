-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "isDeactivated" BOOLEAN NOT NULL DEFAULT false;
