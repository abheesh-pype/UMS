// @ts-nocheck
import express from 'express';
import {
  getPayrolls,
  getPayroll,
  createPayroll,
  updatePayroll,
  processPayroll,
  markPayrollPaid,
  deletePayroll,
  generateMonthlyPayroll,
  confirmPayroll,
  transferToFinance,
  getPayrollBatches,
  getPayrollBatch,
  financeApprovePayrollBatch,
  financeRejectPayrollBatch,
  markBatchPaymentInProgress,
  completeBatchPayment,
} from '../controllers/payrollController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Payroll batch routes (for finance)
router.get('/batches', authorize('hr_admin', 'finance_admin', 'org_admin', 'ceo', 'superadmin'), getPayrollBatches);
router.get('/batches/:id', authorize('hr_admin', 'finance_admin', 'org_admin', 'ceo', 'superadmin'), getPayrollBatch);
router.post('/batches/:id/approve', authorize('finance_admin', 'org_admin', 'superadmin'), financeApprovePayrollBatch);
router.post('/batches/:id/reject', authorize('finance_admin', 'org_admin', 'superadmin'), financeRejectPayrollBatch);
router.put('/batches/:id/payment-in-progress', authorize('finance_admin', 'org_admin', 'superadmin'), markBatchPaymentInProgress);
router.put('/batches/:id/complete-payment', authorize('finance_admin', 'org_admin', 'superadmin'), completeBatchPayment);

// Payroll actions (must be before /:id to avoid param conflicts)
router.post('/generate', authorize('hr_admin', 'finance_admin', 'org_admin', 'ceo', 'superadmin'), generateMonthlyPayroll);
router.post('/transfer-to-finance', authorize('hr_admin', 'finance_admin', 'org_admin', 'superadmin'), transferToFinance);

// Payroll CRUD
router.route('/').get(getPayrolls).post(authorize('hr_admin', 'finance_admin', 'org_admin', 'ceo', 'superadmin'), createPayroll);
router.route('/:id').get(getPayroll).put(authorize('hr_admin', 'finance_admin', 'org_admin', 'ceo', 'superadmin'), updatePayroll).delete(authorize('hr_admin', 'finance_admin', 'org_admin', 'ceo', 'superadmin'), deletePayroll);

// Payroll instance actions
router.put('/:id/process', authorize('hr_admin', 'finance_admin', 'org_admin', 'ceo', 'superadmin'), processPayroll);
router.put('/:id/confirm', authorize('hr_admin', 'org_admin', 'superadmin'), confirmPayroll);
router.put('/:id/pay', authorize('finance_admin', 'org_admin', 'superadmin'), markPayrollPaid);

export default router;
