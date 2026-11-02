import prisma from '../lib/prisma.js';

// Study materials (E-Books, module videos, video classes) are kept in the database
// rather than the local uploads folder, so every machine sharing the database can serve them.
export const STORED_FILE_URL_PREFIX = `/api/${process.env.API_VERSION || 'v1'}/files/`;

export const saveUploadedFile = async (
  file: { buffer: Buffer; originalname: string; mimetype?: string; size?: number },
  organizationId?: string | null,
): Promise<string> => {
  const stored = await prisma.storedFile.create({
    data: {
      organizationId: organizationId || null,
      fileName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size ?? file.buffer.length,
      data: new Uint8Array(file.buffer),
    },
    select: { id: true },
  });
  return `${STORED_FILE_URL_PREFIX}${stored.id}`;
};

// Removes the stored file behind a URL produced by saveUploadedFile; other URLs are left alone.
export const deleteStoredFileByUrl = async (url?: string | null): Promise<void> => {
  if (!url?.startsWith(STORED_FILE_URL_PREFIX)) return;
  // Links may end with the file name: /files/<id>/<name>
  const id = url.slice(STORED_FILE_URL_PREFIX.length).split(/[/?#]/)[0];
  await prisma.storedFile.deleteMany({ where: { id } });
};

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

// Enrollment uploads (student photo, documents, payment proofs) used to be returned and saved as
// base64 data URLs inside the enrollment rows, which made every enrollment list download every
// file. They are stored as files instead, and the link ends with the file name so screens can
// still tell an image from a PDF by its extension.
export const saveEnrollmentUpload = async (
  file: { buffer: Buffer; originalname: string; mimetype: string; size?: number },
  organizationId?: string | null,
): Promise<string> => {
  const url = await saveUploadedFile(file, organizationId);
  const extension = EXTENSION_BY_MIME[file.mimetype];
  let name = (file.originalname || 'file').replace(/[^\w.-]+/g, '_').slice(-80) || 'file';
  if (extension && !name.toLowerCase().endsWith(`.${extension}`) && !(extension === 'jpg' && /\.jpeg$/i.test(name))) {
    name = `${name}.${extension}`;
  }
  return `${url}/${encodeURIComponent(name)}`;
};

// A file link produced by saveEnrollmentUpload
export const STORED_ENROLLMENT_UPLOAD_PATTERN = new RegExp(`^${STORED_FILE_URL_PREFIX}[0-9a-f-]{36}/[^/]+$`, 'i');

// Study center payment proofs: the file goes to stored_files and the record keeps its URL, name and type.
export const savePaymentProofFile = async (
  file: { buffer: Buffer; originalname: string; mimetype: string; size?: number },
  organizationId?: string | null,
) => ({
  url: await saveUploadedFile(file, organizationId),
  fileName: file.originalname,
  mimeType: file.mimetype,
});
