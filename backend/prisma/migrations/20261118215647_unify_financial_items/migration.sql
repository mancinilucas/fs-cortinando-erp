-- UFIN-03: replace financial_components and general_add_ons with a single
-- quote-owned financial_items collection. Development data of the old tables
-- is discarded by decision of the implementation plan; no remapping is done.

-- DropForeignKey
ALTER TABLE "financial_components" DROP CONSTRAINT "financial_components_curtain_id_fkey";

-- DropForeignKey
ALTER TABLE "general_add_ons" DROP CONSTRAINT "general_add_ons_quote_id_fkey";

-- DropTable
DROP TABLE "financial_components";

-- DropTable
DROP TABLE "general_add_ons";

-- CreateTable
CREATE TABLE "financial_items" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "curtain_id" UUID,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(12,6),
    "unit" TEXT,
    "unit_price_cents" INTEGER,

    CONSTRAINT "financial_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_items_quote_id_idx" ON "financial_items"("quote_id");

-- CreateIndex
CREATE INDEX "financial_items_curtain_id_idx" ON "financial_items"("curtain_id");

-- CreateIndex
CREATE UNIQUE INDEX "curtains_quote_id_id_key" ON "curtains"("quote_id", "id");

-- AddForeignKey
ALTER TABLE "financial_items" ADD CONSTRAINT "financial_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_items" ADD CONSTRAINT "financial_items_curtain_id_quote_id_fkey" FOREIGN KEY ("curtain_id", "quote_id") REFERENCES "curtains"("id", "quote_id") ON DELETE CASCADE ON UPDATE CASCADE;
