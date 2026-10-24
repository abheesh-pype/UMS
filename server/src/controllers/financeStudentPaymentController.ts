import { Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { randomUUID } from 'node:crypto';
import {
  generateInvoiceForEnrollment,
  generateNextReceiptNumber,
  recalculateInvoiceBalance
} from '../services/invoiceService.js';

const findLinkedInvoicePayment = async (invoiceId: string, receipt: any) => {
  const linkedPayment = await prisma.paymentEntry.findUnique({
    where: { studentFeeReceiptId: receipt.id }
  });
  if (linkedPayment) return linkedPayment;

  const possibleLegacyPayments = await prisma.paymentEntry.findMany({
    where: {
      invoiceId,
      studentFeeReceiptId: null,
      amount: Number(receipt.amount),
      method: receipt.paymentMode || 'Direct Deposit',
      referenceNo: receipt.referenceNo || null,
      receivedAt: receipt.receiptDate
    }
  });
  if (possibleLegacyPayments.length !== 1) return null;

  return prisma.paymentEntry.update({
    where: { id: possibleLegacyPayments[0].id },
    data: { studentFeeReceiptId: receipt.id }
  });
};

const syncReceiptToInvoice = async (enrollmentId: string, receipt: any) => {
  let invoice = await prisma.invoice.findFirst({
    where: { enrollmentId, organizationId: receipt.organizationId },
    orderBy: { createdAt: 'desc' }
  });

  if (!invoice) {
    invoice = await generateInvoiceForEnrollment(enrollmentId);
  } else {
    const linkedPayment = await findLinkedInvoicePayment(invoice.id, receipt);
    if (!linkedPayment) {
      const receiptNo = await generateNextReceiptNumber(receipt.organizationId);
      await prisma.paymentEntry.create({
        data: {
          organizationId: receipt.organizationId,
          invoiceId: invoice.id,
          studentFeeReceiptId: receipt.id,
          amount: Number(receipt.amount),
          method: receipt.paymentMode || 'Direct Deposit',
          referenceNo: receipt.referenceNo || null,
          receiptNo,
          receiptDate: receipt.receiptDate,
          receivedBy: receipt.recordedBy,
          receivedAt: receipt.receiptDate,
          notes: receipt.remarks || `Student fee receipt ${receipt.id}`
        }
      });
    }
  }

  return recalculateInvoiceBalance(invoice.id);
};

export const getStudentPaymentLogs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { search, universityId, programId, branchId } = req.query;

  let where: any = { organizationId: req.user.organizationId };

  if (search) {
    where.OR = [
      { studentName: { contains: search as string, mode: 'insensitive' } },
      { enrollmentNumber: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  if (programId && programId !== 'all') where.programId = programId as string;
  if (branchId && branchId !== 'all') where.studyCenterId = branchId as string;
  
  if (universityId && universityId !== 'all') {
    where.program = { universityId: universityId as string };
  }

  const enrollments = await prisma.enrollment.findMany({
    where,
    include: {
      program: {
        select: { 
          name: true, 
          code: true, 
          universityId: true,
          programFeeStructure: {
            select: {
              level: true,
              studyCenterId: true,
              billingCycle: true,
              admissionSessionId: true,
              organizationId: true,
            }
          }
        }
      },
      session: { select: { name: true } },
      studentFeeReceipts: {
        orderBy: { receiptDate: 'desc' }
      },
      payment: true // initial wallet payment might be relevant if considered as fee received?
    },
    orderBy: { createdAt: 'desc' }
  });

  const enrollmentIds = enrollments.map(enrollment => enrollment.id);
  const studentIds = [...new Set(enrollments.map(enrollment => enrollment.studentId).filter(Boolean))];
  const periodPayments = enrollmentIds.length > 0
    ? await prisma.universityFeePayment.findMany({
        where: {
          organizationId: req.user.organizationId,
          OR: [
            { enrollmentId: { in: enrollmentIds } },
            ...(studentIds.length > 0 ? [{ studentId: { in: studentIds } }] : [])
          ]
        },
        orderBy: { createdAt: 'asc' }
      })
    : [];
  const enrollmentCountByStudent = new Map<string, number>();
  enrollments.forEach(enrollment => {
    if (enrollment.studentId) {
      enrollmentCountByStudent.set(
        enrollment.studentId,
        (enrollmentCountByStudent.get(enrollment.studentId) || 0) + 1
      );
    }
  });

  const formattedLogs = enrollments.map(enr => {
    const extraFees = (enr.extraFees as any[]) || [];
    const totalExtraFees = extraFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
    const totalFee = (enr.totalFee || 0) + totalExtraFees;
    const studentPeriodPayments = periodPayments.filter(payment =>
      payment.enrollmentId === enr.id
      || (
        !payment.enrollmentId
        && payment.studentId === enr.studentId
        && !!enr.studentId
        && enrollmentCountByStudent.get(enr.studentId) === 1
      )
    );
    
    // Sum receipts + initial wallet payment
    const manualReceipts = enr.studentFeeReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);
    const walletPayment = enr.payment?.amount || 0;
    const totalReceived = manualReceipts + walletPayment;
    const balance = Math.max(0, totalFee - totalReceived);
    
    const status = totalFee === 0 ? 'No Fee Set' : (balance <= 0 ? 'Paid' : (totalReceived > 0 ? 'Partial' : 'Pending'));

    return {
      id: enr.id,
      studentName: enr.studentName,
      enrollmentNumber: enr.enrollmentNumber || '',
      sessionName: enr.session?.name || '',
      program: {
        ...enr.program,
        billingCycle: (
          enr.program?.programFeeStructure?.find(
            f => f.level === 'program'
              && f.studyCenterId === enr.studyCenterId
              && f.admissionSessionId === enr.sessionId
              && f.organizationId === enr.organizationId
          )
          || enr.program?.programFeeStructure?.find(
            f => f.level === 'program'
              && f.studyCenterId === enr.studyCenterId
              && !f.admissionSessionId
              && f.organizationId === enr.organizationId
          )
          || enr.program?.programFeeStructure?.find(
            f => f.level === 'program'
              && !f.studyCenterId
              && f.admissionSessionId === enr.sessionId
              && f.organizationId === enr.organizationId
          )
          || enr.program?.programFeeStructure?.find(
            f => f.level === 'program'
              && !f.studyCenterId
              && !f.admissionSessionId
              && f.organizationId === enr.organizationId
          )
        )?.billingCycle
      },
      totalFee,
      payable: totalFee,
      baseFee: enr.totalFee || 0,
      extraFees,
      received: totalReceived,
      balance,
      walletPayment: enr.payment ? {
        amount: enr.payment.amount,
        date: enr.payment.debitedAt || enr.payment.createdAt
      } : null,
      status,
      receipts: enr.studentFeeReceipts,
      periodPayments: studentPeriodPayments,
      createdAt: enr.createdAt
    };
  });

  res.json({ success: true, data: formattedLogs });
});

export const recordReceipt = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { amount, paymentMode, referenceNo, remarks, receiptDate } = req.body;

  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    res.status(400);
    throw new Error('Valid amount is required');
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id, organizationId: req.user.organizationId }
  });

  if (!enrollment) {
    res.status(404);
    throw new Error('Enrollment not found');
  }

  const receipt = await prisma.studentFeeReceipt.create({
    data: {
      organizationId: req.user.organizationId,
      enrollmentId: id,
      amount: Number(amount),
      paymentMode,
      referenceNo,
      remarks,
      receiptDate: receiptDate ? new Date(receiptDate) : new Date(),
      recordedBy: req.user.id
    }
  });

  await syncReceiptToInvoice(id, receipt);
  res.status(201).json({ success: true, data: receipt });
});

