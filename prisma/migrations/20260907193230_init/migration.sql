-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "PersonnelRole" AS ENUM ('TECNICO', 'AUDITOR_TI', 'AUDITOR_INVENTARIO', 'COORDINADOR');

-- CreateEnum
CREATE TYPE "EstadoMigracion" AS ENUM ('PENDIENTE', 'EN_PROGRESO', 'COMPLETADA', 'CON_INCIDENCIA');

-- CreateEnum
CREATE TYPE "Severidad" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "personnelRole" "PersonnelRole",
    "pais" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "pais" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "tienda" TEXT NOT NULL,
    "horario" TEXT NOT NULL,
    "minutosDia" INTEGER NOT NULL,
    "estado" "EstadoMigracion" NOT NULL DEFAULT 'PENDIENTE',
    "tecnicoId" TEXT,
    "auditorTIId" TEXT,
    "auditorInvId" TEXT,
    "tiempoEstimadoMin" INTEGER NOT NULL DEFAULT 45,
    "inicioReal" TIMESTAMP(3),
    "finReal" TIMESTAMP(3),
    "duracionRealMin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_categories" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "checklist_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_item_defs" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "checklist_item_defs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_checklist_items" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "itemDefId" TEXT NOT NULL,
    "completado" BOOLEAN NOT NULL DEFAULT false,
    "completadoPorId" TEXT,
    "completadoEn" TIMESTAMP(3),

    CONSTRAINT "store_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "severidad" "Severidad" NOT NULL DEFAULT 'MEDIA',
    "descripcion" TEXT NOT NULL,
    "resuelta" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT,
    "detalle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "stores_pais_idx" ON "stores"("pais");

-- CreateIndex
CREATE INDEX "stores_estado_idx" ON "stores"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "store_checklist_items_storeId_itemDefId_key" ON "store_checklist_items"("storeId", "itemDefId");

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_auditorTIId_fkey" FOREIGN KEY ("auditorTIId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_auditorInvId_fkey" FOREIGN KEY ("auditorInvId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_item_defs" ADD CONSTRAINT "checklist_item_defs_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "checklist_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_checklist_items" ADD CONSTRAINT "store_checklist_items_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_checklist_items" ADD CONSTRAINT "store_checklist_items_itemDefId_fkey" FOREIGN KEY ("itemDefId") REFERENCES "checklist_item_defs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_checklist_items" ADD CONSTRAINT "store_checklist_items_completadoPorId_fkey" FOREIGN KEY ("completadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
