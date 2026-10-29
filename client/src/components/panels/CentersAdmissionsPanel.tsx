import { useState, useEffect } from 'react';
import { RefreshCw, Search, School, Building2, Eye, FileText, Calendar, User, GraduationCap, CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { FinanceCenterVerificationPanel } from '@/components/panels/FinanceCenterVerificationPanel';
import { resolveFileUrl, isImageFileUrl } from '@/lib/fileUrl';

interface Enrollment {
  id: string;
  enrollmentNumber?: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  studentAddress?: string;
  studentPhoto?: string;
  uniEnrollmentNumber?: string;
  abcId?: string;
  debId?: string;
  dob?: string;
  religion?: string;
  caste?: string;
  fatherName?: string;
  motherName?: string;
  parentMobile?: string;
  pincode?: string;
  alternativePhone?: string;
  maritalStatus?: string;
  currentlyWorking?: string;
  admissionDate?: string;
  specialisation?: string;
  sessionId?: string;
  totalFee?: number;
  paymentMethod?: string;
  paymentType?: string;
  emiDetails?: unknown;
  refundStatus?: string;
  refundAmount?: number;
  extraFees?: unknown;
  departmentRemarks?: string;
  financeRemarks?: string;
  universityRemarks?: string;
  enrolledAt?: string;
  documents?: { name: string; url: string; reqName?: string; uploadedAt?: string; remarks?: string }[];
  educationalDetails?: { qualification: string; institution: string; passingYear: string; percentage?: string }[];
  statusHistory?: { status?: string; timestamp?: string; note?: string; actorName?: string }[];
  session?: { name: string } | null;
  payment?: { amount: number; debitedAt: string } | null;
  program?: { 
    name: string; 
    code: string;
    university?: { name: string; code: string; } | null;
  } | null;
  studyCenter?: {
    name: string;
    code: string;
  } | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
  departmentReviewedAt?: string;
  financeReviewedAt?: string;
  universityReviewedAt?: string;
  salesUser?: { id: string; name: string; email?: string } | null;
  departmentReviewer?: { id: string; name: string } | null;
  financeReviewer?: { id: string; name: string } | null;
  universityReviewer?: { id: string; name: string } | null;
  assignedOpsUser?: { id: string; name: string } | null;
  assignedFinanceUser?: { id: string; name: string } | null;
}

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : 'N/A');

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

