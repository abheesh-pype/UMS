import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, Search, GraduationCap, Clock, AlertCircle, Ban, UserCheck, Eye, FileText, Mail, Phone, MapPin, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { resolveFileUrl } from '@/lib/fileUrl';

interface Enrollment {
  id: string;
  enrollmentNumber?: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  studentAddress?: string;
  studentPhoto?: string;
  specialisation?: string;
  abcId?: string;
  debId?: string;
  dob?: string;
  religion?: string;
  caste?: string;
  maritalStatus?: string;
  currentlyWorking?: string;
  fatherName?: string;
  motherName?: string;
  parentMobile?: string;
  pincode?: string;
  alternativePhone?: string;
  programId?: { name: string; code: string } | string | null;
  studyCenterId?: { name: string; code: string } | string | null;
  isDirectStudentApplication?: boolean;
  program?: { name: string; code: string } | null;
  studyCenter?: { name: string; code: string } | null;
  status: string;
  departmentRemarks?: string;
  financeRemarks?: string;
  assignedFinanceUserId?: string;
  assignedFinanceUser?: { id: string; name: string; email: string; role?: string } | null;
  payment?: { amount: number; debitedAt: string; walletId?: string } | null;
  totalFee?: number;
  paymentMethod?: string;
  documents?: { name: string; url: string; reqName?: string; uploadedAt?: string; remarks?: string }[];
  educationalDetails?: { qualification: string; institution: string; passingYear: string; percentage?: string }[];
  createdAt: string;
  enrolledAt?: string;
}

