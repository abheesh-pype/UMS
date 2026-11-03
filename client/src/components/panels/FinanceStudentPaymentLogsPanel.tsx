import { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, Plus, Receipt, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';
import { resolveFileUrl } from '@/lib/fileUrl';

interface StudentFeeReceipt {
  id: string;
  amount: number;
  paymentMode: string;
  referenceNo?: string | null;
  remarks?: string | null;
  receiptDate: string;
}

export function FinanceStudentPaymentLogsPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Dialog states
  const [receiptDialog, setReceiptDialog] = useState<{ open: boolean, enrId: string | null, receiptId?: string }>({ open: false, enrId: null });
  const [extraFeeDialog, setExtraFeeDialog] = useState<{ open: boolean, enrId: string | null }>({ open: false, enrId: null });
  
  // Forms
  const [receiptForm, setReceiptForm] = useState({ amount: '', paymentMode: 'Bank Transfer', referenceNo: '', remarks: '', receiptDate: new Date().toISOString().split('T')[0] });
  const [extraFeeForm, setExtraFeeForm] = useState({ amount: '', reason: '' });

  // Filters
  const [universityId, setUniversityId] = useState('all');
  const [programId, setProgramId] = useState('all');
  const [branchId, setBranchId] = useState('all');

  const [universities, setUniversities] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);

  useEffect(() => { 
    fetchLogs(); 
  }, [search, universityId, programId, branchId]);

  useEffect(() => {
    api.get('/operations/universities').then(r => setUniversities(r.data.data || [])).catch(() => {});
    api.get('/operations/programs').then(r => setPrograms(r.data.data || [])).catch(() => {});
    api.get('/operations/centers').then(r => setCenters(r.data.data || [])).catch(() => {});
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/finance/student-payments', { 
        params: { search, universityId, programId, branchId } 
      });
      setLogs(res.data.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordReceipt = async () => {
    if (!receiptDialog.enrId) return;
    try {
      if (receiptDialog.receiptId) {
        await api.put(`/finance/student-payments/${receiptDialog.enrId}/receipts/${receiptDialog.receiptId}`, receiptForm);
        toast.success('Receipt updated successfully');
      } else {
        await api.post(`/finance/student-payments/${receiptDialog.enrId}/receipt`, receiptForm);
        toast.success('Receipt recorded successfully');
      }
      setReceiptDialog({ open: false, enrId: null });
      setReceiptForm({ amount: '', paymentMode: 'Bank Transfer', referenceNo: '', remarks: '', receiptDate: new Date().toISOString().split('T')[0] });
      fetchLogs();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to record receipt');
    }
  };

  const handleEditReceipt = (enrId: string, receipt: StudentFeeReceipt) => {
    setReceiptForm({
      amount: String(receipt.amount),
      paymentMode: receipt.paymentMode || 'Bank Transfer',
      referenceNo: receipt.referenceNo || '',
      remarks: receipt.remarks || '',
      receiptDate: String(receipt.receiptDate || '').slice(0, 10)
    });
    setReceiptDialog({ open: true, enrId, receiptId: receipt.id });
  };

  const openRecordReceipt = (enrId: string) => {
    setReceiptForm({
      amount: '',
      paymentMode: 'Bank Transfer',
      referenceNo: '',
      remarks: '',
      receiptDate: new Date().toISOString().split('T')[0]
    });
    setReceiptDialog({ open: true, enrId });
  };

  const handleDeleteReceipt = async (enrId: string, receiptId: string) => {
    if (!confirm('Delete this receipt? The invoice payment balance will also be updated.')) return;
    try {
      await api.delete(`/finance/student-payments/${enrId}/receipts/${receiptId}`);
      toast.success('Receipt deleted successfully');
      fetchLogs();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete receipt');
    }
  };

  const handleAddExtraFee = async () => {
    if (!extraFeeDialog.enrId) return;
    try {
      await api.post(`/finance/student-payments/${extraFeeDialog.enrId}/extra-fee`, extraFeeForm);
      toast.success('Extra fee added successfully');
      setExtraFeeDialog({ open: false, enrId: null });
      setExtraFeeForm({ amount: '', reason: '' });
      fetchLogs();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to add extra fee');
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatBillingCycle = (billingCycle?: string) => {
    if (!billingCycle) return 'Not specified';
    const normalizedCycle = billingCycle.toLowerCase().replace(/[_-]/g, ' ');
    if (normalizedCycle.includes('semester')) return 'Per semester';
    if (normalizedCycle.includes('year')) return 'Per year';
    if (normalizedCycle.includes('month')) return 'Per month';
    if (normalizedCycle.includes('one time')) return 'One time';
    return billingCycle.replace(/[_-]/g, ' ');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Student Payment Log</h2>
          <p className="text-sm text-slate-500 mt-1">Payment Logs Directory - View comprehensive status of student fee completion</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, enrollment..." 
              className="pl-8 w-[250px] bg-white"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchLogs()}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-white p-3 rounded-lg border shadow-sm">
        <Select value={universityId} onValueChange={setUniversityId}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Universities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Universities</SelectItem>
            {universities.map((u: any) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={programId} onValueChange={setProgramId}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Programs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programs</SelectItem>
            {programs.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Branches" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {centers.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <div className="rounded-md border bg-white">
            <div className="grid grid-cols-12 gap-4 p-4 border-b font-medium text-xs text-muted-foreground uppercase tracking-wider bg-slate-50/50">
              <div className="col-span-4 pl-8">Student Details</div>
              <div className="col-span-3">Program</div>
              <div className="col-span-1 text-right">Total Fee</div>
              <div className="col-span-2 text-right">Amount Received</div>
              <div className="col-span-1 text-right">Balance</div>
              <div className="col-span-1 text-center">Status</div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500">Loading...</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No payment logs found</div>
            ) : (
              <div className="divide-y">
                {logs.map((log) => (
                  <div key={log.id} className="group">
                    <div className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-50/50 transition-colors">
                      <div className="col-span-4 flex items-center gap-3">
                        <button onClick={() => toggleRow(log.id)} className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400">
                          {expandedRows[log.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        <div>
                          <p className="font-semibold text-slate-900">{log.studentName}</p>
                          <p className="text-xs text-slate-500">{log.enrollmentNumber}</p>
                        </div>
                      </div>
                      <div className="col-span-3">
                        <p className="text-sm font-medium text-slate-700">
                          {log.program?.name}
                          {log.program?.billingCycle && (
                            <span className="text-xs text-slate-500 ml-1">
                              ({formatBillingCycle(log.program.billingCycle)})
                            </span>
                          )}
                        </p>
                        {log.sessionName && <p className="text-xs text-slate-500">{log.sessionName}</p>}
                      </div>
                      <div className="col-span-1 text-right font-semibold">₹{log.totalFee?.toLocaleString()}</div>
                      <div className="col-span-2 text-right font-medium text-green-600">₹{log.received?.toLocaleString()}</div>
                      <div className="col-span-1 text-right font-bold text-orange-600">₹{log.balance?.toLocaleString()}</div>
                      <div className="col-span-1 text-center">
                        <Badge variant="outline" className={
                          log.status === 'Paid' ? 'bg-green-50 text-green-700 border-green-200' :
                          log.status === 'Partial' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          log.status === 'No Fee Set' ? 'bg-slate-50 text-slate-700 border-slate-200' :
                          'bg-orange-50 text-orange-700 border-orange-200'
                        }>
                          {log.status}
                        </Badge>
                      </div>
                    </div>

                    {expandedRows[log.id] && (
                      <div className="pl-14 pr-4 py-4 bg-slate-50 border-t">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-semibold text-sm text-slate-800">Fee Breakdown & Receipts</h4>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setExtraFeeDialog({ open: true, enrId: log.id })}>
                              <Plus className="w-3.5 h-3.5 mr-1" /> Add Extra Fee
                            </Button>
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openRecordReceipt(log.id)}>
                              <Receipt className="w-3.5 h-3.5 mr-1" /> Record Receipt
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {/* Main Fee Card */}
                          <div className="bg-white border rounded-xl p-4 shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                              <Badge variant="secondary" className="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider">Total Enrollment Fee</Badge>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between"><span className="text-slate-500">Amount:</span><span className="font-semibold">₹{log.baseFee?.toLocaleString()}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Extra fees:</span><span className="font-semibold">₹{(log.totalFee - log.baseFee)?.toLocaleString()}</span></div>
                              <div className="flex justify-between border-t pt-2"><span className="text-slate-700 font-medium">Total payable:</span><span className="font-bold">₹{log.payable?.toLocaleString()}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Paid:</span><span className="font-semibold text-green-700">₹{log.received?.toLocaleString()}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Balance due:</span><span className="font-semibold text-orange-700">₹{log.balance?.toLocaleString()}</span></div>
                            </div>
                          </div>

                          <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                              <Badge variant="outline" className="bg-white text-indigo-700 uppercase text-[10px] tracking-wider border-indigo-200">
                                Payment Period
                              </Badge>
                              <span className="text-[10px] text-slate-500">
                                {log.sessionName || 'Academic period not set'}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-slate-800">
                              {formatBillingCycle(log.program?.billingCycle)}
                            </p>
                            {log.periodPayments?.length > 0 ? (
                              <div className="mt-3 space-y-2 border-t border-indigo-100 pt-3">
                                {log.periodPayments.map((periodPayment: any) => (
                                  <div key={periodPayment.id} className="flex items-start justify-between gap-3 text-xs">
                                    <div>
                                      <p className="font-medium text-slate-700">{periodPayment.semesterOrYear}</p>
                                      <p className="text-slate-500">
                                        {periodPayment.paidAt
                                          ? new Date(periodPayment.paidAt).toLocaleDateString()
                                          : periodPayment.createdAt
                                            ? new Date(periodPayment.createdAt).toLocaleDateString()
                                            : 'Date not recorded'}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-slate-800">₹{Number(periodPayment.amount || 0).toLocaleString()}</p>
                                      {/* Status from the student's payments, applied to the periods in order */}
                                      <Badge variant="outline" className={
                                        (periodPayment.studentStatus || periodPayment.status)?.toLowerCase() === 'paid'
                                          ? 'mt-1 bg-green-50 text-green-700 border-green-200'
                                          : 'mt-1 bg-amber-50 text-amber-700 border-amber-200'
                                      }>
                                        {periodPayment.studentStatus || periodPayment.status || 'Pending'}
                                      </Badge>
                                      {periodPayment.studentStatus === 'pending' && Number(periodPayment.studentPaid) > 0 && (
                                        <p className="mt-1 text-[10px] text-slate-500">
                                          ₹{Number(periodPayment.studentPaid).toLocaleString()} of ₹{Number(periodPayment.amount || 0).toLocaleString()} paid
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 mt-2">
                                No semester, year, or month-specific fee records found.
                              </p>
                            )}
                          </div>

                          {log.walletPayment && (
                            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 shadow-sm">
                              <div className="flex justify-between items-start mb-3">
                                <Badge variant="outline" className="bg-white text-blue-700 uppercase text-[10px] tracking-wider border-blue-200">Admission Payment</Badge>
                                <span className="text-[10px] text-slate-400">{new Date(log.walletPayment.date).toLocaleDateString()}</span>
                              </div>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-slate-500">Received:</span><span className="font-semibold text-blue-700">₹{log.walletPayment.amount?.toLocaleString()}</span></div>
                                <div className="text-xs text-slate-600">Paid by study centre wallet</div>
                              </div>
                            </div>
                          )}

                          {/* Payment taken in "Payment Info" on the enrollment form, recorded automatically */}
                          {log.enrollmentPayment && (
                            <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 shadow-sm">
                              <div className="flex justify-between items-start mb-3">
                                <Badge variant="outline" className="bg-white text-emerald-700 uppercase text-[10px] tracking-wider border-emerald-200">Paid at Enrollment</Badge>
                                <span className="text-[10px] text-slate-400">{new Date(log.enrollmentPayment.date).toLocaleDateString()}</span>
                              </div>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-slate-500">Received:</span><span className="font-semibold text-emerald-700">₹{Number(log.enrollmentPayment.amount).toLocaleString()}</span></div>
                                <div className="text-xs text-slate-600">Recorded automatically from the enrollment form</div>
                                {log.enrollmentPayment.proof && (
                                  <a href={resolveFileUrl(log.enrollmentPayment.proof)} target="_blank" rel="noreferrer" className="block text-xs font-semibold text-primary hover:underline">
                                    View payment proof
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Extra Fees */}
                          {log.extraFees?.map((fee: any, idx: number) => (
                            <div key={idx} className="bg-orange-50/50 border border-orange-100 rounded-xl p-4 shadow-sm">
                              <div className="flex justify-between items-start mb-3">
                                <Badge variant="outline" className="bg-white text-orange-600 uppercase text-[10px] tracking-wider border-orange-200">Extra Fee</Badge>
                                <span className="text-[10px] text-slate-400">{new Date(fee.date).toLocaleDateString()}</span>
                              </div>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-slate-500">Amount:</span><span className="font-semibold text-orange-700">₹{fee.amount?.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Reason:</span><span className="text-slate-700 truncate ml-2">{fee.reason}</span></div>
                              </div>
                            </div>
                          ))}

                          {/* Receipts */}
                          {log.receipts?.map((receipt: StudentFeeReceipt) => (
                            <div key={receipt.id} className="bg-green-50/50 border border-green-100 rounded-xl p-4 shadow-sm">
                              <div className="flex justify-between items-start mb-3">
                                <Badge variant="outline" className="bg-white text-green-600 uppercase text-[10px] tracking-wider border-green-200">Receipt</Badge>
                                <span className="text-[10px] text-slate-400">{new Date(receipt.receiptDate).toLocaleDateString()}</span>
                              </div>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-slate-500">Received:</span><span className="font-semibold text-green-700">₹{receipt.amount?.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Mode:</span><span className="text-slate-700 truncate ml-2">{receipt.paymentMode}</span></div>
                                {receipt.referenceNo && <div className="flex justify-between"><span className="text-slate-500">Ref:</span><span className="text-slate-700 truncate ml-2 text-xs">{receipt.referenceNo}</span></div>}
                                {receipt.remarks && <div className="text-xs text-slate-600">{receipt.remarks}</div>}
                                <div className="flex justify-end gap-1 pt-2 border-t border-green-100">
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleEditReceipt(log.id, receipt)}>
                                    <Pencil className="w-3 h-3 mr-1" /> Update
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600 hover:text-red-700" onClick={() => handleDeleteReceipt(log.id, receipt.id)}>
                                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {(!log.receipts || log.receipts.length === 0) && !log.enrollmentPayment && (
                            <div className="bg-white border border-dashed rounded-xl p-4 text-sm text-slate-500 flex items-center justify-center">
                              No recorded receipts yet
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Record Receipt Dialog */}
      <Dialog open={receiptDialog.open} onOpenChange={(val) => setReceiptDialog({ ...receiptDialog, open: val })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{receiptDialog.receiptId ? 'Update Receipt' : 'Record Receipt'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input type="number" value={receiptForm.amount} onChange={e => setReceiptForm({...receiptForm, amount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select value={receiptForm.paymentMode} onValueChange={v => setReceiptForm({...receiptForm, paymentMode: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference No (Optional)</Label>
              <Input value={receiptForm.referenceNo} onChange={e => setReceiptForm({...receiptForm, referenceNo: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Receipt Date</Label>
              <Input type="date" value={receiptForm.receiptDate} onChange={e => setReceiptForm({...receiptForm, receiptDate: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Input value={receiptForm.remarks} onChange={e => setReceiptForm({...receiptForm, remarks: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptDialog({ open: false, enrId: null })}>Cancel</Button>
            <Button onClick={handleRecordReceipt}>{receiptDialog.receiptId ? 'Update Receipt' : 'Save Receipt'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Extra Fee Dialog */}
      <Dialog open={extraFeeDialog.open} onOpenChange={(val) => setExtraFeeDialog({ ...extraFeeDialog, open: val })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Extra Fee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input type="number" value={extraFeeForm.amount} onChange={e => setExtraFeeForm({...extraFeeForm, amount: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input placeholder="e.g. Late Fee, Study Material..." value={extraFeeForm.reason} onChange={e => setExtraFeeForm({...extraFeeForm, reason: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtraFeeDialog({ open: false, enrId: null })}>Cancel</Button>
            <Button onClick={handleAddExtraFee}>Add Fee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
