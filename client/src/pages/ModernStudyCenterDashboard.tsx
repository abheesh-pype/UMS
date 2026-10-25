import { useState, useEffect } from 'react';
import { Wallet, GraduationCap, ClipboardList, School } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { StudyCenterWalletPanel } from '@/components/panels/StudyCenterWalletPanel';
import { EnrollStudentPanel } from '@/components/panels/EnrollStudentPanel';
import { StudyCenterEnrollmentsPanel } from '@/components/panels/StudyCenterEnrollmentsPanel';
import { StudentsPanel } from '@/components/panels/StudentsPanel';
import { TasksPanel } from '@/components/panels/TasksPanel';
import { InternalMarksPanel } from '@/components/panels/InternalMarksPanel';
import { ProgramsPanel } from '@/components/panels/ProgramsPanel';
import { FinanceReregReportWrapper } from '@/components/panels/FinanceReregReportWrapper';
import api from '@/lib/api';
import { MyDocumentsPanel } from '@/components/panels/hr/MyDocumentsPanel';


export function ModernStudyCenterDashboard({ initialTab, onNavigate }: { initialTab?: string, onNavigate?: (tab: string) => void }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (onNavigate) {
      onNavigate(tab === 'overview' || tab === 'my_subdept' ? 'dashboard' : tab);
    }
  };
  const [metrics, setMetrics] = useState<any>({});
  const [centerConfig, setCenterConfig] = useState<any>(null);

  useEffect(() => {
    setActiveTab(initialTab || 'overview');
  }, [initialTab]);

  useEffect(() => {
    api.get('/enrollment/wallet').then(r => setMetrics(r.data.data || {})).catch(() => {});
    api.get('/enrollment/my-center-status').then(r => setCenterConfig(r.data.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Study Center Portal</h1>
        <p className="text-muted-foreground mt-1">Manage enrollments, wallet, and daily operations.</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="hidden flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="enroll">Enroll Student</TabsTrigger>
          <TabsTrigger value="enrollments">My Enrollments</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="rereg-report">Re-Registration Report</TabsTrigger>
          {centerConfig?.allowInternalMarks && (
            <TabsTrigger value="marks">Internal Marks</TabsTrigger>
          )}
          <TabsTrigger value="programs">Programs & Materials</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <OverviewCard
                  icon={<Wallet className="w-5 h-5 text-primary" />}
                  label="Wallet Balance"
                  value={`₹${(metrics.balance || 0).toLocaleString()}`}
                  onClick={() => onNavigate ? onNavigate('center_wallet') : handleTabChange('wallet')}
                />
                <OverviewCard
                  icon={<GraduationCap className="w-5 h-5 text-success" />}
                  label="Total Enrollments"
                  value={metrics.totalEnrollments !== undefined ? metrics.totalEnrollments.toString() : '0'}
                  onClick={() => onNavigate ? onNavigate('students') : handleTabChange('students')}
                />
                <OverviewCard
                  icon={<ClipboardList className="w-5 h-5 text-warning" />}
                  label="Pending Review"
                  value={metrics.pendingReview !== undefined ? metrics.pendingReview.toString() : '0'}
                  onClick={() => onNavigate ? onNavigate('center_enrollments') : handleTabChange('enrollments')}
                />
              </div>
              <div className="mt-6 p-6 rounded-xl border border-border bg-card/60">
                <div className="flex items-center gap-3 mb-4">
                  <School className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Quick Actions</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={() => onNavigate ? onNavigate('enroll_student') : handleTabChange('enroll')} className="p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left">
                    <GraduationCap className="w-5 h-5 text-primary mb-2" />
                    <p className="text-sm font-semibold">Enroll Student</p>
                    <p className="text-xs text-muted-foreground">Submit a new enrollment</p>
                  </button>
                  {/* <button onClick={() => onNavigate ? onNavigate('center_wallet') : handleTabChange('wallet')} className="p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left">
                    <Wallet className="w-5 h-5 text-success mb-2" />
                    <p className="text-sm font-semibold">Top Up Wallet</p>
                    <p className="text-xs text-muted-foreground">Request balance top-up</p>
                  </button> */}
                </div>              </div>
            </div>
</div>
        </TabsContent>

        <TabsContent value="wallet"><StudyCenterWalletPanel /></TabsContent>
        <TabsContent value="enroll"><EnrollStudentPanel /></TabsContent>
        <TabsContent value="enrollments"><StudyCenterEnrollmentsPanel /></TabsContent>
        <TabsContent value="students"><StudentsPanel /></TabsContent>
        <TabsContent value="rereg-report"><FinanceReregReportWrapper /></TabsContent>
        {centerConfig?.allowInternalMarks && (
          <TabsContent value="marks"><InternalMarksPanel /></TabsContent>
        )}
        <TabsContent value="programs"><ProgramsPanel /></TabsContent>
        <TabsContent value="tasks"><TasksPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewCard({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick?: () => void }) {
  return (
    <Card 
      onClick={onClick} 
      className={onClick ? "cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors" : ""}
    >
      <CardContent className="p-5 flex items-center gap-4">
        <div className="p-2.5 rounded-xl bg-muted">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
