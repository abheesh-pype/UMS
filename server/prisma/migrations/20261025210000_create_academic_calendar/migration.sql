-- CreateTable
CREATE TABLE IF NOT EXISTS "academic_calendar" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "academicSessionId" TEXT,
    "programId" TEXT,
    "semesterId" TEXT,
    "departmentId" TEXT,
    "studyCenterId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "description" TEXT,
    "location" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_calendar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "academic_calendar_organizationId_startDate_endDate_idx" ON "academic_calendar"("organizationId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "academic_calendar_academicSessionId_programId_semesterId_idx" ON "academic_calendar"("academicSessionId", "programId", "semesterId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academic_calendar_organizationId_fkey') THEN
    ALTER TABLE "academic_calendar" ADD CONSTRAINT "academic_calendar_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academic_calendar_academicSessionId_fkey') THEN
    ALTER TABLE "academic_calendar" ADD CONSTRAINT "academic_calendar_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AdmissionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academic_calendar_programId_fkey') THEN
    ALTER TABLE "academic_calendar" ADD CONSTRAINT "academic_calendar_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academic_calendar_semesterId_fkey') THEN
    ALTER TABLE "academic_calendar" ADD CONSTRAINT "academic_calendar_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academic_calendar_departmentId_fkey') THEN
    ALTER TABLE "academic_calendar" ADD CONSTRAINT "academic_calendar_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academic_calendar_studyCenterId_fkey') THEN
    ALTER TABLE "academic_calendar" ADD CONSTRAINT "academic_calendar_studyCenterId_fkey" FOREIGN KEY ("studyCenterId") REFERENCES "StudyCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academic_calendar_createdBy_fkey') THEN
    ALTER TABLE "academic_calendar" ADD CONSTRAINT "academic_calendar_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
