// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getPendingReviews = asyncHandler(async (req: AuthRequest, res: Response) => {
  const isHistory = req.query.history === 'true';
  const where: any = {
    organizationId: req.user.organizationId
  };

  if (isHistory) {
    where.status = { in: ['pending_finance_review', 'payment_pending', 'enrolled', 'rejected'] } as any;
  } else {
    where.status = 'pending_doc_review';
  }

  const enrollments = await prisma.enrollment.findMany({
    where,
    include: { program: { include: { university: true } }, studyCenter: true, session: true }
  });
  res.json({ success: true, count: enrollments.length, data: enrollments });
});

export const getDeptReviewEnrollments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const enrollments = await prisma.enrollment.findMany({ where: { organizationId: req.user.organizationId, status: 'pending_doc_review' }, include: { program: { include: { university: true } }, studyCenter: true, session: true } });
  res.json({ success: true, count: enrollments.length, data: enrollments });
});

export const approveDeptEnrollment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const currentEnrollment = await prisma.enrollment.findUnique({
    where: { id: req.params.id },
    include: { program: { include: { university: true } } }
  });

  if (!currentEnrollment || !currentEnrollment.program?.university) {
    res.status(404).json({ success: false, message: 'Enrollment or University not found' });
    return;
  }

  const category = (currentEnrollment.program.university as any).category || 'team_lease';
  const isDirectToUni = currentEnrollment.paymentType === 'direct_to_university';
  const nextStatus = (category === 'team_lease' || category === 'direct_iits' || isDirectToUni) ? 'pending_finance_review' : 'payment_pending';

  const enrollment = await prisma.enrollment.update({
    where: { id: req.params.id },
    data: { status: nextStatus, departmentReviewer: { connect: { id: req.user.id } }, departmentReviewedAt: new Date() },
    include: { program: true }
  });

  // Notify Finance Admins - batch insert instead of N+1
  try {
    const financeAdmins = await prisma.user.findMany({
      where: { organizationId: req.user.organizationId, role: 'finance_admin' as any }
    });
    await prisma.notification.createMany({
      data: financeAdmins.map(admin => ({
        organizationId: req.user.organizationId,
        userId: admin.id,
        title: '📄 Enrollment Pending Fee Verification',
        message: `${enrollment.studentName} has been approved by Operations and is pending fee verification for ${enrollment.program.name}.`,
        type: 'general' as any,
        priority: 'medium' as any,
        link: 'enrollments_finance'
      }))
    });
  } catch (notifErr) { console.error('Notification dispatch failed:', notifErr); }

  res.json({ success: true, data: enrollment });
});

export const rejectDeptEnrollment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const enrollment = await prisma.enrollment.update({
    where: { id: req.params.id },
    data: { status: 'rejected' as any, departmentReviewer: { connect: { id: req.user.id } }, departmentReviewedAt: new Date(), departmentRemarks: req.body.remarks },
    include: { program: true }
  });

  // Notify Study Center and Sales User - batch insert instead of N+1
  try {
    const centerAdmins = enrollment.studyCenterId ? await prisma.user.findMany({
      where: { studyCenterId: enrollment.studyCenterId, role: 'center_admin' as any }
    }) : [];
    const recipients = centerAdmins.map(a => a.id);
    if (enrollment.salesUserId) recipients.push(enrollment.salesUserId);
    if (recipients.length > 0) {
      await prisma.notification.createMany({
        data: recipients.map(userId => ({
          organizationId: req.user.organizationId,
          userId,
          title: '❌ Enrollment Rejected by Operations',
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

