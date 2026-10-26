import express from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getReceiverConfigIssues, loadReceiverConfig, ReceiverError, upsertCandidate, validateStudentPayload, verifyBearerToken,
} from '../services/examPortalReceiver.js';

const router = express.Router();

// Machine-to-machine endpoint: authenticated by OAuth bearer token, not by a UMS user session.
router.post('/v1/students', asyncHandler(async (req, res) => {
  const config = loadReceiverConfig();
  if (!config) {
    const { missing, invalid } = getReceiverConfigIssues();
    console.error('Exam Portal receiver is not configured:', [...missing, ...invalid].join(', '));
    res.status(503).json({ ok: false, error: 'not_configured' });
    return;
  }
  try {
    await verifyBearerToken(req.headers.authorization, config);
    const data = validateStudentPayload(req.body, config);
    const header = req.headers['idempotency-key'];
    const outcome = await upsertCandidate(prisma, data, typeof header === 'string' ? header.slice(0, 128) : undefined);
    res.status(outcome === 'created' ? 201 : 200).json({ ok: true, external_student_id: data.externalStudentId, result: outcome });
  } catch (error) {
    if (error instanceof ReceiverError) {
      res.status(error.statusCode).json({ ok: false, error: error.code, message: error.message });
      return;
    }
    throw error;
  }
}));

export default router;
