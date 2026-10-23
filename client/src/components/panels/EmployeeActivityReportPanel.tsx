import { useState, useEffect } from 'react';
import {
  Clock, Users, Activity, ChevronDown, ChevronUp,
  RefreshCw, Search, Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttendanceInfo {
  status: string;
  checkIn?: string;
  checkOut?: string;
  isLate?: boolean;
  lateMinutes?: number;
  workingHours?: number;
}

interface TaskInfo {
  total: number;
  completedToday: number;
  inProgress: number;
  overdue: number;
  list: any[];
}

interface ActivityEvent {
  action: string;
  entityType: string;
  route?: string | null;
  timestamp: string;
}

interface EmployeeReport {
  userId: string;
  name: string;
  email: string;
  role: string;
  designation?: string;
  department: string;
  departmentId?: any;
  attendance: AttendanceInfo | null;
  erpActions: number;
  erpActivity: Record<string, number>;
  recentActivity: ActivityEvent[];
  tasks: TaskInfo;
}

interface DeptSummary {
  departmentId: string;
  name: string;
  totalEmployees: number;
  present: number;
  absent: number;
  late: number;
  totalErpActions: number;
  totalTasksCompleted: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(time?: string) {
  if (!time) return '—';
  return new Date(time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function hoursLabel(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function statusColor(status?: string) {
  switch (status) {
    case 'present': return 'bg-success/10 text-success';
    case 'late': return 'bg-warning/10 text-warning';
    case 'absent': return 'bg-destructive/10 text-destructive';
    case 'half_day': return 'bg-info/10 text-info';
    default: return 'bg-muted text-muted-foreground';
  }
}

// ─── Department Summary Cards ─────────────────────────────────────────────────

function DeptCards({ departments }: { departments: DeptSummary[] }) {
  if (!departments.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {departments.map(d => (
        <Card key={d.departmentId} className="border-none shadow-md bg-card/60">
          <CardContent className="p-4 space-y-3">
            <p className="font-semibold text-sm truncate">{d.name}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-1 text-center">
              <div>
                <p className="text-lg font-bold text-success">{d.present}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Present</p>
              </div>
              <div>
                <p className="text-lg font-bold text-destructive">{d.absent}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Absent</p>
              </div>
              <div>
                <p className="text-lg font-bold text-warning">{d.late}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Late</p>
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground border-t pt-2">
              <span>User actions</span>
              <span className="font-semibold text-foreground">{d.totalErpActions}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Tasks done</span>
              <span className="font-semibold text-foreground">{d.totalTasksCompleted}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── ERP Activity Breakdown ───────────────────────────────────────────────────

function ErpBreakdown({ activity }: { activity: Record<string, number> }) {
  const entries = Object.entries(activity || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return <p className="text-xs text-muted-foreground">No UMS activity recorded</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, count]) => (
        <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
          {key} <span className="font-bold">{count}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Employee Row ─────────────────────────────────────────────────────────────

function EmployeeRow({ emp }: { emp: EmployeeReport }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
              {emp.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold">{emp.name}</p>
              <p className="text-[11px] text-muted-foreground">{emp.designation || emp.role}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">{emp.department}</td>
        <td className="px-4 py-3">
          <Badge className={cn('text-[10px] uppercase font-bold', statusColor(emp.attendance?.status))}>
            {(emp.attendance?.status || 'absent').replace('_', ' ')}
          </Badge>
        </td>
        <td className="px-4 py-3 text-xs">
          <span>{fmt(emp.attendance?.checkIn)}</span>
          {emp.attendance?.isLate && (
            <span className="ml-1 text-warning text-[10px]">+{emp.attendance.lateMinutes}m late</span>
          )}
        </td>
        <td className="px-4 py-3 text-xs">{fmt(emp.attendance?.checkOut)}</td>
        <td className="px-4 py-3 text-xs font-semibold">
          {emp.attendance?.workingHours != null ? hoursLabel(emp.attendance.workingHours) : '—'}
        </td>
        <td className="px-4 py-3 text-xs text-center font-semibold">{emp.erpActions}</td>
        <td className="px-4 py-3 text-xs text-center">
          <span className="text-success font-bold">{emp.tasks?.completedToday || 0}</span>
          <span className="text-muted-foreground">/{emp.tasks?.total || 0}</span>
        </td>
        <td className="px-4 py-3 text-center">
          {expanded ? <ChevronUp className="w-4 h-4 mx-auto text-muted-foreground" /> : <ChevronDown className="w-4 h-4 mx-auto text-muted-foreground" />}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/20">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recorded Activity Breakdown</p>
                <ErpBreakdown activity={emp.erpActivity} />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recorded User Activity</p>
                {emp.recentActivity?.length ? (
                  <div className="space-y-1.5">
                    {emp.recentActivity.map((event, index) => (
                      <div key={`${event.timestamp}-${event.action}-${index}`} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-muted-foreground">
                          {event.action} {event.entityType === 'UserActivity' ? (event.route || 'activity') : event.entityType}
                        </span>
                        <span className="shrink-0 text-muted-foreground">{fmt(event.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No user activity recorded for this date.</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tasks</p>
                <div className="flex gap-4 text-xs">
                  <span className="text-success">✓ {emp.tasks?.completedToday || 0} done today</span>
                  <span className="text-info">⟳ {emp.tasks?.inProgress || 0} in progress</span>
                  {(emp.tasks?.overdue || 0) > 0 && <span className="text-destructive">⚠ {emp.tasks.overdue} overdue</span>}
                </div>
                {(emp.tasks?.list || []).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {emp.tasks.list.slice(0, 5).map((t: any) => (
                      <div key={t.id} className="flex items-center gap-2 text-xs">
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0',
                          t.status === 'completed' ? 'bg-success' :
                          t.status === 'overdue' ? 'bg-destructive' : 'bg-warning'
                        )} />
                        <span className="truncate text-muted-foreground">{t.title}</span>
                        <Badge variant="outline" className="text-[9px] shrink-0">{t.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function EmployeeActivityReportPanel() {
  const [date, setDate] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  });
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [departments, setDepartments] = useState<DeptSummary[]>([]);
  const [report, setReport] = useState<EmployeeReport[]>([]);
  const [scheduledHours, setScheduledHours] = useState(8);
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [loading, setLoading] = useState(false);
  const [deptList, setDeptList] = useState<any[]>([]);

  useEffect(() => {
    api.get('/departments').then(r => setDeptList(r.data.data || [])).catch(() => {});
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchReport(); }, [date, deptFilter]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params: any = { date };
      if (deptFilter) params.departmentId = deptFilter;
      const res = await api.get('/hr/attendance/activity-report', { params });
      setReport(res.data.data || []);
      setDepartments(res.data.departments || []);
      setScheduledHours(res.data.scheduledHours ?? 8);
      setBreakMinutes(res.data.breakMinutes ?? 60);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load activity report');
    } finally {
      setLoading(false);
    }
  };

  const filtered = report.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalPresent = departments.reduce((s, d) => s + d.present, 0);
  const totalAbsent = departments.reduce((s, d) => s + d.absent, 0);
  const totalLate = departments.reduce((s, d) => s + d.late, 0);
  const totalErp = report.reduce((s, e) => s + e.erpActions, 0);
  const totalWorkingHours = filtered.reduce((sum, employee) => sum + (employee.attendance?.workingHours || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Employee Activity Report
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Daily attendance, recorded user actions, and task updates. Break: {breakMinutes}m. Scheduled: {hoursLabel(scheduledHours)}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Departments</option>
            {deptList.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search employee..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Org-level summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Present', value: totalPresent, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Absent', value: totalAbsent, color: 'text-destructive', bg: 'bg-destructive/10' },
          { label: 'Late', value: totalLate, color: 'text-warning', bg: 'bg-warning/10' },
          { label: 'User Actions', value: totalErp, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Total Working Time', value: hoursLabel(totalWorkingHours), color: 'text-info', bg: 'bg-info/10' },
        ].map(s => (
          <Card key={s.label} className="border-none shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', s.bg)}>
                <Users className={cn('w-4 h-4', s.color)} />
              </div>
              <div>
                <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Department cards */}
      {departments.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Department Summary</p>
          <DeptCards departments={departments} />
        </div>
      )}

      {/* Employee table */}
      <Card className="border-none shadow-xl overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Employee Detail ({filtered.length})</span>
            {loading && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !report.length ? (
            <div className="space-y-2 p-4">
              {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No data for this date / filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
<div className="overflow-x-auto w-full">
<table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {['Employee', 'Dept', 'Status', 'Check-In', 'Check-Out', 'Total Working', 'User Actions', 'Tasks', ''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(emp => (
                    <EmployeeRow key={emp.userId} emp={emp} />
                  ))}
                </tbody>
              </table>
</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
