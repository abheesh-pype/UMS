import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  FileText,
  Search,
  Filter,
  RefreshCw,
  Printer,
  CreditCard,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/lib/api';
import { InvoicePrintModal } from '@/components/dialogs/InvoicePrintModal';
import { RecordInvoicePaymentModal } from '@/components/dialogs/RecordInvoicePaymentModal';
import { toast } from 'sonner';

export function InvoicesPanel() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalInvoiced: 0,
    totalPaid: 0,
    totalBalance: 0,
    totalOverdue: 0,
    counts: { all: 0, unpaid: 0, partially_paid: 0, paid: 0, overdue: 0 }
  });
  const [loading, setLoading] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [invoicePartyFilter, setInvoicePartyFilter] = useState('all');

  // Modals
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<any | null>(null);
  const [selectedInvoiceForPay, setSelectedInvoiceForPay] = useState<any | null>(null);
  const [successToast, setSuccessToast] = useState<{ message: string; receiptNo?: string } | null>(null);

  // Manual create/edit invoice dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    centerId: '',
    invoiceNo: '',
    itemDescription: '',
    itemQty: '1',
    itemRate: '',
    tax: '0',
    dueDate: '',
    status: 'unpaid'
  });

  useEffect(() => {
    fetchInvoices();
    fetchCenters();
  }, [statusFilter, invoicePartyFilter]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (invoicePartyFilter !== 'all') params.party = invoicePartyFilter;
      if (search.trim()) params.search = search.trim();

      const res = await api.get('/finance/invoices', { params });
      setInvoices(res.data.data || []);
      if (res.data.summary) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInvoices();
  };

  const fetchCenters = async () => {
    try {
      const res = await api.get('/operations/centers');
      setCenters(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch study centers:', err);
    }
  };

  const handleAutoGenerateInvoices = async () => {
    setAutoGenerating(true);
    try {
      const res = await api.post('/finance/invoices/auto-generate');
      const msg = res.data?.message || 'Invoices synced successfully!';
      setSuccessToast({ message: msg });
      setTimeout(() => setSuccessToast(null), 5000);
      fetchInvoices();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to auto-generate invoices');
    } finally {
      setAutoGenerating(false);
    }
  };

  const handleRecalculate = async (id: string) => {
    try {
      await api.post(`/finance/invoices/${id}/recalculate`);
      fetchInvoices();
    } catch (err: any) {
      console.error('Failed to recalculate balance:', err);
    }
  };

  const handleOpenInvoice = async (invoice: any) => {
    try {
      const response = await api.get(`/finance/invoices/${invoice.id}`);
      setSelectedInvoiceForPrint(response.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load the latest invoice payment history');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice? This cannot be undone.')) return;
    const remarks = prompt('Enter deletion remarks (required for audit):');
    if (!remarks) return;
    try {
      await api.delete(`/finance/invoices/${id}`, { data: { remarks } });
      fetchInvoices();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete invoice');
    }
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-[11px] font-semibold">
            <CheckCircle2 className="w-3 h-3" /> Paid
          </Badge>
        );
      case 'partially_paid':
        return (
          <Badge className="bg-amber-600 hover:bg-amber-700 text-white gap-1 text-[11px] font-semibold">
            <Clock className="w-3 h-3" /> Partially Paid
          </Badge>
        );
      case 'overdue':
        return (
          <Badge className="bg-rose-600 hover:bg-rose-700 text-white gap-1 text-[11px] font-semibold">
            <AlertTriangle className="w-3 h-3" /> Overdue
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-slate-700 border-slate-300 font-semibold text-[11px]">
            Unpaid
          </Badge>
        );
    }
  };

  // Manual invoice submission
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(formData.itemQty) || 1;
    const rate = Number(formData.itemRate) || 0;
    const tax = Number(formData.tax) || 0;
    const amount = qty * rate;
    const total = amount + tax;

    const payload: any = {
      centerId: formData.centerId || null,
      invoiceNo: formData.invoiceNo || `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
      items: [{
        description: formData.itemDescription || 'Tuition and Service Fee',
        category: 'tuition',
        quantity: qty,
        rate,
        taxRate: rate > 0 ? Math.round((tax / amount) * 100) : 0,
        amount
      }],
      amount,
      tax,
      total,
      status: formData.status
    };
    if (formData.dueDate) payload.dueDate = formData.dueDate;

    try {
      if (editingId) {
        await api.put(`/finance/invoices/${editingId}`, payload);
      } else {
        await api.post('/finance/invoices', payload);
      }
      setDialogOpen(false);
      setEditingId(null);
      fetchInvoices();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save manual invoice');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Finance Invoices & Payment History
            </h1>
            <Badge variant="secondary" className="font-mono text-xs">
              Automated Billing
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            View student and study-centre invoices. Print or save an invoice as PDF to include its complete recorded payment history.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleAutoGenerateInvoices}
            disabled={autoGenerating}
            variant="outline"
            size="sm"
            className="gap-2 border-primary/30 hover:bg-primary/5 text-primary font-semibold"
          >
            <Sparkles className={`w-4 h-4 ${autoGenerating ? 'animate-spin' : ''}`} />
            {autoGenerating ? 'Generating Invoices...' : 'Auto-Generate Invoices'}
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                <Plus className="w-4 h-4" />
                <span>Create Manual Invoice</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Custom Manual Invoice</DialogTitle>
                <CardDescription>
                  For ad-hoc student fees or center charges outside standard enrollment.
                </CardDescription>
              </DialogHeader>
              <form onSubmit={handleManualSubmit} className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Study Center (Optional)</Label>
                  <Select value={formData.centerId} onValueChange={(v) => setFormData({ ...formData, centerId: v })}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Direct University (None)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Direct University (None)</SelectItem>
                      {centers.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    className="text-xs"
                    value={formData.itemDescription}
                    onChange={(e) => setFormData({ ...formData, itemDescription: e.target.value })}
                    placeholder="e.g. Backlog Exam Fee / Re-registration"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      className="text-xs"
                      value={formData.itemQty}
                      onChange={(e) => setFormData({ ...formData, itemQty: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Rate (₹)</Label>
                    <Input
                      type="number"
                      className="text-xs font-mono font-semibold"
                      value={formData.itemRate}
                      onChange={(e) => setFormData({ ...formData, itemRate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Tax / GST (₹)</Label>
                    <Input
                      type="number"
                      className="text-xs font-mono"
                      value={formData.tax}
                      onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Due Date</Label>
                    <Input
                      type="date"
                      className="text-xs"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Create Invoice
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successToast && (
        <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successToast.message}</span>
            {successToast.receiptNo && (
              <span className="bg-emerald-200/60 px-2 py-0.5 rounded font-mono font-bold">
                Receipt: {successToast.receiptNo}
              </span>
            )}
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-700 hover:text-emerald-950 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoiced */}
        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Invoiced
              </p>
              <h3 className="text-xl font-black font-mono text-slate-900 mt-1">
                {formatCurrency(summary.totalInvoiced)}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {summary.counts.all} total active invoices
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <FileText className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Collected */}
        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Collected
              </p>
              <h3 className="text-xl font-black font-mono text-emerald-700 mt-1">
                {formatCurrency(summary.totalPaid)}
              </h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                {summary.totalInvoiced > 0
                  ? `${Math.round((summary.totalPaid / summary.totalInvoiced) * 100)}% realization rate`
                  : '0% realized'}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Outstanding Balance */}
        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Outstanding Balance
              </p>
              <h3 className="text-xl font-black font-mono text-amber-700 mt-1">
                {formatCurrency(summary.totalBalance)}
              </h3>
              <p className="text-[11px] text-amber-600 font-medium mt-0.5">
                {summary.counts.unpaid + summary.counts.partially_paid} pending collection
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Overdue Invoices */}
        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Overdue Invoices
              </p>
              <h3 className="text-xl font-black font-mono text-rose-700 mt-1">
                {formatCurrency(summary.totalOverdue)}
              </h3>
              <p className="text-[11px] text-rose-600 font-medium mt-0.5">
                {summary.counts.overdue} past payment deadline
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border">
        <div className="flex flex-col gap-2">
          <Tabs value={invoicePartyFilter} onValueChange={setInvoicePartyFilter} className="w-auto">
            <TabsList className="bg-background shadow-xs h-9">
              <TabsTrigger value="all" className="text-xs px-3">All Invoices</TabsTrigger>
              <TabsTrigger value="student" className="text-xs px-3">Students</TabsTrigger>
              <TabsTrigger value="study_center" className="text-xs px-3">Study Centres</TabsTrigger>
            </TabsList>
          </Tabs>

          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto">
            <TabsList className="bg-background shadow-xs h-9">
              <TabsTrigger value="all" className="text-xs px-3">
                All ({summary.counts.all})
              </TabsTrigger>
              <TabsTrigger value="unpaid" className="text-xs px-3">
                Unpaid ({summary.counts.unpaid})
              </TabsTrigger>
              <TabsTrigger value="partially_paid" className="text-xs px-3">
                Partially Paid ({summary.counts.partially_paid})
              </TabsTrigger>
              <TabsTrigger value="paid" className="text-xs px-3">
                Paid ({summary.counts.paid})
              </TabsTrigger>
              <TabsTrigger value="overdue" className="text-xs px-3 text-rose-700">
                Overdue ({summary.counts.overdue})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice #, student, enr #..."
              className="text-xs pl-9 h-9 bg-background"
            />
          </div>
          <Button type="submit" size="sm" variant="secondary" className="h-9 px-3">
            Search
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => { setSearch(''); fetchInvoices(); }}
            className="h-9 px-2 text-muted-foreground hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </form>
      </div>

      {/* Main Invoices Table Card */}
      <Card className="border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4 text-left">Invoice No & Date</th>
                <th className="py-3 px-4 text-left">Student & Program</th>
                <th className="py-3 px-4 text-left">Period / Session</th>
                <th className="py-3 px-4 text-right">Total Invoiced</th>
                <th className="py-3 px-4 text-center w-48">Payment Progress</th>
                <th className="py-3 px-4 text-center">Due Date</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground space-y-2">
                    <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                    <p className="font-semibold text-sm">No invoices found</p>
                    <p className="text-xs max-w-sm mx-auto">
                      Invoices are auto-generated when students are approved in Finance Review, or click "Auto-Generate Invoices" to sync existing students.
                    </p>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const studentName = inv.studentDetails?.fullName || inv.student?.name || inv.enrollment?.studentName || 'Student';
                  const enrollmentNumber = inv.studentDetails?.enrollmentNumber || inv.enrollment?.enrollmentNumber || inv.student?.enrollmentNo || 'N/A';
                  const programName = inv.studentDetails?.programName || inv.enrollment?.program?.name || 'Program';
                  const programCode = inv.studentDetails?.programCode || inv.enrollment?.program?.code || '';
                  const admissionType = inv.studentDetails?.admissionType || (inv.center ? `Centre: ${inv.center.name}` : 'Direct University');
                  const sessionName = inv.studentDetails?.sessionName || inv.period || inv.enrollment?.session?.name || 'Current';

                  const paidPercent = inv.total > 0 ? Math.min(100, Math.round((inv.paidAmount / inv.total) * 100)) : 0;
                  const isOverdue = inv.status === 'overdue' || (inv.dueDate && new Date(inv.dueDate) < new Date() && inv.balanceAmount > 0);

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Invoice No & Date */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{inv.invoiceNo}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Issued: {formatDate(inv.issuedAt || inv.createdAt)}
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono mt-1 px-1.5 py-0">
                          {inv.invoiceType || 'Tuition'}
                        </Badge>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {inv.payments?.length || 0} payment record{inv.payments?.length === 1 ? '' : 's'}
                        </div>
                      </td>

                      {/* Student & Program */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 truncate" title={studentName}>
                          {studentName}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          ID: {enrollmentNumber}
                        </div>
                        <div className="text-[11px] text-slate-700 truncate mt-0.5" title={programName}>
                          {programName} {programCode && `(${programCode})`}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium truncate">
                          {admissionType}
                        </div>
                      </td>

                      {/* Period & Session */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{sessionName}</div>
                        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          {inv.financialYear || 'FY 2026-27'}
                        </div>
                      </td>

                      {/* Total Invoiced */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        <div>{formatCurrency(inv.total)}</div>
                        {inv.tax > 0 && (
                          <div className="text-[10px] text-muted-foreground font-normal">
                            incl. {formatCurrency(inv.tax)} tax
                          </div>
                        )}
                      </td>

                      {/* Payment Progress Bar */}
                      <td className="py-3 px-4">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="text-emerald-700 font-semibold">{formatCurrency(inv.paidAmount)}</span>
                            <span className={inv.balanceAmount > 0 ? 'text-rose-600 font-semibold' : 'text-slate-500'}>
                              Bal: {formatCurrency(inv.balanceAmount)}
                            </span>
                          </div>
                          <Progress value={paidPercent} className="h-1.5 bg-slate-100" />
                          <div className="text-[10px] text-right text-muted-foreground font-mono">
                            {paidPercent}% realized
                          </div>
                        </div>
                      </td>

                      {/* Due Date */}
                      <td className="py-3 px-4 text-center">
                        <div className={`font-medium ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                          {formatDate(inv.dueDate)}
                        </div>
                        {isOverdue && (
                          <span className="inline-block px-1.5 py-0.2 bg-rose-100 text-rose-800 text-[10px] font-bold rounded mt-0.5">
                            Overdue
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4 text-center">
                        {getStatusBadge(inv.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View & Print Official Invoice */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenInvoice(inv)}
                            className="h-8 px-2 text-slate-700 hover:text-primary hover:bg-primary/10 gap-1 font-semibold text-xs"
                            title="Download invoice with complete payment history"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Invoice</span>
                          </Button>

                          {/* Record Payment Button */}
                          {inv.status !== 'paid' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedInvoiceForPay(inv)}
                              className="h-8 px-2.5 text-xs font-semibold gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              title="Record Payment & Issue Receipt"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Pay</span>
                            </Button>
                          )}

                          {/* Recalculate Balance */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRecalculate(inv.id)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                            title="Recalculate Balance"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>

                          {/* Delete Invoice */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(inv.id)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-destructive hover:bg-destructive/10"
                            title="Delete Invoice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Official Print Modal */}
      <InvoicePrintModal
        open={Boolean(selectedInvoiceForPrint)}
        onOpenChange={(open) => {
          if (!open) setSelectedInvoiceForPrint(null);
        }}
        invoice={selectedInvoiceForPrint}
      />

      {/* Record Payment Modal */}
      <RecordInvoicePaymentModal
        open={Boolean(selectedInvoiceForPay)}
        onOpenChange={(open) => {
          if (!open) setSelectedInvoiceForPay(null);
        }}
        invoice={selectedInvoiceForPay}
        onSuccess={async (updatedInvoice, receiptNo) => {
          setSuccessToast({
            message: `Payment recorded successfully for Invoice #${selectedInvoiceForPay?.invoiceNo}!`,
            receiptNo
          });
          setTimeout(() => setSuccessToast(null), 6000);
          await fetchInvoices();
          setSelectedInvoiceForPay(null);
          if (updatedInvoice?.id && Array.isArray(updatedInvoice.payments)) {
            setSelectedInvoiceForPrint(updatedInvoice);
          } else if (selectedInvoiceForPay?.id) {
            await handleOpenInvoice(selectedInvoiceForPay);
          }
        }}
      />
    </div>
  );
}
