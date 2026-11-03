// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getSalesTeamUserIds } from './salesEnrollmentController.js';
import { loadSyncConfig, listPortalRoles, SyncError } from '../services/examPortalSync.js';

const STAFF_SELECT = { id: true, userId: true, name: true, email: true, designation: true, designationRef: { select: { title: true } } };

// Org-wide admins can pick any active staff member of the organization; an Academic Admin only their own reports.
const ORG_WIDE_ROLES = ['org_admin', 'superadmin'];

const assignableStaffWhere = async (admin: any, organizationId: string) => {
  const base = { organizationId, role: { in: ['employee', 'staff'] }, OR: [{ status: 'active' }, { status: null }] };
  if (ORG_WIDE_ROLES.includes(admin.role)) return { ...base, id: { not: admin.id } };
  const teamIds = [...await getSalesTeamUserIds(admin.id, organizationId)].filter(id => id !== admin.id);
  return { ...base, id: { in: teamIds } };
};

// Roles that exist in the Exam Portal right now. An unreachable portal is reported, not hidden.
const fetchPortalRoles = async () => {
  const config = loadSyncConfig();
  if (!config) return { roles: [], error: 'The Exam Portal is not connected on the server' };
  try {
    return { roles: await listPortalRoles(config), error: null };
  } catch (error) {
    if (!(error instanceof SyncError)) throw error;
    return { roles: [], error: error.message };
  }
};

export const getExaminationAdmins = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.user.organizationId;
  const [staff, assigned, portal] = await Promise.all([
    prisma.user.findMany({
      where: await assignableStaffWhere(req.user, organizationId),
      select: STAFF_SELECT,
      orderBy: { name: 'asc' },
    }),
    prisma.examinationAdminAssignment.findMany({
      where: { organizationId },
      include: { user: { select: STAFF_SELECT } },
      orderBy: { createdAt: 'desc' },
    }),
    fetchPortalRoles(),
  ]);
  res.status(200).json({ success: true, data: { staff, assigned, portalRoles: portal.roles, portalRolesError: portal.error } });
});

export const assignExaminationAdmin = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.user.organizationId;
  const userId = String(req.body.userId || '');
  const requestedRole = typeof req.body.portalRole === 'string' ? req.body.portalRole.trim() : '';
  const staffMember = await prisma.user.findFirst({
    where: { ...await assignableStaffWhere(req.user, organizationId), AND: [{ id: userId }] },
    select: { id: true },
  });
  if (!staffMember) {
    return res.status(400).json({ success: false, message: 'Only active staff you manage can be assigned' });
  }
  // The role must be one the Exam Portal really has; keep its exact spelling.
  const { roles, error } = await fetchPortalRoles();
  if (error) return res.status(503).json({ success: false, message: error });
  let portalRole = null;
  if (requestedRole) {
    const match = roles.find(role => role.name.toLowerCase() === requestedRole.toLowerCase());
    if (!match) return res.status(400).json({ success: false, message: `The Exam Portal has no role named "${requestedRole}"` });
    portalRole = match.name;
  }
  const assignment = await prisma.examinationAdminAssignment.upsert({
    where: { userId },
    update: { portalRole },
    create: { organizationId, userId, assignedById: req.user.id, portalRole },
    include: { user: { select: STAFF_SELECT } },
  });
  res.status(200).json({ success: true, data: assignment });
});

export const removeExaminationAdmin = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { count } = await prisma.examinationAdminAssignment.deleteMany({
    where: { id: req.params.id, organizationId: req.user.organizationId },
  });
  if (!count) {
    return res.status(404).json({ success: false, message: 'Assignment not found' });
  }
  res.status(200).json({ success: true });
});

/** Whether the signed-in user can open the Exam Portal, and as which portal role. Admins always can. */
export const getMyExamPortalAccess = asyncHandler(async (req: AuthRequest, res: Response) => {
  const access = await resolveExamPortalAccess(req.user);
  res.status(200).json({
    success: true,
    data: { allowed: access.allowed, portalRole: access.portalRole, canManage: access.canManage },
  });
});

const MANAGER_ROLES = ['academic_admin', 'org_admin', 'superadmin'];

export const resolveExamPortalAccess = async (user: any) => {
  if (MANAGER_ROLES.includes(user.role)) return { allowed: true, portalRole: null, canManage: true };
  if (user.role === 'employee' || user.role === 'staff') {
    const assignment = await prisma.examinationAdminAssignment.findUnique({ where: { userId: user.id }, select: { portalRole: true } });
    if (assignment) return { allowed: true, portalRole: assignment.portalRole, canManage: false };
  }
  return { allowed: false, portalRole: null, canManage: false };
};
