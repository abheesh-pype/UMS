import prisma from '../lib/prisma.js';

let cachedOrgId: string | null = null;
let cachedUniId: string | null = null;

/**
 * Returns the single primary organization ID from verified database records.
 */
export const getDefaultOrganizationId = async (): Promise<string> => {
  if (cachedOrgId) return cachedOrgId;
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: 'asc' }
  });
  if (!org) {
    throw new Error('No organization found in database.');
  }
  cachedOrgId = org.id;
  return org.id;
};

/**
 * Returns the single primary university ID from verified database records.
 */
export const getDefaultUniversityId = async (): Promise<string> => {
  if (cachedUniId) return cachedUniId;
  const uni = await prisma.university.findFirst({
    orderBy: { id: 'asc' }
  });
  if (!uni) {
    throw new Error('No university found in database.');
  }
  cachedUniId = uni.id;
  return uni.id;
};

/**
 * Helper to get both organization and university IDs.
 */
export const getSingleTenantContext = async (): Promise<{ organizationId: string; universityId: string }> => {
  const [organizationId, universityId] = await Promise.all([
    getDefaultOrganizationId(),
    getDefaultUniversityId()
  ]);
  return { organizationId, universityId };
};