interface Summary {
  payment_pending: number;
  document_review: number;
  finance_review?: number;
  pending_finance_review?: number;
  enrolled: number;
  rejected: number;
  department_rejected: number;
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  payment_pending:        { label: 'Fee Pending',      color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: <Clock className="w-3 h-3" /> },
  document_review:        { label: 'Doc Review',       color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <Search className="w-3 h-3" /> },
  pending_doc_review:     { label: 'Doc Review',       color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: <Search className="w-3 h-3" /> },
  finance_review:         { label: 'Finance Review',   color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <Clock className="w-3 h-3" /> },
  pending_finance_review: { label: 'Finance Review',   color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <Clock className="w-3 h-3" /> },
  enrolled:               { label: 'Enrolled',         color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',     icon: <CheckCircle className="w-3 h-3" /> },
  rejected:               { label: 'Rejected',         color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',             icon: <XCircle className="w-3 h-3" /> },
  department_rejected:    { label: 'Dept Rejected',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',             icon: <Ban className="w-3 h-3" /> },
  ops_rejected:           { label: 'Dept Rejected',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',             icon: <Ban className="w-3 h-3" /> },
  finance_rejected:       { label: 'Finance Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',             icon: <Ban className="w-3 h-3" /> },
};

const FILTER_TABS = [
  { key: '', label: 'All' },
  { key: 'pending_finance_review', label: 'Finance Review' },
  { key: 'enrolled', label: 'Enrolled' },
  { key: 'rejected', label: 'Rejected' },
];

const isPaymentProofDocument = (document: { name?: string; reqName?: string; url?: string }) => {
  const label = `${document.reqName || ''} ${document.name || ''}`.toLowerCase();
  return Boolean(document.url) && (label.includes('payment proof') || label.includes('payment receipt'));
};

export function FinanceEnrollmentsPanel() {
  const { user } = useAuth();
  const isFinanceAdmin = ['finance_admin', 'superadmin', 'org_admin'].includes(user?.role || '');

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [financeTeamMembers, setFinanceTeamMembers] = useState<any[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState('all');

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [refundDialog, setRefundDialog] = useState<{ open: boolean; id: string, amount: string, status: string }>({ open: false, id: '', amount: '', status: 'processed' });
  const [remarks, setRemarks] = useState('');
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);

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

  const fetchFinanceTeam = async () => {
    try {
      const res = await api.get('/users?departmentType=finance');
      const users = res.data.data || [];
      const finSubordinates = users.filter((u: any) => {
        const role = (u.role || '').toLowerCase();
        const isEligibleRole = ['employee', 'finance_sub_admin', 'finance subadmin'].includes(role);
        return isEligibleRole && u.status !== 'inactive';
      });
      setFinanceTeamMembers(finSubordinates);
    } catch (e) {
      console.error('Failed to load finance team members', e);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (isFinanceAdmin) {
      fetchFinanceTeam();
    }
  }, [isFinanceAdmin]);

  const handleAssign = async (enrollmentId: string, assignedFinanceUserId: string | null) => {
    setAssigningId(enrollmentId);
    try {
      await api.put(`/finance/enrollments/${enrollmentId}/assign`, {
        assignedFinanceUserId: assignedFinanceUserId || null
      });
      toast.success(assignedFinanceUserId ? 'Assigned successfully' : 'Unassigned successfully');
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to assign');
    } finally {
      setAssigningId(null);
    }
  };

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

  const getProgramName = (e: Enrollment) => {
    if (e.program && typeof e.program === 'object') {
      return `${e.program.name || 'Program'} ${e.program.code ? `(${e.program.code})` : ''}`.trim();
    }
    if (e.programId && typeof e.programId === 'object') {
      return `${(e.programId as any).name || 'Program'} ${(e.programId as any).code ? `(${(e.programId as any).code})` : ''}`.trim();
    }
    return typeof e.programId === 'string' ? e.programId : '—';
  };

  const getCenterName = (e: Enrollment) => {
    if (e.studyCenter && typeof e.studyCenter === 'object') {
      return `${e.studyCenter.name || 'Study Center'} ${e.studyCenter.code ? `(${e.studyCenter.code})` : ''}`.trim();
    }
    if (e.studyCenterId && typeof e.studyCenterId === 'object') {
      return `${(e.studyCenterId as any).name || 'Study Center'}`;
    }
    if (typeof e.studyCenterId === 'string' && e.studyCenterId) return e.studyCenterId;
    return e.isDirectStudentApplication ? 'Direct Student Application' : 'Direct Admission (Sales)';
  };

  const paymentProof = selectedEnrollment?.documents?.find(isPaymentProofDocument);
  const canApproveEnrollment = (enrollment: Enrollment) => {
    const fee = Number(enrollment.totalFee);
    return (Number.isFinite(fee) && fee <= 0)
      || Boolean(enrollment.documents?.some(isPaymentProofDocument));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Student Enrollments</h2>
          <p className="text-muted-foreground text-sm mt-1">Applications approved by Operations and forwarded to Finance.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryCard label="Finance Review" count={summary.pending_finance_review ?? summary.finance_review ?? 0} icon={<Clock className="w-4 h-4" />} color="text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20" onClick={() => handleTabChange('pending_finance_review')} />
          <SummaryCard label="Enrolled" count={summary.enrolled} icon={<CheckCircle className="w-4 h-4" />} color="text-green-500 bg-green-50 dark:bg-green-900/20" onClick={() => handleTabChange('enrolled')} />
          <SummaryCard label="Rejected" count={summary.rejected} icon={<XCircle className="w-4 h-4" />} color="text-red-500 bg-red-50 dark:bg-red-900/20" onClick={() => handleTabChange('rejected')} />
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
                  {tab.key === 'pending_finance_review'
                    ? (summary.pending_finance_review ?? summary.finance_review ?? 0)
                    : (summary[tab.key as keyof Summary] ?? 0)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search & Assignee Filter */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {isFinanceAdmin && (
            <select
              className="h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer w-44"
              value={assigneeFilter}
              onChange={e => setAssigneeFilter(e.target.value)}
            >
              <option value="all">All Assignees</option>
              <option value="unassigned">⚠️ Unassigned Only</option>
              {financeTeamMembers.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role === 'finance_sub_admin' || m.role === 'finance subadmin' ? 'Sub-Admin' : 'Employee'})
                </option>
              ))}
            </select>
          )}

          <form onSubmit={handleSearch} className="flex gap-2">
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
                <th className="text-left p-3 font-medium text-muted-foreground">Assigned Reviewer</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Date</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {enrollments
                .filter(e => {
                  if (assigneeFilter === 'unassigned') {
                    if (e.assignedFinanceUserId) return false;
                  } else if (assigneeFilter !== 'all') {
                    if (e.assignedFinanceUserId !== assigneeFilter) return false;
                  }
                  return true;
                })
                .map(e => {
                const meta = STATUS_META[e.status] || { label: e.status, color: 'bg-muted text-muted-foreground', icon: null };
                return (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="cursor-pointer group/stud" onClick={() => setSelectedEnrollment(e)}>
                        <p className="font-medium group-hover/stud:text-primary transition-colors flex items-center gap-1">
                          {e.studentName}
                          <Eye className="w-3.5 h-3.5 opacity-0 group-hover/stud:opacity-100 text-primary transition-opacity" />
                        </p>
                        <p className="text-xs text-muted-foreground">{e.studentEmail}</p>
                        {e.enrollmentNumber && <p className="text-[10px] text-muted-foreground font-mono">{e.enrollmentNumber}</p>}
                      </div>
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
                      ) : e.totalFee ? (
                        <div className="space-y-0.5">
                          <span className="text-foreground font-semibold block">₹{Number(e.totalFee).toLocaleString()}</span>
                          <span className="text-[10px] text-muted-foreground block capitalize">{e.paymentMethod?.replace('_', ' ') || 'Direct'}</span>
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
                    <td className="p-3">
                      {isFinanceAdmin ? (
                        <div className="flex flex-col gap-1">
                          <select
                            value={e.assignedFinanceUserId || ''}
                            disabled={assigningId === e.id}
                            onChange={(ev) => handleAssign(e.id, ev.target.value || null)}
                            className="h-7 text-xs rounded border border-input bg-background px-2 py-0.5 font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50 max-w-[170px]"
                          >
                            <option value="">⚠️ Unassigned</option>
                            {financeTeamMembers.map((m: any) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.role === 'finance_sub_admin' || m.role === 'finance subadmin' ? 'Sub-Admin' : 'Employee'})
                              </option>
                            ))}
                          </select>
                          {e.assignedFinanceUser && (
                            <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[170px]">
                              ✓ {e.assignedFinanceUser.name}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[11px] font-medium py-0.5 whitespace-nowrap">
                          <CheckCircle className="w-3 h-3 mr-1" /> Assigned to You
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 hidden lg:table-cell text-muted-foreground text-xs">
                      {new Date(e.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex gap-1.5 justify-end items-center">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" title="View Details" onClick={() => setSelectedEnrollment(e)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        {(e.status === 'pending_finance_review' || e.status === 'finance_review') && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
                              onClick={() => handleApprove(e.id)}
                              disabled={!canApproveEnrollment(e)}
                              title={!canApproveEnrollment(e) ? 'Student payment proof is required before final approval' : undefined}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />Enroll
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => { setRejectDialog({ open: true, id: e.id }); setRemarks(''); }}>
                              <XCircle className="w-3 h-3 mr-1" />Reject
                            </Button>
                          </>
                        )}
                        {e.status === 'enrolled' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => setRefundDialog({ open: true, id: e.id, amount: '', status: 'processed' })}>
                            Refund
                          </Button>
                        )}
                      </div>
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

      {/* Refund Dialog */}
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

      {/* Details Dialog */}
      <Dialog open={!!selectedEnrollment} onOpenChange={o => !o && setSelectedEnrollment(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedEnrollment && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    {selectedEnrollment.studentPhoto ? (
                      <img
                        src={resolveFileUrl(selectedEnrollment.studentPhoto)}
                        alt={selectedEnrollment.studentName}
                        className="w-12 h-12 rounded-full object-cover border-2 border-primary/20 shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-base border border-primary/20">
                        {selectedEnrollment.studentName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <DialogTitle className="text-lg">{selectedEnrollment.studentName}</DialogTitle>
                      <p className="text-xs text-muted-foreground">{selectedEnrollment.studentEmail}</p>
                    </div>
                  </div>
                  <Badge className={cn('text-[10px] uppercase font-bold', STATUS_META[selectedEnrollment.status]?.color || 'bg-muted text-muted-foreground')}>
                    {STATUS_META[selectedEnrollment.status]?.label || selectedEnrollment.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-5 py-3">
                {/* Rejection / Remarks alerts */}
                {selectedEnrollment.financeRemarks && (
                  <div className="bg-destructive/10 text-destructive border border-destructive/20 p-3.5 rounded-xl text-sm">
                    <p className="font-semibold text-xs flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Finance Remarks:</p>
                    <p className="mt-1 font-medium">{selectedEnrollment.financeRemarks}</p>
                  </div>
                )}
                {selectedEnrollment.departmentRemarks && (
                  <div className="bg-muted/40 border border-border p-3.5 rounded-xl text-sm">
                    <p className="font-semibold text-xs flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-primary" /> Operations Department Remarks:</p>
                    <p className="mt-1 font-medium">{selectedEnrollment.departmentRemarks}</p>
                  </div>
                )}

                {/* Contact details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-muted/20 p-3.5 rounded-xl border text-sm">
                  <div className="flex items-start gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Email</p>
                      <p className="font-medium break-all">{selectedEnrollment.studentEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Phone</p>
                      <p className="font-medium">{selectedEnrollment.studentPhone || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Alt / Parent</p>
                      <p className="font-medium">{selectedEnrollment.alternativePhone || selectedEnrollment.parentMobile || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 lg:col-span-3">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Address</p>
                      <p className="font-medium">{selectedEnrollment.studentAddress || 'N/A'} {selectedEnrollment.pincode ? `- ${selectedEnrollment.pincode}` : ''}</p>
                    </div>
                  </div>
                </div>

                {/* Course & Center Info */}
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-primary" /> Program & Admission Info
                  </h4>
                  <div className="bg-muted/10 p-3.5 rounded-xl border text-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-muted-foreground block font-semibold">Program</span>
                      <span className="font-medium">{getProgramName(selectedEnrollment)}</span>
                    </div>
                    {selectedEnrollment.specialisation && (
                      <div>
                        <span className="text-xs text-muted-foreground block font-semibold">Specialisation</span>
                        <span className="font-medium">{selectedEnrollment.specialisation}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-muted-foreground block font-semibold">Channel / Center</span>
                      <span className="font-medium">{getCenterName(selectedEnrollment)}</span>
                    </div>
                    {selectedEnrollment.totalFee && (
                      <div>
                        <span className="text-xs text-muted-foreground block font-semibold">Configured Fee</span>
                        <span className="font-semibold text-green-600">₹{Number(selectedEnrollment.totalFee).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="sm:col-span-2 pt-1 border-t text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Submitted: {new Date(selectedEnrollment.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Personal Details */}
                {(selectedEnrollment.dob || selectedEnrollment.fatherName || selectedEnrollment.abcId || selectedEnrollment.debId) && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                      <span className="w-4 h-4 flex items-center justify-center text-primary text-xs">👤</span> Personal Details
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/10 p-3.5 rounded-xl border text-sm">
                      {selectedEnrollment.dob && (
                        <div>
                          <span className="text-xs text-muted-foreground block font-semibold">DOB</span>
                          <span className="font-medium">{selectedEnrollment.dob}</span>
                        </div>
                      )}
                      {selectedEnrollment.fatherName && (
                        <div>
                          <span className="text-xs text-muted-foreground block font-semibold">Father</span>
                          <span className="font-medium">{selectedEnrollment.fatherName}</span>
                        </div>
                      )}
                      {selectedEnrollment.abcId && (
                        <div>
                          <span className="text-xs text-muted-foreground block font-semibold">ABC ID</span>
                          <span className="font-medium">{selectedEnrollment.abcId}</span>
                        </div>
                      )}
                      {selectedEnrollment.debId && (
                        <div>
                          <span className="text-xs text-muted-foreground block font-semibold">DEB ID</span>
                          <span className="font-medium">{selectedEnrollment.debId}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Educational Details */}
                {selectedEnrollment.educationalDetails && selectedEnrollment.educationalDetails.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-primary" /> Educational History
                    </h4>
                    <div className="space-y-2">
                      {selectedEnrollment.educationalDetails.map((edu, idx) => (
                        <div key={idx} className="bg-muted/10 p-2.5 rounded-lg border text-sm grid grid-cols-3 gap-2">
                          <span className="font-semibold">{edu.qualification}</span>
                          <span className="text-muted-foreground truncate">{edu.institution}</span>
                          <span className="text-right text-muted-foreground">{edu.passingYear} {edu.percentage ? `· ${edu.percentage}%` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Uploaded Documents */}
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-primary" /> Documents
                  </h4>
                  <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h5 className="text-sm font-semibold">Student Payment Proof</h5>
                        <p className="text-xs text-muted-foreground">
                          {paymentProof ? 'Submitted for Finance verification' : 'No student payment proof submitted'}
                        </p>
                      </div>
                      {paymentProof && (
                        <a
                          href={resolveFileUrl(paymentProof.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-primary hover:underline"
                        >
                          View payment proof
                        </a>
                      )}
                    </div>
                    {paymentProof?.uploadedAt && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Uploaded: {new Date(paymentProof.uploadedAt).toLocaleString()}
                      </p>
                    )}
                    {paymentProof?.remarks && (
                      <p className="mt-2 rounded-lg border bg-background p-2.5 text-sm">
                        {paymentProof.remarks}
                      </p>
                    )}
                  </div>
                  {selectedEnrollment.documents && selectedEnrollment.documents.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {selectedEnrollment.documents
                        .filter(doc => doc.reqName !== 'Student Payment Proof')
                        .map((doc, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-muted/10 p-2 rounded-lg border text-sm">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="truncate font-medium text-xs">{doc.name}</span>
                          </div>
                          <a
                            href={resolveFileUrl(doc.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline font-semibold flex-shrink-0"
                          >
                            View
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : !paymentProof ? (
                    <p className="text-xs text-muted-foreground italic bg-muted/10 p-3 rounded-lg border">No documents uploaded.</p>
                  ) : null}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedEnrollment(null)}>
                  Close
                </Button>
                {(selectedEnrollment.status === 'pending_finance_review' || selectedEnrollment.status === 'finance_review') && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        const id = selectedEnrollment.id;
                        setSelectedEnrollment(null);
                        setRejectDialog({ open: true, id });
                        setRemarks('');
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white"
                      disabled={!canApproveEnrollment(selectedEnrollment)}
                      title={!canApproveEnrollment(selectedEnrollment) ? 'Student payment proof is required before final approval' : undefined}
                      onClick={() => {
                        const id = selectedEnrollment.id;
                        setSelectedEnrollment(null);
                        handleApprove(id);
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" /> Enroll Student
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
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
