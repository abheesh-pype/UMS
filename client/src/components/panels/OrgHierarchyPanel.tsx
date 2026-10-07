import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, RefreshCw, UserPlus, Trash2, Edit2, Users, ChevronDown, ChevronUp, Layers, Building2, MapPin } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Dept { id: string; name: string; type: string; }
interface SubDept { id: string; name: string; parentDeptId: string | { id: string; name: string }; }
interface Branch {
  id: string; name: string; code: string; address: string; city?: string;
  branchManagerId?: { id: string; name: string; role: string; userId?: string; designation?: string };
  salesDeptId?: { id: string; name: string; type: string };
  operationsDeptId?: { id: string; name: string; type: string };
  additionalDeptIds?: { id: string; name: string; type: string }[];
}
interface OrgUser { id: string; name: string; email: string; role: string; designation?: string; userId?: string; }
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

// ─── OrgNode ──────────────────────────────────────────────────────────────────
function OrgNode({
  node, allNodes, allUsers, allDepts,
  onEdit, onDelete, onAssign, onUnassign, onAddChild, depth = 0,
}: {
  node: DesignationNode; allNodes: DesignationNode[]; allUsers: OrgUser[]; allDepts: Dept[];
  onEdit: (n: DesignationNode) => void; onDelete: (n: DesignationNode) => void;
  onAssign: (n: DesignationNode) => void; onUnassign: (n: DesignationNode, userId: string) => void;
  onAddChild: (parent: DesignationNode) => void; depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = allNodes.filter(n => {
    const pid = typeof n.parentDesignationId === 'object' ? (n.parentDesignationId)?.id : n.parentDesignationId;
    return pid === node.id;
  });
  const filled = node.filledBy?.length || 0;
  const vacant = node.maxHeadcount - filled;
  const isFull = vacant <= 0;

  const boxColor = node.branchId
    ? '#0891b2'  // cyan for branch-scoped positions
    : node.departmentId
      ? ROLE_COLORS[node.departmentId.type] || '#6366f1'
      : '#6366f1';

  const subDeptName = node.subDepartmentId
    ? (typeof node.subDepartmentId === 'object' ? node.subDepartmentId.name : '')
    : null;

  return (
    <div className="flex flex-col items-center">
      <div className="relative group" style={{ minWidth: 190 }}>
        <div className="rounded-xl border-2 bg-white shadow-md px-4 py-3 text-center transition-all hover:shadow-lg"
          style={{ borderColor: boxColor, minWidth: 190 }}>

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

          {filled > 0 && (
            <div className="mt-2 space-y-1">
              {node.filledBy.map(u => (
                <div key={u.id} className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                    style={{ background: ROLE_COLORS[u.role] || '#6366f1' }}>
                    {u.name.charAt(0)}
                  </div>
                  <span className="text-xs text-gray-700 truncate flex-1">{u.name}</span>
                  <button onClick={() => onUnassign(node, u.id)}
                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {vacant > 0 && (
            <button onClick={() => onAssign(node)}
              className="mt-2 w-full flex items-center justify-center gap-1 text-xs border border-dashed rounded-lg py-1 text-gray-400 hover:text-indigo-600 hover:border-indigo-400 transition-colors">
              <UserPlus className="h-3 w-3" />
              {vacant} vacant {vacant === 1 ? 'slot' : 'slots'}
            </button>
          )}

          <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(node)}
              className="w-6 h-6 bg-white border rounded-full shadow flex items-center justify-center hover:bg-indigo-50">
              <Edit2 className="h-3 w-3 text-indigo-600" />
            </button>
            <button onClick={() => onAddChild(node)}
              className="w-6 h-6 bg-white border rounded-full shadow flex items-center justify-center hover:bg-green-50">
              <Plus className="h-3 w-3 text-green-600" />
            </button>
            <button onClick={() => onDelete(node)}
              className="w-6 h-6 bg-white border rounded-full shadow flex items-center justify-center hover:bg-red-50">
              <Trash2 className="h-3 w-3 text-red-500" />
            </button>
          </div>
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
                <>
                  {/* horizontal bar connecting siblings */}
                  <div className="relative flex items-start">
                    {/* top horizontal line */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2"
                      style={{
                        width: `calc(100% - 190px)`,
                        height: 1,
                        background: '#d1d5db',
                        top: 0,
                      }}
                    />
                    {children.map(child => (
                      <div key={child.id} className="flex flex-col items-center" style={{ padding: '0 20px' }}>
                        <div className="w-px bg-gray-300" style={{ height: 20 }} />
                        <OrgNode node={child} allNodes={allNodes} allUsers={allUsers} allDepts={allDepts}
                          onEdit={onEdit} onDelete={onDelete} onAssign={onAssign}
                          onUnassign={onUnassign} onAddChild={onAddChild} depth={depth + 1} />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <OrgNode node={children[0]} allNodes={allNodes} allUsers={allUsers} allDepts={allDepts}
                  onEdit={onEdit} onDelete={onDelete} onAssign={onAssign}
                  onUnassign={onUnassign} onAddChild={onAddChild} depth={depth + 1} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Branch section in the chart ─────────────────────────────────────────────
function DeptNode({ dept, color }: { dept: { id: string; name: string; type: string }; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-px bg-gray-300" style={{ height: 24 }} />
      <div className="rounded-xl border-2 bg-white shadow-sm px-4 py-3 text-center"
        style={{ borderColor: color, minWidth: 160 }}>
        <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full mb-1 inline-block"
          style={{ background: color + '22', color }}>
          {dept.type}
        </span>
        <p className="font-semibold text-sm text-gray-800 leading-tight">{dept.name}</p>
      </div>
    </div>
  );
}

function BranchSection({
  branch, allNodes, allUsers, allDepts,
  onEdit, onDelete, onAssign, onUnassign, onAddChild, onAddBranchPosition,
}: {
  branch: Branch; allNodes: DesignationNode[]; allUsers: OrgUser[]; allDepts: Dept[];
  onEdit: (n: DesignationNode) => void; onDelete: (n: DesignationNode) => void;
  onAssign: (n: DesignationNode) => void; onUnassign: (n: DesignationNode, userId: string) => void;
  onAddChild: (parent: DesignationNode) => void; onAddBranchPosition: (branch: Branch) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  // Designation nodes scoped to this branch with no parent = roots of branch subtree
  const branchRoots = allNodes.filter(n => {
    const bId = typeof n.branchId === 'object' ? (n.branchId)?.id : n.branchId;
    const hasParent = typeof n.parentDesignationId === 'object' ? !!(n.parentDesignationId)?.id : !!n.parentDesignationId;
    return bId === branch.id && !hasParent;
  });

  // Branch manager controls Sales and Operations only — Finance and HR are org-wide
  const BRANCH_CONTROLLED_TYPES = new Set(['sales', 'operations']);
  const controlledDepts: Array<{ id: string; name: string; type: string }> = [];
  const salesDeptObj = typeof branch.salesDeptId === 'object' && branch.salesDeptId ? branch.salesDeptId : (branch as any).salesDept;
  const operationsDeptObj = typeof branch.operationsDeptId === 'object' && branch.operationsDeptId ? branch.operationsDeptId : (branch as any).operationsDept;

  if (salesDeptObj && salesDeptObj.id) {
    controlledDepts.push({ id: salesDeptObj.id, name: salesDeptObj.name, type: 'sales' });
  }
  if (operationsDeptObj && operationsDeptObj.id) {
    controlledDepts.push({ id: operationsDeptObj.id, name: operationsDeptObj.name, type: 'operations' });
  }
  if (branch.additionalDeptIds) {
    branch.additionalDeptIds
      .filter(d => BRANCH_CONTROLLED_TYPES.has(d.type))
      .forEach(d => {
        if (d && d.id && !controlledDepts.find(x => x.id === d.id)) {
          controlledDepts.push({ id: d.id, name: d.name, type: d.type });
        }
      });
  }

  const DEPT_COLORS: Record<string, string> = {
    sales: '#ca8a04', operations: '#ea580c', finance: '#16a34a',
    hr: '#db2777', ceo: '#2563eb', custom: '#6366f1',
  };

  const mgr = branch.branchManagerId;

  return (
    <div className="border-2 rounded-2xl p-5 bg-cyan-50/50" style={{ borderColor: '#0891b244' }}>
      {/* Branch header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-600 flex items-center justify-center text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-cyan-900">{branch.name}</span>
              <span className="text-xs font-mono bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded">
                {branch.code}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-cyan-700 mt-0.5">
              <MapPin className="h-3 w-3" />{branch.address}{branch.city ? `, ${branch.city}` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="text-xs h-7"
            onClick={() => onAddBranchPosition(branch)}>
            <Plus className="h-3 w-3 mr-1" /> Add Position
          </Button>
          <button onClick={() => setExpanded(!expanded)} className="text-cyan-500 hover:text-cyan-700">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="overflow-x-auto">
          <div className="flex flex-col items-center min-w-max pb-4">

            {/* ── Branch Manager node ── */}
            {mgr ? (
              <div className="relative group" style={{ minWidth: 200 }}>
                <div className="rounded-xl border-2 bg-white shadow-md px-4 py-3 text-center"
                  style={{ borderColor: '#0891b2', minWidth: 200 }}>
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full mb-1 inline-flex items-center gap-1"
                    style={{ background: '#0891b222', color: '#0891b2' }}>
                    <Building2 className="h-2.5 w-2.5" /> Branch Manager
                  </span>
                  <p className="font-bold text-sm text-gray-800">{mgr.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {mgr.designation || mgr.role.replace(/_/g, ' ')}
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-1">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Controls {controlledDepts.length} dept{controlledDepts.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed px-4 py-3 text-center text-sm text-muted-foreground"
                style={{ borderColor: '#0891b244', minWidth: 200 }}>
                <Building2 className="h-5 w-5 mx-auto mb-1 text-cyan-400" />
                No branch manager assigned
              </div>
            )}

            {/* Connector down to dept row */}
            {controlledDepts.length > 0 && (
              <>
                <div className="w-px bg-gray-300" style={{ height: 20 }} />
                {/* Horizontal bar spanning all dept nodes */}
                <div className="flex items-start justify-center">
                  {controlledDepts.map((dept) => (
                    <div key={dept.id} className="flex flex-col items-center" style={{ padding: '0 20px' }}>
                      {controlledDepts.length > 1 && (
                        <div className="w-px bg-gray-300" style={{ height: 20 }} />
                      )}
                      <DeptNode dept={dept} color={DEPT_COLORS[dept.type] || '#6366f1'} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Designation nodes for this branch (below the dept row) */}
            {branchRoots.length > 0 && (
              <>
                <div className="w-px bg-gray-300" style={{ height: 24 }} />
                <div className="flex gap-10 justify-center pt-2">
                  {branchRoots.map(root => (
                    <OrgNode key={root.id} node={root} allNodes={allNodes} allUsers={allUsers} allDepts={allDepts}
                      onEdit={onEdit} onDelete={onDelete} onAssign={onAssign}
                      onUnassign={onUnassign} onAddChild={onAddChild} />
                  ))}
                </div>
              </>
            )}

            {branchRoots.length === 0 && controlledDepts.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed border-cyan-200 rounded-xl mt-4 w-full">
                No positions defined for this branch yet.
                <br />
                <button onClick={() => onAddBranchPosition(branch)}
                  className="text-cyan-600 hover:underline text-xs mt-1 inline-flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Add first position
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export function OrgHierarchyPanel() {
  const [nodes, setNodes] = useState<DesignationNode[]>([]);
  const [allUsers, setAllUsers] = useState<OrgUser[]>([]);
  const [allDepts, setAllDepts] = useState<Dept[]>([]);
  const [allSubDepts, setAllSubDepts] = useState<SubDept[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Create / Edit designation dialog ──
  const [designDialog, setDesignDialog] = useState(false);
  const [editingNode, setEditingNode] = useState<DesignationNode | null>(null);
  const [designForm, setDesignForm] = useState({
    title: '', departmentId: '', subDepartmentId: '', branchId: '',
    level: '1', maxHeadcount: '1', parentDesignationId: '',
  });

  // ── Create sub-department dialog ──
  const [subDeptDialog, setSubDeptDialog] = useState(false);
  const [subDeptForm, setSubDeptForm] = useState({ name: '', parentDeptId: '' });
  const [subDeptSaving, setSubDeptSaving] = useState(false);

  // ── Assign user dialog ──
  const [assignDialog, setAssignDialog] = useState(false);
  const [assignTarget, setAssignTarget] = useState<DesignationNode | null>(null);
  const [assignUserId, setAssignUserId] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [nodesRes, usersRes, deptsRes, subDeptsRes, branchRes] = await Promise.all([
        api.get('/org/designations'),
        api.get('/users'),
        api.get('/departments'),
        api.get('/sub-departments'),
        api.get('/org/branches'),
      ]);
      setNodes(nodesRes.data.data || []);
      setAllUsers(usersRes.data.data?.filter((u: any) => !['ceo', 'superadmin', 'org_admin', 'center_admin', 'student'].includes(u.role)) || []);
      setAllDepts(deptsRes.data.data || []);
      setAllSubDepts(subDeptsRes.data.data || []);
      setAllBranches(branchRes.data.data || []);
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Failed to load organization hierarchy');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const filteredSubDepts = designForm.departmentId
    ? allSubDepts.filter(sd => {
        if (!sd.parentDeptId) return false;
        const parentId = typeof sd.parentDeptId === 'object' ? sd.parentDeptId.id : sd.parentDeptId;
        return parentId === designForm.departmentId;
      })
    : allSubDepts;

  const openCreate = (parent?: DesignationNode) => {
    setEditingNode(null);
    setDesignForm({
      title: '',
      departmentId: parent?.departmentId?.id || '',
      subDepartmentId: '',
      branchId: parent?.branchId?.id || '',
      level: parent ? String((parent.level || 1) + 1) : '1',
      maxHeadcount: '1',
      parentDesignationId: parent?.id || '',
    });
    setDesignDialog(true);
  };

  // Open create dialog pre-scoped to a branch
  const openCreateForBranch = (branch: Branch) => {
    setEditingNode(null);
    setDesignForm({
      title: 'Branch Manager',
      departmentId: '',
      subDepartmentId: '',
      branchId: branch.id,
      level: '2',
      maxHeadcount: '1',
      parentDesignationId: '',
    });
    setDesignDialog(true);
  };

  const openEdit = (node: DesignationNode) => {
    setEditingNode(node);
    setDesignForm({
      title: node.title,
      departmentId: node.departmentId?.id || '',
      subDepartmentId: node.subDepartmentId?.id || '',
      branchId: node.branchId?.id || '',
      level: String(node.level),
      maxHeadcount: String(node.maxHeadcount),
      parentDesignationId: node.parentDesignationId?.id || '',
    });
    setDesignDialog(true);
  };

  const handleSaveDesignation = async () => {
    if (!designForm.title) return;
    setSaving(true);
    try {
      const payload = {
        title: designForm.title,
        departmentId: designForm.departmentId || null,
        subDepartmentId: designForm.subDepartmentId || null,
        branchId: designForm.branchId || null,
        level: Number(designForm.level),
        maxHeadcount: Number(designForm.maxHeadcount),
        parentDesignationId: designForm.parentDesignationId || null,
      };
      if (editingNode) {
        await api.patch(`/org/designations/${editingNode.id}`, payload);
      } else {
        await api.post('/org/designations', payload);
      }
      setDesignDialog(false);
      fetchAll();
    } catch (e) {
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSubDept = async () => {
    if (!subDeptForm.name || !subDeptForm.parentDeptId) return;
    setSubDeptSaving(true);
    try {
      await api.post('/sub-departments', subDeptForm);
      setSubDeptDialog(false);
      setSubDeptForm({ name: '', parentDeptId: '' });
      const res = await api.get('/sub-departments');
      setAllSubDepts(res.data.data || []);
    } catch (e) {
    } finally {
      setSubDeptSaving(false);
    }
  };

  const handleDelete = async (node: DesignationNode) => {
    if (!confirm(`Delete "${node.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/org/designations/${node.id}`);
      fetchAll();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to delete');
    }
  };

  const openAssign = (node: DesignationNode) => {
    setAssignTarget(node);
    setAssignUserId('');
    setAssignDialog(true);
  };

  const handleAssign = async () => {
    if (!assignTarget || !assignUserId) return;
    setSaving(true);
    try {
      await api.patch(`/org/designations/${assignTarget.id}/assign`, { userId: assignUserId });
      setAssignDialog(false);
      fetchAll();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (node: DesignationNode, userId: string) => {
    try {
      await api.patch(`/org/designations/${node.id}/unassign`, { userId });
      fetchAll();
    } catch (e) {
      console.error(e);
    }
  };

  // Global (non-branch) root nodes
  const globalRoots = nodes.filter(n => {
    const hasParent = typeof n.parentDesignationId === 'object' ? !!(n.parentDesignationId)?.id : !!n.parentDesignationId;
    const hasBranch = typeof n.branchId === 'object' ? !!(n.branchId)?.id : !!n.branchId;
    return !hasParent && !hasBranch;
  });
  const assignedUserIds = new Set(nodes.flatMap(n => (n.filledBy || []).map(u => u.id)));
  const unassignedUsers = allUsers.filter(u => !assignedUserIds.has(u.id));

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading org chart...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Organisation Chart</h2>
          <p className="text-sm text-muted-foreground">
            Build the designation hierarchy. Branches have their own position trees.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:flex sm:flex-row gap-2">
          <Button size="sm" variant="outline" onClick={() => setSubDeptDialog(true)} className="w-full sm:w-auto">
            <Layers className="h-4 w-4 mr-1" /> Sub-Dept
          </Button>
          <Button size="sm" variant="outline" onClick={fetchAll} className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => openCreate()} className="col-span-2 sm:col-span-1 w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-1" /> Add Position
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-cyan-200 inline-block" /> Branch position</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-200 inline-block" /> Vacant slots</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-200 inline-block" /> Fully filled</span>
        <span className="flex items-center gap-1"><Edit2 className="h-3 w-3" /> Hover a box to edit/add child/delete</span>
      </div>

      {/* Global org chart */}
      {globalRoots.length > 0 && (
        <div className="overflow-auto border rounded-xl bg-gray-50 p-4 sm:p-8">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-6 text-center">
            Organisation — Head Office
          </p>
          <div className="inline-flex gap-12 justify-center min-w-full pb-4">
            {globalRoots.map(root => (
              <OrgNode key={root.id} node={root} allNodes={nodes} allUsers={allUsers} allDepts={allDepts}
                onEdit={openEdit} onDelete={handleDelete} onAssign={openAssign}
                onUnassign={handleUnassign} onAddChild={openCreate} />
            ))}
          </div>
        </div>
      )}

      {globalRoots.length === 0 && allBranches.length === 0 && (
        <div className="border-2 border-dashed rounded-xl p-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">No positions defined yet.</p>
          <p className="text-sm text-muted-foreground mb-6">
            Start by adding the top-level position (e.g. "CEO"), then add positions below it.
            Create branches in the Branches tab to add branch-specific hierarchies.
          </p>
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4 mr-2" /> Add First Position
          </Button>
        </div>
      )}

      {/* Branch sections */}
      {allBranches.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Branch Hierarchies ({allBranches.length})
          </p>
          {allBranches.map(branch => (
            <BranchSection
              key={branch.id}
              branch={branch}
              allNodes={nodes}
              allUsers={allUsers}
              allDepts={allDepts}
              onEdit={openEdit}
              onDelete={handleDelete}
              onAssign={openAssign}
              onUnassign={handleUnassign}
              onAddChild={openCreate}
              onAddBranchPosition={openCreateForBranch}
            />
          ))}
        </div>
      )}

      {/* Unassigned users */}
      {unassignedUsers.length > 0 && (
        <div className="border rounded-xl p-4 bg-amber-50">
          <p className="text-sm font-semibold text-amber-700 mb-2">
            {unassignedUsers.length} people not yet placed in the chart
          </p>
          <div className="flex flex-wrap gap-2">
            {unassignedUsers.map(u => (
              <span key={u.id} className="text-xs bg-white border rounded-full px-3 py-1 flex items-center gap-1">
                <span className="w-4 h-4 rounded-full inline-flex items-center justify-center text-white text-[9px] font-bold"
                  style={{ background: ROLE_COLORS[u.role] || '#6366f1' }}>
                  {u.name.charAt(0)}
                </span>
                {u.name}
                <span className="text-gray-400">({(u.designation || u.role).replace(/_/g, ' ')})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Create / Edit Designation Dialog ── */}
      <Dialog open={designDialog} onOpenChange={setDesignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingNode ? 'Edit Position' : 'Add Position'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Position Title *</Label>
              <Input placeholder="e.g. CEO, Branch Manager, Sales Executive"
                value={designForm.title}
                onChange={e => setDesignForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Level (1 = top)</Label>
                <Input type="number" min={1} value={designForm.level}
                  onChange={e => setDesignForm(p => ({ ...p, level: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Max Headcount</Label>
                <Input type="number" min={1} value={designForm.maxHeadcount}
                  onChange={e => setDesignForm(p => ({ ...p, maxHeadcount: e.target.value }))} />
              </div>
            </div>

            {/* Branch selector */}
            <div className="space-y-1">
              <Label>Branch (leave empty for head office)</Label>
              <Select value={designForm.branchId || '__none__'}
                onValueChange={v => setDesignForm(p => ({ ...p, branchId: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Head office / global" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Head office / global</SelectItem>
                  {allBranches.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} [{b.code}] — {b.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Department</Label>
              <Select value={designForm.departmentId || '__none__'}
                onValueChange={v => setDesignForm(p => ({
                  ...p, departmentId: v === '__none__' ? '' : v, subDepartmentId: '',
                }))}>
                <SelectTrigger><SelectValue placeholder="Select department..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {allDepts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {designForm.departmentId && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label>Sub-Department</Label>
                  <button type="button"
                    onClick={() => { setSubDeptForm({ name: '', parentDeptId: designForm.departmentId }); setSubDeptDialog(true); }}
                    className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                    <Plus className="h-3 w-3" /> New
                  </button>
                </div>
                <Select value={designForm.subDepartmentId || '__none__'}
                  onValueChange={v => setDesignForm(p => ({ ...p, subDepartmentId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select sub-department..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {filteredSubDepts.map(sd => (
                      <SelectItem key={sd.id} value={sd.id}>{sd.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filteredSubDepts.length === 0 && (
                  <p className="text-xs text-muted-foreground">No sub-departments for this department yet.</p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label>Reports To (parent position)</Label>
              <Select value={designForm.parentDesignationId || '__none__'}
                onValueChange={v => setDesignForm(p => ({ ...p, parentDesignationId: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="None (top-level)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (top-level)</SelectItem>
                  {nodes
                    .filter(n => n.id !== editingNode?.id)
                    .map(n => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.title}{n.branchId ? ` [${n.branchId.code}]` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDesignDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveDesignation} disabled={saving || !designForm.title}>
              {saving ? 'Saving...' : editingNode ? 'Save Changes' : 'Create Position'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Sub-Department Dialog ── */}
      <Dialog open={subDeptDialog} onOpenChange={setSubDeptDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Sub-Department</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input placeholder="e.g. Admissions, Accounts Payable"
                value={subDeptForm.name}
                onChange={e => setSubDeptForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Parent Department *</Label>
              <Select value={subDeptForm.parentDeptId || '__none__'}
                onValueChange={v => setSubDeptForm(p => ({ ...p, parentDeptId: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Select department..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select...</SelectItem>
                  {allDepts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubDeptDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateSubDept}
              disabled={subDeptSaving || !subDeptForm.name || !subDeptForm.parentDeptId}>
              {subDeptSaving ? 'Creating...' : 'Create Sub-Department'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign User Dialog ── */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to "{assignTarget?.title}"
              {assignTarget?.branchId && (
                <span className="text-sm font-normal text-cyan-600 ml-2">
                  [{assignTarget.branchId.code}]
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {(assignTarget?.maxHeadcount || 1) - (assignTarget?.filledBy?.length || 0)} slot(s) available
            </p>
            <div className="space-y-1">
              <Label>Select Person</Label>
              <Select value={assignUserId} onValueChange={setAssignUserId}>
                <SelectTrigger><SelectValue placeholder="Choose a person..." /></SelectTrigger>
                <SelectContent>
                  {allUsers
                    .filter(u => !assignTarget?.filledBy?.find(f => f.id === u.id))
                    .map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} — {u.designation || u.role.replace(/_/g, ' ')} {u.userId ? `(${u.userId})` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={saving || !assignUserId}>
              {saving ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
