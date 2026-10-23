// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const punchIn = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { isWFH = false, isHalfDay = false } = req.body;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkInTime = new Date();
  
  // Find employee and shift
  const employee = await prisma.employeeProfile.findUnique({
    where: { userId: req.user.id },
    include: { shift: true }
  });

  let isLate = false;
  let lateMinutes = 0;
  let status = 'present';

  if (employee?.shift && !employee.shift.isOpenShift && employee.shift.startTime) {
    // Calculate late minutes
    const [hours, minutes] = employee.shift.startTime.split(':').map(Number);
    const expectedTime = new Date(today);
    expectedTime.setHours(hours, minutes, 0, 0);
    
    const graceTime = employee.shift.graceTimeMinutes * 60000; // in milliseconds
    const diff = checkInTime.getTime() - expectedTime.getTime();
    
    if (diff > graceTime) {
      isLate = true;
      lateMinutes = Math.floor(diff / 60000);
      status = 'late';
    }
  }

  if (isHalfDay) status = 'half_day';

  const attendance = await prisma.attendance.create({
    data: { 
      userId: req.user.id, 
      organizationId: req.user.organizationId, 
      date: today, 
      checkIn: checkInTime, 
      status: status as any,
      isLate,
      lateMinutes,
      isWFH,
      isHalfDay
    }
  });
  res.status(201).json({ success: true, data: attendance });
});

export const punchOut = asyncHandler(async (req: AuthRequest, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const attendance = await prisma.attendance.updateMany({
    where: { userId: req.user.id, date: today },
    data: { checkOut: new Date() }
  });
  res.json({ success: true, data: attendance });
});

export const getTodayAttendance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const attendance = await prisma.attendance.findFirst({ where: { userId: req.user.id, date: today } });
  res.json({ success: true, data: attendance });
});

export const getMonthlyLateSummary = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: {} });
});

export const getAttendances = asyncHandler(async (req: AuthRequest, res: Response) => {
  const where: any = { organizationId: req.user.organizationId };
  if (req.query.employeeId) {
    where.userId = req.query.employeeId;
  }

  if (req.query.startDate || req.query.endDate) {
    where.date = {};
    if (req.query.startDate) {
      const startDate = new Date(`${req.query.startDate}T00:00:00.000Z`);
      if (Number.isNaN(startDate.getTime())) {
        res.status(400).json({ success: false, message: 'Invalid start date' });
        return;
      }
      where.date.gte = startDate;
    }
    if (req.query.endDate) {
      const endDate = new Date(`${req.query.endDate}T23:59:59.999Z`);
      if (Number.isNaN(endDate.getTime())) {
        res.status(400).json({ success: false, message: 'Invalid end date' });
        return;
      }
      where.date.lte = endDate;
    }
    if (where.date.gte && where.date.lte && where.date.gte > where.date.lte) {
      res.status(400).json({ success: false, message: 'Start date must be on or before end date' });
      return;
    }
  }

  const attendances = await prisma.attendance.findMany({ 
    where,
    include: { user: true },
    orderBy: { date: 'desc' }
  });
  const mapped = attendances.map(a => ({
    ...a,
    employeeId: a.user ? { id: a.user.id, name: a.user.name, email: a.user.email, designation: a.user.designation } : null
  }));
  res.json({ success: true, count: mapped.length, data: mapped });
});
export const getAttendance = getAttendances;

export const getAttendanceById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attendance = await prisma.attendance.findUnique({ where: { id: req.params.id }, include: { user: true } });
  if (!attendance) {
    res.status(404).json({ success: false, message: 'Attendance record not found' });
    return;
  }
  res.json({ success: true, data: attendance });
});

export const createAttendance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attendance = await prisma.attendance.upsert({
    where: {
      userId_date: {
        userId: req.body.userId,
        date: new Date(req.body.date)
      }
    },
    update: { ...req.body, organizationId: req.user.organizationId },
    create: { ...req.body, organizationId: req.user.organizationId }
  });
  res.status(201).json({ success: true, data: attendance });
});
export const markAttendance = createAttendance;

export const updateAttendance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attendance = await prisma.attendance.findUnique({ where: { id: req.params.id } });
  if (!attendance) {
    res.status(404).json({ success: false, message: 'Attendance record not found' });
    return;
  }
  const updatedAttendance = await prisma.attendance.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: updatedAttendance });
});

