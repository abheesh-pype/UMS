import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ExportCandidateDialog } from '@/components/dialogs/ExportCandidateDialog';

const ALL = 'all';

const isInSession = (student: any, sessionId: string) => student.sessionId === sessionId
  || (student.enrollments || []).some((enrollment: any) => enrollment.sessionId === sessionId);

function FilterSelect({ label, value, onChange, options, allLabel, disabled, placeholder }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
  allLabel: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map(option => (
            <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AcademicStudentsPanel() {
  const [students, setStudents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sessionId, setSessionId] = useState(ALL);
  const [programId, setProgramId] = useState(ALL);
  const [semesterId, setSemesterId] = useState(ALL);
  const [moduleId, setModuleId] = useState(ALL);
  const [exportingStudent, setExportingStudent] = useState<any | null>(null);
  const [candidateIds, setCandidateIds] = useState<Record<string, string>>({});

  const fetchData = async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [studentsResponse, sessionsResponse, programsResponse] = await Promise.all([
        api.get('/students', { params: { status: 'active' } }),
        api.get('/operations/sessions'),
        api.get('/operations/programs'),
      ]);
      setStudents(studentsResponse.data.data || []);
      setSessions(sessionsResponse.data.data || []);
      setPrograms(programsResponse.data.data || []);
    } catch (error: any) {
      setLoadFailed(true);
      toast.error(error.response?.data?.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setSemesters([]);
    if (programId === ALL) return;
    let cancelled = false;
    api.get(`/operations/programs/${programId}/semesters`)
      .then(response => { if (!cancelled) setSemesters(response.data.data || []); })
      .catch((error: any) => { if (!cancelled) toast.error(error.response?.data?.message || 'Failed to load semesters'); });
    return () => { cancelled = true; };
  }, [programId]);

  useEffect(() => {
    setModules([]);
    if (programId === ALL || semesterId === ALL) return;
    let cancelled = false;
    api.get(`/operations/programs/${programId}/modules`, { params: { semesterId } })
      .then(response => { if (!cancelled) setModules(response.data.data || []); })
      .catch((error: any) => { if (!cancelled) toast.error(error.response?.data?.message || 'Failed to load modules'); });
    return () => { cancelled = true; };
  }, [programId, semesterId]);

  const isProgramInSession = (program: any, id: string) => program.academicSessionId === id
    || (program.admissionSessions || []).some((session: any) => session.id === id);

  const programOptions = useMemo(() => programs.filter(program => sessionId === ALL || isProgramInSession(program, sessionId)), [programs, sessionId]);

  const semesterOptions = useMemo(() => semesters
    .filter(semester => sessionId === ALL || semester.academicSessionId === sessionId)
    .sort((a, b) => a.semesterNumber - b.semesterNumber), [semesters, sessionId]);

  const selectedSemester = semesters.find(semester => semester.id === semesterId);
  const selectedModule = modules.find(module => module.id === moduleId);

  // A student's record holds their program and session, not a semester or module. So a semester or module
  // narrows the list to the students of the program and session it belongs to.
  const filteredStudents = useMemo(() => students.filter(student => {
    if (sessionId !== ALL && !isInSession(student, sessionId)) return false;
    if (programId !== ALL && student.program?.id !== programId) return false;
    if (selectedSemester && !isInSession(student, selectedSemester.academicSessionId)) return false;
    if (selectedModule?.academicSessionId && !isInSession(student, selectedModule.academicSessionId)) return false;
    return true;
  }), [students, sessionId, programId, selectedSemester, selectedModule]);

  const hasFilters = sessionId !== ALL || programId !== ALL;

  const changeSession = (value: string) => {
    setSessionId(value);
    const program = programs.find(item => item.id === programId);
    if (value !== ALL && program && !isProgramInSession(program, value)) setProgramId(ALL);
    setSemesterId(ALL);
    setModuleId(ALL);
  };
  const changeProgram = (value: string) => {
    setProgramId(value);
    setSemesterId(ALL);
    setModuleId(ALL);
  };
  const changeSemester = (value: string) => {
    setSemesterId(value);
    setModuleId(ALL);
  };
  const clearFilters = () => {
    changeSession(ALL);
    setProgramId(ALL);
  };

  return (
    <Card>
      <CardHeader className="pt-6">
        <CardTitle>Students</CardTitle>
        <CardDescription>All active students</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pb-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FilterSelect
            label="Session"
            value={sessionId}
            onChange={changeSession}
            allLabel="All Sessions"
            options={sessions.map(session => ({ id: session.id, name: session.name }))}
          />
          <FilterSelect
            label="Program"
            value={programId}
            onChange={changeProgram}
            allLabel="All Programs"
            options={programOptions.map(program => ({ id: program.id, name: program.name }))}
          />
          <FilterSelect
            label="Semester"
            value={semesterId}
            onChange={changeSemester}
            allLabel={programId === ALL ? 'Select a program first' : 'All Semesters'}
            disabled={programId === ALL}
            options={semesterOptions.map(semester => ({ id: semester.id, name: semester.semesterName || `Semester ${semester.semesterNumber}` }))}
          />
          <FilterSelect
            label="Module"
            value={moduleId}
            onChange={setModuleId}
            allLabel={semesterId === ALL ? 'Select a semester first' : 'All Modules'}
            disabled={semesterId === ALL}
            options={modules.map(module => ({ id: module.id, name: module.moduleCode ? `${module.moduleCode} - ${module.moduleName}` : module.moduleName }))}
          />
        </div>

        {(semesterId !== ALL || moduleId !== ALL) && (
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Students are not assigned to a semester or module individually. This list shows the students of the program and session this {moduleId !== ALL ? 'module' : 'semester'} belongs to.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">
            {loading ? 'Loading students...' : `Showing ${filteredStudents.length} of ${students.length} active student${students.length === 1 ? '' : 's'}`}
          </p>
          {hasFilters && <Button variant="outline" size="sm" onClick={clearFilters}>Clear Filters</Button>}
        </div>

        {loadFailed ? (
          <div className="py-8 text-center">
            <p className="text-sm text-destructive">The students could not be loaded.</p>
            <Button className="mt-3" variant="outline" onClick={fetchData}>Try again</Button>
          </div>
        ) : !loading && filteredStudents.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {students.length === 0 ? 'There are no active students.' : 'No active students match these filters.'}
          </p>
        ) : !loading && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Enrollment No</th>
                  <th className="px-4 py-3 font-medium">Program</th>
                  <th className="px-4 py-3 font-medium">Session</th>
                  <th className="px-4 py-3 font-medium">Study Center</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Exam Portal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredStudents.map(student => (
                  <tr key={student.id}>
                    <td className="px-4 py-3 font-medium">{student.name}</td>
                    <td className="whitespace-nowrap px-4 py-3">{student.enrollmentNo}</td>
                    <td className="px-4 py-3">{student.program?.name || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{student.activeSession?.name || '—'}</td>
                    <td className="px-4 py-3">{student.center?.name || 'Direct admission'}</td>
                    <td className="px-4 py-3">
                      <p className="break-all">{student.email}</p>
                      {student.phone && <p className="text-xs text-muted-foreground">{student.phone}</p>}
                    </td>
                    <td className="px-4 py-3"><Badge>Active</Badge></td>
                    <td className="px-4 py-3">
                      <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => setExportingStudent(student)}>Export Candidate</Button>
                      {candidateIds[student.id] && <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">Candidate ID: {candidateIds[student.id]}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {exportingStudent && (
          <ExportCandidateDialog
            student={exportingStudent}
            onClose={() => setExportingStudent(null)}
            onExported={candidateId => setCandidateIds(current => ({ ...current, [exportingStudent.id]: candidateId }))}
          />
        )}
      </CardContent>
    </Card>
  );
}
