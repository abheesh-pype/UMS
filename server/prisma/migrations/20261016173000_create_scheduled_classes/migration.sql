CREATE TABLE "scheduled_classes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "academicSessionId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "meetingUrl" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scheduled_classes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scheduled_class_students" (
    "scheduledClassId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scheduled_class_students_pkey" PRIMARY KEY ("scheduledClassId", "studentId")
);

CREATE INDEX "scheduled_classes_organizationId_startsAt_idx" ON "scheduled_classes"("organizationId", "startsAt");
CREATE INDEX "scheduled_classes_scope_idx" ON "scheduled_classes"("academicSessionId", "programId", "semesterId", "moduleId");
CREATE INDEX "scheduled_class_students_studentId_idx" ON "scheduled_class_students"("studentId");

ALTER TABLE "scheduled_classes" ADD CONSTRAINT "scheduled_classes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduled_classes" ADD CONSTRAINT "scheduled_classes_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AdmissionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduled_classes" ADD CONSTRAINT "scheduled_classes_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduled_classes" ADD CONSTRAINT "scheduled_classes_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduled_classes" ADD CONSTRAINT "scheduled_classes_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduled_classes" ADD CONSTRAINT "scheduled_classes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scheduled_class_students" ADD CONSTRAINT "scheduled_class_students_scheduledClassId_fkey" FOREIGN KEY ("scheduledClassId") REFERENCES "scheduled_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduled_class_students" ADD CONSTRAINT "scheduled_class_students_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
