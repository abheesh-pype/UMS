// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../config/postgres.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// GET /enrollment/university-review
// Returns all enrollments with status university_review for the requesting university_admin's university
export const getUniversityReviewQueue = asyncHandler(async (req: AuthRequest, res: Response) => {
  const universityId = req.user.universityId;
  const isOrgAdmin = req.user.role === 'org_admin';

  if (!isOrgAdmin && !universityId) {
    res.status(403).json({ success: false, message: 'No university linked to your account' });
    return;
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      organizationId: req.user.organizationId,
      status: isOrgAdmin
        ? { in: ['pending_doc_review', 'document_review', 'university_review', 'finance_review', 'pending_finance_review'] } as any
        : 'university_review' as any,
      ...(isOrgAdmin ? {} : { program: { universityId } }),
    },
    include: {
      program: { select: { id: true, name: true, code: true, courseType: true } },
      studyCenter: { select: { id: true, name: true, code: true } },
      session: { select: { id: true, name: true } },
      ...(isOrgAdmin ? {
        departmentReviewer: { select: { id: true, name: true } },
        assignedOpsUser: { select: { id: true, name: true } },
      } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json({ success: true, count: enrollments.length, data: enrollments });
});

// PUT /enrollment/university-review/:id/approve
export const approveUniversityEnrollment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const universityId = req.user.universityId;
  const isOrgAdmin = req.user.role === 'org_admin';
  const now = new Date();

  if (!isOrgAdmin && !universityId) {
    res.status(403).json({ success: false, message: 'No university linked to your account' });
    return;
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: req.params.id },
    include: {
      program: { select: { universityId: true, name: true } },
      studyCenter: { select: { id: true } },
    },
  });

  if (!enrollment) {
    res.status(404).json({ success: false, message: 'Enrollment not found' });
    return;
  }

  if (enrollment.organizationId !== req.user.organizationId
    || (!isOrgAdmin && (enrollment as any).program?.universityId !== universityId)) {
    res.status(403).json({ success: false, message: 'Enrollment does not belong to your university' });
    return;
  }

  if (enrollment.status !== 'university_review') {
    res.status(409).json({ success: false, message: `Cannot transition enrollment from ${enrollment.status} to enrolled` });
    return;
  }

  const updatedStatusHistory = ((enrollment as any).statusHistory as any[]) || [];
  updatedStatusHistory.push({ status: 'enrolled' as any, actorId: req.user.id, timestamp: now.toISOString() });

  const updatedEnrollment = await prisma.enrollment.update({
    where: { id: req.params.id },
    data: {
      status: 'enrolled' as any,
      enrolledAt: now,
      universityReviewedBy: req.user.id,
      universityReviewedAt: now,
      statusHistory: updatedStatusHistory,
    } as any,
  });

  if (updatedEnrollment.studentId) {
    await prisma.student.update({
      where: { id: updatedEnrollment.studentId },
      data: { enrolledAt: now, status: 'active', sessionId: enrollment.sessionId }
    });
  }

  // Notify center_admin users of the partner portal
  try {
    const centerAdmins = await prisma.user.findMany({
      where: { studyCenterId: enrollment.studyCenterId, role: 'center_admin' as any, status: 'active' as any },
      select: { id: true },
    });
    const opsAdmins = await prisma.user.findMany({
      where: { organizationId: req.user.organizationId, role: 'ops_admin' as any, status: 'active' as any },
      select: { id: true },
    });
    const recipients = [...centerAdmins, ...opsAdmins];
    if (recipients.length > 0) {
      await prisma.notification.createMany({
        data: recipients.map((u) => ({
          organizationId: req.user.organizationId,
          userId: u.id,
          title: 'Enrollment Approved',
          message: `${enrollment.studentName}'s enrollment in ${(enrollment as any).program?.name} has been approved by the university. The student is now officially enrolled.`,
          type: 'general' as any,
          priority: 'medium',
          link: 'enrollment/enrollments',
        })),
      });
    }
  } catch (err) { 
    console.error('Failed to notify about enrollment approval:', err);
  }

  res.status(200).json({ success: true, data: updatedEnrollment });
});

// PUT /enrollment/university-review/:id/reject
export const rejectUniversityEnrollment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { remarks } = req.body;
  const universityId = req.user.universityId;
  const isOrgAdmin = req.user.role === 'org_admin';
  const now = new Date();

  if (!remarks || remarks.trim().length === 0) {
    res.status(400).json({ success: false, message: 'remarks is required for rejection' });
    return;
  }

  if (!isOrgAdmin && !universityId) {
    res.status(403).json({ success: false, message: 'No university linked to your account' });
    return;
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: req.params.id },
    include: {
      program: { select: { universityId: true, name: true } },
      studyCenter: { select: { id: true } },
    },
  });

  if (!enrollment) {
    res.status(404).json({ success: false, message: 'Enrollment not found' });
    return;
  }

  if (enrollment.organizationId !== req.user.organizationId
    || (!isOrgAdmin && (enrollment as any).program?.universityId !== universityId)) {
    res.status(403).json({ success: false, message: 'Enrollment does not belong to your university' });
    return;
  }

  if (enrollment.status !== 'university_review') {
    res.status(409).json({ success: false, message: `Cannot transition enrollment from ${enrollment.status} to university_rejected` });
    return;
  }

  const updatedStatusHistory = ((enrollment as any).statusHistory as any[]) || [];
  updatedStatusHistory.push({ status: 'university_rejected' as any, actorId: req.user.id, timestamp: now.toISOString(), remarks });

  const updatedEnrollment = await prisma.enrollment.update({
    where: { id: req.params.id },
    data: {
      status: 'university_rejected' as any,
      universityRemarks: remarks,
      universityReviewedBy: req.user.id,
      universityReviewedAt: now,
      statusHistory: updatedStatusHistory,
    } as any,
  });

  // Notify center_admin and ops_admin users with the remark
  try {
    const centerAdmins = await prisma.user.findMany({
      where: { studyCenterId: enrollment.studyCenterId, role: 'center_admin' as any, status: 'active' as any },
      select: { id: true },
    });
    const opsAdmins = await prisma.user.findMany({
      where: { organizationId: req.user.organizationId, role: 'ops_admin' as any, status: 'active' as any },
      select: { id: true },
    });
    const recipients = [...centerAdmins, ...opsAdmins];
    if (recipients.length > 0) {
      await prisma.notification.createMany({
        data: recipients.map((u) => ({
          organizationId: req.user.organizationId,
          userId: u.id,
          title: 'Enrollment Rejected by University',
          message: `${enrollment.studentName}'s enrollment in ${(enrollment as any).program?.name} was rejected by the university. Reason: ${remarks}`,
          type: 'general' as any,
          priority: 'high',
          link: 'enrollment/enrollments',
        })),
      });
    }
  } catch (err) { 
    console.error('Failed to notify about enrollment rejection:', err);
  }

  res.status(200).json({ success: true, data: updatedEnrollment });
});
