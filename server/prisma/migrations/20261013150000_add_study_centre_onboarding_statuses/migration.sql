-- CreateTable study_centre_onboarding_statuses
CREATE TABLE IF NOT EXISTS "study_centre_onboarding_statuses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "allowedNextStatuses" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_centre_onboarding_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "study_centre_onboarding_statuses_code_key" ON "study_centre_onboarding_statuses"("code");

-- AlterTable StudyCenter
ALTER TABLE "StudyCenter" ADD COLUMN IF NOT EXISTS "onboardingStatusId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudyCenter_onboardingStatusId_idx" ON "StudyCenter"("onboardingStatusId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StudyCenter_onboardingStatusId_fkey'
  ) THEN
    ALTER TABLE "StudyCenter"
    ADD CONSTRAINT "StudyCenter_onboardingStatusId_fkey"
    FOREIGN KEY ("onboardingStatusId")
    REFERENCES "study_centre_onboarding_statuses"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
