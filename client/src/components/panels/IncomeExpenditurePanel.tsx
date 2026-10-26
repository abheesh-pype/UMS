import { useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  RefreshCw, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Plus, Pencil, Trash2,
  Download, Wallet, Users, Receipt, Clock, Search, GraduationCap, AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type EntryType = 'income' | 'expense';

interface MonthlyRow {
  month: string;
  income: { total: number; byCategory: Record<string, number> };
  expenditure: { total: number; byCategory: Record<string, number> };
  net: number;
  cumulativeNet: number;
  transactionCount: number;
  admissions: number;
  enrolled: number;
}

interface CategoryTotal {
  key: string;
  label: string;
  amount: number;
  count: number;
  manual: boolean;
}

interface StatementLine {
  id: string;
  manualId?: string;
  type: EntryType;
  category: string;
  subCategory?: string;
  date: string;
  amount: number;
  description?: string;
  party?: string | null;
  reference?: string | null;
  paymentMode?: string | null;
  source: string;
  createdByName?: string | null;
}

interface Outstanding {
  amount: number;
  count: number;
}

interface ReportData {
  period: { from: string; to: string };
  monthly: MonthlyRow[];
  totals: {
    income: number;
    expenditure: number;
    net: number;
    margin: number;
    avgMonthlyIncome: number;
    avgMonthlyExpenditure: number;
    admissions: number;
    enrolled: number;
    feesBilled: number;
    invoicesBilled: number;
    transactionCount: number;
    bestMonth: { month: string; net: number } | null;
    worstMonth: { month: string; net: number } | null;
  };
  incomeCategories: CategoryTotal[];
  expenditureCategories: CategoryTotal[];
  expenseClaimCategories: { category: string; amount: number; count: number }[];
  outstanding: {
    receivables: Outstanding;
    salaryLiabilities: Outstanding;
    pendingExpenseClaims: Outstanding;
    pendingWalletTopUps: Outstanding;
    pendingCommission: Outstanding;
  };
  transactions: StatementLine[];
  warnings: { type: string; title: string; detail: string; amount: number; items: string[] }[];
}

interface EntryForm {
  type: EntryType;
  category: string;
  amount: string;
  transactionDate: string;
  paymentMode: string;
  referenceNo: string;
  partyName: string;
  description: string;
}

type RangePreset = 'this_month' | 'last_3' | 'last_6' | 'this_fy' | 'last_fy' | 'custom';

const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: 'this_month', label: 'This Month' },
  { id: 'last_3', label: 'Last 3 Months' },
  { id: 'last_6', label: 'Last 6 Months' },
  { id: 'this_fy', label: 'This FY' },
  { id: 'last_fy', label: 'Last FY' },
  { id: 'custom', label: 'Custom' },
];

const INCOME_PRESET_CATEGORIES = [
  'Donation', 'Grant', 'Interest Income', 'Rental Income', 'Consultancy Fees', 'Event / Workshop Fees',
  'Sale of Study Material', 'Miscellaneous Income',
];
const EXPENSE_PRESET_CATEGORIES = [
  'Rent', 'Electricity', 'Internet & Phone', 'Office Supplies', 'Marketing & Advertising', 'Travel',
  'Repairs & Maintenance', 'Software & Subscriptions', 'Professional Fees', 'Printing & Stationery',
  'Bank Charges', 'Taxes & Licences', 'Miscellaneous Expense',
];
const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card', 'Other'];

// Fixed categorical order per side: colour follows the category, never its rank
const INCOME_SERIES: Record<string, string> = {
  student_fees: 'var(--ie-s1)',
  centre_onboarding: 'var(--ie-s2)',
  wallet_topups: 'var(--ie-s3)',
  commission_received: 'var(--ie-s4)',
  other: 'var(--ie-s5)',
};
const EXPENDITURE_SERIES: Record<string, string> = {
  salaries: 'var(--ie-s1)',
  expense_claims: 'var(--ie-s2)',
  university_fee_remittance: 'var(--ie-s3)',
  commission_paid: 'var(--ie-s4)',
  other: 'var(--ie-s5)',
};
const OTHER_INCOME_LABEL = 'Other Income (manual)';
const OTHER_EXPENSE_LABEL = 'Other Expenses (manual)';

const VIZ_STYLES = `
.ie-viz {
  --ie-income: #2a78d6;
  --ie-expense: #eb6834;
  --ie-positive: #2a78d6;
  --ie-negative: #e34948;
  --ie-s1: #2a78d6; --ie-s2: #eb6834; --ie-s3: #1baf7a; --ie-s4: #eda100;
  --ie-s5: #e87ba4; --ie-s6: #008300; --ie-s7: #6250d6; --ie-s8: #e34948;
  --ie-grid: hsl(var(--border));
  --ie-surface: hsl(var(--card));
}
.dark .ie-viz {
  --ie-income: #3987e5;
  --ie-expense: #d95926;
  --ie-positive: #3987e5;
  --ie-negative: #e66767;
  --ie-s1: #3987e5; --ie-s2: #d95926; --ie-s3: #199e70; --ie-s4: #c98500;
  --ie-s5: #d55181; --ie-s6: #008300; --ie-s7: #9085e9; --ie-s8: #e66767;
}
`;

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const money = (n: number) => inr.format(Math.round(n || 0));

