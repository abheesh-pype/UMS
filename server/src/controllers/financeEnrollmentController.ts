// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import bcrypt from 'bcryptjs';

export const getAllEnrollments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status, search } = req.query;
  const where: any = { organizationId: req.user.organizationId };

  if (status) {
    where.status = status as string;
  }

  if (search) {
    where.OR = [
      { studentName: { contains: search as string, mode: 'insensitive' } },
      { studentEmail: { contains: search as string, mode: 'insensitive' } },
      { studentPhone: { contains: search as string, mode: 'insensitive' } },
      { enrollmentNumber: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const [enrollments, allEnrollmentsForSummary] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      include: {
        program: { select: { name: true, code: true } },
        studyCenter: { select: { name: true, code: true } },
        payment: true
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.enrollment.findMany({
      where: { organizationId: req.user.organizationId },
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
    else if (e.status === 'pending_finance_review') summary.pending_finance_review++;
    else if (e.status === 'enrolled') summary.enrolled++;
    else if (e.status === 'rejected') summary.rejected++;
    else if (e.status === 'department_rejected') summary.department_rejected++;
  });

  res.status(200).json({ success: true, count: enrollments.length, data: enrollments, summary });
});

export const getFinanceEnrollments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const enrollments = await prisma.enrollment.findMany({
    where: { organizationId: req.user.organizationId, status: 'pending_finance_review' },
    include: { program: true, studyCenter: true, payment: true },
    orderBy: { createdAt: 'asc' }
  });
  res.json({ success: true, count: enrollments.length, data: enrollments });
});

export const approveFinanceEnrollment = asyncHandler(async (req: AuthRequest, res: Response) => {
  // 1. Fetch enrollment details first to inspect program and studyCenterId
  const dbEnrollment = await prisma.enrollment.findUnique({
    where: { id: req.params.id },
    include: { program: { include: { university: true } } }
  });

  if (!dbEnrollment) {
    res.status(404).json({ success: false, message: 'Enrollment not found' });
    return;
  }

  // 2. Fetch program fee structure matching session
  let feeStructure = await prisma.programFeeStructure.findFirst({
    where: {
      organizationId: req.user.organizationId,
      programId: dbEnrollment.programId,
      admissionSessionId: dbEnrollment.sessionId,
      level: 'program'
    }
  });

  // Fallback 1: Any program level structure
  if (!feeStructure) {
    feeStructure = await prisma.programFeeStructure.findFirst({
      where: {
        organizationId: req.user.organizationId,
        programId: dbEnrollment.programId,
        level: 'program'
      }
    });
  }

  // Fallback 2: Any available structure
  if (!feeStructure) {
    feeStructure = await prisma.programFeeStructure.findFirst({
      where: {
        organizationId: req.user.organizationId,
        programId: dbEnrollment.programId
      }
    });
  }

  // Fall back to the university fee when no program-specific fee is configured.
  if (!feeStructure && dbEnrollment.program?.universityId) {
    feeStructure = await prisma.programFeeStructure.findFirst({
      where: {
        organizationId: req.user.organizationId,
        universityId: dbEnrollment.program.universityId,
        admissionSessionId: dbEnrollment.sessionId,
        level: 'university'
      }
    });
  }

  if (!feeStructure && dbEnrollment.program?.universityId) {
    feeStructure = await prisma.programFeeStructure.findFirst({
      where: {
        organizationId: req.user.organizationId,
        universityId: dbEnrollment.program.universityId,
        level: 'university'
      }
    });
  }

  if (!feeStructure) {
    res.status(400).json({
      success: false,
      message: 'No fee structure is configured for this program or its university. Please configure a program or university fee before approving the enrollment.'
    });
    return;
  }

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

  // 3. Perform final updates and create student inside a transaction
  const enrollment = await prisma.$transaction(async (tx) => {

    // Create/find User
    let user = await tx.user.findUnique({ where: { email: dbEnrollment.studentEmail } });
    if (!user) {
      const rawPassword = 'password123';
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      const userId = `STD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      user = await tx.user.create({
        data: {
          userId,
          email: dbEnrollment.studentEmail,
          password: hashedPassword,
          name: dbEnrollment.studentName,
          role: 'student',
          organizationId: req.user.organizationId,
          status: 'active'
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
          dob: dbEnrollment.dob,
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
          status: 'active',
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
        status: 'active',
        name: dbEnrollment.studentName,
        phone: dbEnrollment.studentPhone,
        address: dbEnrollment.studentAddress,
        specialisation: dbEnrollment.specialisation,
        abcId: dbEnrollment.abcId,
        debId: dbEnrollment.debId,
        dob: dbEnrollment.dob,
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
    if (feeStructure.universityFee !== undefined) {
      const existing = await prisma.universityFeePayment.findMany({
        where: { enrollmentId: enrollment.id }
      });

      if (existing.length === 0) {
        const breakdown = (feeStructure.feeBreakdown as any[]) || [];
        const isSemester = feeStructure.billingCycle === 'per_semester';
        
        if (breakdown.length > 0) {
          const paymentsToCreate = breakdown.map((cycle, index) => ({
            organizationId: req.user.organizationId,
            studentId: enrollment.studentId!,
            enrollmentId: enrollment.id,
            semesterOrYear: isSemester ? `Semester ${index + 1}` : `Year ${index + 1}`,
            amount: Number(cycle.universityFee || 0),
            status: 'pending'
          }));
          await prisma.universityFeePayment.createMany({ data: paymentsToCreate });
        } else if (feeStructure.universityFee > 0) {
          await prisma.universityFeePayment.create({
            data: {
              organizationId: req.user.organizationId,
              studentId: enrollment.studentId!,
              enrollmentId: enrollment.id,
              semesterOrYear: isSemester ? 'Semester 1' : 'Year 1',
              amount: feeStructure.universityFee,
              status: 'pending'
            }
          });
        }
      }
    }
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
  const enrollment = await prisma.enrollment.update({
    where: { id: req.params.id },
    data: { status: 'rejected' as any, financeReviewer: { connect: { id: req.user.id } }, financeReviewedAt: new Date(), financeRemarks: req.body.remarks },
    include: { program: true }
  });

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
          title: '❌ Enrollment Rejected by Finance',
          message: `Enrollment for ${enrollment.studentName} was rejected. Remarks: ${req.body.remarks}`,
          type: 'general' as any,
          priority: 'high' as any,
          link: userId === enrollment.salesUserId ? 'student-applications' : 'enrollments'
        }))
      });
    }
  } catch (notifErr) { console.error('Notification dispatch failed:', notifErr); }

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
