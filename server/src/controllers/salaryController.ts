// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const calculateUsedLeaveByType = (leaveRequests: any[], attendances: any[], year: number) => {
  const yearStart = new Date(year, 0, 1);
  const nextYearStart = new Date(year + 1, 0, 1);
  const todayStart = startOfLocalDay(new Date());
  const attendanceByUserAndDate = new Map<string, any>();
  for (const attendance of attendances) {
    attendanceByUserAndDate.set(
      `${attendance.userId}:${localDateKey(new Date(attendance.date))}`,
      attendance
    );
  }

  const usedByUserAndType = new Map<string, {
    sickLeave: number;
    casualLeave: number;
    earnedLeave: number;
    complementaryLeave: number;
  }>();
  const deductedByUserAndDate = new Map<string, number>();
  const typeByLeave: Record<string, keyof ReturnType<typeof emptyUsedLeave>> = {
    sick: 'sickLeave',
    casual: 'casualLeave',
    earned: 'earnedLeave',
    compensatory: 'complementaryLeave',
  };

  const sortedLeaves = [...leaveRequests].sort((a, b) =>
    a.startDate.getTime() - b.startDate.getTime() || a.createdAt.getTime() - b.createdAt.getTime()
  );
  for (const leave of sortedLeaves) {
    const leaveType = typeByLeave[leave.type];
    if (!leaveType) continue;

    const firstDate = startOfLocalDay(leave.startDate > yearStart ? leave.startDate : yearStart);
    const lastLeaveDate = leave.endDate < nextYearStart ? leave.endDate : new Date(nextYearStart.getTime() - 1);
    const lastDate = startOfLocalDay(lastLeaveDate);
    const completedThrough = new Date(todayStart);
    completedThrough.setDate(completedThrough.getDate() - 1);
    if (lastDate > completedThrough) lastDate.setTime(completedThrough.getTime());
    if (firstDate > lastDate) continue;

    let halfDayUnitsRemaining = leave.isHalfDay ? 0.5 : Number.POSITIVE_INFINITY;
    for (const date = new Date(firstDate); date <= lastDate; date.setDate(date.getDate() + 1)) {
      if (halfDayUnitsRemaining <= 0) break;

      const dateKey = localDateKey(date);
      const userDateKey = `${leave.userId}:${dateKey}`;
      const attendance = attendanceByUserAndDate.get(userDateKey);
      let absenceUnits = 1;
      if (attendance) {
        if (attendance.status === 'half_day') {
          absenceUnits = 0.5;
        } else if (
          attendance.checkIn &&
          ['present', 'late'].includes(attendance.status)
        ) {
          absenceUnits = 0;
        }
      }

      const alreadyDeducted = deductedByUserAndDate.get(userDateKey) || 0;
      const requestUnits = leave.isHalfDay ? halfDayUnitsRemaining : 1;
      const unitsToDeduct = Math.min(requestUnits, Math.max(0, absenceUnits - alreadyDeducted));
      if (unitsToDeduct <= 0) continue;

      let used = usedByUserAndType.get(leave.userId);
      if (!used) {
        used = emptyUsedLeave();
        usedByUserAndType.set(leave.userId, used);
      }
      used[leaveType] += unitsToDeduct;
      deductedByUserAndDate.set(userDateKey, alreadyDeducted + unitsToDeduct);
      halfDayUnitsRemaining -= unitsToDeduct;
    }
  }

  return usedByUserAndType;
};

function emptyUsedLeave() {
  return { sickLeave: 0, casualLeave: 0, earnedLeave: 0, complementaryLeave: 0 };
}

export const getSalaryConfigs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const configs = await prisma.salaryConfig.findMany({
    where: { organizationId: req.user.organizationId },
    include: { user: { select: { name: true, email: true, designation: true } } }
  });
  res.json({ success: true, count: configs.length, data: configs });
});

const SALARY_APPROVAL_STATUSES = ['pending_approval', 'approved', 'rejected'];

// Allowances are saved either as { hra: 1000 } or as [{ name, amount }]; the approval screen reads a map
const toAmountMap = (value: any): Record<string, number> => {
  if (Array.isArray(value)) {
    return value.reduce((map, item, index) => {
      const key = item?.name || item?.type || item?.label || `item ${index + 1}`;
      map[key] = (map[key] || 0) + (Number(item?.amount) || 0);
      return map;
    }, {} as Record<string, number>);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, amount]) => [key, Number(amount) || 0]));
  }
  return {};
};

