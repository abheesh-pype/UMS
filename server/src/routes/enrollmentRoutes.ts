// @ts-nocheck
import express from 'express';
import {
  getWallet,
  submitTopUp,
  getTopUpHistory,
  getWalletTransactions,
  getEnrollablePrograms,
  createEnrollment,
  updateEnrollment,
  getMyEnrollments,
  getMyCenterStatus,
  submitMyCenterPayment,
  getAllEnrollments,
  getActiveSessions,
  checkEmailUniqueness,
  processPaymentStage,
} from '../controllers/enrollmentController.js';
import {
  getPendingReviews,
  getDeptReviewEnrollments,
  approveDeptEnrollment,
  rejectDeptEnrollment,
  assignDeptEnrollment,
  resubmitToFinance,
} from '../controllers/enrollmentReviewController.js';
import {
  getUniversityReviewQueue,
  approveUniversityEnrollment,
  rejectUniversityEnrollment,
} from '../controllers/universityEnrollmentController.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.use(protect);

// Study Center wallet routes
router.get('/wallet', authorize('center_admin'), getWallet);
router.post('/wallet/topup', authorize('center_admin'), upload.single('proofDocument'), submitTopUp);
router.get('/wallet/topups', authorize('center_admin'), getTopUpHistory);
router.get('/wallet/transactions', authorize('center_admin'), getWalletTransactions);

// Study Center enrollment routes
router.get('/programs', authorize('center_admin'), getEnrollablePrograms);
router.get('/sessions', authorize('center_admin'), getActiveSessions);
router.post('/check-email', authorize('center_admin'), checkEmailUniqueness);
router.post('/enroll', authorize('center_admin'), createEnrollment);
router.put('/enroll/:id', authorize('center_admin'), updateEnrollment);
router.post('/enroll/:id/pay', authorize('center_admin'), processPaymentStage);
router.get('/enrollments', authorize('center_admin'), getMyEnrollments);

// Center onboarding status & payment (authenticated)
router.get('/my-center-status', authorize('center_admin'), getMyCenterStatus);
router.post('/submit-payment', authorize('center_admin'), upload.single('proofFile'), submitMyCenterPayment);

// Dedicated file upload for enrollment documents
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  const uploadPath = process.env.UPLOAD_PATH || './uploads';
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl, filename: req.file.originalname });
});

// Global enrollment list (for admins/staff)
router.get('/all', authorize('superadmin', 'org_admin', 'ceo', 'ops_admin', 'finance_admin', 'sales_admin', 'bde', 'employee'), getAllEnrollments);

// Dept/Sub-dept manager review routes
router.get('/review', authorize('ops_admin', 'ops_sub_admin', 'employee'), getPendingReviews);
router.put('/review/:id/assign', authorize('ops_admin', 'ops_sub_admin', 'superadmin', 'org_admin'), assignDeptEnrollment);
router.put('/review/:id/approve', authorize('ops_admin', 'ops_sub_admin', 'employee'), approveDeptEnrollment);
router.put('/review/:id/reject', authorize('ops_admin', 'ops_sub_admin', 'employee'), rejectDeptEnrollment);
router.put('/review/:id/resubmit', authorize('ops_admin', 'ops_sub_admin', 'employee', 'superadmin', 'org_admin'), resubmitToFinance);

// University admin enrollment verification
router.get('/university-review', authorize('university_admin', 'org_admin'), getUniversityReviewQueue);
router.put('/university-review/:id/approve', authorize('university_admin', 'org_admin'), approveUniversityEnrollment);
router.put('/university-review/:id/reject', authorize('university_admin', 'org_admin'), rejectUniversityEnrollment);

export default router;
