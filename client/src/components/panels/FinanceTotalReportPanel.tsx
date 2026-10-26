import { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const statusColor = (s: string) => {
  if (!s) return 'bg-gray-100 text-gray-500';
  const l = s.toLowerCase();
  if (l === 'paid') return 'bg-green-100 text-green-700 border border-green-200';
  if (l === 'due' || l === 'pending') return 'bg-amber-100 text-amber-700 border border-amber-200';
  if (l === 'not applicable') return 'bg-slate-100 text-slate-400';
  return 'bg-blue-100 text-blue-700';
};

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

interface FilterState {
  universityId: string;
  programId: string;
  sessionId: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: FilterState = {
  universityId: '__all__',
  programId: '__all__',
  sessionId: '__all__',
  search: '',
  dateFrom: '',
  dateTo: '',
};

export function FinanceTotalReportPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // UI filter state (what the user sees in the dropdowns)
  const [uiFilters, setUiFilters] = useState<FilterState>(EMPTY_FILTERS);
  // Applied filter state (what is actually sent to the server)
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(EMPTY_FILTERS);

  const [universities, setUniversities] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  // Fetch report whenever appliedFilters changes — no stale closure issues
  useEffect(() => {
    const params = new URLSearchParams();
    if (appliedFilters.universityId !== '__all__') params.set('universityId', appliedFilters.universityId);
    if (appliedFilters.programId !== '__all__') params.set('programId', appliedFilters.programId);
    if (appliedFilters.sessionId !== '__all__') params.set('sessionId', appliedFilters.sessionId);
    if (appliedFilters.search) params.set('search', appliedFilters.search);
    if (appliedFilters.dateFrom) params.set('dateFrom', appliedFilters.dateFrom);
    if (appliedFilters.dateTo) params.set('dateTo', appliedFilters.dateTo);

    setLoading(true);
    api.get(`/finance/total-report?${params.toString()}`)
      .then(res => setRows(res.data.data || []))
      .catch(() => toast.error('Failed to load report'))
      .finally(() => setLoading(false));
  }, [appliedFilters]);

  // Load filter options on mount
  useEffect(() => {
    Promise.all([
      api.get('/operations/universities').catch(() => ({ data: { data: [] } })),
      api.get('/operations/programs').catch(() => ({ data: { data: [] } })),
      api.get('/operations/sessions').catch(() => ({ data: { data: [] } })),
    ]).then(([uRes, pRes, sRes]) => {
      setUniversities(uRes.data.data || []);
      setPrograms(pRes.data.data || []);
      setSessions(sRes.data.data || []);
    });
  }, []);

  const handleApply = () => setAppliedFilters({ ...uiFilters });

  const handleReset = () => {
    setUiFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const exportExcel = () => {
    const data = rows.map((r, i) => ({
      '#': i + 1,
      'Student': r.studentName,
      'Admission No': r.enrollmentNumber || '',
      'Enroll No': r.uniEnrollmentNumber || '',
      'Admission Date': fmtDate(r.admissionDate),
      'Admission Session': r.admissionSession,
      'Center Name': r.centerName,
      'Sub Center / Branch': r.subCenterName || '',
      'Program': r.program,
      'University': r.university,
      'Center Payment (INR)': r.centerPaymentAmount ?? '',
      'Center Payment Status': r.centerPaymentStatus,
      'Payment For': r.centerPaymentFor,
      'Re-Reg Fees Collected (INR)': r.reRegTotalCollected ?? '',
      'Total University Fee (INR)': r.universityPaymentAmount ?? '',
      'University Paid (INR)': r.universityPaidAmount ?? '',
      'University Payment Status': r.universityPaymentStatus,
      'University Payment Proof': Array.isArray(r.universityPaymentScreenshots) && r.universityPaymentScreenshots.length > 0 ? 'Yes (Check UI)' : 'No',
      'Coordinator Name': r.coordinatorName || 'Null',
      'Coordinator Payment (INR)': r.coordinatorPaymentAmount ?? '',
      'Coordinator Payment Status': r.coordinatorPaymentStatus,
      // 'Commission From Uni (INR)': r.commissionInAmount ?? '',
      // 'Commission From Uni Date': fmtDate(r.commissionInDate),
      // 'Commission From Uni Status': r.commissionInStatus || '',
      // 'Commission To Center (INR)': r.commissionOutAmount ?? '',
      // 'Commission To Center Date': fmtDate(r.commissionOutDate),
      // 'Commission To Center Status': r.commissionOutStatus || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Total Report');
    ws['!cols'] = Object.keys(data[0] || {}).map(() => ({ wch: 22 }));
    XLSX.writeFile(wb, `finance_total_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Report exported successfully');
  };

  const totalCenterPaid = rows.filter(r => r.centerPaymentStatus === 'Paid').reduce((s, r) => s + (r.centerPaymentAmount || 0), 0);
  const totalCenterDue = rows.filter(r => r.centerPaymentStatus === 'Due').length;
  const totalUniPaid = rows.reduce((s, r) => s + (r.universityPaidAmount || 0), 0);
  const totalReRegPaid = rows.reduce((s, r) => s + (r.reRegTotalCollected || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Total Data Report</h2>
          {/* <p className="text-muted-foreground text-sm">Complete enrollment, payment, commissions and coordinator fee overview</p> */}
          <p className="text-muted-foreground text-sm">Complete enrollment, payment and coordinator fee overview</p>
        </div>
        <Button onClick={exportExcel} disabled={rows.length === 0} className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Export Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Records', value: rows.length, color: 'text-slate-700' },
          { label: 'Center Fees Collected', value: 'INR ' + totalCenterPaid.toLocaleString('en-IN'), color: 'text-green-700' },
          { label: 'Center Fees Due', value: totalCenterDue + ' students', color: 'text-amber-700' },
          { label: 'University Fees Paid', value: 'INR ' + totalUniPaid.toLocaleString('en-IN'), color: 'text-blue-700' },
          { label: 'Re-Reg Fees Collected', value: 'INR ' + totalReRegPaid.toLocaleString('en-IN'), color: 'text-purple-700' },
        ].map((stat) => (
          <Card key={stat.label} className="border shadow-sm">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={'text-xl font-bold mt-1 ' + stat.color}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Row 1: Search & Date Filters */}
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[240px]">
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search student or center..."
                    className="pl-9 w-full"
                    value={uiFilters.search}
                    onChange={e => setUiFilters(f => ({ ...f, search: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleApply()}
                  />
                </div>
              </div>

              <div className="w-[180px]">
                <label className="text-xs font-semibold text-muted-foreground block mb-1">From Date</label>
                <Input
                  type="date"
                  value={uiFilters.dateFrom}
                  onChange={e => setUiFilters(f => ({ ...f, dateFrom: e.target.value }))}
                />
              </div>

              <div className="w-[180px]">
                <label className="text-xs font-semibold text-muted-foreground block mb-1">To Date</label>
                <Input
                  type="date"
                  value={uiFilters.dateTo}
                  onChange={e => setUiFilters(f => ({ ...f, dateTo: e.target.value }))}
                />
              </div>
            </div>

            {/* Row 2: Select Dropdowns & Buttons */}
            <div className="flex flex-wrap gap-4 items-center justify-between pt-2 border-t border-muted/50">
              <div className="flex flex-wrap gap-3 items-center flex-1">
                <div className="w-[200px]">
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">University</label>
                  <Select value={uiFilters.universityId} onValueChange={v => setUiFilters(f => ({ ...f, universityId: v }))}>
                    <SelectTrigger><SelectValue placeholder="All Universities" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Universities</SelectItem>
                      {universities.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-[200px]">
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Program</label>
                  <Select value={uiFilters.programId} onValueChange={v => setUiFilters(f => ({ ...f, programId: v }))}>
                    <SelectTrigger><SelectValue placeholder="All Programs" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Programs</SelectItem>
                      {programs.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-[200px]">
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Session</label>
                  <Select value={uiFilters.sessionId} onValueChange={v => setUiFilters(f => ({ ...f, sessionId: v }))}>
                    <SelectTrigger><SelectValue placeholder="All Sessions" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Sessions</SelectItem>
                      {sessions.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 self-end mt-4 sm:mt-0">
                <Button onClick={handleApply} disabled={loading}>
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Apply Filters
                </Button>
                <Button variant="outline" onClick={handleReset}>Reset</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading report...</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No data found. Adjust filters and try again.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl">
<div className="overflow-x-auto w-full">
<table className="min-w-max w-full text-sm">
                <thead className="bg-muted/60 border-b">
                  <tr>
                    {[
                      '#', 'Student', 'Admission No', 'Enroll No', 'Admission Date', 'Admission Session', 'Center Name', 'Sub Center (Branch)',
                      'Program', 'University',
                      'Payment (INR)', 'Payment Status', 'Payment For',
                      'Re-Reg Fees Collected',
                      'Total Uni. Fee (INR)', 'Uni. Paid (INR)', 'Uni. Payment Status', 'Uni. Payment Proof',
                      'Coordinator Name', 'Coord. Payment (INR)', 'Coord. Status',
                      // 'Comm. From Uni (INR)', 'Comm. From Uni Date', 'Comm. From Uni Status',
                      // 'Comm. To Center (INR)', 'Comm. To Center Date', 'Comm. To Center Status'
                    ].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r, i) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">{i + 1}</td>
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">{r.studentName}</td>
                      <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{r.enrollmentNumber || '-'}</td>
                      <td className="px-3 py-2.5 text-xs font-mono font-medium text-foreground">{r.uniEnrollmentNumber || '-'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                        {fmtDate(r.admissionDate)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{r.admissionSession || '-'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{r.centerName || '-'}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.subCenterName || '-'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{r.program || '-'}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{r.university || '-'}</td>
                      <td className="px-3 py-2.5 font-semibold">
                        {r.centerPaymentAmount != null ? 'INR ' + Number(r.centerPaymentAmount).toLocaleString('en-IN') : '-'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + statusColor(r.centerPaymentStatus)}>
                          {r.centerPaymentStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground capitalize">
                        {r.centerPaymentFor?.replace(/_/g, ' ') || '-'}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-purple-700">
                        {r.reRegTotalCollected != null && r.reRegTotalCollected > 0 ? 'INR ' + Number(r.reRegTotalCollected).toLocaleString('en-IN') : '-'}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-muted-foreground">
                        {r.universityPaymentAmount != null ? 'INR ' + Number(r.universityPaymentAmount).toLocaleString('en-IN') : '-'}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-green-700">
                        {r.universityPaidAmount != null ? 'INR ' + Number(r.universityPaidAmount).toLocaleString('en-IN') : '-'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + statusColor(r.universityPaymentStatus)}>
                          {r.universityPaymentStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {r.universityPaymentScreenshots?.length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {r.universityPaymentScreenshots.map((url: string, idx: number) => (
                              <a key={idx} href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs">
                                View Proof {idx + 1}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs">{r.coordinatorName || 'Null'}</td>
                      <td className="px-3 py-2.5 font-semibold">
                        {r.coordinatorPaymentAmount != null ? 'INR ' + Number(r.coordinatorPaymentAmount).toLocaleString('en-IN') : '-'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + statusColor(r.coordinatorPaymentStatus)}>
                          {r.coordinatorPaymentStatus}
                        </span>
                      </td>
                      {/* Commission from University */}
                      {/* <td className="px-3 py-2.5 font-semibold">
                        {r.commissionInAmount != null ? 'INR ' + Number(r.commissionInAmount).toLocaleString('en-IN') : '-'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                        {fmtDate(r.commissionInDate)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + statusColor(r.commissionInStatus)}>
                          {r.commissionInStatus}
                        </span>
                      </td> */}
                      {/* Commission to Center */}
                      {/*
                      <td className="px-3 py-2.5 font-semibold">
                        {r.commissionOutAmount != null ? 'INR ' + Number(r.commissionOutAmount).toLocaleString('en-IN') : '-'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                        {fmtDate(r.commissionOutDate)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + statusColor(r.commissionOutStatus)}>
                          {r.commissionOutStatus}
                        </span>
                      </td> */}
                    </tr>
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