export const deleteAttendance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attendance = await prisma.attendance.findUnique({ where: { id: req.params.id } });
  if (!attendance) {
    res.status(404).json({ success: false, message: 'Attendance record not found' });
    return;
  }
  await prisma.attendance.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: {} });
});

export const getHRSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const settings = await prisma.hRSettings.findFirst({ where: { organizationId: req.user.organizationId } });
  res.json({ success: true, data: settings });
});

export const createOrUpdateHRSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const settings = await prisma.hRSettings.upsert({
    where: { organizationId: req.user.organizationId },
    update: req.body,
    create: { ...req.body, organizationId: req.user.organizationId }
  });
  res.json({ success: true, data: settings });
});

export const biometricSync = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, message: 'Biometric sync triggered' });
});

export const getActivityReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { date, departmentId } = req.query;
  const targetDate = date ? new Date(date as string) : new Date();
  
  // Set to midnight UTC for comparison
  const startOfDay = new Date(targetDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  
  const endOfDay = new Date(targetDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  let userWhere: any = { 
    organizationId: req.user.organizationId, 
    status: 'active' as any,
    role: { notIn: ['student', 'center_admin', 'superadmin'] }
  };
  if (departmentId) {
    userWhere.departmentId = departmentId as string;
  }

  const users = await prisma.user.findMany({
    where: userWhere,
    include: {
      department: true,
      attendances: {
        where: {
          date: { gte: startOfDay, lte: endOfDay }
        }
      },
      assignedTasks: {
        where: {
          OR: [
            { status: { not: 'completed' as any } },
            { completedAt: { gte: startOfDay, lte: endOfDay } }
          ]
        }
      },
      auditLogs: {
        where: {
          timestamp: { gte: startOfDay, lte: endOfDay }
        }
      }
    }
  });

  const data = users.map(u => {
    const att = u.attendances[0];
    
    // Tasks logic
    const totalTasks = u.assignedTasks.length;
    const completedToday = u.assignedTasks.filter(t => t.status === ('completed' as any) && t.completedAt && t.completedAt >= startOfDay && t.completedAt <= endOfDay).length;
    const inProgress = u.assignedTasks.filter(t => t.status === ('in_progress' as any)).length;
    
    // Safe check for overdue tasks based on deadline
    const now = new Date();
    const overdue = u.assignedTasks.filter(t => t.status === ('overdue' as any) || (t.deadline && new Date(t.deadline) < now && t.status !== ('completed' as any))).length;

    // ERP Actions
    const erpActions = u.auditLogs.length;
    const erpActivity: Record<string, number> = {};
    u.auditLogs.forEach(log => {
      erpActivity[log.action] = (erpActivity[log.action] || 0) + 1;
    });

    // Simulate Productive & Wasted time (heuristic: 1 action = ~6 minutes / 0.1 hr, capped by workingHours)
    let productiveHours = 0;
    let timeWasted = 0;
    if (att && att.workingHours) {
      productiveHours = Math.min(att.workingHours, Number((erpActions * 0.1).toFixed(1)));
      timeWasted = Math.max(0, Number((att.workingHours - productiveHours).toFixed(1)));
    }

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      department: u.department?.name || '-',
      checkIn: att?.checkIn || null,
      checkOut: att?.checkOut || null,
      status: att?.status || 'absent',
      workingHours: att?.workingHours || 0,
      isLate: att?.isLate || false,
      lateMinutes: att?.lateMinutes || 0,
      tasks: {
        total: totalTasks,
        completedToday,
        inProgress,
        overdue,
        list: u.assignedTasks
      },
      erpActions,
      erpActivity,
      productiveHours,
      timeWasted
    };
  });

  res.json({ success: true, data, scheduledHours: 8, breakMinutes: 60 });
});

export const getMyAttendance = asyncHandler(async (req: AuthRequest, res: Response) => {
  const attendances = await prisma.attendance.findMany({ 
    where: { userId: req.user.id }, 
    include: { user: true },
    orderBy: { date: 'desc' } 
  });
  const mapped = attendances.map(a => ({
    ...a,
    employeeId: a.user ? { id: a.user.id, name: a.user.name, email: a.user.email, designation: a.user.designation } : null
  }));
  res.json({ success: true, data: mapped });
});

export const getMyAttendanceSummary = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: {} });
});
