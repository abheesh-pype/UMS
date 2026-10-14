// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { mapPrismaToFrontendCourseType } from '../utils/courseTypeHelper.js';
import { getOnboardingStatusByCode } from '../services/onboardingStatusService.js';

// Leads
export const getLeads = asyncHandler(async (req: AuthRequest, res: Response) => {
  const leads = await prisma.lead.findMany({ where: { organizationId: req.user.organizationId }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, count: leads.length, data: leads });
});
export const getLead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
  res.json({ success: true, data: lead });
});
export const createLead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, contactName, centerName, address } = req.body;
  const finalContactName = contactName || name || 'Unknown Contact';
  const finalCenterName = centerName || 'General Center';
  const finalAddress = address || 'Not Provided';

  const allowedFields = ['email', 'phone', 'source', 'referredBy', 'status', 'notes', 'convertedAt'];
  const dbData: any = {
    contactName: finalContactName,
    centerName: finalCenterName,
    address: finalAddress,
    organizationId: req.user.organizationId
  };

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) dbData[field] = req.body[field];
  }

  const lead = await prisma.lead.create({
    data: dbData
  });
  res.status(201).json({ success: true, data: { ...lead, _id: lead.id } });
});
export const updateLead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const lead = await prisma.lead.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: { ...lead, _id: lead.id } });
});
export const deleteLead = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.lead.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: {} });
});
export const convertLead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const lead = await prisma.lead.update({ where: { id: req.params.id }, data: { status: 'converted' as any, convertedAt: new Date() } });
  res.json({ success: true, data: lead });
});

// Targets
export const getTargets = asyncHandler(async (req: AuthRequest, res: Response) => {
  const targets = await prisma.target.findMany({ where: { organizationId: req.user.organizationId }, include: { employee: true } });
  res.json({ success: true, count: targets.length, data: targets });
});
export const getTarget = asyncHandler(async (req: AuthRequest, res: Response) => {
  const target = await prisma.target.findUnique({ where: { id: req.params.id } });
  res.json({ success: true, data: target });
});
export const createTarget = asyncHandler(async (req: AuthRequest, res: Response) => {
  const target = await prisma.target.create({ data: { ...req.body, organizationId: req.user.organizationId } });
  res.status(201).json({ success: true, data: target });
});
export const updateTarget = asyncHandler(async (req: AuthRequest, res: Response) => {
  const target = await prisma.target.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: target });
});
export const deleteTarget = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.target.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: {} });
});

// Invites
export const listMyInvites = asyncHandler(async (req: AuthRequest, res: Response) => {
  const invites = await prisma.studyCenterInvite.findMany({ where: { referredBy: req.user.id } });
  res.json({ success: true, count: invites.length, data: invites });
});
export const generateInvite = asyncHandler(async (req: AuthRequest, res: Response) => {
  const invite = await prisma.studyCenterInvite.create({
    data: { ...req.body, organizationId: req.user.organizationId, referredBy: req.user.id, token: Math.random().toString(36).substring(7).toUpperCase() }
  });
  res.status(201).json({ success: true, data: invite });
});
export const regenerateInvite = asyncHandler(async (req: AuthRequest, res: Response) => {
  const invite = await prisma.studyCenterInvite.update({ where: { id: req.params.id }, data: { token: Math.random().toString(36).substring(7).toUpperCase() } });
  res.json({ success: true, data: invite });
});

// Performance
export const getTeamPerformance = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: [] });
});

// Recursive helper to get all subordinate user IDs
async function getAllSubordinateIds(managerId: string, orgId?: string): Promise<string[]> {
  const subordinates = await prisma.user.findMany({
    where: { reportingTo: managerId },
    select: { id: true }
  });
  const ids = subordinates.map(s => s.id);
  const nested = await Promise.all(ids.map(id => getAllSubordinateIds(id, orgId)));
  const reportingSubIds = [...ids, ...nested.flat()];

  if (orgId) {
    const deptEmployees = await prisma.user.findMany({
      where: {
        organizationId: orgId,
        id: { not: managerId },
        role: { in: ['employee', 'bde', 'sales_sub_admin', 'sales subadmin'] as any },
        OR: [
          { department: { type: { equals: 'sales', mode: 'insensitive' } } },
          { department: { name: { contains: 'sales', mode: 'insensitive' } } },
          { subDepartment: { parentDept: { type: { equals: 'sales', mode: 'insensitive' } } } },
          { subDepartment: { parentDept: { name: { contains: 'sales', mode: 'insensitive' } } } },
        ]
      },
      select: { id: true }
    });
    return Array.from(new Set([...reportingSubIds, ...deptEmployees.map(u => u.id)]));
  }

  return reportingSubIds;
}

