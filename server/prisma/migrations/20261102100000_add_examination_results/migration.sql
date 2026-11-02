-- CreateTable
CREATE TABLE "examination_results" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentNo" TEXT NOT NULL,
    "portalCandidateId" TEXT,
    "obtainedMark" DOUBLE PRECISION NOT NULL,
    "negativeMark" DOUBLE PRECISION,
    "totalMark" DOUBLE PRECISION NOT NULL,
    "passMark" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "evaluatedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'exam_portal',
    "importedBy" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "examination_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "examination_results_examinationId_studentId_key" ON "examination_results"("examinationId", "studentId");

-- CreateIndex
CREATE INDEX "examination_results_organizationId_studentId_idx" ON "examination_results"("organizationId", "studentId");

-- AddForeignKey
ALTER TABLE "examination_results" ADD CONSTRAINT "examination_results_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examination_results" ADD CONSTRAINT "examination_results_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "examinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examination_results" ADD CONSTRAINT "examination_results_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
