import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, FileSpreadsheet, Receipt } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InvoiceReceiptsModalProps {
  invoice: any | null;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (amount: number | string | null | undefined) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(amount) || 0);

const formatDate = (date?: string | Date | null) => {
  if (!date) return 'Not recorded';
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime())
    ? 'Not recorded'
    : parsedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const safeFilePart = (value: string) => value.replace(/[<>:"/\\|?*]/g, '_');

// Receipts (recorded payments) of one invoice: view each receipt and download it as PDF or Excel.
export function InvoiceReceiptsModal({ invoice, onOpenChange }: InvoiceReceiptsModalProps) {
  const receiptRef = useRef<HTMLElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const payments: any[] = useMemo(() => {
    const list = Array.isArray(invoice?.payments) ? [...invoice.payments] : [];
    return list.sort((a, b) =>
      new Date(a.receivedAt || a.receiptDate || a.createdAt || 0).getTime()
      - new Date(b.receivedAt || b.receiptDate || b.createdAt || 0).getTime());
  }, [invoice]);

  useEffect(() => {
    setSelectedId(payments.length > 0 ? payments[payments.length - 1].id : null);
  }, [payments]);

  if (!invoice) return null;

  const payment = payments.find(p => p.id === selectedId) || null;
  const details = invoice.studentDetails || {};
  const enrollment = invoice.enrollment || {};
  const payerName = details.fullName || invoice.student?.name || enrollment.studentName || invoice.center?.name || 'Payer';
  const enrollmentNumber = details.enrollmentNumber || invoice.student?.enrollmentNo || enrollment.enrollmentNumber || invoice.center?.code;
  const programName = details.programName || enrollment.program?.name;
  const receiptNumber = (p: any) => p?.receiptNo || `PAY-${String(p?.id || '').slice(0, 8).toUpperCase()}`;

  const downloadPdf = async () => {
    if (!receiptRef.current || !payment) return;
    setDownloading(true);
    try {
      await html2pdf()
        .set({
          margin: 12,
          filename: `Payment_Receipt_${safeFilePart(receiptNumber(payment))}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(receiptRef.current)
        .save();
    } catch {
      toast.error('Failed to download payment receipt PDF');
    } finally {
      setDownloading(false);
    }
  };

  const downloadExcel = () => {
    if (!payment) return;
    try {
      const receiptSheet = XLSX.utils.aoa_to_sheet([
        ['Payment Receipt'],
        [],
        ['Receipt No.', receiptNumber(payment)],
        ['Payment Date', formatDate(payment.receivedAt || payment.receiptDate || payment.createdAt)],
        ['Received From', payerName],
        ['Enrollment No.', enrollmentNumber || ''],
        ['Program', programName || ''],
        ['Invoice No.', invoice.invoiceNo || ''],
        ['Invoice Period', invoice.period || ''],
        ['Payment Method', payment.method || ''],
        ['Transaction Reference', payment.referenceNo || ''],
        ['Notes', payment.notes || ''],
        ['Amount Received (INR)', Number(payment.amount) || 0],
        ['Received By', payment.receiver?.name || 'Finance Department'],
        [],
        ['Invoice Total (INR)', Number(invoice.total) || 0],
        ['Paid to Date (INR)', Number(invoice.paidAmount) || 0],
        ['Balance Due (INR)', Number(invoice.balanceAmount) || 0],
      ]);
      receiptSheet['!cols'] = [{ wch: 24 }, { wch: 40 }];

      const allSheet = XLSX.utils.json_to_sheet(payments.map(p => ({
        'Receipt No.': receiptNumber(p),
        'Payment Date': formatDate(p.receivedAt || p.receiptDate || p.createdAt),
        'Amount (INR)': Number(p.amount) || 0,
        'Method': p.method || '',
        'Reference': p.referenceNo || '',
        'Received By': p.receiver?.name || 'Finance Department',
        'Notes': p.notes || '',
      })));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, receiptSheet, 'Receipt');
      XLSX.utils.book_append_sheet(workbook, allSheet, 'All Receipts');
      XLSX.writeFile(workbook, `Payment_Receipt_${safeFilePart(receiptNumber(payment))}.xlsx`);
    } catch {
      toast.error('Failed to download payment receipt Excel');
    }
  };

  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Receipts · Invoice {invoice.invoiceNo}
          </DialogTitle>
          <DialogDescription>
            {payments.length > 0
              ? `${payments.length} payment receipt${payments.length > 1 ? 's' : ''} recorded for ${payerName}.`
              : 'No payment has been recorded against this invoice yet.'}
          </DialogDescription>
        </DialogHeader>

        {payments.length === 0 ? (
          <p className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Record a payment on this invoice to issue a receipt.
          </p>
        ) : (
          <div className="space-y-4">
            {payments.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {payments.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors',
                      p.id === selectedId ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
                    )}
                  >
                    {receiptNumber(p)} · {formatCurrency(p.amount)}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={downloadExcel} disabled={!payment} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Download Excel
              </Button>
              <Button onClick={downloadPdf} disabled={!payment || downloading} className="gap-2">
                <Download className="h-4 w-4" />
                {downloading ? 'Preparing PDF...' : 'Download PDF'}
              </Button>
            </div>

            {payment && (
              <article ref={receiptRef} className="space-y-6 rounded-lg border bg-white p-6 text-slate-900">
                <header className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Official Payment Receipt</p>
                    <h1 className="mt-1 text-2xl font-bold">Payment Received</h1>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">Receipt No.</p>
                    <p className="font-mono">{receiptNumber(payment)}</p>
                  </div>
                </header>

                <section className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Received From</p>
                    <p className="mt-1 font-semibold">{payerName}</p>
                    {enrollmentNumber && <p className="text-slate-600">{enrollmentNumber}</p>}
                    {programName && <p className="text-slate-600">{programName}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase text-slate-500">Payment Date</p>
                    <p className="mt-1 font-semibold">{formatDate(payment.receivedAt || payment.receiptDate || payment.createdAt)}</p>
                    <p className="mt-2 text-xs uppercase text-slate-500">Invoice No.</p>
                    <p className="font-semibold">{invoice.invoiceNo || 'N/A'}</p>
                    {invoice.period && <p className="text-slate-600">{invoice.period}</p>}
                  </div>
                </section>

                <section className="rounded-lg border border-slate-300">
                  <div className="grid grid-cols-[1fr_auto] gap-4 border-b bg-slate-50 px-4 py-3 text-sm">
                    <span className="font-medium">Payment Method</span>
                    <span className="text-right">{payment.method || 'Not recorded'}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-4 border-b px-4 py-3 text-sm">
                    <span className="font-medium">Transaction Reference</span>
                    <span className="text-right">{payment.referenceNo || 'N/A'}</span>
                  </div>
                  {payment.notes && (
                    <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 text-sm">
                      <span className="font-medium">Notes</span>
                      <span className="text-right">{payment.notes}</span>
                    </div>
                  )}
                </section>

                <section className="flex items-center justify-between border-y-2 border-slate-800 py-4">
                  <span className="text-lg font-bold">Amount Received</span>
                  <span className="text-2xl font-bold">{formatCurrency(payment.amount)}</span>
                </section>

                <section className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Invoice Total</p>
                    <p className="font-semibold">{formatCurrency(invoice.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Paid to Date</p>
                    <p className="font-semibold">{formatCurrency(invoice.paidAmount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase text-slate-500">Balance Due</p>
                    <p className="font-semibold">{formatCurrency(invoice.balanceAmount)}</p>
                  </div>
                </section>

                <footer className="flex items-end justify-between gap-6 pt-8 text-xs text-slate-500">
                  <p>This is a computer-generated receipt and is valid without a signature.</p>
                  <div className="min-w-40 border-t border-slate-400 pt-2 text-center">
                    Received by {payment.receiver?.name || 'Finance Department'}
                  </div>
                </footer>
              </article>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
