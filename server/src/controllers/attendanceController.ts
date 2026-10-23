// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const getOfficeHoursForDate = (settings: any, date: Date, useUTC = false) => {
  const officeHours = settings?.officeHours && typeof settings.officeHours === 'object'
    ? settings.officeHours
    : {};
  const dayName = date.toLocaleDateString('en-US', {
    weekday: 'long',
    ...(useUTC ? { timeZone: 'UTC' } : {}),
  });
  const override = Array.isArray(officeHours.dayOverrides)
    ? officeHours.dayOverrides.find((item: any) => item?.day === dayName)
    : null;
  const rawBreakDuration = Number(override?.breakDurationMinutes ?? officeHours.breakDurationMinutes ?? 60);

  return {
    ...officeHours,
    ...override,
    checkInTime: override?.checkInTime || officeHours.checkInTime || '09:00',
    checkOutTime: override?.checkOutTime || officeHours.checkOutTime || '18:00',
    graceMinutes: Math.max(0, Number(officeHours.graceMinutes) || 0),
    breakDurationMinutes: Number.isFinite(rawBreakDuration) ? Math.max(0, rawBreakDuration) : 60,
    breakStartTime: officeHours.breakStartTime || '13:00',
    breakEndTime: officeHours.breakEndTime || '14:00',
  };
};

const timeInMinutes = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
};

const getDistanceInMeters = (latitude: number, longitude: number, targetLatitude: number, targetLongitude: number) => {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;
  const latitudeDifference = radians(targetLatitude - latitude);
  const longitudeDifference = radians(targetLongitude - longitude);
  const value = Math.min(1,
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(radians(latitude)) * Math.cos(radians(targetLatitude)) * Math.sin(longitudeDifference / 2) ** 2
  );
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const configuredAttendanceLocations = (settings: any) => {
  const locations = Array.isArray(settings?.locations)
    ? settings.locations.filter((location: any) => location && typeof location === 'object')
    : [];
  if (locations.length) {
    return locations.map((location: any) => ({
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      allowedRadius: Number(location.allowedRadius),
      name: location.name,
    }));
  }

  const legacyLocation = settings?.location;
  if (!legacyLocation || typeof legacyLocation !== 'object') return [];
  return [{
    latitude: Number(legacyLocation.officeLatitude),
    longitude: Number(legacyLocation.officeLongitude),
    allowedRadius: Number(legacyLocation.allowedRadius),
    name: 'Office',
  }];
};

const getBreakOverlapMinutes = (checkIn: Date, checkOut: Date, officeHours: any) => {
  const breakStartMinutes = timeInMinutes(officeHours.breakStartTime);
  const breakEndMinutes = timeInMinutes(officeHours.breakEndTime);
  if (breakStartMinutes === null || breakEndMinutes === null || breakEndMinutes <= breakStartMinutes) {
    return 0;
  }

  const breakStart = new Date(checkIn);
  breakStart.setHours(Math.floor(breakStartMinutes / 60), breakStartMinutes % 60, 0, 0);
  const breakEnd = new Date(checkIn);
  breakEnd.setHours(Math.floor(breakEndMinutes / 60), breakEndMinutes % 60, 0, 0);
  const overlapMinutes = Math.max(0, (Math.min(checkOut.getTime(), breakEnd.getTime()) - Math.max(checkIn.getTime(), breakStart.getTime())) / 60000);
  const configuredDuration = Number(officeHours.breakDurationMinutes);
  return Number.isFinite(configuredDuration) && configuredDuration >= 0
    ? Math.min(overlapMinutes, configuredDuration)
    : overlapMinutes;
};

export const punchIn = asyncHandler(async (req: AuthRequest, res: Response) => {
  const isWFH = req.body?.isWFH === true;
  const isHalfDay = req.body?.isHalfDay === true;
  const checkInTime = new Date();
  const today = new Date(checkInTime);
  today.setHours(0, 0, 0, 0);

  const latitude = Number(req.body?.latitude);
  const longitude = Number(req.body?.longitude);
  if (
    req.body?.latitude === null ||
    req.body?.latitude === undefined ||
    req.body?.longitude === null ||
    req.body?.longitude === undefined ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    res.status(400).json({ success: false, message: 'A valid punch-in location is required' });
    return;
  }

  const settings = await prisma.hRSettings.findUnique({
    where: { organizationId: req.user.organizationId },
  });
  const requireLocation = settings?.requireLocationForCheckIn
    ?? settings?.requireLocation
    ?? settings?.location?.requireLocationForCheckIn
    ?? true;
  if (requireLocation && !isWFH) {
    const configuredLocations = configuredAttendanceLocations(settings);
    if (!configuredLocations.length) {
      res.status(400).json({ success: false, message: 'Attendance locations are not configured. Contact HR.' });
      return;
    }

    const validLocations = configuredLocations.filter((location: any) =>
      Number.isFinite(location.latitude) &&
      Number.isFinite(location.longitude) &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      location.longitude >= -180 &&
      location.longitude <= 180 &&
      Number.isFinite(location.allowedRadius) &&
      location.allowedRadius >= 0
    );
    if (!validLocations.length) {
      res.status(400).json({ success: false, message: 'Attendance location settings are invalid. Contact HR.' });
      return;
    }

    const withinOfficeRadius = validLocations.some((location: any) =>
      getDistanceInMeters(latitude, longitude, location.latitude, location.longitude) <= location.allowedRadius
    );
    if (!withinOfficeRadius) {
      res.status(403).json({ success: false, message: 'Punch-in is not allowed outside an approved attendance location.' });
      return;
    }
  }

  const employee = await prisma.employeeProfile.findUnique({
    where: { userId: req.user.id },
    include: { shift: true },
  });
  const officeHours = getOfficeHoursForDate(settings, checkInTime);

  let isLate = false;
  let lateMinutes = 0;
  let status = 'present';

  const dayName = checkInTime.toLocaleDateString('en-US', { weekday: 'long' });
  const workingDays = Array.isArray(officeHours.workingDays)
    ? officeHours.workingDays
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const hasAssignedShift = Boolean(employee?.shift && !employee.shift.isOpenShift && employee.shift.startTime);
  const isScheduledWorkDay = hasAssignedShift || workingDays.includes(dayName);
  const scheduledCheckIn = employee?.shift && !employee.shift.isOpenShift && employee.shift.startTime
    ? employee.shift.startTime
    : officeHours.checkInTime;
  const graceMinutes = employee?.shift && !employee.shift.isOpenShift && employee.shift.startTime
    ? employee.shift.graceTimeMinutes
    : officeHours.graceMinutes;
  const scheduledMinutes = timeInMinutes(scheduledCheckIn);
  if (isScheduledWorkDay && scheduledMinutes !== null) {
    const expectedTime = new Date(today);
    expectedTime.setHours(Math.floor(scheduledMinutes / 60), scheduledMinutes % 60, 0, 0);

    const graceTime = Math.max(0, Number(graceMinutes) || 0) * 60000;
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
      checkInLocation: {
        latitude,
        longitude,
        address: typeof req.body?.address === 'string' ? req.body.address : null,
      },
      isLate,
      lateMinutes,
      isWFH,
      isHalfDay
    }
  });
  res.status(201).json({ success: true, data: attendance });
});

