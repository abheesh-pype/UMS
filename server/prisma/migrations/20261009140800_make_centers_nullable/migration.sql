-- AlterTable
ALTER TABLE "Student" ALTER COLUMN "centerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "centerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Enrollment" ALTER COLUMN "studyCenterId" DROP NOT NULL;
