// @ts-nocheck
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Required environment variable ${name} is not set.`);
  return value;
};

const run = async () => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DB_RESET !== 'true') {
    throw new Error('Production reset blocked. Set ALLOW_DB_RESET=true only after verifying the target database.');
  }

  const expectedDatabase = requiredEnv('RESET_DATABASE_NAME');
  const expectedHost = requiredEnv('RESET_DATABASE_HOST').toLowerCase();
  const connectionString = requiredEnv('DATABASE_URL');
  let configuredHost: string;
  try {
    configuredHost = new URL(connectionString).hostname.toLowerCase();
  } catch {
    throw new Error('DATABASE_URL is not a valid PostgreSQL URL; no data was changed.');
  }
  if (expectedHost !== configuredHost) {
    throw new Error('RESET_DATABASE_HOST does not match the configured database host; no data was changed.');
  }
  const confirmation = `WIPE ${expectedHost}/${expectedDatabase}`;
  if (requiredEnv('RESET_DATABASE_CONFIRMATION') !== confirmation) {
    throw new Error(`Reset confirmation must exactly equal "${confirmation}".`);
  }

  const organizationName = requiredEnv('RESET_ORGANIZATION_NAME');
  const universityName = requiredEnv('RESET_UNIVERSITY_NAME');
  const universityCode = requiredEnv('RESET_UNIVERSITY_CODE');
  const adminEmail = requiredEnv('RESET_SUPERADMIN_EMAIL');
  const adminName = requiredEnv('RESET_SUPERADMIN_NAME');
  const adminPassword = process.env.RESET_SUPERADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('Required environment variable RESET_SUPERADMIN_PASSWORD is not set.');
  }
  if (adminPassword.length < 12) {
    throw new Error('RESET_SUPERADMIN_PASSWORD must be at least 12 characters long.');
  }

  const databases = await prisma.$queryRaw`SELECT current_database() AS name`;
  if (databases[0]?.name !== expectedDatabase) {
    throw new Error('The connected database does not match RESET_DATABASE_NAME; no data was changed.');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.$transaction(async (tx) => {
    const tables = await tx.$queryRaw`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
      ORDER BY tablename
    `;
    if (tables.length === 0) {
      throw new Error('No application tables found; no data was changed.');
    }

    const tableNames = tables
      .map(({ tablename }) => `"public"."${String(tablename).replace(/"/g, '""')}"`)
      .join(', ');
    await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);

    const organization = await tx.organization.create({
      data: { name: organizationName, status: 'active' },
    });
    const university = await tx.university.create({
      data: {
        organizationId: organization.id,
        name: universityName,
        code: universityCode,
        status: 'active',
      },
    });
    await tx.user.create({
      data: {
        userId: 'superadmin',
        organizationId: organization.id,
        universityId: university.id,
        email: adminEmail,
        password: passwordHash,
        name: adminName,
        role: 'superadmin',
        status: 'active',
      },
    });
  });

  console.log('Single-tenant reset completed: one organization, one university, and one superadmin were created.');
  console.log('The Prisma migration history was preserved.');
};

run()
  .catch((error) => {
    const safeMessage = error instanceof Error
      ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')
      : 'Unknown error';
    console.error(`Single-tenant reset failed: ${safeMessage}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
