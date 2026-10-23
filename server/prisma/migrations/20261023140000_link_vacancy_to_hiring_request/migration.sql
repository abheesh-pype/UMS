ALTER TABLE "Vacancy"
ADD COLUMN "hiringRequestId" TEXT;

CREATE UNIQUE INDEX "Vacancy_hiringRequestId_key"
ON "Vacancy"("hiringRequestId");

ALTER TABLE "Vacancy"
ADD CONSTRAINT "Vacancy_hiringRequestId_fkey"
FOREIGN KEY ("hiringRequestId") REFERENCES "HiringRequest"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
