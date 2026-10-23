import { useState, useEffect } from 'react';
import { 
  Users, 
  Briefcase, 
  Clock, 
  Heart, 
  Award, 
  ArrowRight,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import api from '@/lib/api';
import { LeavesPanel } from '@/components/panels/LeavesPanel';
import { AttendancePanel } from '@/components/panels/AttendancePanel';
import { VacanciesPanel } from '@/components/panels/VacanciesPanel';
import { HolidaysPanel } from '@/components/panels/HolidaysPanel';
import { EmployeesPanel } from '@/components/panels/EmployeesPanel';
import { ComplaintsPanel } from '@/components/panels/ComplaintsPanel';
import { HRUsersPanel } from '@/components/panels/HRUsersPanel';
import { TasksPanel } from '@/components/panels/TasksPanel';
import { PayrollPanel } from '@/components/panels/PayrollPanel';
import { PayrollBatchesPanel } from '@/components/panels/PayrollBatchesPanel';
import { ManagerAssignmentPanel } from '@/components/panels/ManagerAssignmentPanel';
import { HRSettingsPanel } from '@/components/attendance/HRSettingsPanel';
import { AnnouncementsPanel } from '@/components/panels/AnnouncementsPanel';
import { SalaryConfigPanel } from '@/components/panels/SalaryConfigPanel';
import { LeaveAllocationPanel } from '@/components/panels/LeaveAllocationPanel';
import { PollsPanel } from '@/components/panels/PollsPanel';
import { HROrgChartPanel } from '@/components/panels/HROrgChartPanel';
import { NoticeBoardPanel } from '@/components/panels/NoticeBoardPanel';
import { EmployeeActivityReportPanel } from '@/components/panels/EmployeeActivityReportPanel';
import { SubDepartmentsPanel } from '@/components/panels/SubDepartmentsPanel';
import { HiringPanel } from '@/components/panels/hr/HiringPanel';
import { ManagerHiringPanel } from '@/components/panels/hr/ManagerHiringPanel';
import { ShiftPanel } from '@/components/panels/hr/ShiftPanel';
import { MyDocumentsPanel } from '@/components/panels/hr/MyDocumentsPanel';
import { LeaveApprovalsPanel } from '@/components/panels/hr/LeaveApprovalsPanel';
import { AttendanceCalendarPanel } from '@/components/panels/hr/AttendanceCalendarPanel';


export function ModernHRDashboard({ initialTab, onNavigate: _onNavigate }: { initialTab?: string, onNavigate?: (tab: string) => void }) {
  const [metrics, setMetrics] = useState<any>({});
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');

  useEffect(() => {
    setActiveTab(initialTab || 'overview');
  }, [initialTab]);
  useEffect(() => {
    api.get('/dashboard/metrics').then(r => setMetrics(r.data.data || {})).catch(() => {});
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><OverviewContent metrics={metrics} onNavigate={setActiveTab} /></div>
</div>
      );
      case 'users': return <HRUsersPanel />;
      case 'employees': return <EmployeesPanel />;
      case 'leaves': return <LeavesPanel />;
      case 'leave-approvals': return <LeaveApprovalsPanel />;
      case 'attendance': return <AttendancePanel />;
      case 'attendance-calendar': return <AttendanceCalendarPanel />;
      case 'hiring': return <HiringPanel />;
      case 'hiring_request': return <ManagerHiringPanel />;
      case 'vacancies': return <VacanciesPanel />;
      case 'holidays': return <HolidaysPanel />;
      case 'complaints': return <ComplaintsPanel />;
      case 'tasks': return <TasksPanel />;
      case 'payroll': return <PayrollPanel />;
      case 'payroll-batches': return <PayrollBatchesPanel />;
      case 'salary-config': return <SalaryConfigPanel />;
      case 'leave-alloc': return <LeaveAllocationPanel />;
      case 'announcements': return <AnnouncementsPanel />;
      case 'polls': return <PollsPanel />;
      case 'org-chart': return <HROrgChartPanel />;
      case 'managers': return <ManagerAssignmentPanel />;
      case 'att-settings': return <HRSettingsPanel />;
      case 'shift-settings': return <ShiftPanel />;
      case 'activity_report': return <EmployeeActivityReportPanel />;
      case 'my_leaves': return <LeavesPanel isPersonalView />;
      case 'my_attendance': return <AttendancePanel isPersonalView />;
      case 'my_payslips': return <PayrollPanel />;
      case 'my_documents': return <MyDocumentsPanel />;
      case 'subdepartments': return <SubDepartmentsPanel />;
      case 'notice-board': return <NoticeBoardPanel />;
      default: return null;
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      {renderContent()}
    </div>
  );
}

export function getHRNavItems() {
  return [
    { id: '__hr_section', label: 'HR Management', isSection: true },
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users' },
    { id: 'employees', label: 'Employees' },
    { id: 'leaves', label: 'Leave Requests' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'hiring', label: 'Hiring & Recruitment' },
    { id: 'hiring_request', label: 'Hiring Request' },
    { id: 'vacancies', label: 'Vacancies' },
    { id: 'holidays', label: 'Holidays' },
    { id: 'complaints', label: 'Complaints' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'payroll-batches', label: 'Payroll Batches' },
    { id: 'salary-config', label: 'Salary Config' },
    { id: 'leave-alloc', label: 'Leave Allocation' },
    { id: 'announcements', label: 'Announcements' },
    { id: 'polls', label: 'Polls' },
    { id: 'org-chart', label: 'Org Chart' },
    { id: 'managers', label: 'Managers' },
    { id: 'att-settings', label: 'Att. Settings' },
    { id: 'shift-settings', label: 'Shift Settings' },
    { id: 'activity_report', label: 'Activity Report' },
    { id: '__portal_section', label: 'My Portal', isSection: true },
    { id: 'my_leaves', label: 'My Leaves' },
    { id: 'my_attendance', label: 'My Attendance' },
    { id: 'my_payslips', label: 'Pay Slips' },
    { id: 'my_documents', label: 'My Documents' },
    { id: 'notice-board', label: 'Notice Board' },
    { id: 'subdepartments', label: 'Sub-Departments' },
  ];
}

function OverviewContent({ metrics, onNavigate }: { metrics: any; onNavigate: (tab: string) => void }) {
  const [vacancies, setVacancies] = useState<any[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);

  const [loadingVacancies, setLoadingVacancies] = useState(true);
  const [loadingLeaves, setLoadingLeaves] = useState(true);

  const fetchOverviewData = () => {
    setLoadingVacancies(true);
    setLoadingLeaves(true);
    api.get('/hr/vacancies?status=open')
      .then(r => setVacancies(r.data.data || []))
      .catch(() => setVacancies([]))
      .finally(() => setLoadingVacancies(false));
    api.get('/hr/leaves?status=pending')
      .then(r => setPendingLeaves(r.data.data || []))
      .catch(() => setPendingLeaves([]))
      .finally(() => setLoadingLeaves(false));
  };

  useEffect(() => { fetchOverviewData(); }, []);

  const highPriorityVacancies = vacancies.filter(v => v.priority === 'high' || v.priority === 'urgent');

  return (
    <div className="space-y-6">
      {/* HR Core Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-6">
        <HRMetricCard 
          title="Total Headcount" 
          value={metrics.totalEmployees ?? '—'} 
          icon={<Users className="w-5 h-5" />}
          subtext="Active across all wings"
          color="primary"
          onClick={() => onNavigate('users')}
        />
        <HRMetricCard 
          title="Open Vacancies" 
          value={metrics.totalVacancies ?? vacancies.length} 
          icon={<Briefcase className="w-5 h-5" />}
          subtext={highPriorityVacancies.length > 0 ? `${highPriorityVacancies.length} high priority` : 'No high priority'}
          color="info"
          onClick={() => onNavigate('vacancies')}
        />
        <HRMetricCard 
          title="Absent Today" 
          value={metrics.absentToday ?? 0} 
          icon={<Clock className="w-5 h-5" />}
          subtext={metrics.absentToday > 0 ? `${metrics.absentToday} not checked in` : 'All present'}
          color="warning"
          onClick={() => onNavigate('attendance')}
        />
        <HRMetricCard 
          title="Present Today" 
          value={metrics.presentToday ?? '—'} 
          icon={<Heart className="w-5 h-5" />}
          subtext={metrics.onLeave != null ? `${metrics.onLeave} on leave` : 'Attendance today'}
          color="success"
          onClick={() => onNavigate('attendance')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recruitment Pipeline — live vacancies */}
        <Card className="lg:col-span-2 border-none shadow-xl bg-card/60 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="cursor-pointer" onClick={() => onNavigate('vacancies')}>
              <CardTitle className="hover:text-primary transition-colors">Open Vacancies</CardTitle>
              <CardDescription>Live hiring positions across departments</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={fetchOverviewData}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('vacancies')}>
                View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingVacancies ? (
              <div className="space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : vacancies.length === 0 ? (
              <button
                className="w-full text-center py-10 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => onNavigate('vacancies')}
              >
                <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No open vacancies — click to add one</p>
              </button>
            ) : (
              <div className="space-y-5">
                {vacancies.slice(0, 5).map(v => (
                  <VacancyItem key={v.id} vacancy={v} onClick={() => onNavigate('vacancies')} />
                ))}
                {vacancies.length > 5 && (
                  <button
                    className="w-full text-xs text-primary hover:underline text-center"
                    onClick={() => onNavigate('vacancies')}
                  >
                    +{vacancies.length - 5} more vacancies — view all
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          <Card className="border-none shadow-lg bg-card/60 backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base cursor-pointer hover:text-primary transition-colors" onClick={() => onNavigate('leaves')}>
                Leave Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Pending', value: metrics.pendingLeaves ?? pendingLeaves.length, color: 'bg-yellow-500', tab: 'leaves' },
                  { label: 'Present Today', value: metrics.presentToday ?? '—', color: 'bg-green-500', tab: 'attendance' },
                  { label: 'On Leave', value: metrics.onLeave ?? '—', color: 'bg-blue-500', tab: 'leaves' },
                ].map(item => (
                  <button
                    key={item.label}
                    className="w-full flex items-center gap-3 p-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    onClick={() => onNavigate(item.tab)}
                  >
                    <div className={cn('w-2 h-2 rounded-full shrink-0', item.color)} />
                    <span className="text-sm text-muted-foreground flex-1">{item.label}</span>
                    <span className="text-sm font-bold">{item.value}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-success text-success-foreground">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/20">
                  <Award className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Employee of the Month</h4>
                  <p className="text-xs text-white/80 mt-0.5">Recognizing excellence in your team.</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200" />
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-300" />
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-400" />
                </div>
                <Button
                  variant="ghost"
                  className="h-8 text-xs font-bold text-white hover:bg-white/10 p-0"
                  onClick={() => onNavigate('employees')}
                >
                  Nominate <ArrowRight className="w-3 h-3 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pending Leave Approvals — live data */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle
            className="text-lg cursor-pointer hover:text-primary transition-colors"
            onClick={() => onNavigate('leaves')}
          >
            Pending Leave Approvals
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{pendingLeaves.length} pending</Badge>
            {pendingLeaves.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => onNavigate('leaves')}>
                View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingLeaves ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : pendingLeaves.length === 0 ? (
            <button
              className="w-full text-center py-8 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => onNavigate('leaves')}
            >
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No pending leave requests — click to view all leaves</p>
            </button>
          ) : (
            <div className="space-y-3">
              {pendingLeaves.slice(0, 5).map(leave => (
                <LiveLeaveItem key={leave.id} leave={leave} onRefresh={fetchOverviewData} onViewAll={() => onNavigate('leaves')} />
              ))}
              {pendingLeaves.length > 5 && (
                <button
                  className="w-full text-xs text-primary hover:underline text-center py-1"
                  onClick={() => onNavigate('leaves')}
                >
                  +{pendingLeaves.length - 5} more pending — view all
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HRMetricCard({ title, value, icon, subtext, color, onClick }: any) {
  const colorMap: any = {
    primary: "bg-primary/10 text-primary group-hover:bg-primary",
    info: "bg-info/10 text-info group-hover:bg-info",
    warning: "bg-warning/10 text-warning group-hover:bg-warning",
    success: "bg-success/10 text-success group-hover:bg-success",
  };

  return (
    <Card
      className="group hover:shadow-lg transition-all duration-300 cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-3 rounded-2xl group-hover:text-white transition-all duration-300", colorMap[color])}>
            {icon}
          </div>
          <div className="opacity-40 group-hover:opacity-100 transition-opacity">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground/60 transition-colors uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold tracking-tight">{value}</p>
          </div>
          <p className="text-[10px] text-muted-foreground group-hover:text-foreground/50 transition-colors">{subtext}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const STAGE_PROGRESS: Record<string, number> = {
  open: 5,
  shortlisting: 20,
  interviewing: 50,
  'technical review': 65,
  'offer extended': 90,
  closed: 100,
};

function VacancyItem({ vacancy, onClick }: { vacancy: any; onClick?: () => void }) {
  const stage = vacancy.stage || vacancy.status || 'open';
  const progress = STAGE_PROGRESS[stage.toLowerCase()] ?? 10;
  const deptName = typeof vacancy.departmentId === 'object' ? vacancy.departmentId?.name : 'General';
  const filled = vacancy.filled ?? 0;
  const total = vacancy.count ?? 1;

  return (
    <div className="space-y-2 cursor-pointer group" onClick={onClick}>
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h5 className="text-sm font-bold truncate group-hover:text-primary transition-colors">{vacancy.title}</h5>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
            {deptName} • {total - filled} position{total - filled !== 1 ? 's' : ''} open
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] bg-muted py-0.5 font-bold uppercase capitalize shrink-0 ml-2">
          {stage}
        </Badge>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function LiveLeaveItem({ leave, onRefresh, onViewAll }: { leave: any; onRefresh: () => void; onViewAll?: () => void }) {
  const [acting, setActing] = useState(false);

  const handleQuickAction = async (action: 'approve' | 'reject') => {
    setActing(true);
    try {
      await api.patch(`/hr/leaves/${leave.id}/dept-approve`, { action, remarks: action === 'approve' ? 'Approved from overview' : 'Rejected from overview' });
      toast.success(action === 'approve' ? 'Leave approved' : 'Leave rejected');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const name = leave.employeeId?.name || 'Employee';
  const type = leave.type ? leave.type.charAt(0).toUpperCase() + leave.type.slice(1) + ' Leave' : 'Leave';
  const start = new Date(leave.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const end = new Date(leave.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const dateStr = start === end ? start : `${start} – ${end}`;

  return (
    <div
      className="flex items-center justify-between p-2 rounded-xl border border-transparent hover:border-border hover:bg-muted/30 transition-all group cursor-pointer"
      onClick={onViewAll}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
          {name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-bold group-hover:text-primary transition-colors">{name}</p>
          <p className="text-[11px] text-muted-foreground">{type} • {dateStr}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Badge className="text-[10px] py-0.5 uppercase font-bold bg-warning/10 text-warning">Pending</Badge>
        <Button
          variant="ghost" size="icon-sm"
          className="opacity-0 group-hover:opacity-100 h-7 w-7 text-green-600 hover:bg-green-50"
          disabled={acting}
          onClick={(e) => { e.stopPropagation(); handleQuickAction('approve'); }}
          title="Quick approve"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost" size="icon-sm"
          className="opacity-0 group-hover:opacity-100 h-7 w-7 text-red-500 hover:bg-red-50"
          disabled={acting}
          onClick={(e) => { e.stopPropagation(); handleQuickAction('reject'); }}
          title="Quick reject"
        >
          <XCircle className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
