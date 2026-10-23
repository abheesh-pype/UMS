// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendEmail } from '../utils/mailer.js';

export const getPayrolls = asyncHandler(async (req: AuthRequest, res: Response) => {
  const payrolls = await prisma.payroll.findMany({
    where: { organizationId: req.user.organizationId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.status(200).json({ success: true, count: payrolls.length, data: payrolls });
});

export const getPayroll = asyncHandler(async (req: AuthRequest, res: Response) => {
  const payroll = await prisma.payroll.findUnique({ where: { id: req.params.id }, include: { user: true } });
  if (!payroll) {
    res.status(404).json({ success: false, message: 'Payroll record not found' });
    return;
  }
  res.json({ success: true, data: payroll });
});

export const createPayroll = asyncHandler(async (req: AuthRequest, res: Response) => {
  const payroll = await prisma.payroll.create({ data: { ...req.body, organizationId: req.user.organizationId } });
  res.status(201).json({ success: true, data: payroll });
});

export const updatePayroll = asyncHandler(async (req: AuthRequest, res: Response) => {
  const payroll = await prisma.payroll.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: payroll });
});

export const deletePayroll = asyncHandler(async (req: AuthRequest, res: Response) => {
  const payroll = await prisma.payroll.findUnique({ where: { id: req.params.id } });
  if (!payroll) {
    res.status(404).json({ success: false, message: 'Payroll record not found' });
    return;
  }
  await prisma.payroll.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: {} });
});

export const processPayroll = asyncHandler(async (req: AuthRequest, res: Response) => {
  const payroll = await prisma.payroll.update({
    where: { id: req.params.id },
    data: { status: 'processed' as any, processedBy: req.user.id, processedAt: new Date() }
  });
  res.status(200).json({ success: true, data: payroll });
});

export const confirmPayroll = asyncHandler(async (req: AuthRequest, res: Response) => {
  const payroll = await prisma.payroll.update({
    where: { id: req.params.id },
    data: { status: 'confirmed' as any, financeApprovedAt: new Date() },
    include: { user: { select: { name: true, email: true } } }
  });

  if (payroll.user?.email) {
    const monthStr = payroll.month;
    const html = `
      <h3>Your Payslip for ${monthStr} is Ready</h3>
      <p>Dear ${payroll.user.name},</p>
      <p>Your payroll for <strong>${monthStr}</strong> has been confirmed by Finance.</p>
      <p>You can now log in to the Employee Portal to view and download your PDF Payslip.</p>
      <br/>
      <p>Regards,<br/>UMS HR Team</p>
    `;
    // non-blocking email send
    sendEmail(payroll.user.email, `Payslip Ready: ${monthStr}`, html).catch(console.error);
  }

  res.status(200).json({ success: true, data: payroll });
});

export const markPayrollPaid = asyncHandler(async (req: AuthRequest, res: Response) => {
  const payroll = await prisma.payroll.update({
    where: { id: req.params.id },
    data: { status: 'paid' as any, paymentDate: new Date() }
  });
  res.status(200).json({ success: true, data: payroll });
});

export const generateMonthlyPayroll = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { month } = req.body; // expected format 'YYYY-MM'
  
  if (!month) {
    res.status(400).json({ success: false, message: 'Month is required' });
    return;
  }

  // Get active employees with salary configs
  const users = await prisma.user.findMany({
    where: { 
      organizationId: req.user.organizationId, 
      status: 'active' as any,
      role: {
        notIn: ['ceo', 'org_admin', 'superadmin', 'center_admin', 'student']
      }
    },
    include: {
      salaryConfig: true,
      employeeProfile: true
    }
  });

  const generated = [];
  const errors = [];

  for (const user of users) {
    if (!user.salaryConfig) {
      errors.push(`User ${user.name} missing salary config`);
      continue;
    }

    const { basicSalary, allowances, deductions } = user.salaryConfig;
    
    // Parse json
    const parsedAllowances = typeof allowances === 'string' ? JSON.parse(allowances) : (allowances || {});
    const parsedDeductions = typeof deductions === 'string' ? JSON.parse(deductions) : (deductions || {});
    
    let allowancesTotal = 0;
    if (Array.isArray(parsedAllowances)) {
       parsedAllowances.forEach((a: any) => allowancesTotal += Number(a.amount || 0));
    } else {
       Object.values(parsedAllowances).forEach((v: any) => allowancesTotal += Number(v || 0));
    }

    let deductionsTotal = 0;
    if (Array.isArray(parsedDeductions)) {
       parsedDeductions.forEach((d: any) => deductionsTotal += Number(d.amount || 0));
    } else {
       Object.values(parsedDeductions).forEach((v: any) => deductionsTotal += Number(v || 0));
    }

    const grossSalary = basicSalary + allowancesTotal;
    const netSalary = grossSalary - deductionsTotal;

    try {
      const payroll = await prisma.payroll.upsert({
        where: {
          userId_month: {
            userId: user.id,
            month: month
          }
        },
        update: {
          basicSalary,
          allowances: parsedAllowances,
          deductions: parsedDeductions,
          grossSalary,
          netSalary
        },
        create: {
          organizationId: req.user.organizationId,
          userId: user.id,
          month: month,
          basicSalary,
          allowances: parsedAllowances,
          deductions: parsedDeductions,
          grossSalary,
          netSalary,
          status: 'draft',
          generatedBy: req.user.id
        }
      });
      generated.push(payroll);
    } catch (err: any) {
      errors.push(`Failed to generate for ${user.name}: ${err.message}`);
    }
  }

  res.status(201).json({ success: true, data: generated, errors });
});

