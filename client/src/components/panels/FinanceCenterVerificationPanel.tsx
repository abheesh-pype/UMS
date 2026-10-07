import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RefreshCw, DollarSign, FileText, ExternalLink, Key, Copy, ArrowLeft, Eye } from 'lucide-react';
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

const SERVER_BASE = '';

interface AuthFeeEntry { universityId: string; universityName: string; amount: number | null; }
interface AssignableFinanceUser {
  id: string;
  name: string;
  role: string;
  departmentId?: string | null;
  subDepartmentId?: string | null;
  designationId?: string | null;
  reportingTo?: string | null;
}
interface PaymentProof { url: string; uploadedAt: string; remarks?: string; }
interface Center {
  id: string;
  name: string;
  code: string;
  email: string;
  contact: string;
  address: string;
  verifiedBy?: { name: string };
  verifiedAt?: string;
  authFees: AuthFeeEntry[];
  paymentProof?: PaymentProof | string | null;
  assignedFinanceUserId?: string | null;
  assignedFinanceUser?: { id: string; name: string; role: string } | null;
  status?: string;
  opsRemarks?: string;
  createdAt: string;
}
interface Credentials { email: string; password: string; }

const normalizeProofUrl = (url?: string) => {
  if (!url) return '';
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:')) return url;
  if (url.startsWith('/')) return `${window.location.origin}${url}`;
  return `${window.location.origin}/${url.replace(/^\.?\//, '')}`;
};

const hasPaymentProof = (paymentProof?: PaymentProof | string | null) => {
  const url = typeof paymentProof === 'string' ? paymentProof : paymentProof?.url;
  return typeof url === 'string' && url.trim().length > 0;
};

