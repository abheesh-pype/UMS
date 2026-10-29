import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, Clock, DollarSign, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface SalaryConfig {
  id: string;
  userId: { id: string; name: string; email: string; designation?: string; role: string; departmentId?: { name: string } };
  basicSalary: number;
  allowances: { hra: number; transport: number; medical: number; other: number };
  deductions: { pf: number; tax: number; insurance: number; other: number };
  lateDeductionPerMinute: number;
  effectiveFrom: string;
  approvalStatus: 'pending_approval' | 'approved' | 'rejected';
  approvedBy?: { name: string; email: string };
  approvedAt?: string;
  rejectedRemarks?: string;
  createdBy?: { name: string };
  updatedAt: string;
}

interface Summary { pending_approval: number; approved: number; rejected: number }

const STATUS_META = {
  pending_approval: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <Clock className="w-3 h-3" /> },
  approved:         { label: 'Approved', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle className="w-3 h-3" /> },
  rejected:         { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="w-3 h-3" /> },
};

const TABS = [
  { key: '', label: 'All' },
  { key: 'pending_approval', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export function FinanceSalaryApprovalPanel() {
  const [configs, setConfigs] = useState<SalaryConfig[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  // Opens on All so pending, approved and rejected salary configurations are listed together
  const [statusFilter, setStatusFilter] = useState('');
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [remarks, setRemarks] = useState('');
  const [detailConfig, setDetailConfig] = useState<SalaryConfig | null>(null);

  const fetchData = async (status = statusFilter) => {
    setLoading(true);
    try {
      const params = status ? `?status=${status}` : '';
      const res = await api.get(`/finance/salary-configs${params}`);
      setConfigs(res.data.data || []);
      setSummary(res.data.summary || null);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load salary configs');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const handleTabChange = (key: string) => {
    setStatusFilter(key);
    fetchData(key);
  };

  const handleApprove = async (id: string) => {
    try {
      await api.put(`/finance/salary-configs/${id}/approve`, { action: 'approve' });
      toast.success('Salary config approved');
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    try {
      await api.put(`/finance/salary-configs/${rejectDialog.id}/approve`, { action: 'reject', remarks });
      toast.success('Salary config rejected');
      setRejectDialog({ open: false, id: '' });
      setRemarks('');
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to reject');
    }
  };

  const gross = (c: SalaryConfig) =>
    c.basicSalary + Object.values(c.allowances).reduce((s, v) => s + (v || 0), 0);
  const net = (c: SalaryConfig) =>
    gross(c) - Object.values(c.deductions).reduce((s, v) => s + (v || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Salary Config Approvals</h2>
          <p className="text-muted-foreground text-sm mt-1">Review and approve salary configurations set by HR.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />Refresh
        </Button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="cursor-pointer hover:border-yellow-400/50 transition-colors" onClick={() => handleTabChange('pending_approval')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600"><Clock className="w-4 h-4" /></div>
              <div>
                <p className="text-xl font-bold">{summary.pending_approval}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-green-400/50 transition-colors" onClick={() => handleTabChange('approved')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600"><CheckCircle className="w-4 h-4" /></div>
              <div>
                <p className="text-xl font-bold">{summary.approved}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-red-400/50 transition-colors" onClick={() => handleTabChange('rejected')}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500"><XCircle className="w-4 h-4" /></div>
              <div>
                <p className="text-xl font-bold">{summary.rejected}</p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              statusFilter === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {tab.label}
            {summary && tab.key && (
              <span className="ml-1.5 opacity-70">{summary[tab.key as keyof Summary] ?? 0}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : configs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>No salary configs{statusFilter ? ` with status "${statusFilter.replace('_', ' ')}"` : ''}.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {configs.map(config => {
            const user = (config as any).user || (typeof config.userId === 'object' ? config.userId : null);
            const meta = STATUS_META[config.approvalStatus];
            const grossAmt = gross(config);
            const netAmt = net(config);
            return (
              <Card key={config.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      {/* Status + name */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', meta.color)}>
                          {meta.icon}{meta.label}
                        </span>
                        <span className="font-semibold">{user?.name || 'Employee'}</span>
                        <Badge variant="outline" className="text-xs capitalize">{user?.role?.replace(/_/g, ' ')}</Badge>
                        {user?.designation && <Badge variant="outline" className="text-xs">{user.designation}</Badge>}
                        {user?.departmentId && <span className="text-xs text-muted-foreground">{user.departmentId.name}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{user?.email}</p>

                      {/* Salary breakdown */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Basic</p>
                          <p className="font-semibold">₹{config.basicSalary.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">HRA</p>
                          <p className="font-semibold">₹{(config.allowances.hra || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Gross</p>
                          <p className="font-semibold text-blue-600">₹{grossAmt.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Deductions</p>
                          <p className="font-semibold text-red-500">
                            ₹{Object.values(config.deductions).reduce((s, v) => s + (v || 0), 0).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Net</p>
                          <p className="font-semibold text-green-600">₹{netAmt.toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Meta info */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        {config.createdBy && <span>Set by: {config.createdBy.name}</span>}
                        <span>Updated: {new Date(config.updatedAt).toLocaleDateString()}</span>
                        {config.approvedBy && (
                          <span>
                            {config.approvalStatus === 'rejected' ? 'Rejected' : 'Approved'} by: {config.approvedBy.name}
                            {config.approvedAt && ` · ${new Date(config.approvedAt).toLocaleDateString()}`}
                          </span>
                        )}
                        {config.rejectedRemarks && (
                          <span className="text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />{config.rejectedRemarks}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => setDetailConfig(config)}>
                        Details
                      </Button>
                      {config.approvalStatus === 'pending_approval' && (
                        <>
                          <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20" onClick={() => handleApprove(config.id)}>
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => { setRejectDialog({ open: true, id: config.id }); setRemarks(''); }}>
                            <XCircle className="w-3.5 h-3.5 mr-1" />Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={o => setRejectDialog(d => ({ ...d, open: o }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Salary Config</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason for rejection (required)</Label>
            <Input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Basic salary exceeds approved band..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, id: '' })}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!remarks.trim()}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailConfig} onOpenChange={o => !o && setDetailConfig(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Salary Config — {(detailConfig as any)?.user?.name || detailConfig?.userId?.name}</DialogTitle></DialogHeader>
          {detailConfig && (
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Basic Salary</p><p className="font-semibold">₹{detailConfig.basicSalary.toLocaleString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Late/min</p><p className="font-semibold">₹{detailConfig.lateDeductionPerMinute}</p></div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Allowances</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(detailConfig.allowances).map(([k, v]) => (
                    <div key={k} className="flex justify-between p-2 rounded-lg bg-muted/40">
                      <span className="capitalize text-muted-foreground">{k}</span>
                      <span className="font-medium">₹{(v || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Deductions</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(detailConfig.deductions).map(([k, v]) => (
                    <div key={k} className="flex justify-between p-2 rounded-lg bg-muted/40">
                      <span className="capitalize text-muted-foreground">{k}</span>
                      <span className="font-medium text-red-500">₹{(v || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-xl bg-muted/50 font-semibold">
                <div><p className="text-xs text-muted-foreground">Gross</p><p className="text-blue-600">₹{gross(detailConfig).toLocaleString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Deductions</p><p className="text-red-500">₹{Object.values(detailConfig.deductions).reduce((s, v) => s + (v || 0), 0).toLocaleString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Net</p><p className="text-green-600">₹{net(detailConfig).toLocaleString()}</p></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailConfig(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
