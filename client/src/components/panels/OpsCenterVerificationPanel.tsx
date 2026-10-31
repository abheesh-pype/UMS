import { useState, useEffect } from 'react';
import { FileText, CheckCircle, XCircle, RefreshCw, ExternalLink, AlertCircle, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { resolveFileUrl } from '@/lib/fileUrl';

interface University { id: string; name: string; code: string; }
interface AssignableOpsUser {
  id: string;
  name: string;
  role: string;
  departmentId?: string | null;
  subDepartmentId?: string | null;
  designationId?: string | null;
  reportingTo?: string | null;
}
interface Center {
  id: string;
  name: string;
  code: string;
  email: string;
  contact: string;
  address: string;
  status: string;
  opsRemarks?: string | null;
  paymentRemarks?: string | null;
  paymentProof?: { url?: string; remarks?: string; uploadedAt?: string } | string | null;
  assignedOperationsUserId?: string | null;
  associatedUniversityIds: University[];
  pendingDocuments: { name: string; url: string }[];
  referredBy?: { name: string; email: string };
  createdAt: string;
}

export function OpsCenterVerificationPanel() {
  const { user } = useAuth();
  const [centers, setCenters] = useState<Center[]>([]);
  const [assignableOpsUsers, setAssignableOpsUsers] = useState<AssignableOpsUser[]>([]);
  const [assigningCenterId, setAssigningCenterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<{ center: Center; action: 'approve' | 'reject' | 'resubmit' } | null>(null);
  const [editingCenter, setEditingCenter] = useState<Center | null>(null);
  const [editForm, setEditForm] = useState({ name: '', code: '', email: '', contact: '', address: '', city: '', state: '', branchName: '', coordinatorName: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replacementPaymentProof, setReplacementPaymentProof] = useState<File | null>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get('/operations/centers/pending-verification');
      setCenters(res.data.data || []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load centers');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignableOpsUsers = async () => {
    if (user?.role !== 'ops_admin') return;
    try {
      const [usersRes, departmentsRes, subDepartmentsRes, designationsRes] = await Promise.all([
        api.get('/users'),
        api.get('/departments'),
        api.get('/sub-departments'),
        api.get('/org/designations'),
      ]);
      const users = (usersRes.data.data || []) as AssignableOpsUser[];
      const departments = (departmentsRes.data.data || []) as Array<{ id: string; type?: string | null }>;
      const subDepartments = (subDepartmentsRes.data.data || []) as Array<{ id: string; parentDeptId: string | { id: string } }>;
      const designations = (designationsRes.data.data || []) as Array<{
        id: string;
        departmentId?: string | { id: string } | null;
        subDepartmentId?: string | { id: string } | null;
        parentDesignationId?: string | { id: string } | null;
        filledBy?: Array<{ id: string }>;
      }>;
      const getRelationId = (value?: string | { id: string } | null) =>
        typeof value === 'string' ? value : value?.id || '';
      const operationsDepartmentIds = new Set(
        departments
          .filter(department => department.type?.trim().toLowerCase() === 'operations')
          .map(department => department.id)
      );
      const subDepartmentParentIds = new Map<string, string>();
      subDepartments.forEach(subDepartment => {
        subDepartmentParentIds.set(subDepartment.id, getRelationId(subDepartment.parentDeptId));
      });
      const operationsSubDepartmentIds = new Set(
        [...subDepartmentParentIds.entries()]
          .filter(([, parentDepartmentId]) => operationsDepartmentIds.has(parentDepartmentId))
          .map(([subDepartmentId]) => subDepartmentId)
      );

      const admin = users.find(candidate => candidate.id === user.id);
      const getUserDepartmentId = (candidate?: AssignableOpsUser) => {
        if (!candidate) return '';
        const designation = designations.find(node => node.id === candidate.designationId);
        return candidate.departmentId
          || subDepartmentParentIds.get(candidate.subDepartmentId || '')
          || getRelationId(designation?.departmentId)
          || subDepartmentParentIds.get(getRelationId(designation?.subDepartmentId))
          || '';
      };
      const adminDepartmentId = getUserDepartmentId(admin);
      const subordinateIds = new Set<string>();
      let managerIds = [user.id];
      while (managerIds.length > 0) {
        const nextReports = users
          .filter(candidate => candidate.reportingTo && managerIds.includes(candidate.reportingTo))
          .map(candidate => candidate.id)
          .filter(id => !subordinateIds.has(id));
        nextReports.forEach(id => subordinateIds.add(id));
        managerIds = nextReports;
      }

      const subordinateDesignationIds = new Set<string>();
      let parentDesignationIds = admin?.designationId ? [admin.designationId] : [];
      while (parentDesignationIds.length > 0) {
        const childDesignations = designations
          .filter(node => parentDesignationIds.includes(getRelationId(node.parentDesignationId)))
          .map(node => node.id)
          .filter(id => !subordinateDesignationIds.has(id));
        childDesignations.forEach(id => subordinateDesignationIds.add(id));
        parentDesignationIds = childDesignations;
      }
      designations
        .filter(node => subordinateDesignationIds.has(node.id))
        .flatMap(node => node.filledBy || [])
        .forEach(assignedUser => subordinateIds.add(assignedUser.id));

      setAssignableOpsUsers(users.filter(candidate => {
        const candidateDepartmentId = getUserDepartmentId(candidate);
        const belongsToOperations = operationsDepartmentIds.has(candidateDepartmentId)
          && (!adminDepartmentId || candidateDepartmentId === adminDepartmentId)
          && (!candidate.subDepartmentId || operationsSubDepartmentIds.has(candidate.subDepartmentId));
        const isAssignableRole = candidate.role === 'ops_sub_admin' || candidate.role === 'employee';
        return subordinateIds.has(candidate.id) && belongsToOperations && isAssignableRole;
      }));
    } catch {
      setAssignableOpsUsers([]);
    }
  };

  useEffect(() => {
    fetch();
    fetchAssignableOpsUsers();
  }, [user?.id, user?.role]);

  const handleAssignCenter = async (center: Center, assignedOperationsUserId: string) => {
    setAssigningCenterId(center.id);
    try {
      await api.put(`/operations/centers/${center.id}`, {
        assignedOperationsUserId: assignedOperationsUserId === '__none__' ? null : assignedOperationsUserId,
      });
      setCenters(previous => previous.map(item => item.id === center.id
        ? { ...item, assignedOperationsUserId: assignedOperationsUserId === '__none__' ? null : assignedOperationsUserId }
        : item));
      toast.success(assignedOperationsUserId === '__none__' ? 'Study center unassigned' : 'Study center assigned');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to assign study center');
    } finally {
      setAssigningCenterId(null);
    }
  };

  const handleAction = async () => {
    if (!dialog) return;
    if (dialog.action === 'reject' && !remarks.trim()) {
      toast.error('Remarks are required when rejecting');
      return;
    }
    if (dialog.action === 'resubmit' && !replacementPaymentProof) {
      toast.error('Upload the replacement payment proof before resubmitting to Finance');
      return;
    }
    setSubmitting(true);
    try {
      if (dialog.action === 'resubmit') {
        const formData = new FormData();
        formData.append('action', dialog.action);
        formData.append('remarks', remarks);
        formData.append('paymentProof', replacementPaymentProof);
        await api.put(`/operations/centers/${dialog.center.id}/verify`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await api.put(`/operations/centers/${dialog.center.id}/verify`, {
          action: dialog.action,
          remarks,
        });
      }
      if (dialog.action === 'resubmit') {
        toast.success('Center resubmitted to Finance for payment verification');
      } else if (dialog.action === 'approve') {
        toast.success('Center approved — advanced to Finance verification');
      } else {
        toast.success('Center rejected — kept awaiting corrections');
      }
      setDialog(null);
      setRemarks('');
      setReplacementPaymentProof(null);
      fetch();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (center: Center) => {
    const details = center as Center & { city?: string; state?: string; branchName?: string; coordinatorName?: string };
    setEditForm({
      name: center.name || '',
      code: center.code || '',
      email: center.email || '',
      contact: center.contact || '',
      address: center.address || '',
      city: details.city || '',
      state: details.state || '',
      branchName: details.branchName || '',
      coordinatorName: details.coordinatorName || '',
    });
    setEditingCenter(center);
  };

  const handleSaveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingCenter) return;
    setSavingEdit(true);
    try {
      await api.put(`/operations/centers/${editingCenter.id}`, editForm);
      toast.success('Study center updated');
      setEditingCenter(null);
      fetch();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update study center');
    } finally {
      setSavingEdit(false);
    }
  };

  const visibleCenters = centers.filter(c => {
    const isFinanceRejected = ['finance_rejected', 'rejected_from_finance'].includes(c.status);
    const isOpsRejected = c.status === 'ops_rejected' || (c.status === 'rejected' && !isFinanceRejected && !c.paymentRemarks);
    return !isOpsRejected;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pending Verification</h2>
          <p className="text-muted-foreground text-sm mt-1">Review, verify, and manage study center onboarding applications.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetch} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />Refresh
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : visibleCenters.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No centers pending verification.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {visibleCenters.map(c => {
            const isFinanceRejected = ['finance_rejected', 'rejected_from_finance'].includes(c.status);
            const rawProofUrl = typeof c.paymentProof === 'string'
              ? c.paymentProof
              : c.paymentProof?.url || '';

            return (
              <Card key={c.id} className={cn('hover:border-primary/30 transition-colors', isFinanceRejected && 'border-destructive/30 bg-destructive/[0.01]')}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-semibold text-base">{c.name}</h4>
                        <Badge variant="outline" className="text-[10px] font-mono">{c.code}</Badge>
                        {isFinanceRejected && (
                          <Badge className="bg-destructive/10 text-destructive border-destructive/30 flex items-center gap-1 font-medium">
                            <XCircle className="w-3 h-3" /> Rejected from Finance
                          </Badge>
                        )}
                        {c.status === 'ops_resubmitted' && (
                          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/30">Resubmitted to Ops</Badge>
                        )}
                        {c.status === 'pending_verification' && (
                          <Badge className="bg-warning/10 text-warning border-warning/30">Pending Ops Review</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{c.email} · {c.contact}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.address}</p>

                      {/* Prominent Finance Rejection Callout */}
                      {isFinanceRejected && c.paymentRemarks && (
                        <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
                          <div className="space-y-0.5 flex-1">
                            <p className="font-semibold text-destructive">Finance Department Rejection Reason:</p>
                            <p className="text-foreground/90 leading-relaxed">{c.paymentRemarks}</p>
                          </div>
                        </div>
                      )}

                      {/* Payment proof receipt if present */}
                      {rawProofUrl && (
                        <div className="mt-2.5 flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground font-medium">Payment Proof:</span>
                          <a
                            href={resolveFileUrl(rawProofUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                          >
                            <FileText className="w-3.5 h-3.5" /> View Payment Receipt <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {(c.associatedUniversityIds || []).map(u => (
                          <Badge key={u.id} variant="secondary" className="text-[10px]">{u.name}</Badge>
                        ))}
                      </div>

                      {(c.pendingDocuments?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(c.pendingDocuments || []).map((doc, i) => (
                            <a
                              key={i}
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <FileText className="w-3 h-3" />{doc.name}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ))}
                        </div>
                      )}
                      {c.referredBy && (
                        <p className="text-xs text-muted-foreground mt-1">Referred by: {c.referredBy.name}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <Button size="sm" variant="outline" onClick={() => handleStartEdit(c)}>
                        <Edit className="w-4 h-4 mr-1" />Update
                      </Button>
                      {user?.role === 'ops_admin' && (
                        <Select
                          value={assignableOpsUsers.some(candidate => candidate.id === c.assignedOperationsUserId) ? c.assignedOperationsUserId || '__none__' : '__none__'}
                          onValueChange={value => handleAssignCenter(c, value)}
                          disabled={assigningCenterId === c.id}
                        >
                          <SelectTrigger className="w-[180px]" aria-label="Assigned To">
                            <SelectValue placeholder="Assigned To" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Unassigned</SelectItem>
                            {assignableOpsUsers.map(candidate => (
                              <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="text-error border-error/30 hover:bg-error/10"
                        onClick={() => { setDialog({ center: c, action: 'reject' }); setRemarks(''); }}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        {isFinanceRejected ? 'Reject to Sales' : 'Reject'}
                      </Button>

                      {isFinanceRejected ? (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                          onClick={() => { setDialog({ center: c, action: 'resubmit' }); setRemarks(''); setReplacementPaymentProof(null); }}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />Resubmit to Finance
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => { setDialog({ center: c, action: 'approve' }); setRemarks(''); }}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />Approve
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={() => { setDialog(null); setRemarks(''); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {dialog?.action === 'resubmit'
                ? `Resubmit to Finance — ${dialog?.center.name}`
                : dialog?.action === 'approve'
                  ? `Approve & Advance to Finance — ${dialog?.center.name}`
                  : `Reject Application — ${dialog?.center.name}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {dialog?.action === 'resubmit' && dialog?.center.paymentRemarks && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Original Finance Rejection Reason:
                </p>
                <p className="text-foreground/90">{dialog.center.paymentRemarks}</p>
              </div>
            )}

            {dialog?.action === 'resubmit' && (
              <div className="space-y-1.5">
                <Label htmlFor="replacement-payment-proof">Replacement Payment Proof *</Label>
                <Input
                  id="replacement-payment-proof"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={event => setReplacementPaymentProof(event.target.files?.[0] || null)}
                />
                {replacementPaymentProof && (
                  <p className="text-xs text-muted-foreground">{replacementPaymentProof.name}</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>
                {dialog?.action === 'resubmit'
                  ? 'Operations Verification / Resubmission Remarks for Finance'
                  : dialog?.action === 'reject'
                    ? 'Reason for Rejection'
                    : 'Verification Remarks'}
                {dialog?.action === 'reject' && <span className="text-error font-bold"> *</span>}
              </Label>
              <Textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder={
                  dialog?.action === 'resubmit'
                    ? 'Enter notes for Finance team (e.g. verified documents, corrected fee proof, etc.)'
                    : dialog?.action === 'reject'
                      ? 'Reason for rejection (required)'
                      : 'Optional remarks for Finance'
                }
                rows={3}
              />
            </div>

            {dialog?.action === 'resubmit' && (
              <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border">
                💡 <strong>Resubmission Note:</strong> This will place the study center back into Finance department's pending queue for payment verification and activation.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialog(null); setRemarks(''); }}>Cancel</Button>
            <Button
              onClick={handleAction}
              disabled={submitting}
              variant={dialog?.action === 'reject' ? 'destructive' : 'default'}
              className={dialog?.action === 'resubmit' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
            >
              {submitting
                ? 'Processing...'
                : dialog?.action === 'resubmit'
                  ? 'Resubmit to Finance'
                  : dialog?.action === 'approve'
                    ? 'Approve & Advance'
                    : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCenter} onOpenChange={open => !open && setEditingCenter(null)}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Update Study Center{editingCenter ? ` — ${editingCenter.name}` : ''}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                ['name', 'Center Name'],
                ['code', 'Center Code'],
                ['email', 'Email'],
                ['contact', 'Contact Number'],
                ['address', 'Address'],
                ['city', 'City'],
                ['state', 'State'],
                ['branchName', 'Branch Name'],
                ['coordinatorName', 'Coordinator Name'],
              ].map(([field, label]) => (
                <div key={field} className="space-y-1">
                  <Label htmlFor={`ops-center-${field}`}>{label}</Label>
                  <Input
                    id={`ops-center-${field}`}
                    type={field === 'email' ? 'email' : 'text'}
                    value={editForm[field as keyof typeof editForm]}
                    onChange={event => setEditForm(current => ({ ...current, [field]: event.target.value }))}
                    required={['name', 'code', 'email', 'contact', 'address'].includes(field)}
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingCenter(null)}>Cancel</Button>
              <Button type="submit" disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save Changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