const fmt = (n: number) => {
  const abs = Math.abs(n || 0);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
};

const fmtMonth = (m: string) => {
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
};

const fmtMonthLong = (m: string) => {
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
};

const toInputDate = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const getPresetRange = (preset: RangePreset) => {
  const now = new Date();
  const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  switch (preset) {
    case 'this_month':
      return { from: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: toInputDate(now) };
    case 'last_3':
      return { from: toInputDate(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: toInputDate(now) };
    case 'last_6':
      return { from: toInputDate(new Date(now.getFullYear(), now.getMonth() - 5, 1)), to: toInputDate(now) };
    case 'last_fy':
      return { from: toInputDate(new Date(fyStart - 1, 3, 1)), to: toInputDate(new Date(fyStart, 2, 31)) };
    case 'this_fy':
    default:
      return { from: toInputDate(new Date(fyStart, 3, 1)), to: toInputDate(now) };
  }
};

const emptyForm = (type: EntryType = 'expense'): EntryForm => ({
  type,
  category: '',
  amount: '',
  transactionDate: toInputDate(new Date()),
  paymentMode: '',
  referenceNo: '',
  partyName: '',
  description: '',
});

const csvCell = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const downloadCsv = (fileName: string, rows: unknown[][]) => {
  const blob = new Blob([rows.map(row => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const SOURCE_LABELS: Record<string, string> = {
  invoice_payment: 'Invoice payment',
  fee_receipt: 'Fee receipt',
  wallet_topup: 'Wallet top-up',
  commission_in: 'Commission',
  payroll: 'Payroll',
  expense_claim: 'Expense claim',
  university_fee_payment: 'University fee',
  commission_out: 'Commission',
  manual: 'Manual entry',
};

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '10px',
  fontSize: 12,
  color: 'hsl(var(--foreground))',
};
const AXIS_TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 11 };

export function IncomeExpenditurePanel() {
  const { user } = useAuth();
  const departmentType = ((user as any)?.department?.type || (user as any)?.subDepartment?.parentDept?.type || '').toLowerCase();
  const canManageEntries = user?.role === 'finance_admin' || (user?.role === 'employee' && departmentType === 'finance');

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState<RangePreset>('this_fy');
  const [from, setFrom] = useState(() => getPresetRange('this_fy').from);
  const [to, setTo] = useState(() => getPresetRange('this_fy').to);
  const [activeTab, setActiveTab] = useState('overview');

  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerType, setLedgerType] = useState<'all' | EntryType>('all');
  const [ledgerCategory, setLedgerCategory] = useState('all');
  const [ledgerMonth, setLedgerMonth] = useState('all');
  const [ledgerLimit, setLedgerLimit] = useState(50);

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState<EntryForm>(emptyForm());
  const [savingEntry, setSavingEntry] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StatementLine | null>(null);
  const [deletingEntry, setDeletingEntry] = useState(false);

  const fetchReport = async (range = { from, to }) => {
    if (range.from > range.to) {
      toast.error('The start date must be before the end date');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/finance/reports/income-expenditure/detailed?from=${range.from}&to=${range.to}`);
      setData(res.data.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchReport(); }, []);

  const applyPreset = (next: RangePreset) => {
    setPreset(next);
    if (next === 'custom') return;
    const range = getPresetRange(next);
    setFrom(range.from);
    setTo(range.to);
    fetchReport(range);
  };

  const categoryLabel = useMemo(() => {
    const labels: Record<string, string> = {};
    data?.incomeCategories.forEach(c => { labels[c.key] = c.label; });
    data?.expenditureCategories.forEach(c => { labels[c.key] = c.label; });
    return labels;
  }, [data]);

  // Standard categories keep their own colour; manual categories fold into one "Other" series for charts
  const incomeSeries = useMemo(() => {
    if (!data) return [];
    const standard = data.incomeCategories.filter(c => !c.manual && c.amount > 0)
      .map(c => ({ key: c.key, label: c.label, color: INCOME_SERIES[c.key] || INCOME_SERIES.other, amount: c.amount }));
    const manualTotal = data.incomeCategories.filter(c => c.manual).reduce((sum, c) => sum + c.amount, 0);
    return manualTotal > 0 ? [...standard, { key: 'other', label: OTHER_INCOME_LABEL, color: INCOME_SERIES.other, amount: manualTotal }] : standard;
  }, [data]);

  const expenditureSeries = useMemo(() => {
    if (!data) return [];
    const standard = data.expenditureCategories.filter(c => !c.manual && c.amount > 0)
      .map(c => ({ key: c.key, label: c.label, color: EXPENDITURE_SERIES[c.key] || EXPENDITURE_SERIES.other, amount: c.amount }));
    const manualTotal = data.expenditureCategories.filter(c => c.manual).reduce((sum, c) => sum + c.amount, 0);
    return manualTotal > 0 ? [...standard, { key: 'other', label: OTHER_EXPENSE_LABEL, color: EXPENDITURE_SERIES.other, amount: manualTotal }] : standard;
  }, [data]);

  const chartData = useMemo(() => (data?.monthly || []).map(m => {
    const row: Record<string, number | string> = {
      name: fmtMonth(m.month),
      month: m.month,
      Income: m.income.total,
      Expenditure: m.expenditure.total,
      Net: m.net,
      Cumulative: m.cumulativeNet,
      Admissions: m.admissions,
      Enrolled: m.enrolled,
    };
    const fold = (byCategory: Record<string, number>, prefix: string) => {
      Object.entries(byCategory).forEach(([key, amount]) => {
        const seriesKey = key.startsWith('manual_') ? 'other' : key;
        row[`${prefix}${seriesKey}`] = ((row[`${prefix}${seriesKey}`] as number) || 0) + amount;
      });
    };
    fold(m.income.byCategory, 'in_');
    fold(m.expenditure.byCategory, 'ex_');
    return row;
  }), [data]);

  const hasActivity = !!data && (data.totals.income > 0 || data.totals.expenditure > 0);

  const ledgerCategories = useMemo(() => {
    if (!data) return [];
    return [...data.incomeCategories, ...data.expenditureCategories].filter(c => c.count > 0);
  }, [data]);

  const filteredLedger = useMemo(() => {
    if (!data) return [];
    const search = ledgerSearch.trim().toLowerCase();
    return data.transactions.filter(line => {
      if (ledgerType !== 'all' && line.type !== ledgerType) return false;
      if (ledgerCategory !== 'all' && line.category !== ledgerCategory) return false;
      if (ledgerMonth !== 'all' && toInputDate(new Date(line.date)).slice(0, 7) !== ledgerMonth) return false;
      if (!search) return true;
      return [line.description, line.party, line.reference, line.paymentMode, categoryLabel[line.category], line.subCategory]
        .some(value => (value || '').toLowerCase().includes(search));
    });
  }, [data, ledgerSearch, ledgerType, ledgerCategory, ledgerMonth, categoryLabel]);

  const ledgerTotals = useMemo(() => filteredLedger.reduce((totals, line) => {
    if (line.type === 'income') totals.income += line.amount;
    else totals.expense += line.amount;
    return totals;
  }, { income: 0, expense: 0 }), [filteredLedger]);

  const openMonthInLedger = (month: string) => {
    setLedgerMonth(month);
    setLedgerType('all');
    setLedgerCategory('all');
    setLedgerSearch('');
    setLedgerLimit(50);
    setActiveTab('ledger');
  };

  const openNewEntry = (type: EntryType) => {
    setEditingEntryId(null);
    setEntryForm(emptyForm(type));
    setEntryDialogOpen(true);
  };

  const openEditEntry = (line: StatementLine) => {
    if (!line.manualId) return;
    setEditingEntryId(line.manualId);
    setEntryForm({
      type: line.type,
      category: categoryLabel[line.category] || '',
      amount: String(line.amount),
      transactionDate: toInputDate(new Date(line.date)),
      paymentMode: line.paymentMode || '',
      referenceNo: line.reference || '',
      partyName: line.party || '',
      description: line.description && line.description !== categoryLabel[line.category] ? line.description : '',
    });
    setEntryDialogOpen(true);
  };

  const handleSaveEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entryForm.category.trim()) {
      toast.error('Choose or type a category');
      return;
    }
    if (!(Number(entryForm.amount) > 0)) {
      toast.error('Enter an amount greater than zero');
      return;
    }
    setSavingEntry(true);
    try {
      const payload = { ...entryForm, amount: Number(entryForm.amount) };
      if (editingEntryId) {
        await api.put(`/finance/transactions/${editingEntryId}`, payload);
        toast.success('Entry updated');
      } else {
        await api.post('/finance/transactions', payload);
        toast.success(`${entryForm.type === 'income' ? 'Income' : 'Expense'} recorded`);
      }
      setEntryDialogOpen(false);
      fetchReport();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save entry');
    } finally {
      setSavingEntry(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!deleteTarget?.manualId) return;
    setDeletingEntry(true);
    try {
      await api.delete(`/finance/transactions/${deleteTarget.manualId}`);
      toast.success('Entry deleted');
      setDeleteTarget(null);
      fetchReport();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete entry');
    } finally {
      setDeletingEntry(false);
    }
  };

  const exportStatement = () => {
    if (!data) return;
    const incomeCols = data.incomeCategories.filter(c => c.amount > 0);
    const expenseCols = data.expenditureCategories.filter(c => c.amount > 0);
    const header = ['Month', ...incomeCols.map(c => c.label), 'Total Income', ...expenseCols.map(c => c.label), 'Total Expenditure', 'Net', 'Cumulative Net', 'Admissions'];
    const rows = data.monthly.map(m => [
      fmtMonthLong(m.month),
      ...incomeCols.map(c => Math.round(m.income.byCategory[c.key] || 0)),
      Math.round(m.income.total),
      ...expenseCols.map(c => Math.round(m.expenditure.byCategory[c.key] || 0)),
      Math.round(m.expenditure.total),
      Math.round(m.net),
      Math.round(m.cumulativeNet),
      m.admissions,
    ]);
    const totalRow = [
      'Total',
      ...incomeCols.map(c => Math.round(c.amount)),
      Math.round(data.totals.income),
      ...expenseCols.map(c => Math.round(c.amount)),
      Math.round(data.totals.expenditure),
      Math.round(data.totals.net),
      '',
      data.totals.admissions,
    ];
    downloadCsv(`income-expenditure-statement_${from}_to_${to}.csv`, [header, ...rows, totalRow]);
  };

  const exportLedger = () => {
    const header = ['Date', 'Type', 'Category', 'Description', 'Party', 'Payment Mode', 'Reference', 'Source', 'Amount'];
    const rows = filteredLedger.map(line => [
      new Date(line.date).toLocaleDateString('en-IN'),
      line.type === 'income' ? 'Income' : 'Expense',
      `${categoryLabel[line.category] || line.category}${line.subCategory ? ` / ${line.subCategory}` : ''}`,
      line.description || '',
      line.party || '',
      line.paymentMode || '',
      line.reference || '',
      SOURCE_LABELS[line.source] || line.source,
      Math.round(line.amount),
    ]);
    downloadCsv(`income-expenditure-ledger_${from}_to_${to}.csv`, [header, ...rows]);
  };

  const suggestedCategories = entryForm.type === 'income' ? INCOME_PRESET_CATEGORIES : EXPENSE_PRESET_CATEGORIES;
  const existingManualCategories = (entryForm.type === 'income' ? data?.incomeCategories : data?.expenditureCategories)
    ?.filter(c => c.manual).map(c => c.label) || [];
  const categoryOptions = Array.from(new Set([...existingManualCategories, ...suggestedCategories]));

  return (
    <div className="ie-viz space-y-6">
      <style>{VIZ_STYLES}</style>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Income & Expenditure</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Cash-basis statement of money received and spent, built from admissions, study centre payments, payroll, expenses and manual entries.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportStatement} disabled={!data}>
            <Download className="w-4 h-4 mr-2" />Export Statement
          </Button>
          {canManageEntries && (
            <>
              <Button variant="outline" size="sm" onClick={() => openNewEntry('income')}>
                <Plus className="w-4 h-4 mr-2" />Add Income
              </Button>
              <Button size="sm" onClick={() => openNewEntry('expense')}>
                <Plus className="w-4 h-4 mr-2" />Add Expense
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Period filter */}
      <Card>
        <CardContent className="p-3 flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {RANGE_PRESETS.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => applyPreset(option.id)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold border transition-all',
                  preset === option.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/40'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            <input
              type="date"
              value={from}
              onChange={e => { setFrom(e.target.value); setPreset('custom'); }}
              aria-label="From date"
              className="h-8 px-2 text-sm rounded-lg border border-border bg-background"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <input
              type="date"
              value={to}
              onChange={e => { setTo(e.target.value); setPreset('custom'); }}
              aria-label="To date"
              className="h-8 px-2 text-sm rounded-lg border border-border bg-background"
            />
            <Button size="sm" onClick={() => fetchReport()} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-xl border bg-muted/40 animate-pulse" />)}
        </div>
      )}

      {data && (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              label="Total Income"
              value={money(data.totals.income)}
              icon={<TrendingUp className="w-5 h-5" />}
              color="text-blue-600 bg-blue-50 dark:bg-blue-900/20"
              sub={`Avg ${money(data.totals.avgMonthlyIncome)} / month`}
            />
            <SummaryCard
              label="Total Expenditure"
              value={money(data.totals.expenditure)}
              icon={<TrendingDown className="w-5 h-5" />}
              color="text-orange-600 bg-orange-50 dark:bg-orange-900/20"
              sub={`Avg ${money(data.totals.avgMonthlyExpenditure)} / month`}
            />
            <SummaryCard
              label={data.totals.net >= 0 ? 'Net Surplus' : 'Net Deficit'}
              value={money(Math.abs(data.totals.net))}
              icon={data.totals.net >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
              color={data.totals.net >= 0 ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-red-500 bg-red-50 dark:bg-red-900/20'}
              sub={`${data.totals.margin}% of income${data.totals.net < 0 ? ' (deficit)' : ''}`}
            />
            <SummaryCard
              label="Admissions"
              value={data.totals.admissions.toLocaleString('en-IN')}
              icon={<GraduationCap className="w-5 h-5" />}
              color="text-violet-600 bg-violet-50 dark:bg-violet-900/20"
              sub={`${data.totals.enrolled} enrolled · ${money(data.totals.feesBilled)} fees billed`}
            />
          </div>

          {/* Records that make the statement inaccurate until Finance corrects them */}
          {data.warnings?.length > 0 && (
            <Card className="border-amber-300 dark:border-amber-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" /> Needs attention ({data.warnings.length})
                </CardTitle>
                <CardDescription>These records affect the accuracy of this statement. Correct them at the source to fix the figures.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.warnings.map(warning => (
                  <div key={warning.type} className="rounded-lg border bg-amber-50/60 dark:bg-amber-900/10 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <p className="font-semibold">{warning.title}</p>
                      <span className="font-semibold whitespace-nowrap">{money(warning.amount)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{warning.detail}</p>
                    <ul className="mt-2 space-y-0.5 text-xs list-disc pl-4">
                      {warning.items.map(item => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Outstanding / pending positions (not counted until the money moves) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /> Outstanding & Pending</CardTitle>
              <CardDescription>Amounts not yet received or paid. They are excluded from the totals above until the money moves.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <OutstandingTile label="Fee Receivables" detail="unpaid invoices" value={data.outstanding.receivables} icon={<Receipt className="w-4 h-4" />} />
              <OutstandingTile label="Salary Liabilities" detail="confirmed, not paid" value={data.outstanding.salaryLiabilities} icon={<Users className="w-4 h-4" />} />
              <OutstandingTile label="Pending Expense Claims" detail="awaiting approval" value={data.outstanding.pendingExpenseClaims} icon={<AlertCircle className="w-4 h-4" />} />
              <OutstandingTile label="Pending Wallet Top-ups" detail="awaiting verification" value={data.outstanding.pendingWalletTopUps} icon={<Wallet className="w-4 h-4" />} />
              <OutstandingTile label="Commission Due" detail="from universities" value={data.outstanding.pendingCommission} icon={<TrendingUp className="w-4 h-4" />} />
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="statement">Monthly Statement</TabsTrigger>
              <TabsTrigger value="income">Income Sources</TabsTrigger>
              <TabsTrigger value="expenditure">Expenditure Breakdown</TabsTrigger>
              <TabsTrigger value="ledger">All Transactions</TabsTrigger>
            </TabsList>

            {/* ── Overview ── */}
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Income vs Expenditure</CardTitle>
                  <CardDescription>Money received and spent in each month</CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  {!hasActivity ? <EmptyChart /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barGap={2}>
                        <CartesianGrid vertical={false} stroke="var(--ie-grid)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                        <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} tickFormatter={v => fmt(v)} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} formatter={(v: any) => money(Number(v))} />
                        <Legend />
                        <Bar dataKey="Income" fill="var(--ie-income)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                        <Bar dataKey="Expenditure" fill="var(--ie-expense)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Net Surplus / Deficit by Month</CardTitle>
                    <CardDescription>Blue months earned more than they spent; red months spent more</CardDescription>
                  </CardHeader>
                  <CardContent className="h-60">
                    {!hasActivity ? <EmptyChart /> : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid vertical={false} stroke="var(--ie-grid)" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                          <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} tickFormatter={v => fmt(v)} />
                          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} formatter={(v: any) => money(Number(v))} />
                          <Bar dataKey="Net" radius={[4, 4, 0, 0]} maxBarSize={28}>
                            {chartData.map(row => (
                              <Cell key={row.month as string} fill={(row.Net as number) >= 0 ? 'var(--ie-positive)' : 'var(--ie-negative)'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Cumulative Net Position</CardTitle>
                    <CardDescription>Running surplus from the start of the period</CardDescription>
                  </CardHeader>
                  <CardContent className="h-60">
                    {!hasActivity ? <EmptyChart /> : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid vertical={false} stroke="var(--ie-grid)" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                          <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} tickFormatter={v => fmt(v)} />
                          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => money(Number(v))} />
                          <Line type="monotone" dataKey="Cumulative" stroke="var(--ie-income)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: 'var(--ie-surface)' }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ShareCard title="Where the money came from" series={incomeSeries} total={data.totals.income} emptyText="No income recorded in this period" />
                <ShareCard title="Where the money went" series={expenditureSeries} total={data.totals.expenditure} emptyText="No expenditure recorded in this period" />
              </div>

              {(data.totals.bestMonth || data.totals.worstMonth) && hasActivity && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data.totals.bestMonth && (
                    <Card><CardContent className="p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Strongest month</p>
                      <p className="text-lg font-bold">{fmtMonthLong(data.totals.bestMonth.month)}</p>
                      <p className="text-sm text-muted-foreground">Net {money(data.totals.bestMonth.net)}</p>
                    </CardContent></Card>
                  )}
                  {data.totals.worstMonth && (
                    <Card><CardContent className="p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Weakest month</p>
                      <p className="text-lg font-bold">{fmtMonthLong(data.totals.worstMonth.month)}</p>
                      <p className="text-sm text-muted-foreground">Net {money(data.totals.worstMonth.net)}</p>
                    </CardContent></Card>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ── Monthly statement ── */}
            <TabsContent value="statement">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle>Monthly Statement</CardTitle>
                    <CardDescription>Click a month to see every transaction behind it</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportStatement}>
                    <Download className="w-4 h-4 mr-2" />CSV
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          <th className="text-left p-3 font-medium text-muted-foreground">Month</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">Admissions</th>
                          {data.incomeCategories.filter(c => c.amount > 0).map(c => (
                            <th key={c.key} className="text-right p-3 font-medium text-muted-foreground whitespace-nowrap">{c.label}</th>
                          ))}
                          <th className="text-right p-3 font-medium text-muted-foreground whitespace-nowrap">Total Income</th>
                          {data.expenditureCategories.filter(c => c.amount > 0).map(c => (
                            <th key={c.key} className="text-right p-3 font-medium text-muted-foreground whitespace-nowrap">{c.label}</th>
                          ))}
                          <th className="text-right p-3 font-medium text-muted-foreground whitespace-nowrap">Total Expenditure</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">Net</th>
                          <th className="text-right p-3 font-medium text-muted-foreground whitespace-nowrap">Cumulative</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.monthly.map(row => (
                          <tr
                            key={row.month}
                            className="hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => openMonthInLedger(row.month)}
                            title="View transactions for this month"
                          >
                            <td className="p-3 font-medium whitespace-nowrap">{fmtMonthLong(row.month)}</td>
                            <td className="p-3 text-right text-muted-foreground">{row.admissions}</td>
                            {data.incomeCategories.filter(c => c.amount > 0).map(c => (
                              <td key={c.key} className="p-3 text-right text-muted-foreground whitespace-nowrap">{money(row.income.byCategory[c.key] || 0)}</td>
                            ))}
                            <td className="p-3 text-right font-semibold whitespace-nowrap">{money(row.income.total)}</td>
                            {data.expenditureCategories.filter(c => c.amount > 0).map(c => (
                              <td key={c.key} className="p-3 text-right text-muted-foreground whitespace-nowrap">{money(row.expenditure.byCategory[c.key] || 0)}</td>
                            ))}
                            <td className="p-3 text-right font-semibold whitespace-nowrap">{money(row.expenditure.total)}</td>
                            <td className={cn('p-3 text-right font-bold whitespace-nowrap', row.net >= 0 ? 'text-green-600' : 'text-red-500')}>
                              {row.net > 0 ? '+' : ''}{money(row.net)}
                            </td>
                            <td className="p-3 text-right text-muted-foreground whitespace-nowrap">{money(row.cumulativeNet)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-border bg-muted/30">
                        <tr>
                          <td className="p-3 font-bold">Total</td>
                          <td className="p-3 text-right font-bold">{data.totals.admissions}</td>
                          {data.incomeCategories.filter(c => c.amount > 0).map(c => (
                            <td key={c.key} className="p-3 text-right font-bold whitespace-nowrap">{money(c.amount)}</td>
                          ))}
                          <td className="p-3 text-right font-bold whitespace-nowrap">{money(data.totals.income)}</td>
                          {data.expenditureCategories.filter(c => c.amount > 0).map(c => (
                            <td key={c.key} className="p-3 text-right font-bold whitespace-nowrap">{money(c.amount)}</td>
                          ))}
                          <td className="p-3 text-right font-bold whitespace-nowrap">{money(data.totals.expenditure)}</td>
                          <td className={cn('p-3 text-right font-bold text-base whitespace-nowrap', data.totals.net >= 0 ? 'text-green-600' : 'text-red-500')}>
                            {data.totals.net > 0 ? '+' : ''}{money(data.totals.net)}
                          </td>
                          <td className="p-3" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Income sources ── */}
            <TabsContent value="income" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Income by Source per Month</CardTitle>
                  <CardDescription>Each bar is one month's income split by where it came from</CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  {incomeSeries.length === 0 ? <EmptyChart text="No income recorded in this period" /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid vertical={false} stroke="var(--ie-grid)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                        <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} tickFormatter={v => fmt(v)} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} formatter={(v: any) => money(Number(v))} />
                        <Legend />
                        {incomeSeries.map((series, index) => (
                          <Bar
                            key={series.key}
                            dataKey={`in_${series.key}`}
                            name={series.label}
                            stackId="income"
                            fill={series.color}
                            stroke="var(--ie-surface)"
                            strokeWidth={1}
                            maxBarSize={32}
                            radius={index === incomeSeries.length - 1 ? [4, 4, 0, 0] : undefined}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <CategoryTable
                  title="Income Sources"
                  categories={data.incomeCategories}
                  total={data.totals.income}
                  colorFor={c => (c.manual ? INCOME_SERIES.other : INCOME_SERIES[c.key] || INCOME_SERIES.other)}
                  onSelect={key => { setLedgerCategory(key); setLedgerType('income'); setLedgerMonth('all'); setActiveTab('ledger'); }}
                />
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Admissions per Month</CardTitle>
                    <CardDescription>Student applications received ({data.totals.admissions} in this period)</CardDescription>
                  </CardHeader>
                  <CardContent className="h-60">
                    {data.totals.admissions === 0 ? <EmptyChart text="No admissions in this period" /> : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                          <CartesianGrid vertical={false} stroke="var(--ie-grid)" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                          <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} allowDecimals={false} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
                          <Bar dataKey="Admissions" fill="var(--ie-s1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── Expenditure breakdown ── */}
            <TabsContent value="expenditure" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Expenditure by Head per Month</CardTitle>
                  <CardDescription>Each bar is one month's spending split by expense head</CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  {expenditureSeries.length === 0 ? <EmptyChart text="No expenditure recorded in this period" /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid vertical={false} stroke="var(--ie-grid)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={AXIS_TICK} />
                        <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} tickFormatter={v => fmt(v)} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} formatter={(v: any) => money(Number(v))} />
                        <Legend />
                        {expenditureSeries.map((series, index) => (
                          <Bar
                            key={series.key}
                            dataKey={`ex_${series.key}`}
                            name={series.label}
                            stackId="expenditure"
                            fill={series.color}
                            stroke="var(--ie-surface)"
                            strokeWidth={1}
                            maxBarSize={32}
                            radius={index === expenditureSeries.length - 1 ? [4, 4, 0, 0] : undefined}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <CategoryTable
                  title="Expenditure Heads"
                  categories={data.expenditureCategories}
                  total={data.totals.expenditure}
                  colorFor={c => (c.manual ? EXPENDITURE_SERIES.other : EXPENDITURE_SERIES[c.key] || EXPENDITURE_SERIES.other)}
                  onSelect={key => { setLedgerCategory(key); setLedgerType('expense'); setLedgerMonth('all'); setActiveTab('ledger'); }}
                />
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Expense Claims by Category</CardTitle>
                    <CardDescription>Approved and reimbursed employee claims</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.expenseClaimCategories.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No approved expense claims in this period.</p>
                    ) : data.expenseClaimCategories.map(claim => (
                      <BreakdownRow
                        key={claim.category}
                        label={`${claim.category.charAt(0).toUpperCase()}${claim.category.slice(1)} (${claim.count})`}
                        amount={claim.amount}
                        total={data.expenditureCategories.find(c => c.key === 'expense_claims')?.amount || 0}
                        color={EXPENDITURE_SERIES.expense_claims}
                      />
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── Ledger ── */}
            <TabsContent value="ledger">
              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle>All Transactions</CardTitle>
                      <CardDescription>
                        {filteredLedger.length} of {data.transactions.length} entries · In {money(ledgerTotals.income)} · Out {money(ledgerTotals.expense)} · Net {money(ledgerTotals.income - ledgerTotals.expense)}
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={exportLedger} disabled={filteredLedger.length === 0}>
                      <Download className="w-4 h-4 mr-2" />CSV
                    </Button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search description, party, reference..."
                        className="pl-9"
                        value={ledgerSearch}
                        onChange={e => { setLedgerSearch(e.target.value); setLedgerLimit(50); }}
                      />
                    </div>
                    <Select value={ledgerType} onValueChange={value => { setLedgerType(value as 'all' | EntryType); setLedgerCategory('all'); setLedgerLimit(50); }}>
                      <SelectTrigger className="w-[140px]" aria-label="Type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={ledgerCategory} onValueChange={value => { setLedgerCategory(value); setLedgerLimit(50); }}>
                      <SelectTrigger className="w-[220px]" aria-label="Category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {ledgerCategories
                          .filter(c => ledgerType === 'all' || (ledgerType === 'income' ? data.incomeCategories.includes(c) : data.expenditureCategories.includes(c)))
                          .map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={ledgerMonth} onValueChange={value => { setLedgerMonth(value); setLedgerLimit(50); }}>
                      <SelectTrigger className="w-[170px]" aria-label="Month"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All months</SelectItem>
                        {data.monthly.map(m => <SelectItem key={m.month} value={m.month}>{fmtMonthLong(m.month)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {filteredLedger.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">No transactions match these filters.</p>
                  ) : (
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b border-border">
                          <tr>
                            <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Category</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Description</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Party</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Mode / Ref</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                            {canManageEntries && <th className="p-3" />}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredLedger.slice(0, ledgerLimit).map(line => (
                            <tr key={line.id} className="hover:bg-muted/30 transition-colors align-top">
                              <td className="p-3 whitespace-nowrap">{new Date(line.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className={cn('text-[10px] uppercase', line.type === 'income' ? 'text-blue-600 border-blue-200 dark:border-blue-900' : 'text-orange-600 border-orange-200 dark:border-orange-900')}>
                                    {line.type === 'income' ? 'In' : 'Out'}
                                  </Badge>
                                  <span className="font-medium">{categoryLabel[line.category] || line.category}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {SOURCE_LABELS[line.source] || line.source}{line.subCategory ? ` · ${line.subCategory}` : ''}
                                  {line.createdByName ? ` · by ${line.createdByName}` : ''}
                                </p>
                              </td>
                              <td className="p-3 max-w-[260px] break-words">{line.description || '—'}</td>
                              <td className="p-3">{line.party || '—'}</td>
                              <td className="p-3 text-xs text-muted-foreground">
                                <p>{line.paymentMode || '—'}</p>
                                {line.reference && <p className="font-mono break-all">{line.reference}</p>}
                              </td>
                              <td className={cn('p-3 text-right font-semibold whitespace-nowrap', line.type === 'income' ? 'text-green-600' : 'text-red-500')}>
                                {line.type === 'income' ? '+' : '-'}{money(line.amount)}
                              </td>
                              {canManageEntries && (
                                <td className="p-3 text-right whitespace-nowrap">
                                  {line.manualId && (
                                    <div className="flex justify-end gap-1">
                                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Edit entry" onClick={() => openEditEntry(line)}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Delete entry" onClick={() => setDeleteTarget(line)}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {filteredLedger.length > ledgerLimit && (
                    <div className="p-3 border-t text-center">
                      <Button variant="ghost" size="sm" onClick={() => setLedgerLimit(limit => limit + 50)}>
                        Show more ({filteredLedger.length - ledgerLimit} remaining)
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Add / edit manual entry */}
      <Dialog open={entryDialogOpen} onOpenChange={open => !savingEntry && setEntryDialogOpen(open)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEntryId ? 'Edit Entry' : entryForm.type === 'income' ? 'Record Income' : 'Record Expense'}</DialogTitle>
            <DialogDescription>
              Use this for money that is not already captured by admissions, payroll, expense claims or university fee payments.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEntry} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(['income', 'expense'] as EntryType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEntryForm(current => ({ ...current, type, category: current.type === type ? current.category : '' }))}
                  className={cn(
                    'rounded-lg border p-2 text-sm font-semibold transition-all',
                    entryForm.type === type
                      ? type === 'income' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  )}
                >
                  {type === 'income' ? 'Income' : 'Expense'}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <Label htmlFor="ie-category">Category</Label>
              <Input
                id="ie-category"
                list="ie-category-options"
                placeholder={entryForm.type === 'income' ? 'e.g. Donation' : 'e.g. Rent'}
                value={entryForm.category}
                onChange={e => setEntryForm(current => ({ ...current, category: e.target.value }))}
                required
              />
              <datalist id="ie-category-options">
                {categoryOptions.map(option => <option key={option} value={option} />)}
              </datalist>
              <div className="flex flex-wrap gap-1 pt-1">
                {categoryOptions.slice(0, 8).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setEntryForm(current => ({ ...current, category: option }))}
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[11px] border transition-all',
                      entryForm.category === option ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ie-amount">Amount (₹)</Label>
                <Input
                  id="ie-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={entryForm.amount}
                  onChange={e => setEntryForm(current => ({ ...current, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ie-date">Date</Label>
                <Input
                  id="ie-date"
                  type="date"
                  value={entryForm.transactionDate}
                  onChange={e => setEntryForm(current => ({ ...current, transactionDate: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Payment Mode</Label>
                <Select value={entryForm.paymentMode || undefined} onValueChange={value => setEntryForm(current => ({ ...current, paymentMode: value }))}>
                  <SelectTrigger aria-label="Payment mode"><SelectValue placeholder="Select mode" /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map(mode => <SelectItem key={mode} value={mode}>{mode}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ie-reference">Reference No.</Label>
                <Input
                  id="ie-reference"
                  placeholder="Txn / cheque / bill no."
                  value={entryForm.referenceNo}
                  onChange={e => setEntryForm(current => ({ ...current, referenceNo: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ie-party">{entryForm.type === 'income' ? 'Received From' : 'Paid To'}</Label>
              <Input
                id="ie-party"
                placeholder={entryForm.type === 'income' ? 'Person or organisation' : 'Vendor or payee'}
                value={entryForm.partyName}
                onChange={e => setEntryForm(current => ({ ...current, partyName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ie-description">Description</Label>
              <Textarea
                id="ie-description"
                rows={3}
                placeholder="What was this for?"
                value={entryForm.description}
                onChange={e => setEntryForm(current => ({ ...current, description: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEntryDialogOpen(false)} disabled={savingEntry}>Cancel</Button>
              <Button type="submit" disabled={savingEntry}>
                {savingEntry ? 'Saving...' : editingEntryId ? 'Save Changes' : 'Save Entry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && !deletingEntry && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this entry?</DialogTitle>
            <DialogDescription>
              {deleteTarget && `${categoryLabel[deleteTarget.category] || 'Entry'} of ${money(deleteTarget.amount)} on ${new Date(deleteTarget.date).toLocaleDateString('en-IN')} will be removed from the statement. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deletingEntry}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteEntry} disabled={deletingEntry}>
              {deletingEntry ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value, icon, color, sub }: { label: string; value: string; icon: ReactNode; color: string; sub: string }) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn('p-3 rounded-xl', color)}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold truncate">{value}</p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function OutstandingTile({ label, detail, value, icon }: { label: string; detail: string; value: Outstanding; icon: ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="text-lg font-bold mt-1">{money(value.amount)}</p>
      <p className="text-[11px] text-muted-foreground">{value.count} {detail}</p>
    </div>
  );
}

