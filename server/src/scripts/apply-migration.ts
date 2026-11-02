/**
 * Applies one migration from prisma/migrations through the app's own database connection, which
 * waits for Neon to wake up (the Prisma CLI gives up after ~5 s and reports P1001). Records it in
 * _prisma_migrations exactly like `prisma migrate resolve --applied`, so Prisma's history stays
 * consistent. Does nothing if the migration is already recorded.
 *
 * Usage: npx tsx src/scripts/apply-migration.ts 20261102100000_add_examination_results
 */
import { createHash, randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import prisma from '../lib/prisma.js';

const main = async () => {
  const name = process.argv[2];
  if (!name || !/^\d{14}_[a-z0-9_]+$/.test(name)) {
    throw new Error('Pass the migration folder name, e.g. 20261102100000_add_examination_results');
  }
  const sql = readFileSync(path.resolve('prisma/migrations', name, 'migration.sql'), 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');

  const recorded = await prisma.$queryRawUnsafe<{ finished_at: Date | null }[]>(
    'SELECT finished_at FROM "_prisma_migrations" WHERE migration_name = $1',
    name,
  );
  if (recorded.some(row => row.finished_at)) {
    console.log(`${name} is already applied. Nothing to do.`);
    return;
  }

  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map(statement => statement.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean);

  // DDL is transactional in PostgreSQL: either every statement applies, or none does.
  await prisma.$transaction(async tx => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
    await tx.$executeRawUnsafe(
      `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES ($1, $2, now(), $3, NULL, NULL, now(), 1)`,
      randomUUID(), checksum, name,
    );
  });
  console.log(`Applied ${name} (${statements.length} statements) and recorded it in _prisma_migrations.`);
};

main()
  .catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
