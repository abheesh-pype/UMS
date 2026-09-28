import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { PrismaLayout } from '@/components/layout/PrismaLayout';
import { DataGrid } from '@/components/ui/data-grid';
import PublicRegisterPage from '@/pages/PublicRegisterPage';
import { getOpsNavItems } from '@/pages/ModernOpsDashboard';
import { getHRNavItems } from '@/pages/ModernHRDashboard';
import { getFinanceNavItems } from '@/pages/ModernFinanceDashboard';
import { getSalesNavItems } from '@/pages/ModernSalesDashboard';
import { getBranchManagerNavItems } from '@/pages/ModernBranchManagerDashboard';
import api from '@/lib/api';
import { toast } from 'sonner';

type ViewMode = 'dashboard' | 'table';

// Basic employee nav items (non-sub-dept-manager employees)
const EMPLOYEE_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'tasks', label: 'My Tasks' },
  { id: 'leaves', label: 'My Leaves' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'holidays', label: 'Holiday List' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'notice-board', label: 'Notice Board' },
  { id: 'team', label: 'My Team' },
  { id: 'ld-portal', label: 'L&D Portal' },
];

// Maps sidebar table IDs to the dashboard tab they should open
const TABLE_TO_TAB: Record<string, string> = {
  // Superadmin
  organizations: 'organizations',
  licenses: 'licenses',
  // Org Admin
  hierarchy: 'hierarchy',
  branches: 'branches',
  // Shared
  users: 'users',
  departments: 'departments',
  tasks: 'tasks',
  // HR
  employees: 'employees',
  vacancies: 'vacancies',
  leave_requests: 'leaves',
  attendance: 'attendance',
  holidays: 'holidays',
  complaints: 'complaints',
  // Finance
  invoices: 'invoices',
  payments: 'payments',
  university_fees: 'university_fees',
  expenses: 'expenses',
  targets: 'targets',
  fee_structures: 'fees',
  payroll: 'payroll',
  payroll_batches: 'payroll-batches',
  auth_fees: 'auth_fees',
  pending_payment: 'pending_payment',
  program_fees: 'program_fees',
  wallet_topups: 'wallet_topups',
  enrollments_finance: 'enrollments_finance',
  // Operations / shared
  students: 'students',
  universities: 'universities',
  programs: 'programs',
  study_centers: 'centers',
  admission_sessions: 'admission_sessions',
  internal_marks: 'marks',
  announcements: 'announcements',
  pending_verification: 'pending_verification',
  'kpi-kra': 'kpi-kra',
  activity_report: 'activity_report',
  program_allocations: 'program_allocations',
  enrollment_review: 'enrollment_review',
  // Sales
  leads: 'leads',
  invite_links: 'invite_links',
  sub_departments: 'subdepartments',
  // CEO
  performance: 'performance',
  center_onboarding: 'center_onboarding',
  // Center Admin
  center_wallet: 'wallet',
  enroll_student: 'enroll',
  center_enrollments: 'enrollments',
  center_programs: 'programs',
  center_rereg_report: 'rereg-report',
  // Employee
  notice_board: 'notice-board',
  ld_portal: 'ld-portal',
  payslips: 'payslips',
  my_team: 'team',
  // Common
  escalations: 'escalations',
  audit_logs: 'overview',
  center_admissions: 'center_admissions',
};

