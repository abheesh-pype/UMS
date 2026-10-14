import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Bell, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UniversityEnrollmentReviewPanel } from '@/components/panels/UniversityEnrollmentReviewPanel';
import api from '@/lib/api';
import { toast } from 'sonner';

interface StudyCenter {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  coordinatorName?: string | null;
  contact?: string | null;
  email?: string | null;
  status: string;
  createdAt: string;
  opsRemarks?: string | null;
  referrer?: { name?: string | null } | null;
  onboardingStatus?: { stage?: string | null } | null;
}

interface RejectedStudentApplication {
  id: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  status: string;
  departmentRemarks?: string | null;
  createdAt: string;
  program?: { name?: string | null; code?: string | null } | null;
  studyCenter?: { name?: string | null; code?: string | null } | null;
}

interface PendingCenterVerificationPanelProps {
  mode: 'sales' | 'university' | 'org';
}

export function PendingCenterVerificationPanel({ mode }: PendingCenterVerificationPanelProps) {
  const [centers, setCenters] = useState<StudyCenter[]>([]);
  const [studentApplications, setStudentApplications] = useState<RejectedStudentApplication[]>([]);
  const [universityFilter, setUniversityFilter] = useState<'all' | 'students' | 'centres'>('all');
  const [loading, setLoading] = useState(true);
  const [resubmitCenter, setResubmitCenter] = useState<StudyCenter | null>(null);
  const [resubmitting, setResubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    email: '',
    contact: '',
    address: '',
    city: '',
    state: '',
    coordinatorName: '',
    remarks: '',
  });

  const fetchCenters = useCallback(async () => {
    setLoading(true);
    try {
      const params = mode === 'sales'
        ? { mode: 'sales', status: 'ops_rejected' }
        : { status: mode === 'org' ? 'all_pending' : 'pending_verification' };
      const [centersResponse, studentsResponse] = await Promise.all([
        api.get('/operations/centers', { params }),
        mode === 'sales'
          ? api.get('/sales/student-applications', { params: { status: 'ops_rejected' } })
          : Promise.resolve({ data: { data: [] } }),
      ]);
      setCenters(centersResponse.data.data || []);
      setStudentApplications(studentsResponse.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load study centres');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchCenters();
  }, [fetchCenters]);

  const openResubmit = (center: StudyCenter) => {
    setForm({
      name: center.name || '',
      code: center.code || '',
      email: center.email || '',
      contact: center.contact || '',
      address: center.address || '',
      city: center.city || '',
      state: center.state || '',
      coordinatorName: center.coordinatorName || '',
      remarks: '',
    });
    setResubmitCenter(center);
  };

  const handleResubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resubmitCenter) return;

    setResubmitting(true);
    try {
      await api.put(`/sales/my-centers/${resubmitCenter.id}/resubmit`, form);
      toast.success('Study centre resubmitted to Operations');
      setResubmitCenter(null);
      await fetchCenters();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to resubmit study centre');
    } finally {
      setResubmitting(false);
    }
  };

  const isOpsRejected = (center: StudyCenter) => center.status === 'ops_rejected';
  const centerStatusLabel = (status: string) => {
    if (status === 'ops_resubmitted') return 'Resubmitted to Operations';
    if (status === 'ops_rejected') return 'Rejected from Operations';
    if (['pending', 'pending_verification'].includes(status)) return 'Pending Verification';
    return status.replace(/_/g, ' ');
  };
  const centerPendingDepartment = (center: StudyCenter) => {
    if (center.onboardingStatus?.stage === 'finance'
      || ['pending_payment', 'finance_resubmitted'].includes(center.status)) return 'Finance Department';
    return 'Operations Department';
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Pending Verification</CardTitle>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {mode === 'org' && (
              <Button variant="outline" size="sm">
                <Bell className="mr-2 h-4 w-4" />
                Send Reminder All
              </Button>
            )}
            {mode !== 'sales' && (
              <div className="flex flex-wrap gap-2">
                {([
                  ['all', 'All'],
                  ['students', 'Pending Student'],
                  ['centres', 'Pending Centre'],
                ] as const).map(([filter, label]) => (
                  <Button
                    key={filter}
                    size="sm"
                    variant={universityFilter === filter ? 'default' : 'outline'}
                    onClick={() => setUniversityFilter(filter)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={fetchCenters} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {mode !== 'sales' && universityFilter !== 'centres' && (
            <section className="space-y-3">
              {universityFilter === 'all' && <h3 className="font-semibold">Pending Students</h3>}
              <UniversityEnrollmentReviewPanel organizationWide={mode === 'org'} />
            </section>
          )}
          {mode !== 'sales' && universityFilter === 'students' ? null : loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading study centres...</div>
          ) : (
            <>
              {centers.length === 0 && mode !== 'sales' && universityFilter !== 'students' && (
                <div className="py-10 text-center text-sm text-muted-foreground">No study centres require verification.</div>
              )}
              {mode !== 'sales' && universityFilter === 'all' && centers.length > 0 && (
                <h3 className="font-semibold">Pending Study Centres</h3>
              )}
              {mode === 'sales' && (
                <section className="space-y-3">
                  <h3 className="font-semibold">Study Centres Rejected by Operations</h3>
                  {centers.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No Operations-rejected study centres.</p>
                  ) : null}
                </section>
              )}
              {centers.map(center => {
            const rejected = isOpsRejected(center);
            return (
              <div
                key={center.id}
                className={`rounded-lg border border-l-2 p-4 ${rejected ? 'border-l-destructive bg-destructive/[0.02]' : 'border-l-primary'}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{center.name}</h3>
                      <Badge
                        variant="outline"
                        className={rejected
                          ? 'border-red-400/40 bg-red-500/10 text-red-600'
                          : center.status === 'ops_resubmitted'
                            ? 'border-blue-400/40 bg-blue-500/10 text-blue-600'
                            : 'border-amber-400/40 bg-amber-500/10 text-amber-700'}
                      >
                        {mode === 'org'
                          ? `Pending for ${centerPendingDepartment(center)} approval`
                          : centerStatusLabel(center.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Code: {center.code} · {center.email || 'No email'}
                    </p>
                    {center.referrer?.name && (
                      <p className="text-sm text-muted-foreground">
                        Agent: <span className="font-medium text-foreground">{center.referrer.name}</span>
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {[center.city, center.state].filter(Boolean).join(' ')}
                    </p>
                    {rejected && center.opsRemarks && (
                      <div className="mt-2 flex items-start gap-2 rounded-md border border-red-300/60 bg-red-100/60 p-2 text-sm dark:bg-red-950/30">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                        <p><span className="font-medium text-red-600">Operations Feedback:</span> {center.opsRemarks}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {mode === 'org' && (
                      <Button variant="outline" size="sm">
                        <Bell className="mr-2 h-4 w-4" />
                        Send Reminder
                      </Button>
                    )}
                    {rejected && (
                      <Button
                        size="sm"
                        className="bg-amber-600 text-white hover:bg-amber-700"
                        onClick={() => openResubmit(center)}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Resubmit Center
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
              })}
              {mode === 'sales' && (
                <section className="space-y-3">
                  <h3 className="font-semibold">Students Rejected by Operations</h3>
                  {studentApplications.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No Operations-rejected student applications.</p>
                  ) : studentApplications.map(application => (
                    <div key={application.id} className="rounded-lg border border-l-2 border-l-destructive bg-destructive/[0.02] p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold">{application.studentName}</h4>
                            <Badge variant="outline" className="border-red-400/40 bg-red-500/10 text-red-600">
                              Rejected by Operations
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {application.studentEmail} · {application.studentPhone}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {application.program?.name || 'Program not specified'}
                            {application.studyCenter?.name ? ` · ${application.studyCenter.name}` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm text-muted-foreground">
                          {new Date(application.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {application.departmentRemarks && (
                        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-300/60 bg-red-100/60 p-2 text-sm dark:bg-red-950/30">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                          <p><span className="font-medium text-red-600">Operations Feedback:</span> {application.departmentRemarks}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {mode === 'sales' && (
        <Dialog open={!!resubmitCenter} onOpenChange={open => !open && setResubmitCenter(null)}>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Resubmit Centre to Operations</DialogTitle>
              <DialogDescription>Correct the centre details and resubmit them for verification.</DialogDescription>
            </DialogHeader>
            {resubmitCenter?.opsRemarks && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p><span className="font-medium">Operations Feedback:</span> {resubmitCenter.opsRemarks}</p>
              </div>
            )}
            <form id="resubmit-centre-form" onSubmit={handleResubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {([
                  ['name', 'Centre Name'],
                  ['code', 'Centre Code'],
                  ['email', 'Email Address'],
                  ['contact', 'Contact Phone'],
                  ['city', 'City'],
                  ['state', 'State'],
                  ['address', 'Address'],
                  ['coordinatorName', 'Coordinator Name'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={`resubmit-${key}`}>{label}</Label>
                    <Input
                      id={`resubmit-${key}`}
                      type={key === 'email' ? 'email' : 'text'}
                      required={['name', 'code', 'email', 'contact', 'address'].includes(key)}
                      value={form[key]}
                      onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))}
                    />
                  </div>
                ))}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="resubmit-remarks">Remarks</Label>
                  <Textarea
                    id="resubmit-remarks"
                    value={form.remarks}
                    onChange={event => setForm(current => ({ ...current, remarks: event.target.value }))}
                    placeholder="Describe the corrections made"
                  />
                </div>
              </div>
            </form>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResubmitCenter(null)} disabled={resubmitting}>
                Cancel
              </Button>
              <Button type="submit" form="resubmit-centre-form" disabled={resubmitting}>
                {resubmitting ? 'Resubmitting...' : 'Resubmit Center'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
