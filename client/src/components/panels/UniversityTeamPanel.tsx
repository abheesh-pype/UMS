import { useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCw, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmployeeProfilePanel } from '@/components/panels/EmployeeProfilePanel';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  userId?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  designation?: string;
  status?: string;
  department?: { name?: string };
  subDepartment?: { name?: string; parentDept?: { name?: string } };
  branch?: { name?: string };
}

export function UniversityTeamPanel() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/hr/employee-profiles/admin/team');
      setMembers(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load team members');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter(member =>
      [member.name, member.email, member.userId, member.phone, member.role,
        member.designation, member.department?.name, member.subDepartment?.name,
        member.branch?.name]
        .some(value => value?.toLowerCase().includes(query)),
    );
  }, [members, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team</h2>
          <p className="text-sm text-muted-foreground">View and update staff profiles across the organization.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMembers} disabled={loading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Team Members</CardTitle>
              <CardDescription>{filteredMembers.length} staff members</CardDescription>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, email, role..." />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">Loading team members...</div>
          ) : filteredMembers.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Users className="h-8 w-8 opacity-30" />
              <p className="text-sm">{members.length ? 'No team members match your search.' : 'No team members found.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-3 pr-4 text-left font-medium">Staff member</th>
                    <th className="py-3 pr-4 text-left font-medium">Role / Designation</th>
                    <th className="py-3 pr-4 text-left font-medium">Department / Team</th>
                    <th className="py-3 pr-4 text-left font-medium">Branch</th>
                    <th className="py-3 pr-4 text-left font-medium">Status</th>
                    <th className="py-3 text-right font-medium">Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map(member => (
                    <tr
                      key={member.id}
                      className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                      onClick={() => setSelectedMember(member)}
                    >
                      <td className="py-3 pr-4">
                        <p className="font-medium">{member.name || '—'}</p>
                        <p className="text-xs text-muted-foreground">{member.email || member.userId || '—'}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="capitalize">{member.designation || member.role?.replace(/_/g, ' ') || '—'}</p>
                        {member.designation && <p className="text-xs capitalize text-muted-foreground">{member.role?.replace(/_/g, ' ')}</p>}
                      </td>
                      <td className="py-3 pr-4">
                        <p>{member.department?.name || member.subDepartment?.parentDept?.name || '—'}</p>
                        {member.subDepartment?.name && <p className="text-xs text-muted-foreground">{member.subDepartment.name}</p>}
                      </td>
                      <td className="py-3 pr-4">{member.branch?.name || '—'}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className="capitalize">{member.status?.replace(/_/g, ' ') || 'unknown'}</Badge>
                      </td>
                      <td className="py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={event => { event.stopPropagation(); setSelectedMember(member); }}>
                          <Eye className="mr-1 h-4 w-4" /> Profile
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedMember && (
        <EmployeeProfilePanel
          userId={selectedMember.id}
          employee={selectedMember}
          open
          adminAccess
          onOpenChange={isOpen => { if (!isOpen) setSelectedMember(null); }}
        />
      )}
    </div>
  );
}