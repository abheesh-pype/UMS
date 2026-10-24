// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import bcrypt from 'bcryptjs';
import { activateStudentPortalAccount, getStudentPortalPassword } from '../utils/studentPortalAccess.js';
import { generateInvoiceForEnrollment } from '../services/invoiceService.js';

const FINANCE_VISIBLE_ENROLLMENT_STATUSES = [
  'pending_finance_review',
  'finance_review',
  'enrolled',
  'rejected',
  'finance_rejected',
];

const hasEnrollmentPaymentProof = (documents: unknown) => {
  let parsedDocuments = documents;
  if (typeof parsedDocuments === 'string') {
    try {
      parsedDocuments = JSON.parse(parsedDocuments);
    } catch {
      return false;
    }
  }
  if (!Array.isArray(parsedDocuments)) return false;
  return parsedDocuments.some((document: any) => {
    if (typeof document?.url !== 'string' || !document.url.trim()) return false;
    const label = `${document.reqName || ''} ${document.name || ''}`.toLowerCase();
    return label.includes('payment proof') || label.includes('payment receipt');
  });
};

const getAllEnrollmentsHandler = async (req: AuthRequest, res: Response, financeQueueOnly = false) => {
  const { status, search } = req.query;
  const where: any = { organizationId: req.user.organizationId };

  if (financeQueueOnly) {
    where.status = { in: FINANCE_VISIBLE_ENROLLMENT_STATUSES };
  }

  if (status) {
    let statuses: string[] | null = null;
    if (status === 'rejected') {
      statuses = ['rejected', 'finance_rejected', 'department_rejected', 'ops_rejected'];
    } else if (status === 'pending_finance_review' || status === 'finance_review') {
      statuses = ['pending_finance_review', 'finance_review'];
    } else if (status === 'document_review' || status === 'pending_doc_review') {
      statuses = ['document_review', 'pending_doc_review'];
    } else {
      statuses = [status as string];
    }

    if (financeQueueOnly) {
      statuses = statuses.filter(value => FINANCE_VISIBLE_ENROLLMENT_STATUSES.includes(value));
    }
    where.status = { in: statuses };
  }

  // Regular employees only see enrollments assigned to them
  if (req.user.role === 'employee') {
    where.assignedFinanceUserId = req.user.id;
  }

  if (search) {
    where.OR = [
      { studentName: { contains: search as string, mode: 'insensitive' } },
      { studentEmail: { contains: search as string, mode: 'insensitive' } },
      { studentPhone: { contains: search as string, mode: 'insensitive' } },
      { enrollmentNumber: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const summaryWhere: any = { organizationId: req.user.organizationId };
  if (financeQueueOnly) {
    summaryWhere.status = { in: FINANCE_VISIBLE_ENROLLMENT_STATUSES };
  }
  if (req.user.role === 'employee') {
    summaryWhere.assignedFinanceUserId = req.user.id;
  }

  const [enrollments, allEnrollmentsForSummary] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      include: {
        program: { select: { name: true, code: true } },
        studyCenter: { select: { name: true, code: true } },
        payment: true,
        assignedFinanceUser: { select: { id: true, name: true, email: true, role: true } },
        assignedOpsUser: { select: { id: true, name: true, email: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.enrollment.findMany({
      where: summaryWhere,
      select: { status: true }
    })
  ]);

  // Compute summary counts
  const summary = {
    payment_pending: 0,
    document_review: 0,
    pending_finance_review: 0,
    enrolled: 0,
    rejected: 0,
    department_rejected: 0
  };

  allEnrollmentsForSummary.forEach(e => {
    if (e.status === 'payment_pending') summary.payment_pending++;
    else if (e.status === 'document_review' || e.status === 'pending_doc_review') summary.document_review++;
    else if (e.status === 'pending_finance_review' || e.status === 'finance_review') summary.pending_finance_review++;
    else if (e.status === 'enrolled') summary.enrolled++;
    else if (e.status === 'rejected' || e.status === 'finance_rejected') summary.rejected++;
    else if (e.status === 'department_rejected' || e.status === 'ops_rejected') summary.department_rejected++;
  });

  const data = enrollments.map(({ publicTrackingTokenHash, ...enrollment }) => ({
    ...enrollment,
    isDirectStudentApplication: Boolean(publicTrackingTokenHash),
  }));
  res.status(200).json({ success: true, count: data.length, data, summary });
};

export const getAllEnrollments = asyncHandler(async (req: AuthRequest, res: Response) => {
  await getAllEnrollmentsHandler(req, res);
});

export const getFinanceAllEnrollments = asyncHandler(async (req: AuthRequest, res: Response) => {
  await getAllEnrollmentsHandler(req, res, true);
});

export const getFinanceEnrollments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const where: any = { organizationId: req.user.organizationId, status: { in: ['pending_finance_review', 'finance_review'] } };
  if (req.user.role === 'employee') {
    where.assignedFinanceUserId = req.user.id;
  }

  const enrollments = await prisma.enrollment.findMany({
    where,
    include: {
      program: true,
      studyCenter: true,
      payment: true,
      assignedFinanceUser: { select: { id: true, name: true, email: true, role: true } },
      assignedOpsUser: { select: { id: true, name: true, email: true, role: true } }
    },
    orderBy: { createdAt: 'asc' }
  });
  res.json({ success: true, count: enrollments.length, data: enrollments });
});

export const assignFinanceEnrollment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { assignedFinanceUserId } = req.body;
  const financeEnrollment = await prisma.enrollment.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user.organizationId,
      status: { in: ['pending_finance_review', 'finance_review'] },
    },
    select: { id: true },
  });
  if (!financeEnrollment) {
    res.status(404).json({ success: false, message: 'Finance-review enrollment not found' });
    return;
  }

  if (assignedFinanceUserId) {
    const targetUser = await prisma.user.findFirst({
      where: { id: assignedFinanceUserId, organizationId: req.user.organizationId }
    });
    if (!targetUser) {
      res.status(404).json({ success: false, message: 'Assignee not found in organization' });
      return;
    }
  }

  const enrollment = await prisma.enrollment.update({
    where: { id: req.params.id },
    data: {
      assignedFinanceUserId: assignedFinanceUserId || null
    },
    include: {
      assignedFinanceUser: { select: { id: true, name: true, email: true, role: true } },
      program: true
    }
  });

  if (assignedFinanceUserId) {
    try {
      await prisma.notification.create({
        data: {
          organizationId: req.user.organizationId,
          userId: assignedFinanceUserId,
          title: '💰 Finance Enrollment Review Assigned',
          message: `You have been assigned to verify fee & enrollment for ${enrollment.studentName} (${enrollment.program?.name || 'Program'}).`,
          type: 'general',
          priority: 'medium',
          link: 'enrollments_finance'
        }
      });
    } catch (notifErr) {
      console.error('Notification dispatch failed:', notifErr);
    }
  }

  res.json({ success: true, data: enrollment });
});

