// @ts-nocheck
import prisma from '../lib/prisma.js';

export interface OnboardingStatusRecord {
  id: string;
  code: string;
  name: string;
  stage: string;
  state: string;
  stepOrder: number;
  description: string | null;
  allowedNextStatuses: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory cache for fast lookups (refreshes automatically or every 60s)
let cachedStatuses: OnboardingStatusRecord[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 60 * 1000;

/**
 * Fetch all active onboarding statuses from DB with caching
 */
export async function getAllOnboardingStatuses(forceRefresh = false): Promise<OnboardingStatusRecord[]> {
  const now = Date.now();
  if (!forceRefresh && cachedStatuses && now - lastCacheTime < CACHE_TTL) {
    return cachedStatuses;
  }

  const statuses = await prisma.studyCenterOnboardingStatus.findMany({
    where: { isActive: true },
    orderBy: [{ stepOrder: 'asc' }, { createdAt: 'asc' }],
  });

  cachedStatuses = statuses.map(s => ({
    ...s,
    allowedNextStatuses: Array.isArray(s.allowedNextStatuses)
      ? (s.allowedNextStatuses as string[])
      : [],
  }));
  lastCacheTime = now;
  return cachedStatuses;
}

/**
 * Resolve status record by code (handles legacy aliases gracefully)
 */
export async function getOnboardingStatusByCode(code: string): Promise<OnboardingStatusRecord | null> {
  const normalized = (code || '').trim().toLowerCase();
  const all = await getAllOnboardingStatuses();

  // 1. Direct match
  const direct = all.find(s => s.code.toLowerCase() === normalized);
  if (direct) return direct;

  // 2. Legacy alias mapping
  if (normalized === 'pending') {
    return all.find(s => s.code === 'pending_verification') || null;
  }
  if (normalized === 'rejected') {
    return all.find(s => s.code === 'ops_rejected') || all.find(s => s.code === 'rejected') || null;
  }
  if (normalized === 'rejected_from_finance') {
    return all.find(s => s.code === 'finance_rejected') || all.find(s => s.code === 'rejected_from_finance') || null;
  }
  if (normalized === 'ops_verified') {
    return all.find(s => s.code === 'pending_payment') || null;
  }

  // 3. Fallback query direct from DB in case cache missed
  const dbMatch = await prisma.studyCenterOnboardingStatus.findUnique({
    where: { code: normalized }
  });
  if (dbMatch) {
    return {
      ...dbMatch,
      allowedNextStatuses: Array.isArray(dbMatch.allowedNextStatuses)
        ? (dbMatch.allowedNextStatuses as string[])
        : [],
    };
  }

  return null;
}

/**
 * Resolve status record by ID
 */
export async function getOnboardingStatusById(id: string): Promise<OnboardingStatusRecord | null> {
  const all = await getAllOnboardingStatuses();
  const found = all.find(s => s.id === id);
  if (found) return found;

  const dbMatch = await prisma.studyCenterOnboardingStatus.findUnique({ where: { id } });
  if (dbMatch) {
    return {
      ...dbMatch,
      allowedNextStatuses: Array.isArray(dbMatch.allowedNextStatuses)
        ? (dbMatch.allowedNextStatuses as string[])
        : [],
    };
  }
  return null;
}

/**
 * Check if transitioning from currentStatusCode to targetStatusCode is allowed
 */
export async function validateStatusTransition(
  currentStatusCode: string,
  targetStatusCode: string,
  bypassForRoles?: string[]
): Promise<{ allowed: boolean; message?: string }> {
  const current = await getOnboardingStatusByCode(currentStatusCode);
  const target = await getOnboardingStatusByCode(targetStatusCode);

  if (!target) {
    return { allowed: false, message: `Target onboarding status '${targetStatusCode}' not found in database` };
  }

  if (!current) {
    // If center has no status yet, allow transitioning to pending_verification
    return { allowed: true };
  }

  // Admin bypass check if needed
  if (bypassForRoles && ['superadmin', 'org_admin', 'ceo'].some(r => bypassForRoles.includes(r))) {
    return { allowed: true };
  }

  const allowedList = current.allowedNextStatuses || [];
  const isDirectlyAllowed = allowedList.includes(target.code) || allowedList.includes(targetStatusCode);

  if (isDirectlyAllowed) {
    return { allowed: true };
  }

  // Check alias compatibility and cross-department transitions
  if (
    (target.code === 'ops_rejected' && (allowedList.includes('rejected') || ['finance_rejected', 'rejected_from_finance'].includes(current.code))) ||
    (target.code === 'finance_rejected' && allowedList.includes('rejected_from_finance')) ||
    (target.code === 'pending_payment' && (allowedList.includes('ops_approved') || ['finance_rejected', 'rejected_from_finance'].includes(current.code))) ||
    (target.code === 'finance_resubmitted' && ['finance_rejected', 'rejected_from_finance'].includes(current.code))
  ) {
    return { allowed: true };
  }

  return {
    allowed: false,
    message: `Invalid workflow transition: Cannot move from '${current.name}' (${current.code}) to '${target.name}' (${target.code}). Allowed next: ${allowedList.join(', ')}`
  };
}

/**
 * Execute center status transition with workflow rules, history logging, and relational linkage
 */
export async function transitionStudyCenterStatus(params: {
  centerId: string;
  targetStatusCode: string;
  actor?: { id?: string; name?: string; role?: string };
  remarks?: string;
  extraData?: Record<string, any>;
}) {
  const { centerId, targetStatusCode, actor, remarks, extraData = {} } = params;

  const center = await prisma.studyCenter.findUnique({
    where: { id: centerId },
    include: { onboardingStatus: true }
  });

  if (!center) {
    throw new Error('Study Center not found');
  }

  const currentStatusCode = center.onboardingStatus?.code || center.status || 'pending_verification';
  const targetStatus = await getOnboardingStatusByCode(targetStatusCode);

  if (!targetStatus) {
    throw new Error(`Target onboarding status '${targetStatusCode}' does not exist in database`);
  }

  // Validate transition (allow org_admin/ceo/superadmin bypass)
  const validation = await validateStatusTransition(
    currentStatusCode,
    targetStatus.code,
    actor?.role ? [actor.role] : []
  );

  if (!validation.allowed) {
    throw new Error(validation.message || 'Invalid workflow transition');
  }

  const historyEntry = {
    status: targetStatus.code,
    statusName: targetStatus.name,
    stage: targetStatus.stage,
    state: targetStatus.state,
    actorId: actor?.id || null,
    actorName: actor?.name || 'System',
    actorRole: actor?.role || null,
    remarks: remarks?.trim() || '',
    timestamp: new Date().toISOString(),
  };

  const existingHistory = Array.isArray(center.statusHistory) ? (center.statusHistory as any[]) : [];
  const updatedHistory = [...existingHistory, historyEntry];

  const updatedCenter = await prisma.studyCenter.update({
    where: { id: centerId },
    data: {
      onboardingStatusId: targetStatus.id,
      status: targetStatus.code, // Keep status field synced for backward compatibility
      statusHistory: updatedHistory,
      ...extraData,
    },
    include: {
      onboardingStatus: true,
      referrer: { select: { id: true, name: true, email: true, role: true } },
      assignedOperationsUser: { select: { id: true, name: true, email: true, role: true } },
      assignedFinanceUser: { select: { id: true, name: true, email: true, role: true } },
    }
  });

  return updatedCenter;
}
