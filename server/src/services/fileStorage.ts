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
  await prisma.storedFile.deleteMany({ where: { id: url.slice(STORED_FILE_URL_PREFIX.length) } });
};

// Study center payment proofs: the file goes to stored_files and the record keeps its URL, name and type.
export const savePaymentProofFile = async (
  file: { buffer: Buffer; originalname: string; mimetype: string; size?: number },
  organizationId?: string | null,
) => ({
  url: await saveUploadedFile(file, organizationId),
  fileName: file.originalname,
  mimeType: file.mimetype,
});
