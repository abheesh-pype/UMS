// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getAllOnboardingStatuses } from '../services/onboardingStatusService.js';

export const getPerformanceMetrics = asyncHandler(async (req: AuthRequest, res: Response) => {
  const [total, completed] = await Promise.all([
    prisma.task.count({ where: { organizationId: req.user.organizationId } }),
    prisma.task.count({ where: { organizationId: req.user.organizationId, status: 'completed' as any } })
  ]);
  res.json({ success: true, data: { taskCompletionRate: total > 0 ? (completed / total) * 100 : 0 } });
});

export const getRiskMetrics = asyncHandler(async (req: AuthRequest, res: Response) => {
  const overdue = await prisma.task.count({ where: { organizationId: req.user.organizationId, status: 'overdue' as any } });
  res.json({ success: true, data: { overdueTasks: overdue } });
});

export const getEscalations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const escalations = await prisma.escalation.findMany({ where: { organizationId: req.user.organizationId }, include: { employee: true } });
  res.json({ success: true, count: escalations.length, data: escalations });
});

export const handleEscalation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const escalation = await prisma.escalation.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: escalation });
});

export const getAnalytics = asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user.organizationId;

  // 1. Employee Performance
  const users = await prisma.user.findMany({
    where: { 
      organizationId: orgId,
      role: { in: ['ops_admin', 'ops_sub_admin', 'finance_admin', 'hr_admin', 'sales_admin', 'finance', 'sales', 'employee', 'staff'] }
    },
    include: { assignedTasks: true }
  });

  const employeePerformance = users.map(u => {
    const total = u.assignedTasks.length;
    const completed = u.assignedTasks.filter(t => t.status === 'completed').length;
    const overdue = u.assignedTasks.filter(t => t.status !== 'completed' && new Date(t.deadline) < new Date()).length;
    const inProgress = u.assignedTasks.filter(t => t.status === 'in_progress').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const overdueRate = total > 0 ? Math.round((overdue / total) * 100) : 0;
    const score = total > 0 ? Math.max(0, Math.min(100, Math.round(completionRate - (overdueRate * 0.5)))) : 0;

    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      total,
      completed,
      overdue,
      inProgress,
      completionRate,
      score
    };
  }).sort((a, b) => b.score - a.score);

  // 2. Department Efficiency
  const departments = await prisma.department.findMany({
    where: { organizationId: orgId },
    include: { tasks: true, _count: { select: { users: true } } }
  });

  const departmentEfficiency = departments.map(d => {
    const total = d.tasks.length;
    const completed = d.tasks.filter(t => t.status === 'completed').length;
    const overdue = d.tasks.filter(t => t.status !== 'completed' && new Date(t.deadline) < new Date()).length;
    const inProgress = d.tasks.filter(t => t.status === 'in_progress').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const overdueRate = total > 0 ? Math.round((overdue / total) * 100) : 0;
    const efficiency = total > 0 ? Math.max(0, Math.min(100, Math.round(completionRate - (overdueRate * 0.5)))) : 0;

    return {
      departmentId: d.id,
      name: d.name,
      type: d.type || 'General',
      memberCount: d._count.users,
      total,
      completed,
      overdue,
      inProgress,
      completionRate,
      overdueRate,
      efficiency
    };
  }).sort((a, b) => b.efficiency - a.efficiency);

  res.json({ 
    success: true, 
    data: { 
      employeePerformance, 
      departmentEfficiency 
    } 
  });
});

export const getDepartmentManagers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const managers = await prisma.user.findMany({ where: { organizationId: req.user.organizationId, role: { in: ['dept_admin', 'ops_admin', 'finance_admin', 'hr_admin', 'sales_admin'] } } });
  res.json({ success: true, count: managers.length, data: managers });
});

export const assignTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { assignedTo, ...rest } = req.body;
  const task = await prisma.task.create({ data: { ...rest, assignedTo, organizationId: req.user.organizationId, createdBy: req.user.id } });
  res.status(201).json({ success: true, data: task });
});

export const getKPIKRAReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: [] });
});

