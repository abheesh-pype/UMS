ALTER TABLE "ProgramFeeStructure"
ADD COLUMN "yearlyFee" DOUBLE PRECISION,
ADD COLUMN "semesterFee" DOUBLE PRECISION;

ALTER TABLE "ProgramAllocation"
ADD COLUMN "admissionSessionId" TEXT;

ALTER TABLE "ProgramAllocation"
ADD CONSTRAINT "ProgramAllocation_admissionSessionId_fkey"
FOREIGN KEY ("admissionSessionId") REFERENCES "AdmissionSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "ProgramAllocation_organizationId_centerId_programId_key";

CREATE UNIQUE INDEX "ProgramAllocation_organizationId_centerId_programId_admissionSessionId_key"
ON "ProgramAllocation"("organizationId", "centerId", "programId", "admissionSessionId");

CREATE INDEX "ProgramAllocation_organizationId_centerId_admissionSessionId_idx"
ON "ProgramAllocation"("organizationId", "centerId", "admissionSessionId");
