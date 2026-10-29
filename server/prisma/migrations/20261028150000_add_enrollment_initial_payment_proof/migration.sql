-- Proof of the initial admission payment (image or PDF) stored as a data URL. Existing rows stay NULL.
ALTER TABLE "Enrollment" ADD COLUMN "initialPaymentProof" TEXT;
