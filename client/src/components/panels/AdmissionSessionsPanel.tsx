import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Calendar, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function AdmissionSessionsPanel({ financeMode = false }: { financeMode?: boolean }) {
  const { user } = useAuth();
  const canWrite = ['org_admin', 'superadmin'].includes(user?.role || '');
  const [sessions, setSessions] = useState<any[]>([]);
  const [universities, setUniversities] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [universityFilter, setUniversityFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    subDepartmentId: '',
    startDate: '',
    endDate: '',
    examDate: '',
    reregPaymentClosingDate: '',
    status: 'pending'
  });

  useEffect(() => {
    fetchSessions();
    fetchDepartments();
    fetchUniversities();
  }, [universityFilter, financeMode]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (financeMode) {
        params.set('includeDetails', 'true');
      }
      if (universityFilter && universityFilter !== 'all') params.set('universityId', universityFilter);
      const query = params.toString();
      const q = query ? `?${query}` : '';
      const res = await api.get(`/operations/sessions${q}`);
      setSessions(res.data.data || []);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      // Filter to operations-type departments only, as AdmissionSession.subDepartmentId refs Department
      const all = res.data.data || [];
      setDepartments(all.filter((d: any) => d.type === 'operations'));
    } catch (err) {
    }
  };

  const fetchUniversities = async () => {
    try {
      const res = await api.get('/operations/universities');
      setUniversities(res.data.data || []);
    } catch (err) {
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: formData.name,
        subDepartmentId: formData.subDepartmentId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status
      };
      if (formData.examDate) payload.examDate = formData.examDate;
      if (formData.reregPaymentClosingDate) payload.reregPaymentClosingDate = formData.reregPaymentClosingDate;

      if (editingId) {
        await api.put(`/operations/sessions/${editingId}`, payload);
      } else {
        await api.post('/operations/sessions', payload);
      }
      setDialogOpen(false);
      resetForm();
      fetchSessions();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save session');
    }
  };

  const handleEdit = (s: any) => {
    const subDeptId = typeof s.subDepartmentId === 'object'
      ? (s.subDepartmentId?.id || s.subDepartmentId?.id)
      : s.subDepartmentId;
    setEditingId(s.id || s.id);
    setFormData({
      name: s.name || '',
      subDepartmentId: subDeptId?.toString() || '',
      startDate: s.startDate ? new Date(s.startDate).toISOString().split('T')[0] : '',
      endDate: s.endDate ? new Date(s.endDate).toISOString().split('T')[0] : '',
      examDate: s.examDate ? new Date(s.examDate).toISOString().split('T')[0] : '',
      reregPaymentClosingDate: s.reregPaymentClosingDate ? new Date(s.reregPaymentClosingDate).toISOString().split('T')[0] : '',
      status: s.status || 'pending'
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this session?')) return;
    try {
      await api.delete(`/operations/sessions/${id}`);
      fetchSessions();
    } catch (err) {
    }
  };

  const handleDuplicate = async (id: string) => {
    if (!confirm('Duplicate this session?')) return;
    try {
      await api.post(`/operations/sessions/${id}/duplicate`);
      fetchSessions();
      toast.success('Session duplicated successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to duplicate session');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: '', subDepartmentId: '', startDate: '', endDate: '', examDate: '', reregPaymentClosingDate: '', status: 'pending' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{financeMode ? 'Admission Sessions' : 'Admission Session Management'}</h2>
          <p className="text-muted-foreground">
            {financeMode ? 'View active admission sessions and their related details' : 'Manage admission sessions and cycles'}
          </p>
        </div>
        {canWrite && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Add Session</Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Session' : 'Add New Session'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Session Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div>
                <Label>Department</Label>
                <Select value={formData.subDepartmentId} onValueChange={(v) => setFormData({ ...formData, subDepartmentId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {departments.filter((d: any) => d && (d.id || d.id)).map((d: any) => (
                      <SelectItem key={d.id || d.id} value={(d.id || d.id).toString()}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} required />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} required />
                </div>
              </div>
              <div>
                <Label>Exam Date (optional)</Label>
                <Input type="date" value={formData.examDate} onChange={(e) => setFormData({ ...formData, examDate: e.target.value })} />
              </div>
              <div>
                <Label>Re-registration Payment Closing Date (optional)</Label>
                <Input type="date" value={formData.reregPaymentClosingDate} onChange={(e) => setFormData({ ...formData, reregPaymentClosingDate: e.target.value })} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Save</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="flex justify-end mb-4">
        <Select value={universityFilter} onValueChange={setUniversityFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Universities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Universities</SelectItem>
            {universities.map(u => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle>Admission Sessions</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No sessions found</div>
          ) : (
            <div className="space-y-2">
              {sessions.filter(s => s && s.id).map((s) => {
                const sid = s.id;
                const isExpanded = expandedSessionId === sid;
                const primaryProgram = s.program;
                const academicPrograms = s.academicPrograms || [];
                const semesters = s.semesters || [];
                const allocations = s.programAllocations || [];
                const feeStructures = s.programFeeStructures || [];
                const counts = s._count || {};
                return (
                  <div key={sid} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50">
                      <button
                        type="button"
                        className="flex items-center gap-3 min-w-0 text-left"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedSessionId(isExpanded ? null : sid)}
                      >
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                          : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                        <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Calendar className="w-5 h-5 text-primary" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium truncate">{s.name}</span>
                          <span className="block text-sm text-muted-foreground">
                            {s.startDate && new Date(s.startDate).toLocaleDateString()} – {s.endDate && new Date(s.endDate).toLocaleDateString()}
                          </span>
                        </span>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={s.status === 'active' ? 'bg-green-600 text-white hover:bg-green-600' : ''}>
                          {s.status}
                        </Badge>
                        {canWrite && (
                          <>
                            <Button title="Duplicate" variant="ghost" size="sm" onClick={() => handleDuplicate(sid)}><Copy className="w-4 h-4" /></Button>
                            <Button title="Edit" variant="ghost" size="sm" onClick={() => handleEdit(s)}><Edit className="w-4 h-4" /></Button>
                            <Button title="Delete" variant="ghost" size="sm" onClick={() => handleDelete(sid)}><Trash2 className="w-4 h-4" /></Button>
                          </>
                        )}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t bg-muted/20 p-4 space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {[
                            ['Session ID', s.id],
                            ['Status', s.status],
                            ['Capacity', s.capacity ?? 'Not set'],
                            ['Start Date', s.startDate ? new Date(s.startDate).toLocaleDateString() : 'Not set'],
                            ['End Date', s.endDate ? new Date(s.endDate).toLocaleDateString() : 'Not set'],
                            ['Re-registration Payment Closing Date', s.reregPaymentClosingDate ? new Date(s.reregPaymentClosingDate).toLocaleDateString() : 'Not set'],
                            ['University', s.university ? `${s.university.name} (${s.university.code})` : 'Not assigned'],
                            ['Primary Program', primaryProgram ? `${primaryProgram.name} (${primaryProgram.code})` : 'Not assigned'],
                            ['Study Centre', s.studyCenter ? `${s.studyCenter.name} (${s.studyCenter.code})` : 'Not assigned'],
                            ['Department', s.subDepartment?.name || 'Not assigned'],
                            ['Created', s.createdAt ? new Date(s.createdAt).toLocaleString() : 'Not available'],
                            ['Last Updated', s.updatedAt ? new Date(s.updatedAt).toLocaleString() : 'Not available'],
                            ['Created By', s.creator?.name || 'Not available'],
                            ['Approved By', s.approver?.name || 'Not approved'],
                            ['Approved At', s.approvedAt ? new Date(s.approvedAt).toLocaleString() : 'Not approved'],
                          ].map(([label, value]) => (
                            <div key={label} className="min-w-0">
                              <p className="text-xs text-muted-foreground">{label}</p>
                              <p className="text-sm font-medium break-words">{value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                          {[
                            ['Programs', counts.academicPrograms ?? academicPrograms.length],
                            ['Semesters', counts.semesters ?? semesters.length],
                            ['Enrollments', counts.enrollments ?? 0],
                            ['Program Allocations', counts.programAllocations ?? allocations.length],
                            ['Fee Configurations', counts.programFeeStructures ?? feeStructures.length],
                            ['Modules', counts.modules ?? 0],
                            ['Examinations', counts.examinations ?? 0],
                            ['Scheduled Classes', counts.scheduledClasses ?? 0],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-md border bg-background p-2">
                              <p className="text-xs text-muted-foreground">{label}</p>
                              <p className="text-base font-semibold">{value}</p>
                            </div>
                          ))}
                        </div>
                        {academicPrograms.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">Programs in this Session</h4>
                            <div className="flex flex-wrap gap-2">
                              {academicPrograms.map((program: any) => (
                                <Badge key={program.id} variant="outline">{program.name} ({program.code}) · {program.status}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {semesters.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">Semester Records</h4>
                            <div className="space-y-2">
                              {semesters.map((semester: any) => (
                                <div key={semester.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-3">
                                  <span className="text-sm font-medium">
                                    {semester.program?.name || 'Program'} · {semester.semesterName}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(semester.startDate).toLocaleDateString()} – {new Date(semester.endDate).toLocaleDateString()} · {semester.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {allocations.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">Study Centre Program Allocations</h4>
                            <div className="space-y-2">
                              {allocations.map((allocation: any) => (
                                <div key={allocation.id} className="rounded-md border bg-background p-3 text-sm">
                                  {allocation.center?.name || 'Study Centre'} ({allocation.center?.code || '—'})
                                  {' · '}{allocation.program?.name || 'Program'} ({allocation.program?.code || '—'})
                                  {' · '}{allocation.isActive ? 'Active' : 'Inactive'}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {feeStructures.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-2">Fee Configurations</h4>
                            <div className="space-y-2">
                              {feeStructures.map((fee: any) => (
                                <div key={fee.id} className="rounded-md border bg-background p-3 text-sm">
                                  {fee.level} · {fee.program?.name || 'All Programs'}
                                  {' · '}{fee.studyCenter?.name || fee.university?.name || 'Organization-wide'}
                                  {' · '}{fee.billingCycle} · {fee.currency} {Number(fee.baseFee || 0).toLocaleString()}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