export const getFinanceSalaryConfigs = asyncHandler(async (req: AuthRequest, res: Response) => {
  // ?status= pending_approval | approved | rejected; no status returns every salary configuration
  const status = SALARY_APPROVAL_STATUSES.includes(req.query.status as string) ? req.query.status : undefined;
  const configs = await prisma.salaryConfig.findMany({
    where: { organizationId: req.user.organizationId, ...(status ? { approvalStatus: status } : {}) },
    include: {
      user: {
        select: {
          id: true, name: true, email: true, designation: true, role: true,
          department: { select: { name: true } }
        }
      },
      creator: { select: { name: true, email: true } },
      approver: { select: { name: true, email: true } }
    },
    orderBy: { updatedAt: 'desc' }
  });

  const counts = await prisma.salaryConfig.groupBy({
    by: ['approvalStatus'],
    where: { organizationId: req.user.organizationId },
    _count: { _all: true }
  });
  const summary = { pending_approval: 0, approved: 0, rejected: 0 };
  for (const row of counts) summary[row.approvalStatus] = row._count._all;

  const data = configs.map(config => {
    const deductions = toAmountMap(config.deductions);
    // Statutory deductions are stored in their own columns
    if (config.professionalTax) deductions.professionalTax = config.professionalTax;
    if (config.labourWelfareFund) deductions.labourWelfareFund = config.labourWelfareFund;
    if (config.tds) deductions.tds = config.tds;
    return {
      ...config,
      allowances: toAmountMap(config.allowances),
      deductions,
      user: config.user ? { ...config.user, departmentId: config.user.department || null } : null,
      createdBy: config.creator ? { name: config.creator.name, email: config.creator.email } : null,
      approvedBy: config.approver ? { name: config.approver.name, email: config.approver.email } : null,
    };
  });

  res.json({ success: true, count: data.length, summary, data });
});

export const getSalaryConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
  const config = await prisma.salaryConfig.findUnique({ where: { userId: req.params.userId } });
  if (!config) {
    res.status(404).json({ success: false, message: 'Salary config not found' });
    return;
  }
  res.json({ success: true, data: config });
});

export const upsertSalaryConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
  let { effectiveFrom, basicSalary, allowances, professionalTax, labourWelfareFund, tds, ...salaryData } = req.body;
  
  // Calculate total allowances
  let totalAllowances = 0;
  if (Array.isArray(allowances)) {
    totalAllowances = allowances.reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
  } else if (typeof allowances === 'object' && allowances !== null) {
    totalAllowances = Object.values(allowances).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0);
  }

  const grossSalary = Number(basicSalary) + totalAllowances;
  if (Number(basicSalary) < grossSalary * 0.5) {
    return res.status(400).json({ 
      success: false, 
      message: 'Basic Salary must be at least 50% of Gross Salary.' 
    });
  }

  // Statutory Calculations
  let pfDeduction = 0;
  if (Number(basicSalary) <= 15000) {
    // 12% of basic
    pfDeduction = Number(basicSalary) * 0.12;
  }

  const deductions = req.body.deductions || {};
  deductions['PF'] = pfDeduction;

  const config = await prisma.salaryConfig.upsert({
    where: { userId: req.params.userId },
    update: { 
      ...salaryData,
      basicSalary: Number(basicSalary),
      allowances: allowances || [],
      deductions,
      professionalTax: Number(professionalTax || 0),
      labourWelfareFund: Number(labourWelfareFund || 0),
      tds: Number(tds || 0),
      organizationId: req.user.organizationId, 
      createdBy: req.user.id 
    },
    create: { 
      ...salaryData,
      basicSalary: Number(basicSalary),
      allowances: allowances || [],
      deductions,
      professionalTax: Number(professionalTax || 0),
      labourWelfareFund: Number(labourWelfareFund || 0),
      tds: Number(tds || 0),
      userId: req.params.userId, 
      organizationId: req.user.organizationId, 
      createdBy: req.user.id 
    }
  });
  res.json({ success: true, data: config });
});

export const deleteSalaryConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
  const config = await prisma.salaryConfig.findUnique({ where: { userId: req.params.userId } });
  if (!config) {
    res.status(404).json({ success: false, message: 'Salary config not found' });
    return;
  }
  await prisma.salaryConfig.delete({ where: { userId: req.params.userId } });
  res.json({ success: true, data: {} });
});

