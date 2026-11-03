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
  portalRole?: string | null;
  user: StaffMember;
}

interface PortalRole {
  name: string;
  administratorAccess: boolean;
}

const DEFAULT_ROLE = 'UMS Administrator';

export function AssignExaminationAdminPanel() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [assigned, setAssigned] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [portalRoles, setPortalRoles] = useState<PortalRole[]>([]);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [newRole, setNewRole] = useState('');

  const fetchData = async () => {
    try {
      const response = await api.get('/operations/examination-admins');
      setStaff(response.data.data.staff || []);
      setAssigned(response.data.data.assigned || []);
      const roles: PortalRole[] = response.data.data.portalRoles || [];
      setPortalRoles(roles);
      setRolesError(response.data.data.portalRolesError || null);
      setNewRole(current => current || roles.find(role => role.name === DEFAULT_ROLE)?.name || roles[0]?.name || '');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load academic staff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssign = async (userId: string, portalRole: string) => {
    if (!portalRole) { toast.error('Choose a portal role first'); return; }
    setSaving(true);
    try {
      const response = await api.post('/operations/examination-admins', { userId, portalRole });
      toast.success(`Exam Portal access saved as ${portalRole}`);
      if (response.data.warning) toast.warning(response.data.warning);
      await fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save Exam Portal access');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    setSaving(true);
    try {
      const response = await api.delete(`/operations/examination-admins/${assignmentId}`);
      toast.success('Exam Portal access removed');
      if (response.data.warning) toast.warning(response.data.warning);
      await fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to remove Exam Portal access');
    } finally {
      setSaving(false);
    }
  };

  const assignedUserIds = new Set(assigned.map(assignment => assignment.user.id));
  const placeholder = loading ? 'Loading...' : staff.length ? 'Select a staff member' : 'No staff found';

  return (
    <Card>
      <CardHeader className="pt-6">
        <CardTitle>Exam Portal Access</CardTitle>
        <p className="text-sm text-muted-foreground">
          Give UMS staff a role in the Exam Portal. They then see an "Exam Portal" button in their own UMS menu that signs them in with that role.
        </p>
      </CardHeader>
      <CardContent className="space-y-6 pb-6">
        {rolesError && <p role="alert" className="text-sm text-destructive">{rolesError}</p>}
        <div className="max-w-md space-y-2">
          <Label>Portal role</Label>
          <Select value={newRole} onValueChange={setNewRole} disabled={loading || saving || portalRoles.length === 0}>
            <SelectTrigger className="w-full" aria-label="Portal role">
              <SelectValue placeholder={loading ? 'Loading...' : 'No portal roles available'} />
            </SelectTrigger>
            <SelectContent>
              {portalRoles.map(role => <SelectItem key={role.name} value={role.name}>{role.name}{role.administratorAccess ? ' (full access)' : ''}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="max-w-md space-y-2">
          <Label>Staff member</Label>
          {/* Selecting a person saves straight away with the role above; value stays empty so the field is ready for the next one */}
          <Select value="" onValueChange={userId => handleAssign(userId, newRole)} disabled={loading || saving || staff.length === 0 || !newRole}>
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
              No active staff or employees were found in your organization.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">People with Exam Portal access ({assigned.length})</h3>
          {assigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">{loading ? 'Loading...' : 'No one has been given access yet.'}</p>
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
                  <div className="flex items-center gap-2">
                    <Select value={assignment.portalRole || DEFAULT_ROLE} onValueChange={role => handleAssign(assignment.user.id, role)} disabled={saving || portalRoles.length === 0}>
                      <SelectTrigger className="w-48" aria-label={`Portal role for ${assignment.user.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* A role removed from the portal still shows so it can be replaced */}
                        {[...new Set([assignment.portalRole || DEFAULT_ROLE, ...portalRoles.map(role => role.name)])].map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" disabled={saving} onClick={() => handleRemove(assignment.id)}>
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
