import { useState, useEffect } from 'react';
import { Plus, Edit, Key, Users, ArrowRightLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { toast } from 'sonner';

interface User {
  id?: string;
  name: string;
  email: string;
  role: string;
  designation?: string;
  departmentId?: string | { id: string };
  additionalDepartmentIds?: string[];
  subDepartmentId?: string | { id: string };
  reportingTo?: string | { id: string };
  department?: { name: string; id?: string };
  additionalDepartments?: { id: string; name: string }[];
  subDepartment?: { name: string; parentDept?: { id: string }; parentDeptId?: string };
  reportingToUser?: { name: string };
  manager?: { id: string; name: string; designation?: string };
  _count?: { subordinates?: number };
  status?: string;
}

interface Department {
  id?: string;
  name: string;
  type: string;
  managerId?: string;
  parentDepartmentId?: string;
}

interface SubDepartment {
  id?: string;
  name: string;
  parentDeptId: string;
}

interface DesignationOption {
  id: string;
  title: string;
  departmentId?: { id: string; name: string };
  maxHeadcount: number;
  filledBy: any[];
}

export function HRUsersPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [designations, setDesignations] = useState<DesignationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee',
    designation: '',
    departmentId: '',
    additionalDepartmentIds: [] as string[],
    subDepartmentId: '',
    reportingTo: '',
  });

  const [transferData, setTransferData] = useState({
    departmentId: '',
    subDepartmentId: '',
    role: '',
    reportingTo: '',
    pendingWorkAssigneeId: '',
    reason: '',
  });

  const [promotionData, setPromotionData] = useState({
    newDesignation: '',
    newRole: 'employee',
    departmentId: '',
    reportingTo: '',
    pendingWorkAssigneeId: '',
    reason: '',
    type: 'promotion' as 'promotion' | 'demotion',
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
    fetchSubDepartments();
    fetchDesignations();
  }, []);

  useEffect(() => {
    // Fetch sub-departments when department changes
    if (formData.departmentId) {
      fetchSubDepartmentsByParent(formData.departmentId);
    }
  }, [formData.departmentId]);

  useEffect(() => {
    // Fetch sub-departments when transfer department changes
    if (transferData.departmentId) {
      fetchSubDepartmentsByParent(transferData.departmentId);
    }
  }, [transferData.departmentId]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users');
      const allUsers = response.data.data || response.data || [];
      // Exclude top-level admin roles, centers and students — everyone else is headcount
      const staffUsers = allUsers.filter((user: User) =>
        !['ceo', 'org_admin', 'superadmin', 'center_admin', 'student'].includes(user.role)
      );
      setUsers(staffUsers);
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      setDepartments(response.data.data || response.data || []);
    } catch (_error) {
    }
  };

  const fetchSubDepartments = async () => {
    try {
      const response = await api.get('/sub-departments');
      setSubDepartments(response.data.data || response.data || []);
    } catch (_error) {
    }
  };

  const fetchDesignations = async () => {
    try {
      const response = await api.get('/org/designations');
      setDesignations(response.data.data || []);
    } catch (_error) {
      // Designations may not exist yet — that's fine
    }
  };

  const fetchSubDepartmentsByParent = async (parentId: string) => {
    try {
      const response = await api.get(`/sub-departments?parentDeptId=${parentId}`);
      setSubDepartments(response.data.data || response.data || []);
    } catch (_error) {
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const additionalDepts = formData.additionalDepartmentIds.filter(id => id && id !== formData.departmentId);
      if (editingUser) {
        const userId = editingUser.id || editingUser.id;
        await api.put(`/users/${userId}`, {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          designation: formData.designation || undefined,
          departmentId: formData.departmentId && formData.departmentId !== 'none' ? formData.departmentId : null,
          additionalDepartmentIds: additionalDepts,
          subDepartmentId: formData.subDepartmentId && formData.subDepartmentId !== 'none' ? formData.subDepartmentId : null,
          reportingTo: formData.reportingTo && formData.reportingTo !== 'none' ? formData.reportingTo : null,
        });
      } else {
        await api.post('/users', {
          ...formData,
          additionalDepartmentIds: additionalDepts,
          departmentId: (formData.departmentId && formData.departmentId !== 'none') ? formData.departmentId : undefined,
          subDepartmentId: (formData.subDepartmentId && formData.subDepartmentId !== 'none') ? formData.subDepartmentId : undefined,
          reportingTo: (formData.reportingTo && formData.reportingTo !== 'none') ? formData.reportingTo : undefined,
        });
      }
      setDialogOpen(false);
      resetForm();
      await fetchUsers();
    } catch (_error) {
      toast.error('Failed to save user. Please try again.');
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) return;

    try {
      const userId = selectedUser.id || selectedUser.id;
      const response = await api.put(`/users/${userId}/transfer`, {
        departmentId: transferData.departmentId,
        subDepartmentId: transferData.subDepartmentId && transferData.subDepartmentId !== 'none' ? transferData.subDepartmentId : null,
        role: transferData.role,
        reportingTo: transferData.reportingTo,
        pendingWorkAssigneeId: transferData.pendingWorkAssigneeId || undefined,
        reason: transferData.reason,
      });
      
      setTransferDialogOpen(false);
      setTransferData({ departmentId: '', subDepartmentId: '', role: '', reportingTo: '', pendingWorkAssigneeId: '', reason: '' });
      setSelectedUser(null);
      await fetchUsers();
      const reassignedTaskCount = response.data?.data?.reassignedTaskCount ?? 0;
      toast.success('Employee transferred successfully', {
        description: `${selectedUser.name} was transferred. ${reassignedTaskCount} pending task${reassignedTaskCount === 1 ? '' : 's'} reassigned.`,
        duration: 5000,
      });
    } catch (error: any) {
      toast.error('Transfer failed', {
        description: error.response?.data?.message || 'Failed to transfer employee. Please try again.',
        duration: 6000,
      });
    }
  };

  const handlePromotionDemotion = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) return;

    try {
      const userId = selectedUser.id || selectedUser.id;
      const response = await api.put(`/users/${userId}/transfer`, {
        changeType: promotionData.type,
        designation: promotionData.newDesignation,
        role: promotionData.newRole,
        departmentId: promotionData.departmentId && promotionData.departmentId !== 'none' ? promotionData.departmentId : null,
        subDepartmentId: promotionData.departmentId === getUserDepartmentId(selectedUser) ? getUserSubDepartmentId(selectedUser) : null,
        reportingTo: promotionData.reportingTo,
        pendingWorkAssigneeId: promotionData.pendingWorkAssigneeId || undefined,
        reason: promotionData.reason,
      });
      
      setPromotionDialogOpen(false);
      setPromotionData({ newDesignation: '', newRole: 'employee', departmentId: '', reportingTo: '', pendingWorkAssigneeId: '', reason: '', type: 'promotion' });
      setSelectedUser(null);
      await fetchUsers();
      const reassignedTaskCount = response.data?.data?.reassignedTaskCount ?? 0;
      toast.success(`Employee ${promotionData.type === 'promotion' ? 'promoted' : 'demoted'} successfully`, {
        description: `${reassignedTaskCount} pending task${reassignedTaskCount === 1 ? '' : 's'} reassigned.`,
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || `Failed to ${promotionData.type} employee. Please try again.`);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords do not match!');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long!');
      return;
    }

    try {
      await api.put(`/users/${selectedUserId}`, {
        password: passwordData.newPassword,
      });
      setPasswordDialogOpen(false);
      setPasswordData({ newPassword: '', confirmPassword: '' });
      setSelectedUserId(null);
      setSelectedUser(null);
      await fetchUsers();
      toast.success('Password updated successfully!');
    } catch (_error) {
      toast.error('Failed to update password. Please try again.');
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    const deptId = typeof user.departmentId === 'object' && user.departmentId !== null
      ? user.departmentId.id
      : user.departmentId;
    const subDeptId = typeof user.subDepartmentId === 'object' && user.subDepartmentId !== null
      ? user.subDepartmentId.id
      : user.subDepartmentId;
    const reportingToId = typeof user.reportingTo === 'object' && user.reportingTo !== null
      ? user.reportingTo.id
      : user.reportingTo;
    const additionalIds = (user.additionalDepartments || []).map((d: any) =>
      typeof d === 'object' ? (d.id || d.id) : d
    ).filter(Boolean);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      designation: user.designation || '',
      departmentId: deptId?.toString() || '',
      additionalDepartmentIds: additionalIds,
      subDepartmentId: subDeptId?.toString() || '',
      reportingTo: reportingToId?.toString() || '',
    });
    setDialogOpen(true);
  };

  const openTransferDialog = (user: User) => {
    setSelectedUser(user);
    setTransferData({
      departmentId: getUserDepartmentId(user),
      subDepartmentId: getUserSubDepartmentId(user),
      role: user.role,
      reportingTo: '',
      pendingWorkAssigneeId: '',
      reason: '',
    });
    setTransferDialogOpen(true);
  };

  const openPromotionDialog = (user: User, type: 'promotion' | 'demotion') => {
    setSelectedUser(user);
    const reportingToId = typeof user.reportingTo === 'object' && user.reportingTo !== null
      ? user.reportingTo.id
      : user.reportingTo;
    setPromotionData({
      newDesignation: user.designation || '',
      newRole: user.role,
      departmentId: typeof user.departmentId === 'object' && user.departmentId !== null
        ? user.departmentId.id || ''
        : user.departmentId || '',
      reportingTo: reportingToId || '',
      pendingWorkAssigneeId: '',
      reason: '',
      type,
    });
    setPromotionDialogOpen(true);
  };

  const openPasswordDialog = (user: User) => {
    setSelectedUserId(user.id || '');
    setSelectedUser(user);
    setPasswordData({ newPassword: '', confirmPassword: '' });
    setPasswordDialogOpen(true);
  };

  const getUserDepartmentId = (user: User) =>
    typeof user.departmentId === 'object' && user.departmentId !== null
      ? user.departmentId.id || ''
      : user.departmentId || user.subDepartment?.parentDept?.id || user.subDepartment?.parentDeptId || '';

  const getUserSubDepartmentId = (user: User) =>
    typeof user.subDepartmentId === 'object' && user.subDepartmentId !== null
      ? user.subDepartmentId.id || ''
      : user.subDepartmentId || '';

  const managerRoles = [
    'superadmin', 'org_admin', 'ceo', 'university_admin', 'hr_admin',
    'finance_admin', 'ops_admin', 'ops_sub_admin', 'sales_admin', 'academic_admin',
  ];

  const isManager = (user: User) =>
    managerRoles.includes(user.role)
    || Boolean(user._count?.subordinates)
    || /manager|lead|head/i.test(user.designation || '');

  const usersInDepartment = (departmentId: string) => users.filter(user =>
    getUserDepartmentId(user) === departmentId && user.id !== selectedUser?.id
  );

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'employee',
      designation: '',
      departmentId: '',
      additionalDepartmentIds: [],
      subDepartmentId: '',
      reportingTo: '',
    });
    setEditingUser(null);
  };

  const getRoleBadgeColor = (role: string) => {
    const map: Record<string, string> = {
      employee: 'bg-blue-100 text-blue-800',
      staff: 'bg-green-100 text-green-800',
      hr_admin: 'bg-orange-100 text-orange-800',
      finance_admin: 'bg-emerald-100 text-emerald-800',
      ops_admin: 'bg-indigo-100 text-indigo-800',
      ops_sub_admin: 'bg-violet-100 text-violet-800',
      sales_admin: 'bg-pink-100 text-pink-800',
      center_admin: 'bg-cyan-100 text-cyan-800',
      bde: 'bg-yellow-100 text-yellow-800',
    };
    return map[role] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-muted-foreground">Loading users...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>User Management</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all staff accounts — HR, Finance, Ops, Sales, and Employees
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Employee User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Edit Employee User' : 'Create Employee User'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              {!editingUser && (
                <div>
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="designation">Designation</Label>
                {designations.length > 0 ? (
                  <Select
                    value={formData.designation}
                    onValueChange={(value) => {
                      // Auto-fill department if designation has one
                      const desig = designations.find(d => d.title === value);
                      setFormData({
                        ...formData,
                        designation: value,
                        departmentId: desig?.departmentId?.id || formData.departmentId,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select from org chart..." />
                    </SelectTrigger>
                    <SelectContent>
                      {designations.map(d => {
                        const filled = d.filledBy?.length || 0;
                        const vacant = d.maxHeadcount - filled;
                        return (
                          <SelectItem key={d.id} value={d.title} disabled={vacant <= 0}>
                            {d.title}
                            {d.departmentId ? ` — ${d.departmentId.name}` : ''}
                            {vacant <= 0 ? ' (Full)' : ` (${vacant} open)`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="designation"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g., Senior Manager, Team Lead"
                  />
                )}
                {designations.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Tip: Org Admin can define positions in the Hierarchy chart for structured assignment.
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="hr_admin">HR Admin</SelectItem>
                    <SelectItem value="finance_admin">Finance Admin</SelectItem>
                    <SelectItem value="ops_admin">Operations Admin</SelectItem>
                    <SelectItem value="ops_sub_admin">Ops Sub Admin</SelectItem>
                    <SelectItem value="sales_admin">Sales Admin</SelectItem>
                    <SelectItem value="bde">BDE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="department">Primary Department</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) => {
                    setFormData({ ...formData, departmentId: value, subDepartmentId: '' });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Department</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id || dept.id} value={(dept.id || dept.id)!}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Additional departments — for branch managers etc. */}
              <div>
                <Label>Additional Departments <span className="text-xs text-muted-foreground font-normal">(for branch managers with multi-dept access)</span></Label>
                <div className="mt-2 border rounded-lg p-3 space-y-2 max-h-36 overflow-y-auto bg-muted/30">
                  {departments
                    .filter(d => (d.id || d.id) !== formData.departmentId && (d.id || d.id) !== 'none')
                    .map(dept => {
                      const deptId = (dept.id || dept.id)!;
                      const checked = formData.additionalDepartmentIds.includes(deptId);
                      return (
                        <label key={deptId} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? formData.additionalDepartmentIds.filter(id => id !== deptId)
                                : [...formData.additionalDepartmentIds, deptId];
                              setFormData({ ...formData, additionalDepartmentIds: next });
                            }}
                            className="rounded"
                          />
                          {dept.name}
                          <span className="text-xs text-muted-foreground">({dept.type})</span>
                        </label>
                      );
                    })}
                  {departments.length === 0 && <p className="text-xs text-muted-foreground">No departments available</p>}
                </div>
              </div>
              {formData.departmentId && subDepartments.length > 0 && (
                <div>
                  <Label htmlFor="subDepartment">Sub-Department</Label>
                  <Select
                    value={formData.subDepartmentId}
                    onValueChange={(value) => setFormData({ ...formData, subDepartmentId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sub-department (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Sub-Department</SelectItem>
                      {subDepartments.map((subDept) => (
                        <SelectItem key={subDept.id || subDept.id} value={(subDept.id || subDept.id)!}>
                          {subDept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label htmlFor="reportingTo">Reports To</Label>
                <Select
                  value={formData.reportingTo}
                  onValueChange={(value) => setFormData({ ...formData, reportingTo: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reporting manager (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Manager</SelectItem>
                    {users.filter(u => (u.id || u.id) !== (editingUser?.id || editingUser?.id)).map((user) => (
                      <SelectItem key={user.id || user.id} value={(user.id || user.id)!}>
                        {user.name} {user.designation ? `(${user.designation})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingUser ? 'Update' : 'Create'} User
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No users found</p>
            <p className="text-sm">Create your first user to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {users.map((user) => {
              const userId = user.id || user.id || '';
              return (
                <div
                  key={userId}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{user.name}</h3>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {user.role}
                      </Badge>
                      {user.status === 'inactive' && (
                        <Badge variant="outline" className="bg-red-50 text-red-700">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
                    {user.designation && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Designation: {user.designation}
                      </p>
                    )}
                    {user.department && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Department: {user.department.name}
                        {user.subDepartment && ` → ${user.subDepartment.name}`}
                      </p>
                    )}
                    {user.additionalDepartments && user.additionalDepartments.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Also: {user.additionalDepartments.map((d: any) => d.name || d).join(', ')}
                      </p>
                    )}
                    {user.reportingToUser && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Reports to: {user.reportingToUser.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openTransferDialog(user)}
                      title="Transfer Employee"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPromotionDialog(user, 'promotion')}
                      title="Promote Employee"
                    >
                      <TrendingUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPromotionDialog(user, 'demotion')}
                      title="Demote Employee"
                    >
                      <TrendingDown className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPasswordDialog(user)}
                      title="Change Password"
                    >
                      <Key className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(user)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={(open) => {
        setPasswordDialogOpen(open);
        if (!open) {
          setPasswordData({ newPassword: '', confirmPassword: '' });
          setSelectedUserId(null);
          setSelectedUser(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Password</DialogTitle>
            {selectedUser && <p className="text-sm text-muted-foreground">{selectedUser.name} · {selectedUser.email}</p>}
          </DialogHeader>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <PasswordInput
                id="newPassword"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                required
                minLength={6}
                placeholder="Minimum 6 characters"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <PasswordInput
                id="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                required
                minLength={6}
                placeholder="Re-enter password"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPasswordDialogOpen(false);
                  setPasswordData({ newPassword: '', confirmPassword: '' });
                  setSelectedUserId(null);
                  setSelectedUser(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Update Password</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transfer Employee Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="text-xl">Transfer Employee</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="mx-6 mt-5 rounded-lg border bg-muted/50 px-4 py-3">
              <p className="font-semibold leading-6">{selectedUser.name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Current: {selectedUser.department?.name || 'No Department'} · {selectedUser.role.replace(/_/g, ' ')}
              </p>
            </div>
          )}
          <form onSubmit={handleTransfer} className="space-y-6 px-6 py-5">
            <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transferDepartment">New Department</Label>
              <Select
                value={transferData.departmentId}
                onValueChange={(value) => {
                  setTransferData({ ...transferData, departmentId: value, subDepartmentId: '', reportingTo: '' });
                }}
                required
              >
                <SelectTrigger id="transferDepartment" className="w-full">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id || dept.id} value={(dept.id || dept.id)!}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transferRole">New Role</Label>
              <Select
                value={transferData.role}
                onValueChange={(value) => setTransferData({ ...transferData, role: value })}
                required
              >
                <SelectTrigger id="transferRole" className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="hr_admin">HR Admin</SelectItem>
                  <SelectItem value="finance_admin">Finance Admin</SelectItem>
                  <SelectItem value="ops_admin">Operations Admin</SelectItem>
                  <SelectItem value="ops_sub_admin">Ops Sub Admin</SelectItem>
                  <SelectItem value="sales_admin">Sales Admin</SelectItem>
                  <SelectItem value="academic_admin">Academic Admin</SelectItem>
                  <SelectItem value="bde">BDE</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Change the department, role, or both.</p>
            </div>
            {transferData.departmentId && subDepartments.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="transferSubDepartment">Sub-Department</Label>
                <Select
                  value={transferData.subDepartmentId}
                  onValueChange={(value) => setTransferData({ ...transferData, subDepartmentId: value })}
                >
                  <SelectTrigger id="transferSubDepartment" className="w-full">
                    <SelectValue placeholder="Select sub-department (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Sub-Department</SelectItem>
                    {subDepartments.map((subDept) => (
                      <SelectItem key={subDept.id || subDept.id} value={(subDept.id || subDept.id)!}>
                        {subDept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className={`space-y-2 ${subDepartments.length === 0 ? 'sm:col-span-2' : ''}`}>
              <Label htmlFor="transferReportingTo">Reports To After Transfer</Label>
              <Select
                value={transferData.reportingTo}
                onValueChange={(value) => setTransferData({ ...transferData, reportingTo: value })}
                required
              >
                <SelectTrigger id="transferReportingTo" className="w-full">
                  <SelectValue placeholder="Select a manager in the new department" />
                </SelectTrigger>
                <SelectContent>
                  {usersInDepartment(transferData.departmentId).filter(isManager).map(user => (
                    <SelectItem key={user.id} value={user.id!}>
                      {user.name} {user.designation ? `(${user.designation})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {usersInDepartment(transferData.departmentId).filter(isManager).length === 0 && (
                <p className="text-xs text-destructive">No eligible manager is assigned to this department.</p>
              )}
            </div>
            </div>
            {selectedUser && isManager(selectedUser) ? (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                <Label htmlFor="pendingWorkAssignee">Pending Work Handoff</Label>
                <Select
                  value={transferData.pendingWorkAssigneeId}
                  onValueChange={(value) => setTransferData({ ...transferData, pendingWorkAssigneeId: value })}
                >
                  <SelectTrigger id="pendingWorkAssignee" className="w-full bg-background">
                    <SelectValue placeholder="Select another manager in the current department" />
                  </SelectTrigger>
                  <SelectContent>
                    {usersInDepartment(getUserDepartmentId(selectedUser)).filter(isManager).map(user => (
                      <SelectItem key={user.id} value={user.id!}>
                        {user.name} {user.designation ? `(${user.designation})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs leading-5 text-muted-foreground">
                  All unfinished tasks will move to this manager, who can reassign them later.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
                Unfinished tasks will be reassigned to the employee&apos;s current reporting manager
                {selectedUser?.manager?.name ? ` (${selectedUser.manager.name})` : ''}.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="transferReason">Reason for Transfer</Label>
              <Input
                id="transferReason"
                value={transferData.reason}
                onChange={(e) => setTransferData({ ...transferData, reason: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTransferDialogOpen(false);
                  setTransferData({ departmentId: '', subDepartmentId: '', role: '', reportingTo: '', pendingWorkAssigneeId: '', reason: '' });
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="sm:min-w-40"
                disabled={
                  !transferData.departmentId
                  || !transferData.role
                  || !transferData.reportingTo
                  || (Boolean(selectedUser && isManager(selectedUser)) && !transferData.pendingWorkAssigneeId)
                }
              >
                Transfer Employee
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Promotion/Demotion Dialog */}
      <Dialog open={promotionDialogOpen} onOpenChange={setPromotionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {promotionData.type === 'promotion' ? 'Promote' : 'Demote'} Employee
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <p className="font-semibold">{selectedUser.name}</p>
              <p className="text-sm text-muted-foreground">
                Current: {selectedUser.designation || 'No Designation'} ({selectedUser.role})
              </p>
            </div>
          )}
          <form onSubmit={handlePromotionDemotion} className="space-y-4">
            <div>
              <Label htmlFor="newDesignation">New Designation</Label>
              {designations.length > 0 ? (
                <Select
                  value={promotionData.newDesignation}
                  onValueChange={(value) => {
                    const designation = designations.find(item => item.title === value);
                    const nextDepartmentId = designation?.departmentId?.id || promotionData.departmentId;
                    setPromotionData({
                      ...promotionData,
                      newDesignation: value,
                      departmentId: nextDepartmentId,
                      reportingTo: nextDepartmentId !== promotionData.departmentId ? '' : promotionData.reportingTo,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select from org chart..." />
                  </SelectTrigger>
                  <SelectContent>
                    {designations.map(d => {
                      const filled = d.filledBy?.length || 0;
                      const vacant = d.maxHeadcount - filled;
                      return (
                        <SelectItem key={d.id} value={d.title}>
                          {d.title}
                          {d.departmentId ? ` — ${d.departmentId.name}` : ''}
                          {vacant <= 0 ? ' (Full)' : ` (${vacant} open)`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="newDesignation"
                  value={promotionData.newDesignation}
                  onChange={(e) => setPromotionData({ ...promotionData, newDesignation: e.target.value })}
                  required
                  placeholder="e.g., Senior Manager, Team Lead"
                />
              )}
            </div>
            <div>
              <Label htmlFor="promotionDepartment">Department</Label>
              <Select
                value={promotionData.departmentId}
                onValueChange={(value) => setPromotionData({ ...promotionData, departmentId: value, reportingTo: '' })}
              >
                <SelectTrigger id="promotionDepartment">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department</SelectItem>
                  {departments.map(department => (
                    <SelectItem key={department.id} value={department.id!}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="newRole">New Role</Label>
              <Select
                value={promotionData.newRole}
                onValueChange={(value) => setPromotionData({ ...promotionData, newRole: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="hr_admin">HR Admin</SelectItem>
                  <SelectItem value="finance_admin">Finance Admin</SelectItem>
                  <SelectItem value="ops_admin">Operations Admin</SelectItem>
                  <SelectItem value="ops_sub_admin">Ops Sub Admin</SelectItem>
                  <SelectItem value="sales_admin">Sales Admin</SelectItem>
                  <SelectItem value="bde">BDE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="newReportingTo">Reports To</Label>
              <Select
                value={promotionData.reportingTo}
                onValueChange={(value) => setPromotionData({ ...promotionData, reportingTo: value })}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a manager in this department" />
                </SelectTrigger>
                <SelectContent>
                  {usersInDepartment(promotionData.departmentId).filter(isManager).map((user) => (
                    <SelectItem key={user.id || user.id} value={(user.id || user.id)!}>
                      {user.name} {user.designation ? `(${user.designation})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedUser && isManager(selectedUser) ? (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                <Label htmlFor="promotionPendingWorkAssignee">Pending Work & Team Handoff</Label>
                <Select
                  value={promotionData.pendingWorkAssigneeId}
                  onValueChange={(value) => setPromotionData({ ...promotionData, pendingWorkAssigneeId: value })}
                >
                  <SelectTrigger id="promotionPendingWorkAssignee" className="w-full bg-background">
                    <SelectValue placeholder="Select another manager in the current department" />
                  </SelectTrigger>
                  <SelectContent>
                    {usersInDepartment(getUserDepartmentId(selectedUser)).filter(isManager).map(user => (
                      <SelectItem key={user.id} value={user.id!}>
                        {user.name} {user.designation ? `(${user.designation})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs leading-5 text-muted-foreground">
                  Unfinished tasks, direct reports, and managed department ownership will move to this manager.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
                Unfinished tasks will be reassigned to the employee&apos;s current reporting manager
                {selectedUser?.manager?.name ? ` (${selectedUser.manager.name})` : ''}.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="promotionReason">Reason</Label>
              <Input
                id="promotionReason"
                value={promotionData.reason}
                onChange={(event) => setPromotionData({ ...promotionData, reason: event.target.value })}
                placeholder={`Reason for ${promotionData.type} (optional)`}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPromotionDialogOpen(false);
                  setPromotionData({ newDesignation: '', newRole: 'employee', departmentId: '', reportingTo: '', pendingWorkAssigneeId: '', reason: '', type: 'promotion' });
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !promotionData.departmentId
                  || !promotionData.reportingTo
                  || (Boolean(selectedUser && isManager(selectedUser)) && !promotionData.pendingWorkAssigneeId)
                }
              >
                {promotionData.type === 'promotion' ? 'Promote' : 'Demote'} Employee
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
