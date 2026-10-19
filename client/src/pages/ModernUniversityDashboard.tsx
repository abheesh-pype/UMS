import { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  BookOpen,
  Building2,
  TrendingUp,
  Search,
  RefreshCw,
  Users,
  KeyRound,
  Save,
  ShieldCheck,
  Calendar,
  Mail,
  Phone,
  MapPin,
  User,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { toast } from 'sonner';
import { UniversityEnrollmentReviewPanel } from '@/components/panels/UniversityEnrollmentReviewPanel';
import { PendingCenterVerificationPanel } from '@/components/panels/PendingCenterVerificationPanel';


interface Enrollment {
  id: string;
  enrollmentNumber?: string;
  uniEnrollmentNumber?: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  studentAddress?: string;
  dob?: string;
  fatherName?: string;
  motherName?: string;
  parentMobile?: string;
  pincode?: string;
  alternativePhone?: string;
  maritalStatus?: string;
  religion?: string;
  caste?: string;
  enrolledAt?: string;
  admissionDate?: string;
  status?: string;
  program?: { id: string; name: string; code: string; courseType: string } | null;
  studyCenter?: { id: string; name: string; code: string; city?: string } | null;
  session?: { id: string; name: string; startDate?: string; endDate?: string } | null;
  student?: {
    id: string;
    enrollmentNo?: string;
    phone?: string;
    address?: string;
    dob?: string;
    fatherName?: string;
    motherName?: string;
    parentMobile?: string;
    alternativePhone?: string;
    maritalStatus?: string;
    religion?: string;
    caste?: string;
    pincode?: string;
  } | null;
}

interface Metrics {
  totalEnrolled: number;
  totalPrograms: number;
  totalCenters: number;
  recentEnrollments: number;
}

interface Program { id: string; name: string; code: string; }

export function ModernUniversityDashboard({ initialTab, onNavigate }: { initialTab?: string, onNavigate?: (tab: string) => void }) {
  const { user } = useAuth();
  const universityId = (user as any)?.universityId;
  const [activeTab, setActiveTab] = useState(initialTab || 'dashboard');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('all');
  const [uniName, setUniName] = useState('University');

  // Student Details dialog state
  const [selectedStudent, setSelectedStudent] = useState<Enrollment | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingUniEnr, setEditingUniEnr] = useState(false);
  const [uniEnrInput, setUniEnrInput] = useState('');
  const [savingUniEnr, setSavingUniEnr] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab || 'dashboard');
  }, [initialTab]);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await api.get(`/operations/universities/${universityId}/metrics`);
      setMetrics(res.data.data);
      setUniName(res.data.data?.university?.name || 'University');
    } catch { /* silent */ }
  }, [universityId]);

  const fetchPrograms = useCallback(async () => {
    try {
      const res = await api.get('/operations/programs');
      setPrograms(res.data.data || []);
    } catch { /* silent */ }
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (programFilter !== 'all') params.programId = programFilter;
      const res = await api.get(`/operations/universities/${universityId}/students`, { params });
      setEnrollments(res.data.data || []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [universityId, search, programFilter]);

  useEffect(() => {
    if (universityId) {
      fetchMetrics();
      fetchPrograms();
      fetchStudents();
    }
  }, [universityId, fetchMetrics, fetchPrograms, fetchStudents]);

  useEffect(() => {
    if (universityId) fetchStudents();
  }, [search, programFilter, universityId, fetchStudents]);

  const formatDOB = (d?: string | null) => {
    if (!d) return 'N/A';
    const str = String(d).trim();
    if (!str) return 'N/A';

    // If already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }

    // If DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }

    // If YYYY/MM/DD
    const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, '0');
      const day = ymdMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // If Date string (e.g. ISO 8601)
    try {
      const date = new Date(str);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch {
      // fallback
    }

    return str;
  };

  const formatDisplayDate = (d?: string | null) => {
    if (!d) return 'N/A';
    try {
      const date = new Date(d);
      if (isNaN(date.getTime())) return d;
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const handleSaveUniEnrollment = async () => {
    if (!selectedStudent) return;
    setSavingUniEnr(true);
    try {
      await api.put(`/operations/enrollments/${selectedStudent.id}`, { uniEnrollmentNumber: uniEnrInput });
      toast.success('University Enrollment Number saved');
      setSelectedStudent(prev => prev ? { ...prev, uniEnrollmentNumber: uniEnrInput } : null);
      setEnrollments(prev => prev.map(e => e.id === selectedStudent.id ? { ...e, uniEnrollmentNumber: uniEnrInput } : e));
      setEditingUniEnr(false);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save University Enrollment Number');
    } finally {
      setSavingUniEnr(false);
    }
  };

  if (!universityId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No university linked to your account. Contact your administrator.
      </div>
    );
  }

  // Render pending review tab
  if (activeTab === 'pending_center_verification') {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h1 className="text-2xl font-bold">{uniName}</h1>
          <p className="text-sm text-muted-foreground mt-1">University Admin Panel</p>
        </div>
        <PendingCenterVerificationPanel mode="university" />
      </div>
    );
  }

  if (activeTab === 'pending-review') {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h1 className="text-2xl font-bold">{uniName}</h1>
          <p className="text-sm text-muted-foreground mt-1">University Admin Panel</p>
        </div>
        <UniversityEnrollmentReviewPanel />
      </div>
    );
  }

  if (activeTab === 'integration') {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h1 className="text-2xl font-bold">{uniName}</h1>
          <p className="text-sm text-muted-foreground mt-1">University Admin Panel</p>
        </div>
        <UniversityExamIntegrationPanel universityId={universityId} />
      </div>
    );
  }

  const isEnrolledStudentsTab = activeTab === 'enrolled_students' || activeTab === 'students';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {isEnrolledStudentsTab ? 'Enrolled Students' : uniName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isEnrolledStudentsTab
            ? `${uniName} — all enrolled students and programs`
            : 'University Admin Panel — enrolled students and programs'}
        </p>
      </div>

      {/* Metrics — show on dashboard/overview or all main views */}
      {metrics && !isEnrolledStudentsTab && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={<GraduationCap className="w-4 h-4" />} label="Total Enrolled" value={metrics.totalEnrolled} color="text-primary" />
          <MetricCard icon={<BookOpen className="w-4 h-4" />} label="Active Programs" value={metrics.totalPrograms} color="text-blue-500" />
          <MetricCard icon={<Building2 className="w-4 h-4" />} label="Partner Portals" value={metrics.totalCenters} color="text-green-500" />
          <MetricCard icon={<TrendingUp className="w-4 h-4" />} label="Last 30 Days" value={metrics.recentEnrollments} color="text-orange-500" />
        </div>
      )}

      {/* Students section */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base">Enrolled Students</CardTitle>
              <CardDescription>Students verified by Operations and enrolled in your programs</CardDescription>
            </div>
            <Badge variant="outline">{enrollments.length} students</Badge>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email or enrollment no..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={programFilter} onValueChange={setProgramFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="All Programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {programs.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchStudents} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Loading...</div>
          ) : enrollments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
              <Users className="w-8 h-8 opacity-30" />
              <p className="text-sm">No enrolled students found</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Enrollment No.</th>
                    <th className="text-left py-2 pr-4 font-medium">Student &amp; DOB</th>
                    <th className="text-left py-2 pr-4 font-medium">Program</th>
                    <th className="text-left py-2 pr-4 font-medium">Partner Portal</th>
                    <th className="text-left py-2 pr-4 font-medium">Session</th>
                    <th className="text-left py-2 font-medium">Enrolled On</th>
                    <th className="text-right py-2 pr-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {enrollments.map(e => {
                    const studentDob = e.dob || e.student?.dob;
                    return (
                      <tr
                        key={e.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer group"
                        onClick={() => { setSelectedStudent(e); setDetailsOpen(true); }}
                      >
                        <td className="py-3 pr-4">
                          <div className="flex flex-col gap-0.5 items-start">
                            {e.uniEnrollmentNumber ? (
                              <span className="font-mono text-xs font-bold text-primary">ENR: {e.uniEnrollmentNumber}</span>
                            ) : null}
                            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                              ADM: {e.enrollmentNumber || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{e.studentName}</p>
                          <p className="text-xs text-muted-foreground">{e.studentEmail}</p>
                          {studentDob && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded mt-1 font-mono">
                              <Calendar className="w-3 h-3 text-primary" /> DOB: {formatDOB(studentDob)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <p className="font-medium">{e.program?.name || 'Program'}</p>
                          <p className="text-xs text-muted-foreground">{e.program?.code || '—'} · {e.program?.courseType || '—'}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <p className="font-medium">{e.studyCenter?.name || 'Direct Admission'}</p>
                          <p className="text-xs text-muted-foreground">{e.studyCenter?.city || e.studyCenter?.code || 'Direct University Admission'}</p>
                        </td>
                        <td className="py-3 pr-4 text-xs">{e.session?.name || '—'}</td>
                        <td className="py-3 text-xs text-muted-foreground">
                          {formatDisplayDate(e.enrolledAt)}
                        </td>
                        <td className="py-3 text-right pr-2" onClick={ev => ev.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary"
                            onClick={() => { setSelectedStudent(e); setDetailsOpen(true); }}
                          >
                            <Eye className="w-3.5 h-3.5" /> View Details
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedStudent && (
            <div className="space-y-6 py-1">
              <DialogHeader>
                <div className="flex items-center justify-between pr-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg font-bold">Student Details</DialogTitle>
                      <DialogDescription className="text-xs">
                        Comprehensive enrollment and profile information
                      </DialogDescription>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold text-xs">
                    {selectedStudent.status || 'Enrolled'}
                  </Badge>
                </div>
              </DialogHeader>

              {/* Personal & Contact Info Card */}
              <div className="rounded-xl border bg-card p-4 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                    <User className="w-4 h-4 text-primary" />
                    Personal &amp; Contact Info
                  </h4>
                  <Badge variant="outline" className="text-[11px] font-normal">
                    Student Profile
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {/* Full Name */}
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <span className="text-xs text-muted-foreground block font-medium">Student Full Name</span>
                    <span className="font-semibold text-foreground text-base">{selectedStudent.studentName}</span>
                  </div>

                  {/* Date of Birth (DOB) - Highlighted */}
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/25 flex items-start gap-2.5">
                    <Calendar className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs text-primary font-semibold block uppercase tracking-wider">Date of Birth (DOB)</span>
                      <span className="font-bold text-foreground text-base font-mono">
                        {formatDOB(selectedStudent.dob || selectedStudent.student?.dob)}
                      </span>
                      <span className="text-[11px] text-muted-foreground block font-mono">
                        Format: YYYY-MM-DD
                      </span>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50 flex items-start gap-2.5">
                    <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs text-muted-foreground block font-medium">Email Address</span>
                      <span className="font-medium text-foreground break-all">{selectedStudent.studentEmail || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50 flex items-start gap-2.5">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs text-muted-foreground block font-medium">Phone Number</span>
                      <span className="font-medium text-foreground">{selectedStudent.studentPhone || selectedStudent.student?.phone || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Alternate Phone */}
                  {(selectedStudent.alternativePhone || selectedStudent.student?.alternativePhone) && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50 flex items-start gap-2.5">
                      <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs text-muted-foreground block font-medium">Alternate Phone</span>
                        <span className="font-medium text-foreground">{selectedStudent.alternativePhone || selectedStudent.student?.alternativePhone}</span>
                      </div>
                    </div>
                  )}

                  {/* Parents */}
                  {(selectedStudent.fatherName || selectedStudent.student?.fatherName || selectedStudent.motherName || selectedStudent.student?.motherName) && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50 flex items-start gap-2.5">
                      <Users className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs text-muted-foreground block font-medium">Parents Info</span>
                        <div className="text-xs space-y-0.5 mt-0.5">
                          {(selectedStudent.fatherName || selectedStudent.student?.fatherName) && (
                            <p><span className="text-muted-foreground">Father:</span> <span className="font-medium text-foreground">{selectedStudent.fatherName || selectedStudent.student?.fatherName}</span></p>
                          )}
                          {(selectedStudent.motherName || selectedStudent.student?.motherName) && (
                            <p><span className="text-muted-foreground">Mother:</span> <span className="font-medium text-foreground">{selectedStudent.motherName || selectedStudent.student?.motherName}</span></p>
                          )}
                          {(selectedStudent.parentMobile || selectedStudent.student?.parentMobile) && (
                            <p><span className="text-muted-foreground">Parent Contact:</span> <span className="font-medium text-foreground">{selectedStudent.parentMobile || selectedStudent.student?.parentMobile}</span></p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Additional Personal Info */}
                  {(selectedStudent.maritalStatus || selectedStudent.religion || selectedStudent.caste || selectedStudent.student?.maritalStatus) && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <span className="text-xs text-muted-foreground block font-medium">Other Personal Details</span>
                      <div className="text-xs text-foreground mt-1 flex flex-wrap gap-2">
                        {(selectedStudent.maritalStatus || selectedStudent.student?.maritalStatus) && (
                          <Badge variant="outline" className="text-[11px]">Marital: {selectedStudent.maritalStatus || selectedStudent.student?.maritalStatus}</Badge>
                        )}
                        {(selectedStudent.religion || selectedStudent.student?.religion) && (
                          <Badge variant="outline" className="text-[11px]">Religion: {selectedStudent.religion || selectedStudent.student?.religion}</Badge>
                        )}
                        {(selectedStudent.caste || selectedStudent.student?.caste) && (
                          <Badge variant="outline" className="text-[11px]">Category: {selectedStudent.caste || selectedStudent.student?.caste}</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Full Address */}
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50 sm:col-span-2 flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground block font-medium">Residential Address</span>
                      <span className="font-medium text-foreground">
                        {selectedStudent.studentAddress || selectedStudent.student?.address || 'N/A'}
                        {(selectedStudent.pincode || selectedStudent.student?.pincode) && ` - ${selectedStudent.pincode || selectedStudent.student?.pincode}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Academic & Program Details */}
              <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground border-b pb-2">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  Program &amp; Academic Info
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/40">
                    <span className="text-xs text-muted-foreground block font-medium">Program</span>
                    <span className="font-semibold text-foreground">
                      {selectedStudent.program?.name || 'N/A'}
                    </span>
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      Code: {selectedStudent.program?.code || '—'} · {selectedStudent.program?.courseType || '—'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/20 border border-border/40">
                    <span className="text-xs text-muted-foreground block font-medium">Partner Portal / Study Center</span>
                    <span className="font-semibold text-foreground">
                      {selectedStudent.studyCenter?.name || 'Direct Admission'}
                    </span>
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      {selectedStudent.studyCenter?.city || selectedStudent.studyCenter?.code || 'Direct University Admission'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/20 border border-border/40">
                    <span className="text-xs text-muted-foreground block font-medium">Admission Session</span>
                    <span className="font-semibold text-foreground">
                      {selectedStudent.session?.name || '—'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/20 border border-border/40">
                    <span className="text-xs text-muted-foreground block font-medium">Enrolled Date</span>
                    <span className="font-semibold text-foreground">
                      {formatDisplayDate(selectedStudent.enrolledAt || selectedStudent.admissionDate)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Enrollment Numbers Card */}
              <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground border-b pb-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Enrollment Identifiers
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/40">
                    <span className="text-xs text-muted-foreground block font-medium">Admission / Internal Enrollment No.</span>
                    <span className="font-mono font-semibold text-foreground">
                      {selectedStudent.enrollmentNumber || selectedStudent.student?.enrollmentNo || '—'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/20 border border-border/40">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground block font-medium">University Enrollment No.</span>
                      {!editingUniEnr && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2 text-primary"
                          onClick={() => {
                            setUniEnrInput(selectedStudent.uniEnrollmentNumber || '');
                            setEditingUniEnr(true);
                          }}
                        >
                          {selectedStudent.uniEnrollmentNumber ? 'Edit' : 'Set'}
                        </Button>
                      )}
                    </div>
                    {editingUniEnr ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          size="sm"
                          value={uniEnrInput}
                          onChange={e => setUniEnrInput(e.target.value)}
                          placeholder="Enter Uni Enrollment No..."
                          className="h-8 text-xs font-mono"
                        />
                        <Button
                          size="sm"
                          className="h-8 px-2.5 text-xs"
                          disabled={savingUniEnr}
                          onClick={handleSaveUniEnrollment}
                        >
                          <Save className="w-3.5 h-3.5 mr-1" /> Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          onClick={() => setEditingUniEnr(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <span className="font-mono font-bold text-primary text-base block mt-0.5">
                        {selectedStudent.uniEnrollmentNumber || 'Not assigned yet'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function UniversityExamIntegrationPanel({ universityId }: { universityId: string }) {
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api.get(`/operations/universities/${universityId}/exam-portal-integration`)
      .then(response => {
        if (!active) return;
        setEndpoint(response.data.data?.endpoint || '');
        setHasApiKey(Boolean(response.data.data?.hasApiKey));
      })
      .catch((error: any) => {
        if (active) toast.error(error.response?.data?.message || 'Failed to load exam portal integration');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [universityId]);

  const saveIntegration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await api.put(`/operations/universities/${universityId}/exam-portal-integration`, { endpoint, apiKey });
      setEndpoint(response.data.data.endpoint);
      setHasApiKey(Boolean(response.data.data.hasApiKey));
      setApiKey('');
      toast.success('Exam portal integration saved');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save exam portal integration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Exam Portal Integration</CardTitle>
        <CardDescription>Connect an external exam system. The API key is stored encrypted and never sent to the browser after saving.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <p className="py-6 text-sm text-muted-foreground">Loading integration settings...</p> : (
          <form onSubmit={saveIntegration} className="max-w-2xl space-y-5">
            <div className="space-y-2">
              <Label htmlFor="exam-portal-endpoint">Exam portal SSO endpoint</Label>
              <Input
                id="exam-portal-endpoint"
                type="url"
                placeholder="https://exam.example.com/api/sso/launch"
                value={endpoint}
                onChange={event => setEndpoint(event.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">The endpoint receives a server-to-server launch request and must return a one-time launch URL.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam-portal-api-key">API key</Label>
              <Input
                id="exam-portal-api-key"
                type="password"
                autoComplete="new-password"
                placeholder={hasApiKey ? 'Saved — enter a new key only to replace it' : 'Enter the exam portal API key'}
                value={apiKey}
                onChange={event => setApiKey(event.target.value)}
                required={!hasApiKey}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                {hasApiKey ? 'API key is configured' : 'API key is not configured'}
              </p>
              <Button type="submit" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save Integration'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-muted ${color}`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function getUniversityNavItems() {
  return [
    { id: 'dashboard', label: 'Dashboard' },
    {
      id: 'students',
      label: 'Students',
      children: [
        { id: 'enrolled_students', label: 'Enrolled Students' },
      ],
    },
    { id: 'pending_center_verification', label: 'Pending Verification' },
    { id: 'integration', label: 'Integration' },
  ];
}
