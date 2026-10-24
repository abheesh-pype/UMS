import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Center { id: string; name: string; code: string; }
interface Program {
  id: string;
  name: string;
  code: string;
  courseType?: string;
  universityId?: string;
  academicSessionId?: string | null;
  admissionSessions?: { id: string }[];
}
interface University { id: string; name: string; code: string; }
interface AdmissionSession { id: string; name: string; programId?: string | null; universityId?: string | null; status: string; }
interface Allocation { id: string; programId: string; program: Program; admissionSessionId?: string | null; admissionSession?: AdmissionSession | null; allocatedAt: string; isActive: boolean; }

export function OpsProgramAllocationPanel() {
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenter, setSelectedCenter] = useState('');
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [sessions, setSessions] = useState<AdmissionSession[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'programs' | 'universities'>('programs');

  useEffect(() => {
    Promise.all([
      api.get('/operations/centers'),
      api.get('/operations/programs'),
      api.get('/operations/universities?status=all'),
      api.get('/operations/sessions'),
    ]).then(([centerRes, programRes, universityRes, sessionRes]) => {
      setCenters(centerRes.data.data || []);
      setPrograms(programRes.data.data || []);
      setUniversities(universityRes.data.data || []);
      setSessions(sessionRes.data.data || []);
    }).catch((error: any) => {
      toast.error(error.response?.data?.message || 'Failed to load allocation data');
    });
  }, []);

  const fetchAllocations = async (centerId: string) => {
    if (!centerId) return;
    setLoading(true);
    try {
      const progRes = await api.get(`/operations/centers/${centerId}/allocations`);
      setAllocations(progRes.data.data || []);
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

  const handleProgramAllocation = async (program: Program, session: AdmissionSession, allocation?: Allocation) => {
    if (!selectedCenter) return;
    setSubmitting(true);
    try {
      if (!allocation) {
        await api.post(`/operations/centers/${selectedCenter}/allocations`, {
          programId: program.id,
          admissionSessionId: session.id,
        });
        toast.success('Program session allocated');
      } else {
        await api.delete(`/operations/centers/${selectedCenter}/allocations/${allocation.id}`);
        toast.success('Program session allocation removed');
      }
      await fetchAllocations(selectedCenter);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to change program allocation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProgramActiveStatus = async (allocation: Allocation) => {
    setSubmitting(true);
    try {
      const isActive = !allocation.isActive;
      await api.put(`/operations/centers/${selectedCenter}/allocations/${allocation.id}`, { isActive });
      toast.success(`Program ${isActive ? 'activated' : 'deactivated'}`);
      await fetchAllocations(selectedCenter);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update program status');
    } finally {
      setSubmitting(false);
    }
  };

  const sessionGroups = sessions.map(session => ({
    session,
    programs: programs.filter(program =>
      program.id === session.programId
      || program.academicSessionId === session.id
      || program.admissionSessions?.some(admissionSession => admissionSession.id === session.id)
    ),
  }));
  const universityAllocationGroups = universities
    .map(university => ({
      university,
      allocations: allocations.filter(allocation => allocation.program?.universityId === university.id),
    }))
    .filter(group => group.allocations.length > 0);

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
                <CardTitle className="text-base">Programs by Admission Session ({sessionGroups.reduce((total, group) => total + group.programs.length, 0)})</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Allocate each program for the admission session in which it is offered.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {programs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No programs are available to allocate.</p>
                ) : (
                  <>
                    {sessionGroups.map(({ session, programs: sessionPrograms }) => (
                      <section key={session.id} className="space-y-2">
                        <div className="flex items-center gap-2 border-b pb-2">
                          <h3 className="font-semibold text-sm">{session.name}</h3>
                          <Badge variant="outline" className="text-[10px]">{session.status}</Badge>
                        </div>
                        {sessionPrograms.length === 0 ? (
                          <p className="py-2 text-sm text-muted-foreground">No programs are assigned to this session.</p>
                        ) : sessionPrograms.map(program => {
                          const allocation = allocations.find(item =>
                            item.programId === program.id && item.admissionSessionId === session.id
                          );
                          return (
                            <div key={`${session.id}:${program.id}`} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40">
                              <div>
                                <span className="font-medium text-sm">{program.name}</span>
                                <span className="text-muted-foreground text-xs ml-2">({program.code})</span>
                                {program.courseType && <Badge variant="outline" className="ml-2 text-[10px]">{program.courseType}</Badge>}
                                <div className="mt-1">
                                  <Badge variant={allocation?.isActive ? 'default' : 'secondary'}>
                                    {allocation?.isActive ? 'Active' : allocation ? 'Inactive' : 'Not allocated'}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant={allocation ? 'outline' : 'default'}
                                  disabled={submitting}
                                  onClick={() => handleProgramAllocation(program, session, allocation)}
                                >
                                  {allocation ? 'Not Allocate' : 'Allocate'}
                                </Button>
                                {allocation && (
                                  <Button
                                    size="sm"
                                    variant={allocation.isActive ? 'default' : 'outline'}
                                    disabled={submitting}
                                    onClick={() => handleProgramActiveStatus(allocation)}
                                  >
                                    {allocation.isActive ? 'Active' : 'Inactive'}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </section>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            universityAllocationGroups.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
                No programs are allocated to this study centre yet.
              </CardContent></Card>
            ) : (
              <div className="space-y-4">
                {universityAllocationGroups.map(({ university, allocations: universityAllocations }) => (
                  <Card key={university.id}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {university.name}{university.code ? ` (${university.code})` : ''}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {universityAllocations.map(allocation => (
                        <div key={allocation.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40">
                          <div>
                            <span className="font-medium text-sm">{allocation.program.name}</span>
                            <span className="text-muted-foreground text-xs ml-2">({allocation.program.code})</span>
                            {allocation.admissionSession?.name && (
                              <span className="text-muted-foreground text-xs ml-2">{allocation.admissionSession.name}</span>
                            )}
                          </div>
                          <Badge variant={allocation.isActive ? 'default' : 'secondary'}>
                            {allocation.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
