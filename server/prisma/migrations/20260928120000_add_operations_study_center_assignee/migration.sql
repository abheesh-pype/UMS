ALTER TABLE "StudyCenter"
ADD COLUMN IF NOT EXISTS "assignedOperationsUserId" TEXT;

CREATE INDEX IF NOT EXISTS "StudyCenter_assignedOperationsUserId_idx"
ON "StudyCenter"("assignedOperationsUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'StudyCenter_assignedOperationsUserId_fkey'
  ) THEN
    ALTER TABLE "StudyCenter"
    ADD CONSTRAINT "StudyCenter_assignedOperationsUserId_fkey"
    FOREIGN KEY ("assignedOperationsUserId")
    REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;