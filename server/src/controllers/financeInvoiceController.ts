// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  generateInvoiceForEnrollment,
  recalculateInvoiceBalance,
  recordPaymentForInvoice,
  autoGenerateMissingInvoices,
  checkOverdueInvoices,
  syncStudentFeeReceiptsToInvoices,
  syncPaidUniversityFeeInvoices
} from '../services/invoiceService.js';

/**
 * Get all invoices with filtering, search, and summary stats
 */
export const getInvoices = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status, search, financialYear, academicYear, centerId, party } = req.query;
  const organizationId = req.user.organizationId;

  await syncStudentFeeReceiptsToInvoices(organizationId);
  await syncPaidUniversityFeeInvoices(organizationId);

  // Run overdue check quietly to ensure real-time accuracy
  try {
    await checkOverdueInvoices(organizationId);
  } catch (e) {
    // Non-blocking
  }

  const where: any = { organizationId };

  if (status && status !== 'all') {
    where.status = status as string;
  }

  if (financialYear && financialYear !== 'all') {
    where.financialYear = financialYear as string;
  }

  if (academicYear && academicYear !== 'all') {
    where.academicYear = academicYear as string;
  }

  if (centerId && centerId !== 'all') {
    where.centerId = centerId as string;
  }

  if (party === 'student') {
    where.OR = [
      { studentId: { not: null } },
      { enrollmentId: { not: null } }
    ];
  } else if (party === 'study_center') {
    where.studentId = null;
    where.enrollmentId = null;
    if (!centerId || centerId === 'all') where.centerId = { not: null };
  }

  if (search && String(search).trim()) {
    const q = String(search).trim();
    const searchConditions = [
      { invoiceNo: { contains: q, mode: 'insensitive' } },
      { enrollment: { studentName: { contains: q, mode: 'insensitive' } } },
      { enrollment: { studentEmail: { contains: q, mode: 'insensitive' } } },
      { enrollment: { enrollmentNumber: { contains: q, mode: 'insensitive' } } },
      { student: { name: { contains: q, mode: 'insensitive' } } },
      { student: { enrollmentNo: { contains: q, mode: 'insensitive' } } }
    ];
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchConditions }];
      delete where.OR;
    } else {
      where.OR = searchConditions;
    }
  }

  const [invoices, allInvoicesForSummary] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        center: { select: { id: true, name: true, code: true } },
        student: { select: { id: true, name: true, enrollmentNo: true, email: true, phone: true } },
        enrollment: {
          select: {
            id: true,
            enrollmentNumber: true,
            uniEnrollmentNumber: true,
            studentName: true,
            studentEmail: true,
            studentPhone: true,
            status: true,
            program: { select: { id: true, name: true, code: true } },
            session: { select: { id: true, name: true } },
            studyCenter: { select: { id: true, name: true, code: true } }
          }
        },
        payments: {
          orderBy: { receivedAt: 'desc' },
          include: {
            receiver: { select: { id: true, name: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.invoice.findMany({
      where: { organizationId },
      select: {
        id: true,
        total: true,
        paidAmount: true,
        balanceAmount: true,
        status: true
      }
    })
  ]);

  // Compute summary stats across all organization invoices
  const summary = {
    totalInvoiced: 0,
    totalPaid: 0,
    totalBalance: 0,
    totalOverdue: 0,
    counts: {
      all: allInvoicesForSummary.length,
      unpaid: 0,
      partially_paid: 0,
      paid: 0,
      overdue: 0,
      cancelled: 0
    }
  };

  allInvoicesForSummary.forEach(inv => {
    summary.totalInvoiced += Number(inv.total || 0);
    summary.totalPaid += Number(inv.paidAmount || 0);
    summary.totalBalance += Number(inv.balanceAmount || 0);

    if (inv.status === 'overdue') {
      summary.totalOverdue += Number(inv.balanceAmount || 0);
      summary.counts.overdue += 1;
    } else if (inv.status === 'paid') {
      summary.counts.paid += 1;
    } else if (inv.status === 'partially_paid') {
      summary.counts.partially_paid += 1;
    } else if (inv.status === 'unpaid') {
      summary.counts.unpaid += 1;
    } else if (inv.status === 'cancelled') {
      summary.counts.cancelled += 1;
    }
  });

  res.json({
    success: true,
    count: invoices.length,
    data: invoices,
    summary
  });
});

/**
 * Get single invoice with full details
 */
export const getInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  await syncStudentFeeReceiptsToInvoices(req.user.organizationId);
  await syncPaidUniversityFeeInvoices(req.user.organizationId);

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user.organizationId
    },
    include: {
      center: true,
      student: true,
      enrollment: {
        include: {
          program: { include: { university: true } },
          session: true,
          studyCenter: true
        }
      },
      payments: {
        orderBy: { receivedAt: 'desc' },
        include: { receiver: { select: { id: true, name: true, email: true } } }
      }
    }
  });

  if (!invoice) {
    res.status(404).json({ success: false, message: 'Invoice not found' });
    return;
  }

  res.json({ success: true, data: invoice });
});

/**
 * Record a payment against an invoice and generate receipt
 */
export const recordInvoicePayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { amount, method, referenceNo, notes, receivedAt } = req.body;

  if (!amount || Number(amount) <= 0) {
    res.status(400).json({ success: false, message: 'Valid payment amount is required' });
    return;
  }

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user.organizationId
    }
  });

  if (!invoice) {
    res.status(404).json({ success: false, message: 'Invoice not found' });
    return;
  }

  const result = await recordPaymentForInvoice(invoice.id, {
    amount: Number(amount),
    method: method || 'NetBanking / UPI',
    referenceNo,
    receivedBy: req.user.id,
    notes,
    receivedAt: receivedAt ? new Date(receivedAt) : new Date()
  });

  res.status(201).json({
    success: true,
    message: 'Payment recorded and receipt generated successfully',
    data: result.invoice,
    payment: result.payment,
    receiptNo: result.receiptNo
  });
});

/**
 * Bulk auto-generate invoices for enrolled students without an invoice
 */
export const autoGenerateInvoices = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await autoGenerateMissingInvoices(req.user.organizationId);

  res.json({
    success: true,
    message: `Processed ${result.totalEligible} eligible enrollments: Generated ${result.generated} invoices.`,
    data: result
  });
});

/**
 * Recalculate invoice balance manually
 */
export const recalculateInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user.organizationId
    }
  });

  if (!invoice) {
    res.status(404).json({ success: false, message: 'Invoice not found' });
    return;
  }

  const updated = await recalculateInvoiceBalance(invoice.id);
  res.json({ success: true, data: updated });
});
