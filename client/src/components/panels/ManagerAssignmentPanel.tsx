import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, UserCheck, UserX, Building, Building2, Crown, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  designation?: string;
  role: string;
}

interface SubDepartment {
  id: string;
  name: string;
  parentDeptId: any;
  managerId?: any;
  status: string;
}

interface Department {
  id: string;
  name: string;
  type: string;
  managerId?: any;
  assistantManagerIds?: any[];
  subDepartments?: SubDepartment[];
}

const DEPT_TYPE_COLORS: Record<string, string> = {
  academic: 'bg-purple-100 text-purple-800',
  hr: 'bg-orange-100 text-orange-800',
  finance: 'bg-green-100 text-green-800',
  operations: 'bg-blue-100 text-blue-800',
  sales: 'bg-pink-100 text-pink-800',
  ceo: 'bg-indigo-100 text-indigo-800',
  org_admin: 'bg-teal-100 text-teal-800',
  custom: 'bg-purple-100 text-purple-800',
};

export function ManagerAssignmentPanel() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{
    type: 'department' | 'subdepartment';
    id: string;
    name: string;
    currentManagerId?: string;
  } | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState('none');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [deptsRes, subDeptsRes, usersRes] = await Promise.all([
        api.get('/departments'),
        api.get('/sub-departments'),
        api.get('/users'),
      ]);

      const depts: Department[] = deptsRes.data.data || [];
      const subs: SubDepartment[] = subDeptsRes.data.data || [];
      const allUsers: User[] = usersRes.data.data || [];

      // Attach sub-departments to their parent departments
      const deptsWithSubs = depts.map((dept) => ({
        ...dept,
        subDepartments: subs.filter((s) => {
          const parentId =
            typeof s.parentDeptId === 'object'
              ? s.parentDeptId?.id
              : s.parentDeptId;
          return parentId === dept.id;
        }),
      }));

      setDepartments(deptsWithSubs);
      // Filter out superadmin/org_admin for manager candidates
      setUsers(allUsers.filter((u) => !['ceo', 'superadmin', 'org_admin', 'center_admin', 'student'].includes(u.role)));
    } catch (_err) {
      toast.error('Failed to load hierarchy data');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (deptId: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) { next.delete(deptId); } else { next.add(deptId); }
      return next;
    });
  };

  const openAssignDialog = (
    type: 'department' | 'subdepartment',
    id: string,
    name: string,
    currentManager?: any
  ) => {
    const currentId =
      typeof currentManager === 'object'
        ? currentManager?.id
        : currentManager;
    setAssignTarget({ type, id, name, currentManagerId: currentId });
    setSelectedManagerId(currentId || 'none');
    setDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!assignTarget) return;
    const managerId = selectedManagerId === 'none' ? null : selectedManagerId;

    try {
      if (assignTarget.type === 'department') {
        if (managerId) {
          await api.put(`/departments/${assignTarget.id}/assign-manager`, { managerId });
        } else {
          await api.delete(`/departments/${assignTarget.id}/remove-manager`);
        }
      } else {
        await api.patch(`/sub-departments/${assignTarget.id}`, {
          managerId: managerId || null,
        });
      }
      toast.success(`Manager ${managerId ? 'assigned' : 'removed'} for ${assignTarget.name}`);
      setDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to assign manager');
    }
  };

  const getManagerName = (managerId: any) => {
    if (!managerId) return null;
    if (typeof managerId === 'object') return managerId.name;
    const user = users.find((u) => u.id === managerId);
    return user?.name || null;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            Manager Assignment — Hierarchy View
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Assign or change managers for departments and their sub-departments
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {departments.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Building className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No departments found</p>
            </div>
          )}

          {departments.map((dept) => {
            const isExpanded = expandedDepts.has(dept.id);
            const hasSubs = (dept.subDepartments?.length ?? 0) > 0;
            const managerName = getManagerName(dept.managerId);

            return (
              <div key={dept.id} className="border rounded-xl overflow-hidden">
                {/* Department row */}
                <div className="flex items-center gap-3 p-4 bg-muted/30 hover:bg-muted/50 transition-colors">
                  <button
                    onClick={() => hasSubs && toggleExpand(dept.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    disabled={!hasSubs}
                  >
                    {hasSubs ? (
                      isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )
                    ) : (
                      <div className="w-4" />
                    )}
                  </button>

                  <Building className="w-4 h-4 text-primary shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{dept.name}</span>
                      <Badge
                        className={`text-xs ${DEPT_TYPE_COLORS[dept.type] || 'bg-gray-100 text-gray-800'}`}
                        variant="outline"
                      >
                        {dept.type}
                      </Badge>
                      {hasSubs && (
                        <span className="text-xs text-muted-foreground">
                          {(dept.subDepartments?.length ?? 0)} sub-dept{(dept.subDepartments?.length ?? 0) !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {managerName ? (
                        <>
                          <UserCheck className="w-3 h-3 text-green-600" />
                          <span className="text-xs text-green-700 font-medium">{managerName}</span>
                        </>
                      ) : (
                        <>
                          <UserX className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">No manager assigned</span>
                        </>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={managerName ? 'outline' : 'default'}
                    onClick={() =>
                      openAssignDialog('department', dept.id, dept.name, dept.managerId)
                    }
                  >
                    <Users className="w-3 h-3 mr-1" />
                    {managerName ? 'Change' : 'Assign'}
                  </Button>
                </div>

                {/* Sub-departments */}
                {isExpanded && dept.subDepartments && dept.subDepartments.length > 0 && (
                  <div className="border-t divide-y">
                    {dept.subDepartments.map((sub) => {
                      const subManagerName = getManagerName(sub.managerId);
                      return (
                        <div
                          key={sub.id}
                          className="flex items-center gap-3 p-3 pl-10 bg-background hover:bg-muted/20 transition-colors"
                        >
                          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{sub.name}</span>
                              <Badge
                                variant="outline"
                                className={`text-xs ${sub.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'}`}
                              >
                                {sub.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {subManagerName ? (
                                <>
                                  <UserCheck className="w-3 h-3 text-green-600" />
                                  <span className="text-xs text-green-700 font-medium">{subManagerName}</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">No manager assigned</span>
                                </>
                              )}
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant={subManagerName ? 'outline' : 'default'}
                            onClick={() =>
                              openAssignDialog('subdepartment', sub.id, sub.name, sub.managerId)
                            }
                          >
                            <Users className="w-3 h-3 mr-1" />
                            {subManagerName ? 'Change' : 'Assign'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Assign Manager Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Manager</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground">
                {assignTarget?.type === 'department' ? 'Department' : 'Sub-Department'}:{' '}
                <span className="font-semibold text-foreground">{assignTarget?.name}</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Select Manager</Label>
              <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Remove Manager —</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                      {' — '}
                      {user.designation || user.role.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign}>
              {selectedManagerId === 'none' ? 'Remove Manager' : 'Assign Manager'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
