CREATE TABLE "EmployeePerformanceReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeePerformanceReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeePerformanceReview_organizationId_employeeId_createdAt_idx"
ON "EmployeePerformanceReview"("organizationId", "employeeId", "createdAt");

CREATE INDEX "EmployeePerformanceReview_reviewerId_idx"
ON "EmployeePerformanceReview"("reviewerId");

ALTER TABLE "EmployeePerformanceReview"
ADD CONSTRAINT "EmployeePerformanceReview_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeePerformanceReview"
ADD CONSTRAINT "EmployeePerformanceReview_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeePerformanceReview"
ADD CONSTRAINT "EmployeePerformanceReview_reviewerId_fkey"
FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
