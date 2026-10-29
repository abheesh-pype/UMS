// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { hashPassword, generateStudyCenterUserId } from '../utils/authUtils.js';
import { getOnboardingStatusByCode } from '../services/onboardingStatusService.js';
import { getPaymentProofDataUrl } from '../utils/paymentProof.js';
import {
  calculateFinancialYear,
  generateNextInvoiceNumber,
  generateNextReceiptNumber,
  recordPaymentForInvoice,
  recalculateInvoiceBalance,
  syncPaidUniversityFeeInvoices
} from '../services/invoiceService.js';

// Invoices
export const getInvoices = asyncHandler(async (req: AuthRequest, res: Response) => {
  const invoices = await prisma.invoice.findMany({
    where: { organizationId: req.user.organizationId },
    include: { center: { select: { name: true } }, student: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, count: invoices.length, data: invoices });
});
export const getInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) {
    res.status(404).json({ success: false, message: 'Invoice not found' });
    return;
  }
  res.json({ success: true, data: invoice });
});
export const createInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { centerId, studentId, invoiceNo, amount, tax, total, status, items, dueDate } = req.body;
  
  let finalCenterId = (centerId && centerId !== 'null' && centerId !== 'none') ? centerId : null;
  if (!finalCenterId && studentId) {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (student && student.centerId) {
      finalCenterId = student.centerId;
    }
  }

  const data: any = {
    centerId: finalCenterId,
    studentId,
    invoiceNo,
    amount: amount !== undefined ? parseFloat(amount) : 0,
    tax: tax !== undefined ? parseFloat(tax) : 0,
    total: total !== undefined ? parseFloat(total) : 0,
    status: status || 'draft',
    items: items || [],
    organizationId: req.user.organizationId
  };
  if (dueDate) data.dueDate = new Date(dueDate);

  const invoice = await prisma.invoice.create({ data });
  res.status(201).json({ success: true, data: { ...invoice, _id: invoice.id } });
});
export const updateInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const exists = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!exists) {
    res.status(404).json({ success: false, message: 'Invoice not found' });
    return;
  }
  const { centerId, studentId, invoiceNo, amount, tax, total, status, items, dueDate, paidAt } = req.body;
  const data: any = {};
  if (centerId !== undefined) data.centerId = centerId;
  if (studentId !== undefined) data.studentId = studentId;
  if (invoiceNo !== undefined) data.invoiceNo = invoiceNo;
  if (amount !== undefined) data.amount = parseFloat(amount);
  if (tax !== undefined) data.tax = parseFloat(tax);
  if (total !== undefined) data.total = parseFloat(total);
  if (status !== undefined) data.status = status;
  if (items !== undefined) data.items = items;
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
  if (paidAt !== undefined) data.paidAt = paidAt ? new Date(paidAt) : null;

  const invoice = await prisma.invoice.update({ 
    where: { id: req.params.id }, 
    data,
    include: { student: true }
  });

  // University fee payments are now generated at enrollment time for all cycles.

  res.json({ success: true, data: { ...invoice, _id: invoice.id } });
});
export const deleteInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const exists = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!exists) {
    res.status(404).json({ success: false, message: 'Invoice not found' });
    return;
  }
  await prisma.invoice.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: {} });
});
export const approveInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const invoice = await prisma.invoice.update({ where: { id: req.params.id }, data: { status: 'approved' as any } });
  res.json({ success: true, data: invoice });
});

// Payments
export const getPayments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const payments = await prisma.paymentEntry.findMany({
    where: { organizationId: req.user.organizationId },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNo: true,
          invoiceType: true,
          period: true,
          studentDetails: true,
          student: { select: { name: true, enrollmentNo: true } },
          center: { select: { name: true, code: true } },
          enrollment: {
            select: {
              studentName: true,
              enrollmentNumber: true,
              program: { select: { name: true } },
              studyCenter: { select: { name: true, code: true } }
            }
          }
        }
      },
      receiver: { select: { name: true, email: true } }
    },
    orderBy: { receivedAt: 'desc' }
  });
  res.json({ success: true, count: payments.length, data: payments });
});
export const getPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const payment = await prisma.paymentEntry.findUnique({ where: { id: req.params.id } });
  if (!payment) {
    res.status(404).json({ success: false, message: 'Payment not found' });
    return;
  }
  res.json({ success: true, data: payment });
});
export const createPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { invoiceId, amount, notes } = req.body;
  const method = req.body.method || req.body.paymentMethod;
  const referenceNo = req.body.referenceNo || req.body.transactionId;
  const rawReceivedAt = req.body.receivedAt || req.body.paymentDate;

  if (!method) {
    res.status(400).json({ success: false, message: 'Payment method is required' });
    return;
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: req.user.organizationId }
  });
  if (!invoice) {
    res.status(404).json({ success: false, message: 'Invoice not found' });
    return;
  }

  const result = await recordPaymentForInvoice(invoice.id, {
    amount: Number(amount),
    method,
    referenceNo,
    receivedAt: rawReceivedAt ? new Date(rawReceivedAt) : undefined,
    notes,
    receivedBy: req.user.id
  });
  res.status(201).json({ success: true, data: result.payment, receiptNo: result.receiptNo });
});
export const updatePayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const exists = await prisma.paymentEntry.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId }
  });
  if (!exists) {
    res.status(404).json({ success: false, message: 'Payment not found' });
    return;
  }
  const { invoiceId, amount, method, referenceNo, receivedAt, notes } = req.body;
  if (amount !== undefined && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) {
    res.status(400).json({ success: false, message: 'Valid payment amount is required' });
    return;
  }
  const nextInvoiceId = invoiceId ?? exists.invoiceId;
  const nextInvoice = await prisma.invoice.findFirst({
    where: { id: nextInvoiceId, organizationId: req.user.organizationId },
    select: { id: true, enrollmentId: true }
  });
  if (!nextInvoice) {
    res.status(404).json({ success: false, message: 'Invoice not found' });
    return;
  }
  if (exists.studentFeeReceiptId) {
    const receipt = await prisma.studentFeeReceipt.findUnique({
      where: { id: exists.studentFeeReceiptId },
      select: { enrollmentId: true }
    });
    if (receipt && nextInvoice.enrollmentId !== receipt.enrollmentId) {
      res.status(400).json({ success: false, message: 'Student payment must stay linked to an invoice for the same enrollment' });
      return;
    }
  }

  const data: any = {};
  const receiptData: any = {};
  if (invoiceId !== undefined) data.invoiceId = nextInvoiceId;
  if (amount !== undefined) {
    data.amount = parseFloat(amount);
    receiptData.amount = parseFloat(amount);
  }
  if (method !== undefined) {
    data.method = method;
    receiptData.paymentMode = method;
  }
  if (referenceNo !== undefined) {
    data.referenceNo = referenceNo;
    receiptData.referenceNo = referenceNo;
  }
  if (receivedAt !== undefined) {
    data.receivedAt = new Date(receivedAt);
    receiptData.receiptDate = new Date(receivedAt);
  }
  if (notes !== undefined) {
    data.notes = notes;
    receiptData.remarks = notes;
  }

  const payment = await prisma.paymentEntry.update({
    where: { id: req.params.id },
    data,
    include: { studentFeeReceipt: true }
  });
  if (payment.studentFeeReceipt && Object.keys(receiptData).length > 0) {
    await prisma.studentFeeReceipt.update({
      where: { id: payment.studentFeeReceipt.id },
      data: receiptData
    });
  }
  await recalculateInvoiceBalance(exists.invoiceId);
  if (nextInvoiceId !== exists.invoiceId) await recalculateInvoiceBalance(nextInvoiceId);
  res.json({ success: true, data: payment });
});
export const deletePayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const exists = await prisma.paymentEntry.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId }
  });
  if (!exists) {
    res.status(404).json({ success: false, message: 'Payment not found' });
    return;
  }
  await prisma.paymentEntry.delete({ where: { id: req.params.id } });
  await recalculateInvoiceBalance(exists.invoiceId);
  res.json({ success: true, data: {} });
});

