-- CreateEnum
CREATE TYPE "EstadoSeguimiento" AS ENUM ('PENDIENTE', 'EN_SEGUIMIENTO', 'COMPLETADO');

-- CreateTable
CREATE TABLE "seguimiento_items" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" "EstadoSeguimiento" NOT NULL DEFAULT 'PENDIENTE',
    "responsableId" TEXT,
    "createdById" TEXT,
    "completadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seguimiento_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seguimiento_items_storeId_idx" ON "seguimiento_items"("storeId");

-- CreateIndex
CREATE INDEX "seguimiento_items_estado_idx" ON "seguimiento_items"("estado");

-- AddForeignKey
ALTER TABLE "seguimiento_items" ADD CONSTRAINT "seguimiento_items_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento_items" ADD CONSTRAINT "seguimiento_items_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento_items" ADD CONSTRAINT "seguimiento_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
