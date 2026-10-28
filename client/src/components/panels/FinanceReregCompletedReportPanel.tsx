import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  RefreshCw, Download, Search, X, CheckCircle2,
  GraduationCap, Building2, School, IndianRupee,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReregCompletedRow {
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
  completedInstallment: string;
  paidDate: string;
  amountPaid: number;
  invoiceId: string;
  dueDate?: string;
  paidOnTime?: boolean | null;
}

// ─── Excel Export Helper ───────────────────────────────────────────────────────
function exportToExcel(rows: ReregCompletedRow[]) {
  const headers = [
    'Enrollment No', 'Student Name', 'Email', 'Phone',
    'Center', 'Branch', 'University', 'Program', 'Session',
    'Completed Installment', 'Paid Date', 'Amount Paid', 'Due Date', 'Paid On Time'
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
    r.completedInstallment,
    r.paidDate ? new Date(r.paidDate).toLocaleDateString() : 'N/A',
    r.amountPaid,
    r.dueDate ? new Date(r.dueDate).toLocaleDateString() : 'N/A',
    r.paidOnTime == null ? 'N/A' : r.paidOnTime ? 'Yes' : 'Late',
  ]);

  const csvContent = [headers, ...data]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `rereg_completed_report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export function FinanceReregCompletedReportPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ReregCompletedRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [search, setSearch] = useState('');
  const [centerId, setCenterId] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [programId, setProgramId] = useState('');
  
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
      const res = await api.get(`/finance/rereg-completed-report?${params.toString()}`);
      setRows(res.data.data || []);
    } catch (err: any) {
      toast.error('Failed to load re-reg completed report');
    } finally {
      setLoading(false);
    }
  }, [centerId, universityId, programId, search]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleReset = () => {
    setSearch('');
    setCenterId('');
    setUniversityId('');
    setProgramId('');
  };

  const hasFilters = search || centerId || universityId || programId;

  // Filtered programs based on selected university
  const filteredPrograms = universityId
    ? programs.filter((p: any) => p.universityId === universityId || (typeof p.university === 'object' && p.university?.id === universityId))
    : programs;

  // Sorted rows
  const sortedRows = [...rows].sort((a, b) => {
    if (sortOrder === null) return 0;
    const aTime = new Date(a.paidDate).getTime();
    const bTime = new Date(b.paidDate).getTime();
    if (sortOrder === 'asc') return aTime - bTime;
    return bTime - aTime;
  });

  const totalAmount = rows.reduce((acc, row) => acc + (Number(row.amountPaid) || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Re-Registration Completed Report</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Students who have successfully paid for their re-registration installments.
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-none shadow-md bg-gradient-to-br from-success/10 to-success/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-success/20">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Completed</p>
              <p className="text-2xl font-bold mt-0.5">{loading ? '...' : rows.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-primary/20">
              <IndianRupee className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Amount Collected</p>
              <p className="text-2xl font-bold mt-0.5">{loading ? '...' : `₹${totalAmount.toLocaleString()}`}</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
          </div>

          {/* Reset */}
          {hasFilters && (
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
              <CardTitle className="text-base">Completed Re-Registration Students</CardTitle>
              <CardDescription>
                {loading ? 'Loading...' : `${rows.length} record${rows.length !== 1 ? 's' : ''} found`}
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
              <p className="font-medium text-sm">No completed re-registrations found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Adjust filters or check back later.
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
                      { key: 'installment', label: 'Installment' },
                      { key: 'paidDate', label: 'Paid Date', sortable: true },
                      { key: 'amount', label: 'Amount Paid' }
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
                      <td className="px-4 py-3 text-sm font-medium text-primary">
                        {row.completedInstallment}
                        <br />
                        <span className="text-[10px] text-muted-foreground font-normal">{row.session || ''}</span>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {row.paidDate
                          ? new Date(row.paidDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                        {row.dueDate && (
                          <p className={`text-[11px] ${row.paidOnTime === false ? 'text-destructive' : 'text-muted-foreground'}`}>
                            Due {new Date(row.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {row.paidOnTime === false ? ' · paid late' : row.paidOnTime ? ' · on time' : ''}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        ₹{row.amountPaid?.toLocaleString() || 0}
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