export const updateReceipt = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id, receiptId } = req.params;
  const { amount, paymentMode, referenceNo, remarks, receiptDate } = req.body;

  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    res.status(400).json({ success: false, message: 'Valid amount is required' });
    return;
  }

  const receipt = await prisma.studentFeeReceipt.findFirst({
    where: {
      id: receiptId,
      enrollmentId: id,
      organizationId: req.user.organizationId
    }
  });
  if (!receipt) {
    res.status(404).json({ success: false, message: 'Receipt not found' });
    return;
  }

  const invoice = await prisma.invoice.findFirst({
    where: { enrollmentId: id, organizationId: req.user.organizationId },
    orderBy: { createdAt: 'desc' }
  });
  const payment = invoice ? await findLinkedInvoicePayment(invoice.id, receipt) : null;
  const updatedReceipt = await prisma.studentFeeReceipt.update({
    where: { id: receipt.id },
    data: {
      amount: Number(amount),
      paymentMode: paymentMode || receipt.paymentMode,
      referenceNo: referenceNo || null,
      remarks: remarks || null,
      receiptDate: receiptDate ? new Date(receiptDate) : receipt.receiptDate
    }
  });

  if (payment) {
    await prisma.paymentEntry.update({
      where: { id: payment.id },
      data: {
        amount: Number(amount),
        method: updatedReceipt.paymentMode,
        referenceNo: updatedReceipt.referenceNo,
        receiptDate: updatedReceipt.receiptDate,
        receivedAt: updatedReceipt.receiptDate,
        notes: updatedReceipt.remarks || `Student fee receipt ${updatedReceipt.id}`
      }
    });
  }
  await syncReceiptToInvoice(id, updatedReceipt);

  res.json({ success: true, data: updatedReceipt });
});

