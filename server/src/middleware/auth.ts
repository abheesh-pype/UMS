// @ts-nocheck
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { getSingleTenantContext } from '../utils/contextHelper.js';

export interface AuthRequest extends Request {
  user?: any;
}

// A page fires several API calls at once and each one authenticates. Loading the user with its
// relations takes several round trips to the remote database, so concurrent and back-to-back
// requests from the same user share one lookup for a few seconds.
const AUTH_USER_CACHE_MS = 5000;
const authUserCache = new Map<string, { expiresAt: number; user: Promise<any> }>();

const loadAuthUser = (id: string, organizationId: string) => {
  const key = `${organizationId}:${id}`;
  const now = Date.now();
  const cached = authUserCache.get(key);
  if (cached && cached.expiresAt > now) return cached.user;

  if (authUserCache.size > 1000) {
    for (const [cacheKey, entry] of authUserCache) {
      if (entry.expiresAt <= now) authUserCache.delete(cacheKey);
    }
  }
  // Same result as `include: { organization, department, branch, studyCenter, subDepartment: { include: { parentDept } } }`,
  // but the related rows are fetched in parallel instead of one after another.
  const user = prisma.user.findFirst({ where: { id, organizationId } }).then(async found => {
    if (!found) return null;
    const [organization, department, branch, studyCenter, subDepartment] = await Promise.all([
      found.organizationId ? prisma.organization.findUnique({ where: { id: found.organizationId } }) : null,
      found.departmentId ? prisma.department.findUnique({ where: { id: found.departmentId } }) : null,
      found.branchId ? prisma.branch.findUnique({ where: { id: found.branchId } }) : null,
      found.studyCenterId ? prisma.studyCenter.findUnique({ where: { id: found.studyCenterId } }) : null,
      found.subDepartmentId
        ? prisma.subDepartment.findUnique({ where: { id: found.subDepartmentId }, include: { parentDept: true } })
        : null,
    ]);
    return { ...found, organization, department, branch, studyCenter, subDepartment };
  });
  authUserCache.set(key, { expiresAt: now + AUTH_USER_CACHE_MS, user });
  // Never keep a failed or missing lookup
  user.then(found => { if (!found) authUserCache.delete(key); }, () => authUserCache.delete(key));
  return user;
};

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

    const { organizationId, universityId } = await getSingleTenantContext();
    const user = await loadAuthUser(decoded.id, organizationId);

    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    req.user = {
      ...user,
      organizationId,
      universityId,
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && organizationId) {
      res.once('finish', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return;
        const route = `${req.baseUrl}${req.path}`;
        if (route.includes('/attendance/activity-report')) return;

        const action = req.method === 'POST'
          ? 'create'
          : req.method === 'DELETE'
            ? 'delete'
            : 'update';
        prisma.auditLog.create({
          data: {
            organizationId,
            userId: user.id,
            action,
            entityType: 'UserActivity',
            entityId: req.params.id || `${req.method}:${route}`,
            newValue: { method: req.method, route },
            ipAddress: req.ip || '0.0.0.0',
          },
        }).catch(error => console.error('User activity log error:', error));
      });
    }

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