// Study Centers
export const getMyCenters = asyncHandler(async (req: AuthRequest, res: Response) => {
  const isAuth = ['superadmin', 'org_admin', 'ceo'].includes(req.user.role);
  let whereClause: any = { organizationId: req.user.organizationId };
  
  if (!isAuth) {
    if (req.user.role === 'sales_admin') {
      const subordinateIds = await getAllSubordinateIds(req.user.id, req.user.organizationId);
      const visibleUserIds = [req.user.id, ...subordinateIds];
      whereClause.OR = [
        { referredBy: { in: visibleUserIds } },
        { referredBy: null }
      ];
    } else {
      // Sales staff: view ONLY staff-created study centers
      whereClause.referredBy = req.user.id;
    }
  }

  const centers = await prisma.studyCenter.findMany({
    where: whereClause,
    include: {
      onboardingStatus: true,
      referrer: {
        select: { id: true, name: true, email: true, role: true }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });
  res.json({
    success: true,
    data: centers.map(center => {
      const isFinanceRejected = center.status === 'finance_rejected'
        || center.status === 'rejected_from_finance'
        || center.onboardingStatus?.code === 'finance_rejected'
        || (center.status === 'rejected' && center.verifiedBy && center.paymentRemarks);
      const isOpsRejected = center.status === 'ops_rejected'
        || (center.status === 'rejected' && !isFinanceRejected)
        || center.onboardingStatus?.code === 'ops_rejected'
        || (center.onboardingStatus?.stage === 'operations' && center.onboardingStatus?.state === 'rejected');

      const resolvedStatus = isFinanceRejected
        ? 'finance_rejected'
        : isOpsRejected
        ? 'ops_rejected'
        : (center.onboardingStatus?.code || center.status);

      return {
        ...center,
        status: resolvedStatus,
      };
    }),
  });
});

export const resubmitFinanceRejectedCenter = asyncHandler(async (req: AuthRequest, res: Response) => {
  const centerId = req.params.studyCenterId || req.params.id;
  const center = await prisma.studyCenter.findFirst({
    where: {
      id: centerId,
      organizationId: req.user.organizationId,
      OR: [
        { status: { in: ['rejected', 'ops_rejected', 'finance_rejected', 'rejected_from_finance'] } },
        { onboardingStatus: { state: 'rejected' } },
      ],
    },
    include: {
      onboardingStatus: true,
    },
  });
  if (!center) {
    res.status(404).json({ success: false, message: 'Rejected study center not found' });
    return;
  }
  const isAdmin = ['superadmin', 'org_admin', 'ceo'].includes(req.user.role);
  let visibleUserIds = [req.user.id];
  if (req.user.role === 'sales_admin') {
    visibleUserIds = [...visibleUserIds, ...await getAllSubordinateIds(req.user.id, req.user.organizationId)];
  }
  if (!isAdmin && center.referredBy && !visibleUserIds.includes(center.referredBy)) {
    res.status(403).json({ success: false, message: 'You can only update study centers referred by you or your team' });
    return;
  }

  const name = typeof req.body.name === 'string' && req.body.name.trim() ? req.body.name.trim() : center.name;
  const rawCode = typeof req.body.code === 'string' && req.body.code.trim() ? req.body.code.trim() : center.code;
  const code = rawCode.toUpperCase();

  const data: Record<string, any> = {
    name,
    code,
    email: typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : center.email,
    contact: typeof req.body.contact === 'string' ? req.body.contact.trim() : center.contact,
    address: typeof req.body.address === 'string' ? req.body.address.trim() : center.address,
    city: typeof req.body.city === 'string' ? req.body.city.trim() : center.city,
    state: typeof req.body.state === 'string' ? req.body.state.trim() : center.state,
    coordinatorName: typeof req.body.coordinatorName === 'string' ? req.body.coordinatorName.trim() : center.coordinatorName,
    branchName: typeof req.body.branchName === 'string' ? req.body.branchName.trim() : center.branchName,
  };

  const duplicateCode = await prisma.studyCenter.findFirst({
    where: {
      organizationId: req.user.organizationId,
      code: data.code,
      id: { not: center.id },
    },
    select: { id: true },
  });
  if (duplicateCode) {
    res.status(400).json({ success: false, message: 'A study center with this code already exists' });
    return;
  }

  // Workflow Rule:
  // When Operations rejected: move to ops_resubmitted (stage: operations, state: resubmitted)
  // When Finance rejected: move to finance_resubmitted (stage: finance, state: resubmitted)
  const isFinanceRejection = center.onboardingStatus?.stage === 'finance'
    || center.status === 'finance_rejected'
    || center.status === 'rejected_from_finance'
    || (center.status === 'rejected' && center.verifiedBy && center.paymentRemarks);

  const targetStatusCode = isFinanceRejection ? 'finance_resubmitted' : 'ops_resubmitted';
  const targetStatus = await getOnboardingStatusByCode(targetStatusCode);

  const remarks = req.body.remarks || (
    isFinanceRejection
      ? 'Payment and center details updated and resubmitted to Finance for re-verification'
      : 'Updated and resubmitted to Operations for re-verification'
  );

  const historyEntry = {
    status: targetStatus?.code || targetStatusCode,
    statusName: targetStatus?.name || (isFinanceRejection ? 'Finance Resubmitted' : 'Operations Resubmitted'),
    stage: targetStatus?.stage || (isFinanceRejection ? 'finance' : 'operations'),
    state: targetStatus?.state || 'resubmitted',
    actorId: req.user.id,
    actorName: req.user.name,
    remarks,
    timestamp: new Date().toISOString(),
  };

  const updatedCenter = await prisma.studyCenter.update({
    where: { id: center.id },
    data: {
      ...data,
      onboardingStatusId: targetStatus?.id || null,
      status: targetStatusCode,
      ...(isFinanceRejection ? {} : { verifiedBy: null, verifiedAt: null, opsRemarks: null }),
      statusHistory: [
        ...((center.statusHistory as any[]) || []),
        historyEntry,
      ],
    },
    include: {
      onboardingStatus: true,
      referrer: { select: { id: true, name: true, email: true, role: true } },
    }
  });
  res.json({ success: true, data: updatedCenter });
});

export const resubmitStudyCenter = resubmitFinanceRejectedCenter;


export const getMyCenterAdmissions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const isAuth = ['superadmin', 'org_admin', 'ceo'].includes(req.user.role);
  let whereCenterClause: any = { organizationId: req.user.organizationId };
  
  if (!isAuth) {
    if (req.user.role === 'sales_admin') {
      const subordinateIds = await getAllSubordinateIds(req.user.id, req.user.organizationId);
      const visibleUserIds = [req.user.id, ...subordinateIds];
      whereCenterClause.referredBy = { in: visibleUserIds };
    } else {
      whereCenterClause.referredBy = req.user.id;
    }
  }

  const visibleCenters = await prisma.studyCenter.findMany({
    where: whereCenterClause,
    select: { id: true }
  });

  const centerIds = visibleCenters.map(c => c.id);

  const admissions = await prisma.enrollment.findMany({
    where: {
      studyCenterId: { in: centerIds }
    },
    include: {
      program: { select: { name: true } },
      studyCenter: { select: { name: true } }
    }
  });
  res.json({ success: true, data: admissions });
});

