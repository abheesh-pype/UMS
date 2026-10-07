// @ts-nocheck
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { generateToken, generateRefreshToken } from '../utils/jwt.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { hashPassword, comparePassword, generateUserId } from '../utils/authUtils.js';

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public (or Superadmin/OrgAdmin only)
export const register = asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    organizationId,
    departmentId,
    subDepartmentId,
    email,
    password,
    name,
    role,
    phone,
    designation,
    reportingTo,
  } = req.body;

  // Check if user exists
  const userExists = await prisma.user.findUnique({ where: { email } });
  if (userExists) {
    res.status(400).json({ success: false, message: 'User already exists' });
    return;
  }

  // Generate userId and hash password
  const userId = await generateUserId(organizationId);
  const hashedPassword = await hashPassword(password);

  // Create user
  const user = await prisma.user.create({
    data: {
      userId,
      organizationId,
      departmentId,
      subDepartmentId,
      email,
      password: hashedPassword,
      name,
      role,
      phone,
      designation,
      reportingTo,
      status: 'active' as any,
    },
  });

  if (user) {
    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user.id),
      },
    });
  } else {
    res.status(400).json({ success: false, message: 'Invalid user data' });
  }
});

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
export const login = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;
  const loginIdentifier = typeof email === 'string' ? email.trim() : '';

  if (!loginIdentifier || !password) {
    res.status(400).json({ 
      success: false, 
      message: 'Please provide email and password' 
    });
    return;
  }

  // Check for user (by email or unique userId)
  const user = await prisma.user.findFirst({ 
    where: {
      OR: [
        { email: { equals: loginIdentifier, mode: 'insensitive' } },
        { userId: { equals: loginIdentifier, mode: 'insensitive' } }
      ]
    },
    include: {
      organization: true,
      department: true,
      subDepartment: true,
      designationRef: true,
    }
  });

  if (!user) {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
    return;
  }

  // Check if password matches
  const isMatch = await comparePassword(password, user.password);

  if (!isMatch) {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
    return;
  }

  // Update last login
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() }
  });

  const token = generateToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  // For center_admin, include center status so frontend can gate the dashboard
  let centerStatus: string | null = null;
  if (user.role === 'center_admin' && user.studyCenterId) {
    const center = await prisma.studyCenter.findUnique({
      where: { id: user.studyCenterId },
      select: { status: true }
    });
    centerStatus = center?.status ?? null;
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        universityId: user.universityId,
        departmentId: user.departmentId,
        subDepartmentId: user.subDepartmentId,
        studyCenterId: user.studyCenterId,
        designation: user.designation || (user as any).designationRef?.title,
        status: user.status,
        department: user.department,
        subDepartment: user.subDepartment,
        ...(centerStatus !== null && { centerStatus }),
      },
      token,
      refreshToken,
    },
  });
});

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      organization: true,
      department: true,
      subDepartment: true,
      designationRef: true,
    }
  });

  res.status(200).json({
    success: true,
    data: {
      ...user,
      designation: user?.designation || (user as any)?.designationRef?.title,
    },
  });
});

// @desc    Update user details
// @route   PUT /api/v1/auth/updatedetails
// @access  Private
export const updateDetails = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, email, phone } = req.body;

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { name, email, phone }
  });

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Update password
// @route   PUT /api/v1/auth/updatepassword
// @access  Private
export const updatePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id }
  });

  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  // Check current password
  const isMatch = await comparePassword(req.body.currentPassword, user.password);

  if (!isMatch) {
    res.status(401).json({ success: false, message: 'Password is incorrect' });
    return;
  }

  const hashedPassword = await hashPassword(req.body.newPassword);
  
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword }
  });

  const token = generateToken(user.id);

  res.status(200).json({
    success: true,
    data: { token },
  });
});

// @desc    Logout user
// @route   POST /api/v1/auth/logout
// @access  Private
export const logout = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.status(200).json({
    success: true,
    data: {},
  });
});
