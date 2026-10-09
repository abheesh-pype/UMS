import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, Search, GraduationCap, Clock, AlertCircle, Ban } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Enrollment {
  id: string;
  enrollmentNumber?: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  programId: { name: string; code: string } | string;
  studyCenterId: { name: string; code: string } | string;
  program?: { name: string; code: string } | null;
  studyCenter?: { name: string; code: string } | null;
  status: string;
  departmentRemarks?: string;
  financeRemarks?: string;
  payment?: { amount: number; debitedAt: string; walletId?: string } | null;
  createdAt: string;
  enrolledAt?: string;
}

interface Summary {
  payment_pending: number;
  document_review: number;
  finance_review: number;
  enrolled: number;
  rejected: number;
  department_rejected: number;
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  payment_pending:     { label: 'Fee Pending',      color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: <Clock className="w-3 h-3" /> },
  document_review:     { label: 'Doc Review',       color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <Search className="w-3 h-3" /> },
  pending_finance_review:      { label: 'Finance Review',   color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <Clock className="w-3 h-3" /> },
  enrolled:            { label: 'Enrolled',         color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',     icon: <CheckCircle className="w-3 h-3" /> },
  rejected:            { label: 'Rejected',         color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',             icon: <XCircle className="w-3 h-3" /> },
  department_rejected: { label: 'Dept Rejected',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',             icon: <Ban className="w-3 h-3" /> },
};

const FILTER_TABS = [
  { key: '', label: 'All' },
  { key: 'payment_pending', label: 'Fee Pending' },
  { key: 'document_review', label: 'Doc Review' },
  { key: 'pending_finance_review', label: 'Finance Review' },
  { key: 'enrolled', label: 'Enrolled' },
  { key: 'rejected', label: 'Rejected' },
];

export function FinanceEnrollmentsPanel() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [refundDialog, setRefundDialog] = useState<{ open: boolean; id: string, amount: string, status: string }>({ open: false, id: '', amount: '', status: 'processed' });
  const [remarks, setRemarks] = useState('');

  const fetchData = async (status = statusFilter, q = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (q) params.set('search', q);
      const res = await api.get(`/finance/enrollments/all?${params}`);
      setEnrollments(res.data.data || []);
      setSummary(res.data.summary || null);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load enrollments');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const handleTabChange = (key: string) => {
    setStatusFilter(key);
    fetchData(key, search);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(statusFilter, search);
  };

  const handleApprove = async (id: string) => {
    try {
      await api.put(`/finance/enrollments/${id}/approve`);
      toast.success('Student enrolled successfully');
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    try {
      await api.put(`/finance/enrollments/${rejectDialog.id}/reject`, { remarks });
      toast.success('Enrollment rejected');
      setRejectDialog({ open: false, id: '' });
      setRemarks('');
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to reject');
    }
  };

  const handleRefund = async () => {
    try {
      await api.post(`/finance/enrollments/${refundDialog.id}/refund`, {
        refundAmount: Number(refundDialog.amount),
        refundStatus: refundDialog.status
      });
      toast.success('Refund processed successfully');
      setRefundDialog({ open: false, id: '', amount: '', status: 'processed' });
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to process refund');
    }
  };

  const getProgramName = (e: Enrollment) =>
    e.program && typeof e.program === 'object'
      ? `${e.program.name} (${e.program.code})`
      : (typeof e.programId === 'object' ? `${(e.programId).name} (${(e.programId).code})` : e.programId);

  const getCenterName = (e: Enrollment) =>
    e.studyCenter && typeof e.studyCenter === 'object'
      ? `${e.studyCenter.name} (${e.studyCenter.code})`
      : (typeof e.studyCenterId === 'object' ? `${(e.studyCenterId).name}` : (e.studyCenterId || 'Direct University Admission'));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Student Enrollments</h2>
          <p className="text-muted-foreground text-sm mt-1">All student enrollment data across every stage.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard label="Payment Pending" count={summary.payment_pending} icon={<Clock className="w-4 h-4" />} color="text-slate-500 bg-slate-50 dark:bg-slate-900/20" onClick={() => handleTabChange('payment_pending')} />
          <SummaryCard label="Doc Review" count={summary.document_review} icon={<Search className="w-4 h-4" />} color="text-blue-500 bg-blue-50 dark:bg-blue-900/20" onClick={() => handleTabChange('document_review')} />
          <SummaryCard label="Finance Review" count={summary.pending_finance_review || 0} icon={<Clock className="w-4 h-4" />} color="text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20" onClick={() => handleTabChange('pending_finance_review')} />
          <SummaryCard label="Enrolled" count={summary.enrolled} icon={<CheckCircle className="w-4 h-4" />} color="text-green-500 bg-green-50 dark:bg-green-900/20" onClick={() => handleTabChange('enrolled')} />
          <SummaryCard label="Rejected" count={summary.rejected} icon={<XCircle className="w-4 h-4" />} color="text-red-500 bg-red-50 dark:bg-red-900/20" onClick={() => handleTabChange('rejected')} />
          <SummaryCard label="Dept Rejected" count={summary.department_rejected} icon={<Ban className="w-4 h-4" />} color="text-red-400 bg-red-50 dark:bg-red-900/20" onClick={() => handleTabChange('department_rejected')} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Status tabs */}
        <div className="flex flex-wrap gap-1">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                statusFilter === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {tab.label}
              {summary && tab.key && (
                <span className="ml-1.5 opacity-70">
                  {summary[tab.key as keyof Summary] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, ID..."
              className="pl-8 h-8 text-sm w-56"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" className="h-8">Search</Button>
        </form>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : enrollments.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>No enrollments found{statusFilter ? ` with status "${statusFilter.replace('_', ' ')}"` : ''}.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
<div className="overflow-x-auto w-full">
<table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left p-3 font-medium text-muted-foreground">Student</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Program</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Center</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Fee Paid</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Date</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {enrollments.map(e => {
                const meta = STATUS_META[e.status] || { label: e.status, color: 'bg-muted text-muted-foreground', icon: null };
                return (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <p className="font-medium">{e.studentName}</p>
                      <p className="text-xs text-muted-foreground">{e.studentEmail}</p>
                      {e.enrollmentNumber && <p className="text-[10px] text-muted-foreground font-mono">{e.enrollmentNumber}</p>}
                    </td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{getProgramName(e)}</td>
                    <td className="p-3 hidden lg:table-cell text-muted-foreground">{getCenterName(e)}</td>
                    <td className="p-3 hidden sm:table-cell">
                      {e.payment ? (
                        <div className="space-y-0.5">
                          <span className="text-green-600 font-semibold block">₹{e.payment.amount.toLocaleString()}</span>
                          <span className="text-[10px] text-muted-foreground block">
                            Paid: {new Date(e.payment.debitedAt || e.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-[10px] text-muted-foreground block font-mono">
                            Wallet: {e.payment.walletId ? e.payment.walletId.slice(0, 8) : 'N/A'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', meta.color)}>
                        {meta.icon}{meta.label}
                      </span>
                      {(e.financeRemarks || e.departmentRemarks) && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[160px] truncate" title={e.financeRemarks || e.departmentRemarks}>
                          {e.financeRemarks || e.departmentRemarks}
                        </p>
                      )}
                    </td>
                    <td className="p-3 hidden lg:table-cell text-muted-foreground text-xs">
                      {new Date(e.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      {e.status === 'pending_finance_review' && (
                        <div className="flex gap-1.5 justify-end">
                          <Button size="sm" variant="outline" className="h-7 text-xs text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20" onClick={() => handleApprove(e.id)}>
                            <CheckCircle className="w-3 h-3 mr-1" />Enroll
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => { setRejectDialog({ open: true, id: e.id }); setRemarks(''); }}>
                            <XCircle className="w-3 h-3 mr-1" />Reject
                          </Button>
                        </div>
                      )}
                      {e.status === 'enrolled' && (
                        <div className="flex gap-1.5 justify-end">
                           <Button size="sm" variant="outline" className="h-7 text-xs text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => setRefundDialog({ open: true, id: e.id, amount: '', status: 'processed' })}>
                             Refund
                           </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
</div>
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={o => setRejectDialog(d => ({ ...d, open: o }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Enrollment</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Remarks (required)</Label>
            <Input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Reason for rejection..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, id: '' })}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!remarks.trim()}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundDialog.open} onOpenChange={open => !open && setRefundDialog({ ...refundDialog, open: false })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Process Refund</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Refund Amount (Optional)</Label>
              <Input type="number" value={refundDialog.amount} onChange={e => setRefundDialog({...refundDialog, amount: e.target.value})} placeholder="Amount to refund..." />
            </div>
            <div className="space-y-2">
              <Label>Refund Status</Label>
              <select className="w-full p-2 border rounded-md" value={refundDialog.status} onChange={e => setRefundDialog({...refundDialog, status: e.target.value})}>
                <option value="processing">Processing</option>
                <option value="processed">Processed (Credit Wallet)</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog({ ...refundDialog, open: false })}>Cancel</Button>
            <Button onClick={handleRefund}>Submit Refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, count, icon, color, onClick }: { label: string; count: number; icon: React.ReactNode; color: string; onClick: () => void }) {
  return (
    <Card className="cursor-pointer hover:border-primary/40 transition-colors" onClick={onClick}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', color)}>{icon}</div>
        <div>
          <p className="text-xl font-bold">{count}</p>
          <p className="text-[11px] text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
