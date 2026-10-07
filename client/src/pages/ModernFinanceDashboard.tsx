import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  CreditCard, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Receipt,
  Wallet,
  FileText,
  Users,
} from 'lucide-react';
import { InvoicesPanel } from '@/components/panels/InvoicesPanel';
import { PaymentsPanel } from '@/components/panels/PaymentsPanel';
import { ExpensesPanel } from '@/components/panels/ExpensesPanel';
import { TargetsPanel } from '@/components/panels/TargetsPanel';
import { TasksPanel } from '@/components/panels/TasksPanel';
import { PayrollPanel } from '@/components/panels/PayrollPanel';
import { PayrollBatchesPanel } from '@/components/panels/PayrollBatchesPanel';
import { StudentsPanel } from '@/components/panels/StudentsPanel';
import { StudyCentersPanel } from '@/components/panels/StudyCentersPanel';
import { BroadcastNotificationsPanel } from '@/components/panels/BroadcastNotificationsPanel';
import { AdmissionSessionsPanel } from '@/components/panels/AdmissionSessionsPanel';
import { LeavesPanel } from '@/components/panels/LeavesPanel';
import { AttendancePanel } from '@/components/panels/AttendancePanel';
import { HolidaysPanel } from '@/components/panels/HolidaysPanel';
import { NoticeBoardPanel } from '@/components/panels/NoticeBoardPanel';
import { FinanceAuthFeePanel } from '@/components/panels/FinanceAuthFeePanel';
import { FinanceCenterVerificationPanel } from '@/components/panels/FinanceCenterVerificationPanel';
import { ProgramFeeStructurePanel } from '@/components/panels/ProgramFeeStructurePanel';
import { WalletTopUpsPanel } from '@/components/panels/WalletTopUpsPanel';
import { FinanceEnrollmentsPanel } from '@/components/panels/FinanceEnrollmentsPanel';
import { IncomeExpenditurePanel } from '@/components/panels/IncomeExpenditurePanel';
import { ProfitLossPanel } from '@/components/panels/ProfitLossPanel';
import { FinanceSalaryApprovalPanel } from '@/components/panels/FinanceSalaryApprovalPanel';
import { FinanceSalesTargetsPanel } from '@/components/panels/FinanceSalesTargetsPanel';
import { FinanceUniversityFeePanel } from '@/components/panels/FinanceUniversityFeePanel';
import { SubDepartmentsPanel } from '@/components/panels/SubDepartmentsPanel';
import { CentersAdmissionsPanel } from '@/components/panels/CentersAdmissionsPanel';
import { StatusRequestsPanel } from '@/components/panels/StatusRequestsPanel';
import { FinanceTotalReportPanel } from '@/components/panels/FinanceTotalReportPanel';
import { CommissionsPanel } from '@/components/panels/CommissionsPanel';
import { FinanceReregReportWrapper } from '@/components/panels/FinanceReregReportWrapper';
import { FinanceStudentPaymentLogsPanel } from '@/components/panels/FinanceStudentPaymentLogsPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import { MyDocumentsPanel } from '@/components/panels/hr/MyDocumentsPanel';


