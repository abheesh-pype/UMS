import { useState, useEffect } from 'react';
import { ArrowUpRight } from 'lucide-react';
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
import { SalesOverview } from '@/components/panels/SalesOverviewCharts';
import { PayrollPanel } from '@/components/panels/PayrollPanel';
import { ManagerHiringPanel } from '@/components/panels/hr/ManagerHiringPanel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { MyDocumentsPanel } from '@/components/panels/hr/MyDocumentsPanel';
import { getSalesNavItems } from './navItems';
export { getSalesNavItems };


export function ModernSalesDashboard({ initialTab, isSubDeptManager, onNavigate }: { initialTab?: string; isSubDeptManager?: boolean; onNavigate?: (tab: string) => void }) {
  const { user } = useAuth();
  const isSalesAdmin = user?.role === 'sales_admin' || user?.role === 'bde' || isSubDeptManager;

  const [activeTab, setActiveTab] = useState(initialTab || 'overview');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (onNavigate) {
      onNavigate(tab === 'overview' || tab === 'my_subdept' ? 'dashboard' : tab);
    }
  };

  useEffect(() => {
    setActiveTab(initialTab || 'overview');
  }, [initialTab]);

  // Sub-dept manager (employee in sales dept) — scoped personal view
  if (!isSalesAdmin) {
    return <SalesEmployeePortal initialTab={initialTab} user={user} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return (
        <SalesOverview hideTeam={Boolean(isSubDeptManager)} onNavigate={handleTabChange} />
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
      case 'leave_approvals': return <LeavesPanel approvalsOnly />;
      case 'my_attendance': return <AttendancePanel isPersonalView />;
      case 'team_attendance': return <AttendancePanel isTeamView />;
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
          case 'team_attendance': return <AttendancePanel isTeamView />;
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
