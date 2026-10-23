// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getSalaryConfigs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const configs = await prisma.salaryConfig.findMany({
    where: { organizationId: req.user.organizationId },
    include: { user: { select: { name: true, email: true, designation: true } } }
  });
  res.json({ success: true, count: configs.length, data: configs });
});

export const getFinanceSalaryConfigs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const configs = await prisma.salaryConfig.findMany({
    where: { organizationId: req.user.organizationId, approvalStatus: 'pending_approval' },
    include: { user: { select: { name: true, email: true, designation: true } } }
  });
  res.json({ success: true, count: configs.length, data: configs });
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

  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

  const leaveRequests = await prisma.leaveRequest.findMany({
    where: {
      organizationId: req.user.organizationId,
      status: 'approved',
      startDate: { gte: startDate },
      endDate: { lte: endDate }
    }
  });

  const data = allocations.map(alloc => {
    const userLeaves = leaveRequests.filter(lr => lr.userId === alloc.userId);
    let usedSick = 0, usedCasual = 0, usedEarned = 0, usedComplementary = 0;
    
    for (const lr of userLeaves) {
      const days = Math.ceil((new Date(lr.endDate).getTime() - new Date(lr.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (lr.type === 'sick') usedSick += days;
      else if (lr.type === 'casual') usedCasual += days;
      else if (lr.type === 'earned') usedEarned += days;
      else if (lr.type === 'compensatory') usedComplementary += days;
    }

    return {
      ...alloc,
      usedSick,
      usedCasual,
      usedEarned,
      usedComplementary
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

  const yearStart = new Date(year, 0, 1);
  const nextYearStart = new Date(year + 1, 0, 1);
  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      userId: req.user.id,
      organizationId: req.user.organizationId,
      status: 'approved',
      startDate: { lt: nextYearStart },
      endDate: { gte: yearStart }
    },
    select: { type: true, startDate: true, endDate: true, isHalfDay: true }
  });

  const used = { sickLeave: 0, casualLeave: 0, earnedLeave: 0, complementaryLeave: 0 };
  for (const leave of approvedLeaves) {
    const start = leave.startDate > yearStart ? leave.startDate : yearStart;
    const lastDay = new Date(nextYearStart.getTime() - 1);
    const end = leave.endDate < lastDay ? leave.endDate : lastDay;
    const days = leave.isHalfDay
      ? 0.5
      : Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

    if (leave.type === 'sick') used.sickLeave += days;
    else if (leave.type === 'casual') used.casualLeave += days;
    else if (leave.type === 'earned') used.earnedLeave += days;
    else if (leave.type === 'compensatory') used.complementaryLeave += days;
  }

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
  const config = await prisma.salaryConfig.update({
    where: { id: req.params.id },
    data: { approvalStatus: 'approved', approvedBy: req.user.id, approvedAt: new Date() }
  });
  res.json({ success: true, data: config });
});
