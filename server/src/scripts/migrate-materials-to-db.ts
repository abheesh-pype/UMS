// @ts-nocheck
/**
 * Moves study material files (E-Books, module videos, video classes) that still point at
 * files in the uploads folder (`/uploads/<file>`) into the stored_files table, and points
 * each material at /api/v1/files/<id>.
 *
 * Run it on the machine whose uploads folder holds the files:
 *   npm run migrate-materials            -> dry run, only reports what would change
 *   npm run migrate-materials -- --apply -> copies the files into the database
 */
import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma.js';
import { saveUploadedFile } from '../services/fileStorage.js';

const apply = process.argv.includes('--apply');
const uploadDir = path.resolve(process.env.UPLOAD_PATH || './uploads');

const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.m4v': 'video/x-m4v',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

const run = async () => {
  const materials = await prisma.programMaterial.findMany({
    where: { fileUrl: { startsWith: '/uploads/' } },
    select: { id: true, organizationId: true, fileUrl: true, fileName: true },
  });
  const stats = { moved: 0, missing: 0 };
  const missingFiles: string[] = [];

  for (const material of materials) {
    const storedName = path.basename(material.fileUrl.replace(/^\/uploads\//, ''));
    const filePath = path.join(uploadDir, storedName);
    if (!fs.existsSync(filePath)) {
      stats.missing += 1;
      missingFiles.push(storedName);
      continue;
    }
    stats.moved += 1;
    if (!apply) continue;
    const buffer = fs.readFileSync(filePath);
    const fileUrl = await saveUploadedFile({
      buffer,
      originalname: material.fileName || storedName,
      mimetype: MIME_BY_EXT[path.extname(storedName).toLowerCase()] || 'application/octet-stream',
      size: buffer.length,
    }, material.organizationId);
    await prisma.programMaterial.update({ where: { id: material.id }, data: { fileUrl } });
  }

  console.log(`${apply ? 'Moved' : 'Would move'} ${stats.moved} of ${materials.length} material file(s) into the database.`);
  if (stats.missing) {
    console.log(`${stats.missing} file(s) are not in ${uploadDir} and were left unchanged:`);
    missingFiles.forEach(name => console.log(`  - ${name}`));
  }
  if (!apply) console.log('Dry run only. Re-run with --apply to write the changes.');
};

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
