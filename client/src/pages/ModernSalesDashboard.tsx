import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Target, 
  Users, 
  Zap, 
  ArrowUpRight,
  BarChart3,
} from 'lucide-react';
import { LeadsPanel } from '@/components/panels/LeadsPanel';
import { TargetsPanel } from '@/components/panels/TargetsPanel';
import { LeavesPanel } from '@/components/panels/LeavesPanel';
import { AttendancePanel } from '@/components/panels/AttendancePanel';
import { TasksPanel } from '@/components/panels/TasksPanel';
import { SalesInvitePanel } from '@/components/panels/SalesInvitePanel';
import { SalesStudentEnrollmentPanel } from '@/components/panels/SalesStudentEnrollmentPanel';
import { AnnouncementsPanel } from '@/components/panels/AnnouncementsPanel';
import { HolidaysPanel } from '@/components/panels/HolidaysPanel';
import { NoticeBoardPanel } from '@/components/panels/NoticeBoardPanel';
import { SubSalesPortalPanel } from '@/components/panels/SubSalesPortalPanel';
import { TeamPerformancePanel } from '@/components/panels/TeamPerformancePanel';
import { MyTeamPanel } from '@/components/panels/MyTeamPanel';

import { StudyCentersPanel } from '@/components/panels/StudyCentersPanel';
import { PendingCenterVerificationPanel } from '@/components/panels/PendingCenterVerificationPanel';
import { CenterOnboardingOverviewPanel } from '@/components/panels/CenterOnboardingOverviewPanel';
import { CentersAdmissionsPanel } from '@/components/panels/CentersAdmissionsPanel';
import { PayrollPanel } from '@/components/panels/PayrollPanel';
import { ManagerHiringPanel } from '@/components/panels/hr/ManagerHiringPanel';
import { 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { MyDocumentsPanel } from '@/components/panels/hr/MyDocumentsPanel';


export function ModernSalesDashboard({ initialTab, isSubDeptManager, onNavigate }: { initialTab?: string; isSubDeptManager?: boolean; onNavigate?: (tab: string) => void }) {
  const { user } = useAuth();
  const isSalesAdmin = user?.role === 'sales_admin' || user?.role === 'bde' || isSubDeptManager;

  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<any>({});
  const [leads, setLeads] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [applicationSummary, setApplicationSummary] = useState<any>({ total: 0, enrolled: 0 });
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (onNavigate) {
      onNavigate(tab === 'overview' || tab === 'my_subdept' ? 'dashboard' : tab);
    }
  };
  void handleTabChange;

  useEffect(() => {
    setActiveTab(initialTab || 'overview');
  }, [initialTab]);
  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [metricsRes, leadsRes, targetsRes, applicationsRes] = await Promise.all([
        api.get('/dashboard/metrics'),
        api.get('/sales/leads').catch(() => ({ data: { data: [] } })),
        api.get('/sales/targets').catch(() => ({ data: { data: [] } })),
        api.get('/sales/student-applications').catch(() => ({ data: { summary: { total: 0, enrolled: 0 } } })),
      ]);
      setMetrics(metricsRes.data.data || {});
      setLeads(leadsRes.data.data || []);
      setTargets(targetsRes.data.data || []);
      setApplicationSummary(applicationsRes.data.summary || { total: 0, enrolled: 0 });
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  // Sub-dept manager (employee in sales dept) — scoped personal view
  if (!isSalesAdmin) {
    return <SalesEmployeePortal initialTab={initialTab} user={user} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return (
        <OverviewContent metrics={metrics} leads={leads} targets={targets} applicationSummary={applicationSummary} loading={loading} onNavigate={setActiveTab} />
      );
      case 'leads': return null;
      case 'targets': return <TargetsPanel endpoint="/sales/targets" title="Sales Targets" />;
      case 'invite_links': return <SalesInvitePanel />;
      case 'my_team':
      case 'team': return <MyTeamPanel departmentType="sales" title="Sales Team" />;
      case 'study_centre': return <StudyCentersPanel salesMode />;
      case 'pending_center_verification': return <PendingCenterVerificationPanel mode="sales" />;
      case 'center_admissions': return <CentersAdmissionsPanel />;
      case 'center_onboarding': return <CenterOnboardingOverviewPanel mode="sales" />;
      case 'student_enrollment': return <SalesStudentEnrollmentPanel />;
      case 'tasks': return <TasksPanel />;
      case 'my_leaves': return <LeavesPanel isPersonalView />;
      case 'leave_approvals': return <LeavesPanel />;
      case 'my_attendance': return <AttendancePanel isPersonalView />;
      case 'my_payslips': return <PayrollPanel personalView />;
      case 'my_documents': return <MyDocumentsPanel />;
      case 'manager_hiring': return <ManagerHiringPanel />;
      case 'holidays': return <HolidaysPanel />;
      case 'announcements': return <AnnouncementsPanel />;
      case 'notice-board': return <NoticeBoardPanel />;
      default: return null;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{user?.name || 'Sales Dashboard'}</h1>
          <p className="text-muted-foreground mt-1">{user?.designation || 'Sales Administrator'}</p>
        </div>
      </div>
      {renderContent()}
    </div>
  );
}

