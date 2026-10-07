// @ts-nocheck
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

export interface AuthRequest extends Request {
  user?: any;
}

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    } catch (error) {
      res.status(401).json({ success: false, message: 'Invalid token' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        organization: true,
        department: true,
        branch: true,
        studyCenter: true,
        subDepartment: { include: { parentDept: true } },
      }
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Auth error' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    if (roles.includes(req.user.role)) {
      return next();
    }

    const deptType = req.user.department?.type || req.user.subDepartment?.parentDept?.type;
    const isHrEmployee = req.user.role === 'employee' && deptType === 'hr';
    const isFinanceEmployee = req.user.role === 'employee' && deptType === 'finance';
    
    // Allow HR employees access if hr_admin is in the allowed roles
    if (isHrEmployee && roles.includes('hr_admin')) {
      return next();
    }
    
    // Allow Finance employees access if finance_admin is in the allowed roles
    if (isFinanceEmployee && roles.includes('finance_admin')) {
      return next();
    }

    // Custom check: If the request is a write operation on programs, and the user has canAddPrograms permission, allow it.
    const isProgramWrite = (req.baseUrl.endsWith('/operations') || req.baseUrl.includes('/operations/')) &&
      (req.path.startsWith('/programs') || req.path.includes('/programs/')) &&
      ['POST', 'PUT', 'DELETE'].includes(req.method);

    if (isProgramWrite && req.user.canAddPrograms) {
      return next();
    }

    res.status(403).json({ success: false, message: 'Access denied' });
  };
};