// Expenses
export const getExpenses = asyncHandler(async (req: AuthRequest, res: Response) => {
  const expenses = await prisma.expenseClaim.findMany({
    where: { organizationId: req.user.organizationId },
    include: {
      user: { select: { id: true, name: true, email: true } }
    }
  });
  const mapped = expenses.map(exp => ({
    ...exp,
    employeeId: exp.user || exp.employeeId
  }));
  res.json({ success: true, count: mapped.length, data: mapped });
});
export const getExpense = asyncHandler(async (req: AuthRequest, res: Response) => {
  const expense = await prisma.expenseClaim.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, name: true, email: true } }
    }
  });
  if (!expense) {
    res.status(404).json({ success: false, message: 'Expense not found' });
    return;
  }
  const mapped = {
    ...expense,
    employeeId: expense.user || expense.employeeId
  };
  res.json({ success: true, data: mapped });
});
export const createExpense = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { amount, category, description, receipts, status } = req.body;
  const expense = await prisma.expenseClaim.create({
    data: {
      amount: amount !== undefined ? parseFloat(amount) : 0,
      category,
      description,
      receipts: receipts || [],
      status: status || 'pending',
      organizationId: req.user.organizationId,
      employeeId: req.user.id
    }
  });
  res.status(201).json({ success: true, data: expense });
});
export const updateExpense = asyncHandler(async (req: AuthRequest, res: Response) => {
  const exists = await prisma.expenseClaim.findUnique({ where: { id: req.params.id } });
  if (!exists) {
    res.status(404).json({ success: false, message: 'Expense not found' });
    return;
  }
  const { amount, category, description, receipts, status, approvedBy, remarks } = req.body;
  const data: any = {};
  if (amount !== undefined) data.amount = parseFloat(amount);
  if (category !== undefined) data.category = category;
  if (description !== undefined) data.description = description;
  if (receipts !== undefined) data.receipts = receipts;
  if (status !== undefined) data.status = status;
  if (approvedBy !== undefined) data.approvedBy = approvedBy;
  if (remarks !== undefined) data.remarks = remarks;

  const expense = await prisma.expenseClaim.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: expense });
});
export const deleteExpense = asyncHandler(async (req: AuthRequest, res: Response) => {
  const exists = await prisma.expenseClaim.findUnique({ where: { id: req.params.id } });
  if (!exists) {
    res.status(404).json({ success: false, message: 'Expense not found' });
    return;
  }
  await prisma.expenseClaim.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: {} });
});
export const approveExpense = asyncHandler(async (req: AuthRequest, res: Response) => {
  const expense = await prisma.expenseClaim.update({ where: { id: req.params.id }, data: { status: 'approved' as any, approvedBy: req.user.id, approvedAt: new Date() } });
  res.json({ success: true, data: expense });
});

// Targets
export const getTargets = asyncHandler(async (req: AuthRequest, res: Response) => {
  const canViewAll = ['ceo', 'org_admin', 'superadmin', 'university_admin'].includes(req.user.role);
  const isFinanceAdmin = req.user.role === 'finance_admin';
  let departmentId = req.user.departmentId || req.user.department?.id;
  if (!canViewAll && !departmentId && req.user.role === 'finance_admin') {
    const financeDepartment = await prisma.department.findFirst({
      where: {
        organizationId: req.user.organizationId,
        OR: [
          { type: { equals: 'finance', mode: 'insensitive' } },
          { name: { contains: 'finance', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    departmentId = financeDepartment?.id;
  }
  const targets = await prisma.target.findMany({
    where: {
      organizationId: req.user.organizationId,
      ...(!canViewAll && isFinanceAdmin ? {
        OR: [
          { employeeId: req.user.id },
          ...(departmentId ? [{ departmentId }] : []),
        ],
      } : {}),
      ...(!canViewAll && !isFinanceAdmin ? { employeeId: req.user.id } : {}),
    },
    include: {
      department: { select: { id: true, name: true, type: true } },
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    }
  });
  const mapped = targets.map(t => ({
    ...t,
    employeeId: t.employee || t.employeeId
  }));
  res.json({ success: true, count: mapped.length, data: mapped });
});
export const getTarget = asyncHandler(async (req: AuthRequest, res: Response) => {
  const canViewAll = ['ceo', 'org_admin', 'superadmin', 'university_admin'].includes(req.user.role);
  const isFinanceAdmin = req.user.role === 'finance_admin';
  const target = await prisma.target.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user.organizationId,
      ...(!canViewAll && !isFinanceAdmin ? { employeeId: req.user.id } : {}),
    },
    include: {
      department: { select: { id: true, name: true, type: true } },
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    }
  });
  if (!target) {
    res.status(404).json({ success: false, message: 'Target not found' });
    return;
  }
  const mapped = {
    ...target,
    employeeId: target.employee || target.employeeId
  };
  res.json({ success: true, data: mapped });
});
export const createTarget = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { employeeId, type, period, target, achieved, incentive, deadline } = req.body;
  let departmentId = req.body.departmentId || null;
  let assignedDepartmentId = req.user.departmentId || req.user.department?.id;
  if (!assignedDepartmentId) {
    const financeDepartment = await prisma.department.findFirst({
      where: {
        organizationId: req.user.organizationId,
        OR: [
          { type: { equals: 'finance', mode: 'insensitive' } },
          { name: { contains: 'finance', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    assignedDepartmentId = financeDepartment?.id;
  }
  if (departmentId && assignedDepartmentId && departmentId !== assignedDepartmentId) {
    res.status(403).json({ success: false, message: 'Targets can only be assigned to your department' });
    return;
  }
  departmentId = assignedDepartmentId || null;
  let employee = null;
  if (employeeId) {
    employee = await prisma.user.findFirst({
      where: { id: employeeId, organizationId: req.user.organizationId },
      select: { id: true, departmentId: true, subDepartment: { select: { parentDeptId: true } } },
    });
    if (!employee) {
      res.status(400).json({ success: false, message: 'Selected employee was not found in your organization' });
      return;
    }
    if (departmentId && employee.departmentId !== departmentId && employee.subDepartment?.parentDeptId !== departmentId) {
      res.status(400).json({ success: false, message: 'Selected employee does not belong to the selected department' });
      return;
    }
  }
  if (departmentId) {
    const department = await prisma.department.findFirst({
      where: { id: departmentId, organizationId: req.user.organizationId },
      select: { id: true },
    });
    if (!department) {
      res.status(400).json({ success: false, message: 'Selected department was not found in your organization' });
      return;
    }
  }
  const recipientIds = employeeId
    ? [employeeId]
    : departmentId
      ? (await prisma.user.findMany({
          where: {
            organizationId: req.user.organizationId,
            id: { not: req.user.id },
            OR: [
              { departmentId },
              { subDepartment: { parentDeptId: departmentId } },
            ],
          },
          select: { id: true },
        })).map((recipient) => recipient.id)
      : [];
  const newTarget = await prisma.$transaction(async (tx) => {
    const createdTarget = await tx.target.create({
      data: {
        organizationId: req.user.organizationId,
        employeeId: employeeId || null,
        departmentId,
        type,
        period,
        target: parseFloat(target),
        achieved: achieved !== undefined ? parseFloat(achieved) : 0,
        incentive: incentive !== undefined && incentive !== '' ? parseFloat(incentive) : null,
        deadline: deadline ? new Date(deadline) : null
      },
      include: {
        department: { select: { id: true, name: true, type: true } },
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });
    if (recipientIds.length) {
      await tx.notification.createMany({
        data: recipientIds.map((userId) => ({
          organizationId: req.user.organizationId,
          userId,
          title: 'New target assigned',
          message: `A ${period} ${type} target has been assigned to you.`,
          type: 'general',
          priority: 'medium',
          link: '/dashboard?tab=targets',
        })),
      });
    }
    return createdTarget;
  });
  const mapped = {
    ...newTarget,
    employeeId: newTarget.employee || newTarget.employeeId
  };
  res.status(201).json({ success: true, data: mapped });
});
export const updateTarget = asyncHandler(async (req: AuthRequest, res: Response) => {
  const exists = await prisma.target.findUnique({ where: { id: req.params.id } });
  if (!exists) {
    res.status(404).json({ success: false, message: 'Target not found' });
    return;
  }
  const { employeeId, type, period, target, achieved, incentive, deadline, status } = req.body;
  const data: any = {};
  if (employeeId !== undefined) data.employeeId = employeeId;
  if (type !== undefined) data.type = type;
  if (period !== undefined) data.period = period;
  if (target !== undefined) data.target = parseFloat(target);
  if (achieved !== undefined) data.achieved = parseFloat(achieved);
  if (incentive !== undefined) data.incentive = incentive !== '' && incentive !== null ? parseFloat(incentive) : null;
  if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null;
  if (status !== undefined) data.status = status;

  const updated = await prisma.target.update({
    where: { id: req.params.id },
    data,
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    }
  });
  const mapped = {
    ...updated,
    employeeId: updated.employee || updated.employeeId
  };
  res.json({ success: true, data: mapped });
});
export const deleteTarget = asyncHandler(async (req: AuthRequest, res: Response) => {
  const exists = await prisma.target.findUnique({ where: { id: req.params.id } });
  if (!exists) {
    res.status(404).json({ success: false, message: 'Target not found' });
    return;
  }
  await prisma.target.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: {} });
});

// Fee Structures
export const getFeeStructures = asyncHandler(async (req: AuthRequest, res: Response) => {
  const fees = await prisma.feeStructure.findMany({
    where: { organizationId: req.user.organizationId },
    include: { program: true }
  });
  const mapped = fees.map(f => ({
    ...f,
    programId: f.program || f.programId
  }));
  res.json({ success: true, count: mapped.length, data: mapped });
});
export const getFeeStructure = asyncHandler(async (req: AuthRequest, res: Response) => {
  const fee = await prisma.feeStructure.findUnique({
    where: { id: req.params.id },
    include: { program: true }
  });
  if (!fee) {
    res.status(404).json({ success: false, message: 'Fee structure not found' });
    return;
  }
  const mapped = {
    ...fee,
    programId: fee.program || fee.programId
  };
  res.json({ success: true, data: mapped });
});
export const createFeeStructure = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { programId, registrationFee, tuitionFee, examFee, otherCharges, gstPercentage } = req.body;
  
  const existing = await prisma.feeStructure.findUnique({ where: { programId } });
  if (existing) {
    res.status(400).json({ success: false, message: 'Fee structure already exists for this program. Please edit the existing one.' });
    return;
  }

  const fee = await prisma.feeStructure.create({
    data: {
      programId,
      registrationFee: registrationFee !== undefined ? parseFloat(registrationFee) : 0,
      tuitionFee: tuitionFee !== undefined ? parseFloat(tuitionFee) : 0,
      examFee: examFee !== undefined ? parseFloat(examFee) : 0,
      otherCharges: otherCharges || {},
      gstPercentage: gstPercentage !== undefined ? parseFloat(gstPercentage) : 18,
      organizationId: req.user.organizationId
    }
  });
  res.status(201).json({ success: true, data: fee });
});
export const updateFeeStructure = asyncHandler(async (req: AuthRequest, res: Response) => {
  const exists = await prisma.feeStructure.findUnique({ where: { id: req.params.id } });
  if (!exists) {
    res.status(404).json({ success: false, message: 'Fee structure not found' });
    return;
  }
  const { registrationFee, tuitionFee, examFee, otherCharges, gstPercentage } = req.body;
  const data: any = {};
  if (registrationFee !== undefined) data.registrationFee = parseFloat(registrationFee);
  if (tuitionFee !== undefined) data.tuitionFee = parseFloat(tuitionFee);
  if (examFee !== undefined) data.examFee = parseFloat(examFee);
  if (otherCharges !== undefined) data.otherCharges = otherCharges;
  if (gstPercentage !== undefined) data.gstPercentage = parseFloat(gstPercentage);

  const fee = await prisma.feeStructure.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: fee });
});
export const deleteFeeStructure = asyncHandler(async (req: AuthRequest, res: Response) => {
  const exists = await prisma.feeStructure.findUnique({ where: { id: req.params.id } });
  if (!exists) {
    res.status(404).json({ success: false, message: 'Fee structure not found' });
    return;
  }
  await prisma.feeStructure.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: {} });
});

