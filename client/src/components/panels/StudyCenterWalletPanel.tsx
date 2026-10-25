import { useState, useEffect } from 'react';
import { Wallet, RefreshCw, Upload, ArrowUpRight, ArrowDownLeft, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface WalletData {
  balance: number;
  studyCenterId: string;
}

interface TopUp {
  id: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  status: string;
  createdAt: string;
  remarks?: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
};

export function StudyCenterWalletPanel() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [topUps, setTopUps] = useState<TopUp[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: '', paymentMethod: 'offline', referenceNumber: '' });
  const [file, setFile] = useState<File | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [walletRes, topUpsRes, txRes] = await Promise.all([
        api.get('/enrollment/wallet'),
        api.get('/enrollment/wallet/topups'),
        api.get('/enrollment/wallet/transactions'),
      ]);
      setWallet(walletRes.data.data);
      setTopUps(topUpsRes.data.data || []);
      setTransactions(txRes.data.data || []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleTopUp = async () => {
    try {
      const formData = new FormData();
      formData.append('amount', form.amount);
      formData.append('paymentMethod', form.paymentMethod);
      if (form.referenceNumber) formData.append('referenceNumber', form.referenceNumber);
      if (file) formData.append('proofDocument', file);

      await api.post('/enrollment/wallet/topup', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Top-up request submitted');
      setOpen(false);
      setForm({ amount: '', paymentMethod: 'bank_transfer', referenceNumber: '' });
      setFile(null);
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to submit top-up');
    }
  };

  const exportToCSV = () => {
    if (transactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }
    const headers = ['Date', 'Type', 'Amount', 'Description', 'Reference', 'Method'];
    const csvContent = [
      headers.join(','),
      ...transactions.map(tx => [
        new Date(tx.createdAt).toLocaleDateString(),
        tx.type.toUpperCase(),
        tx.amount,
        `"${tx.description.replace(/"/g, '""')}"`,
        `"${tx.reference?.replace(/"/g, '""') || ''}"`,
        tx.method
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `wallet_transactions_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Wallet</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage your study center wallet balance.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />Refresh
          </Button>
          {/* <Button size="sm" onClick={() => setOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />Request Top-Up
          </Button> */}
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6 flex items-center gap-6">
          <div className="p-4 rounded-2xl bg-primary/10 text-primary">
            <Wallet className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold">Available Balance</p>
            <p className="text-4xl font-bold tracking-tight mt-1">
              ₹{(wallet?.balance || 0).toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="ledger" className="space-y-6">
        <TabsList>
          <TabsTrigger value="ledger">Wallet Ledger</TabsTrigger>
          <TabsTrigger value="topups">Top-Up Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Account Ledger</CardTitle>
                <CardDescription>Statements of all deposits and enrollment charges.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportToCSV} disabled={transactions.length === 0}>
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
              ) : transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No transactions found.</p>
              ) : (
                <div className="divide-y divide-border border rounded-xl overflow-hidden bg-card">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                          tx.type === 'credit' ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                        )}>
                          {tx.type === 'credit' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{tx.description}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Ref: {tx.reference} • Method: {tx.method}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-sm font-bold",
                          tx.type === 'credit' ? "text-success" : "text-destructive"
                        )}>
                          {tx.type === 'credit' ? '+' : '-'} ₹{tx.amount.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(tx.date).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="topups">
          <Card>
            <CardHeader>
              <CardTitle>Top-Up History</CardTitle>
              <CardDescription>All wallet top-up requests and their status.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
              ) : topUps.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No top-up requests yet.</p>
              ) : (
                <div className="space-y-3">
                  {topUps.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className={cn('text-[10px] uppercase font-bold', STATUS_COLOR[t.status] || 'bg-muted text-muted-foreground')}>
                            {t.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{t.paymentMethod}</span>
                        </div>
                        <p className="text-sm font-semibold mt-1">₹{t.amount.toLocaleString()}</p>
                        {t.referenceNumber && <p className="text-xs text-muted-foreground">Ref: {t.referenceNumber}</p>}
                        {t.remarks && <p className="text-xs text-destructive mt-1">{t.remarks}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Wallet Top-Up</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Amount (₹)</Label>
              <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 10000" />
            </div>
            <div className="space-y-1">
              <Label>Payment Method</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.paymentMethod}
                onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
              >
                <option value="offline">Offline / Bank Transfer</option>
                <option value="online">Online</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Reference Number</Label>
              <Input value={form.referenceNumber} onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))} placeholder="UTR / Cheque number" />
            </div>
            <div className="space-y-1">
              <Label>Payment Proof</Label>
              <Input type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
              <p className="text-xs text-muted-foreground mt-1">Upload receipt or screenshot (Optional)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleTopUp} disabled={!form.amount || !form.paymentMethod || loading}>
              {loading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
