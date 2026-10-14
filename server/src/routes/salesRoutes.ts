// @ts-nocheck
import express from 'express';
import {
  getLeads,
  getLead,
  createLead,
  updateLead,
  convertLead,
  deleteLead,
  getTargets,
  getTarget,
  createTarget,
  updateTarget,
  deleteTarget,
  generateInvite,
  listMyInvites,
  regenerateInvite,
  getTeamPerformance,
  getMyCenters,
  resubmitFinanceRejectedCenter,
  getMyCenterAdmissions,
  getMyCenterDetail,
  getProgramsByUniversity,
  getTeamMembers,
  reassignCenter,
} from '../controllers/salesController.js';
import { protect, authorize } from '../middleware/auth.js';
import {
  getSalesEnrollmentPipeline,
  getSalesEnrollmentPrograms,
  getSalesEnrollmentSessions,
  checkSalesEnrollmentEmail,
  createSalesStudentEnrollment,
} from '../controllers/salesEnrollmentController.js';

const router = express.Router();

router.use(protect);

// Lead routes
router.route('/leads').get(getLeads).post(createLead);
router.route('/leads/:id').get(getLead).put(updateLead).delete(deleteLead);
router.put('/leads/:id/convert', convertLead);

// Target routes
router.route('/targets').get(getTargets).post(authorize('sales_admin', 'ceo'), createTarget);
router.route('/targets/:id').get(getTarget).put(authorize('sales_admin', 'ceo'), updateTarget).delete(authorize('sales_admin', 'ceo'), deleteTarget);

// Invite routes — available to all sales department employees
router.route('/invites').get(listMyInvites).post(generateInvite);
router.patch('/invites/:id/regenerate', regenerateInvite);

// Programs by university (for invite creation)
router.get('/programs-by-university', getProgramsByUniversity);

// Team performance
router.get('/team-performance', getTeamPerformance);

// Team members list for reassignment selection
router.get('/team-members', getTeamMembers);
router.get('/student-applications', authorize('sales_admin', 'sales_sub_admin', 'bde', 'employee'), getSalesEnrollmentPipeline);
router.get('/enrollment-programs', authorize('sales_sub_admin', 'bde', 'employee'), getSalesEnrollmentPrograms);
router.get('/enrollment-sessions', authorize('sales_sub_admin', 'bde', 'employee'), getSalesEnrollmentSessions);
router.post('/enrollment-check-email', authorize('sales_sub_admin', 'bde', 'employee'), checkSalesEnrollmentEmail);
router.post('/enroll-student', authorize('sales_sub_admin', 'bde', 'employee'), createSalesStudentEnrollment);

// My study centers (via invite links — self + subordinates)
router.get('/my-centers', getMyCenters);
router.put('/my-centers/:studyCenterId/resubmit', resubmitFinanceRejectedCenter);
router.get('/my-centers/admissions', getMyCenterAdmissions);
router.get('/my-centers/:studyCenterId', getMyCenterDetail);
router.put('/my-centers/:studyCenterId/reassign', reassignCenter);

export default router;
