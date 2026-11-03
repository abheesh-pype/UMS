// @ts-nocheck
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';

const SUPERADMIN_EMAIL = 'superadmin@ums.com';
const SUPERADMIN_PASSWORD = 'superadmin';

// Removes every user and seeds a single superadmin. Login also needs the single
// organization and university to exist, so they are created when missing.
const run = async () => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DB_RESET !== 'true') {
    throw new Error('Production reset blocked. Set ALLOW_DB_RESET=true only after verifying the target database.');
  }

  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');

    const organization =
      (await tx.organization.findUnique({ where: { singletonKey: 'primary' } })) ??
      (await tx.organization.create({ data: { name: 'UMS', status: 'active' } }));

    const university =
      (await tx.university.findUnique({ where: { singletonKey: 'primary' } })) ??
      (await tx.university.create({
        data: { organizationId: organization.id, name: 'UMS University', code: 'UMS', status: 'active' },
      }));

    await tx.user.create({
      data: {
        userId: 'superadmin',
        organizationId: organization.id,
        universityId: university.id,
        email: SUPERADMIN_EMAIL,
        password: passwordHash,
        name: 'Super Admin',
        role: 'superadmin',
        status: 'active',
      },
    });
  }, { maxWait: 20000, timeout: 30000 });

  console.log(`Superadmin seeded: ${SUPERADMIN_EMAIL}`);
};

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
