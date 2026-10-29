// @ts-nocheck
import express from 'express';
import {
  createInvoice,
  updateInvoice,
  deleteInvoice,
  approveInvoice,
  getPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  approveExpense,
  getTargets,
  getTarget,
  createTarget,
  updateTarget,
  deleteTarget,
  getFeeStructures,
  getFeeStructure,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  getAuthFees,
  createAuthFee,
  updateAuthFee,
  getPendingPaymentCenters,
  assignFinanceCenter,
  updateCenterPaymentProof,
  financeVerifyCenter,
  createStudyCenter,
  getIncomeExpenditureReport,
  getFinanceSalesUsers,
  getUniversityFeePayments,
  payUniversityFee,
  getTotalReport,
  getReregPendingReport,
  getReregCompletedReport,
} from '../controllers/financeController.js';
import { upload, uploadPaymentProof } from '../middleware/upload.js';
import {
  getProgramFees,
  getProgramFee,
  createProgramFee,
  updateProgramFee,
  deleteProgramFee,
} from '../controllers/programFeeController.js';
import {
  getWalletTopUps,
  approveWalletTopUp,
  rejectWalletTopUp,
  getWalletLedger,
} from '../controllers/walletTopUpController.js';
import {
  getFinanceEnrollments,
  approveFinanceEnrollment,
  rejectFinanceEnrollment,
  getFinanceAllEnrollments,
  processRefund,
  assignFinanceEnrollment,
} from '../controllers/financeEnrollmentController.js';
import {
  getStudentPaymentLogs,
  recordReceipt,
  updateReceipt,
  deleteReceipt,
  addExtraFee,
} from '../controllers/financeStudentPaymentController.js';
import {
  getFinanceSalaryConfigs,
  approveSalaryConfig,
} from '../controllers/salaryController.js';
import {
  getPayrollBatches,
  getPayrollBatch,
  financeApprovePayrollBatch,
  financeRejectPayrollBatch,
  markBatchPaymentInProgress,
  completeBatchPayment,
  getFinancePayrollRecords,
  financeApprovePayrolls,
} from '../controllers/payrollController.js';
import {
  getInvoices,
  getInvoice,
  recordInvoicePayment,
  autoGenerateInvoices,
  recalculateInvoice
} from '../controllers/financeInvoiceController.js';
import {
  getDetailedIncomeExpenditureReport,
  getFinanceTransactions,
  createFinanceTransaction,
  updateFinanceTransaction,
  deleteFinanceTransaction,
} from '../controllers/incomeExpenditureController.js';
import { getBankDetails, updateBankDetails } from '../controllers/bankDetailsController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Collection bank details: readable by every signed-in user (shown on invoices), editable by Finance
router.route('/bank-details')
  .get(getBankDetails)
  .put(authorize('finance_admin', 'org_admin', 'superadmin'), updateBankDetails);

// Invoices
router.route('/invoices').get(getInvoices).post(createInvoice);
router.post('/invoices/auto-generate', autoGenerateInvoices);
router.route('/invoices/:id')
  .get(getInvoice)
  .put(updateInvoice)
  .delete(authorize('finance_admin'), deleteInvoice);
router.post('/invoices/:id/payments', recordInvoicePayment);
router.post('/invoices/:id/recalculate', recalculateInvoice);
router.put('/invoices/:id/approve', authorize('finance_admin'), approveInvoice);

// Payments
router.route('/payments').get(getPayments).post(authorize('finance_admin'), createPayment);
router.route('/payments/:id')
  .get(getPayment)
  .put(authorize('finance_admin'), updatePayment)
  .delete(authorize('finance_admin'), deletePayment);

// Expenses
router.route('/expenses').get(getExpenses).post(createExpense);
router.route('/expenses/:id')
  .get(getExpense)
  .put(updateExpense)
  .delete(authorize('finance_admin'), deleteExpense);
router.put('/expenses/:id/approve', authorize('finance_admin'), approveExpense);

// Targets
router.route('/targets').get(getTargets).post(authorize('finance_admin'), createTarget);
router.route('/targets/:id')
  .get(getTarget)
  .put(authorize('finance_admin'), updateTarget)
  .delete(authorize('finance_admin'), deleteTarget);

// Fee Structures
router.route('/fees').get(getFeeStructures).post(authorize('finance_admin'), createFeeStructure);
router.route('/fees/:id')
  .get(getFeeStructure)
  .put(authorize('finance_admin'), updateFeeStructure)
  .delete(authorize('finance_admin'), deleteFeeStructure);

// University Auth Fees
router.route('/auth-fees').get(authorize('finance_admin'), getAuthFees).post(authorize('finance_admin'), createAuthFee);
router.put('/auth-fees/:id', authorize('finance_admin'), updateAuthFee);

// Study Center Payment Verification & Creation
router.get('/centers/pending-payment', authorize('finance_admin', 'finance_sub_admin'), getPendingPaymentCenters);
router.put('/centers/:id/assign', authorize('finance_admin'), assignFinanceCenter);
router.put('/centers/:id/payment-proof', authorize('finance_admin', 'finance_sub_admin'), uploadPaymentProof.single('proofFile'), updateCenterPaymentProof);
router.post('/centers', authorize('finance_admin', 'org_admin', 'superadmin'), createStudyCenter);
router.put('/centers/:id/finance-verify', authorize('finance_admin', 'finance_sub_admin'), financeVerifyCenter);

