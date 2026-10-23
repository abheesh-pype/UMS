import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle, XCircle, Clock, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';

interface LeaveRequest {
  id: string;
  employeeId: { id: string; name: string; email: string; designation?: string; role?: string } | null;
  departmentId?: { id: string; name: string } | null;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'dept_approved' | 'approved' | 'rejected';
  deptAdminRemarks?: string;
  hrRemarks?: string;
  deptApprovedBy?: { name: string } | null;
  hrApprovedBy?: { name: string } | null;
  appliedAt: string;
  createdAt: string;
}

interface MyLeaveAllocation {
  year: number;
  sickLeave: number;
  casualLeave: number;
  earnedLeave: number;
  complementaryLeave: number;
  used: {
    sickLeave: number;
    casualLeave: number;
    earnedLeave: number;
    complementaryLeave: number;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:      { label: 'Pending',          color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  dept_approved:{ label: 'Dept Approved',    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  approved:     { label: 'Fully Approved',   color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  rejected:     { label: 'Rejected',         color: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

const DEPT_MANAGER_ROLES = ['ops_admin', 'finance_admin', 'sales_admin', 'center_admin', 'ops_sub_admin'];

export function LeavesPanel({
  isPersonalView = false,
  approvalsOnly = false,
}: {
  isPersonalView?: boolean;
  approvalsOnly?: boolean;
}) {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaveAllocation, setLeaveAllocation] = useState<MyLeaveAllocation | null>(null);
  const [allocationLoading, setAllocationLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ type: 'sick', startDate: '', endDate: '', reason: '', isHalfDay: false, attachmentUrl: '' });
  const [submitting, setSubmitting] = useState(false);

  // Action dialog (approve/reject with remarks)
  const [actionDialog, setActionDialog] = useState(false);
  const [actionLeave, setActionLeave] = useState<LeaveRequest | null>(null);
  const [actionType, setActionType] = useState<'dept' | 'hr'>('dept');
  const [actionMode, setActionMode] = useState<'approve' | 'reject'>('approve');
  const [remarks, setRemarks] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLeave, setDeleteLeave] = useState<LeaveRequest | null>(null);

  // Expanded card for remarks
  const [expanded, setExpanded] = useState<string | null>(null);

  const role = user?.role || '';
  const userId = user?.id?.toString() || '';
  const isBranchManager = Boolean((user as any)?.branchId);
  const isGodMode = ['org_admin', 'superadmin', 'ceo'].includes(role);
  const isHR = ['hr_admin', 'org_admin', 'superadmin', 'ceo'].includes(role) && !isPersonalView;
  const isDeptManager = (DEPT_MANAGER_ROLES.includes(role) || isBranchManager || isHR) && !isPersonalView;
  const isEmployee = (!isDeptManager && !isHR && !isGodMode) || isPersonalView;

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      // Employees only see their own leaves; managers/HR see all
      const endpoint = (isEmployee) ? '/hr/leaves/my' : '/hr/leaves';
      const res = await api.get(endpoint);
      setLeaves(res.data.data || []);
    } catch {
      toast.error('Failed to fetch leave requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyAllocation = async () => {
    setAllocationLoading(true);
    try {
      const year = new Date().getFullYear();
      const response = await api.get(`/hr/leave-allocations/my?year=${year}`);
      setLeaveAllocation(response.data.data || null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load your leave allocation');
    } finally {
      setAllocationLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchLeaves();
    if (isEmployee) fetchMyAllocation();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/hr/leaves', form);
      toast.success(role === 'hr_admin'
        ? 'Leave request submitted. Your university admin will review it.'
        : 'Leave request submitted. Your department manager will review it.');
      setCreateOpen(false);
      setForm({ type: 'sick', startDate: '', endDate: '', reason: '', isHalfDay: false, attachmentUrl: '' });
      fetchLeaves();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const openAction = (leave: LeaveRequest, type: 'dept' | 'hr', mode: 'approve' | 'reject') => {
    setActionLeave(leave);
    setActionType(type);
    setActionMode(mode);
    setRemarks('');
    setActionDialog(true);
  };

  const handleAction = async () => {
    if (!actionLeave) return;
    if (actionMode === 'reject' && !remarks.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    setActionSubmitting(true);
    try {
      const endpoint = actionType === 'dept'
        ? `/hr/leaves/${actionLeave.id}/dept-approve`
        : `/hr/leaves/${actionLeave.id}/hr-approve`;
      await api.patch(endpoint, { action: actionMode, remarks });
      toast.success(actionMode === 'approve' ? 'Leave approved' : 'Leave rejected');
      setActionDialog(false);
      fetchLeaves();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteLeave) return;
    try {
      await api.delete(`/hr/leaves/${deleteLeave.id}`);
      toast.success('Leave request deleted');
      setDeleteOpen(false);
      fetchLeaves();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  // Filter tabs
  const filtered = leaves.filter(l => {
    if (approvalsOnly) {
      const awaitingAction = isHR
        ? ['pending', 'dept_approved'].includes(l.status)
        : l.status === 'pending';
      return awaitingAction && l.employeeId?.id !== userId;
    }
    if (activeTab === 'all') return true;
    if (activeTab === 'mine') return l.employeeId?.id === userId;
    return l.status === activeTab;
  });

  const counts = {
    all: leaves.length,
    pending: leaves.filter(l => l.status === 'pending').length,
    dept_approved: leaves.filter(l => l.status === 'dept_approved').length,
    approved: leaves.filter(l => l.status === 'approved').length,
    rejected: leaves.filter(l => l.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Leave Requests</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {approvalsOnly
              ? 'Review and approve or reject leave requests from your subordinates.'
              : isPersonalView
              ? 'Submit and track your leave requests.'
              : isDeptManager
              ? 'Review and approve leave requests from your department.'
              : isHR
              ? 'Final approval for department-approved leave requests.'
              : 'Submit and track your leave requests.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            fetchLeaves();
            if (isEmployee) fetchMyAllocation();
          }} disabled={loading || allocationLoading}>
            <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
          {/* Employees and managers can submit leaves */}
          {!isHR && !approvalsOnly && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Request
            </Button>
          )}
        </div>
      </div>

      {isEmployee && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-4">
              <h3 className="font-semibold">My Leave Balance — {new Date().getFullYear()}</h3>
              <p className="text-xs text-muted-foreground">Approved leave used is subtracted from your HR allocation.</p>
            </div>
            {allocationLoading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Loading leave allocation...</p>
            ) : leaveAllocation ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {([
                  { key: 'sickLeave', label: 'Sick Leave' },
                  { key: 'casualLeave', label: 'Casual Leave' },
                  { key: 'earnedLeave', label: 'Earned Leave' },
                  { key: 'complementaryLeave', label: 'Complementary Leave' },
                ] as const).map(({ key, label }) => {
                  const allocated = leaveAllocation[key] || 0;
                  const used = leaveAllocation.used[key] || 0;
                  return (
                    <div key={key} className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 text-lg font-semibold">{Math.max(0, allocated - used)} <span className="text-xs font-normal text-muted-foreground">remaining</span></p>
                      <p className="text-xs text-muted-foreground">{used} used of {allocated} days</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No leave allocation found for this year. Please contact HR to set up your leave allocation.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Pending', count: counts.pending, color: 'text-yellow-600' },
          { label: 'Dept Approved', count: counts.dept_approved, color: 'text-blue-600' },
          { label: 'Approved', count: counts.approved, color: 'text-green-600' },
          { label: 'Rejected', count: counts.rejected, color: 'text-red-600' },
        ].map(({ label, count, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <p className={cn('text-2xl font-bold', color)}>{count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {approvalsOnly ? (
            <TabsTrigger value="all">Awaiting Action ({filtered.length})</TabsTrigger>
          ) : (
            <>
              <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
              <TabsTrigger value="dept_approved">Dept Approved ({counts.dept_approved})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
              {!isEmployee && <TabsTrigger value="mine">My Requests</TabsTrigger>}
            </>
          )}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No leave requests found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map(leave => {
                const cfg = STATUS_CONFIG[leave.status] || STATUS_CONFIG.pending;
                const isExpanded = expanded === leave.id;
                const isOwner = leave.employeeId?.id === userId;
                
                const userDeptId = (user as any)?.departmentId || (user as any)?.department?.id;
                const isSameDept = leave.departmentId?.id === userDeptId;
                const isHrAdminRequest = leave.employeeId?.role === 'hr_admin';
                const canDeptAct = !isHrAdminRequest && isDeptManager && leave.status === 'pending' && (isGodMode || isBranchManager || isSameDept);
                const canHRAct = isHR && (
                  (isHrAdminRequest && approvalsOnly && role === 'org_admin' && leave.status === 'pending') ||
                  (!isHrAdminRequest && leave.status === 'dept_approved')
                );

                return (
                  <Card key={leave.id} className="hover:border-primary/30 transition-colors">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Top row */}
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <Badge className={cn('text-[10px] font-bold uppercase border', cfg.color)}>
                              {cfg.label}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] capitalize">{leave.type}</Badge>
                            {leave.departmentId && (
                              <Badge variant="outline" className="text-[10px]">{leave.departmentId.name}</Badge>
                            )}
                          </div>

                          {/* Employee name */}
                          <p className="font-semibold text-sm">
                            {leave.employeeId?.name || 'Employee'}
                            {leave.employeeId?.designation && (
                              <span className="text-muted-foreground font-normal ml-1 text-xs">· {leave.employeeId.designation}</span>
                            )}
                          </p>

                          {/* Dates + reason */}
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                            <span>{new Date(leave.startDate).toLocaleDateString()} → {new Date(leave.endDate).toLocaleDateString()}</span>
                            <span className="line-clamp-1">{leave.reason}</span>
                          </div>

                          {/* Expandable remarks/approver details */}
                          {(leave.deptAdminRemarks || leave.hrRemarks || leave.deptApprovedBy || leave.hrApprovedBy) && (
                            <button
                              className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                              onClick={() => setExpanded(isExpanded ? null : leave.id)}
                            >
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              {isExpanded ? 'Hide details' : 'View details'}
                            </button>
                          )}

                          {isExpanded && (
                            <div className="mt-3 space-y-2 text-xs border-t pt-3">
                              {(leave.deptAdminRemarks || leave.deptApprovedBy) && (
                                <div>
                                  <span className="font-semibold text-foreground/70">Dept Manager:</span>
                                  {leave.deptAdminRemarks ? (
                                    <span className="ml-1 text-muted-foreground">{leave.deptAdminRemarks}</span>
                                  ) : (
                                    <span className="ml-1 text-muted-foreground italic">No remarks</span>
                                  )}
                                  {leave.deptApprovedBy && (
                                    <span className="ml-1 text-muted-foreground/60">— {(leave.deptApprovedBy).name}</span>
                                  )}
                                </div>
                              )}
                              {(leave.hrRemarks || leave.hrApprovedBy) && (
                                <div>
                                  <span className="font-semibold text-foreground/70">HR:</span>
                                  {leave.hrRemarks ? (
                                    <span className="ml-1 text-muted-foreground">{leave.hrRemarks}</span>
                                  ) : (
                                    <span className="ml-1 text-muted-foreground italic">No remarks</span>
                                  )}
                                  {leave.hrApprovedBy && (
                                    <span className="ml-1 text-muted-foreground/60">— {(leave.hrApprovedBy).name}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col gap-2 shrink-0">
                          {canDeptAct && (
                            <>
                              <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => openAction(leave, 'dept', 'approve')}>
                                <CheckCircle className="w-3 h-3 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => openAction(leave, 'dept', 'reject')}>
                                <XCircle className="w-3 h-3 mr-1" /> Reject
                              </Button>
                            </>
                          )}
                          {canHRAct && (
                            <>
                              <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => openAction(leave, 'hr', 'approve')}>
                                <CheckCircle className="w-3 h-3 mr-1" /> {isHrAdminRequest ? 'Approve' : 'Final Approve'}
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => openAction(leave, 'hr', 'reject')}>
                                <XCircle className="w-3 h-3 mr-1" /> Reject
                              </Button>
                            </>
                          )}
                          {/* Owner can delete pending requests */}
                          {isOwner && leave.status === 'pending' && (
                            <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive" onClick={() => { setDeleteLeave(leave); setDeleteOpen(true); }}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Workflow progress bar */}
                      <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <StepDot active={true} done={true} label="Submitted" />
                        <div className={cn('flex-1 h-px', leave.status !== 'pending' ? 'bg-primary' : 'bg-muted')} />
                        <StepDot
                          active={leave.status !== 'pending'}
                          done={['dept_approved', 'approved'].includes(leave.status)}
                          rejected={leave.status === 'rejected' && !!leave.deptAdminRemarks && !leave.hrRemarks}
                          label="Dept Manager"
                        />
                        <div className={cn('flex-1 h-px', leave.status === 'approved' ? 'bg-primary' : 'bg-muted')} />
                        <StepDot
                          active={leave.status === 'approved' || (leave.status === 'rejected' && !!leave.hrRemarks)}
                          done={leave.status === 'approved'}
                          rejected={leave.status === 'rejected' && !!leave.hrRemarks}
                          label="HR Admin"
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Leave Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Leave Request</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="casual">Casual Leave</SelectItem>
                  <SelectItem value="earned">Earned Leave</SelectItem>
                  <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                  <SelectItem value="compensatory">Compensatory Off</SelectItem>
                  <SelectItem value="bereavement">Bereavement Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input type="date" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" required disabled={form.isHalfDay} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isHalfDay" checked={form.isHalfDay} onChange={e => setForm({ ...form, isHalfDay: e.target.checked, endDate: form.startDate })} />
              <Label htmlFor="isHalfDay">Half Day</Label>
            </div>
            <div>
              <Label>Attachment URL (Optional)</Label>
              <Input placeholder="Link to medical certificate or document" value={form.attachmentUrl} onChange={e => setForm({ ...form, attachmentUrl: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Explain the reason for your leave..." rows={3} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Request'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Approve/Reject Action Dialog */}
      <Dialog open={actionDialog} onOpenChange={setActionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionMode === 'approve' ? 'Approve' : 'Reject'} Leave Request
              <span className="text-muted-foreground font-normal text-sm ml-2">
                ({actionType === 'dept' ? 'Department' : 'HR'} Review)
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {actionLeave && (
              <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                <p className="font-semibold">{actionLeave.employeeId?.name}</p>
                <p className="text-muted-foreground capitalize">{actionLeave.type} leave · {new Date(actionLeave.startDate).toLocaleDateString()} → {new Date(actionLeave.endDate).toLocaleDateString()}</p>
                <p className="text-muted-foreground text-xs">{actionLeave.reason}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>
                {actionMode === 'reject' ? 'Rejection Reason' : 'Remarks'}{' '}
                {actionMode === 'reject' && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder={actionMode === 'reject' ? 'Explain why this leave is being rejected...' : 'Optional remarks...'}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog(false)}>Cancel</Button>
              <Button
                onClick={handleAction}
                disabled={actionSubmitting}
                className={actionMode === 'approve' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
              >
                {actionSubmitting ? 'Processing...' : actionMode === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Leave Request</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to withdraw this leave request?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StepDot({ active, done, rejected, label }: { active: boolean; done: boolean; rejected?: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn(
        'w-4 h-4 rounded-full border-2 flex items-center justify-center',
        done ? 'bg-green-500 border-green-500' :
        rejected ? 'bg-red-500 border-red-500' :
        active ? 'bg-primary border-primary' :
        'bg-muted border-muted-foreground/30'
      )}>
        {(done || rejected) && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
      </div>
      <span className="text-[9px] text-muted-foreground whitespace-nowrap">{label}</span>
    </div>
  );
}
