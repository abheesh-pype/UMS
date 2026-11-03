import { useState, useEffect } from 'react';
import { Plus, Pencil, RefreshCw, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface University { id: string; name: string; code: string; }
interface AuthFee { id: string; universityId: University; amount: number; currency: string; updatedAt: string; }

export function FinanceAuthFeePanel() {
  const [fees, setFees] = useState<AuthFee[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AuthFee | null>(null);
  const [form, setForm] = useState({ universityId: '', amount: '', currency: 'INR' });
  const [submitting, setSubmitting] = useState(false);

  const fetchFees = async () => {
    setLoading(true);
    try {
      const res = await api.get('/finance/auth-fees');
      setFees(res.data.data || []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load auth fees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFees();
    api.get('/operations/universities').then(r => setUniversities(r.data.data || [])).catch(() => {});
  }, []);

  // Single tenancy: there is exactly one university, so the fee is always for it.
  const university = universities[0];
  const hasFee = fees.some(fee => fee.universityId?.id === university?.id);

  const openCreate = () => { setEditing(null); setForm({ universityId: university?.id || '', amount: '', currency: 'INR' }); setOpen(true); };
  const openEdit = (fee: AuthFee) => {
    setEditing(fee);
    setForm({ universityId: fee.universityId.id, amount: String(fee.amount), currency: fee.currency });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.universityId || !form.amount) { toast.error('University and amount are required'); return; }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) { toast.error('Amount must be greater than zero'); return; }

    setSubmitting(true);
    try {
      if (editing) {
        await api.put(`/finance/auth-fees/${editing.id}`, { amount, currency: form.currency });
      } else {
        await api.post('/finance/auth-fees', { universityId: form.universityId, amount, currency: form.currency });
      }
      toast.success(editing ? 'Auth fee updated' : 'Auth fee configured');
      setOpen(false);
      fetchFees();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">University Auth Fees</h2>
          <p className="text-muted-foreground text-sm mt-1">Configure the authorisation fee required per university for study center onboarding.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchFees} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />Refresh
          </Button>
          <Button
            size="sm"
            onClick={openCreate}
            disabled={!university || hasFee}
            title={hasFee ? 'The auth fee is already configured. Use the edit button to change it.' : undefined}
          >
            <Plus className="w-4 h-4 mr-2" />Add Fee
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : fees.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No auth fees configured yet.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {fees.map(fee => (
            <Card key={fee.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{fee.universityId.name}</p>
                  <p className="text-xs text-muted-foreground">{fee.universityId.code}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-bold">{fee.currency} {fee.amount.toLocaleString()}</span>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(fee)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Auth Fee' : 'Configure Auth Fee'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="authFeeUniversity">University</Label>
              <Input
                id="authFeeUniversity"
                value={editing
                  ? `${editing.universityId.name} (${editing.universityId.code})`
                  : university ? `${university.name} (${university.code})` : 'Loading university...'}
                disabled
                readOnly
              />
            </div>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="e.g. 5000"
              />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Input value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} placeholder="INR" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : editing ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
