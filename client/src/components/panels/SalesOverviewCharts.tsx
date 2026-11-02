import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle,
  ClipboardList,
  Clock,
  GraduationCap,
  Link2,
  School,
  ShieldCheck,
  Target,
  UserCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

// Loads one endpoint; the overview shares each response between its sections.
type OverviewGet = (path: string) => Promise<any>;
type Navigate = (tab: string) => void;

const SERIES = [
  { key: 'sales', label: 'Sales applications', color: 'var(--viz-series-1)' },
  { key: 'centers', label: 'Center admissions', color: 'var(--viz-series-2)' },
] as const;

export const useOverviewData = <T,>(load: () => Promise<T>, deps: unknown[]) => {
  // undefined = loading, null = the request failed
  const [data, setData] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    load()
      .then(result => { if (active) setData(result); })
      .catch(() => { if (active) setData(null); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return data;
};

// A figure from a section: "..." while loading and "—" when the request failed, never a misleading 0
export const figure = <T,>(data: T | null | undefined, read: (loaded: T) => number | string) =>
  data === undefined ? '...' : data === null ? '—' : read(data);

const isRejectedStatus = (status?: string) => /rejected/.test(status || '');
const isTaskOverdue = (task: any) => task.status === 'overdue' || new Date(task.deadline).getTime() < Date.now();

// ─── Top row ──────────────────────────────────────────────────────────────────

export function OverviewMetric({ title, value, sub, trend, trendType, icon, color, onClick }: {
  title: string;
  value: number | string;
  sub: string;
  trend?: string;
  trendType?: 'up' | 'warn';
  icon: ReactNode;
  color: 'primary' | 'success' | 'warning';
  onClick: () => void;
}) {
  const colorMap = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
  };
  return (
    <Card className="group cursor-pointer transition-all duration-300 hover:border-primary/50" onClick={onClick}>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className={cn('rounded-xl p-2.5 transition-transform group-hover:scale-110', colorMap[color])}>{icon}</div>
          {trend && (
            <div className={cn(
              'flex items-center rounded-full px-2 py-1 text-xs font-bold',
              trendType === 'up' ? 'bg-success/10 text-success' : trendType === 'warn' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground',
            )}>
              {trendType === 'up' && <ArrowUpRight className="mr-1 h-3 w-3" />}
              {trendType === 'warn' && <ArrowDownRight className="mr-1 h-3 w-3" />}
              {trend}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="pt-1 text-xs text-muted-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewTile({ label, value, icon, urgent, onClick }: {
  label: string;
  value: number | string;
  icon: ReactNode;
  urgent?: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      className={cn('cursor-pointer transition-colors', urgent ? 'border-warning/20 hover:border-warning/50' : 'hover:border-primary/40')}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn('rounded-lg p-2', urgent ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground')}>{icon}</div>
        <div>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Admissions chart ─────────────────────────────────────────────────────────

const lastSixMonths = () => Array.from({ length: 6 }, (_, index) => {
  const month = new Date();
  month.setDate(1);
  month.setMonth(month.getMonth() - (5 - index));
  return { year: month.getFullYear(), month: month.getMonth(), label: month.toLocaleString('en', { month: 'short', year: '2-digit' }) };
});

const countInMonth = (rows: any[], year: number, month: number) => rows.filter(row => {
  const created = new Date(row.createdAt);
  return created.getFullYear() === year && created.getMonth() === month;
}).length;

export function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      {payload.map((row: any) => (
        <div key={row.dataKey} className="flex items-center gap-2 text-xs">
          <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: row.color }} />
          <span className="font-semibold">{row.value}</span>
          <span className="text-muted-foreground">{row.name}</span>
        </div>
      ))}
    </div>
  );
}

function AdmissionsChart({ applications, admissions, onNavigate }: { applications: any; admissions: any[] | null | undefined; onNavigate: Navigate }) {
  const loading = applications === undefined || admissions === undefined;
  const failed = applications === null && admissions === null;
  const months = lastSixMonths().map(({ year, month, label }) => ({
    label,
    sales: countInMonth(applications?.data || [], year, month),
    centers: countInMonth(admissions || [], year, month),
  }));
  const hasData = months.some(row => row.sales > 0 || row.centers > 0);

  return (
    <Card
      className="cursor-pointer border-none bg-card/60 shadow-xl backdrop-blur-xl transition-colors hover:border-primary/30 lg:col-span-2"
      onClick={() => onNavigate('student_enrollment')}
    >
      <CardHeader>
        <CardTitle>Admissions Overview</CardTitle>
        <CardDescription>New applications per month, last 6 months — click to manage applications</CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        {loading ? (
          <div className="h-[280px] animate-pulse rounded-lg bg-muted" aria-label="Loading admissions" />
        ) : failed ? (
          <p className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">Could not load this chart.</p>
        ) : !hasData ? (
          <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <BarChart3 className="h-10 w-10 opacity-20" />
            <p className="text-sm">No applications in the last 6 months</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-4">
              {SERIES.map(series => (
                <span key={series.key} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.color }} />
                  {series.label}
                </span>
              ))}
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months} barGap={2} margin={{ top: 10, right: 20, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                  {SERIES.map(series => (
                    <Bar key={series.key} dataKey={series.key} name={series.label} fill={series.color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <details className="mt-3 text-sm" onClick={event => event.stopPropagation()}>
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">View as table</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-4 font-medium">Month</th>
                      {SERIES.map(series => <th key={series.key} className="py-1 pr-4 font-medium">{series.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {months.map(row => (
                      <tr key={row.label} className="border-t">
                        <td className="py-1 pr-4">{row.label}</td>
                        <td className="py-1 pr-4">{row.sales}</td>
                        <td className="py-1 pr-4">{row.centers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Admission status ─────────────────────────────────────────────────────────

export function StatusStat({ label, count, total, color, unit = 'application' }: { label: string; count: number; total: number; color: string; unit?: string }) {
  const percent = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-bold">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${percent}%` }} />
      </div>
      <p className="text-right text-[10px] text-muted-foreground">{count} {unit}{count === 1 ? '' : 's'}</p>
    </div>
  );
}

function AdmissionStatus({ applications, onNavigate }: { applications: any; onNavigate: Navigate }) {
  const summary = applications?.summary;
  return (
    <Card
      className="cursor-pointer border-none bg-card/60 shadow-xl backdrop-blur-xl transition-colors hover:border-primary/30"
      onClick={() => onNavigate('student_enrollment')}
    >
      <CardHeader>
        <CardTitle>Admission Status</CardTitle>
        <CardDescription>Live student application breakdown</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pb-6">
        {applications === undefined ? (
          <div className="h-56 animate-pulse rounded-lg bg-muted" aria-label="Loading admission status" />
        ) : applications === null ? (
          <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">Could not load this section.</p>
        ) : (
          <>
            <StatusStat label="Enrolled" count={summary.enrolled} total={summary.total} color="bg-success" />
            <StatusStat label="Under review" count={summary.document_review + summary.finance_review} total={summary.total} color="bg-warning" />
            <StatusStat label="Rejected" count={summary.ops_rejected + summary.rejected} total={summary.total} color="bg-error" />
            <div className="mt-3 border-t border-border pt-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium">Total Applications</span>
                <span className="text-sm font-bold">{summary.total}</span>
              </div>
              <p className="text-xs text-muted-foreground">Click to view all applications</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Recent admissions ────────────────────────────────────────────────────────

function RecentAdmissions({ applications, admissions, onNavigate }: { applications: any; admissions: any[] | null | undefined; onNavigate: Navigate }) {
  const loading = applications === undefined || admissions === undefined;
  const failed = applications === null && admissions === null;
  // An admission can be in both lists; each student appears once
  const recent = useMemo(() => {
    const byId = new Map<string, { row: any; tab: string }>();
    (admissions || []).forEach(row => byId.set(row.id, { row, tab: 'center_admissions' }));
    (applications?.data || []).forEach((row: any) => byId.set(row.id, { row, tab: 'student_enrollment' }));
    return [...byId.values()]
      .sort((a, b) => new Date(b.row.createdAt).getTime() - new Date(a.row.createdAt).getTime())
      .slice(0, 5);
  }, [applications, admissions]);

  return (
    <Card className="cursor-pointer transition-colors hover:border-primary/30 lg:col-span-2" onClick={() => onNavigate('student_enrollment')}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Recent Admissions</CardTitle>
        <Button size="sm" variant="ghost" onClick={event => { event.stopPropagation(); onNavigate('student_enrollment'); }}>
          View All <ArrowUpRight className="ml-1 h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 pb-6">
        {loading ? (
          [1, 2, 3, 4].map(item => <div key={item} className="h-12 animate-pulse rounded-lg bg-muted" />)
        ) : failed ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Could not load this section.</p>
        ) : recent.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <GraduationCap className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">No admissions yet</p>
          </div>
        ) : recent.map(({ row, tab }) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
            onClick={event => { event.stopPropagation(); onNavigate(tab); }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {(row.studentName || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{row.studentName || 'Student'}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {[row.program?.name, row.studyCenter?.name, new Date(row.createdAt).toLocaleDateString()].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              {row.totalFee > 0 && <p className="text-sm font-bold">₹{Number(row.totalFee).toLocaleString()}</p>}
              <span className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                row.status === 'enrolled' ? 'bg-success/10 text-success' : isRejectedStatus(row.status) ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning',
              )}>
                {String(row.status || '').replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Priority actions ─────────────────────────────────────────────────────────

const ACTION_STYLES = {
  error: { box: 'border-error/20 bg-error/5 hover:bg-error/10', icon: 'text-error', Icon: AlertTriangle },
  warning: { box: 'border-warning/20 bg-warning/5 hover:bg-warning/10', icon: 'text-warning', Icon: AlertCircle },
  primary: { box: 'border-primary/20 bg-primary/5 hover:bg-primary/10', icon: 'text-primary', Icon: Clock },
};

export function PriorityActions({ actions, loading, onNavigate }: {
  actions: { title: string; text: string; tab: string; style: keyof typeof ACTION_STYLES }[];
  loading: boolean;
  onNavigate: Navigate;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Priority Actions</CardTitle></CardHeader>
      <CardContent className="space-y-3 pb-6">
        {actions.map(({ title, text, tab, style }) => {
          const { box, icon, Icon } = ACTION_STYLES[style];
          return (
            <div key={title} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors', box)} onClick={() => onNavigate(tab)}>
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', icon)} />
              <div>
                <h5 className="text-sm font-bold">{title}</h5>
                <p className="mt-1 text-xs text-muted-foreground">{text}</p>
              </div>
            </div>
          );
        })}
        {loading ? (
          <div className="h-16 animate-pulse rounded-xl bg-muted" aria-label="Loading priority actions" />
        ) : actions.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            <CheckCircle className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">All clear — no pending actions</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Bar lists ────────────────────────────────────────────────────────────────

// Horizontal bars on one baseline, one hue, with the value at the end of each bar
export function BarListCard({ title, description, rows, emptyMessage, onClick }: {
  title: string;
  description: string;
  rows: { label: string; value: number }[] | null | undefined;
  emptyMessage: string;
  onClick: () => void;
}) {
  const max = Math.max(...(rows || []).map(row => row.value), 1);
  return (
    <Card className="cursor-pointer transition-colors hover:border-primary/30" onClick={onClick}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        {rows === undefined ? (
          <div className="h-40 animate-pulse rounded-lg bg-muted" aria-label={`Loading ${title}`} />
        ) : rows === null ? (
          <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">Could not load this chart.</p>
        ) : !rows.some(row => row.value > 0) ? (
          <p className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="space-y-3.5">
            {rows.map(row => (
              <li key={row.label} title={`${row.label}: ${row.value}`}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-muted-foreground">{row.label}</span>
                  <span className="font-semibold">{row.value}</span>
                </div>
                <div className="h-3 rounded-r bg-muted/60">
                  {row.value > 0 && (
                    <div
                      className="h-full rounded-r transition-opacity hover:opacity-80"
                      style={{ width: `${(row.value / max) * 100}%`, backgroundColor: 'var(--viz-series-1)' }}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// Largest first; anything past the top five is folded into "Other"
export const countBy = (rows: any[], field: (row: any) => string | undefined) => {
  const counts = new Map<string, number>();
  rows.forEach(row => {
    const label = field(row) || 'Not specified';
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  const ranked = [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  if (ranked.length <= 5) return ranked;
  return [...ranked.slice(0, 5), { label: 'Other', value: ranked.slice(5).reduce((sum, row) => sum + row.value, 0) }];
};

// ─── Overview ─────────────────────────────────────────────────────────────────

// Every figure reads the same endpoint as the page it links to, so the numbers match that page.
export function SalesOverview({ hideTeam, onNavigate }: { hideTeam: boolean; onNavigate: Navigate }) {
  // One request per endpoint, so a list is never downloaded twice
  const get = useMemo<OverviewGet>(() => {
    const responses = new Map<string, Promise<any>>();
    return path => {
      if (!responses.has(path)) responses.set(path, api.get(path).then(response => response.data));
      return responses.get(path)!;
    };
  }, []);
  const list = (path: string) => async (): Promise<any[]> => (await get(path)).data || [];

  const applications = useOverviewData(() => get('/sales/student-applications'), [get]);
  const admissions = useOverviewData(list('/enrollment/all'), [get]);
  // Sub-department managers have no My Team page in their menu
  const team = useOverviewData(hideTeam ? async () => [] : list('/users/my-team'), [get, hideTeam]);
  const targets = useOverviewData(list('/sales/targets'), [get]);
  const tasks = useOverviewData(list('/tasks'), [get]);
  const invites = useOverviewData(list('/sales/invites'), [get]);
  const studyCenters = useOverviewData(list('/operations/centers?mode=sales'), [get]);
  const myCenters = useOverviewData(list('/sales/my-centers'), [get]);
  const returnedCenters = useOverviewData(list('/operations/centers?mode=sales&status=ops_rejected'), [get]);

  const summary = applications?.summary;
  const underReview = summary ? summary.document_review + summary.finance_review : 0;
  const returnedStudents = summary?.ops_rejected || 0;
  const returnedTotal = (returnedCenters?.length || 0) + returnedStudents;
  const openTasks = (tasks || []).filter(task => task.status !== 'completed');
  const overdueTasks = openTasks.filter(isTaskOverdue).length;
  const centerEnrolled = (admissions || []).filter(row => row.status === 'enrolled').length;
  const centerInProgress = (admissions || []).filter(row => row.status !== 'enrolled' && !isRejectedStatus(row.status)).length;
  const countCenters = (statuses: string[]) => (myCenters || []).filter(center => statuses.includes(center.status)).length;
  const onboardingPending = countCenters(['pending_verification', 'ops_resubmitted', 'pending', 'pending_payment', 'finance_resubmitted']);

  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  const actions = [
    ...(returnedTotal > 0 ? [{ title: 'Returned by Operations', text: `${returnedTotal} ${returnedTotal === 1 ? 'record needs' : 'records need'} correction and resubmission.`, tab: 'pending_center_verification', style: 'error' as const }] : []),
    ...(overdueTasks > 0 ? [{ title: 'Overdue Tasks', text: `${plural(overdueTasks, 'task')} past the deadline.`, tab: 'tasks', style: 'warning' as const }] : []),
    ...(underReview > 0 ? [{ title: 'Applications Under Review', text: `${plural(underReview, 'application')} awaiting Operations or Finance.`, tab: 'student_enrollment', style: 'primary' as const }] : []),
    ...(onboardingPending > 0 ? [{ title: 'Centers in Onboarding', text: `${plural(onboardingPending, 'center')} awaiting verification or payment.`, tab: 'center_onboarding', style: 'primary' as const }] : []),
  ];
  const actionsLoading = [applications, tasks, myCenters, returnedCenters].some(section => section === undefined);

  const tiles = [
    ...(hideTeam ? [] : [{ label: 'My Team', value: figure(team, rows => rows.length), icon: <Users className="h-4 w-4" />, tab: 'my_team', urgent: false }]),
    { label: 'Targets', value: figure(targets, rows => rows.length), icon: <Target className="h-4 w-4" />, tab: 'targets', urgent: false },
    { label: 'Open Tasks', value: figure(tasks, () => openTasks.length), icon: <ClipboardList className="h-4 w-4" />, tab: 'tasks', urgent: overdueTasks > 0 },
    { label: 'Invite Links', value: figure(invites, rows => rows.length), icon: <Link2 className="h-4 w-4" />, tab: 'invite_links', urgent: false },
    { label: 'Study Centers', value: figure(studyCenters, rows => rows.length), icon: <School className="h-4 w-4" />, tab: 'study_centre', urgent: false },
    { label: 'Pending Verification', value: figure(returnedCenters === undefined || applications === undefined ? undefined : returnedCenters === null || applications === null ? null : returnedTotal, total => total), icon: <ShieldCheck className="h-4 w-4" />, tab: 'pending_center_verification', urgent: returnedTotal > 0 },
  ];

  const pipelineRows = myCenters && [
    { label: 'Pending Operations', value: countCenters(['pending_verification', 'ops_resubmitted', 'pending']) },
    { label: 'Pending payment', value: countCenters(['pending_payment', 'finance_resubmitted']) },
    { label: 'Active', value: countCenters(['active']) },
    { label: 'Rejected', value: countCenters(['rejected', 'ops_rejected', 'finance_rejected', 'rejected_from_finance']) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <OverviewMetric
          title="Student Applications"
          value={figure(applications, loaded => loaded.summary.total)}
          sub={applications ? plural(summary.total, 'total application') : 'Sales pipeline'}
          trend={applications ? (underReview > 0 ? `${underReview} under review` : summary.total > 0 ? 'All reviewed' : 'No applications yet') : undefined}
          trendType={applications && summary.total > 0 ? (underReview > 0 ? 'warn' : 'up') : undefined}
          icon={<GraduationCap className="h-5 w-5" />}
          color="primary"
          onClick={() => onNavigate('student_enrollment')}
        />
        <OverviewMetric
          title="Enrolled Students"
          value={figure(applications, loaded => loaded.summary.enrolled)}
          sub="From sales applications"
          trend={applications && summary.total > 0 ? `${Math.round((summary.enrolled / summary.total) * 100)}% enrollment rate` : undefined}
          trendType="up"
          icon={<UserCheck className="h-5 w-5" />}
          color="success"
          onClick={() => onNavigate('student_enrollment')}
        />
        <OverviewMetric
          title="Center Admissions"
          value={figure(admissions, rows => rows.length)}
          sub={admissions ? `${centerEnrolled} enrolled` : 'From your study centers'}
          trend={admissions ? (centerInProgress > 0 ? `${centerInProgress} in progress` : admissions.length > 0 ? 'All processed' : 'No admissions yet') : undefined}
          trendType={admissions && admissions.length > 0 ? (centerInProgress > 0 ? 'warn' : 'up') : undefined}
          icon={<Building2 className="h-5 w-5" />}
          color="warning"
          onClick={() => onNavigate('center_admissions')}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map(({ tab, ...tile }) => <OverviewTile key={tab} {...tile} onClick={() => onNavigate(tab)} />)}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AdmissionsChart applications={applications} admissions={admissions} onNavigate={onNavigate} />
        <AdmissionStatus applications={applications} onNavigate={onNavigate} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <RecentAdmissions applications={applications} admissions={admissions} onNavigate={onNavigate} />
        <PriorityActions actions={actions} loading={actionsLoading} onNavigate={onNavigate} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <BarListCard
          title="Top Programs"
          description="Student applications by program"
          rows={applications === undefined ? undefined : applications === null ? null : countBy(applications.data || [], row => row.program?.name)}
          emptyMessage="No student applications yet."
          onClick={() => onNavigate('student_enrollment')}
        />
        {!hideTeam && (
          <BarListCard
            title="Team Performance"
            description="Student applications by salesperson"
            rows={applications === undefined ? undefined : applications === null ? null : countBy(applications.data || [], row => row.salesUser?.name)}
            emptyMessage="No applications from your team yet."
            onClick={() => onNavigate('my_team')}
          />
        )}
        <BarListCard
          title="Study Center Pipeline"
          description="Centers at each onboarding stage"
          rows={pipelineRows}
          emptyMessage="No study centers yet."
          onClick={() => onNavigate('center_onboarding')}
        />
      </div>
    </div>
  );
}
