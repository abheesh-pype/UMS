import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Search, CheckCircle, Clock, Wallet, Users, Eye, Building2, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

type FinanceApproval = 'pending' | 'approved' | 'paid';

interface FinancePayroll {
  id: string;
  month: string;
  basicSalary: number;
  professionalTax?: number;
  labourWelfareFund?: number;
  tds?: number;
  allowances?: Record<string, number> | null;
  deductions?: Record<string, number> | null;
  bonus?: number | null;
  overtime?: number | null;
  grossSalary: number;
  netSalary: number;
  status: string;
  remarks?: string | null;
  createdAt: string;
  confirmedAt?: string | null;
  transferredToFinanceAt?: string | null;
  financeApprovedAt?: string | null;
  paymentDate?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    userId?: string | null;
    designation?: string | null;
    department?: { name: string } | null;
    employeeProfileDetail?: {
      employeeCode?: string | null;
      bankName?: string | null;
      bankAccountNo?: string | null;
      ifscCode?: string | null;
      panNumber?: string | null;
    } | null;
  } | null;
  confirmer?: { name: string } | null;
  transferer?: { name: string } | null;
  financeApprover?: { name: string } | null;
  batch?: { id: string; status: string; remarks?: string | null; createdAt: string } | null;
  financeApproval: FinanceApproval;
}

const APPROVAL_LABEL: Record<FinanceApproval, string> = {
  pending: 'Pending Approval',
  approved: 'Approved',
  paid: 'Paid',
};

const APPROVAL_COLOR: Record<FinanceApproval, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-info/10 text-info',
  paid: 'bg-success/10 text-success',
};

