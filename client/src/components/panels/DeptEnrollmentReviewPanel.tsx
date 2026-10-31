import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, Mail, Phone, MapPin, GraduationCap, FileText, Calendar, ShieldAlert, UserCheck, Users, Send, AlertTriangle, Edit, Upload, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  studentPhone?: string;
  studentAddress?: string;
  studentPhoto?: string;
  programId?: string | null;
  studyCenterId?: string | null;
  isDirectStudentApplication?: boolean;
  status: string;
  createdAt: string;
  departmentRemarks?: string;
  financeRemarks?: string;
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
  admissionDate?: string;
  assignedOpsUserId?: string;
  assignedOpsUser?: { id: string; name: string; email: string; role?: string };
  departmentReviewer?: { id: string; name: string };
  program?: { name: string; code: string; university?: { id: string; name: string } };
  studyCenter?: { id: string; name: string } | null;
  session?: { name: string };
  documents?: { name: string; url: string }[];
  educationalDetails?: { qualification: string; institution: string; passingYear: string; percentage?: string }[];
  initialPaymentProof?: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  payment_pending: 'bg-muted text-muted-foreground',
  document_review: 'bg-info/10 text-info',
  pending_doc_review: 'bg-info/10 text-info',
  dept_review: 'bg-warning/10 text-warning',
  finance_review: 'bg-orange-100 text-orange-700',
  pending_finance_review: 'bg-orange-100 text-orange-700',
  enrolled: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
  department_rejected: 'bg-destructive/10 text-destructive',
  finance_rejected: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400',
};

