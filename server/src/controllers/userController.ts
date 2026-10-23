// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { hashPassword, generateUserId } from '../utils/authUtils.js';

export const getUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const where: any = { organizationId: req.user.organizationId };

  if (req.query.role) {
    where.role = req.query.role as string;
  } else {
    // Exclude study center admins and students from the general user list
    where.role = { notIn: ['center_admin', 'student'] };
  }
  
  if (req.query.departmentId) where.departmentId = req.query.departmentId as string;
  if (req.query.status) where.status = req.query.status as string;

  if (req.query.departmentType) {
    const deptType = (req.query.departmentType as string).trim().toLowerCase();
    const departmentMatches = [
      { department: { type: { equals: deptType, mode: 'insensitive' } } },
      { department: { name: { contains: deptType, mode: 'insensitive' } } },
      { subDepartment: { parentDept: { type: { equals: deptType, mode: 'insensitive' } } } },
      { subDepartment: { parentDept: { name: { contains: deptType, mode: 'insensitive' } } } },
    ];
    where.OR = req.query.includeAssignedReports === 'true'
      ? [...departmentMatches, { reportingTo: req.user.id }]
      : departmentMatches;
  }

  const users = await prisma.user.findMany({
    where,
    include: {
      organization: { select: { id: true, name: true } },
      department: { select: { id: true, name: true, type: true } },
      subDepartment: {
        select: {
          id: true,
          name: true,
          type: true,
          parentDept: { select: { id: true, name: true, type: true } }
        }
      },
      branch: { select: { id: true, name: true } },
      designationRef: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' }
  });

  res.status(200).json({ success: true, count: users.length, data: users });
});

export const getUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
    include: {
      organization: true,
      department: true,
    }
  });

  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  res.status(200).json({ success: true, data: user });
});

export const createUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.body.vacancyId) {
    res.status(400).json({
      success: false,
      message: 'Hire candidates through the approved Hiring & Recruitment workflow.',
    });
    return;
  }
  req.body.organizationId = req.user.organizationId;
  req.body.universityId = req.user.universityId;

  const userData = req.body;

  const existingUser = await prisma.user.findUnique({
    where: { email: userData.email },
    select: { id: true }
  });
  if (existingUser) {
    res.status(409).json({ success: false, message: 'A user with this email already exists' });
    return;
  }

  // Generate userId and hash password if not provided
  if (!userData.userId) {
    userData.userId = await generateUserId(userData.organizationId);
  }
  
  if (userData.password) {
    userData.password = await hashPassword(userData.password);
  }

  let user;
  try {
    user = await prisma.user.create({ data: userData });
  } catch (error: any) {
    const uniqueTarget = error?.meta?.target;
    const isEmailConflict = Array.isArray(uniqueTarget)
      ? uniqueTarget.includes('email')
      : typeof uniqueTarget === 'string' && uniqueTarget.includes('email');
    if (error?.code === 'P2002' && isEmailConflict) {
      res.status(409).json({ success: false, message: 'A user with this email already exists' });
      return;
    }
    throw error;
  }

  res.status(201).json({ success: true, data: user });
});

export const updateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userExists = await prisma.user.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
  });
  if (!userExists) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  req.body.organizationId = req.user.organizationId;
  req.body.universityId = req.user.universityId;

  // If password is being updated, hash it
  if (req.body.password) {
    req.body.password = await hashPassword(req.body.password);
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: req.body
  });

  res.status(200).json({ success: true, data: user });
});

export const updateUserRole = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { role, designation, departmentId, subDepartmentId, reportingTo, changeType } = req.body;
  const user = await prisma.user.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
    select: { id: true },
  });
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }
  if (typeof role !== 'string' || !role.trim()) {
    res.status(400).json({ success: false, message: 'A role must be selected' });
    return;
  }

  if (changeType === 'demotion') {
    const subordinate = await prisma.user.findFirst({
      where: {
        organizationId: req.user.organizationId,
        reportingTo: user.id,
      },
      select: { id: true },
    });
    if (subordinate) {
      res.status(400).json({
        success: false,
        message: 'Cannot demote this user while they have direct reports. Reassign or remove all direct reports first.',
      });
      return;
    }
  }

  const targetDepartmentId = departmentId || null;
  const targetSubDepartmentId = subDepartmentId || null;

  if (targetDepartmentId) {
    const department = await prisma.department.findFirst({
      where: { id: targetDepartmentId, organizationId: req.user.organizationId },
      select: { id: true },
    });
    if (!department) {
      res.status(400).json({ success: false, message: 'Selected department was not found in this organization' });
      return;
    }
  }

  if (targetSubDepartmentId) {
    const subDepartment = await prisma.subDepartment.findFirst({
      where: {
        id: targetSubDepartmentId,
        organizationId: req.user.organizationId,
        parentDeptId: targetDepartmentId,
      },
      select: { id: true },
    });
    if (!subDepartment) {
      res.status(400).json({ success: false, message: 'Selected sub-department does not belong to the selected department' });
      return;
    }
  }

  if (reportingTo) {
    const manager = await prisma.user.findFirst({
      where: { id: reportingTo, organizationId: req.user.organizationId },
      select: { id: true },
    });
    if (!manager) {
      res.status(400).json({ success: false, message: 'Selected reporting manager was not found in this organization' });
      return;
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      role: role.trim(),
      designation: typeof designation === 'string' ? designation.trim() : null,
      departmentId: targetDepartmentId,
      subDepartmentId: targetSubDepartmentId,
      reportingTo: reportingTo || null,
    },
    include: {
      department: { select: { id: true, name: true } },
      subDepartment: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true } },
    },
  });

  res.status(200).json({ success: true, data: updatedUser });
});

