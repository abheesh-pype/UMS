import { useState, useEffect } from 'react';
import { 
  Shield,
  Building2, 
  Users, 
  ShieldAlert, 
  Globe, 
  Lock, 
  Server,
  Key,
  Search,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { OrganizationsPanel } from '@/components/panels/OrganizationsPanel';
import { UniversitiesPanel } from '@/components/panels/UniversitiesPanel';
import { UsersPanel } from '@/components/panels/UsersPanel';
import { DepartmentsPanel } from '@/components/panels/DepartmentsPanel';
import { LicensesPanel } from '@/components/panels/LicensesPanel';
import { SubDepartmentsPanel } from '@/components/panels/SubDepartmentsPanel';
import { CentersAdmissionsPanel } from '@/components/panels/CentersAdmissionsPanel';
import { MyDocumentsPanel } from '@/components/panels/hr/MyDocumentsPanel';

const globalActivity = [
  { time: '00:00', requests: 120, latency: 45 },
  { time: '04:00', requests: 80, latency: 42 },
  { time: '08:00', requests: 450, latency: 68 },
  { time: '12:00', requests: 890, latency: 85 },
  { time: '16:00', requests: 720, latency: 72 },
  { time: '20:00', requests: 340, latency: 50 },
  { time: '23:59', requests: 180, latency: 46 },
];

export function ModernSuperadminDashboard({ initialTab, onNavigate: _onNavigate }: { initialTab?: string, onNavigate?: (tab: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<any>({});
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');

  useEffect(() => {
    setActiveTab(initialTab || 'overview');
  }, [initialTab]);

  useEffect(() => {
    fetchGlobalMetrics();
  }, []);

  const fetchGlobalMetrics = async () => {
    setLoading(true);
    try {
      const response = await api.get('/dashboard/metrics');
      setMetrics(response.data.data || {});
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8"><div className="h-64 bg-muted rounded-xl animate-pulse" /></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Superadmin Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary mb-2">
            <div className="rounded-md bg-primary/10 p-1.5"><Shield className="w-3.5 h-3.5" /></div>
            <span className="text-xs font-bold uppercase tracking-widest">Mission Control</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Global Administration</h1>
          <p className="text-muted-foreground mt-2 text-sm">Managing {metrics.totalOrganizations || 8} universities across the institutional network.</p>
        </div>
      </div>

      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-white/70 p-1.5 shadow-sm dark:bg-card/70">
          <TabsTrigger value="overview" className="rounded-xl px-4 py-2 text-xs font-semibold data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Overview</TabsTrigger>
          <TabsTrigger value="university-management" className="rounded-xl px-4 py-2 text-xs font-semibold">University Management</TabsTrigger>
          <TabsTrigger value="organizations" className="rounded-xl px-4 py-2 text-xs font-semibold">University Profile</TabsTrigger>
          <TabsTrigger value="users" className="rounded-xl px-4 py-2 text-xs font-semibold">Users</TabsTrigger>
          <TabsTrigger value="departments" className="rounded-xl px-4 py-2 text-xs font-semibold">Departments</TabsTrigger>
          <TabsTrigger value="subdepartments" className="rounded-xl px-4 py-2 text-xs font-semibold">Sub-Departments</TabsTrigger>
          <TabsTrigger value="center_admissions" className="rounded-xl px-4 py-2 text-xs font-semibold">Admissions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Overview content - existing dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2"><OverviewContent metrics={metrics} /></div>
</div>
        </TabsContent>

        <TabsContent value="university-management">
          <UniversitiesPanel />
        </TabsContent>

        <TabsContent value="organizations">
          <OrganizationsPanel />
        </TabsContent>

        <TabsContent value="users">
          <UsersPanel />
        </TabsContent>

        <TabsContent value="departments">
          <DepartmentsPanel />
        </TabsContent>

        <TabsContent value="subdepartments">
          <SubDepartmentsPanel />
        </TabsContent>

        <TabsContent value="center_admissions">
          <CentersAdmissionsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewContent({ metrics }: { metrics: any }) {
  return (
    <div className="space-y-6">
      {/* Global Core Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-5">
        <GlobalMetric 
            title="Universities"
          value={metrics.totalOrganizations || 8} 
          trend="2 Pending" 
          icon={<Building2 className="w-5 h-5" />}
          color="primary"
        />
        <GlobalMetric 
          title="Global Users" 
          value={(metrics.totalEmployees || 0) + (metrics.totalStudents || 0) || "1.5k"} 
          trend="+84 this week" 
          icon={<Users className="w-5 h-5" />}
          color="info"
        />
        <GlobalMetric 
          title="Security Alerts" 
          value="0" 
          trend="All clear" 
          icon={<ShieldAlert className="w-5 h-5" />}
          color="success"
        />
        <GlobalMetric 
          title="Avg Latency" 
          value="64ms" 
          trend="Optimized" 
          icon={<Server className="w-5 h-5" />}
          color="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Global Traffic Chart */}
        <Card className="lg:col-span-2 border-border/70 shadow-sm bg-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-8">
            <div>
              <CardTitle>System Load & Traffic</CardTitle>
              <CardDescription>Real-time request processing and latency</CardDescription>
            </div>
            <div className="flex items-center gap-2">
               <Badge className="bg-success/10 text-success border-none">Healthy</Badge>
               <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            </div>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={globalActivity}>
                <defs>
                  <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E9684A" stopOpacity={0.28}/>
                    <stop offset="95%" stopColor="#F4B183" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                <YAxis hide />
                <Tooltip contentStyle={{ borderRadius: '12px' }} />
                <Area 
                  type="monotone" 
                  dataKey="requests" 
                  stroke="#E9684A" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorReq)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Global Universities */}
        <Card className="border-border/70 shadow-sm bg-card">
          <CardHeader>
            <CardTitle>University Pulse</CardTitle>
            <CardDescription>Activity per institution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
             <OrgPulseItem name="Global University" health={98} users="840" status="Active" />
             <OrgPulseItem name="Northern Academy" health={84} users="320" status="Attention" />
             <OrgPulseItem name="Tech Institute" health={99} users="210" status="Active" />
             <OrgPulseItem name="Science College" health={92} users="180" status="Active" />
             <Button variant="outline" className="w-full mt-4 h-9 text-xs font-bold border-primary/20 hover:bg-primary/5 text-primary">
               View All Universities
               <ChevronRight className="w-3 h-3 ml-2" />
             </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Security / Audit Log */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Security Audit Log</CardTitle>
            <Shield className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
             <AuditItem 
               user="superadmin" 
               action="Modified License" 
               target="Global Uni" 
               time="10m ago" 
               type="info"
             />
             <AuditItem 
               user="org_admin_2" 
               action="New API Key Generated" 
               target="..." 
               time="45m ago" 
               type="warning"
             />
             <AuditItem 
               user="system" 
               action="Auto-Backup Completed" 
               target="Local Storage" 
               time="2h ago" 
               type="success"
             />
          </CardContent>
        </Card>

        {/* Global Search / Quick Access */}
        <div className="space-y-4">
           <div className="relative group">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
             <input 
               placeholder="Global search across universities, users, or audit logs..."
               className="w-full h-14 pl-12 pr-4 rounded-2xl bg-card/60 backdrop-blur-xl border border-border focus:border-primary/50 outline-none shadow-lg transition-all"
             />
             <div className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-muted rounded text-[10px] font-bold text-muted-foreground">⌘ K</div>
           </div>
           
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <QuickAccessBtn icon={<Lock className="w-5 h-5" />} title="Permissions" desc="Global RBAC" />
             <QuickAccessBtn icon={<Globe className="w-5 h-5" />} title="Domains" desc="Whitelabeling" />
             <QuickAccessBtn icon={<Key className="w-5 h-5" />} title="License Keys" desc="Compliance" />
             <QuickAccessBtn icon={<Server className="w-5 h-5" />} title="Resources" desc="Server Health" />
           </div>
        </div>
      </div>
    </div>
  );
}

function GlobalMetric({ title, value, trend, icon, color }: any) {
  const colorMap: any = {
    primary: "text-primary",
    info: "text-info",
    success: "text-success",
    warning: "text-warning",
  };

  return (
    <Card className="border-border/70 shadow-sm hover:-translate-y-0.5 hover:border-primary/40 transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-2.5 rounded-xl bg-muted", colorMap[color])}>
            {icon}
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-[9px] font-bold text-muted-foreground uppercase">{trend}</span>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{title}</p>
          <p className="text-3xl font-bold tracking-tight mt-1 text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function OrgPulseItem({ name, health, users, status }: any) {
  return (
    <div className="flex items-center justify-between p-2">
       <div className="flex items-center gap-3">
         <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center font-bold text-[10px]">{name.substring(0, 2).toUpperCase()}</div>
         <div>
           <p className="text-xs font-bold">{name}</p>
           <p className="text-[10px] text-muted-foreground">{users} Active Users</p>
         </div>
       </div>
         <div className="flex items-center gap-3">
            <div className="text-right">
               <p className={cn("text-xs font-bold", health > 90 ? "text-success" : "text-warning")}>{health}%</p>
               <p className="text-[9px] text-muted-foreground uppercase leading-none">{status}</p>
            </div>
            <Button variant="ghost" size="icon-sm"><MoreHorizontal className="w-4 h-4" /></Button>
         </div>
    </div>
  );
}

function AuditItem({ user, action, target, time, type }: any) {
  const typeMap: any = {
    success: "bg-success",
    warning: "bg-warning",
    info: "bg-info",
    error: "bg-error",
  };

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-all">
       <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", typeMap[type])} />
       <div className="min-w-0">
          <p className="text-xs font-bold truncate">
            <span className="text-primary">{user}</span> {action} <span className="text-muted-foreground">{target}</span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{time}</p>
       </div>
    </div>
  );
}

function QuickAccessBtn({ icon, title, desc }: any) {
  return (
    <button className="flex flex-col gap-3 p-4 rounded-2xl bg-card border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left group">
       <div className="p-2 w-fit rounded-lg bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
         {icon}
       </div>
       <div>
         <h5 className="text-xs font-bold">{title}</h5>
         <p className="text-[9px] text-muted-foreground">{desc}</p>
       </div>
    </button>
  );
}
