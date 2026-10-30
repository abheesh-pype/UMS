import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw, UserPlus, Trash2, ChevronDown, ChevronUp,
  Building2, Layers, MapPin, Users, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Dept { id: string; name: string; type: string; }
interface SubDept { id: string; name: string; parentDeptId: string | { id: string; name: string }; }
interface Branch {
  id: string; name: string; code: string; address: string; city?: string;
  branchManagerId?: { id: string; name: string; role: string; designation?: string };
  salesDeptId?: { id: string; name: string; type: string };
  operationsDeptId?: { id: string; name: string; type: string };
}
interface OrgUser { id: string; name: string; email: string; role: string; designation?: string; }
interface DesignationNode {
  id: string;
  title: string;
  level: number;
  maxHeadcount: number;
  departmentId?: Dept;
  subDepartmentId?: SubDept;
  branchId?: { id: string; name: string; code: string };
  parentDesignationId?: { id: string; title: string };
  filledBy: OrgUser[];
  status: string;
}

const ROLE_COLORS: Record<string, string> = {
  org_admin: '#7c3aed', ceo: '#2563eb', ops_admin: '#ea580c',
  finance_admin: '#16a34a', hr_admin: '#db2777', sales_admin: '#ca8a04',
  center_admin: '#0d9488', ops_sub_admin: '#f97316', employee: '#6b7280', staff: '#94a3b8',
};

