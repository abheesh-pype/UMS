import express from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

// Public like the old /uploads folder: links are opened by <a>, <video> and <iframe>,
// which cannot send the auth header. File ids are random UUIDs.
router.get('/:id', asyncHandler(async (req, res) => {
  const file = await prisma.storedFile.findUnique({ where: { id: req.params.id } });
  if (!file) {
    res.status(404).json({ success: false, message: 'File not found' });
    return;
  }

  const data = Buffer.from(file.data);
  const total = data.length;
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);

  // Videos are fetched in byte ranges so the player can seek.
  const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    const start = range[1] ? parseInt(range[1], 10) : Math.max(total - parseInt(range[2], 10), 0);
    const end = range[1] && range[2] ? Math.min(parseInt(range[2], 10), total - 1) : total - 1;
    if (start > end || start >= total) {
      res.status(416).setHeader('Content-Range', `bytes */${total}`);
      res.end();
      return;
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Content-Length', end - start + 1);
    res.end(data.subarray(start, end + 1));
    return;
  }

  res.setHeader('Content-Length', total);
  res.end(data);
}));

export default router;