export const deleteUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId },
  });
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }
  await prisma.user.delete({
    where: { id: req.params.id }
  });

  res.status(200).json({ success: true, data: {} });
});

export const bulkImportUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { users } = req.body;

  if (!Array.isArray(users)) {
    res.status(400).json({ success: false, message: 'Invalid payload: users must be an array' });
    return;
  }

  const organizationId = req.user.organizationId;
  
  if (!organizationId && req.user.role !== 'superadmin') {
    res.status(400).json({ success: false, message: 'Organization ID is required' });
    return;
  }

  // Fetch departments of the organization for name lookup
  const departments = await prisma.department.findMany({
    where: { organizationId }
  });

  const results = {
    total: users.length,
    successCount: 0,
    failedCount: 0,
    errors: [] as any[]
  };

  // Track emails inside this payload to prevent duplicates within the upload itself
  const processedEmails = new Set<string>();

  for (let i = 0; i < users.length; i++) {
    const rawUser = users[i];
    const rowNum = i + 2; // Row number in Excel (header is row 1)

    const name = rawUser.name?.toString().trim();
    const email = rawUser.email?.toString().trim().toLowerCase();
    const password = rawUser.password?.toString() || 'Welcome@123';
    const role = rawUser.role?.toString().trim().toLowerCase();
    const departmentName = rawUser.department?.toString().trim();
    const canAddPrograms = ['true', 'yes', '1', 'y'].includes(rawUser.canAddPrograms?.toString().trim().toLowerCase());

    if (!name || !email || !role) {
      results.failedCount++;
      results.errors.push({
        row: rowNum,
        email: email || 'Unknown',
        message: 'Name, Email, and Role are required fields'
      });
      continue;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      results.failedCount++;
      results.errors.push({
        row: rowNum,
        email,
        message: 'Invalid email format'
      });
      continue;
    }

    // Check duplicate in payload
    if (processedEmails.has(email)) {
      results.failedCount++;
      results.errors.push({
        row: rowNum,
        email,
        message: 'Duplicate email in the upload file'
      });
      continue;
    }
    processedEmails.add(email);

    // Validate role
    const validRoles = ['org_admin', 'ceo', 'hr_admin', 'finance_admin', 'ops_admin', 'sales_admin', 'center_admin', 'academic_admin', 'employee'];
    if (!validRoles.includes(role)) {
      results.failedCount++;
      results.errors.push({
        row: rowNum,
        email,
        message: `Invalid role: "${role}". Must be one of: ${validRoles.join(', ')}`
      });
      continue;
    }

    // Role restrictions for non-superadmins
    if (req.user.role !== 'superadmin' && role === 'superadmin') {
      results.failedCount++;
      results.errors.push({
        row: rowNum,
        email,
        message: 'You are not authorized to import superadmin users'
      });
      continue;
    }

    // Check duplicate in DB
    const dbUserExists = await prisma.user.findUnique({
      where: { email }
    });
    if (dbUserExists) {
      results.failedCount++;
      results.errors.push({
        row: rowNum,
        email,
        message: 'A user with this email already exists in the system'
      });
      continue;
    }

    // Map departmentName to departmentId
    let departmentId = null;
    if (departmentName) {
      const matchedDept = departments.find(
        (d) => d.name.toLowerCase() === departmentName.toLowerCase()
      );
      if (matchedDept) {
        departmentId = matchedDept.id;
      } else {
        results.failedCount++;
        results.errors.push({
          row: rowNum,
          email,
          message: `Department "${departmentName}" not found in this organization`
        });
        continue;
      }
    }

    try {
      const generatedId = await generateUserId(organizationId);
      const hashedPassword = await hashPassword(password);

      await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role,
          userId: generatedId,
          organizationId,
          universityId: req.user.universityId,
          departmentId,
          canAddPrograms,
          status: 'active'
        }
      });

      results.successCount++;
    } catch (err: any) {
      results.failedCount++;
      results.errors.push({
        row: rowNum,
        email,
        message: err.message || 'Database error occurred while creating user'
      });
    }
  }

  res.status(200).json({
    success: true,
    data: results
  });
});
