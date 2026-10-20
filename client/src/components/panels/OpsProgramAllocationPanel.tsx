import { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Center { id: string; name: string; code: string; }
interface Program { id: string; name: string; code: string; courseType?: string; }
interface University { id: string; name: string; code: string; }
interface Allocation { id: string; programId: string; program: Program; allocatedAt: string; isActive: boolean; }
interface UniAllocation { id: string; universityId: string; university: University; allocatedAt: string; }

export function OpsProgramAllocationPanel() {
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenter, setSelectedCenter] = useState('');
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [uniAllocations, setUniAllocations] = useState<UniAllocation[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(false);
  const [uniOpen, setUniOpen] = useState(false);
  const [selectedUniversity, setSelectedUniversity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'programs' | 'universities'>('programs');

  useEffect(() => {
    api.get('/operations/centers').then(r => setCenters(r.data.data || [])).catch(() => {});
    api.get('/operations/programs').then(r => setPrograms(r.data.data || [])).catch(() => {});
    api.get('/operations/universities?status=active').then(r => setUniversities(r.data.data || [])).catch(() => {});
  }, []);

  const fetchAllocations = async (centerId: string) => {
    if (!centerId) return;
    setLoading(true);
    try {
      const [progRes, uniRes] = await Promise.all([
        api.get(`/operations/centers/${centerId}/allocations`),
        api.get(`/operations/centers/${centerId}/uni-allocations`),
      ]);
      setAllocations(progRes.data.data || []);
      setUniAllocations(uniRes.data.data || []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load allocations');
    } finally {
      setLoading(false);
    }
  };

  const handleCenterChange = (id: string) => {
    setSelectedCenter(id);
    fetchAllocations(id);
  };

  const handleProgramStatus = async (program: Program, allocation?: Allocation) => {
    if (!selectedCenter) return;
    setSubmitting(true);
    try {
      if (!allocation) {
        await api.post(`/operations/centers/${selectedCenter}/allocations`, { programId: program.id });
        toast.success('Program allocated and activated');
      } else {
        const isActive = !allocation.isActive;
        await api.put(`/operations/centers/${selectedCenter}/allocations/${allocation.id}`, { isActive });
        toast.success(`Program ${isActive ? 'activated' : 'deactivated'}`);
      }
      await fetchAllocations(selectedCenter);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update program allocation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAllocateUniversity = async () => {
    if (!selectedUniversity) { toast.error('Select a university'); return; }
    setSubmitting(true);
    try {
      await api.post(`/operations/centers/${selectedCenter}/uni-allocations`, { universityId: selectedUniversity });
      toast.success('University allocated');
      setUniOpen(false);
      setSelectedUniversity('');
      fetchAllocations(selectedCenter);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to allocate university');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (allocId: string) => {
    try {
      await api.delete(`/operations/centers/${selectedCenter}/allocations/${allocId}`);
      toast.success('Allocation removed');
      fetchAllocations(selectedCenter);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to remove');
    }
  };

  const handleRemoveUniversity = async (allocId: string) => {
    try {
      await api.delete(`/operations/centers/${selectedCenter}/uni-allocations/${allocId}`);
      toast.success('University allocation removed');
      fetchAllocations(selectedCenter);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to remove university');
    }
  };

  const allocatedUniIds = uniAllocations.map(a => a.universityId);
  const availableUniversities = universities.filter(u => !allocatedUniIds.includes(u.id));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Allocations</h2>
        <p className="text-muted-foreground text-sm mt-1">Manage the programs and universities available to each study center.</p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={selectedCenter} onValueChange={handleCenterChange}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select a study center" />
          </SelectTrigger>
          <SelectContent>
            {centers.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedCenter && (
          <>
            <Button variant="outline" size="sm" onClick={() => fetchAllocations(selectedCenter)} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </Button>
            {activeSubTab === 'universities' && (
              <Button size="sm" onClick={() => setUniOpen(true)} disabled={availableUniversities.length === 0}>
                <Plus className="w-4 h-4 mr-2" />Add University
              </Button>
            )}
          </>
        )}
      </div>

      {selectedCenter && (
        <>
          {/* Sub tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveSubTab('programs')}
              className={cn(
                'px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors',
                activeSubTab === 'programs' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Program Allocations
            </button>
            <button
              onClick={() => setActiveSubTab('universities')}
              className={cn(
                'px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors',
                activeSubTab === 'universities' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              University Allocations
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : activeSubTab === 'programs' ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Programs ({programs.length})</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Activate programs to make them available in the selected study center.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {programs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No programs are available to allocate.</p>
                ) : programs.map(program => {
                  const allocation = allocations.find(item => item.programId === program.id);
                  return (
                    <div key={program.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40">
                      <div>
                        <span className="font-medium text-sm">{program.name}</span>
                        <span className="text-muted-foreground text-xs ml-2">({program.code})</span>
                        {program.courseType && (
                          <Badge variant="outline" className="ml-2 text-[10px]">{program.courseType}</Badge>
                        )}
                        <div className="mt-1">
                          <Badge variant={allocation?.isActive ? 'default' : 'secondary'}>
                            {allocation?.isActive ? 'Active' : allocation ? 'Inactive' : 'Not allocated'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant={allocation?.isActive ? 'outline' : 'default'}
                          disabled={submitting}
                          onClick={() => handleProgramStatus(program, allocation)}
                        >
                          {!allocation ? 'Allocate' : allocation.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        {allocation && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-error hover:text-error"
                            onClick={() => handleRemove(allocation.id)}
                            title="Remove allocation"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : (
            uniAllocations.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
                No universities allocated yet.
              </CardContent></Card>
            ) : (
              <Card>
                <CardHeader><CardTitle className="text-base">Allocated Universities ({uniAllocations.length})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {uniAllocations.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                      <div>
                        <span className="font-medium text-sm">{a.university?.name}</span>
                        <span className="text-muted-foreground text-xs ml-2">({a.university?.code})</span>
                      </div>
                      <Button variant="ghost" size="sm" className="text-error hover:text-error" onClick={() => handleRemoveUniversity(a.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          )}
        </>
      )}

      {/* University Allocation Dialog */}
      <Dialog open={uniOpen} onOpenChange={setUniOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Allocate University</DialogTitle></DialogHeader>
          <div className="py-2">
            <Select value={selectedUniversity} onValueChange={setSelectedUniversity}>
              <SelectTrigger>
                <SelectValue placeholder="Select a university" />
              </SelectTrigger>
              <SelectContent>
                {availableUniversities.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name} ({u.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUniOpen(false); setSelectedUniversity(''); }}>Cancel</Button>
            <Button onClick={handleAllocateUniversity} disabled={submitting || !selectedUniversity}>
              {submitting ? 'Allocating...' : 'Allocate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