export function getSalesNavItems(includeStudentEnrollment = true) {
  return [
    { id: '__dashboard_section', label: 'Dashboard', isSection: true },
    { id: 'overview', label: 'Overview' },

    { id: '__sales_team_section', label: 'Sales Team', isSection: true },
    { id: 'targets', label: 'Target' },
    { id: 'my_team', label: 'My Team' },
    { id: 'tasks', label: 'Task' },

    { id: '__admission_section', label: 'Admission', isSection: true },
    { id: 'invite_links', label: 'Invite Link' },
    ...(includeStudentEnrollment ? [{ id: 'student_enrollment', label: 'Student Enrollment' }] : []),

    { id: '__study_center_management_section', label: 'Study Center Management', isSection: true },
    { id: 'study_centre', label: 'Study Center' },
    { id: 'center_admissions', label: 'Center Admission' },
    { id: 'center_onboarding', label: 'Center Onboarding Status' },

    { id: '__verification_section', label: 'Verification', isSection: true },
    { id: 'pending_center_verification', label: 'Pending Verification' },

    { id: '__portal_section', label: 'My Portal', isSection: true },
    { id: 'my_leaves', label: 'My Leaves' },
    { id: 'leave_approvals', label: 'Leave Approvals' },
    { id: 'my_attendance', label: 'Attendance' },
    { id: 'my_payslips', label: 'Pay Slips' },
    { id: 'my_documents', label: 'My Documents' },
    { id: 'manager_hiring', label: 'Hiring Requests' },
    { id: 'holidays', label: 'Holidays' },
    { id: 'announcements', label: 'Announcements' },
    { id: 'notice-board', label: 'Notice Board' },
  ];
}

