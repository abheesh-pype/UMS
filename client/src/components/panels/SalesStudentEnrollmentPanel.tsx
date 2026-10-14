import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import api from '@/lib/api';
import { toast } from 'sonner';
import { EnrollStudentPanel } from '@/components/panels/EnrollStudentPanel';

interface SalesEnrollment {
  id: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  status: string;
  createdAt: string;
  program?: { name: string; code: string } | null;
  session?: { name: string } | null;
  salesUser?: { id: string; name: string; email: string } | null;
}

export function SalesStudentEnrollmentPanel() {
  const [enrollments, setEnrollments] = useState<SalesEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/sales/student-applications');
      setEnrollments(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load student enrollments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  if (showForm) {
    return (
      <EnrollStudentPanel
        mode="sales"
        onSubmitted={() => {
          setShowForm(false);
          fetchEnrollments();
        }}
        onBack={() => setShowForm(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Student Enrollment</h2>
          <p className="mt-1 text-sm text-muted-foreground">View and manage student applications submitted by you and your sales team.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchEnrollments} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Student
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map(row => <div key={row} className="h-10 animate-pulse rounded bg-muted" />)}
            </div>
          ) : enrollments.length === 0 ? (
            <p className="py-14 text-center text-sm text-muted-foreground">No student applications found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Student Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Program</th>
                    <th className="px-4 py-3 font-medium">Admission Session</th>
                    <th className="px-4 py-3 font-medium">Enrolled By</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map(enrollment => (
                    <tr key={enrollment.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{enrollment.studentName}</td>
                      <td className="px-4 py-3">{enrollment.studentEmail}</td>
                      <td className="px-4 py-3">{enrollment.studentPhone}</td>
                      <td className="px-4 py-3">{enrollment.program?.name || '—'}{enrollment.program?.code ? ` (${enrollment.program.code})` : ''}</td>
                      <td className="px-4 py-3">{enrollment.session?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{enrollment.salesUser?.name || '—'}</span>
                        {enrollment.salesUser?.email && (
                          <span className="block text-xs text-muted-foreground">{enrollment.salesUser.email}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{enrollment.status.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="px-4 py-3">{new Date(enrollment.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