export function FinanceCenterVerificationPanel() {
  const { user } = useAuth();
  const [centers, setCenters] = useState<Center[]>([]);
  const [assignableFinanceUsers, setAssignableFinanceUsers] = useState<AssignableFinanceUser[]>([]);
  const [assigningCenterId, setAssigningCenterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<{ center: Center; action: 'approve' | 'reject' } | null>(null);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);

  const loadCenters = async () => {
    setLoading(true);
    try {
      const res = await api.get('/finance/centers/pending-payment');
      setCenters(res.data.data || []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load centers');
    } finally {
      setLoading(false);
    }
  };

  const loadAssignableFinanceUsers = async () => {
    if (user?.role !== 'finance_admin') return;
    try {
      const [usersRes, departmentsRes, subDepartmentsRes, designationsRes] = await Promise.all([
        api.get('/users'),
        api.get('/departments'),
        api.get('/sub-departments'),
        api.get('/org/designations'),
      ]);
      const users = (usersRes.data.data || []) as AssignableFinanceUser[];
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
      const financeDepartmentIds = new Set(
        departments
          .filter(department => department.type?.trim().toLowerCase() === 'finance')
          .map(department => department.id)
      );
      const subDepartmentParentIds = new Map<string, string>();
      subDepartments.forEach(subDepartment => {
        subDepartmentParentIds.set(subDepartment.id, getRelationId(subDepartment.parentDeptId));
      });
      const financeSubDepartmentIds = new Set(
        [...subDepartmentParentIds.entries()]
          .filter(([, parentDepartmentId]) => financeDepartmentIds.has(parentDepartmentId))
          .map(([subDepartmentId]) => subDepartmentId)
      );
      const admin = users.find(candidate => candidate.id === user.id);
      const getUserDepartmentId = (candidate?: AssignableFinanceUser) => {
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

      setAssignableFinanceUsers(users.filter(candidate => {
        const candidateDepartmentId = getUserDepartmentId(candidate);
        const belongsToFinance = financeDepartmentIds.has(candidateDepartmentId)
          && (!adminDepartmentId || candidateDepartmentId === adminDepartmentId)
          && (!candidate.subDepartmentId || financeSubDepartmentIds.has(candidate.subDepartmentId));
        const isAssignableRole = candidate.role === 'finance_sub_admin' || candidate.role === 'employee';
        return subordinateIds.has(candidate.id) && belongsToFinance && isAssignableRole;
      }));
    } catch {
      setAssignableFinanceUsers([]);
    }
  };

  useEffect(() => {
    loadCenters();
    loadAssignableFinanceUsers();
  }, [user?.id, user?.role]);

  const handleAssignCenter = async (center: Center, assignedFinanceUserId: string) => {
    setAssigningCenterId(center.id);
    try {
      const res = await api.put(`/finance/centers/${center.id}/assign`, {
        assignedFinanceUserId: assignedFinanceUserId === '__none__' ? null : assignedFinanceUserId,
      });
      setCenters(previous => previous.map(item => item.id === center.id
        ? { ...item, assignedFinanceUserId: res.data.data.assignedFinanceUserId, assignedFinanceUser: res.data.data.assignedFinanceUser }
        : item));
      toast.success(assignedFinanceUserId === '__none__' ? 'Study center unassigned' : 'Study center assigned');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to assign study center');
    } finally {
      setAssigningCenterId(null);
    }
  };

  const handleAction = async () => {
    if (!dialog) return;
    if (dialog.action === 'approve' && !hasPaymentProof(dialog.center.paymentProof)) {
      toast.error('A payment proof must be uploaded before approving this study center');
      return;
    }
    if (dialog.action === 'reject' && !remarks.trim()) {
      toast.error('Remarks are required when rejecting');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.put(`/finance/centers/${dialog.center.id}/finance-verify`, {
        action: dialog.action,
        remarks,
      });
      setDialog(null);
      setSelectedCenter(null);
      setRemarks('');
      loadCenters();
      if (dialog.action === 'approve' && res.data._credentials) {
        setCredentials(res.data._credentials);
      } else {
        toast.success(dialog.action === 'approve' ? 'Center activated' : 'Center rejected');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const totalFee = (fees: AuthFeeEntry[]) =>
    fees.reduce((sum, f) => sum + (f.amount || 0), 0);

  const openReview = (center: Center) => setSelectedCenter(center);

  const closeReview = () => setSelectedCenter(null);

  if (selectedCenter) {
    const rawProofUrl = typeof selectedCenter.paymentProof === 'string'
      ? selectedCenter.paymentProof
      : selectedCenter.paymentProof?.url || '';
    const proofUrl = normalizeProofUrl(rawProofUrl);
    const isImageProof = !!proofUrl && /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(proofUrl);
    const fees = selectedCenter.authFees || [];

    return (
      <>
        {proofPreviewUrl && (
          <Dialog open={!!proofPreviewUrl} onOpenChange={(open) => !open && setProofPreviewUrl(null)}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden border-0 bg-transparent shadow-none">
              <div className="rounded-2xl border bg-background p-2 shadow-2xl">
                <img
                  src={proofPreviewUrl}
                  alt="Payment proof preview"
                  className="max-h-[80vh] w-full rounded-xl object-contain bg-muted"
                />
              </div>
            </DialogContent>
          </Dialog>
        )}

        <div className="space-y-6">
        <div>
          <Button variant="ghost" className="px-0 mb-2" onClick={closeReview}>
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Pending Payment
          </Button>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-bold">Payment Review — {selectedCenter.name}</h2>
              <p className="text-sm text-muted-foreground">Review the center details and uploaded payment proof.</p>
            </div>
            <Badge variant="outline">{selectedCenter.status || 'pending_payment'}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold">Study Center Details</h3>
              {[
                ['Name', selectedCenter.name],
                ['Code', selectedCenter.code],
                ['Email', selectedCenter.email],
                ['Contact', selectedCenter.contact],
                ['Address', selectedCenter.address],
                ['Verified By', selectedCenter.verifiedBy?.name],
                ['Verified At', selectedCenter.verifiedAt ? new Date(selectedCenter.verifiedAt).toLocaleString() : ''],
                ['Operations Remarks', selectedCenter.opsRemarks],
              ].map(([label, value]) => (
                <div key={label} className="border-b pb-2">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium mt-1">{value || 'Not provided'}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold">Uploaded Payment Proof</h3>
              {proofUrl ? (
                <>
                  {isImageProof && (
                    <button type="button" onClick={() => setProofPreviewUrl(proofUrl)} className="block w-full text-left">
                      <img src={proofUrl} alt={`Payment proof for ${selectedCenter.name}`} className="w-full max-h-80 object-contain rounded-lg border bg-muted" />
                    </button>
                  )}
                  <button type="button" onClick={() => setProofPreviewUrl(proofUrl)} className="text-sm text-primary hover:underline inline-flex items-center gap-2">
                    <FileText className="w-4 h-4" />Open uploaded proof<ExternalLink className="w-4 h-4" />
                  </button>
                  {selectedCenter.paymentProof?.uploadedAt && (
                    <p className="text-xs text-muted-foreground">Uploaded: {new Date(selectedCenter.paymentProof.uploadedAt).toLocaleString()}</p>
                  )}
                  {selectedCenter.paymentProof?.remarks && <p className="text-sm border rounded-lg p-3">{selectedCenter.paymentProof.remarks}</p>}
                </>
              ) : <p className="text-sm text-muted-foreground">No payment proof uploaded yet.</p>}

              <div className="border-t pt-4 space-y-2">
                {fees.map(fee => (
                  <div key={fee.universityId} className="flex justify-between text-sm">
                    <span>{fee.universityName}</span>
                    <span className="font-semibold">{fee.amount === null ? 'Fee not configured' : `₹${fee.amount.toLocaleString()}`}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Total Authorization Fee</span><span>₹{totalFee(fees).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" className="text-destructive border-destructive/30" onClick={() => { setDialog({ center: selectedCenter, action: 'reject' }); setRemarks(''); }}>
            <XCircle className="w-4 h-4 mr-1" />Reject Payment
          </Button>
          <Button disabled={!hasPaymentProof(selectedCenter.paymentProof)} onClick={() => { setDialog({ center: selectedCenter, action: 'approve' }); setRemarks(''); }}>
            <CheckCircle className="w-4 h-4 mr-1" />Approve Payment
          </Button>
        </div>

        <Dialog open={!!dialog} onOpenChange={() => { setDialog(null); setRemarks(''); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{dialog?.action === 'approve' ? 'Approve Payment' : 'Reject Payment'} — {dialog?.center.name}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <Label>Remarks {dialog?.action === 'reject' && <span className="text-destructive">*</span>}</Label>
              <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder={dialog?.action === 'reject' ? 'Reason for rejection (required)' : 'Optional remarks'} rows={3} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialog(null); setRemarks(''); }}>Cancel</Button>
              <Button onClick={handleAction} disabled={submitting || (dialog?.action === 'reject' && !remarks.trim()) || (dialog?.action === 'approve' && !hasPaymentProof(dialog.center.paymentProof))} variant={dialog?.action === 'reject' ? 'destructive' : 'default'}>
                {submitting ? 'Processing...' : dialog?.action === 'approve' ? 'Approve Payment' : 'Reject Payment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pending Payment Verification</h2>
          <p className="text-muted-foreground text-sm mt-1">Verify authorisation fee payment for study centers.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadCenters} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />Refresh
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : centers.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No centers pending payment verification.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {centers.map(c => (
            <Card key={c.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{c.name}</h4>
                      <Badge variant="outline" className="text-[10px]">{c.code}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.email} · {c.contact}</p>
                    {c.verifiedBy && (
                      <p className="text-xs text-muted-foreground mt-0.5">Docs verified by: {c.verifiedBy.name}</p>
                    )}
                    <div className="mt-3 space-y-1">
                      {c.authFees.map(f => (
                        <div key={f.universityId} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{f.universityName}</span>
                          {f.amount !== null ? (
                            <span className="font-semibold">&#8377;{f.amount.toLocaleString()}</span>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">Fee not configured</Badge>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-sm font-bold pt-1 border-t border-border mt-1">
                        <span>Total</span>
                        <span>&#8377;{totalFee(c.authFees).toLocaleString()}</span>
                      </div>
                    </div>
                    {c.paymentProof ? (
                      <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border">
                        <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Payment Proof
                        </p>
                        <button
                          type="button"
                          onClick={() => setProofPreviewUrl(normalizeProofUrl(c.paymentProof?.url))}
                          className="text-xs text-primary flex items-center gap-1 hover:underline"
                        >
                          View Receipt <ExternalLink className="w-3 h-3" />
                        </button>
                        {c.paymentProof.remarks && (
                          <p className="text-xs text-muted-foreground mt-1">{c.paymentProof.remarks}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Uploaded: {new Date(c.paymentProof.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2 italic">No payment proof uploaded yet.</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openReview(c)}>
                      <Eye className="w-4 h-4 mr-1" />More
                    </Button>
                    {user?.role === 'finance_admin' && (
                      <Select
                        value={assignableFinanceUsers.some(candidate => candidate.id === c.assignedFinanceUserId) ? c.assignedFinanceUserId || '__none__' : '__none__'}
                        onValueChange={value => handleAssignCenter(c, value)}
                        disabled={assigningCenterId === c.id}
                      >
                        <SelectTrigger className="w-[180px]" aria-label="Assigned To">
                          <SelectValue placeholder="Assigned To" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Unassigned</SelectItem>
                          {assignableFinanceUsers.map(candidate => (
                            <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => { setDialog({ center: c, action: 'reject' }); setRemarks(''); }}>
                      <XCircle className="w-4 h-4 mr-1" />Reject
                    </Button>
                    <Button size="sm" disabled={!hasPaymentProof(c.paymentProof)} onClick={() => { setDialog({ center: c, action: 'approve' }); setRemarks(''); }}>
                      <CheckCircle className="w-4 h-4 mr-1" />Approve
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approve / Reject dialog */}
      <Dialog open={!!dialog} onOpenChange={() => { setDialog(null); setRemarks(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.action === 'approve' ? 'Approve & Activate' : 'Reject'} — {dialog?.center.name}
            </DialogTitle>
          </DialogHeader>
          {dialog?.action === 'approve' && (
            <p className="text-sm text-muted-foreground">
              Approving will activate the study center and generate login credentials.
            </p>
          )}
          <div className="space-y-3 py-2">
            <Label>Remarks {dialog?.action === 'reject' && <span className="text-destructive">*</span>}</Label>
            <Textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder={dialog?.action === 'reject' ? 'Reason for rejection (required)' : 'Optional remarks'}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialog(null); setRemarks(''); }}>Cancel</Button>
            <Button
              onClick={handleAction}
              disabled={submitting || (dialog?.action === 'approve' && !hasPaymentProof(dialog.center.paymentProof))}
              variant={dialog?.action === 'reject' ? 'destructive' : 'default'}
            >
              {submitting ? 'Processing...' : dialog?.action === 'approve' ? 'Approve & Activate' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials modal — shown once after approval */}
      <Dialog open={!!credentials} onOpenChange={() => setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" /> Study Center Login Credentials
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Save these credentials — the password will not be shown again.
          </p>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Email / Username</Label>
              <div className="flex gap-2">
                <Input readOnly value={credentials?.email || ''} />
                <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(credentials?.email || ''); toast.success('Email copied'); }}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <div className="flex gap-2">
                <Input readOnly value={credentials?.password || ''} />
                <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(credentials?.password || ''); toast.success('Password copied'); }}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCredentials(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
