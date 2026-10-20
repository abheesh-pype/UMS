// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getEmployeeProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.params.userId || req.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true, department: true }
  });
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId }
  });
  const salaryConfig = await prisma.salaryConfig.findUnique({
    where: { userId }
  });
  res.json({ success: true, data: { user, profile, salaryConfig } });
});

const normalizeDepartmentType = (type?: string | null) => {
  const normalized = (type || '').toLowerCase().replace(/[^a-z]/g, '');
  return normalized === 'operation' ? 'operations' : normalized;
};

const departmentTypeFromRole = (role?: string | null) => {
  const normalized = (role || '').toLowerCase();
  if (normalized.includes('ops') || normalized.includes('operation')) return 'operations';
  if (normalized.includes('finance')) return 'finance';
  if (normalized.includes('sales') || normalized === 'bde') return 'sales';
  return '';
};

const isTeamProfileRole = (role?: string | null) => {
  const normalized = (role || '').toLowerCase();
  return normalized === 'employee' || normalized === 'bde' || normalized.includes('sub');
};

const employeeProfileUserSelect = {
  id: true,
  userId: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  designation: true,
  designationId: true,
  status: true,
  departmentId: true,
  subDepartmentId: true,
  branchId: true,
  department: { select: { id: true, name: true, type: true } },
  subDepartment: {
    select: {
      id: true,
      name: true,
      parentDept: { select: { id: true, name: true, type: true } },
    },
  },
  branch: { select: { id: true, name: true } },
  designationRef: { select: { id: true, title: true } },
};

const employeeProfileSelect = {
  dateOfBirth: true,
  gender: true,
  bloodGroup: true,
  address: true,
  city: true,
  state: true,
  pincode: true,
  emergencyContact: true,
  employeeCode: true,
  joinDate: true,
  confirmationDate: true,
  probationEndDate: true,
  employmentType: true,
  employmentRole: true,
  inductionStatus: true,
  workLocation: true,
  ctc: true,
  basicSalary: true,
  bankName: true,
  bankAccountNo: true,
  ifscCode: true,
  panNumber: true,
  kpis: true,
  kras: true,
  lastReviewDate: true,
  nextReviewDate: true,
  overallRating: true,
  reviewRemarks: true,
};

const findOrganizationEmployee = async (req: AuthRequest) => prisma.user.findFirst({
  where: {
    id: req.params.userId,
    organizationId: req.user.organizationId,
    role: { notIn: ['student', 'center_admin', 'superadmin'] },
  },
  select: employeeProfileUserSelect,
});

export const getAdminTeamMembers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    where: {
      organizationId: req.user.organizationId,
      role: { notIn: ['student', 'center_admin', 'superadmin'] },
    },
    select: employeeProfileUserSelect,
    orderBy: [{ name: 'asc' }],
  });
  res.json({ success: true, count: users.length, data: users });
});

export const getAdminEmployeeProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await findOrganizationEmployee(req);
  if (!user) {
    res.status(404).json({ success: false, message: 'Employee not found' });
    return;
  }
  const [profile, salaryConfig] = await Promise.all([
    prisma.employeeProfile.findFirst({
      where: { userId: user.id, organizationId: req.user.organizationId },
      select: employeeProfileSelect,
    }),
    prisma.salaryConfig.findFirst({
      where: { userId: user.id, organizationId: req.user.organizationId },
      select: {
        basicSalary: true,
        allowances: true,
        deductions: true,
        lateDeductionPerMinute: true,
      },
    }),
  ]);
  res.json({ success: true, data: { user, profile, salaryConfig } });
});

export const getAdminEmployeeReviews = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await findOrganizationEmployee(req);
  if (!user) {
    res.status(404).json({ success: false, message: 'Employee not found' });
    return;
  }
  const reviews = await prisma.employeePerformanceReview.findMany({
    where: { employeeId: user.id, organizationId: req.user.organizationId },
    orderBy: { createdAt: 'desc' },
    include: { reviewer: { select: { id: true, name: true, role: true } } },
  });
  res.json({ success: true, data: reviews });
});