export const transferToFinance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { payrollIds, remarks } = req.body;
  if (!Array.isArray(payrollIds) || payrollIds.length === 0 ||
      payrollIds.some(id => typeof id !== 'string')) {
    res.status(400).json({ success: false, message: 'Select at least one payroll record to submit' });
    return;
  }

  const uniquePayrollIds = [...new Set(payrollIds)];
  const payrolls = await prisma.payroll.findMany({
    where: {
      id: { in: uniquePayrollIds },
      organizationId: req.user.organizationId,
      status: 'confirmed'
    }
  });
  if (payrolls.length !== uniquePayrollIds.length) {
    res.status(400).json({ success: false, message: 'One or more selected payroll records are unavailable or not confirmed' });
    return;
  }

  const payrollsByMonth = new Map<string, typeof payrolls>();
  for (const payroll of payrolls) {
    payrollsByMonth.set(payroll.month, [...(payrollsByMonth.get(payroll.month) || []), payroll]);
  }

  const batches = await prisma.$transaction(async transaction => {
    const createdBatches = [];
    for (const [month, monthPayrolls] of payrollsByMonth) {
      const batch = await transaction.payrollBatch.create({
        data: {
          organizationId: req.user.organizationId,
          month,
          payrollIds: monthPayrolls.map(payroll => payroll.id),
          totalAmount: monthPayrolls.reduce((sum, payroll) => sum + payroll.netSalary, 0),
          employeeCount: monthPayrolls.length,
          transferredBy: req.user.id,
          remarks,
          status: 'pending_finance_approval'
        }
      });
      createdBatches.push(batch);
    }
    await transaction.payroll.updateMany({
      where: { id: { in: uniquePayrollIds }, organizationId: req.user.organizationId },
      data: { status: 'transferred_to_finance', transferredToFinanceBy: req.user.id, transferredToFinanceAt: new Date() }
    });
    return createdBatches;
  });

  res.status(201).json({ success: true, count: batches.length, data: batches });
});

export const getPayrollBatches = asyncHandler(async (req: AuthRequest, res: Response) => {
  const batches = await prisma.payrollBatch.findMany({
    where: { organizationId: req.user.organizationId },
    orderBy: { createdAt: 'desc' }
  });
  res.status(200).json({ success: true, count: batches.length, data: batches });
});

export const getPayrollBatch = asyncHandler(async (req: AuthRequest, res: Response) => {
  const batch = await prisma.payrollBatch.findUnique({ where: { id: req.params.id } });
  res.json({ success: true, data: batch });
});

export const financeApprovePayrollBatch = asyncHandler(async (req: AuthRequest, res: Response) => {
  const batch = await prisma.payrollBatch.update({
    where: { id: req.params.id },
    data: { status: 'approved_by_finance' as any, approvedBy: req.user.id, approvedAt: new Date() }
  });
  res.status(200).json({ success: true, data: batch });
});

export const financeRejectPayrollBatch = asyncHandler(async (req: AuthRequest, res: Response) => {
  const batch = await prisma.$transaction(async transaction => {
    const currentBatch = await transaction.payrollBatch.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId }
    });
    if (!currentBatch) return null;

    const rejectedBatch = await transaction.payrollBatch.update({
      where: { id: currentBatch.id },
      data: {
        status: 'rejected',
        rejectionReason: req.body.rejectionReason || req.body.remarks || null
      }
    });
    await transaction.payroll.updateMany({
      where: {
        id: { in: currentBatch.payrollIds },
        organizationId: req.user.organizationId,
        status: 'transferred_to_finance'
      },
      data: { status: 'confirmed' }
    });
    return rejectedBatch;
  });

  if (!batch) {
    res.status(404).json({ success: false, message: 'Payroll batch not found' });
    return;
  }
  res.status(200).json({ success: true, data: batch });
});

export const markBatchPaymentInProgress = asyncHandler(async (req: AuthRequest, res: Response) => {
  const batch = await prisma.payrollBatch.update({
    where: { id: req.params.id },
    data: { status: 'payment_in_progress' as any }
  });
  res.status(200).json({ success: true, data: batch });
});

export const completeBatchPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { paymentDate, paymentMethod, paymentReference } = req.body;
  if (!['bank_transfer', 'cash', 'cheque'].includes(paymentMethod)) {
    res.status(400).json({ success: false, message: 'A valid payment method is required' });
    return;
  }

  const batch = await prisma.$transaction(async transaction => {
    const currentBatch = await transaction.payrollBatch.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
        status: 'payment_in_progress'
      }
    });
    if (!currentBatch) return null;

    const updatedPayrolls = await transaction.payroll.updateMany({
      where: {
        id: { in: currentBatch.payrollIds },
        organizationId: req.user.organizationId,
        status: 'transferred_to_finance'
      },
      data: {
        status: 'paid',
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentMethod,
        paymentReference: typeof paymentReference === 'string' ? paymentReference : null
      }
    });
    if (updatedPayrolls.count !== currentBatch.payrollIds.length) {
      throw new Error('Some payroll records in this batch are no longer available for payment');
    }
    return transaction.payrollBatch.update({
      where: { id: currentBatch.id },
      data: { status: 'completed', completedAt: new Date() }
    });
  });

  if (!batch) {
    res.status(404).json({ success: false, message: 'Payroll batch not found or not in payment progress' });
    return;
  }
  res.status(200).json({ success: true, data: batch });
});
