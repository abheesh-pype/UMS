import prisma from '../lib/prisma.js';

/**
 * Returns the only organization ID allowed by the single-tenant database constraint.
 */
export const getDefaultOrganizationId = async (): Promise<string> => {
  const org =
    (await prisma.organization.findUnique({
      where: { singletonKey: 'primary' },
      select: { id: true },
    })) ??
    (await prisma.organization.findFirst({
      select: { id: true },
    }));
  if (!org) {
    throw new Error('No primary organization found in database. Run the single-tenant setup.');
  }
  return org.id;
};

/**
 * Returns the only university ID allowed by the single-tenant database constraint.
 */
export const getDefaultUniversityId = async (): Promise<string> => {
  const uni =
    (await prisma.university.findUnique({
      where: { singletonKey: 'primary' },
      select: { id: true },
    })) ??
    (await prisma.university.findFirst({
      select: { id: true },
    }));
  if (!uni) {
    throw new Error('No primary university found in database. Run the single-tenant setup.');
  }
  return uni.id;
};

// The single-tenant IDs never change while the server runs, and this is called on every
// authenticated request, so they are looked up once and kept.
let cachedContext: { organizationId: string; universityId: string } | null = null;

/**
 * Helper to get both organization and university IDs.
 */
export const getSingleTenantContext = async (): Promise<{ organizationId: string; universityId: string }> => {
  if (!cachedContext) {
    const [organizationId, universityId] = await Promise.all([getDefaultOrganizationId(), getDefaultUniversityId()]);
    cachedContext = { organizationId, universityId };
  }
  return { ...cachedContext };
};