// Auth Fees
export const getAuthFees = asyncHandler(async (req: AuthRequest, res: Response) => {
  const authFees = await prisma.universityAuthFee.findMany({
    where: { organizationId: req.user.organizationId },
    include: { university: true }
  });
  const formattedFees = authFees.map(fee => {
    const details = (fee.feeDetails as any) || {};
    return {
      id: fee.id,
      universityId: fee.university,
      amount: details.amount || 0,
      currency: details.currency || 'INR',
      updatedAt: fee.updatedAt
    };
  });
  res.json({ success: true, data: formattedFees });
});
export const createAuthFee = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { universityId, amount, currency } = req.body;
  if (!universityId) {
    res.status(400).json({ success: false, message: 'University ID is required' });
    return;
  }
  const existing = await prisma.universityAuthFee.findUnique({
    where: {
      organizationId_universityId: {
        organizationId: req.user.organizationId,
        universityId
      }
    }
  });
  if (existing) {
    res.status(400).json({ success: false, message: 'Auth fee already configured for this university' });
    return;
  }
  const authFee = await prisma.universityAuthFee.create({
    data: {
      organizationId: req.user.organizationId,
      universityId,
      feeDetails: { amount: parseFloat(amount), currency: currency || 'INR' },
      configuredBy: req.user.id
    },
    include: { university: true }
  });
  const details = authFee.feeDetails as any;
  res.status(201).json({
    success: true,
    data: {
      id: authFee.id,
      universityId: authFee.university,
      amount: details.amount || 0,
      currency: details.currency || 'INR',
      updatedAt: authFee.updatedAt
    }
  });
});
export const updateAuthFee = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { amount, currency } = req.body;
  const exists = await prisma.universityAuthFee.findUnique({ where: { id: req.params.id } });
  if (!exists) {
    res.status(404).json({ success: false, message: 'Auth fee configuration not found' });
    return;
  }
  const authFee = await prisma.universityAuthFee.update({
    where: { id: req.params.id },
    data: {
      feeDetails: { amount: parseFloat(amount), currency: currency || 'INR' }
    },
    include: { university: true }
  });
  const details = authFee.feeDetails as any;
  res.json({
    success: true,
    data: {
      id: authFee.id,
      universityId: authFee.university,
      amount: details.amount || 0,
      currency: details.currency || 'INR',
      updatedAt: authFee.updatedAt
    }
  });
});

// Centers
export const getPendingPaymentCenters = asyncHandler(async (req: AuthRequest, res: Response) => {
  const departmentType = req.user.department?.type || req.user.subDepartment?.parentDept?.type;
  const isFinanceAssignee = req.user.role === 'finance_sub_admin'
    || (req.user.role === 'employee' && departmentType === 'finance');
  const centers = await prisma.studyCenter.findMany({
    where: {
      organizationId: req.user.organizationId,
      OR: [
        { onboardingStatus: { stage: 'finance', state: { in: ['pending', 'resubmitted'] } } },
        { status: { in: ['pending_payment', 'finance_resubmitted'] } },
      ],
      ...(isFinanceAssignee ? { assignedFinanceUserId: req.user.id } : {}),
    },
    include: {
      onboardingStatus: true,
      verifier: { select: { id: true, name: true, email: true } },
      assignedFinanceUser: { select: { id: true, name: true, role: true } },
    },
    orderBy: { updatedAt: 'asc' }
  });
  const result = await Promise.all(centers.map(async center => {
    const universities = await prisma.university.findMany({
      where: { id: { in: center.universityIds || [] }, organizationId: req.user.organizationId, singletonKey: 'primary' },
      select: { id: true, name: true, code: true }
    });
    const authFees = await prisma.universityAuthFee.findMany({
      where: { organizationId: req.user.organizationId, universityId: { in: center.universityIds || [] } },
      select: { universityId: true, feeDetails: true }
    });
    const feeByUniversity = new Map(authFees.map(fee => {
      const details = (fee.feeDetails as any) || {};
      return [fee.universityId, Number(details.amount) || 0];
    }));
    return {
      ...center,
      status: center.onboardingStatus?.code || center.status,
      verifiedBy: center.verifier,
      authFees: universities.map(university => ({
        universityId: university.id,
        universityName: `${university.name} (${university.code})`,
        amount: feeByUniversity.has(university.id) ? feeByUniversity.get(university.id) : null
      }))
    };
  }));
  res.json({ success: true, data: result });
});

export const assignFinanceCenter = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { assignedFinanceUserId } = req.body;
  const center = await prisma.studyCenter.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user.organizationId,
      OR: [
        { onboardingStatus: { stage: 'finance' } },
        { status: { in: ['pending_payment', 'finance_resubmitted', 'finance_rejected', 'rejected_from_finance'] } },
      ],
    },
    select: { id: true },
  });
  if (!center) {
    res.status(404).json({ success: false, message: 'Pending payment center not found' });
    return;
  }

  if (assignedFinanceUserId) {
    const assignedUser = await prisma.user.findFirst({
      where: {
        id: assignedFinanceUserId,
        organizationId: req.user.organizationId,
        role: { in: ['finance_sub_admin', 'employee'] },
      },
      include: {
        department: { select: { type: true } },
        subDepartment: { include: { parentDept: { select: { type: true } } } },
        designationRef: { include: { department: { select: { type: true } }, subDepartment: { include: { parentDept: { select: { type: true } } } } } },
      },
    });
    const isFinanceDepartment = assignedUser?.department?.type === 'finance'
      || assignedUser?.subDepartment?.parentDept?.type === 'finance'
      || assignedUser?.designationRef?.department?.type === 'finance'
      || assignedUser?.designationRef?.subDepartment?.parentDept?.type === 'finance';
    if (!assignedUser || !isFinanceDepartment) {
      res.status(400).json({ success: false, message: 'Assignee must be a Finance sub-admin or employee in this organization' });
      return;
    }
  }

  const updatedCenter = await prisma.studyCenter.update({
    where: { id: center.id },
    data: { assignedFinanceUserId: assignedFinanceUserId || null },
    include: { assignedFinanceUser: { select: { id: true, name: true, role: true } } },
  });
  res.json({ success: true, data: updatedCenter });
});

