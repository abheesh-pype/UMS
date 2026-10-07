import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole, DepartmentType } from '@/types/erp';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Users,
  LayoutDashboard,
  GraduationCap,
  DollarSign,
  Briefcase,
  TrendingUp,
  School,
  Settings,
  UserCog,
  AlertTriangle,
  FileText,
  Calendar,
  MessageSquare,
  CheckSquare,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Building,
  Key,
  Target,
  Receipt,
  Wallet,
  UserPlus,
  Bell,
  BookOpen,
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  activeModule: string;
  onModuleChange: (module: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  badge?: number;
  children?: NavItem[];
  department?: DepartmentType;
}

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['superadmin', 'org_admin', 'ceo', 'ops_admin', 'finance_admin', 'hr_admin', 'sales_admin', 'bde', 'employee'],
  },
  {
    id: 'organizations',
    label: 'Universities',
    icon: Building2,
    roles: ['superadmin'],
    children: [
      { id: 'org-list', label: 'All Universities', icon: Building, roles: ['superadmin'] },
      { id: 'licenses', label: 'Licenses', icon: Key, roles: ['superadmin'] },
    ],
  },
  {
    id: 'center_admissions',
    label: 'Centers Admissions',
    icon: GraduationCap,
    roles: ['superadmin', 'org_admin', 'ceo'],
  },
  {
    id: 'departments',
    label: 'Departments',
    icon: Building,
    roles: ['org_admin', 'ceo'],
  },
  {
    id: 'ceo-dashboard',
    label: 'CEO Dashboard',
    icon: UserCog,
    roles: ['ceo'],
    children: [
      { id: 'escalations', label: 'Escalations', icon: AlertTriangle, roles: ['ceo'], badge: 1 },
      { id: 'reports', label: 'Reports', icon: FileText, roles: ['ceo'] },
      { id: 'performance', label: 'Performance', icon: Target, roles: ['ceo'] },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: GraduationCap,
    roles: ['ops_admin', 'ceo', 'employee'],
    department: 'operations',
    children: [
      { id: 'centers', label: 'Study Centers', icon: Building, roles: ['ops_admin', 'ceo', 'employee'] },
      { id: 'students', label: 'Students', icon: Users, roles: ['ops_admin', 'ceo', 'employee'] },
      { id: 'marks', label: 'Internal Marks', icon: FileText, roles: ['ops_admin', 'ceo', 'employee'] },
      { id: 'sessions', label: 'Admission Sessions', icon: Calendar, roles: ['ops_admin', 'ceo', 'employee'] },
      { id: 'center_admissions', label: 'Center Admissions', icon: GraduationCap, roles: ['ops_admin', 'ceo', 'employee'] },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: DollarSign,
    roles: ['finance_admin', 'ceo'],
    children: [
      { id: 'student_payment_log', label: 'Student Payment Log', icon: Receipt, roles: ['finance_admin', 'ceo'] },
      { id: 'invoices', label: 'Invoices', icon: Receipt, roles: ['finance_admin', 'ceo'] },
      { id: 'payments', label: 'Payments', icon: Wallet, roles: ['finance_admin', 'ceo'] },
      { id: 'university_fees', label: 'University Fees', icon: School, roles: ['finance_admin', 'ceo'] },
      { id: 'expenses', label: 'Expenses', icon: Receipt, roles: ['finance_admin', 'ceo'] },
      { id: 'targets', label: 'Targets', icon: Target, roles: ['finance_admin', 'ceo'] },
      { id: 'fees', label: 'Fee Structures', icon: Settings, roles: ['finance_admin', 'ceo'] },
      { id: 'salary_approvals', label: 'Salary Approvals', icon: CheckSquare, roles: ['finance_admin', 'ceo'] },
      { id: 'payroll-batches', label: 'Payroll Batches', icon: CheckSquare, roles: ['finance_admin', 'ceo'] },
      { id: 'approvals', label: 'Approvals', icon: CheckSquare, roles: ['finance_admin', 'ceo'] },
      { id: 'center_admissions', label: 'Center Admissions', icon: GraduationCap, roles: ['finance_admin', 'ceo'] },
    ],
  },
  {
    id: 'hr',
    label: 'Human Resources',
    icon: Briefcase,
    roles: ['hr_admin', 'ceo'],
    children: [
      { id: 'users', label: 'Users', icon: Users, roles: ['hr_admin', 'ceo'] },
      { id: 'employees', label: 'Employees', icon: Users, roles: ['hr_admin', 'ceo'] },
      { id: 'vacancies', label: 'Vacancies', icon: UserPlus, roles: ['hr_admin', 'ceo'] },
      { id: 'attendance', label: 'Attendance list', icon: Calendar, roles: ['hr_admin', 'ceo'] },
      { id: 'attendance-calendar', label: 'Attendance Calendar', icon: Calendar, roles: ['hr_admin', 'ceo'] },
      { id: 'leaves', label: 'Leave History', icon: Calendar, roles: ['hr_admin', 'ceo'] },
      { id: 'leave-approvals', label: 'Leave Approvals', icon: CheckSquare, roles: ['hr_admin', 'ceo'] },
      { id: 'complaints', label: 'Complaints', icon: MessageSquare, roles: ['hr_admin', 'ceo'] },
      { id: 'payroll', label: 'Payroll', icon: DollarSign, roles: ['hr_admin', 'ceo'] },
      { id: 'salary-config', label: 'Salary Config', icon: Settings, roles: ['hr_admin', 'ceo'] },
      { id: 'payroll-batches', label: 'Payroll Batches', icon: CheckSquare, roles: ['hr_admin', 'ceo'] },
    ],
  },
  {
    id: 'sales',
    label: 'Sales & CRM',
    icon: TrendingUp,
    roles: ['sales_admin', 'bde', 'ceo', 'employee'],
    department: 'sales',
    children: [
      { id: 'leads', label: 'Leads', icon: Users, roles: ['sales_admin', 'bde', 'ceo', 'employee'] },
      { id: 'study_centers', label: 'Manual Center Creation', icon: Building, roles: ['sales_admin', 'bde', 'ceo', 'employee'] },
      { id: 'center_onboarding', label: 'Center Onboarding Status', icon: LayoutDashboard, roles: ['sales_admin', 'bde', 'ceo', 'employee'] },
      { id: 'deals', label: 'Deals', icon: CheckSquare, roles: ['sales_admin', 'bde', 'ceo', 'employee'] },
      { id: 'referrals', label: 'Referrals', icon: UserPlus, roles: ['sales_admin', 'bde', 'ceo', 'employee'] },
      { id: 'quotations', label: 'Quotations', icon: FileText, roles: ['sales_admin', 'bde', 'ceo', 'employee'] },
      { id: 'center_admissions', label: 'Center Admissions', icon: GraduationCap, roles: ['sales_admin', 'bde', 'ceo', 'employee'] },
    ],
  },
  {
    id: 'center',
    label: 'Center Portal',
    icon: School,
    roles: ['center_admin'],
    children: [
      { id: 'center-students', label: 'My Students', icon: Users, roles: ['center_admin'] },
      { id: 'center-invoices', label: 'Invoices', icon: Receipt, roles: ['center_admin'] },
      { id: 'center-marks', label: 'Enter Marks', icon: FileText, roles: ['center_admin'] },
    ],
  },
  {
    id: 'academic-admin',
    label: 'Academic Administration',
    icon: GraduationCap,
    roles: ['academic_admin'],
    children: [
      { id: 'academic-session', label: 'Academic Session', icon: Calendar, roles: ['academic_admin'] },
      { id: 'academic-programs', label: 'Programs', icon: BookOpen, roles: ['academic_admin'] },
      { id: 'academic-semesters', label: 'Semester', icon: Calendar, roles: ['academic_admin'] },
      { id: 'academic-modules', label: 'Modules', icon: BookOpen, roles: ['academic_admin'] },
      { id: 'academic-calendar', label: 'Academic Calendar', icon: Calendar, roles: ['academic_admin'] },
      { id: 'academic-examination', label: 'Examination', icon: FileText, roles: ['academic_admin'] },
    ],
  },
  {
    id: 'employee',
    label: 'My Workspace',
    icon: Briefcase,
    roles: ['employee'],
    children: [
      { id: 'my-tasks', label: 'My Tasks', icon: CheckSquare, roles: ['employee'] },
      { id: 'my-attendance', label: 'Attendance', icon: Calendar, roles: ['employee'] },
      { id: 'my-leaves', label: 'Apply Leave', icon: Calendar, roles: ['employee'] },
      { id: 'my-complaints', label: 'Complaints', icon: MessageSquare, roles: ['employee'] },
    ],
  },
  {
    id: 'staff',
    label: 'Staff Portal',
    icon: Users,
    roles: ['employee', 'ops_admin', 'finance_admin', 'hr_admin', 'sales_admin', 'bde'],
    children: [
      { id: 'holidays', label: 'Holidays', icon: Calendar, roles: ['employee', 'ops_admin', 'finance_admin', 'hr_admin', 'sales_admin', 'bde'] },
      { id: 'announcements', label: 'Announcements', icon: Bell, roles: ['employee', 'ops_admin', 'finance_admin', 'hr_admin', 'sales_admin', 'bde'] },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    roles: ['superadmin', 'org_admin'],
  },
];

export function Sidebar({ isCollapsed, onToggle, activeModule, onModuleChange }: SidebarProps) {
  const { user, logout } = useAuth();

  if (!user) return null;

  const filteredNavItems = navItems.filter(item => {
    if (!item.roles.includes(user.role)) return false;

    // Filter department-specific tabs for employee role
    if (item.department && user.role === 'employee') {
      const userDeptType = typeof (user as any).departmentId === 'object' 
        ? ((user as any).departmentId)?.type 
        : null;
      return userDeptType === item.department;
    }

    return true;
  });

  const handleNavClick = (itemId: string) => {
    onModuleChange(itemId);
  };

  return (
    <div
      className={cn(
        'flex flex-col h-screen bg-slate-900 text-white transition-all duration-300 border-r border-slate-800',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="UMS" className="w-8 h-8 object-contain rounded-lg" />
            <span className="font-bold text-lg tracking-tight">UMS</span>
          </div>
        )}
        {isCollapsed && (
          <img src="/logo.png" alt="UMS" className="w-8 h-8 object-contain rounded-lg mx-auto" />
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="text-slate-400 hover:text-white hover:bg-slate-800"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="px-2 space-y-1">
          {filteredNavItems.map((item) => (
            <NavItemComponent
              key={item.id}
              item={item}
              isCollapsed={isCollapsed}
              isActive={activeModule === item.id || (item.children?.some(c => c.id === activeModule) ?? false)}
              activeChild={activeModule}
              onClick={handleNavClick}
            />
          ))}
        </nav>
      </ScrollArea>

      {/* User Info & Logout */}
      <div className="border-t border-slate-800 p-4">
        {!isCollapsed && (
          <div className="mb-4 px-2">
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-slate-400 capitalize">{user.role.replace('_', ' ')}</p>
          </div>
        )}
        <Button
          variant="ghost"
          className={cn(
            'w-full text-slate-400 hover:text-white hover:bg-slate-800',
            isCollapsed && 'px-2'
          )}
          onClick={logout}
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span className="ml-2">Logout</span>}
        </Button>
      </div>
    </div>
  );
}

interface NavItemComponentProps {
  item: NavItem;
  isCollapsed: boolean;
  isActive: boolean;
  activeChild: string;
  onClick: (id: string) => void;
  level?: number;
}

function NavItemComponent({ item, isCollapsed, isActive, activeChild, onClick, level = 0 }: NavItemComponentProps) {
  const [isExpanded, setIsExpanded] = React.useState(isActive);
  const Icon = item.icon;

  const hasChildren = item.children && item.children.length > 0;

  const handleClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    } else {
      onClick(item.id);
    }
  };

  const handleChildClick = (childId: string) => {
    onClick(childId);
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white',
          isCollapsed && 'justify-center px-2'
        )}
        style={{ paddingLeft: isCollapsed ? undefined : `${12 + level * 12}px` }}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        {!isCollapsed && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge && (
              <Badge variant="destructive" className="text-xs">
                {item.badge}
              </Badge>
            )}
            {hasChildren && (
              <ChevronRight
                className={cn(
                  'w-4 h-4 transition-transform',
                  isExpanded && 'rotate-90'
                )}
              />
            )}
          </>
        )}
      </button>

      {/* Child Items */}
      {!isCollapsed && hasChildren && isExpanded && (
        <div className="mt-1 ml-4 space-y-1 border-l border-slate-700">
          {item.children!.map((child) => (
            <button
              key={child.id}
              onClick={() => handleChildClick(child.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                activeChild === child.id
                  ? 'bg-blue-600/50 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <child.icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">{child.label}</span>
              {child.badge && (
                <Badge variant="destructive" className="text-xs">
                  {child.badge}
                </Badge>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
