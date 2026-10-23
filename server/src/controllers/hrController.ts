// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const mapLeaveRequest = (leave: any) => ({
  ...leave,
  employeeId: leave.user ? {
    id: leave.userId,
    name: leave.user.name,
    email: leave.user.email,
    designation: leave.user.designation
  } : null,
  departmentId: leave.department ? {
    id: leave.departmentId,
    name: leave.department.name
  } : null,
  deptApprovedBy: leave.deptApprover ? { name: leave.deptApprover.name } : null,
  hrApprovedBy: leave.hrApprover ? { name: leave.hrApprover.name } : null,
});

export const getLeaveRequests = asyncHandler(async (req: AuthRequest, res: Response) => {
  const isGodMode = ['hr_admin', 'org_admin', 'superadmin', 'ceo'].includes(req.user.role);
  const isDeptManager = ['ops_admin', 'finance_admin', 'sales_admin', 'center_admin', 'ops_sub_admin'].includes(req.user.role);
  const whereClause: any = { organizationId: req.user.organizationId };

  // Dept managers only see their own department's leaves; fallback to all if no dept
  if (!isGodMode && isDeptManager && req.user.departmentId) {
    whereClause.departmentId = req.user.departmentId;
  }

  // Support ?status= filter (e.g. status=pending)
  if (req.query.status) {
    whereClause.status = req.query.status;
  }

  // Support ?userId= filter for admin drill-downs
  if (req.query.userId && isGodMode) {
    whereClause.userId = req.query.userId;
  }

  const leaves = await prisma.leaveRequest.findMany({
    where: whereClause,
    include: { 
      user: { select: { name: true, email: true, designation: true } },
      department: { select: { name: true } },
      deptApprover: { select: { name: true } },
      hrApprover: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  const mappedLeaves = leaves.map(mapLeaveRequest);
  res.json({ success: true, count: mappedLeaves.length, data: mappedLeaves });
});

export const getLeaveRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const leave = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
  res.json({ success: true, data: leave });
});

export const createLeaveRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { startDate, endDate, departmentId, type, isHalfDay, attachmentUrl, reason } = req.body;
  
  let deptId = departmentId || req.user.departmentId;
  if (!deptId) {
    const firstDept = await prisma.department.findFirst({
      where: { organizationId: req.user.organizationId }
    });
    if (firstDept) {
      deptId = firstDept.id;
    } else {
      const defaultDept = await prisma.department.create({
        data: {
          name: 'General',
          organizationId: req.user.organizationId,
          status: 'active'
        }
      });
      deptId = defaultDept.id;
    }
  }

  // Calculate required days
  const start = new Date(startDate);
  const end = new Date(endDate);
  // naive calculation (including weekends), can be improved
  let diffTime = Math.abs(end.getTime() - start.getTime());
  let requiredDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  if (isHalfDay) requiredDays = 0.5;

  const currentYear = new Date().getFullYear();
  
  // Skip balance check for unpaid and bereavement (or do custom check if needed)
  if (type !== 'unpaid' && type !== 'bereavement') {
    const allocation = await prisma.leaveAllocation.findUnique({
      where: { userId_year: { userId: req.user.id, year: currentYear } }
    });

    if (!allocation) {
      return res.status(400).json({ success: false, message: 'Leave allocation not found for this year.' });
    }

    // Check previously approved/pending leaves
    const usedLeaves = await prisma.leaveRequest.findMany({
      where: { 
        userId: req.user.id, 
        type: type, 
        startDate: { gte: new Date(`${currentYear}-01-01`) },
        status: { in: ['pending', 'dept_approved', 'approved'] }
      }
    });

    let usedDays = 0;
    usedLeaves.forEach(l => {
      if (l.isHalfDay) usedDays += 0.5;
      else {
        let diff = Math.abs(l.endDate.getTime() - l.startDate.getTime());
        usedDays += Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
      }
    });

    const fieldMap: Record<string, string> = {
      'sick': 'sickLeave',
      'casual': 'casualLeave',
      'earned': 'earnedLeave',
      'compensatory': 'complementaryLeave'
    };
    
    const balanceField = fieldMap[type];
    if (balanceField) {
      const allowed = (allocation as any)[balanceField];
      if (usedDays + requiredDays > allowed) {
        return res.status(400).json({ success: false, message: `Insufficient leave balance for ${type}. Allowed: ${allowed}, Used/Pending: ${usedDays}, Requested: ${requiredDays}` });
      }
    }
  }

  const leave = await prisma.leaveRequest.create({
    data: { 
      type,
      reason,
      isHalfDay,
      attachmentUrl,
      startDate: start,
      endDate: end,
      userId: req.user.id, 
      organizationId: req.user.organizationId,
      departmentId: deptId,
      status: 'pending' // pending manager approval
    }
  });
  res.status(201).json({ success: true, data: leave });
});

