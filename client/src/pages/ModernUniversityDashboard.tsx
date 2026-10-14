import { useState, useEffect, useCallback } from 'react';
import { GraduationCap, BookOpen, Building2, TrendingUp, Search, RefreshCw, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { toast } from 'sonner';
import { UniversityEnrollmentReviewPanel } from '@/components/panels/UniversityEnrollmentReviewPanel';
import { MyDocumentsPanel } from '@/components/panels/hr/MyDocumentsPanel';
import { PendingCenterVerificationPanel } from '@/components/panels/PendingCenterVerificationPanel';


interface Enrollment {
  id: string;
  enrollmentNumber?: string;
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
}

interface Program { id: string; name: string; code: string; }

export function ModernUniversityDashboard({ initialTab, onNavigate }: { initialTab?: string, onNavigate?: (tab: string) => void }) {
  const { user } = useAuth();
  const universityId = (user as any)?.universityId;
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('all');
  const [uniName, setUniName] = useState('University');

  useEffect(() => {
    setActiveTab(initialTab || 'overview');
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{uniName}</h1>
        <p className="text-sm text-muted-foreground mt-1">University Admin Panel — enrolled students and programs</p>
      </div>

      {/* Metrics */}
      {metrics && (
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
            <div className="overflow-x-auto">
<div className="overflow-x-auto w-full">
<table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Enrollment No.</th>
                    <th className="text-left py-2 pr-4 font-medium">Student</th>
                    <th className="text-left py-2 pr-4 font-medium">Program</th>
                    <th className="text-left py-2 pr-4 font-medium">Partner Portal</th>
                    <th className="text-left py-2 pr-4 font-medium">Session</th>
                    <th className="text-left py-2 font-medium">Enrolled On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {enrollments.map(e => (
                    <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4">
                        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                          {e.enrollmentNumber || '—'}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{e.studentName}</p>
                        <p className="text-xs text-muted-foreground">{e.studentEmail}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{e.program.name}</p>
                        <p className="text-xs text-muted-foreground">{e.program.code} · {e.program.courseType}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{e.studyCenter.name}</p>
                        <p className="text-xs text-muted-foreground">{e.studyCenter.city || e.studyCenter.code}</p>
                      </td>
                      <td className="py-3 pr-4 text-xs">{e.session.name}</td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {e.enrolledAt ? new Date(e.enrolledAt).toLocaleDateString() : '—'}
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
    { id: '__uni_section', label: 'University', isSection: true },
    { id: 'overview', label: 'Dashboard' },
    { id: 'pending-review', label: 'Pending Review' },
    { id: 'students', label: 'Enrolled Students' },
  ];
}
