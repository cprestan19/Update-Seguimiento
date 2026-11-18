-- Alcance de criterios de checklist (tienda / región / proyecto) y criterios
-- de tipo dato/comentario (además de casilla).
ALTER TABLE "checklist_item_defs" ADD COLUMN "storeId" TEXT;
ALTER TABLE "checklist_item_defs" ADD COLUMN "region" TEXT;
ALTER TABLE "checklist_item_defs" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'CHECK';
ALTER TABLE "store_checklist_items" ADD COLUMN "valor" TEXT;

CREATE INDEX "checklist_item_defs_storeId_idx" ON "checklist_item_defs"("storeId");

ALTER TABLE "checklist_item_defs" ADD CONSTRAINT "checklist_item_defs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
