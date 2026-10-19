import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { CreditCard, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface RecordInvoicePaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any | null;
  onSuccess: (updatedInvoice?: any, receiptNo?: string) => void;
}

export const RecordInvoicePaymentModal: React.FC<RecordInvoicePaymentModalProps> = ({
  open,
  onOpenChange,
  invoice,
  onSuccess
}) => {
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<string>('UPI');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [receivedAt, setReceivedAt] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invoice && open) {
      setAmount(String(invoice.balanceAmount > 0 ? invoice.balanceAmount : 0));
      setMethod('UPI');
      setReferenceNo('');
      setReceivedAt(new Date().toISOString().split('T')[0]);
      setNotes('');
      setError(null);
    }
  }, [invoice, open]);

  if (!invoice) return null;

  const formatCurrency = (val: number | string | undefined | null) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/finance/invoices/${invoice.id}/payments`, {
        amount: payAmount,
        method,
        referenceNo: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        receivedAt: receivedAt ? new Date(receivedAt).toISOString() : new Date().toISOString()
      });

      const receiptNo = res.data?.receiptNo || 'RCP-GENERATED';
      onSuccess(res.data?.data, receiptNo);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const studentName = invoice.studentDetails?.fullName || invoice.student?.name || invoice.enrollment?.studentName || 'Student';
  const programName = invoice.studentDetails?.programName || invoice.enrollment?.program?.name || '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <CreditCard className="w-5 h-5 text-primary" />
            <span>Record Payment & Issue Receipt</span>
          </DialogTitle>
        </DialogHeader>

        {/* Invoice Summary Card */}
        <div className="bg-muted/60 p-3.5 rounded-lg border text-xs space-y-1.5 my-2">
          <div className="flex justify-between font-medium">
            <span className="text-muted-foreground">Invoice No:</span>
            <span className="font-mono font-bold">{invoice.invoiceNo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Student:</span>
            <span className="font-semibold">{studentName}</span>
          </div>
          {programName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Program:</span>
              <span className="truncate max-w-[200px]">{programName}</span>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t mt-2 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Total Fee</p>
              <p className="font-bold text-sm font-mono">{formatCurrency(invoice.total)}</p>
            </div>
            <div>
              <p className="text-[10px] text-emerald-700 uppercase">Paid So Far</p>
              <p className="font-bold text-sm font-mono text-emerald-700">{formatCurrency(invoice.paidAmount)}</p>
            </div>
            <div>
              <p className="text-[10px] text-rose-700 uppercase">Balance Due</p>
              <p className="font-bold text-sm font-mono text-rose-700">{formatCurrency(invoice.balanceAmount)}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-xs rounded-md border border-destructive/20">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Label htmlFor="pay-amount" className="text-xs font-semibold">Payment Amount (₹) *</Label>
              {invoice.balanceAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(invoice.balanceAmount))}
                  className="text-[11px] text-primary hover:underline"
                >
                  Pay Full Balance ({formatCurrency(invoice.balanceAmount)})
                </button>
              )}
            </div>
            <Input
              id="pay-amount"
              type="number"
              min="1"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              required
              className="font-mono text-base font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay-method" className="text-xs font-semibold">Payment Mode *</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="pay-method" className="text-xs">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPI">UPI / QR Code</SelectItem>
                  <SelectItem value="Net Banking">Net Banking</SelectItem>
                  <SelectItem value="NEFT / RTGS">NEFT / RTGS</SelectItem>
                  <SelectItem value="Cheque / DD">Cheque / DD</SelectItem>
                  <SelectItem value="Debit Card">Debit Card</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Cash">Cash Deposit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-date" className="text-xs font-semibold">Payment Date *</Label>
              <Input
                id="pay-date"
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                required
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-ref" className="text-xs font-semibold">Transaction Reference / UTR Number</Label>
            <Input
              id="pay-ref"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="e.g. UTR38491823901 or Cheque #982102"
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-notes" className="text-xs font-semibold">Payment Notes / Remarks (Optional)</Label>
            <Input
              id="pay-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 1st installment clearance"
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Recording & Generating Receipt...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirm Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
