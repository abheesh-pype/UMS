import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const useSSL = process.env.DATABASE_URL && 
               !process.env.DATABASE_URL.includes('localhost') && 
               !process.env.DATABASE_URL.includes('127.0.0.1') &&
               !process.env.DATABASE_URL.includes('::1');

const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined
});

const DEFAULT_STATUSES = [
  {
    code: 'pending_verification',
    name: 'Pending Operations Verification',
    stage: 'operations',
    state: 'pending',
    stepOrder: 1,
    description: 'Study center submitted by Sales, awaiting Operations review and verification',
    allowedNextStatuses: ['pending_payment', 'ops_rejected', 'rejected']
  },
  {
    code: 'ops_rejected',
    name: 'Operations Rejected',
    stage: 'operations',
    state: 'rejected',
    stepOrder: 1,
    description: 'Application rejected by Operations team; awaiting corrections from Sales',
    allowedNextStatuses: ['ops_resubmitted', 'pending_verification']
  },
  {
    code: 'rejected',
    name: 'Operations Rejected (Legacy)',
    stage: 'operations',
    state: 'rejected',
    stepOrder: 1,
    description: 'Legacy code for centers rejected by Operations team',
    allowedNextStatuses: ['ops_resubmitted', 'pending_verification']
  },
  {
    code: 'ops_resubmitted',
    name: 'Operations Resubmitted',
    stage: 'operations',
    state: 'resubmitted',
    stepOrder: 1,
    description: 'Corrected application resubmitted by Sales, awaiting Operations re-verification',
    allowedNextStatuses: ['pending_payment', 'ops_rejected', 'rejected']
  },
  {
    code: 'pending_payment',
    name: 'Pending Finance Verification',
    stage: 'finance',
    state: 'pending',
    stepOrder: 2,
    description: 'Approved by Operations; awaiting Finance authorization fee verification',
    allowedNextStatuses: ['active', 'finance_rejected', 'rejected_from_finance']
  },
  {
    code: 'finance_rejected',
    name: 'Finance Rejected',
    stage: 'finance',
    state: 'rejected',
    stepOrder: 2,
    description: 'Payment verification rejected by Finance; awaiting payment correction and resubmission',
    allowedNextStatuses: ['finance_resubmitted', 'pending_payment']
  },
  {
    code: 'rejected_from_finance',
    name: 'Finance Rejected (Legacy)',
    stage: 'finance',
    state: 'rejected',
    stepOrder: 2,
    description: 'Legacy code for centers rejected by Finance team',
    allowedNextStatuses: ['finance_resubmitted', 'pending_payment']
  },
  {
    code: 'finance_resubmitted',
    name: 'Finance Resubmitted',
    stage: 'finance',
    state: 'resubmitted',
    stepOrder: 2,
    description: 'Corrected payment details resubmitted, awaiting Finance re-verification',
    allowedNextStatuses: ['active', 'finance_rejected', 'rejected_from_finance']
  },
  {
    code: 'active',
    name: 'Active',
    stage: 'completed',
    state: 'active',
    stepOrder: 3,
    description: 'Final Finance approval granted; Study Centre is fully active',
    allowedNextStatuses: ['suspended', 'inactive']
  },
  {
    code: 'suspended',
    name: 'Suspended',
    stage: 'completed',
    state: 'suspended',
    stepOrder: 3,
    description: 'Study centre operations suspended',
    allowedNextStatuses: ['active']
  },
  {
    code: 'inactive',
    name: 'Inactive',
    stage: 'completed',
    state: 'inactive',
    stepOrder: 3,
    description: 'Study centre deactivated',
    allowedNextStatuses: ['active']
  }
];

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting Study Center Onboarding Status migration...');

    await client.query('BEGIN');

    // 1. Create table study_centre_onboarding_statuses if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS "study_centre_onboarding_statuses" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" TEXT NOT NULL UNIQUE,
        "name" TEXT NOT NULL,
        "stage" TEXT NOT NULL,
        "state" TEXT NOT NULL,
        "stepOrder" INTEGER NOT NULL DEFAULT 1,
        "description" TEXT,
        "allowedNextStatuses" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created table study_centre_onboarding_statuses');

    // 2. Add onboardingStatusId column to StudyCenter
    await client.query(`
      ALTER TABLE "StudyCenter"
      ADD COLUMN IF NOT EXISTS "onboardingStatusId" TEXT;
    `);
    console.log('✅ Added column onboardingStatusId to StudyCenter');

    // 3. Add foreign key constraint if not exists
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'StudyCenter_onboardingStatusId_fkey'
        ) THEN
          ALTER TABLE "StudyCenter"
          ADD CONSTRAINT "StudyCenter_onboardingStatusId_fkey"
          FOREIGN KEY ("onboardingStatusId")
          REFERENCES "study_centre_onboarding_statuses"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    // 4. Create index on onboardingStatusId
    await client.query(`
      CREATE INDEX IF NOT EXISTS "StudyCenter_onboardingStatusId_idx"
      ON "StudyCenter"("onboardingStatusId");
    `);

    // 5. Seed default statuses (upsert by code)
    for (const s of DEFAULT_STATUSES) {
      await client.query(`
        INSERT INTO "study_centre_onboarding_statuses" (
          "id", "code", "name", "stage", "state", "stepOrder", "description", "allowedNextStatuses", "isActive", "updatedAt"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("code") DO UPDATE SET
          "name" = EXCLUDED."name",
          "stage" = EXCLUDED."stage",
          "state" = EXCLUDED."state",
          "stepOrder" = EXCLUDED."stepOrder",
          "description" = EXCLUDED."description",
          "allowedNextStatuses" = EXCLUDED."allowedNextStatuses",
          "isActive" = EXCLUDED."isActive",
          "updatedAt" = CURRENT_TIMESTAMP;
      `, [
        s.code,
        s.name,
        s.stage,
        s.state,
        s.stepOrder,
        s.description,
        JSON.stringify(s.allowedNextStatuses)
      ]);
    }
    console.log(`✅ Seeded ${DEFAULT_STATUSES.length} onboarding statuses`);

    // 6. Migrate existing study centers in the DB
    const statusMapRes = await client.query(`SELECT "id", "code" FROM "study_centre_onboarding_statuses";`);
    const statusIdByCode: Record<string, string> = {};
    statusMapRes.rows.forEach(r => { statusIdByCode[r.code] = r.id; });

    const centersRes = await client.query(`
      SELECT "id", "status", "verifiedBy", "paymentRemarks" FROM "StudyCenter";
    `);
    console.log(`🔍 Checking ${centersRes.rows.length} existing study centers...`);

    let migratedCount = 0;
    for (const c of centersRes.rows) {
      let targetCode = c.status || 'pending_verification';

      if (targetCode === 'pending') {
        targetCode = 'pending_verification';
      } else if (targetCode === 'rejected') {
        // If it was rejected by finance (has verifiedBy from ops + paymentRemarks)
        if (c.verifiedBy && c.paymentRemarks) {
          targetCode = 'finance_rejected';
        } else {
          targetCode = 'ops_rejected';
        }
      } else if (targetCode === 'rejected_from_finance') {
        targetCode = 'finance_rejected';
      }

      const statusId = statusIdByCode[targetCode] || statusIdByCode['pending_verification'];
      if (statusId) {
        await client.query(`
          UPDATE "StudyCenter"
          SET "onboardingStatusId" = $1, "status" = $2
          WHERE "id" = $3;
        `, [statusId, targetCode, c.id]);
        migratedCount++;
      }
    }
    console.log(`✅ Successfully mapped and linked ${migratedCount} study centers to onboarding status records`);

    await client.query('COMMIT');
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error(err);
  process.exit(1);
});
