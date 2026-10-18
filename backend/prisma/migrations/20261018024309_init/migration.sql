-- CreateEnum
CREATE TYPE "quote_status" AS ENUM ('DRAFT', 'SENT', 'CONFIRMED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('NO_DISCOUNT', 'PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "history_event_type" AS ENUM ('QUOTE_CREATED', 'QUOTE_SENT', 'QUOTE_EDITED', 'QUOTE_CONFIRMED', 'QUOTE_REOPENED', 'QUOTE_RENEWED', 'QUOTE_CANCELLED', 'PRODUCTION_STARTED', 'INSTALLATION_SCHEDULED', 'INSTALLATION_CHANGED', 'INSTALLATION_REMOVED', 'SERVICE_COMPLETED', 'COMMERCIAL_PDF_GENERATED', 'PRODUCTION_ORDER_GENERATED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "tax_id" TEXT,
    "address_postal_code" TEXT,
    "address_street" TEXT,
    "address_number" TEXT,
    "address_complement" TEXT,
    "address_neighborhood" TEXT,
    "address_city" TEXT,
    "address_state" CHAR(2),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "quote_number" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" "quote_status" NOT NULL,
    "notes" TEXT,
    "discount_type" "discount_type" NOT NULL DEFAULT 'NO_DISCOUNT',
    "discount_percentage" DECIMAL(5,2),
    "discount_fixed_amount_cents" INTEGER,
    "commercial_adjustment_cents" INTEGER,
    "installation_address_postal_code" TEXT,
    "installation_address_street" TEXT,
    "installation_address_number" TEXT,
    "installation_address_complement" TEXT,
    "installation_address_neighborhood" TEXT,
    "installation_address_city" TEXT,
    "installation_address_state" CHAR(2),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "first_sent_at" TIMESTAMPTZ(3),
    "valid_until" TIMESTAMPTZ(3),
    "confirmed_at" TIMESTAMPTZ(3),
    "production_started_at" TIMESTAMPTZ(3),
    "scheduled_installation_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curtains" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "room" TEXT,
    "description" TEXT,
    "material" TEXT,
    "opening_width" DECIMAL(9,3),
    "border_value" DECIMAL(6,3),
    "height" DECIMAL(9,3),
    "fabric_factor" DECIMAL(6,3),
    "notes" TEXT,

    CONSTRAINT "curtains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_components" (
    "id" UUID NOT NULL,
    "curtain_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(12,6),
    "unit" TEXT,
    "unit_price_cents" INTEGER,

    CONSTRAINT "financial_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "general_add_ons" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(12,6),
    "unit" TEXT,
    "unit_price_cents" INTEGER,

    CONSTRAINT "general_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_history" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "event_type" "history_event_type" NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "quote_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_sequence" (
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_sequence_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "business_data" (
    "id" TEXT NOT NULL,
    "commercial_name_or_consultant" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "tax_id" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "business_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tax_id_key" ON "customers"("tax_id");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_quote_number_key" ON "quotes"("quote_number");

-- CreateIndex
CREATE INDEX "quotes_customer_id_idx" ON "quotes"("customer_id");

-- CreateIndex
CREATE INDEX "quotes_status_idx" ON "quotes"("status");

-- CreateIndex
CREATE INDEX "quotes_valid_until_idx" ON "quotes"("valid_until");

-- CreateIndex
CREATE INDEX "quotes_scheduled_installation_at_idx" ON "quotes"("scheduled_installation_at");

-- CreateIndex
CREATE UNIQUE INDEX "curtains_quote_id_sequence_key" ON "curtains"("quote_id", "sequence");

-- CreateIndex
CREATE INDEX "financial_components_curtain_id_idx" ON "financial_components"("curtain_id");

-- CreateIndex
CREATE INDEX "general_add_ons_quote_id_idx" ON "general_add_ons"("quote_id");

-- CreateIndex
CREATE INDEX "quote_history_quote_id_occurred_at_idx" ON "quote_history"("quote_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curtains" ADD CONSTRAINT "curtains_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_components" ADD CONSTRAINT "financial_components_curtain_id_fkey" FOREIGN KEY ("curtain_id") REFERENCES "curtains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "general_add_ons" ADD CONSTRAINT "general_add_ons_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_history" ADD CONSTRAINT "quote_history_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
