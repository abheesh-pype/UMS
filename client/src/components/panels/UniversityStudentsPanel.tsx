import { useState, useEffect, useCallback } from 'react';
import { GraduationCap, Building2, BookOpen, Users, RefreshCw, Search, ChevronLeft, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { toast } from 'sonner';

interface University {
  id: string;
  name: string;
  code: string;
  address?: string;
  contact?: string;
  status: string;
}

interface Enrollment {
  id: string;
  enrollmentNumber?: string;
  uniEnrollmentNumber?: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  enrolledAt?: string;
  program: { id: string; name: string; code: string; courseType: string };
  studyCenter: { id: string; name: string; code: string; city?: string };
  session: { id: string; name: string };
}

interface Metrics {
  totalEnrolled: number;
  totalPrograms: number;
  totalCenters: number;
  recentEnrollments: number;
  university: { id: string; name: string; code: string };
}

export function UniversityStudentsPanel() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('all');
  const [centerFilter, setCenterFilter] = useState('all');
  const [sessionFilter, setSessionFilter] = useState('all');

  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([]);
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => { fetchUniversities(); fetchCenters(); fetchSessions(); }, []);

  const fetchUniversities = async () => {
    setLoading(true);
    try {
      const res = await api.get('/operations/universities');
      setUniversities(res.data.data || []);
    } catch {
      toast.error('Failed to load universities');
    } finally {
      setLoading(false);
    }
  };

  const fetchCenters = async () => {
    try {
      const res = await api.get('/operations/centers');
      setCenters(res.data.data || []);
    } catch {
      toast.error('Failed to load centers');
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await api.get('/operations/admission-sessions');
      setSessions(res.data.data || []);
    } catch {
      toast.error('Failed to load sessions');
    }
  };

  const openUniversity = async (uni: University) => {
    setSelectedUniversity(uni);
    setLoading(true);
    try {
      const [studentsRes, metricsRes, programsRes] = await Promise.all([
        api.get(`/operations/universities/${uni.id}/students`),
        api.get(`/operations/universities/${uni.id}/metrics`),
        api.get('/operations/programs', { params: { universityId: uni.id } }),
      ]);
      setEnrollments(studentsRes.data.data || []);
      setMetrics(metricsRes.data.data || null);
      setPrograms(programsRes.data.data || []);
    } catch {
      toast.error('Failed to load university data');
    } finally {
      setLoading(false);
    }
  };

  const refreshStudents = useCallback(async () => {
    if (!selectedUniversity) return;
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (programFilter !== 'all') params.programId = programFilter;
      if (centerFilter !== 'all') params.studyCenterId = centerFilter;
      if (sessionFilter !== 'all') params.sessionId = sessionFilter;
      const res = await api.get(`/operations/universities/${selectedUniversity.id}/students`, { params });
      setEnrollments(res.data.data || []);
    } catch {
      toast.error('Failed to refresh');
    } finally {
      setLoading(false);
    }
  }, [selectedUniversity, search, programFilter, centerFilter, sessionFilter]);

  useEffect(() => {
    if (selectedUniversity) refreshStudents();
  }, [search, programFilter, centerFilter, sessionFilter, selectedUniversity, refreshStudents]);

  // ── University list view ──────────────────────────────────────────────────
  if (!selectedUniversity) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">University Panels</h2>
          <p className="text-sm text-muted-foreground mt-1">Select a university to view its enrolled students</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">Loading universities...</div>
        ) : universities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <Building2 className="w-8 h-8 opacity-40" />
            <p>No universities found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {universities.map(uni => (
              <button
                key={uni.id}
                onClick={() => openUniversity(uni)}
                className="text-left p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <Badge variant={uni.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                    {uni.status}
                  </Badge>
                </div>
                <h3 className="font-bold text-sm leading-tight">{uni.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{uni.code}</p>
                {uni.address && <p className="text-xs text-muted-foreground mt-0.5 truncate">{uni.address}</p>}
                <div className="mt-3 flex items-center gap-1 text-xs text-primary font-medium">
                  <GraduationCap className="w-3.5 h-3.5" />
                  View enrolled students
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── University detail view ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedUniversity(null); setEnrollments([]); setMetrics(null); }}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          All Universities
        </Button>
        <div className="h-4 w-px bg-border" />
        <div>
          <h2 className="text-lg font-bold">{selectedUniversity.name}</h2>
          <p className="text-xs text-muted-foreground">{selectedUniversity.code}</p>
        </div>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={<GraduationCap className="w-4 h-4" />} label="Total Enrolled" value={metrics.totalEnrolled} />
          <MetricCard icon={<BookOpen className="w-4 h-4" />} label="Active Programs" value={metrics.totalPrograms} />
          <MetricCard icon={<Building2 className="w-4 h-4" />} label="Partner Portals" value={metrics.totalCenters} />
          <MetricCard icon={<TrendingUp className="w-4 h-4" />} label="Last 30 Days" value={metrics.recentEnrollments} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or admission no..."
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
              <SelectItem key={p.id} value={p.id}>{(p).name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={centerFilter} onValueChange={setCenterFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="All Centers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Centers</SelectItem>
            {centers.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sessionFilter} onValueChange={setSessionFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="All Sessions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sessions</SelectItem>
            {sessions.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={refreshStudents} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Students table */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Enrolled Students</CardTitle>
              <CardDescription>Students verified by Operations and enrolled in this university's programs</CardDescription>
            </div>
            <Badge variant="outline">{enrollments.length} students</Badge>
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
            <div className="overflow-x-auto">
<div className="overflow-x-auto w-full">
<table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Admission / Uni ENR No.</th>
                    <th className="text-left py-2 pr-4 font-medium">Student</th>
                    <th className="text-left py-2 pr-4 font-medium">Program</th>
                    <th className="text-left py-2 pr-4 font-medium">Partner Portal</th>
                    <th className="text-left py-2 pr-4 font-medium">Session</th>
                    <th className="text-left py-2 font-medium">Enrolled On</th>
                    <th className="text-left py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {enrollments.map(e => (
                    <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4">
                        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded flex flex-col gap-1 items-start">
                          {e.uniEnrollmentNumber ? (
                            <span className="text-primary font-bold">ENR: {e.uniEnrollmentNumber}</span>
                          ) : null}
                          <span className={e.uniEnrollmentNumber ? "text-muted-foreground" : ""}>ADM: {e.enrollmentNumber || '—'}</span>
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{e.studentName}</p>
                        <p className="text-xs text-muted-foreground">{e.studentEmail}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{e.program?.name || 'Program'}</p>
                        <p className="text-xs text-muted-foreground">{e.program?.code || '—'} · {e.program?.courseType || '—'}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{e.studyCenter?.name || 'Direct'}</p>
                        <p className="text-xs text-muted-foreground">{e.studyCenter?.city || e.studyCenter?.code || 'Direct Admission'}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-xs">{e.session?.name || '—'}</span>
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {e.enrolledAt ? new Date(e.enrolledAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 text-xs">
                        {/* Only operations/admins should see this button ideally, but this panel is generally for operations */}
                        <Button size="sm" variant="ghost" className="h-8 text-xs px-2" onClick={() => {
                          const uniEnr = prompt('Enter University Enrollment Number:', e.uniEnrollmentNumber || '');
                          if (uniEnr !== null) {
                            api.put(`/operations/enrollments/${e.id}`, { uniEnrollmentNumber: uniEnr })
                              .then(() => {
                                toast.success('University Enrollment Number saved');
                                refreshStudents();
                              })
                              .catch(() => toast.error('Failed to update University Enrollment Number'));
                          }
                        }}>
                          Set Uni ENR
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
