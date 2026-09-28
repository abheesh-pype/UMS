import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, BookOpen, Clock, Layers, ChevronDown, ChevronUp, Tag, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ProgramDetailPanel } from './ProgramDetailPanel';
import { toast } from 'sonner';

type CourseType = 'Skill Course' | 'Online Degree' | 'B.Voc Degree' | 'Credit Transfer';

const COURSE_TYPES: { value: CourseType; label: string; color: string; bg: string }[] = [
  { value: 'Skill Course',     label: 'Skill Course',     color: '#7c3aed', bg: '#f5f3ff' },
  { value: 'Online Degree',    label: 'Online Degree',    color: '#2563eb', bg: '#eff6ff' },
  { value: 'B.Voc Degree',     label: 'B.Voc Degree',    color: '#0891b2', bg: '#ecfeff' },
  { value: 'Credit Transfer',  label: 'Credit Transfer',  color: '#16a34a', bg: '#f0fdf4' },
];

const DURATION_OPTIONS = [
  { value: 3,  label: '3 months' },
  { value: 6,  label: '6 months' },
  { value: 9,  label: '9 months' },
  { value: 11, label: '11 months' },
  { value: 12, label: '1 year (12 months)' },
  { value: 18, label: '1.5 years (18 months)' },
  { value: 24, label: '2 years (24 months)' },
  { value: 30, label: '2.5 years (30 months)' },
  { value: 36, label: '3 years (36 months)' },
  { value: 42, label: '3.5 years (42 months)' },
  { value: 48, label: '4 years (48 months)' },
];

interface Semester { number: number; name: string; durationMonths: number; }
interface SubDepartment { id: string; name: string; }
interface CertificateRequirement { name: string; isMandatory: boolean; }
interface Program {
  id: string; name: string; code: string; courseType: CourseType;
  duration: number; hasSemesters: boolean; semesters: Semester[];
  status: string; universityId: any; subDepartmentId?: any;
  specialisations?: string[];
  certificateRequirements?: CertificateRequirement[];
}

function formatDuration(months: number) {
  if (months < 12) return `${months} months`;
  if (months % 12 === 0) return `${months / 12} year${months / 12 > 1 ? 's' : ''}`;
  return `${Math.floor(months / 12)}y ${months % 12}m`;
}

