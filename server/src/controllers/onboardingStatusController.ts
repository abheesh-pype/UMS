// @ts-nocheck
import { Response, Request } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getAllOnboardingStatuses,
  getOnboardingStatusByCode,
} from '../services/onboardingStatusService.js';

export const getOnboardingStatuses = asyncHandler(async (req: Request, res: Response) => {
  const statuses = await getAllOnboardingStatuses();
  res.json({
    success: true,
    count: statuses.length,
    data: statuses,
  });
});

export const getOnboardingStatusDetail = asyncHandler(async (req: Request, res: Response) => {
  const status = await getOnboardingStatusByCode(req.params.code);
  if (!status) {
    res.status(404).json({ success: false, message: 'Onboarding status not found' });
    return;
  }
  res.json({
    success: true,
    data: status,
  });
});

export const getOnboardingStages = asyncHandler(async (req: Request, res: Response) => {
  const statuses = await getAllOnboardingStatuses();
  const stages = {
    operations: statuses.filter(s => s.stage === 'operations'),
    finance: statuses.filter(s => s.stage === 'finance'),
    completed: statuses.filter(s => s.stage === 'completed'),
  };
  res.json({
    success: true,
    data: stages,
  });
});