export function DeptEnrollmentReviewPanel() {
  const { user } = useAuth();
  const isOpsAdmin = ['ops_admin', 'superadmin', 'org_admin'].includes(user?.role || '');

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState('all');

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [remarks, setRemarks] = useState('');
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editDocuments, setEditDocuments] = useState<{ name: string; url: string }[]>([]);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  // Replacement for a wrong payment proof submitted with the enrollment form
  const [newPaymentProof, setNewPaymentProof] = useState<{ name: string; url: string } | null>(null);
  const [uploadingPaymentProof, setUploadingPaymentProof] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [universityFilter, setUniversityFilter] = useState('all');
  const [centerFilter, setCenterFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/enrollment/review?history=${activeTab === 'history'}`);
      setEnrollments(res.data.data || []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const res = await api.get('/users?departmentType=operations');
      const users = res.data.data || [];
      const opsSubordinates = users.filter((u: any) => {
        const role = (u.role || '').toLowerCase();
        const isEligibleRole = ['employee', 'ops_sub_admin', 'operation subadmin'].includes(role);
        return isEligibleRole && u.status !== 'inactive';
      });
      setTeamMembers(opsSubordinates);
    } catch (e) {
      console.error('Failed to load operations team members', e);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetch(); }, [activeTab]);

  useEffect(() => {
    if (isOpsAdmin) {
      fetchTeamMembers();
    }
  }, [isOpsAdmin]);

  const handleAssign = async (enrollmentId: string, assignedOpsUserId: string | null) => {
    setAssigningId(enrollmentId);
    try {
      await api.put(`/enrollment/review/${enrollmentId}/assign`, {
        assignedOpsUserId: assignedOpsUserId || null,
      });
      toast.success(assignedOpsUserId ? 'Assigned successfully' : 'Unassigned successfully');
      fetch();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to assign');
    } finally {
      setAssigningId(null);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.put(`/enrollment/review/${id}/approve`);
      toast.success('Enrollment approved — forwarded to Finance');
      setSelectedEnrollment(null);
      fetch();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to approve');
    }
  };

  const handleResubmit = async (id: string) => {
    try {
      await api.put(`/enrollment/review/${id}/resubmit`);
      toast.success('Enrollment resubmitted to Finance');
      setSelectedEnrollment(null);
      fetch();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to resubmit');
    }
  };

  const handleStartEdit = (enrollment: Enrollment) => {
    const editableFields = [
      'studentName', 'studentEmail', 'studentPhone', 'studentAddress', 'dob', 'fatherName',
      'motherName', 'parentMobile', 'alternativePhone', 'pincode', 'religion', 'caste',
      'maritalStatus', 'currentlyWorking', 'specialisation', 'abcId', 'debId',
    ];
    setEditForm(Object.fromEntries(editableFields.map(field => [field, String((enrollment as any)[field] || '')])));
    setEditDocuments(enrollment.documents || []);
    setNewPaymentProof(null);
    setEditingEnrollment(enrollment);
    setSelectedEnrollment(null);
  };

  const handleUploadPaymentProof = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Payment proof must be an image or PDF file');
      return;
    }
    setUploadingPaymentProof(true);
    const body = new FormData();
    body.append('file', file);
    try {
      const response = await api.post('/enrollment/payment-proof-upload', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setNewPaymentProof({ name: response.data.filename || file.name, url: response.data.url });
      toast.success('Payment proof uploaded. Save to apply it.');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to upload payment proof');
    } finally {
      setUploadingPaymentProof(false);
    }
  };

  const handleUploadEditDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingDocument(true);
    const body = new FormData();
    body.append('file', file);
    try {
      const response = await api.post('/enrollment/upload', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEditDocuments(current => [...current, { name: file.name, url: response.data.url }]);
      toast.success('Document uploaded');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploadingDocument(false);
      event.target.value = '';
    }
  };

  const handleUpdateEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingEnrollment) return;
    try {
      await api.put(`/enrollment/review/${editingEnrollment.id}/update`, {
        ...editForm,
        documents: editDocuments,
        ...(newPaymentProof ? { initialPaymentProof: newPaymentProof.url } : {}),
      });
      toast.success('Student details updated and returned to Operations review');
      setEditingEnrollment(null);
      fetch();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update student details');
    }
  };

  const handleReject = async () => {
    try {
      await api.put(`/enrollment/review/${rejectDialog.id}/reject`, { remarks });
      toast.success('Enrollment rejected');
      setRejectDialog({ open: false, id: '' });
      setSelectedEnrollment(null);
      setRemarks('');
      fetch();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to reject');
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
      return e.studyCenter.name || 'Study Center';
    }
    if (e.studyCenterId && typeof e.studyCenterId === 'object') {
      return (e.studyCenterId as any).name || 'Study Center';
    }
    if (typeof e.studyCenterId === 'string' && e.studyCenterId) return e.studyCenterId;
    return e.isDirectStudentApplication ? 'Direct Student Application' : 'Direct Admission (Sales)';
  };

  const uniqueUniversities = Array.from(new Set(enrollments.filter(e => e.program?.university).map(e => JSON.stringify({ id: e.program!.university!.id, name: e.program!.university!.name })))).map(s => JSON.parse(s));
  const uniqueCenters = Array.from(new Set(enrollments.filter(e => e.studyCenter).map(e => JSON.stringify({ id: e.studyCenter!.id, name: e.studyCenter!.name })))).map(s => JSON.parse(s));
  const uniquePrograms = Array.from(new Set(enrollments.filter(e => e.program).map(e => JSON.stringify({ id: e.programId, name: `${e.program!.name} (${e.program!.code})` })))).map(s => JSON.parse(s));

  const filteredEnrollments = enrollments
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter(e => {
      if (universityFilter !== 'all' && e.program?.university?.id !== universityFilter) return false;
      if (centerFilter !== 'all' && (e.studyCenter?.id !== centerFilter && e.studyCenterId !== centerFilter)) return false;
      if (programFilter !== 'all' && e.programId !== programFilter) return false;

      if (assigneeFilter === 'unassigned') {
        if (e.assignedOpsUserId) return false;
      } else if (assigneeFilter !== 'all') {
        if (e.assignedOpsUserId !== assigneeFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          e.studentName.toLowerCase().includes(q) ||
          e.studentEmail.toLowerCase().includes(q) ||
          (e.enrollmentNumber || '').toLowerCase().includes(q)
        );
      }
      return true;
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Enrollment Review</h2>
          <p className="text-muted-foreground text-sm mt-1">Review and approve student enrollments before finance processing.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetch} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />Refresh
        </Button>
      </div>

      <Tabs defaultValue="pending" value={activeTab} onValueChange={(val) => setActiveTab(val as 'pending' | 'history')} className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending">Pending Reviews</TabsTrigger>
          <TabsTrigger value="history">Review History</TabsTrigger>
        </TabsList>

        <div className="flex flex-col md:flex-row gap-3 flex-wrap">
          <Input
            placeholder="Search name, email, or enrollment no..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="md:w-64"
          />
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm md:w-48"
            value={universityFilter}
            onChange={e => setUniversityFilter(e.target.value)}
          >
            <option value="all">All Universities</option>
            {uniqueUniversities.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm md:w-48"
            value={centerFilter}
            onChange={e => setCenterFilter(e.target.value)}
          >
            <option value="all">All Centers</option>
            {uniqueCenters.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm md:w-48"
            value={programFilter}
            onChange={e => setProgramFilter(e.target.value)}
          >
            <option value="all">All Programs</option>
            {uniquePrograms.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {isOpsAdmin && (
            <select
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm md:w-56"
              value={assigneeFilter}
              onChange={e => setAssigneeFilter(e.target.value)}
            >
              <option value="all">All Assignees</option>
              <option value="unassigned">⚠️ Unassigned Only</option>
              {teamMembers.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role === 'ops_sub_admin' || m.role === 'operation subadmin' ? 'Sub-Admin' : 'Employee'})
                </option>
              ))}
            </select>
          )}
        </div>

        <TabsContent value="pending" className="space-y-4">
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : filteredEnrollments.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">No enrollments pending review.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {filteredEnrollments.map(e => (
                <Card key={e.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0 cursor-pointer group/item" onClick={() => setSelectedEnrollment(e)}>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={cn('text-[10px] uppercase font-bold', STATUS_COLOR[e.status] || 'bg-warning/10 text-warning')}>
                            {e.status === 'finance_rejected' ? 'Rejected by Finance' : e.status.replace(/_/g, ' ')}
                          </Badge>
                          {e.enrollmentNumber && <span className="text-xs text-muted-foreground">{e.enrollmentNumber}</span>}
                        </div>
                        <h4 className="font-semibold text-base group-hover/item:text-primary transition-colors flex items-center gap-1.5">
                          {e.studentName}
                          <span className="text-[10px] text-primary opacity-0 group-hover/item:opacity-100 transition-opacity font-normal">(Click to review details)</span>
                        </h4>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                          <span>{e.studentEmail}</span>
                          <span>{getProgramName(e)}</span>
                          <span>{getCenterName(e)}</span>
                          <span>{new Date(e.createdAt).toLocaleDateString()}</span>
                        </div>
                        {e.status === 'finance_rejected' && (
                          <div className="mt-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 p-2.5 rounded-lg text-xs flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold">Finance Rejection Reason:</span> {e.financeRemarks || 'No remarks provided.'}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleStartEdit(e)}>
                          <Edit className="w-4 h-4 mr-1" />Update
                        </Button>
                        {e.status === 'finance_rejected' ? (
                          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm" onClick={() => handleResubmit(e.id)}>
                            <Send className="w-4 h-4 mr-1" />Resubmit to Finance
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="text-success border-success/30 hover:bg-success/10" onClick={() => handleApprove(e.id)}>
                            <CheckCircle className="w-4 h-4 mr-1" />Approve
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { setRejectDialog({ open: true, id: e.id }); setRemarks(''); }}>
                          <XCircle className="w-4 h-4 mr-1" />Reject
                        </Button>
                      </div>
                    </div>

                    {/* Assignment Row */}
                    {isOpsAdmin ? (
                      <div className="pt-3 border-t border-border flex items-center justify-between flex-wrap gap-2 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-muted-foreground font-medium flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-primary" /> Assign Reviewer:
                          </span>
                          <select
                            value={e.assignedOpsUserId || ''}
                            disabled={assigningId === e.id}
                            onChange={(ev) => handleAssign(e.id, ev.target.value || null)}
                            className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50"
                          >
                            <option value="">⚠️ Unassigned (Select employee)</option>
                            {teamMembers.map((m: any) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.role === 'ops_sub_admin' || m.role === 'operation subadmin' ? 'Sub-Admin' : 'Employee'})
                              </option>
                            ))}
                          </select>
                        </div>
                        {e.assignedOpsUser ? (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[11px] font-medium py-0.5">
                            Assigned to: {e.assignedOpsUser.name}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[11px] font-medium py-0.5">
                            Needs Assignment
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <div className="pt-3 border-t border-border flex items-center justify-between flex-wrap gap-2 text-xs">
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[11px] font-medium py-0.5">
                          <CheckCircle className="w-3 h-3 mr-1" /> Assigned to You
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : filteredEnrollments.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">No review history found.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {filteredEnrollments.map(e => (
                <Card key={e.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-5 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0 cursor-pointer group/item" onClick={() => setSelectedEnrollment(e)}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={cn('text-[10px] uppercase font-bold', STATUS_COLOR[e.status] || 'bg-muted text-muted-foreground')}>
                          {e.status.replace(/_/g, ' ')}
                        </Badge>
                        {e.enrollmentNumber && <span className="text-xs text-muted-foreground">{e.enrollmentNumber}</span>}
                      </div>
                      <h4 className="font-semibold text-base group-hover/item:text-primary transition-colors flex items-center gap-1.5">
                        {e.studentName}
                        <span className="text-[10px] text-primary opacity-0 group-hover/item:opacity-100 transition-opacity font-normal">(Click to view details)</span>
                      </h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                        <span>{e.studentEmail}</span>
                        <span>{getProgramName(e)}</span>
                        <span>{getCenterName(e)}</span>
                        <span>{new Date(e.createdAt).toLocaleDateString()}</span>
                      </div>
                      {(e.assignedOpsUser || e.departmentReviewer) && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground pt-2 border-t border-border/50 flex-wrap">
                          {e.assignedOpsUser && <span>Assigned to: <strong className="text-foreground">{e.assignedOpsUser.name}</strong></span>}
                          {e.departmentReviewer && <span>Reviewed by: <strong className="text-foreground">{e.departmentReviewer.name}</strong></span>}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

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
                  <Badge className={cn('text-[10px] uppercase font-bold', STATUS_COLOR[selectedEnrollment.status] || 'bg-muted text-muted-foreground')}>
                    {selectedEnrollment.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Rejection remarks */}
                {selectedEnrollment.status === 'finance_rejected' && (
                  <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 p-4 rounded-xl text-sm">
                    <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Rejected by Finance:</p>
                    <p className="mt-1 font-medium italic">{selectedEnrollment.financeRemarks || 'No remarks provided.'}</p>
                  </div>
                )}
                {selectedEnrollment.status === 'department_rejected' && (
                  <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-xl text-sm">
                    <p className="font-bold flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> Rejection Remarks by Operations:</p>
                    <p className="mt-1 font-medium italic">{selectedEnrollment.departmentRemarks || 'No remarks provided.'}</p>
                  </div>
                )}
                {selectedEnrollment.status === 'rejected' && (
                  <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-xl text-sm">
                    <p className="font-bold flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> Rejection Remarks:</p>
                    <p className="mt-1 font-medium italic">{selectedEnrollment.departmentRemarks || selectedEnrollment.financeRemarks || 'No remarks provided.'}</p>
                  </div>
                )}

                {/* Contact details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-muted/20 p-4 rounded-xl border text-sm">
                  <div className="flex items-start gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Email</p>
                      <p className="font-medium break-all">{selectedEnrollment.studentEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Phone</p>
                      <p className="font-medium">{selectedEnrollment.studentPhone || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Alt Phone</p>
                      <p className="font-medium">{selectedEnrollment.alternativePhone || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Parent Mobile</p>
                      <p className="font-medium">{selectedEnrollment.parentMobile || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 lg:col-span-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Address</p>
                      <p className="font-medium">{selectedEnrollment.studentAddress || 'N/A'} {selectedEnrollment.pincode ? `- ${selectedEnrollment.pincode}` : ''}</p>
                    </div>
                  </div>
                </div>

                {/* Personal Details */}
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <span className="w-4 h-4 flex items-center justify-center text-primary text-xs">👤</span> Personal Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-muted/10 p-4 rounded-xl border text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block font-semibold">Date of Birth</span>
                      <span className="font-medium">{selectedEnrollment.dob || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block font-semibold">Father's Name</span>
                      <span className="font-medium">{selectedEnrollment.fatherName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block font-semibold">Mother's Name</span>
                      <span className="font-medium">{selectedEnrollment.motherName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block font-semibold">Religion</span>
                      <span className="font-medium">{selectedEnrollment.religion || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block font-semibold">Caste / Category</span>
                      <span className="font-medium">{selectedEnrollment.caste || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block font-semibold">Marital Status</span>
                      <span className="font-medium">{selectedEnrollment.maritalStatus || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block font-semibold">Currently Working</span>
                      <span className="font-medium">{selectedEnrollment.currentlyWorking || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block font-semibold">ABC ID</span>
                      <span className="font-medium">{selectedEnrollment.abcId || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block font-semibold">DEB ID</span>
                      <span className="font-medium">{selectedEnrollment.debId || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Course Details */}
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-primary" /> Program & Session Info
                  </h4>
                  <div className="bg-muted/10 p-4 rounded-xl border text-sm space-y-2">
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
                      <span className="text-xs text-muted-foreground block font-semibold">Study Center</span>
                      <span className="font-medium">{getCenterName(selectedEnrollment)}</span>
                    </div>
                    {selectedEnrollment.session?.name && (
                      <div>
                        <span className="text-xs text-muted-foreground block font-medium">Intake Session</span>
                        <span className="font-semibold">{selectedEnrollment.session.name}</span>
                      </div>
                    )}
                    <div className="pt-1 border-t mt-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Submitted on: {new Date(selectedEnrollment.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Educational Details */}
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-primary" /> Educational History
                  </h4>
                  {selectedEnrollment.educationalDetails && selectedEnrollment.educationalDetails.length > 0 ? (
                    <div className="space-y-2">
                      {selectedEnrollment.educationalDetails.map((edu, idx) => (
                        <div key={idx} className="bg-muted/10 p-3 rounded-lg border text-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                          <div className="col-span-1">
                            <span className="text-xs text-muted-foreground block">Qualification</span>
                            <span className="font-semibold">{edu.qualification}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-xs text-muted-foreground block">Institution</span>
                            <span className="font-medium">{edu.institution}</span>
                          </div>
                          <div className="col-span-1 text-right">
                            <span className="text-xs text-muted-foreground block">Passing / %</span>
                            <span className="font-medium">{edu.passingYear} {edu.percentage ? `· ${edu.percentage}%` : ''}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic bg-muted/10 p-3 rounded-lg border">No educational credentials added.</p>
                  )}
                </div>

                {/* Uploaded Documents */}
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-primary" /> Uploaded Documents
                  </h4>
                  {selectedEnrollment.documents && selectedEnrollment.documents.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedEnrollment.documents.map((doc, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-muted/10 p-2.5 rounded-lg border text-sm">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="truncate font-medium">{doc.name}</span>
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
                  ) : (
                    <p className="text-xs text-muted-foreground italic bg-muted/10 p-3 rounded-lg border">No documents uploaded.</p>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedEnrollment(null)}>
                  Close
                </Button>
                {activeTab === 'pending' && (
                  <>
                <Button variant="outline" onClick={() => handleStartEdit(selectedEnrollment)}>
                  <Edit className="w-4 h-4 mr-1" />Update Details
                </Button>
                <Button
                      variant="destructive"
                      className="text-white bg-destructive hover:bg-destructive/90"
                      onClick={() => {
                        setRejectDialog({ open: true, id: selectedEnrollment.id });
                        setRemarks('');
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Reject Application
                    </Button>
                    {selectedEnrollment.status === 'finance_rejected' ? (
                      <Button
                        className="text-white bg-amber-600 hover:bg-amber-700 shadow-sm"
                        onClick={() => handleResubmit(selectedEnrollment.id)}
                      >
                        <Send className="w-4 h-4 mr-1" /> Resubmit to Finance
                      </Button>
                    ) : (
                      <Button
                        className="text-white bg-success hover:bg-success/90"
                        onClick={() => handleApprove(selectedEnrollment.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                      </Button>
                    )}
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingEnrollment} onOpenChange={open => !open && setEditingEnrollment(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Student Application</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateEnrollment} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                ['studentName', 'Student Name'],
                ['studentEmail', 'Email'],
                ['studentPhone', 'Phone'],
                ['studentAddress', 'Address'],
                ['dob', 'Date of Birth'],
                ['fatherName', "Father's Name"],
                ['motherName', "Mother's Name"],
                ['parentMobile', 'Parent Mobile'],
                ['alternativePhone', 'Alternative Phone'],
                ['pincode', 'Pincode'],
                ['religion', 'Religion'],
                ['caste', 'Caste / Category'],
                ['maritalStatus', 'Marital Status'],
                ['currentlyWorking', 'Currently Working'],
                ['specialisation', 'Specialisation'],
                ['abcId', 'ABC ID'],
                ['debId', 'DEB ID'],
              ].map(([field, label]) => (
                <div key={field} className="space-y-1">
                  <Label htmlFor={`ops-enrollment-${field}`}>{label}</Label>
                  <Input
                    id={`ops-enrollment-${field}`}
                    type={field === 'studentEmail' ? 'email' : 'text'}
                    value={editForm[field] || ''}
                    onChange={event => setEditForm(current => ({ ...current, [field]: event.target.value }))}
                    required={['studentName', 'studentEmail', 'studentPhone'].includes(field)}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Application Documents</Label>
              <Input type="file" onChange={handleUploadEditDocument} disabled={uploadingDocument} />
              {uploadingDocument && <p className="text-xs text-muted-foreground">Uploading document...</p>}
              {editDocuments.map((document, index) => (
                <div key={`${document.url}-${index}`} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
                  <a className="truncate text-primary hover:underline" href={document.url} target="_blank" rel="noreferrer">
                    {document.name || 'Application document'}
                  </a>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${document.name || 'document'}`}
                    onClick={() => setEditDocuments(current => current.filter((_, documentIndex) => documentIndex !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="updatePaymentProof">Update Payment Proof</Label>
              {editingEnrollment?.initialPaymentProof ? (
                <div className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
                  <span className="text-muted-foreground">Current payment proof</span>
                  <a className="text-primary hover:underline" href={resolveFileUrl(editingEnrollment.initialPaymentProof)} target="_blank" rel="noreferrer">
                    View
                  </a>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No payment proof was submitted with the enrollment form.</p>
              )}
              <Input
                id="updatePaymentProof"
                type="file"
                accept="image/*,application/pdf"
                onChange={handleUploadPaymentProof}
                disabled={uploadingPaymentProof}
              />
              <p className="text-xs text-muted-foreground">Upload an image or PDF to replace a wrong payment proof.</p>
              {uploadingPaymentProof && <p className="text-xs text-muted-foreground">Uploading payment proof...</p>}
              {newPaymentProof && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 p-2 text-sm">
                  <a className="truncate text-primary hover:underline" href={resolveFileUrl(newPaymentProof.url)} target="_blank" rel="noreferrer">
                    New: {newPaymentProof.name}
                  </a>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Remove new payment proof"
                    onClick={() => setNewPaymentProof(null)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingEnrollment(null)}>Cancel</Button>
              <Button type="submit" disabled={uploadingDocument || uploadingPaymentProof}>Save and Return to Operations Review</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
