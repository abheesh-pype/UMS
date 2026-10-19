import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UsersPanel } from '@/components/panels/UsersPanel';
import { DepartmentsPanel } from '@/components/panels/DepartmentsPanel';
import { TasksPanel } from '@/components/panels/TasksPanel';
import { StudentsPanel } from '@/components/panels/StudentsPanel';
import { UniversitiesPanel } from '@/components/panels/UniversitiesPanel';
import { ProgramsPanel } from '@/components/panels/ProgramsPanel';
import { StudyCentersPanel } from '@/components/panels/StudyCentersPanel';
import { InvoicesPanel } from '@/components/panels/InvoicesPanel';
import { PaymentsPanel } from '@/components/panels/PaymentsPanel';
import { ExpensesPanel } from '@/components/panels/ExpensesPanel';
import { EmployeesPanel } from '@/components/panels/EmployeesPanel';
import { LeavesPanel } from '@/components/panels/LeavesPanel';
import { LeadsPanel } from '@/components/panels/LeadsPanel';
import { OrgHierarchyPanel } from '@/components/panels/OrgHierarchyPanel';
import { BranchesPanel } from '@/components/panels/BranchesPanel';
import { SubDepartmentsPanel } from '@/components/panels/SubDepartmentsPanel';
import { CentersAdmissionsPanel } from '@/components/panels/CentersAdmissionsPanel';
import { OrgAdminSessionsPanel } from '@/components/panels/OrgAdminSessionsPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { MyDocumentsPanel } from '@/components/panels/hr/MyDocumentsPanel';
import { PendingCenterVerificationPanel } from '@/components/panels/PendingCenterVerificationPanel';
import { UniversityExamIntegrationPanel } from '@/pages/ModernUniversityDashboard';

