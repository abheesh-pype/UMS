import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Receipt } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { toast } from 'sonner';

interface PaymentReceiptInvoice {
  invoiceNo?: string | null;
  period?: string | null;
  studentDetails?: {
    fullName?: string | null;
    enrollmentNumber?: string | null;
    programName?: string | null;
  } | null;
  student?: {
    name?: string | null;
    enrollmentNo?: string | null;
  } | null;
  enrollment?: {
    studentName?: string | null;
    enrollmentNumber?: string | null;
    program?: { name?: string | null } | null;
  } | null;
  center?: {
    name?: string | null;
    code?: string | null;
  } | null;
}

interface PaymentReceiptData {
  id: string;
  receiptNo?: string | null;
  amount?: number | string | null;
  method?: string | null;
  referenceNo?: string | null;
  notes?: string | null;
  receivedAt?: string | Date | null;
  receiptDate?: string | Date | null;
  createdAt?: string | Date | null;
  receiver?: { name?: string | null } | null;
  invoice?: PaymentReceiptInvoice | null;
}

interface PaymentReceiptPrintModalProps {
  payment: PaymentReceiptData | null;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (amount: number | string | null | undefined) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(amount) || 0);

const formatDate = (date?: string | Date | null) => {
  if (!date) return 'Not recorded';
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime())
    ? 'Not recorded'
    : parsedDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
};

export function PaymentReceiptPrintModal({ payment, onOpenChange }: PaymentReceiptPrintModalProps) {
  const receiptRef = useRef<HTMLElement>(null);
  const [downloading, setDownloading] = useState(false);

  const downloadPdf = useCallback(async () => {
    if (!receiptRef.current || !payment) return;

    setDownloading(true);
    try {
      const filenamePart = String(payment.receiptNo || payment.id).replace(/[<>:"/\\|?*]/g, '_');
      await html2pdf()
        .set({
          margin: 12,
          filename: `Payment_Receipt_${filenamePart}.pdf`,
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
  }, [payment]);

  useEffect(() => {
    if (payment && receiptRef.current) {
      void downloadPdf();
    }
  }, [downloadPdf, payment]);

  if (!payment) return null;

  const invoice = payment.invoice || {};
  const details = invoice.studentDetails || {};
  const enrollment = invoice.enrollment || {};
  const payerName = details.fullName
    || invoice.student?.name
    || enrollment.studentName
    || invoice.center?.name
    || 'Payer';
  const enrollmentNumber = details.enrollmentNumber
    || invoice.student?.enrollmentNo
    || enrollment.enrollmentNumber
    || invoice.center?.code;
  const programName = details.programName || enrollment.program?.name;
  const receiptNumber = payment.receiptNo || `PAY-${payment.id.slice(0, 8).toUpperCase()}`;

  return (
    <Dialog open={!!payment} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #printable-payment-receipt,
            #printable-payment-receipt * { visibility: visible !important; }
            #printable-payment-receipt {
              position: absolute !important;
              inset: 0 auto auto 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 24px !important;
              border: 0 !important;
              box-shadow: none !important;
              background: white !important;
              color: black !important;
            }
            .receipt-no-print { display: none !important; }
            @page { size: A4 portrait; margin: 12mm; }
          }
        `}</style>

        <div className="receipt-no-print flex items-center justify-between gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Payment Receipt
            </DialogTitle>
          </DialogHeader>
          <Button onClick={downloadPdf} disabled={downloading} className="gap-2">
            <Download className="h-4 w-4" />
            {downloading ? 'Preparing PDF...' : 'Download PDF'}
          </Button>
        </div>

        <article ref={receiptRef} id="printable-payment-receipt" className="space-y-6 rounded-lg border bg-white p-6 text-slate-900">
          <header className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Official Payment Receipt</p>
              <h1 className="mt-1 text-2xl font-bold">Payment Received</h1>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold">Receipt No.</p>
              <p className="font-mono">{receiptNumber}</p>
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

          <footer className="flex items-end justify-between gap-6 pt-8 text-xs text-slate-500">
            <p>This is a computer-generated receipt and is valid without a signature.</p>
            <div className="min-w-40 border-t border-slate-400 pt-2 text-center">
              Received by {payment.receiver?.name || 'Finance Department'}
            </div>
          </footer>
        </article>
      </DialogContent>
    </Dialog>
  );
}
