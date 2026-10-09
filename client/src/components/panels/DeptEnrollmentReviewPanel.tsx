import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, Mail, Phone, MapPin, GraduationCap, FileText, Calendar, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Enrollment {
  id: string;
  enrollmentNumber?: string;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  studentAddress?: string;
  programId: string;
  studyCenterId: string;
  status: string;
  createdAt: string;
  departmentRemarks?: string;
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
  program?: { name: string; code: string; university?: { id: string; name: string } };
  studyCenter?: { id: string; name: string };
  session?: { name: string };
  documents?: { name: string; url: string }[];
  educationalDetails?: { qualification: string; institution: string; passingYear: string; percentage?: string }[];
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
};

export function DeptEnrollmentReviewPanel() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [remarks, setRemarks] = useState('');
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetch(); }, [activeTab]);

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

  const getProgramName = (e: Enrollment) =>
    e.program && typeof e.program === 'object'
      ? `${e.program.name} (${e.program.code})`
      : (typeof e.programId === 'object' ? `${(e.programId as any).name} (${(e.programId as any).code})` : e.programId);

  const getCenterName = (e: Enrollment) =>
    e.studyCenter && typeof e.studyCenter === 'object'
      ? e.studyCenter.name
      : (typeof e.studyCenterId === 'object' ? (e.studyCenterId as any).name : (e.studyCenterId || 'Direct University Admission'));

  const uniqueUniversities = Array.from(new Set(enrollments.filter(e => e.program?.university).map(e => JSON.stringify({ id: e.program!.university!.id, name: e.program!.university!.name })))).map(s => JSON.parse(s));
  const uniqueCenters = Array.from(new Set(enrollments.filter(e => e.studyCenter).map(e => JSON.stringify({ id: e.studyCenter!.id, name: e.studyCenter!.name })))).map(s => JSON.parse(s));
  const uniquePrograms = Array.from(new Set(enrollments.filter(e => e.program).map(e => JSON.stringify({ id: e.programId, name: `${e.program!.name} (${e.program!.code})` })))).map(s => JSON.parse(s));

  const filteredEnrollments = enrollments
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter(e => {
      if (universityFilter !== 'all' && e.program?.university?.id !== universityFilter) return false;
      if (centerFilter !== 'all' && (e.studyCenter?.id !== centerFilter && e.studyCenterId !== centerFilter)) return false;
      if (programFilter !== 'all' && e.programId !== programFilter) return false;
      
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

        <div className="flex flex-col md:flex-row gap-4">
          <Input 
            placeholder="Search name, email, or enrollment no..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="md:w-1/4"
          />
          <select 
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:w-1/4"
            value={universityFilter}
            onChange={e => setUniversityFilter(e.target.value)}
          >
            <option value="all">All Universities</option>
            {uniqueUniversities.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select 
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:w-1/4"
            value={centerFilter}
            onChange={e => setCenterFilter(e.target.value)}
          >
            <option value="all">All Centers</option>
            {uniqueCenters.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select 
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:w-1/4"
            value={programFilter}
            onChange={e => setProgramFilter(e.target.value)}
          >
            <option value="all">All Programs</option>
            {uniquePrograms.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <TabsContent value="pending" className="space-y-4">
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : filteredEnrollments.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">No enrollments pending review.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {filteredEnrollments.map(e => (
                <Card key={e.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-5 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0 cursor-pointer group/item" onClick={() => setSelectedEnrollment(e)}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-warning/10 text-warning text-[10px] uppercase font-bold">
                          {e.status.replace(/_/g, ' ')}
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
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-success border-success/30 hover:bg-success/10" onClick={() => handleApprove(e.id)}>
                        <CheckCircle className="w-4 h-4 mr-1" />Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { setRejectDialog({ open: true, id: e.id }); setRemarks(''); }}>
                        <XCircle className="w-4 h-4 mr-1" />Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
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
                <div className="flex items-center gap-2">
                  <DialogTitle>Review Enrollment Details</DialogTitle>
                  <Badge className={cn('text-[10px] uppercase font-bold', STATUS_COLOR[selectedEnrollment.status] || 'bg-muted text-muted-foreground')}>
                    {selectedEnrollment.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Rejection remarks */}
                {selectedEnrollment.status === 'rejected' && (
                  <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-xl text-sm">
                    <p className="font-bold flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> Rejection Remarks:</p>
                    <p className="mt-1 font-medium italic">{selectedEnrollment.departmentRemarks || 'No remarks provided.'}</p>
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
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedEnrollment(null)}>
                  Close
                </Button>
                {activeTab === 'pending' && (
                  <>
                    <Button
                      variant="destructive"
                      className="text-white bg-destructive hover:bg-destructive/90"
                      onClick={() => {
                        setRejectDialog({ open: true, id: selectedEnrollment.id });
                        setRemarks('');
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                    <Button
                      className="text-white bg-success hover:bg-success/90"
                      onClick={() => handleApprove(selectedEnrollment.id)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
