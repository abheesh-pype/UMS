// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseInitialPaymentProof } from '../utils/initialPayment.js';

export const getPendingReviews = asyncHandler(async (req: AuthRequest, res: Response) => {
  const isHistory = req.query.history === 'true';
  const where: any = {
    organizationId: req.user.organizationId
  };

  if (isHistory) {
    where.status = { in: ['pending_finance_review', 'finance_review', 'payment_pending', 'enrolled', 'rejected', 'department_rejected', 'ops_rejected'] } as any;
    if (req.user.role === 'employee') {
      where.OR = [
        { assignedOpsUserId: req.user.id },
        { departmentReviewedBy: req.user.id }
      ];
    }
  } else {
    // Both pending document review and finance-rejected forms need Operations action
    where.status = { in: ['pending_doc_review', 'document_review', 'finance_rejected'] } as any;
    // Regular employees only see reviews specifically assigned to them
    if (req.user.role === 'employee') {
      where.assignedOpsUserId = req.user.id;
    }
  }

  const enrollments = await prisma.enrollment.findMany({
    where,
    include: {
      program: { include: { university: true } },
      studyCenter: true,
      session: true,
      assignedOpsUser: { select: { id: true, name: true, email: true, role: true } },
      departmentReviewer: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'asc' }
  });
  const data = enrollments.map(({ publicTrackingTokenHash, ...enrollment }) => ({
    ...enrollment,
    isDirectStudentApplication: Boolean(publicTrackingTokenHash),
  }));
  res.json({ success: true, count: data.length, data });
});

export const assignDeptEnrollment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { assignedOpsUserId } = req.body;

  if (assignedOpsUserId) {
    const targetUser = await prisma.user.findFirst({
      where: { id: assignedOpsUserId, organizationId: req.user.organizationId }
    });
    if (!targetUser) {
      res.status(404).json({ success: false, message: 'Assignee not found in organization' });
      return;
    }
  }

  const enrollment = await prisma.enrollment.update({
    where: { id: req.params.id },
    data: {
      assignedOpsUserId: assignedOpsUserId || null
    },
    include: {
      assignedOpsUser: { select: { id: true, name: true, email: true, role: true } },
      program: true
    }
  });

  if (assignedOpsUserId) {
    try {
      await prisma.notification.create({
        data: {
          organizationId: req.user.organizationId,
          userId: assignedOpsUserId,
          title: '📋 Enrollment Review Assigned',
          message: `You have been assigned to review enrollment for ${enrollment.studentName} (${enrollment.program?.name || 'Program'}).`,
          type: 'general',
          priority: 'medium',
          link: 'enrollment_review'
        }
      });
    } catch (notifErr) {
      console.error('Notification dispatch failed:', notifErr);
    }
  }

  res.json({ success: true, data: enrollment });
});

export const getDeptReviewEnrollments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const where: any = { organizationId: req.user.organizationId, status: { in: ['pending_doc_review', 'document_review'] } };
  if (req.user.role === 'employee') {
    where.assignedOpsUserId = req.user.id;
  }
  const enrollments = await prisma.enrollment.findMany({
    where,
    include: {
      program: { include: { university: true } },
      studyCenter: true,
      session: true,
      assignedOpsUser: { select: { id: true, name: true, email: true, role: true } }
    }
  });
  res.json({ success: true, count: enrollments.length, data: enrollments });
});