export const getLeaveAllocations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const allocations = await prisma.leaveAllocation.findMany({
    where: { organizationId: req.user.organizationId, year },
    include: { user: { select: { name: true, email: true, role: true, designation: true } } }
  });

  const yearStart = new Date(year, 0, 1);
  const nextYearStart = new Date(year + 1, 0, 1);
  const [leaveRequests, attendances] = await Promise.all([
    prisma.leaveRequest.findMany({
    where: {
      organizationId: req.user.organizationId,
      status: 'approved',
      startDate: { lt: nextYearStart },
      endDate: { gte: yearStart },
    },
    select: { userId: true, type: true, startDate: true, endDate: true, isHalfDay: true, createdAt: true },
    }),
    allocations.length
      ? prisma.attendance.findMany({
        where: {
          organizationId: req.user.organizationId,
          userId: { in: allocations.map((allocation: any) => allocation.userId) },
          date: { gte: yearStart, lt: nextYearStart },
        },
        select: { userId: true, date: true, status: true, checkIn: true },
      })
      : Promise.resolve([]),
  ]);
  const usedByUser = calculateUsedLeaveByType(leaveRequests, attendances, year);

  const data = allocations.map(alloc => {
    const used = usedByUser.get(alloc.userId) || emptyUsedLeave();
    return {
      ...alloc,
      usedSick: used.sickLeave,
      usedCasual: used.casualLeave,
      usedEarned: used.earnedLeave,
      usedComplementary: used.complementaryLeave,
    };
  });

  res.json({ success: true, count: data.length, data });
});

export const getLeaveAllocation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const allocation = await prisma.leaveAllocation.findUnique({
    where: { userId_year: { userId: req.params.userId, year } }
  });
  res.json({ success: true, data: allocation });
});

export const getMyLeaveAllocation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const allocation = await prisma.leaveAllocation.findUnique({
    where: { userId_year: { userId: req.user.id, year } }
  });

  if (!allocation) {
    res.json({ success: true, data: null });
    return;
  }

  const [approvedLeaves, attendances] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        userId: req.user.id,
        organizationId: req.user.organizationId,
        status: 'approved',
        startDate: { lt: new Date(year + 1, 0, 1) },
        endDate: { gte: new Date(year, 0, 1) },
      },
      select: { userId: true, type: true, startDate: true, endDate: true, isHalfDay: true, createdAt: true },
    }),
    prisma.attendance.findMany({
      where: {
        userId: req.user.id,
        organizationId: req.user.organizationId,
        date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      },
      select: { userId: true, date: true, status: true, checkIn: true },
    }),
  ]);
  const used = calculateUsedLeaveByType(approvedLeaves, attendances, year).get(req.user.id) || emptyUsedLeave();

  res.json({ success: true, data: { ...allocation, used } });
});

export const upsertLeaveAllocation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const year = Number(req.body.year) || new Date().getFullYear();
  const allocation = await prisma.leaveAllocation.upsert({
    where: { userId_year: { userId: req.params.userId, year } },
    update: { ...req.body, createdBy: req.user.id },
    create: { ...req.body, userId: req.params.userId, organizationId: req.user.organizationId, year, createdBy: req.user.id }
  });
  res.json({ success: true, data: allocation });
});

export const bulkInitLeaveAllocations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { year = new Date().getFullYear(), casualLeave, sickLeave, earnedLeave, complementaryLeave } = req.body;
  const casualNum = Number(casualLeave) || 0;
  const sickNum = Number(sickLeave) || 0;
  const earnedNum = Number(earnedLeave) || 0;
  const compNum = Number(complementaryLeave) || 0;

  const users = await prisma.user.findMany({ 
    where: { 
      organizationId: req.user.organizationId, 
      status: 'active' as any,
      role: {
        notIn: ['ceo', 'org_admin', 'superadmin', 'center_admin', 'student']
      }
    } 
  });
  
  const results = await Promise.all(users.map(u => 
    prisma.leaveAllocation.upsert({
      where: { userId_year: { userId: u.id, year } },
      update: { casualLeave: casualNum, sickLeave: sickNum, earnedLeave: earnedNum, complementaryLeave: compNum },
      create: { userId: u.id, organizationId: req.user.organizationId, year, casualLeave: casualNum, sickLeave: sickNum, earnedLeave: earnedNum, complementaryLeave: compNum, createdBy: req.user.id }
    })
  ));

  res.json({ success: true, message: `Initialized for ${results.length} users` });
});

