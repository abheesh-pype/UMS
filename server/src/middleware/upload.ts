// @ts-nocheck
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = process.env.UPLOAD_PATH || './uploads';
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|xls|xlsx|mp4|webm|ogg|mov|mkv/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const extname = allowedTypes.test(ext);
  const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.startsWith('video/');

  if ((mimetype && extname) || file.mimetype.startsWith('video/')) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, documents, and videos are allowed.'));
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB default
  },
  fileFilter,
});

const paymentProofFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']);
  if (allowedTypes.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error('Invalid payment proof type. Upload a JPEG, PNG, GIF, WebP, or PDF file.'));
};

// Files kept in memory are stored in the database as data URLs, so cap them well below the disk upload limit
const DB_FILE_SIZE_LIMIT = parseInt(process.env.MAX_DB_FILE_SIZE || '10485760'); // 10MB default

export const uploadPaymentProof = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: DB_FILE_SIZE_LIMIT,
  },
  fileFilter: paymentProofFileFilter,
});

const documentFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]);
  if (allowedTypes.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error('Invalid document type. Upload a JPEG, PNG, GIF, WebP, PDF, DOC, or DOCX file.'));
};

// Enrollment documents (certificates, photos, ID proofs) stored in the database
export const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: DB_FILE_SIZE_LIMIT,
  },
  fileFilter: documentFileFilter,
});

const videoFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedExtensions = new Set(['.mp4', '.webm', '.mov', '.m4v']);
  const allowedMimeTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']);
  const extension = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.has(extension) && allowedMimeTypes.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error('Invalid video type. Upload an MP4, WebM, MOV, or M4V video.'));
};

export const uploadVideo = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: videoFileFilter,
});
