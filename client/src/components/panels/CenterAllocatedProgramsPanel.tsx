import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AllocatedProgram {
  id: string;
  isActive: boolean;
  allocatedAt: string;
  enrollable: boolean;
  program: {
    id: string;
    name: string;
    code: string;
    courseType: string;
    duration: number;
    status: string;
    isDeleted: boolean;
    university: { id: string; name: string; code: string } | null;
    academicSession: { id: string; name: string; status: string } | null;
  };
  admissionSession: { id: string; name: string; status: string; startDate: string; endDate: string } | null;
}

type StatusFilter = 'all' | 'active' | 'inactive';

// Why an allocated program is missing from Add New Student Record
const getUnavailableReason = (allocation: AllocatedProgram) => {
  if (!allocation.isActive) return 'Allocation deactivated by Operations';
  if (allocation.program.isDeleted || allocation.program.status !== 'active') return 'Program is inactive';
  return '';
};

export function CenterAllocatedProgramsPanel() {
  const [allocations, setAllocations] = useState<AllocatedProgram[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const loadAllocations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/enrollment/allocated-programs');
      setAllocations(res.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load allocated programs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllocations();
  }, []);

  const visibleAllocations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allocations.filter(allocation => {
      if (statusFilter === 'active' && !allocation.enrollable) return false;
      if (statusFilter === 'inactive' && allocation.enrollable) return false;
      if (!query) return true;
      return [allocation.program.name, allocation.program.code, allocation.program.university?.name, allocation.admissionSession?.name]
        .some(value => value?.toLowerCase().includes(query));
    });
  }, [allocations, search, statusFilter]);

  const activeCount = allocations.filter(allocation => allocation.enrollable).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Allocated Programs</h2>
          <p className="text-muted-foreground text-sm mt-1">Programs allocated to your study center by Operations. Active programs are available in Add New Student Record.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAllocations} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Total Allocated" value={allocations.length} />
        <SummaryCard label="Active" value={activeCount} className="text-green-600" />
        <SummaryCard label="Inactive" value={allocations.length - activeCount} className="text-muted-foreground" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search program, code, university or session"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={value => setStatusFilter(value as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All programs</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && allocations.length === 0 ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : visibleAllocations.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{allocations.length === 0 ? 'No programs have been allocated to your study center yet.' : 'No programs match your filters.'}</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">Program</th>
                    <th className="p-3 font-medium">University</th>
                    <th className="p-3 font-medium">Admission Session</th>
                    <th className="p-3 font-medium">Duration</th>
                    <th className="p-3 font-medium">Allocated On</th>
                    <th className="p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAllocations.map(allocation => {
                    const session = allocation.admissionSession || allocation.program.academicSession;
                    const reason = getUnavailableReason(allocation);
                    return (
                      <tr key={allocation.id} className="border-t border-border align-top">
                        <td className="p-3">
                          <p className="font-medium">{allocation.program.name}</p>
                          <p className="text-xs text-muted-foreground">{allocation.program.code} · {allocation.program.courseType}</p>
                        </td>
                        <td className="p-3">{allocation.program.university?.name || '—'}</td>
                        <td className="p-3">
                          <p>{session?.name || '—'}</p>
                          {session && <p className="text-xs text-muted-foreground capitalize">{session.status}</p>}
                        </td>
                        <td className="p-3 whitespace-nowrap">{allocation.program.duration ? `${allocation.program.duration} months` : '—'}</td>
                        <td className="p-3 whitespace-nowrap">{new Date(allocation.allocatedAt).toLocaleDateString()}</td>
                        <td className="p-3">
                          {allocation.enrollable ? (
                            <Badge className="bg-green-500/10 text-green-700 border-green-500/30">Active</Badge>
                          ) : (
                            <div className="space-y-1">
                              <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                              <p className="text-xs text-muted-foreground">{reason}</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('text-2xl font-bold mt-1', className)}>{value}</p>
      </CardContent>
    </Card>
  );
}
