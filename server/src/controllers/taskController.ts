// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const departmentTypeByAdminRole: Record<string, string> = {
  sales_admin: 'sales',
  ops_admin: 'operations',
  finance_admin: 'finance',
};

const getAssignableUser = async (userId: string, organizationId: string, departmentType?: string) => {
  return prisma.user.findFirst({
    where: {
      id: userId,
      organizationId,
      status: 'active' as any,
      ...(departmentType ? {
        OR: [
          { department: { type: { equals: departmentType, mode: 'insensitive' } } },
          { department: { name: { contains: departmentType, mode: 'insensitive' } } },
          { subDepartment: { parentDept: { type: { equals: departmentType, mode: 'insensitive' } } } },
          { subDepartment: { parentDept: { name: { contains: departmentType, mode: 'insensitive' } } } },
        ],
      } : {}),
    },
    select: {
      id: true,
      departmentId: true,
      subDepartment: { select: { parentDeptId: true } },
    },
  });
};

export const getTasks = asyncHandler(async (req: AuthRequest, res: Response) => {
  const where: any = { organizationId: req.user.organizationId };
  if (req.query.assignedTo) where.assignedTo = req.query.assignedTo as string;
  if (req.query.status) where.status = req.query.status as string;

  const isAdmin = ['superadmin', 'org_admin', 'ceo', 'hr_admin', 'finance_admin', 'ops_admin', 'sales_admin'].includes(req.user.role);
  if (!isAdmin) {
    where.OR = [
      { assignedTo: req.user.id },
      { createdBy: req.user.id }
    ];
  }
  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: { select: { name: true, email: true } },
      assigner: { select: { name: true, email: true } },
      department: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' }
  });
  res.status(200).json({ success: true, count: tasks.length, data: tasks });
});

export const getTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const isAdmin = ['superadmin', 'org_admin', 'ceo', 'hr_admin', 'finance_admin', 'ops_admin', 'sales_admin'].includes(req.user.role);
  
  const where: any = { id: req.params.id, organizationId: req.user.organizationId };
  if (!isAdmin) {
    where.OR = [
      { assignedTo: req.user.id },
      { createdBy: req.user.id }
    ];
  }

  const task = await prisma.task.findFirst({
    where,
    include: {
      assignee: { select: { name: true, email: true } },
      assigner: { select: { name: true, email: true } },
      department: { select: { name: true } },
    }
  });
  if (!task) {
    res.status(404).json({ success: false, message: 'Task not found' });
    return;
  }
  res.status(200).json({ success: true, data: task });
});

export const createTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, description, assignedTo, deadline, priority, departmentId } = req.body;
  const cleanAssignedTo = assignedTo === 'null' || !assignedTo ? req.user.id : assignedTo;
  const departmentType = departmentTypeByAdminRole[req.user.role];
  const assignee = await getAssignableUser(cleanAssignedTo, req.user.organizationId, departmentType);
  if (!assignee) {
    res.status(400).json({
      success: false,
      message: departmentType
        ? 'Select an active employee from your department'
        : 'Selected assignee was not found in your organization',
    });
    return;
  }
  const cleanDepartmentId = assignee.departmentId || assignee.subDepartment?.parentDeptId
    || (departmentId === 'null' ? null : departmentId)
    || null;

  const task = await prisma.task.create({
    data: {
      title,
      description,
      status: 'pending' as any,
      priority: priority || 'medium',
      deadline: deadline ? new Date(deadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // default 7 days deadline
      organization: { connect: { id: req.user.organizationId } },
      assignee: { connect: { id: cleanAssignedTo } },
      assigner: { connect: { id: req.user.id } },
      department: cleanDepartmentId ? { connect: { id: cleanDepartmentId } } : undefined
    }
  });
  res.status(201).json({ success: true, data: { ...task, _id: task.id } });
});

export const updateTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, description, assignedTo, deadline, status, priority, departmentId } = req.body;
  
  const updateData: any = {};
  if (assignedTo !== undefined && assignedTo !== 'null') {
    const assignee = await getAssignableUser(
      assignedTo,
      req.user.organizationId,
      departmentTypeByAdminRole[req.user.role],
    );
    if (!assignee) {
      res.status(400).json({
        success: false,
        message: departmentTypeByAdminRole[req.user.role]
          ? 'Select an active employee from your department'
          : 'Selected assignee was not found in your organization',
      });
      return;
    }
    updateData.assignedTo = assignee.id;
    updateData.departmentId = assignee.departmentId || assignee.subDepartment?.parentDeptId || null;
  }
  if (title) updateData.title = title;
  if (description) updateData.description = description;
  if (deadline) updateData.deadline = new Date(deadline);
  if (status) updateData.status = status;
  if (priority) updateData.priority = priority;
  if (departmentId !== undefined && assignedTo === undefined) {
    updateData.departmentId = departmentId === 'null' ? null : departmentId;
  }

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: updateData
  });
  res.status(200).json({ success: true, data: { ...task, _id: task.id } });
});

export const completeTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      status: 'completed' as any,
      completedAt: new Date(),
      remarks: req.body.remarks,
    }
  });
  res.status(200).json({ success: true, data: { ...task, _id: task.id } });
});

export const deleteTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(200).json({ success: true, data: {} });
});

export const getAssignableUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const departmentType = departmentTypeByAdminRole[req.user.role];
  const users = await prisma.user.findMany({
    where: {
      organizationId: req.user.organizationId,
      status: 'active' as any,
      ...(departmentType ? {
        OR: [
          { department: { type: { equals: departmentType, mode: 'insensitive' } } },
          { department: { name: { contains: departmentType, mode: 'insensitive' } } },
          { subDepartment: { parentDept: { type: { equals: departmentType, mode: 'insensitive' } } } },
          { subDepartment: { parentDept: { name: { contains: departmentType, mode: 'insensitive' } } } },
        ],
      } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      designation: true,
      departmentId: true,
      department: { select: { id: true, name: true, type: true } },
      subDepartment: { select: { parentDeptId: true, parentDept: { select: { id: true, name: true, type: true } } } },
    },
  });
  const data = users.map(user => ({
    ...user,
    departmentId: user.departmentId || user.subDepartment?.parentDeptId || undefined,
  }));
  res.status(200).json({ success: true, count: data.length, data });
});
