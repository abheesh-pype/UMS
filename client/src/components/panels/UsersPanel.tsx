import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, User, Shield, Upload, Download, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/lib/api';
import * as XLSX from 'xlsx';

interface User {
  id: string;
  userId?: string;
  name: string;
  email: string;
  role: string;
  status: string;
  organizationId?: any;
  departmentId?: any;
  department?: { name?: string | null } | null;
  subDepartmentId?: any;
  subDepartment?: {
    parentDept?: { name?: string | null } | null;
  } | null;
  canAddPrograms?: boolean;
  createdAt: string;
}

interface Organization {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

export function UsersPanel() {
  const { user: currentUser } = useAuth();
  const isGlobalSuperadmin = currentUser?.role === 'superadmin' && !currentUser.universityId;
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importUsers, setImportUsers] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee',
    organizationId: '',
    departmentId: '',
    canAddPrograms: false,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, orgsRes, deptsRes] = await Promise.all([
        api.get('/users'),
        api.get('/organizations'),
        api.get('/departments'),
      ]);
      setUsers(usersRes.data.data || []);
      setOrganizations(orgsRes.data.data || []);
      setDepartments(deptsRes.data.data || []);
    } catch (error: any) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        Name: 'John Doe',
        Email: 'john.doe@example.com',
        Password: 'password123',
        Role: 'employee',
        Department: 'Operations',
        CanAddPrograms: 'No'
      },
      {
        Name: 'Jane Smith',
        Email: 'jane.smith@example.com',
        Password: 'password123',
        Role: 'hr_admin',
        Department: 'Human Resources',
        CanAddPrograms: 'No'
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, 'users_import_template.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const parsedData: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (parsedData.length === 0) {
          toast.error('The uploaded file is empty');
          return;
        }

        // Map excel header titles to keys we need
        const mappedUsers = parsedData.map((row: any) => ({
          name: row.Name || row.name || '',
          email: row.Email || row.email || '',
          password: row.Password || row.password || '',
          role: row.Role || row.role || '',
          department: row.Department || row.department || '',
          canAddPrograms: row.CanAddPrograms || row.canAddPrograms || 'No'
        }));

        // Client-side validation
        const errors: any[] = [];
        const emails = new Set();
        mappedUsers.forEach((u, index) => {
          const rowNum = index + 2;
          if (!u.name) errors.push({ row: rowNum, message: 'Name is missing' });
          if (!u.email) {
            errors.push({ row: rowNum, message: 'Email is missing' });
          } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(u.email)) {
              errors.push({ row: rowNum, message: `Invalid email format: ${u.email}` });
            }
            if (emails.has(u.email.toLowerCase())) {
              errors.push({ row: rowNum, message: `Duplicate email in sheet: ${u.email}` });
            }
            emails.add(u.email.toLowerCase());
          }
          if (!u.role) {
            errors.push({ row: rowNum, message: 'Role is missing' });
          } else {
            const validRoles = ['org_admin', 'ceo', 'hr_admin', 'finance_admin', 'ops_admin', 'sales_admin', 'center_admin', 'academic_admin', 'employee'];
            if (!validRoles.includes(u.role.toLowerCase())) {
              errors.push({ row: rowNum, message: `Invalid role: ${u.role}. Must be one of: ${validRoles.join(', ')}` });
            }
          }
        });

        setImportUsers(mappedUsers);
        setImportErrors(errors);
        setImportSummary(null);
      } catch (err: any) {
        toast.error('Failed to parse Excel file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportSubmit = async () => {
    if (importUsers.length === 0) return;
    setImporting(true);
    try {
      const res = await api.post('/users/bulk-import', { users: importUsers });
      setImportSummary(res.data.data);
      toast.success(`Successfully imported ${res.data.data.successCount} users`);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bulk import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'employee',
      organizationId: isGlobalSuperadmin ? '' : (currentUser?.organizationId || ''),
      departmentId: '',
      canAddPrograms: false,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      organizationId: user.organizationId?.id || user.organizationId || currentUser?.organizationId || '',
      departmentId: user.departmentId?.id || user.departmentId || '',
      canAddPrograms: user.canAddPrograms || false,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (user: User) => {
    setDeletingUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = { ...formData };
      
      // Remove empty departmentId
      if (!payload.departmentId) {
        delete (payload as any).departmentId;
      }
      
      // Remove password if editing and password is empty
      if (editingUser && !payload.password) {
        delete (payload as any).password;
      }


      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, payload);
        toast.success('User updated successfully');
      } else {
        await api.post('/users', payload);
        toast.success('User created successfully');
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Operation failed';
      toast.error(errorMessage);
    }
  };

  const confirmDelete = async () => {
    if (!deletingUser) return;

    try {
      await api.delete(`/users/${deletingUser.id}`);
      toast.success('User deleted successfully');
      setIsDeleteDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: any = {
      superadmin: 'bg-purple-500',
      org_admin: 'bg-blue-500',
      ceo: 'bg-indigo-500',
      hr_admin: 'bg-orange-500',
      finance_admin: 'bg-green-500',
      ops_admin: 'bg-cyan-500',
      sales_admin: 'bg-pink-500',
      employee: 'bg-gray-500',
    };
    return colors[role] || 'bg-gray-500';
  };

  const getDepartmentName = (user: User) => {
    if (user.department?.name) return user.department.name;
    if (typeof user.departmentId === 'object' && user.departmentId?.name) {
      return user.departmentId.name;
    }

    const departmentId = typeof user.departmentId === 'string'
      ? user.departmentId
      : user.departmentId?.id;
    const departmentName = departments.find(department => department.id === departmentId)?.name;
    return departmentName || user.subDepartment?.parentDept?.name || null;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q) ||
      u.userId?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Users</h2>
          <p className="text-muted-foreground text-sm">
            Manage all users across universities
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            onClick={() => {
              setImportUsers([]);
              setImportErrors([]);
              setImportSummary(null);
              setIsImportDialogOpen(true);
            }}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <Upload className="w-4 h-4 mr-2" />
            Bulk Import
          </Button>
          <Button onClick={handleCreate} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            New User
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, role or user ID…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((user) => (
          <Card key={user.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{user.name}</CardTitle>
                    <Badge className={`mt-1 ${getRoleBadgeColor(user.role)} text-white border-none`}>
                      {user.role.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium">Email:</span>
                  <span className="truncate">{user.email}</span>
                </div>
                {getDepartmentName(user) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Shield className="w-3 h-3" />
                    <span className="text-xs truncate">
                      {getDepartmentName(user)}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                    {user.status}
                  </Badge>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleEdit(user)}
                >
                  <Edit className="w-3 h-3 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(user)}
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? 'No users match your search' : 'No users found'}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {searchQuery ? 'Try a different keyword.' : 'Get started by creating your first user'}
            </p>
            {!searchQuery && (
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Create User
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col p-0 gap-0 sm:max-w-lg">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>
              {editingUser ? 'Edit User' : 'Create New User'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Update the user details below'
                : 'Fill in the details to create a new user'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">
                  Password {editingUser ? '(leave blank to keep current)' : '*'}
                </Label>
                <PasswordInput
                  id="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder={editingUser ? 'Enter new password' : '••••••••'}
                  required={!editingUser}
                />
              </div>
              {isGlobalSuperadmin && (
                <div className="space-y-2">
                  <Label htmlFor="organizationId">University *</Label>
                  <Select
                    value={formData.organizationId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, organizationId: value })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select university" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData({ ...formData, role: value })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                        <SelectItem value="org_admin">University Admin</SelectItem>
                    <SelectItem value="ceo">CEO</SelectItem>
                    <SelectItem value="hr_admin">HR Admin</SelectItem>
                    <SelectItem value="finance_admin">Finance Admin</SelectItem>
                    <SelectItem value="ops_admin">Operations Admin</SelectItem>
                    <SelectItem value="sales_admin">Sales Admin</SelectItem>
                    <SelectItem value="center_admin">Center Admin</SelectItem>
                    <SelectItem value="academic_admin">Academic Admin</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="departmentId">Department (Optional)</Label>
                <Select
                  value={formData.departmentId || undefined}
                  onValueChange={(value) =>
                    setFormData({ ...formData, departmentId: value || '' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="canAddPrograms"
                  checked={formData.canAddPrograms}
                  onChange={(e) =>
                    setFormData({ ...formData, canAddPrograms: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <Label htmlFor="canAddPrograms" className="text-sm font-medium cursor-pointer">
                  Can Add Programs against Universities
                </Label>
              </div>
            </div>
            <DialogFooter className="p-6 pt-4 border-t bg-muted/20">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingUser ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingUser?.name}"? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col p-0 gap-0 sm:max-w-2xl">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>Bulk Import Users</DialogTitle>
            <DialogDescription>
              Upload an Excel (.xlsx, .xls) or CSV file containing user details.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Step 1: Template and File Upload */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border bg-muted/40">
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Need a template?</h4>
                <p className="text-xs text-muted-foreground">Download the Excel template to prepare your user details.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} className="w-full sm:w-auto">
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="importFile" className="text-sm font-semibold">Select Excel/CSV File</Label>
              <Input
                id="importFile"
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
            </div>

            {/* Validation Errors */}
            {importErrors.length > 0 && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  Please fix the following {importErrors.length} errors in your file:
                </div>
                <ul className="list-disc pl-5 space-y-1 text-xs max-h-40 overflow-y-auto">
                  {importErrors.map((err, idx) => (
                    <li key={idx}>
                      <strong>Row {err.row}:</strong> {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Summary display after import */}
            {importSummary && (
              <div className={`p-4 rounded-lg border text-sm space-y-3 ${importSummary.failedCount > 0 ? 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300' : 'bg-green-500/10 border-green-500/20 text-green-800 dark:text-green-300'}`}>
                <div className="flex items-center gap-2 font-semibold text-base">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Import Completed
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="p-2 rounded bg-background/50">
                    <div className="font-bold text-lg">{importSummary.total}</div>
                    <div className="text-xs text-muted-foreground">Total Rows</div>
                  </div>
                  <div className="p-2 rounded bg-background/50">
                    <div className="font-bold text-lg text-green-600 dark:text-green-400">{importSummary.successCount}</div>
                    <div className="text-xs text-muted-foreground">Succeeded</div>
                  </div>
                  <div className="p-2 rounded bg-background/50">
                    <div className="font-bold text-lg text-destructive">{importSummary.failedCount}</div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                </div>

                {importSummary.errors.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-muted">
                    <div className="font-semibold text-xs">Import Warnings/Failures:</div>
                    <ul className="list-disc pl-5 space-y-1 text-xs max-h-40 overflow-y-auto">
                      {importSummary.errors.map((err: any, idx: number) => (
                        <li key={idx}>
                          <strong>Row {err.row} ({err.email}):</strong> {err.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Preview parsed users */}
            {importUsers.length > 0 && !importSummary && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Preview ({importUsers.length} users parsed)</h4>
                </div>
                <div className="rounded-md border max-h-60 overflow-auto">
<div className="overflow-x-auto w-full">
<table className="w-full text-sm">
                    <thead className="bg-muted/80 sticky top-0 font-semibold text-muted-foreground border-b text-left">
                      <tr>
                        <th className="p-2 pl-3">Row</th>
                        <th className="p-2">Name</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Role</th>
                        <th className="p-2">Department</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importUsers.map((u, idx) => (
                        <tr key={idx} className="hover:bg-muted/30">
                          <td className="p-2 pl-3 text-muted-foreground text-xs">{idx + 2}</td>
                          <td className="p-2 font-medium">{u.name}</td>
                          <td className="p-2 text-xs truncate max-w-[150px]">{u.email}</td>
                          <td className="p-2"><Badge variant="outline">{u.role}</Badge></td>
                          <td className="p-2 text-xs text-muted-foreground">{u.department || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
</div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 pt-4 border-t bg-muted/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsImportDialogOpen(false)}
            >
              {importSummary ? 'Close' : 'Cancel'}
            </Button>
            {importUsers.length > 0 && !importSummary && (
              <Button
                type="button"
                onClick={handleImportSubmit}
                disabled={importErrors.length > 0 || importing}
              >
                {importing ? 'Importing...' : `Import ${importUsers.length} Users`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