export const updateCenterPaymentProof = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'Payment proof file is required' });
    return;
  }

  const center = await prisma.studyCenter.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user.organizationId,
      OR: [
        { onboardingStatus: { stage: 'finance', state: { in: ['pending', 'resubmitted'] } } },
        { status: { in: ['pending_payment', 'finance_resubmitted'] } }
      ]
    },
    include: { onboardingStatus: true }
  });
  if (!center) {
    res.status(404).json({ success: false, message: 'Pending finance study center not found' });
    return;
  }

  const departmentType = req.user.department?.type || req.user.subDepartment?.parentDept?.type;
  const isFinanceAssignee = req.user.role === 'finance_sub_admin'
    || (req.user.role === 'employee' && departmentType === 'finance');
  if (isFinanceAssignee && center.assignedFinanceUserId !== req.user.id) {
    res.status(403).json({ success: false, message: 'This study center is not assigned to you' });
    return;
  }

  const paymentProof = {
    url: getPaymentProofDataUrl(req.file),
    uploadedAt: new Date().toISOString(),
    remarks: typeof req.body.remarks === 'string' ? req.body.remarks.trim() : ''
  };
  const updatedCenter = await prisma.studyCenter.update({
    where: { id: center.id },
    data: {
      paymentProof,
      paymentRemarks: paymentProof.remarks || null
    },
    include: {
      onboardingStatus: true,
      verifier: { select: { id: true, name: true, email: true } },
      assignedFinanceUser: { select: { id: true, name: true, role: true } }
    }
  });

  res.json({ success: true, data: updatedCenter });
});

export const financeVerifyCenter = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { action, remarks } = req.body;
  if (!['approve', 'reject'].includes(action)) {
    res.status(400).json({ success: false, message: 'action must be approve or reject' });
    return;
  }
  if (action === 'reject' && !remarks?.trim()) {
    res.status(400).json({ success: false, message: 'Remarks are required when rejecting payment' });
    return;
  }
  const existingCenter = await prisma.studyCenter.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user.organizationId,
      OR: [
        { onboardingStatus: { stage: 'finance' } },
        { status: { in: ['pending_payment', 'finance_resubmitted', 'finance_rejected', 'rejected_from_finance'] } },
      ],
    },
    include: { onboardingStatus: true },
  });
  if (!existingCenter) {
    res.status(404).json({ success: false, message: 'Pending payment center not found' });
    return;
  }
  const departmentType = req.user.department?.type || req.user.subDepartment?.parentDept?.type;
  const isFinanceAssignee = req.user.role === 'finance_sub_admin'
    || (req.user.role === 'employee' && departmentType === 'finance');
  if (isFinanceAssignee && existingCenter.assignedFinanceUserId !== req.user.id) {
    res.status(403).json({ success: false, message: 'This study center is not assigned to you' });
    return;
  }
  const paymentProof = existingCenter.paymentProof as { url?: unknown } | string | null;
  const paymentProofUrl = typeof paymentProof === 'string' ? paymentProof : paymentProof?.url;
  if (action === 'approve' && (typeof paymentProofUrl !== 'string' || !paymentProofUrl.trim())) {
    res.status(400).json({ success: false, message: 'A payment proof must be uploaded before approving this study center' });
    return;
  }

  let admissionInvoice: any = null;
  if (action === 'approve') {
    const [universities, authFees] = await Promise.all([
      prisma.university.findMany({
        where: {
          id: { in: existingCenter.universityIds || [] },
          organizationId: req.user.organizationId
        },
        select: { id: true, name: true, code: true }
      }),
      prisma.universityAuthFee.findMany({
        where: {
          organizationId: req.user.organizationId,
          universityId: { in: existingCenter.universityIds || [] }
        },
        select: { universityId: true, feeDetails: true }
      })
    ]);
    const universityById = new Map(universities.map(university => [university.id, university]));
    const feeByUniversity = new Map(authFees.map(fee => {
      const details = (fee.feeDetails as any) || {};
      return [fee.universityId, Number(details.amount) || 0];
    }));
    const items = (existingCenter.universityIds || []).flatMap((universityId: string) => {
      const university = universityById.get(universityId);
      const amount = feeByUniversity.get(universityId) || 0;
      if (!university || amount <= 0) return [];
      return [{
        description: `Authorization Fee - ${university.name} (${university.code})`,
        category: 'admission',
        quantity: 1,
        rate: amount,
        taxRate: 0,
        amount
      }];
    });
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    if (total > 0) {
      const proofUploadedAt = paymentProof && typeof paymentProof === 'object' && paymentProof.uploadedAt
        ? new Date(paymentProof.uploadedAt as string)
        : new Date();
      const receivedAt = Number.isNaN(proofUploadedAt.getTime()) ? new Date() : proofUploadedAt;
      admissionInvoice = {
        items,
        amount: total,
        receivedAt,
        invoiceNo: await generateNextInvoiceNumber(req.user.organizationId),
        receiptNo: await generateNextReceiptNumber(req.user.organizationId)
      };
    }
  }

  // Workflow Rule:
  // When Finance approves: Only after final approval should the centre be activated! (active).
  // When Finance rejects: keep at Finance stage (finance_rejected).
  const targetStatusCode = action === 'approve' ? 'active' : 'finance_rejected';
  const targetStatus = await getOnboardingStatusByCode(targetStatusCode);

  const historyEntry = {
    status: targetStatus?.code || targetStatusCode,
    statusName: targetStatus?.name || (action === 'approve' ? 'Active' : 'Finance Rejected'),
    stage: targetStatus?.stage || (action === 'approve' ? 'completed' : 'finance'),
    state: targetStatus?.state || (action === 'approve' ? 'active' : 'rejected'),
    actorId: req.user.id,
    actorName: req.user.name,
    remarks: remarks?.trim() || '',
    timestamp: new Date().toISOString(),
  };

  const center = await prisma.$transaction(async tx => {
    const updatedCenter = await tx.studyCenter.update({
      where: { id: req.params.id },
      data: {
        onboardingStatusId: targetStatus?.id || null,
        status: targetStatusCode,
        financeApprovedBy: action === 'approve' ? req.user.id : undefined,
        financeApprovedAt: action === 'approve' ? new Date() : undefined,
        paymentRemarks: remarks?.trim() || null,
        statusHistory: [
          ...((existingCenter.statusHistory as any[]) || []),
          historyEntry
        ],
      },
      include: {
        onboardingStatus: true,
        verifier: { select: { id: true, name: true, email: true } },
        assignedFinanceUser: { select: { id: true, name: true, role: true } },
      }
    });

    if (admissionInvoice) {
      const existingInvoice = await tx.invoice.findFirst({
        where: {
          organizationId: req.user.organizationId,
          centerId: existingCenter.id,
          invoiceType: 'study_center_admission'
        },
        select: { id: true, status: true, paidAmount: true }
      });
      if (existingInvoice && existingInvoice.status !== 'paid' && existingInvoice.status !== 'cancelled' && Number(existingInvoice.paidAmount || 0) === 0) {
        // Invoice raised at Operations approval: settle it now and issue the receipt.
        await tx.invoice.update({
          where: { id: existingInvoice.id },
          data: {
            items: admissionInvoice.items,
            amount: admissionInvoice.amount,
            total: admissionInvoice.amount,
            paidAmount: admissionInvoice.amount,
            balanceAmount: 0,
            status: 'paid',
            paidAt: admissionInvoice.receivedAt
          }
        });
        await tx.paymentEntry.create({
          data: {
            organizationId: req.user.organizationId,
            invoiceId: existingInvoice.id,
            amount: admissionInvoice.amount,
            method: 'Study Centre Admission Payment',
            // Data URL proofs are megabytes of base64 and stay on the center record, not in the reference field
            referenceNo: String(paymentProofUrl).startsWith('data:') ? null : paymentProofUrl,
            receiptNo: admissionInvoice.receiptNo,
            receiptDate: admissionInvoice.receivedAt,
            receivedBy: req.user.id,
            receivedAt: admissionInvoice.receivedAt,
            notes: 'Payment proof approved by Finance'
          }
        });
      }
      if (!existingInvoice) {
        const invoice = await tx.invoice.create({
          data: {
            organizationId: req.user.organizationId,
            centerId: existingCenter.id,
            invoiceNo: admissionInvoice.invoiceNo,
            invoiceType: 'study_center_admission',
            financialYear: calculateFinancialYear(admissionInvoice.receivedAt),
            period: 'Study Centre Authorization Fee',
            amount: admissionInvoice.amount,
            tax: 0,
            total: admissionInvoice.amount,
            paidAmount: admissionInvoice.amount,
            balanceAmount: 0,
            status: 'paid',
            items: admissionInvoice.items,
            studentDetails: {
              fullName: existingCenter.name,
              enrollmentNumber: existingCenter.code,
              programName: 'Study Centre Authorization',
              programCode: existingCenter.code,
              admissionType: 'Study Centre Admission'
            },
            issuedAt: admissionInvoice.receivedAt,
            paidAt: admissionInvoice.receivedAt
          }
        });
        await tx.paymentEntry.create({
          data: {
            organizationId: req.user.organizationId,
            invoiceId: invoice.id,
            amount: admissionInvoice.amount,
            method: 'Study Centre Admission Payment',
            // Data URL proofs are megabytes of base64 and stay on the center record, not in the reference field
            referenceNo: String(paymentProofUrl).startsWith('data:') ? null : paymentProofUrl,
            receiptNo: admissionInvoice.receiptNo,
            receiptDate: admissionInvoice.receivedAt,
            receivedBy: req.user.id,
            receivedAt: admissionInvoice.receivedAt,
            notes: 'Payment proof approved by Finance'
          }
        });
      }
    }
    return updatedCenter;
  });
  res.json({ success: true, data: center });
});


