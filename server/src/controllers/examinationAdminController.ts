// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { loadSyncConfig, listPortalRoles, revokeStaffAccess, SyncError } from '../services/examPortalSync.js';

const STAFF_SELECT = { id: true, userId: true, name: true, email: true, designation: true, designationRef: { select: { title: true } } };

// Any active staff member or employee of the organization can be given Exam Portal access, whoever they report to.
// Ends the person's open Exam Portal session. Returns a warning to show the admin when the portal could not be told.
const revokePortalAccess = async (userId: string) => {
  const config = loadSyncConfig();
  if (!config) return null;
  try {
    await revokeStaffAccess(config, userId);
    return null;
  } catch (error) {
    if (!(error instanceof SyncError)) throw error;
    return `The Exam Portal could not be told to end their session (${error.message}). Their existing portal session may stay open until it expires.`;
  }
};

const assignableStaffWhere = async (admin: any, organizationId: string) => ({
  organizationId,
  id: { not: admin.id },
  role: { in: ['employee', 'staff'] },
  OR: [{ status: 'active' }, { status: null }],
});

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
    return res.status(400).json({ success: false, message: 'Only active staff or employees of your organization can be assigned' });
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
  // A changed role takes effect immediately: the open portal session is ended so the next sign-in uses the new role.
  const existing = await prisma.examinationAdminAssignment.findUnique({ where: { userId }, select: { portalRole: true } });
  const warning = existing && existing.portalRole !== portalRole ? await revokePortalAccess(userId) : null;
  const assignment = await prisma.examinationAdminAssignment.upsert({
    where: { userId },
    update: { portalRole },
    create: { organizationId, userId, assignedById: req.user.id, portalRole },
    include: { user: { select: STAFF_SELECT } },
  });
  res.status(200).json({ success: true, data: assignment, warning });
});

export const removeExaminationAdmin = asyncHandler(async (req: AuthRequest, res: Response) => {
  const assignment = await prisma.examinationAdminAssignment.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
    select: { id: true, userId: true },
  });
  if (!assignment) {
    return res.status(404).json({ success: false, message: 'Assignment not found' });
  }
  await prisma.examinationAdminAssignment.delete({ where: { id: assignment.id } });
  // Closing their portal session matters: removing the UMS menu item alone would leave an open portal tab working.
  const warning = await revokePortalAccess(assignment.userId);
  res.status(200).json({ success: true, warning });
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