export function ModernFinanceDashboard({ initialTab, onNavigate: _onNavigate }: { initialTab?: string, onNavigate?: (tab: string) => void }) {
  const [metrics, setMetrics] = useState<any>({});
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [payrollBatches, setPayrollBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');

  useEffect(() => {
    setActiveTab(initialTab || 'overview');
  }, [initialTab]);
  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [metricsRes, invoicesRes, expensesRes, batchesRes] = await Promise.all([
        api.get('/dashboard/metrics'),
        api.get('/finance/invoices').catch(() => ({ data: { data: [] } })),
        api.get('/finance/expenses').catch(() => ({ data: { data: [] } })),
        api.get('/finance/payroll-batches').catch(() => ({ data: { data: [] } })),
      ]);
      setMetrics(metricsRes.data.data || {});
      setInvoices(invoicesRes.data.data || []);
      setExpenses(expensesRes.data.data || []);
      setPayrollBatches(batchesRes.data.data || []);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return (
        <OverviewContent
          metrics={metrics} invoices={invoices} expenses={expenses}
          payrollBatches={payrollBatches} loading={loading} onNavigate={setActiveTab}
        />
      );
      case 'invoices': return <InvoicesPanel />;
      case 'payments': return <PaymentsPanel />;
      case 'university_fees': return <FinanceUniversityFeePanel />;
      case 'expenses': return <ExpensesPanel />;
      case 'targets': return <TargetsPanel endpoint="/finance/targets" title="Finance Targets" />;
      case 'fees': return <ProgramFeeStructurePanel />;
      case 'payroll': return <PayrollPanel />;
      case 'payroll-batches': return <PayrollBatchesPanel />;
      case 'students': return <StudentsPanel />;
      case 'study_centers': return <StudyCentersPanel financeMode />;
      case 'broadcast_notifications': return <BroadcastNotificationsPanel />;
      case 'admission_sessions': return <AdmissionSessionsPanel />;
      case 'auth_fees': return <FinanceAuthFeePanel />;
      case 'pending_payment': return <FinanceCenterVerificationPanel />;
      case 'program_fees': return <ProgramFeeStructurePanel />;
      case 'wallet_topups': return <WalletTopUpsPanel />;
      case 'enrollments_finance': return <FinanceEnrollmentsPanel />;
      case 'status_requests': return <StatusRequestsPanel type="finance" />;
      case 'center_admissions': return <CentersAdmissionsPanel />;
      case 'income_expenditure': return <IncomeExpenditurePanel />;
      case 'profit_loss': return <ProfitLossPanel />;
      case 'salary_approvals': return <FinanceSalaryApprovalPanel />;
      case 'sales_targets': return <FinanceSalesTargetsPanel />;
      case 'leaves': return <LeavesPanel />;
      case 'tasks': return <TasksPanel />;
      case 'escalations': return <FinanceEscalationsPanel />;
      case 'my_leaves': return <LeavesPanel isPersonalView />;
      case 'my_attendance': return <AttendancePanel isPersonalView />;
      case 'my_payslips': return <PayrollPanel />;
      case 'my_documents': return <MyDocumentsPanel />;
      case 'holidays': return <HolidaysPanel />;
      case 'notice-board': return <NoticeBoardPanel />;
      case 'subdepartments': return <SubDepartmentsPanel />;
      case 'total_report': return <FinanceTotalReportPanel />;
      case 'student_payment_log': return <FinanceStudentPaymentLogsPanel />;
      case 'commissions': return <CommissionsPanel />;
      case 'rereg_report': return <FinanceReregReportWrapper />;
      default: return null;
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      {renderContent()}
    </div>
  );
}

export function getFinanceNavItems() {
  return [
    { id: '__finance_section', label: 'Finance Management', isSection: true },
    { id: 'overview', label: 'Overview' },
    { id: 'student_payment_log', label: 'Student Payment Log' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'payments', label: 'Payments' },
    { id: 'university_fees', label: 'University Fees' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'targets', label: 'Targets' },
    { id: 'fees', label: 'Fee Structures' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'payroll-batches', label: 'Payroll Batches' },
    { id: 'students', label: 'Students' },
    { id: 'study_centers', label: 'Study Centers' },
    { id: 'pending_payment', label: 'Pending Payment' },
    { id: 'broadcast_notifications', label: 'Send Notifications' },
    { id: 'admission_sessions', label: 'Admissions' },
    { id: 'auth_fees', label: 'Auth Fees' },
    { id: 'program_fees', label: 'Program Fees' },
    { id: 'wallet_topups', label: 'Wallet Top-Ups' },
    { id: 'enrollments_finance', label: 'Enrollments' },
    { id: 'status_requests', label: 'Status Requests' },
    { id: 'center_admissions', label: 'Centers Admissions' },
    { id: 'income_expenditure', label: 'Income & Expenditure' },
    { id: 'profit_loss', label: 'Profit & Loss' },
    { id: 'salary_approvals', label: 'Salary Approvals' },
    { id: 'sales_targets', label: 'Sales Targets' },
    { id: 'total_report', label: 'Total Data Report' },
    { id: 'rereg_report', label: 'Re-Registration Report' },
    { id: 'commissions', label: 'Commissions' },
    { id: 'leaves', label: 'Leave Requests' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'escalations', label: 'Escalations' },
    { id: '__portal_section', label: 'My Portal', isSection: true },
    { id: 'my_leaves', label: 'My Leaves' },
    { id: 'my_attendance', label: 'My Attendance' },
    { id: 'my_payslips', label: 'Pay Slips' },
    { id: 'my_documents', label: 'My Documents' },
    { id: 'holidays', label: 'Holidays' },
    { id: 'notice-board', label: 'Notice Board' },
    { id: 'subdepartments', label: 'Sub-Departments' },
  ];
}

