/**
 * Moves base64 data URLs kept inside enrollment rows (student photo, initial payment proof,
 * uploaded documents) and student rows (photo) into stored_files and replaces them with file links, so enrollment
 * lists no longer download every file. File contents are unchanged.
 *
 * Dry run:  npx tsx src/scripts/migrate-enrollment-files-to-storage.ts
 * Apply:    npx tsx src/scripts/migrate-enrollment-files-to-storage.ts --apply
 */
import prisma from '../lib/prisma.js';
import { saveEnrollmentUpload } from '../services/fileStorage.js';

const apply = process.argv.includes('--apply');
let moved = 0;

const toStoredUrl = async (value: unknown, organizationId: string, name: string): Promise<string | null> => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:([^;,]+);base64,(.*)$/s);
  if (!match) return null;
  moved++;
  if (!apply) return value;
  const buffer = Buffer.from(match[2], 'base64');
  return saveEnrollmentUpload({ buffer, originalname: name, mimetype: match[1], size: buffer.length }, organizationId);
};

const migrateDocuments = async (documents: unknown, organizationId: string) => {
  if (!Array.isArray(documents)) return null;
  let changed = false;
  const updated = [];
  for (const document of documents as any[]) {
    const url = await toStoredUrl(document?.url, organizationId, document?.name || document?.reqName || 'document');
    if (url) changed = true;
    updated.push(url ? { ...document, url } : document);
  }
  return changed ? updated : null;
};

const main = async () => {
  const enrollments = await prisma.enrollment.findMany({
    select: { id: true, organizationId: true, studentPhoto: true, initialPaymentProof: true, documents: true },
  });
  for (const enrollment of enrollments) {
    const data: Record<string, unknown> = {};
    const photo = await toStoredUrl(enrollment.studentPhoto, enrollment.organizationId, 'student-photo');
    if (photo) data.studentPhoto = photo;
    const proof = await toStoredUrl(enrollment.initialPaymentProof, enrollment.organizationId, 'payment-proof');
    if (proof) data.initialPaymentProof = proof;
    const documents = await migrateDocuments(enrollment.documents, enrollment.organizationId);
    if (documents) data.documents = documents;
    if (apply && Object.keys(data).length) await prisma.enrollment.update({ where: { id: enrollment.id }, data });
  }

  const students = await prisma.student.findMany({
    select: { id: true, organizationId: true, studentPhoto: true },
  });
  for (const student of students) {
    const photo = await toStoredUrl(student.studentPhoto, student.organizationId, 'student-photo');
    if (apply && photo) await prisma.student.update({ where: { id: student.id }, data: { studentPhoto: photo } });
  }

  console.log(`${apply ? 'Moved' : 'Would move'} ${moved} embedded file(s) to stored_files.`);
};

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