export const deleteReceipt = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id, receiptId } = req.params;
  const receipt = await prisma.studentFeeReceipt.findFirst({
    where: {
      id: receiptId,
      enrollmentId: id,
      organizationId: req.user.organizationId
    }
  });
  if (!receipt) {
    res.status(404).json({ success: false, message: 'Receipt not found' });
    return;
  }

  const invoice = await prisma.invoice.findFirst({
    where: { enrollmentId: id, organizationId: req.user.organizationId },
    orderBy: { createdAt: 'desc' }
  });
  if (invoice) {
    const payment = await findLinkedInvoicePayment(invoice.id, receipt);
    if (payment) {
      await prisma.paymentEntry.delete({ where: { id: payment.id } });
    }
  }
  await prisma.studentFeeReceipt.delete({ where: { id: receipt.id } });
  if (invoice) await recalculateInvoiceBalance(invoice.id);

  res.json({ success: true, message: 'Receipt deleted successfully' });
});

export const addExtraFee = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { amount, reason } = req.body;

  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    res.status(400);
    throw new Error('Valid amount is required');
  }
  if (typeof reason !== 'string' || !reason.trim()) {
    res.status(400);
    throw new Error('Reason is required');
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id, organizationId: req.user.organizationId }
  });

  if (!enrollment) {
    res.status(404);
    throw new Error('Enrollment not found');
  }

  const currentExtraFees = (enrollment.extraFees as any[]) || [];
  const updatedExtraFees = [
    ...currentExtraFees, 
    { id: randomUUID(), amount: Number(amount), reason: reason.trim(), date: new Date().toISOString() }
  ];

  await prisma.enrollment.update({
    where: { id },
    data: { extraFees: updatedExtraFees }
  });

  let invoice = await prisma.invoice.findFirst({
    where: { enrollmentId: id, organizationId: req.user.organizationId },
    orderBy: { createdAt: 'desc' }
  });
  if (!invoice) {
    invoice = await generateInvoiceForEnrollment(id);
  } else {
    const items = Array.isArray(invoice.items) ? invoice.items as any[] : [];
    const existingExtraItems = items.filter(item => item.category === 'extra_fee');
    const baseAmount = Number(invoice.amount) - existingExtraItems.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );
    const extraItems = updatedExtraFees.map((fee: any, index: number) => ({
      description: fee.reason || 'Additional Fee',
      category: 'extra_fee',
      quantity: 1,
      rate: Number(fee.amount) || 0,
      taxRate: Number((invoice.taxDetails as any)?.taxRatePercent || 0),
      amount: Number(fee.amount) || 0,
      extraFeeId: fee.id || `legacy-extra-fee-${index}`
    }));
    const nextItems = [...items.filter(item => item.category !== 'extra_fee'), ...extraItems];
    const nextAmount = baseAmount + extraItems.reduce((sum, item) => sum + item.amount, 0);
    const taxRate = Number((invoice.taxDetails as any)?.taxRatePercent || 0);
    const nextTax = taxRate > 0 ? Math.round(nextAmount * taxRate / 100) : Number(invoice.tax || 0);
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        items: nextItems,
        amount: nextAmount,
        tax: nextTax,
        total: nextAmount + nextTax
      }
    });
    await recalculateInvoiceBalance(invoice.id);
  }

  res.json({ success: true, message: 'Extra fee added successfully' });
});
