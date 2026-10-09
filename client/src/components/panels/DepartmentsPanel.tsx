import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Building, Users } from 'lucide-react';
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

interface Department {
  id: string;
  name: string;
  type: string;
  organizationId?: any;
  managerId?: any;
  features?: string[];
  createdAt: string;
}

interface Organization {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  designation?: string;
  role: string;
}

const BUILT_IN_DEPARTMENT_TYPES = ['hr', 'finance', 'operations', 'sales', 'ceo', 'org_admin', 'study_center', 'staff'];

export function DepartmentsPanel() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'custom',
    customType: '',
    organizationId: '',
    managerId: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [deptsRes, orgsRes, usersRes] = await Promise.all([
        api.get('/departments'),
        api.get('/organizations'),
        api.get('/users'),
      ]);
      setDepartments(deptsRes.data.data || []);
      setOrganizations(orgsRes.data.data || []);
      setUsers(usersRes.data.data?.filter((u: any) => !['ceo', 'superadmin', 'org_admin', 'center_admin', 'student'].includes(u.role)) || []);
    } catch (error: any) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingDept(null);
    setFormData({
      name: '',
      type: 'custom',
      customType: '',
      organizationId: user?.role === 'superadmin' ? '' : (user?.organizationId || ''),
      managerId: '',
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (dept: Department) => {
    const isBuiltInType = BUILT_IN_DEPARTMENT_TYPES.includes(dept.type);
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      type: isBuiltInType ? dept.type : 'custom',
      customType: isBuiltInType || dept.type === 'custom' ? '' : dept.type,
      organizationId: dept.organizationId?.id || dept.organizationId || user?.organizationId || '',
      managerId: dept.managerId?.id || dept.managerId || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (dept: Department) => {
    setDeletingDept(dept);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      const payload: any = {
        name: formData.name,
        type: formData.type === 'custom' ? formData.customType.trim() : formData.type,
        organizationId: formData.organizationId,
      };
      if (!payload.type) {
        toast.error('Please enter a custom department type');
        setSubmitting(false);
        return;
      }
      // Only include managerId if a real user was selected
      if (formData.managerId && formData.managerId !== 'none') {
        payload.managerId = formData.managerId;
      }

      if (editingDept) {
        await api.put(`/departments/${editingDept.id}`, payload);
        toast.success('Department updated successfully');
      } else {
        await api.post('/departments', payload);
        toast.success('Department created successfully');
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingDept || deleting) return;

    try {
      setDeleting(true);
      await api.delete(`/departments/${deletingDept.id}`);
      toast.success('Department deleted successfully');
      setIsDeleteDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete department');
    } finally {
      setDeleting(false);
    }
  };

  const getTypeBadgeColor = (type: string) => {
    const colors: any = {
      hr: 'bg-orange-500',
      finance: 'bg-green-500',
      operations: 'bg-blue-500',
      sales: 'bg-pink-500',
      ceo: 'bg-indigo-500',
      org_admin: 'bg-teal-500',
      study_center: 'bg-cyan-500',
      staff: 'bg-slate-500',
      custom: 'bg-purple-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Departments</h2>
          <p className="text-muted-foreground text-sm">
            Manage departments across all universities
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          New Department
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => (
          <Card key={dept.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{dept.name}</CardTitle>
                    <Badge className={`mt-1 ${getTypeBadgeColor(dept.type)} text-white border-none`}>
                      {dept.type}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                {dept.organizationId && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium">University:</span>
                    <span className="truncate">
                      {dept.organizationId.name || 'N/A'}
                    </span>
                  </div>
                )}
                {dept.managerId && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-3 h-3" />
                    <span className="text-xs">
                      Manager: {dept.managerId.name || 'Assigned'}
                    </span>
                  </div>
                )}
                {dept.features && dept.features.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {dept.features.slice(0, 3).map((feature, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {dept.features.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{dept.features.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleEdit(dept)}
                >
                  <Edit className="w-3 h-3 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(dept)}
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {departments.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No departments found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Get started by creating your first department
            </p>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Create Department
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDept ? 'Edit Department' : 'Create New Department'}
            </DialogTitle>
            <DialogDescription>
              {editingDept
                ? 'Update the department details below'
                : 'Fill in the details to create a new department'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Department Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Marketing"
                  required
                />
              </div>
              {user?.role === 'superadmin' && (
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
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="ceo">CEO</SelectItem>
                    <SelectItem value="org_admin">Org Admin</SelectItem>
                    <SelectItem value="study_center">Study Center</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {formData.type === 'custom' && (
                  <Input
                    id="customType"
                    value={formData.customType}
                    onChange={(e) =>
                      setFormData({ ...formData, customType: e.target.value })
                    }
                    placeholder="e.g. Marketing, Legal, Admissions"
                    required
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="managerId">Department Manager</Label>
                <Select
                  value={formData.managerId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, managerId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select manager (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Manager</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} {user.designation ? `(${user.designation})` : ''} - {user.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? editingDept
                    ? 'Updating...'
                    : 'Creating...'
                  : editingDept
                  ? 'Update'
                  : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Department</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingDept?.name}"? This action
              cannot be undone and may affect users assigned to this department.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