export const punchOut = asyncHandler(async (req: AuthRequest, res: Response) => {
  const checkOutTime = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const attendance = await prisma.attendance.findUnique({
    where: { userId_date: { userId: req.user.id, date: today } },
  });
  if (!attendance) {
    res.status(404).json({ success: false, message: 'Punch in before punching out' });
    return;
  }
  if (attendance.checkOut) {
    res.status(400).json({ success: false, message: 'You have already punched out today' });
    return;
  }

  const latitude = Number(req.body?.latitude);
  const longitude = Number(req.body?.longitude);
  const hasValidLocation =
    req.body?.latitude !== null &&
    req.body?.latitude !== undefined &&
    req.body?.longitude !== null &&
    req.body?.longitude !== undefined &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
  const settings = await prisma.hRSettings.findUnique({
    where: { organizationId: req.user.organizationId },
  });
  const officeHours = getOfficeHoursForDate(settings, checkOutTime);
  const breakMinutes = getBreakOverlapMinutes(attendance.checkIn || checkOutTime, checkOutTime, officeHours);
  const workedMinutes = Math.max(
    0,
    (checkOutTime.getTime() - (attendance.checkIn || checkOutTime).getTime()) / 60000 - breakMinutes
  );
  const updatedAttendance = await prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      checkOut: checkOutTime,
      workingHours: Number((workedMinutes / 60).toFixed(2)),
      ...(hasValidLocation ? {
        checkOutLocation: {
          latitude,
          longitude,
          address: typeof req.body?.address === 'string' ? req.body.address : null,
        },
      } : {}),
    },
  });
  res.json({ success: true, data: updatedAttendance });
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

  const parseLocalDate = (value: unknown, endOfDay = false) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      return null;
    }
    if (endOfDay) {
      parsed.setHours(23, 59, 59, 999);
    } else {
      parsed.setHours(0, 0, 0, 0);
    }
    return parsed;
  };

  if (req.query.startDate || req.query.endDate) {
    where.date = {};
    if (req.query.startDate) {
      const startDate = parseLocalDate(req.query.startDate);
      if (!startDate) {
        res.status(400).json({ success: false, message: 'Invalid start date' });
        return;
      }
      where.date.gte = startDate;
    }
    if (req.query.endDate) {
      const endDate = parseLocalDate(req.query.endDate, true);
      if (!endDate) {
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
  const dateValue = typeof date === 'string' ? date : new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    res.status(400).json({ success: false, message: 'Invalid report date' });
    return;
  }
  const [year, month, day] = dateValue.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  if (targetDate.getFullYear() !== year || targetDate.getMonth() !== month - 1 || targetDate.getDate() !== day) {
    res.status(400).json({ success: false, message: 'Invalid report date' });
    return;
  }
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const settings = await prisma.hRSettings.findUnique({
    where: { organizationId: req.user.organizationId },
  });
  const officeHours = getOfficeHoursForDate(settings, targetDate);
  const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' });
  const workingDays = Array.isArray(officeHours.workingDays)
    ? officeHours.workingDays
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const isScheduledWorkDay = workingDays.includes(dayName);
  const checkInMinutes = timeInMinutes(officeHours.checkInTime);
  const checkOutMinutes = timeInMinutes(officeHours.checkOutTime);
  let scheduledSpanMinutes = checkInMinutes !== null && checkOutMinutes !== null
    ? checkOutMinutes - checkInMinutes
    : 8 * 60;
  if (scheduledSpanMinutes < 0) scheduledSpanMinutes += 24 * 60;
  const scheduledMinutes = Math.max(0, scheduledSpanMinutes - officeHours.breakDurationMinutes);
  const scheduledHours = Number((scheduledMinutes / 60).toFixed(2));

  const userWhere: any = {
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
        },
        orderBy: { timestamp: 'desc' },
      }
    }
  });

  const data = users.map(u => {
    const att = u.attendances[0];
    let actualWorkingHours = 0;
    if (att?.checkIn) {
      const reportEnd = new Date(Math.min(
        (att.checkOut || new Date()).getTime(),
        endOfDay.getTime()
      ));
      const reportStart = new Date(att.checkIn);
      if (reportEnd > reportStart) {
        const breakMinutes = getBreakOverlapMinutes(reportStart, reportEnd, officeHours);
        actualWorkingHours = Number(Math.max(
          0,
          (reportEnd.getTime() - reportStart.getTime()) / 3600000 - breakMinutes / 60
        ).toFixed(2));
      }
    }

    const totalTasks = u.assignedTasks.length;
    const completedToday = u.assignedTasks.filter(t => t.status === ('completed' as any) && t.completedAt && t.completedAt >= startOfDay && t.completedAt <= endOfDay).length;
    const inProgress = u.assignedTasks.filter(t => t.status === ('in_progress' as any)).length;

    const now = new Date();
    const overdue = u.assignedTasks.filter(t => t.status === ('overdue' as any) || (t.deadline && new Date(t.deadline) < now && t.status !== ('completed' as any))).length;

    const erpActions = u.auditLogs.length;
    const erpActivity: Record<string, number> = {};
    u.auditLogs.forEach(log => {
      const activityType = log.entityType === 'UserActivity'
        ? `${log.action} ${((log.newValue as any)?.route || '').split('/').filter(Boolean).slice(-1)[0] || 'activity'}`
        : `${log.action} ${log.entityType}`;
      erpActivity[activityType] = (erpActivity[activityType] || 0) + 1;
    });

    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      designation: u.designation,
      department: u.department?.name || '-',
      departmentId: u.departmentId,
      attendance: att ? {
        status: att.status,
        checkIn: att.checkIn,
        checkOut: att.checkOut || null,
        workingHours: actualWorkingHours,
        isLate: att.isLate,
        lateMinutes: att.lateMinutes,
      } : {
        status: isScheduledWorkDay ? 'absent' : 'off_day',
        checkIn: null,
        checkOut: null,
        workingHours: 0,
        isLate: false,
        lateMinutes: 0,
      },
      workingHours: actualWorkingHours,
      tasks: {
        total: totalTasks,
        completedToday,
        inProgress,
        overdue,
        list: u.assignedTasks
      },
      erpActions,
      erpActivity,
      recentActivity: u.auditLogs.slice(0, 8).map(log => ({
        action: log.action,
        entityType: log.entityType,
        route: log.entityType === 'UserActivity' ? (log.newValue as any)?.route : null,
        timestamp: log.timestamp,
      })),
    };
  });

  const departmentSummary = new Map<string, any>();
  data.forEach((employee: any) => {
    const id = employee.departmentId || 'unassigned';
    const existing = departmentSummary.get(id) || {
      departmentId: id,
      name: employee.department,
      totalEmployees: 0,
      present: 0,
      absent: 0,
      late: 0,
      totalErpActions: 0,
      totalTasksCompleted: 0,
    };
    existing.totalEmployees += 1;
    if (isScheduledWorkDay) {
      if (['present', 'late', 'half_day'].includes(employee.attendance.status)) existing.present += 1;
      if (employee.attendance.status === 'absent') existing.absent += 1;
      if (employee.attendance.isLate) existing.late += 1;
    }
    existing.totalErpActions += employee.erpActions;
    existing.totalTasksCompleted += employee.tasks.completedToday;
    departmentSummary.set(id, existing);
  });

  res.json({
    success: true,
    data,
    departments: Array.from(departmentSummary.values()),
    scheduledHours,
    breakMinutes: officeHours.breakDurationMinutes,
  });
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
