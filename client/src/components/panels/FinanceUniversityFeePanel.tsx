import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, CheckCircle, Clock, DollarSign, Upload, Calendar, FileText, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Student {
  id: string;
  name: string;
  email: string;
  enrollmentNo: string;
  program: {
    name: string;
    code: string;
  };
  center: {
    name: string;
    code: string;
  };
}

interface UniversityFeePayment {
  id: string;
  semesterOrYear: string;
  amount: number;
  status: string;
  referenceNo?: string;
  paidAt?: string;
  screenshot?: string;
  createdAt: string;
  student: Student;
}

export function FinanceUniversityFeePanel() {
  const [payments, setPayments] = useState<UniversityFeePayment[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [centerFilter, setCenterFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [search, setSearch] = useState('');
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'paid'>('pending');
  const [payDialog, setPayDialog] = useState<{ open: boolean; payment: UniversityFeePayment | null }>({ open: false, payment: null });
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    referenceNo: '',
    paidAt: new Date().toISOString().split('T')[0],
    screenshot: null as File | null
  });
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({});

  const fetchPrograms = useCallback(async () => {
    try {
      const res = await api.get('/operations/programs');
      setPrograms(res.data.data || []);
    } catch (err) {}
  }, []);

  const fetchCenters = useCallback(async () => {
    try {
      const res = await api.get('/operations/centers');
      setCenters(res.data.data || []);
    } catch (err) {}
  }, []);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      // Fetch all to allow showing paid details in pending tab
      if (centerFilter && centerFilter !== 'all') query.append('centerId', centerFilter);
      if (programFilter && programFilter !== 'all') query.append('programId', programFilter);
      if (search) query.append('search', search);

      const res = await api.get(`/finance/university-fees?${query.toString()}`);
      setPayments(res.data.data || []);
      setExpandedStudents({});
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load university fees');
    } finally {
      setLoading(false);
    }
  }, [activeTab, centerFilter, programFilter, search]);

  useEffect(() => {
    fetchPayments();
    fetchCenters();
    fetchPrograms();
  }, [fetchPayments, fetchCenters, fetchPrograms]);

  const handlePayClick = (p: UniversityFeePayment) => {
    setPayDialog({ open: true, payment: p });
    setForm({
      referenceNo: '',
      paidAt: new Date().toISOString().split('T')[0],
      screenshot: null
    });
  };

  const handlePaySubmit = async () => {
    if (!payDialog.payment) return;
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('referenceNo', form.referenceNo);
      formData.append('paidAt', form.paidAt);
      if (form.screenshot) {
        formData.append('screenshot', form.screenshot);
      }

      await api.post(`/finance/university-fees/${payDialog.payment.id}/pay`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('University fee marked as paid successfully');
      setPayDialog({ open: false, payment: null });
      fetchPayments();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to submit payment');
    } finally {
      setSubmitting(false);
    }
  };

  const groupedPayments = useMemo(() => {
    return payments.reduce((acc: any, p: any) => {
      if (!acc[p.enrollmentId]) {
        acc[p.enrollmentId] = {
          student: p.student,
          enrollmentId: p.enrollmentId,
          cycles: []
        };
      }
      acc[p.enrollmentId].cycles.push(p);
      return acc;
    }, {} as Record<string, { student: Student, enrollmentId: string, cycles: UniversityFeePayment[] }>);
  }, [payments]);

  
  const groupedArray = Object.values(groupedPayments).filter(group => {
    if (activeTab === 'pending') {
      return group.cycles.some(c => c.status === 'pending');
    } else {
      return group.cycles.every(c => c.status === 'paid') && group.cycles.length > 0;
    }
  });


  const toggleStudent = (id: string) => {
    setExpandedStudents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">University Fee Payments</h2>
          <p className="text-muted-foreground text-sm mt-1">View the university fee configured for each student, what is still due, and what Finance has paid to the university.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchPayments()} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />Refresh
        </Button>
      </div>

      
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by student name or enrollment no..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={centerFilter} onValueChange={setCenterFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Centers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Centers</SelectItem>
            {centers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={programFilter} onValueChange={setProgramFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Programs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programs</SelectItem>
            {programs.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'paid')} className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-orange-500" /> Pending
          </TabsTrigger>
          <TabsTrigger value="paid" className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Paid
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-2">
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : groupedArray.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">
              <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No pending university fee payments found.</p>
            </CardContent></Card>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden bg-card text-card-foreground">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="w-10"></th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Student</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Program</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">{activeTab === 'pending' ? 'Total Pending' : 'Total Paid'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {groupedArray.map(group => {
                      const isExpanded = expandedStudents[group.enrollmentId];
                      const totalAmount = group.cycles.reduce((sum, c) => (activeTab === 'pending' && c.status === 'pending') || activeTab === 'paid' ? sum + c.amount : sum, 0);

                      return (
                        <React.Fragment key={group.enrollmentId}>
                          <tr 
                            className="hover:bg-muted/20 transition-colors cursor-pointer"
                            onClick={() => toggleStudent(group.enrollmentId)}
                          >
                            <td className="p-3 text-center text-muted-foreground">
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </td>
                            <td className="p-3">
                              <p className="font-medium text-sm">{group.student?.name}</p>
                              <p className="text-xs text-muted-foreground">{group.student?.enrollmentNo}</p>
                            </td>
                            <td className="p-3">
                              <p className="text-sm">{group.student?.program?.name}</p>
                              <p className="text-xs text-muted-foreground">{group.student?.center?.name}</p>
                            </td>
                            <td className="p-3 text-right font-bold text-blue-600">
                              ₹{totalAmount.toLocaleString()}
                            </td>
                          </tr>
                          {isExpanded && group.cycles.map(p => (
                            <tr key={p.id} className="bg-muted/5 border-t border-border">
                              <td></td>
                              <td colSpan={2} className="p-3">
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline">{p.semesterOrYear}</Badge>
                                  <span className="font-medium">₹{p.amount.toLocaleString()}</span>
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                {p.status === 'paid' ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                                      <CheckCircle className="w-4 h-4" /> Paid
                                      {p.paidAt && <span className="text-xs text-muted-foreground font-normal ml-1">on {new Date(p.paidAt).toLocaleDateString()}</span>}
                                    </div>
                                    {(p.referenceNo || p.screenshot) && (
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        {p.referenceNo && <span>Ref: {p.referenceNo}</span>}
                                        {p.screenshot && (
                                          <a
                                            href={`${(import.meta.env.VITE_API_URL || '').replace('/api/v1', '')}${p.screenshot}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                                          >
                                            <FileText className="w-3 h-3" /> View Proof
                                          </a>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <Button size="sm" onClick={() => handlePayClick(p)}>Record Payment</Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="paid" className="space-y-4 mt-2">
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : groupedArray.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No paid university fee payments recorded yet.</p>
            </CardContent></Card>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden bg-card text-card-foreground">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="w-10"></th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Student</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Program</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Total Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {groupedArray.map(group => {
                      const isExpanded = expandedStudents[group.student.id];
                      const totalAmount = group.cycles.reduce((sum, c) => sum + c.amount, 0);

                      return (
                        <React.Fragment key={group.student.id}>
                          <tr 
                            className="hover:bg-muted/20 transition-colors cursor-pointer"
                            onClick={() => toggleStudent(group.student.id)}
                          >
                            <td className="p-3 text-center text-muted-foreground">
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </td>
                            <td className="p-3">
                              <p className="font-medium text-sm">{group.student?.name}</p>
                              <p className="text-xs text-muted-foreground">{group.student?.enrollmentNo}</p>
                            </td>
                            <td className="p-3">
                              <p className="text-sm">{group.student?.program?.name}</p>
                              <p className="text-xs text-muted-foreground">{group.student?.center?.name}</p>
                            </td>
                            <td className="p-3 text-right font-bold text-green-600">
                              ₹{totalAmount.toLocaleString()}
                            </td>
                          </tr>
                          {isExpanded && group.cycles.map(p => (
                            <tr key={p.id} className="bg-muted/5 border-t border-border">
                              <td></td>
                              <td className="p-3">
                                <Badge variant="outline">{p.semesterOrYear}</Badge>
                                <span className="ml-3 font-medium text-green-600">₹{p.amount.toLocaleString()}</span>
                              </td>
                              <td className="p-3">
                                <p className="text-xs font-mono">Ref: {p.referenceNo || 'N/A'}</p>
                                {p.paidAt && (
                                  <p className="text-[11px] text-muted-foreground">
                                    Date: {new Date(p.paidAt).toLocaleDateString()}
                                  </p>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                {p.screenshot ? (
                                  <a
                                    href={`${(import.meta.env.VITE_API_URL || '').replace('/api/v1', '')}${p.screenshot}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  >
                                    <FileText className="w-3.5 h-3.5" /> View Proof
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={payDialog.open} onOpenChange={o => !o && setPayDialog({ open: false, payment: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record University Fee Payment</DialogTitle>
          </DialogHeader>

          {payDialog.payment && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-xl flex justify-between items-center text-sm">
                <div>
                  <p className="font-medium">{payDialog.payment.student.name}</p>
                  <p className="text-muted-foreground">{payDialog.payment.semesterOrYear}</p>
                </div>
                <p className="font-bold text-lg">₹{payDialog.payment.amount.toLocaleString()}</p>
              </div>

              <div className="space-y-2">
                <Label>Reference No (Optional)</Label>
                <Input
                  value={form.referenceNo}
                  onChange={e => setForm({ ...form, referenceNo: e.target.value })}
                  placeholder="e.g. UTR123456"
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    className="pl-9"
                    value={form.paidAt}
                    onChange={e => setForm({ ...form, paidAt: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Proof (Screenshot)</Label>
                <Label
                  htmlFor="screenshot-upload"
                  className={cn(
                    "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
                    form.screenshot ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  )}
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className={cn("w-8 h-8 mb-3", form.screenshot ? "text-primary" : "text-muted-foreground")} />
                    <p className="mb-2 text-sm text-muted-foreground">
                      {form.screenshot ? (
                        <span className="font-medium text-foreground">{form.screenshot.name}</span>
                      ) : (
                        <span><span className="font-semibold text-foreground">Click to upload</span> proof</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, PDF (Max 2MB)</p>
                  </div>
                  <input
                    id="screenshot-upload"
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setForm({ ...form, screenshot: e.target.files[0] });
                      }
                    }}
                  />
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog({ open: false, payment: null })}>Cancel</Button>
            <Button onClick={handlePaySubmit} disabled={submitting}>
              {submitting ? 'Saving...' : 'Mark as Paid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
