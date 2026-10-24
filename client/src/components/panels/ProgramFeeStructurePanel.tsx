import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, IndianRupee, BookOpen, GraduationCap, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ProgramFee {
  id: string;
  level: string; // "program" or "university"
  studyCenterId?: string | null;
  programId?: { id: string; name: string; code: string; universityId: any;
  duration?: number; specialisations?: any } | string | null;
  universityId?: { id: string; name: string } | string | null;
  admissionSessionId?: { id: string; name: string } | string | null;
  baseFee: number;
  fullProgramFee?: number;
  yearlyFee?: number | null;
  semesterFee?: number | null;
  semesterFees?: number[] | null;
  additionalFees: { label: string; amount: number }[];
  feeBreakdown?: any[];
  currency: string;
  effectiveFrom: string;
  billingCycle?: string;
  examFee?: number;
  gstPercentage?: number;
  universityFee?: number;
  commissionRate?: number;
}

interface University {
  id: string;
  name: string;
  code?: string;
}

interface Program {
  id: string;
  name: string;
  code: string;
  status?: string;
  universityId: any;
  academicSessionId?: string | null;
  admissionSessions?: { id: string }[];
  semesterRecords?: {
    id: string;
    semesterName: string;
    semesterNumber: number;
    academicSessionId: string;
  }[];
  duration?: number;
  hasSemesters?: boolean;
  semesters?: ({ number: number; name: string } | string)[];
  specialisations?: string[];
}

interface AdmissionSession {
  id: string;
  name: string;
  programId?: string | null;
  universityId?: string | null;
  status?: string;
}

interface StudyCenter {
  id: string;
  name: string;
  code?: string;
  universityIds?: string[];
  programIds?: string[];
  programAllocations?: {
    id: string;
    centerId: string;
    programId: string;
    isActive: boolean;
    admissionSessionId?: string | null;
    admissionSession?: { id: string; name: string; status: string } | null;
  }[];
}