export const createStudyCenter = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name: rawName, code: rawCode, email: rawEmail, contact: rawContact, referredById, ...rest } = req.body;
  const name = typeof rawName === 'string' ? rawName.trim() : rawName;
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : rawCode;
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : rawEmail;
  const contact = typeof rawContact === 'string' ? rawContact.trim() : rawContact;

  const linkedUniversityIds = req.user.universityId
    ? [req.user.universityId]
    : (Array.isArray(req.body.universityIds) ? req.body.universityIds : []);
  
  const rawPassword = 'admin123'.trim();
  const hashedPassword = await hashPassword(rawPassword);
  const rawUserId = await generateStudyCenterUserId(req.user.organizationId);
  const userId = (rawUserId || '').trim();

  const userEmail = email || `admin.${code}@example.com`.trim();

  const center = await prisma.studyCenter.create({
    data: {
      ...rest,
      name,
      code,
      email: userEmail,
      contact,
      organizationId: req.user.organizationId,
      status: 'active' as any,
      financeApprovedBy: req.user.id,
      financeApprovedAt: new Date(),
      referredBy: typeof referredById === 'string' ? (referredById.trim() || null) : (referredById || null),
      universityIds: linkedUniversityIds,
      credentials: { userId, password: rawPassword }
    }
  });

  const user = await prisma.user.create({
    data: {
      userId,
      organizationId: req.user.organizationId,
      universityId: linkedUniversityIds[0] || null,
      studyCenterId: center.id,
      email: userEmail,
      password: hashedPassword,
      name: `${name} Admin`.trim(),
      role: 'center_admin' as any,
      phone: contact,
      status: 'active' as any
    }
  });

  res.status(201).json({ success: true, data: { center, user, credentials: { userId, password: rawPassword } } });
});

// Reports
export const getIncomeExpenditureReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const fromDate = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear() + '-04-01');
  const toDate = req.query.to ? new Date(req.query.to as string) : new Date();

  // Set time limits to include whole days
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(23, 59, 59, 999);

  // Generate list of months in date range
  const months: string[] = [];
  let current = new Date(fromDate);
  while (current <= toDate) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const key = `${yyyy}-${mm}`;
    if (!months.includes(key)) {
      months.push(key);
    }
    current.setMonth(current.getMonth() + 1);
  }

  // Initialize monthly structure
  const monthlyData = new Map<string, {
    month: string;
    income: { invoices: number; enrollments: number; payments: number; total: number };
    expenditure: { expenses: number; salaries: number; total: number };
    net: number;
  }>();

  for (const m of months) {
    monthlyData.set(m, {
      month: m,
      income: { invoices: 0, enrollments: 0, payments: 0, total: 0 },
      expenditure: { expenses: 0, salaries: 0, total: 0 },
      net: 0
    });
  }

  // 1. Fetch Invoices
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: req.user.organizationId,
      createdAt: { gte: fromDate, lte: toDate },
      status: { not: 'draft' }
    }
  });
  for (const inv of invoices) {
    const date = new Date(inv.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const bucket = monthlyData.get(key);
    if (bucket) {
      bucket.income.invoices += inv.total;
      bucket.income.total += inv.total;
    }
  }

  // 2. Fetch Enrollment Payments
  const enrollmentPayments = await prisma.enrollmentPayment.findMany({
    where: {
      studyCenter: { organizationId: req.user.organizationId },
      createdAt: { gte: fromDate, lte: toDate }
    }
  });
  for (const ep of enrollmentPayments) {
    const date = new Date(ep.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const bucket = monthlyData.get(key);
    if (bucket) {
      bucket.income.enrollments += ep.amount;
      bucket.income.total += ep.amount;
    }
  }

  // 3. Fetch Payment Entries
  const paymentEntries = await prisma.paymentEntry.findMany({
    where: {
      organizationId: req.user.organizationId,
      receivedAt: { gte: fromDate, lte: toDate }
    }
  });
  for (const pe of paymentEntries) {
    const date = new Date(pe.receivedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const bucket = monthlyData.get(key);
    if (bucket) {
      bucket.income.payments += pe.amount;
      bucket.income.total += pe.amount;
    }
  }

  // 4. Fetch Expense Claims
  const expenses = await prisma.expenseClaim.findMany({
    where: {
      organizationId: req.user.organizationId,
      status: { in: ['approved', 'reimbursed'] },
      createdAt: { gte: fromDate, lte: toDate }
    }
  });
  for (const exp of expenses) {
    const date = new Date(exp.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const bucket = monthlyData.get(key);
    if (bucket) {
      bucket.expenditure.expenses += exp.amount;
      bucket.expenditure.total += exp.amount;
    }
  }

  // 5. Fetch Salaries
  const payrolls = await prisma.payroll.findMany({
    where: {
      organizationId: req.user.organizationId,
      status: { in: ['paid', 'confirmed', 'transferred_to_finance'] },
      OR: [
        { paymentDate: { gte: fromDate, lte: toDate } },
        { createdAt: { gte: fromDate, lte: toDate } }
      ]
    }
  });
  for (const pay of payrolls) {
    const date = pay.paymentDate ? new Date(pay.paymentDate) : new Date(pay.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const bucket = monthlyData.get(key);
    if (bucket) {
      bucket.expenditure.salaries += pay.netSalary;
      bucket.expenditure.total += pay.netSalary;
    }
  }

  // Calculate net for each month
  for (const bucket of monthlyData.values()) {
    bucket.net = bucket.income.total - bucket.expenditure.total;
  }

  // Calculate totals and breakdowns
  const monthly = Array.from(monthlyData.values());
  let totalIncome = 0;
  let totalExpenditure = 0;
  let invoiceTotal = 0;
  let enrollmentTotal = 0;
  let paymentTotal = 0;
  let salaryTotal = 0;
  let expenseTotal = 0;

  for (const m of monthly) {
    invoiceTotal += m.income.invoices;
    enrollmentTotal += m.income.enrollments;
    paymentTotal += m.income.payments;
    salaryTotal += m.expenditure.salaries;
    expenseTotal += m.expenditure.expenses;
    totalIncome += m.income.total;
    totalExpenditure += m.expenditure.total;
  }

  const categoryMap = new Map<string, number>();
  for (const exp of expenses) {
    const cat = exp.category || 'Other';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + exp.amount);
  }
  const byCategory = Array.from(categoryMap.entries()).map(([id, amount]) => ({
    id,
    amount,
    count: expenses.filter(e => e.category === id).length
  }));

  const netProfit = totalIncome - totalExpenditure;
  const profitMargin = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

  res.json({
    success: true,
    data: {
      period: { from: fromDate.toISOString().slice(0, 10), to: toDate.toISOString().slice(0, 10) },
      monthly,
      totals: {
        income: totalIncome,
        expenditure: totalExpenditure,
        netProfit,
        profitMargin
      },
      incomeBreakdown: {
        invoices: invoiceTotal,
        enrollments: enrollmentTotal,
        payments: paymentTotal
      },
      expenditureBreakdown: {
        salaries: salaryTotal,
        expenses: expenseTotal,
        byCategory
      }
    }
  });
});

// Sales Users
export const getFinanceSalesUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    where: {
      organizationId: req.user.organizationId,
      role: { in: ['sales_admin', 'bde', 'employee'] }
    }
  });
  res.json({ success: true, data: users });
});

// University Fee Payments

export const getUniversityFeePayments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status, universityId, centerId, programId, search } = req.query;
  const whereClause: any = { organizationId: req.user.organizationId };
  if (status && status !== 'all') {
    whereClause.status = status;
  }
  
  if (universityId || centerId || programId || search) {
    whereClause.student = { ...whereClause.student };
    
    if (universityId) {
      whereClause.student.program = { universityId: universityId as string };
    }
    if (centerId) {
      whereClause.student.centerId = centerId as string;
    }
    if (programId) {
      whereClause.student.programId = programId as string;
    }
    if (search) {
      const s = search as string;
      whereClause.student = {
        ...whereClause.student,
        OR: [
          { name: { contains: s, mode: 'insensitive' } },
          { enrollmentNo: { contains: s, mode: 'insensitive' } },
          { uniEnrollmentNumber: { contains: s, mode: 'insensitive' } }
        ]
      };
    }
  }

  const payments = await prisma.universityFeePayment.findMany({
    where: whereClause,
    include: {
      student: {
        include: {
          program: true,
          center: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, count: payments.length, data: payments });
});


export const payUniversityFee = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { referenceNo, paidAt } = req.body;
  const screenshot = req.file ? getPaymentProofDataUrl(req.file) : undefined;

  const payment = await prisma.universityFeePayment.findUnique({
    where: { id: req.params.id }
  });

  if (!payment || payment.organizationId !== req.user.organizationId) {
    res.status(404).json({ success: false, message: 'University fee payment entry not found' });
    return;
  }

  const updated = await prisma.universityFeePayment.update({
    where: { id: req.params.id },
    data: {
      status: 'paid',
      referenceNo: referenceNo || null,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      screenshot: screenshot || payment.screenshot
    }
  });

  await syncPaidUniversityFeeInvoices(req.user.organizationId);
  const paymentWithInvoice = await prisma.universityFeePayment.findUnique({
    where: { id: updated.id }
  });

  res.json({ success: true, data: paymentWithInvoice });
});

