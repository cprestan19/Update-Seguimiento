/*
  Warnings:

  - Added the required column `region` to the `seguimiento_items` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "seguimiento_items" DROP CONSTRAINT "seguimiento_items_storeId_fkey";

-- DropIndex
DROP INDEX "seguimiento_items_storeId_idx";

-- AlterTable
ALTER TABLE "seguimiento_items" ADD COLUMN     "region" TEXT NOT NULL,
ADD COLUMN     "tienda" TEXT,
ALTER COLUMN "storeId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "seguimiento_items_region_idx" ON "seguimiento_items"("region");

-- AddForeignKey
ALTER TABLE "seguimiento_items" ADD CONSTRAINT "seguimiento_items_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