function App() {
  const { user, logout } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);

  // Set default table based on user role
  const getDefaultTable = (role?: string) => {
    switch (role) {
      case 'superadmin': return 'overview';
      case 'ceo': return 'dashboard';
      case 'ops_admin':
      case 'ops_sub_admin':
      case 'finance_admin':
      case 'hr_admin':
      case 'sales_admin': return 'overview';
      case 'academic_admin': return 'dashboard';
      default: return 'tasks';
    }
  };
  
  const [activeTable, setActiveTable] = useState(() => getDefaultTable(user?.role));
  const [tableData, setTableData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // For employee sub-dept managers: track their department type to show correct nav
  const [deptType, setDeptType] = useState<string | null>(null);

  // When user loads/changes, reset activeTable to the correct default
  useEffect(() => {
    if (user?.role) {
      setActiveTable(getDefaultTable(user.role));
      setActiveTab(undefined);
      setViewMode('dashboard');
      setDeptType(null);
    }
  }, [user?.role]);

  // Fetch department type for employee sub-dept managers (mirrors Dashboard.tsx logic)
  useEffect(() => {
    if (user?.role !== 'employee') return;
    const subDeptId = (user as any)?.subDepartmentId;
    if (!(user as any)?.departmentId && !subDeptId) return;

    const fetchDeptType = async () => {
      try {
        // Try direct department object or departmentId first
        const dept: any = (user as any)?.department || (user as any)?.departmentId;
        if (dept) {
          if (typeof dept === 'object' && dept?.type) {
            setDeptType(dept.type);
            return;
          }
          const deptId = typeof dept === 'object'
            ? dept.id?.toString()
            : dept.toString();
          if (deptId) {
            const res = await api.get(`/departments/${deptId}`);
            if (res.data.data?.type) { setDeptType(res.data.data.type); return; }
          }
        }
        // Fall back to sub-department's parentDeptId
        const subDept: any = typeof subDeptId === 'object' ? subDeptId : null;
        const parentDeptId = subDept?.parentDeptId;
        if (parentDeptId) {
          if (typeof parentDeptId === 'object' && parentDeptId.type) {
            setDeptType(parentDeptId.type);
            return;
          }
          const pid = typeof parentDeptId === 'object' ? parentDeptId.id?.toString() : parentDeptId?.toString();
          if (pid) {
            const res = await api.get(`/departments/${pid}`);
            if (res.data.data?.type) { setDeptType(res.data.data.type); return; }
          }
        }
        // Last resort: fetch from /sub-departments/my
        try {
          const res = await api.get('/sub-departments/my');
          const parentType = res.data.data?.subDepartment?.parentDeptId?.type;
          if (parentType) { setDeptType(parentType); return; }
        } catch (_ignored) { /* intentionally silent */ }
      } catch (err) {
      }
    };

    fetchDeptType();
  }, [user?.role, (user as any)?.subDepartmentId, (user as any)?.departmentId, (user as any)?.department]);

  // Public register page — show when on /register path OR has ?token= param (no-router SPA)
  // Only intercept if user is not logged in, to avoid breaking logged-in users with token params
  const urlParams = new URLSearchParams(window.location.search);
  const hasInviteToken = urlParams.has('token');
  const isRegisterPage = window.location.pathname === '/register' || (hasInviteToken && !user);

  // Define available tables based on user role
  const getAvailableTables = () => {
    if (!user) return [];
    
    const baseTables = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'users', label: 'Users' },
      { id: 'tasks', label: 'Tasks' },
      { id: 'departments', label: 'Departments' },
    ];

    if (user.role === 'superadmin') {
      return [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'organizations', label: 'Universities' },
        { id: 'licenses', label: 'Licenses' },
        { id: 'users', label: 'Users' },
        { id: 'departments', label: 'Departments' },
        { id: 'audit_logs', label: 'Audit Logs' },
      ];
    }

    if (user.role === 'ceo') {
      return [
        { id: 'dashboard', label: 'Overview' },
        { id: 'performance', label: 'Performance' },
        { id: 'kpi-kra', label: 'KPI / KRA' },
        { id: 'users', label: 'Users' },
        { id: 'departments', label: 'Departments' },
        { id: 'tasks', label: 'Tasks' },
        { id: 'escalations', label: 'Escalations' },
        { id: 'students', label: 'Students' },
        { id: 'invoices', label: 'Invoices' },
        { id: 'leads', label: 'Leads' },
        { id: 'center_onboarding', label: 'Centers & Enrollment' },
        { id: 'activity_report', label: 'Activity Report' },
      ];
    }

    if (user.role === 'org_admin') {
      return [
        { id: 'dashboard', label: 'Overview' },
        { id: 'hierarchy', label: 'Hierarchy' },
        { id: 'branches', label: 'Branches' },
        { id: 'users', label: 'Users' },
        { id: 'departments', label: 'Departments' },
        { id: 'sub_departments', label: 'Sub-Departments' },
        { id: 'tasks', label: 'Tasks' },
        { id: 'students', label: 'Students' },
        { id: 'universities', label: 'Universities' },
        { id: 'programs', label: 'Programs' },
        { id: 'study_centers', label: 'Study Centers' },
        { id: 'center_admissions', label: 'Centers Admissions' },
        { id: 'invoices', label: 'Invoices' },
        { id: 'payments', label: 'Payments' },
        { id: 'expenses', label: 'Expenses' },
        { id: 'employees', label: 'Employees' },
        { id: 'leave_requests', label: 'Leave Requests' },
        { id: 'leads', label: 'Leads' },
      ];
    }

    // Branch manager — takes priority over role-specific nav
    if ((user as any)?.branchId) {
      return getBranchManagerNavItems();
    }

    if (user.role === 'ops_admin' || user.role === 'ops_sub_admin') {
      const isSubDeptManager = Boolean((user as any)?.subDepartmentId);
      const items = getOpsNavItems(isSubDeptManager);
      return [...items, { id: 'center_admissions', label: 'Centers Admissions' }];
    }

    if (user.role === 'finance_admin') {
      return getFinanceNavItems();
    }

    if (user.role === 'hr_admin') {
      return getHRNavItems();
    }

    if (user.role === 'sales_admin') {
      const items = getSalesNavItems();
      return [...items, { id: 'center_admissions', label: 'Centers Admissions' }];
    }

    if (user.role === 'center_admin') {
      return [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'center_wallet', label: 'Wallet' },
        { id: 'enroll_student', label: 'Enroll Student' },
        { id: 'center_enrollments', label: 'My Enrollments' },
        { id: 'students', label: 'Students' },
        { id: 'center_rereg_report', label: 'Re-Registration Report' },
        { id: 'center_programs', label: 'Programs & Materials' },
        { id: 'tasks', label: 'Tasks' },
      ];
    }

    if (user.role === 'academic_admin') {
      return [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'academic-session', label: 'Academic Session' },
        { id: 'academic-programs', label: 'Programs' },
        { id: 'academic-semesters', label: 'Semester' },
        { id: 'academic-modules', label: 'Modules' },
        { id: 'academic-calendar', label: 'Academic Calendar' },
        {
          id: 'academic-examination',
          label: 'Examination',
          children: [
            { id: 'academic-examination-create', label: 'Create Examination' },
            { id: 'academic-examination-scheduled', label: 'Scheduled Exam' },
            { id: 'academic-examination-manage', label: 'Manage Examination' },
          ],
        },
        { id: 'academic-examination-registered', label: 'Registered Students' },
        { id: 'academic-examination-portal', label: 'Examination Portal' },
      ];
    }

    if (user.role === 'employee') {
      const isSubDeptManager = Boolean((user as any)?.subDepartmentId);
      if (deptType) {
        if (isSubDeptManager) {
          switch (deptType) {
            case 'operations': return getOpsNavItems(true);
            case 'hr': return getHRNavItems();
            case 'finance': return getFinanceNavItems();
            case 'sales': return getSalesNavItems();
          }
        } else if (deptType === 'sales') {
          return getSalesNavItems();
        } else if (deptType === 'operations') {
          return getOpsNavItems(false);
        } else if (deptType === 'hr') {
          return getHRNavItems();
        } else if (deptType === 'finance') {
          return getFinanceNavItems();
        }
      }
      return EMPLOYEE_NAV_ITEMS;
    }

    return baseTables;
  };

  const tables = useMemo(() => isRegisterPage ? [] : getAvailableTables(), [isRegisterPage, user?.role, (user as any)?.subDepartmentId, (user as any)?.branchId, deptType]);

  // Fetch data for active table — only when in table view mode
  useEffect(() => {
    if (!isRegisterPage && user && activeTable !== 'dashboard' && viewMode === 'table') {
      fetchTableData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRegisterPage, activeTable, user, viewMode]);

  // Public register page early return — must be AFTER all hooks
  if (isRegisterPage) {
    return <PublicRegisterPage />;
  }


  const handleTableChange = (table: string) => {
    // Section headers are non-clickable
    if (table.startsWith('__')) return;

    if (table === 'dashboard') {
      setViewMode('dashboard');
      setActiveTable('dashboard');
      setActiveTab(undefined);
      return;
    }

    // For role-specific dashboards (ops, hr, finance, sales), the nav item IDs
    // are already the correct tab IDs — pass them directly
    if (table === 'study-centre-customisation') {
      setViewMode('dashboard');
      setActiveTable(table);
      setActiveTab(table);
      return;
    }

    const roleDashboardRoles = ['ops_admin', 'ops_sub_admin', 'finance_admin', 'hr_admin', 'sales_admin', 'academic_admin'];
    const isEmployeeSubDeptManager = user?.role === 'employee' && Boolean((user as any)?.subDepartmentId) && Boolean(deptType);
    const isEmployeeRole = user?.role === 'employee';
    const isBranchManager = Boolean((user as any)?.branchId);
    if (user && (roleDashboardRoles.includes(user.role) || isEmployeeSubDeptManager || isEmployeeRole || isBranchManager)) {
      setViewMode('dashboard');
      setActiveTable(table);
      setActiveTab(table);
      return;
    }

    // For other roles, use the TABLE_TO_TAB mapping
    const tab = TABLE_TO_TAB[table];
    if (tab) {
      setViewMode('dashboard');
      setActiveTable(table);
      setActiveTab(tab);
    } else {
      // Fallback to table view for unmapped items
      setViewMode('table');
      setActiveTable(table);
      setActiveTab(undefined);
    }
  };

  const fetchTableData = async () => {
    setLoading(true);
    try {
      let response;
      
      switch (activeTable) {
        case 'users':
          response = await api.get('/users');
          break;
        case 'tasks':
          response = await api.get('/tasks');
          break;
        case 'departments':
          response = await api.get('/departments');
          break;
        case 'organizations':
          response = await api.get('/organizations');
          break;
        case 'licenses':
          response = await api.get('/licenses');
          break;
        case 'students':
          response = await api.get('/students');
          break;
        case 'universities':
          response = await api.get('/operations/universities');
          break;
        case 'programs':
          response = await api.get('/operations/programs');
          break;
        case 'study_centers':
          response = await api.get('/operations/centers');
          break;
        case 'admission_sessions':
          response = await api.get('/operations/sessions');
          break;
        case 'internal_marks':
          response = await api.get('/operations/marks');
          break;
        case 'invoices':
          response = await api.get('/finance/invoices');
          break;
        case 'payments':
          response = await api.get('/finance/payments');
          break;
        case 'expenses':
          response = await api.get('/finance/expenses');
          break;
        case 'targets':
          response = await api.get('/finance/targets');
          break;
        case 'fee_structures':
          response = await api.get('/finance/fees');
          break;
        case 'employees':
          response = await api.get('/users?role=employee');
          break;
        case 'vacancies':
          response = await api.get('/hr/vacancies');
          break;
        case 'leave_requests':
          response = await api.get('/hr/leaves');
          break;
        case 'attendance':
          response = await api.get('/hr/attendance');
          break;
        case 'holidays':
          response = await api.get('/hr/holidays');
          break;
        case 'complaints':
          response = await api.get('/hr/complaints');
          break;
        case 'leads':
          response = await api.get('/sales/leads');
          break;
        case 'escalations':
          response = await api.get('/escalations');
          break;
        case 'announcements':
          response = await api.get('/operations/announcements');
          break;
        case 'audit_logs':
          response = await api.get('/users'); // Placeholder
          break;
        case 'payroll':
          response = await api.get('/payroll');
          break;
        case 'payroll_batches':
          response = await api.get('/payroll/batches');
          break;
        default:
          response = { data: { data: [] } };
      }
      
      
      // Transform data for better display
      let data = response.data.data || [];
      
      // For users table, combine firstName and lastName and format role
      if (activeTable === 'users') {
        data = data.map((user: any) => ({
          ...user,
          name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A',
          role: user.role ? user.role.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'N/A',
          department: typeof user.departmentId === 'object' && user.departmentId?.name 
            ? user.departmentId.name 
            : (user.departmentId || 'N/A'),
          status: user.status || 'active',
        }));
      }
      
      setTableData(data);
    } catch (error: any) {
      if (error.response?.status === 403) {
        toast.error('You do not have permission to access this data');
        setTableData([]);
      } else if (error.response?.status === 404) {
        toast.error('This feature is not yet available');
        setTableData([]);
      } else {
        toast.error(error.response?.data?.message || 'Failed to fetch data');
        setTableData([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Get columns for active table
  const getColumns = () => {
    const columnMap: Record<string, any[]> = {
      users: [
        { key: 'userId', label: 'id', type: 'text', required: true },
        { key: 'name', label: 'name', type: 'text' },
        { key: 'email', label: 'email', type: 'text', required: true },
        { key: 'role', label: 'role', type: 'text' },
        { key: 'department', label: 'department', type: 'text' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
        { key: 'id', label: 'id', type: 'id' },
      ],
      tasks: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'title', label: 'title', type: 'text', required: true },
        { key: 'description', label: 'description', type: 'text' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'priority', label: 'priority', type: 'text' },
        { key: 'dueDate', label: 'dueDate', type: 'date' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      departments: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'name', label: 'name', type: 'text', required: true },
        { key: 'type', label: 'type', type: 'text' },
        { key: 'organizationId', label: 'organizationId', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      organizations: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'name', label: 'name', type: 'text', required: true },
        { key: 'email', label: 'email', type: 'text' },
        { key: 'phone', label: 'phone', type: 'text' },
        { key: 'licenseId', label: 'licenseId', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      licenses: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'name', label: 'name', type: 'text', required: true },
        { key: 'type', label: 'type', type: 'text' },
        { key: 'maxUsers', label: 'maxUsers', type: 'number' },
        { key: 'price', label: 'price', type: 'number' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      students: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'firstName', label: 'firstName', type: 'text' },
        { key: 'lastName', label: 'lastName', type: 'text' },
        { key: 'email', label: 'email', type: 'text' },
        { key: 'enrollmentNo', label: 'enrollmentNo', type: 'text' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      invoices: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'invoiceNo', label: 'invoiceNo', type: 'text' },
        { key: 'amount', label: 'amount', type: 'number' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'dueDate', label: 'dueDate', type: 'date' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      leads: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'name', label: 'name', type: 'text' },
        { key: 'email', label: 'email', type: 'text' },
        { key: 'phone', label: 'phone', type: 'text' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'source', label: 'source', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      universities: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'name', label: 'name', type: 'text', required: true },
        { key: 'code', label: 'code', type: 'text' },
        { key: 'type', label: 'type', type: 'text' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      programs: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'name', label: 'name', type: 'text', required: true },
        { key: 'code', label: 'code', type: 'text' },
        { key: 'duration', label: 'duration', type: 'text' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      study_centers: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'name', label: 'name', type: 'text', required: true },
        { key: 'code', label: 'code', type: 'text' },
        { key: 'city', label: 'city', type: 'text' },
        { key: 'state', label: 'state', type: 'text' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      admission_sessions: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'sessionName', label: 'sessionName', type: 'text' },
        { key: 'startDate', label: 'startDate', type: 'date' },
        { key: 'endDate', label: 'endDate', type: 'date' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      internal_marks: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'studentId', label: 'studentId', type: 'text' },
        { key: 'subject', label: 'subject', type: 'text' },
        { key: 'marks', label: 'marks', type: 'number' },
        { key: 'maxMarks', label: 'maxMarks', type: 'number' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      announcements: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'title', label: 'title', type: 'text', required: true },
        { key: 'message', label: 'message', type: 'text' },
        { key: 'type', label: 'type', type: 'text' },
        { key: 'priority', label: 'priority', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      payments: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'paymentNo', label: 'paymentNo', type: 'text' },
        { key: 'amount', label: 'amount', type: 'number' },
        { key: 'method', label: 'method', type: 'text' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      expenses: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'description', label: 'description', type: 'text' },
        { key: 'amount', label: 'amount', type: 'number' },
        { key: 'category', label: 'category', type: 'text' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      targets: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'name', label: 'name', type: 'text' },
        { key: 'targetValue', label: 'targetValue', type: 'number' },
        { key: 'achievedValue', label: 'achievedValue', type: 'number' },
        { key: 'period', label: 'period', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      fee_structures: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'name', label: 'name', type: 'text' },
        { key: 'amount', label: 'amount', type: 'number' },
        { key: 'type', label: 'type', type: 'text' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      employees: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'userId', label: 'userId', type: 'text' },
        { key: 'name', label: 'name', type: 'text' },
        { key: 'email', label: 'email', type: 'text' },
        { key: 'designation', label: 'designation', type: 'text' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      vacancies: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'title', label: 'title', type: 'text', required: true },
        { key: 'department', label: 'department', type: 'text' },
        { key: 'positions', label: 'positions', type: 'number' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      leave_requests: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'userId', label: 'userId', type: 'text' },
        { key: 'leaveType', label: 'leaveType', type: 'text' },
        { key: 'startDate', label: 'startDate', type: 'date' },
        { key: 'endDate', label: 'endDate', type: 'date' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      attendance: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'userId', label: 'userId', type: 'text' },
        { key: 'date', label: 'date', type: 'date' },
        { key: 'checkIn', label: 'checkIn', type: 'text' },
        { key: 'checkOut', label: 'checkOut', type: 'text' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      holidays: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'name', label: 'name', type: 'text', required: true },
        { key: 'date', label: 'date', type: 'date' },
        { key: 'type', label: 'type', type: 'text' },
        { key: 'description', label: 'description', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      complaints: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'title', label: 'title', type: 'text', required: true },
        { key: 'description', label: 'description', type: 'text' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'priority', label: 'priority', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      escalations: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'title', label: 'title', type: 'text', required: true },
        { key: 'description', label: 'description', type: 'text' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'priority', label: 'priority', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      payroll: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'employeeId', label: 'employeeId', type: 'text' },
        { key: 'month', label: 'month', type: 'text' },
        { key: 'year', label: 'year', type: 'number' },
        { key: 'basicSalary', label: 'basicSalary', type: 'number' },
        { key: 'netSalary', label: 'netSalary', type: 'number' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
      payroll_batches: [
        { key: 'id', label: 'id', type: 'id', required: true },
        { key: 'batchNumber', label: 'batchNumber', type: 'text' },
        { key: 'month', label: 'month', type: 'text' },
        { key: 'year', label: 'year', type: 'number' },
        { key: 'totalAmount', label: 'totalAmount', type: 'number' },
        { key: 'status', label: 'status', type: 'text' },
        { key: 'createdAt', label: 'createdAt', type: 'date' },
      ],
    };

    return columnMap[activeTable] || [
      { key: 'id', label: 'id', type: 'id', required: true },
      { key: 'name', label: 'name', type: 'text' },
      { key: 'createdAt', label: 'createdAt', type: 'date' },
    ];
  };

  const handleEdit = (_id: string, _data: any) => {
    toast.info('Edit functionality coming soon');
  };

  const handleDelete = async (_id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    
    try {
      // Implement delete based on table
      toast.success('Record deleted successfully');
      fetchTableData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete record');
    }
  };

  // Redirect to login if not authenticated
  if (!user) {
    return <Login />;
  }

  // For employees with department or sub-department assignments, route to department dashboard
  // Branch managers are excluded — they always get the branch dashboard
  const shouldUseDepartmentDashboard = Boolean(
    user.role === 'employee' &&
    !(user as any)?.branchId &&
    ((user as any)?.departmentId || (user as any)?.subDepartmentId) &&
    viewMode === 'dashboard'
  );

  return (
    <PrismaLayout
      tables={tables}
      activeTable={activeTable}
      onTableChange={handleTableChange}
      onLogout={logout}
      userName={user?.name}
      userRole={user?.role}
      userDesignation={user?.designation}
      userId={user?.id?.toString()}
      organizationId={
        (() => {
          const orgId: any = (user as any)?.organizationId;
          if (!orgId) return undefined;
          if (typeof orgId === 'object') return orgId.id?.toString() || String(orgId);
          return String(orgId);
        })()
      }
      schema="public"
    >
      {viewMode === 'dashboard' ? (
        <Dashboard 
          onNavigateToTable={handleTableChange} 
          useDepartmentDashboard={shouldUseDepartmentDashboard}
          initialTab={activeTab}
        />
      ) : (
        <DataGrid
          columns={getColumns()}
          data={tableData}
          onEdit={handleEdit}
          onDelete={handleDelete}
          loading={loading}
        />
      )}
    </PrismaLayout>
  );
}

export default App;
