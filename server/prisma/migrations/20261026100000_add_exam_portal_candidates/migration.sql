CREATE TABLE "exam_portal_candidates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalStudentId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "category" TEXT NOT NULL DEFAULT '',
    "subCategory" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "assignedAssessments" JSONB NOT NULL DEFAULT '[]',
    "lastIdempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_portal_candidates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exam_portal_candidates_tenantId_externalStudentId_key" ON "exam_portal_candidates"("tenantId", "externalStudentId");
