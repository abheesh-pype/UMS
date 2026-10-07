import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User, UserRole } from '@/types/erp';
import api from '@/lib/api';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  hasPermission: (module: string, action: string) => boolean;
  switchRole: (role: UserRole) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Verify token and get user data
      api.get('/auth/me')
        .then(response => {
          if (response.data.success) {
            setUser(response.data.data);
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const response = await api.post('/auth/login', { email, password });

    if (response.data.success) {
      const { token, user: userData } = response.data.data;
      localStorage.setItem('token', token);
      setUser(userData);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  const hasRole = useCallback((roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  const hasPermission = useCallback((module: string, _action: string): boolean => {
    // Simplified permission check - in real app, would check user's permissions
    if (!user) return false;
    
    const rolePermissions: Record<UserRole, string[]> = {
      superadmin: ['all'],
      org_admin: ['organizations', 'departments', 'users', 'settings'],
      ceo: ['dashboard', 'reports', 'escalations', 'approvals', 'all_departments'],
      ops_admin: ['operations', 'universities', 'courses', 'centers', 'students', 'marks'],
      ops_sub_admin: ['operations', 'students', 'marks'],
      finance_admin: ['finance', 'invoices', 'payments', 'expenses', 'targets', 'approvals'],
      hr_admin: ['hr', 'employees', 'attendance', 'leave', 'recruitment', 'complaints'],
      sales_admin: ['sales', 'leads', 'deals', 'referrals', 'targets'],
      center_admin: ['center', 'students', 'invoices', 'marks'],
      employee: ['tasks', 'attendance', 'leave', 'profile'],
      staff: ['tasks', 'attendance', 'leave', 'profile'],
      bde: ['sales', 'leads', 'deals', 'tasks', 'attendance', 'leave', 'profile'],
    };

    const userPermissions = rolePermissions[user.role] || [];
    return userPermissions.includes('all') || userPermissions.includes(module);
  }, [user]);

  const switchRole = useCallback(async (role: UserRole) => {
    // In a real app, this would require re-authentication
    // For demo purposes, we'll just update the user object
    if (user) {
      setUser({ ...user, role });
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole, hasPermission, switchRole, loading }}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
