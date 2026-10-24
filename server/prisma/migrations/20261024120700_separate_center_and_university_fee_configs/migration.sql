ALTER TABLE "ProgramFeeStructure"
ADD COLUMN "studyCenterId" TEXT;

ALTER TABLE "ProgramFeeStructure"
ADD CONSTRAINT "ProgramFeeStructure_studyCenterId_fkey"
FOREIGN KEY ("studyCenterId") REFERENCES "StudyCenter"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ProgramFeeStructure_organizationId_studyCenterId_programId_idx"
ON "ProgramFeeStructure"("organizationId", "studyCenterId", "programId");

CREATE INDEX "ProgramFeeStructure_organizationId_universityId_programId_idx"
ON "ProgramFeeStructure"("organizationId", "universityId", "programId");
