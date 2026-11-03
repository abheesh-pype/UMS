-- CreateTable
CREATE TABLE "examination_admin_assignments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "examination_admin_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "examination_admin_assignments_userId_key" ON "examination_admin_assignments"("userId");

-- CreateIndex
CREATE INDEX "examination_admin_assignments_organizationId_idx" ON "examination_admin_assignments"("organizationId");

-- AddForeignKey
ALTER TABLE "examination_admin_assignments" ADD CONSTRAINT "examination_admin_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examination_admin_assignments" ADD CONSTRAINT "examination_admin_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examination_admin_assignments" ADD CONSTRAINT "examination_admin_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