// ─── HR Org Node (view + assign only, no edit/delete/add-child) ───────────────
function HROrgNode({
  node, allNodes, onAssign, onUnassign, depth = 0,
}: {
  node: DesignationNode; allNodes: DesignationNode[];
  onAssign: (n: DesignationNode) => void;
  onUnassign: (n: DesignationNode, userId: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = allNodes.filter(n => n.parentDesignationId?.id === node.id);
  const filled = node.filledBy?.length || 0;
  const vacant = node.maxHeadcount - filled;
  const isFull = vacant <= 0;

  const boxColor = node.branchId
    ? '#0891b2'
    : node.departmentId
      ? (ROLE_COLORS[node.departmentId.type] || '#6366f1')
      : '#6366f1';

  const subDeptName = node.subDepartmentId
    ? (typeof node.subDepartmentId === 'object' ? node.subDepartmentId.name : '')
    : null;

  return (
    <div className="flex flex-col items-center">
      <div className="relative group" style={{ minWidth: 190 }}>
        <div
          className="rounded-xl border-2 bg-white shadow-md px-4 py-3 text-center transition-all hover:shadow-lg"
          style={{ borderColor: boxColor, minWidth: 190 }}
        >
          {/* Branch badge */}
          {node.branchId && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full mb-1 inline-flex items-center gap-1"
              style={{ background: '#0891b222', color: '#0891b2' }}>
              <Building2 className="h-2.5 w-2.5" />
              {node.branchId.name} [{node.branchId.code}]
            </span>
          )}

          {/* Dept badge */}
          {node.departmentId && !node.branchId && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full mb-1 inline-block"
              style={{ background: boxColor + '22', color: boxColor }}>
              {node.departmentId.name}
            </span>
          )}

          {/* Sub-dept badge */}
          {subDeptName && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full mb-1 inline-flex items-center gap-1 bg-slate-100 text-slate-600">
              <Layers className="h-2.5 w-2.5" />{subDeptName}
            </span>
          )}

          <p className="font-bold text-sm text-gray-800 leading-tight">{node.title}</p>

          <div className="flex items-center justify-center gap-1 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isFull ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {filled}/{node.maxHeadcount} filled
            </span>
          </div>

          {/* People in this slot */}
          {filled > 0 && (
            <div className="mt-2 space-y-1">
              {node.filledBy.map(u => (
                <div key={u.id} className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1 group/person">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                    style={{ background: ROLE_COLORS[u.role] || '#6366f1' }}
                  >
                    {u.name.charAt(0)}
                  </div>
                  <span className="text-xs text-gray-700 truncate flex-1 text-left">{u.name}</span>
                  <span className="text-[9px] text-gray-400 capitalize hidden group-hover/person:inline">
                    {u.role.replace(/_/g, ' ')}
                  </span>
                  <button
                    onClick={() => onUnassign(node, u.id)}
                    className="text-red-400 hover:text-red-600 opacity-0 group-hover/person:opacity-100 transition-opacity ml-1"
                    title="Remove from position"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Assign button for vacant slots */}
          {vacant > 0 && (
            <button
              onClick={() => onAssign(node)}
              className="mt-2 w-full flex items-center justify-center gap-1 text-xs border border-dashed rounded-lg py-1.5 text-gray-400 hover:text-indigo-600 hover:border-indigo-400 transition-colors"
            >
              <UserPlus className="h-3 w-3" />
              {vacant} vacant {vacant === 1 ? 'slot' : 'slots'} — assign
            </button>
          )}
        </div>
      </div>

      {children.length > 0 && (
        <>
          <div className="w-px bg-gray-300" style={{ height: 24 }} />
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 mb-1">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {expanded && (
            <div className="flex flex-col items-center">
              {children.length > 1 ? (
                <div className="relative flex items-start">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2"
                    style={{ width: `calc(100% - 190px)`, height: 1, background: '#d1d5db', top: 0 }}
                  />
                  {children.map(child => (
                    <div key={child.id} className="flex flex-col items-center" style={{ padding: '0 20px' }}>
                      <div className="w-px bg-gray-300" style={{ height: 20 }} />
                      <HROrgNode node={child} allNodes={allNodes} onAssign={onAssign} onUnassign={onUnassign} depth={depth + 1} />
                    </div>
                  ))}
                </div>
              ) : (
                <HROrgNode node={children[0]} allNodes={allNodes} onAssign={onAssign} onUnassign={onUnassign} depth={depth + 1} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main HR Org Chart Panel ──────────────────────────────────────────────────
export function HROrgChartPanel() {
  const [nodes, setNodes] = useState<DesignationNode[]>([]);
  const [allUsers, setAllUsers] = useState<OrgUser[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Assign dialog
  const [assignDialog, setAssignDialog] = useState(false);
  const [assignTarget, setAssignTarget] = useState<DesignationNode | null>(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [nodesRes, usersRes, branchRes] = await Promise.all([
        api.get('/org/designations'),
        api.get('/users'),
        api.get('/org/branches'),
      ]);
      setNodes(nodesRes.data.data || []);
      setAllUsers(usersRes.data.data?.filter((u: any) => !['ceo', 'superadmin', 'center_admin', 'student'].includes(u.role)) || []);
      setAllBranches(branchRes.data.data || []);
    } catch {
      toast.error('Failed to load org chart');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openAssign = (node: DesignationNode) => {
    setAssignTarget(node);
    setAssignUserId('');
    setUserSearch('');
    setAssignDialog(true);
  };

  const handleAssign = async () => {
    if (!assignTarget || !assignUserId) return;
    setSaving(true);
    try {
      await api.patch(`/org/designations/${assignTarget.id}/assign`, { userId: assignUserId });
      toast.success('User assigned to position');
      setAssignDialog(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to assign');
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (node: DesignationNode, userId: string) => {
    if (!confirm('Remove this person from the position?')) return;
    try {
      await api.patch(`/org/designations/${node.id}/unassign`, { userId });
      toast.success('Removed from position');
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove');
    }
  };

  // Stats
  const totalPositions = nodes.reduce((s, n) => s + n.maxHeadcount, 0);
  const totalFilled = nodes.reduce((s, n) => s + (n.filledBy?.length || 0), 0);
  const totalVacant = totalPositions - totalFilled;

  const globalRoots = nodes.filter(n => !n.parentDesignationId && !n.branchId);

  // Filter nodes by search (title or filled person name)
  const searchLower = search.toLowerCase();
  const matchesSearch = (node: DesignationNode) => {
    if (!searchLower) return true;
    if (node.title.toLowerCase().includes(searchLower)) return true;
    if (node.filledBy?.some(u => u.name.toLowerCase().includes(searchLower))) return true;
    return false;
  };

  // Users not yet in any position
  const assignedUserIds = new Set(nodes.flatMap(n => (n.filledBy || []).map(u => u.id)));
  const unplacedUsers = allUsers.filter(u =>
    !assignedUserIds.has(u.id) && !['ceo', 'superadmin', 'center_admin', 'student'].includes(u.role)
  );

  // Filtered users for assign dialog
  const filteredUsers = allUsers
    .filter(u => !assignTarget?.filledBy?.find(f => f.id === u.id))
    .filter(u => !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading org chart...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Organisation Chart</h2>
          <p className="text-sm text-muted-foreground">
            View the org hierarchy and assign employees to vacant positions
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchAll}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{totalPositions}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Positions</p>
        </div>
        <div className="border rounded-xl p-4 text-center bg-green-50">
          <p className="text-2xl font-bold text-green-700">{totalFilled}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Filled</p>
        </div>
        <div className="border rounded-xl p-4 text-center bg-amber-50">
          <p className="text-2xl font-bold text-amber-700">{totalVacant}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Vacant</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search positions or people..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-200 inline-block" /> Vacant slots</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-200 inline-block" /> Fully filled</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-cyan-200 inline-block" /> Branch position</span>
        <span className="text-muted-foreground">Hover a person to remove · Click vacant slot to assign</span>
      </div>

      {nodes.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No org chart defined yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Ask your Org Admin to set up the hierarchy first.</p>
        </div>
      ) : (
        <>
          {/* Global / Head Office chart */}
          {globalRoots.length > 0 && (
            <div className="overflow-auto border rounded-xl bg-gray-50 p-8">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-6 text-center">
                Organisation — Head Office
              </p>
              <div className="inline-flex gap-12 justify-center min-w-full pb-4">
                {globalRoots
                  .filter(r => !search || matchesSearch(r) || nodes.some(n => n.parentDesignationId?.id === r.id && matchesSearch(n)))
                  .map(root => (
                    <HROrgNode
                      key={root.id}
                      node={root}
                      allNodes={nodes}
                      onAssign={openAssign}
                      onUnassign={handleUnassign}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Branch sections */}
          {allBranches.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Branch Hierarchies ({allBranches.length})
              </p>
              {allBranches.map(branch => {
                const branchRoots = nodes.filter(n => n.branchId?.id === branch.id && !n.parentDesignationId);
                const mgr = branch.branchManagerId;
                return (
                  <div key={branch.id} className="border-2 rounded-2xl p-5 bg-cyan-50/50" style={{ borderColor: '#0891b244' }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-xl bg-cyan-600 flex items-center justify-center text-white">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-cyan-900">{branch.name}</span>
                          <span className="text-xs font-mono bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded">{branch.code}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-cyan-700 mt-0.5">
                          <MapPin className="h-3 w-3" />{branch.address}{branch.city ? `, ${branch.city}` : ''}
                        </div>
                      </div>
                      {mgr && (
                        <Badge variant="outline" className="ml-auto text-xs">
                          Manager: {mgr.name}
                        </Badge>
                      )}
                    </div>

                    {branchRoots.length > 0 ? (
                      <div className="overflow-auto">
                        <div className="inline-flex gap-10 justify-center min-w-full pb-4 pt-2">
                          {branchRoots.map(root => (
                            <HROrgNode
                              key={root.id}
                              node={root}
                              allNodes={nodes}
                              onAssign={openAssign}
                              onUnassign={handleUnassign}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No positions defined for this branch yet.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Unplaced employees */}
      {unplacedUsers.length > 0 && (
        <div className="border rounded-xl p-4 bg-amber-50">
          <p className="text-sm font-semibold text-amber-700 mb-2">
            {unplacedUsers.length} employee{unplacedUsers.length !== 1 ? 's' : ''} not yet placed in the chart
          </p>
          <div className="flex flex-wrap gap-2">
            {unplacedUsers.map(u => (
              <span key={u.id} className="text-xs bg-white border rounded-full px-3 py-1 flex items-center gap-1.5">
                <span
                  className="w-4 h-4 rounded-full inline-flex items-center justify-center text-white text-[9px] font-bold"
                  style={{ background: ROLE_COLORS[u.role] || '#6366f1' }}
                >
                  {u.name.charAt(0)}
                </span>
                {u.name}
                <span className="text-gray-400">({u.role.replace(/_/g, ' ')})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Assign User Dialog */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Assign to "{assignTarget?.title}"
              {assignTarget?.branchId && (
                <span className="text-sm font-normal text-cyan-600 ml-2">
                  [{assignTarget.branchId.code}]
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Position info */}
            <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
              {assignTarget?.departmentId && (
                <p className="text-muted-foreground">
                  Department: <span className="font-medium text-foreground">{assignTarget.departmentId.name}</span>
                </p>
              )}
              {assignTarget?.subDepartmentId && typeof assignTarget.subDepartmentId === 'object' && (
                <p className="text-muted-foreground">
                  Sub-dept: <span className="font-medium text-foreground">{assignTarget.subDepartmentId.name}</span>
                </p>
              )}
              <p className="text-muted-foreground">
                Slots available: <span className="font-medium text-amber-600">
                  {(assignTarget?.maxHeadcount || 1) - (assignTarget?.filledBy?.length || 0)}
                </span>
              </p>
            </div>

            {/* Search users */}
            <div className="space-y-1">
              <Label>Search Employee</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Name or email..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Select Person</Label>
              <Select value={assignUserId} onValueChange={setAssignUserId}>
                <SelectTrigger><SelectValue placeholder="Choose an employee..." /></SelectTrigger>
                <SelectContent>
                  {filteredUsers.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">No matching employees</div>
                  ) : (
                    filteredUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-5 h-5 rounded-full inline-flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                            style={{ background: ROLE_COLORS[u.role] || '#6366f1' }}
                          >
                            {u.name.charAt(0)}
                          </span>
                          <span>{u.name}</span>
                          <span className="text-xs text-muted-foreground">— {u.role.replace(/_/g, ' ')}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Selected user preview */}
            {assignUserId && (() => {
              const u = allUsers.find(x => x.id === assignUserId);
              if (!u) return null;
              return (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-primary/5 border-primary/20">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ background: ROLE_COLORS[u.role] || '#6366f1' }}
                  >
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email} · {u.role.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={saving || !assignUserId}>
              {saving ? 'Assigning...' : 'Assign to Position'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
