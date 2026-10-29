import { useEffect, useRef, useState } from 'react';
import { Landmark, Save, Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

type BankDetails = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  upiId: string;
  panNumber: string;
  gstin: string;
  instructions: string;
  updatedAt?: string;
  updatedBy?: string | null;
};

const EMPTY: BankDetails = {
  bankName: '', accountHolder: '', accountNumber: '', ifscCode: '', branch: '',
  upiId: '', panNumber: '', gstin: '', instructions: '',
};

const FIELDS: { key: keyof BankDetails; label: string; placeholder: string; required?: boolean; upper?: boolean }[] = [
  { key: 'bankName', label: 'Bank Name', placeholder: 'e.g. State Bank of India', required: true },
  { key: 'accountHolder', label: 'Account Holder Name', placeholder: 'Name on the bank account', required: true },
  { key: 'accountNumber', label: 'Account Number', placeholder: 'Digits only', required: true },
  { key: 'ifscCode', label: 'IFSC Code', placeholder: 'e.g. SBIN0001234', required: true, upper: true },
  { key: 'branch', label: 'Branch', placeholder: 'Branch name and city' },
  { key: 'upiId', label: 'UPI ID', placeholder: 'e.g. fees@sbi' },
  { key: 'panNumber', label: 'PAN', placeholder: 'e.g. ABCDE1234F', upper: true },
  { key: 'gstin', label: 'GSTIN', placeholder: 'e.g. 27ABCDE1234F1Z5', upper: true },
];

const canEditRoles = ['finance_admin', 'org_admin', 'superadmin'];

// Finance → Bank Details: the collection account printed on every invoice for making payments.
export function FinanceBankDetailsPanel() {
  const { user } = useAuth();
  const canEdit = canEditRoles.includes(user?.role || '');
  const [form, setForm] = useState<BankDetails>(EMPTY);
  const [saved, setSaved] = useState<BankDetails>(EMPTY);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get('/finance/bank-details');
      const data = { ...EMPTY, ...(res.data.data || {}) };
      setForm(data);
      setSaved(data);
      setConfigured(Boolean(res.data.configured));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load bank details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetails(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/finance/bank-details', form);
      const data = { ...EMPTY, ...(res.data.data || {}) };
      setForm(data);
      setSaved(data);
      setConfigured(true);
      toast.success('Bank details updated. All invoices now show these details.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update bank details');
    } finally {
      setSaving(false);
    }
  };

  const rows: [string, string][] = [
    ['Bank Name', saved.bankName],
    ['Account Holder', saved.accountHolder],
    ['Account Number', saved.accountNumber],
    ['IFSC Code', saved.ifscCode],
    ['Branch', saved.branch],
    ['UPI ID', saved.upiId],
    ['PAN', saved.panNumber],
    ['GSTIN', saved.gstin],
  ];

  const downloadPdf = async () => {
    if (!previewRef.current) return;
    setDownloading(true);
    try {
      await html2pdf()
        .set({
          margin: 12,
          filename: 'Bank_Details.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(previewRef.current)
        .save();
    } catch {
      toast.error('Failed to download bank details PDF');
    } finally {
      setDownloading(false);
    }
  };

  const downloadExcel = () => {
    try {
      const sheet = XLSX.utils.aoa_to_sheet([
        ['Bank Details for Payments'],
        [],
        ...rows.map(([label, value]) => [label, value || '']),
        ['Payment Instructions', saved.instructions || ''],
        [],
        ['Last Updated', saved.updatedAt ? new Date(saved.updatedAt).toLocaleString('en-IN') : ''],
      ]);
      sheet['!cols'] = [{ wch: 24 }, { wch: 60 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Bank Details');
      XLSX.writeFile(workbook, 'Bank_Details.xlsx');
    } catch {
      toast.error('Failed to download bank details Excel');
    }
  };

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="w-6 h-6 text-primary" /> Bank Details
          </h2>
          <p className="text-muted-foreground text-sm">
            The collection account shown on every invoice for making payments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={fetchDetails} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" onClick={downloadExcel} disabled={!configured} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Download Excel
          </Button>
          <Button onClick={downloadPdf} disabled={!configured || downloading} className="gap-2">
            <Download className="w-4 h-4" /> {downloading ? 'Preparing PDF...' : 'Download PDF'}
          </Button>
        </div>
      </div>

      {!configured && !loading && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          No bank details are saved yet. Invoices show placeholder account details until you save the real ones below.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Update Bank Details</CardTitle>
            <CardDescription>
              {canEdit ? 'Fields marked * are required. Changes apply to all invoices immediately.' : 'Only Finance can change these details.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {FIELDS.map(field => (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={`bank-${field.key}`}>
                      {field.label} {field.required && <span className="text-destructive">*</span>}
                    </Label>
                    <Input
                      id={`bank-${field.key}`}
                      value={form[field.key] as string}
                      placeholder={field.placeholder}
                      required={field.required}
                      disabled={!canEdit}
                      inputMode={field.key === 'accountNumber' ? 'numeric' : undefined}
                      onChange={e => {
                        let value = e.target.value;
                        if (field.key === 'accountNumber') value = value.replace(/\D/g, '');
                        if (field.upper) value = value.toUpperCase();
                        setForm(prev => ({ ...prev, [field.key]: value }));
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bank-instructions">Payment Instructions</Label>
                <Textarea
                  id="bank-instructions"
                  rows={3}
                  value={form.instructions}
                  disabled={!canEdit}
                  placeholder="e.g. Pay by NEFT/IMPS or UPI and quote the invoice number as the reference."
                  onChange={e => setForm(prev => ({ ...prev, instructions: e.target.value }))}
                />
              </div>
              {canEdit && (
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" disabled={!isDirty || saving} onClick={() => setForm(saved)}>
                    Reset
                  </Button>
                  <Button type="submit" disabled={!isDirty || saving} className="gap-2">
                    <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Bank Details'}
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">As Shown on Invoices</CardTitle>
            <CardDescription>This is what students and study centres see, and what the download contains.</CardDescription>
          </CardHeader>
          <CardContent>
            <div ref={previewRef} className="rounded-lg border bg-white p-6 text-slate-900 space-y-4">
              <div className="border-b-2 border-slate-800 pb-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Official Payment Details</p>
                <h3 className="mt-1 text-xl font-bold">Bank Details for Payments</h3>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                {rows.map(([label, value]) => (
                  <div key={label} className="contents">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-semibold font-mono break-all">{value || '—'}</span>
                  </div>
                ))}
              </div>
              {saved.instructions && (
                <div className="border-t pt-3 text-sm">
                  <p className="text-xs uppercase text-slate-500 mb-1">Payment Instructions</p>
                  <p className="text-slate-700">{saved.instructions}</p>
                </div>
              )}
              {saved.updatedAt && (
                <p className="text-xs text-slate-400 pt-2">
                  Last updated {new Date(saved.updatedAt).toLocaleString('en-IN')}{saved.updatedBy ? ` by ${saved.updatedBy}` : ''}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
