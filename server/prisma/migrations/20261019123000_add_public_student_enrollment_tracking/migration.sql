ALTER TABLE "Enrollment" ADD COLUMN "publicTrackingTokenHash" TEXT;

CREATE UNIQUE INDEX "Enrollment_publicTrackingTokenHash_key" ON "Enrollment"("publicTrackingTokenHash");
