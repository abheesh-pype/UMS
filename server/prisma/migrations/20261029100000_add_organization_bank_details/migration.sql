-- Collection bank account details shown on invoices, managed from Finance -> Bank Details. Existing rows stay NULL.
ALTER TABLE "Organization" ADD COLUMN "bankDetails" JSONB;
