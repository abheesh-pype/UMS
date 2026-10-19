import { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  ShieldCheck, 
  UserCheck, 
  Search, 
  RefreshCw, 
  Mail, 
  Phone, 
  Building2, 
  GitBranch, 
  MapPin, 
  Briefcase,
  Eye,
  CheckCircle2,
  XCircle,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmployeeProfilePanel } from '@/components/panels/EmployeeProfilePanel';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface MyTeamPanelProps {
  departmentType: 'operations' | 'sales' | 'finance';
  title?: string;
  description?: string;
}

export function MyTeamPanel({ departmentType, title, description }: MyTeamPanelProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'employee' | 'subadmin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const deptLabels: Record<string, { name: string; gradient: string; badgeClass: string }> = {
    operations: {
      name: 'Operations',
      gradient: 'from-blue-600 to-indigo-600',
      badgeClass: 'bg-blue-500/10 text-blue-700 border-blue-200 dark:border-blue-800 dark:text-blue-400',
    },
    sales: {
      name: 'Sales',
      gradient: 'from-emerald-600 to-teal-600',
      badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400',
    },
    finance: {
      name: 'Finance',
      gradient: 'from-amber-600 to-orange-600',
      badgeClass: 'bg-amber-500/10 text-amber-700 border-amber-200 dark:border-amber-800 dark:text-amber-400',
    },
  };

  const currentDept = deptLabels[departmentType] || {
    name: departmentType.charAt(0).toUpperCase() + departmentType.slice(1),
    gradient: 'from-primary to-indigo-600',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
  };

  const fetchTeam = async () => {
    setLoading(true);
    try {
      // Query users API with departmentType parameter
      const res = await api.get('/users', {
        params: { departmentType }
      });
      setUsers(res.data.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch team members');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [departmentType]);

  // Match Department helper
  const isDeptMatch = (user: any) => {
    const target = departmentType.toLowerCase();
    const deptType = user.department?.type?.toLowerCase() || '';
    const deptName = user.department?.name?.toLowerCase() || '';
    const subDeptType = user.subDepartment?.type?.toLowerCase() || '';
    const subDeptParentType = user.subDepartment?.parentDept?.type?.toLowerCase() || '';
    const subDeptParentName = user.subDepartment?.parentDept?.name?.toLowerCase() || '';

    return (
      deptType === target ||
      deptName.includes(target) ||
      subDeptType === target ||
      subDeptParentType === target ||
      subDeptParentName.includes(target)
    );
  };

  // Match Role helper
  const isSubAdminRole = (role: string = '') => {
    const r = role.toLowerCase();
    if (departmentType === 'operations') {
      return r === 'ops_sub_admin' || r === 'operation_subadmin' || r === 'operations_sub_admin' || (r.includes('sub') && r.includes('ops'));
    }
    if (departmentType === 'sales') {
      return r === 'sales_sub_admin' || r === 'bde' || (r.includes('sub') && r.includes('sales'));
    }
    if (departmentType === 'finance') {
      return r === 'finance_sub_admin' || (r.includes('sub') && r.includes('finance'));
    }
    return r.includes('sub_admin');
  };

  const isRoleMatch = (role: string = '') => {
    const r = role.toLowerCase();
    if (r === 'employee') return true;
    return isSubAdminRole(r);
  };

  // Filter team based on exact department and role specifications
  const teamMembers = useMemo(() => {
    return users.filter((user: any) => {
      // Must match department
      if (!isDeptMatch(user)) return false;

      // Must match employee or sub-admin role
      if (!isRoleMatch(user.role)) return false;

      // Exclude generic admins or students
      if (['student', 'center_admin', 'superadmin', 'org_admin', 'ceo'].includes(user.role)) {
        return false;
      }

      return true;
    });
  }, [users, departmentType]);

  // Apply search and filter toggles
  const filteredMembers = useMemo(() => {
    return teamMembers.filter((m: any) => {
      // Role filter
      if (roleFilter === 'employee' && m.role?.toLowerCase() !== 'employee') return false;
      if (roleFilter === 'subadmin' && !isSubAdminRole(m.role)) return false;

      // Status filter
      if (statusFilter === 'active' && m.status !== 'active') return false;
      if (statusFilter === 'inactive' && m.status === 'active') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = m.name?.toLowerCase().includes(q);
        const emailMatch = m.email?.toLowerCase().includes(q);
        const userIdMatch = m.userId?.toLowerCase().includes(q);
        const phoneMatch = m.phone?.toLowerCase().includes(q);
        const desigMatch = m.designation?.toLowerCase().includes(q) || m.designationRef?.title?.toLowerCase().includes(q);
        const branchMatch = m.branch?.name?.toLowerCase().includes(q);
        return nameMatch || emailMatch || userIdMatch || phoneMatch || desigMatch || branchMatch;
      }

      return true;
    });
  }, [teamMembers, roleFilter, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = teamMembers.length;
    const active = teamMembers.filter((m) => m.status === 'active').length;
    const subAdmins = teamMembers.filter((m) => isSubAdminRole(m.role)).length;
    const employees = teamMembers.filter((m) => m.role?.toLowerCase() === 'employee').length;
    return { total, active, subAdmins, employees };
  }, [teamMembers]);

  const handleOpenProfile = (userId: string) => {
    setSelectedUserId(userId);
    setProfileOpen(true);
  };
  const selectedEmployee = users.find((user) => user.id === selectedUserId);

  const formatRoleLabel = (role: string = '') => {
    const r = role.toLowerCase();
    if (r === 'ops_sub_admin' || r === 'operation_subadmin' || r === 'operations_sub_admin') {
      return 'Operations Sub-Admin';
    }
    if (r === 'finance_sub_admin') {
      return 'Finance Sub-Admin';
    }
    if (r === 'sales_sub_admin') {
      return 'Sales Sub-Admin';
    }
    if (r === 'bde') {
      return 'Business Development Exec (BDE)';
    }
    if (r === 'employee') {
      return 'Employee';
    }
    return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={cn("text-xs font-semibold px-2.5 py-0.5", currentDept.badgeClass)}>
              {currentDept.name} Department
            </Badge>
            <span className="text-xs text-muted-foreground font-medium">Team Directory</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {title || `${currentDept.name} Team`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {description || `Members, sub-administrators, and employees reporting in ${currentDept.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchTeam} disabled={loading} className="gap-2">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-border/60 shadow-xs bg-card/60 backdrop-blur-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Team</p>
              <h3 className="text-2xl font-bold text-foreground mt-1">{loading ? '...' : stats.total}</h3>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-xs bg-card/60 backdrop-blur-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Members</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">{loading ? '...' : stats.active}</h3>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
              <UserCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-xs bg-card/60 backdrop-blur-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sub-Admins</p>
              <h3 className="text-2xl font-bold text-indigo-600 mt-1">{loading ? '...' : stats.subAdmins}</h3>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-xs bg-card/60 backdrop-blur-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Employees</p>
              <h3 className="text-2xl font-bold text-sky-600 mt-1">{loading ? '...' : stats.employees}</h3>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600">
              <Briefcase className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border border-border/60 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, email, designation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Filter className="w-3.5 h-3.5" />
                <span>Role:</span>
              </div>
              <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
                <SelectTrigger className="w-[140px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="subadmin">Sub-Admins</SelectItem>
                  <SelectItem value="employee">Employees</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-[120px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="border border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="py-4 px-6 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-semibold">Team Members</CardTitle>
              <CardDescription className="text-xs">
                Showing {filteredMembers.length} of {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''} in {currentDept.name}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-primary/70" />
              <p className="text-sm">Loading team members...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-foreground">No team members found</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                  ? 'No members match the current filter criteria. Try clearing search or filters.'
                  : `There are currently no employees or sub-admins assigned to the ${currentDept.name} department.`}
              </p>
              {(searchQuery || roleFilter !== 'all' || statusFilter !== 'all') && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => { setSearchQuery(''); setRoleFilter('all'); setStatusFilter('all'); }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-muted-foreground font-semibold text-xs">
                    <th className="py-3 px-4 text-left">Employee</th>
                    <th className="py-3 px-4 text-left">Role</th>
                    <th className="py-3 px-4 text-left">Designation</th>
                    <th className="py-3 px-4 text-left">Department</th>
                    <th className="py-3 px-4 text-left">Branch</th>
                    <th className="py-3 px-4 text-left">Contact</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredMembers.map((member: any) => {
                    const isSubAdmin = isSubAdminRole(member.role);
                    const designationTitle = member.designationRef?.title || member.designation || 'Team Member';
                    const initials = member.name
                      ? member.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
                      : 'U';

                    return (
                      <tr 
                        key={member.id} 
                        className="hover:bg-muted/40 transition-colors group cursor-pointer"
                        onClick={() => handleOpenProfile(member.id)}
                      >
                        {/* Employee Name & UserID */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                              isSubAdmin 
                                ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800" 
                                : "bg-primary/10 text-primary border border-primary/20"
                            )}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                {member.name}
                              </p>
                              {member.userId ? (
                                <span className="inline-block font-mono text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded mt-0.5">
                                  {member.userId}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td className="py-3 px-4">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs font-medium gap-1",
                              isSubAdmin
                                ? "bg-indigo-500/10 text-indigo-700 border-indigo-200 dark:border-indigo-800 dark:text-indigo-300"
                                : "bg-sky-500/10 text-sky-700 border-sky-200 dark:border-sky-800 dark:text-sky-300"
                            )}
                          >
                            {isSubAdmin ? <ShieldCheck className="w-3 h-3 text-indigo-600" /> : <UserCheck className="w-3 h-3 text-sky-600" />}
                            {formatRoleLabel(member.role)}
                          </Badge>
                        </td>

                        {/* Designation */}
                        <td className="py-3 px-4 text-foreground/90 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[180px]">{designationTitle}</span>
                          </div>
                        </td>

                        {/* Department / SubDepartment */}
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-medium text-foreground text-xs">
                              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span>{member.department?.name || currentDept.name}</span>
                            </div>
                            {member.subDepartment?.name && (
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <GitBranch className="w-3 h-3 shrink-0" />
                                <span>{member.subDepartment.name}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Branch */}
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {member.branch?.name ? (
                            <div className="flex items-center gap-1.5 text-foreground/80">
                              <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate">{member.branch.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        {/* Contact */}
                        <td className="py-3 px-4 text-xs">
                          <div className="space-y-1">
                            {member.email && (
                              <a 
                                href={`mailto:${member.email}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 text-foreground/80 hover:text-primary transition-colors"
                              >
                                <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate max-w-[170px]">{member.email}</span>
                              </a>
                            )}
                            {member.phone && (
                              <a 
                                href={`tel:${member.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span>{member.phone}</span>
                              </a>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          {member.status === 'active' ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400 text-[11px] gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted text-muted-foreground text-[11px]">
                              {member.status || 'Inactive'}
                            </Badge>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenProfile(member.id)}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Profile
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Profile Sheet */}
      {selectedUserId && (
        <EmployeeProfilePanel
          userId={selectedUserId}
          open={profileOpen}
          employee={selectedEmployee}
          readOnly
          onOpenChange={(open) => {
            setProfileOpen(open);
            if (!open) setSelectedUserId(null);
          }}
        />
      )}
    </div>
  );
}
