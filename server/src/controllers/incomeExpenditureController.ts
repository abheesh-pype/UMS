// @ts-nocheck
import { Response } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthRequest } from '../middleware/auth.js';

/**
 * Cash-basis Income & Expenditure statement.
 * Every source is counted once, on the date the money actually moved:
 *  Income      - invoice payments (student fees, university fee collections, centre onboarding fees),
 *                student fee receipts not linked to an invoice payment, approved wallet top-ups,
 *                commission received, and manual income entries.
 *  Expenditure - paid salaries, approved/reimbursed expense claims, university fee remittances,
 *                commission paid to study centres, and manual expense entries.
 */

const INCOME_LABELS: Record<string, string> = {
  student_fees: 'Student Fee Collections',
  centre_onboarding: 'Study Centre Onboarding Fees',
  wallet_topups: 'Study Centre Wallet Top-ups',
  commission_received: 'Commission Received',
};

const EXPENDITURE_LABELS: Record<string, string> = {
  salaries: 'Salaries (Payroll)',
  expense_claims: 'Expense Claims',
  university_fee_remittance: 'University Fee Remittance',
  commission_paid: 'Commission Paid to Centres',
};

const STUDY_CENTRE_ADMISSION_METHOD = 'Study Centre Admission Payment';
// University fee invoices are generated automatically when Finance pays the university
// (syncPaidUniversityFeeInvoices) and marked paid at once. They mirror that outgoing payment,
// which is already counted as a remittance, so they are not money received.
const UNIVERSITY_FEE_INVOICE_TYPE = 'university_fee';
const UNIVERSITY_FEE_PAYMENT_METHOD = 'University Fee Payment';

