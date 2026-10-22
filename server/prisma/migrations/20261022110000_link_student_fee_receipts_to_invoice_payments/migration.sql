ALTER TABLE "PaymentEntry"
ADD COLUMN "studentFeeReceiptId" TEXT;

CREATE UNIQUE INDEX "PaymentEntry_studentFeeReceiptId_key"
ON "PaymentEntry"("studentFeeReceiptId");

ALTER TABLE "PaymentEntry"
ADD CONSTRAINT "PaymentEntry_studentFeeReceiptId_fkey"
FOREIGN KEY ("studentFeeReceiptId") REFERENCES "StudentFeeReceipt"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
