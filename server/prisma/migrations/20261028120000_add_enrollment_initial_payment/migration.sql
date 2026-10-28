-- Amount paid at admission, entered on the admission form (minimum 500). Existing rows stay NULL.
ALTER TABLE "Enrollment" ADD COLUMN "initialPayment" DOUBLE PRECISION;
