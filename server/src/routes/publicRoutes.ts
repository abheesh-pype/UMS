// @ts-nocheck
import express from 'express';
import {
  validateInviteToken,
  getPublicStudentInvite,
  publicRegister,
  getPaymentStatus,
  submitPaymentProof,
  getPublicStudentEnrollmentPrograms,
  getPublicStudentEnrollmentSessions,
  checkPublicStudentEnrollmentEmail,
  uploadPublicEnrollmentFile,
  createPublicStudentEnrollment,
  resubmitPublicStudentApplicationByCredentials,
  resubmitPublicStudentApplicationByToken,
  getPublicStudentApplicationStatusByCredentials,
  getPublicStudentApplicationStatus,
  submitPublicStudentPaymentProofByCredentials,
  submitPublicStudentPaymentProof,
} from '../controllers/publicController.js';
import { upload, uploadDocument, uploadPaymentProof } from '../middleware/upload.js';

const router = express.Router();

// No auth required on these routes
router.get('/invite/:token', validateInviteToken);
router.get('/student-invite/:token', getPublicStudentInvite);
router.post('/register', upload.array('documents', 10), publicRegister);
router.get('/payment-status/:token', getPaymentStatus);
router.post('/submit-payment/:token', upload.array('paymentProof', 1), submitPaymentProof);
router.get('/student-enrollment/programs', getPublicStudentEnrollmentPrograms);
router.get('/student-enrollment/sessions', getPublicStudentEnrollmentSessions);
router.post('/student-enrollment/check-email', checkPublicStudentEnrollmentEmail);
router.post('/student-enrollment/upload', uploadDocument.single('file'), uploadPublicEnrollmentFile);
router.post('/student-enrollment', createPublicStudentEnrollment);
router.post('/student-applications/resubmit', resubmitPublicStudentApplicationByCredentials);
router.post('/student-applications/status', getPublicStudentApplicationStatusByCredentials);
router.post('/student-applications/payment-proof', uploadPaymentProof.single('paymentProof'), submitPublicStudentPaymentProofByCredentials);
router.post('/student-applications/:token/resubmit', resubmitPublicStudentApplicationByToken);
router.get('/student-applications/:token', getPublicStudentApplicationStatus);
router.post('/student-applications/:token/payment-proof', uploadPaymentProof.single('paymentProof'), submitPublicStudentPaymentProof);

export default router;
