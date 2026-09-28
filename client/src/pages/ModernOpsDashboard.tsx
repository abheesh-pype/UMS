import { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Building2, 
  BookOpen, 
  Users, 
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  MapPin,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { StudentsPanel } from '@/components/panels/StudentsPanel';
import { ProgramsPanel } from '@/components/panels/ProgramsPanel';
import { StudyCentersPanel } from '@/components/panels/StudyCentersPanel';
import { AdmissionSessionsPanel } from '@/components/panels/AdmissionSessionsPanel';
import { InternalMarksPanel } from '@/components/panels/InternalMarksPanel';
import { AnnouncementsPanel } from '@/components/panels/AnnouncementsPanel';
import { BroadcastNotificationsPanel } from '@/components/panels/BroadcastNotificationsPanel';
import { TasksPanel } from '@/components/panels/TasksPanel';
import { OpsCenterVerificationPanel } from '@/components/panels/OpsCenterVerificationPanel';
import { OpsProgramAllocationPanel } from '@/components/panels/OpsProgramAllocationPanel';
import { DeptEnrollmentReviewPanel } from '@/components/panels/DeptEnrollmentReviewPanel';
import { SubOpsPortalPanel } from '@/components/panels/SubOpsPortalPanel';
import { LeavesPanel } from '@/components/panels/LeavesPanel';
import { AttendancePanel } from '@/components/panels/AttendancePanel';
import { HolidaysPanel } from '@/components/panels/HolidaysPanel';
import { NoticeBoardPanel } from '@/components/panels/NoticeBoardPanel';
import { PollsPanel } from '@/components/panels/PollsPanel';
import { PayrollPanel } from '@/components/panels/PayrollPanel';
import { CentersAdmissionsPanel } from '@/components/panels/CentersAdmissionsPanel';
import { StatusRequestsPanel } from '@/components/panels/StatusRequestsPanel';
import { ManagerHiringPanel } from '@/components/panels/hr/ManagerHiringPanel';
import { useAuth } from '@/hooks/useAuth';
import { MyDocumentsPanel } from '@/components/panels/hr/MyDocumentsPanel';


export function ModernOpsDashboard({ initialTab, onNavigate }: { initialTab?: string, onNavigate?: (tab: string) => void }) {
  const { user } = useAuth();
  const isSubDeptManager = Boolean((user)?.subDepartmentId);
  const [metrics, setMetrics] = useState<any>({});
  const [activeTab, setActiveTab] = useState(initialTab || (isSubDeptManager ? 'my_subdept' : 'overview'));

  // Declare before useEffect so the reference is stable
  const fetchOpsMetrics = async () => {
    try {
      const response = await api.get('/dashboard/metrics');
      setMetrics(response.data.data || {});
    } catch (error) {
    }
  };

  // Sync initialTab changes to activeTab
  useEffect(() => {
    setActiveTab(initialTab || (isSubDeptManager ? 'my_subdept' : 'overview'));
  }, [initialTab]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchOpsMetrics(); }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><OverviewContent metrics={metrics} onNavigate={setActiveTab} /></div>
</div>
      );
      case 'my_subdept': return <SubOpsPortalPanel />;
      case 'students': return <StudentsPanel />;
      case 'programs': return <ProgramsPanel readOnly />;
      case 'centers': return <StudyCentersPanel operationsMode />;
      case 'pending_verification': return <OpsCenterVerificationPanel />;
      case 'program_allocations': return <OpsProgramAllocationPanel />;
      case 'enrollment_review': return <DeptEnrollmentReviewPanel />;
      case 'status_requests': return <StatusRequestsPanel type="operations" />;
      case 'sessions': return <AdmissionSessionsPanel />;
      case 'marks': return <InternalMarksPanel />;
      case 'center_admissions': return <CentersAdmissionsPanel />;
      case 'announcements': return <AnnouncementsPanel />;
      case 'broadcast_notifications': return <BroadcastNotificationsPanel />;
      case 'tasks': return <TasksPanel />;
      case 'my_leaves': return <LeavesPanel isPersonalView />;
      case 'my_attendance': return <AttendancePanel isPersonalView />;
      case 'my_payslips': return <PayrollPanel />;
      case 'my_documents': return <MyDocumentsPanel />;
      case 'manager_hiring': return <ManagerHiringPanel />;
      case 'holidays': return <HolidaysPanel />;
      case 'notice-board': return <NoticeBoardPanel />;
      case 'polls': return <PollsPanel />;
      default: return null;
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      {renderContent()}
    </div>
  );
}