export const updateDeptEnrollment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.user.organizationId,
      status: { in: ['pending_doc_review', 'document_review', 'finance_rejected'] },
      ...(req.user.role === 'employee' ? { assignedOpsUserId: req.user.id } : {}),
    },
  });
  if (!enrollment) {
    res.status(404).json({ success: false, message: 'Operations enrollment not found or is no longer editable' });
    return;
  }

  const fields = [
    'studentName', 'studentEmail', 'studentPhone', 'studentAddress', 'dob', 'fatherName',
    'motherName', 'parentMobile', 'alternativePhone', 'pincode', 'religion', 'caste',
    'maritalStatus', 'currentlyWorking', 'specialisation', 'abcId', 'debId',
  ];
  const data: Record<string, unknown> = {};
  for (const field of fields) {
    if (req.body[field] !== undefined) {
      data[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
    }
  }
  if (typeof data.studentEmail === 'string' && data.studentEmail.toLowerCase() !== enrollment.studentEmail.toLowerCase()) {
    const duplicateApplication = await prisma.enrollment.findFirst({
      where: {
        organizationId: req.user.organizationId,
        studentEmail: { equals: data.studentEmail, mode: 'insensitive' },
        programId: enrollment.programId,
        sessionId: enrollment.sessionId,
        id: { not: enrollment.id },
      },
      select: { id: true },
    });
    if (duplicateApplication) {
      res.status(409).json({ success: false, message: 'An application with this email already exists for this program and session' });
      return;
    }

    if (enrollment.studentId) {
      const duplicateStudent = await prisma.student.findFirst({
        where: {
          email: { equals: data.studentEmail, mode: 'insensitive' },
          id: { not: enrollment.studentId },
        },
        select: { id: true },
      });
      if (duplicateStudent) {
        res.status(409).json({ success: false, message: 'Another student already uses this email address' });
        return;
      }
    }
  }
  if (req.body.admissionDate !== undefined) {
    data.admissionDate = req.body.admissionDate ? new Date(req.body.admissionDate) : null;
  }
  if (req.body.documents !== undefined) {
    data.documents = typeof req.body.documents === 'string' ? JSON.parse(req.body.documents) : req.body.documents;
  }
  if (req.body.educationalDetails !== undefined) {
    data.educationalDetails = typeof req.body.educationalDetails === 'string'
      ? JSON.parse(req.body.educationalDetails)
      : req.body.educationalDetails;
  }
  // Operations can replace a wrong payment proof submitted with the enrollment form
  if (req.body.initialPaymentProof !== undefined) {
    const parsedProof = parseInitialPaymentProof(req.body.initialPaymentProof);
    if ('error' in parsedProof) {
      res.status(400).json({ success: false, message: parsedProof.error });
      return;
    }
    data.initialPaymentProof = parsedProof.proof;
  }

  const now = new Date();
  const statusHistory = Array.isArray(enrollment.statusHistory) ? [...enrollment.statusHistory] : [];
  statusHistory.push({
    status: 'pending_doc_review',
    actorId: req.user.id,
    actorName: req.user.name,
    actorRole: req.user.role,
    timestamp: now.toISOString(),
    note: 'Application details updated by Operations and returned for document review',
  });

  const updatedEnrollment = await prisma.$transaction(async (tx) => {
    const updated = await tx.enrollment.update({
      where: { id: enrollment.id },
      data: {
        ...data,
        status: 'pending_doc_review',
        statusHistory,
      },
    });
    if (enrollment.studentId) {
      const studentData: Record<string, unknown> = {};
      if (data.studentName !== undefined) studentData.name = data.studentName;
      if (data.studentEmail !== undefined) studentData.email = data.studentEmail;
      if (data.studentPhone !== undefined) studentData.phone = data.studentPhone;
      if (data.studentAddress !== undefined) studentData.address = data.studentAddress;
      if (data.dob !== undefined) studentData.dob = data.dob;
      if (Object.keys(studentData).length) {
        await tx.student.update({ where: { id: enrollment.studentId }, data: studentData });
      }
    }
    return updated;
  });

  res.json({ success: true, data: updatedEnrollment });
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

  // Once approved by Operations, always forward to Finance Review so it shows in Finance Admin panel
  const nextStatus = 'pending_finance_review';
  const now = new Date();
  const history = Array.isArray(currentEnrollment.statusHistory) ? [...currentEnrollment.statusHistory] : [];
  history.push({
    status: nextStatus,
    actorId: req.user.id,
    actorName: req.user.name,
    actorRole: req.user.role,
    timestamp: now.toISOString(),
    note: 'Documents verified and approved by Operations department',
  });

  const enrollment = await prisma.enrollment.update({
    where: { id: req.params.id },
    data: {
      status: nextStatus,
      departmentReviewer: { connect: { id: req.user.id } },
      departmentReviewedAt: now,
      statusHistory: history,
    },
    include: { program: true }
  });

  // Notify Sales user if this was created via Sales
  if (currentEnrollment.salesUserId) {
    try {
      await prisma.notification.create({
        data: {
          organizationId: req.user.organizationId,
          userId: currentEnrollment.salesUserId,
          title: 'Application Verified by Operations',
          message: `${enrollment.studentName}'s application has been verified and forwarded to Finance for fee verification.`,
          type: 'general' as any,
          priority: 'medium' as any,
          link: 'student-applications'
        }
      });
    } catch (err) {
      console.error('Failed to notify sales user:', err);
    }
  }

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
  const currentEnrollment = await prisma.enrollment.findUnique({
    where: { id: req.params.id }
  });

  if (!currentEnrollment) {
    res.status(404).json({ success: false, message: 'Enrollment not found' });
    return;
  }

  const now = new Date();
  const history = Array.isArray(currentEnrollment.statusHistory) ? [...currentEnrollment.statusHistory] : [];
  history.push({
    status: 'department_rejected',
    actorId: req.user.id,
    actorName: req.user.name,
    actorRole: req.user.role,
    timestamp: now.toISOString(),
    note: req.body.remarks ? `Rejected by Operations: ${req.body.remarks}` : 'Application rejected by Operations department',
  });

  const enrollment = await prisma.enrollment.update({
    where: { id: req.params.id },
    data: {
      status: 'department_rejected' as any,
      departmentReviewer: { connect: { id: req.user.id } },
      departmentReviewedAt: now,
      departmentRemarks: req.body.remarks,
      statusHistory: history,
    },
    include: { program: true }
  });

  // Notify Study Center and Sales User - batch insert instead of N+1
  try {
    const recipients: string[] = [];
    if (enrollment.studyCenterId) {
      const centerAdmins = await prisma.user.findMany({
        where: { studyCenterId: enrollment.studyCenterId, role: 'center_admin' as any }
      });
      recipients.push(...centerAdmins.map(a => a.id));
    }
    if (enrollment.salesUserId && !recipients.includes(enrollment.salesUserId)) {
      recipients.push(enrollment.salesUserId);
    }
    if (recipients.length > 0) {
      await prisma.notification.createMany({
        data: recipients.map(userId => ({
          organizationId: req.user.organizationId,
          userId,
          title: '❌ Enrollment Rejected by Operations',
          message: `Enrollment for ${enrollment.studentName} was rejected. Remarks: ${req.body.remarks || 'No remarks'}.`,
          type: 'general' as any,
          priority: 'high' as any,
          link: userId === enrollment.salesUserId ? 'student-applications' : 'enrollments'
        }))
      });
    }
  } catch (notifErr) { console.error('Notification dispatch failed:', notifErr); }

  res.json({ success: true, data: enrollment });
});

