/*
  Warnings:

  - Made the column `projectId` on table `checklist_categories` required. This step will fail if there are existing NULL values in that column.
  - Made the column `projectId` on table `seguimiento_items` required. This step will fail if there are existing NULL values in that column.
  - Made the column `projectId` on table `stores` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "checklist_categories" ALTER COLUMN "projectId" SET NOT NULL;

-- AlterTable
ALTER TABLE "seguimiento_items" ALTER COLUMN "projectId" SET NOT NULL;

-- AlterTable
ALTER TABLE "stores" ALTER COLUMN "projectId" SET NOT NULL;