export const getMyCenterDetail = asyncHandler(async (req: AuthRequest, res: Response) => {
  const center = await prisma.studyCenter.findUnique({
    where: { id: req.params.studyCenterId },
    include: {
      onboardingStatus: true,
      referrer: { select: { id: true, name: true, email: true, role: true } },
      allowedPrograms: true,
      associatedUniversities: true
    }
  });

  if (!center) {
    res.status(404).json({ success: false, message: 'Study center not found' });
    return;
  }

  const isAuth = ['superadmin', 'org_admin', 'ceo'].includes(req.user.role);
  if (!isAuth) {
    let visibleUserIds = [req.user.id];
    if (req.user.role === 'sales_admin') {
      const subordinateIds = await getAllSubordinateIds(req.user.id, req.user.organizationId);
      visibleUserIds = [req.user.id, ...subordinateIds];
    }
    if (!center.referredBy || !visibleUserIds.includes(center.referredBy)) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { studyCenterId: center.id },
    include: { program: true }
  });

  // Group by program
  const byProgramMap = new Map<string, { program: any, students: any[] }>();
  for (const e of enrollments) {
    const progId = e.programId;
    if (!byProgramMap.has(progId)) {
      byProgramMap.set(progId, {
        program: e.program,
        students: []
      });
    }
    byProgramMap.get(progId)!.students.push({
      id: e.id,
      studentName: e.studentName,
      studentEmail: e.studentEmail,
      enrollmentNumber: e.enrollmentNumber || 'N/A',
      status: e.status
    });
  }
  const byProgram = Array.from(byProgramMap.values());

  const stats = {
    totalStudents: enrollments.length,
    enrolled: enrollments.filter(e => e.status === 'enrolled').length,
    pending: enrollments.filter(e => ['payment_pending', 'document_review', 'finance_review'].includes(e.status)).length,
    rejected: enrollments.filter(e => e.status === 'rejected' || e.status === 'department_rejected').length
  };

  res.json({
    success: true,
    data: {
      center: {
        ...center,
        status: center.onboardingStatus?.code || (
          center.status === 'rejected' && center.verifiedBy && center.paymentRemarks
            ? 'rejected_from_finance'
            : (center.status === 'rejected' ? 'ops_rejected' : center.status)
        ),
        associatedUniversityIds: center.associatedUniversities,
        allowedProgramIds: center.allowedPrograms
      },
      enrollments,
      byProgram,
      stats
    }
  });
});

