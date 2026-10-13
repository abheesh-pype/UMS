import { useState, useEffect } from 'react';
import api from '@/lib/api';

export interface OnboardingStatus {
  id: string;
  code: string;
  name: string;
  stage: 'operations' | 'finance' | 'completed' | string;
  state: 'pending' | 'approved' | 'rejected' | 'resubmitted' | 'active' | string;
  stepOrder: number;
  description?: string;
  allowedNextStatuses: string[];
  isActive: boolean;
}

export interface StatusUIConfig {
  label: string;
  color: string;
  stage: string;
  state: string;
  step: number;
}

export const DEFAULT_STATUS_MAP: Record<string, StatusUIConfig> = {
  pending_verification: { label: 'Pending Operations Review', color: 'bg-warning/10 text-warning border-warning/30', stage: 'operations', state: 'pending', step: 1 },
  ops_rejected:         { label: 'Operations Rejected', color: 'bg-error/10 text-error border-error/30', stage: 'operations', state: 'rejected', step: 1 },
  rejected:             { label: 'Operations Rejected', color: 'bg-error/10 text-error border-error/30', stage: 'operations', state: 'rejected', step: 1 },
  ops_resubmitted:      { label: 'Operations Resubmitted', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30', stage: 'operations', state: 'resubmitted', step: 1 },
  pending_payment:      { label: 'Pending Finance Review', color: 'bg-purple-500/10 text-purple-500 border-purple-500/30', stage: 'finance', state: 'pending', step: 2 },
  finance_rejected:     { label: 'Finance Rejected', color: 'bg-error/10 text-error border-error/30', stage: 'finance', state: 'rejected', step: 2 },
  rejected_from_finance: { label: 'Finance Rejected', color: 'bg-error/10 text-error border-error/30', stage: 'finance', state: 'rejected', step: 2 },
  finance_resubmitted:  { label: 'Finance Resubmitted', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30', stage: 'finance', state: 'resubmitted', step: 2 },
  active:               { label: 'Active', color: 'bg-success/10 text-success border-success/30', stage: 'completed', state: 'active', step: 3 },
  suspended:            { label: 'Suspended', color: 'bg-muted text-muted-foreground border-border', stage: 'completed', state: 'suspended', step: 3 },
  inactive:             { label: 'Inactive', color: 'bg-muted text-muted-foreground border-border', stage: 'completed', state: 'inactive', step: 3 },
};

let cachedStatuses: OnboardingStatus[] | null = null;
let fetchPromise: Promise<OnboardingStatus[]> | null = null;

export async function fetchOnboardingStatuses(): Promise<OnboardingStatus[]> {
  if (cachedStatuses) return cachedStatuses;
  if (!fetchPromise) {
    fetchPromise = api.get('/onboarding-statuses')
      .then(res => {
        cachedStatuses = res.data.data || [];
        return cachedStatuses || [];
      })
      .catch(() => [])
      .finally(() => {
        fetchPromise = null;
      });
  }
  return fetchPromise;
}

export function getStatusUI(code: string, dynamicList?: OnboardingStatus[]): StatusUIConfig {
  const norm = (code || '').trim().toLowerCase();
  
  if (dynamicList && dynamicList.length > 0) {
    const found = dynamicList.find(s => s.code.toLowerCase() === norm);
    if (found) {
      let color = 'bg-muted text-muted-foreground border-border';
      if (found.state === 'pending') {
        color = found.stage === 'operations' ? 'bg-warning/10 text-warning border-warning/30' : 'bg-purple-500/10 text-purple-500 border-purple-500/30';
      } else if (found.state === 'rejected') {
        color = 'bg-error/10 text-error border-error/30';
      } else if (found.state === 'resubmitted') {
        color = 'bg-blue-500/10 text-blue-500 border-blue-500/30';
      } else if (found.state === 'active') {
        color = 'bg-success/10 text-success border-success/30';
      }
      return {
        label: found.name,
        color,
        stage: found.stage,
        state: found.state,
        step: found.stepOrder,
      };
    }
  }

  return DEFAULT_STATUS_MAP[norm] || {
    label: (code || '').replace(/_/g, ' '),
    color: 'bg-muted text-muted-foreground border-border',
    stage: 'operations',
    state: 'pending',
    step: 1,
  };
}

export function useOnboardingStatuses() {
  const [statuses, setStatuses] = useState<OnboardingStatus[]>(cachedStatuses || []);
  const [loading, setLoading] = useState(!cachedStatuses);

  useEffect(() => {
    fetchOnboardingStatuses().then(data => {
      setStatuses(data);
      setLoading(false);
    });
  }, []);

  return {
    statuses,
    loading,
    getStatusUI: (code: string) => getStatusUI(code, statuses),
  };
}
