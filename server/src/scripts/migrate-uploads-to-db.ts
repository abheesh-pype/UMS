// @ts-nocheck
/**
 * Moves payment proofs and enrollment documents that still point at files in the
 * uploads folder (`/uploads/<file>`) into the database as base64 data URLs.
 *
 * Run it on the machine whose uploads folder holds the files (normally the production server):
 *   npm run migrate-uploads            -> dry run, only reports what would change
 *   npm run migrate-uploads -- --apply -> writes the data URLs to the database
 */
import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma.js';

const apply = process.argv.includes('--apply');
const uploadDir = path.resolve(process.env.UPLOAD_PATH || './uploads');

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const stats = { converted: 0, missing: 0 };
const missingFiles = new Set<string>();

// Returns the data URL for an uploads path, the original value when it needs no change, or null when the file is gone
const toDataUrl = (value: unknown): string | null | undefined => {
  if (typeof value !== 'string' || value.startsWith('data:') || /^https?:\/\//i.test(value)) return undefined;
  const fileName = path.basename(value.replace(/^\/?uploads\//, ''));
  if (!fileName) return undefined;
  const filePath = path.join(uploadDir, fileName);
  const mime = MIME_BY_EXT[path.extname(fileName).toLowerCase()];
  if (!mime) return undefined;
  if (!fs.existsSync(filePath)) {
    stats.missing += 1;
    missingFiles.add(fileName);
    return null;
  }
  stats.converted += 1;
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
};

const migrateStringField = async (model: string, field: string) => {
  const rows = await prisma[model].findMany({
    where: { [field]: { startsWith: '/uploads/' } },
    select: { id: true, [field]: true },
  });
  for (const row of rows) {
    const dataUrl = toDataUrl(row[field]);
    if (!dataUrl) continue;
    console.log(`${model}.${field} ${row.id}: ${row[field]}`);
    if (apply) await prisma[model].update({ where: { id: row.id }, data: { [field]: dataUrl } });
  }
};

const migrateStudyCenterProofs = async () => {
  const centers = await prisma.studyCenter.findMany({
    where: { paymentProof: { not: null } },
    select: { id: true, name: true, paymentProof: true },
  });
  for (const center of centers) {
    const proof = center.paymentProof;
    const url = typeof proof === 'string' ? proof : proof?.url;
    const dataUrl = toDataUrl(url);
    if (!dataUrl) continue;
    console.log(`studyCenter.paymentProof ${center.name}: ${url}`);
    const nextProof = typeof proof === 'string' ? { url: dataUrl } : { ...proof, url: dataUrl };
    if (apply) await prisma.studyCenter.update({ where: { id: center.id }, data: { paymentProof: nextProof } });
  }
};

const migrateEnrollmentDocuments = async () => {
  const enrollments = await prisma.enrollment.findMany({ select: { id: true, documents: true } });
  for (const enrollment of enrollments) {
    if (!Array.isArray(enrollment.documents)) continue;
    let changed = false;
    const documents = enrollment.documents.map((document: any) => {
      const dataUrl = toDataUrl(document?.url);
      if (!dataUrl) return document;
      changed = true;
      return { ...document, url: dataUrl };
    });
    if (!changed) continue;
    console.log(`enrollment.documents ${enrollment.id}`);
    if (apply) await prisma.enrollment.update({ where: { id: enrollment.id }, data: { documents } });
  }
};

const run = async () => {
  console.log(`${apply ? 'Applying' : 'Dry run'}: reading files from ${uploadDir}\n`);
  await migrateStudyCenterProofs();
  await migrateStringField('walletTopUp', 'proofDocument');
  await migrateStringField('universityFeePayment', 'screenshot');
  await migrateStringField('enrollment', 'studentPhoto');
  await migrateStringField('student', 'studentPhoto');
  await migrateEnrollmentDocuments();

  console.log(`\n${apply ? 'Converted' : 'Would convert'} ${stats.converted} file(s).`);
  if (missingFiles.size) {
    console.log(`${missingFiles.size} referenced file(s) are not in ${uploadDir} (run this where they exist, or re-upload):`);
    missingFiles.forEach(file => console.log(`  - ${file}`));
  }
  if (!apply) console.log('\nRe-run with --apply to write these changes.');
};

run()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
