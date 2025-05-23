/*
  Warnings:

  - Added the required column `ownerId` to the `Brand` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'DRAFT');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'BRAND_VERIFICATION_STATUS';

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "businessPhoneNumber" TEXT,
ADD COLUMN     "contactAddress" TEXT,
ADD COLUMN     "ownerId" TEXT NOT NULL,
ADD COLUMN     "status" "BrandStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "verificationNotes" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT;

-- CreateTable
CREATE TABLE "BrandCertification" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandCertification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrandCertification_brandId_idx" ON "BrandCertification"("brandId");

-- CreateIndex
CREATE INDEX "Brand_ownerId_idx" ON "Brand"("ownerId");

-- CreateIndex
CREATE INDEX "Brand_status_idx" ON "Brand"("status");

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCertification" ADD CONSTRAINT "BrandCertification_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