// ─── Total Data Report ─────────────────────────────────────────────────────────

export const getTotalReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { universityId, programId, sessionId, search, dateFrom, dateTo } = req.query as Record<string, string>;

  // Fetch fee structures first so we can build university→programId mapping
  const feeStructures = await prisma.programFeeStructure.findMany({
    where: { organizationId: req.user.organizationId },
    include: {
      program: { select: { id: true, name: true } },
      university: { select: { id: true, name: true, coordinatorName: true } },
      admissionSession: { select: { id: true, name: true } },
    },
  });

  let programIdsForUniversity: string[] | undefined;
  if (universityId) {
    const progs = await prisma.program.findMany({ where: { universityId }, select: { id: true } });
    programIdsForUniversity = progs.map(p => p.id);
    if (programIdsForUniversity.length === 0) {
      res.json({ success: true, count: 0, data: [] });
      return;
    }
  }

  // Build final programId filter: if both universityId AND programId filters active,
  // use the intersection; otherwise use whichever is set
  let programIdFilter: { programId: string } | { programId: { in: string[] } } | undefined;
  if (programId && programIdsForUniversity) {
    // Both filters — intersection
    if (!programIdsForUniversity.includes(programId)) {
      res.json({ success: true, count: 0, data: [] });
      return;
    }
    programIdFilter = { programId };
  } else if (programId) {
    programIdFilter = { programId };
  } else if (programIdsForUniversity) {
    programIdFilter = { programId: { in: programIdsForUniversity } };
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      organizationId: req.user.organizationId,
      ...programIdFilter,
      ...(sessionId && { sessionId }),
      ...( (() => {
        const dateFilter: any = {};
        if (dateFrom && !isNaN(new Date(dateFrom).getTime())) {
          dateFilter.gte = new Date(dateFrom);
        }
        if (dateTo && !isNaN(new Date(dateTo + 'T23:59:59.999Z').getTime())) {
          dateFilter.lte = new Date(dateTo + 'T23:59:59.999Z');
        }
        return Object.keys(dateFilter).length > 0 ? {
          OR: [
            { admissionDate: dateFilter },
            { admissionDate: null, createdAt: dateFilter }
          ]
        } : {};
      })() ),
      ...(search && {
        OR: [
          { studentName: { contains: search, mode: 'insensitive' } },
          { studyCenter: { name: { contains: search, mode: 'insensitive' } } },
        ]
      }),
    },
    include: {
      program: { select: { id: true, name: true, university: { select: { name: true, coordinatorName: true } } } },
      session: { select: { id: true, name: true } },
      studyCenter: { select: { id: true, name: true, branchName: true, coordinatorName: true, referredBy: true } },
      student: { select: { enrollmentNo: true, uniEnrollmentNumber: true } },
      salesUser: { select: { name: true } },
      payment: true,
      commissionIn: {
        include: {
          commissionOuts: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
  });

  // Fees actually collected per enrollment: invoice payments (university fee invoices mirror
  // remittances, so they are excluded) plus fee receipts not linked to an invoice payment
  const enrollmentIds = enrollments.map(e => e.id);
  const [enrollmentInvoices, unlinkedReceipts, centreReferrers] = enrollmentIds.length > 0
    ? await Promise.all([
        prisma.invoice.findMany({
          where: {
            organizationId: req.user.organizationId,
            enrollmentId: { in: enrollmentIds },
            invoiceType: { not: 'university_fee' },
            status: { not: 'cancelled' },
          },
          select: { enrollmentId: true, total: true, paidAmount: true },
        }),
        prisma.studentFeeReceipt.findMany({
          where: { organizationId: req.user.organizationId, enrollmentId: { in: enrollmentIds }, invoicePayment: null },
          select: { enrollmentId: true, amount: true },
        }),
        prisma.user.findMany({
          where: {
            organizationId: req.user.organizationId,
            id: { in: [...new Set(enrollments.map(e => e.studyCenter?.referredBy).filter(Boolean))] as string[] },
          },
          select: { id: true, name: true },
        }),
      ])
    : [[], [], []];
  const feesByEnrollment: Record<string, { billed: number; collected: number }> = {};
  for (const invoice of enrollmentInvoices) {
    if (!invoice.enrollmentId) continue;
    const entry = feesByEnrollment[invoice.enrollmentId] || { billed: 0, collected: 0 };
    entry.billed += Number(invoice.total) || 0;
    entry.collected += Number(invoice.paidAmount) || 0;
    feesByEnrollment[invoice.enrollmentId] = entry;
  }
  for (const receipt of unlinkedReceipts) {
    const entry = feesByEnrollment[receipt.enrollmentId] || { billed: 0, collected: 0 };
    entry.collected += Number(receipt.amount) || 0;
    feesByEnrollment[receipt.enrollmentId] = entry;
  }
  const referrerNames = new Map(centreReferrers.map(user => [user.id, user.name]));

  // Fetch university fee payments for enrolled students
  const studentIds = [...new Set(enrollments.map(e => e.studentId).filter(Boolean))] as string[];
  const universityPayments = studentIds.length > 0
    ? await prisma.universityFeePayment.findMany({
        where: {
          organizationId: req.user.organizationId,
          studentId: { in: studentIds },
        },
      })
    : [];

  const uniPaymentMap: Record<string, any[]> = {};
  for (const up of universityPayments) {
    let eId = up.enrollmentId;
    if (!eId && up.studentId) {
      const e = enrollments.find(e => e.studentId === up.studentId);
      if (e) eId = e.id;
    }
    if (eId) {
      uniPaymentMap[eId] = uniPaymentMap[eId] || [];
      uniPaymentMap[eId].push(up);
    }
  }

  // Fetch Re-Registration Invoices
  const invoices = studentIds.length > 0
    ? await prisma.invoice.findMany({
        where: {
          organizationId: req.user.organizationId,
          studentId: { in: studentIds },
          status: 'paid'
        },
      })
    : [];

  const invoiceMap: Record<string, any[]> = {};
  for (const inv of invoices) {
    if (inv.studentId) {
      const e = enrollments.find(e => e.studentId === inv.studentId);
      if (e) {
        invoiceMap[e.id] = invoiceMap[e.id] || [];
        invoiceMap[e.id].push(inv);
      }
    }
  }

  const rows = enrollments.map(enrollment => {
    const payment = enrollment.payment;
    const uniPayments = uniPaymentMap[enrollment.id] || [];
    const studentInvoices = invoiceMap[enrollment.id] || [];
    const reRegPaidAmount = studentInvoices.reduce((sum, i) => sum + i.amount, 0);

    const totalUniAmount = uniPayments.reduce((sum, p) => sum + p.amount, 0);
    const paidUniAmount = uniPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    let uniStatus = 'Pending';
    if (uniPayments.length > 0) {
      if (uniPayments.every(p => p.status === 'paid')) uniStatus = 'Paid';
      else if (uniPayments.some(p => p.status === 'paid')) uniStatus = 'Partially Paid';
    } else {
      uniStatus = 'pending';
    }

    // Find best-matching fee structure (session-specific first, then program-only)
    const centerFees = feeStructures.filter(
      fee => fee.level === 'program'
        && fee.programId === enrollment.programId
        && fee.studyCenterId === enrollment.studyCenterId
    );
    const legacyProgramFees = feeStructures.filter(
      fee => fee.level === 'program'
        && fee.programId === enrollment.programId
        && !fee.studyCenterId
    );
    const feeStruct =
      centerFees.find(fee => fee.admissionSessionId === enrollment.sessionId) ||
      centerFees.find(fee => !fee.admissionSessionId) ||
      legacyProgramFees.find(fee => fee.admissionSessionId === enrollment.sessionId) ||
      legacyProgramFees.find(fee => !fee.admissionSessionId);

    const additionalFees: any[] = Array.isArray(feeStruct?.additionalFees) ? feeStruct.additionalFees : [];
    const coordinatorFee = additionalFees.find((f: any) => {
      const label = typeof f?.label === 'string' ? f.label.toLowerCase() : '';
      const type = typeof f?.type === 'string' ? f.type.toLowerCase() : '';
      return label.includes('coordinator') || type.includes('coordinator');
    });

    const commIn = enrollment.commissionIn;
    const commOut = commIn?.commissionOuts?.[0] || null;

      let centerPaymentAmount = payment?.amount ?? null;
      let centerPaymentStatus = payment ? 'Paid' : 'Due';
      
      if (!payment && enrollment.paymentType === 'direct_to_university') {
        centerPaymentAmount = 0;
        centerPaymentStatus = 'Paid';
      } else if (!payment) {
        // No wallet debit: use the fees collected against the enrollment's invoices and receipts
        const fees = feesByEnrollment[enrollment.id];
        const billed = fees?.billed || Number(enrollment.totalFee) || 0;
        const collected = fees?.collected || 0;
        if (collected > 0) {
          centerPaymentAmount = collected;
          centerPaymentStatus = billed > 0 && collected < billed ? 'Partially Paid' : 'Paid';
        }
      }

      const isDirectApplication = Boolean((enrollment as any).publicTrackingTokenHash);
      const centreReferrerName = enrollment.studyCenter?.referredBy
        ? referrerNames.get(enrollment.studyCenter.referredBy) || null
        : null;

      return {
        id: enrollment.id,
        studentName: enrollment.studentName,
        // Admission number is assigned to the student when the application is created
        enrollmentNumber: enrollment.enrollmentNumber || (enrollment as any).student?.enrollmentNo || null,
        uniEnrollmentNumber: enrollment.uniEnrollmentNumber || (enrollment as any).student?.uniEnrollmentNumber || null,
        admissionDate: enrollment.admissionDate || enrollment.createdAt,
        admissionSession: enrollment.session?.name || '',
        centerName: enrollment.studyCenter?.name
          || ((enrollment as any).salesUser ? 'Sales Direct' : isDirectApplication ? 'Direct (Online Application)' : 'Direct'),
        isStudyCentre: Boolean(enrollment.studyCenter),
        subCenterName: enrollment.studyCenter?.branchName || '',
        isSubCenter: Boolean(enrollment.studyCenter?.branchName?.trim()),
        program: enrollment.program?.name || '',
        university: (feeStruct?.university?.name || (enrollment.program as any)?.university?.name) || '',
        centerPaymentAmount,
        centerPaymentStatus,
        centerPaymentFor: enrollment.status || '',
      universityPaymentAmount: uniPayments.length > 0 ? totalUniAmount : null,
      universityPaidAmount: uniPayments.length > 0 ? paidUniAmount : 0,
      universityPaymentStatus: uniStatus,
      universityPaymentScreenshots: uniPayments.map(p => p.screenshot).filter(Boolean),
      // Recorded coordinator first, otherwise who brought the admission in: the Sales executive
      // for Sales applications, or the person who onboarded the study centre
      coordinatorName: enrollment.studyCenter?.coordinatorName || feeStruct?.university?.coordinatorName || (enrollment.program as any)?.university?.coordinatorName || coordinatorFee?.coordinator
        || (enrollment as any).salesUser?.name || centreReferrerName || null,
      coordinatorPaymentAmount: coordinatorFee?.amount || null,
      coordinatorPaymentStatus: coordinatorFee
        ? (uniStatus === 'Paid' ? 'paid' : 'Due')
        : 'Not Applicable',
      enrollmentStatus: enrollment.status,
      reRegTotalCollected: reRegPaidAmount,
      // Commission Got from University details
      commissionInAmount: commIn ? commIn.receivedAmount : null,
      commissionInExpected: commIn ? commIn.expectedAmount : null,
      commissionInStatus: commIn ? commIn.status : 'pending',
      commissionInDate: commIn ? commIn.receivedAt : null,
      // Commission Given to Centers details
      commissionOutAmount: commOut ? commOut.amount : null,
      commissionOutStatus: commOut ? commOut.status : 'pending',
      commissionOutDate: commOut ? commOut.paidAt : null,
    };
  });

  res.json({ success: true, count: rows.length, data: rows });
});