export function getOpsNavItems(isSubDeptManager: boolean) {
  return [
    { id: '__ops_section', label: 'Operations', isSection: true },
    { id: 'overview', label: 'Overview' },
    ...(isSubDeptManager ? [{ id: 'my_subdept', label: 'My Sub-Dept' }] : []),
    { id: 'students', label: 'Students' },
    { id: 'programs', label: 'Programs' },
    { id: 'centers', label: 'Study Centers' },
    { id: 'pending_verification', label: 'Pending Verification' },
    { id: 'program_allocations', label: 'Program Allocations' },
    { id: 'enrollment_review', label: 'Enrollment Review' },
    { id: 'status_requests', label: 'Status Requests' },
    { id: 'sessions', label: 'Admission Sessions' },
    { id: 'marks', label: 'Internal Marks' },
    { id: 'center_admissions', label: 'Centers Admissions' },
    { id: 'announcements', label: 'Announcements' },
    { id: 'broadcast_notifications', label: 'Send Notifications' },
    { id: 'tasks', label: 'Tasks' },
    { id: '__portal_section', label: 'My Portal', isSection: true },
    { id: 'my_leaves', label: 'My Leaves' },
    { id: 'my_attendance', label: 'Attendance' },
    { id: 'my_payslips', label: 'Pay Slips' },
    { id: 'my_documents', label: 'My Documents' },
    { id: 'manager_hiring', label: 'My Hiring Requests' },
    { id: 'holidays', label: 'Holidays' },
    { id: 'notice-board', label: 'Notice Board' },
    { id: 'polls', label: 'Polls' },
  ];
}