function StudyCentreCustomisationPage() {
  const { user } = useAuth();
  const [currentPattern, setCurrentPattern] = useState('IITSRPS');
  const [customPattern, setCustomPattern] = useState('');
  const [currentUserIdPattern, setCurrentUserIdPattern] = useState('IITSRPS');
  const [customUserIdPattern, setCustomUserIdPattern] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const orgId = typeof (user as any)?.organizationId === 'object'
      ? (user as any)?.organizationId?.id
      : (user as any)?.organizationId;

    if (!orgId) return;

    api.get('/organizations')
      .then((response) => {
        const org = (response.data.data || []).find((item: any) => item.id === orgId);
        const existingPattern = org?.metadata?.studyCenterIdPattern || 'IITSRPS';
        const existingUserIdPattern = org?.metadata?.userIdPattern || 'IITSRPS';
        setCurrentPattern(existingPattern);
        setCustomPattern(existingPattern);
        setCurrentUserIdPattern(existingUserIdPattern);
        setCustomUserIdPattern(existingUserIdPattern);
      })
      .catch(() => {
        setCurrentPattern('IITSRPS');
        setCustomPattern('IITSRPS');
        setCurrentUserIdPattern('IITSRPS');
        setCustomUserIdPattern('IITSRPS');
      });
  }, [user]);

  const handleSave = async () => {
    const orgId = typeof (user as any)?.organizationId === 'object'
      ? (user as any)?.organizationId?.id
      : (user as any)?.organizationId;

    const cleaned = customPattern.trim().replace(/[^a-zA-Z0-9]/g, '');
    if (!orgId) {
      toast.error('Organization not found');
      return;
    }
    if (!cleaned) {
      toast.error('Please enter a valid ID pattern');
      return;
    }

    setSaving(true);
    try {
      const response = await api.get('/organizations');
      const org = (response.data.data || []).find((item: any) => item.id === orgId);
      const payload = {
        ...org,
        metadata: {
          ...(org?.metadata || {}),
          studyCenterIdPattern: cleaned,
        },
      };

      await api.put(`/organizations/${orgId}`, payload);
      setCurrentPattern(cleaned);
      setCustomPattern(cleaned);
      toast.success('Study centre ID pattern saved');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save pattern');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUserIdPattern = async () => {
    const orgId = typeof (user as any)?.organizationId === 'object'
      ? (user as any)?.organizationId?.id
      : (user as any)?.organizationId;

    const cleaned = customUserIdPattern.trim().replace(/[^a-zA-Z0-9]/g, '');
    if (!orgId) {
      toast.error('Organization not found');
      return;
    }
    if (!cleaned) {
      toast.error('Please enter a valid ID pattern');
      return;
    }

    setSaving(true);
    try {
      const response = await api.get('/organizations');
      const org = (response.data.data || []).find((item: any) => item.id === orgId);
      const payload = {
        ...org,
        metadata: {
          ...(org?.metadata || {}),
          userIdPattern: cleaned,
        },
      };

      await api.put(`/organizations/${orgId}`, payload);
      setCurrentUserIdPattern(cleaned);
      setCustomUserIdPattern(cleaned);
      toast.success('User ID pattern saved');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save pattern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Study Centre ID</h1>
      </div>

      <Card className="max-w-3xl">
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Current pattern</label>
            <Input
              value={currentPattern}
              disabled
              readOnly
              className="bg-muted/80 text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">This is the prefix currently used for study centre admin IDs.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Customise pattern</label>
            <Input
              value={customPattern}
              onChange={(e) => setCustomPattern(e.target.value)}
              placeholder="iitsrps"
              className="bg-background"
            />
            <p className="text-xs text-muted-foreground">Example: iitsrps or aaaaaaa. New IDs will continue with a 4-digit number, like aaaaaaa0009.</p>
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </CardContent>
      </Card>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">User ID</h1>
      </div>

      <Card className="max-w-3xl">
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Current pattern</label>
            <Input
              value={currentUserIdPattern}
              disabled
              readOnly
              className="bg-muted/80 text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">This is the prefix currently used for user IDs.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Customise pattern</label>
            <Input
              value={customUserIdPattern}
              onChange={(e) => setCustomUserIdPattern(e.target.value)}
              placeholder="iitsrps"
              className="bg-background"
            />
            <p className="text-xs text-muted-foreground">New IDs will continue with a 4-digit number, like iitsrps0009.</p>
          </div>

          <Button
            type="button"
            onClick={handleSaveUserIdPattern}
            disabled={saving}
            className="w-full"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function ModernOrgAdminDashboard({ initialTab, onNavigate }: { initialTab?: string, onNavigate?: (tab: string) => void }) {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<any>({});
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');
  const linkedUniversityId = typeof (user as any)?.universityId === 'object'
    ? (user as any)?.universityId?.id
    : (user as any)?.universityId;
  const [integrationUniversityId, setIntegrationUniversityId] = useState<string | null>(linkedUniversityId || null);
  const [integrationUniversityLoading, setIntegrationUniversityLoading] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab || 'overview');
  }, [initialTab]);

  useEffect(() => {
    api.get('/dashboard/metrics')
      .then(r => setMetrics(r.data.data || {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (linkedUniversityId) {
      setIntegrationUniversityId(linkedUniversityId);
      return;
    }
    if (activeTab !== 'integration' || integrationUniversityId) return;

    let active = true;
    setIntegrationUniversityLoading(true);
    api.get('/operations/universities')
      .then(response => {
        if (!active) return;
        const university = response.data.data?.[0];
        if (university?.id) setIntegrationUniversityId(university.id);
        else toast.error('No university is configured for this organization');
      })
      .catch((error: any) => {
        if (active) toast.error(error.response?.data?.message || 'Failed to load organization university');
      })
      .finally(() => {
        if (active) setIntegrationUniversityLoading(false);
      });
    return () => { active = false; };
  }, [activeTab, integrationUniversityId, linkedUniversityId]);

  if (activeTab === 'study-centre-customisation') {
    return <StudyCentreCustomisationPage />;
  }

  if (activeTab === 'pending_center_verification') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pending Verification</h1>
          <p className="mt-1 text-muted-foreground">Review pending students and study centres.</p>
        </div>
        <PendingCenterVerificationPanel mode="org" />
      </div>
    );
  }

  if (activeTab === 'integration') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integration</h1>
          <p className="mt-1 text-muted-foreground">Connect your university to an external examination portal.</p>
        </div>
        {integrationUniversityLoading ? (
          <p className="py-6 text-sm text-muted-foreground">Loading university integration...</p>
        ) : integrationUniversityId ? (
          <UniversityExamIntegrationPanel universityId={integrationUniversityId} />
        ) : (
          <p className="py-6 text-sm text-muted-foreground">No university is available for exam portal integration.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">University Admin</h1>
        <p className="text-muted-foreground mt-1">Manage your university's operations, finance, HR, and sales.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                <MetricCard title="Total Users" value={metrics.totalEmployees || 0} />
                <MetricCard title="Students" value={metrics.totalStudents || 0} />
                <MetricCard title="Study Centers" value={metrics.totalCenters || 0} />
                <MetricCard title="Leads" value={metrics.totalLeads || 0} />
              </div>
            </div>
</div>
        </TabsContent>

        <TabsContent value="users"><UsersPanel /></TabsContent>
        <TabsContent value="hierarchy"><OrgHierarchyPanel /></TabsContent>
        <TabsContent value="branches"><BranchesPanel /></TabsContent>
        <TabsContent value="departments"><DepartmentsPanel /></TabsContent>
        <TabsContent value="subdepartments"><SubDepartmentsPanel /></TabsContent>
        <TabsContent value="tasks"><TasksPanel /></TabsContent>
        <TabsContent value="students"><StudentsPanel /></TabsContent>
        <TabsContent value="universities" className="hidden"><UniversitiesPanel /></TabsContent>
        <TabsContent value="programs"><ProgramsPanel /></TabsContent>
        <TabsContent value="sessions"><OrgAdminSessionsPanel /></TabsContent>
        <TabsContent value="centers"><StudyCentersPanel universityAdminMode /></TabsContent>
        <TabsContent value="invoices"><InvoicesPanel /></TabsContent>
        <TabsContent value="payments"><PaymentsPanel /></TabsContent>
        <TabsContent value="expenses"><ExpensesPanel /></TabsContent>
        <TabsContent value="employees"><EmployeesPanel /></TabsContent>
        <TabsContent value="leaves"><LeavesPanel /></TabsContent>
        <TabsContent value="leads"><LeadsPanel /></TabsContent>
        <TabsContent value="center_admissions"><CentersAdmissionsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}