function OverviewContent({ metrics, leads, targets, applicationSummary, loading, onNavigate }: any) {
  // Compute live stats
  const totalLeads = leads.length;
  const newLeads = leads.filter((l: any) => l.status === 'new').length;
  const convertedLeads = leads.filter((l: any) => l.status === 'converted').length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
  const totalApplications = applicationSummary?.total || 0;
  const enrolledApplications = applicationSummary?.enrolled || 0;
  const admissionRate = totalApplications > 0 ? Math.round((enrolledApplications / totalApplications) * 100) : 0;

  const growthData = Array.from({ length: 6 }, (_, index) => {
    const month = new Date();
    month.setDate(1);
    month.setMonth(month.getMonth() - (5 - index));
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    return {
      month: month.toLocaleString('en', { month: 'short' }),
      leads: leads.filter((lead: any) => {
        const createdAt = new Date(lead.createdAt);
        return createdAt.getFullYear() === year && createdAt.getMonth() === monthIndex;
      }).length,
    };
  });
  const currentMonthLeads = growthData[growthData.length - 1]?.leads || 0;
  const previousMonthLeads = growthData[growthData.length - 2]?.leads || 0;
  const monthlyGrowth = previousMonthLeads > 0
    ? Math.round(((currentMonthLeads - previousMonthLeads) / previousMonthLeads) * 100)
    : null;

  // Lead source breakdown from real data
  const sourceCounts: Record<string, number> = {};
  leads.forEach((l: any) => {
    const src = l.source || 'Direct';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });
  const COLORS = ['hsl(var(--primary))', 'hsl(var(--info))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--error))'];
  const sourceData = Object.entries(sourceCounts).map(([name, value], i) => ({
    name, value, color: COLORS[i % COLORS.length],
  }));

  // Target progress — compute from achieved/target since model has no status/progress fields
  const activeTargets = targets.filter((t: any) => (t.achieved || 0) < t.target);
  const avgProgress = activeTargets.length
    ? Math.round(activeTargets.reduce((s: number, t: any) => {
        const pct = t.target > 0 ? Math.round((t.achieved / t.target) * 100) : 0;
        return s + pct;
      }, 0) / activeTargets.length)
    : 0;

  const hotLeads = [...leads]
    .filter((l: any) => l.status !== 'converted' && l.status !== 'lost')
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-5 gap-6">
        <SalesMetric
          title="Total Leads"
          value={loading ? '...' : totalLeads}
          trend={newLeads > 0 ? `${newLeads} new` : 'No new leads'}
          icon={<Users className="w-5 h-5" />}
          color="primary"
          onClick={() => onNavigate('leads')}
        />
        <SalesMetric
          title="Conversions"
          value={loading ? '...' : convertedLeads}
          trend={`${conversionRate}% rate`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="success"
          onClick={() => onNavigate('leads')}
        />
        <SalesMetric
          title="Student Admissions"
          value={loading ? '...' : totalApplications}
          trend={`${enrolledApplications} enrolled · ${admissionRate}% admission rate`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="success"
          onClick={() => onNavigate('student_enrollment')}
        />
        <SalesMetric
          title="Active Targets"
          value={loading ? '...' : activeTargets.length}
          trend={avgProgress > 0 ? `${avgProgress}% avg progress` : 'No targets yet'}
          icon={<Target className="w-5 h-5" />}
          color="warning"
          onClick={() => onNavigate('targets')}
        />
        <SalesMetric
          title="Pending Tasks"
          value={loading ? '...' : (metrics.pendingTasks || 0)}
          trend={metrics.overdueTasks ? `${metrics.overdueTasks} overdue` : 'On track'}
          icon={<Zap className="w-5 h-5" />}
          color="info"
          onClick={() => onNavigate('tasks')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Growth */}
        <Card
          className="lg:col-span-2 border-none shadow-xl bg-card/60 backdrop-blur-xl cursor-pointer hover:border-primary/30 transition-colors"
          onClick={() => onNavigate('leads')}
        >
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Lead Growth</CardTitle>
              <CardDescription>
                Monthly lead volume · {monthlyGrowth === null ? 'Growth comparison unavailable' : `${monthlyGrowth >= 0 ? '+' : ''}${monthlyGrowth}% vs. last month`}
              </CardDescription>
            </div>
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="h-[260px]">
            {leads.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                  <Line type="monotone" dataKey="leads" name="Leads" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Users className="w-10 h-10 opacity-20" />
                <p className="text-sm">No lead growth data yet</p>
                <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); onNavigate('leads'); }}>
                  Add Lead
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead Sources */}
        <Card
          className="border-none shadow-xl bg-card/60 backdrop-blur-xl cursor-pointer hover:border-primary/30 transition-colors"
          onClick={() => onNavigate('leads')}
        >
          <CardHeader>
            <CardTitle>Lead Sources</CardTitle>
            <CardDescription>Acquisition channel breakdown</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {sourceData.length > 0 ? (
              <>
                <div className="h-[160px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sourceData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                        {sourceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {sourceData.map(item => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                      <span className="text-xs font-bold ml-auto">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Users className="w-8 h-8 opacity-20" />
                <p className="text-sm">No source data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hot Leads */}
        <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => onNavigate('leads')}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Leads</CardTitle>
            <Button variant="ghost" size="sm" className="text-primary font-bold" onClick={e => { e.stopPropagation(); onNavigate('leads'); }}>
              View All <ArrowUpRight className="ml-1 w-3 h-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)
            ) : hotLeads.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No active leads</p>
              </div>
            ) : (
              hotLeads.map((lead: any) => (
                <div key={lead.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {(lead.name || lead.contactName || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <h5 className="text-sm font-bold">{lead.name || lead.contactName || 'Unknown'}</h5>
                      <p className="text-[10px] text-muted-foreground">{lead.source || 'Direct'} · {new Date(lead.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold">{lead.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Targets + Punch */}
        <div className="space-y-4">
          <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => onNavigate('targets')}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">Active Targets</CardTitle>
              <Button variant="ghost" size="sm" className="text-primary font-bold" onClick={e => { e.stopPropagation(); onNavigate('targets'); }}>
                View All <ArrowUpRight className="ml-1 w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                [1,2].map(i => <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />)
              ) : activeTargets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No active targets</p>
              ) : (
              activeTargets.slice(0, 3).map((t: any) => {
                  const pct = t.target > 0 ? Math.round((t.achieved / t.target) * 100) : 0;
                  const label = t.employee?.name
                    || t.department?.name
                    || (typeof t.employeeId === 'object' ? t.employeeId?.name : '')
                    || (typeof t.departmentId === 'object' ? t.departmentId?.name : '')
                    || t.type
                    || 'Target';
                  return (
                  <div key={t.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium truncate max-w-[180px]">{label} ({t.period})</span>
                      <span className="font-bold text-primary">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  );
                })
              )}
            </CardContent>
          </Card>
</div>
      </div>
    </div>
  );
}

function SalesMetric({ title, value, trend, icon, color, className, onClick }: any) {
  const colorMap: any = {
    primary: 'bg-primary/10 text-primary',
    info: 'bg-info/10 text-info',
    warning: 'bg-warning/10 text-warning',
    success: 'bg-success/10 text-success',
  };

  return (
    <Card
      className={cn('group transition-all duration-300 hover:border-primary/50', onClick && 'cursor-pointer', className)}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn('p-2.5 rounded-xl transition-transform group-hover:scale-110', colorMap[color])}>
            {icon}
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">{trend}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{title}</p>
          <p className="text-3xl font-bold tracking-tight mt-1">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Sales Employee Portal (sub-dept managers, sales employees) ───────────────
function SalesEmployeePortal({ initialTab, user }: { initialTab?: string; user: any }) {
  const isSubDeptManager = Boolean(user?.subDepartmentId);
  const [activeTab, setActiveTab] = useState(initialTab || (isSubDeptManager ? 'my_subdept' : 'overview'));
  const [leads, setLeads] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab || (isSubDeptManager ? 'my_subdept' : 'overview'));
  }, [initialTab]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/sales/leads').catch(() => ({ data: { data: [] } })),
      api.get('/sales/targets').catch(() => ({ data: { data: [] } })),
    ]).then(([leadsRes, targetsRes]) => {
      setLeads(leadsRes.data.data || []);
      setTargets(targetsRes.data.data || []);
    }).finally(() => setLoading(false));
  }, []);


  const myLeads = leads.filter((l: any) => {
    const refId = typeof l.referredBy === 'object' ? l.referredBy?.id : l.referredBy;
    return refId?.toString() === (user?.id || user?.id)?.toString();
  });

  const myTargets = targets.filter((t: any) => {
    const empId = typeof t.employeeId === 'object' ? t.employeeId?.id : t.employeeId;
    return empId?.toString() === (user?.id || user?.id)?.toString();
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{user?.name || 'Sales Portal'}</h1>
          <p className="text-muted-foreground mt-1">{user?.designation || 'Sales Executive'}</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="hidden"><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase font-medium">My Leads</p>
          <p className="text-3xl font-bold mt-1">{loading ? '...' : myLeads.length}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{myLeads.filter((l:any) => l.status === 'new').length} new</p>
        </CardContent></Card>
        <Card className="hidden"><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase font-medium">Converted</p>
          <p className="text-3xl font-bold mt-1 text-success">{loading ? '...' : myLeads.filter((l:any) => l.status === 'converted').length}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {myLeads.length > 0 ? Math.round((myLeads.filter((l:any) => l.status === 'converted').length / myLeads.length) * 100) : 0}% rate
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase font-medium">My Targets</p>
          <p className="text-3xl font-bold mt-1">{loading ? '...' : myTargets.length}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{myTargets.filter((t:any) => (t.achieved||0) < t.target).length} active</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase font-medium">Avg Progress</p>
          <p className="text-3xl font-bold mt-1 text-primary">
            {loading ? '...' : (myTargets.length > 0
              ? Math.round(myTargets.reduce((s:number, t:any) => s + (t.target > 0 ? (t.achieved/t.target)*100 : 0), 0) / myTargets.length)
              : 0)}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">across all targets</p>
        </CardContent></Card>
      </div>

      {/* Content rendered by active tab */}
      {(() => {
        switch (activeTab) {
          case 'student_enrollment': return <SalesStudentEnrollmentPanel />;
          case 'overview': return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base">Recent Leads</CardTitle>
                  <Button variant="ghost" size="sm" className="text-primary text-xs" onClick={() => setActiveTab('leads')}>
                    View All <ArrowUpRight className="ml-1 w-3 h-3" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {loading ? [1,2,3].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />) :
                    myLeads.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No leads yet</p> :
                    myLeads.slice(0, 4).map((l: any) => (
                      <div key={l.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                        <div>
                          <p className="text-sm font-medium">{l.centerName || l.contactName || 'Lead'}</p>
                          <p className="text-[10px] text-muted-foreground">{l.source} · {new Date(l.createdAt).toLocaleDateString()}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase">{l.status}</Badge>
                      </div>
                    ))
                  }
                </CardContent>
              </Card>
              <div className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base">My Targets</CardTitle>
                    <Button variant="ghost" size="sm" className="text-primary text-xs" onClick={() => setActiveTab('targets')}>
                      View All <ArrowUpRight className="ml-1 w-3 h-3" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {loading ? [1,2].map(i => <div key={i} className="h-8 bg-muted rounded animate-pulse" />) :
                      myTargets.length === 0 ? <p className="text-sm text-muted-foreground text-center py-2">No targets assigned</p> :
                      myTargets.slice(0, 3).map((t: any) => {
                        const pct = t.target > 0 ? Math.min(100, Math.round((t.achieved / t.target) * 100)) : 0;
                        return (
                          <div key={t.id} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium">{t.type} · {t.period}</span>
                              <span className="font-bold text-primary">{pct}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })
                    }
                  </CardContent>
                </Card>
</div>
            </div>
          );
          case 'my_subdept': return isSubDeptManager ? <SubSalesPortalPanel /> : null;
          case 'leads': return null;
          case 'targets': return <TargetsPanel endpoint="/sales/targets" title="My Targets" />;
          case 'invite_links': return <SalesInvitePanel />;
          case 'my_team':
          case 'team': return <MyTeamPanel departmentType="sales" title="Sales Team" />;
          case 'study_centre': return <StudyCentersPanel salesMode />;
          case 'pending_center_verification': return <PendingCenterVerificationPanel mode="sales" />;
          case 'center_onboarding': return <CenterOnboardingOverviewPanel mode="sales" />;
          case 'my_attendance': return <AttendancePanel isPersonalView />;
          case 'my_leaves': return <LeavesPanel isPersonalView />;
          case 'my_payslips': return <PayrollPanel personalView />;
      case 'my_documents': return <MyDocumentsPanel />;
          case 'tasks': return <TasksPanel />;
          case 'announcements': return <AnnouncementsPanel />;
          case 'notice-board': return <NoticeBoardPanel />;
          case 'holidays': return <HolidaysPanel />;
          case 'ld-portal': return (
            <Card className="border-none shadow-xl bg-card/60 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>Learning &amp; Development Portal</CardTitle>
                <CardDescription>Courses, certifications and growth resources</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="py-12 text-center text-muted-foreground">
                  <p className="font-medium">Courses will be assigned by HR. Check back regularly.</p>
                </div>
              </CardContent>
            </Card>
          );
          default: return null;
        }
      })()}
    </div>
  );
}