function EmptyChart({ text = 'No income or expenditure in this period' }: { text?: string }) {
  return <div className="h-full flex items-center justify-center text-muted-foreground text-sm">{text}</div>;
}

function ShareCard({ title, series, total, emptyText }: {
  title: string;
  series: { key: string; label: string; color: string; amount: number }[];
  total: number;
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {series.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{emptyText}</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={series} dataKey="amount" nameKey="label" innerRadius="62%" outerRadius="95%" stroke="var(--ie-surface)" strokeWidth={2} paddingAngle={series.length > 1 ? 1 : 0}>
                    {series.map(s => <Cell key={s.key} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => money(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 w-full space-y-2">
              {series.map(s => (
                <div key={s.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                    <span className="text-muted-foreground truncate">{s.label}</span>
                  </span>
                  <span className="font-semibold whitespace-nowrap">
                    {money(s.amount)} <span className="text-xs font-normal text-muted-foreground">({total > 0 ? Math.round((s.amount / total) * 100) : 0}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryTable({ title, categories, total, colorFor, onSelect }: {
  title: string;
  categories: CategoryTotal[];
  total: number;
  colorFor: (category: CategoryTotal) => string;
  onSelect: (key: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Click a row to see its transactions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {categories.map(category => (
          <button
            key={category.key}
            type="button"
            className="w-full text-left rounded-md p-1 -m-1 hover:bg-muted/40 transition-colors disabled:opacity-60 disabled:hover:bg-transparent"
            onClick={() => onSelect(category.key)}
            disabled={category.count === 0}
          >
            <BreakdownRow
              label={`${category.label}${category.manual ? ' · manual' : ''} (${category.count})`}
              amount={category.amount}
              total={total}
              color={colorFor(category)}
            />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function BreakdownRow({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold whitespace-nowrap">{money(amount)} <span className="text-muted-foreground font-normal text-xs">({pct}%)</span></span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
