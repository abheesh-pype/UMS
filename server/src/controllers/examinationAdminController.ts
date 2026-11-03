// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getSalesTeamUserIds } from './salesEnrollmentController.js';

const STAFF_SELECT = { id: true, userId: true, name: true, email: true, designation: true, designationRef: { select: { title: true } } };

// The admin's subordinates in the hierarchy (at any depth) who are staff or employees
const subordinateStaffWhere = async (adminId: string, organizationId: string) => {
  const teamIds = [...await getSalesTeamUserIds(adminId, organizationId)].filter(id => id !== adminId);
  return {
    organizationId,
    id: { in: teamIds },
    role: { in: ['employee', 'staff'] },
    OR: [{ status: 'active' }, { status: null }],
  };
};

export const getExaminationAdmins = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.user.organizationId;
  const [staff, assigned] = await Promise.all([
    prisma.user.findMany({
      where: await subordinateStaffWhere(req.user.id, organizationId),
      select: STAFF_SELECT,
      orderBy: { name: 'asc' },
    }),
    prisma.examinationAdminAssignment.findMany({
      where: { organizationId },
      include: { user: { select: STAFF_SELECT } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  res.status(200).json({ success: true, data: { staff, assigned } });
});

export const assignExaminationAdmin = asyncHandler(async (req: AuthRequest, res: Response) => {
  const organizationId = req.user.organizationId;
  const userId = String(req.body.userId || '');
  const staffMember = await prisma.user.findFirst({
    where: { ...await subordinateStaffWhere(req.user.id, organizationId), AND: [{ id: userId }] },
    select: { id: true },
  });
  if (!staffMember) {
    return res.status(400).json({ success: false, message: 'Only your own active staff can be assigned' });
  }
  const assignment = await prisma.examinationAdminAssignment.upsert({
    where: { userId },
    update: {},
    create: { organizationId, userId, assignedById: req.user.id },
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