// Program Fee Structures
router.route('/program-fees').get(authorize('finance_admin'), getProgramFees).post(authorize('finance_admin'), createProgramFee);
router.route('/program-fees/:id')
  .get(authorize('finance_admin'), getProgramFee)
  .put(authorize('finance_admin'), updateProgramFee)
  .delete(authorize('finance_admin'), deleteProgramFee);

// Wallet Top-Ups
router.get('/wallet-topups', authorize('finance_admin'), getWalletTopUps);
router.put('/wallet-topups/:id/approve', authorize('finance_admin'), approveWalletTopUp);
router.put('/wallet-topups/:id/reject', authorize('finance_admin'), rejectWalletTopUp);
router.get('/wallet-ledger', authorize('finance_admin'), getWalletLedger);

// Student Payments (Finance)
router.get('/student-payments', authorize('finance_admin'), getStudentPaymentLogs);
router.post('/student-payments/:id/receipt', authorize('finance_admin'), recordReceipt);
router.put('/student-payments/:id/receipts/:receiptId', authorize('finance_admin'), updateReceipt);
router.delete('/student-payments/:id/receipts/:receiptId', authorize('finance_admin'), deleteReceipt);
router.post('/student-payments/:id/extra-fee', authorize('finance_admin'), addExtraFee);

// Finance Enrollment Review
router.get('/enrollments/all', authorize('finance_admin', 'finance_sub_admin', 'employee', 'superadmin', 'org_admin'), getFinanceAllEnrollments);
router.get('/enrollments', authorize('finance_admin', 'finance_sub_admin', 'employee', 'superadmin', 'org_admin'), getFinanceEnrollments);
router.put('/enrollments/:id/assign', authorize('finance_admin', 'finance_sub_admin', 'superadmin', 'org_admin'), assignFinanceEnrollment);
router.put('/enrollments/:id/approve', authorize('finance_admin', 'finance_sub_admin', 'employee', 'superadmin', 'org_admin'), approveFinanceEnrollment);
router.put('/enrollments/:id/reject', authorize('finance_admin', 'finance_sub_admin', 'employee', 'superadmin', 'org_admin'), rejectFinanceEnrollment);
router.post('/enrollments/:id/refund', authorize('finance_admin', 'superadmin', 'org_admin'), processRefund);

// Reports
router.get('/reports/income-expenditure', authorize('finance_admin'), getIncomeExpenditureReport);
router.get('/reports/income-expenditure/detailed', authorize('finance_admin', 'superadmin', 'org_admin', 'ceo'), getDetailedIncomeExpenditureReport);
router.get('/transactions', authorize('finance_admin', 'superadmin', 'org_admin', 'ceo'), getFinanceTransactions);
router.post('/transactions', authorize('finance_admin'), createFinanceTransaction);
router.put('/transactions/:id', authorize('finance_admin'), updateFinanceTransaction);
router.delete('/transactions/:id', authorize('finance_admin'), deleteFinanceTransaction);

// Sales users (for target assignment)
router.get('/sales-users', authorize('finance_admin'), getFinanceSalesUsers);

// University Fee Payments
router.get('/university-fees', authorize('finance_admin'), getUniversityFeePayments);
router.post('/university-fees/:id/pay', authorize('finance_admin'), uploadPaymentProof.single('screenshot'), payUniversityFee);

// Salary Config Approval
router.get('/salary-configs', authorize('finance_admin'), getFinanceSalaryConfigs);
router.put('/salary-configs/:id/approve', authorize('finance_admin'), approveSalaryConfig);

// Payroll Batches (from HR)
router.get('/payroll-batches', authorize('finance_admin', 'hr_admin'), getPayrollBatches);
router.get('/payroll-batches/:id', authorize('finance_admin', 'hr_admin'), getPayrollBatch);
router.post('/payroll-batches/:id/approve', authorize('finance_admin'), financeApprovePayrollBatch);
router.post('/payroll-batches/:id/reject', authorize('finance_admin'), financeRejectPayrollBatch);
router.put('/payroll-batches/:id/payment-in-progress', authorize('finance_admin'), markBatchPaymentInProgress);
router.put('/payroll-batches/:id/complete-payment', authorize('finance_admin'), completeBatchPayment);

// Payroll records submitted by HR (Finance review & approval)
router.get('/payroll-records', authorize('finance_admin', 'org_admin', 'superadmin'), getFinancePayrollRecords);
router.post('/payroll-records/approve', authorize('finance_admin', 'org_admin', 'superadmin'), financeApprovePayrolls);

// Total Data Report
router.get('/total-report', getTotalReport);

// Re-Reg Pending Report
router.get('/rereg-pending-report', authorize('finance_admin', 'center_admin'), getReregPendingReport);
router.get('/rereg-completed-report', authorize('finance_admin', 'center_admin'), getReregCompletedReport);

export default router;
