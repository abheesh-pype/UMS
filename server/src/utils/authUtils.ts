// @ts-nocheck
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';

/**
 * Hash a plain text password
 */
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 12);
};

/**
 * Compare plain text password with hashed password
 */
export const comparePassword = async (password: string, hashed: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashed);
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const normalizeIdPattern = (pattern: string | null | undefined): string => {
  const cleaned = (pattern || '').trim().replace(/[^a-zA-Z0-9]/g, '');
  return cleaned || 'IITSRPS';
};

export const getOrganizationStudyCenterPattern = async (organizationId?: string | null): Promise<string> => {
  if (!organizationId) return 'IITSRPS';

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { metadata: true }
  });

  const metadata = (organization?.metadata as any) || {};
  return normalizeIdPattern(metadata.studyCenterIdPattern || 'IITSRPS');
};

export const getOrganizationUserIdPattern = async (organizationId?: string | null): Promise<string> => {
  if (!organizationId) return 'IITSRPS';

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { metadata: true }
  });

  const metadata = (organization?.metadata as any) || {};
  return normalizeIdPattern(metadata.userIdPattern || 'IITSRPS');
};

/**
 * Generate a unique userId in the format IITSRPS0001
 */
export const generateUserId = async (organizationId?: string | null): Promise<string> => {
  const prefix = await getOrganizationUserIdPattern(organizationId);
  const lastUser = await prisma.user.findFirst({
    where: {
      userId: {
        startsWith: prefix
      }
    },
    orderBy: {
      userId: 'desc'
    }
  });

  let nextNum = 1;
  if (lastUser && lastUser.userId) {
    const match = lastUser.userId.match(new RegExp(`^${escapeRegExp(prefix)}(\\d+)`));
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  let userId = `${prefix}${String(nextNum).padStart(4, '0')}`;
  let exists = await prisma.user.findUnique({ where: { userId } });
  while (exists) {
    nextNum++;
    userId = `${prefix}${String(nextNum).padStart(4, '0')}`;
    exists = await prisma.user.findUnique({ where: { userId } });
  }

  return userId;
};

/**
 * Generate a unique study center admin userId based on the configured org pattern.
 * Example: "aaaaaaa" => "aaaaaaa0009"
 */
export const generateStudyCenterUserId = async (organizationId?: string | null): Promise<string> => {
  const prefix = await getOrganizationStudyCenterPattern(organizationId);
  const lastUser = await prisma.user.findFirst({
    where: {
      userId: {
        startsWith: prefix
      }
    },
    orderBy: {
      userId: 'desc'
    }
  });

  let nextNum = 1;
  if (lastUser && lastUser.userId) {
    const match = lastUser.userId.match(new RegExp(`^${escapeRegExp(prefix)}(\\d+)`));
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  let userId = `${prefix}${String(nextNum).padStart(4, '0')}`;
  let exists = await prisma.user.findUnique({ where: { userId } });
  while (exists) {
    nextNum++;
    userId = `${prefix}${String(nextNum).padStart(4, '0')}`;
    exists = await prisma.user.findUnique({ where: { userId } });
  }

  return userId;
};
