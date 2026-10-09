import prisma from './src/lib/prisma.js';

async function main() {
  try {
    console.log('Applying database migration: make_centers_nullable...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Student" ALTER COLUMN "centerId" DROP NOT NULL;`);
    console.log('✅ Student.centerId is now NULLABLE');

    await prisma.$executeRawUnsafe(`ALTER TABLE "Invoice" ALTER COLUMN "centerId" DROP NOT NULL;`);
    console.log('✅ Invoice.centerId is now NULLABLE');

    await prisma.$executeRawUnsafe(`ALTER TABLE "Enrollment" ALTER COLUMN "studyCenterId" DROP NOT NULL;`);
    console.log('✅ Enrollment.studyCenterId is now NULLABLE');

    console.log('Database migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
