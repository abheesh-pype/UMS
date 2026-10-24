ALTER TABLE "ProgramFeeStructure"
ADD COLUMN "semesterFees" JSONB NOT NULL DEFAULT '[]'::jsonb;