export const generateSmartPayroll = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { month } = req.body;
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    res.status(400).json({ success: false, message: 'Month is required in YYYY-MM format' });
    return;
  }

  const [year, monthNumber] = month.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, monthNumber - 1, 1));
  const endDate = new Date(Date.UTC(year, monthNumber, 1));

  const users = await prisma.user.findMany({
    where: {
      organizationId: req.user.organizationId,
      status: 'active' as any,
      role: { notIn: ['ceo', 'org_admin', 'superadmin', 'center_admin', 'student'] }
    },
    include: { salaryConfig: true }
  });

  const configuredUsers = users.filter(user => user.salaryConfig);
  const attendance = await prisma.attendance.findMany({
    where: {
      organizationId: req.user.organizationId,
      userId: { in: configuredUsers.map(user => user.id) },
      date: { gte: startDate, lt: endDate },
      lateMinutes: { gt: 0 }
    },
    select: { userId: true, lateMinutes: true }
  });
  const lateMinutesByUser = new Map<string, number>();
  for (const record of attendance) {
    lateMinutesByUser.set(
      record.userId,
      (lateMinutesByUser.get(record.userId) || 0) + record.lateMinutes
    );
  }

  const toAmountRecord = (value: any): Record<string, number> => {
    if (Array.isArray(value)) {
      return Object.fromEntries(value.map((item, index) => [
        item?.name || item?.label || `item_${index + 1}`,
        Number(item?.amount) || 0
      ]));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, amount]: [string, any]) => [
        key,
        Number(amount?.amount ?? amount) || 0
      ]));
    }
    return {};
  };

  const generated = [];
  const errors: string[] = [];
  for (const user of users) {
    const config = user.salaryConfig;
    if (!config) {
      errors.push(`${user.name}: missing salary configuration`);
      continue;
    }

    const existingPayroll = await prisma.payroll.findUnique({
      where: { employeeId_month: { employeeId: user.id, month } },
      select: { id: true, status: true }
    });
    if (existingPayroll && existingPayroll.status !== 'draft') {
      errors.push(`${user.name}: payroll for ${month} is already ${existingPayroll.status}`);
      continue;
    }

    const basicSalary = Number(config.basicSalary) || 0;
    const allowances = toAmountRecord(config.allowances);
    const deductions = toAmountRecord(config.deductions);
    const professionalTax = Number(config.professionalTax) || 0;
    const labourWelfareFund = Number(config.labourWelfareFund) || 0;
    const tds = Number(config.tds) || 0;
    const lateDeduction = (lateMinutesByUser.get(user.id) || 0) *
      (Number(config.lateDeductionPerMinute) || 0);

    deductions.professionalTax = professionalTax;
    deductions.labourWelfareFund = labourWelfareFund;
    deductions.tds = tds;
    deductions.lateAttendance = lateDeduction;

    const grossSalary = basicSalary + Object.values(allowances).reduce((total, amount) => total + amount, 0);
    const netSalary = grossSalary - Object.values(deductions).reduce((total, amount) => total + amount, 0);
    const payrollData = {
      organizationId: req.user.organizationId,
      basicSalary,
      professionalTax,
      labourWelfareFund,
      tds,
      allowances,
      deductions,
      grossSalary,
      netSalary
    };

    const payroll = await prisma.payroll.upsert({
      where: { employeeId_month: { employeeId: user.id, month } },
      update: payrollData,
      create: {
        ...payrollData,
        employeeId: user.id,
        month,
        status: 'draft'
      }
    });
    generated.push(payroll);
  }

  res.status(201).json({ success: true, count: generated.length, data: generated, errors });
});

export const approveSalaryConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
  // Finance sends { action: 'reject', remarks } to reject; anything else approves as before
  if (req.body?.action === 'reject') {
    const remarks = typeof req.body.remarks === 'string' ? req.body.remarks.trim() : '';
    if (!remarks) {
      res.status(400).json({ success: false, message: 'A reason is required to reject a salary configuration' });
      return;
    }
    const rejected = await prisma.salaryConfig.update({
      where: { id: req.params.id },
      data: { approvalStatus: 'rejected', rejectedRemarks: remarks, approvedBy: req.user.id, approvedAt: new Date() }
    });
    res.json({ success: true, data: rejected });
    return;
  }

  const config = await prisma.salaryConfig.update({
    where: { id: req.params.id },
    data: { approvalStatus: 'approved', approvedBy: req.user.id, approvedAt: new Date() }
  });
  res.json({ success: true, data: config });
});
