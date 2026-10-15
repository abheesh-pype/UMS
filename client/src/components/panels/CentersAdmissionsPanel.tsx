import { useState, useEffect } from 'react';
import { RefreshCw, Search, School, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { FinanceCenterVerificationPanel } from '@/components/panels/FinanceCenterVerificationPanel';

interface Enrollment {
  id: string;
  enrollmentNumber?: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
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

export function CentersAdmissionsPanel() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const departmentType = ((user as any)?.department?.type || (user as any)?.subDepartment?.parentDept?.type || '').toLowerCase();
  const isFinanceDepartment = ['finance_admin', 'finance_sub_admin'].includes(user?.role || '') || departmentType === 'finance';

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

      {isFinanceDepartment && <FinanceCenterVerificationPanel />}

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
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
