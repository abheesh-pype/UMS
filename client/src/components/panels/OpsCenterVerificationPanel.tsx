import { useState, useEffect } from 'react';
import { FileText, CheckCircle, XCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

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
  const [dialog, setDialog] = useState<{ center: Center; action: 'approve' | 'reject' } | null>(null);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      await api.put(`/operations/centers/${dialog.center.id}/verify`, {
        action: dialog.action,
        remarks,
      });
      toast.success(dialog.action === 'approve' ? 'Center approved — moved to pending payment' : 'Center rejected');
      setDialog(null);
      setRemarks('');
      fetch();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pending Verification</h2>
          <p className="text-muted-foreground text-sm mt-1">Review and verify study center documents.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetch} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />Refresh
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : centers.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No centers pending verification.</p>
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
                    <p className="text-xs text-muted-foreground mt-0.5">{c.address}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
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
                  <div className="flex gap-2 shrink-0">
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
                    <Button size="sm" variant="outline" className="text-error border-error/30 hover:bg-error/10"
                      onClick={() => { setDialog({ center: c, action: 'reject' }); setRemarks(''); }}>
                      <XCircle className="w-4 h-4 mr-1" />Reject
                    </Button>
                    <Button size="sm" onClick={() => { setDialog({ center: c, action: 'approve' }); setRemarks(''); }}>
                      <CheckCircle className="w-4 h-4 mr-1" />Approve
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={() => { setDialog(null); setRemarks(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.action === 'approve' ? 'Approve' : 'Reject'} — {dialog?.center.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Remarks {dialog?.action === 'reject' && <span className="text-error">*</span>}</Label>
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
              disabled={submitting}
              variant={dialog?.action === 'reject' ? 'destructive' : 'default'}
            >
              {submitting ? 'Processing...' : dialog?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
