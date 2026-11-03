import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, UserPlus, Eye, ShieldAlert, Clock, CheckCircle, XCircle, Pencil, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { toast } from 'sonner';
import { EnrollStudentPanel } from '@/components/panels/EnrollStudentPanel';
import { EditSalesStudentDialog } from '@/components/dialogs/EditSalesStudentDialog';

interface SalesEnrollment {
  id: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  studentAddress?: string;
  status: string;
  createdAt: string;
  departmentRemarks?: string | null;
  financeRemarks?: string | null;
  specialisation?: string | null;
  abcId?: string | null;
  debId?: string | null;
  dob?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  program?: { id: string; name: string; code: string } | null;
  session?: { id: string; name: string } | null;
  salesUser?: { id: string; name: string; email: string } | null;
  documents?: any;
  educationalDetails?: any;
}

export function SalesStudentEnrollmentPanel() {
  const [enrollments, setEnrollments] = useState<SalesEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<SalesEnrollment | null>(null);
  const [viewingEnrollment, setViewingEnrollment] = useState<SalesEnrollment | null>(null);
  const [updatingEnrollment, setUpdatingEnrollment] = useState<SalesEnrollment | null>(null);
  // Only a sales manager can reassign a student, and only within their own team.
  const { user } = useAuth();
  const isSalesManager = user?.role === 'sales_admin';
  const [reassigningEnrollment, setReassigningEnrollment] = useState<SalesEnrollment | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; email: string; role: string; designation?: string }[]>([]);
  const [reassignTo, setReassignTo] = useState('');
  const [reassignSaving, setReassignSaving] = useState(false);

  const openReassign = async (enrollment: SalesEnrollment) => {
    setReassigningEnrollment(enrollment);
    setReassignTo('');
    try {
      const response = await api.get('/sales/student-applications/reassign-targets');
      setTeamMembers(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load your sales team');
    }
  };

  const handleReassign = async () => {
    if (!reassigningEnrollment || !reassignTo || reassignSaving) return;
    setReassignSaving(true);
    try {
      await api.put(`/sales/student-applications/${reassigningEnrollment.id}/reassign`, { salesUserId: reassignTo });
      const newOwner = teamMembers.find(member => member.id === reassignTo);
      toast.success(`${reassigningEnrollment.studentName} reassigned to ${newOwner?.name || 'the selected staff member'}`);
      setReassigningEnrollment(null);
      fetchEnrollments();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reassign student');
    } finally {
      setReassignSaving(false);
    }
  };

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/sales/student-applications');
      setEnrollments(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load student enrollments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const isOpsRejected = (status: string) => status === 'ops_rejected' || status === 'department_rejected';
  // Matches the server rule: details can be corrected until Operations completes verification
  const canUpdateDetails = (status: string) => ['pending_doc_review', 'document_review', 'payment_pending'].includes(status);

  const renderStatusBadge = (enrollment: SalesEnrollment) => {
    if (isOpsRejected(enrollment.status)) {
      return (
        <div className="space-y-1">
          <Badge variant="outline" className="border-red-400/40 bg-red-500/10 text-red-600 font-medium text-xs">
            <XCircle className="mr-1 h-3 w-3" />
            Rejected by Operations
          </Badge>
          {enrollment.departmentRemarks && (
            <p className="text-[11px] text-red-600 font-medium max-w-[200px] truncate" title={enrollment.departmentRemarks}>
              Reason: {enrollment.departmentRemarks}
            </p>
          )}
        </div>
      );
    }

    if (enrollment.status === 'document_review' || enrollment.status === 'pending_doc_review') {
      return (
        <Badge variant="outline" className="border-yellow-400/40 bg-yellow-500/10 text-yellow-700 font-medium text-xs">
          <Clock className="mr-1 h-3 w-3" />
          Operations Review
        </Badge>
      );
    }

    if (enrollment.status === 'finance_review' || enrollment.status === 'pending_finance_review') {
      return (
        <Badge variant="outline" className="border-blue-400/40 bg-blue-500/10 text-blue-700 font-medium text-xs">
          <Clock className="mr-1 h-3 w-3" />
          Finance Review
        </Badge>
      );
    }

    if (enrollment.status === 'enrolled') {
      return (
        <Badge variant="outline" className="border-green-400/40 bg-green-500/10 text-green-700 font-medium text-xs">
          <CheckCircle className="mr-1 h-3 w-3" />
          Enrolled
        </Badge>
      );
    }

    if (enrollment.status === 'rejected' || enrollment.status === 'finance_rejected') {
      return (
        <Badge variant="outline" className="border-red-400/40 bg-red-500/10 text-red-600 font-medium text-xs">
          <XCircle className="mr-1 h-3 w-3" />
          Rejected by Finance
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        {enrollment.status.replace(/_/g, ' ')}
      </Badge>
    );
  };

  if (showForm) {
    return (
      <EnrollStudentPanel
        mode="sales"
        onSubmitted={() => {
          setShowForm(false);
          fetchEnrollments();
        }}
        onBack={() => setShowForm(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Student Enrollment</h2>
          <p className="mt-1 text-sm text-muted-foreground">View and manage student applications submitted by you and your sales team.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchEnrollments} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Student
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map(row => <div key={row} className="h-10 animate-pulse rounded bg-muted" />)}
            </div>
          ) : enrollments.length === 0 ? (
            <p className="py-14 text-center text-sm text-muted-foreground">No student applications found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Student Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Program</th>
                    <th className="px-4 py-3 font-medium">Admission Session</th>
                    <th className="px-4 py-3 font-medium">Enrolled By</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Submitted</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map(enrollment => (
                    <tr key={enrollment.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 font-medium">{enrollment.studentName}</td>
                      <td className="px-4 py-3">{enrollment.studentEmail}</td>
                      <td className="px-4 py-3">{enrollment.studentPhone}</td>
                      <td className="px-4 py-3">{enrollment.program?.name || '—'}{enrollment.program?.code ? ` (${enrollment.program.code})` : ''}</td>
                      <td className="px-4 py-3">{enrollment.session?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{enrollment.salesUser?.name || '—'}</span>
                        {enrollment.salesUser?.email && (
                          <span className="block text-xs text-muted-foreground">{enrollment.salesUser.email}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {renderStatusBadge(enrollment)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(enrollment.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isOpsRejected(enrollment.status) && (
                            <Button
                              size="sm"
                              className="bg-amber-600 text-white hover:bg-amber-700 h-8 text-xs font-medium"
                              onClick={() => setEditingEnrollment(enrollment)}
                            >
                              <RefreshCw className="mr-1.5 h-3 w-3" />
                              Edit &amp; Re-submit
                            </Button>
                          )}
                          {!isOpsRejected(enrollment.status) && (
                            <span title={canUpdateDetails(enrollment.status) ? 'Update student details' : 'Details are locked after Operations verification'}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-medium"
                                disabled={!canUpdateDetails(enrollment.status)}
                                onClick={() => setUpdatingEnrollment(enrollment)}
                              >
                                <Pencil className="mr-1 h-3.5 w-3.5" />
                                Update
                              </Button>
                            </span>
                          )}
                          {isSalesManager && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs font-medium"
                              onClick={() => openReassign(enrollment)}
                            >
                              <UserCheck className="mr-1 h-3.5 w-3.5" />
                              Reassign
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setViewingEnrollment(enrollment)}
                          >
                            <Eye className="mr-1 h-3.5 w-3.5" />
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={!!viewingEnrollment} onOpenChange={(open) => !open && setViewingEnrollment(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          {viewingEnrollment && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl">{viewingEnrollment.studentName}</DialogTitle>
                  {renderStatusBadge(viewingEnrollment)}
                </div>
                <DialogDescription>
                  Submitted on {new Date(viewingEnrollment.createdAt).toLocaleDateString()} by {viewingEnrollment.salesUser?.name || 'Sales Staff'}
                </DialogDescription>
              </DialogHeader>

              {isOpsRejected(viewingEnrollment.status) && viewingEnrollment.departmentRemarks && (
                <div className="rounded-lg border border-red-300/60 bg-red-50 p-3.5 text-sm dark:bg-red-950/30">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <div>
                      <p className="font-semibold text-red-700 dark:text-red-400">Operations Feedback:</p>
                      <p className="mt-0.5 text-red-600 dark:text-red-300">{viewingEnrollment.departmentRemarks}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg border">
                  <div>
                    <span className="text-xs text-muted-foreground block">Email</span>
                    <span className="font-medium">{viewingEnrollment.studentEmail}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Phone</span>
                    <span className="font-medium">{viewingEnrollment.studentPhone}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Program</span>
                    <span className="font-medium">{viewingEnrollment.program?.name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Admission Session</span>
                    <span className="font-medium">{viewingEnrollment.session?.name || '—'}</span>
                  </div>
                  {viewingEnrollment.studentAddress && (
                    <div className="col-span-2">
                      <span className="text-xs text-muted-foreground block">Address</span>
                      <span className="font-medium">{viewingEnrollment.studentAddress}</span>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setViewingEnrollment(null)}>
                  Close
                </Button>
                {canUpdateDetails(viewingEnrollment.status) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const toUpdate = viewingEnrollment;
                      setViewingEnrollment(null);
                      setUpdatingEnrollment(toUpdate);
                    }}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Update
                  </Button>
                )}
                {isOpsRejected(viewingEnrollment.status) && (
                  <Button
                    className="bg-amber-600 text-white hover:bg-amber-700"
                    onClick={() => {
                      const toEdit = viewingEnrollment;
                      setViewingEnrollment(null);
                      setEditingEnrollment(toEdit);
                    }}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Edit &amp; Re-submit
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reassign a student to another member of the manager's team */}
      <Dialog open={!!reassigningEnrollment} onOpenChange={(open) => { if (!open && !reassignSaving) setReassigningEnrollment(null); }}>
        <DialogContent className="max-w-md">
          {reassigningEnrollment && (
            <>
              <DialogHeader>
                <DialogTitle>Reassign Student</DialogTitle>
                <DialogDescription>
                  Move {reassigningEnrollment.studentName} ({reassigningEnrollment.program?.name || 'Program'}) to another member of your sales team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <span className="block text-xs text-muted-foreground">Currently assigned to</span>
                  <span className="font-medium">{reassigningEnrollment.salesUser?.name || '—'}</span>
                  {reassigningEnrollment.salesUser?.email && (
                    <span className="block text-xs text-muted-foreground">{reassigningEnrollment.salesUser.email}</span>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reassignTo">Reassign to *</Label>
                  <Select value={reassignTo} onValueChange={setReassignTo}>
                    <SelectTrigger id="reassignTo"><SelectValue placeholder="Select a sales staff member" /></SelectTrigger>
                    <SelectContent>
                      {teamMembers
                        .filter(member => member.id !== reassigningEnrollment.salesUser?.id)
                        .map(member => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name}{member.id === user?.id ? ' (You)' : ''} — {member.designation || member.role.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {teamMembers.filter(member => member.id !== reassigningEnrollment.salesUser?.id).length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No one else is in your team. Sales staff join your team when they report to you in the organization hierarchy.
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setReassigningEnrollment(null)} disabled={reassignSaving}>Cancel</Button>
                <Button onClick={handleReassign} disabled={!reassignTo || reassignSaving}>
                  {reassignSaving ? 'Reassigning...' : 'Reassign'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit & Re-submit Dialog */}
      <EditSalesStudentDialog
        open={!!editingEnrollment}
        onOpenChange={(open) => !open && setEditingEnrollment(null)}
        enrollment={editingEnrollment}
        onSuccess={fetchEnrollments}
      />

      {/* Update details without changing the review status */}
      <EditSalesStudentDialog
        mode="update"
        open={!!updatingEnrollment}
        onOpenChange={(open) => !open && setUpdatingEnrollment(null)}
        enrollment={updatingEnrollment}
        onSuccess={fetchEnrollments}
      />
    </div>
  );
}