// ─── Overview Content ─────────────────────────────────────────────────────────

function OverviewContent({ metrics, invoices, expenses, payrollBatches, loading, onNavigate }: any) {
  // Compute live stats from real data
  const totalInvoiceAmount = invoices.reduce((s: number, i: any) => s + (i.total || i.amount || 0), 0);
  const paidInvoices = invoices.filter((i: any) => i.status === 'paid');
  const pendingInvoices = invoices.filter((i: any) => i.status === 'pending' || i.status === 'unpaid');
  const partialInvoices = invoices.filter((i: any) => i.status === 'partial');
  const totalPaid = paidInvoices.reduce((s: number, i: any) => s + (i.total || i.amount || 0), 0);
  const totalExpenses = expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const pendingExpenses = expenses.filter((e: any) => e.status === 'pending');
  const pendingBatches = payrollBatches.filter((b: any) => b.status === 'pending_finance');

  // Build bar chart data from invoices grouped by status
  const chartData = [
    { label: 'Paid', value: paidInvoices.length, color: 'hsl(var(--success))' },
    { label: 'Pending', value: pendingInvoices.length, color: 'hsl(var(--warning))' },
    { label: 'Partial', value: partialInvoices.length, color: 'hsl(var(--info))' },
    { label: 'Expenses', value: expenses.length, color: 'hsl(var(--error))' },
  ];

  const paidPct = invoices.length ? Math.round((paidInvoices.length / invoices.length) * 100) : 0;
  const partialPct = invoices.length ? Math.round((partialInvoices.length / invoices.length) * 100) : 0;
  const pendingPct = invoices.length ? Math.round((pendingInvoices.length / invoices.length) * 100) : 0;

  const recentInvoices = [...invoices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Hero Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FinanceMetric
          title="Total Receivables"
          value={`₹${(totalInvoiceAmount / 1000).toFixed(1)}K`}
          sub={`${invoices.length} total invoices`}
          trend={pendingInvoices.length > 0 ? `${pendingInvoices.length} pending` : 'All collected'}
          trendType={pendingInvoices.length > 0 ? 'warn' : 'up'}
          icon={<DollarSign className="w-5 h-5" />}
          color="primary"
          onClick={() => onNavigate('invoices')}
        />
        <FinanceMetric
          title="Total Collected"
          value={`₹${(totalPaid / 1000).toFixed(1)}K`}
          sub={`${paidInvoices.length} paid invoices`}
          trend={paidPct > 0 ? `${paidPct}% collection rate` : 'No payments yet'}
          trendType="up"
          icon={<CreditCard className="w-5 h-5" />}
          color="success"
          onClick={() => onNavigate('payments')}
        />
        <FinanceMetric
          title="Operational Expenses"
          value={`₹${(totalExpenses / 1000).toFixed(1)}K`}
          sub={`${expenses.length} expense claims`}
          trend={pendingExpenses.length > 0 ? `${pendingExpenses.length} pending approval` : 'All reviewed'}
          trendType={pendingExpenses.length > 0 ? 'down' : 'up'}
          icon={<TrendingUp className="w-5 h-5" />}
          color="warning"
          onClick={() => onNavigate('expenses')}
        />
      </div>

      {/* Secondary quick-nav row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Payroll Batches', value: pendingBatches.length, sub: 'Pending approval', icon: <Users className="w-4 h-4" />, tab: 'payroll-batches', urgent: pendingBatches.length > 0 },
          { label: 'Wallet Top-Ups', value: metrics.pendingWalletTopUps || 0, sub: 'Awaiting review', icon: <Wallet className="w-4 h-4" />, tab: 'wallet_topups', urgent: (metrics.pendingWalletTopUps || 0) > 0 },
          { label: 'Enrollments', value: metrics.pendingEnrollments || 0, sub: 'Finance review', icon: <FileText className="w-4 h-4" />, tab: 'enrollments_finance', urgent: (metrics.pendingEnrollments || 0) > 0 },
          { label: 'Pending Centers', value: metrics.pendingCenters || 0, sub: 'Payment verification', icon: <Receipt className="w-4 h-4" />, tab: 'pending_payment', urgent: (metrics.pendingCenters || 0) > 0 },
        ].map(item => (
          <Card
            key={item.label}
            className={cn('cursor-pointer transition-colors', item.urgent ? 'hover:border-warning/50 border-warning/20' : 'hover:border-primary/40')}
            onClick={() => onNavigate(item.tab)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', item.urgent ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground')}>
                {item.icon}
              </div>
              <div>
                <p className="text-xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Status Chart */}
        <Card
          className="lg:col-span-2 border-none shadow-xl bg-card/60 backdrop-blur-xl cursor-pointer hover:border-primary/30 transition-colors"
          onClick={() => onNavigate('invoices')}
        >
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Invoice Overview</CardTitle>
              <CardDescription>Live billing status — click to manage invoices</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="h-[280px]">
            {invoices.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Receipt className="w-10 h-10 opacity-20" />
                <p className="text-sm">No invoice data yet</p>
                <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); onNavigate('invoices'); }}>
                  Create Invoice
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fee Status */}
        <Card className="border-none shadow-xl bg-card/60 backdrop-blur-xl cursor-pointer hover:border-primary/30 transition-colors" onClick={() => onNavigate('invoices')}>
          <CardHeader>
            <CardTitle>Fee Status</CardTitle>
            <CardDescription>Live student billing breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <FeeStat label="Fully Paid" value={`${paidPct}%`} color="bg-success" count={`${paidInvoices.length} invoices`} />
            <FeeStat label="Partial" value={`${partialPct}%`} color="bg-warning" count={`${partialInvoices.length} invoices`} />
            <FeeStat label="Outstanding" value={`${pendingPct}%`} color="bg-error" count={`${pendingInvoices.length} invoices`} />
            <div className="pt-3 mt-3 border-t border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Total Invoices</span>
                <span className="text-sm font-bold">{invoices.length}</span>
              </div>
              <p className="text-xs text-muted-foreground">Click to view full invoice list</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Invoices */}
        <Card className="lg:col-span-2 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => onNavigate('invoices')}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Invoices</CardTitle>
            <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); onNavigate('invoices'); }}>
              View All <ArrowUpRight className="ml-1 w-3 h-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              [1,2,3,4].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)
            ) : recentInvoices.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No invoices yet</p>
              </div>
            ) : (
              recentInvoices.map((inv: any) => (
                <TransactionItem
                  key={inv.id}
                  name={inv.center?.name || inv.student?.name || (typeof inv.centerId === 'object' ? inv.centerId?.name : '') || 'Invoice'}
                  id={`#${inv.id?.slice(-8).toUpperCase()}`}
                  amount={`₹${(inv.total || inv.amount || 0).toLocaleString()}`}
                  status={inv.status}
                  type="revenue"
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Priority Tasks */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Priority Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pendingBatches.length > 0 && (
              <div
                className="p-4 rounded-xl border border-warning/20 bg-warning/5 flex items-start gap-3 cursor-pointer hover:bg-warning/10 transition-colors"
                onClick={() => onNavigate('payroll-batches')}
              >
                <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-sm">Payroll Batches Pending</h5>
                  <p className="text-xs text-muted-foreground mt-1">{pendingBatches.length} batch{pendingBatches.length > 1 ? 'es' : ''} awaiting finance approval.</p>
                </div>
              </div>
            )}
            {pendingExpenses.length > 0 && (
              <div
                className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3 cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => onNavigate('expenses')}
              >
                <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-sm">Expense Claims Pending</h5>
                  <p className="text-xs text-muted-foreground mt-1">{pendingExpenses.length} expense claim{pendingExpenses.length > 1 ? 's' : ''} waiting for review.</p>
                </div>
              </div>
            )}
            {pendingInvoices.length > 0 && (
              <div
                className="p-4 rounded-xl border border-error/20 bg-error/5 flex items-start gap-3 cursor-pointer hover:bg-error/10 transition-colors"
                onClick={() => onNavigate('invoices')}
              >
                <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-sm">Unpaid Invoices</h5>
                  <p className="text-xs text-muted-foreground mt-1">{pendingInvoices.length} invoice{pendingInvoices.length > 1 ? 's' : ''} outstanding.</p>
                </div>
              </div>
            )}
            {pendingBatches.length === 0 && pendingExpenses.length === 0 && pendingInvoices.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">All clear — no pending actions</p>
              </div>
            )}
            <div className="pt-2">
