import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  RefreshCw, Download, Search, X, AlertCircle, Clock, CheckCircle2,
  GraduationCap, Building2, School, IndianRupee,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReregRow {
  id: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  enrollmentNumber: string;
  program: string;
  university: string;
  center: string;
  branchName: string;
  session: string;
  reregClosingDate: string | null;
  reregPaymentStatus: 'Pending' | 'Partially Paid' | 'Paid';
  enrollmentStatus: string;
  daysUntilDeadline: number | null;
  installmentName?: string;
  installmentAmount?: number;
  amountPaid?: number;
  balanceDue?: number;
  deadlineSource?: 'fee_structure' | 'session' | 'estimated';
  completedInstallments?: number;
  totalInstallments?: number;
}

const DEADLINE_SOURCE_LABEL: Record<string, string> = {
  fee_structure: 'Fee structure due date',
  session: 'Session closing date',
  estimated: 'Estimated from enrolment date',
};

const formatInr = (value?: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

// ─── Excel Export Helper ───────────────────────────────────────────────────────
function exportToExcel(rows: ReregRow[]) {
  const headers = [
    'Enrollment No', 'Student Name', 'Email', 'Phone',
    'Center', 'Branch', 'University', 'Program', 'Session',
    'Re-Reg Closing Date', 'Days Until Deadline', 'Payment Status', 'Enrollment Status',
    'Installment', 'Installment Amount', 'Paid', 'Balance Due', 'Deadline Source',
  ];
  const data = rows.map(r => [
    r.enrollmentNumber,
    r.studentName,
    r.studentEmail,
    r.studentPhone,
    r.center,
    r.branchName,
    r.university,
    r.program,
    r.session,
    r.reregClosingDate ? new Date(r.reregClosingDate).toLocaleDateString() : 'N/A',
    r.daysUntilDeadline != null ? r.daysUntilDeadline.toString() : 'N/A',
    r.reregPaymentStatus,
    r.enrollmentStatus,
    r.installmentName || '',
    r.installmentAmount ?? '',
    r.amountPaid ?? '',
    r.balanceDue ?? '',
    r.deadlineSource ? DEADLINE_SOURCE_LABEL[r.deadlineSource] : '',
  ]);

  const csvContent = [headers, ...data]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `rereg_pending_report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export function FinanceReregPendingReportPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ReregRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [search, setSearch] = useState('');
  const [centerId, setCenterId] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [programId, setProgramId] = useState('');
  const [dueDate, setDueDate] = useState('');
  
  // Sorting state
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

  // Dropdown data
  const [centers, setCenters] = useState<any[]>([]);
  const [universities, setUniversities] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);

  const isCenterUser = user?.role === 'center_admin';

  // Load dropdown data
  useEffect(() => {
    if (!isCenterUser) {
      api.get('/operations/centers').then(r => setCenters(r.data.data || [])).catch(() => {});
    }
    api.get('/operations/universities').then(r => setUniversities(r.data.data || [])).catch(() => {});
    api.get('/operations/programs').then(r => setPrograms(r.data.data || [])).catch(() => {});
  }, [isCenterUser]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (centerId) params.set('centerId', centerId);
      if (universityId) params.set('universityId', universityId);
      if (programId) params.set('programId', programId);
      if (search.trim()) params.set('search', search.trim());
      if (dueDate) params.set('dueDate', dueDate);
      const res = await api.get(`/finance/rereg-pending-report?${params.toString()}`);
      setRows(res.data.data || []);
    } catch (err: any) {
      toast.error('Failed to load re-reg pending report');
    } finally {
      setLoading(false);
    }
  }, [centerId, universityId, programId, search, dueDate]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleReset = () => {
    setSearch('');
    setCenterId('');
    setUniversityId('');
    setProgramId('');
    setDueDate('');
  };

  const hasFilters = search || centerId || universityId || programId || dueDate;

  // Urgency badge
  const urgencyBadge = (days: number | null) => {
    if (days == null) return <Badge variant="outline" className="text-[10px]">No deadline</Badge>;
    if (days < 0) return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">Overdue {Math.abs(days)}d</Badge>;
    if (days <= 7) return <Badge className="bg-warning/10 text-warning border-warning/20 text-[10px]">{days}d left</Badge>;
    return <Badge className="bg-success/10 text-success border-success/20 text-[10px]">{days}d left</Badge>;
  };

  // Stats
  const overdueCount = rows.filter(r => (r.daysUntilDeadline ?? 1) < 0).length;
  const dueThisWeek = rows.filter(r => r.daysUntilDeadline != null && r.daysUntilDeadline >= 0 && r.daysUntilDeadline <= 7).length;
  const totalBalanceDue = rows.reduce((sum, r) => sum + (Number(r.balanceDue) || 0), 0);

  // Filtered programs based on selected university
  const filteredPrograms = universityId
    ? programs.filter((p: any) => p.universityId === universityId || (typeof p.university === 'object' && p.university?.id === universityId))
    : programs;

  // Sorted rows
  const sortedRows = [...rows].sort((a, b) => {
    if (sortOrder === null) return 0;
    
    // Sort by daysUntilDeadline (which correlates with due date)
    const aVal = a.daysUntilDeadline ?? Infinity;
    const bVal = b.daysUntilDeadline ?? Infinity;
    
    if (sortOrder === 'asc') return aVal - bVal;
    return bVal - aVal;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Re-Registration Pending Report</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enrolled students whose next semester / year fee (after the admission installment) is not yet paid.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => exportToExcel(rows)} disabled={rows.length === 0} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-md bg-gradient-to-br from-destructive/10 to-destructive/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-destructive/20">
              <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Overdue</p>
              <p className="text-2xl font-bold mt-0.5">{loading ? '...' : overdueCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-gradient-to-br from-warning/10 to-warning/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-warning/20">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Due This Week</p>
              <p className="text-2xl font-bold mt-0.5">{loading ? '...' : dueThisWeek}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-primary/20">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Pending</p>
              <p className="text-2xl font-bold mt-0.5">{loading ? '...' : rows.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-gradient-to-br from-info/10 to-info/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-info/20">
              <IndianRupee className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Balance Due</p>
              <p className="text-2xl font-bold mt-0.5">{loading ? '...' : formatInr(totalBalanceDue)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search student name, email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>

            {/* Center filter */}
            {!isCenterUser && (
              <Select value={centerId || 'all'} onValueChange={v => setCenterId(v === 'all' ? '' : v)}>
                <SelectTrigger className="h-9 text-sm gap-2">
                  <School className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="All Centers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Centers</SelectItem>
                  {centers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* University filter */}
            <Select value={universityId || 'all'} onValueChange={v => { setUniversityId(v === 'all' ? '' : v); setProgramId(''); }}>
              <SelectTrigger className="h-9 text-sm gap-2">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="All Universities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Universities</SelectItem>
                {universities.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Program filter */}
            <Select value={programId || 'all'} onValueChange={v => setProgramId(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-9 text-sm gap-2">
                <GraduationCap className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="All Programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {filteredPrograms.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort filter */}
            <Select value={sortOrder || 'default'} onValueChange={v => setSortOrder(v === 'default' ? null : (v as 'asc' | 'desc'))}>
              <SelectTrigger className="h-9 text-sm gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default Sort</SelectItem>
                <SelectItem value="asc">Earliest Deadline</SelectItem>
                <SelectItem value="desc">Latest Deadline</SelectItem>
              </SelectContent>
            </Select>

            {/* Due Date filter */}
            <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
              <Input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="h-9 text-sm"
                title="Filter by deadline until this date"
              />
            </div>
          </div>

          {/* Reset */}
          {(hasFilters || sortOrder) && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => { handleReset(); setSortOrder(null); }} className="gap-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
                Reset Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Pending Re-Registration Students</CardTitle>
              <CardDescription>
                {loading ? 'Loading...' : `${rows.length} student${rows.length !== 1 ? 's' : ''} with pending re-registration payment`}
              </CardDescription>
            </div>
            {rows.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => exportToExcel(rows)} className="gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Download CSV
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="w-10 h-10 text-success/60 mb-3" />
              <p className="font-medium text-sm">No pending re-registrations found</p>
              <p className="text-xs text-muted-foreground mt-1">
                All students with re-reg deadlines have paid, or no sessions have re-reg dates set.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {[
                      { key: 'enrollmentNumber', label: 'Enrollment No' },
                      { key: 'student', label: 'Student' },
                      { key: 'center', label: 'Center' },
                      { key: 'university', label: 'University' },
                      { key: 'program', label: 'Program' },
                      { key: 'session', label: 'Session' },
                      { key: 'amount', label: 'Amount Due' },
                      { key: 'deadline', label: 'Re-Reg Deadline', sortable: true },
                      { key: 'urgency', label: 'Urgency' },
                      { key: 'status', label: 'Status' }
                    ].map(h => (
                      <th 
                        key={h.key} 
                        className={`px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap ${h.sortable ? 'cursor-pointer hover:text-foreground select-none' : ''}`}
                        onClick={() => {
                          if (h.sortable) {
                            setSortOrder(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          {h.label}
                          {h.sortable && sortOrder === 'asc' && <span>↑</span>}
                          {h.sortable && sortOrder === 'desc' && <span>↓</span>}
                          {h.sortable && sortOrder === null && <span className="opacity-30">↕</span>}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedRows.map(row => (
                    <tr key={row.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {row.enrollmentNumber || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{row.studentName}</p>
                        <p className="text-[11px] text-muted-foreground">{row.studentEmail}</p>
                        <p className="text-[11px] text-muted-foreground">{row.studentPhone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{row.center || '—'}</p>
                        {row.branchName && <p className="text-[11px] text-muted-foreground">{row.branchName}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm">{row.university || '—'}</td>
                      <td className="px-4 py-3 text-sm">{row.program || '—'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {row.session || '—'}
                        {row.totalInstallments != null && (
                          <p className="text-[11px]">Re-registrations paid: {row.completedInstallments ?? 0} of {Math.max(0, row.totalInstallments - 1)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap tabular-nums">
                        {row.balanceDue != null ? (
                          <>
                            <p className="font-semibold">{formatInr(row.balanceDue)}</p>
                            {!!row.amountPaid && (
                              <p className="text-[11px] text-muted-foreground">{formatInr(row.amountPaid)} paid of {formatInr(row.installmentAmount)}</p>
                            )}
                          </>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {row.reregClosingDate
                          ? new Date(row.reregClosingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                        {row.deadlineSource && (
                          <p className="text-[11px] text-muted-foreground">{DEADLINE_SOURCE_LABEL[row.deadlineSource]}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">{urgencyBadge(row.daysUntilDeadline)}</td>
                      <td className="px-4 py-3">
                        <Badge className={row.reregPaymentStatus === 'Partially Paid'
                          ? 'bg-warning/10 text-warning border-warning/20 text-[10px] uppercase'
                          : 'bg-destructive/10 text-destructive border-destructive/20 text-[10px] uppercase'}>
                          {row.reregPaymentStatus}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
