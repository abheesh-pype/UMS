import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { ModernCEODashboard } from './ModernCEODashboard';
import { ModernFinanceDashboard } from './ModernFinanceDashboard';
import { ModernOpsDashboard } from './ModernOpsDashboard';
import { ModernHRDashboard } from './ModernHRDashboard';
import { ModernSalesDashboard } from './ModernSalesDashboard';
import { ModernSuperadminDashboard } from './ModernSuperadminDashboard';
import { ModernOrgAdminDashboard } from './ModernOrgAdminDashboard';
import { ModernStudyCenterDashboard } from './ModernStudyCenterDashboard';
import { ModernEmployeeDashboard } from './ModernEmployeeDashboard';
import { ModernStaffPortal } from './ModernStaffPortal';
import { ModernBranchManagerDashboard } from './ModernBranchManagerDashboard';
import { CenterOnboardingGate } from '@/components/CenterOnboardingGate';
import { ModernStudentDashboard } from './ModernStudentDashboard';
import { AcademicAdminPanel } from './AcademicAdminPanel';

interface DashboardProps {
  onNavigateToTable?: (table: string) => void;
  useDepartmentDashboard?: boolean;
  initialTab?: string;
}

export function Dashboard({ useDepartmentDashboard, initialTab, onNavigateToTable }: DashboardProps) {
  const { user } = useAuth();
  const [departmentType, setDepartmentType] = useState<string | null>(null);
  const isBranchManager = Boolean((user as any)?.branchId);
  const [deptLoading, setDeptLoading] = useState(Boolean(useDepartmentDashboard) && !isBranchManager);

  const subDeptId = (user as any)?.subDepartmentId;
  const hasSubDept = Boolean(subDeptId);

  // fetchDepartmentType defined before useEffect so it can be in deps safely
  const fetchDepartmentType = async () => {
    try {
      // Try direct department object or departmentId first
      const dept = (user as any)?.department || (user as any)?.departmentId;
      if (dept) {
        if (typeof dept === 'object' && dept !== null) {
          const populated = dept;
          if (populated.type) { setDepartmentType(populated.type); return; }
          const deptId = populated.id?.toString();
          if (deptId) {
            const res = await api.get(`/departments/${deptId}`);
            setDepartmentType(res.data.data?.type || null);
            return;
          }
        } else {
          const deptId = dept.toString();
          if (deptId) {
            const res = await api.get(`/departments/${deptId}`);
            setDepartmentType(res.data.data?.type || null);
            return;
          }
        }
      }
      // Fall back to sub-department's parentDeptId
      if (hasSubDept) {
        const subDept = typeof subDeptId === 'object' ? subDeptId : null;
        const parentDeptId = (subDept as any)?.parentDeptId;
        if (parentDeptId) {
          if (typeof parentDeptId === 'object' && parentDeptId.type) {
            setDepartmentType(parentDeptId.type);
            return;
          }
          const pid = typeof parentDeptId === 'object' ? parentDeptId.id?.toString() : parentDeptId?.toString();
          if (pid) {
            const res = await api.get(`/departments/${pid}`);
            setDepartmentType(res.data.data?.type || null);
            return;
          }
        }
        // If sub-dept has no parentDeptId info, fetch from /sub-departments/my
        try {
          const res = await api.get('/sub-departments/my');
          const parentType = res.data.data?.subDepartment?.parentDeptId?.type;
          if (parentType) { setDepartmentType(parentType); return; }
        } catch (_ignored) { /* intentionally silent */ }
      }
    } catch (error) {
      setDepartmentType(null);
    }
  };

  useEffect(() => {
    if (useDepartmentDashboard && (user?.departmentId || hasSubDept)) {
      setDeptLoading(true);
      fetchDepartmentType().finally(() => setDeptLoading(false));
    } else if (useDepartmentDashboard) {
      setDeptLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useDepartmentDashboard, user?.departmentId, hasSubDept]);

  // Branch managers always get the branch dashboard — skip all other routing
  if (isBranchManager) {
    return <ModernBranchManagerDashboard initialTab={initialTab} onNavigate={onNavigateToTable} />;
  }

  // While fetching department type, don't render anything yet to avoid flash
  if (useDepartmentDashboard && deptLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Route employees to department-specific dashboards
  if (useDepartmentDashboard) {
    const isSubDeptManager = hasSubDept;

    // If we have a department type, route accordingly
    if (departmentType) {
      // Regular employees (not sub-dept managers) always get the employee dashboard
      // Exception: Sales, Operations, HR, and Finance employees get their respective dashboards
      if (!isSubDeptManager && !['sales', 'operations', 'hr', 'finance'].includes(departmentType)) {
        return <ModernEmployeeDashboard initialTab={initialTab} onNavigate={onNavigateToTable} />;
      }
      // Sub-dept managers get the department admin dashboard
      switch (departmentType) {
        case 'hr':
          return <ModernHRDashboard initialTab={initialTab} onNavigate={onNavigateToTable} />;
        case 'finance':
          return <ModernFinanceDashboard initialTab={initialTab} onNavigate={onNavigateToTable} />;
        case 'operations':
          return <ModernOpsDashboard initialTab={initialTab} onNavigate={onNavigateToTable} />;
        case 'sales':
          return <ModernSalesDashboard initialTab={initialTab} onNavigate={onNavigateToTable} isSubDeptManager={isSubDeptManager} />;
        default:
          return <ModernEmployeeDashboard initialTab={initialTab} onNavigate={onNavigateToTable} />;
      }
    }

    // No department type found — sub-dept manager with unknown parent dept type
    // Show employee dashboard (it has a My Sub-Dept tab for sub-dept managers)
    return <ModernEmployeeDashboard initialTab={initialTab} onNavigate={onNavigateToTable} />;
  }

  if (user?.role === 'superadmin') {
    return <ModernSuperadminDashboard initialTab={initialTab} onNavigate={onNavigateToTable} />;
  }

  if (user?.role === 'ceo') {
    return <ModernCEODashboard initialTab={initialTab} onNavigate={onNavigateToTable} />;
  }

  if (user?.role === 'org_admin') {
    return <ModernOrgAdminDashboard initialTab={initialTab} onNavigate={onNavigateToTable} />;
  }

  if (user?.role === 'finance_admin') {
    return <ModernFinanceDashboard initialTab={initialTab} onNavigate={onNavigateToTable} />;
  }

  if (['ops_admin', 'ops_sub_admin'].includes(user?.role || '')) {
    return <ModernOpsDashboard initialTab={initialTab} onNavigate={onNavigateToTable} />;
  }

  if (user?.role === 'hr_admin') {
    return <ModernHRDashboard initialTab={initialTab} onNavigate={onNavigateToTable} />;
  }

  if (user?.role === 'sales_admin') {
    return <ModernSalesDashboard initialTab={initialTab} onNavigate={onNavigateToTable} />;
  }

  if (user?.role === 'center_admin') {
    return (
      <CenterOnboardingGate>
        <ModernStudyCenterDashboard initialTab={initialTab} onNavigate={onNavigateToTable} />
      </CenterOnboardingGate>
    );
  }

  if (user?.role === 'academic_admin') {
    return <AcademicAdminPanel initialTab={initialTab} onNavigate={onNavigateToTable} />;
  }

  if ((user as any)?.role === 'student') {
    return <ModernStudentDashboard initialTab={initialTab} />;
  }

  if (user?.role === 'employee') {
    return <ModernEmployeeDashboard initialTab={initialTab} onNavigate={onNavigateToTable} />;
  }

  // Fallback for other staff/admin roles
  return <ModernStaffPortal />;
}
