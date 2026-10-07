ALTER TABLE "StudyCenter"
ADD COLUMN IF NOT EXISTS "assignedFinanceUserId" TEXT;

CREATE INDEX IF NOT EXISTS "StudyCenter_assignedFinanceUserId_idx"
ON "StudyCenter"("assignedFinanceUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'StudyCenter_assignedFinanceUserId_fkey'
  ) THEN
    ALTER TABLE "StudyCenter"
    ADD CONSTRAINT "StudyCenter_assignedFinanceUserId_fkey"
    FOREIGN KEY ("assignedFinanceUserId")
    REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;