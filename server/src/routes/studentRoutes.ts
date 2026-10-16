// @ts-nocheck
import express from 'express';
import {
  getStudents,
  getStudent,
  getStudentResults,
  getStudentDocuments,
  getStudentExamination,
  registerForExamination,
  createStudent,
  updateStudent,
  approveStudent,
  deleteStudent,
  getInternalMarks,
  getInternalMark,
  createInternalMark,
  updateInternalMark,
  deleteInternalMark,
  getStudentInstallments,
  payStudentInstallment,
  submitStatusChangeRequest,
  getStatusChangeRequests,
  verifyStatusChangeRequest,
  confirmStatusChangeRequest,
} from '../controllers/studentController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Internal marks routes (must come before /:id routes)
router.route('/marks').get(getInternalMarks).post(authorize('ops_admin', 'employee'), createInternalMark);
router.route('/marks/:id').get(getInternalMark).put(authorize('ops_admin', 'employee'), updateInternalMark).delete(authorize('ops_admin'), deleteInternalMark);

// Installments routes
router.get('/:id/installments', getStudentInstallments);
router.post('/:id/pay-installment', authorize('center_admin'), payStudentInstallment);
router.get('/results', authorize('student'), getStudentResults);
router.get('/documents', authorize('student'), getStudentDocuments);
router.get('/examinations/:examinationId', getStudentExamination);
router.post('/examinations/:examinationId/register', registerForExamination);

// Status change request routes
router.get('/status-requests', authorize('org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'finance_admin', 'center_admin', 'employee'), getStatusChangeRequests);
router.post('/:id/status-request', authorize('center_admin'), submitStatusChangeRequest);
router.put('/status-requests/:requestId/verify', authorize('ops_admin', 'ops_sub_admin', 'employee'), verifyStatusChangeRequest);
router.put('/status-requests/:requestId/confirm', authorize('finance_admin', 'employee'), confirmStatusChangeRequest);

// Student routes
router.route('/').get(getStudents).post(authorize('org_admin', 'superadmin', 'center_admin', 'ops_admin', 'ops_sub_admin'), createStudent);
router.route('/:id').get(getStudent).put(authorize('org_admin', 'superadmin', 'center_admin', 'ops_admin', 'ops_sub_admin', 'employee'), updateStudent).delete(authorize('org_admin', 'superadmin', 'ops_admin'), deleteStudent);
router.put('/:id/approve', authorize('finance_admin', 'ops_admin'), approveStudent);

export default router;