// When an admission was enrolled: enrolledAt, else the 'enrolled' status history entry, else the last update
const getEnrolledDate = (enrollment: any) => {
  if (enrollment.enrolledAt) return new Date(enrollment.enrolledAt);
  if (enrollment.status !== 'enrolled') return null;
  const history = Array.isArray(enrollment.statusHistory) ? enrollment.statusHistory : [];
  const entry = [...history].reverse().find((item: any) => item?.status === 'enrolled' && item?.timestamp);
  return new Date(entry?.timestamp || enrollment.updatedAt);
};
const TRANSACTION_TYPES = ['income', 'expense'];

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const manualCategoryKey = (type: string, category: string) =>
  `manual_${type}_${category.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

const parseRange = (query: any) => {
  const now = new Date();
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fromDate = query.from ? new Date(query.from) : new Date(fyStartYear, 3, 1);
  const toDate = query.to ? new Date(query.to) : now;
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(23, 59, 59, 999);
  return { fromDate, toDate };
};

export const getDetailedIncomeExpenditureReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.user.organizationId;
  const { fromDate, toDate } = parseRange(req.query);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
    res.status(400).json({ success: false, message: 'Invalid date range' });
    return;
  }
  const range = { gte: fromDate, lte: toDate };

  const months: string[] = [];
  const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  while (cursor <= toDate) {
    months.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const [
    paymentEntries,
    unlinkedReceipts,
    topUps,
    commissionsIn,
    payrolls,
    expenseClaims,
    universityFeePayments,
    commissionsOut,
    manualEntries,
    enrollments,
    outstandingInvoices,
    pendingPayrolls,
    pendingClaims,
    pendingTopUps,
    pendingCommissionIn,
    billedInvoices,
    invoicesPaidInRange,
    activeCentresWithProof,
    authFees,
    onboardingPayments,
  ] = await Promise.all([
    prisma.paymentEntry.findMany({
      where: { organizationId, receivedAt: range },
      include: {
        invoice: {
          select: {
            invoiceNo: true,
            invoiceType: true,
            centerId: true,
            studentDetails: true,
            center: { select: { name: true } },
          },
        },
      },
    }),
    prisma.studentFeeReceipt.findMany({
      where: { organizationId, receiptDate: range, invoicePayment: null },
      include: { enrollment: { select: { studentName: true, enrollmentNumber: true } } },
    }),
    prisma.walletTopUp.findMany({
      where: {
        organizationId,
        status: 'approved',
        OR: [{ verifiedAt: range }, { verifiedAt: null, createdAt: range }],
      },
      include: { studyCenter: { select: { name: true } } },
    }),
    prisma.commissionIn.findMany({
      where: { organizationId, receivedAmount: { gt: 0 }, OR: [{ receivedAt: range }, { receivedAt: null, updatedAt: range }] },
      include: { enrollment: { select: { studentName: true } } },
    }),
    prisma.payroll.findMany({
      where: {
        organizationId,
        status: 'paid',
        OR: [{ paymentDate: range }, { paymentDate: null, updatedAt: range }],
      },
      include: { user: { select: { name: true } } },
    }),
    prisma.expenseClaim.findMany({
      where: {
        organizationId,
        status: { in: ['approved', 'reimbursed'] },
        OR: [{ approvedAt: range }, { approvedAt: null, submittedAt: range }],
      },
      include: { user: { select: { name: true } } },
    }),
    prisma.universityFeePayment.findMany({
      where: { organizationId, status: 'paid', OR: [{ paidAt: range }, { paidAt: null, updatedAt: range }] },
      include: { student: { select: { name: true } } },
    }),
    prisma.commissionOut.findMany({
      where: { organizationId, status: 'paid', OR: [{ paidAt: range }, { paidAt: null, updatedAt: range }] },
      include: { studyCenter: { select: { name: true } } },
    }),
    prisma.financeTransaction.findMany({
      where: { organizationId, transactionDate: range },
      orderBy: { transactionDate: 'desc' },
    }).catch(error => {
      // P2021: table missing because the finance_transactions migration has not been applied yet
      if (error?.code === 'P2021') {
        console.warn('finance_transactions table is missing; run the create_finance_transactions migration');
        return [];
      }
      throw error;
    }),
    prisma.enrollment.findMany({
      where: { organizationId, OR: [{ createdAt: range }, { enrolledAt: range }, { status: 'enrolled', enrolledAt: null }] },
      select: { createdAt: true, enrolledAt: true, status: true, totalFee: true, statusHistory: true, updatedAt: true },
    }),
    prisma.invoice.aggregate({
      where: { organizationId, status: { in: ['unpaid', 'partially_paid', 'overdue'] }, invoiceType: { not: 'university_fee' } },
      _sum: { balanceAmount: true },
      _count: true,
    }),
    prisma.payroll.aggregate({
      where: { organizationId, status: { in: ['confirmed', 'transferred_to_finance'] } },
      _sum: { netSalary: true },
      _count: true,
    }),
    prisma.expenseClaim.aggregate({
      where: { organizationId, status: 'pending' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.walletTopUp.aggregate({
      where: { organizationId, status: 'pending' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.commissionIn.aggregate({
      where: { organizationId, status: 'pending' },
      _sum: { expectedAmount: true, receivedAmount: true },
      _count: true,
    }),
    // Fees raised on students/centres in the period (accrual view, shown next to cash collected)
    prisma.invoice.aggregate({
      where: { organizationId, issuedAt: range, invoiceType: { not: UNIVERSITY_FEE_INVOICE_TYPE }, status: { not: 'cancelled' } },
      _sum: { total: true },
      _count: true,
    }),
    // Invoices paid in the period, with all their payments, to spot receipts recorded twice
    prisma.invoice.findMany({
      where: {
        organizationId,
        invoiceType: { not: UNIVERSITY_FEE_INVOICE_TYPE },
        payments: { some: { receivedAt: range } },
      },
      select: {
        id: true,
        invoiceNo: true,
        total: true,
        studentDetails: true,
        payments: { select: { amount: true, createdAt: true } },
      },
    }),
    prisma.studyCenter.findMany({
      where: { organizationId, status: 'active', paymentProof: { not: null } },
      select: { id: true, name: true, universityIds: true, financeApprovedAt: true, updatedAt: true },
    }),
    prisma.universityAuthFee.findMany({
      where: { organizationId },
      select: { universityId: true, feeDetails: true },
    }),
    prisma.paymentEntry.findMany({
      where: { organizationId, method: STUDY_CENTRE_ADMISSION_METHOD },
      select: { invoice: { select: { centerId: true } } },
    }),
  ]);

  // Every money movement becomes one statement line
  const lines: any[] = [];
  const addLine = (line: any) => {
    const amount = Number(line.amount) || 0;
    if (amount <= 0 || !line.date || Number.isNaN(new Date(line.date).getTime())) return;
    lines.push({ ...line, amount, date: new Date(line.date).toISOString() });
  };

  for (const entry of paymentEntries) {
    const invoice = entry.invoice || {};
    if (invoice.invoiceType === UNIVERSITY_FEE_INVOICE_TYPE || entry.method === UNIVERSITY_FEE_PAYMENT_METHOD) continue;
    const isCentreOnboarding = entry.method === STUDY_CENTRE_ADMISSION_METHOD;
    const category = isCentreOnboarding ? 'centre_onboarding' : 'student_fees';
    const studentName = invoice.studentDetails?.fullName || invoice.studentDetails?.name || invoice.studentDetails?.studentName;
    addLine({
      id: `payment_${entry.id}`,
      type: 'income',
      category,
      date: entry.receivedAt,
      amount: entry.amount,
      description: isCentreOnboarding
        ? `Onboarding fee${invoice.center?.name ? ` - ${invoice.center.name}` : ''}`
        : `${(invoice.invoiceType || 'fee').replace(/_/g, ' ')} payment${invoice.invoiceNo ? ` (${invoice.invoiceNo})` : ''}`,
      party: isCentreOnboarding ? invoice.center?.name : studentName || invoice.center?.name || null,
      reference: entry.receiptNo || (entry.referenceNo && !String(entry.referenceNo).startsWith('data:') ? entry.referenceNo : null),
      paymentMode: entry.method,
      source: 'invoice_payment',
    });
  }

  for (const receipt of unlinkedReceipts) {
    addLine({
      id: `receipt_${receipt.id}`,
      type: 'income',
      category: 'student_fees',
      date: receipt.receiptDate,
      amount: receipt.amount,
      description: `Fee receipt${receipt.enrollment?.enrollmentNumber ? ` (${receipt.enrollment.enrollmentNumber})` : ''}`,
      party: receipt.enrollment?.studentName || null,
      reference: receipt.referenceNo,
      paymentMode: receipt.paymentMode,
      source: 'fee_receipt',
    });
  }

  for (const topUp of topUps) {
    addLine({
      id: `topup_${topUp.id}`,
      type: 'income',
      category: 'wallet_topups',
      date: topUp.verifiedAt || topUp.createdAt,
      amount: topUp.amount,
      description: 'Wallet top-up for student enrollments',
      party: topUp.studyCenter?.name || null,
      reference: topUp.referenceNumber,
      paymentMode: topUp.paymentMethod,
      source: 'wallet_topup',
    });
  }

  for (const commission of commissionsIn) {
    addLine({
      id: `commission_in_${commission.id}`,
      type: 'income',
      category: 'commission_received',
      date: commission.receivedAt || commission.updatedAt,
      amount: commission.receivedAmount,
      description: 'University commission received',
      party: commission.enrollment?.studentName || null,
      reference: commission.paymentDetails,
      source: 'commission_in',
    });
  }

  for (const payroll of payrolls) {
    addLine({
      id: `payroll_${payroll.id}`,
      type: 'expense',
      category: 'salaries',
      date: payroll.paymentDate || payroll.updatedAt,
      amount: payroll.netSalary,
      description: `Salary for ${payroll.month}`,
      party: payroll.user?.name || null,
      reference: payroll.paymentReference,
      paymentMode: payroll.paymentMethod,
      source: 'payroll',
    });
  }

  for (const claim of expenseClaims) {
    addLine({
      id: `claim_${claim.id}`,
      type: 'expense',
      category: 'expense_claims',
      subCategory: claim.category || 'other',
      date: claim.approvedAt || claim.submittedAt,
      amount: claim.amount,
      description: claim.description || `${claim.category} expense claim`,
      party: claim.user?.name || null,
      source: 'expense_claim',
    });
  }

  for (const feePayment of universityFeePayments) {
    addLine({
      id: `university_fee_${feePayment.id}`,
      type: 'expense',
      category: 'university_fee_remittance',
      date: feePayment.paidAt || feePayment.updatedAt,
      amount: feePayment.amount,
      description: `University fee - ${feePayment.semesterOrYear}`,
      party: feePayment.student?.name || null,
      reference: feePayment.referenceNo,
      source: 'university_fee_payment',
    });
  }

  for (const commission of commissionsOut) {
    addLine({
      id: `commission_out_${commission.id}`,
      type: 'expense',
      category: 'commission_paid',
      date: commission.paidAt || commission.updatedAt,
      amount: commission.amount,
      description: 'Commission paid to study centre',
      party: commission.studyCenter?.name || null,
      reference: commission.paymentDetails,
      source: 'commission_out',
    });
  }

  const manualLabels: Record<string, string> = {};
  for (const entry of manualEntries) {
    const category = manualCategoryKey(entry.type, entry.category);
    manualLabels[category] = entry.category.trim();
    addLine({
      id: `manual_${entry.id}`,
      manualId: entry.id,
      type: entry.type === 'income' ? 'income' : 'expense',
      category,
      date: entry.transactionDate,
      amount: entry.amount,
      description: entry.description || entry.category,
      party: entry.partyName,
      reference: entry.referenceNo,
      paymentMode: entry.paymentMode,
      source: 'manual',
      createdByName: entry.createdByName,
    });
  }

  // Monthly buckets
  const monthly = new Map(months.map(month => [month, {
    month,
    income: { total: 0, byCategory: {} as Record<string, number> },
    expenditure: { total: 0, byCategory: {} as Record<string, number> },
    net: 0,
    cumulativeNet: 0,
    transactionCount: 0,
    admissions: 0,
    enrolled: 0,
  }]));

  const categoryTotals = { income: new Map<string, { amount: number; count: number }>(), expense: new Map<string, { amount: number; count: number }>() };
  const claimCategories = new Map<string, { amount: number; count: number }>();

  for (const line of lines) {
    const bucket = monthly.get(monthKey(new Date(line.date)));
    if (!bucket) continue;
    const side = line.type === 'income' ? bucket.income : bucket.expenditure;
    side.total += line.amount;
    side.byCategory[line.category] = (side.byCategory[line.category] || 0) + line.amount;
    bucket.transactionCount += 1;

    const totals = categoryTotals[line.type];
    const current = totals.get(line.category) || { amount: 0, count: 0 };
    totals.set(line.category, { amount: current.amount + line.amount, count: current.count + 1 });

    if (line.category === 'expense_claims') {
      const claim = claimCategories.get(line.subCategory) || { amount: 0, count: 0 };
      claimCategories.set(line.subCategory, { amount: claim.amount + line.amount, count: claim.count + 1 });
    }
  }

  let admissionsInRange = 0;
  for (const enrollment of enrollments) {
    const createdAt = new Date(enrollment.createdAt);
    if (createdAt >= fromDate && createdAt <= toDate) {
      admissionsInRange += 1;
      const bucket = monthly.get(monthKey(createdAt));
      if (bucket) bucket.admissions += 1;
    }
    const enrolledDate = getEnrolledDate(enrollment);
    if (enrolledDate && enrolledDate >= fromDate && enrolledDate <= toDate) {
      const enrolledBucket = monthly.get(monthKey(enrolledDate));
      if (enrolledBucket) enrolledBucket.enrolled += 1;
    }
  }

  // Data checks: records that make the statement wrong until Finance corrects them
  const warnings: { type: string; title: string; detail: string; amount: number; items: string[] }[] = [];

  const overpaid = invoicesPaidInRange
    .map(invoice => {
      const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const name = invoice.studentDetails?.fullName || invoice.studentDetails?.name || invoice.studentDetails?.studentName;
      return { invoice, paid, excess: paid - invoice.total, name };
    })
    .filter(item => item.excess > 0.5);
  if (overpaid.length) {
    warnings.push({
      type: 'duplicate_receipts',
      title: 'Payments exceed the invoice amount',
      detail: 'These invoices have more payments recorded than they were raised for, usually a receipt entered twice. The extra amount is counted in income until the duplicate receipt is removed.',
      amount: overpaid.reduce((sum, item) => sum + item.excess, 0),
      items: overpaid.map(item => `${item.invoice.invoiceNo}${item.name ? ` (${item.name})` : ''}: invoice ₹${Math.round(item.invoice.total).toLocaleString('en-IN')}, payments ₹${Math.round(item.paid).toLocaleString('en-IN')}`),
    });
  }

  const feeByUniversity = new Map(authFees.map(fee => [fee.universityId, Number((fee.feeDetails as any)?.amount) || 0]));
  const defaultAuthFee = authFees.length === 1 ? Number((authFees[0].feeDetails as any)?.amount) || 0 : 0;
  const centresWithOnboardingPayment = new Set(onboardingPayments.map(payment => payment.invoice?.centerId).filter(Boolean));
  const unrecordedCentres = activeCentresWithProof
    .filter(centre => !centresWithOnboardingPayment.has(centre.id))
    .filter(centre => {
      const approvedAt = new Date(centre.financeApprovedAt || centre.updatedAt);
      return approvedAt >= fromDate && approvedAt <= toDate;
    })
    .map(centre => {
      const fee = (centre.universityIds || []).reduce((sum, universityId) => sum + (feeByUniversity.get(universityId) || 0), 0);
      return { centre, fee: fee || defaultAuthFee };
    });
  if (unrecordedCentres.length) {
    warnings.push({
      type: 'missing_onboarding_fees',
      title: 'Study centre onboarding fees not recorded',
      detail: 'These centres are active and uploaded a payment proof, but no onboarding fee payment was recorded when they were approved, so it is not counted in income. The amount shown is estimated from the configured authorization fee.',
      amount: unrecordedCentres.reduce((sum, item) => sum + item.fee, 0),
      items: unrecordedCentres.map(item => `${item.centre.name}${item.fee ? `: ₹${Math.round(item.fee).toLocaleString('en-IN')}` : ''}`),
    });
  }

  let runningNet = 0;
  const monthlyRows = Array.from(monthly.values()).map(bucket => {
    bucket.net = bucket.income.total - bucket.expenditure.total;
    runningNet += bucket.net;
    bucket.cumulativeNet = runningNet;
    return bucket;
  });

  const toCategoryList = (type: 'income' | 'expense', labels: Record<string, string>) => {
    const keys = new Set([...Object.keys(labels), ...categoryTotals[type].keys()]);
    return Array.from(keys)
      .filter(key => !key.startsWith('manual_') || categoryTotals[type].has(key))
      .map(key => ({
        key,
        label: labels[key] || manualLabels[key] || key,
        amount: categoryTotals[type].get(key)?.amount || 0,
        count: categoryTotals[type].get(key)?.count || 0,
        manual: key.startsWith('manual_'),
      }))
      .sort((a, b) => b.amount - a.amount);
  };

  const totalIncome = monthlyRows.reduce((sum, row) => sum + row.income.total, 0);
  const totalExpenditure = monthlyRows.reduce((sum, row) => sum + row.expenditure.total, 0);
  const netSurplus = totalIncome - totalExpenditure;
  const monthCount = Math.max(monthlyRows.length, 1);
  const activeMonths = monthlyRows.filter(row => row.transactionCount > 0);
  const bestMonth = activeMonths.reduce((best, row) => (!best || row.net > best.net ? row : best), null);
  const worstMonth = activeMonths.length > 1
    ? activeMonths.reduce((worst, row) => (!worst || row.net < worst.net ? row : worst), null)
    : null;

  res.json({
    success: true,
    data: {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      monthly: monthlyRows,
      totals: {
        income: totalIncome,
        expenditure: totalExpenditure,
        net: netSurplus,
        margin: totalIncome > 0 ? Math.round((netSurplus / totalIncome) * 1000) / 10 : 0,
        avgMonthlyIncome: totalIncome / monthCount,
        avgMonthlyExpenditure: totalExpenditure / monthCount,
        admissions: admissionsInRange,
        enrolled: monthlyRows.reduce((sum, row) => sum + row.enrolled, 0),
        feesBilled: billedInvoices._sum.total || 0,
        invoicesBilled: billedInvoices._count,
        transactionCount: lines.length,
        bestMonth: bestMonth ? { month: bestMonth.month, net: bestMonth.net } : null,
        worstMonth: worstMonth ? { month: worstMonth.month, net: worstMonth.net } : null,
      },
      incomeCategories: toCategoryList('income', INCOME_LABELS),
      expenditureCategories: toCategoryList('expense', EXPENDITURE_LABELS),
      expenseClaimCategories: Array.from(claimCategories.entries())
        .map(([category, value]) => ({ category, ...value }))
        .sort((a, b) => b.amount - a.amount),
      warnings,
      outstanding: {
        receivables: { amount: outstandingInvoices._sum.balanceAmount || 0, count: outstandingInvoices._count },
        salaryLiabilities: { amount: pendingPayrolls._sum.netSalary || 0, count: pendingPayrolls._count },
        pendingExpenseClaims: { amount: pendingClaims._sum.amount || 0, count: pendingClaims._count },
        pendingWalletTopUps: { amount: pendingTopUps._sum.amount || 0, count: pendingTopUps._count },
        pendingCommission: {
          amount: Math.max((pendingCommissionIn._sum.expectedAmount || 0) - (pendingCommissionIn._sum.receivedAmount || 0), 0),
          count: pendingCommissionIn._count,
        },
      },
      transactions: lines.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    },
  });
});

const parseTransactionBody = (body: any) => {
  const type = typeof body.type === 'string' ? body.type.trim().toLowerCase() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const amount = Number(body.amount);
  const transactionDate = body.transactionDate ? new Date(body.transactionDate) : null;
  const optional = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

  if (!TRANSACTION_TYPES.includes(type)) return { error: 'Type must be income or expense' };
  if (!category) return { error: 'Category is required' };
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Amount must be greater than zero' };
  if (!transactionDate || Number.isNaN(transactionDate.getTime())) return { error: 'A valid date is required' };

  return {
    data: {
      type,
      category,
      amount,
      transactionDate,
      description: optional(body.description),
      paymentMode: optional(body.paymentMode),
      referenceNo: optional(body.referenceNo),
      partyName: optional(body.partyName),
    },
  };
};

export const getFinanceTransactions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { fromDate, toDate } = parseRange(req.query);
  const where: any = { organizationId: req.user.organizationId, transactionDate: { gte: fromDate, lte: toDate } };
  if (TRANSACTION_TYPES.includes(req.query.type as string)) where.type = req.query.type;
  const transactions = await prisma.financeTransaction.findMany({ where, orderBy: { transactionDate: 'desc' } });
  res.json({ success: true, count: transactions.length, data: transactions });
});

export const createFinanceTransaction = asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = parseTransactionBody(req.body);
  if (parsed.error) {
    res.status(400).json({ success: false, message: parsed.error });
    return;
  }
  const transaction = await prisma.financeTransaction.create({
    data: {
      ...parsed.data,
      organizationId: req.user.organizationId,
      createdBy: req.user.id,
      createdByName: req.user.name || null,
    },
  });
  res.status(201).json({ success: true, data: transaction });
});

export const updateFinanceTransaction = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await prisma.financeTransaction.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
  });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Entry not found' });
    return;
  }
  const parsed = parseTransactionBody(req.body);
  if (parsed.error) {
    res.status(400).json({ success: false, message: parsed.error });
    return;
  }
  const transaction = await prisma.financeTransaction.update({ where: { id: existing.id }, data: parsed.data });
  res.json({ success: true, data: transaction });
});

export const deleteFinanceTransaction = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await prisma.financeTransaction.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
  });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Entry not found' });
    return;
  }
  await prisma.financeTransaction.delete({ where: { id: existing.id } });
  res.json({ success: true, message: 'Entry deleted' });
});
