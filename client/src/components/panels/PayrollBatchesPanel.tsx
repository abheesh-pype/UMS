import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, CreditCard, RefreshCw, Eye, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';

interface PayrollBatch {
  id?: string;
  month: string;
  totalAmount: number;
  employeeCount: number;
  status: string;
  transferredBy?: { name: string };
  approvedBy?: { name: string };
  rejectedBy?: { name: string };
  rejectionReason?: string;
  remarks?: string;
  createdAt: string;
  transferredByName?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  completedAt?: string | null;
  payrolls?: BatchPayroll[];
}

// Employee payroll records grouped in a batch
interface BatchPayroll {
  id: string;
  month: string;
  basicSalary: number;
  grossSalary: number;
  netSalary: number;
  status: string;
  user?: {
    name: string;
    email: string;
    designation?: string | null;
    department?: { name: string } | null;
    employeeProfileDetail?: { employeeCode?: string | null; bankName?: string | null; bankAccountNo?: string | null; ifscCode?: string | null } | null;
  } | null;
}

interface ConfirmedPayroll {
  id: string;
  month: string;
  netSalary: number;
  user?: { name: string; email: string };
}

export function PayrollBatchesPanel({ allowBatchCreation = false }: { allowBatchCreation?: boolean }) {
  const isFinance = allowBatchCreation;
  const { user } = useAuth();
  // Creating a batch submits confirmed payroll to Finance, which is HR's step, so Finance only approves and pays
  const departmentType = ((user as any)?.department?.type || (user as any)?.subDepartment?.parentDept?.type || '').toLowerCase();
  const canSubmitToFinance = ['hr_admin', 'org_admin', 'superadmin'].includes(user?.role || '')
    || (user?.role === 'employee' && departmentType === 'hr');
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [availablePayrolls, setAvailablePayrolls] = useState<ConfirmedPayroll[]>([]);
  const [selectedPayrollIds, setSelectedPayrollIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [batchRemarks, setBatchRemarks] = useState('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<PayrollBatch | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  // Batch opened as a single group view (employees, total payable and payment actions)
  const [detailBatchId, setDetailBatchId] = useState<string | null>(null);
  const [startingPayment, setStartingPayment] = useState(false);
  const [paymentData, setPaymentData] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'bank_transfer',
    paymentReference: '',
  });

  useEffect(() => {
    fetchBatches();
    if (isFinance) fetchAvailablePayrolls();
  }, []);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const response = await api.get('/payroll/batches');
      setBatches(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load payroll batches');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailablePayrolls = async () => {
    try {
      const response = await api.get('/payroll');
      setAvailablePayrolls((response.data.data || []).filter((payroll: ConfirmedPayroll & { status: string }) =>
        payroll.status === 'confirmed'
      ));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load confirmed payroll records');
    }
  };

  const handleCreateBatch = async () => {
    if (selectedPayrollIds.length === 0) {
      toast.error('Select at least one confirmed payroll record');
      return;
    }
    setCreatingBatch(true);
    try {
      const response = await api.post('/payroll/transfer-to-finance', {
        payrollIds: selectedPayrollIds,
        remarks: batchRemarks
      });
      const count = response.data.count || response.data.data?.length || 1;
      toast.success(`${count} payroll batch${count === 1 ? '' : 'es'} created`);
      setCreateDialogOpen(false);
      setSelectedPayrollIds([]);
      setBatchRemarks('');
      await Promise.all([fetchBatches(), fetchAvailablePayrolls()]);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create payroll batch');
    } finally {
      setCreatingBatch(false);
    }
  };

  const togglePayrollSelection = (id: string) => {
    setSelectedPayrollIds(current =>
      current.includes(id) ? current.filter(selectedId => selectedId !== id) : [...current, id]
    );
  };

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/payroll/batches/${id}/approve`);
      toast.success('Payroll batch approved');
      fetchBatches();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!selectedBatch || !rejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    const id = selectedBatch.id || selectedBatch.id;
    try {
      await api.post(`/payroll/batches/${id}/reject`, { rejectionReason });
      toast.success('Payroll batch rejected');
      setRejectDialogOpen(false);
      setRejectionReason('');
      setSelectedBatch(null);
      fetchBatches();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reject');
    }
  };

  const handleStartPayment = async (id: string) => {
    setStartingPayment(true);
    try {
      await api.put(`/payroll/batches/${id}/payment-in-progress`);
      toast.success('Payment marked as in progress');
      fetchBatches();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update status');
    } finally {
      setStartingPayment(false);
    }
  };

  const handleCompletePayment = async () => {
    if (!selectedBatch) return;
    const id = selectedBatch.id || selectedBatch.id;
    try {
      await api.put(`/payroll/batches/${id}/complete-payment`, paymentData);
      toast.success('Payment completed — salaries disbursed');
      setPaymentDialogOpen(false);
      setSelectedBatch(null);
      fetchBatches();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to complete payment');
    }
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      pending_finance_approval: 'bg-yellow-100 text-yellow-800',
      approved_by_finance: 'bg-blue-100 text-blue-800',
      payment_in_progress: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  const detailBatch = batches.find(b => b.id === detailBatchId) || null;
  const formatAmount = (value?: number | null) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const filteredBatches = activeTab === 'all'
    ? batches
    : batches.filter(b => b.status === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Payroll Batches</h2>
          <p className="text-muted-foreground">Review and process payroll batches from HR</p>
        </div>
        <div className="flex gap-2">
          {allowBatchCreation && canSubmitToFinance && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              Create Payroll Batch
            </Button>
          )}
          <Button variant="outline" onClick={() => {
            fetchBatches();
            if (isFinance) fetchAvailablePayrolls();
          }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending_finance_approval">Pending Approval</TabsTrigger>
          <TabsTrigger value="approved_by_finance">Approved</TabsTrigger>
          <TabsTrigger value="payment_in_progress">In Progress</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle>Payroll Batches</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : filteredBatches.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No payroll batches found</p>
                  <p className="text-sm">
                    {isFinance
                      ? 'Create a batch from confirmed payroll records, or wait for HR to submit one.'
                      : 'HR will transfer payroll batches here for approval.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredBatches.map((batch) => {
                    const bid = batch.id || batch.id || '';
                    return (
                      <div
                        key={bid}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 cursor-pointer" onClick={() => setDetailBatchId(bid)}>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-semibold">Month: {batch.month}</span>
                            <Badge className={getStatusColor(batch.status)}>
                              {batch.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground flex gap-4">
                            <span>{batch.employeeCount} employees</span>
                            <span className="font-medium text-foreground">
                              Total: ₹{batch.totalAmount?.toLocaleString()}
                            </span>
                            {batch.transferredBy && (
                              <span>Transferred by: {batch.transferredByName || batch.transferredBy.name}</span>
                            )}
                          </div>
                          {batch.rejectionReason && (
                            <p className="text-xs text-red-600 mt-1">
                              Rejection: {batch.rejectionReason}
                            </p>
                          )}
                          {batch.remarks && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Remarks: {batch.remarks}
                            </p>
                          )}
                          {!!batch.payrolls?.length && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {batch.payrolls.map(p => p.user?.name || 'Employee').join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setDetailBatchId(bid)}>
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                          {isFinance && batch.status === 'pending_finance_approval' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600"
                                onClick={() => handleApprove(bid)}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                onClick={() => {
                                  setSelectedBatch(batch);
                                  setRejectDialogOpen(true);
                                }}
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          {isFinance && batch.status === 'approved_by_finance' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartPayment(bid)}
                            >
                              <CreditCard className="w-3 h-3 mr-1" />
                              Start Payment
                            </Button>
                          )}
                          {isFinance && batch.status === 'payment_in_progress' && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedBatch(batch);
                                setPaymentDialogOpen(true);
                              }}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Complete Payment
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

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Payroll Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select confirmed payroll records to submit into Finance batches. Records from different months are placed in separate batches.
            </p>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
              {availablePayrolls.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No confirmed payroll records are available.
                </p>
              ) : availablePayrolls.map(payroll => (
                <label key={payroll.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={selectedPayrollIds.includes(payroll.id)}
                    onChange={() => togglePayrollSelection(payroll.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{payroll.user?.name || 'Employee'}</span>
                    <span className="text-xs text-muted-foreground">{payroll.month}</span>
                  </span>
                  <span className="font-medium">₹{payroll.netSalary?.toLocaleString()}</span>
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll-batch-remarks">Remarks (optional)</Label>
              <Input
                id="payroll-batch-remarks"
                value={batchRemarks}
                onChange={event => setBatchRemarks(event.target.value)}
                placeholder="Add a note for the Finance batch"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateBatch} disabled={creatingBatch || selectedPayrollIds.length === 0}>
                {creatingBatch ? 'Creating...' : `Create Batch (${selectedPayrollIds.length})`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch group view */}
      <Dialog open={!!detailBatch} onOpenChange={open => !open && setDetailBatchId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detailBatch && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 pr-6">
                  <DialogTitle>Payroll Batch · {detailBatch.month}</DialogTitle>
                  <Badge className={getStatusColor(detailBatch.status)}>{detailBatch.status.replace(/_/g, ' ')}</Badge>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Employees</p>
                    <p className="text-xl font-bold">{detailBatch.employeeCount}</p>
                  </div>
                  <div className="rounded-lg border p-3 sm:col-span-2 bg-primary/5">
                    <p className="text-xs text-muted-foreground">Total Payable</p>
                    <p className="text-xl font-bold tabular-nums">{formatAmount(detailBatch.totalAmount)}</p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  {detailBatch.transferredByName && <span>Submitted by HR: {detailBatch.transferredByName}</span>}
                  {detailBatch.approvedByName && <span>Approved by: {detailBatch.approvedByName}</span>}
                  {detailBatch.approvedAt && <span>Approved on: {new Date(detailBatch.approvedAt).toLocaleString()}</span>}
                  {detailBatch.completedAt && <span>Paid on: {new Date(detailBatch.completedAt).toLocaleString()}</span>}
                </div>
                {detailBatch.remarks && <p className="text-sm text-muted-foreground">Remarks: {detailBatch.remarks}</p>}

                <div className="rounded-lg border divide-y">
                  {(detailBatch.payrolls || []).length === 0 ? (
                    <p className="p-4 text-sm text-center text-muted-foreground">No employee records found for this batch.</p>
                  ) : (detailBatch.payrolls || []).map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="font-medium">{p.user?.name || 'Employee'}</p>
                        <p className="text-xs text-muted-foreground">
                          {[p.user?.employeeProfileDetail?.employeeCode, p.user?.department?.name, p.user?.designation, p.month].filter(Boolean).join(' · ')}
                        </p>
                        {p.user?.employeeProfileDetail?.bankAccountNo && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {[p.user.employeeProfileDetail.bankName, p.user.employeeProfileDetail.bankAccountNo, p.user.employeeProfileDetail.ifscCode].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold tabular-nums">{formatAmount(p.netSalary)}</p>
                        <Badge variant="outline" className="text-[10px]">{p.status === 'paid' ? 'paid' : 'unpaid'}</Badge>
                      </div>
                    </div>
                  ))}
                </div>

                {isFinance && ['approved_by_finance', 'payment_in_progress'].includes(detailBatch.status) && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {detailBatch.status === 'approved_by_finance'
                          ? 'Start payment for this group'
                          : 'Payment in progress. Complete it to mark every employee in this batch paid'}
                      </p>
                      <p className="text-lg font-bold tabular-nums">{formatAmount(detailBatch.totalAmount)}</p>
                    </div>
                    {detailBatch.status === 'approved_by_finance' ? (
                      <Button onClick={() => handleStartPayment(detailBatch.id || '')} disabled={startingPayment}>
                        <CreditCard className="w-4 h-4 mr-2" />
                        {startingPayment ? 'Starting...' : `Start Payment · ${formatAmount(detailBatch.totalAmount)}`}
                      </Button>
                    ) : (
                      <Button onClick={() => { setSelectedBatch(detailBatch); setPaymentDialogOpen(true); }}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Complete Payment
                      </Button>
                    )}
                  </div>
                )}
                {detailBatch.status === 'completed' && (
                  <p className="rounded-lg border p-3 text-sm text-success bg-success/10">
                    Paid. All {detailBatch.employeeCount} employees in this batch are marked paid.
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payroll Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rejection Reason *</Label>
              <Input
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this batch is being rejected"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject}>Reject Batch</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Batch Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedBatch && (
              <p className="text-sm text-muted-foreground">
                Marks all {selectedBatch.employeeCount} employees in this batch as paid · Total {formatAmount(selectedBatch.totalAmount)}
              </p>
            )}
            <div>
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={paymentData.paymentDate}
                onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Payment Method</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={paymentData.paymentMethod}
                onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div>
              <Label>Payment Reference</Label>
              <Input
                value={paymentData.paymentReference}
                onChange={(e) => setPaymentData({ ...paymentData, paymentReference: e.target.value })}
                placeholder="Transaction ID / Reference number"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCompletePayment}>Mark as Paid</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
