// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getEscalations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const canReviewAll = [
    'superadmin',
    'org_admin',
    'university_admin',
    'ceo',
    'ops_admin',
    'finance_admin',
    'hr_admin',
    'sales_admin',
  ].includes(req.user.role);
  const isFinanceEmployee = req.user.role === 'employee'
    && (req.user.department?.type || req.user.subDepartment?.parentDept?.type) === 'finance';
  const escalations = await prisma.escalation.findMany({
    where: {
      organizationId: req.user.organizationId,
      ...(canReviewAll || isFinanceEmployee ? {} : { raisedById: req.user.id }),
    },
    include: { employee: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }
  });
  const raisedByIds = [...new Set(escalations.map(escalation => escalation.raisedById).filter(Boolean))];
  const raisers = await prisma.user.findMany({
    where: { organizationId: req.user.organizationId, id: { in: raisedByIds } },
    select: { id: true, name: true, email: true },
  });
  const raisersById = new Map(raisers.map(raiser => [raiser.id, raiser]));
  const data = escalations.map(escalation => ({
    ...escalation,
    raisedBy: escalation.raisedById ? raisersById.get(escalation.raisedById) || null : null,
    title: escalation.type || 'Escalation',
    priority: escalation.impact,
    raisedAt: escalation.raisedAt || escalation.escalatedAt || escalation.createdAt,
  }));
  res.json({ success: true, count: data.length, data });
});

export const getEscalation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const escalation = await prisma.escalation.findUnique({ where: { id: req.params.id } });
  res.json({ success: true, data: escalation });
});

export const createEscalation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { type, description, impact, entityType, entityId, currentLevel, maxLevel } = req.body;
  if (typeof description !== 'string' || !description.trim()) {
    res.status(400).json({ success: false, message: 'A description is required' });
    return;
  }
  if (typeof type !== 'string' || !type.trim() || typeof impact !== 'string' || !impact.trim()) {
    res.status(400).json({ success: false, message: 'Escalation type and impact are required' });
    return;
  }

  const escalation = await prisma.$transaction(async tx => {
    const created = await tx.escalation.create({
      data: {
        organizationId: req.user.organizationId,
        raisedById: req.user.id,
        raisedAt: new Date(),
        status: 'pending',
        type: type.trim(),
        description: description.trim(),
        impact: impact.trim(),
        entityType: typeof entityType === 'string' ? entityType : null,
        entityId: typeof entityId === 'string' ? entityId : null,
        currentLevel: Number.isInteger(currentLevel) ? currentLevel : 1,
        maxLevel: Number.isInteger(maxLevel) ? maxLevel : 3,
      },
    });
    await tx.escalationLog.create({
      data: {
        organizationId: req.user.organizationId,
        escalationId: created.id,
        action: 'created',
        remarks: 'Escalation submitted',
      },
    });
    return created;
  });
  res.status(201).json({ success: true, data: escalation });
});

export const updateEscalation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const escalation = await prisma.escalation.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: escalation });
});

export const deleteEscalation = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.escalation.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: {} });
});

export const resolveEscalation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await prisma.escalation.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
    select: { id: true, status: true },
  });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Escalation not found' });
    return;
  }
  if (existing.status === 'resolved') {
    res.status(409).json({ success: false, message: 'Escalation is already resolved' });
    return;
  }

  const remarks = typeof req.body?.remarks === 'string' ? req.body.remarks.trim() : '';
  const resolvedAt = new Date();
  const [escalation] = await prisma.$transaction([
    prisma.escalation.update({
      where: { id: existing.id },
      data: {
        status: 'resolved',
        resolution: remarks || null,
        resolvedAt,
        resolvedBy: req.user.id,
        handledBy: req.user.id,
      },
    }),
    prisma.escalationLog.create({
      data: {
        organizationId: req.user.organizationId,
        escalationId: existing.id,
        action: 'resolved',
        remarks: remarks || null,
      },
    }),
  ]);
  res.json({ success: true, data: escalation });
});

export const handleCeoEscalation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { action, resolution, newDeadline, reassignTo } = req.body;
  const validActions = ['resolve', 'reassign', 'extend', 'justify'];
  if (!validActions.includes(action)) {
    res.status(400).json({ success: false, message: 'Select a valid escalation action' });
    return;
  }

  const escalation = await prisma.escalation.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
    select: { id: true, status: true, taskId: true },
  });
  if (!escalation) {
    res.status(404).json({ success: false, message: 'Escalation not found' });
    return;
  }
  if (['resolved', 'closed'].includes(escalation.status)) {
    res.status(409).json({ success: false, message: 'Escalation is already closed' });
    return;
  }

  const remarks = typeof resolution === 'string' ? resolution.trim() : '';
  if (['resolve', 'justify'].includes(action) && !remarks) {
    res.status(400).json({ success: false, message: 'Resolution notes are required for this action' });
    return;
  }

  let escalationUpdate: Record<string, unknown> = {
    handledBy: req.user.id,
  };
  let taskUpdate: { id: string; deadline?: Date; assignedTo?: string } | null = null;

  if (action === 'resolve') {
    escalationUpdate = {
      ...escalationUpdate,
      status: 'resolved',
      resolution: remarks,
      resolvedAt: new Date(),
      resolvedBy: req.user.id,
    };
  } else if (action === 'justify') {
    escalationUpdate = { ...escalationUpdate, status: 'justified', resolution: remarks };
  } else if (action === 'reassign') {
    if (typeof reassignTo !== 'string' || !reassignTo.trim()) {
      res.status(400).json({ success: false, message: 'Select a user to reassign this escalation to' });
      return;
    }
    const assignee = await prisma.user.findFirst({
      where: { id: reassignTo.trim(), organizationId: req.user.organizationId },
      select: { id: true },
    });
    if (!assignee) {
      res.status(400).json({ success: false, message: 'The selected user is not in this organization' });
      return;
    }
    escalationUpdate = { ...escalationUpdate, status: 'reassigned', deptAdminId: assignee.id };
    if (escalation.taskId) taskUpdate = { id: escalation.taskId, assignedTo: assignee.id };
  } else {
    if (!escalation.taskId) {
      res.status(400).json({ success: false, message: 'Only task escalations can have their deadline extended' });
      return;
    }
    if (typeof newDeadline !== 'string' || !newDeadline.trim() || Number.isNaN(Date.parse(newDeadline))) {
      res.status(400).json({ success: false, message: 'Enter a valid new deadline' });
      return;
    }
    taskUpdate = { id: escalation.taskId, deadline: new Date(newDeadline) };
    escalationUpdate = { ...escalationUpdate, status: 'extended' };
  }

  const logRemarks = remarks || (action === 'reassign' ? `Reassigned to ${reassignTo}` : null);
  const updated = await prisma.$transaction(async tx => {
    if (taskUpdate) {
      await tx.task.update({
        where: { id: taskUpdate.id },
        data: {
          ...(taskUpdate.deadline ? { deadline: taskUpdate.deadline } : {}),
          ...(taskUpdate.assignedTo ? { assignedTo: taskUpdate.assignedTo } : {}),
        },
      });
    }
    const updatedEscalation = await tx.escalation.update({
      where: { id: escalation.id },
      data: escalationUpdate,
    });
    await tx.escalationLog.create({
      data: {
        organizationId: req.user.organizationId,
        escalationId: escalation.id,
        action,
        remarks: logRemarks,
      },
    });
    return updatedEscalation;
  });
  res.json({ success: true, data: updated });
});
