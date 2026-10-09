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

  const users = await prisma.user.findMany({
    where,
    include: {
      organization: { select: { name: true } },
      department: { select: { name: true } },
    }
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
  req.body.organizationId = req.user.organizationId;
  req.body.universityId = req.user.universityId;

  const { vacancyId, ...userData } = req.body;

  const existingUser = await prisma.user.findUnique({
    where: { email: userData.email },
    select: { id: true }
  });
  if (existingUser) {
    res.status(409).json({ success: false, message: 'A user with this email already exists' });
    return;
  }

  if (vacancyId) {
    const vacancy = await prisma.vacancy.findUnique({ where: { id: vacancyId } });
    if (!vacancy) {
      res.status(404).json({ success: false, message: 'Vacancy not found' });
      return;
    }
    if (vacancy.filled >= vacancy.count) {
      res.status(400).json({ success: false, message: 'Vacancy limit reached. Cannot hire more candidates.' });
      return;
    }
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

  if (vacancyId) {
    await prisma.vacancy.update({
      where: { id: vacancyId },
      data: { filled: { increment: 1 } }
    });
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
