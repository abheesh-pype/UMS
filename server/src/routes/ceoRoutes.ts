// @ts-nocheck
import express from 'express';
import {
  getPerformanceMetrics,
  getRiskMetrics,
  getEscalations,
  getAnalytics,
  getDepartmentManagers,
  assignTask,
  getKPIKRAReport,
  getCenterOnboardingOverview,
  getStudentEnrollmentOverview,
} from '../controllers/ceoController.js';
import { handleCeoEscalation } from '../controllers/escalationController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(authorize('ceo'));

// Metrics routes
router.get('/metrics/performance', getPerformanceMetrics);
router.get('/metrics/risk', getRiskMetrics);
router.get('/analytics', getAnalytics);

// Center onboarding & enrollment overview
router.get('/center-onboarding', getCenterOnboardingOverview);
router.get('/enrollment-overview', getStudentEnrollmentOverview);

// Escalation routes
router.get('/escalations', getEscalations);
router.patch('/escalations/:id', handleCeoEscalation);

// Task assignment routes
router.get('/managers', getDepartmentManagers);
router.post('/tasks', assignTask);

// KPI / KRA org-wide report
router.get('/kpi-kra-report', getKPIKRAReport);

export default router;
