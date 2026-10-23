import { useState, useEffect } from 'react';
import { DollarSign, Play, CheckCircle, Send, RefreshCw, Edit, Save, X, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import api from '@/lib/api';
import html2pdf from 'html2pdf.js';
import { PayslipDocument } from './hr/PayslipDocument';

interface Payroll {
  id: string;
  employeeId: any;
  user?: { name: string; email: string };
  month: string;
  basicSalary: number;
  grossSalary: number;
  netSalary: number;
  status: string;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  bonus: number;
  overtime: number;
  remarks?: string;
  createdAt?: string;
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  processed: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  transferred_to_finance: 'bg-purple-100 text-purple-700',
  paid: 'bg-emerald-100 text-emerald-700',
};

export function PayrollPanel({ personalView = false }: { personalView?: boolean }) {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Generate
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateMonth, setGenerateMonth] = useState(new Date().toISOString().slice(0, 7));
  const [generateMode, setGenerateMode] = useState<'smart' | 'basic'>('smart');
  const [generationErrors, setGenerationErrors] = useState<string[]>([]);
  const [generationErrorsOpen, setGenerationErrorsOpen] = useState(false);

  // Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editPayroll, setEditPayroll] = useState<Payroll | null>(null);
  const [editForm, setEditForm] = useState<any>({
    basicSalary: 0,
    allowances: { hra: 0, transport: 0, medical: 0, other: 0 },
    deductions: { pf: 0, tax: 0, insurance: 0, other: 0 },
    bonus: 0,
    overtime: 0,
    remarks: '',
  });
  const [editSaving, setEditSaving] = useState(false);

  // Transfer
  const [transferOpen, setTransferOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [transferRemarks, setTransferRemarks] = useState('');

  useEffect(() => { fetchPayrolls(); }, [personalView]);

  const fetchPayrolls = async () => {
    setLoading(true);
    try {
      const res = await api.get(personalView ? '/payroll?mine=true' : '/payroll');
      setPayrolls(res.data.data || []);
    } catch { toast.error('Failed to fetch payrolls'); }
    finally { setLoading(false); }
  };

  const handleGenerate = async () => {
    try {
      const endpoint = generateMode === 'smart' ? '/hr/payroll/generate-smart' : '/payroll/generate';
      const res = await api.post(endpoint, { month: generateMonth });
      const count = res.data.data?.length || 0;
      const errors = Array.isArray(res.data.errors) ? res.data.errors.map(String) : [];
      if (count > 0) toast.success(`Generated ${count} payroll records`);
      if (errors.length > 0) {
        console.error('Payroll generation errors:', errors);
        setGenerationErrors(errors);
        setGenerationErrorsOpen(true);
        toast.error(`${errors.length} payroll record${errors.length === 1 ? '' : 's'} could not be generated`);
      } else if (count === 0) {
        toast.info('No payroll records were generated');
      }
      setGenerateOpen(false);
      fetchPayrolls();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to generate');
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await api.put(`/payroll/${id}/confirm`);
      toast.success('Payroll confirmed');
      fetchPayrolls();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const openEdit = (p: Payroll) => {
    setEditPayroll(p);
    setEditForm({
      basicSalary: p.basicSalary,
      allowances: { hra: 0, transport: 0, medical: 0, other: 0, ...p.allowances },
      deductions: { pf: 0, tax: 0, insurance: 0, other: 0, ...p.deductions },
      bonus: p.bonus || 0,
      overtime: p.overtime || 0,
      remarks: p.remarks || '',
    });
    setEditOpen(true);
  };

  const calcGross = (f: any) =>
    (f.basicSalary || 0) +
    Object.values((f.allowances || {}) as Record<string, number>).reduce((s, v) => s + (v || 0), 0) +
    (f.bonus || 0) + (f.overtime || 0);

  const calcNet = (f: any) =>
    calcGross(f) - Object.values((f.deductions || {}) as Record<string, number>).reduce((s, v) => s + (v || 0), 0);

  const [pdfPayroll, setPdfPayroll] = useState<Payroll | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const downloadPayslip = (p: Payroll) => {
    setPdfPayroll(p);
    setDownloadingPdf(true);
    // Give state time to flush to DOM
    setTimeout(() => {
      const element = document.getElementById(`payslip-${p.id}`);
      if (element) {
        html2pdf()
          .set({
            margin: 10,
            filename: `Payslip_${p.month}_${p.user?.name || 'Employee'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          })
          .from(element)
          .save()
          .then(() => setDownloadingPdf(false))
          .catch(() => {
            toast.error('Failed to generate PDF');
            setDownloadingPdf(false);
          });
      }
    }, 100);
  };

  const handleEditSave = async () => {
    if (!editPayroll) return;
    setEditSaving(true);
    try {
      await api.put(`/payroll/${editPayroll.id}`, editForm);
      toast.success('Payroll updated');
      setEditOpen(false);
      fetchPayrolls();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally { setEditSaving(false); }
  };

  const handleTransfer = async () => {
    if (!selectedIds.length) { toast.error('Select at least one confirmed payroll'); return; }
    try {
      await api.post('/payroll/transfer-to-finance', { payrollIds: selectedIds, remarks: transferRemarks });
      toast.success(`Transferred ${selectedIds.length} payrolls to Finance`);
      setTransferOpen(false);
      setSelectedIds([]);
      setTransferRemarks('');
      fetchPayrolls();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Transfer failed'); }
  };

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const filtered = activeTab === 'all' ? payrolls : payrolls.filter(p => p.status === activeTab);
  const confirmedPayrolls = payrolls.filter(p => p.status === 'confirmed');

  if (personalView) {
    const availablePayslips = payrolls.filter(p =>
      ['confirmed', 'transferred_to_finance', 'paid'].includes(p.status)
    );

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">My Payslips</h2>
            <p className="text-sm text-muted-foreground">Payslips generated and confirmed by HR</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPayrolls}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>

        <Card>
          <CardHeader><CardTitle>Available Payslips</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading payslips...</div>
            ) : availablePayslips.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No payslips have been generated for your account yet.</p>
                <p className="mt-1 text-sm">Please contact your HR department to generate your payslip.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {availablePayslips.map(payroll => (
                  <div key={payroll.id} className="flex items-center gap-3 rounded-lg border p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{payroll.month}</span>
                        <Badge className={`text-xs ${STATUS_COLOR[payroll.status] || 'bg-gray-100'}`}>
                          {payroll.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                        <span>Gross: ₹{payroll.grossSalary?.toLocaleString()}</span>
                        <span className="font-semibold text-foreground">Net: ₹{payroll.netSalary?.toLocaleString()}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadPayslip(payroll)}
                      disabled={downloadingPdf}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="hidden">
          {pdfPayroll && <PayslipDocument payroll={{ ...pdfPayroll, user: pdfPayroll.user }} />}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Payroll Management</h2>
          <p className="text-muted-foreground text-sm">Generate, edit, confirm and submit payroll to Finance</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchPayrolls}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          {confirmedPayrolls.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}>
              <Send className="w-4 h-4 mr-1" /> Submit to Finance ({confirmedPayrolls.length})
            </Button>
          )}
          <Button size="sm" onClick={() => setGenerateOpen(true)}>
            <Play className="w-4 h-4 mr-1" /> Generate Payroll
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">All ({payrolls.length})</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
          <TabsTrigger value="transferred_to_finance">Submitted</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardHeader><CardTitle>Payroll Records</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No payroll records</p>
                  <p className="text-sm">Generate payroll to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map(p => {
                    const empName = p.employeeId?.name || p.employeeId?.userId?.name || 'Employee';
                    const isSelected = selectedIds.includes(p.id);
                    return (
                      <div key={p.id} className={`flex items-center gap-3 p-4 border rounded-lg transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'}`}>
                        {p.status === 'confirmed' && (
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p.id)} className="w-4 h-4 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold">{empName}</span>
                            <Badge variant="outline" className="text-xs">{p.month}</Badge>
                            <Badge className={`text-xs ${STATUS_COLOR[p.status] || 'bg-gray-100'}`}>
                              {p.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span>Basic: ₹{p.basicSalary?.toLocaleString()}</span>
                            <span>Gross: ₹{p.grossSalary?.toLocaleString()}</span>
                            <span className="font-semibold text-foreground">Net: ₹{p.netSalary?.toLocaleString()}</span>
                            {p.remarks && <span className="text-orange-600">{p.remarks}</span>}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {(p.status === 'draft' || p.status === 'processed') && (
                            <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {(p.status === 'draft' || p.status === 'processed') && (
                            <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleConfirm(p.id)}>
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Confirm
                            </Button>
                          )}
                          {(p.status === 'confirmed' || p.status === 'paid' || p.status === 'transferred_to_finance') && (
                            <Button size="sm" variant="outline" onClick={() => downloadPayslip(p)} disabled={downloadingPdf}>
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Hidden PDF Container */}
      <div className="hidden">
        {pdfPayroll && <PayslipDocument payroll={{ ...pdfPayroll, user: pdfPayroll.user }} />}
      </div>

      {/* Generate Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Generate Monthly Payroll</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Month</Label>
              <Input type="month" value={generateMonth} onChange={e => setGenerateMonth(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Generation Mode</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGenerateMode('smart')}
                  className={`p-3 rounded-xl border text-left text-sm transition-colors ${generateMode === 'smart' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'}`}
                >
                  <p className="font-semibold">Smart Generate</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Uses salary configs + auto late deductions from attendance</p>
                </button>
                <button
                  type="button"
                  onClick={() => setGenerateMode('basic')}
                  className={`p-3 rounded-xl border text-left text-sm transition-colors ${generateMode === 'basic' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'}`}
                >
                  <p className="font-semibold">Basic Generate</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Uses Employee model salary with default allowances</p>
                </button>
              </div>
            </div>
            {generateMode === 'smart' && (
              <p className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
                Smart mode reads each employee's salary config, calculates late deductions from attendance records, and generates accurate payroll automatically.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerate}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={generationErrorsOpen} onOpenChange={setGenerationErrorsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Payroll generation issues</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {generationErrors.length} payroll record{generationErrors.length === 1 ? '' : 's'} could not be generated:
          </p>
          <ul className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3 text-sm">
            {generationErrors.map((error, index) => (
              <li key={`${index}-${error}`} className="break-words">{error}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button onClick={() => setGenerationErrorsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Payroll Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Payroll — {editPayroll?.employeeId?.name || 'Employee'} ({editPayroll?.month})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="space-y-1">
              <Label>Basic Salary (₹)</Label>
              <Input type="number" min="0" value={editForm.basicSalary}
                onChange={e => setEditForm((f: any) => ({ ...f, basicSalary: Number(e.target.value) }))} />
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Allowances</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(['hra', 'transport', 'medical', 'other'] as const).map(key => (
                  <div key={key} className="space-y-1">
                    <Label className="capitalize">{key} (₹)</Label>
                    <Input type="number" min="0" value={editForm.allowances?.[key] || 0}
                      onChange={e => setEditForm((f: any) => ({ ...f, allowances: { ...f.allowances, [key]: Number(e.target.value) } }))} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Deductions</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(['pf', 'tax', 'insurance', 'other'] as const).map(key => (
                  <div key={key} className="space-y-1">
                    <Label className="capitalize">{key} (₹)</Label>
                    <Input type="number" min="0" value={editForm.deductions?.[key] || 0}
                      onChange={e => setEditForm((f: any) => ({ ...f, deductions: { ...f.deductions, [key]: Number(e.target.value) } }))} />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Bonus (₹)</Label>
                <Input type="number" min="0" value={editForm.bonus || 0}
                  onChange={e => setEditForm((f: any) => ({ ...f, bonus: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label>Overtime (₹)</Label>
                <Input type="number" min="0" value={editForm.overtime || 0}
                  onChange={e => setEditForm((f: any) => ({ ...f, overtime: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Remarks</Label>
              <Textarea value={editForm.remarks || ''} rows={2}
                onChange={e => setEditForm((f: any) => ({ ...f, remarks: e.target.value }))} />
            </div>
            {/* Live preview */}
            <div className="p-3 rounded-xl bg-muted/50 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Gross</p>
                <p className="font-bold text-blue-600">₹{calcGross(editForm).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deductions</p>
                <p className="font-bold text-red-500">
                  ₹{Object.values(((editForm.deductions || {}) as Record<string, number>)).reduce((s, v) => s + (v || 0), 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net</p>
                <p className="font-bold text-green-600">₹{calcNet(editForm).toLocaleString()}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}><X className="w-4 h-4 mr-1" />Cancel</Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              <Save className="w-4 h-4 mr-1" />{editSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer to Finance Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Submit Payroll to Finance</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Check the boxes next to confirmed payrolls, then submit them to Finance for approval and salary disbursement.
            </p>
            <div className="space-y-1">
              <Label>Remarks (optional)</Label>
              <Input value={transferRemarks} onChange={e => setTransferRemarks(e.target.value)} placeholder="e.g., March 2026 payroll batch" />
            </div>
            <p className="text-sm font-medium">{selectedIds.length} payroll(s) selected</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={!selectedIds.length}>
              <Send className="w-4 h-4 mr-1" /> Submit to Finance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