export const updateLeaveRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Leave request not found' });
    return;
  }

  const isAdmin = ['hr_admin', 'org_admin', 'superadmin', 'ceo'].includes(req.user.role);
  if (!isAdmin && (existing.userId !== req.user.id || existing.status !== 'pending')) {
    res.status(403).json({ success: false, message: 'You can only edit your own pending leave requests' });
    return;
  }

  const { startDate, endDate, type, reason, isHalfDay, attachmentUrl } = req.body;
  const updateData: any = {};
  
  // Only allow editing fields the employee controls; block status changes via this endpoint
  if (type !== undefined) updateData.type = type;
  if (reason !== undefined) updateData.reason = reason;
  if (isHalfDay !== undefined) updateData.isHalfDay = isHalfDay;
  if (attachmentUrl !== undefined) updateData.attachmentUrl = attachmentUrl;
  if (startDate) updateData.startDate = new Date(startDate);
  if (endDate) updateData.endDate = new Date(endDate);

  const leave = await prisma.leaveRequest.update({ 
    where: { id: req.params.id }, 
    data: updateData 
  });
  res.json({ success: true, data: leave });
});

export const deleteLeaveRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const leave = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
  if (!leave) {
    res.status(404).json({ success: false, message: 'Leave request not found' });
    return;
  }

  const isAdmin = ['hr_admin', 'org_admin', 'superadmin', 'ceo'].includes(req.user.role);
  const isOwner = leave.userId === req.user.id;

  // Only the owner can delete their own pending requests; admins can delete any
  if (!isAdmin && (!isOwner || leave.status !== 'pending')) {
    res.status(403).json({ success: false, message: 'You can only withdraw your own pending leave requests' });
    return;
  }

  await prisma.leaveRequest.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: {} });
});

