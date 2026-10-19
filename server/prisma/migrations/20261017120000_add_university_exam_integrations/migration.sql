CREATE TABLE "university_exam_integrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "university_exam_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "university_exam_integrations_universityId_key" ON "university_exam_integrations"("universityId");
CREATE INDEX "university_exam_integrations_organizationId_idx" ON "university_exam_integrations"("organizationId");

ALTER TABLE "university_exam_integrations" ADD CONSTRAINT "university_exam_integrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "university_exam_integrations" ADD CONSTRAINT "university_exam_integrations_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