export const getCenterOnboardingOverview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const centers = await prisma.studyCenter.findMany({
    where: { organizationId: req.user.organizationId },
    include: {
      onboardingStatus: true,
      referrer: { select: { id: true, name: true, email: true } },
      verifier: { select: { id: true, name: true, email: true } },
      assignedOperationsUser: { select: { id: true, name: true, email: true } },
      assignedFinanceUser: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, name: true, email: true } },
    },
    orderBy: { updatedAt: 'desc' }
  });

  const allStatuses = await getAllOnboardingStatuses();
  const SLA_HOURS = 48;
  const enrichedCenters = await Promise.all(centers.map(async c => {
    const hrs = Math.round((Date.now() - new Date(c.updatedAt).getTime()) / 3600000);
    const slaBreached = (c.onboardingStatus?.stage === 'operations' && c.onboardingStatus?.state === 'pending') && hrs > SLA_HOURS;
    const universities = await prisma.university.findMany({
      where: { id: { in: c.universityIds || [] }, organizationId: req.user.organizationId, singletonKey: 'primary' },
      select: { id: true, name: true, code: true }
    });
    return {
      ...c,
      status: c.onboardingStatus?.code || c.status,
      hoursAtCurrentStage: hrs,
      slaBreached,
      associatedUniversityIds: universities,
    };
  }));

  const summary = {
    total: enrichedCenters.length,
    pending_verification: enrichedCenters.filter(c => c.onboardingStatus?.stage === 'operations' && c.onboardingStatus?.state === 'pending').length,
    ops_verified: enrichedCenters.filter(c => c.onboardingStatus?.stage === 'finance' && c.onboardingStatus?.state === 'pending').length,
    pending_payment: enrichedCenters.filter(c => c.onboardingStatus?.stage === 'finance' && ['pending', 'resubmitted'].includes(c.onboardingStatus?.state)).length,
    active: enrichedCenters.filter(c => c.status === 'active' || c.onboardingStatus?.state === 'active').length,
    rejected: enrichedCenters.filter(c => c.onboardingStatus?.state === 'rejected' || ['rejected', 'ops_rejected', 'finance_rejected', 'rejected_from_finance'].includes(c.status)).length,
    slaBreached: enrichedCenters.filter(c => c.slaBreached).length,
  };

  res.json({
    success: true,
    data: {
      centers: enrichedCenters,
      summary,
      statuses: allStatuses,
    }
  });
});

export const getStudentEnrollmentOverview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const enrollments = await prisma.enrollment.findMany({
    where: { organizationId: req.user.organizationId },
    include: {
      program: true,
      studyCenter: true,
      session: true
    },
    orderBy: { createdAt: 'desc' }
  });

  const statusCounts: Record<string, number> = {};
  enrollments.forEach(e => {
    statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
  });

  const monthlyMap: Record<string, { month: string; total: number; enrolled: number; pending: number; rejected: number }> = {};
  
  enrollments.forEach(e => {
    const date = new Date(e.createdAt);
    const monthStr = date.toLocaleString('default', { month: 'short', year: '2-digit' });
    
    if (!monthlyMap[monthStr]) {
      monthlyMap[monthStr] = { month: monthStr, total: 0, enrolled: 0, pending: 0, rejected: 0 };
    }
    
    monthlyMap[monthStr].total += 1;
    if (e.status === 'enrolled') {
      monthlyMap[monthStr].enrolled += 1;
    } else if (e.status === 'rejected' || e.status === 'department_rejected') {
      monthlyMap[monthStr].rejected += 1;
    } else {
      monthlyMap[monthStr].pending += 1;
    }
  });

  const sortedMonths = Object.keys(monthlyMap).sort((a, b) => {
    const dateA = new Date('01 ' + a);
    const dateB = new Date('01 ' + b);
    return dateA.getTime() - dateB.getTime();
  });
  
  const monthly = sortedMonths.map(m => monthlyMap[m]);

  res.json({
    success: true,
    data: {
      statusCounts,
      total: enrollments.length,
      enrollments,
      monthly
    }
  });
});
