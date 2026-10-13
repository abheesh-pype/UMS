import { useState, useEffect } from 'react';
import {
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  ChevronDown,
  ChevronUp,
  Building2,
  GraduationCap,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';

interface CenterData {
  id: string;
  name: string;
  code: string;
  email?: string;
  contact?: string;
  address?: string;
  city?: string;
  state?: string;
  coordinatorName?: string;
  branchName?: string;
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
  statusHistory: { status: string; actorId?: string | { name: string }; actorName?: string; remarks?: string; timestamp: string }[];
  slaBreached?: boolean;
  hoursAtCurrentStage?: number;
  studentStats?: { total: number; enrolled: number; pending: number; rejected: number };
  referredBy?: { name: string; email: string };
}

interface Summary {
  total: number;
  pending_verification: number;
  ops_verified: number;
  pending_payment: number;
  active: number;
  rejected: number;
  slaBreached: number;
}

interface EnrollmentData {
  statusCounts: Record<string, number>;
  total: number;
  enrollments: any[];
  monthly: { month: string; total: number; enrolled: number; pending: number; rejected: number }[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; step: number }> = {
  pending_verification: { label: 'Pending Ops Review', color: 'bg-warning/10 text-warning border-warning/30', icon: <Clock className="w-3.5 h-3.5" />, step: 1 },
  ops_verified:         { label: 'Ops Approved', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30', icon: <CheckCircle className="w-3.5 h-3.5" />, step: 2 },
  pending_payment:      { label: 'Pending Finance', color: 'bg-purple-500/10 text-purple-500 border-purple-500/30', icon: <Clock className="w-3.5 h-3.5" />, step: 3 },
  active:               { label: 'Active', color: 'bg-success/10 text-success border-success/30', icon: <CheckCircle className="w-3.5 h-3.5" />, step: 4 },
  rejected:             { label: 'Rejected from Operations', color: 'bg-error/10 text-error border-error/30', icon: <XCircle className="w-3.5 h-3.5" />, step: 0 },
  rejected_from_finance: { label: 'Rejected from Finance', color: 'bg-error/10 text-error border-error/30', icon: <XCircle className="w-3.5 h-3.5" />, step: 0 },
};

const ENROLLMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  payment_pending:      { label: 'Payment Pending', color: 'bg-warning/10 text-warning border-warning/30' },
  document_review:      { label: 'Document Review', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  finance_review:       { label: 'Finance Review', color: 'bg-purple-500/10 text-purple-500 border-purple-500/30' },
  enrolled:             { label: 'Enrolled', color: 'bg-success/10 text-success border-success/30' },
  rejected:             { label: 'Rejected', color: 'bg-error/10 text-error border-error/30' },
  department_rejected:  { label: 'Dept Rejected', color: 'bg-error/10 text-error border-error/30' },
  department_approved:  { label: 'Dept Approved', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
};

const STEPS = [
  { key: 'pending_verification', label: 'Registered' },
  { key: 'ops_verified', label: 'Ops Verified' },
  { key: 'pending_payment', label: 'Payment' },
  { key: 'active', label: 'Active' },
];

function formatDuration(hours: number) {
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/**
 * A comprehensive Center Onboarding & Student Enrollment status panel.
 * Used by both Sales and CEO dashboards.
 * - `endpoint`: the API endpoint to fetch center onboarding data ('sales' uses /sales/my-centers, 'ceo' uses /ceo/center-onboarding)
 * - `mode`: 'sales' or 'ceo' — CEO sees org-wide data + enrollment pipeline
 */
export function CenterOnboardingOverviewPanel({ mode = 'ceo' }: { mode?: 'ceo' | 'sales' }) {
  const [centers, setCenters] = useState<CenterData[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('centers');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingCenter, setEditingCenter] = useState<CenterData | null>(null);
  const [resubmitting, setResubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (mode === 'ceo') {
        const [centersRes, enrollRes] = await Promise.all([
          api.get('/ceo/center-onboarding'),
          api.get('/ceo/enrollment-overview'),
        ]);
        const data = centersRes.data.data || {};
        setSummary(data.summary || null);
        setCenters(data.centers || []);
        setEnrollmentData(enrollRes.data.data || null);
      } else {
        // Sales mode — use existing endpoint
        const res = await api.get('/sales/my-centers');
        const rawCenters: CenterData[] = res.data.data || [];
        const SLA_HOURS = 48;
        const enriched = rawCenters.map(c => {
          const hrs = Math.round((Date.now() - new Date(c.updatedAt).getTime()) / 3600000);
          const slaBreached = c.status === 'pending_verification' && hrs > SLA_HOURS;
          return { ...c, hoursAtCurrentStage: hrs, slaBreached };
        });
        setCenters(enriched);
        setSummary({
          total: enriched.length,
          pending_verification: enriched.filter(c => c.status === 'pending_verification').length,
          ops_verified: enriched.filter(c => c.status === 'ops_verified').length,
          pending_payment: enriched.filter(c => c.status === 'pending_payment').length,
          active: enriched.filter(c => c.status === 'active').length,
          rejected: enriched.filter(c => ['rejected', 'rejected_from_finance'].includes(c.status)).length,
          slaBreached: enriched.filter(c => c.slaBreached).length,
        });
      }
    } catch {
      toast.error('Failed to load onboarding data');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [mode]);

  const handleResubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCenter) return;
    const formData = new FormData(event.currentTarget);
    setResubmitting(true);
    try {
      await api.put(`/sales/my-centers/${editingCenter.id}/resubmit`, Object.fromEntries(formData.entries()));
      toast.success('Study center updated and resubmitted to Finance');
      setEditingCenter(null);
      await fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to resubmit study center');
    } finally {
      setResubmitting(false);
    }
  };

  const filteredCenters = statusFilter === 'all'
    ? centers
    : statusFilter === 'rejected'
      ? centers.filter(c => ['rejected', 'rejected_from_finance'].includes(c.status))
      : centers.filter(c => c.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Center Onboarding {mode === 'ceo' ? '& Enrollment' : 'Status'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'ceo'
              ? 'University-wide center onboarding pipeline and student enrollment tracking'
              : 'Track your referred centers through the approval pipeline'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Centers', value: summary.total, color: 'text-foreground', bg: 'bg-muted', filter: 'all' },
            { label: 'Pending Ops', value: summary.pending_verification, color: 'text-warning', bg: 'bg-warning/10', filter: 'pending_verification' },
            { label: 'Ops Verified', value: summary.ops_verified, color: 'text-blue-500', bg: 'bg-blue-500/10', filter: 'ops_verified' },
            { label: 'Pending Finance', value: summary.pending_payment, color: 'text-purple-500', bg: 'bg-purple-500/10', filter: 'pending_payment' },
            { label: 'Active', value: summary.active, color: 'text-success', bg: 'bg-success/10', filter: 'active' },
            { label: 'Rejected', value: summary.rejected, color: 'text-error', bg: 'bg-error/10', filter: 'rejected' },
          ].map(s => (
            <Card
              key={s.label}
              className={cn(
                'cursor-pointer transition-all hover:border-primary/40',
                statusFilter === s.filter && 'border-primary ring-1 ring-primary/20'
              )}
              onClick={() => setStatusFilter(s.filter)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn('p-2 rounded-lg', s.bg)}>
                  <div className={cn('w-2 h-2 rounded-full',
                    s.filter === 'all' ? 'bg-foreground/30' :
                    s.bg.replace('/10', '')
                  )} />
                </div>
                <div>
                  <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* SLA Breach Alert */}
      {summary && summary.slaBreached > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-warning/30 bg-warning/5">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-warning">
              {summary.slaBreached} center{summary.slaBreached > 1 ? 's' : ''} breached the 48-hour ops SLA
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Operations has not acted on these within the expected timeframe.
            </p>
          </div>
        </div>
      )}

      {/* Tabs for CEO mode */}
      {mode === 'ceo' ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="centers" className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Centers ({centers?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="enrollments" className="flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" /> Enrollments ({enrollmentData?.total || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="centers" className="mt-4">
            <CenterList
              centers={filteredCenters}
              loading={loading}
              expanded={expanded}
              setExpanded={setExpanded}
              showReferrer={mode === 'ceo'}
              onResubmit={mode === 'sales' ? setEditingCenter : undefined}
            />
          </TabsContent>

          <TabsContent value="enrollments" className="mt-4">
            <EnrollmentOverview data={enrollmentData} loading={loading} />
          </TabsContent>
        </Tabs>
      ) : (
        <CenterList
          centers={filteredCenters}
          loading={loading}
          expanded={expanded}
          setExpanded={setExpanded}
          showReferrer={false}
          onResubmit={setEditingCenter}
        />
      )}
      <Dialog open={!!editingCenter} onOpenChange={open => !open && setEditingCenter(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Update and Resubmit Study Center</DialogTitle></DialogHeader>
          {editingCenter && (
            <form onSubmit={handleResubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  ['name', 'Center Name', editingCenter.name, true],
                  ['code', 'Center Code', editingCenter.code, true],
                  ['email', 'Email', editingCenter.email || '', false],
                  ['contact', 'Contact', editingCenter.contact || '', false],
                  ['address', 'Address', editingCenter.address || '', false],
                  ['city', 'City', editingCenter.city || '', false],
                  ['state', 'State', editingCenter.state || '', false],
                  ['coordinatorName', 'Coordinator Name', editingCenter.coordinatorName || '', false],
                  ['branchName', 'Branch Name', editingCenter.branchName || '', false],
                ] as const).map(([name, label, value, required]) => (
                  <div key={name} className="space-y-1.5">
                    <Label htmlFor={`resubmit-${name}`}>{label}</Label>
                    <Input id={`resubmit-${name}`} name={name} defaultValue={value} required={required} />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingCenter(null)}>Cancel</Button>
                <Button type="submit" disabled={resubmitting}>{resubmitting ? 'Resubmitting...' : 'Resubmit'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Center List ────────────────────────────────────────────────────────────────
function CenterList({
  centers,
  loading,
  expanded,
  setExpanded,
  showReferrer,
  onResubmit,
}: {
  centers: CenterData[];
  loading: boolean;
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  showReferrer: boolean;
  onResubmit?: (center: CenterData) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (!centers || centers.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No centers found</p>
          <p className="text-sm mt-1">Centers will appear here as they register.</p>
        </CardContent>
      </Card>
    );
  }

  return (
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
                  <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                    {center.email && <span>{center.email}</span>}
                    {showReferrer && center.referredBy && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> Referred by {center.referredBy.name}
                      </span>
                    )}
                  </div>

                  {/* Student stats for CEO mode */}
                  {center.studentStats && center.status === 'active' && (
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <GraduationCap className="w-3 h-3" />
                        {center.studentStats.enrolled} enrolled
                      </span>
                      {center.studentStats.pending > 0 && (
                        <span className="text-xs text-warning">{center.studentStats.pending} pending</span>
                      )}
                      <span className="text-xs text-muted-foreground/60">
                        {center.studentStats.total} total applications
                      </span>
                    </div>
                  )}

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
                  {center.status === 'rejected' && onResubmit && (
                    <Button size="sm" onClick={() => onResubmit(center)}>
                      Update and Resubmit
                    </Button>
                  )}
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-border space-y-4">
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
                  {center.statusHistory?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Timeline</p>
                      <div className="space-y-2">
                        {center.statusHistory.map((h, i) => {
                          const hcfg = STATUS_CONFIG[h.status];
                          return (
                            <div key={i} className="flex items-start gap-3 text-xs">
                              <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', hcfg ? hcfg.color.split(' ')[0] : 'bg-muted')} />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold">{hcfg?.label || h.status}</span>
                                  {(h.actorName || (typeof h.actorId === 'object' && h.actorId?.name)) && (
                                    <span className="text-muted-foreground">
                                      by {h.actorName || (typeof h.actorId === 'object' ? h.actorId.name : '')}
                                    </span>
                                  )}
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
                  {center.associatedUniversityIds?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Universities</p>
                      <div className="flex flex-wrap gap-1">
                        {center.associatedUniversityIds.map((u: any) => (
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
  );
}

// ─── Enrollment Overview ──────────────────────────────────────────────────────
function EnrollmentOverview({ data, loading }: { data: EnrollmentData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No enrollment data available</p>
        </CardContent>
      </Card>
    );
  }

  const statusEntries = Object.entries(data.statusCounts || {});
  const COLORS = ['hsl(var(--warning))', 'hsl(var(--info))', 'hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--error))'];

  const barData = statusEntries.map(([status, count], i) => ({
    label: ENROLLMENT_STATUS_CONFIG[status]?.label || status.replace(/_/g, ' '),
    value: count,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Status summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl font-bold">{data.total}</p>
              <p className="text-[10px] text-muted-foreground">Total Applications</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10 text-success">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl font-bold text-success">{data.statusCounts.enrolled || 0}</p>
              <p className="text-[10px] text-muted-foreground">Enrolled</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10 text-warning">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl font-bold text-warning">
                {(data.statusCounts.payment_pending || 0) + (data.statusCounts.document_review || 0) + (data.statusCounts.finance_review || 0)}
              </p>
              <p className="text-[10px] text-muted-foreground">In Pipeline</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-error/10 text-error">
              <XCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl font-bold text-error">
                {(data.statusCounts.rejected || 0) + (data.statusCounts.department_rejected || 0)}
              </p>
              <p className="text-[10px] text-muted-foreground">Rejected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Chart */}
        {barData.length > 0 && (
          <Card className="border-none shadow-xl bg-card/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-base">Enrollment Status Distribution</CardTitle>
              <CardDescription>Current student enrollment pipeline</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={32}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Monthly Trend */}
        {data.monthly?.length > 0 && (
          <Card className="border-none shadow-xl bg-card/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Monthly Enrollment Trend
              </CardTitle>
              <CardDescription>Enrollments over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthly} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                  <Bar dataKey="enrolled" name="Enrolled" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="pending" name="Pending" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="rejected" name="Rejected" fill="hsl(var(--error))" radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Enrollments Table */}
      {data.enrollments?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Student Enrollments</CardTitle>
            <CardDescription>Latest applications across all centers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
<div className="overflow-x-auto w-full">
<table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Student</th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">Center</th>
                    <th className="text-left p-3 font-medium hidden lg:table-cell">Program</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.enrollments.slice(0, 20).map((e: any) => {
                    const ecfg = ENROLLMENT_STATUS_CONFIG[e.status];
                    return (
                      <tr key={e.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <div>
                            <p className="font-medium text-sm">{e.studentName}</p>
                            <p className="text-[10px] text-muted-foreground">{e.studentEmail}</p>
                          </div>
                        </td>
                        <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">
                          {(e.studyCenterId)?.name || '—'}
                        </td>
                        <td className="p-3 hidden lg:table-cell text-xs text-muted-foreground">
                          {(e.programId)?.name || '—'}
                        </td>
                        <td className="p-3">
                          <Badge className={cn('text-[10px] border', ecfg?.color || 'bg-muted text-muted-foreground')}>
                            {ecfg?.label || e.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right text-xs text-muted-foreground hidden sm:table-cell">
                          {new Date(e.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
