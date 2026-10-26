import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, FileText, GraduationCap, Eye, Calendar, User, Phone, Mail, MapPin, ShieldAlert, Trash2, Plus, Upload, Printer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import { resolveFileUrl } from '@/lib/fileUrl';

interface Enrollment {
  id: string;
  enrollmentNumber?: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  studentAddress: string;
  programId: { id: string; name: string; code: string } | string;
  program?: { id: string; name: string; code: string; university?: { name: string } };
  session?: { id: string; name: string };
  specialisation?: string;
  status: string;
  createdAt: string;
  departmentRemarks?: string;
  financeRemarks?: string;
  documents?: { name: string; url: string }[] | null;
  educationalDetails?: { qualification: string; institution: string; passingYear: string; percentage?: string }[] | null;
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
  finance_rejected: 'bg-destructive/10 text-destructive',
};

const isRejectedStatus = (status: string) => ['rejected', 'department_rejected', 'finance_rejected'].includes(status);

export function StudyCenterEnrollmentsPanel() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);

  // Editing state
  const [editOpen, setEditOpen] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [editForm, setEditForm] = useState({
    id: '',
    studentName: '',
    studentEmail: '',
    studentPhone: '',
    studentAddress: '',
    programId: '',
    sessionId: '',
    specialisation: ''
  });
  const [editEducation, setEditEducation] = useState<any[]>([]);
  const [editDocuments, setEditDocuments] = useState<any[]>([]);
  const [tempEdu, setTempEdu] = useState({ qualification: '', institution: '', passingYear: '', percentage: '' });
  const [uploading, setUploading] = useState(false);

  // Payment state
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentType: 'wallet',
    emiDetails: '',
    paymentProof: ''
  });

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await api.get(`/enrollment/enrollments${params}`);
      setEnrollments(res.data.data || []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchEnrollments();
    // Fetch programs and sessions for editing dropdowns
    api.get('/enrollment/programs').then(r => setPrograms(r.data.data || [])).catch(() => {});
    api.get('/enrollment/sessions').then(r => setSessions(r.data.data || [])).catch(() => {});
  }, [fetchEnrollments]);

  const getProgramName = (e: Enrollment) => {
    if (e.program && e.program.name) {
      return `${e.program.name} (${e.program.code})`;
    }
    return typeof e.programId === 'object' ? `${e.programId.name} (${e.programId.code})` : e.programId;
  };

  const getUniversityName = (e: Enrollment) => {
    return e.program?.university?.name || '';
  };

  const handleStartEdit = (e: Enrollment) => {
    const progId = typeof e.programId === 'object' ? e.programId?.id : (e.program?.id || e.programId || '');
    const sessId = e.session?.id || '';

    setEditForm({
      id: e.id,
      studentName: e.studentName || '',
      studentEmail: e.studentEmail || '',
      studentPhone: e.studentPhone || '',
      studentAddress: e.studentAddress || '',
      programId: String(progId),
      sessionId: String(sessId),
      specialisation: e.specialisation || ''
    });
    setEditEducation(e.educationalDetails || []);
    setEditDocuments(e.documents || []);
    setSelectedEnrollment(null); // Close detail dialog
    setEditOpen(true);
  };

  const handleAddEducation = () => {
    if (!tempEdu.qualification.trim() || !tempEdu.institution.trim() || !tempEdu.passingYear.trim()) {
      toast.error('Please fill qualification, institution, and passing year');
      return;
    }
    setEditEducation(list => [...list, { ...tempEdu }]);
    setTempEdu({ qualification: '', institution: '', passingYear: '', percentage: '' });
  };

  const handleRemoveEducation = (index: number) => {
    setEditEducation(list => list.filter((_, idx) => idx !== index));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docName: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/enrollment/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setEditDocuments(list => [...list, { name: docName || file.name, url: res.data.url }]);
      toast.success(`${docName || file.name} uploaded successfully`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveDocument = (index: number) => {
    setEditDocuments(list => list.filter((_, idx) => idx !== index));
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollment) return;
    try {
      await api.post(`/enrollment/enroll/${selectedEnrollment.id}/pay`, paymentForm);
      alert('Payment stage processed successfully');
      setPaymentOpen(false);
      setSelectedEnrollment(null);
      fetchEnrollments();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to process payment');
    }
  };

  const handlePrintApp = (e: Enrollment) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Application Form - ${e.studentName}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            h1 { font-size: 24px; text-align: center; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
            th { background: #f9f9f9; width: 30%; font-weight: 600; }
            .section-title { font-size: 18px; margin-top: 30px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px; }
          </style>
        </head>
        <body>
          <h1>Student Application Form</h1>
          <div class="section-title">Personal Details</div>
          <table>
            <tr><th>Student Name</th><td>${e.studentName}</td></tr>
            <tr><th>Email</th><td>${e.studentEmail}</td></tr>
            <tr><th>Phone</th><td>${e.studentPhone}</td></tr>
            <tr><th>Address</th><td>${e.studentAddress}</td></tr>
          </table>
          <div class="section-title">Enrollment Details</div>
          <table>
            <tr><th>Program</th><td>${typeof e.program === 'object' ? e.program?.name : e.programId}</td></tr>
            <tr><th>Application Status</th><td>${e.status.replace(/_/g, ' ').toUpperCase()}</td></tr>
            <tr><th>Date Submitted</th><td>${new Date(e.createdAt).toLocaleDateString()}</td></tr>
          </table>
          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.studentName || !editForm.studentEmail || !editForm.studentPhone || !editForm.studentAddress || !editForm.programId || !editForm.sessionId) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      const payload = {
        ...editForm,
        documents: editDocuments,
        educationalDetails: editEducation
      };
      await api.put(`/enrollment/enroll/${editForm.id}`, payload);
      toast.success('Enrollment updated and re-submitted successfully!');
      setEditOpen(false);
      fetchEnrollments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update enrollment');
    }
  };

  const STATUSES = ['', 'document_review', 'dept_review', 'finance_review', 'enrolled', 'rejected'];

  const availableSessions = sessions.filter(
    s => !editForm.programId || s.programId === null || s.programId === editForm.programId
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Enrollments</h2>
          <p className="text-muted-foreground text-sm mt-1">Track all student enrollments submitted by your center.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchEnrollments()} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />Refresh
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold border transition-all',
              statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/40'
            )}
          >
            {s ? s.replace(/_/g, ' ') : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : enrollments.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No enrollments found.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {enrollments.map(e => (
            <Card key={e.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={cn('text-[10px] uppercase font-bold', STATUS_COLOR[e.status] || 'bg-muted text-muted-foreground')}>
                      {e.status === 'department_rejected' ? 'Rejected by Operations' : e.status === 'finance_rejected' ? 'Rejected by Finance' : e.status.replace(/_/g, ' ')}
                    </Badge>
                    {e.enrollmentNumber && <span className="text-xs text-muted-foreground">{e.enrollmentNumber}</span>}
                  </div>
                  <h4 className="font-semibold">{e.studentName}</h4>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                    <span>{e.studentEmail}</span>
                    <span>{e.studentPhone}</span>
                    <span>{getProgramName(e)}</span>
                    {getUniversityName(e) && <span>{getUniversityName(e)}</span>}
                    <span>{new Date(e.createdAt).toLocaleDateString()}</span>
                  </div>
                  {isRejectedStatus(e.status) && (e.departmentRemarks || e.financeRemarks) && (
                    <div className="mt-2.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2.5 flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Rejection Reason:</span> {e.departmentRemarks || e.financeRemarks}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isRejectedStatus(e.status) && (
                    <Button size="sm" onClick={() => handleStartEdit(e)}>
                      Edit & Re-submit
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setSelectedEnrollment(e)}>
                    <Eye className="w-4 h-4 mr-1.5" /> View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Enrollment Details Dialog */}
      <Dialog open={!!selectedEnrollment} onOpenChange={o => { if(!o) setSelectedEnrollment(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedEnrollment && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl">Application Details</DialogTitle>
                  <Badge className={cn('text-[10px] uppercase font-bold', STATUS_COLOR[selectedEnrollment.status] || 'bg-muted text-muted-foreground')}>
                    {selectedEnrollment.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-6 pt-3">
                {/* Rejection remarks */}
                {isRejectedStatus(selectedEnrollment.status) && (
                  <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-xl text-sm">
                    <p className="font-bold flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> Rejection Remarks:</p>
                    <p className="mt-1 font-medium italic">{selectedEnrollment.departmentRemarks || selectedEnrollment.financeRemarks || 'No remarks provided.'}</p>
                  </div>
                )}

                {/* Basic Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Student Name</p>
                      <p className="font-medium">{selectedEnrollment.studentName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Email</p>
                      <p className="font-medium">{selectedEnrollment.studentEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Phone</p>
                      <p className="font-medium">{selectedEnrollment.studentPhone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">Address</p>
                      <p className="font-medium">{selectedEnrollment.studentAddress}</p>
                    </div>
                  </div>
                  {selectedEnrollment.maritalStatus && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4" /> {/* Spacer icon */}
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold">Marital Status</p>
                        <p className="font-medium">{selectedEnrollment.maritalStatus}</p>
                      </div>
                    </div>
                  )}
                  {selectedEnrollment.currentlyWorking && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4" /> {/* Spacer icon */}
                      <div>
                        <p className="text-xs text-muted-foreground font-semibold">Currently Working</p>
                        <p className="font-medium">{selectedEnrollment.currentlyWorking}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Course Details */}
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-primary" /> Program Selection & Intake Session
                  </h4>
                  <div className="bg-muted/20 p-4 rounded-xl border text-sm space-y-2">
                    <div>
                      <span className="text-xs text-muted-foreground block font-medium">Program Name</span>
                      <span className="font-semibold text-foreground">{getProgramName(selectedEnrollment)}</span>
                    </div>
                    {getUniversityName(selectedEnrollment) && (
                      <div>
                        <span className="text-xs text-muted-foreground block font-medium">University</span>
                        <span className="font-semibold text-foreground">{getUniversityName(selectedEnrollment)}</span>
                      </div>
                    )}
                    {selectedEnrollment.session?.name && (
                      <div>
                        <span className="text-xs text-muted-foreground block font-medium">Intake Session</span>
                        <span className="font-semibold text-foreground">{selectedEnrollment.session.name}</span>
                      </div>
                    )}
                    {selectedEnrollment.specialisation && (
                      <div>
                        <span className="text-xs text-muted-foreground block font-medium">Specialisation Combo</span>
                        <span className="font-semibold text-indigo-600">{selectedEnrollment.specialisation}</span>
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
                <Button variant="outline" onClick={() => setSelectedEnrollment(null)}>Close</Button>
                <Button variant="secondary" onClick={() => handlePrintApp(selectedEnrollment)}>
                  <Printer className="w-4 h-4 mr-2" /> Print App
                </Button>
                {isRejectedStatus(selectedEnrollment.status) && (
                  <Button onClick={() => handleStartEdit(selectedEnrollment)}>Edit & Re-submit</Button>
                )}
                {selectedEnrollment.status === 'payment_pending' && (
                  <Button onClick={() => setPaymentOpen(true)}>Process Payment</Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payment</DialogTitle>
            <DialogDescription>Submit payment details for this enrollment.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <select 
                className="w-full p-2 border rounded-md"
                value={paymentForm.paymentType} 
                onChange={e => setPaymentForm({ ...paymentForm, paymentType: e.target.value })}
              >
                <option value="wallet">Wallet Deduction</option>
                <option value="emi">EMI / Installments</option>
                <option value="offline">Offline / Receipt</option>
              </select>
            </div>
            {paymentForm.paymentType === 'emi' && (
              <div className="space-y-2">
                <Label>EMI Details / NBFC Name</Label>
                <Input value={paymentForm.emiDetails} onChange={e => setPaymentForm({ ...paymentForm, emiDetails: e.target.value })} required />
              </div>
            )}
            {paymentForm.paymentType === 'offline' && (
              <div className="space-y-2">
                <Label>Payment Proof / UTR No.</Label>
                <Input value={paymentForm.paymentProof} onChange={e => setPaymentForm({ ...paymentForm, paymentProof: e.target.value })} required />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
              <Button type="submit">Submit Payment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit rejected student dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit & Re-Submit Application</DialogTitle>
            <DialogDescription>Modify application details and documents to re-submit for review.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateSubmit} className="space-y-6 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Student Full Name</Label>
                <Input value={editForm.studentName} onChange={e => setEditForm({ ...editForm, studentName: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Student Email</Label>
                <Input type="email" value={editForm.studentEmail} onChange={e => setEditForm({ ...editForm, studentEmail: e.target.value })} required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Student Phone</Label>
                <Input value={editForm.studentPhone} onChange={e => setEditForm({ ...editForm, studentPhone: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Input value={editForm.studentAddress} onChange={e => setEditForm({ ...editForm, studentAddress: e.target.value })} required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Program</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={editForm.programId}
                  onChange={e => setEditForm({ ...editForm, programId: e.target.value, sessionId: '' })}
                  required
                >
                  <option value="">Select Program</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label>Admission Session</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={editForm.sessionId}
                  onChange={e => setEditForm({ ...editForm, sessionId: e.target.value })}
                  required
                >
                  <option value="">Select Session</option>
                  {availableSessions.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Specialisation Combo (Optional)</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={editForm.specialisation}
                onChange={e => setEditForm({ ...editForm, specialisation: e.target.value })}
              >
                <option value="">Select Specialisation Combo</option>
                {programs.find(p => p.id === editForm.programId)?.specialisations?.map((spec: string, idx: number) => (
                  <option key={idx} value={spec}>{spec}</option>
                ))}
              </select>
            </div>

            {/* Educational History Section */}
            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-primary" /> Educational History
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end mb-3">
                <div className="col-span-1 space-y-1">
                  <Label className="text-xs">Qualification</Label>
                  <Input placeholder="10th, 12th, UG" value={tempEdu.qualification} onChange={e => setTempEdu({ ...tempEdu, qualification: e.target.value })} />
                </div>
                <div className="col-span-1 space-y-1">
                  <Label className="text-xs">Institution</Label>
                  <Input placeholder="School/College" value={tempEdu.institution} onChange={e => setTempEdu({ ...tempEdu, institution: e.target.value })} />
                </div>
                <div className="col-span-1 space-y-1">
                  <Label className="text-xs">Passing Year</Label>
                  <Input placeholder="e.g. 2020" value={tempEdu.passingYear} onChange={e => setTempEdu({ ...tempEdu, passingYear: e.target.value })} />
                </div>
                <div className="col-span-1 space-y-1 flex gap-1 items-center">
                  <div className="flex-1">
                    <Label className="text-xs">Percentage / GPA</Label>
                    <Input placeholder="e.g. 85%" value={tempEdu.percentage} onChange={e => setTempEdu({ ...tempEdu, percentage: e.target.value })} />
                  </div>
                  <Button type="button" size="icon" className="h-9 w-9 shrink-0" onClick={handleAddEducation}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>

              {editEducation.length > 0 && (
                <div className="space-y-2">
                  {editEducation.map((edu, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-muted/40 text-xs border border-border">
                      <span className="font-semibold">{edu.qualification}</span>
                      <span>{edu.institution}</span>
                      <span>{edu.passingYear} {edu.percentage && `• ${edu.percentage}`}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveEducation(idx)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Documents Section */}
            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary" /> Upload Documents
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {['Photo', 'Signature', '10th Marksheet', '12th Marksheet', 'Degree Certificate'].map((docName) => {
                  const alreadyUploaded = editDocuments.some(d => d.name === docName);
                  return (
                    <div key={docName} className="flex flex-col gap-1 p-3 border rounded-xl bg-card hover:bg-muted/10 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{docName}</span>
                        {alreadyUploaded && <Badge className="bg-success/10 text-success text-[9px]">Uploaded</Badge>}
                      </div>
                      <label className="mt-2 flex items-center justify-center border border-dashed rounded-lg py-2 hover:bg-muted/30 cursor-pointer transition-colors text-xs text-muted-foreground">
                        <Upload className="w-3.5 h-3.5 mr-1" /> {alreadyUploaded ? 'Replace File' : 'Choose File'}
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, docName)} disabled={uploading} />
                      </label>
                    </div>
                  );
                })}
              </div>

              {editDocuments.length > 0 && (
                <div className="space-y-2">
                  {editDocuments.map((doc, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-muted/40 text-xs border border-border">
                      <span className="font-medium">{doc.name}</span>
                      <div className="flex gap-2 items-center">
                        <a href={resolveFileUrl(doc.url)} target="_blank" rel="noreferrer" className="text-primary hover:underline font-semibold">View</a>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveDocument(idx)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit">Re-Submit Application</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