export const updateAdminEmployeeProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await findOrganizationEmployee(req);
  if (!user) {
    res.status(404).json({ success: false, message: 'Employee not found' });
    return;
  }

  const {
    name, email, phone, designation, status, designationId, departmentId, subDepartmentId, branchId,
    dateOfBirth, gender, bloodGroup, address, city, state, pincode, emergencyContact,
    employeeCode, joinDate, confirmationDate, probationEndDate, employmentType,
    employmentRole, inductionStatus, workLocation, lastReviewDate, nextReviewDate,
    overallRating, reviewRemarks, kpis, kras,
  } = req.body;
  const userData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries({
    name, email, phone, designation, status, designationId, departmentId, subDepartmentId, branchId,
  })) {
    if (value !== undefined) userData[key] = value;
  }
  for (const [model, id, label] of [
    [prisma.department, departmentId, 'Department'],
    [prisma.subDepartment, subDepartmentId, 'Team'],
    [prisma.branch, branchId, 'Branch'],
    [prisma.designation, designationId, 'Designation'],
  ] as const) {
    if (id && !(await model.findFirst({
      where: { id, organizationId: req.user.organizationId },
      select: { id: true },
    }))) {
      res.status(400).json({ success: false, message: `${label} was not found in this organization` });
      return;
    }
  }

  const profileData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries({
    dateOfBirth, gender, bloodGroup, address, city, state, pincode, emergencyContact,
    employeeCode, joinDate, confirmationDate, probationEndDate, employmentType,
    employmentRole, inductionStatus, workLocation, lastReviewDate, nextReviewDate,
    overallRating, reviewRemarks, kpis, kras,
  })) {
    if (value !== undefined) {
      profileData[key] = ['dateOfBirth', 'joinDate', 'confirmationDate', 'probationEndDate', 'lastReviewDate', 'nextReviewDate'].includes(key) && value
        ? new Date(value as string)
        : value;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (Object.keys(userData).length) {
      await tx.user.update({ where: { id: user.id }, data: userData });
    }
    const profile = Object.keys(profileData).length
      ? await tx.employeeProfile.upsert({
          where: { userId: user.id },
          update: profileData,
          create: { ...profileData, userId: user.id, organizationId: req.user.organizationId },
          select: employeeProfileSelect,
        })
      : await tx.employeeProfile.findFirst({
          where: { userId: user.id, organizationId: req.user.organizationId },
          select: employeeProfileSelect,
        });
    return profile;
  });
  res.json({ success: true, data: updated });
});

export const updateAdminEmployeeSalary = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await findOrganizationEmployee(req);
  if (!user) {
    res.status(404).json({ success: false, message: 'Employee not found' });
    return;
  }
  const { salaryConfig, ctc, basicSalary, bankName, bankAccountNo, ifscCode, panNumber } = req.body;
  const profileData = {
    ctc: ctc === '' || ctc == null ? null : Number(ctc),
    basicSalary: basicSalary === '' || basicSalary == null ? null : Number(basicSalary),
    bankName,
    bankAccountNo,
    ifscCode,
    panNumber,
  };
  const result = await prisma.$transaction(async (tx) => {
    const profile = await tx.employeeProfile.upsert({
      where: { userId: user.id },
      update: profileData,
      create: { ...profileData, userId: user.id, organizationId: req.user.organizationId },
    });
    const config = salaryConfig
      ? await tx.salaryConfig.upsert({
          where: { userId: user.id },
          update: {
            basicSalary: Number(salaryConfig.basicSalary) || 0,
            allowances: salaryConfig.allowances || {},
            deductions: salaryConfig.deductions || {},
            lateDeductionPerMinute: Number(salaryConfig.lateDeductionPerMinute) || 0,
          },
          create: {
            userId: user.id,
            organizationId: req.user.organizationId,
            createdBy: req.user.id,
            basicSalary: Number(salaryConfig.basicSalary) || 0,
            allowances: salaryConfig.allowances || {},
            deductions: salaryConfig.deductions || {},
            lateDeductionPerMinute: Number(salaryConfig.lateDeductionPerMinute) || 0,
          },
        })
      : null;
    return { profile, salaryConfig: config };
  });
  res.json({ success: true, data: result });
});

export const updateAdminEmployeeKPIs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await findOrganizationEmployee(req);
  if (!user) {
    res.status(404).json({ success: false, message: 'Employee not found' });
    return;
  }
  const profile = await prisma.employeeProfile.upsert({
    where: { userId: user.id },
    update: { kpis: req.body.kpis },
    create: { userId: user.id, organizationId: req.user.organizationId, kpis: req.body.kpis },
  });
  res.json({ success: true, data: profile });
});