</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FinanceMetric({ title, value, sub, trend, trendType, icon, color, onClick }: any) {
  const colorMap: any = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    info: 'text-info bg-info/10',
  };
  return (
    <Card
      className={cn('group transition-all duration-300 hover:border-primary/50', onClick && 'cursor-pointer')}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn('p-2.5 rounded-xl transition-transform group-hover:scale-110', colorMap[color])}>
            {icon}
          </div>
          <div className={cn(
            'flex items-center text-xs font-bold px-2 py-1 rounded-full',
            trendType === 'up' ? 'bg-success/10 text-success' : trendType === 'down' ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'
          )}>
            {trendType === 'up' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {trend}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground pt-1">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FeeStat({ label, value, color, count }: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-bold">{value}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: value }} />
      </div>
      <p className="text-[10px] text-muted-foreground text-right">{count}</p>
    </div>
  );
}

function TransactionItem({ name, id, amount, status, type }: any) {
  const statusColor: Record<string, string> = {
    paid: 'bg-success/10 text-success',
    pending: 'bg-warning/10 text-warning',
    partial: 'bg-info/10 text-info',
    rejected: 'bg-error/10 text-error',
  };
  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center', type === 'revenue' ? 'bg-success/10 text-success' : 'bg-error/10 text-error')}>
          {type === 'revenue' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground truncate max-w-[160px]">{name}</p>
          <p className="text-[11px] text-muted-foreground uppercase">{id}</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={cn('text-sm font-bold', type === 'revenue' ? 'text-success' : 'text-foreground')}>{amount}</p>
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded uppercase font-bold', statusColor[status?.toLowerCase()] || 'bg-muted text-muted-foreground')}>
          {status}
        </span>
      </div>
    </div>
  );
}

