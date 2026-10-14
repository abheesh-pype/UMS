import { useState, useEffect } from 'react';
import { RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle, User, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface OnboardingCenter {
  id: string;
  name: string;
  code: string;
  email?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  verifiedBy?: { id: string; name: string; email: string };
  verifiedAt?: string;
  opsRemarks?: string;
  financeApprovedBy?: { id: string; name: string; email: string };
  financeApprovedAt?: string;
  paymentRemarks?: string;
  associatedUniversityIds: { name: string; code: string }[];
  statusHistory: { status: string; actorId?: { name: string }; remarks?: string; timestamp: string }[];
  slaBreached?: boolean;
  hoursAtCurrentStage?: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; step: number }> = {
  pending_verification: { label: 'Pending Ops Review', color: 'bg-warning/10 text-warning border-warning/30', icon: <Clock className="w-3.5 h-3.5" />, step: 1 },
  ops_resubmitted:      { label: 'Ops Resubmitted', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30', icon: <Clock className="w-3.5 h-3.5" />, step: 1 },
  ops_rejected:         { label: 'Rejected from Operation', color: 'bg-error/10 text-error border-error/30', icon: <XCircle className="w-3.5 h-3.5" />, step: 0 },
  rejected:             { label: 'Rejected from Operation', color: 'bg-error/10 text-error border-error/30', icon: <XCircle className="w-3.5 h-3.5" />, step: 0 },
  ops_verified:         { label: 'Ops Approved', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30', icon: <CheckCircle className="w-3.5 h-3.5" />, step: 2 },
  pending_payment:      { label: 'Pending Finance', color: 'bg-purple-500/10 text-purple-500 border-purple-500/30', icon: <Clock className="w-3.5 h-3.5" />, step: 3 },
  finance_resubmitted:  { label: 'Finance Resubmitted', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30', icon: <Clock className="w-3.5 h-3.5" />, step: 3 },
  finance_rejected:     { label: 'Rejected from Finance', color: 'bg-error/10 text-error border-error/30', icon: <XCircle className="w-3.5 h-3.5" />, step: 0 },
  rejected_from_finance:{ label: 'Rejected from Finance', color: 'bg-error/10 text-error border-error/30', icon: <XCircle className="w-3.5 h-3.5" />, step: 0 },
  active:               { label: 'Active', color: 'bg-success/10 text-success border-success/30', icon: <CheckCircle className="w-3.5 h-3.5" />, step: 4 },
};

const STEPS = [
  { key: 'pending_verification', label: 'Registered' },
  { key: 'ops_verified', label: 'Ops Verified' },
  { key: 'pending_payment', label: 'Payment' },
  { key: 'active', label: 'Active' },
];

const SLA_HOURS = 48; // ops should act within 48h

function hoursAgo(iso: string) {
  return Math.round((Date.now() - new Date(iso).getTime()) / 3600000);
}

function formatDuration(hours: number) {
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function SalesCenterOnboardingPanel() {
  const [centers, setCenters] = useState<OnboardingCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchCenters = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sales/my-centers');
      const data: OnboardingCenter[] = res.data.data || [];

      // Compute SLA breach for centers stuck in pending_verification
      const enriched = data.map(c => {
        const hrs = hoursAgo(c.updatedAt);
        const slaBreached = c.status === 'pending_verification' && hrs > SLA_HOURS;
        return { ...c, hoursAtCurrentStage: hrs, slaBreached };
      });

      setCenters(enriched);
    } catch {
      toast.error('Failed to load centers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCenters(); }, []);

  const pending = centers.filter(c => c.status === 'pending_verification').length;
  const opsVerified = centers.filter(c => c.status === 'ops_verified').length;
  const pendingPayment = centers.filter(c => c.status === 'pending_payment').length;
  const active = centers.filter(c => c.status === 'active').length;
  const rejected = centers.filter(c => c.status === 'rejected').length;
  const breached = centers.filter(c => c.slaBreached).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Center Onboarding Status</h2>
          <p className="text-sm text-muted-foreground mt-1">Track your referred centers through the approval pipeline</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCenters} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Pending Ops', value: pending, color: 'text-warning', bg: 'bg-warning/10' },
          { label: 'Ops Verified', value: opsVerified, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Pending Finance', value: pendingPayment, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { label: 'Active', value: active, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Rejected', value: rejected, color: 'text-error', bg: 'bg-error/10' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', s.bg)}>
                <div className={cn('w-2 h-2 rounded-full', s.bg.replace('/10', ''))} />
              </div>
              <div>
                <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SLA breach warning */}
      {breached > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-warning/30 bg-warning/5">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-warning">{breached} center{breached > 1 ? 's' : ''} breached the 48-hour ops SLA</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Operations has not acted on these within the expected timeframe. This delay is being tracked and will affect the responsible ops user's performance score.
            </p>
          </div>
        </div>
      )}

      {/* Center list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : centers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No centers found</p>
            <p className="text-sm mt-1">Centers referred via your invite links will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {centers.map(center => {
            const cfg = STATUS_CONFIG[center.status] || STATUS_CONFIG['pending_verification'];
            const isExpanded = expanded === center.id;
            const currentStep = cfg.step;

            return (
              <Card
                key={center.id}
                className={cn(
                  'transition-colors',
                  center.slaBreached ? 'border-warning/40' : 'hover:border-primary/20',
                  isExpanded && 'border-primary/40'
                )}
              >
                <CardContent className="p-5">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-sm">{center.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{center.code}</span>
                        <Badge className={cn('text-[10px] border flex items-center gap-1', cfg.color)}>
                          {cfg.icon} {cfg.label}
                        </Badge>
                        {center.slaBreached && (
                          <Badge className="text-[10px] bg-warning/10 text-warning border border-warning/30 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> SLA Breached
                          </Badge>
                        )}
                      </div>
                      {center.email && <p className="text-xs text-muted-foreground">{center.email}</p>}

                      {/* Progress stepper */}
                      {center.status !== 'rejected' && (
                        <div className="flex items-center gap-1 mt-3">
                          {STEPS.map((step, i) => (
                            <div key={step.key} className="flex items-center gap-1">
                              <div className={cn(
                                'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border',
                                currentStep > i + 1 ? 'bg-success text-white border-success' :
                                currentStep === i + 1 ? 'bg-primary text-white border-primary' :
                                'bg-muted text-muted-foreground border-border'
                              )}>
                                {currentStep > i + 1 ? '✓' : i + 1}
                              </div>
                              <span className={cn(
                                'text-[9px] hidden sm:block',
                                currentStep === i + 1 ? 'text-primary font-semibold' : 'text-muted-foreground'
                              )}>{step.label}</span>
                              {i < STEPS.length - 1 && (
                                <div className={cn('w-6 h-0.5 mx-1', currentStep > i + 1 ? 'bg-success' : 'bg-muted')} />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">
                        {formatDuration(center.hoursAtCurrentStage || 0)} at this stage
                      </span>
                      <button
                        className="text-xs text-primary flex items-center gap-1 hover:underline"
                        onClick={() => setExpanded(isExpanded ? null : center.id)}
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isExpanded ? 'Hide' : 'Details'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border space-y-4">
                      {/* Who is handling */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ops Handler</p>
                          {center.verifiedBy ? (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center text-xs font-bold">
                                {center.verifiedBy.name[0]}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{center.verifiedBy.name}</p>
                                <p className="text-[10px] text-muted-foreground">{center.verifiedBy.email}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-warning">
                              <User className="w-4 h-4" />
                              <span className="text-xs">
                                {center.status === 'pending_verification'
                                  ? 'Not yet assigned — awaiting ops action'
                                  : 'No ops handler recorded'}
                              </span>
                            </div>
                          )}
                          {center.opsRemarks && (
                            <p className="text-xs text-muted-foreground mt-1 italic">"{center.opsRemarks}"</p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Finance Handler</p>
                          {center.financeApprovedBy ? (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center text-xs font-bold">
                                {center.financeApprovedBy.name[0]}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{center.financeApprovedBy.name}</p>
                                <p className="text-[10px] text-muted-foreground">{center.financeApprovedBy.email}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <User className="w-4 h-4" />
                              <span className="text-xs">
                                {['pending_payment', 'active'].includes(center.status)
                                  ? 'Awaiting finance action'
                                  : 'Not yet reached finance stage'}
                              </span>
                            </div>
                          )}
                          {center.paymentRemarks && (
                            <p className="text-xs text-muted-foreground mt-1 italic">"{center.paymentRemarks}"</p>
                          )}
                        </div>
                      </div>

                      {/* Status history timeline */}
                      {(center.statusHistory?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Timeline</p>
                          <div className="space-y-2">
                            {(center.statusHistory || []).map((h, i) => {
                              const hcfg = STATUS_CONFIG[h.status];
                              return (
                                <div key={i} className="flex items-start gap-3 text-xs">
                                  <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', hcfg ? hcfg.color.split(' ')[0] : 'bg-muted')} />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold">{hcfg?.label || h.status}</span>
                                      {h.actorId && <span className="text-muted-foreground">by {h.actorId.name}</span>}
                                      <span className="text-muted-foreground/60">{new Date(h.timestamp).toLocaleString()}</span>
                                    </div>
                                    {h.remarks && <p className="text-muted-foreground mt-0.5 italic">"{h.remarks}"</p>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Universities */}
                      {(center.associatedUniversityIds?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Universities</p>
                          <div className="flex flex-wrap gap-1">
                            {(center.associatedUniversityIds || []).map((u: any) => (
                              <Badge key={u.id || u.name} variant="outline" className="text-[10px]">{u.name}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
