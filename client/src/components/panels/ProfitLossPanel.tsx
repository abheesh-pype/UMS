import { useState, useEffect, useMemo, Fragment } from 'react';
import {
  RefreshCw, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Download, AlertCircle, X,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, Cell, ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

// Data comes from the cash-basis Income & Expenditure report: every money movement counted once
interface StatementLine {
  id: string;
  type: 'income' | 'expense';
  category: string;
  subCategory?: string;
  date: string;
  amount: number;
  description?: string;
  party?: string | null;
  reference?: string | null;
  paymentMode?: string | null;
  source: string;
}

interface CategoryTotal {
  key: string;
  label: string;
  amount: number;
  count: number;
  manual: boolean;
}

interface ReportData {
  incomeCategories: CategoryTotal[];
  expenditureCategories: CategoryTotal[];
  transactions: StatementLine[];
  warnings?: { type: string; title: string; amount: number }[];
}

type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'fy' | 'custom';
type Granularity = 'day' | 'week' | 'month' | 'quarter';

const PERIOD_TYPES: { id: PeriodType; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'year', label: 'Year' },
  { id: 'fy', label: 'Financial Year' },
  { id: 'custom', label: 'Date Range' },
];

const GRANULARITIES: { id: Granularity; label: string }[] = [
  { id: 'day', label: 'Daily' },
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
  { id: 'quarter', label: 'Quarterly' },
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const VIZ_STYLES = `
.pl-viz {
  --pl-revenue: #2a78d6;
  --pl-expense: #eb6834;
  --pl-positive: #2a78d6;
  --pl-negative: #e34948;
  --pl-surface: hsl(var(--card));
}
.dark .pl-viz {
  --pl-revenue: #3987e5;
  --pl-expense: #d95926;
  --pl-positive: #3987e5;
  --pl-negative: #e66767;
}
`;

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '10px',
  fontSize: 12,
  color: 'hsl(var(--foreground))',
};
const AXIS_TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 11 };

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

// ── Date helpers (all in local time) ──

