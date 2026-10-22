import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, IndianRupee, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { PaymentReceiptPrintModal } from '@/components/dialogs/PaymentReceiptPrintModal';

export function PaymentsPanel() {
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    invoiceId: '',
    amount: '',
    method: 'cash',
    referenceNo: ''
  });

  useEffect(() => {
    fetchPayments();
    fetchInvoices();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/finance/payments');
      setPayments(response.data.data || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      const response = await api.get('/finance/invoices');
      setInvoices(response.data.data || []);
    } catch (error) {
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/finance/payments/${editingId}`, formData);
      } else {
        await api.post('/finance/payments', formData);
      }
      setDialogOpen(false);
      resetForm();
      fetchPayments();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save payment');
    }
  };

  const handleEdit = (payment: any) => {
    const paymentId = payment.id || payment.id;
    const rawInvoice = payment.invoiceId;
    const invoiceId = typeof rawInvoice === 'object' && rawInvoice !== null
      ? (rawInvoice.id || rawInvoice.id)
      : rawInvoice;
    setEditingId(paymentId);
    setFormData({
      invoiceId: invoiceId?.toString() || '',
      amount: payment.amount?.toString() || '',
      method: payment.method || 'cash',
      referenceNo: payment.referenceNo || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const remarks = prompt('Enter deletion remarks (required for audit):');
    if (!remarks) return;
    try {
      await api.delete(`/finance/payments/${id}`, { data: { remarks } });
      fetchPayments();
    } catch (error) {
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      invoiceId: '',
      amount: '',
      method: 'cash',
      referenceNo: ''
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Payment Management</h2>
          <p className="text-muted-foreground">Track and manage payment entries</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Payment</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Payment' : 'Add New Payment'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Invoice</Label>
                <Select value={formData.invoiceId} onValueChange={(value) => setFormData({...formData, invoiceId: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {invoices.filter(inv => inv && (inv.id || inv.id)).map((inv) => (
                      <SelectItem key={inv.id || inv.id} value={(inv.id || inv.id).toString()}>
                        {inv.invoiceNo || inv.id} - ₹{inv.total || inv.amount}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Amount</Label>
                  <Input type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required />
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <Select value={formData.method} onValueChange={(value) => setFormData({...formData, method: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Reference No</Label>
                <Input value={formData.referenceNo} onChange={(e) => setFormData({...formData, referenceNo: e.target.value})} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Save</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No payments found</div>
          ) : (
            <div className="space-y-2">
              {payments.filter(payment => payment && (payment.id || payment.id)).map((payment) => {
                const paymentId = payment.id || payment.id;
                return (
                  <div key={paymentId} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                        <IndianRupee className="w-6 h-6 text-success" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">₹{payment.amount}</div>
                        <div className="text-sm text-muted-foreground">
                          {payment.method} • {payment.referenceNo || 'No reference'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {payment.invoice?.invoiceNo || 'Invoice unavailable'}
                          {' • '}
                          {payment.invoice?.studentDetails?.fullName
                            || payment.invoice?.student?.name
                            || payment.invoice?.enrollment?.studentName
                            || payment.invoice?.center?.name
                            || 'Payer unavailable'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPaymentForReceipt(payment)}
                        className="gap-1.5"
                        title="Download payment receipt"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Receipt</span>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(payment)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(paymentId)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <PaymentReceiptPrintModal
        payment={selectedPaymentForReceipt}
        onOpenChange={open => {
          if (!open) setSelectedPaymentForReceipt(null);
        }}
      />
    </div>
  );
}
