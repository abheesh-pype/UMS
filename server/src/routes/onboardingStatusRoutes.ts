// @ts-nocheck
import express from 'express';
import {
  getOnboardingStatuses,
  getOnboardingStatusDetail,
  getOnboardingStages,
} from '../controllers/onboardingStatusController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Allow public or authenticated access to read statuses
router.get('/', getOnboardingStatuses);
router.get('/stages', getOnboardingStages);
router.get('/:code', getOnboardingStatusDetail);

export default router;