export const resubmitToFinance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const currentEnrollment = await prisma.enrollment.findUnique({
    where: { id: req.params.id },
    include: { program: true }
  });

  if (!currentEnrollment) {
    res.status(404).json({ success: false, message: 'Enrollment not found' });
    return;
  }

  const enrollment = await prisma.enrollment.update({
    where: { id: req.params.id },
    data: {
      status: 'pending_finance_review',
      departmentRemarks: req.body.remarks || currentEnrollment.departmentRemarks,
      departmentReviewer: { connect: { id: req.user.id } },
      departmentReviewedAt: new Date()
    },
    include: { program: true }
  });

  // Notify Finance Admins
  try {
    const financeAdmins = await prisma.user.findMany({
      where: { organizationId: req.user.organizationId, role: 'finance_admin' as any }
    });
    await prisma.notification.createMany({
      data: financeAdmins.map(admin => ({
        organizationId: req.user.organizationId,
        userId: admin.id,
        title: '📄 Enrollment Re-submitted by Operations',
        message: `${enrollment.studentName} has been re-submitted by Operations for fee verification (${enrollment.program?.name || 'Program'}).`,
        type: 'general' as any,
        priority: 'medium' as any,
        link: 'enrollments_finance'
      }))
    });
  } catch (notifErr) { console.error('Notification dispatch failed:', notifErr); }

  res.json({ success: true, data: enrollment });
});