export const approveLeave = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { action, remarks } = req.body;
  const isHr = req.path.includes('hr-approve');

  const updateData: any = {};
  if (isHr) {
    updateData.status = (action === 'approve' ? 'approved' : 'rejected') as any;
    updateData.hrRemarks = remarks;
    updateData.hrApprovedBy = req.user.id;
  } else {
    updateData.status = (action === 'approve' ? 'dept_approved' : 'rejected') as any;
    updateData.deptAdminRemarks = remarks;
    updateData.deptApprovedBy = req.user.id;
  }

  const leave = await prisma.leaveRequest.update({
    where: { id: req.params.id },
    data: updateData,
    include: { user: { select: { name: true } } }
  });

  // Notify the employee
  try {
    const actionLabel = action === 'approve' ? (isHr ? 'fully approved' : 'approved by department') : 'rejected';
    await prisma.notification.create({
      data: {
        organizationId: req.user.organizationId,
        userId: leave.userId,
        title: `Leave Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        message: `Your ${leave.type} leave request has been ${actionLabel}.${remarks ? ' Remarks: ' + remarks : ''}`,
        type: 'general' as any,
        priority: 'medium',
        link: 'leaves'
      }
    });
  } catch (_) { /* non-fatal */ }

  res.json({ success: true, data: leave });
});

export const deptApproveLeave = approveLeave;
export const hrApproveLeave = approveLeave;
export const getLeaveStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const leaves = await prisma.leaveRequest.findMany({
    where: { organizationId: req.user.organizationId },
    select: { status: true, type: true }
  });
  const stats = {
    total: leaves.length,
    pending: leaves.filter(l => l.status === 'pending').length,
    dept_approved: leaves.filter(l => l.status === 'dept_approved').length,
    approved: leaves.filter(l => l.status === 'approved').length,
    rejected: leaves.filter(l => l.status === 'rejected').length,
    byType: leaves.reduce((acc: any, l) => { acc[l.type] = (acc[l.type] || 0) + 1; return acc; }, {}),
  };
  res.json({ success: true, data: stats });
});
export const getMyLeaves = asyncHandler(async (req: AuthRequest, res: Response) => {
  const leaves = await prisma.leaveRequest.findMany({ 
    where: { userId: req.user.id },
    include: { 
      user: { select: { name: true, email: true, designation: true } },
      department: { select: { name: true } },
      deptApprover: { select: { name: true } },
      hrApprover: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  const mappedLeaves = leaves.map(mapLeaveRequest);
  res.json({ success: true, data: mappedLeaves });
});

// --- Vacancies ---
export const getVacancies = asyncHandler(async (req: AuthRequest, res: Response) => {
  const vacancies = await prisma.vacancy.findMany({
    where: { organizationId: req.user.organizationId },
    include: {
      department: { select: { id: true, name: true } },
      hiringRequest: { select: { id: true, title: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: vacancies });
});
export const getVacancy = asyncHandler(async (req: AuthRequest, res: Response) => {
  const vacancy = await prisma.vacancy.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
    include: {
      department: { select: { id: true, name: true } },
      hiringRequest: { select: { id: true, title: true, status: true } },
    },
  });
  res.json({ success: true, data: vacancy });
});
export const createVacancy = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(400).json({
    success: false,
    message: 'Create a hiring request first. HR approval will open the vacancy.',
  });
});
export const updateVacancy = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await prisma.vacancy.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
    select: { id: true, hiringRequestId: true, filled: true },
  });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Vacancy not found' });
    return;
  }
  if (existing.hiringRequestId) {
    res.status(400).json({ success: false, message: 'Update hiring-request vacancies through the hiring workflow' });
    return;
  }
  const { designation, departmentId, count, status } = req.body;
  if (designation !== undefined && (typeof designation !== 'string' || !designation.trim())) {
    res.status(400).json({ success: false, message: 'Vacancy designation cannot be empty' });
    return;
  }
  if (departmentId !== undefined) {
    const department = await prisma.department.findFirst({
      where: { id: departmentId, organizationId: req.user.organizationId },
      select: { id: true },
    });
    if (!department) {
      res.status(400).json({ success: false, message: 'Select a department in your organization' });
      return;
    }
  }
  if (count !== undefined && (!Number.isInteger(Number(count)) || Number(count) < existing.filled || Number(count) < 1)) {
    res.status(400).json({ success: false, message: `Position count must be at least ${Math.max(existing.filled, 1)}` });
    return;
  }
  if (status !== undefined && !['open', 'closed'].includes(status)) {
    res.status(400).json({ success: false, message: 'Vacancy status must be open or closed' });
    return;
  }
  const vacancy = await prisma.vacancy.update({
    where: { id: existing.id },
    data: {
      ...(typeof designation === 'string' ? { designation: designation.trim() } : {}),
      ...(typeof departmentId === 'string' ? { departmentId } : {}),
      ...(Number.isInteger(Number(count)) && Number(count) > 0 ? { count: Number(count) } : {}),
      ...(typeof status === 'string' ? { status } : {}),
    },
  });
  res.json({ success: true, data: vacancy });
});
export const deleteVacancy = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await prisma.vacancy.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
    select: { id: true, hiringRequestId: true },
  });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Vacancy not found' });
    return;
  }
  if (existing.hiringRequestId) {
    res.status(400).json({ success: false, message: 'Hiring-request vacancies cannot be deleted from vacancy management' });
    return;
  }
  await prisma.vacancy.delete({ where: { id: existing.id } });
  res.json({ success: true, data: {} });
});
export const closeVacancy = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await prisma.vacancy.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
    select: { id: true, hiringRequestId: true },
  });
  if (!existing) {
    res.status(404).json({ success: false, message: 'Vacancy not found' });
    return;
  }
  if (existing.hiringRequestId) {
    res.status(400).json({ success: false, message: 'Hiring-request vacancies cannot be closed from vacancy management' });
    return;
  }
  const vacancy = await prisma.vacancy.update({ where: { id: existing.id }, data: { status: 'closed' as any } });
  res.json({ success: true, data: vacancy });
});
export const validateVacancyForHiring = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, valid: true });
});
export const fillVacancyPosition = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: {} });
});
export const getVacancyStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: {} });
});

// --- Complaints ---
export const getComplaints = asyncHandler(async (req: AuthRequest, res: Response) => {
  const complaints = await prisma.complaint.findMany({ where: { organizationId: req.user.organizationId } });
  res.json({ success: true, data: complaints });
});
export const getComplaint = asyncHandler(async (req: AuthRequest, res: Response) => {
  const complaint = await prisma.complaint.findUnique({ where: { id: req.params.id } });
  res.json({ success: true, data: complaint });
});
export const createComplaint = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { assignedToId, userId, ...complaintData } = req.body;
  const complaint = await prisma.complaint.create({
    data: { ...complaintData, organizationId: req.user.organizationId, employeeId: req.user.id }
  });
  res.status(201).json({ success: true, data: complaint });
});
export const updateComplaint = asyncHandler(async (req: AuthRequest, res: Response) => {
  const complaint = await prisma.complaint.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: complaint });
});
export const deleteComplaint = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.complaint.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: {} });
});
export const resolveComplaint = asyncHandler(async (req: AuthRequest, res: Response) => {
  const complaint = await prisma.complaint.update({ where: { id: req.params.id }, data: { status: 'resolved' as any } });
  res.json({ success: true, data: complaint });
});

// --- Holidays ---
export const getHolidays = asyncHandler(async (req: AuthRequest, res: Response) => {
  const holidays = await prisma.holiday.findMany({ where: { organizationId: req.user.organizationId } });
  res.json({ success: true, data: holidays });
});
export const getHoliday = asyncHandler(async (req: AuthRequest, res: Response) => {
  const holiday = await prisma.holiday.findUnique({ where: { id: req.params.id } });
  res.json({ success: true, data: holiday });
});
export const createHoliday = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { date, ...rest } = req.body;
  const holiday = await prisma.holiday.create({ 
    data: { 
      ...rest, 
      date: new Date(date),
      organizationId: req.user.organizationId 
    } 
  });
  res.status(201).json({ success: true, data: holiday });
});
export const updateHoliday = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { date, ...rest } = req.body;
  const updateData: any = { ...rest };
  if (date) updateData.date = new Date(date);

  const holiday = await prisma.holiday.update({ where: { id: req.params.id }, data: updateData });
  res.json({ success: true, data: holiday });
});
export const deleteHoliday = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.holiday.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: {} });
});

// --- Announcements ---
export const getAnnouncements = asyncHandler(async (req: AuthRequest, res: Response) => {
  const announcements = await prisma.announcement.findMany({ where: { organizationId: req.user.organizationId } });
  res.json({ success: true, data: announcements });
});
export const createAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { expiresAt, ...rest } = req.body;
  const announcement = await prisma.announcement.create({
    data: { 
      ...rest, 
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      organizationId: req.user.organizationId, 
      postedBy: req.user.id 
    }
  });
  res.status(201).json({ success: true, data: announcement });
});
export const updateAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { expiresAt, ...rest } = req.body;
  const updateData: any = { ...rest };
  if (expiresAt) updateData.expiresAt = new Date(expiresAt);

  const announcement = await prisma.announcement.update({ where: { id: req.params.id }, data: updateData });
  res.json({ success: true, data: announcement });
});
export const deleteAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.announcement.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: {} });
});