export function CentersAdmissionsPanel() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  // Documents uploaded before files were stored in the database may point at files missing from this server
  const [missingDocumentUrls, setMissingDocumentUrls] = useState<Set<string>>(new Set());
  const markDocumentMissing = (url: string) =>
    setMissingDocumentUrls(current => (current.has(url) ? current : new Set(current).add(url)));
  const departmentType = ((user as any)?.department?.type || (user as any)?.subDepartment?.parentDept?.type || '').toLowerCase();
  const isFinanceDepartment = ['finance_admin', 'finance_sub_admin'].includes(user?.role || '') || departmentType === 'finance';
  // Finance sees both study-centre admissions and student admissions; toggle between them
  const [admissionView, setAdmissionView] = useState<'centers' | 'students'>('centers');
  const showCentersView = isFinanceDepartment && admissionView === 'centers';
  const showStudentsView = !isFinanceDepartment || admissionView === 'students';

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get('/enrollment/all');
      setEnrollments(res.data.data || []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load admissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const filtered = enrollments.filter(e => {
    const s = search.toLowerCase();
    const matchesSearch = 
      (e.studentName || '').toLowerCase().includes(s) ||
      (e.enrollmentNumber || '').toLowerCase().includes(s) ||
      (e.studyCenter?.name || '').toLowerCase().includes(s) ||
      (e.studyCenter?.code || '').toLowerCase().includes(s) ||
      (e.program?.name || '').toLowerCase().includes(s) ||
      (e.program?.code || '').toLowerCase().includes(s) ||
      (e.program?.university?.name || '').toLowerCase().includes(s);
    
    const matchesStatus = !statusFilter || e.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const STATUSES = ['', 'pending_doc_review', 'document_review', 'payment_pending', 'dept_review', 'pending_finance_review', 'finance_review', 'enrolled', 'rejected'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Centers Admissions</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {['sales_admin', 'bde'].includes(user?.role || '') 
              ? 'View admissions for study centers referred by you.'
              : 'Global view of all student enrollments across all study centers.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetch} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} /> Refresh
        </Button>
      </div>

      {isFinanceDepartment && (
        <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1 gap-1">
          {([
            ['centers', 'Centers Admission', Building2],
            ['students', 'Students Admission', GraduationCap],
          ] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setAdmissionView(value)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all',
                admissionView === value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background'
              )}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      )}

      {showCentersView && <FinanceCenterVerificationPanel />}

      {showStudentsView && (<>
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search student, center, program or enrollment ID..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
              {s ? s.replace(/_/g, ' ').toUpperCase() : 'ALL'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-24 bg-muted/40 rounded-xl animate-pulse border border-border" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center text-muted-foreground">
            <School className="w-12 h-12 mx-auto mb-4 opacity-20" />
            No admissions found matching your criteria.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(e => (
            <Card key={e.id} className="group hover:border-primary/40 transition-all hover:shadow-md">
              <CardContent className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                  <div className="md:col-span-1 border-r border-border pr-4 h-full flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className={cn('text-[10px] uppercase font-bold', STATUS_COLOR[e.status] || 'bg-muted text-muted-foreground')}>
                          {e.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <h4 className="font-bold text-lg leading-tight">{e.studentName}</h4>
                      <p className="text-xs text-muted-foreground font-mono">{e.enrollmentNumber || 'ID: ' + e.id.slice(0,8)}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-4">{new Date(e.createdAt).toLocaleString()}</p>
                  </div>

                  <div className="md:col-span-2 space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-primary font-semibold">
                        <School className="w-4 h-4" />
                        <span>{e.program?.university?.name || 'Direct University'}</span>
                      </div>
                      <p className="text-sm font-medium pl-6">
                        {e.program?.name || 'Program'} {e.program?.code ? `(${e.program.code})` : ''}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="w-4 h-4" />
                        <span className="text-sm font-medium">{e.studyCenter?.name || 'Direct / Sales Direct'}</span>
                        {e.studyCenter?.code && (
                          <Badge variant="outline" className="text-[10px]">{e.studyCenter.code}</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-1 text-right flex flex-col justify-between h-full">
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>{e.studentEmail}</p>
                      <p>{e.studentPhone}</p>
                    </div>
                    {['sales_admin', 'bde'].includes(user?.role || '') && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 self-end"
                        onClick={() => setSelectedEnrollment(e)}
                      >
                        <Eye className="w-4 h-4 mr-2" /> View Profile
                      </Button>
                    )}
                    {isFinanceDepartment && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 self-end"
                        onClick={() => setSelectedEnrollment(e)}
                      >
                        <Eye className="w-4 h-4 mr-2" /> View More
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </>)}

      <Dialog open={!!selectedEnrollment} onOpenChange={open => !open && setSelectedEnrollment(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedEnrollment && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {selectedEnrollment.studentPhoto && (
                    <img
                      src={resolveFileUrl(selectedEnrollment.studentPhoto)}
                      alt={selectedEnrollment.studentName}
                      className="w-14 h-14 rounded-full object-cover border"
                    />
                  )}
                  <div>
                    <DialogTitle>{selectedEnrollment.studentName}</DialogTitle>
                    <p className="text-sm text-muted-foreground">{selectedEnrollment.enrollmentNumber || `ID: ${selectedEnrollment.id}`}</p>
                  </div>
                  <Badge className={cn('ml-auto uppercase', STATUS_COLOR[selectedEnrollment.status] || 'bg-muted text-muted-foreground')}>
                    {selectedEnrollment.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-5 py-3">
                <section>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Personal &amp; Contact Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border bg-muted/10 p-4 text-sm">
                    {[
                      ['Email', selectedEnrollment.studentEmail],
                      ['Phone', selectedEnrollment.studentPhone],
                      ['Alternative Phone', selectedEnrollment.alternativePhone],
                      ['Address', selectedEnrollment.studentAddress],
                      ['Pincode', selectedEnrollment.pincode],
                      ['Date of Birth', selectedEnrollment.dob],
                      ['Father Name', selectedEnrollment.fatherName],
                      ['Mother Name', selectedEnrollment.motherName],
                      ['Parent Mobile', selectedEnrollment.parentMobile],
                      ['Religion', selectedEnrollment.religion],
                      ['Caste / Category', selectedEnrollment.caste],
                      ['Marital Status', selectedEnrollment.maritalStatus],
                      ['Currently Working', selectedEnrollment.currentlyWorking],
                      ['ABC ID', selectedEnrollment.abcId],
                      ['DEB ID', selectedEnrollment.debId],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-medium break-words">{value || 'N/A'}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><GraduationCap className="w-4 h-4 text-primary" /> Admission Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border bg-muted/10 p-4 text-sm">
                    {[
                      ['University', selectedEnrollment.program?.university?.name],
                      ['Program', `${selectedEnrollment.program?.name || 'N/A'}${selectedEnrollment.program?.code ? ` (${selectedEnrollment.program.code})` : ''}`],
                      ['Specialisation', selectedEnrollment.specialisation],
                      ['Admission Session', selectedEnrollment.session?.name || selectedEnrollment.sessionId],
                      ['Study Centre', `${selectedEnrollment.studyCenter?.name || 'Direct / Sales Direct'}${selectedEnrollment.studyCenter?.code ? ` (${selectedEnrollment.studyCenter.code})` : ''}`],
                      ['Enrollment Number', selectedEnrollment.enrollmentNumber],
                      ['University Enrollment Number', selectedEnrollment.uniEnrollmentNumber],
                      ['Admission Date', selectedEnrollment.admissionDate ? new Date(selectedEnrollment.admissionDate).toLocaleDateString() : 'N/A'],
                      ['Submitted', selectedEnrollment.createdAt ? new Date(selectedEnrollment.createdAt).toLocaleString() : 'N/A'],
                      ['Enrolled At', selectedEnrollment.enrolledAt ? new Date(selectedEnrollment.enrolledAt).toLocaleString() : 'N/A'],
                      ['Total Fee', selectedEnrollment.totalFee != null ? `₹${Number(selectedEnrollment.totalFee).toLocaleString()}` : 'N/A'],
                      ['Payment Method', selectedEnrollment.paymentMethod],
                      ['Payment Type', selectedEnrollment.paymentType],
                      ['Center Admission Payment', selectedEnrollment.payment ? `₹${Number(selectedEnrollment.payment.amount).toLocaleString()} (${new Date(selectedEnrollment.payment.debitedAt).toLocaleString()})` : 'N/A'],
                      ['Refund Status', selectedEnrollment.refundStatus],
                      ['Refund Amount', selectedEnrollment.refundAmount != null ? `₹${Number(selectedEnrollment.refundAmount).toLocaleString()}` : 'N/A'],
                      ['Installment Details', selectedEnrollment.emiDetails ? JSON.stringify(selectedEnrollment.emiDetails) : 'N/A'],
                      ['Extra Fees', selectedEnrollment.extraFees ? JSON.stringify(selectedEnrollment.extraFees) : 'N/A'],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-medium break-words">{value || 'N/A'}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Review &amp; Assignment</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border bg-muted/10 p-4 text-sm">
                    {[
                      ['Sales Executive', selectedEnrollment.salesUser ? `${selectedEnrollment.salesUser.name}${selectedEnrollment.salesUser.email ? ` (${selectedEnrollment.salesUser.email})` : ''}` : undefined],
                      ['Assigned Operations User', selectedEnrollment.assignedOpsUser?.name],
                      ['Assigned Finance User', selectedEnrollment.assignedFinanceUser?.name],
                      ['Operations Reviewed By', selectedEnrollment.departmentReviewer?.name],
                      ['Operations Reviewed At', formatDateTime(selectedEnrollment.departmentReviewedAt)],
                      ['Finance Reviewed By', selectedEnrollment.financeReviewer?.name],
                      ['Finance Reviewed At', formatDateTime(selectedEnrollment.financeReviewedAt)],
                      ['University Reviewed By', selectedEnrollment.universityReviewer?.name],
                      ['University Reviewed At', formatDateTime(selectedEnrollment.universityReviewedAt)],
                      ['Last Updated', formatDateTime(selectedEnrollment.updatedAt)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-medium break-words">{value || 'N/A'}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><GraduationCap className="w-4 h-4 text-primary" /> Educational History</h3>
                  {selectedEnrollment.educationalDetails?.length ? (
                    <div className="space-y-2">
                      {selectedEnrollment.educationalDetails.map((education, index) => (
                        <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-2 rounded-lg border bg-muted/10 p-3 text-sm">
                          <span>{education.qualification || 'N/A'}</span>
                          <span>{education.institution || 'N/A'}</span>
                          <span>{education.passingYear || 'N/A'}</span>
                          <span>{education.percentage ? `${education.percentage}%` : 'N/A'}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No educational details recorded.</p>}
                </section>

                <section>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Uploaded Documents</h3>
                  {selectedEnrollment.documents?.length ? (
                    <div className="space-y-2">
                      {selectedEnrollment.documents.map((document, index) => (
                        <div key={`${document.url}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/10 p-3 text-sm">
                          {isImageFileUrl(document.url) && !missingDocumentUrls.has(document.url) && (
                            <a href={resolveFileUrl(document.url)} target="_blank" rel="noreferrer" className="shrink-0">
                              <img
                                src={resolveFileUrl(document.url)}
                                alt={document.reqName || document.name}
                                className="h-16 w-16 rounded-md border object-cover bg-muted"
                                onError={() => markDocumentMissing(document.url)}
                              />
                            </a>
                          )}
                          {missingDocumentUrls.has(document.url) && (
                            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-md border border-dashed border-destructive/40 bg-destructive/5 text-center text-[10px] font-medium text-destructive">
                              <FileText className="mb-1 h-4 w-4" />
                              File missing
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{document.reqName || document.name}</p>
                            {document.uploadedAt && <p className="text-xs text-muted-foreground">Uploaded {new Date(document.uploadedAt).toLocaleString()}</p>}
                            {document.remarks && <p className="text-xs text-muted-foreground">{document.remarks}</p>}
                            {missingDocumentUrls.has(document.url) && (
                              <p className="text-xs text-destructive">
                                This file is not available on the server. Ask the study center to re-upload it.
                              </p>
                            )}
                          </div>
                          <a
                            href={resolveFileUrl(document.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            View document
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No documents uploaded.</p>}
                </section>

                {(selectedEnrollment.departmentRemarks || selectedEnrollment.financeRemarks || selectedEnrollment.universityRemarks) && (
                  <section>
                    <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" /> Review Remarks</h3>
                    <div className="space-y-2 rounded-xl border bg-muted/10 p-4 text-sm">
                      {selectedEnrollment.departmentRemarks && <p><span className="font-medium">Operations: </span>{selectedEnrollment.departmentRemarks}</p>}
                      {selectedEnrollment.financeRemarks && <p><span className="font-medium">Finance: </span>{selectedEnrollment.financeRemarks}</p>}
                      {selectedEnrollment.universityRemarks && <p><span className="font-medium">University: </span>{selectedEnrollment.universityRemarks}</p>}
                    </div>
                  </section>
                )}

                {selectedEnrollment.statusHistory?.length ? (
                  <section>
                    <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Status History</h3>
                    <div className="space-y-2">
                      {selectedEnrollment.statusHistory.map((history, index) => (
                        <div key={index} className="rounded-lg border bg-muted/10 p-3 text-sm">
                          <p className="font-medium">{history.status?.replace(/_/g, ' ') || 'Status update'}{history.actorName ? ` · ${history.actorName}` : ''}</p>
                          {history.timestamp && <p className="text-xs text-muted-foreground">{new Date(history.timestamp).toLocaleString()}</p>}
                          {history.note && <p className="mt-1">{history.note}</p>}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
