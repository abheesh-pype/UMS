import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { toast } from 'sonner';

interface StaffMember {
  id: string;
  userId?: string | null;
  name: string;
  email: string;
  designation?: string | null;
  designationRef?: { title: string } | null;
}

// The hierarchy's designation first: the free-text one can be out of date
const designationOf = (member: StaffMember) => member.designationRef?.title || member.designation || '';

interface Assignment {
  id: string;
  createdAt: string;
  user: StaffMember;
}

export function AssignExaminationAdminPanel() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [assigned, setAssigned] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const response = await api.get('/operations/examination-admins');
      setStaff(response.data.data.staff || []);
      setAssigned(response.data.data.assigned || []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load academic staff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssign = async (userId: string) => {
    setSaving(true);
    try {
      await api.post('/operations/examination-admins', { userId });
      toast.success('Examination admin assigned');
      await fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to assign examination admin');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    setSaving(true);
    try {
      await api.delete(`/operations/examination-admins/${assignmentId}`);
      toast.success('Examination admin removed');
      await fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to remove examination admin');
    } finally {
      setSaving(false);
    }
  };

  const assignedUserIds = new Set(assigned.map(assignment => assignment.user.id));
  const placeholder = loading ? 'Loading...' : staff.length ? 'Select academic staff' : 'No academic staff found';

  return (
    <Card>
      <CardHeader className="pt-6">
        <CardTitle>Assign Examination Admin</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pb-6">
        <div className="max-w-md space-y-2">
          <Label>Academic Staff</Label>
          {/* Selecting a person saves straight away; value stays empty so the field is ready for the next one */}
          <Select value="" onValueChange={handleAssign} disabled={loading || saving || staff.length === 0}>
            <SelectTrigger className="w-full" aria-label="Academic Staff">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {staff.map(member => (
                <SelectItem key={member.id} value={member.id} disabled={assignedUserIds.has(member.id)}>
                  {member.name}{designationOf(member) ? ` - ${designationOf(member)}` : ''}{assignedUserIds.has(member.id) ? ' (assigned)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!loading && staff.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Only staff and employees who report to you in the hierarchy are listed, and none do yet.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Selected Employees ({assigned.length})</h3>
          {assigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">{loading ? 'Loading...' : 'No examination admins assigned yet.'}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {assigned.map(assignment => (
                <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{assignment.user.name}</p>
                    <p className="break-all text-xs text-muted-foreground">
                      {[designationOf(assignment.user), assignment.user.email].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" disabled={saving} onClick={() => handleRemove(assignment.id)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