export const updateAdminEmployeeKRAs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await findOrganizationEmployee(req);
  if (!user) {
    res.status(404).json({ success: false, message: 'Employee not found' });
    return;
  }
  const profile = await prisma.employeeProfile.upsert({
    where: { userId: user.id },
    update: { kras: req.body.kras },
    create: { userId: user.id, organizationId: req.user.organizationId, kras: req.body.kras },
  });
  res.json({ success: true, data: profile });
});

export const createAdminEmployeeReview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await findOrganizationEmployee(req);
  if (!user) {
    res.status(404).json({ success: false, message: 'Employee not found' });
    return;
  }
  const rating = Number(req.body.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    return;
  }
  const review = await prisma.employeePerformanceReview.create({
    data: {
      organizationId: req.user.organizationId,
      employeeId: user.id,
      reviewerId: req.user.id,
      rating,
      remarks: typeof req.body.remarks === 'string' ? req.body.remarks.trim() || null : null,
    },
    include: { reviewer: { select: { id: true, name: true, role: true } } },
  });
  res.status(201).json({ success: true, data: review });
});

const findTeamProfileEmployee = async (req: AuthRequest) => prisma.user.findFirst({
  where: { id: req.params.userId, organizationId: req.user.organizationId },
  select: {
    id: true,
    userId: true,
    name: true,
    email: true,
    role: true,
    phone: true,
    designation: true,
    status: true,
    department: { select: { id: true, name: true, type: true } },
    subDepartment: {
      select: {
        id: true,
        name: true,
        parentDept: { select: { id: true, name: true, type: true } },
      },
    },
    branch: { select: { id: true, name: true } },
    designationRef: { select: { id: true, title: true } },
  },
});

const isInRequesterDepartment = (req: AuthRequest, user: any) => {
  const requesterType = normalizeDepartmentType(
    req.user.department?.type ||
    req.user.subDepartment?.parentDept?.type ||
    departmentTypeFromRole(req.user.role),
  );
  const employeeType = normalizeDepartmentType(
    user.department?.type || user.subDepartment?.parentDept?.type,
  );
  return Boolean(requesterType && requesterType === employeeType);
};

export const getDepartmentEmployeeProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await findTeamProfileEmployee(req);
  if (!user) {
    res.status(404).json({ success: false, message: 'Employee not found' });
    return;
  }
  if (!isInRequesterDepartment(req, user) || !isTeamProfileRole(user.role)) {
    res.status(403).json({ success: false, message: 'Access denied' });
    return;
  }

  const [profile, salaryConfig] = await Promise.all([
    prisma.employeeProfile.findFirst({
      where: { userId: user.id, organizationId: req.user.organizationId },
      select: {
        dateOfBirth: true,
        gender: true,
        bloodGroup: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        emergencyContact: true,
        employeeCode: true,
        joinDate: true,
        confirmationDate: true,
        probationEndDate: true,
        employmentType: true,
        employmentRole: true,
        inductionStatus: true,
        workLocation: true,
        ctc: true,
        basicSalary: true,
        bankName: true,
        bankAccountNo: true,
        ifscCode: true,
        panNumber: true,
        kpis: true,
        kras: true,
        lastReviewDate: true,
        nextReviewDate: true,
        overallRating: true,
        reviewRemarks: true,
      },
    }),
    prisma.salaryConfig.findFirst({
      where: { userId: user.id, organizationId: req.user.organizationId },
      select: {
        basicSalary: true,
        allowances: true,
        deductions: true,
        lateDeductionPerMinute: true,
      },
    }),
  ]);
  res.json({ success: true, data: { user, profile, salaryConfig } });
});

export const getDepartmentEmployeeReviews = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await findTeamProfileEmployee(req);
  if (!user) {
    res.status(404).json({ success: false, message: 'Employee not found' });
    return;
  }
  if (!isInRequesterDepartment(req, user) || !isTeamProfileRole(user.role)) {
    res.status(403).json({ success: false, message: 'Access denied' });
    return;
  }
  const reviews = await prisma.employeePerformanceReview.findMany({
    where: { employeeId: user.id, organizationId: req.user.organizationId },
    orderBy: { createdAt: 'desc' },
    include: { reviewer: { select: { id: true, name: true, role: true } } },
  });
  res.json({ success: true, data: reviews });
});