export const getTeamMembers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const isAuth = ['superadmin', 'org_admin', 'ceo'].includes(req.user.role);
  let users = [];
  if (isAuth || req.user.role === 'sales_admin') {
    const subordinateIds = await getAllSubordinateIds(req.user.id, req.user.organizationId);
    users = await prisma.user.findMany({
      where: {
        organizationId: req.user.organizationId,
        id: { in: subordinateIds }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });
  } else {
    users = [];
  }
  res.json({ success: true, data: users });
});

export const reassignCenter = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { studyCenterId } = req.params;
  const { newSalesUserId } = req.body;

  if (!newSalesUserId) {
    res.status(400).json({ success: false, message: 'New sales user ID is required' });
    return;
  }

  const center = await prisma.studyCenter.findUnique({
    where: { id: studyCenterId }
  });

  if (!center) {
    res.status(404).json({ success: false, message: 'Study center not found' });
    return;
  }

  const isAuth = ['superadmin', 'org_admin', 'ceo'].includes(req.user.role);
  if (!isAuth) {
    const subordinateIds = await getAllSubordinateIds(req.user.id, req.user.organizationId);
    if (!subordinateIds.includes(newSalesUserId)) {
      res.status(403).json({ success: false, message: 'You can only reassign to sales users on your team' });
      return;
    }
  } else {
    const targetUser = await prisma.user.findUnique({
      where: { id: newSalesUserId }
    });
    if (!targetUser || targetUser.organizationId !== req.user.organizationId) {
      res.status(400).json({ success: false, message: 'Invalid target user' });
      return;
    }
  }

  const updatedCenter = await prisma.studyCenter.update({
    where: { id: studyCenterId },
    data: { referredBy: newSalesUserId },
    include: {
      referrer: { select: { id: true, name: true, email: true, role: true } }
    }
  });

  res.json({ success: true, data: updatedCenter });
});

// Programs
export const getProgramsByUniversity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const programs = await prisma.program.findMany({ where: { universityId: req.query.universityId as string } });
  const mapped = programs.map(p => ({
    ...p,
    courseType: mapPrismaToFrontendCourseType(p.courseType)
  }));
  res.json({ success: true, data: mapped });
});