function OverviewContent({ metrics, onNavigate }: { metrics: any; onNavigate: (tab: string) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => onNavigate('sessions')}>
          <Calendar className="w-4 h-4 mr-2" />
          Academic Calendar
        </Button>
        <Button variant="premium" onClick={() => onNavigate('students')}>
          <Users className="w-4 h-4 mr-2" />
          View Students
        </Button>
      </div>

      {/* Operations Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-6">
        <OpsMetricCard 
          title="Total Students" 
          value={metrics.totalStudents || 0} 
          icon={<GraduationCap className="w-5 h-5" />}
          subtext="Active in current session"
          onClick={() => onNavigate('students')}
        />
        <OpsMetricCard 
          title="Study Centers" 
          value={metrics.totalCenters || 0} 
          icon={<MapPin className="w-5 h-5" />}
          subtext="Verified institutions"
          onClick={() => onNavigate('centers')}
        />
        <OpsMetricCard 
          title="Active Programs" 
          value={metrics.totalPrograms || 0} 
          icon={<BookOpen className="w-5 h-5" />}
          subtext="Across all departments"
          onClick={() => onNavigate('programs')}
        />
        <OpsMetricCard 
          title="Affiliated Unis" 
          value={metrics.totalOrganizations || 0} 
          icon={<Building2 className="w-5 h-5" />}
          subtext="Partner institutions"
          onClick={() => onNavigate('universities')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Admission Pipeline */}
        <Card className="lg:col-span-2 border-none shadow-xl bg-card/60 backdrop-blur-xl cursor-pointer hover:border-primary/30 transition-colors" onClick={() => onNavigate('students')}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Admission Pipeline</CardTitle>
              <CardDescription>Current session progress</CardDescription>
            </div>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">Session 2026-A</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <PipelineStep 
                label="Inquiry / Leads" 
                value={metrics.totalLeads || 0} 
                percentage={100} 
                color="bg-primary"
                subtext="Total potential candidates"
              />
              <PipelineStep 
                label="Application Submitted" 
                value={metrics.pendingApplications || 0} 
                percentage={metrics.totalLeads ? Math.round((metrics.pendingApplications || 0) / metrics.totalLeads * 100) : 0} 
                color="bg-info"
                subtext="Documents under review"
              />
              <PipelineStep 
                label="Verified & Approved" 
                value={metrics.verifiedApplications || 0} 
                percentage={metrics.totalLeads ? Math.round((metrics.verifiedApplications || 0) / metrics.totalLeads * 100) : 0} 
                color="bg-success"
                subtext="Ready for enrollment"
              />
              <PipelineStep 
                label="Final Enrolled" 
                value={metrics.enrolledStudents || 0} 
                percentage={metrics.totalLeads ? Math.round((metrics.enrolledStudents || 0) / metrics.totalLeads * 100) : 0} 
                color="bg-emerald-500"
                subtext="Payment confirmed"
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Needed */}
        <Card className="border-none shadow-xl bg-card/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Urgent Actions</CardTitle>
            <CardDescription>Tasks requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!metrics.urgentActions || metrics.urgentActions.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No urgent actions at the moment</p>
              </div>
            ) : (
              metrics.urgentActions.map((action: any, idx: number) => (
                <ActionItem 
                  key={idx}
                  icon={action.type === 'error' ? <AlertCircle className="w-4 h-4 text-error" /> : <Clock className="w-4 h-4 text-warning" />}
                  title={action.title}
                  desc={action.desc}
                  action={action.btnText || "View"}
                  onClick={() => onNavigate(action.tab || 'dashboard')}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Management Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <OpsQuickLink 
          title="Student Records" 
          desc="Manage profiles & docs"
          icon={<Users className="w-5 h-5 text-primary" />}
          onClick={() => onNavigate('students')}
        />
        <OpsQuickLink 
          title="University Portal" 
          desc="Manage affiliations"
          icon={<Building2 className="w-5 h-5 text-success" />}
          onClick={() => onNavigate('universities')}
        />
        <OpsQuickLink 
          title="Curriculum Info" 
          desc="Program details & fees"
          icon={<BookOpen className="w-5 h-5 text-info" />}
          onClick={() => onNavigate('programs')}
        />
        <OpsQuickLink 
          title="Admission Rules" 
          desc="Criteria & limits"
          icon={<CheckCircle2 className="w-5 h-5 text-warning" />}
          onClick={() => onNavigate('sessions')}
        />
      </div>
    </div>
  );
}

function OpsMetricCard({ title, value, icon, subtext, onClick }: any) {
  return (
    <Card className="group hover:border-primary/50 transition-all duration-300 cursor-pointer" onClick={onClick}>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-muted text-foreground group-hover:bg-primary group-hover:text-white transition-all duration-300">
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{subtext}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PipelineStep({ label, value, percentage, color, subtext }: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-bold text-foreground">{label}</span>
          <p className="text-[10px] text-muted-foreground">{subtext}</p>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold">{value}</span>
          <span className="text-xs text-muted-foreground ml-2">({percentage}%)</span>
        </div>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-1000", color)} 
          style={{ width: `${percentage}%` }} 
        />
      </div>
    </div>
  );
}

function ActionItem({ icon, title, desc, action, onClick }: any) {
  return (
    <div className="p-4 rounded-xl border border-border bg-background/50 space-y-3">
      <div className="flex items-start gap-3">
        <div className="mt-1 p-1.5 rounded-lg bg-muted">
          {icon}
        </div>
        <div className="space-y-0.5">
          <h5 className="text-sm font-bold">{title}</h5>
          <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="w-full h-8 text-xs hover:bg-muted font-bold" onClick={onClick}>
        {action}
        <ArrowRight className="w-3 h-3 ml-2" />
      </Button>
    </div>
  );
}

function OpsQuickLink({ title, desc, icon, onClick }: any) {
  return (
    <button onClick={onClick} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card/40 hover:bg-muted/50 hover:border-primary/30 hover:shadow-md transition-all text-left">
      <div className="p-2.5 rounded-xl bg-background shadow-xs">
        {icon}
      </div>
      <div className="min-w-0">
        <h5 className="text-sm font-bold truncate">{title}</h5>
        <p className="text-[10px] text-muted-foreground truncate">{desc}</p>
      </div>
    </button>
  );
}