export function ProgramFeeStructurePanel() {
  const { user } = useAuth();
  const [fees, setFees] = useState<ProgramFee[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [centers, setCenters] = useState<StudyCenter[]>([]);
  const [sessions, setSessions] = useState<AdmissionSession[]>([]);
  const [selectedUniversityId, setSelectedUniversityId] = useState<string>('');
  const [selectedCenterId, setSelectedCenterId] = useState<string>('');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [selectedAdmissionSessionId, setSelectedAdmissionSessionId] = useState<string>('');
  const [feeView, setFeeView] = useState<'center' | 'university'>('center');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProgramFee | null>(null);
  const [configuringUniversityFee, setConfiguringUniversityFee] = useState(false);
  
  // Dialog state for adding a program
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [subDepartments, setSubDepartments] = useState<{ id: string; name: string }[]>([]);
  const [specInput, setSpecInput] = useState('');
  
  const [newProgramForm, setNewProgramForm] = useState({
    name: '',
    code: '',
    universityId: '',
    subDepartmentId: '',
    courseType: 'Online Degree',
    duration: 12,
    status: 'active',
    hasSemesters: false,
    specialisations: [] as string[]
  });

  const [form, setForm] = useState({ 
    level: 'program',
    programId: '', 
    studyCenterId: '',
    universityId: '',
    admissionSessionId: '',
    billingCycle: 'per_year', 
    currency: 'INR', 
    effectiveFrom: '', 
    additionalFees: '',
    feeBreakdown: [] as any[],
    baseFee: '0',
    universityFee: '0',
    fullProgramFee: '0',
    yearlyFee: '0',
    semesterFee: '0',
    semesterFees: [] as string[],
  });

  
  useEffect(() => {
    if (form.level !== 'university') return;
    let dur = 36; // Default to 3 years
    
    if (!form.programId) return;
    const prog = programs.find(p => p.id === form.programId);
    if (prog) dur = prog.duration || 36;

    let numBlocks = 1;
    if (form.billingCycle === 'per_year') numBlocks = Math.max(1, Math.floor(dur / 12));
    else if (form.billingCycle === 'per_semester') numBlocks = Math.max(1, Math.floor(dur / 6));
    
    setForm(prev => {
       const newBreakdown = [...prev.feeBreakdown];
       while (newBreakdown.length < numBlocks) {
         newBreakdown.push({
           year: newBreakdown.length + 1,
           baseFee: '0',
           universityFee: '0',
           examFee: '0',
           commissionRate: '0',
           dueDate: '',
           additionalFees: ''
         });
       }
       if (newBreakdown.length > numBlocks) {
         newBreakdown.length = numBlocks;
       }
       if (newBreakdown.length !== prev.feeBreakdown.length) {
           return { ...prev, feeBreakdown: newBreakdown };
       }
       return prev;
    });
  }, [form.programId, form.billingCycle, programs, form.level]);

  const handleBreakdownChange = (idx: number, field: string, value: string) => {
    setForm(prev => {
      const newBreakdown = [...prev.feeBreakdown];
      newBreakdown[idx] = { ...newBreakdown[idx], [field]: value };
      return { ...prev, feeBreakdown: newBreakdown };
    });
  };

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [feesRes, progsRes, unisRes, sessionsRes, subDeptsRes, centersRes] = await Promise.all([
        api.get('/finance/program-fees'),
        api.get('/operations/programs'),
        api.get('/operations/universities'),
        api.get('/operations/sessions').catch(() => ({ data: { data: [] } })),
        api.get('/sub-departments').catch(() => ({ data: { data: [] } })),
        api.get('/operations/centers?status=all'),
      ]);
      const fetchedFees = feesRes.data.data || [];
      const fetchedPrograms = progsRes.data.data || [];
      const fetchedUnis: University[] = unisRes.data.data || [];
      const fetchedSessions = sessionsRes.data.data || [];
      const fetchedSubDepts = subDeptsRes.data.data || [];
      const fetchedCenters: StudyCenter[] = centersRes.data.data || [];

      setFees(fetchedFees);
      setPrograms(fetchedPrograms);
      setUniversities(fetchedUnis);
      setSessions(fetchedSessions);
      setSubDepartments(fetchedSubDepts);
      setCenters(fetchedCenters);
      setSelectedCenterId(previous => (
        previous && fetchedCenters.some(center => center.id === previous)
          ? previous
          : ''
      ));
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Keep the selected center's university as the context for fee creation.
  useEffect(() => {
    if (feeView !== 'center') return;
    const center = centers.find(item => item.id === selectedCenterId);
    const centerUniversityId = center?.universityIds?.find(id => universities.some(university => university.id === id));
    const userUniversityId = (user as any)?.universityId;
    const universityId = centerUniversityId
      || (userUniversityId && universities.some(university => university.id === userUniversityId) ? userUniversityId : '')
      || '';
    if (universityId && universityId !== selectedUniversityId) setSelectedUniversityId(universityId);
  }, [centers, selectedCenterId, universities, selectedUniversityId, user, feeView]);

  const openCreate = () => {
    setEditing(null);
    const selectedProgram = programs.find(program => program.id === selectedProgramId);
    const semesterCount = getSemesterCount(selectedProgram, selectedAdmissionSessionId);
    const programUniversityId = typeof selectedProgram?.universityId === 'object'
      ? selectedProgram.universityId?.id
      : selectedProgram?.universityId;
    const activeUniId = programUniversityId || selectedUniversityId || (user as any)?.universityId || (universities[0]?.id || '');
    const isUniversityFee = feeView === 'university';
    setConfiguringUniversityFee(isUniversityFee);
    setForm({ 
      level: isUniversityFee ? 'university' : 'program',
      programId: selectedProgramId, 
      studyCenterId: isUniversityFee ? '' : selectedCenterId,
      universityId: activeUniId,
      admissionSessionId: isUniversityFee ? 'all' : selectedAdmissionSessionId || '',
      billingCycle: 'per_year', 
      currency: 'INR', 
      effectiveFrom: '', 
      additionalFees: '',
      feeBreakdown: [],
      baseFee: 0,
      universityFee: 0,
      fullProgramFee: 0,
      yearlyFee: 0,
      semesterFee: 0,
      semesterFees: Array.from({ length: semesterCount }, () => '0'),
    });
    setOpen(true);
  };

  const openEdit = (fee: ProgramFee) => {
    setEditing(fee);
    setConfiguringUniversityFee(fee.level === 'university');
    
    const otherFees = fee.additionalFees?.filter(
      f => !['registration fee', 'exam fee', 'gst'].includes(f.label.toLowerCase())
    ) || [];

    const progId = typeof fee.programId === 'object' ? fee.programId?.id : fee.programId;
    const uniId = typeof fee.universityId === 'object' ? fee.universityId?.id : fee.universityId;
    const sessId = typeof fee.admissionSessionId === 'object' ? fee.admissionSessionId?.id : fee.admissionSessionId;
    const activeUniId = uniId || selectedUniversityId || (user as any)?.universityId || (universities[0]?.id || '');
    const selectedProgram = programs.find(program => program.id === progId);
    const fullProgramFee = Number(fee.fullProgramFee || 0);
    const yearlyFee = fee.yearlyFee ?? (fullProgramFee
      ? fullProgramFee / Math.max(1, Math.ceil((selectedProgram?.duration || 12) / 12))
      : fee.baseFee || 0);
    const semesterCount = getSemesterCount(selectedProgram, sessId || '');
    const semesterFee = fee.semesterFee ?? (fullProgramFee && semesterCount > 0
      ? fullProgramFee / semesterCount
      : fee.baseFee || 0);
    const semesterFees = Array.isArray(fee.semesterFees) && fee.semesterFees.length === semesterCount
      ? fee.semesterFees.map(amount => String(amount))
      : Array.from({ length: semesterCount }, () => String(semesterFee || 0));

    let parsedBreakdown = fee.feeBreakdown || [];
    if (typeof parsedBreakdown === 'string') {
      try { parsedBreakdown = JSON.parse(parsedBreakdown); } catch (e) { parsedBreakdown = []; }
    }
    if (Array.isArray(parsedBreakdown) && parsedBreakdown.length > 0) {
       parsedBreakdown = parsedBreakdown.map((b: any) => ({
         year: b.year,
         baseFee: String(b.baseFee || '0'),
         universityFee: String(b.universityFee || '0'),
         examFee: String(b.examFee || '0'),
         commissionRate: String(b.commissionRate || '0'),
         dueDate: b.dueDate || '',
         additionalFees: b.additionalFees || ''
       }));
    }

    setForm({
      level: fee.level || 'program',
      programId: progId || '',
      studyCenterId: fee.studyCenterId || '',
      universityId: activeUniId,
      admissionSessionId: sessId || 'all',
      billingCycle: fee.billingCycle || 'per_year',
      currency: fee.currency || 'INR',
      effectiveFrom: fee.effectiveFrom ? fee.effectiveFrom.slice(0, 10) : '',
      baseFee: fee.baseFee || 0,
      universityFee: fee.universityFee || 0,
      fullProgramFee,
      yearlyFee,
      semesterFee,
      semesterFees,
      commissionRate: fee.commissionRate !== undefined ? String(fee.commissionRate) : '0',
      additionalFees: otherFees.map(f => `${f.label}:${f.amount}`).join(', '),
      feeBreakdown: parsedBreakdown
    });
    setSelectedAdmissionSessionId(sessId || '');
    setOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (!form.programId) {
        toast.error('Please select a program');
        return;
      }
      if (form.level === 'university' && !form.universityId) {
        toast.error('Please select a university');
        return;
      }
      if (form.level === 'program' && !selectedCenterId) {
        toast.error('Please select a study centre');
        return;
      }
      if (form.level === 'program' && Number(form.fullProgramFee) <= 0) {
        toast.error('Full program fee must be greater than zero');
        return;
      }
      if (form.level === 'program' && Number(form.yearlyFee) <= 0) {
        toast.error('Yearly payment must be greater than zero');
        return;
      }
      if (form.level === 'program' && form.semesterFees.length > 0 && (
        Number(form.semesterFee) <= 0
        || form.semesterFees.some(amount => !Number.isFinite(Number(amount)) || Number(amount) <= 0)
      )) {
        toast.error('Every semester fee must be greater than zero');
        return;
      }

      const addFees = [];
      if (form.additionalFees) {
        const custom = form.additionalFees.split(',').map(s => {
          const [label, amount] = s.trim().split(':');
          return { label: label?.trim(), amount: Number(amount) };
        }).filter(f => f.label && !isNaN(f.amount));
        addFees.push(...custom);
      }
      
      let totalBaseFee = 0;
      let totalUniversityFee = 0;
      let aggregatedCommissionRate = 0;
      
      const cleanBreakdown = form.feeBreakdown.map(b => {
         totalBaseFee += Number(b.baseFee || 0);
         totalUniversityFee += Number(b.universityFee || 0);
         if (Number(b.commissionRate || 0) > 0) aggregatedCommissionRate = Number(b.commissionRate);
         return {
           year: b.year,
           baseFee: Number(b.baseFee || 0),
           universityFee: Number(b.universityFee || 0),
           examFee: Number(b.examFee || 0),
           commissionRate: Number(b.commissionRate || 0),
           dueDate: b.dueDate,
           additionalFees: b.additionalFees || ''
         };
      });

      const finalUniId = form.universityId || selectedUniversityId || undefined;
      const payload = {
        level: form.level,
        programId: form.programId,
        studyCenterId: form.level === 'program' ? selectedCenterId : undefined,
        universityId: finalUniId,
        admissionSessionId: form.level === 'program'
          ? selectedAdmissionSessionId || undefined
          : form.admissionSessionId && form.admissionSessionId !== 'all'
            ? form.admissionSessionId
            : undefined,
        baseFee: form.level === 'program' ? Number(form.yearlyFee) : totalBaseFee,
        fullProgramFee: Number(form.fullProgramFee || 0),
        yearlyFee: form.level === 'program' ? Number(form.yearlyFee) : undefined,
        semesterFee: form.level === 'program' ? Number(form.semesterFee) : undefined,
        semesterFees: form.level === 'program' ? form.semesterFees.map(Number) : undefined,
        universityFee: totalUniversityFee,
        billingCycle: form.billingCycle,
        currency: form.currency,
        effectiveFrom: form.effectiveFrom || undefined,
        additionalFees: addFees,
        feeBreakdown: cleanBreakdown,
        commissionRate: aggregatedCommissionRate > 0 ? aggregatedCommissionRate : Number(form.commissionRate || 0),
      };

      if (editing) {
        await api.put(`/finance/program-fees/${editing.id}`, payload);
        toast.success('Fee structure updated');
      } else {
        await api.post('/finance/program-fees', payload);
        toast.success('Fee structure created');
      }
      setOpen(false);
      fetchAllData();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this fee structure?')) return;
    try {
      await api.delete(`/finance/program-fees/${id}`);
      toast.success('Deleted');
      fetchAllData();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete');
    }
  };

  // Program creation handlers
  const handleAddSpecialisation = () => {
    if (!specInput.trim()) return;
    if (newProgramForm.specialisations.includes(specInput.trim())) {
      toast.error('Specialisation already added');
      return;
    }
    setNewProgramForm(prev => ({
      ...prev,
      specialisations: [...prev.specialisations, specInput.trim()]
    }));
    setSpecInput('');
  };

  const handleRemoveSpecialisation = (spec: string) => {
    setNewProgramForm(prev => ({
      ...prev,
      specialisations: prev.specialisations.filter(s => s !== spec)
    }));
  };

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...newProgramForm,
        subDepartmentId: newProgramForm.subDepartmentId || null
      };
      await api.post('/operations/programs', payload);
      toast.success('Program and specialisations created successfully');
      setProgramDialogOpen(false);
      
      setNewProgramForm({
        name: '',
        code: '',
        universityId: selectedUniversityId !== 'all' ? selectedUniversityId : '',
        subDepartmentId: '',
        courseType: 'Online Degree',
        duration: 12,
        status: 'active',
        hasSemesters: false,
        specialisations: []
      });
      
      fetchAllData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create program');
    }
  };

  const selectedCenter = centers.find(center => center.id === selectedCenterId);
  const getProgramSemesters = (program?: Program, sessionId = selectedAdmissionSessionId) =>
    program?.semesterRecords?.filter(semester => semester.academicSessionId === sessionId) || [];
  const getSemesterCount = (program?: Program, sessionId = selectedAdmissionSessionId) =>
    getProgramSemesters(program, sessionId).length;

  const centerProgramEntries = useMemo(() => {
    if (!selectedCenter) return [];
    const allocations = selectedCenter.programAllocations || [];
    return allocations
      .filter(allocation => allocation.centerId === selectedCenter.id && allocation.isActive)
      .flatMap(allocation => {
        const program = programs.find(item => item.id === allocation.programId);
        if (!program) return [];
        const session = allocation.admissionSession
          || sessions.find(item => item.id === allocation.admissionSessionId)
          || null;
        const sessionId = allocation.admissionSessionId || '';
        const matchesProgramSession = !sessionId
          || session?.programId === program.id
          || program.academicSessionId === sessionId
          || program.admissionSessions?.some(programSession => programSession.id === sessionId);
        if (!matchesProgramSession) return [];
        return [{
          program,
          sessionId,
          sessionName: session?.name || 'All Sessions',
          key: `${program.id}:${sessionId || 'all'}`,
        }];
      });
  }, [programs, selectedCenter, sessions]);

  const filteredPrograms = feeView === 'university'
    ? programs.map(program => ({ program, sessionId: '', sessionName: '', key: program.id }))
    : centerProgramEntries;
  const selectedPrograms = useMemo(() => feeView === 'university'
    ? filteredPrograms.filter(entry => {
        const programUniversityId = typeof entry.program.universityId === 'object'
          ? entry.program.universityId?.id
          : entry.program.universityId;
        return programUniversityId === selectedUniversityId;
      })
    : filteredPrograms, [filteredPrograms, feeView, selectedUniversityId]);
  const hasSelectedScope = feeView === 'center' ? !!selectedCenterId : !!selectedUniversityId;

  const filteredFees = useMemo(() => {
    if (!selectedProgramId) return [];
    const selectedProgram = programs.find(program => program.id === selectedProgramId);
    const programUniversityId = typeof selectedProgram?.universityId === 'object'
      ? selectedProgram.universityId?.id
      : selectedProgram?.universityId;
    const matchingFees = fees.filter(f => {
      const pId = typeof f.programId === 'object' ? f.programId?.id : f.programId;
      if (pId !== selectedProgramId) return false;
      if (feeView === 'university') {
        const feeUniversityId = typeof f.universityId === 'object' ? f.universityId?.id : f.universityId;
        return f.level === 'university' && feeUniversityId === programUniversityId;
      }
      if (f.level !== 'program' || f.studyCenterId !== selectedCenterId) return false;
      const feeSessionId = typeof f.admissionSessionId === 'object'
        ? f.admissionSessionId?.id
        : f.admissionSessionId;
      return feeSessionId === selectedAdmissionSessionId;
    });
    if (feeView === 'center' && selectedAdmissionSessionId && matchingFees.length === 0) {
      return fees.filter(f => {
        const pId = typeof f.programId === 'object' ? f.programId?.id : f.programId;
        return pId === selectedProgramId
          && f.level === 'program'
          && f.studyCenterId === selectedCenterId
          && !f.admissionSessionId;
      });
    }
    return matchingFees;
  }, [fees, selectedProgramId, selectedCenterId, selectedAdmissionSessionId, selectedUniversityId, feeView, programs]);

  // Keep a valid program selected when switching between center and university views.
  useEffect(() => {
    if (selectedPrograms.length > 0) {
      if (!selectedProgramId || !selectedPrograms.some(entry =>
        entry.program.id === selectedProgramId
        && (feeView === 'university' || entry.sessionId === selectedAdmissionSessionId)
      )) {
        setSelectedProgramId(selectedPrograms[0].program.id);
        setSelectedAdmissionSessionId(selectedPrograms[0].sessionId);
      }
    } else {
      setSelectedProgramId('');
      setSelectedAdmissionSessionId('');
    }
  }, [selectedPrograms, selectedProgramId, selectedAdmissionSessionId, feeView]);

  // Keep fee creation within the selected view's programs.
  const dialogFilteredPrograms = selectedPrograms.filter(p => {
    const pUniId = typeof p.program.universityId === 'object' ? p.program.universityId?.id : p.program.universityId;
    return !form.universityId || pUniId === form.universityId;
  });



  const getProgramName = (fee: ProgramFee) => {
    const prog = typeof fee.programId === 'object' ? fee.programId : programs.find(p => p.id === fee.programId);
    if (prog) return `${prog.name} (${prog.code})`;
    if (fee.level === 'university') {
      const uni = typeof fee.universityId === 'object' ? fee.universityId : universities.find(u => u.id === fee.universityId);
      return uni ? `${uni.name} (University Level)` : 'Unknown University';
    }
    return 'Unknown Program';
  };

  const getProgramSpecialisations = (fee: ProgramFee) => {
    if (fee.level === 'university') return [];
    const prog = typeof fee.programId === 'object' ? fee.programId : programs.find(p => p.id === fee.programId);
    return prog?.specialisations || [];
  };

  return (
    <div className="space-y-6">
      {/* Modern Unified Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Fee Structure</h2>
          <p className="text-muted-foreground text-sm mt-1 max-w-xl">
            {feeView === 'center'
              ? 'Configure independent fee structures for programs allocated to each study centre.'
              : 'Configure university fees independently for each university program.'}
          </p>
          
          {hasSelectedScope && <div className="mt-4 flex items-center gap-3">
             <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Programs</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">{selectedPrograms.length}</span>
             </div>
             <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-200/60 dark:border-emerald-800 shadow-sm">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Fee Configs</span>
                <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">{filteredFees.length}</span>
             </div>
          </div>}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex gap-2 items-end">
            <Button variant="outline" className="h-10 w-10 p-0 border-slate-200 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800" onClick={fetchAllData} disabled={loading} title="Refresh Data">
              <RefreshCw className={`w-4 h-4 text-slate-600 dark:text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {feeView === 'center' ? (
              <Button variant="outline" className="h-10 border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => {
                setSelectedUniversityId('');
                setSelectedProgramId('');
                setSelectedAdmissionSessionId('');
                setFeeView('university');
              }}>
                <Building2 className="w-4 h-4 mr-2" /> University Fee Configuration
              </Button>
            ) : (
              <Button variant="outline" className="h-10 border-slate-200" onClick={() => setFeeView('center')}>
                <Building2 className="w-4 h-4 mr-2" /> Study Centre Fee Structures
              </Button>
            )}
          </div>
        </div>
      </div>

      {feeView === 'center' && <Card className="border-slate-200 shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-500" /> Study Centres
          </CardTitle>
          <CardDescription>Select a centre to view its allocated program sessions.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {loading && centers.length === 0 ? (
            <div className="h-16 bg-muted rounded-lg animate-pulse" />
          ) : centers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No study centres are available.</p>
          ) : centers.map(center => (
            <button
              key={center.id}
              type="button"
              onClick={() => {
                setSelectedProgramId('');
                setSelectedAdmissionSessionId('');
                setSelectedCenterId(center.id);
              }}
              className={`rounded-xl border p-4 text-left transition-all ${
                selectedCenterId === center.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900'
              }`}
            >
              <span className="block font-semibold text-sm">{center.name}</span>
              {center.code && <span className="mt-1 block text-xs text-muted-foreground">{center.code}</span>}
            </button>
          ))}
        </CardContent>
      </Card>}

      {feeView === 'university' && <Card className="border-slate-200 shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-500" /> Universities
          </CardTitle>
          <CardDescription>Select a university to view its programs and configure university fees.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {loading && universities.length === 0 ? (
            <div className="h-16 bg-muted rounded-lg animate-pulse" />
          ) : universities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No universities are available.</p>
          ) : universities.map(university => (
            <button
              key={university.id}
              type="button"
              onClick={() => {
                setSelectedProgramId('');
                setSelectedAdmissionSessionId('');
                setSelectedUniversityId(university.id);
              }}
              className={`rounded-xl border p-4 text-left transition-all ${
                selectedUniversityId === university.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900'
              }`}
            >
              <span className="block font-semibold text-sm">{university.name}</span>
              {university.code && <span className="mt-1 block text-xs text-muted-foreground">{university.code}</span>}
            </button>
          ))}
        </CardContent>
      </Card>}

      {/* Main content grid - Programs & Fee Structures */}
      {hasSelectedScope && <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Programs List */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden h-full">
            <CardHeader className="pb-3 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-500" /> {feeView === 'university' ? 'University Programs' : 'Programs List'}
              </CardTitle>
              <CardDescription>
                {feeView === 'university'
                  ? 'Select any program to view or configure its university fee.'
                  : selectedCenter ? `Programs at ${selectedCenter.name}` : 'Select a study centre first'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {feeView === 'center' && !selectedCenter ? (
                <div className="text-center py-8 text-sm text-muted-foreground">Please select a study centre first.</div>
              ) : loading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
              ) : selectedPrograms.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {feeView === 'university' ? 'No programs are available.' : 'No programs are allocated to this study centre.'}
                </div>
              ) : (
                selectedPrograms.map(({ program: p, sessionId, sessionName, key }) => (
                  <div
                    key={key}
                    onClick={() => {
                      setSelectedProgramId(p.id);
                      setSelectedAdmissionSessionId(sessionId);
                    }}
                    className={`p-3 border rounded-xl cursor-pointer transition-all group ${selectedProgramId === p.id && (feeView === 'university' || selectedAdmissionSessionId === sessionId) ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-sm'}`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-semibold text-sm leading-none">{p.name}</h4>
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">{p.code}</span>
                        {feeView === 'center' && (
                          <span className="mt-1 block text-xs text-muted-foreground">{sessionName}</span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] py-0">{p.specialisations?.length || 0} Specs</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Fee Structures */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-3 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <IndianRupee className="w-5 h-5 text-emerald-500" />
                    {feeView === 'university' ? 'University Fee Configuration' : 'Study Centre Fee Configuration'}
                  </CardTitle>
                  <CardDescription>
                    {feeView === 'university'
                      ? 'University fee configuration for the selected program.'
                      : `Fee structures for ${selectedCenter?.name || 'the selected study centre'}.`}
                  </CardDescription>
                </div>
                <Button
                  className={feeView === 'university' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
                  onClick={openCreate}
                  disabled={!selectedProgramId || (feeView === 'center' && !selectedCenterId)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {feeView === 'university' ? 'Add University Fee Configuration' : 'Add Fee Configuration'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
              {!selectedProgramId ? (
                <div className="text-center py-16 border rounded-xl border-dashed text-muted-foreground">
                  Please select a program first to view its fee configurations.
                </div>
              ) : loading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
              ) : filteredFees.length === 0 ? (
                <div className="text-center py-16 border rounded-xl border-dashed text-muted-foreground">
                {feeView === 'university'
                  ? 'No university fee configuration exists for this program yet.'
                  : 'No fee structure exists for this program and study centre yet.'}
                </div>
              ) : (
                filteredFees.map((fee: ProgramFee) => {
                  const specs = getProgramSpecialisations(fee);
                  const sess = typeof fee.admissionSessionId === 'object' ? fee.admissionSessionId?.name : sessions.find(s => s.id === fee.admissionSessionId)?.name;
                  
                  return (
                    <Card key={fee.id} className="hover:border-primary/30 transition-all bg-background shadow-sm">
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1 space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-base flex items-center gap-2">
                              {fee.level === 'university' ? <Building2 className="w-4 h-4 text-indigo-500" /> : <BookOpen className="w-4 h-4 text-blue-500" />}
                              {getProgramName(fee)}
                            </h4>
                            <Badge variant="secondary" className={fee.level === 'university' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}>
                              {fee.level === 'university' ? 'University Fee' : selectedCenter?.name || 'Study Centre Fee'}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {fee.level === 'university' ? fee.billingCycle?.replace('_', ' ') : 'Yearly / Semester'}
                            </Badge>
                            {sess && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none text-xs">{sess}</Badge>}
                            {!sess && <Badge variant="outline" className="text-xs">All Sessions</Badge>}
                          </div>
                          
                          {/* Specialisations listing in Fee Structure */}
                          {specs.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs text-muted-foreground font-medium flex items-center gap-0.5">
                                <GraduationCap className="w-3 h-3 text-primary" /> Specialisations:
                              </span>
                              {specs.map((s: string, idx: number) => (
                                <span key={idx} className="text-xs px-1.5 py-0.2 bg-slate-100 rounded text-slate-700">{s}</span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {fee.level !== 'university' && (
                              <>
                                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 shadow-sm font-medium px-2 py-0.5">
                                  {fee.currency || 'INR'} {Number(fee.fullProgramFee || 0).toLocaleString()} One-Time
                                </Badge>
                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 shadow-sm font-medium px-2 py-0.5">
                                  {fee.currency || 'INR'} {Number(fee.yearlyFee ?? fee.baseFee).toLocaleString()} / Year
                                </Badge>
                                {fee.semesterFee !== undefined && fee.semesterFee !== null && (
                                  <Badge variant="secondary" className="bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-200 shadow-sm font-medium px-2 py-0.5">
                                    {fee.currency || 'INR'} {Number(fee.semesterFee).toLocaleString()} / Semester
                                  </Badge>
                                )}
                              </>
                            )}
                            {fee.level === 'university' && fee.universityFee !== undefined && fee.universityFee > 0 && (
                              <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 shadow-sm font-medium px-2 py-0.5">
                                {fee.currency || 'INR'} {fee.universityFee.toLocaleString()} Uni Fee
                              </Badge>
                            )}
                            {fee.effectiveFrom && (
                              <span className="text-xs text-slate-500 font-medium ml-1 flex items-center gap-1">
                                Effective: {new Date(fee.effectiveFrom).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          
                          {fee.feeBreakdown && fee.feeBreakdown.length > 0 && (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {fee.feeBreakdown.map((b: any, idx: number) => (
                                <div key={idx} className="p-2 bg-slate-50 border rounded-md text-xs">
                                  <div className="font-semibold mb-1">{fee.billingCycle === 'per_semester' ? 'Sem' : 'Year'} {b.year} <span className="font-normal text-muted-foreground ml-1">Due: {b.dueDate ? new Date(b.dueDate).toLocaleDateString() : 'N/A'}</span></div>
                                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-muted-foreground">
                                    {fee.level === 'university'
                                      ? <span className="col-span-2">University fee: {b.universityFee}</span>
                                      : <>
                                          <span>Tui: {b.baseFee}</span>
                                          <span>Exam: {b.examFee}</span>
                                          {b.commissionRate > 0 && <span className="col-span-2 text-indigo-600">Comm: {b.commissionRate}%</span>}
                                        </>}
                                    {b.additionalFees && <span className="col-span-2 text-xs text-slate-500">Add: {b.additionalFees}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 self-end sm:self-center">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(fee)} className="hover:bg-primary/10">
                            <Pencil className="w-4 h-4 text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(fee.id)} className="hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

      </div>}

      {/* Dialog for Program Creation with Multiple Specialisations */}
      <Dialog open={programDialogOpen} onOpenChange={setProgramDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Add New Program</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProgram} className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
            
            <div className="space-y-1">
              <Label>University <span className="text-destructive">*</span></Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-muted/60 text-muted-foreground cursor-not-allowed opacity-90 font-medium select-none shadow-sm"
                value={newProgramForm.universityId || selectedUniversityId}
                disabled
              >
                {universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Program Name <span className="text-destructive">*</span></Label>
                <Input value={newProgramForm.name} onChange={e => setNewProgramForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. MBA" required />
              </div>
              <div className="space-y-1">
                <Label>Program Code <span className="text-destructive">*</span></Label>
                <Input value={newProgramForm.code} onChange={e => setNewProgramForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. MBA-ONLINE" required />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Sub-Department <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={newProgramForm.subDepartmentId}
                onChange={e => setNewProgramForm(f => ({ ...f, subDepartmentId: e.target.value }))}
              >
                <option value="">None</option>
                {subDepartments.map(sd => <option key={sd.id} value={sd.id}>{sd.name}</option>)}
              </select>
            </div>

            {/* Specialisations listing chips selection */}
            <div className="space-y-2">
              <Label>Specialisations <span className="text-muted-foreground text-xs">(optional — add multiple)</span></Label>
              <div className="flex gap-2">
                <Input 
                  value={specInput} 
                  onChange={e => setSpecInput(e.target.value)} 
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSpecialisation();
                    }
                  }}
                  placeholder="e.g. Computer Science, then press Enter" 
                />
                <Button type="button" onClick={handleAddSpecialisation} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200">
                  Add
                </Button>
              </div>

              {newProgramForm.specialisations.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1.5">
                  {newProgramForm.specialisations.map((spec, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1.5 px-2 py-1">
                      {spec}
                      <button 
                        type="button" 
                        onClick={() => handleRemoveSpecialisation(spec)} 
                        className="text-muted-foreground hover:text-destructive text-xs font-bold font-mono"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Course Type selector buttons/chips */}
            <div className="space-y-2">
              <Label>Course Type <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {['Skill Course', 'Online Degree', 'B.Voc Degree', 'Credit Transfer'].map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={newProgramForm.courseType === type ? 'default' : 'outline'}
                    onClick={() => setNewProgramForm(f => ({ ...f, courseType: type }))}
                    className={`w-full text-sm font-medium ${newProgramForm.courseType === type ? 'bg-indigo-50 border-indigo-500 text-indigo-700 hover:bg-indigo-100' : 'hover:bg-slate-50'}`}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            {/* Duration dropdown */}
            <div className="space-y-1">
              <Label>Duration <span className="text-destructive">*</span></Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={newProgramForm.duration}
                onChange={e => setNewProgramForm(f => ({ ...f, duration: Number(e.target.value) }))}
                required
              >
                <option value={3}>3 months</option>
                <option value={6}>6 months</option>
                <option value={9}>9 months</option>
                <option value={11}>11 months</option>
                <option value={12}>1 year (12 months)</option>
                <option value={18}>1.5 years (18 months)</option>
                <option value={24}>2 years (24 months)</option>
                <option value={30}>2.5 years (30 months)</option>
                <option value={36}>3 years (36 months)</option>
                <option value={42}>3.5 years (42 months)</option>
                <option value={48}>4 years (48 months)</option>
              </select>
            </div>

            {/* Dialog Footer Actions */}
            <div className="pt-4 border-t flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setProgramDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">Create Program</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for Fee Structure Create/Edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>
              {editing ? 'Edit Fee Structure' : 'Add New Fee Structure'}
              {configuringUniversityFee && <span className="block mt-1 text-sm font-normal text-muted-foreground">University Fee Configuration</span>}
            </DialogTitle>
            {configuringUniversityFee && (
              <p className="text-xs text-muted-foreground">
                Configure this university program fee independently from every study-centre fee structure.
              </p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
            

            <div className="space-y-1">
              <Label>University <span className="text-destructive">*</span></Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-muted/60 text-muted-foreground cursor-not-allowed opacity-90 font-medium select-none shadow-sm"
                value={form.universityId || selectedUniversityId}
                disabled
                required
              >
                {universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
                <Label>Program <span className="text-destructive">*</span></Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.programId}
                  disabled={form.level === 'program'}
                  onChange={e => {
                    const program = programs.find(item => item.id === e.target.value);
                    const programUniversityId = typeof program?.universityId === 'object'
                      ? program.universityId?.id
                      : program?.universityId;
                    setForm(f => ({
                      ...f,
                      programId: e.target.value,
                      universityId: programUniversityId || f.universityId,
                    }));
                  }}
                  required
                >
                  <option value="">Select program...</option>
                  {dialogFilteredPrograms.map(({ program: p, key, sessionName }) => (
                    <option key={key} value={p.id}>
                      {p.name} ({p.code}){sessionName ? ` - ${sessionName}` : ''}
                    </option>
                  ))}
                </select>
            </div>

            <div className="space-y-1">
              <Label>Admission Session</Label>
              {form.level === 'program' ? (
                <Input
                  value={selectedAdmissionSessionId
                    ? sessions.find(session => session.id === selectedAdmissionSessionId)?.name || ''
                    : 'All Sessions'}
                  disabled
                  aria-readonly="true"
                />
              ) : (
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.admissionSessionId}
                  onChange={e => setForm(f => ({ ...f, admissionSessionId: e.target.value }))}
                >
                  <option value="all">All Sessions</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>

            {form.level === 'program' ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Full Program Fee (One-Time Payment) <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.fullProgramFee}
                    onChange={e => {
                      const fullFee = Number(e.target.value) || 0;
                      const program = programs.find(item => item.id === form.programId);
                      const durationMonths = Math.max(1, Number(program?.duration) || 12);
                      const yearCount = Math.max(1, Math.ceil(durationMonths / 12));
                      const programSemesters = getProgramSemesters(program, selectedAdmissionSessionId);
                      const semesterCount = programSemesters.length;
                      setForm(f => ({
                        ...f,
                        fullProgramFee: e.target.value,
                        yearlyFee: fullFee > 0 ? (fullFee / yearCount).toFixed(2) : '',
                        semesterFee: fullFee > 0 && semesterCount > 0 ? (fullFee / semesterCount).toFixed(2) : '',
                        semesterFees: Array.from(
                          { length: semesterCount },
                          () => fullFee > 0 ? (fullFee / semesterCount).toFixed(2) : ''
                        ),
                      }));
                    }}
                    placeholder="Enter full program fee"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Yearly Payment <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.yearlyFee}
                    onChange={e => setForm(f => ({ ...f, yearlyFee: e.target.value }))}
                    required
                  />
                </div>
                {form.semesterFees.length > 0 && (
                  <>
                    <div className="space-y-2">
                      <Label>Semester Payments <span className="text-destructive">*</span></Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {form.semesterFees.map((amount, index) => {
                          const semester = getProgramSemesters(
                            programs.find(item => item.id === form.programId),
                            selectedAdmissionSessionId
                          )[index];
                          return (
                            <div key={semester.id} className="space-y-1">
                              <Label htmlFor={`semester-fee-${semester.id}`} className="text-xs text-muted-foreground">
                                {semester.semesterName}
                              </Label>
                              <Input
                                id={`semester-fee-${semester.id}`}
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={amount}
                                onChange={e => setForm(f => {
                                  const semesterFees = [...f.semesterFees];
                                  semesterFees[index] = e.target.value;
                                  const numericFees = semesterFees.map(Number).filter(Number.isFinite);
                                  return {
                                    ...f,
                                    semesterFees,
                                    semesterFee: numericFees.length
                                      ? (numericFees.reduce((total, fee) => total + fee, 0) / semesterFees.length).toFixed(2)
                                      : '',
                                  };
                                })}
                                required
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Semester amounts are pre-calculated evenly from the full program fee and can be adjusted individually.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Billing Cycle</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.billingCycle}
                  onChange={e => setForm(f => ({ ...f, billingCycle: e.target.value }))}
                >
                  <option value="per_semester">Per Semester</option>
                  <option value="per_year">Per Year</option>
                  <option value="total">Total (one-time)</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="space-y-1">
                <Label>Currency</Label>
                <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} placeholder="INR" />
              </div>
              <div className="space-y-1">
                <Label>Effective From</Label>
                <Input type="date" value={form.effectiveFrom} onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))} />
              </div>
            </div>

            {form.feeBreakdown && form.feeBreakdown.length > 0 && (
              <div className="space-y-4 mt-6">
                <h3 className="font-semibold text-lg">{form.billingCycle === 'per_semester' ? 'Semester' : 'Yearly'} Fee Breakdown ({form.feeBreakdown.length} {form.billingCycle === 'per_semester' ? 'Semesters' : 'Years'})</h3>
                {form.feeBreakdown.map((block, idx) => (
                  <div key={idx} className="p-4 border rounded-lg space-y-4 bg-slate-50 dark:bg-slate-900">
                    <h4 className="font-medium text-emerald-700">{form.billingCycle === 'per_semester' ? 'Semester' : 'Year'} {block.year}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {form.level === 'university' ? (
                        <div className="space-y-1">
                          <Label>University Fee</Label>
                          <Input type="number" value={block.universityFee} onChange={e => handleBreakdownChange(idx, 'universityFee', e.target.value)} />
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <Label>Tuition / Base Fee</Label>
                            <Input type="number" value={block.baseFee} onChange={e => handleBreakdownChange(idx, 'baseFee', e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label>Exam Fee</Label>
                            <Input type="number" value={block.examFee} onChange={e => handleBreakdownChange(idx, 'examFee', e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label>Commission Rate (%)</Label>
                            <Input type="number" step="0.01" value={block.commissionRate} onChange={e => handleBreakdownChange(idx, 'commissionRate', e.target.value)} />
                          </div>
                        </>
                      )}
                      <div className="space-y-1">
                        <Label>Payment Due Date</Label>
                        <Input type="date" value={block.dueDate} onChange={e => handleBreakdownChange(idx, 'dueDate', e.target.value)} />
                      </div>
                      {form.level === 'program' && (
                        <div className="space-y-1 md:col-span-2 lg:col-span-3">
                          <Label>Additional Fees <span className="text-muted-foreground text-xs">(label:amount, comma-separated)</span></Label>
                          <Input value={block.additionalFees || ''} onChange={e => handleBreakdownChange(idx, 'additionalFees', e.target.value)} placeholder="Verification:100, Library:50" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
          </div>
          <DialogFooter className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-700 text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
