import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Building2, GitBranch, Globe, Lock } from 'lucide-react';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
// Card import removed — using custom sections instead
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';

interface Branch { id: string; name: string; code: string; }
interface University {
  id: string; name: string; code: string; address?: string;
  contact?: string; status: string; coordinatorName?: string;
  category?: string; optionalFields?: unknown;
  allowedBranchIds: Branch[];
}

export function UniversitiesPanel() {
  const { user } = useAuth();
  const isOrgAdmin = ['org_admin', 'superadmin'].includes(user?.role || '');

  const [universities, setUniversities] = useState<University[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '', code: '', address: '', contact: '', coordinatorName: '', status: 'active', category: 'team_lease', optionalFields: ''
  });
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [accessMode, setAccessMode] = useState<'all' | 'exclusive' | 'multi'>('all');

  const fetchUniversities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/operations/universities');
      setUniversities(res.data.data || []);
    } catch {
      toast.error('Failed to fetch universities');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await api.get('/org/branches');
      setBranches(res.data.data || []);
    } catch {
      toast.error('Failed to fetch branches');
    }
  }, []);

  useEffect(() => {
    fetchUniversities();
    if (isOrgAdmin) fetchBranches();
  }, [isOrgAdmin, fetchUniversities, fetchBranches]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        optionalFields: formData.optionalFields ? JSON.stringify(formData.optionalFields.split(',').map(s => s.trim())) : null,
        allowedBranchIds: selectedBranchIds,
      };
      if (editingId) {
        await api.put(`/operations/universities/${editingId}`, payload);
      } else {
        await api.post('/operations/universities', payload);
      }
      setDialogOpen(false);
      resetForm();
      fetchUniversities();
    } catch (error) {
      const message = isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      alert(message || 'Failed to save university');
    }
  };

  const handleEdit = (u: University) => {
    setEditingId(u.id);
    let optFieldsStr = '';
    if (u.optionalFields && Array.isArray(u.optionalFields)) {
       optFieldsStr = u.optionalFields.join(', ');
    }
    setFormData({ name: u.name, code: u.code, address: u.address || '', contact: u.contact || '', coordinatorName: u.coordinatorName || '', status: u.status, category: u.category || 'team_lease', optionalFields: optFieldsStr });
    const ids = (u.allowedBranchIds || []).map(b => b.id);
    setSelectedBranchIds(ids);
    if (ids.length === 0) setAccessMode('all');
    else if (ids.length === 1) setAccessMode('exclusive');
    else setAccessMode('multi');
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      code: '',
      address: '',
      contact: '',
      coordinatorName: '',
      status: 'active',
      category: 'team_lease',
      optionalFields: '',
    });
    setSelectedBranchIds([]);
    setAccessMode('all');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">University Management</h2>
          <p className="text-muted-foreground">Manage the single university for this organization</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          {isOrgAdmin && universities.length === 0 && (
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Add University</Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit University' : 'Add New University'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>University Name</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div>
                  <Label>University Code</Label>
                  <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Contact (Phone/Email)</Label>
                  <Input value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} />
                </div>
                <div>
                  <Label>Coordinator Name (optional)</Label>
                  <Input value={formData.coordinatorName} onChange={(e) => setFormData({ ...formData, coordinatorName: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team_lease">Team Lease</SelectItem>
                      <SelectItem value="direct_iits">Direct IITS Payment</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.category === 'premium' && (
                  <div>
                    <Label>Optional Fields (comma-separated)</Label>
                    <Input 
                       placeholder="e.g. abcId, dob, fatherName" 
                       value={formData.optionalFields} 
                       onChange={(e) => setFormData({ ...formData, optionalFields: e.target.value })} 
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">These fields won't be mandatory during enrollment.</p>
                  </div>
                )}
              </div>

              {/* ── Branch Access ── */}
              {isOrgAdmin && branches.length > 0 && (
                <div className="rounded-xl border-2 border-dashed border-cyan-200 bg-cyan-50/40 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-600 flex items-center justify-center">
                      <GitBranch className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-cyan-900">Branch Access Control</p>
                      <p className="text-xs text-cyan-700">Who can see and use this university?</p>
                    </div>
                  </div>

                  {/* Mode cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <button type="button"
                      onClick={() => { setAccessMode('all'); setSelectedBranchIds([]); }}
                      className={`rounded-lg border-2 p-3 text-left transition-all ${
                        accessMode === 'all'
                          ? 'border-green-500 bg-green-50'
                          : 'border-slate-200 bg-white hover:border-green-300'}`}>
                      <Globe className={`h-5 w-5 mb-1 ${accessMode === 'all' ? 'text-green-600' : 'text-slate-400'}`} />
                      <p className={`text-xs font-semibold ${accessMode === 'all' ? 'text-green-700' : 'text-slate-600'}`}>
                        All Branches
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Visible to everyone</p>
                    </button>

                    <button type="button"
                      onClick={() => { setAccessMode('exclusive'); setSelectedBranchIds(selectedBranchIds.slice(0, 1)); }}
                      className={`rounded-lg border-2 p-3 text-left transition-all ${
                        accessMode === 'exclusive'
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-slate-200 bg-white hover:border-amber-300'}`}>
                      <Lock className={`h-5 w-5 mb-1 ${accessMode === 'exclusive' ? 'text-amber-600' : 'text-slate-400'}`} />
                      <p className={`text-xs font-semibold ${accessMode === 'exclusive' ? 'text-amber-700' : 'text-slate-600'}`}>
                        Exclusive
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">One branch only</p>
                    </button>

                    <button type="button"
                      onClick={() => setAccessMode('multi')}
                      className={`rounded-lg border-2 p-3 text-left transition-all ${
                        accessMode === 'multi'
                          ? 'border-cyan-500 bg-cyan-50'
                          : 'border-slate-200 bg-white hover:border-cyan-300'}`}>
                      <GitBranch className={`h-5 w-5 mb-1 ${accessMode === 'multi' ? 'text-cyan-600' : 'text-slate-400'}`} />
                      <p className={`text-xs font-semibold ${accessMode === 'multi' ? 'text-cyan-700' : 'text-slate-600'}`}>
                        Select Branches
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Pick 2 or more</p>
                    </button>
                  </div>

                  {/* All branches — confirmation note */}
                  {accessMode === 'all' && (
                    <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <Globe className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-green-800">
                        This university will be visible and usable by <strong>all branches</strong> in your organisation.
                      </p>
                    </div>
                  )}

                  {/* Exclusive — single branch picker */}
                  {accessMode === 'exclusive' && (
                    <div className="space-y-2">
                      <Select
                        value={selectedBranchIds[0] || '__none__'}
                        onValueChange={v => setSelectedBranchIds(v === '__none__' ? [] : [v])}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Choose the exclusive branch..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Choose a branch —</SelectItem>
                          {branches.map(b => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name} [{b.code}]
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedBranchIds[0] ? (
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
                          <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                          <p className="text-xs text-amber-800">
                            <strong>Exclusive to {branches.find(b => b.id === selectedBranchIds[0])?.name}.</strong>{' '}
                            All other branches will not see this university in their lists.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-600">Select a branch above to make this university exclusive to it.</p>
                      )}
                    </div>
                  )}

                  {/* Multi — checklist */}
                  {accessMode === 'multi' && (
                    <div className="space-y-2">
                      <div className="bg-white border rounded-lg divide-y">
                        {branches.map(b => {
                          const checked = selectedBranchIds.includes(b.id);
                          return (
                            <label key={b.id}
                              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors">
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                checked ? 'bg-cyan-600 border-cyan-600' : 'border-slate-300'}`}
                                onClick={() => setSelectedBranchIds(prev =>
                                  prev.includes(b.id) ? prev.filter(x => x !== b.id) : [...prev, b.id]
                                )}>
                                {checked && <span className="text-white text-[10px] font-bold">✓</span>}
                              </div>
                              <span className="text-sm font-medium">{b.name}</span>
                              <span className="text-xs font-mono text-muted-foreground ml-auto">[{b.code}]</span>
                            </label>
                          );
                        })}
                      </div>
                      {selectedBranchIds.length > 0 ? (
                        <div className="flex items-start gap-2 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2">
                          <GitBranch className="h-4 w-4 text-cyan-600 mt-0.5 shrink-0" />
                          <p className="text-xs text-cyan-800">
                            Accessible by <strong>{selectedBranchIds.length} branch{selectedBranchIds.length > 1 ? 'es' : ''}</strong>.
                            Branches not selected won't see this university.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Check at least one branch.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Save</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Grouped university list ── */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading...</div>
      ) : universities.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No universities found</div>
      ) : (() => {
        // Build groups
        // 1. "All Branches" — universities with no branch restriction
        const globalUnis = universities.filter(u => (u.allowedBranchIds || []).length === 0);

        // 2. Per-branch groups — collect all branches that appear in any university
        const branchMap = new Map<string, { branch: Branch; unis: University[] }>();
        universities.forEach(u => {
          (u.allowedBranchIds || []).forEach(b => {
            if (!branchMap.has(b.id)) branchMap.set(b.id, { branch: b, unis: [] });
            // Only add once per university per branch
            if (!branchMap.get(b.id)!.unis.find(x => x.id === u.id)) {
              branchMap.get(b.id)!.unis.push(u);
            }
          });
        });

        const UniRow = ({ u }: { u: University }) => (
          <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{u.name}</p>
                <p className="text-xs text-muted-foreground">
                  {u.code}{u.contact ? ` • ${u.contact}` : ''}{u.address ? ` • ${u.address}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs bg-slate-50 capitalize">{u.category?.replace('_', ' ') || 'Team Lease'}</Badge>
              <Badge variant={u.status === 'active' ? 'default' : 'secondary'} className="text-xs">{u.status}</Badge>
              {isOrgAdmin && (
                <Button variant="ghost" size="sm" onClick={() => handleEdit(u)}><Edit className="w-3.5 h-3.5" /></Button>
              )}
            </div>
          </div>
        );

        return (
          <div className="space-y-4">
            {/* All-branches section */}
            {globalUnis.length > 0 && (
              <div className="border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b">
                  <Globe className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-700">All Branches</span>
                  <span className="ml-auto text-xs text-muted-foreground">{globalUnis.length} universit{globalUnis.length > 1 ? 'ies' : 'y'}</span>
                </div>
                <div className="divide-y">
                  {globalUnis.map(u => <UniRow key={u.id} u={u} />)}
                </div>
              </div>
            )}

            {/* Per-branch sections */}
            {Array.from(branchMap.values()).map(({ branch, unis }) => (
              <div key={branch.id} className="border-2 rounded-xl overflow-hidden" style={{ borderColor: '#0891b233' }}>
                <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ background: '#0891b211' }}>
                  <div className="w-6 h-6 rounded-lg bg-cyan-600 flex items-center justify-center">
                    <GitBranch className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-cyan-900">{branch.name}</span>
                  <span className="text-xs font-mono text-cyan-600 bg-cyan-100 px-1.5 py-0.5 rounded">{branch.code}</span>
                  {unis.length === 1 && unis[0].allowedBranchIds.length === 1 && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full ml-1">
                      <Lock className="h-2.5 w-2.5" /> Exclusive
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">{unis.length} universit{unis.length > 1 ? 'ies' : 'y'}</span>
                </div>
                <div className="divide-y">
                  {unis.map(u => <UniRow key={u.id} u={u} />)}
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
