import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Mail, Phone, GraduationCap, MapPin, Calendar, FileText, CreditCard, Check, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function StudentsPanel() {
  const { user } = useAuth();
  const canWrite = ['org_admin', 'superadmin', 'center_admin'].includes(user?.role || '');
  const canDelete = ['org_admin', 'superadmin'].includes(user?.role || '');
  const [students, setStudents] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [universities, setUniversities] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    enrollmentNo: '',
    programId: '',
    centerId: '',
    status: 'pending'
  });
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  // Installments state
  const [installments, setInstallments] = useState<any[]>([]);
  const [fetchingInstallments, setFetchingInstallments] = useState(false);
  const [payingInstallment, setPayingInstallment] = useState(false);

  // Status Change Request state
  const [requestStatusOpen, setRequestStatusOpen] = useState(false);
  const [requestedStatus, setRequestedStatus] = useState<'hold' | 'dropout'>('hold');
  const [statusReason, setStatusReason] = useState('');
  const [submittingStatusReq, setSubmittingStatusReq] = useState(false);

  const handleRequestStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setSubmittingStatusReq(true);
    try {
      await api.post(`/students/${selectedStudent.id}/status-request`, {
        requestedStatus,
        reason: statusReason
      });
      toast.success(`Request to ${requestedStatus} student submitted successfully!`);
      setRequestStatusOpen(false);
      setStatusReason('');
      setSelectedStudent(null);
      fetchStudents();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit status request');
    } finally {
      setSubmittingStatusReq(false);
    }
  };

  const [statusFilter, setStatusFilter] = useState('');
  const [universityFilter, setUniversityFilter] = useState('');
  const [centerFilter, setCenterFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') query.append('status', statusFilter);
      if (universityFilter && universityFilter !== 'all') query.append('universityId', universityFilter);
      if (centerFilter && centerFilter !== 'all') query.append('centerId', centerFilter);
      if (programFilter && programFilter !== 'all') query.append('programId', programFilter);
      if (sessionFilter && sessionFilter !== 'all') query.append('sessionId', sessionFilter);
      if (searchQuery) query.append('search', searchQuery);
      
      const response = await api.get(`/students?${query.toString()}`);
      setStudents(response.data.data || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [statusFilter, universityFilter, centerFilter, programFilter, sessionFilter, searchQuery]);

  const fetchPrograms = useCallback(async () => {
    try {
      const response = await api.get('/operations/programs');
      setPrograms(response.data.data || []);
    } catch (error) {
    }
  }, []);

  const fetchCenters = useCallback(async () => {
    try {
      const response = await api.get('/operations/centers');
      setCenters(response.data.data || []);
    } catch (error) {
    }
  }, []);

  const fetchUniversities = useCallback(async () => {
    try {
      const response = await api.get('/operations/universities');
      setUniversities(response.data.data || []);
    } catch (error) {
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await api.get('/operations/admission-sessions');
      setSessions(response.data.data || []);
    } catch (error) {
    }
  }, []);

  useEffect(() => {
    fetchStudents();
    fetchPrograms();
    fetchCenters();
    fetchUniversities();
    fetchSessions();
  }, [fetchStudents, fetchPrograms, fetchCenters, fetchUniversities, fetchSessions]);

  const fetchInstallments = async (studentId: string) => {
    setFetchingInstallments(true);
    try {
      const res = await api.get(`/students/${studentId}/installments`);
      setInstallments(res.data.installments || []);
    } catch (err) {
    } finally {
      setFetchingInstallments(false);
    }
  };

  useEffect(() => {
    if (selectedStudent) {
      fetchInstallments(selectedStudent.id);
    } else {
      setInstallments([]);
    }
  }, [selectedStudent]);

  const handlePayInstallment = async (installmentName: string, amount: number) => {
    if (!selectedStudent) return;
    
    const uniCategory = selectedStudent.program?.university?.category;
    const isNoWallet = uniCategory === 'direct_iits' || uniCategory === 'team_lease';
    
    const message = isNoWallet 
      ? `Are you sure you want to mark ₹${amount.toLocaleString()} for ${installmentName} as paid directly to the university?`
      : `Are you sure you want to pay ₹${amount.toLocaleString()} for ${installmentName} using your study center wallet?`;
      
    if (!confirm(message)) return;

    setPayingInstallment(true);
    try {
      await api.post(`/students/${selectedStudent.id}/pay-installment`, { installmentName, amount });
      toast.success(`${installmentName} paid successfully!`);
      fetchInstallments(selectedStudent.id);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to pay installment');
    } finally {
      setPayingInstallment(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        centerId: formData.centerId === 'direct' || !formData.centerId ? null : formData.centerId
      };
      if (editingId) {
        await api.put(`/students/${editingId}`, payload);
      } else {
        await api.post('/students', payload);
      }
      setDialogOpen(false);
      resetForm();
      fetchStudents();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save student');
    }
  };

  const handleEdit = (student: any) => {
    const studentId = student.id || student.id;
    const programId = typeof student.programId === 'object'
      ? (student.programId?.id || student.programId?.id)
      : student.programId;
    const centerId = typeof student.centerId === 'object'
      ? (student.centerId?.id || student.centerId?.id)
      : student.centerId;
    setEditingId(studentId);
    setFormData({
      name: student.name || '',
      email: student.email || '',
      phone: student.phone || '',
      address: student.address || '',
      enrollmentNo: student.enrollmentNo || '',
      programId: programId?.toString() || '',
      centerId: centerId?.toString() || '',
      status: student.status || 'active'
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    try {
      await api.delete(`/students/${id}`);
      fetchStudents();
    } catch (error) {
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      enrollmentNo: '',
      programId: '',
      centerId: '',
      status: 'pending'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Student Management</h2>
          <p className="text-muted-foreground">Manage student records and enrollments</p>
        </div>
        {canWrite && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Add Student</Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Student' : 'Add New Student'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required />
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} required />
              </div>
              <div>
                <Label>Admission Number</Label>
                <Input value={formData.enrollmentNo} onChange={(e) => setFormData({...formData, enrollmentNo: e.target.value})} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Program</Label>
                  <Select value={formData.programId} onValueChange={(value) => setFormData({...formData, programId: value})}>
                    <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
                    <SelectContent>
                      {programs.filter(p => p && (p.id || p.id)).map((prog) => (
                        <SelectItem key={prog.id || prog.id} value={(prog.id || prog.id).toString()}>
                          {prog.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Study Center</Label>
                  <Select value={formData.centerId} onValueChange={(value) => setFormData({...formData, centerId: value})}>
                    <SelectTrigger><SelectValue placeholder="Select center (Optional for Direct)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Direct University Admission (No Center)</SelectItem>
                      {centers.filter(c => c && (c.id || c.id)).map((center) => (
                        <SelectItem key={center.id || center.id} value={(center.id || center.id).toString()}>
                          {center.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
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

      <div className="flex gap-2 flex-wrap mb-4">
        {[
          { key: '', label: 'All' },
          { key: 'active', label: 'Active' },
          { key: 'hold', label: 'Hold' },
          { key: 'dropout', label: 'Dropout' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
              statusFilter === tab.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted text-muted-foreground border-border hover:border-primary/40'
            )}
          >
            {tab.label}
          </button>
        ))}

        <div className="ml-auto flex gap-2">
          <Select value={sessionFilter} onValueChange={setSessionFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Sessions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sessions</SelectItem>
              {sessions.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={universityFilter} onValueChange={setUniversityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Universities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Universities</SelectItem>
              {universities.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={programFilter} onValueChange={setProgramFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Programs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Programs</SelectItem>
              {programs.filter(p => p && (p.id || p.id)).map((prog) => (
                <SelectItem key={prog.id || prog.id} value={(prog.id || prog.id).toString()}>
                  {prog.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {user?.role !== 'center_admin' && (
            <Select value={centerFilter} onValueChange={setCenterFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Centers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Centers</SelectItem>
                {centers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Input 
          placeholder="Search by name, email, or admission no..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Student Directory</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : students.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No students found</div>
          ) : (
            <div className="space-y-2">
              {students.filter(s => s && (s.id || s.id)).map((student) => {
                const studentId = student.id || student.id;
                const centerName = typeof student.centerId === 'object' ? student.centerId?.name : '';
                const programName = typeof student.programId === 'object' ? student.programId?.name : '';
                return (
                  <div key={studentId} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => setSelectedStudent(student)}>
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <GraduationCap className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{student.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {student.uniEnrollmentNumber ? (
                            <span className="font-semibold text-primary">Uni ENR: {student.uniEnrollmentNumber}</span>
                          ) : (
                            <span>Admission No: {student.enrollmentNo}</span>
                          )}
                          {programName ? ` • ${programName}` : ''}{centerName ? ` • ${centerName}` : ''}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {student.email}</span>
                          {student.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {student.phone}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{student.status}</Badge>
                      {canWrite && (
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(student)}><Edit className="w-4 h-4" /></Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(studentId)}><Trash2 className="w-4 h-4" /></Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedStudent} onOpenChange={o => !o && setSelectedStudent(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedStudent && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between w-full pr-6">
                  <div className="flex items-center gap-2">
                    <DialogTitle>Student Details</DialogTitle>
                    <Badge className="bg-primary/10 text-primary text-[10px] uppercase font-bold">
                      {selectedStudent.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {['ops_admin', 'ops_sub_admin', 'employee', 'org_admin', 'superadmin'].includes(user?.role || '') && (
                      <Button size="sm" variant="outline" onClick={() => {
                        const uniEnr = prompt('Enter University Enrollment Number:', selectedStudent.uniEnrollmentNumber || '');
                        if (uniEnr !== null) {
                          api.put(`/students/${selectedStudent.id || selectedStudent.id}`, { uniEnrollmentNumber: uniEnr })
                            .then(() => {
                              toast.success('University Enrollment Number saved');
                              fetchStudents();
                              setSelectedStudent({ ...selectedStudent, uniEnrollmentNumber: uniEnr });
                            })
                            .catch(() => toast.error('Failed to update University Enrollment Number'));
                        }
                      }}>
                        Add Uni Enrollment No
                      </Button>
                    )}
                    {user?.role === 'center_admin' && !['hold', 'dropout'].includes(selectedStudent.status) && (
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => setRequestStatusOpen(true)}
                      >
                        Request Hold / Dropout
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Contact details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Email</p>
                      <p className="font-medium">{selectedStudent.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Phone</p>
                      <p className="font-medium">{selectedStudent.phone || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="col-span-2 flex items-start gap-2 pt-2 border-t">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Address</p>
                      <p className="font-medium">{selectedStudent.address || 'N/A'}</p>
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
                      <span className="text-xs text-muted-foreground block">Program</span>
                      <span className="font-semibold">{selectedStudent.program?.name || 'N/A'} ({selectedStudent.program?.code || ''})</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Study Center</span>
                      <span className="font-semibold">{selectedStudent.center?.name || 'N/A'} ({selectedStudent.center?.code || ''})</span>
                    </div>
                    {selectedStudent.specialisation && (
                      <div>
                        <span className="text-xs text-muted-foreground block">Specialisation Combo</span>
                        <span className="font-semibold text-indigo-600">{selectedStudent.specialisation}</span>
                      </div>
                    )}
                    <div className="pt-1 border-t mt-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Joined on: {new Date(selectedStudent.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Future Payments & Installments */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-primary" /> Fees & Installments
                  </h4>
                  {fetchingInstallments ? (
                    <div className="text-xs text-muted-foreground animate-pulse py-2">Loading installment schedules...</div>
                  ) : installments.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic bg-muted/10 p-3 rounded-lg border">No installment structure found.</p>
                  ) : (
                    <div className="space-y-2">
                      {installments.map((inst, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-muted/5 p-3 rounded-lg border text-sm hover:bg-muted/10 transition-colors">
                          <div>
                            <span className="font-semibold text-foreground">{inst.name}</span>
                            <span className="text-xs text-muted-foreground block">
                              Due Date: {new Date(inst.dueDate).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-foreground">₹{inst.amount.toLocaleString()}</span>
                            {inst.status === 'paid' ? (
                              <Badge className="bg-success/15 text-success hover:bg-success/20 border-success/30 font-semibold text-xs flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Paid
                              </Badge>
                            ) : (
                              <div className="flex gap-2">
                                <Badge className="bg-warning/15 text-warning hover:bg-warning/20 border-warning/30 font-semibold text-xs flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" /> Pending
                                </Badge>
                                {user?.role === 'center_admin' && (!selectedStudent?.programId?.university?.category || selectedStudent?.programId?.university?.category === 'direct_iits') && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs font-semibold text-primary hover:bg-primary/10 border-primary/30"
                                    onClick={() => handlePayInstallment(inst.name, inst.amount)}
                                    disabled={payingInstallment}
                                  >
                                    Pay Advance
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Original Enrollment Info */}
                {selectedStudent.enrollments && selectedStudent.enrollments.length > 0 && (
                  <>
                    {/* Educational Details */}
                    <div className="border-t pt-4">
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-primary" /> Educational History
                      </h4>
                      {selectedStudent.enrollments[0].educationalDetails && selectedStudent.enrollments[0].educationalDetails.length > 0 ? (
                        <div className="space-y-2">
                          {selectedStudent.enrollments[0].educationalDetails.map((edu: any, idx: number) => (
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
                    <div className="border-t pt-4">
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-primary" /> Uploaded Documents
                      </h4>
                      {selectedStudent.enrollments[0].documents && selectedStudent.enrollments[0].documents.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedStudent.enrollments[0].documents.map((doc: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center bg-muted/10 p-2.5 rounded-lg border text-sm">
                              <div className="flex items-center gap-2 truncate pr-2">
                                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <span className="truncate font-medium">{doc.name}</span>
                              </div>
                              <a
                                href={doc.url.startsWith('/') ? doc.url : `/uploads/${doc.url}`}
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
                  </>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedStudent(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={requestStatusOpen} onOpenChange={setRequestStatusOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Status Change</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRequestStatusChange} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Requested Status</Label>
              <Select 
                value={requestedStatus} 
                onValueChange={(val: 'hold' | 'dropout') => setRequestedStatus(val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hold">Hold</SelectItem>
                  <SelectItem value="dropout">Dropout</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Reason / Remarks</Label>
              <textarea
                className="w-full min-h-[100px] border rounded-md p-2 text-sm bg-background"
                value={statusReason}
                onChange={e => setStatusReason(e.target.value)}
                placeholder="Please explain the reason for this request..."
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setRequestStatusOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingStatusReq} className="bg-destructive hover:bg-destructive/90 text-white">
                {submittingStatusReq ? 'Submitting...' : 'Submit Request'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