// ─── Re-Registration schedule (shared by the pending and completed reports) ──
// A re-registration is every fee installment after the first one (Semester 2+, Year 2+); the first
// installment is paid at admission. An installment counts as paid when the money collected for the
// enrollment covers it (cumulatively, in installment order), or when a paid invoice names it.

const REREG_PAID_TOLERANCE = 1; // rupee rounding

const parseJsonArray = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
};

const sumBreakdownAdditionalFees = (value: any) => {
  if (typeof value !== 'string' || !value.trim()) return 0;
  return value.split(',').reduce((sum, part) => sum + (Number(part.trim().split(':')[1]) || 0), 0);
};

// Same amounts used when the enrollment is approved (first installment) and billed afterwards
const getInstallmentAmount = (feeStructure: any, item: any, isFirst: boolean) => {
  const additionalFees = Array.isArray(feeStructure.additionalFees) ? feeStructure.additionalFees : [];
  let subtotal = (Number(item.baseFee) || 0) + (Number(item.examFee) || 0) + sumBreakdownAdditionalFees(item.additionalFees);
  // University-level structures carry the cycle amount in universityFee
  if (subtotal === 0) subtotal = Number(item.universityFee) || 0;
  if (isFirst) {
    subtotal += additionalFees.filter((fee: any) => fee.label !== 'GST').reduce((sum: number, fee: any) => sum + (Number(fee.amount) || 0), 0);
  }
  const gst = additionalFees.find((fee: any) => fee.label === 'GST');
  return subtotal + (gst ? Math.round((subtotal * (Number(gst.amount) || 0)) / 100) : 0);
};