export function ProgramsPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { user } = useAuth();
  const canManagePrograms = !readOnly && (['org_admin', 'superadmin'].includes(user?.role || '') || (user as any)?.canAddPrograms === true);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [universities, setUniversities] = useState<any[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('all');
  
  // Chip input state for specialisations
  const [specInput, setSpecInput] = useState('');
  
  // Certificate Requirements state
  const [certReqInput, setCertReqInput] = useState('');
  const [certReqMandatory, setCertReqMandatory] = useState(false);

  const [form, setForm] = useState({
    name: '', code: '', universityId: '',
    subDepartmentId: '',
    courseType: 'Online Degree' as CourseType,
    duration: 12, status: 'active',
    hasSemesters: false,
    specialisations: [] as string[],
    certificateRequirements: [] as CertificateRequirement[]
  });
  const [semesters, setSemesters] = useState<Semester[]>([]);

  useEffect(() => { fetchPrograms(); fetchUniversities(); fetchSubDepartments(); }, []);

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const res = await api.get('/operations/programs');
      setPrograms(res.data.data || []);
    } catch (err) {
    } finally { setLoading(false); }
  };

  const fetchUniversities = async () => {
    try {
      const res = await api.get('/operations/universities');
      setUniversities(res.data.data || []);
    } catch (err) {}
  };

  const fetchSubDepartments = async () => {
    try {
      const res = await api.get('/sub-departments');
      setSubDepartments(res.data.data || []);
    } catch (err) {}
  };

  // Auto-generate semesters based on duration
  const autoSemesters = (durationMonths: number): Semester[] => {
    const semCount = Math.round(durationMonths / 6);
    const perSem = Math.round(durationMonths / semCount);
    return Array.from({ length: semCount }, (_, i) => ({
      number: i + 1,
      name: `Semester ${i + 1}`,
      durationMonths: perSem,
    }));
  };

  const handleToggleSemesters = (enabled: boolean) => {
    setForm(f => ({ ...f, hasSemesters: enabled }));
    if (enabled && semesters.length === 0) {
      setSemesters(autoSemesters(form.duration));
    }
  };

  const handleDurationChange = (val: number) => {
    setForm(f => ({ ...f, duration: val }));
    if (form.hasSemesters) setSemesters(autoSemesters(val));
  };

  const updateSemester = (idx: number, field: keyof Semester, value: any) => {
    setSemesters(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const addSemester = () => {
    setSemesters(prev => [...prev, {
      number: prev.length + 1,
      name: `Semester ${prev.length + 1}`,
      durationMonths: 6,
    }]);
  };

  const removeSemester = (idx: number) => {
    setSemesters(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, number: i + 1, name: `Semester ${i + 1}` })));
  };

  // Specialisations listing actions
  const handleAddSpecialisation = () => {
    if (!specInput.trim()) return;
    if (form.specialisations.includes(specInput.trim())) {
      toast.error('Specialisation already added');
      return;
    }
    setForm(f => ({
      ...f,
      specialisations: [...f.specialisations, specInput.trim()]
    }));
    setSpecInput('');
  };

  const handleRemoveSpecialisation = (spec: string) => {
    setForm(f => ({
      ...f,
      specialisations: f.specialisations.filter(s => s !== spec)
    }));
  };

  const handleAddCertReq = () => {
    if (!certReqInput.trim()) return;
    setForm(f => ({
      ...f,
      certificateRequirements: [...f.certificateRequirements, { name: certReqInput.trim(), isMandatory: certReqMandatory }]
    }));
    setCertReqInput('');
    setCertReqMandatory(false);
  };

  const handleRemoveCertReq = (idx: number) => {
    setForm(f => ({
      ...f,
      certificateRequirements: f.certificateRequirements.filter((_, i) => i !== idx)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        subDepartmentId: form.subDepartmentId || null,
        semesters: form.hasSemesters ? semesters : [],
      };
      if (editingId) {
        await api.put(`/operations/programs/${editingId}`, payload);
      } else {
        await api.post('/operations/programs', payload);
      }
      setDialogOpen(false);
      resetForm();
      fetchPrograms();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save program');
    }
  };

  const handleEdit = (p: Program) => {
    const uniId = typeof p.universityId === 'object' ? (p.universityId?.id || p.universityId?.id) : p.universityId;
    const subDeptId = typeof p.subDepartmentId === 'object' ? (p.subDepartmentId?.id || p.subDepartmentId?.id) : p.subDepartmentId;
    setEditingId(p.id);
    setForm({
      name: p.name, code: p.code,
      universityId: uniId?.toString() || '',
      subDepartmentId: subDeptId?.toString() || '',
      courseType: p.courseType || 'Online Degree',
      duration: p.duration,
      status: p.status,
      hasSemesters: p.hasSemesters || false,
      specialisations: p.specialisations || [],
      certificateRequirements: p.certificateRequirements || []
    });
    setSemesters(p.semesters || []);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this program?')) return;
    try { await api.delete(`/operations/programs/${id}`); fetchPrograms(); }
    catch (e: any) { toast.error(e.response?.data?.message || 'Failed to delete'); }
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ 
      name: '', code: '', universityId: '', 
      subDepartmentId: '', courseType: 'Online Degree', 
      duration: 12, status: 'active', hasSemesters: false,
      specialisations: [],
      certificateRequirements: []
    });
    setSpecInput('');
    setCertReqInput('');
    setCertReqMandatory(false);
    setSemesters([]);
  };

  const getCourseTypeMeta = (ct: string) => COURSE_TYPES.find(c => c.value === ct) || COURSE_TYPES[1];

  // If a program is selected, show its detail panel
  if (selectedProgramId) {
    return (
      <ProgramDetailPanel 
        programId={selectedProgramId} 
        initialSemester={selectedSemesterId}
        onBack={() => {
          setSelectedProgramId(null);
          setSelectedSemesterId('all');
        }} 
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Program Management</h2>
          <p className="text-muted-foreground">Manage academic programs and courses</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} disabled={!canManagePrograms} className={!canManagePrograms ? 'hidden' : ''}>
          <Plus className="w-4 h-4 mr-2" />Add Program
        </Button>
      </div>

      {/* List */}
      <Card>
        <CardHeader><CardTitle>Programs</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : programs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No programs found</div>
          ) : (
            <div className="space-y-2">
              {programs.map((p) => {
                const meta = getCourseTypeMeta(p.courseType);
                const uniName = typeof p.universityId === 'object' ? p.universityId?.name : '';
                const isExpanded = expandedId === p.id;
                return (
                  <div key={p.id} className="border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                          style={{ background: meta.bg }}>
                          <BookOpen className="w-4 h-4" style={{ color: meta.color }} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{p.name}</span>
                            <span className="text-xs font-mono text-muted-foreground">{p.code}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: meta.bg, color: meta.color }}>
                              {p.courseType}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />{formatDuration(p.duration)}
                            </span>
                            {p.hasSemesters && p.semesters?.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Layers className="h-3 w-3" />{p.semesters.length} semesters
                              </span>
                            )}
                            {uniName && <span>{uniName}</span>}
                            {p.subDepartmentId && (
                              <span className="flex items-center gap-1 text-violet-600">
                                <Tag className="h-3 w-3" />
                                {typeof p.subDepartmentId === 'object' ? p.subDepartmentId.name : p.subDepartmentId}
                              </span>
                            )}
                          </div>
                          
                          {/* Specialisation tags in listing */}
                          {p.specialisations && p.specialisations.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {p.specialisations.map((spec, i) => (
                                <Badge key={i} variant="secondary" className="text-[9px] px-1 py-0">{spec}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={p.status === 'active' ? 'default' : 'secondary'} className="text-xs">{p.status}</Badge>
                        {p.hasSemesters && p.semesters?.length > 0 && (
                          <button onClick={() => setExpandedId(isExpanded ? null : p.id)}
                            className="text-muted-foreground hover:text-foreground">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        )}
                        {canManagePrograms && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(p)}><Edit className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setSelectedProgramId(p.id)} title="View details & materials">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Semester breakdown */}
                    {isExpanded && p.semesters?.length > 0 && (
                      <div className="border-t bg-slate-50 px-4 py-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {p.semesters.map(s => (
                            <div 
                              key={s.number} 
                              onClick={() => {
                                setSelectedSemesterId(String(s.number));
                                setSelectedProgramId(p.id);
                              }}
                              className="bg-white border rounded-lg px-3 py-2 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                            >
                              <p className="text-xs font-semibold text-slate-700">{s.name}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{s.durationMonths} months</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>{editingId ? 'Edit Program' : 'Add New Program'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">

            {/* Basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Program Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label>Program Code *</Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} required />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Sub-Department <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={form.subDepartmentId || 'none'} onValueChange={v => setForm(f => ({ ...f, subDepartmentId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Select sub-department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {subDepartments.map(sd => (
                    <SelectItem key={sd.id} value={sd.id}>{sd.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

              {form.specialisations.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1.5">
                  {form.specialisations.map((spec, index) => (
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

            {/* Certificate Requirements */}
            <div className="space-y-2 border-t pt-4">
              <Label>Certificate Requirements <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <div className="flex gap-2 items-center">
                <Input 
                  value={certReqInput} 
                  onChange={e => setCertReqInput(e.target.value)} 
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCertReq();
                    }
                  }}
                  placeholder="e.g. 10th Marksheet, Aadhar Card" 
                  className="flex-1"
                />
                <div className="flex items-center gap-2 px-2 shrink-0">
                  <input type="checkbox" id="mandatoryCheck" checked={certReqMandatory} onChange={e => setCertReqMandatory(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <label htmlFor="mandatoryCheck" className="text-sm font-medium text-slate-700 whitespace-nowrap cursor-pointer">Mandatory</label>
                </div>
                <Button type="button" onClick={handleAddCertReq} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200">
                  Add
                </Button>
              </div>

              {form.certificateRequirements.length > 0 && (
                <div className="flex flex-col gap-2 pt-1.5">
                  {form.certificateRequirements.map((req, index) => (
                    <div key={index} className="flex items-center justify-between bg-slate-50 border rounded-md px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{req.name}</span>
                        {req.isMandatory ? (
                          <Badge variant="default" className="text-[10px] h-5 bg-red-100 text-red-700 hover:bg-red-200 border-red-200">Mandatory</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] h-5 text-slate-500 bg-white">Optional</Badge>
                        )}
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveCertReq(index)} 
                        className="text-muted-foreground hover:text-destructive text-sm font-bold font-mono px-2"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Course Type */}
            <div className="space-y-2">
              <Label>Course Type *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {COURSE_TYPES.map(ct => (
                  <button key={ct.value} type="button"
                    onClick={() => setForm(f => ({ ...f, courseType: ct.value }))}
                    className={`rounded-lg border-2 px-3 py-2.5 text-left transition-all ${
                      form.courseType === ct.value
                        ? 'border-current'
                        : 'border-slate-200 hover:border-slate-300'}`}
                    style={form.courseType === ct.value
                      ? { borderColor: ct.color, background: ct.bg }
                      : {}}>
                    <p className="text-xs font-semibold" style={{ color: form.courseType === ct.value ? ct.color : '#374151' }}>
                      {ct.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-1">
              <Label>Duration *</Label>
              <Select value={String(form.duration)} onValueChange={v => handleDurationChange(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map(d => (
                    <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Semesters toggle */}
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-slate-500" />
                  <div>
                    <p className="text-sm font-semibold">Semester Structure</p>
                    <p className="text-xs text-muted-foreground">Optional — divide the program into semesters</p>
                  </div>
                </div>
                <button type="button"
                  onClick={() => handleToggleSemesters(!form.hasSemesters)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.hasSemesters ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.hasSemesters ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {form.hasSemesters && (
                <div className="space-y-2">
                  {semesters.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2">
                      <span className="text-xs font-semibold text-slate-500 w-6 shrink-0">{s.number}</span>
                      <Input
                        className="h-7 text-xs flex-1"
                        value={s.name}
                        onChange={e => updateSemester(idx, 'name', e.target.value)}
                        placeholder="Semester name" />
                      <Select value={String(s.durationMonths)}
                        onValueChange={v => updateSemester(idx, 'durationMonths', Number(v))}>
                        <SelectTrigger className="h-7 text-xs w-28 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                            <SelectItem key={m} value={String(m)}>{m} mo</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button type="button" onClick={() => removeSemester(idx)}
                        className="text-red-400 hover:text-red-600 shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addSemester}
                    className="w-full text-xs text-indigo-600 hover:text-indigo-800 border border-dashed border-indigo-300 rounded-lg py-1.5 flex items-center justify-center gap-1">
                    <Plus className="h-3 w-3" /> Add Semester
                  </button>
                  {semesters.length > 0 && (
                    <p className="text-xs text-muted-foreground text-right">
                      Total: {semesters.reduce((a, s) => a + s.durationMonths, 0)} months
                      {semesters.reduce((a, s) => a + s.durationMonths, 0) !== form.duration && (
                        <span className="text-amber-600 ml-1">
                          (program is {form.duration} months)
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                {editingId ? 'Save Changes' : 'Create Program'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
