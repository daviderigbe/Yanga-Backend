-- CreateEnum
CREATE TYPE "DispatchProvider" AS ENUM ('KWIK', 'MANUAL');

-- CreateEnum
CREATE TYPE "DeliveryServiceLevel" AS ENUM ('STANDARD', 'EXPRESS', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'QUOTED', 'READY_FOR_PICKUP', 'DISPATCH_REQUESTED', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'CANCELLED', 'FAILED', 'RETURNED');

-- CreateEnum
CREATE TYPE "OrderActivityType" AS ENUM ('CREATED', 'PAYMENT_INITIALIZED', 'PAYMENT_VERIFIED', 'STOCK_RESERVED', 'DISPATCH_QUOTED', 'DISPATCH_CREATED', 'DISPATCH_STATUS_UPDATED', 'ORDER_STATUS_UPDATED', 'CANCELLED', 'FAILED');

-- Add pickup address support for seller dispatch origins
ALTER TYPE "AddressType" ADD VALUE IF NOT EXISTS 'PICKUP';

-- AlterTable
ALTER TABLE "Address" ADD COLUMN "contactName" TEXT,
ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "deliveryInstructions" TEXT,
ADD COLUMN "landmark" TEXT,
ADD COLUMN "latitude" DECIMAL(10,7),
ADD COLUMN "longitude" DECIMAL(10,7);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "providerDeliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "deliveryMarkup" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "serviceFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "commissionAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "sellerPayoutAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "platformRevenueAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "subtotalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "sellerSettledAt" TIMESTAMP(3);

-- Backfill subtotal for existing orders
UPDATE "Order"
SET
  "subtotalAmount" = "totalAmount",
  "sellerPayoutAmount" = "totalAmount"
WHERE "subtotalAmount" = 0;

-- CreateTable
CREATE TABLE "Shipment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" "DispatchProvider" NOT NULL DEFAULT 'KWIK',
  "serviceLevel" "DeliveryServiceLevel" NOT NULL DEFAULT 'STANDARD',
  "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "externalShipmentId" TEXT,
  "externalTrackingId" TEXT,
  "trackingUrl" TEXT,
  "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "pickupName" TEXT,
  "pickupPhone" TEXT,
  "pickupAddress" TEXT,
  "pickupCity" TEXT,
  "pickupState" TEXT,
  "dropoffName" TEXT,
  "dropoffPhone" TEXT,
  "dropoffAddress" TEXT,
  "dropoffCity" TEXT,
  "dropoffState" TEXT,
  "dropoffInstructions" TEXT,
  "providerPayload" JSONB,
  "failureReason" TEXT,
  "dispatchedAt" TIMESTAMP(3),
  "pickedUpAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentEvent" (
  "id" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "status" "DeliveryStatus" NOT NULL,
  "providerStatus" TEXT,
  "message" TEXT,
  "providerPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderActivity" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "type" "OrderActivityType" NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrderActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Address_state_idx" ON "Address"("state");

-- CreateIndex
CREATE INDEX "Address_city_idx" ON "Address"("city");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_provider_idx" ON "Shipment"("provider");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "Shipment_externalShipmentId_idx" ON "Shipment"("externalShipmentId");

-- CreateIndex
CREATE INDEX "Shipment_createdAt_idx" ON "Shipment"("createdAt");

-- CreateIndex
CREATE INDEX "ShipmentEvent_shipmentId_idx" ON "ShipmentEvent"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentEvent_status_idx" ON "ShipmentEvent"("status");

-- CreateIndex
CREATE INDEX "ShipmentEvent_createdAt_idx" ON "ShipmentEvent"("createdAt");

-- CreateIndex
CREATE INDEX "OrderActivity_orderId_idx" ON "OrderActivity"("orderId");

-- CreateIndex
CREATE INDEX "OrderActivity_type_idx" ON "OrderActivity"("type");

-- CreateIndex
CREATE INDEX "OrderActivity_createdAt_idx" ON "OrderActivity"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_sellerSettledAt_idx" ON "OrderItem"("sellerSettledAt");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderActivity" ADD CONSTRAINT "OrderActivity_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