// ─── Finance Escalations Panel ────────────────────────────────────────────────

interface Escalation {
  id: string;
  title?: string;
  description?: string;
  type?: string;
  status: string;
  priority?: string;
  raisedBy?: { name: string; email: string };
  raisedAt?: string;
}

function FinanceEscalationsPanel() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEscalations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/escalations');
      setEscalations(res.data.data || []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load escalations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEscalations(); }, []);

  const handleResolve = async (id: string) => {
    try {
      await api.put(`/escalations/${id}/resolve`, { remarks: 'Resolved by Finance Admin' });
      toast.success('Escalation resolved');
      fetchEscalations();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to resolve');
    }
  };

  const STATUS_COLOR: Record<string, string> = {
    open:     'bg-warning/10 text-warning',
    resolved: 'bg-success/10 text-success',
    closed:   'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Escalations</h2>
          <p className="text-muted-foreground text-sm mt-1">View and resolve escalations in your organisation.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchEscalations} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-warning/10 text-warning"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-bold">{escalations.filter(e => e.status === 'open').length}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Open</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/10 text-success"><CheckCircle className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-bold">{escalations.filter(e => e.status === 'resolved').length}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Resolved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary"><Clock className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-bold">{escalations.length}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : escalations.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No escalations found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {escalations.map(esc => (
            <Card key={esc.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Badge className={cn('text-[10px] uppercase font-bold', STATUS_COLOR[esc.status] || 'bg-muted text-muted-foreground')}>
                        {esc.status}
                      </Badge>
                      {esc.priority && <Badge variant="outline" className="text-[10px] uppercase font-bold">{esc.priority}</Badge>}
                      {esc.type && <Badge variant="outline" className="text-[10px]">{esc.type}</Badge>}
                    </div>
                    <h4 className="font-semibold text-sm">{esc.title || 'Escalation'}</h4>
                    {esc.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{esc.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {esc.raisedBy && <span>Raised by: {esc.raisedBy.name}</span>}
                      {esc.raisedAt && <span>{new Date(esc.raisedAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  {esc.status === 'open' && (
                    <Button size="sm" variant="outline" onClick={() => handleResolve(esc.id)}>Resolve</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