export const approveFinanceEnrollment = asyncHandler(async (req: AuthRequest, res: Response) => {
  // 1. Fetch enrollment details first to inspect program and studyCenterId
  const dbEnrollment = await prisma.enrollment.findUnique({
    where: { id: req.params.id },
    include: { program: { include: { university: true } } }
  });

  if (!dbEnrollment || dbEnrollment.organizationId !== req.user.organizationId) {
    res.status(404).json({ success: false, message: 'Enrollment not found' });
    return;
  }
  if (!['pending_finance_review', 'finance_review'].includes(dbEnrollment.status)) {
    res.status(409).json({ success: false, message: 'Enrollment must be approved by Operations before Finance can approve it' });
    return;
  }
  const findFeeForScope = async (
    level: string,
    scope: Record<string, string | null>,
    sessionId: string | null | 'any',
  ) => prisma.programFeeStructure.findFirst({
    where: {
      organizationId: req.user.organizationId,
      level,
      ...scope,
      ...(sessionId === 'any' ? {} : { admissionSessionId: sessionId }),
    },
  });

  const findFeeForSessions = async (level: string, scope: Record<string, string | null>) => (
    await findFeeForScope(level, scope, dbEnrollment.sessionId)
    || await findFeeForScope(level, scope, null)
    || await findFeeForScope(level, scope, 'any')
  );

  // Use the selected centre's own pricing before any legacy shared fee.
  let feeStructure = dbEnrollment.studyCenterId
    ? await findFeeForSessions('program', {
        programId: dbEnrollment.programId,
        studyCenterId: dbEnrollment.studyCenterId,
      })
    : null;

  if (!feeStructure) {
    feeStructure = await findFeeForSessions('program', {
      programId: dbEnrollment.programId,
      studyCenterId: null,
    });
  }

  // A university-scoped configuration is independent of centre pricing.
  if (!feeStructure && !dbEnrollment.studyCenterId && dbEnrollment.program?.universityId) {
    feeStructure = await findFeeForSessions('university', {
      programId: dbEnrollment.programId,
      universityId: dbEnrollment.program.universityId,
      studyCenterId: null,
    });
  }

  if (!feeStructure && !dbEnrollment.studyCenterId && dbEnrollment.program?.universityId) {
    feeStructure = await findFeeForSessions('university', {
      programId: null,
      universityId: dbEnrollment.program.universityId,
      studyCenterId: null,
    });
  }

  if (!feeStructure) {
    res.status(400).json({
      success: false,
      message: dbEnrollment.studyCenterId
        ? 'No fee structure is configured for this study centre and program. Configure the centre fee before approving the enrollment.'
        : 'No fee structure is configured for this program or its university. Please configure a program or university fee before approving the enrollment.'
    });
    return;
  }

  const existingStudent = await prisma.student.findUnique({
    where: { email: dbEnrollment.studentEmail },
    select: { dob: true },
  });
  const dobPassword = getStudentPortalPassword(dbEnrollment.dob)
    || getStudentPortalPassword(existingStudent?.dob);
  if (!dobPassword) {
    res.status(400).json({
      success: false,
      message: 'A valid date of birth in YYYY-MM-DD format is required before approving the enrollment',
    });
    return;
  }
  const studentPasswordHash = await bcrypt.hash(dobPassword, 12);

  // Calculate total fee
  const addFees = Array.isArray(feeStructure.additionalFees) ? feeStructure.additionalFees : [];
  const nonGstFees = addFees.filter((f: any) => f.label !== 'GST');
  const additionalFeesTotal = nonGstFees.reduce((s: number, f: any) => s + f.amount, 0);

  let breakdowns = (feeStructure as any).feeBreakdown;
  if (typeof breakdowns === 'string') {
    try { breakdowns = JSON.parse(breakdowns); } catch (e) { breakdowns = []; }
  }

  let subtotal = 0;
  if (breakdowns && Array.isArray(breakdowns) && breakdowns.length > 0) {
    const b = breakdowns[0]; // first payment config
    let breakdownAdditionalFeesTotal = 0;
    if (typeof b.additionalFees === 'string' && b.additionalFees.trim() !== '') {
      const custom = b.additionalFees.split(',').map((s: string) => {
        const parts = s.trim().split(':');
        return Number(parts[1]) || 0;
      });
      breakdownAdditionalFeesTotal = custom.reduce((sum: number, val: number) => sum + val, 0);
    }
    subtotal = Number(b.baseFee || 0) + Number(b.examFee || 0) + additionalFeesTotal + breakdownAdditionalFeesTotal;
  } else {
    subtotal = feeStructure.baseFee + additionalFeesTotal;
  }

  const gstEntry = addFees.find((f: any) => f.label === 'GST');
  const gstAmount = gstEntry ? Math.round((subtotal * gstEntry.amount) / 100) : 0;

  // Use the totalFee calculated at enrollment time (which respects paymentMethod), or fallback
  const totalFee = (dbEnrollment as any).totalFee || (subtotal + gstAmount);
  if (totalFee > 0 && !hasEnrollmentPaymentProof(dbEnrollment.documents)) {
    res.status(400).json({ success: false, message: 'Payment proof must be submitted before Finance can give final approval' });
    return;
  }

  // 3. Perform final updates and create student inside a transaction
  const enrollment = await prisma.$transaction(async (tx) => {

    // Create/find User
    let user = await tx.user.findUnique({ where: { email: dbEnrollment.studentEmail } });
    if (!user) {
      const userId = `STD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      user = await tx.user.create({
        data: {
          userId,
          email: dbEnrollment.studentEmail,
          password: studentPasswordHash,
          name: dbEnrollment.studentName,
          role: 'student',
          organizationId: req.user.organizationId,
          status: 'inactive'
        }
      });
    }

    // Generate a fresh unique enrollment number for this enrollment record
    // Always generate new to avoid unique constraint conflicts when a student re-enrolls
    const enrollmentNo = `ENR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Find or create Student
    let student = await tx.student.findUnique({ where: { email: dbEnrollment.studentEmail } });
    if (!student) {
      student = await tx.student.create({
        data: {
          name: dbEnrollment.studentName,
          enrollmentNo,
          phone: dbEnrollment.studentPhone,
          address: dbEnrollment.studentAddress,
          specialisation: dbEnrollment.specialisation,
          sessionId: dbEnrollment.sessionId,
          abcId: dbEnrollment.abcId,
          debId: dbEnrollment.debId,
          dob: dobPassword,
          religion: dbEnrollment.religion,
          caste: dbEnrollment.caste,
          fatherName: dbEnrollment.fatherName,
          motherName: dbEnrollment.motherName,
          parentMobile: dbEnrollment.parentMobile,
          studentPhoto: dbEnrollment.studentPhoto,
          pincode: dbEnrollment.pincode,
          alternativePhone: dbEnrollment.alternativePhone,
          maritalStatus: dbEnrollment.maritalStatus,
          currentlyWorking: dbEnrollment.currentlyWorking,
          status: 'pending',
          sessionId: dbEnrollment.sessionId,
          enrolledAt: new Date(),
          organization: { connect: { id: req.user.organizationId } },
          center: dbEnrollment.studyCenterId ? { connect: { id: dbEnrollment.studyCenterId } } : undefined,
          user: { connect: { email: dbEnrollment.studentEmail } },
          program: { connect: { id: dbEnrollment.programId } }
        }
      });
    } else {
      // Sync fields in case they were updated during the review process
      const updateData: any = {
        status: 'pending',
        name: dbEnrollment.studentName,
        phone: dbEnrollment.studentPhone,
        address: dbEnrollment.studentAddress,
        specialisation: dbEnrollment.specialisation,
        abcId: dbEnrollment.abcId,
        debId: dbEnrollment.debId,
        dob: dobPassword,
        religion: dbEnrollment.religion,
        caste: dbEnrollment.caste,
        fatherName: dbEnrollment.fatherName,
        motherName: dbEnrollment.motherName,
        parentMobile: dbEnrollment.parentMobile,
        studentPhoto: dbEnrollment.studentPhoto,
        pincode: dbEnrollment.pincode,
        alternativePhone: dbEnrollment.alternativePhone,
        maritalStatus: dbEnrollment.maritalStatus,
        currentlyWorking: dbEnrollment.currentlyWorking,
        sessionId: dbEnrollment.sessionId
      };
      if (!student.enrolledAt) {
        updateData.enrolledAt = new Date();
      }
      student = await tx.student.update({
        where: { id: student.id },
        data: updateData
      });
    }

    student = await tx.student.update({
      where: { id: student.id },
      data: { status: 'active' },
    });
    await activateStudentPortalAccount(tx, {
      email: student.email,
      name: student.name,
      organizationId: student.organizationId,
    }, studentPasswordHash);

    // Link enrollment to student
    const updatedEnrollment = await tx.enrollment.update({
      where: { id: dbEnrollment.id },
      data: {
        status: 'enrolled' as any,
        financeReviewer: { connect: { id: req.user.id } },
        financeReviewedAt: new Date(),
        student: { connect: { id: student.id } },
        enrollmentNumber: enrollmentNo
      },
      include: { program: { include: { university: true } } }
    });
    return updatedEnrollment;
  });

  // Use dbEnrollment (pre-transaction) which already has university included
  const uniCategory = (dbEnrollment as any).program?.university?.category;
  const NO_WALLET_CATEGORIES = ['direct_iits', 'team_lease'];
  const isDirectToUni = dbEnrollment.paymentType === 'direct_to_university' || NO_WALLET_CATEGORIES.includes(uniCategory);

  // Automatically calculate and create expected CommissionIn
  if ((feeStructure.commissionRate && feeStructure.commissionRate > 0) || isDirectToUni) {
    // For no-wallet universities: use commissionRate if set, otherwise 0
    // This allows the admin to set a commission rate on the fee structure and have it reflected here
    const expectedAmount = (feeStructure.commissionRate && feeStructure.commissionRate > 0 && feeStructure.baseFee)
      ? (feeStructure.baseFee * feeStructure.commissionRate) / 100
      : 0;

    const existingComm = await prisma.commissionIn.findUnique({
      where: { enrollmentId: enrollment.id }
    });
    if (!existingComm) {
      await prisma.commissionIn.create({
        data: {
          organizationId: req.user.organizationId,
          enrollmentId: enrollment.id,
          expectedAmount,
          status: 'pending'
        }
      });
    }
  }

  if (enrollment.studentId && enrollment.programId) {
    const programUniversityFee = dbEnrollment.program?.universityId
      ? await findFeeForSessions('university', {
          programId: enrollment.programId,
          universityId: dbEnrollment.program.universityId,
          studyCenterId: null,
        })
      : null;
    const universityFeeStructure = programUniversityFee || (
      dbEnrollment.program?.universityId
        ? await findFeeForSessions('university', {
            programId: null,
            universityId: dbEnrollment.program.universityId,
            studyCenterId: null,
          })
        : null
    );
    const universityFeeSource = universityFeeStructure
      || (Number(feeStructure.universityFee) > 0 ? feeStructure : null);

    const existing = await prisma.universityFeePayment.findMany({
      where: { enrollmentId: enrollment.id }
    });
    if (existing.length === 0 && universityFeeSource) {
      const breakdown = Array.isArray(universityFeeSource.feeBreakdown)
        ? universityFeeSource.feeBreakdown as any[]
        : [];
      const isSemester = universityFeeSource.billingCycle === 'per_semester';

      if (breakdown.length > 0) {
        const paymentsToCreate = breakdown
          .map((cycle, index) => ({
            organizationId: req.user.organizationId,
            studentId: enrollment.studentId!,
            enrollmentId: enrollment.id,
            semesterOrYear: isSemester ? `Semester ${index + 1}` : `Year ${index + 1}`,
            amount: Number(cycle.universityFee || 0),
            status: 'pending'
          }))
          .filter(payment => payment.amount > 0);
        if (paymentsToCreate.length > 0) {
          await prisma.universityFeePayment.createMany({ data: paymentsToCreate });
        }
      } else if (universityFeeSource.universityFee > 0) {
        await prisma.universityFeePayment.create({
          data: {
            organizationId: req.user.organizationId,
            studentId: enrollment.studentId!,
            enrollmentId: enrollment.id,
            semesterOrYear: isSemester ? 'Semester 1' : 'Year 1',
            amount: universityFeeSource.universityFee,
            status: 'pending'
          }
        });
      }
    }
  }

  // Automatically generate official invoice for the newly approved enrollment
  try {
    await generateInvoiceForEnrollment(enrollment.id);
  } catch (invoiceErr) {
    console.error('Invoice generation failed during enrollment approval:', invoiceErr);
  }

  // Create notifications
  try {
    const centerAdmins = enrollment.studyCenterId ? await prisma.user.findMany({
      where: { studyCenterId: enrollment.studyCenterId, role: 'center_admin' as any }
    }) : [];
    const recipients = centerAdmins.map(a => a.id);
    if (enrollment.salesUserId) recipients.push(enrollment.salesUserId);

    // Batch create all notifications in a single DB call
    if (recipients.length > 0) {
      await prisma.notification.createMany({
        data: recipients.map(userId => ({
          organizationId: req.user.organizationId,
          userId,
          title: '🎉 Student Enrolled',
          message: `Student ${enrollment.studentName} has been successfully enrolled for ${enrollment.program.name}.`,
          type: 'general' as any,
          priority: 'high' as any,
          link: userId === enrollment.salesUserId ? 'student-applications' : 'enrollments'
        }))
      });
    }
  } catch (notifErr) { console.error('Notification dispatch failed:', notifErr); }

  res.json({ success: true, data: enrollment });
});

export const rejectFinanceEnrollment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const currentEnrollment = await prisma.enrollment.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user.organizationId,
      status: { in: ['pending_finance_review', 'finance_review'] },
    },
  });
  if (!currentEnrollment) {
    res.status(404).json({ success: false, message: 'Finance-review enrollment not found' });
    return;
  }

  const enrollment = await prisma.enrollment.update({
    where: { id: currentEnrollment.id },
    data: {
      status: 'finance_rejected' as any,
      financeReviewer: { connect: { id: req.user.id } },
      financeReviewedAt: new Date(),
      financeRemarks: req.body.remarks
    },
    include: { program: true }
  });

  // Create notifications for Operations team and Study Center
  try {
    const notificationsToCreate: any[] = [];

    // 1. Notify Operations team so they can review and resubmit from Pending Reviews
    const opsUsers = await prisma.user.findMany({
      where: {
        organizationId: req.user.organizationId,
        OR: [
          { role: { in: ['ops_admin', 'ops_sub_admin'] } as any },
          ...(enrollment.assignedOpsUserId ? [{ id: enrollment.assignedOpsUserId }] : [])
        ]
      }
    });

    opsUsers.forEach(opUser => {
      notificationsToCreate.push({
        organizationId: req.user.organizationId,
        userId: opUser.id,
        title: '⚠️ Enrollment Rejected by Finance',
        message: `Enrollment for ${enrollment.studentName} (${enrollment.program?.name}) was rejected by Finance. Reason: ${req.body.remarks || 'No remarks'}. Action required in Pending Reviews.`,
        type: 'general' as any,
        priority: 'high' as any,
        link: 'enrollment_review'
      });
    });

    // 2. Notify Study Center & Sales User
    const centerAdmins = enrollment.studyCenterId ? await prisma.user.findMany({
      where: { studyCenterId: enrollment.studyCenterId, role: 'center_admin' as any }
    }) : [];

    centerAdmins.forEach(admin => {
      notificationsToCreate.push({
        organizationId: req.user.organizationId,
        userId: admin.id,
        title: '⚠️ Enrollment Rejected by Finance',
        message: `Enrollment for ${enrollment.studentName} was rejected by Finance. Remarks: ${req.body.remarks || 'No remarks'}`,
        type: 'general' as any,
        priority: 'high' as any,
        link: 'enrollments'
      });
    });

    if (enrollment.salesUserId) {
      notificationsToCreate.push({
        organizationId: req.user.organizationId,
        userId: enrollment.salesUserId,
        title: '⚠️ Enrollment Rejected by Finance',
        message: `Enrollment for ${enrollment.studentName} was rejected by Finance. Remarks: ${req.body.remarks || 'No remarks'}`,
        type: 'general' as any,
        priority: 'high' as any,
        link: 'student-applications'
      });
    }

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({ data: notificationsToCreate });
    }
  } catch (notifErr) {
    console.error('Notification dispatch failed:', notifErr);
  }

  res.json({ success: true, data: enrollment });
});

export const processRefund = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { refundAmount, refundStatus } = req.body;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id },
    include: { payment: true }
  });

  if (!enrollment) {
    res.status(404).json({ success: false, message: 'Enrollment not found' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (refundStatus === 'processed' && enrollment.paymentType === 'wallet') {
      const amountToCredit = Number(refundAmount) || (enrollment.payment ? enrollment.payment.amount : 0);

      const wallet = await tx.studyCenterWallet.findUnique({
        where: { studyCenterId: enrollment.studyCenterId }
      });

      if (wallet && amountToCredit > 0) {
        await tx.studyCenterWallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amountToCredit } }
        });
      }
    }

    await tx.enrollment.update({
      where: { id },
      data: {
        status: refundStatus === 'processed' ? 'refunded' : enrollment.status,
        refundStatus,
        refundAmount: Number(refundAmount) || null
      }
    });
  });

  res.json({ success: true, message: 'Refund processed successfully' });
});
