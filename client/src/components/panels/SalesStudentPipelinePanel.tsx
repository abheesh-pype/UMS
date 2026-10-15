import { useState, useEffect } from 'react';
import { RefreshCw, GraduationCap, Search, ChevronDown, ChevronUp, User, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import { EditSalesStudentDialog } from '@/components/dialogs/EditSalesStudentDialog';

interface StatusHistoryEntry {
  status: string;
  actorId: string;
  actorName?: string;
  actorRole?: string;
  timestamp: string;
  note?: string;
  remarks?: string;
}

interface Enrollment {
  id: string;
  enrollmentNumber?: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  status: string;
  createdAt: string;
  enrolledAt?: string;
  departmentRemarks?: string;
  financeRemarks?: string;
  statusHistory: StatusHistoryEntry[];
  program: { name: string; code: string; courseType: string };
  studyCenter: { name: string; code: string };
  session: { name: string };
  departmentReviewer?: { name: string; email: string };
  financeReviewer?: { name: string; email: string };
}

interface Summary {
  total: number;
  document_review: number;
  finance_review: number;
  enrolled: number;
  ops_rejected: number;
  rejected: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  document_review: { label: 'Ops Review', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock className="w-3 h-3" /> },
  pending_doc_review: { label: 'Ops Review', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock className="w-3 h-3" /> },
  finance_review: { label: 'Finance Review', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Clock className="w-3 h-3" /> },
  pending_finance_review: { label: 'Finance Review', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Clock className="w-3 h-3" /> },
  payment_pending: { label: 'Payment Pending', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <Clock className="w-3 h-3" /> },
  enrolled: { label: 'Enrolled', color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle className="w-3 h-3" /> },
  ops_rejected: { label: 'Rejected by Ops', color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle className="w-3 h-3" /> },
  department_rejected: { label: 'Rejected by Ops', color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle className="w-3 h-3" /> },
  rejected: { label: 'Rejected by Finance', color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle className="w-3 h-3" /> },
  finance_rejected: { label: 'Rejected by Finance', color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle className="w-3 h-3" /> },
  submitted: { label: 'Submitted', color: 'bg-muted text-muted-foreground', icon: <Clock className="w-3 h-3" /> },
};

const ROLE_LABELS: Record<string, string> = {
  ops_admin: 'Operations',
  finance_admin: 'Finance',
  sales_admin: 'Sales',
  student: 'Student',
  system: 'System',
};

export function SalesStudentPipelinePanel() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [centerFilter, setCenterFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingEnrollment, setEditingEnrollment] = useState<any | null>(null);

  const fetchPipeline = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sales/student-applications');
      setEnrollments(res.data.data || []);
      setSummary(res.data.summary || null);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPipeline(); }, []);

  const filtered = enrollments.filter(e => {
    const matchesSearch = !search ||
      e.studentName.toLowerCase().includes(search.toLowerCase()) ||
      e.studentEmail.toLowerCase().includes(search.toLowerCase()) ||
      e.program.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchesProgram = programFilter === 'all' || (e.program && e.program.name === programFilter);
    const matchesCenter = centerFilter === 'all' || (e.studyCenter && e.studyCenter.name === centerFilter);
    return matchesSearch && matchesStatus && matchesProgram && matchesCenter;
  });

  const uniquePrograms = Array.from(new Set(enrollments.map(e => e.program?.name).filter(Boolean)));
  const uniqueCenters = Array.from(new Set(enrollments.map(e => e.studyCenter?.name).filter(Boolean)));
  
  const statusCfg = (status: string) => STATUS_CONFIG[status] || { label: status.replace(/_/g, ' '), color: 'bg-muted text-muted-foreground', icon: <Clock className="w-3 h-3" /> };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Student Application Pipeline</h2>
          <p className="text-sm text-muted-foreground mt-1">Track all applications submitted via your invite links</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPipeline} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { key: 'total', label: 'Total', color: 'text-foreground' },
            { key: 'document_review', label: 'Ops Review', color: 'text-yellow-600' },
            { key: 'finance_review', label: 'Finance', color: 'text-blue-600' },
            { key: 'enrolled', label: 'Enrolled', color: 'text-green-600' },
            { key: 'ops_rejected', label: 'Ops Rejected', color: 'text-red-600' },
            { key: 'rejected', label: 'Fin. Rejected', color: 'text-red-600' },
          ].map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
              className={cn(
                'p-3 rounded-xl border text-left transition-all hover:border-primary/40',
                statusFilter === key ? 'border-primary bg-primary/5' : 'border-border bg-card'
              )}
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn('text-2xl font-bold mt-0.5', color)}>{(summary)[key]}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or program..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={programFilter} onValueChange={setProgramFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Programs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programs</SelectItem>
            {uniquePrograms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={centerFilter} onValueChange={setCenterFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Centers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Centers</SelectItem>
            {uniqueCenters.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Enrollment list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No applications found</p>
            <p className="text-sm mt-1">Share your invite link to collect student applications</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(e => {
            const cfg = statusCfg(e.status);
            const isExpanded = expandedId === e.id;
            const history: StatusHistoryEntry[] = Array.isArray(e.statusHistory) ? e.statusHistory : [];

            return (
              <Card key={e.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium', cfg.color)}>
                          {cfg.icon}{cfg.label}
                        </span>
                        {e.enrollmentNumber && (
                          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{e.enrollmentNumber}</span>
                        )}
                      </div>
                      <h4 className="font-semibold">{e.studentName}</h4>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-muted-foreground">
                        <span>{e.studentEmail}</span>
                        <span>{e.program.name} ({e.program.code})</span>
                        <span>{new Date(e.createdAt).toLocaleDateString()}</span>
                      </div>
                      {/* Current handler */}
                      {e.status === 'document_review' && (
                        <p className="text-xs text-yellow-600 mt-1 font-medium">📋 Waiting for Operations review</p>
                      )}
                      {e.status === 'finance_review' && (
                        <p className="text-xs text-blue-600 mt-1 font-medium">
                          💰 With Finance{e.departmentReviewer ? ` — verified by ${e.departmentReviewer.name}` : ''}
                        </p>
                      )}
                      {e.status === 'enrolled' && (
                        <p className="text-xs text-green-600 mt-1 font-medium">
                          ✅ Enrolled{e.enrolledAt ? ` on ${new Date(e.enrolledAt).toLocaleDateString()}` : ''}
                          {e.financeReviewer ? ` — approved by ${e.financeReviewer.name}` : ''}
                        </p>
                      )}
                      {(e.status === 'ops_rejected' || e.status === 'rejected') && (
                        <p className="text-xs text-red-600 mt-1 font-medium">
                          ❌ {e.departmentRemarks || e.financeRemarks}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(e.status === 'ops_rejected' || e.status === 'department_rejected') && (
                        <Button
                          size="sm"
                          className="bg-amber-600 text-white hover:bg-amber-700 h-8 text-xs font-medium"
                          onClick={() => setEditingEnrollment(e)}
                        >
                          <RefreshCw className="mr-1.5 h-3 w-3" />
                          Edit &amp; Re-submit
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(isExpanded ? null : e.id)}
                        className="shrink-0"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded: full status timeline */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Application Timeline</p>
                      <div className="space-y-3">
                        {history.map((h, i) => (
                          <div key={i} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={cn(
                                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                                h.status === 'enrolled' ? 'bg-green-100 text-green-700' :
                                h.status.includes('rejected') ? 'bg-red-100 text-red-700' :
                                'bg-muted text-muted-foreground'
                              )}>
                                <User className="w-3.5 h-3.5" />
                              </div>
                              {i < history.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                            </div>
                            <div className="pb-3 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium capitalize">{h.status.replace(/_/g, ' ')}</span>
                                {h.actorName && (
                                  <span className="text-xs text-muted-foreground">
                                    by {h.actorName} ({ROLE_LABELS[h.actorRole || ''] || h.actorRole || 'System'})
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {new Date(h.timestamp).toLocaleString()}
                                </span>
                              </div>
                              {h.note && <p className="text-xs text-muted-foreground mt-0.5">{h.note}</p>}
                              {h.remarks && (
                                <p className="text-xs text-red-600 mt-0.5 font-medium">Reason: {h.remarks}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit & Re-submit Dialog */}
      <EditSalesStudentDialog
        open={!!editingEnrollment}
        onOpenChange={(open) => !open && setEditingEnrollment(null)}
        enrollment={editingEnrollment}
        onSuccess={fetchPipeline}
      />
    </div>
  );
}