const inr = (value?: number | null) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : '-');
const formatMonth = (month: string) => {
  const [year, m] = month.split('-').map(Number);
  if (!year || !m) return month;
  return new Date(year, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};
const sumValues = (values?: Record<string, number> | null) =>
  Object.values(values || {}).reduce((total, value) => total + (Number(value) || 0), 0);
const totalDeductions = (p: FinancePayroll) =>
  sumValues(p.deductions) + (p.professionalTax || 0) + (p.labourWelfareFund || 0) + (p.tds || 0);
const labelize = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

export function FinancePayrollPanel() {
  const [records, setRecords] = useState<FinancePayroll[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [approvalTab, setApprovalTab] = useState<'all' | FinanceApproval>('pending');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewRecord, setViewRecord] = useState<FinancePayroll | null>(null);
  const [approveIds, setApproveIds] = useState<string[] | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveRemarks, setApproveRemarks] = useState('');

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await api.get('/finance/payroll-records');
      setRecords(res.data.data || []);
      setSelectedIds([]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load payroll');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, []);

  const months = useMemo(() => [...new Set(records.map(r => r.month))].sort().reverse(), [records]);

  const monthRecords = useMemo(
    () => (monthFilter === 'all' ? records : records.filter(r => r.month === monthFilter)),
    [records, monthFilter]
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return monthRecords.filter(r => {
      if (approvalTab !== 'all' && r.financeApproval !== approvalTab) return false;
      if (!s) return true;
      return [r.user?.name, r.user?.email, r.user?.userId, r.user?.employeeProfileDetail?.employeeCode, r.user?.department?.name, r.user?.designation]
        .some(v => (v || '').toLowerCase().includes(s));
    });
  }, [monthRecords, approvalTab, search]);

  const stats = useMemo(() => {
    const by = (a: FinanceApproval) => monthRecords.filter(r => r.financeApproval === a);
    const total = (list: FinancePayroll[]) => list.reduce((sum, r) => sum + (r.netSalary || 0), 0);
    const pending = by('pending');
    const approved = by('approved');
    const paid = by('paid');
    return {
      employees: new Set(monthRecords.map(r => r.user?.id || r.id)).size,
      totalNet: total(monthRecords),
      pendingCount: pending.length, pendingAmount: total(pending),
      approvedCount: approved.length, approvedAmount: total(approved),
      paidCount: paid.length, paidAmount: total(paid),
    };
  }, [monthRecords]);

  const pendingVisible = filtered.filter(r => r.financeApproval === 'pending');
  const allPendingSelected = pendingVisible.length > 0 && pendingVisible.every(r => selectedIds.includes(r.id));

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]));
  const toggleSelectAll = () =>
    setSelectedIds(allPendingSelected ? [] : pendingVisible.map(r => r.id));

  const approveTargets = records.filter(r => approveIds?.includes(r.id));

  const handleApprove = async () => {
    if (!approveIds?.length) return;
    setApproving(true);
    try {
      const res = await api.post('/finance/payroll-records/approve', { payrollIds: approveIds, remarks: approveRemarks });
      toast.success(res.data.message || 'Payroll approved', { description: 'Open Payroll Batches to start the payment.' });
      setApproveIds(null);
      setApproveRemarks('');
      setViewRecord(null);
      fetchRecords();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve payroll');
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Payroll</h2>
          <p className="text-muted-foreground text-sm mt-1">Payroll submitted by HR for Finance review and approval.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchRecords} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} /> Refresh
          </Button>
          {selectedIds.length > 0 && (
            <Button size="sm" onClick={() => setApproveIds(selectedIds)}>
              <CheckCircle className="w-4 h-4 mr-2" /> Approve Selected ({selectedIds.length})
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Employees', value: stats.employees, sub: `Net total ${inr(stats.totalNet)}`, icon: Users, tone: 'text-primary' },
          { label: 'Pending Approval', value: stats.pendingCount, sub: inr(stats.pendingAmount), icon: Clock, tone: 'text-warning' },
          { label: 'Approved', value: stats.approvedCount, sub: inr(stats.approvedAmount), icon: CheckCircle, tone: 'text-info' },
          { label: 'Paid', value: stats.paidCount, sub: inr(stats.paidAmount), icon: Wallet, tone: 'text-success' },
        ].map(card => (
          <Card key={card.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <card.icon className={cn('w-4 h-4', card.tone)} />
              </div>
              <p className="text-2xl font-bold mt-2">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <CardTitle>Submitted Payroll</CardTitle>
            <Tabs value={approvalTab} onValueChange={v => { setApprovalTab(v as any); setSelectedIds([]); }}>
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="pending">Pending ({stats.pendingCount})</TabsTrigger>
                <TabsTrigger value="approved">Approved ({stats.approvedCount})</TabsTrigger>
                <TabsTrigger value="paid">Paid ({stats.paidCount})</TabsTrigger>
                <TabsTrigger value="all">All ({monthRecords.length})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search employee, email, code or department..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={monthFilter} onValueChange={v => { setMonthFilter(v); setSelectedIds([]); }}>
              <SelectTrigger className="md:w-56"><SelectValue placeholder="All months" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {months.map(m => <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted/40 rounded-lg animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No payroll records here.</p>
              <p className="text-sm mt-1">Payroll appears once HR confirms it and submits it to Finance.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allPendingSelected}
                        disabled={pendingVisible.length === 0}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all pending"
                      />
                    </TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Basic</TableHead>
                    <TableHead className="text-right">Allowances</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {r.financeApproval === 'pending' && (
                          <Checkbox
                            checked={selectedIds.includes(r.id)}
                            onCheckedChange={() => toggleSelect(r.id)}
                            aria-label={`Select ${r.user?.name || 'payroll'}`}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{r.user?.name || '-'}</p>
                        <p className="text-xs text-muted-foreground">{r.user?.email}</p>
                        {(r.user?.employeeProfileDetail?.employeeCode || r.user?.userId) && (
                          <p className="text-[11px] text-muted-foreground font-mono">{r.user?.employeeProfileDetail?.employeeCode || r.user?.userId}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{r.user?.department?.name || '-'}</p>
                        {r.user?.designation && <p className="text-xs text-muted-foreground">{r.user.designation}</p>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatMonth(r.month)}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(r.basicSalary)}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(sumValues(r.allowances) + (r.bonus || 0) + (r.overtime || 0))}</TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">{inr(totalDeductions(r))}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(r.grossSalary)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{inr(r.netSalary)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <p className="text-sm">{r.transferer?.name || '-'}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(r.transferredToFinanceAt)}</p>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-[11px] whitespace-nowrap', APPROVAL_COLOR[r.financeApproval])}>
                          {APPROVAL_LABEL[r.financeApproval]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setViewRecord(r)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {r.financeApproval === 'pending' && (
                            <Button size="sm" onClick={() => setApproveIds([r.id])}>
                              <CheckCircle className="w-4 h-4 mr-1" /> Approve
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payroll detail */}
      <Dialog open={!!viewRecord} onOpenChange={open => !open && setViewRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewRecord && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 pr-6">
                  <div>
                    <DialogTitle>{viewRecord.user?.name || 'Payroll'}</DialogTitle>
                    <p className="text-sm text-muted-foreground">{formatMonth(viewRecord.month)} payroll</p>
                  </div>
                  <Badge className={cn('ml-auto', APPROVAL_COLOR[viewRecord.financeApproval])}>
                    {APPROVAL_LABEL[viewRecord.financeApproval]}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <section>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Employee</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border bg-muted/10 p-4 text-sm">
                    {[
                      ['Email', viewRecord.user?.email],
                      ['Phone', viewRecord.user?.phone],
                      ['Employee Code', viewRecord.user?.employeeProfileDetail?.employeeCode || viewRecord.user?.userId],
                      ['Department', viewRecord.user?.department?.name],
                      ['Designation', viewRecord.user?.designation],
                      ['PAN', viewRecord.user?.employeeProfileDetail?.panNumber],
                    ].map(([label, value]) => (
                      <div key={label as string}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-medium break-words">{value || '-'}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Bank Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border bg-muted/10 p-4 text-sm">
                    {[
                      ['Bank', viewRecord.user?.employeeProfileDetail?.bankName],
                      ['Account No', viewRecord.user?.employeeProfileDetail?.bankAccountNo],
                      ['IFSC', viewRecord.user?.employeeProfileDetail?.ifscCode],
                    ].map(([label, value]) => (
                      <div key={label as string}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-medium font-mono break-all">{value || '-'}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border p-4 text-sm space-y-2">
                    <h3 className="font-semibold">Earnings</h3>
                    <div className="flex justify-between"><span className="text-muted-foreground">Basic Salary</span><span className="tabular-nums">{inr(viewRecord.basicSalary)}</span></div>
                    {Object.entries(viewRecord.allowances || {}).filter(([, v]) => Number(v)).map(([k, v]) => (
                      <div key={k} className="flex justify-between"><span className="text-muted-foreground">{labelize(k)}</span><span className="tabular-nums">{inr(v)}</span></div>
                    ))}
                    {!!viewRecord.bonus && <div className="flex justify-between"><span className="text-muted-foreground">Bonus</span><span className="tabular-nums">{inr(viewRecord.bonus)}</span></div>}
                    {!!viewRecord.overtime && <div className="flex justify-between"><span className="text-muted-foreground">Overtime</span><span className="tabular-nums">{inr(viewRecord.overtime)}</span></div>}
                    <div className="flex justify-between border-t pt-2 font-semibold"><span>Gross</span><span className="tabular-nums">{inr(viewRecord.grossSalary)}</span></div>
                  </div>
                  <div className="rounded-xl border p-4 text-sm space-y-2">
                    <h3 className="font-semibold">Deductions</h3>
                    {Object.entries(viewRecord.deductions || {}).filter(([, v]) => Number(v)).map(([k, v]) => (
                      <div key={k} className="flex justify-between"><span className="text-muted-foreground">{labelize(k)}</span><span className="tabular-nums">{inr(v)}</span></div>
                    ))}
                    {!!viewRecord.professionalTax && <div className="flex justify-between"><span className="text-muted-foreground">Professional Tax</span><span className="tabular-nums">{inr(viewRecord.professionalTax)}</span></div>}
                    {!!viewRecord.labourWelfareFund && <div className="flex justify-between"><span className="text-muted-foreground">Labour Welfare Fund</span><span className="tabular-nums">{inr(viewRecord.labourWelfareFund)}</span></div>}
                    {!!viewRecord.tds && <div className="flex justify-between"><span className="text-muted-foreground">TDS</span><span className="tabular-nums">{inr(viewRecord.tds)}</span></div>}
                    <div className="flex justify-between border-t pt-2 font-semibold"><span>Total Deductions</span><span className="tabular-nums text-destructive">{inr(totalDeductions(viewRecord))}</span></div>
                  </div>
                </section>

                <div className="flex items-center justify-between rounded-xl border bg-primary/5 p-4">
                  <span className="font-semibold">Net Pay</span>
                  <span className="text-xl font-bold tabular-nums">{inr(viewRecord.netSalary)}</span>
                </div>

                <section>
                  <h3 className="font-semibold text-sm mb-2">Workflow</h3>
                  <div className="rounded-xl border p-4 text-sm space-y-2">
                    {[
                      ['Generated', formatDateTime(viewRecord.createdAt), null],
                      ['Confirmed by HR', formatDateTime(viewRecord.confirmedAt), viewRecord.confirmer?.name],
                      ['Submitted to Finance', formatDateTime(viewRecord.transferredToFinanceAt), viewRecord.transferer?.name],
                      // HR's confirm step also stamps financeApprovedAt, so only trust it when a Finance approver is recorded
                      ['Approved by Finance', viewRecord.financeApprover ? formatDateTime(viewRecord.financeApprovedAt) : (viewRecord.financeApproval === 'pending' ? '-' : 'Approved via payroll batch'), viewRecord.financeApprover?.name],
                      ['Paid', formatDateTime(viewRecord.paymentDate), viewRecord.paymentMethod ? `${labelize(viewRecord.paymentMethod)}${viewRecord.paymentReference ? ` · ${viewRecord.paymentReference}` : ''}` : null],
                    ].map(([label, when, who]) => (
                      <div key={label as string} className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="text-right">{when}{who ? ` · ${who}` : ''}</span>
                      </div>
                    ))}
                    {(viewRecord.batch?.remarks || viewRecord.remarks) && (
                      <p className="border-t pt-2 text-muted-foreground">
                        Remarks: {viewRecord.batch?.remarks || viewRecord.remarks}
                      </p>
                    )}
                  </div>
                </section>
              </div>

              {viewRecord.financeApproval === 'pending' && (
                <DialogFooter>
                  <Button onClick={() => setApproveIds([viewRecord.id])}>
                    <CheckCircle className="w-4 h-4 mr-2" /> Approve Payroll
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve confirmation */}
      <Dialog open={!!approveIds} onOpenChange={open => !open && !approving && setApproveIds(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Payroll</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Approve {approveTargets.length} payroll record{approveTargets.length === 1 ? '' : 's'} submitted by HR.
              {' '}They are grouped into one payroll batch, which you can pay from Payroll Batches.
            </p>
            <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
              {approveTargets.map(r => (
                <div key={r.id} className="flex justify-between gap-3 px-3 py-2">
                  <span>{r.user?.name || '-'} <span className="text-muted-foreground">· {formatMonth(r.month)}</span></span>
                  <span className="tabular-nums font-medium">{inr(r.netSalary)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total Net Pay</span>
              <span className="tabular-nums">{inr(approveTargets.reduce((s, r) => s + (r.netSalary || 0), 0))}</span>
            </div>
            <Input
              placeholder="Batch remarks (optional)"
              value={approveRemarks}
              onChange={e => setApproveRemarks(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveIds(null)} disabled={approving}>Cancel</Button>
            <Button onClick={handleApprove} disabled={approving}>
              {approving ? 'Approving...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
