import { useState, useEffect } from 'react';
import { Building2, GraduationCap, RefreshCw, ChevronRight, ArrowLeft, BookOpen, Users, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const statusColor: Record<string, string> = {
  pending_verification: 'bg-yellow-500/10 text-yellow-600 border-yellow-400/30',
  ops_resubmitted: 'bg-blue-500/10 text-blue-600 border-blue-400/30',
  ops_rejected: 'bg-red-500/10 text-red-600 border-red-400/30',
  rejected: 'bg-red-500/10 text-red-600 border-red-400/30',
  ops_verified: 'bg-blue-500/10 text-blue-600 border-blue-400/30',
  pending_payment: 'bg-purple-500/10 text-purple-600 border-purple-400/30',
  finance_resubmitted: 'bg-blue-500/10 text-blue-600 border-blue-400/30',
  finance_rejected: 'bg-red-500/10 text-red-600 border-red-400/30',
  rejected_from_finance: 'bg-red-500/10 text-red-600 border-red-400/30',
  active: 'bg-green-500/10 text-green-600 border-green-400/30',
  suspended: 'bg-muted text-muted-foreground',
  inactive: 'bg-muted text-muted-foreground',
};


const enrollStatusColor: Record<string, string> = {
  payment_pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-400/30',
  document_review: 'bg-blue-500/10 text-blue-600 border-blue-400/30',
  finance_review: 'bg-orange-500/10 text-orange-600 border-orange-400/30',
  enrolled: 'bg-green-500/10 text-green-600 border-green-400/30',
  rejected: 'bg-red-500/10 text-red-600 border-red-400/30',
  department_rejected: 'bg-red-500/10 text-red-600 border-red-400/30',
};

function CenterDetailView({ centerId, onBack }: { centerId: string; onBack: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [team, setTeam] = useState<any[]>([]);
  const [reassigning, setReassigning] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitForm, setResubmitForm] = useState({
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

  useEffect(() => {
    api.get(`/sales/my-centers/${centerId}`)
      .then(r => setData(r.data.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));

    api.get('/sales/team-members')
      .then(r => setTeam(r.data.data || []))
      .catch(() => setTeam([]));
  }, [centerId]);

  const handleOpenResubmit = () => {
    if (!data?.center) return;
    const c = data.center;
    setResubmitForm({
      name: c.name || '',
      code: c.code || '',
      email: c.email || '',
      contact: c.contact || '',
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      coordinatorName: c.coordinatorName || '',
      remarks: '',
    });
    setResubmitOpen(true);
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResubmitting(true);
    try {
      await api.put(`/sales/my-centers/${centerId}/resubmit`, resubmitForm);
      toast.success('Study center successfully resubmitted to Operations!');
      setResubmitOpen(false);
      setLoading(true);
      const r = await api.get(`/sales/my-centers/${centerId}`);
      setData(r.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to resubmit center');
    } finally {
      setResubmitting(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedUserId) {
      toast.error('Please select a team member');
      return;
    }
    setReassigning(true);
    try {
      await api.put(`/sales/my-centers/${centerId}/reassign`, { newSalesUserId: selectedUserId });
      toast.success('Center reassigned successfully');
      setIsDialogOpen(false);
      // Reload details
      setLoading(true);
      const r = await api.get(`/sales/my-centers/${centerId}`);
      setData(r.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reassign center');
    } finally {
      setReassigning(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />Back
        </Button>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />Back
        </Button>
        <p className="text-muted-foreground text-center py-12">Failed to load center details.</p>
      </div>
    );
  }

  const { center, enrollments, byProgram, stats } = data;
  const isOpsRejected = center.status === 'ops_rejected'
    || center.status === 'rejected'
    || center.onboardingStatus?.code === 'ops_rejected'
    || (center.onboardingStatus?.state === 'rejected' && center.onboardingStatus?.stage === 'operations');

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold">{center.name}</h2>
              <span className="text-sm text-muted-foreground">({center.code})</span>
              <Badge variant="outline" className={cn('text-[10px] uppercase', statusColor[center.status] || '')}>
                {center.status?.replace(/_/g, ' ')}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {center.email}{center.city ? ` · ${center.city}` : ''}
            </p>
            {center.referrer && (
              <p className="text-xs text-muted-foreground mt-1">
                Assigned Sales Agent: <span className="font-semibold text-foreground">{center.referrer.name}</span> ({center.referrer.role?.replace(/_/g, ' ')})
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isOpsRejected && (
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleOpenResubmit}>
              <RefreshCw className="w-4 h-4 mr-2" /> Resubmit Center
            </Button>
          )}

          {team.length > 0 && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary/90 hover:bg-primary text-primary-foreground">
                  <Users className="w-4 h-4 mr-2" /> Reassign Center
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Reassign Study Center</DialogTitle>
                  <DialogDescription>
                    Assign this study center to a different sales representative on your team.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Team Member</label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a sales representative..." />
                      </SelectTrigger>
                      <SelectContent>
                        {team.map((t: any) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({t.role?.replace(/_/g, ' ')})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={reassigning}>
                    Cancel
                  </Button>
                  <Button onClick={handleReassign} disabled={reassigning || !selectedUserId}>
                    {reassigning ? 'Reassigning...' : 'Confirm Reassign'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Prominent Operations Rejection Callout */}
      {isOpsRejected && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-destructive text-sm">Study Center Rejected by Operations</h4>
              <p className="text-sm text-foreground/90 mt-0.5">
                {center.opsRemarks ? (
                  <><strong>Operations Rejection Reason:</strong> {center.opsRemarks}</>
                ) : (
                  'Operations requested corrections before verifying this center.'
                )}
              </p>
            </div>
          </div>
          <Button
            className="bg-amber-600 hover:bg-amber-700 text-white font-medium shrink-0 shadow-sm"
            onClick={handleOpenResubmit}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Resubmit Center
          </Button>
        </div>
      )}

      {/* Resubmit Center Dialog */}
      <Dialog open={resubmitOpen} onOpenChange={setResubmitOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-amber-600" />
              Resubmit Study Center to Operations
            </DialogTitle>
            <DialogDescription>
              Correct center information and submit it back to Operations for verification.
            </DialogDescription>
          </DialogHeader>

          {center.opsRemarks && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
              <div>
                <span className="font-semibold text-destructive">Operations Feedback:</span>
                <p className="mt-0.5 text-foreground/90 leading-relaxed">{center.opsRemarks}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleResubmit} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sc-name">Center Name *</Label>
                <Input
                  id="sc-name"
                  required
                  value={resubmitForm.name}
                  onChange={e => setResubmitForm({ ...resubmitForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sc-code">Center Code *</Label>
                <Input
                  id="sc-code"
                  required
                  value={resubmitForm.code}
                  onChange={e => setResubmitForm({ ...resubmitForm, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sc-email">Email Address *</Label>
                <Input
                  id="sc-email"
                  type="email"
                  required
                  value={resubmitForm.email}
                  onChange={e => setResubmitForm({ ...resubmitForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sc-contact">Contact Phone *</Label>
                <Input
                  id="sc-contact"
                  required
                  value={resubmitForm.contact}
                  onChange={e => setResubmitForm({ ...resubmitForm, contact: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sc-coordinator">Coordinator Name</Label>
                <Input
                  id="sc-coordinator"
                  value={resubmitForm.coordinatorName}
                  onChange={e => setResubmitForm({ ...resubmitForm, coordinatorName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sc-city">City</Label>
                <Input
                  id="sc-city"
                  value={resubmitForm.city}
                  onChange={e => setResubmitForm({ ...resubmitForm, city: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sc-address">Address</Label>
                <Input
                  id="sc-address"
                  value={resubmitForm.address}
                  onChange={e => setResubmitForm({ ...resubmitForm, address: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sc-remarks">Correction Notes / Remarks</Label>
                <Input
                  id="sc-remarks"
                  placeholder="Details of updates made for Operations..."
                  value={resubmitForm.remarks}
                  onChange={e => setResubmitForm({ ...resubmitForm, remarks: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="pt-2 border-t gap-2">
              <Button type="button" variant="outline" onClick={() => setResubmitOpen(false)} disabled={resubmitting}>
                Cancel
              </Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={resubmitting}>
                {resubmitting ? 'Resubmitting...' : 'Confirm & Resubmit to Operations'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Students', value: stats.totalStudents, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Enrolled', value: stats.enrolled, color: 'text-green-600', bg: 'bg-green-500/10' },
          { label: 'Pending', value: stats.pending, color: 'text-yellow-600', bg: 'bg-yellow-500/10' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-600', bg: 'bg-red-500/10' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', s.bg)}>
                <Users className={cn('w-4 h-4', s.color)} />
              </div>
              <div>
                <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="programs">Programs ({byProgram.length})</TabsTrigger>
          <TabsTrigger value="students">All Students ({enrollments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Associated Universities
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!center.associatedUniversityIds?.length ? (
                <p className="text-sm text-muted-foreground">No universities assigned yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {center.associatedUniversityIds.map((u: any) => (
                    <Badge key={u.id} variant="secondary" className="text-xs">
                      {u.name}{u.code ? ` (${u.code})` : ''}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Allowed Programs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!center.allowedProgramIds?.length ? (
                <p className="text-sm text-muted-foreground">No programs assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {center.allowedProgramIds.map((p: any) => {
                    const group = byProgram.find((b: any) => b.program?.id?.toString() === p.id?.toString());
                    return (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {p.code}{p.duration ? ` · ${p.duration}` : ''}{p.level ? ` · ${p.level}` : ''}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {group?.students?.length || 0} students
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="programs" className="mt-4 space-y-4">
          {byProgram.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p>No enrollments yet</p>
              </CardContent>
            </Card>
          ) : byProgram.map((group: any) => (
            <Card key={group.program?.id || 'unknown'}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{group.program?.name || 'Unknown Program'}</CardTitle>
                  <Badge variant="secondary">{group.students.length} students</Badge>
                </div>
                {group.program?.code && (
                  <CardDescription className="text-[10px]">
                    {group.program.code}{group.program.level ? ` · ${group.program.level}` : ''}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {group.students.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">{s.studentName}</p>
                      <p className="text-[10px] text-muted-foreground">{s.studentEmail} · {s.enrollmentNumber}</p>
                    </div>
                    <Badge variant="outline" className={cn('text-[10px] uppercase', enrollStatusColor[s.status] || '')}>
                      {s.status?.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {enrollments.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p>No students enrolled yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {enrollments.map((e: any) => (
                    <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {(e.studentName || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{e.studentName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {e.studentEmail} · {e.programId?.name || 'Program'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{e.enrollmentNumber}</p>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <Badge variant="outline" className={cn('text-[10px] uppercase', enrollStatusColor[e.status] || '')}>
                          {e.status?.replace(/_/g, ' ')}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(e.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function SalesCentersPanel() {
  const [centers, setCenters] = useState<any[]>([]);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('centers');
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [centersRes, admissionsRes] = await Promise.all([
        api.get('/sales/my-centers'),
        api.get('/sales/my-centers/admissions'),
      ]);
      setCenters(centersRes.data.data || []);
      setAdmissions(admissionsRes.data.data || []);
    } catch {
      setCenters([]);
      setAdmissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  if (selectedCenterId) {
    return <CenterDetailView centerId={selectedCenterId} onBack={() => setSelectedCenterId(null)} />;
  }

  const activeCount = centers.filter(c => c.status === 'active').length;
  const pendingCount = centers.filter(c => c.status === 'pending_verification').length;
  const enrolledCount = admissions.filter(a => a.status === 'enrolled').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Study Centers</h2>
          <p className="text-sm text-muted-foreground">Centers onboarded via your invite links and your team's links</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary"><Building2 className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">Total Centers</p>
              <p className="text-2xl font-bold">{loading ? '...' : centers.length}</p>
              <p className="text-[10px] text-muted-foreground">{activeCount} active · {pendingCount} pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-500/10 text-green-600"><GraduationCap className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">Total Admissions</p>
              <p className="text-2xl font-bold">{loading ? '...' : admissions.length}</p>
              <p className="text-[10px] text-muted-foreground">{enrolledCount} enrolled</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-yellow-500/10 text-yellow-600"><ChevronRight className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">Pending Review</p>
              <p className="text-2xl font-bold">
                {loading ? '...' : admissions.filter(a => ['payment_pending', 'document_review', 'finance_review'].includes(a.status)).length}
              </p>
              <p className="text-[10px] text-muted-foreground">awaiting processing</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="centers">Study Centers ({centers.length})</TabsTrigger>
          <TabsTrigger value="admissions">Admissions ({admissions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="centers" className="mt-4">
          <Card className="border-none shadow-xl bg-card/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Onboarded Centers</CardTitle>
              <CardDescription>Study centers registered through your invite links or your team's links</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
                </div>
              ) : centers.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Building2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No centers yet</p>
                  <p className="text-sm mt-1">Share invite links to onboard study centers.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {centers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCenterId(c.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border bg-muted/20 hover:bg-muted/50 hover:border-primary/30 transition-all text-left group"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {c.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{c.name}</p>
                          <span className="text-xs text-muted-foreground">({c.code})</span>
                          {(c.status === 'ops_rejected' || c.status === 'rejected') && (
                            <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40 bg-destructive/10">
                              Ops Rejected
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {c.email}{c.city ? ` · ${c.city}` : ''}
                        </p>
                        {c.opsRemarks && (c.status === 'ops_rejected' || c.status === 'rejected') && (
                          <p className="text-[10px] text-destructive truncate mt-0.5">
                            Rejection: {c.opsRemarks}
                          </p>
                        )}
                        {c.associatedUniversityIds?.length > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {c.associatedUniversityIds.map((u: any) => u.name || u).join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right space-y-1">
                        <Badge variant="outline" className={cn('text-[10px] uppercase', statusColor[c.status] || '')}>
                          {c.status?.replace(/_/g, ' ')}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admissions" className="mt-4">
          <Card className="border-none shadow-xl bg-card/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Admissions</CardTitle>
              <CardDescription>Student enrollments from your onboarded centers</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}
                </div>
              ) : admissions.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No admissions yet</p>
                  <p className="text-sm mt-1">Admissions from your centers will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {admissions.map(a => (
                    <div key={a.id} className="flex items-center gap-4 p-4 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 font-bold text-sm shrink-0">
                        {(a.studentName || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{a.studentName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {a.programId?.name || 'Program'} · {a.studyCenterId?.name || 'Center'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{a.enrollmentNumber}</p>
                      </div>
                      <div className="shrink-0 text-right space-y-1">
                        <Badge variant="outline" className={cn('text-[10px] uppercase', enrollStatusColor[a.status] || '')}>
                          {a.status?.replace(/_/g, ' ')}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(a.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
