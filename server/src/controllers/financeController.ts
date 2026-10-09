// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { hashPassword, generateStudyCenterUserId } from '../utils/authUtils.js';

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
  const payments = await prisma.paymentEntry.findMany({ where: { organizationId: req.user.organizationId } });
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

  const payment = await prisma.paymentEntry.create({
    data: {
      invoiceId,
      amount: amount !== undefined ? parseFloat(amount) : 0,
      method,
      referenceNo,
      receivedAt: rawReceivedAt ? new Date(rawReceivedAt) : undefined,
      notes,
      organizationId: req.user.organizationId,
      receivedBy: req.user.id
    }
  });
  res.status(201).json({ success: true, data: payment });
});
export const updatePayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const exists = await prisma.paymentEntry.findUnique({ where: { id: req.params.id } });
  if (!exists) {
    res.status(404).json({ success: false, message: 'Payment not found' });
    return;
  }
  const { invoiceId, amount, method, referenceNo, receivedAt, notes } = req.body;
  const data: any = {};
  if (invoiceId !== undefined) data.invoiceId = invoiceId;
  if (amount !== undefined) data.amount = parseFloat(amount);
  if (method !== undefined) data.method = method;
  if (referenceNo !== undefined) data.referenceNo = referenceNo;
  if (receivedAt !== undefined) data.receivedAt = new Date(receivedAt);
  if (notes !== undefined) data.notes = notes;

  const payment = await prisma.paymentEntry.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: payment });
});
export const deletePayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const exists = await prisma.paymentEntry.findUnique({ where: { id: req.params.id } });
  if (!exists) {
    res.status(404).json({ success: false, message: 'Payment not found' });
    return;
  }
  await prisma.paymentEntry.delete({ where: { id: req.params.id } });
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
  const targets = await prisma.target.findMany({
    where: { organizationId: req.user.organizationId },
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
  const mapped = targets.map(t => ({
    ...t,
    employeeId: t.employee || t.employeeId
  }));
  res.json({ success: true, count: mapped.length, data: mapped });
});
export const getTarget = asyncHandler(async (req: AuthRequest, res: Response) => {
  const target = await prisma.target.findUnique({
    where: { id: req.params.id },
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
  const newTarget = await prisma.target.create({
    data: {
      organizationId: req.user.organizationId,
      employeeId,
      type,
      period,
      target: parseFloat(target),
      achieved: achieved !== undefined ? parseFloat(achieved) : 0,
      incentive: incentive !== undefined && incentive !== '' ? parseFloat(incentive) : null,
      deadline: deadline ? new Date(deadline) : null
    },
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
      status: 'pending_payment' as any,
      ...(isFinanceAssignee ? { assignedFinanceUserId: req.user.id } : {}),
    },
    include: {
      verifier: { select: { id: true, name: true, email: true } },
      assignedFinanceUser: { select: { id: true, name: true, role: true } },
    },
    orderBy: { updatedAt: 'asc' }
  });
  const result = await Promise.all(centers.map(async center => {
    const universities = await prisma.university.findMany({
      where: { id: { in: center.universityIds || [] }, organizationId: req.user.organizationId },
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
      status: 'pending_payment' as any,
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
    where: { id: req.params.id, organizationId: req.user.organizationId, status: 'pending_payment' as any }
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
  const center = await prisma.studyCenter.update({
    where: { id: req.params.id },
    data: {
      status: action === 'approve' ? 'active' as any : 'rejected' as any,
      financeApprovedBy: action === 'approve' ? req.user.id : undefined,
      financeApprovedAt: action === 'approve' ? new Date() : undefined,
      paymentRemarks: remarks?.trim() || null
    }
  });
  res.json({ success: true, data: center });
});

export const createStudyCenter = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, code, email, contact, referredById, ...rest } = req.body;
  const linkedUniversityIds = req.user.universityId
    ? [req.user.universityId]
    : (Array.isArray(req.body.universityIds) ? req.body.universityIds : []);
  
  const rawPassword = 'admin123';
  const hashedPassword = await hashPassword(rawPassword);
  const userId = await generateStudyCenterUserId(req.user.organizationId);

  const center = await prisma.studyCenter.create({
    data: {
      ...rest,
      name,
      code,
      email,
      contact,
      organizationId: req.user.organizationId,
      status: 'active' as any,
      financeApprovedBy: req.user.id,
      financeApprovedAt: new Date(),
      referredBy: referredById || null,
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
      email: email || `admin.${code}@example.com`,
      password: hashedPassword,
      name: `${name} Admin`,
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
  const screenshot = req.file ? `/uploads/${req.file.filename}` : undefined;

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

  res.json({ success: true, data: updated });
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
      studyCenter: { select: { id: true, name: true, branchName: true, coordinatorName: true } },
      payment: true,
      commissionIn: {
        include: {
          commissionOuts: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
  });

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
    const feeStruct =
      feeStructures.find(f => f.programId === enrollment.programId && f.admissionSessionId === enrollment.sessionId) ||
      feeStructures.find(f => f.programId === enrollment.programId && !f.admissionSessionId);

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
      }

      return {
        id: enrollment.id,
        studentName: enrollment.studentName,
        enrollmentNumber: enrollment.enrollmentNumber,
        uniEnrollmentNumber: enrollment.uniEnrollmentNumber,
        admissionDate: enrollment.admissionDate || enrollment.createdAt,
        admissionSession: enrollment.session?.name || '',
        centerName: enrollment.studyCenter?.name || '',
        subCenterName: enrollment.studyCenter?.branchName || '',
        program: enrollment.program?.name || '',
        university: (feeStruct?.university?.name || (enrollment.program as any)?.university?.name) || '',
        centerPaymentAmount,
        centerPaymentStatus,
        centerPaymentFor: enrollment.status || '',
      universityPaymentAmount: uniPayments.length > 0 ? totalUniAmount : null,
      universityPaidAmount: uniPayments.length > 0 ? paidUniAmount : 0,
      universityPaymentStatus: uniStatus,
      universityPaymentScreenshots: uniPayments.map(p => p.screenshot).filter(Boolean),
      coordinatorName: enrollment.studyCenter?.coordinatorName || feeStruct?.university?.coordinatorName || (enrollment.program as any)?.university?.coordinatorName || coordinatorFee?.coordinator || null,
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

// ─── Re-Reg Pending Report ────────────────────────────────────────────────────
export const getReregPendingReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { centerId, universityId, programId, search, dueDate } = req.query as any;
  const orgId = req.user.organizationId;
  
  let actualCenterId = centerId;
  if (req.user.role === 'center_admin') {
    actualCenterId = (req.user as any).studyCenterId || (req.user as any).centerId;
  }

  // Build program filter
  let programFilter: any = {};
  if (programId) programFilter.programId = programId;
  if (universityId) {
    // Filter via program's university
    const progIds = (await prisma.program.findMany({
      where: { organizationId: orgId, universityId },
      select: { id: true },
    })).map(p => p.id);
    programFilter.programId = programId ? (progIds.includes(programId) ? programId : '__none__') : { in: progIds };
  }

  // Find all enrollments matching filters
  const enrollments = await prisma.enrollment.findMany({
    where: {
      organizationId: orgId,
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
      session: { select: { id: true, name: true } },
      studyCenter: { select: { id: true, name: true, branchName: true } },
      student: { select: { id: true, createdAt: true, enrolledAt: true, invoices: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Pre-fetch all fee structures for this organization to avoid N+1 queries
  const feeStructures = await prisma.programFeeStructure.findMany({
    where: { organizationId: orgId }
  });

  const rows: any[] = [];

  for (const e of enrollments) {
    if (!e.student) continue;

    const sessionId = e.sessionId || null;
    
    // Find candidate fee structures
    const candidates = feeStructures.filter((c: any) => 
      (c.programId === e.programId) ||
      (c.level === 'university' && c.universityId === (e.program as any).university?.id)
    );

    // Rank candidate fee structures
    const sorted = candidates.map(c => {
      let score = 0;
      if (c.level === 'program' && c.programId === e.programId) {
        if (c.admissionSessionId === sessionId) score = 100;
        else if (c.admissionSessionId === null) score = 80;
        else score = 60;
      } else if (c.level === 'university' && c.universityId === (e.program as any).university?.id) {
        if (c.admissionSessionId === sessionId) score = 40;
        else if (c.admissionSessionId === null) score = 20;
        else score = 10;
      }
      return { c, score };
    }).sort((a, b) => b.score - a.score);

    const feeStructure = sorted[0]?.c;
    if (!feeStructure) continue;

    let breakdownArray: any[] = [];
    if (feeStructure.feeBreakdown) {
      if (typeof feeStructure.feeBreakdown === 'string') {
        try { breakdownArray = JSON.parse(feeStructure.feeBreakdown); } catch (err) {}
      } else if (Array.isArray(feeStructure.feeBreakdown)) {
        breakdownArray = feeStructure.feeBreakdown;
      }
    }

    if (breakdownArray.length === 0) continue;

    const billingCycle = feeStructure.billingCycle;
    let cycleLabel = 'Installment';
    if (billingCycle === 'per_semester') cycleLabel = 'Semester';
    else if (billingCycle === 'per_year' || billingCycle === 'yearly') cycleLabel = 'Year';

    const invoices = e.student.invoices || [];

    let nextUnpaidDate: Date | null = null;
    let nextUnpaidName = '';

    // Find the next UNPAID installment, starting from the 2nd installment (i = 1)
    // The 1st installment (i = 0) is paid during initial enrollment, so it is not a "Re-Registration".
    for (let i = 1; i < breakdownArray.length; i++) {
      const b = breakdownArray[i];
      const name = `${cycleLabel} ${b.year || i + 1}`;
      
      const isPaid = invoices.some((inv: any) => {
        const items = Array.isArray(inv.items) ? inv.items : JSON.parse(typeof inv.items === 'string' ? inv.items : '[]');
        return inv.status === 'paid' && items.some((item: any) => item.description?.toLowerCase().includes(name.toLowerCase()));
      });

      if (!isPaid) {
        // This is the next unpaid installment (i > 0)
        nextUnpaidName = name;
        if (b.dueDate) {
          nextUnpaidDate = new Date(b.dueDate);
        } else {
          nextUnpaidDate = new Date(e.student.enrolledAt || e.student.createdAt);
          if (cycleLabel === 'Semester') nextUnpaidDate.setMonth(nextUnpaidDate.getMonth() + i * 6);
          else nextUnpaidDate.setFullYear(nextUnpaidDate.getFullYear() + i);
        }
        break; // Stop at the first unpaid installment
      }
    }

    if (nextUnpaidName && nextUnpaidDate) {
      if (dueDate) {
        const filterDate = new Date(dueDate);
        filterDate.setHours(23, 59, 59, 999);
        if (nextUnpaidDate > filterDate) {
          continue;
        }
      }

      const daysUntilDeadline = Math.ceil((nextUnpaidDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));


      const closingDate = nextUnpaidDate.toISOString();
      const sessionStr = e.session?.name ? `${e.session.name} - ${nextUnpaidName}` : nextUnpaidName;
      rows.push({
        id: e.id,
        studentName: e.studentName,
        studentEmail: e.studentEmail,
        studentPhone: e.studentPhone,
        enrollmentNumber: e.enrollmentNumber || '',
        program: e.program?.name || '',
        university: (e.program as any)?.university?.name || '',
        center: e.studyCenter?.name || '',
        branchName: e.studyCenter?.branchName || '',
        session: sessionStr,
        reregClosingDate: closingDate,
        reregPaymentStatus: 'Pending',
        enrollmentStatus: e.status,
        daysUntilDeadline,
      });
    }
  }

  res.json({ success: true, count: rows.length, data: rows });
});

// ─── Re-Reg Completed Report ──────────────────────────────────────────────────
export const getReregCompletedReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { centerId, universityId, programId, search } = req.query as any;
  const orgId = req.user.organizationId;
  
  let actualCenterId = centerId;
  if (req.user.role === 'center_admin') {
    actualCenterId = (req.user as any).studyCenterId || (req.user as any).centerId;
  }

  // Build program filter
  let programFilter: any = {};
  if (programId) programFilter.programId = programId;
  if (universityId) {
    const progIds = (await prisma.program.findMany({
      where: { organizationId: orgId, universityId },
      select: { id: true },
    })).map(p => p.id);
    programFilter.programId = programId ? (progIds.includes(programId) ? programId : '__none__') : { in: progIds };
  }

  // Find all enrollments matching filters
  const enrollments = await prisma.enrollment.findMany({
    where: {
      organizationId: orgId,
      ...(actualCenterId && { studyCenterId: actualCenterId }),
      ...programFilter,
      ...(search && {
        OR: [
          { studentName: { contains: search, mode: 'insensitive' } },
          { studentEmail: { contains: search, mode: 'insensitive' } },
          { enrollmentNumber: { contains: search, mode: 'insensitive' } },
        ]
      })
    },
    include: {
      program: {
        select: { id: true, name: true, duration: true, university: { select: { id: true, name: true } } }
      },
      session: { select: { id: true, name: true } },
      studyCenter: { select: { id: true, name: true, branchName: true } },
      student: { 
        select: { 
          id: true, createdAt: true, enrolledAt: true, status: true, email: true, name: true,
          invoices: {
            where: { status: 'paid' }
          }
        } 
      },
    }
  });

  const rows: any[] = [];
  
  for (const e of enrollments) {
    if (!e.student || !e.student.invoices || e.student.invoices.length === 0) continue;

    const invoices = e.student.invoices;

    for (const inv of invoices) {
      let items: any[] = [];
      if (typeof inv.items === 'string') {
        try { items = JSON.parse(inv.items); } catch(err) {}
      } else if (Array.isArray(inv.items)) {
        items = inv.items;
      }

      // Find items that represent a re-registration payment
      // e.g., "Semester 2", "Year 2", etc. (excluding Semester 1/Year 1)
      const reregItems = items.filter(item => {
        const desc = (item.description || '').toLowerCase();
        return (desc.includes('semester') || desc.includes('year')) && 
               !desc.includes('semester 1') && !desc.includes('year 1');
      });

      if (reregItems.length > 0) {
        for (const item of reregItems) {
          // Try to extract just the "Semester X" or "Year X" part
          const match = item.description?.match(/(Semester|Year)\s+\d+/i);
          const installmentName = match ? match[0] : item.description;

          rows.push({
            id: `${e.id}-${inv.id}-${item.id || Math.random()}`,
            studentName: e.studentName,
            studentEmail: e.studentEmail,
            studentPhone: e.studentPhone,
            enrollmentNumber: e.enrollmentNumber || '',
            program: e.program?.name || '',
            university: (e.program as any)?.university?.name || '',
            center: e.studyCenter?.name || '',
            branchName: e.studyCenter?.branchName || '',
            session: e.session?.name || '',
            completedInstallment: installmentName,
            paidDate: inv.createdAt,
            amountPaid: item.amount || inv.amount,
            invoiceId: inv.id
          });
        }
      }
    }
  }

  // Sort rows by paidDate descending (newest first)
  rows.sort((a, b) => new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime());

  res.json({ success: true, count: rows.length, data: rows });
});
