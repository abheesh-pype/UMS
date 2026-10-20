import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Mail, Phone, UserCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { EmployeeProfilePanel } from '@/components/panels/EmployeeProfilePanel';
import api from '@/lib/api';

export function EmployeesPanel({ adminProfileAccess = false }: { adminProfileAccess?: boolean }) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    departmentId: '',
    role: 'employee',
    designation: '',
    branchId: '',
    status: 'active'
  });

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await api.get('/org/branches');
      setBranches(res.data.data || []);
    } catch { /* non-critical */ }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users');
      // Filter out admin roles - HR should only see regular employees
      const allUsers = response.data.data || [];
      // Only exclude ceo and org_admin — all other roles (including *_admin) are employees
      const employeesOnly = allUsers.filter((user: any) => {
        const role = user.role?.toLowerCase() || '';
        return role !== 'ceo' && role !== 'org_admin' && role !== 'center_admin' && role !== 'student';
      });
      setEmployees(employeesOnly);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      setDepartments(response.data.data || []);
    } catch (error) {
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        departmentId: formData.departmentId || undefined,
        role: formData.role,
        designation: formData.designation,
        ...(editingId ? {} : { password: formData.password || 'password123' })
      };
      
      let userId = editingId;
      if (editingId) {
        await api.put(`/users/${editingId}`, payload);
      } else {
        const res = await api.post('/users', payload);
        userId = res.data.data?.id || res.data.data?.id;
      }

      // If a branch was selected, assign this user as branch manager
      if (formData.branchId && formData.branchId !== 'none' && userId) {
        await api.patch(`/org/branches/${formData.branchId}/manager`, { userId });
      }

      setDialogOpen(false);
      resetForm();
      fetchEmployees();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save employee');
    }
  };

  const handleEdit = (employee: any) => {
    const empId = employee.id || employee.id;
    const rawDept = employee.departmentId;
    const deptId = typeof rawDept === 'object' && rawDept !== null
      ? (rawDept.id || rawDept.id)
      : (rawDept || employee.department?.id || employee.department?.id);
    setEditingId(empId);
    setFormData({
      name: employee.name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      password: '',
      departmentId: deptId?.toString() || '',
      role: employee.role || 'employee',
      designation: employee.designation || '',
      branchId: typeof employee.branchId === 'object' ? (employee.branchId?.id || '') : (employee.branchId || ''),
      status: employee.status || 'active'
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    try {
      await api.delete(`/users/${id}`);
      fetchEmployees();
    } catch (error) {
    }
  };

  const openProfile = (id: string) => {
    setProfileUserId(id);
    setProfileOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      password: '',
      departmentId: '',
      role: 'employee',
      designation: '',
      branchId: '',
      status: 'active'
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      on_leave: 'bg-yellow-100 text-yellow-800'
    };
    return <Badge className={variants[status] || ''}>{status?.replace('_', ' ')}</Badge>;
  };

  return (
    <div className="space-y-6">
      <EmployeeProfilePanel
        userId={profileUserId}
        open={profileOpen}
        adminAccess={adminProfileAccess}
        onClose={() => setProfileOpen(false)}
      />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Employee Management</h2>
          <p className="text-muted-foreground">Manage employee records and information</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Employee</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              </div>
              {!editingId && (
                <div>
                  <Label>Password</Label>
                  <PasswordInput
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="Leave blank to use default (password123)"
                  />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Role</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({...formData, role: value})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="hr_admin">HR Admin</SelectItem>
                      <SelectItem value="finance_admin">Finance Admin</SelectItem>
                      <SelectItem value="ops_admin">Operations Admin</SelectItem>
                      <SelectItem value="ops_sub_admin">Operations Sub-Admin</SelectItem>
                      <SelectItem value="sales_admin">Sales Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Designation</Label>
                  <Input
                    value={formData.designation}
                    onChange={(e) => setFormData({...formData, designation: e.target.value})}
                    placeholder="e.g. Branch Manager, CFO"
                  />
                </div>
              </div>
              {/* Branch assignment — makes this user the branch manager */}
              {branches.length > 0 && (
                <div>
                  <Label>Assign as Branch Manager (optional)</Label>
                  <Select value={formData.branchId} onValueChange={(value) => setFormData({...formData, branchId: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch to manage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {branches.map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} ({b.code})
                          {b.branchManagerId ? ' · has manager' : ' · vacant'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.branchId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      This user will be assigned as the branch manager and get access to all branch departments.
                    </p>
                  )}
                </div>
              )}
              <div>
                <Label>Department</Label>
                <Select value={formData.departmentId} onValueChange={(value) => setFormData({...formData, departmentId: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.filter(dept => dept && (dept.id || dept.id)).map((dept) => (
                      <SelectItem key={dept.id || dept.id} value={(dept.id || dept.id).toString()}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Save</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Directory</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : employees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No employees found</div>
          ) : (
            <div className="space-y-2">
              {employees.filter(emp => emp && (emp.id || emp.id)).map((employee) => {
                const empId = employee.id || employee.id;
                return (
                <div key={empId} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                      {(employee.name || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{employee.name || 'Unknown'}</div>
                      <div className="text-sm text-muted-foreground">
                        {employee.role}{employee.designation ? ` · ${employee.designation}` : ''} • {employee.department?.name || (typeof employee.departmentId === 'object' ? employee.departmentId?.name : '')}
                        {employee.branchId && (
                          <span className="ml-1 text-primary text-xs">
                            · {typeof employee.branchId === 'object' ? employee.branchId?.name : 'Branch Manager'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {employee.email}
                        </span>
                        {employee.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {employee.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(employee.status)}
                    <Button variant="ghost" size="sm" onClick={() => openProfile(empId)} title="View Profile">
                      <UserCircle className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(employee)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(empId)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
