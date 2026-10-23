import { useState, useEffect } from 'react';
import { Calendar, Edit, Save, RefreshCw, Plus, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/lib/api';

interface LeaveAllocation {
  id?: string;
  userId: any;
  year: number;
  sickLeave: number;
  casualLeave: number;
  earnedLeave: number;
  complementaryLeave: number;
  usedSick: number;
  usedCasual: number;
  usedEarned: number;
  usedComplementary: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  designation?: string;
}

export function LeaveAllocationPanel() {
  const [allocations, setAllocations] = useState<LeaveAllocation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    sickLeave: 12, casualLeave: 12, earnedLeave: 15, complementaryLeave: 0,
  });
  const [bulkForm, setBulkForm] = useState({
    sickLeave: 12, casualLeave: 12, earnedLeave: 15, complementaryLeave: 0,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAll(); }, [year]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [allocRes, usersRes] = await Promise.all([
        api.get(`/hr/leave-allocations?year=${year}`),
        api.get('/users'),
      ]);
      setAllocations(allocRes.data.data || []);
      const allUsers: User[] = usersRes.data.data || [];
      setUsers(allUsers.filter(u => !['ceo', 'org_admin', 'superadmin', 'center_admin', 'student'].includes(u.role)));
    } catch {
      toast.error('Failed to load leave allocations');
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (alloc?: LeaveAllocation, userId?: string) => {
    if (alloc) {
      setEditingUserId(typeof alloc.userId === 'object' ? alloc.userId.id : alloc.userId);
      setForm({
        sickLeave: alloc.sickLeave,
        casualLeave: alloc.casualLeave,
        earnedLeave: alloc.earnedLeave,
        complementaryLeave: alloc.complementaryLeave,
      });
    } else {
      setEditingUserId(userId || '');
      setForm({ sickLeave: 12, casualLeave: 12, earnedLeave: 15, complementaryLeave: 0 });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingUserId) { toast.error('Select an employee'); return; }
    setSaving(true);
    try {
      await api.put(`/hr/leave-allocations/${editingUserId}`, { ...form, year });
      toast.success('Leave allocation saved');
      setDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkInit = async () => {
    setSaving(true);
    try {
      const res = await api.post('/hr/leave-allocations/bulk-init', { ...bulkForm, year });
      toast.success(res.data.message);
      setBulkDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to initialize');
    } finally {
      setSaving(false);
    }
  };

  const allocatedUserIds = new Set(allocations.map(a =>
    typeof a.userId === 'object' ? a.userId.id : a.userId
  ));
  const unallocatedUsers = users.filter(u => !allocatedUserIds.has(u.id));

  const filtered = allocations.filter(a => {
    const employee = (a as any).user || (typeof a.userId === 'object' ? a.userId : null);
    const query = search.trim().toLowerCase();
    return [employee?.name, employee?.email, employee?.designation]
      .some(value => typeof value === 'string' && value.toLowerCase().includes(query));
  });

  const remaining = (total: number, used: number) => Math.max(0, total - used);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Leave Allocations</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage sick, casual, earned & complementary leave per employee</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            className="border rounded-md px-3 py-1.5 text-sm bg-background"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkDialogOpen(true)}>
            <Zap className="w-4 h-4 mr-1" /> Bulk Init
          </Button>
          <Button size="sm" onClick={() => openEdit()}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      <Input placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>{search.trim() ? 'No employees match your search' : `No leave allocations for ${year}`}</p>
            {!search.trim() && <p className="text-xs mt-1">Use "Bulk Init" to set up all employees at once</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(alloc => {
            const user = (alloc as any).user || (typeof alloc.userId === 'object' ? alloc.userId : null);
            const uid = user?.id || (typeof alloc.userId === 'string' ? alloc.userId : alloc.id);
            return (
              <Card key={uid} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-semibold">{user?.name || 'Employee'}</span>
                        {user?.role && <Badge variant="outline" className="text-xs capitalize">{user.role.replace(/_/g, ' ')}</Badge>}
                        {user?.designation && <Badge variant="outline" className="text-xs">{user.designation}</Badge>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        {[
                          { label: 'Sick', total: alloc.sickLeave, used: alloc.usedSick || 0, color: 'text-red-500' },
                          { label: 'Casual', total: alloc.casualLeave, used: alloc.usedCasual || 0, color: 'text-blue-500' },
                          { label: 'Earned', total: alloc.earnedLeave, used: alloc.usedEarned || 0, color: 'text-green-500' },
                          { label: 'Comp.', total: alloc.complementaryLeave, used: alloc.usedComplementary || 0, color: 'text-purple-500' },
                        ].map(({ label, total, used, color }) => (
                          <div key={label}>
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className={`font-semibold ${color}`}>{remaining(total, used)}<span className="text-muted-foreground font-normal text-xs">/{total}</span></p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openEdit(alloc)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Leave Allocation — {year}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {!allocations.find(a => (typeof a.userId === 'object' ? a.userId.id : a.userId) === editingUserId) && (
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={editingUserId} onValueChange={setEditingUserId}>
                  <SelectTrigger><SelectValue placeholder="Select employee..." /></SelectTrigger>
                  <SelectContent>
                    {unallocatedUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name} — {u.role.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { key: 'sickLeave', label: 'Sick Leave (days)' },
                { key: 'casualLeave', label: 'Casual Leave (days)' },
                { key: 'earnedLeave', label: 'Earned Leave (days)' },
                { key: 'complementaryLeave', label: 'Complementary Leave (days)' },
              ] as const).map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <Input type="number" min="0" value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: Number(e.target.value) }))} />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />{saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Init Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Initialize Leave — {year}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Sets default leave balances for all active employees who don't have an allocation yet for {year}.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {([
              { key: 'sickLeave', label: 'Sick Leave' },
              { key: 'casualLeave', label: 'Casual Leave' },
              { key: 'earnedLeave', label: 'Earned Leave' },
              { key: 'complementaryLeave', label: 'Complementary Leave' },
            ] as const).map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input type="number" min="0" value={bulkForm[key]}
                  onChange={e => setBulkForm(f => ({ ...f, [key]: Number(e.target.value) }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkInit} disabled={saving}>
              <Zap className="w-4 h-4 mr-1" />{saving ? 'Initializing...' : 'Initialize All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
