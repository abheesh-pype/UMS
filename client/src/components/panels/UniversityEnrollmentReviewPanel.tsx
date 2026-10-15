import { useState, useEffect } from 'react';
import { Bell, CheckCircle, XCircle, RefreshCw, GraduationCap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Enrollment {
  id: string;
  enrollmentNumber?: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  studentAddress: string;
  createdAt: string;
  status: string;
  program?: { id: string; name: string; code: string; courseType: string } | null;
  studyCenter?: { id: string; name: string; code: string } | null;
  session: { id: string; name: string };
  departmentReviewer?: { id: string; name: string } | null;
  assignedOpsUser?: { id: string; name: string } | null;
}

export function UniversityEnrollmentReviewPanel({ organizationWide = false }: { organizationWide?: boolean }) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string; studentName: string }>({ open: false, id: '', studentName: '' });
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await api.get('/enrollment/university-review');
      setEnrollments(res.data.data || []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQueue(); }, []);

  const handleApprove = async (id: string) => {
    try {
      await api.put(`/enrollment/university-review/${id}/approve`);
      toast.success('Enrollment approved — student is now enrolled');
      setEnrollments(prev => prev.filter(e => e.id !== id));
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!remarks.trim()) { toast.error('Remarks are required'); return; }
    setSubmitting(true);
    try {
      await api.put(`/enrollment/university-review/${rejectDialog.id}/reject`, { remarks });
      toast.success('Enrollment rejected — partner portal and operations have been notified');
      setEnrollments(prev => prev.filter(e => e.id !== rejectDialog.id));
      setRejectDialog({ open: false, id: '', studentName: '' });
      setRemarks('');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to reject');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingDepartment = (status: string) => {
    if (['pending_doc_review', 'document_review'].includes(status)) return 'Operations Department';
    if (status === 'university_review') return 'University Administration';
    if (['finance_review', 'pending_finance_review'].includes(status)) return 'Finance Department';
    return 'Department';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{organizationWide ? 'Pending Student Verification' : 'Pending Enrollment Review'}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {organizationWide
              ? 'See which department is currently reviewing each student.'
              : 'Review student enrollments forwarded by Operations for final approval.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline">{enrollments.length} pending</Badge>
          <Button variant="outline" size="sm" onClick={fetchQueue} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : enrollments.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No enrollments pending review</p>
            <p className="text-sm mt-1">All caught up — check back later.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {enrollments.map(e => (
            <Card key={e.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {e.enrollmentNumber && (
                        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{e.enrollmentNumber}</span>
                      )}
                      <Badge variant="secondary" className="text-xs">{e.program.courseType}</Badge>
                      {organizationWide && (
                        <Badge variant="outline">
                          Pending for {pendingDepartment(e.status)} approval
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-semibold text-base">{e.studentName}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 mt-2 text-sm text-muted-foreground">
                      <span>{e.studentEmail}</span>
                      <span>{e.studentPhone}</span>
                      <span className="font-medium text-foreground">{e.program?.name} ({e.program?.code})</span>
                      <span>Partner: {e.studyCenter?.name || 'Direct / Sales Direct'}</span>
                      <span>Session: {e.session?.name}</span>
                      <span>Submitted: {new Date(e.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 flex-col sm:flex-row">
                      {(!organizationWide || e.status === 'university_review') && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => { setRejectDialog({ open: true, id: e.id, studentName: e.studentName }); setRemarks(''); }}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                          <Button size="sm" onClick={() => handleApprove(e.id)}>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                        </>
                      )}
                      {organizationWide && (
                        <Button variant="outline" size="sm">
                          <Bell className="w-4 h-4 mr-1" />
                          Send Reminder
                        </Button>
                      )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={rejectDialog.open} onOpenChange={o => { if (!o) { setRejectDialog({ open: false, id: '', studentName: '' }); setRemarks(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Enrollment — {rejectDialog.studentName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Rejection Remark <span className="text-destructive">*</span></Label>
            <Textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Provide a reason for rejection. This will be shared with the partner portal and operations team."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">This remark will be sent as a notification to the partner portal and operations department.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog({ open: false, id: '', studentName: '' }); setRemarks(''); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={submitting || !remarks.trim()}>
              {submitting ? 'Rejecting...' : 'Reject Enrollment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
