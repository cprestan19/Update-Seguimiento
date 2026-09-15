-- DropForeignKey
ALTER TABLE "checklist_item_defs" DROP CONSTRAINT "checklist_item_defs_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "store_checklist_items" DROP CONSTRAINT "store_checklist_items_itemDefId_fkey";

-- AddForeignKey
ALTER TABLE "checklist_item_defs" ADD CONSTRAINT "checklist_item_defs_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "checklist_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_checklist_items" ADD CONSTRAINT "store_checklist_items_itemDefId_fkey" FOREIGN KEY ("itemDefId") REFERENCES "checklist_item_defs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