const pickReregFeeStructure = (enrollment: any, feeStructures: any[]) => {
  const sessionId = enrollment.sessionId || null;
  const universityId = enrollment.program?.university?.id;
  const ranked = feeStructures
    .map(c => {
      let score = 0;
      if (c.level === 'program' && c.programId === enrollment.programId
        && (c.studyCenterId === enrollment.studyCenterId || c.studyCenterId === null)) {
        const centerMatch = Boolean(enrollment.studyCenterId && c.studyCenterId === enrollment.studyCenterId);
        if (c.admissionSessionId === sessionId) score = centerMatch ? 150 : 100;
        else if (c.admissionSessionId === null) score = centerMatch ? 130 : 80;
        else score = centerMatch ? 110 : 60;
      } else if (!enrollment.studyCenterId && c.level === 'university' && c.universityId === universityId
        && (c.programId === enrollment.programId || c.programId === null)) {
        const programMatch = c.programId === enrollment.programId;
        if (c.admissionSessionId === sessionId) score = programMatch ? 50 : 40;
        else if (c.admissionSessionId === null) score = programMatch ? 30 : 20;
        else score = programMatch ? 15 : 10;
      }
      return { c, score };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.c || null;
};

const getCycleLabel = (billingCycle: string) =>
  billingCycle === 'per_semester' ? 'Semester'
    : (billingCycle === 'per_year' || billingCycle === 'yearly') ? 'Year'
    : 'Installment';

// Exact "Semester N" / "Year N" match, so "Semester 1" never matches "Semester 10"
const invoiceNamesInstallment = (invoice: any, name: string) => {
  const pattern = new RegExp(`\\b${name.replace(/\s+/g, '\\s*')}\\b`, 'i');
  return parseJsonArray(invoice.items).some((item: any) => pattern.test(item?.description || ''));
};

const buildReregSchedules = async (req: AuthRequest) => {
  const { centerId, universityId, programId, search } = req.query as any;
  const orgId = req.user.organizationId;

  let actualCenterId = centerId;
  if (req.user.role === 'center_admin') {
    actualCenterId = (req.user as any).studyCenterId || (req.user as any).centerId;
  }

  const programFilter: any = {};
  if (programId) programFilter.programId = programId;
  if (universityId) {
    const progIds = (await prisma.program.findMany({
      where: { organizationId: orgId, universityId },
      select: { id: true },
    })).map(p => p.id);
    programFilter.programId = programId ? (progIds.includes(programId) ? programId : '__none__') : { in: progIds };
  }

  // Only students who have completed admission owe re-registration fees
  const enrollments = await prisma.enrollment.findMany({
    where: {
      organizationId: orgId,
      status: 'enrolled',
      ...(actualCenterId && { studyCenterId: actualCenterId }),
      ...programFilter,
      ...(search && {
        OR: [
          { studentName: { contains: search, mode: 'insensitive' } },
          { studentEmail: { contains: search, mode: 'insensitive' } },
          { studentPhone: { contains: search, mode: 'insensitive' } },
          { enrollmentNumber: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    include: {
      program: { select: { id: true, name: true, duration: true, university: { select: { id: true, name: true } } } },
      session: { select: { id: true, name: true, reregPaymentClosingDate: true } },
      studyCenter: { select: { id: true, name: true, branchName: true } },
      student: { select: { id: true, createdAt: true, enrolledAt: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (enrollments.length === 0) return [];

  const enrollmentIds = enrollments.map(e => e.id);
  const studentIds = enrollments.map(e => e.student?.id).filter(Boolean) as string[];
  const [feeStructures, invoices, unlinkedReceipts] = await Promise.all([
    prisma.programFeeStructure.findMany({ where: { organizationId: orgId } }),
    // Student fees only: university remittance mirrors are not money collected from the student
    prisma.invoice.findMany({
      where: {
        organizationId: orgId,
        invoiceType: { not: 'university_fee' },
        status: { not: 'cancelled' },
        OR: [{ enrollmentId: { in: enrollmentIds } }, ...(studentIds.length ? [{ studentId: { in: studentIds } }] : [])],
      },
      select: {
        id: true, enrollmentId: true, studentId: true, status: true, items: true, paidAmount: true, paidAt: true, createdAt: true,
        payments: { select: { amount: true, receivedAt: true, receiptDate: true } },
      },
    }),
    prisma.studentFeeReceipt.findMany({
      where: { organizationId: orgId, enrollmentId: { in: enrollmentIds }, invoicePayment: null },
      select: { enrollmentId: true, amount: true, receiptDate: true },
    }),
  ]);

  const enrollmentIdByStudent = new Map<string, string>();
  for (const e of enrollments) if (e.student?.id && !enrollmentIdByStudent.has(e.student.id)) enrollmentIdByStudent.set(e.student.id, e.id);

  // Dated collections per enrollment
  const collections = new Map<string, { invoices: any[]; payments: { amount: number; date: Date; invoiceId: string | null }[] }>();
  const bucket = (id: string) => {
    if (!collections.has(id)) collections.set(id, { invoices: [], payments: [] });
    return collections.get(id)!;
  };
  for (const invoice of invoices) {
    const enrollmentId = invoice.enrollmentId || (invoice.studentId ? enrollmentIdByStudent.get(invoice.studentId) : null);
    if (!enrollmentId || !enrollmentIds.includes(enrollmentId)) continue;
    const entry = bucket(enrollmentId);
    entry.invoices.push(invoice);
    let recorded = 0;
    for (const payment of invoice.payments || []) {
      const amount = Number(payment.amount) || 0;
      recorded += amount;
      entry.payments.push({ amount, date: new Date(payment.receiptDate || payment.receivedAt), invoiceId: invoice.id });
    }
    // Amounts marked paid on the invoice without a payment entry (e.g. approval or wallet)
    const residual = (Number(invoice.paidAmount) || 0) - recorded;
    if (residual > REREG_PAID_TOLERANCE) {
      entry.payments.push({ amount: residual, date: new Date(invoice.paidAt || invoice.createdAt), invoiceId: invoice.id });
    }
  }
  for (const receipt of unlinkedReceipts) {
    bucket(receipt.enrollmentId).payments.push({ amount: Number(receipt.amount) || 0, date: new Date(receipt.receiptDate), invoiceId: null });
  }

  const schedules: any[] = [];
  for (const e of enrollments) {
    if (!e.student) continue;
    const feeStructure = pickReregFeeStructure(e, feeStructures);
    if (!feeStructure) continue;
    const breakdown = parseJsonArray(feeStructure.feeBreakdown);
    if (breakdown.length < 2) continue; // nothing to re-register after the first installment

    const cycleLabel = getCycleLabel(feeStructure.billingCycle);
    const entry = collections.get(e.id) || { invoices: [], payments: [] };
    const payments = [...entry.payments].sort((a, b) => a.date.getTime() - b.date.getTime());
    const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
    const startDate = new Date(e.enrolledAt || e.student.enrolledAt || e.student.createdAt);

    let cumulativeDue = 0;
    let nextUnpaidSeen = false;
    const installments = breakdown.map((item: any, index: number) => {
      const name = `${cycleLabel} ${item.year || index + 1}`;
      const amount = getInstallmentAmount(feeStructure, item, index === 0);
      cumulativeDue += amount;

      const namedInvoice = entry.invoices.find(inv => inv.status === 'paid' && invoiceNamesInstallment(inv, name));
      const coveredByCollections = amount > 0 && totalCollected + REREG_PAID_TOLERANCE >= cumulativeDue;
      const paid = Boolean(namedInvoice) || coveredByCollections;

      // Date the collections first covered this installment
      let paidDate: Date | null = null;
      let paidInvoiceId: string | null = namedInvoice?.id || null;
      if (namedInvoice) {
        paidDate = new Date(namedInvoice.paidAt || namedInvoice.createdAt);
      } else if (coveredByCollections) {
        let running = 0;
        for (const payment of payments) {
          running += payment.amount;
          if (running + REREG_PAID_TOLERANCE >= cumulativeDue) { paidDate = payment.date; paidInvoiceId = payment.invoiceId; break; }
        }
      }

      // Deadline: fee breakdown due date, else the session's re-registration closing date for the
      // next pending installment, else an estimate from the enrolment date
      let dueDate: Date;
      let deadlineSource: 'fee_structure' | 'session' | 'estimated';
      if (item.dueDate) {
        dueDate = new Date(item.dueDate);
        deadlineSource = 'fee_structure';
      } else if (index > 0 && !paid && !nextUnpaidSeen && e.session?.reregPaymentClosingDate) {
        dueDate = new Date(e.session.reregPaymentClosingDate);
        deadlineSource = 'session';
      } else {
        dueDate = new Date(startDate);
        if (cycleLabel === 'Semester') dueDate.setMonth(dueDate.getMonth() + index * 6);
        else dueDate.setFullYear(dueDate.getFullYear() + index);
        deadlineSource = 'estimated';
      }
      if (index > 0 && !paid) nextUnpaidSeen = true;

      const collectedBefore = cumulativeDue - amount;
      const paidTowards = Math.max(0, Math.min(amount, totalCollected - collectedBefore));
      return { index, name, amount, paid, paidDate, paidInvoiceId, paidTowards, balance: paid ? 0 : Math.max(0, amount - paidTowards), dueDate, deadlineSource };
    });

    schedules.push({ enrollment: e, cycleLabel, installments, totalCollected, totalDue: cumulativeDue });
  }
  return schedules;
};

const reregBaseRow = (e: any) => ({
  studentName: e.studentName,
  studentEmail: e.studentEmail,
  studentPhone: e.studentPhone,
  enrollmentNumber: e.enrollmentNumber || '',
  program: e.program?.name || '',
  university: e.program?.university?.name || '',
  center: e.studyCenter?.name || '',
  branchName: e.studyCenter?.branchName || '',
});

// ─── Re-Reg Pending Report ────────────────────────────────────────────────────
export const getReregPendingReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { dueDate } = req.query as any;
  const filterDate = dueDate ? new Date(dueDate) : null;
  if (filterDate) filterDate.setHours(23, 59, 59, 999);

  const schedules = await buildReregSchedules(req);
  const rows: any[] = [];
  for (const { enrollment: e, installments, totalCollected, totalDue } of schedules) {
    // Next unpaid re-registration (the first installment is the admission payment)
    const next = installments.find((installment: any) => installment.index > 0 && !installment.paid);
    if (!next) continue;
    if (filterDate && next.dueDate > filterDate) continue;

    const daysUntilDeadline = Math.ceil((next.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    rows.push({
      id: e.id,
      ...reregBaseRow(e),
      session: e.session?.name ? `${e.session.name} - ${next.name}` : next.name,
      reregClosingDate: next.dueDate.toISOString(),
      reregPaymentStatus: next.paidTowards > 0 ? 'Partially Paid' : 'Pending',
      enrollmentStatus: e.status,
      daysUntilDeadline,
      installmentName: next.name,
      installmentAmount: next.amount,
      amountPaid: next.paidTowards,
      balanceDue: next.balance,
      deadlineSource: next.deadlineSource,
      completedInstallments: installments.filter((installment: any) => installment.index > 0 && installment.paid).length,
      totalInstallments: installments.length,
      totalCollected,
      totalDue,
    });
  }

  rows.sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline);
  res.json({ success: true, count: rows.length, data: rows });
});

// ─── Re-Reg Completed Report ──────────────────────────────────────────────────
export const getReregCompletedReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const schedules = await buildReregSchedules(req);
  const rows: any[] = [];
  for (const { enrollment: e, installments } of schedules) {
    for (const installment of installments) {
      if (installment.index === 0 || !installment.paid) continue;
      rows.push({
        id: `${e.id}-${installment.index}`,
        ...reregBaseRow(e),
        session: e.session?.name || '',
        completedInstallment: installment.name,
        paidDate: installment.paidDate ? installment.paidDate.toISOString() : null,
        amountPaid: installment.amount,
        invoiceId: installment.paidInvoiceId || '',
        dueDate: installment.dueDate.toISOString(),
        paidOnTime: installment.paidDate ? installment.paidDate <= installment.dueDate : null,
      });
    }
  }

  // Newest payments first
  rows.sort((a, b) => new Date(b.paidDate || 0).getTime() - new Date(a.paidDate || 0).getTime());
  res.json({ success: true, count: rows.length, data: rows });
});