export const createDepartmentEmployeeReview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await findTeamProfileEmployee(req);
  if (!user) {
    res.status(404).json({ success: false, message: 'Employee not found' });
    return;
  }
  if (!isInRequesterDepartment(req, user) || !isTeamProfileRole(user.role)) {
    res.status(403).json({ success: false, message: 'Access denied' });
    return;
  }

  const rating = Number(req.body.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    return;
  }

  const remarks = typeof req.body.remarks === 'string' ? req.body.remarks.trim() : '';
  const review = await prisma.employeePerformanceReview.create({
    data: {
      organizationId: req.user.organizationId,
      employeeId: user.id,
      reviewerId: req.user.id,
      rating,
      remarks: remarks || null,
    },
    include: { reviewer: { select: { id: true, name: true, role: true } } },
  });

  res.status(201).json({ success: true, data: review });
});

export const upsertEmployeeProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  
  // Format dates correctly before saving
  const dataToSave = { ...req.body };
  if (dataToSave.dateOfBirth) dataToSave.dateOfBirth = new Date(dataToSave.dateOfBirth);
  if (dataToSave.joinDate) dataToSave.joinDate = new Date(dataToSave.joinDate);
  if (dataToSave.confirmationDate) dataToSave.confirmationDate = new Date(dataToSave.confirmationDate);
  if (dataToSave.probationEndDate) dataToSave.probationEndDate = new Date(dataToSave.probationEndDate);
  if (dataToSave.lastReviewDate) dataToSave.lastReviewDate = new Date(dataToSave.lastReviewDate);
  if (dataToSave.nextReviewDate) dataToSave.nextReviewDate = new Date(dataToSave.nextReviewDate);

  const profile = await prisma.employeeProfile.upsert({
    where: { userId },
    update: dataToSave,
    create: { ...dataToSave, userId, organizationId: req.user.organizationId }
  });
  res.json({ success: true, data: profile });
});

export const updateKPIs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const profile = await prisma.employeeProfile.upsert({
    where: { userId },
    update: { kpis: req.body.kpis },
    create: { userId, organizationId: req.user.organizationId, kpis: req.body.kpis }
  });
  res.json({ success: true, data: profile });
});

export const updateKRAs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const profile = await prisma.employeeProfile.upsert({
    where: { userId },
    update: { kras: req.body.kras },
    create: { userId, organizationId: req.user.organizationId, kras: req.body.kras }
  });
  res.json({ success: true, data: profile });
});

export const updateSalaryDetails = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const { salaryConfig, ctc, basicSalary, bankName, bankAccountNo, ifscCode, panNumber } = req.body;

  const profileData = { 
    ctc: ctc ? Number(ctc) : null,
    basicSalary: basicSalary ? Number(basicSalary) : null,
    bankName, 
    bankAccountNo, 
    ifscCode, 
    panNumber 
  };

  const profile = await prisma.employeeProfile.upsert({
    where: { userId },
    update: profileData,
    create: { ...profileData, userId, organizationId: req.user.organizationId }
  });

  let config = null;
  if (salaryConfig) {
    config = await prisma.salaryConfig.upsert({
      where: { userId },
      update: {
        basicSalary: salaryConfig.basicSalary ? Number(salaryConfig.basicSalary) : 0,
        allowances: salaryConfig.allowances || {},
        deductions: salaryConfig.deductions || {},
        lateDeductionPerMinute: salaryConfig.lateDeductionPerMinute ? Number(salaryConfig.lateDeductionPerMinute) : 0,
      },
      create: {
        userId,
        organizationId: req.user.organizationId,
        createdBy: req.user.id,
        basicSalary: salaryConfig.basicSalary ? Number(salaryConfig.basicSalary) : 0,
        allowances: salaryConfig.allowances || {},
        deductions: salaryConfig.deductions || {},
        lateDeductionPerMinute: salaryConfig.lateDeductionPerMinute ? Number(salaryConfig.lateDeductionPerMinute) : 0,
      }
    });
  }

  res.json({ success: true, data: { profile, salaryConfig: config } });
});