const toKey = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const parseKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const weekStart = (date: Date) => addDays(date, -((date.getDay() + 6) % 7)); // Monday
const fyStartYear = (date: Date) => (date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1);
// Financial-year quarters: Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar
const quarterStart = (date: Date) => {
  const startMonth = Math.floor(((date.getMonth() + 9) % 12) / 3) * 3;
  const month = (startMonth + 3) % 12;
  return new Date(date.getFullYear(), month, 1);
};
const fyLabel = (startYear: number) => `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
const shortDate = (date: Date) => date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const longDate = (date: Date) => date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const getRange = (type: PeriodType, anchorKey: string, customFrom: string, customTo: string) => {
  const anchor = parseKey(anchorKey);
  switch (type) {
    case 'day':
      return { from: anchor, to: anchor };
    case 'week': {
      const start = weekStart(anchor);
      return { from: start, to: addDays(start, 6) };
    }
    case 'month':
      return { from: new Date(anchor.getFullYear(), anchor.getMonth(), 1), to: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0) };
    case 'quarter': {
      const start = quarterStart(anchor);
      return { from: start, to: new Date(start.getFullYear(), start.getMonth() + 3, 0) };
    }
    case 'year':
      return { from: new Date(anchor.getFullYear(), 0, 1), to: new Date(anchor.getFullYear(), 11, 31) };
    case 'fy': {
      const year = fyStartYear(anchor);
      return { from: new Date(year, 3, 1), to: new Date(year + 1, 2, 31) };
    }
    case 'custom':
    default:
      return { from: parseKey(customFrom), to: parseKey(customTo) };
  }
};

const shiftAnchor = (type: PeriodType, anchorKey: string, direction: number) => {
  const anchor = parseKey(anchorKey);
  switch (type) {
    case 'day': return toKey(addDays(anchor, direction));
    case 'week': return toKey(addDays(anchor, 7 * direction));
    case 'month': return toKey(new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1));
    case 'quarter': return toKey(new Date(anchor.getFullYear(), anchor.getMonth() + 3 * direction, 1));
    case 'year':
    case 'fy': return toKey(new Date(anchor.getFullYear() + direction, anchor.getMonth(), 1));
    default: return anchorKey;
  }
};

const dayCount = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 86400000) + 1;

const describePeriod = (type: PeriodType, from: Date, to: Date) => {
  switch (type) {
    case 'day': return from.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    case 'week': return `Week of ${shortDate(from)} – ${longDate(to)}`;
    case 'month': return `${MONTH_NAMES[from.getMonth()]} ${from.getFullYear()}`;
    case 'quarter': return `Q${Math.floor(((from.getMonth() + 9) % 12) / 3) + 1} ${fyLabel(fyStartYear(from))} (${shortDate(from)} – ${longDate(to)})`;
    case 'year': return `Calendar Year ${from.getFullYear()}`;
    case 'fy': return `${fyLabel(from.getFullYear())} (1 Apr ${from.getFullYear()} – 31 Mar ${from.getFullYear() + 1})`;
    default: return `${longDate(from)} – ${longDate(to)}`;
  }
};

const defaultGranularity = (type: PeriodType, days: number): Granularity => {
  if (type === 'day' || type === 'week') return 'day';
  if (type === 'month') return days > 31 ? 'week' : 'day';
  if (type === 'quarter') return 'week';
  if (type === 'year' || type === 'fy') return 'month';
  if (days <= 31) return 'day';
  if (days <= 92) return 'week';
  if (days <= 730) return 'month';
  return 'quarter';
};

const bucketStart = (date: Date, granularity: Granularity) => {
  if (granularity === 'day') return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (granularity === 'week') return weekStart(date);
  if (granularity === 'month') return new Date(date.getFullYear(), date.getMonth(), 1);
  return quarterStart(date);
};

const nextBucket = (start: Date, granularity: Granularity) => {
  if (granularity === 'day') return addDays(start, 1);
  if (granularity === 'week') return addDays(start, 7);
  if (granularity === 'month') return new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return new Date(start.getFullYear(), start.getMonth() + 3, 1);
};

const bucketLabel = (start: Date, granularity: Granularity) => {
  if (granularity === 'day') return start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  if (granularity === 'week') return `${shortDate(start)} – ${shortDate(addDays(start, 6))}`;
  if (granularity === 'month') return start.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  return `Q${Math.floor(((start.getMonth() + 9) % 12) / 3) + 1} ${fyLabel(fyStartYear(start))}`;
};

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

// Sum statement lines into revenue and expense heads
const summarise = (lines: StatementLine[]) => {
  const income = new Map<string, number>();
  const expense = new Map<string, number>();
  const claimCategories = new Map<string, number>();
  let revenue = 0;
  let expenses = 0;
  for (const line of lines) {
    if (line.type === 'income') {
      revenue += line.amount;
      income.set(line.category, (income.get(line.category) || 0) + line.amount);
    } else {
      expenses += line.amount;
      expense.set(line.category, (expense.get(line.category) || 0) + line.amount);
      if (line.category === 'expense_claims') {
        const sub = line.subCategory || 'other';
        claimCategories.set(sub, (claimCategories.get(sub) || 0) + line.amount);
      }
    }
  }
  const net = revenue - expenses;
  return { revenue, expenses, net, margin: revenue > 0 ? (net / revenue) * 100 : 0, income, expense, claimCategories };
};

const percentChange = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

export function ProfitLossPanel() {
  const today = toKey(new Date());
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [anchor, setAnchor] = useState(today);
  const [customFrom, setCustomFrom] = useState(() => toKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customTo, setCustomTo] = useState(today);
  const [granularity, setGranularity] = useState<Granularity | 'auto'>('auto');
  const [current, setCurrent] = useState<ReportData | null>(null);
  const [previous, setPrevious] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);

  const range = useMemo(() => getRange(periodType, anchor, customFrom, customTo), [periodType, anchor, customFrom, customTo]);
  const previousRange = useMemo(() => {
    if (periodType === 'custom') {
      const length = dayCount(range.from, range.to);
      return { from: addDays(range.from, -length), to: addDays(range.from, -1) };
    }
    return getRange(periodType, shiftAnchor(periodType, anchor, -1), customFrom, customTo);
  }, [periodType, anchor, customFrom, customTo, range]);
  const effectiveGranularity: Granularity = granularity === 'auto'
    ? defaultGranularity(periodType, dayCount(range.from, range.to))
    : granularity;

  const fetchReport = async () => {
    if (range.from > range.to) {
      toast.error('The start date must be before the end date');
      return;
    }
    setLoading(true);
    setSelectedBucket(null);
    try {
      const [currentRes, previousRes] = await Promise.all([
        api.get(`/finance/reports/income-expenditure/detailed?from=${toKey(range.from)}&to=${toKey(range.to)}`),
        api.get(`/finance/reports/income-expenditure/detailed?from=${toKey(previousRange.from)}&to=${toKey(previousRange.to)}`),
      ]);
      setCurrent(currentRes.data.data);
      setPrevious(previousRes.data.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load profit & loss');
    } finally {
      setLoading(false);
    }
  };

  // Reload whenever the selected period changes (custom ranges reload on Apply)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (periodType !== 'custom') fetchReport(); }, [periodType, anchor]);

  const labels = useMemo(() => {
    const map: Record<string, string> = {};
    [current, previous].forEach(report => {
      report?.incomeCategories.forEach(c => { map[c.key] = c.label; });
      report?.expenditureCategories.forEach(c => { map[c.key] = c.label; });
    });
    return map;
  }, [current, previous]);

  const currentSummary = useMemo(() => summarise(current?.transactions || []), [current]);
  const previousSummary = useMemo(() => summarise(previous?.transactions || []), [previous]);

  // Revenue and expense heads present in either period, largest first
  const revenueHeads = useMemo(() => Array.from(new Set([...currentSummary.income.keys(), ...previousSummary.income.keys()]))
    .sort((a, b) => (currentSummary.income.get(b) || 0) - (currentSummary.income.get(a) || 0)), [currentSummary, previousSummary]);
  const expenseHeads = useMemo(() => Array.from(new Set([...currentSummary.expense.keys(), ...previousSummary.expense.keys()]))
    .sort((a, b) => (currentSummary.expense.get(b) || 0) - (currentSummary.expense.get(a) || 0)), [currentSummary, previousSummary]);

  const buckets = useMemo(() => {
    const rows: { key: string; label: string; start: Date; end: Date; revenue: number; expenses: number; net: number; count: number; cumulative: number }[] = [];
    let cursor = bucketStart(range.from, effectiveGranularity);
    let guard = 0;
    while (cursor <= range.to && guard < 400) {
      const next = nextBucket(cursor, effectiveGranularity);
      rows.push({ key: toKey(cursor), label: bucketLabel(cursor, effectiveGranularity), start: cursor, end: addDays(next, -1), revenue: 0, expenses: 0, net: 0, count: 0, cumulative: 0 });
      cursor = next;
      guard += 1;
    }
    const byKey = new Map(rows.map(row => [row.key, row]));
    for (const line of current?.transactions || []) {
      const row = byKey.get(toKey(bucketStart(new Date(line.date), effectiveGranularity)));
      if (!row) continue;
      if (line.type === 'income') row.revenue += line.amount;
      else row.expenses += line.amount;
      row.count += 1;
    }
    let running = 0;
    for (const row of rows) {
      row.net = row.revenue - row.expenses;
      running += row.net;
      row.cumulative = running;
    }
    return rows;
  }, [current, range, effectiveGranularity]);

  const bucketTransactions = useMemo(() => {
    if (!selectedBucket || !current) return [];
    const row = buckets.find(item => item.key === selectedBucket);
    if (!row) return [];
    return current.transactions
      .filter(line => {
        const date = new Date(line.date);
        return date >= row.start && date < addDays(row.end, 1);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedBucket, current, buckets]);

  const hasActivity = currentSummary.revenue > 0 || currentSummary.expenses > 0;
  const isProfit = currentSummary.net >= 0;
  const periodText = describePeriod(periodType, range.from, range.to);
  const previousText = periodType === 'custom'
    ? `${longDate(previousRange.from)} – ${longDate(previousRange.to)}`
    : describePeriod(periodType, previousRange.from, previousRange.to);
  const fileSuffix = `${toKey(range.from)}_to_${toKey(range.to)}`;

  const exportStatement = () => {
    const rows: unknown[][] = [
      ['Profit & Loss Account', periodText],
      [],
      ['Particulars', 'Current Period', 'Previous Period', 'Change %'],
      ['REVENUE'],
      ...revenueHeads.map(key => {
        const now = currentSummary.income.get(key) || 0;
        const before = previousSummary.income.get(key) || 0;
        const change = percentChange(now, before);
        return [labels[key] || key, Math.round(now), Math.round(before), change == null ? 'new' : change.toFixed(1)];
      }),
      ['Total Revenue', Math.round(currentSummary.revenue), Math.round(previousSummary.revenue)],
      ['EXPENSES'],
      ...expenseHeads.map(key => {
        const now = currentSummary.expense.get(key) || 0;
        const before = previousSummary.expense.get(key) || 0;
        const change = percentChange(now, before);
        return [labels[key] || key, Math.round(now), Math.round(before), change == null ? 'new' : change.toFixed(1)];
      }),
      ['Total Expenses', Math.round(currentSummary.expenses), Math.round(previousSummary.expenses)],
      [],
      [isProfit ? 'Net Profit' : 'Net Loss', Math.round(currentSummary.net), Math.round(previousSummary.net)],
      ['Net Margin %', currentSummary.margin.toFixed(1), previousSummary.margin.toFixed(1)],
    ];
    downloadCsv(`profit-and-loss_${fileSuffix}.csv`, rows);
  };

  const exportBreakdown = () => {
    downloadCsv(`profit-and-loss-breakdown_${fileSuffix}.csv`, [
      ['Period', 'Revenue', 'Expenses', 'Net Profit / Loss', 'Margin %', 'Cumulative', 'Transactions'],
      ...buckets.map(row => [
        row.label, Math.round(row.revenue), Math.round(row.expenses), Math.round(row.net),
        row.revenue > 0 ? ((row.net / row.revenue) * 100).toFixed(1) : '', Math.round(row.cumulative), row.count,
      ]),
      ['Total', Math.round(currentSummary.revenue), Math.round(currentSummary.expenses), Math.round(currentSummary.net), currentSummary.margin.toFixed(1), '', buckets.reduce((sum, row) => sum + row.count, 0)],
    ]);
  };

  const anchorDate = parseKey(anchor);
  const yearOptions = Array.from({ length: 8 }, (_, index) => new Date().getFullYear() + 1 - index);
  const selectClass = 'h-8 px-2 text-sm rounded-lg border border-border bg-background';

  return (
    <div className="pl-viz space-y-6">
      <style>{VIZ_STYLES}</style>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Profit & Loss Account</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Revenue, expenses and net profit for any day, week, month, quarter, year or date range, compared with the previous period.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportStatement} disabled={!current}>
            <Download className="w-4 h-4 mr-2" />Export P&L
          </Button>
          <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />Refresh
          </Button>
        </div>
      </div>

      {/* Period filter */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex gap-1 flex-wrap">
            {PERIOD_TYPES.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => { setPeriodType(option.id); setGranularity('auto'); }}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold border transition-all',
                  periodType === option.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/40'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {periodType !== 'custom' && (
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous period" onClick={() => setAnchor(shiftAnchor(periodType, anchor, -1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}

            {(periodType === 'day' || periodType === 'week') && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                {periodType === 'week' ? 'Any day in the week' : 'Date'}
                <input type="date" value={anchor} onChange={e => e.target.value && setAnchor(e.target.value)} className={selectClass} />
              </label>
            )}

            {periodType === 'month' && (
              <>
                <select aria-label="Month" className={selectClass} value={anchorDate.getMonth()}
                  onChange={e => setAnchor(toKey(new Date(anchorDate.getFullYear(), Number(e.target.value), 1)))}>
                  {MONTH_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}
                </select>
                <select aria-label="Year" className={selectClass} value={anchorDate.getFullYear()}
                  onChange={e => setAnchor(toKey(new Date(Number(e.target.value), anchorDate.getMonth(), 1)))}>
                  {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
              </>
            )}

            {periodType === 'quarter' && (
              <>
                <select aria-label="Quarter" className={selectClass}
                  value={Math.floor(((anchorDate.getMonth() + 9) % 12) / 3)}
                  onChange={e => {
                    const fy = fyStartYear(anchorDate);
                    const startMonth = Number(e.target.value) * 3 + 3;
                    setAnchor(toKey(new Date(fy, startMonth, 1)));
                  }}>
                  <option value={0}>Q1 (Apr – Jun)</option>
                  <option value={1}>Q2 (Jul – Sep)</option>
                  <option value={2}>Q3 (Oct – Dec)</option>
                  <option value={3}>Q4 (Jan – Mar)</option>
                </select>
                <select aria-label="Financial year" className={selectClass} value={fyStartYear(anchorDate)}
                  onChange={e => {
                    const quarter = Math.floor(((anchorDate.getMonth() + 9) % 12) / 3);
                    setAnchor(toKey(new Date(Number(e.target.value), quarter * 3 + 3, 1)));
                  }}>
                  {yearOptions.map(year => <option key={year} value={year}>{fyLabel(year)}</option>)}
                </select>
              </>
            )}

            {periodType === 'year' && (
              <select aria-label="Year" className={selectClass} value={anchorDate.getFullYear()}
                onChange={e => setAnchor(toKey(new Date(Number(e.target.value), 0, 1)))}>
                {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            )}

            {periodType === 'fy' && (
              <select aria-label="Financial year" className={selectClass} value={fyStartYear(anchorDate)}
                onChange={e => setAnchor(toKey(new Date(Number(e.target.value), 3, 1)))}>
                {yearOptions.map(year => <option key={year} value={year}>{fyLabel(year)}</option>)}
              </select>
            )}

            {periodType === 'custom' && (
              <>
                <input type="date" aria-label="From date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className={selectClass} />
                <span className="text-muted-foreground text-sm">to</span>
                <input type="date" aria-label="To date" value={customTo} onChange={e => setCustomTo(e.target.value)} className={selectClass} />
                <Button size="sm" onClick={fetchReport} disabled={loading || !customFrom || !customTo}>
                  <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />Apply
                </Button>
              </>
            )}

            {periodType !== 'custom' && (
              <>
                <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next period" onClick={() => setAnchor(shiftAnchor(periodType, anchor, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAnchor(today)}>Today</Button>
              </>
            )}

            <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              Breakdown
              <select aria-label="Breakdown" className={selectClass} value={granularity}
                onChange={e => { setGranularity(e.target.value as Granularity | 'auto'); setSelectedBucket(null); }}>
                <option value="auto">Auto ({GRANULARITIES.find(g => g.id === defaultGranularity(periodType, dayCount(range.from, range.to)))?.label})</option>
                {GRANULARITIES.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </div>
          </div>

          <p className="text-sm font-semibold">{periodText}</p>
        </CardContent>
      </Card>

      {loading && !current && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-xl border bg-muted/40 animate-pulse" />)}
        </div>
      )}

      {current && (
        <>
          {/* Headline numbers with change vs previous period */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Revenue" value={money(currentSummary.revenue)} change={percentChange(currentSummary.revenue, previousSummary.revenue)} previous={money(previousSummary.revenue)} goodWhenUp />
            <KpiCard label="Expenses" value={money(currentSummary.expenses)} change={percentChange(currentSummary.expenses, previousSummary.expenses)} previous={money(previousSummary.expenses)} goodWhenUp={false} />
            <KpiCard label={isProfit ? 'Net Profit' : 'Net Loss'} value={money(Math.abs(currentSummary.net))} change={percentChange(currentSummary.net, previousSummary.net)} previous={money(previousSummary.net)} goodWhenUp highlight={isProfit ? 'profit' : 'loss'} />
            <KpiCard label="Net Margin" value={`${currentSummary.margin.toFixed(1)}%`} change={null} previous={`${previousSummary.margin.toFixed(1)}%`} goodWhenUp />
          </div>

          {(current.warnings?.length || 0) > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50/60 p-3 text-sm dark:border-amber-800 dark:bg-amber-900/10">
              <AlertCircle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
              <p>
                <span className="font-semibold">{current.warnings!.length} record issue{current.warnings!.length > 1 ? 's' : ''} affect these figures: </span>
                {current.warnings!.map(warning => `${warning.title} (${money(warning.amount)})`).join('; ')}.
                <span className="text-muted-foreground"> See Income & Expenditure → Needs attention for details.</span>
              </p>
            </div>
          )}

          {/* P&L statement */}
          <Card className={cn('border-2', isProfit ? 'border-green-200 dark:border-green-900' : 'border-red-200 dark:border-red-900')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 flex-wrap">
                {isProfit ? <TrendingUp className="w-5 h-5 text-green-600" /> : <TrendingDown className="w-5 h-5 text-red-500" />}
                Profit & Loss Statement
              </CardTitle>
              <CardDescription>{periodText} · compared with {previousText}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-y border-border">
                    <tr>
                      <th className="text-left p-3 font-medium text-muted-foreground">Particulars</th>
                      <th className="text-right p-3 font-medium text-muted-foreground whitespace-nowrap">This Period</th>
                      <th className="text-right p-3 font-medium text-muted-foreground whitespace-nowrap">Previous Period</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <SectionRow title="Revenue" />
                    {revenueHeads.length === 0 && <EmptyRow text="No revenue in either period" />}
                    {revenueHeads.map(key => (
                      <StatementRow key={key} label={labels[key] || key} current={currentSummary.income.get(key) || 0} previous={previousSummary.income.get(key) || 0} goodWhenUp />
                    ))}
                    <StatementRow label="Total Revenue" current={currentSummary.revenue} previous={previousSummary.revenue} goodWhenUp total />

                    <SectionRow title="Expenses" />
                    {expenseHeads.length === 0 && <EmptyRow text="No expenses in either period" />}
                    {expenseHeads.map(key => (
                      <Fragment key={key}>
                        <StatementRow label={labels[key] || key} current={currentSummary.expense.get(key) || 0} previous={previousSummary.expense.get(key) || 0} goodWhenUp={false} />
                        {key === 'expense_claims' && Array.from(currentSummary.claimCategories.entries()).map(([sub, amount]) => (
                          <tr key={`claim-${sub}`} className="text-muted-foreground">
                            <td className="py-1.5 pl-12 pr-3 text-xs capitalize">└ {sub}</td>
                            <td className="py-1.5 px-3 text-right text-xs">{money(amount)}</td>
                            <td className="py-1.5 px-3 text-right text-xs">{money(previousSummary.claimCategories.get(sub) || 0)}</td>
                            <td />
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                    <StatementRow label="Total Expenses" current={currentSummary.expenses} previous={previousSummary.expenses} goodWhenUp={false} total />
                  </tbody>
                  <tfoot>
                    <tr className={cn(isProfit ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20')}>
                      <td className="p-4">
                        <p className={cn('text-lg font-bold', isProfit ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                          {isProfit ? 'Net Profit' : 'Net Loss'}
                        </p>
                        <p className="text-xs text-muted-foreground">Net margin {currentSummary.margin.toFixed(1)}% (previous {previousSummary.margin.toFixed(1)}%)</p>
                      </td>
                      <td className={cn('p-4 text-right text-xl font-bold whitespace-nowrap', isProfit ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                        {currentSummary.net < 0 ? '-' : ''}{money(Math.abs(currentSummary.net))}
                      </td>
                      <td className="p-4 text-right font-semibold whitespace-nowrap text-muted-foreground">
                        {previousSummary.net < 0 ? '-' : ''}{money(Math.abs(previousSummary.net))}
                      </td>
                      <td className="p-4 text-right"><ChangeBadge change={percentChange(currentSummary.net, previousSummary.net)} goodWhenUp /></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue vs Expenses</CardTitle>
                <CardDescription>{GRANULARITIES.find(g => g.id === effectiveGranularity)?.label} breakdown</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {!hasActivity ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={buckets} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barGap={2}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} interval="preserveStartEnd" minTickGap={12} />
                      <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} tickFormatter={v => fmt(v)} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} formatter={(v: any) => money(Number(v))} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill="var(--pl-revenue)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                      <Bar dataKey="expenses" name="Expenses" fill="var(--pl-expense)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Net Profit / Loss</CardTitle>
                <CardDescription>Blue periods made a profit, red periods a loss · line shows the running total</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {!hasActivity ? <EmptyChart /> : (
                  <div className="h-full grid grid-rows-2 gap-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={buckets} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" hide />
                        <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} tickFormatter={v => fmt(v)} />
                        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} formatter={(v: any) => money(Number(v))} />
                        <Bar dataKey="net" name="Net" radius={[4, 4, 0, 0]} maxBarSize={22}>
                          {buckets.map(row => <Cell key={row.key} fill={row.net >= 0 ? 'var(--pl-positive)' : 'var(--pl-negative)'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={buckets} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} interval="preserveStartEnd" minTickGap={12} />
                        <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} tickFormatter={v => fmt(v)} />
                        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => money(Number(v))} />
                        <Line type="monotone" dataKey="cumulative" name="Running total" stroke="var(--pl-revenue)" strokeWidth={2} dot={buckets.length <= 31 ? { r: 3, strokeWidth: 2, stroke: 'var(--pl-surface)' } : false} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Period breakdown */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle>{GRANULARITIES.find(g => g.id === effectiveGranularity)?.label} Profit & Loss</CardTitle>
                <CardDescription>Click a row to see the transactions behind it</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportBreakdown}>
                <Download className="w-4 h-4 mr-2" />CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto w-full max-h-[480px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-y border-border sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium text-muted-foreground">Period</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Revenue</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Expenses</th>
                      <th className="text-right p-3 font-medium text-muted-foreground whitespace-nowrap">Net Profit / Loss</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Margin</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Running Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {buckets.map(row => (
                      <tr
                        key={row.key}
                        onClick={() => setSelectedBucket(current => (current === row.key ? null : row.key))}
                        className={cn('cursor-pointer transition-colors', selectedBucket === row.key ? 'bg-primary/5' : 'hover:bg-muted/30', row.count === 0 && 'text-muted-foreground')}
                      >
                        <td className="p-3 font-medium whitespace-nowrap">
                          {row.label}
                          {row.count > 0 && <Badge variant="outline" className="ml-2 text-[10px]">{row.count}</Badge>}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">{money(row.revenue)}</td>
                        <td className="p-3 text-right whitespace-nowrap">{money(row.expenses)}</td>
                        <td className={cn('p-3 text-right font-semibold whitespace-nowrap', row.net > 0 && 'text-green-600', row.net < 0 && 'text-red-500')}>
                          {row.net > 0 ? '+' : row.net < 0 ? '-' : ''}{money(Math.abs(row.net))}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">{row.revenue > 0 ? `${((row.net / row.revenue) * 100).toFixed(1)}%` : '—'}</td>
                        <td className="p-3 text-right whitespace-nowrap text-muted-foreground">{money(row.cumulative)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-border bg-muted/30">
                    <tr>
                      <td className="p-3 font-bold">Total</td>
                      <td className="p-3 text-right font-bold whitespace-nowrap">{money(currentSummary.revenue)}</td>
                      <td className="p-3 text-right font-bold whitespace-nowrap">{money(currentSummary.expenses)}</td>
                      <td className={cn('p-3 text-right font-bold whitespace-nowrap', isProfit ? 'text-green-600' : 'text-red-500')}>
                        {currentSummary.net > 0 ? '+' : currentSummary.net < 0 ? '-' : ''}{money(Math.abs(currentSummary.net))}
                      </td>
                      <td className="p-3 text-right font-bold">{currentSummary.revenue > 0 ? `${currentSummary.margin.toFixed(1)}%` : '—'}</td>
                      <td className="p-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Transactions for the selected row */}
          {selectedBucket && (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base">Transactions · {buckets.find(row => row.key === selectedBucket)?.label}</CardTitle>
                  <CardDescription>{bucketTransactions.length} entries</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Close transactions" onClick={() => setSelectedBucket(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {bucketTransactions.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">No transactions in this period.</p>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-y border-border">
                        <tr>
                          <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Head</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Description</th>
                          <th className="text-left p-3 font-medium text-muted-foreground">Party</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {bucketTransactions.map(line => (
                          <tr key={line.id} className="align-top">
                            <td className="p-3 whitespace-nowrap">{longDate(new Date(line.date))}</td>
                            <td className="p-3">{labels[line.category] || line.category}{line.subCategory ? <span className="text-xs text-muted-foreground"> · {line.subCategory}</span> : null}</td>
                            <td className="p-3 max-w-[280px] break-words">{line.description || '—'}</td>
                            <td className="p-3">{line.party || '—'}</td>
                            <td className={cn('p-3 text-right font-semibold whitespace-nowrap', line.type === 'income' ? 'text-green-600' : 'text-red-500')}>
                              {line.type === 'income' ? '+' : '-'}{money(line.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ChangeBadge({ change, goodWhenUp }: { change: number | null; goodWhenUp: boolean }) {
  if (change === null) return <span className="text-xs text-muted-foreground">new</span>;
  if (Math.abs(change) < 0.05) {
    return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="w-3 h-3" />0%</span>;
  }
  const up = change > 0;
  const good = up === goodWhenUp;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold whitespace-nowrap', good ? 'text-green-600' : 'text-red-500')}>
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

function KpiCard({ label, value, change, previous, goodWhenUp, highlight }: {
  label: string;
  value: string;
  change: number | null;
  previous: string;
  goodWhenUp: boolean;
  highlight?: 'profit' | 'loss';
}) {
  return (
    <Card className={cn(highlight === 'profit' && 'border-green-200 dark:border-green-900', highlight === 'loss' && 'border-red-200 dark:border-red-900')}>
      <CardContent className="p-5">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={cn('text-2xl font-bold truncate', highlight === 'profit' && 'text-green-700 dark:text-green-400', highlight === 'loss' && 'text-red-600 dark:text-red-400')}>{value}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <ChangeBadge change={change} goodWhenUp={goodWhenUp} />
          <span className="truncate">vs {previous} previous</span>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionRow({ title }: { title: string }) {
  return (
    <tr className="bg-muted/20">
      <td colSpan={4} className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</td>
    </tr>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <tr>
      <td colSpan={4} className="px-3 py-2 pl-8 text-sm text-muted-foreground">{text}</td>
    </tr>
  );
}

function StatementRow({ label, current, previous, goodWhenUp, total }: {
  label: string;
  current: number;
  previous: number;
  goodWhenUp: boolean;
  total?: boolean;
}) {
  return (
    <tr className={cn(total && 'font-semibold bg-muted/10')}>
      <td className={cn('p-3', total ? 'pl-3' : 'pl-8')}>{label}</td>
      <td className="p-3 text-right whitespace-nowrap tabular-nums">{money(current)}</td>
      <td className="p-3 text-right whitespace-nowrap tabular-nums text-muted-foreground">{money(previous)}</td>
      <td className="p-3 text-right"><ChangeBadge change={percentChange(current, previous)} goodWhenUp={goodWhenUp} /></td>
    </tr>
  );
}

function EmptyChart() {
  return <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No revenue or expenses in this period</div>;
}
