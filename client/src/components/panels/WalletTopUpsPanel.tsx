import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import { resolveFileUrl } from '@/lib/fileUrl';

interface TopUp {
  id: string;
  studyCenterId: { name?: string; id?: string } | string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  status: string;
  createdAt: string;
  remarks?: string;
  proofDocument?: string;
}

interface LedgerEntry {
  id: string;
  date: string;
  type: 'credit' | 'debit';
  amount: number;
  method: string;
  reference: string;
  description: string;
  centerName: string;
  centerCode: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
};

export function WalletTopUpsPanel() {
  const [activeTab, setActiveTab] = useState<'requests' | 'ledger'>('requests');
  const [topUps, setTopUps] = useState<TopUp[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<string>('__all__');
  const [loading, setLoading] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [remarks, setRemarks] = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      if (activeTab === 'requests') {
        const res = await api.get('/finance/wallet-topups');
        setTopUps(res.data.data || []);
      } else {
        const res = await api.get(`/finance/wallet-ledger?studyCenterId=${selectedCenter}`);
        setLedger(res.data.data || []);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load study centers list for filtering ledger
    api.get('/operations/centers').then(res => {
      setCenters(res.data.data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedCenter]);

  const handleApprove = async (id: string) => {
    try {
      await api.put(`/finance/wallet-topups/${id}/approve`);
      toast.success('Top-up approved');
      fetch();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    try {
      await api.put(`/finance/wallet-topups/${rejectDialog.id}/reject`, { remarks });
      toast.success('Top-up rejected');
      setRejectDialog({ open: false, id: '' });
      setRemarks('');
      fetch();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to reject');
    }
  };

  const getCenterName = (t: TopUp) =>
    typeof t.studyCenterId === 'object' ? t.studyCenterId.name || 'Unknown' : t.studyCenterId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">Wallet Operations</h2>
          <p className="text-muted-foreground text-sm mt-1">Approve wallet top-up requests or view the unified study center ledger.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-muted p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('requests')}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                activeTab === 'requests' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Top-Up Requests
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                activeTab === 'ledger' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Wallet Ledger
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={fetch} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />Refresh
          </Button>
        </div>
      </div>

      {activeTab === 'ledger' && (
        <Card className="border shadow-sm">
          <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-muted-foreground">Filter by Center:</span>
            </div>
            <div className="w-[280px]">
              <Select value={selectedCenter} onValueChange={setSelectedCenter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Study Centers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Study Centers</SelectItem>
                  {centers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : activeTab === 'requests' ? (
        topUps.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">No top-up requests found.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {topUps.map(t => (
              <Card key={t.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-5 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={cn('text-[10px] uppercase font-bold', STATUS_COLOR[t.status] || 'bg-muted text-muted-foreground')}>
                        {t.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{t.paymentMethod}</Badge>
                    </div>
                    <h4 className="font-semibold">{getCenterName(t)}</h4>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>Amount: <strong className="text-foreground">₹{t.amount.toLocaleString()}</strong></span>
                      {t.referenceNumber && <span>Ref: {t.referenceNumber}</span>}
                      {t.proofDocument && (
                        <a href={resolveFileUrl(t.proofDocument)} target="_blank" rel="noreferrer" className="text-primary hover:underline font-semibold">
                          View Proof
                        </a>
                      )}
                      <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {t.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-success border-success/30 hover:bg-success/10" onClick={() => handleApprove(t.id)}>
                        <CheckCircle className="w-4 h-4 mr-1" />Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { setRejectDialog({ open: true, id: t.id }); setRemarks(''); }}>
                        <XCircle className="w-4 h-4 mr-1" />Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : ledger.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No ledger transactions found.</CardContent></Card>
      ) : (
        <Card className="overflow-hidden border">
          <div className="overflow-x-auto">
<div className="overflow-x-auto w-full">
<table className="w-full text-sm">
              <thead className="bg-muted/60 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Study Center</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Reference</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Credit (₹)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Debit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ledger.map(item => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(item.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <div className="font-semibold">{item.centerName}</div>
                      <div className="text-[10px] text-muted-foreground">{item.centerCode}</div>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate">{item.description}</td>
                    <td className="px-4 py-3 text-xs capitalize whitespace-nowrap">{item.method.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{item.reference}</td>
                    <td className="px-4 py-3 text-right font-semibold text-success">
                      {item.type === 'credit' ? `+₹${item.amount.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-destructive">
                      {item.type === 'debit' ? `-₹${item.amount.toLocaleString()}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
</div>
          </div>
        </Card>
      )}

      <Dialog open={rejectDialog.open} onOpenChange={o => setRejectDialog(d => ({ ...d, open: o }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Top-Up</DialogTitle></DialogHeader>
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
    </div>
  );
}
