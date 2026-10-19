import React, { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Printer,
  Download,
  Building2,
  GraduationCap,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Receipt
} from 'lucide-react';

interface InvoicePrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any | null;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  open,
  onOpenChange,
  invoice
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (val: number | string | undefined | null) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num);
  };

  const formatDate = (dateStr?: string | Date | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return String(dateStr);
    }
  };

  // Extract snapshots or fallback to current relations
  const uni = invoice.universityDetails || {};
  const student = invoice.studentDetails || {};
  const tax = invoice.taxDetails || {};
  const instructions = invoice.paymentInstructions || {};
  const items: any[] = Array.isArray(invoice.items) ? invoice.items : [];
  const payments: any[] = Array.isArray(invoice.payments) ? invoice.payments : [];

  const uniName = uni.name || invoice.enrollment?.program?.university?.name || 'Autonomous State University';
  const uniAddress = uni.address || invoice.enrollment?.program?.university?.address || 'University Main Campus, Academic City';
  const uniContact = uni.contact || invoice.enrollment?.program?.university?.contact || '+91 98765 43210';
  const uniEmail = uni.email || 'finance@university.edu';
  const uniGstin = uni.gstin || tax.gstin || '27AAACG0584P1Z3';
  const uniLogo = uni.logo || '/logo.png';

  const studentName = student.fullName || invoice.student?.name || invoice.enrollment?.studentName || 'Student Name';
  const studentId = student.studentId || invoice.student?.enrollmentNo || invoice.enrollment?.enrollmentNumber || 'N/A';
  const uniEnrollmentNumber = student.uniEnrollmentNumber || invoice.enrollment?.uniEnrollmentNumber || studentId;
  const programName = student.programName || invoice.enrollment?.program?.name || 'Academic Degree Program';
  const programCode = student.programCode || invoice.enrollment?.program?.code || 'PRG';
  const sessionName = student.sessionName || invoice.academicYear || invoice.enrollment?.session?.name || '2026-2027';
  const admissionType = student.admissionType || (invoice.center ? `Study Centre (${invoice.center.name})` : 'Direct University');

  const status = invoice.status || 'unpaid';

  const getStatusBadge = () => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">PAID</Badge>;
      case 'partially_paid':
        return <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">PARTIALLY PAID</Badge>;
      case 'overdue':
        return <Badge className="bg-rose-600 hover:bg-rose-700 text-white font-semibold">OVERDUE</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-700 border-slate-400 font-semibold">UNPAID</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 border shadow-2xl print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:overflow-visible">
        {/* Print Stylesheet */}
        <style dangerouslySetInnerHTML={{
          __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-invoice, #printable-invoice * {
              visibility: visible;
            }
            #printable-invoice {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 20px !important;
              background: white !important;
              color: black !important;
              box-shadow: none !important;
              border: none !important;
            }
            .no-print {
              display: none !important;
            }
            @page {
              size: A4 portrait;
              margin: 12mm;
            }
          }
        `}} />

        {/* Modal Action Header (Hidden during print) */}
        <div className="no-print sticky top-0 z-20 flex items-center justify-between border-b bg-muted/80 backdrop-blur-md px-6 py-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm sm:text-base">
              Invoice #{invoice.invoiceNo} · {studentName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>

        {/* Printable Invoice Document Body */}
        <div id="printable-invoice" ref={printRef} className="relative bg-white text-slate-900 p-8 sm:p-10 font-sans leading-relaxed">
          {/* Status Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-5 z-0">
            <span className="text-[120px] font-black uppercase tracking-widest -rotate-45 transform">
              {status.replace('_', ' ')}
            </span>
          </div>

          <div className="relative z-10 space-y-6">
            {/* Header: University Branding & Official Address */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b-2 border-slate-800">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 shrink-0 font-bold overflow-hidden shadow-sm">
                  {uniLogo && uniLogo !== '/logo.png' ? (
                    <img src={uniLogo} alt={uniName} className="w-full h-full object-contain p-1" />
                  ) : (
                    <Building2 className="w-9 h-9 text-slate-700" />
                  )}
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                    {uniName}
                  </h1>
                  <p className="text-xs text-slate-600 mt-1 max-w-md">
                    {uniAddress}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 mt-1.5 font-medium">
                    <span><strong>Phone:</strong> {uniContact}</span>
                    <span><strong>Email:</strong> {uniEmail}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700 mt-1 font-semibold">
                    <span><strong>GSTIN:</strong> {uniGstin}</span>
                    {uni.panNumber && <span><strong>PAN:</strong> {uni.panNumber}</span>}
                  </div>
                </div>
              </div>

              {/* Title & Badge */}
              <div className="text-right sm:shrink-0">
                <div className="inline-block px-3 py-1 bg-slate-900 text-white font-extrabold text-sm tracking-wider uppercase rounded">
                  TAX INVOICE
                </div>
                <div className="mt-2 flex justify-end">
                  {getStatusBadge()}
                </div>
                <p className="text-xs text-slate-500 mt-1">Official Student Fee Statement</p>
              </div>
            </div>

            {/* Invoice & Student Meta (2 Column Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50/80 p-5 rounded-lg border border-slate-200">
              {/* Left Column: Student Details */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-slate-900 font-bold uppercase tracking-wider mb-2 pb-1 border-b border-slate-300">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  <span>Student & Admission Details</span>
                </div>
                <div>
                  <span className="text-slate-500">Student Name:</span>{' '}
                  <strong className="text-slate-900 text-sm">{studentName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Student ID / Enr No:</span>{' '}
                  <strong className="text-slate-900">{studentId}</strong>
                </div>
                <div>
                  <span className="text-slate-500">University Enr No:</span>{' '}
                  <strong className="text-slate-900">{uniEnrollmentNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Program & Course:</span>{' '}
                  <span className="text-slate-900 font-semibold">{programName} ({programCode})</span>
                </div>
                {student.specialisation && (
                  <div>
                    <span className="text-slate-500">Specialisation:</span>{' '}
                    <span className="text-slate-800">{student.specialisation}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">Admission Mode:</span>{' '}
                  <span className="text-slate-800 font-medium">{admissionType}</span>
                </div>
                {student.phone && (
                  <div>
                    <span className="text-slate-500">Contact / Email:</span>{' '}
                    <span className="text-slate-800">{student.phone} · {student.email}</span>
                  </div>
                )}
              </div>

              {/* Right Column: Invoice Meta */}
              <div className="space-y-1.5 text-xs sm:pl-4 sm:border-l border-slate-300">
                <div className="flex items-center gap-1.5 text-slate-900 font-bold uppercase tracking-wider mb-2 pb-1 border-b border-slate-300">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>Invoice Information</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice Number:</span>
                  <strong className="text-slate-900 font-mono text-sm">{invoice.invoiceNo}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice Issue Date:</span>
                  <strong className="text-slate-900">{formatDate(invoice.issuedAt || invoice.createdAt)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Due Date:</span>
                  <strong className={invoice.status === 'overdue' ? 'text-rose-600 font-bold' : 'text-slate-900'}>
                    {formatDate(invoice.dueDate)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Financial Year:</span>
                  <span className="text-slate-900 font-semibold">{invoice.financialYear || 'FY 2026-27'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Academic Year / Session:</span>
                  <span className="text-slate-900 font-semibold">{sessionName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice Type:</span>
                  <span className="text-slate-900 capitalize font-medium">{invoice.invoiceType || 'Tuition Fee'}</span>
                </div>
              </div>
            </div>

            {/* Fee Breakdown Table */}
            <div className="space-y-2">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Fee Particulars & Line Items
              </h2>
              <div className="overflow-hidden rounded-lg border border-slate-300">
                <table className="w-full text-xs">
                  <thead className="bg-slate-800 text-white uppercase text-[11px] font-semibold tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 text-left w-12">#</th>
                      <th className="py-2.5 px-3 text-left">Description</th>
                      <th className="py-2.5 px-3 text-center w-24">Category</th>
                      <th className="py-2.5 px-3 text-center w-16">Qty</th>
                      <th className="py-2.5 px-3 text-right w-24">Rate (₹)</th>
                      <th className="py-2.5 px-3 text-right w-20">GST %</th>
                      <th className="py-2.5 px-3 text-right w-28">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-slate-500">
                          Tuition and Program Fee
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="py-2.5 px-3 text-slate-500 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">{item.description}</td>
                          <td className="py-2.5 px-3 text-center capitalize text-slate-600">{item.category || 'Tuition'}</td>
                          <td className="py-2.5 px-3 text-center text-slate-600">{item.quantity || 1}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(item.rate || item.amount)}</td>
                          <td className="py-2.5 px-3 text-right text-slate-600">{item.taxRate || 0}%</td>
                          <td className="py-2.5 px-3 text-right font-bold font-mono text-slate-900">
                            {formatCurrency(item.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculations & Summary Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
              {/* Payment Instructions / Bank Info */}
              <div className="sm:max-w-md w-full bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 uppercase">
                  <CreditCard className="w-4 h-4 text-primary" />
                  <span>Official Payment Instructions</span>
                </div>
                <p className="text-slate-600 leading-normal">
                  {instructions.instructions || 'Direct deposit or UPI transfer to the university official collection account:'}
                </p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[11px] pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Bank Name:</span>
                  <span className="text-slate-900 font-semibold">{instructions.bankName || 'State Bank of India'}</span>
                  <span className="text-slate-500">Account Holder:</span>
                  <span className="text-slate-900 font-semibold">{instructions.accountHolder || uniName}</span>
                  <span className="text-slate-500">A/C Number:</span>
                  <span className="text-slate-900 font-bold">{instructions.accountNumber || '40928374921'}</span>
                  <span className="text-slate-500">IFSC Code:</span>
                  <span className="text-slate-900 font-bold">{instructions.ifscCode || 'SBIN0001234'}</span>
                  {instructions.upiId && (
                    <>
                      <span className="text-slate-500">UPI ID:</span>
                      <span className="text-slate-900 font-bold">{instructions.upiId}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Totals Table */}
              <div className="w-full sm:w-80 space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-200">
                  <span className="text-slate-600">Subtotal (before tax):</span>
                  <span className="font-mono font-semibold text-slate-900">{formatCurrency(invoice.amount)}</span>
                </div>

                {/* Tax Breakdown */}
                {tax.taxAmount > 0 ? (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                      <span>CGST ({tax.cgstRate || 9}%):</span>
                      <span className="font-mono">{formatCurrency(tax.cgstAmount || tax.taxAmount / 2)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                      <span>SGST ({tax.sgstRate || 9}%):</span>
                      <span className="font-mono">{formatCurrency(tax.sgstAmount || tax.taxAmount / 2)}</span>
                    </div>
                  </>
                ) : (
                  invoice.tax > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-200 text-slate-600">
                      <span>Applicable Tax:</span>
                      <span className="font-mono">{formatCurrency(invoice.tax)}</span>
                    </div>
                  )
                )}

                <div className="flex justify-between py-2 border-b-2 border-slate-800 text-sm font-extrabold text-slate-900">
                  <span>TOTAL INVOICE AMOUNT:</span>
                  <span className="font-mono text-base">{formatCurrency(invoice.total)}</span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-slate-200 text-emerald-700 font-semibold">
                  <span>Total Amount Paid:</span>
                  <span className="font-mono">{formatCurrency(invoice.paidAmount)}</span>
                </div>

                <div className="flex justify-between py-2 bg-slate-100 px-3 rounded text-sm font-black text-slate-900">
                  <span className={invoice.balanceAmount > 0 ? 'text-rose-600' : 'text-slate-800'}>
                    BALANCE DUE:
                  </span>
                  <span className={`font-mono text-base ${invoice.balanceAmount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {formatCurrency(invoice.balanceAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Verified Payments & Generated Receipts (if any) */}
            {payments.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Payment Receipts Recorded Against This Invoice</span>
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-300">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[10px]">
                      <tr>
                        <th className="py-2 px-3 text-left">Receipt No</th>
                        <th className="py-2 px-3 text-left">Payment Date</th>
                        <th className="py-2 px-3 text-left">Method</th>
                        <th className="py-2 px-3 text-left">Reference / UTR</th>
                        <th className="py-2 px-3 text-right">Amount (₹)</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {payments.map((p, idx) => (
                        <tr key={p.id || idx} className="hover:bg-slate-50 font-mono text-[11px]">
                          <td className="py-2 px-3 font-bold text-slate-900">{p.receiptNo || `RCP-000${idx + 1}`}</td>
                          <td className="py-2 px-3 text-slate-700">{formatDate(p.receivedAt || p.createdAt)}</td>
                          <td className="py-2 px-3 text-slate-700 capitalize font-sans">{p.method || 'Online'}</td>
                          <td className="py-2 px-3 text-slate-500">{p.referenceNo || 'N/A'}</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-700">{formatCurrency(p.amount)}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                              VERIFIED
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer Terms & Signatory */}
            <div className="pt-8 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-6 items-end text-xs text-slate-600">
              <div>
                <p className="font-semibold text-slate-800">Terms & Conditions:</p>
                <p className="text-[11px] leading-relaxed mt-1">
                  1. This is a computer-generated tax invoice and is valid without physical signature when issued electronically.
                  <br />
                  2. All payments are subject to realization and compliance with university policies.
                  <br />
                  3. Please retain this invoice and official receipts for student verification and examination clearance.
                </p>
              </div>

              <div className="text-right sm:text-right space-y-3">
                <div className="inline-block border-b-2 border-slate-800 pb-1 w-48 text-center">
                  <div className="h-10 flex items-center justify-center text-slate-400 italic font-serif">
                    Finance Department
                  </div>
                </div>
                <p className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Authorized Signatory / Accounts Officer
                </p>
                <p className="text-[10px] text-slate-500">{uniName}</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
