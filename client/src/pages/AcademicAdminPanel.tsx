import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, BookOpen, Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, Copy, Edit, Eye, Filter, GraduationCap, Loader2, MapPin, Plus, RotateCcw, Search, Trash2, Video } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import api from '@/lib/api';
import { toast } from 'sonner';

const CALENDAR_CATEGORIES = [
  'Classes & Teaching',
  'Assessment & Assignments',
  'University Events',
  'Meetings',
  'Examinations',
  'Holidays',
  'Administrative Deadlines',
  'Others',
] as const;

const CATEGORY_CONFIG: Record<string, {
  color: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
  badgeBg: string;
  badgeText: string;
  shortLabel: string;
}> = {
  'Classes & Teaching': {
    color: '#10b981',
    bg: 'bg-emerald-100 hover:bg-emerald-200/80 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80',
    text: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-600',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300',
    badgeText: 'text-emerald-800',
    shortLabel: 'Academic',
  },
  'Examinations': {
    color: '#f43f5e',
    bg: 'bg-rose-100 hover:bg-rose-200/80 dark:bg-rose-950/60 dark:hover:bg-rose-900/80',
    text: 'text-rose-800 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300',
    badgeText: 'text-rose-800',
    shortLabel: 'Examination',
  },
  'Assessment & Assignments': {
    color: '#a855f7',
    bg: 'bg-purple-100 hover:bg-purple-200/80 dark:bg-purple-950/60 dark:hover:bg-purple-900/80',
    text: 'text-purple-800 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    dot: 'bg-purple-600',
    badgeBg: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300',
    badgeText: 'text-purple-800',
    shortLabel: 'Assessment',
  },
  'Holidays': {
    color: '#0284c7',
    bg: 'bg-sky-100 hover:bg-sky-200/80 dark:bg-sky-950/60 dark:hover:bg-sky-900/80',
    text: 'text-sky-800 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800',
    dot: 'bg-sky-500',
    badgeBg: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300',
    badgeText: 'text-sky-800',
    shortLabel: 'Holiday',
  },
  'University Events': {
    color: '#f59e0b',
    bg: 'bg-amber-100 hover:bg-amber-200/80 dark:bg-amber-950/60 dark:hover:bg-amber-900/80',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300',
    badgeText: 'text-amber-800',
    shortLabel: 'Event',
  },
  'Administrative Deadlines': {
    color: '#f97316',
    bg: 'bg-orange-100 hover:bg-orange-200/80 dark:bg-orange-950/60 dark:hover:bg-orange-900/80',
    text: 'text-orange-800 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-500',
    badgeBg: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300',
    badgeText: 'text-orange-800',
    shortLabel: 'Deadline',
  },
  'Meetings': {
    color: '#14b8a6',
    bg: 'bg-teal-100 hover:bg-teal-200/80 dark:bg-teal-950/60 dark:hover:bg-teal-900/80',
    text: 'text-teal-800 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-800',
    dot: 'bg-teal-500',
    badgeBg: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300',
    badgeText: 'text-teal-800',
    shortLabel: 'Meeting',
  },
  'Others': {
    color: '#64748b',
    bg: 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900/60 dark:hover:bg-slate-800/80',
    text: 'text-slate-800 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-800',
    dot: 'bg-slate-500',
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/60 dark:text-slate-300',
    badgeText: 'text-slate-800',
    shortLabel: 'Other',
  },
};

interface AcademicAdminPanelProps { initialTab?: string; onNavigate?: (table: string) => void; }

export function AcademicAdminPanel({ initialTab, onNavigate }: AcademicAdminPanelProps) {
  const examPortalStorageKey = 'academic-created-exam-portals';
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ startDate: '', endDate: '', status: 'inactive' });
  const sessionScrollerRef = useRef<HTMLDivElement>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'programs' | 'semesters' | 'modules'>('programs');
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [programLoading, setProgramLoading] = useState(false);
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [programForm, setProgramForm] = useState({ name: '', courseName: '', duration: '', status: 'active', description: '' });
  const [programSearch, setProgramSearch] = useState('');
  const [programSessionFilter, setProgramSessionFilter] = useState<string>('all');
  const [programFormSessionId, setProgramFormSessionId] = useState('');
  const [programTemplateId, setProgramTemplateId] = useState('');
  const [programCopySemesters, setProgramCopySemesters] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importSourceSessionId, setImportSourceSessionId] = useState('');
  const [importSelectedProgramIds, setImportSelectedProgramIds] = useState<string[]>([]);
  const [importProgramSemesters, setImportProgramSemesters] = useState<Record<string, any[]>>({});
  const [importSelectedSemesterIds, setImportSelectedSemesterIds] = useState<Record<string, string[]>>({});
  const [importSemestersLoading, setImportSemestersLoading] = useState<Record<string, boolean>>({});
  const [importExpandedProgramIds, setImportExpandedProgramIds] = useState<string[]>([]);
  const [importIncludeDetails, setImportIncludeDetails] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [importSearch, setImportSearch] = useState('');
  const [modules, setModules] = useState<any[]>([]);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [moduleForm, setModuleForm] = useState({
    academicSessionId: '',
    programId: '',
    semesterId: '',
    moduleCode: '',
    moduleName: '',
    moduleType: '',
  });
  const [ebookModule, setEbookModule] = useState<any | null>(null);
  const [ebookMaterials, setEbookMaterials] = useState<any[]>([]);
  const [ebookFile, setEbookFile] = useState<File | null>(null);
  const [ebookLoading, setEbookLoading] = useState(false);
  const [ebookUploading, setEbookUploading] = useState(false);
  const [ebookEditingMaterialId, setEbookEditingMaterialId] = useState<string | null>(null);
  const [allEbooks, setAllEbooks] = useState<any[]>([]);
  const [allEbooksLoading, setAllEbooksLoading] = useState(false);
  const [addNoteModalOpen, setAddNoteModalOpen] = useState(false);
  const [addNoteSaving, setAddNoteSaving] = useState(false);
  const [addNoteSessionId, setAddNoteSessionId] = useState('');
  const [addNoteProgramId, setAddNoteProgramId] = useState('');
  const [addNoteSemesterId, setAddNoteSemesterId] = useState('');
  const [addNoteModuleId, setAddNoteModuleId] = useState('');
  const [addNoteBookName, setAddNoteBookName] = useState('');
  const [addNoteFile, setAddNoteFile] = useState<File | null>(null);
  const [addNoteSemesters, setAddNoteSemesters] = useState<any[]>([]);
  const [addNoteModules, setAddNoteModules] = useState<any[]>([]);
  const [addNoteSemestersLoading, setAddNoteSemestersLoading] = useState(false);
  const [addNoteModulesLoading, setAddNoteModulesLoading] = useState(false);
  const [videoModule, setVideoModule] = useState<any | null>(null);
  const [videoMaterials, setVideoMaterials] = useState<any[]>([]);
  const [moduleVideoFile, setModuleVideoFile] = useState<File | null>(null);
  const [moduleVideoLoading, setModuleVideoLoading] = useState(false);
  const [moduleVideoUploading, setModuleVideoUploading] = useState(false);
  const [videoClasses, setVideoClasses] = useState<any[]>([]);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoSaving, setVideoSaving] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [videoForm, setVideoForm] = useState({
    sessionId: '',
    programId: '',
    semesterId: '',
    moduleId: '',
    title: '',
    description: '',
    youtubeUrl: '',
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSemesters, setVideoSemesters] = useState<any[]>([]);
  const [videoModules, setVideoModules] = useState<any[]>([]);
  const [videoSemestersLoading, setVideoSemestersLoading] = useState(false);
  const [videoModulesLoading, setVideoModulesLoading] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoSearch, setVideoSearch] = useState('');
  const [videoFilterSession, setVideoFilterSession] = useState('all');
  const [videoFilterProgram, setVideoFilterProgram] = useState('all');
  const [videoFilterSemester, setVideoFilterSemester] = useState('all');
  const [videoFilterModule, setVideoFilterModule] = useState('all');
  const [scheduledClassForm, setScheduledClassForm] = useState({
    academicSessionId: '',
    programId: '',
    semesterId: '',
    moduleId: '',
    title: '',
    startsAt: '',
    meetingUrl: '',
  });
  const [scheduledClassSemesters, setScheduledClassSemesters] = useState<any[]>([]);
  const [scheduledClassModules, setScheduledClassModules] = useState<any[]>([]);
  const [schedulableStudents, setSchedulableStudents] = useState<any[]>([]);
  const [selectedScheduledStudentIds, setSelectedScheduledStudentIds] = useState<string[]>([]);
  const [scheduledClasses, setScheduledClasses] = useState<any[]>([]);
  const [scheduledClassLoading, setScheduledClassLoading] = useState(false);
  const [schedulableStudentsLoading, setSchedulableStudentsLoading] = useState(false);
  const [scheduledClassSaving, setScheduledClassSaving] = useState(false);

  // Academic Calendar states
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date(2026, 9, 25)); // Default to October 2026
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'agenda'>('month');

  // Academic Calendar filters
  const [calFilterSession, setCalFilterSession] = useState<string>('all');
  const [calFilterSemester, setCalFilterSemester] = useState<string>('all');
  const [calFilterCategory, setCalFilterCategory] = useState<string>('all');
  const [calFilterDepartment, setCalFilterDepartment] = useState<string>('all');
  const [calFilterStudyCenter, setCalFilterStudyCenter] = useState<string>('all');
  const [calDepartments, setCalDepartments] = useState<any[]>([]);
  const [calStudyCenters, setCalStudyCenters] = useState<any[]>([]);

  // Academic Calendar add / edit modal
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [editingCalendarEventId, setEditingCalendarEventId] = useState<string | null>(null);
  const [calendarForm, setCalendarForm] = useState({
    title: '',
    category: '',
    academicSessionId: '',
    programId: '',
    semesterId: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    description: '',
  });
  const [calendarModalSemesters, setCalendarModalSemesters] = useState<any[]>([]);
  const [calendarModalSemestersLoading, setCalendarModalSemestersLoading] = useState(false);

  // Academic Calendar event detail & delete
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<any | null>(null);
  const [deletingCalendarEventId, setDeletingCalendarEventId] = useState<string | null>(null);

  const [semesters, setSemesters] = useState<any[]>([]);
  const [semesterLoading, setSemesterLoading] = useState(false);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string | null>(null);
  const [semesterDialogOpen, setSemesterDialogOpen] = useState(false);
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(null);
  const [semesterForm, setSemesterForm] = useState({
    programId: '',
    academicSessionId: '',
    semesterName: '',
    semesterNumber: '',
    startDate: '',
    endDate: '',
    status: 'active',
  });
  const [semesterSessionFilter, setSemesterSessionFilter] = useState('all');
  const [semesterProgramFilter, setSemesterProgramFilter] = useState('all');
  const [moduleSessionFilter, setModuleSessionFilter] = useState('all');
  const [moduleProgramFilter, setModuleProgramFilter] = useState('all');
  const [moduleSemesterFilter, setModuleSemesterFilter] = useState('all');
  const [examinations, setExaminations] = useState<any[]>([]);
  const [examinationLoading, setExaminationLoading] = useState(false);
  const [examinationDialogOpen, setExaminationDialogOpen] = useState(false);
  const [examinationStep, setExaminationStep] = useState(1);
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
  const [examinationModules, setExaminationModules] = useState<any[]>([]);
  const [examinationSchedule, setExaminationSchedule] = useState<any[]>([]);
  const [examinationFilters, setExaminationFilters] = useState({ sessionId: 'all', programId: 'all', semesterId: 'all', status: 'all' });
  const [examinationForm, setExaminationForm] = useState({ examinationName: '', examinationType: '', academicSessionId: '', programId: '', semesterId: '', startDate: '', endDate: '', description: '' });
  const [selectedExamination, setSelectedExamination] = useState<any | null>(null);
  const [viewExaminationDialogOpen, setViewExaminationDialogOpen] = useState(false);
  const [editingExaminationId, setEditingExaminationId] = useState<string | null>(null);
  const [registeredExaminationId, setRegisteredExaminationId] = useState('all');
  const [registeredStudents, setRegisteredStudents] = useState<any[]>([]);
  const [registeredStudentsLoading, setRegisteredStudentsLoading] = useState(false);
  const [removingRegistrationId, setRemovingRegistrationId] = useState<string | null>(null);
  const [examPortalForm, setExamPortalForm] = useState({ examId: '', academicSessionId: '', programId: '', examDate: '', examSession: '', examTime: '' });
  const [examPortalCodes, setExamPortalCodes] = useState<Record<string, string>>({});
  const [createdExamPortals, setCreatedExamPortals] = useState<Record<string, any>>(() => {
    try {
      return JSON.parse(localStorage.getItem(examPortalStorageKey) || '{}');
    } catch {
      return {};
    }
  });

  const moduleEbookTag = (module: any) => `Module: ${module.id} - ${module.moduleName}`;
  const moduleVideoTag = moduleEbookTag;

  const openVideoDialog = async (module: any) => {
    setVideoModule(module);
    setModuleVideoFile(null);
    setVideoMaterials([]);
    setModuleVideoLoading(true);
    try {
      const response = await api.get(`/operations/programs/${module.programId}/materials`);
      const moduleTag = moduleVideoTag(module);
      setVideoMaterials((response.data.data || []).filter((material: any) => (
        material.category === 'video' && material.description === moduleTag
      )));
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to load this module's videos");
    } finally {
      setModuleVideoLoading(false);
    }
  };

  const uploadModuleVideo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!videoModule || !moduleVideoFile) {
      toast.error('Select a video file to upload');
      return;
    }
    if (moduleVideoFile.size > 10 * 1024 * 1024) {
      toast.error('Video must be 10 MB or smaller');
      return;
    }
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];
    const allowedVideoExtensions = ['.mp4', '.webm', '.mov', '.m4v'];
    const extension = moduleVideoFile.name.slice(moduleVideoFile.name.lastIndexOf('.')).toLowerCase();
    if (!allowedVideoTypes.includes(moduleVideoFile.type) || !allowedVideoExtensions.includes(extension)) {
      toast.error('Only MP4, WebM, MOV, or M4V videos are allowed');
      return;
    }

    setModuleVideoUploading(true);
    try {
      const formData = new FormData();
      formData.append('moduleId', videoModule.id);
      formData.append('file', moduleVideoFile);
      const response = await api.post(
        `/operations/programs/${videoModule.programId}/videos`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setVideoMaterials(current => [response.data.data, ...current]);
      setModuleVideoFile(null);
      toast.success('Video uploaded successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload video');
    } finally {
      setModuleVideoUploading(false);
    }
  };

  const deleteModuleVideo = async (material: any) => {
    if (!videoModule || !window.confirm(`Delete "${material.fileName}"?`)) return;
    try {
      await api.delete(`/operations/programs/${videoModule.programId}/materials/${material.id}`);
      setVideoMaterials(current => current.filter(item => item.id !== material.id));
      toast.success('Video deleted');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete video');
    }
  };

  const openEbookDialog = async (module: any) => {
    setEbookModule(module);
    setEbookFile(null);
    setEbookEditingMaterialId(null);
    setEbookMaterials([]);
    setEbookLoading(true);
    try {
      const response = await api.get(`/operations/programs/${module.programId}/materials`);
      const moduleTag = moduleEbookTag(module);
      setEbookMaterials((response.data.data || []).filter((material: any) => (
        material.category === 'ebook' && material.description === moduleTag
      )));
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to load this module's E-Books");
    } finally {
      setEbookLoading(false);
    }
  };

  const fetchAllEbooks = async () => {
    setAllEbooksLoading(true);
    try {
      const response = await api.get('/operations/ebooks');
      setAllEbooks(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load E-Books');
    } finally {
      setAllEbooksLoading(false);
    }
  };

  useEffect(() => {
    if (initialTab === 'academic-ebooks') fetchAllEbooks();
    if (initialTab === 'academic-video-classes') fetchVideoClasses();
    if (initialTab === 'academic-scheduled-classes') fetchScheduledClasses();
    if (initialTab === 'academic-calendar') {
      fetchCalendarEvents();
      fetchCalendarAuxiliaryData();
    }
  }, [initialTab]);

  const fetchCalendarEvents = async (customFilters?: {
    academicSessionId?: string;
    semesterId?: string;
    category?: string;
    departmentId?: string;
    studyCenterId?: string;
  }) => {
    setCalendarLoading(true);
    try {
      const activeSession = customFilters?.academicSessionId !== undefined ? customFilters.academicSessionId : calFilterSession;
      const activeSemester = customFilters?.semesterId !== undefined ? customFilters.semesterId : calFilterSemester;
      const activeCategory = customFilters?.category !== undefined ? customFilters.category : calFilterCategory;
      const activeDept = customFilters?.departmentId !== undefined ? customFilters.departmentId : calFilterDepartment;
      const activeCenter = customFilters?.studyCenterId !== undefined ? customFilters.studyCenterId : calFilterStudyCenter;

      const params: any = {};
      if (activeSession && activeSession !== 'all') params.academicSessionId = activeSession;
      if (activeSemester && activeSemester !== 'all') params.semesterId = activeSemester;
      if (activeCategory && activeCategory !== 'all') params.category = activeCategory;
      if (activeDept && activeDept !== 'all') params.departmentId = activeDept;
      if (activeCenter && activeCenter !== 'all') params.studyCenterId = activeCenter;

      const response = await api.get('/operations/academic-calendar', { params });
      setCalendarEvents(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load academic calendar');
    } finally {
      setCalendarLoading(false);
    }
  };

  const fetchCalendarAuxiliaryData = async () => {
    try {
      const [deptRes, centerRes] = await Promise.all([
        api.get('/departments').catch(() => ({ data: [] })),
        api.get('/operations/centers').catch(() => ({ data: { data: [] } })),
      ]);
      const depts = Array.isArray(deptRes.data) ? deptRes.data : deptRes.data?.data || [];
      const centers = Array.isArray(centerRes.data) ? centerRes.data : centerRes.data?.data || [];
      setCalDepartments(depts);
      setCalStudyCenters(centers);
    } catch {
      // ignore
    }
  };

  const applyCalendarFilters = () => {
    fetchCalendarEvents();
  };

  const resetCalendarFilters = () => {
    setCalFilterSession('all');
    setCalFilterSemester('all');
    setCalFilterCategory('all');
    setCalFilterDepartment('all');
    setCalFilterStudyCenter('all');
    fetchCalendarEvents({
      academicSessionId: 'all',
      semesterId: 'all',
      category: 'all',
      departmentId: 'all',
      studyCenterId: 'all',
    });
  };

  const openAddCalendarEventModal = (prefillDate?: string) => {
    const defaultDate = prefillDate || '2026-10-25';
    const activeSession = sessions.find((s: any) => s.status === 'active') || sessions[0];
    setEditingCalendarEventId(null);
    setCalendarForm({
      title: '',
      category: '',
      academicSessionId: activeSession?.id || '',
      programId: '',
      semesterId: '',
      startDate: defaultDate,
      endDate: defaultDate,
      startTime: '',
      endTime: '',
      description: '',
    });
    setCalendarModalSemesters([]);
    setCalendarModalOpen(true);
  };

  const handleCalendarProgramChange = async (programId: string) => {
    setCalendarForm(prev => ({ ...prev, programId: programId === 'all' ? '' : programId, semesterId: '' }));
    setCalendarModalSemesters([]);
    if (!programId || programId === 'all') return;
    setCalendarModalSemestersLoading(true);
    try {
      const response = await api.get(`/operations/programs/${programId}/semesters`);
      setCalendarModalSemesters(response.data.data || []);
    } catch {
      toast.error('Failed to load semesters for program');
    } finally {
      setCalendarModalSemestersLoading(false);
    }
  };

  const handleCalendarEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calendarForm.title.trim()) {
      toast.error('Please enter an event title');
      return;
    }
    if (!calendarForm.category) {
      toast.error('Please select an event category');
      return;
    }
    if (!calendarForm.academicSessionId) {
      toast.error('Please select an academic year');
      return;
    }
    if (!calendarForm.startDate) {
      toast.error('Please select a start date');
      return;
    }
    if (!calendarForm.endDate) {
      toast.error('Please select an end date');
      return;
    }

    if (new Date(calendarForm.endDate) < new Date(calendarForm.startDate)) {
      toast.error('End date cannot be earlier than start date');
      return;
    }

    if (calendarForm.startDate === calendarForm.endDate && calendarForm.startTime && calendarForm.endTime) {
      if (calendarForm.endTime < calendarForm.startTime) {
        toast.error('End time cannot be earlier than start time');
        return;
      }
    }

    setCalendarSaving(true);
    try {
      const payload = {
        title: calendarForm.title.trim(),
        category: calendarForm.category,
        academicSessionId: calendarForm.academicSessionId,
        programId: calendarForm.programId && calendarForm.programId !== 'all' ? calendarForm.programId : null,
        semesterId: calendarForm.semesterId && calendarForm.semesterId !== 'all' ? calendarForm.semesterId : null,
        startDate: calendarForm.startDate,
        endDate: calendarForm.endDate,
        startTime: calendarForm.startTime ? calendarForm.startTime.trim() : null,
        endTime: calendarForm.endTime ? calendarForm.endTime.trim() : null,
        description: calendarForm.description ? calendarForm.description.trim() : null,
      };

      if (editingCalendarEventId) {
        await api.put(`/operations/academic-calendar/${editingCalendarEventId}`, payload);
        toast.success('Academic event updated successfully');
      } else {
        await api.post('/operations/academic-calendar', payload);
        toast.success('Academic event created successfully');
      }
      setCalendarModalOpen(false);
      setSelectedCalendarEvent(null);
      fetchCalendarEvents();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save academic event');
    } finally {
      setCalendarSaving(false);
    }
  };

  const handleEditCalendarEvent = (event: any) => {
    setEditingCalendarEventId(event.id);
    const startStr = event.startDate ? new Date(event.startDate).toISOString().split('T')[0] : '';
    const endStr = event.endDate ? new Date(event.endDate).toISOString().split('T')[0] : '';
    setCalendarForm({
      title: event.title || '',
      category: event.category || '',
      academicSessionId: event.academicSessionId || '',
      programId: event.programId || '',
      semesterId: event.semesterId || '',
      startDate: startStr,
      endDate: endStr,
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      description: event.description || '',
    });
    if (event.programId) {
      handleCalendarProgramChange(event.programId);
    }
    setSelectedCalendarEvent(null);
    setCalendarModalOpen(true);
  };

  const handleDeleteCalendarEvent = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this academic event?')) return;
    setDeletingCalendarEventId(id);
    try {
      await api.delete(`/operations/academic-calendar/${id}`);
      toast.success('Academic event deleted successfully');
      setSelectedCalendarEvent(null);
      fetchCalendarEvents();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete academic event');
    } finally {
      setDeletingCalendarEventId(null);
    }
  };

  const formatTimeDisplay = (timeStr?: string | null) => {
    if (!timeStr) return '';
    try {
      const [h, m] = timeStr.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      const formattedH = h % 12 || 12;
      return `${String(formattedH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
    } catch {
      return timeStr;
    }
  };

  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const monthDisplayTitle = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const handleCalendarPrev = () => {
    if (calendarView === 'month' || calendarView === 'agenda') {
      setCalendarDate(new Date(calendarYear, calendarMonth - 1, 1));
    } else if (calendarView === 'week') {
      const nextDate = new Date(calendarDate);
      nextDate.setDate(nextDate.getDate() - 7);
      setCalendarDate(nextDate);
    }
  };

  const handleCalendarNext = () => {
    if (calendarView === 'month' || calendarView === 'agenda') {
      setCalendarDate(new Date(calendarYear, calendarMonth + 1, 1));
    } else if (calendarView === 'week') {
      const nextDate = new Date(calendarDate);
      nextDate.setDate(nextDate.getDate() + 7);
      setCalendarDate(nextDate);
    }
  };

  const handleCalendarToday = () => {
    setCalendarDate(new Date(2026, 9, 25));
  };

  const calendarWeekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInCurrentMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(calendarYear, calendarMonth, 0).getDate();

  const calendarMonthCells: {
    date: Date;
    dayNumber: number;
    isCurrentMonth: boolean;
    dateKey: string;
  }[] = [];

  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const date = new Date(calendarYear, calendarMonth - 1, day);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarMonthCells.push({ date, dayNumber: day, isCurrentMonth: false, dateKey });
  }

  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const date = new Date(calendarYear, calendarMonth, d);
    const dateKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarMonthCells.push({ date, dayNumber: d, isCurrentMonth: true, dateKey });
  }

  const totalCellsNeeded = calendarMonthCells.length <= 35 ? 35 : 42;
  const nextMonthPadding = totalCellsNeeded - calendarMonthCells.length;
  for (let d = 1; d <= nextMonthPadding; d++) {
    const date = new Date(calendarYear, calendarMonth + 1, d);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarMonthCells.push({ date, dayNumber: d, isCurrentMonth: false, dateKey });
  }

  const getCalendarEventsForDate = (dateKey: string) => {
    return calendarEvents.filter(event => {
      if (!event.startDate) return false;
      const startKey = new Date(event.startDate).toISOString().split('T')[0];
      const endKey = event.endDate ? new Date(event.endDate).toISOString().split('T')[0] : startKey;
      return dateKey >= startKey && dateKey <= endKey;
    });
  };

  const currentDayOfWeek = calendarDate.getDay();
  const weekStart = new Date(calendarDate);
  weekStart.setDate(calendarDate.getDate() - currentDayOfWeek);

  const calendarWeekDaysList = Array.from({ length: 7 }, (_, idx) => {
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + idx);
    const dateKey = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
    return {
      date: dayDate,
      dayName: calendarWeekDays[idx],
      dayNumber: dayDate.getDate(),
      dateKey,
    };
  });

  const upcomingEventsList = [...calendarEvents]
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 8);

  const fetchScheduledClasses = async () => {
    setScheduledClassLoading(true);
    try {
      const response = await api.get('/operations/scheduled-classes');
      setScheduledClasses(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load scheduled classes');
    } finally {
      setScheduledClassLoading(false);
    }
  };

  const handleScheduledSessionChange = (academicSessionId: string) => {
    setScheduledClassForm({
      academicSessionId,
      programId: '',
      semesterId: '',
      moduleId: '',
      title: '',
      startsAt: '',
      meetingUrl: '',
    });
    setScheduledClassSemesters([]);
    setScheduledClassModules([]);
    setSchedulableStudents([]);
    setSelectedScheduledStudentIds([]);
  };

  const handleScheduledProgramChange = async (programId: string) => {
    setScheduledClassForm(current => ({ ...current, programId, semesterId: '', moduleId: '' }));
    setScheduledClassSemesters([]);
    setScheduledClassModules([]);
    setSchedulableStudents([]);
    setSelectedScheduledStudentIds([]);
    if (!programId || !scheduledClassForm.academicSessionId) return;
    setScheduledClassLoading(true);
    setSchedulableStudentsLoading(true);
    try {
      const [semestersResponse, studentsResponse] = await Promise.all([
        api.get(`/operations/programs/${programId}/semesters`),
        api.get('/operations/scheduled-classes/students', {
          params: { academicSessionId: scheduledClassForm.academicSessionId, programId },
        }),
      ]);
      setScheduledClassSemesters(semestersResponse.data.data || []);
      setSchedulableStudents(studentsResponse.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load semesters or enrolled students');
    } finally {
      setScheduledClassLoading(false);
      setSchedulableStudentsLoading(false);
    }
  };

  const handleScheduledSemesterChange = async (semesterId: string) => {
    setScheduledClassForm(current => ({ ...current, semesterId, moduleId: '' }));
    setScheduledClassModules([]);
    if (!semesterId || !scheduledClassForm.programId) return;
    setScheduledClassLoading(true);
    try {
      const response = await api.get(`/operations/programs/${scheduledClassForm.programId}/modules`, {
        params: { semesterId },
      });
      setScheduledClassModules(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load modules');
    } finally {
      setScheduledClassLoading(false);
    }
  };

  const handleScheduledClassSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedScheduledStudentIds.length === 0) {
      toast.error('Select at least one enrolled student');
      return;
    }
    setScheduledClassSaving(true);
    try {
      await api.post('/operations/scheduled-classes', {
        ...scheduledClassForm,
        studentIds: selectedScheduledStudentIds,
      });
      toast.success('Class scheduled and students notified');
      setScheduledClassForm({
        academicSessionId: '',
        programId: '',
        semesterId: '',
        moduleId: '',
        title: '',
        startsAt: '',
        meetingUrl: '',
      });
      setScheduledClassSemesters([]);
      setScheduledClassModules([]);
      setSchedulableStudents([]);
      setSelectedScheduledStudentIds([]);
      await fetchScheduledClasses();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to schedule class');
    } finally {
      setScheduledClassSaving(false);
    }
  };

  const fetchVideoClasses = async () => {
    setVideoLoading(true);
    try {
      const response = await api.get('/operations/video-classes');
      setVideoClasses(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load video classes');
    } finally {
      setVideoLoading(false);
    }
  };

  const handleVideoSessionChange = (sessionId: string) => {
    setVideoForm(prev => ({
      ...prev,
      sessionId,
      programId: '',
      semesterId: '',
      moduleId: '',
    }));
    setVideoSemesters([]);
    setVideoModules([]);
  };

  const handleVideoProgramChange = async (programId: string) => {
    setVideoForm(prev => ({
      ...prev,
      programId,
      semesterId: '',
      moduleId: '',
    }));
    setVideoSemesters([]);
    setVideoModules([]);
    if (!programId) return;
    setVideoSemestersLoading(true);
    try {
      const res = await api.get(`/operations/programs/${programId}/semesters`);
      setVideoSemesters(res.data.data || []);
    } catch {
      toast.error('Failed to load semesters for program');
    } finally {
      setVideoSemestersLoading(false);
    }
  };

  const handleVideoSemesterChange = async (semesterId: string) => {
    setVideoForm(prev => ({
      ...prev,
      semesterId,
      moduleId: '',
    }));
    setVideoModules([]);
    if (!semesterId || !videoForm.programId) return;
    setVideoModulesLoading(true);
    try {
      const res = await api.get(`/operations/programs/${videoForm.programId}/modules`, {
        params: { semesterId },
      });
      setVideoModules(res.data.data || []);
    } catch {
      toast.error('Failed to load modules for semester');
    } finally {
      setVideoModulesLoading(false);
    }
  };

  const resetVideoForm = () => {
    setEditingVideoId(null);
    setVideoFile(null);
    setVideoForm({
      sessionId: '',
      programId: '',
      semesterId: '',
      moduleId: '',
      title: '',
      description: '',
      youtubeUrl: '',
    });
    setVideoSemesters([]);
    setVideoModules([]);
  };

  const openAddVideoModal = () => {
    resetVideoForm();
    const activeSession = sessions.find((s: any) => s.status === 'active');
    if (activeSession) {
      setVideoForm(prev => ({ ...prev, sessionId: activeSession.id }));
    }
    setVideoModalOpen(true);
  };

  const handleVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoForm.sessionId) {
      toast.error('Please select an academic session');
      return;
    }
    if (!videoForm.programId) {
      toast.error('Please select an academic program');
      return;
    }
    if (!videoForm.semesterId) {
      toast.error('Please select a semester');
      return;
    }
    if (!videoForm.moduleId) {
      toast.error('Please select a module');
      return;
    }
    if (!videoForm.title.trim()) {
      toast.error('Please enter a video title');
      return;
    }
    if (!editingVideoId && !videoFile && !videoForm.youtubeUrl.trim()) {
      toast.error('Please upload a video file or provide a YouTube video link');
      return;
    }

    setVideoSaving(true);
    try {
      const selectedSession = sessions.find(s => s.id === videoForm.sessionId);
      const selectedProgram = programs.find(p => p.id === videoForm.programId);
      const selectedSem = videoSemesters.find(s => s.id === videoForm.semesterId);
      const selectedMod = videoModules.find(m => m.id === videoForm.moduleId);

      const formData = new FormData();
      formData.append('title', videoForm.title.trim());
      formData.append('description', videoForm.description.trim());
      formData.append('sessionId', videoForm.sessionId);
      formData.append('sessionName', selectedSession ? displaySession(selectedSession.id) : '');
      formData.append('programId', videoForm.programId);
      formData.append('programName', selectedProgram?.name || '');
      formData.append('semesterId', videoForm.semesterId);
      formData.append('semesterName', selectedSem?.semesterName || '');
      formData.append('moduleId', videoForm.moduleId);
      formData.append('moduleName', selectedMod?.moduleName || '');
      if (videoForm.youtubeUrl.trim()) {
        formData.append('youtubeUrl', videoForm.youtubeUrl.trim());
      }
      if (videoFile) {
        formData.append('file', videoFile);
      }

      if (editingVideoId) {
        await api.put(`/operations/video-classes/${editingVideoId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Video class updated successfully');
      } else {
        await api.post('/operations/video-classes', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Video class saved successfully');
      }

      setVideoModalOpen(false);
      resetVideoForm();
      fetchVideoClasses();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save video class');
    } finally {
      setVideoSaving(false);
    }
  };

  const handleEditVideo = async (item: any) => {
    setEditingVideoId(item.id);
    setVideoFile(null);
    setVideoForm({
      sessionId: item.sessionId || '',
      programId: item.programId || '',
      semesterId: item.semesterId || '',
      moduleId: item.moduleId || '',
      title: item.title || '',
      description: item.description || '',
      youtubeUrl: item.youtubeUrl || '',
    });

    if (item.programId) {
      setVideoSemestersLoading(true);
      try {
        const semRes = await api.get(`/operations/programs/${item.programId}/semesters`);
        setVideoSemesters(semRes.data.data || []);
      } catch {
        // silent
      } finally {
        setVideoSemestersLoading(false);
      }

      if (item.semesterId) {
        setVideoModulesLoading(true);
        try {
          const modRes = await api.get(`/operations/programs/${item.programId}/modules`, {
            params: { semesterId: item.semesterId },
          });
          setVideoModules(modRes.data.data || []);
        } catch {
          // silent
        } finally {
          setVideoModulesLoading(false);
        }
      }
    }

    setVideoModalOpen(true);
  };

  const handleDeleteVideo = async (item: any) => {
    if (!window.confirm(`Delete video class "${item.title}"?`)) return;
    try {
      await api.delete(`/operations/video-classes/${item.id}`);
      toast.success('Video class deleted successfully');
      if (editingVideoId === item.id) {
        resetVideoForm();
      }
      fetchVideoClasses();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete video class');
    }
  };

  const getYouTubeEmbedUrl = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}` : null;
  };

  const videoAvailableSemesters = Array.from(
    new Map(
      videoClasses
        .filter(item => {
          if (videoFilterSession !== 'all' && item.sessionId !== videoFilterSession) return false;
          if (videoFilterProgram !== 'all' && item.programId !== videoFilterProgram) return false;
          return Boolean(item.semesterId && item.semesterName);
        })
        .map(item => [item.semesterId, item.semesterName])
    ).entries()
  ).map(([id, name]) => ({ id, name }));

  const videoAvailableModules = Array.from(
    new Map(
      videoClasses
        .filter(item => {
          if (videoFilterSession !== 'all' && item.sessionId !== videoFilterSession) return false;
          if (videoFilterProgram !== 'all' && item.programId !== videoFilterProgram) return false;
          if (videoFilterSemester !== 'all' && item.semesterId !== videoFilterSemester) return false;
          return Boolean(item.moduleId && item.moduleName);
        })
        .map(item => [item.moduleId, item.moduleName])
    ).entries()
  ).map(([id, name]) => ({ id, name }));

  const filteredVideoClasses = videoClasses.filter(item => {
    if (videoSearch.trim() && !item.title?.toLowerCase().includes(videoSearch.trim().toLowerCase())) {
      return false;
    }
    if (videoFilterSession !== 'all' && item.sessionId !== videoFilterSession) {
      return false;
    }
    if (videoFilterProgram !== 'all' && item.programId !== videoFilterProgram) {
      return false;
    }
    if (videoFilterSemester !== 'all' && item.semesterId !== videoFilterSemester) {
      return false;
    }
    if (videoFilterModule !== 'all' && item.moduleId !== videoFilterModule) {
      return false;
    }
    return true;
  });

  const uploadModuleEbook = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ebookModule || !ebookFile) {
      toast.error('Select a PDF document to upload');
      return;
    }
    if (ebookFile.type !== 'application/pdf' && !ebookFile.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF documents are allowed');
      return;
    }

    setEbookUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', ebookFile.name);
      formData.append('description', moduleEbookTag(ebookModule));
      formData.append('category', 'ebook');
      formData.append('file', ebookFile);
      const endpoint = `/operations/programs/${ebookModule.programId}/materials`;
      const response = ebookEditingMaterialId
        ? await api.put(`${endpoint}/${ebookEditingMaterialId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        : await api.post(endpoint, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (ebookEditingMaterialId) {
        setEbookMaterials(current => current.map(material => material.id === ebookEditingMaterialId ? response.data.data : material));
        toast.success('E-Book updated successfully');
      } else {
        setEbookMaterials(current => [response.data.data, ...current]);
        toast.success('E-Book uploaded successfully');
      }
      setEbookEditingMaterialId(null);
      setEbookFile(null);
      if (initialTab === 'academic-ebooks') fetchAllEbooks();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save E-Book');
    } finally {
      setEbookUploading(false);
    }
  };

  const deleteModuleEbook = async (material: any) => {
    const programId = ebookModule?.programId || material.programId;
    if (!programId || !window.confirm(`Delete "${material.fileName}"?`)) return;
    try {
      await api.delete(`/operations/programs/${programId}/materials/${material.id}`);
      setEbookMaterials(current => current.filter(item => item.id !== material.id));
      setAllEbooks(current => current.filter(item => item.id !== material.id));
      setEbookEditingMaterialId(current => current === material.id ? null : current);
      toast.success('E-Book deleted');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete E-Book');
    }
  };

  const editAllEbook = async (material: any) => {
    if (!material.module) return;
    await openEbookDialog({ ...material.module, programId: material.programId });
    setEbookEditingMaterialId(material.id);
  };

  const openAddNoteModal = () => {
    const activeSession = sessions.find((s: any) => s.status === 'active');
    const defaultSessionId = activeSession ? activeSession.id : (sessions[0]?.id || '');
    setAddNoteSessionId(defaultSessionId);
    setAddNoteProgramId('');
    setAddNoteSemesterId('');
    setAddNoteModuleId('');
    setAddNoteBookName('');
    setAddNoteFile(null);
    setAddNoteSemesters([]);
    setAddNoteModules([]);
    setAddNoteModalOpen(true);
  };

  const handleAddNoteSessionChange = (sessionId: string) => {
    setAddNoteSessionId(sessionId);
    setAddNoteProgramId('');
    setAddNoteSemesterId('');
    setAddNoteModuleId('');
    setAddNoteSemesters([]);
    setAddNoteModules([]);
  };

  const handleAddNoteProgramChange = async (programId: string) => {
    setAddNoteProgramId(programId);
    setAddNoteSemesterId('');
    setAddNoteModuleId('');
    setAddNoteSemesters([]);
    setAddNoteModules([]);
    if (!programId) return;
    setAddNoteSemestersLoading(true);
    try {
      const res = await api.get(`/operations/programs/${programId}/semesters`);
      setAddNoteSemesters(res.data.data || []);
    } catch {
      toast.error('Failed to load semesters for program');
    } finally {
      setAddNoteSemestersLoading(false);
    }
  };

  const handleAddNoteSemesterChange = async (semesterId: string) => {
    setAddNoteSemesterId(semesterId);
    setAddNoteModuleId('');
    setAddNoteModules([]);
    if (!semesterId || !addNoteProgramId) return;
    setAddNoteModulesLoading(true);
    try {
      const res = await api.get(`/operations/programs/${addNoteProgramId}/modules`, {
        params: { semesterId },
      });
      setAddNoteModules(res.data.data || []);
    } catch {
      toast.error('Failed to load modules for semester');
    } finally {
      setAddNoteModulesLoading(false);
    }
  };

  const handleAddNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addNoteSessionId) {
      toast.error('Please select an Academic Session');
      return;
    }
    if (!addNoteProgramId) {
      toast.error('Please select a Program');
      return;
    }
    if (!addNoteSemesterId) {
      toast.error('Please select a Semester');
      return;
    }
    if (!addNoteModuleId) {
      toast.error('Please select a Module');
      return;
    }
    if (!addNoteBookName.trim()) {
      toast.error('Please enter the Book Name');
      return;
    }
    if (!addNoteFile) {
      toast.error('Please upload a note file');
      return;
    }

    const allowedExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg'];
    const fileNameLower = addNoteFile.name.toLowerCase();
    const isAllowed = allowedExts.some(ext => fileNameLower.endsWith(ext));
    if (!isAllowed) {
      toast.error('Invalid file type. Please upload a Document (.pdf, .doc, .docx, .xls, .xlsx) or Image (.png, .jpg, .jpeg)');
      return;
    }

    const selectedModule = addNoteModules.find((m: any) => m.id === addNoteModuleId);
    const selectedSemester = addNoteSemesters.find((s: any) => s.id === addNoteSemesterId);
    const moduleTag = selectedModule ? moduleEbookTag(selectedModule) : `Module: ${addNoteModuleId} - Unknown`;
    const semesterNum = selectedSemester?.semesterNumber ? String(selectedSemester.semesterNumber) : addNoteSemesterId;

    setAddNoteSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', addNoteBookName.trim());
      formData.append('description', moduleTag);
      formData.append('category', 'ebook');
      formData.append('semesterNumber', semesterNum);
      formData.append('file', addNoteFile);

      await api.post(`/operations/programs/${addNoteProgramId}/materials`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Notes saved successfully');
      setAddNoteModalOpen(false);
      setAddNoteFile(null);
      setAddNoteBookName('');
      await fetchAllEbooks();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save notes');
    } finally {
      setAddNoteSaving(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const response = await api.get('/operations/sessions');
      const rawSessions = response.data.data || [];
      const loadedSessions = rawSessions.map((session: any) => ({
        ...session,
        startYear: session.startYear !== undefined && session.startYear !== null
          ? Number(session.startYear)
          : session.startDate
          ? new Date(session.startDate).getFullYear()
          : (parseInt(session.name, 10) || 0),
      })).sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      setSessions(loadedSessions);
      const activeSession = loadedSessions.find((session: any) => session.status === 'active');
      const defaultSessionId = activeSession?.id || loadedSessions[0]?.id || null;
      if (initialTab !== 'academic-programs') {
        setSelectedSessionId(current => current || defaultSessionId);
        if (defaultSessionId) {
          setProgramSessionFilter(current => (current === 'active' || !current ? defaultSessionId : current));
        }
      } else {
        setSelectedSessionId(null);
        setProgramSessionFilter('all');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load academic sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, []);

  useEffect(() => {
    localStorage.setItem(examPortalStorageKey, JSON.stringify(createdExamPortals));
  }, [createdExamPortals]);

  useEffect(() => {
    const scroller = sessionScrollerRef.current;
    const activeSession = scroller?.querySelector<HTMLElement>('[data-session-active="true"]');
    activeSession?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
  }, [sessions]);

  const fetchPrograms = async () => {
    setProgramLoading(true);
    try {
      const response = await api.get('/operations/programs');
      setPrograms(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load programs');
    } finally {
      setProgramLoading(false);
    }
  };

  useEffect(() => { fetchPrograms(); }, []);

  useEffect(() => {
    const section = initialTab === 'academic-semesters' ? 'semesters' : initialTab === 'academic-modules' ? 'modules' : initialTab === 'academic-programs' ? 'programs' : 'programs';
    setActiveSection(section);
    if (initialTab === 'academic-programs') {
      setProgramSessionFilter('all');
      setSelectedSessionId(null);
    }
  }, [initialTab]);

  const activeSessionIds = new Set(sessions.filter(s => s.status === 'active').map(s => s.id));

  const displayedPrograms = (() => {
    if (programSessionFilter === 'all') {
      return programs;
    }
    if (programSessionFilter === 'active') {
      if (activeSessionIds.size === 0) return programs;
      return programs.filter(program => program.academicSessionId && activeSessionIds.has(program.academicSessionId));
    }
    return programs.filter(program => program.academicSessionId === programSessionFilter);
  })();

  const filteredPrograms = displayedPrograms.filter(program => {
    if (!programSearch.trim()) return true;
    const query = programSearch.toLowerCase();
    return (
      program.name?.toLowerCase().includes(query) ||
      (program.courseName || '').toLowerCase().includes(query) ||
      (program.code || '').toLowerCase().includes(query)
    );
  });

  const displaySession = (sessionId: string | null | undefined) => {
    const session = sessions.find(item => item.id === sessionId);
    return session ? `${new Date(session.startDate).getFullYear()} - ${new Date(session.endDate).getFullYear()}` : 'Unknown session';
  };

  const fetchExaminations = async () => {
    setExaminationLoading(true);
    try {
      const response = await api.get('/operations/examinations');
      setExaminations(response.data.data || []);
    } catch (error: any) { toast.error(error.response?.data?.message || 'Failed to load examinations'); }
    finally { setExaminationLoading(false); }
  };

  useEffect(() => {
    if (['academic-examination', 'academic-examination-create', 'academic-examination-scheduled', 'academic-examination-manage', 'academic-examination-registered', 'academic-examination-portal'].includes(initialTab || '')) {
      fetchExaminations();
    }
  }, [initialTab]);

  const examinationPrograms = examinationForm.academicSessionId === '' ? programs : programs.filter(program => program.academicSessionId === examinationForm.academicSessionId);
  const examinationSemesters = semesters.filter(semester => (!examinationForm.programId || semester.programId === examinationForm.programId) && (!examinationForm.academicSessionId || semester.academicSessionId === examinationForm.academicSessionId));
  const filteredExaminations = examinations.filter(examination => (examinationFilters.sessionId === 'all' || examination.academicSessionId === examinationFilters.sessionId) && (examinationFilters.programId === 'all' || examination.programId === examinationFilters.programId) && (examinationFilters.semesterId === 'all' || examination.semesterId === examinationFilters.semesterId) && (examinationFilters.status === 'all' || examination.status === examinationFilters.status));
  const portalExaminations = examPortalForm.academicSessionId
    ? examinations.filter(examination => examination.academicSessionId === examPortalForm.academicSessionId)
    : [];
  const examinationView = initialTab === 'academic-examination-scheduled' ? 'scheduled' : initialTab === 'academic-examination-manage' ? 'manage' : 'create';

  const fetchRegisteredStudents = async (examinationId: string) => {
    setRegisteredExaminationId(examinationId);
    setRegisteredStudentsLoading(true);
    try {
      const response = await api.get(examinationId === 'all' ? '/operations/examinations/registrations' : `/operations/examinations/${examinationId}/registrations`);
      setRegisteredStudents(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load registered students');
      setRegisteredStudents([]);
    } finally {
      setRegisteredStudentsLoading(false);
    }
  };

  const removeRegisteredStudent = async (registration: any) => {
    if (!window.confirm(`Remove ${registration.fullName} from this examination?`)) return;
    setRemovingRegistrationId(registration.id);
    try {
      await api.delete(`/operations/examinations/registrations/${registration.id}`);
      toast.success('Student removed from the examination');
      await fetchRegisteredStudents(registeredExaminationId);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to remove student');
    } finally {
      setRemovingRegistrationId(null);
    }
  };

  useEffect(() => {
    if (initialTab === 'academic-examination-registered') fetchRegisteredStudents('all');
  }, [initialTab]);

  const openExaminationDialog = () => {
    setEditingExaminationId(null);
    setExaminationStep(1);
    setSelectedModuleIds([]);
    setExaminationSchedule([]);
    setExaminationForm({ examinationName: '', examinationType: '', academicSessionId: '', programId: '', semesterId: '', startDate: '', endDate: '', description: '' });
    setExaminationDialogOpen(true);
  };

  const handleEditExamination = (examination: any) => {
    setEditingExaminationId(examination.id);
    setExaminationForm({
      examinationName: examination.examinationName || '',
      examinationType: examination.examinationType || '',
      academicSessionId: examination.academicSessionId || '',
      programId: examination.programId || '',
      semesterId: examination.semesterId || '',
      startDate: examination.startDate ? new Date(examination.startDate).toISOString().slice(0, 10) : '',
      endDate: examination.endDate ? new Date(examination.endDate).toISOString().slice(0, 10) : '',
      description: examination.description || '',
    });
    setSelectedModuleIds(Array.isArray(examination.moduleIds) ? examination.moduleIds : []);
    setExaminationSchedule(Array.isArray(examination.schedule) ? examination.schedule.map((row: any) => ({
      moduleId: row.moduleId || '',
      date: row.date || '',
      startTime: row.startTime || '09:30',
      endTime: row.endTime || '12:30',
      maxMarks: row.maxMarks ?? '',
      passingMarks: row.passingMarks ?? '',
      examDuration: row.examDuration ?? '120',
    })) : []);
    setExaminationStep(1);
    setExaminationDialogOpen(true);
  };

  const submitExamination = async () => {
    try {
      const payload = { ...examinationForm, moduleIds: selectedModuleIds, schedule: examinationSchedule };
      if (editingExaminationId) {
        await api.put(`/operations/examinations/${editingExaminationId}`, payload);
        toast.success('Examination updated');
      } else {
        await api.post('/operations/examinations', payload);
        toast.success('Examination created');
      }
      setExaminationDialogOpen(false);
      setEditingExaminationId(null);
      fetchExaminations();
    } catch (error: any) { toast.error(error.response?.data?.message || 'Failed to save examination'); }
  };

  const handleDeleteExamination = async (examination: any) => {
    if (!window.confirm(`Delete ${examination.examinationName}?`)) return;
    try {
      await api.delete(`/operations/examinations/${examination.id}`);
      toast.success('Examination deleted');
      fetchExaminations();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete examination');
    }
  };

  const [publishingExamId, setPublishingExamId] = useState<string | null>(null);
  const [openingPortalWorkspace, setOpeningPortalWorkspace] = useState(false);

  // Single sign-on: opens the Exam Portal (question bank, bulk upload, assessments) already signed in as this user.
  const openExamPortalWorkspace = async () => {
    const win = window.open('about:blank', '_blank');
    if (!win) { toast.error('Allow pop-ups to open the Exam Portal'); return; }
    setOpeningPortalWorkspace(true);
    try {
      const response = await api.post('/operations/exam-portal/staff-launch');
      win.opener = null;
      win.location.href = response.data.data.launchUrl;
    } catch (error: any) {
      win.close();
      toast.error(error.response?.data?.message || 'Could not open the Exam Portal');
    } finally {
      setOpeningPortalWorkspace(false);
    }
  };

  // Creates/updates the examination in the connected Exam Portal. Returns false when it must not continue.
  const publishToExamPortal = async (examination: any) => {
    if (!examPortalForm.examDate || !examPortalForm.examTime) {
      toast.error('Select the exam date and time first');
      return false;
    }
    const startsAt = new Date(`${examPortalForm.examDate}T${examPortalForm.examTime}`);
    if (Number.isNaN(startsAt.getTime())) { toast.error('Exam date or time is invalid'); return false; }
    setPublishingExamId(examination.id);
    try {
      const response = await api.post(`/operations/examinations/${examination.id}/exam-portal`, { startsAt: startsAt.toISOString() });
      toast.success(`Exam Portal confirmed: assessment ${response.data.data.outcome}`);
      return true;
    } catch (error: any) {
      if (error.response?.status === 503) {
        toast.warning('Exam Portal is not connected on the server. The portal was created here only.');
        return true;
      }
      toast.error(error.response?.data?.message || 'The examination could not be created in the Exam Portal');
      return false;
    } finally {
      setPublishingExamId(null);
    }
  };

  const generateExamLink = async (examination: any) => {
    if (!examination) return;
    if (!(await publishToExamPortal(examination))) return;
    const programName = programs.find(program => program.id === examination.programId)?.name || 'PROGRAM';
    const clean = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'EXAM';
    const date = examPortalForm.examDate.replace(/-/g, '');
    const time = examPortalForm.examTime.replace(':', '') || '0000';
    const code = examPortalCodes[examination.id] || `${clean(programName)}-${clean(examination.examinationName)}-${date}-${clean(examPortalForm.examSession)}-${time}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    setExamPortalCodes(current => ({ ...current, [examination.id]: code }));
    const params = new URLSearchParams({
      code,
      date: examPortalForm.examDate,
      session: examPortalForm.examSession,
      time: examPortalForm.examTime,
    });
    const link = `${window.location.origin}/student/examinations/${examination.id}?${params.toString()}`;
    const createdPortal = {
      examinationId: examination.id,
      examinationName: examination.examinationName,
      examinationType: examination.examinationType,
      academicSessionId: examPortalForm.academicSessionId,
      programName,
      examDate: examPortalForm.examDate,
      examSession: examPortalForm.examSession,
      examTime: examPortalForm.examTime,
      isOpen: true,
      code,
      link,
    };
    setCreatedExamPortals(current => ({ ...current, [examination.id]: createdPortal }));
    try {
      const storedPortals = JSON.parse(localStorage.getItem(examPortalStorageKey) || '{}');
      localStorage.setItem(examPortalStorageKey, JSON.stringify({ ...storedPortals, [examination.id]: createdPortal }));
    } catch {
      toast.error('Exam portal could not be saved in this browser');
    }
    navigator.clipboard?.writeText(link);
    toast.success(`Exam portal created. Code: ${code}`);
    onNavigate?.('academic-examination-portal');
  };

  const selectExamForPortal = (examId: string) => {
    const examination = examinations.find(item => item.id === examId);
    setExamPortalForm(current => ({
      ...current,
      examId,
      academicSessionId: examination?.academicSessionId || current.academicSessionId,
      programId: examination?.programId || current.programId,
      examDate: examination?.startDate ? new Date(examination.startDate).toISOString().slice(0, 10) : current.examDate,
    }));
  };

  const setExamPortalStatus = (portal: any, isOpen: boolean) => {
    const updatedPortal = { ...portal, isOpen };
    setCreatedExamPortals(current => ({ ...current, [portal.examinationId]: updatedPortal }));
    try {
      const storedPortals = JSON.parse(localStorage.getItem(examPortalStorageKey) || '{}');
      localStorage.setItem(examPortalStorageKey, JSON.stringify({ ...storedPortals, [portal.examinationId]: updatedPortal }));
    } catch {
      toast.error('Exam portal status could not be saved in this browser');
    }
    if (isOpen) {
      localStorage.setItem('active-student-exam-portal', JSON.stringify(updatedPortal));
    } else {
      try {
        const activePortal = JSON.parse(localStorage.getItem('active-student-exam-portal') || 'null');
        if (activePortal?.examinationId === portal.examinationId) {
          localStorage.removeItem('active-student-exam-portal');
        }
      } catch {
        localStorage.removeItem('active-student-exam-portal');
      }
    }
    toast.success(`Exam portal ${isOpen ? 'opened' : 'closed'}`);
  };

  const closeExamPortal = (portal: any) => {
    setExamPortalStatus(portal, false);
  };

  const openExamPortal = (portal: any) => {
    setExamPortalStatus(portal, true);
  };

  const selectSessionForPortal = (academicSessionId: string) => {
    setExamPortalForm({ academicSessionId, examId: '', programId: '', examDate: '', examSession: '', examTime: '' });
  };

  const buildScheduleRow = (moduleId = '', date = '', overrides: Partial<Record<string, string>> = {}) => ({
    moduleId,
    date,
    startTime: '09:30',
    endTime: '12:30',
    maxMarks: '',
    passingMarks: '',
    examDuration: '120',
    ...overrides,
  });

  const openExaminationDetails = (examination: any) => {
    setSelectedExamination(examination);
    setViewExaminationDialogOpen(true);
  };

  const goToSchedule = () => {
    setExaminationSchedule(selectedModuleIds.map((moduleId, index) => buildScheduleRow(moduleId, index === 0 ? examinationForm.startDate : '')));
    setExaminationStep(3);
  };

  const addScheduleRow = () => {
    const nextModule = examinationModules.find(module => !examinationSchedule.some(row => row.moduleId === module.id));
    setExaminationSchedule(current => [...current, buildScheduleRow(nextModule?.id || '')]);
  };

  const updateScheduleRow = (index: number, field: string, value: string) => {
    setExaminationSchedule(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  };

  useEffect(() => {
    if (!examinationForm.programId) return;
    const loadExaminationOptions = async () => {
      try {
        const semesterResponse = await api.get(`/operations/programs/${examinationForm.programId}/semesters`);
        const loadedSemesters = semesterResponse.data.data || [];
        setSemesters(previous => [...previous.filter(item => !loadedSemesters.some((loaded: any) => loaded.id === item.id)), ...loadedSemesters]);
        if (examinationForm.semesterId) {
          const moduleResponse = await api.get(`/operations/programs/${examinationForm.programId}/modules`, { params: { semesterId: examinationForm.semesterId } });
          setExaminationModules(moduleResponse.data.data || []);
        }
      } catch (error: any) { toast.error(error.response?.data?.message || 'Failed to load examination options'); }
    };
    loadExaminationOptions();
  }, [examinationForm.programId, examinationForm.semesterId]);

  useEffect(() => {
    if (!['academic-semesters', 'academic-modules'].includes(initialTab || '') || programs.length === 0) return;
    loadAllSemestersAndModules();
  }, [initialTab, programs]);

  const loadAllSemestersAndModules = async () => {
    try {
      const records = await Promise.all(programs.map(async program => {
        const response = await api.get(`/operations/programs/${program.id}/semesters`);
        return (response.data.data || []).map((semester: any) => ({
          ...semester,
          programId: program.id,
          programName: program.name,
          academicSessionId: semester.academicSessionId || program.academicSessionId,
        }));
      }));
      const allSemesters = records.flat();
      setSemesters(allSemesters);
      if (initialTab === 'academic-modules') {
        const moduleRecords = await Promise.all(programs.map(async program => {
          const response = await api.get(`/operations/programs/${program.id}/modules`);
          return (response.data.data || []).map((module: any) => ({
            ...module,
            programId: program.id,
            programName: program.name,
            academicSessionId: module.academicSessionId || program.academicSessionId,
            semesterName: allSemesters.find(semester => semester.id === module.semesterId)?.semesterName || 'Unknown semester',
          }));
        }));
        setModules(moduleRecords.flat());
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load academic records');
    }
  };

  const fetchModules = async (programId: string, semesterId = selectedSemesterId) => {
    setModuleLoading(true);
    try {
      const response = await api.get(`/operations/programs/${programId}/modules`, { params: semesterId ? { semesterId } : undefined });
      setModules(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load modules');
    } finally {
      setModuleLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = {
        name: `${formData.startDate.slice(0, 4)} - ${formData.endDate.slice(0, 4)}`,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status,
      };
      if (editingId) {
        await api.put(`/operations/sessions/${editingId}`, payload);
        toast.success('Academic session updated');
      } else {
        await api.post('/operations/sessions', payload);
        toast.success('Academic session added');
      }
      setDialogOpen(false);
      setEditingId(null);
      setFormData({ startDate: '', endDate: '', status: 'inactive' });
      fetchSessions();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add academic session');
    }
  };

  const handleEdit = (session: any) => {
    setEditingId(session.id);
    setFormData({
      startDate: new Date(session.startDate).toISOString().slice(0, 10),
      endDate: new Date(session.endDate).toISOString().slice(0, 10),
      status: session.status === 'active' ? 'active' : 'inactive',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this academic session?')) return;
    try {
      await api.delete(`/operations/sessions/${id}`);
      toast.success('Academic session deleted');
      fetchSessions();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete academic session');
    }
  };

  const closeDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingId(null);
      setFormData({ startDate: '', endDate: '', status: 'inactive' });
    }
  };

  const openCreateProgram = (templateProg?: any) => {
    setEditingId(null);
    setProgramFormSessionId(selectedSessionId || (sessions[0]?.id || ''));
    if (templateProg) {
      setProgramTemplateId(templateProg.id);
      setProgramCopySemesters(true);
      setProgramForm({
        name: `${templateProg.name} (Copy)`,
        courseName: templateProg.courseName || '',
        duration: String(templateProg.duration || '1'),
        status: templateProg.status || 'active',
        description: templateProg.description || '',
      });
    } else {
      setProgramTemplateId('');
      setProgramCopySemesters(true);
      setProgramForm({ name: '', courseName: '', duration: '', status: 'active', description: '' });
    }
    setProgramDialogOpen(true);
  };

  const openImportDialog = () => {
    const currentTargetId = selectedSessionId || (sessions[0]?.id || '');
    if (!selectedSessionId && sessions[0]?.id) {
      setSelectedSessionId(sessions[0].id);
    }
    const otherSessions = sessions.filter(s => s.id !== currentTargetId);
    setImportSourceSessionId(otherSessions[0]?.id || '');
    setImportSelectedProgramIds([]);
    setImportProgramSemesters({});
    setImportSelectedSemesterIds({});
    setImportSemestersLoading({});
    setImportExpandedProgramIds([]);
    setImportIncludeDetails(true);
    setImportSearch('');
    setImportDialogOpen(true);
  };

  const fetchSemestersForImportProgram = async (programId: string) => {
    if (importProgramSemesters[programId] !== undefined) {
      return importProgramSemesters[programId];
    }
    setImportSemestersLoading(prev => ({ ...prev, [programId]: true }));
    try {
      const response = await api.get(`/operations/programs/${programId}/semesters`);
      const sems = response.data.data || [];
      setImportProgramSemesters(prev => ({ ...prev, [programId]: sems }));
      setImportSelectedSemesterIds(prev => ({
        ...prev,
        [programId]: prev[programId] !== undefined ? prev[programId] : sems.map((s: any) => s.id),
      }));
      return sems;
    } catch {
      toast.error('Failed to load semesters for program');
      return [];
    } finally {
      setImportSemestersLoading(prev => ({ ...prev, [programId]: false }));
    }
  };

  const toggleImportProgram = async (programId: string) => {
    const isSelected = importSelectedProgramIds.includes(programId);
    if (isSelected) {
      setImportSelectedProgramIds(prev => prev.filter(id => id !== programId));
    } else {
      setImportSelectedProgramIds(prev => [...prev, programId]);
      setImportExpandedProgramIds(prev => (prev.includes(programId) ? prev : [...prev, programId]));
      await fetchSemestersForImportProgram(programId);
    }
  };

  const toggleExpandImportProgram = async (programId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    const isExpanded = importExpandedProgramIds.includes(programId);
    if (isExpanded) {
      setImportExpandedProgramIds(prev => prev.filter(id => id !== programId));
    } else {
      setImportExpandedProgramIds(prev => [...prev, programId]);
      await fetchSemestersForImportProgram(programId);
    }
  };

  const toggleImportSemester = (programId: string, semesterId: string) => {
    setImportSelectedSemesterIds(prev => {
      const sems = importProgramSemesters[programId] || [];
      const currentList = prev[programId] !== undefined ? prev[programId] : sems.map(s => s.id);
      const updated = currentList.includes(semesterId)
        ? currentList.filter(id => id !== semesterId)
        : [...currentList, semesterId];
      return { ...prev, [programId]: updated };
    });
  };

  const selectAllSemestersForProgram = (programId: string) => {
    const sems = importProgramSemesters[programId] || [];
    setImportSelectedSemesterIds(prev => ({
      ...prev,
      [programId]: sems.map(s => s.id),
    }));
  };

  const deselectAllSemestersForProgram = (programId: string) => {
    setImportSelectedSemesterIds(prev => ({
      ...prev,
      [programId]: [],
    }));
  };

  const handleImportPrograms = async () => {
    const targetId = selectedSessionId || sessions[0]?.id;
    if (!targetId) {
      toast.error('No target academic session selected');
      return;
    }
    if (!importSourceSessionId) {
      toast.error('Please select a source academic session');
      return;
    }
    if (importSelectedProgramIds.length === 0) {
      toast.error('Please select at least one program to import');
      return;
    }
    setImportLoading(true);
    try {
      const res = await api.post('/operations/programs/import-from-session', {
        sourceSessionId: importSourceSessionId,
        targetSessionId: targetId,
        programIds: importSelectedProgramIds,
        selectedSemesterIds: importSelectedSemesterIds,
        includeSemestersAndModules: importIncludeDetails,
      });
      toast.success(res.data.message || `Successfully imported ${importSelectedProgramIds.length} programs`);
      setImportDialogOpen(false);
      setImportSelectedProgramIds([]);
      setImportProgramSemesters({});
      setImportSelectedSemesterIds({});
      setImportExpandedProgramIds([]);
      await fetchPrograms();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to import programs');
    } finally {
      setImportLoading(false);
    }
  };

  const handleProgramSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const targetSession = programFormSessionId || selectedSessionId || (sessions[0]?.id || '');
    if (!targetSession) {
      toast.error('Academic session is required');
      return;
    }
    try {
      const payload: any = {
        academicSessionId: targetSession,
        name: programForm.name,
        courseName: programForm.courseName,
        duration: Number(programForm.duration),
        status: programForm.status,
        description: programForm.description,
      };
      if (!editingId && programTemplateId && programCopySemesters) {
        payload.copyFromProgramId = programTemplateId;
      }
      if (editingId) {
        await api.put(`/operations/programs/${editingId}`, payload);
        toast.success('Program updated');
      } else {
        await api.post('/operations/programs', payload);
        toast.success('Program added');
      }
      setProgramDialogOpen(false);
      setEditingId(null);
      setProgramTemplateId('');
      setProgramForm({ name: '', courseName: '', duration: '', status: 'active', description: '' });
      fetchPrograms();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add program');
    }
  };

  const handleEditProgram = (program: any) => {
    setEditingId(program.id);
    setProgramTemplateId('');
    setProgramFormSessionId(program.academicSessionId || selectedSessionId || '');
    setProgramForm({
      name: program.name || '',
      courseName: program.courseName || '',
      duration: String(program.duration || ''),
      status: program.status || 'active',
      description: program.description || '',
    });
    setProgramDialogOpen(true);
  };

  const handleDeleteProgram = async (program: any) => {
    if (!window.confirm(`Delete program "${program.name}"?`)) return;
    try {
      await api.delete(`/operations/programs/${program.id}`);
      toast.success('Program deleted');
      fetchPrograms();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete program');
    }
  };

  const openProgramModules = (programId: string) => {
    setSelectedProgramId(programId);
    setSelectedSemesterId(null);
    setModules([]);
    setActiveSection('semesters');
    fetchSemesters(programId);
  };

  const handleSessionChange = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setProgramSessionFilter(sessionId);
    setSelectedProgramId(null);
    setSelectedSemesterId(null);
    setSemesters([]);
    setModules([]);
    setActiveSection('programs');
  };

  const fetchSemesters = async (programId: string) => {
    setSemesterLoading(true);
    try {
      const response = await api.get(`/operations/programs/${programId}/semesters`);
      setSemesters(response.data.data || []);
    } catch (error: any) { toast.error(error.response?.data?.message || 'Failed to load semesters'); }
    finally { setSemesterLoading(false); }
  };

  const openSemesterModules = (semesterId: string) => {
    if (!selectedProgramId) return;
    setSelectedSemesterId(semesterId);
    setActiveSection('modules');
    fetchModules(selectedProgramId, semesterId);
  };

  const closeSemesterDialog = (open: boolean) => {
    setSemesterDialogOpen(open);
    if (!open) {
      setEditingSemesterId(null);
      setSemesterForm({
        programId: '',
        academicSessionId: '',
        semesterName: '',
        semesterNumber: '',
        startDate: '',
        endDate: '',
        status: 'active',
      });
    }
  };

  const openCreateSemester = (defaultProgId?: string) => {
    setEditingSemesterId(null);
    const initialSession = (semesterSessionFilter && semesterSessionFilter !== 'all')
      ? semesterSessionFilter
      : (selectedSessionId || sessions.find(s => s.status === 'active')?.id || sessions[0]?.id || '');
    const initialProgram = defaultProgId || selectedProgramId || (semesterProgramFilter !== 'all' ? semesterProgramFilter : (programs[0]?.id || ''));
    const prog = programs.find(p => p.id === initialProgram);
    const sessionForProg = prog?.academicSessionId || initialSession;

    setSemesterForm({
      programId: initialProgram,
      academicSessionId: sessionForProg,
      semesterName: '',
      semesterNumber: '',
      startDate: '',
      endDate: '',
      status: 'active',
    });
    setSemesterDialogOpen(true);
  };

  const handleEditSemester = (semester: any) => {
    setEditingSemesterId(semester.id);
    setSemesterForm({
      programId: semester.programId || selectedProgramId || '',
      academicSessionId: semester.academicSessionId || selectedSessionId || '',
      semesterName: semester.semesterName,
      semesterNumber: String(semester.semesterNumber),
      startDate: semester.startDate ? new Date(semester.startDate).toISOString().slice(0, 10) : '',
      endDate: semester.endDate ? new Date(semester.endDate).toISOString().slice(0, 10) : '',
      status: semester.status || 'active',
    });
    setSemesterDialogOpen(true);
  };

  const handleDeleteSemester = async (semester: any) => {
    const progId = semester.programId || selectedProgramId;
    if (!progId || !window.confirm(`Delete semester "${semester.semesterName}"?`)) return;
    try {
      await api.delete(`/operations/programs/${progId}/semesters/${semester.id}`);
      toast.success('Semester deleted');
      if (initialTab === 'academic-semesters' || initialTab === 'academic-modules') {
        loadAllSemestersAndModules();
      } else {
        fetchSemesters(progId);
      }
      fetchPrograms();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete semester');
    }
  };

  const handleSemesterSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const targetProgramId = semesterForm.programId || selectedProgramId;
    const targetSessionId = semesterForm.academicSessionId || selectedSessionId;

    if (!targetProgramId) {
      toast.error('Please select a program');
      return;
    }
    if (!targetSessionId) {
      toast.error('Please select an academic session');
      return;
    }
    if (!semesterForm.semesterName.trim()) {
      toast.error('Semester name is required');
      return;
    }
    if (!semesterForm.semesterNumber) {
      toast.error('Semester number is required');
      return;
    }
    if (!semesterForm.startDate || !semesterForm.endDate) {
      toast.error('Start date and End date are required');
      return;
    }

    try {
      const payload = {
        semesterName: semesterForm.semesterName.trim(),
        semesterNumber: Number(semesterForm.semesterNumber),
        academicSessionId: targetSessionId,
        startDate: semesterForm.startDate,
        endDate: semesterForm.endDate,
        status: semesterForm.status,
      };

      if (editingSemesterId) {
        await api.put(`/operations/programs/${targetProgramId}/semesters/${editingSemesterId}`, payload);
        toast.success('Semester updated successfully');
      } else {
        await api.post(`/operations/programs/${targetProgramId}/semesters`, payload);
        toast.success('Semester created successfully');
      }

      closeSemesterDialog(false);

      if (initialTab === 'academic-semesters' || initialTab === 'academic-modules') {
        loadAllSemestersAndModules();
      } else if (targetProgramId) {
        fetchSemesters(targetProgramId);
      }
      fetchPrograms();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save semester');
    }
  };

  const closeModuleDialog = (open: boolean) => {
    setModuleDialogOpen(open);
    if (!open) {
      setEditingModuleId(null);
      setModuleForm({
        academicSessionId: '',
        programId: '',
        semesterId: '',
        moduleCode: '',
        moduleName: '',
        moduleType: '',
      });
    }
  };

  const openCreateModule = (defaultProgId?: string, defaultSemesterId?: string) => {
    const targetProgId = defaultProgId || (moduleProgramFilter !== 'all' ? moduleProgramFilter : selectedProgramId) || '';
    const prog = programs.find(p => p.id === targetProgId);
    const sessionForProg = prog?.academicSessionId || (moduleSessionFilter !== 'all' ? moduleSessionFilter : selectedSessionId) || '';
    const targetSemId = defaultSemesterId || (moduleSemesterFilter !== 'all' ? moduleSemesterFilter : selectedSemesterId) || '';

    setEditingModuleId(null);
    setModuleForm({
      academicSessionId: sessionForProg,
      programId: targetProgId,
      semesterId: targetSemId,
      moduleCode: '',
      moduleName: '',
      moduleType: 'Core',
    });
    setModuleDialogOpen(true);
  };

  const handleEditModule = (module: any) => {
    setEditingModuleId(module.id);
    const modProgId = module.programId || selectedProgramId || '';
    const prog = programs.find(p => p.id === modProgId);
    setModuleForm({
      academicSessionId: module.academicSessionId || prog?.academicSessionId || selectedSessionId || '',
      programId: modProgId,
      semesterId: module.semesterId || selectedSemesterId || '',
      moduleCode: module.moduleCode || '',
      moduleName: module.moduleName || '',
      moduleType: module.moduleType || 'Core',
    });
    setModuleDialogOpen(true);
  };

  const handleDeleteModule = async (module: any) => {
    const progId = module.programId || selectedProgramId;
    if (!progId || !window.confirm(`Delete module "${module.moduleName}"?`)) return;
    try {
      await api.delete(`/operations/programs/${progId}/modules/${module.id}`);
      toast.success('Module deleted');
      if (initialTab === 'academic-modules' || initialTab === 'academic-semesters') {
        loadAllSemestersAndModules();
      } else {
        fetchModules(progId);
      }
      fetchPrograms();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete module');
    }
  };

  const handleModuleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const targetProgramId = moduleForm.programId || selectedProgramId;
    const targetSessionId = moduleForm.academicSessionId || selectedSessionId;
    const targetSemesterId = moduleForm.semesterId || selectedSemesterId;

    if (!targetProgramId) {
      toast.error('Please select a program');
      return;
    }
    if (!targetSemesterId) {
      toast.error('Please select a semester');
      return;
    }
    if (!moduleForm.moduleCode.trim()) {
      toast.error('Module code is required');
      return;
    }
    if (!moduleForm.moduleName.trim()) {
      toast.error('Module name is required');
      return;
    }
    if (!moduleForm.moduleType) {
      toast.error('Module type is required');
      return;
    }

    try {
      const payload = {
        moduleCode: moduleForm.moduleCode.trim(),
        moduleName: moduleForm.moduleName.trim(),
        moduleType: moduleForm.moduleType,
        academicSessionId: targetSessionId || null,
        semesterId: targetSemesterId || null,
      };

      if (editingModuleId) {
        await api.put(`/operations/programs/${targetProgramId}/modules/${editingModuleId}`, payload);
        toast.success('Module updated successfully');
      } else {
        await api.post(`/operations/programs/${targetProgramId}/modules`, payload);
        toast.success('Module created successfully');
      }

      closeModuleDialog(false);

      if (initialTab === 'academic-modules' || initialTab === 'academic-semesters') {
        loadAllSemestersAndModules();
      } else if (targetProgramId) {
        fetchModules(targetProgramId);
      }
      fetchPrograms();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save module');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {initialTab === 'academic-session'
              ? 'Academic Session'
              : initialTab === 'academic-semesters'
              ? 'Semester'
              : initialTab === 'academic-modules'
              ? 'Modules'
              : initialTab === 'academic-ebooks'
              ? 'E-Book'
              : initialTab === 'academic-study-material'
              ? 'Study Material'
              : initialTab === 'academic-video-classes'
              ? 'Video Classes'
              : initialTab === 'academic-scheduled-classes'
              ? 'Schedule Class'
              : initialTab === 'academic-examination-manage'
              ? 'Create Exam Portal'
              : initialTab === 'academic-calendar'
              ? 'Academic Calendar'
              : 'Programs'}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {initialTab === 'academic-session'
              ? 'Manage academic sessions'
              : initialTab === 'academic-examination-manage'
              ? 'Configure the exam details before opening the student portal'
              : initialTab === 'academic-ebooks'
              ? 'Manage uploaded E-Books and study notes'
              : initialTab === 'academic-study-material'
              ? 'Study materials for academic modules'
              : initialTab === 'academic-video-classes'
              ? 'Upload and manage video classes for academic modules'
              : initialTab === 'academic-scheduled-classes'
              ? 'Schedule a live class and notify selected students'
              : initialTab === 'academic-calendar'
              ? 'Manage and view all academic events, examinations, holidays and important dates.'
              : 'Manage programs by academic session'}
          </p>
        </div>
        {initialTab === 'academic-ebooks' && (
          <Button type="button" onClick={openAddNoteModal} className="flex items-center gap-2">
            <Plus className="h-4 w-4 mr-1" />
            Add Notes
          </Button>
        )}
        {initialTab === 'academic-video-classes' && (
          <Button type="button" onClick={openAddVideoModal} className="flex items-center gap-2">
            <Plus className="h-4 w-4 mr-1" />
            Add Class video
          </Button>
        )}
        {initialTab === 'academic-calendar' && (
          <Button
            type="button"
            onClick={() => openAddCalendarEventModal()}
            className="bg-[#EF5A43] hover:bg-[#d94e39] text-white font-medium flex items-center gap-2 shadow-xs"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Academic Event
          </Button>
        )}
      </div>

      {initialTab === 'academic-scheduled-classes' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Schedule a live class</CardTitle>
              <CardDescription>Choose the academic details, enrolled students, start time, and live meeting link.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleScheduledClassSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Academic Session *</Label>
                    <Select value={scheduledClassForm.academicSessionId} onValueChange={handleScheduledSessionChange}>
                      <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const now = new Date();
                          const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                          const parseDateToDay = (dateVal: any): Date | null => {
                            if (!dateVal) return null;
                            if (typeof dateVal === 'string') {
                              const match = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
                              if (match) {
                                return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
                              }
                            }
                            const d = new Date(dateVal);
                            if (isNaN(d.getTime())) return null;
                            return new Date(d.getFullYear(), d.getMonth(), d.getDate());
                          };

                          return sessions
                            .filter(session => {
                              const sessionEndDate = parseDateToDay(session.endDate);
                              const sessionStartDate = parseDateToDay(session.startDate);

                              if (!sessionEndDate) return false;

                              // Exclude sessions whose end date is earlier than the current date
                              if (sessionEndDate.getTime() < currentDate.getTime()) {
                                return false;
                              }

                              // Include ongoing sessions (start date <= current date and end date >= current date)
                              // and upcoming/future sessions (start date > current date and end date >= current date),
                              // even if their start date is earlier than the current date.
                              const isOngoing = sessionStartDate
                                ? sessionStartDate.getTime() <= currentDate.getTime() && sessionEndDate.getTime() >= currentDate.getTime()
                                : false;
                              const isUpcoming = sessionStartDate
                                ? sessionStartDate.getTime() > currentDate.getTime() && sessionEndDate.getTime() >= currentDate.getTime()
                                : false;

                              return sessionEndDate.getTime() >= currentDate.getTime() && (isOngoing || isUpcoming || !sessionStartDate);
                            })
                            .map(session => (
                              <SelectItem key={session.id} value={session.id}>{displaySession(session.id)}</SelectItem>
                            ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Program *</Label>
                    <Select
                      value={scheduledClassForm.programId}
                      onValueChange={handleScheduledProgramChange}
                      disabled={!scheduledClassForm.academicSessionId}
                    >
                      <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
                      <SelectContent>
                        {programs.filter(item => item.academicSessionId === scheduledClassForm.academicSessionId).map(item => (
                          <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Semester *</Label>
                    <Select
                      value={scheduledClassForm.semesterId}
                      onValueChange={handleScheduledSemesterChange}
                      disabled={!scheduledClassForm.programId}
                    >
                      <SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
                      <SelectContent>
                        {scheduledClassSemesters.map(item => (
                          <SelectItem key={item.id} value={item.id}>{item.semesterName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Module *</Label>
                    <Select
                      value={scheduledClassForm.moduleId}
                      onValueChange={moduleId => setScheduledClassForm(current => ({ ...current, moduleId }))}
                      disabled={!scheduledClassForm.semesterId}
                    >
                      <SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger>
                      <SelectContent>
                        {scheduledClassModules.map(item => (
                          <SelectItem key={item.id} value={item.id}>{item.moduleCode} · {item.moduleName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduled-class-title">Class title *</Label>
                    <Input
                      id="scheduled-class-title"
                      value={scheduledClassForm.title}
                      onChange={event => setScheduledClassForm(current => ({ ...current, title: event.target.value }))}
                      placeholder="e.g. Live lecture: Introduction"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scheduled-class-start">Start date and time *</Label>
                    <Input
                      id="scheduled-class-start"
                      type="datetime-local"
                      value={scheduledClassForm.startsAt}
                      onChange={event => setScheduledClassForm(current => ({ ...current, startsAt: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2 lg:col-span-3">
                    <Label htmlFor="scheduled-class-link">Live meeting link *</Label>
                    <Input
                      id="scheduled-class-link"
                      type="url"
                      value={scheduledClassForm.meetingUrl}
                      onChange={event => setScheduledClassForm(current => ({ ...current, meetingUrl: event.target.value }))}
                      placeholder="https://meet.google.com/..."
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Select enrolled students *</Label>
                    <span className="text-sm text-muted-foreground">
                      {schedulableStudentsLoading ? 'Loading students…' : `${selectedScheduledStudentIds.length} selected`}
                    </span>
                  </div>
                  {!scheduledClassForm.programId ? (
                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      Select a session and program to load eligible students.
                    </p>
                  ) : schedulableStudents.length === 0 && !schedulableStudentsLoading ? (
                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      No enrolled students were found for this program and session.
                    </p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto rounded-md border p-3">
                      <div className="space-y-3">
                        {schedulableStudents.map(item => (
                          <label key={item.id} className="flex cursor-pointer items-center gap-3 text-sm">
                            <Checkbox
                              checked={selectedScheduledStudentIds.includes(item.id)}
                              onCheckedChange={checked => setSelectedScheduledStudentIds(current => (
                                checked === true
                                  ? [...current, item.id]
                                  : current.filter(id => id !== item.id)
                              ))}
                            />
                            <span className="min-w-0">
                              <span className="block font-medium">{item.name}</span>
                              <span className="text-xs text-muted-foreground">{item.enrollmentNo} · {item.email}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Button type="submit" disabled={scheduledClassSaving || scheduledClassLoading || schedulableStudentsLoading}>
                  {scheduledClassSaving ? 'Scheduling…' : 'Schedule Class'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scheduled classes</CardTitle>
              <CardDescription>Classes created for students in your organization.</CardDescription>
            </CardHeader>
            <CardContent>
              {scheduledClassLoading && scheduledClasses.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading scheduled classes…</p>
              ) : scheduledClasses.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No classes have been scheduled yet.</p>
              ) : (
                <div className="space-y-3">
                  {scheduledClasses.map(item => (
                    <div key={item.id} className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.academicSession.name} · {item.program.name} · {item.semester.semesterName} · {item.module.moduleName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(item.startsAt).toLocaleString()}</p>
                      </div>
                      <Badge variant="secondary">{item._count.students} students</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {initialTab === 'academic-video-classes' && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Uploaded Video Classes ({filteredVideoClasses.length}{filteredVideoClasses.length !== videoClasses.length ? ` of ${videoClasses.length}` : ''})
                  </CardTitle>
                  <CardDescription>
                    Browse, filter, and manage uploaded video lectures and YouTube classes across modules
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filters Bar */}
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by video title..."
                    value={videoSearch}
                    onChange={e => setVideoSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="flex flex-wrap sm:flex-nowrap gap-2">
                  {/* Session Filter */}
                  <Select
                    value={videoFilterSession}
                    onValueChange={val => {
                      setVideoFilterSession(val);
                      setVideoFilterProgram('all');
                      setVideoFilterSemester('all');
                      setVideoFilterModule('all');
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-44">
                      <SelectValue placeholder="All Sessions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sessions</SelectItem>
                      {sessions.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name || displaySession(s.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Program Filter */}
                  <Select
                    value={videoFilterProgram}
                    onValueChange={val => {
                      setVideoFilterProgram(val);
                      setVideoFilterSemester('all');
                      setVideoFilterModule('all');
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-44">
                      <SelectValue placeholder="All Programs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Programs</SelectItem>
                      {programs
                        .filter(p => videoFilterSession === 'all' || p.academicSessionId === videoFilterSession)
                        .map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  {/* Semester Filter */}
                  <Select
                    value={videoFilterSemester}
                    onValueChange={val => {
                      setVideoFilterSemester(val);
                      setVideoFilterModule('all');
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="All Semesters" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Semesters</SelectItem>
                      {videoAvailableSemesters.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Module Filter */}
                  <Select
                    value={videoFilterModule}
                    onValueChange={setVideoFilterModule}
                  >
                    <SelectTrigger className="w-full sm:w-44">
                      <SelectValue placeholder="All Modules" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Modules</SelectItem>
                      {videoAvailableModules.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {(videoSearch || videoFilterSession !== 'all' || videoFilterProgram !== 'all' || videoFilterSemester !== 'all' || videoFilterModule !== 'all') && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setVideoSearch('');
                        setVideoFilterSession('all');
                        setVideoFilterProgram('all');
                        setVideoFilterSemester('all');
                        setVideoFilterModule('all');
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Uploaded Videos Grid */}
              {videoLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredVideoClasses.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  {videoClasses.length === 0
                    ? 'No video classes uploaded yet. Click "Add Class video" to add your first video class.'
                    : 'No video classes match your search and filter criteria.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                  {filteredVideoClasses.map(item => {
                    const embedUrl = getYouTubeEmbedUrl(item.youtubeUrl);
                    const resolvedFileUrl = item.fileUrl
                      ? (item.fileUrl.startsWith('http')
                          ? item.fileUrl
                          : `${(import.meta.env.VITE_API_URL || '/api/v1').replace('/api/v1', '')}${item.fileUrl}`)
                      : null;

                    return (
                      <Card key={item.id} className="flex flex-col overflow-hidden border">
                        <div className="aspect-video w-full bg-black relative flex items-center justify-center overflow-hidden">
                          {embedUrl ? (
                            <iframe
                              src={embedUrl}
                              title={item.title}
                              className="w-full h-full border-0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          ) : resolvedFileUrl ? (
                            <video
                              src={resolvedFileUrl}
                              controls
                              className="w-full h-full object-contain"
                              preload="metadata"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-muted-foreground p-4">
                              <Video className="h-10 w-10 mb-2 opacity-50" />
                              <span className="text-xs">No video stream</span>
                            </div>
                          )}
                        </div>

                        <CardContent className="flex-1 p-4 space-y-3">
                          <div>
                            <h4 className="font-semibold text-base line-clamp-1" title={item.title}>
                              {item.title}
                            </h4>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2" title={item.description}>
                                {item.description}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1.5 text-xs">
                            {item.sessionName && (
                              <Badge variant="outline" className="text-[11px] py-0 px-2">
                                {item.sessionName}
                              </Badge>
                            )}
                            {item.programName && (
                              <Badge variant="secondary" className="text-[11px] py-0 px-2">
                                {item.programName}
                              </Badge>
                            )}
                            {item.semesterName && (
                              <Badge variant="outline" className="text-[11px] py-0 px-2">
                                {item.semesterName}
                              </Badge>
                            )}
                            {item.moduleName && (
                              <Badge variant="default" className="text-[11px] py-0 px-2 bg-primary/80">
                                {item.moduleName}
                              </Badge>
                            )}
                          </div>

                          {item.youtubeUrl && !embedUrl && (
                            <a
                              href={item.youtubeUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline line-clamp-1 block"
                            >
                              {item.youtubeUrl}
                            </a>
                          )}
                        </CardContent>

                        <div className="p-4 pt-0 border-t flex justify-end gap-2 mt-auto bg-muted/20 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditVideo(item)}
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" />
                            Update
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteVideo(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {initialTab === 'academic-ebooks' && (
        <Card>
          <CardHeader>
            <CardTitle>All E-Books & Notes ({allEbooks.length})</CardTitle>
            <CardDescription>Manage uploaded E-Books, study notes, and reading materials across modules</CardDescription>
          </CardHeader>
          <CardContent>
            {allEbooksLoading ? (
              <p className="py-8 text-center text-muted-foreground">Loading E-Books...</p>
            ) : allEbooks.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No E-Books uploaded.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="p-3 text-left">Book Name</th>
                      <th className="p-3 text-left">Program</th>
                      <th className="p-3 text-left">Session</th>
                      <th className="p-3 text-left">Module</th>
                      <th className="p-3 text-left">File</th>
                      <th className="p-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allEbooks.map(material => {
                      const fileUrl = material.fileUrl.startsWith('http')
                        ? material.fileUrl
                        : `${(import.meta.env.VITE_API_URL || '/api/v1').replace('/api/v1', '')}${material.fileUrl}`;
                      return (
                        <tr key={material.id} className="border-t">
                          <td className="p-3 font-medium">{material.title || material.fileName}</td>
                          <td className="p-3">{material.program?.name || '-'}</td>
                          <td className="p-3">{material.session?.name || '-'}</td>
                          <td className="p-3">{material.module?.moduleName || '-'}</td>
                          <td className="p-3">
                            <a href={fileUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                              {material.fileName}
                            </a>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => editAllEbook(material)}>Update</Button>
                              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => deleteModuleEbook(material)}>Delete</Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {initialTab === 'academic-study-material' && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">This is study material.</CardContent>
        </Card>
      )}

      {initialTab === 'academic-calendar' && (
        <div className="space-y-6">
          {/* Top Filter Bar */}
          <Card className="shadow-xs border border-border/70">
            <CardContent className="p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end">
                {/* Academic Year */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Academic Year</Label>
                  <Select value={calFilterSession} onValueChange={setCalFilterSession}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="All Sessions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sessions</SelectItem>
                      {sessions.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {displaySession(s.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Semester */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Semester</Label>
                  <Select value={calFilterSemester} onValueChange={setCalFilterSemester}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="All Semesters" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Semesters</SelectItem>
                      {semesters.map(sem => (
                        <SelectItem key={sem.id} value={sem.id}>
                          {sem.semesterName || `Semester ${sem.semesterNumber}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Event Category */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Event Category</Label>
                  <Select value={calFilterCategory} onValueChange={setCalFilterCategory}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {CALENDAR_CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_CONFIG[cat]?.dot || 'bg-slate-400'}`} />
                            <span>{cat}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Department */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Department</Label>
                  <Select value={calFilterDepartment} onValueChange={setCalFilterDepartment}>
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {calDepartments.length > 0
                        ? calDepartments.map((dept: any) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))
                        : programs.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 mt-4 pt-3 border-t border-border/50">
                <Button
                  type="button"
                  onClick={applyCalendarFilters}
                  disabled={calendarLoading}
                  className="bg-[#EF5A43] hover:bg-[#d94e39] text-white font-medium px-5"
                >
                  {calendarLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Apply
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetCalendarFilters}
                  disabled={calendarLoading}
                  className="font-medium px-4"
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Main Calendar 2-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Calendar Widget */}
            <div className="lg:col-span-8 space-y-4">
              <Card className="shadow-xs border border-border/70 overflow-hidden">
                <CardContent className="p-4 sm:p-6 space-y-4">
                  {/* Calendar Header Controls */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleCalendarPrev}
                        title="Previous month"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleCalendarNext}
                        title="Next month"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <h3 className="text-xl font-bold tracking-tight text-foreground ml-1">
                        {monthDisplayTitle}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {/* View Switcher Pills */}
                      <div className="flex rounded-lg bg-muted/60 p-1 border border-border/50">
                        <button
                          type="button"
                          onClick={() => setCalendarView('month')}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                            calendarView === 'month'
                              ? 'bg-sky-100 text-sky-800 shadow-2xs dark:bg-sky-950 dark:text-sky-300 font-bold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Month
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalendarView('week')}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                            calendarView === 'week'
                              ? 'bg-sky-100 text-sky-800 shadow-2xs dark:bg-sky-950 dark:text-sky-300 font-bold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Week
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalendarView('agenda')}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                            calendarView === 'agenda'
                              ? 'bg-sky-100 text-sky-800 shadow-2xs dark:bg-sky-950 dark:text-sky-300 font-bold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Agenda
                        </button>
                      </div>

                      {/* Today Button */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCalendarToday}
                        className="h-8 px-3 text-xs font-medium"
                      >
                        Today
                      </Button>
                    </div>
                  </div>

                  {/* View 1: Month Grid View */}
                  {calendarView === 'month' && (
                    <div className="rounded-xl border border-border/80 overflow-hidden bg-card shadow-2xs">
                      {/* Sun - Sat Column Headers */}
                      <div className="grid grid-cols-7 border-b border-border/80 bg-muted/20 text-center py-2.5 text-xs font-semibold text-muted-foreground">
                        {calendarWeekDays.map(day => (
                          <div key={day}>{day}</div>
                        ))}
                      </div>

                      {/* Day Cells Grid */}
                      <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-border/80">
                        {calendarMonthCells.map((cell, idx) => {
                          const cellEvents = getCalendarEventsForDate(cell.dateKey);
                          const isToday = cell.dateKey === new Date().toISOString().split('T')[0];

                          return (
                            <div
                              key={`${cell.dateKey}-${idx}`}
                              className={`min-h-[105px] p-1.5 transition-colors group relative flex flex-col justify-between ${
                                cell.isCurrentMonth
                                  ? 'bg-card'
                                  : 'bg-muted/15 text-muted-foreground/40'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span
                                    className={`text-xs font-medium px-1.5 py-0.2 rounded-full ${
                                      isToday
                                        ? 'bg-[#EF5A43] text-white font-bold'
                                        : cell.isCurrentMonth
                                        ? 'text-foreground'
                                        : 'text-muted-foreground/40'
                                    }`}
                                  >
                                    {cell.dayNumber}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => openAddCalendarEventModal(cell.dateKey)}
                                    title={`Add event on ${cell.dateKey}`}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>

                                {/* Event Pills */}
                                <div className="space-y-1">
                                  {cellEvents.slice(0, 3).map(ev => {
                                    const cfg = CATEGORY_CONFIG[ev.category] || CATEGORY_CONFIG['Others'];
                                    return (
                                      <div
                                        key={ev.id}
                                        onClick={() => setSelectedCalendarEvent(ev)}
                                        title={`${ev.title} (${ev.category})${
                                          ev.startTime ? ` • ${formatTimeDisplay(ev.startTime)}` : ''
                                        }`}
                                        className={`px-1.5 py-0.5 rounded text-[11px] font-medium leading-tight truncate cursor-pointer transition-all border ${cfg.bg} ${cfg.text} ${cfg.border} shadow-2xs hover:scale-[1.01]`}
                                      >
                                        {ev.title}
                                      </div>
                                    );
                                  })}
                                  {cellEvents.length > 3 && (
                                    <div
                                      onClick={() => {
                                        setCalendarDate(cell.date);
                                        setCalendarView('agenda');
                                      }}
                                      className="text-[10px] font-semibold text-muted-foreground hover:text-[#EF5A43] cursor-pointer px-1 pt-0.5"
                                    >
                                      +{cellEvents.length - 3} more
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* View 2: Week View */}
                  {calendarView === 'week' && (
                    <div className="rounded-xl border border-border/80 overflow-hidden bg-card shadow-2xs">
                      <div className="grid grid-cols-7 border-b border-border/80 bg-muted/20 text-center py-2.5 text-xs font-semibold text-muted-foreground divide-x divide-border/80">
                        {calendarWeekDaysList.map(day => (
                          <div key={day.dateKey} className="py-1">
                            <div>{day.dayName}</div>
                            <div
                              className={`text-base font-bold mt-0.5 ${
                                day.dateKey === new Date().toISOString().split('T')[0]
                                  ? 'text-[#EF5A43]'
                                  : 'text-foreground'
                              }`}
                            >
                              {day.dayNumber}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 divide-x divide-border/80 min-h-[380px]">
                        {calendarWeekDaysList.map(day => {
                          const dayEvents = getCalendarEventsForDate(day.dateKey);
                          return (
                            <div key={day.dateKey} className="p-2 space-y-2">
                              {dayEvents.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground/40 text-center pt-6">No events</p>
                              ) : (
                                dayEvents.map(ev => {
                                  const cfg = CATEGORY_CONFIG[ev.category] || CATEGORY_CONFIG['Others'];
                                  return (
                                    <div
                                      key={ev.id}
                                      onClick={() => setSelectedCalendarEvent(ev)}
                                      className={`p-2 rounded-lg border text-xs cursor-pointer space-y-1 shadow-2xs transition-all hover:scale-[1.02] ${cfg.bg} ${cfg.text} ${cfg.border}`}
                                    >
                                      <p className="font-semibold leading-tight line-clamp-2">{ev.title}</p>
                                      {ev.startTime && (
                                        <p className="text-[10px] opacity-80 flex items-center gap-1">
                                          <Clock className="h-3 w-3 shrink-0" />
                                          {formatTimeDisplay(ev.startTime)}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* View 3: Agenda View */}
                  {calendarView === 'agenda' && (
                    <div className="rounded-xl border border-border/80 overflow-hidden bg-card divide-y divide-border/80 shadow-2xs">
                      {calendarEvents.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground">
                          <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
                          <p>No academic events found for current filters.</p>
                        </div>
                      ) : (
                        calendarEvents.map(ev => {
                          const cfg = CATEGORY_CONFIG[ev.category] || CATEGORY_CONFIG['Others'];
                          const dateStr = new Date(ev.startDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          });
                          return (
                            <div
                              key={ev.id}
                              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
                            >
                              <div className="flex items-start gap-4">
                                <div className="flex flex-col items-center justify-center min-w-[54px] h-[54px] rounded-lg bg-slate-100 dark:bg-slate-800 border border-border/70 text-center shrink-0">
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                    {new Date(ev.startDate).toLocaleString('default', { month: 'short' })}
                                  </span>
                                  <span className="text-xl font-bold leading-none text-foreground mt-0.5">
                                    {new Date(ev.startDate).getDate()}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4
                                      className="font-semibold text-foreground text-sm cursor-pointer hover:underline"
                                      onClick={() => setSelectedCalendarEvent(ev)}
                                    >
                                      {ev.title}
                                    </h4>
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.badgeBg}`}
                                    >
                                      {ev.category}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                    <span>{dateStr}</span>
                                    {ev.startTime && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatTimeDisplay(ev.startTime)}
                                        {ev.endTime ? ` - ${formatTimeDisplay(ev.endTime)}` : ''}
                                      </span>
                                    )}
                                    {ev.program && (
                                      <span className="flex items-center gap-1">
                                        <GraduationCap className="h-3 w-3" />
                                        {ev.program.name}
                                        {ev.semester
                                          ? ` · ${ev.semester.semesterName || `Sem ${ev.semester.semesterNumber}`}`
                                          : ''}
                                      </span>
                                    )}
                                  </div>
                                  {ev.description && (
                                    <p className="text-xs text-muted-foreground/80 line-clamp-1">
                                      {ev.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditCalendarEvent(ev)}
                                >
                                  <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteCalendarEvent(ev.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Event Categories & Upcoming Events */}
            <div className="lg:col-span-4 space-y-6">
              {/* Event Categories Card */}
              <Card className="shadow-xs border border-border/70">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-base font-bold text-foreground">
                    Event Categories
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-y-3.5 gap-x-2 text-xs font-medium">
                    {/* Left Column of Categories */}
                    <div className="space-y-3.5">
                      {[
                        'Classes & Teaching',
                        'Assessment & Assignments',
                        'University Events',
                        'Meetings',
                      ].map(cat => {
                        const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG['Others'];
                        return (
                          <div key={cat} className="flex items-center gap-2.5">
                            <span className={`h-3 w-3 rounded-full shrink-0 ${cfg.dot}`} />
                            <span className="text-foreground text-xs leading-tight">{cat}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Right Column of Categories */}
                    <div className="space-y-3.5">
                      {[
                        'Examinations',
                        'Holidays',
                        'Administrative Deadlines',
                        'Others',
                      ].map(cat => {
                        const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG['Others'];
                        return (
                          <div key={cat} className="flex items-center gap-2.5">
                            <span className={`h-3 w-3 rounded-full shrink-0 ${cfg.dot}`} />
                            <span className="text-foreground text-xs leading-tight">{cat}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Upcoming Events Card */}
              <Card className="shadow-xs border border-border/70">
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
                  <CardTitle className="text-base font-bold text-foreground">
                    Upcoming Events
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => setCalendarView('agenda')}
                    className="text-xs text-[#EF5A43] hover:underline font-semibold"
                  >
                    View All
                  </button>
                </CardHeader>
                <CardContent className="pt-4 space-y-3.5">
                  {upcomingEventsList.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      No upcoming events scheduled
                    </p>
                  ) : (
                    upcomingEventsList.map(ev => {
                      const cfg = CATEGORY_CONFIG[ev.category] || CATEGORY_CONFIG['Others'];
                      const evDate = new Date(ev.startDate);
                      const monthShort = evDate.toLocaleString('default', { month: 'short' }).toUpperCase();
                      const dayNumber = evDate.getDate();

                      return (
                        <div
                          key={ev.id}
                          onClick={() => setSelectedCalendarEvent(ev)}
                          className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Date Box */}
                            <div className="flex flex-col items-center justify-center min-w-[50px] h-[50px] rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-border/70 text-center shrink-0">
                              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase leading-tight">
                                {monthShort}
                              </span>
                              <span className="text-lg font-bold leading-none text-foreground mt-0.5">
                                {dayNumber}
                              </span>
                            </div>

                            {/* Title & Meta */}
                            <div className="min-w-0 space-y-0.5">
                              <p className="font-semibold text-xs sm:text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                {ev.title}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground truncate">
                                {ev.startTime ? (
                                  <span className="flex items-center gap-1 shrink-0">
                                    <Clock className="h-3 w-3" />
                                    {formatTimeDisplay(ev.startTime)}
                                    {ev.endTime ? ` - ${formatTimeDisplay(ev.endTime)}` : ''}
                                  </span>
                                ) : null}
                                {!ev.startTime && ev.description ? (
                                  <span className="truncate">{ev.description}</span>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          {/* Category Pill Badge */}
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium shrink-0 border ${cfg.badgeBg}`}
                          >
                            {cfg.shortLabel}
                          </span>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {initialTab === 'academic-examination-registered' && <Card>
        <CardHeader><CardTitle>Registered Students ({registeredStudents.length})</CardTitle><p className="text-sm text-muted-foreground">Total students registered for examinations</p></CardHeader>
        <CardContent className="space-y-4">
          <Select value={registeredExaminationId} onValueChange={fetchRegisteredStudents}>
            <SelectTrigger><SelectValue placeholder="Filter students" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Students</SelectItem>{examinations.map(examination => <SelectItem key={examination.id} value={examination.id}>{examination.examinationName} - {examination.examinationType}</SelectItem>)}</SelectContent>
          </Select>
          {registeredStudentsLoading ? <p className="py-8 text-center text-muted-foreground">Loading registered students...</p> : registeredStudents.length === 0 ? <p className="py-8 text-center text-muted-foreground">No students registered for this examination.</p> : <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted/40"><tr><th className="p-3 text-left">Name</th><th className="p-3 text-left">Enrollment No</th><th className="p-3 text-left">Email</th><th className="p-3 text-left">Phone</th><th className="p-3 text-left">Examination</th><th className="p-3 text-left">Registered At</th><th className="p-3 text-left">Action</th></tr></thead><tbody>{registeredStudents.map(registration => <tr key={registration.id} className="border-t"><td className="p-3">{registration.fullName}</td><td className="p-3">{registration.enrollmentNo}</td><td className="p-3">{registration.email}</td><td className="p-3">{registration.phone}</td><td className="p-3">{registration.examination?.examinationName || 'Selected examination'}</td><td className="p-3">{new Date(registration.createdAt).toLocaleString()}</td><td className="p-3"><Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={removingRegistrationId === registration.id} onClick={() => removeRegisteredStudent(registration)}><Trash2 className="mr-1 h-4 w-4" />{removingRegistrationId === registration.id ? 'Removing...' : 'Remove'}</Button></td></tr>)}</tbody></table></div>}
        </CardContent>
      </Card>}

      {initialTab === 'academic-examination-portal' && <Card>
        <CardHeader><CardTitle>Examination Portal</CardTitle><p className="text-sm text-muted-foreground">Examinations available for portal access.</p></CardHeader>
        <CardContent className="space-y-3">
          {Object.keys(createdExamPortals).length === 0 ? <p className="py-8 text-center text-muted-foreground">No exam portals created yet. Create one from Create Exam Portal.</p> : Object.values(createdExamPortals).map((portal: any) => { const session = sessions.find(item => item.id === portal.academicSessionId); const isOpen = portal.isOpen !== false; return <div key={portal.examinationId} className="rounded-lg border p-4 space-y-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><p className="font-semibold">{portal.examinationName}</p><Badge variant={isOpen ? 'default' : 'secondary'}>{isOpen ? 'Opened' : 'Closed'}</Badge></div><p className="text-sm text-muted-foreground">{portal.examinationType} · {portal.programName}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => openExamPortal(portal)}>Open Portal</Button><Button variant="outline" onClick={() => closeExamPortal(portal)}>Close Portal</Button></div></div><div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3"><span><strong>Academic Session:</strong> {session?.name || (session ? `${new Date(session.startDate).getFullYear()} - ${new Date(session.endDate).getFullYear()}` : 'N/A')}</span><span><strong>Examination Date:</strong> {portal.examDate}</span><span><strong>Exam Session:</strong> {portal.examSession}</span><span><strong>Exam Time:</strong> {portal.examTime}</span><span className="font-mono"><strong>Exam Code:</strong> {portal.code}</span></div></div>; })}
        </CardContent>
      </Card>}

      {initialTab === 'academic-examination-manage' && <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Create Exam Portal</CardTitle>
              <p className="text-sm text-muted-foreground">Select the examination details before opening the student exam portal. Opening it creates the examination in the connected Exam Portal.</p>
            </div>
            <Button type="button" variant="outline" onClick={openExamPortalWorkspace} disabled={openingPortalWorkspace}>
              {openingPortalWorkspace ? 'Opening...' : 'Open Exam Portal (questions & bulk upload)'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Academic Session</Label><Select value={examPortalForm.academicSessionId} onValueChange={selectSessionForPortal}><SelectTrigger><SelectValue placeholder="Select academic session first" /></SelectTrigger><SelectContent>{sessions.map(session => <SelectItem key={session.id} value={session.id}>{session.name || `${new Date(session.startDate).getFullYear()} - ${new Date(session.endDate).getFullYear()}`}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Examination</Label><Select value={examPortalForm.examId} onValueChange={selectExamForPortal} disabled={!examPortalForm.academicSessionId}><SelectTrigger><SelectValue placeholder={examPortalForm.academicSessionId ? 'Select examination' : 'Select session first'} /></SelectTrigger><SelectContent>{portalExaminations.map(examination => <SelectItem key={examination.id} value={examination.id}>{examination.examinationName} - {examination.examinationType}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Department / Program</Label><Select value={examPortalForm.programId} disabled><SelectTrigger><SelectValue placeholder="Auto-filled from examination" /></SelectTrigger><SelectContent>{programs.map(program => <SelectItem key={program.id} value={program.id}>{program.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Exam Date</Label><Input type="date" value={examPortalForm.examDate} disabled /></div>
            <div className="space-y-2"><Label>Exam Session</Label><Select value={examPortalForm.examSession} onValueChange={examSession => setExamPortalForm(current => ({ ...current, examSession }))}><SelectTrigger><SelectValue placeholder="Select exam session" /></SelectTrigger><SelectContent><SelectItem value="Morning">Morning</SelectItem><SelectItem value="Afternoon">Afternoon</SelectItem><SelectItem value="Evening">Evening</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Exam Time</Label><Input type="time" value={examPortalForm.examTime} onChange={event => setExamPortalForm(current => ({ ...current, examTime: event.target.value }))} /></div>
          </div>
          <div className="flex justify-end border-t pt-4"><Button disabled={publishingExamId !== null || !examPortalForm.examId || !examPortalForm.academicSessionId || !examPortalForm.programId || !examPortalForm.examDate || !examPortalForm.examSession || !examPortalForm.examTime} onClick={() => generateExamLink(examinations.find(examination => examination.id === examPortalForm.examId))}>{publishingExamId ? 'Creating in Exam Portal...' : 'Open Exam Portal'}</Button></div>
        </CardContent>
      </Card>}

      {['academic-examination', 'academic-examination-create', 'academic-examination-scheduled'].includes(initialTab || '') && <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle>{examinationView === 'scheduled' ? 'Scheduled Exams' : examinationView === 'manage' ? 'Manage Examination' : 'Create Examination'}</CardTitle><p className="text-sm text-muted-foreground">{examinationView === 'manage' ? 'Review examinations and generate student links' : 'Create and manage examinations'}</p></div>{examinationView === 'create' && <Button onClick={openExaminationDialog}><Plus className="w-4 h-4 mr-2" />Create Examination</Button>}</CardHeader>
        <CardContent className="space-y-5"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3"><Select value={examinationFilters.sessionId} onValueChange={sessionId => setExaminationFilters({ ...examinationFilters, sessionId })}><SelectTrigger><SelectValue placeholder="All Sessions" /></SelectTrigger><SelectContent><SelectItem value="all">All Sessions</SelectItem>{sessions.map(session => <SelectItem key={session.id} value={session.id}>{displaySession(session.id)}</SelectItem>)}</SelectContent></Select><Select value={examinationFilters.programId} onValueChange={programId => setExaminationFilters({ ...examinationFilters, programId })}><SelectTrigger><SelectValue placeholder="All Programs" /></SelectTrigger><SelectContent><SelectItem value="all">All Programs</SelectItem>{programs.map(program => <SelectItem key={program.id} value={program.id}>{program.name}</SelectItem>)}</SelectContent></Select><Select value={examinationFilters.semesterId} onValueChange={semesterId => setExaminationFilters({ ...examinationFilters, semesterId })}><SelectTrigger><SelectValue placeholder="All Semesters" /></SelectTrigger><SelectContent><SelectItem value="all">All Semesters</SelectItem>{semesters.map(semester => <SelectItem key={semester.id} value={semester.id}>{semester.semesterName}</SelectItem>)}</SelectContent></Select><Select value={examinationFilters.status} onValueChange={status => setExaminationFilters({ ...examinationFilters, status })}><SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent></Select></div>
          {examinationLoading ? <p className="py-8 text-center text-muted-foreground">Loading examinations...</p> : filteredExaminations.length === 0 ? <p className="py-8 text-center text-muted-foreground">No examinations created.</p> : <div className="space-y-3">{filteredExaminations.map(examination => <div key={examination.id} className="rounded-lg border p-4 space-y-3"><div><p className="font-semibold">{examination.examinationName}</p><p className="text-sm text-muted-foreground">Examination: {examination.examinationType}</p></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm"><span>Program: {examination.program?.name || 'Program not found'}</span><span>Semester: {examination.semester?.semesterName}</span></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm"><span>Modules: {Array.isArray(examination.moduleIds) ? examination.moduleIds.length : 0}</span><span>Examination Date: {new Date(examination.startDate).toLocaleDateString()} - {new Date(examination.endDate).toLocaleDateString()}</span><span>Status: <Badge variant="outline">{examination.status}</Badge></span></div><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => openExaminationDetails(examination)}>View</Button>{examinationView === 'scheduled' ? <><Button size="sm" variant="outline" onClick={() => handleEditExamination(examination)}>Edit</Button><Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDeleteExamination(examination)}>Delete</Button></> : examinationView === 'manage' ? <Button size="sm" onClick={() => generateExamLink(examination)}>Generate Exam Link</Button> : null}</div></div>)}</div>}
        </CardContent>
      </Card>}

      {(!initialTab || initialTab === 'academic-session') && <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5 text-primary" />{initialTab === 'academic-session' ? 'Academic Sessions' : 'Select Academic Session'}</CardTitle>
          <div className="flex items-center gap-2">
            {selectedSessionId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedSessionId(null);
                  setProgramSessionFilter('all');
                }}
              >
                All Sessions
              </Button>
            )}
            <Button type="button" onClick={() => { setEditingId(null); setFormData({ startDate: '', endDate: '', status: 'inactive' }); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />Add Session</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="py-6 text-center text-muted-foreground">Loading sessions...</p> : sessions.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">No academic sessions found.</p>
          ) : initialTab === 'academic-session' ? (
            <div className="space-y-2">
              <div className="hidden md:grid md:grid-cols-[1.5fr_1fr_1fr_auto] gap-4 px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Academic Session</span><span>Start Date</span><span>End Date</span><span>Status</span>
              </div>
              {sessions.map(session => (
                <div key={session.id} onClick={() => handleSessionChange(session.id)} className={`grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_auto] gap-3 md:gap-4 items-center rounded-lg border p-4 cursor-pointer ${selectedSessionId === session.id ? 'border-primary ring-1 ring-primary' : ''}`}>
                  <div><p className="font-semibold">{new Date(session.startDate).getFullYear()} - {new Date(session.endDate).getFullYear()}</p><p className="text-xs text-muted-foreground mt-1">{session.name || 'Academic Session'}</p></div>
                  <span className="text-sm text-muted-foreground">{new Date(session.startDate).toLocaleDateString()}</span>
                  <span className="text-sm text-muted-foreground">{new Date(session.endDate).toLocaleDateString()}</span>
                  <div className="flex items-center justify-between gap-3"><Badge variant="outline" className={session.status === 'active' ? 'text-green-600 border-green-300' : ''}>{session.status === 'active' ? 'Active' : 'Not Active'}</Badge><div className="flex gap-1"><Button type="button" variant="ghost" size="sm" onClick={event => { event.stopPropagation(); handleEdit(session); }}><Edit className="w-3.5 h-3.5 mr-1" />Edit</Button><Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={event => { event.stopPropagation(); handleDelete(session.id); }}><Trash2 className="w-3.5 h-3.5" /></Button></div></div>
                </div>
              ))}
            </div>
          ) : (
            <div ref={sessionScrollerRef} className="flex gap-3 overflow-x-auto pb-3 scroll-smooth snap-x snap-mandatory">
                {sessions.map(session => {
                  const sessionProgramCount = programs.filter(p => p.academicSessionId === session.id).length;
                  const isSelected = selectedSessionId === session.id;

                  return (
                    <div
                      role="button"
                      tabIndex={0}
                      key={session.id}
                      data-session-active={session.status === 'active'}
                      onClick={() => handleSessionChange(session.id)}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') handleSessionChange(session.id); }}
                      className={`relative min-w-[200px] flex-none snap-start rounded-lg border p-4 min-h-24 text-left cursor-pointer transition-all ${isSelected ? 'border-primary ring-2 ring-primary bg-primary/10 shadow-sm' : 'hover:border-primary/50'} ${session.status === 'active' && !isSelected ? 'bg-primary/5' : ''}`}
                    >
                      {session.status === 'active' && <div className="absolute top-3 right-3 rounded-full bg-primary p-1 text-primary-foreground"><Check className="w-3 h-3" /></div>}
                      <p className="font-semibold text-base">{new Date(session.startDate).getFullYear()} - {new Date(session.endDate).getFullYear()}</p>
                      <div className="flex items-center justify-between gap-1.5 mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={`h-2 w-2 rounded-full ${session.status === 'active' ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                          {session.status === 'active' ? <Badge variant="outline" className="text-green-600 border-green-300">Active</Badge> : 'Not Active'}
                        </div>
                        <Badge variant="secondary" className="text-[11px] font-normal">
                          {sessionProgramCount} {sessionProgramCount === 1 ? 'Program' : 'Programs'}
                        </Badge>
                      </div>
                      <div className="flex gap-1 mt-3 border-t pt-2">
                        <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={event => { event.stopPropagation(); handleEdit(session); }}><Edit className="w-3.5 h-3.5 mr-1" />Edit</Button>
                        <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={event => { event.stopPropagation(); handleDelete(session.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>}

      {!initialTab && <Card>
        <CardContent className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'programs' as const, label: 'Programs', description: 'Manage academic programs', icon: GraduationCap },
            { id: 'semesters' as const, label: 'Semester Management', description: 'Manage semesters for this program', icon: Calendar },
            { id: 'modules' as const, label: 'Modules', description: 'Manage modules in this semester', icon: BookOpen },
          ].map(({ id, label, description, icon: Icon }) => (
            <Button key={id} type="button" variant={activeSection === id ? 'default' : 'outline'} className="h-20 justify-start gap-3 text-left" disabled={(id === 'semesters' && !selectedProgramId) || (id === 'modules' && !selectedSemesterId)} onClick={() => {
              if ((id === 'semesters' || id === 'modules') && !selectedProgramId) return;
              if (id === 'modules' && !selectedSemesterId) return;
              setActiveSection(id);
            }}>
              <Icon className="w-5 h-5 shrink-0" />
              <span className="flex flex-col items-start gap-1">
                <span className="font-semibold">{label}</span>
                <span className="text-xs font-normal opacity-70">{description}</span>
              </span>
            </Button>
          ))}
        </CardContent>
      </Card>}

      {activeSection === 'programs' && (!initialTab || initialTab === 'academic-programs') && initialTab !== 'academic-session' && !['academic-calendar', 'academic-examination'].includes(initialTab || '') && (
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>
                  {programSessionFilter === 'all'
                    ? `All Programs (${filteredPrograms.length})`
                    : programSessionFilter === 'active'
                    ? `Active Session Programs (${filteredPrograms.length})`
                    : (() => {
                        const s = sessions.find(item => item.id === programSessionFilter);
                        return s?.status === 'active'
                          ? `Active Session Programs - ${displaySession(programSessionFilter)} (${filteredPrograms.length})`
                          : `Programs under Academic Session: ${displaySession(programSessionFilter)} (${filteredPrograms.length})`;
                      })()}
                </CardTitle>
                {programSessionFilter === 'active' ? (
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    Active Sessions
                  </Badge>
                ) : programSessionFilter === 'all' ? (
                  <Badge variant="secondary">
                    All Sessions
                  </Badge>
                ) : (() => {
                  const currSession = sessions.find(s => s.id === programSessionFilter);
                  return currSession ? (
                    <Badge variant="outline" className={currSession.status === 'active' ? 'text-green-600 border-green-300' : ''}>
                      {currSession.status === 'active' ? 'Active Session' : 'Inactive Session'}
                    </Badge>
                  ) : null;
                })()}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {programSessionFilter === 'all'
                  ? 'Manage academic programs across all sessions'
                  : programSessionFilter === 'active'
                  ? 'Manage academic programs belonging to active academic sessions'
                  : `Manage, create, or import academic programs for academic session ${displaySession(programSessionFilter)}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={openImportDialog}
                disabled={sessions.length < 2}
                title="Import programs from another academic session"
              >
                <ArrowDownToLine className="w-4 h-4 mr-2" />
                Import Programs
              </Button>
              <Button
                type="button"
                onClick={() => openCreateProgram()}
                title="Create a new academic program"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Program
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* View All Programs button and Filter by Session dropdown on top of the search bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={programSessionFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setProgramSessionFilter('all');
                    setSelectedSessionId(null);
                  }}
                  title="View all programs across all sessions"
                >
                  <BookOpen className="w-4 h-4 mr-1.5" />
                  View All Programs
                </Button>
                {programSessionFilter !== 'active' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const firstActive = sessions.find(s => s.status === 'active');
                      if (firstActive) {
                        setProgramSessionFilter(firstActive.id);
                        setSelectedSessionId(firstActive.id);
                      } else {
                        setProgramSessionFilter('active');
                        setSelectedSessionId(null);
                      }
                    }}
                    title="View only active session programs"
                  >
                    Active Session Programs
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="program-session-filter" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Filter by Session:
                </Label>
                <Select
                  value={programSessionFilter}
                  onValueChange={(val) => {
                    setProgramSessionFilter(val);
                    if (val === 'all') {
                      setSelectedSessionId(null);
                    } else if (val === 'active') {
                      const firstActive = sessions.find(s => s.status === 'active');
                      setSelectedSessionId(firstActive ? firstActive.id : null);
                    } else {
                      setSelectedSessionId(val);
                    }
                  }}
                >
                  <SelectTrigger id="program-session-filter" className="w-[230px] h-9 text-xs">
                    <SelectValue placeholder="Filter by Session" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sessions</SelectItem>
                    <SelectItem value="active">Active Sessions</SelectItem>
                    {sessions.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {displaySession(s.id)} {s.status === 'active' ? '(Active)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search programs by name, code, or course..."
                  value={programSearch}
                  onChange={e => setProgramSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              {programSearch && (
                <Button variant="ghost" size="sm" onClick={() => setProgramSearch('')}>
                  Clear
                </Button>
              )}
            </div>

            {programLoading ? (
              <p className="py-8 text-center text-muted-foreground">Loading programs...</p>
            ) : filteredPrograms.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">
                    {programSearch ? 'No matching programs found' : 'No programs in this section'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    {programSearch
                      ? `No programs matched "${programSearch}". Try clearing your search.`
                      : programSessionFilter === 'active'
                        ? 'There are no programs configured under the active academic session(s). You can view all programs, import existing programs, or create a new program.'
                        : programSessionFilter !== 'all'
                          ? `There are no academic programs configured under ${displaySession(programSessionFilter)} yet. You can import existing programs from another session or create a new one.`
                          : 'No academic programs created yet. You can create a new program or import from an academic session.'}
                  </p>
                </div>
                {!programSearch && (
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    {programSessionFilter !== 'all' && (
                      <Button variant="outline" size="sm" onClick={() => { setProgramSessionFilter('all'); setSelectedSessionId(null); }}>
                        <BookOpen className="w-4 h-4 mr-1.5" />
                        View All Programs
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={openImportDialog} disabled={sessions.length < 2}>
                      <ArrowDownToLine className="w-4 h-4 mr-2" />
                      Import from Another Session
                    </Button>
                    <Button size="sm" onClick={() => openCreateProgram()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Program
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredPrograms.map(program => {
                  const progSession = sessions.find(s => s.id === program.academicSessionId);
                  const semesterCount = program._count?.semesterRecords ?? (Array.isArray(program.semesters) ? program.semesters.length : undefined);
                  const moduleCount = program._count?.modules;
                  const isProgramActive = !program.status || program.status.toLowerCase() === 'active';

                  return (
                    <div key={program.id} className="rounded-lg border p-4 flex flex-col justify-between gap-3 hover:border-primary/50 transition-colors bg-card">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {isProgramActive && (
                                <span className="relative flex h-2 w-2 shrink-0" title="Active Program">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                                </span>
                              )}
                              <h3 className="font-semibold leading-tight">{program.name}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">{program.courseName || 'Course name not provided'}</p>
                          </div>
                          {isProgramActive ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 shrink-0">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              Active
                            </span>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[11px] shrink-0">
                              Not Active
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1">
                          <Badge variant="secondary" className="font-normal">
                            Duration: {program.duration} {program.duration === 1 ? 'Year' : 'Years'}
                          </Badge>
                          {progSession && (
                            <Badge variant="outline" className="font-normal">
                              {displaySession(progSession.id)}
                            </Badge>
                          )}
                          {semesterCount !== undefined && (
                            <Badge variant="outline" className="font-normal">
                              {semesterCount} {semesterCount === 1 ? 'Semester' : 'Semesters'}
                            </Badge>
                          )}
                          {moduleCount !== undefined && (
                            <Badge variant="outline" className="font-normal">
                              {moduleCount} {moduleCount === 1 ? 'Module' : 'Modules'}
                            </Badge>
                          )}
                        </div>

                        {program.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 pt-1">{program.description}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
                        <Button type="button" variant="outline" size="sm" onClick={() => openProgramModules(program.id)}>
                          <BookOpen className="w-3.5 h-3.5 mr-1" />
                          Open
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openCreateProgram(program)}
                          title="Create a new program based on this existing program"
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Clone
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => handleEditProgram(program)} title="Edit program">
                          <Edit className="w-3.5 h-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive ml-auto"
                          onClick={() => handleDeleteProgram(program)}
                          title="Delete program"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {initialTab === 'academic-semesters' && (
        <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>All Semesters ({semesters.filter(semester => (semesterSessionFilter === 'all' || semester.academicSessionId === semesterSessionFilter) && (semesterProgramFilter === 'all' || semester.programId === semesterProgramFilter)).length})</CardTitle>
                <p className="text-sm text-muted-foreground">Filter semesters by academic session and program</p>
              </div>
              <Button type="button" onClick={() => openCreateSemester()}>
                <Plus className="w-4 h-4 mr-2" />Add Semester
              </Button>
            </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Select value={semesterSessionFilter} onValueChange={setSemesterSessionFilter}>
                  <SelectTrigger className="w-60">
                    <SelectValue placeholder="Filter by Session" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sessions</SelectItem>
                    {sessions.map(session => (
                      <SelectItem key={session.id} value={session.id}>
                        <div className="flex items-center gap-2">
                          <span>{displaySession(session.id)}</span>
                          {session.status === 'active' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full border border-green-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              Active
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {semesterSessionFilter !== 'all' && (() => {
                  const selectedSession = sessions.find(s => s.id === semesterSessionFilter);
                  return selectedSession?.status === 'active' ? (
                    <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/20 text-xs">
                      Active
                    </Badge>
                  ) : null;
                })()}
              </div>
              <Select value={semesterProgramFilter} onValueChange={setSemesterProgramFilter}>
                <SelectTrigger className="w-56"><SelectValue placeholder="All Programs" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs.map(program => <SelectItem key={program.id} value={program.id}>{program.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(() => {
              const filteredList = semesters.filter(semester => (semesterSessionFilter === 'all' || semester.academicSessionId === semesterSessionFilter) && (semesterProgramFilter === 'all' || semester.programId === semesterProgramFilter));
              if (filteredList.length === 0) {
                return (
                  <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Calendar className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">No semesters found</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                        No semesters found for the selected session and program. You can add a new semester using the button above.
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button size="sm" onClick={() => openCreateSemester()}>
                        <Plus className="w-4 h-4 mr-2" />Add Semester
                      </Button>
                    </div>
                  </div>
                );
              }
              return (
                <div className="space-y-2">
                  {filteredList.map(semester => {
                    const isSessionActive = sessions.find(s => s.id === semester.academicSessionId)?.status === 'active';
                    return (
                      <div key={semester.id} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center border rounded-lg p-4">
                        <div className="font-medium">{semester.semesterName}<div className="text-xs text-muted-foreground">No. {semester.semesterNumber}</div></div>
                        <div className="text-sm">{semester.programName}</div>
                        <div className="text-sm">
                          <div>{displaySession(semester.academicSessionId)}</div>
                          {isSessionActive && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-green-600 font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              Active Session
                            </span>
                          )}
                        </div>
                        <Badge variant={semester.status === 'active' ? 'default' : 'outline'}>{semester.status}</Badge>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => { setSelectedProgramId(semester.programId); openSemesterModules(semester.id); }}>Open</Button>
                          <Button size="sm" variant="outline" onClick={() => handleEditSemester(semester)}>Edit</Button>
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDeleteSemester(semester)}>Delete</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {initialTab === 'academic-modules' && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>
                All Modules ({modules.filter(module => (moduleSessionFilter === 'all' || module.academicSessionId === moduleSessionFilter) && (moduleProgramFilter === 'all' || module.programId === moduleProgramFilter) && (moduleSemesterFilter === 'all' || module.semesterId === moduleSemesterFilter)).length})
              </CardTitle>
              <p className="text-sm text-muted-foreground">Filter modules by academic session, program, and semester</p>
            </div>
            <Button type="button" onClick={() => openCreateModule()}>
              <Plus className="w-4 h-4 mr-2" />Add Modules
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Select value={moduleSessionFilter} onValueChange={setModuleSessionFilter}>
                  <SelectTrigger className="w-60">
                    <SelectValue placeholder="All Sessions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sessions</SelectItem>
                    {sessions.map(session => (
                      <SelectItem key={session.id} value={session.id}>
                        <div className="flex items-center gap-2">
                          <span>{displaySession(session.id)}</span>
                          {session.status === 'active' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full border border-green-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              Active
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {moduleSessionFilter !== 'all' && (() => {
                  const selectedSession = sessions.find(s => s.id === moduleSessionFilter);
                  return selectedSession?.status === 'active' ? (
                    <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/20 text-xs">
                      Active
                    </Badge>
                  ) : null;
                })()}
              </div>

              <Select value={moduleProgramFilter} onValueChange={setModuleProgramFilter}>
                <SelectTrigger className="w-56"><SelectValue placeholder="All Programs" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs
                    .filter(program => moduleSessionFilter === 'all' || !program.academicSessionId || program.academicSessionId === moduleSessionFilter)
                    .map(program => (
                      <SelectItem key={program.id} value={program.id}>{program.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Select value={moduleSemesterFilter} onValueChange={setModuleSemesterFilter}>
                <SelectTrigger className="w-56"><SelectValue placeholder="All Semesters" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Semesters</SelectItem>
                  {semesters
                    .filter(semester => (moduleProgramFilter === 'all' || semester.programId === moduleProgramFilter) && (moduleSessionFilter === 'all' || semester.academicSessionId === moduleSessionFilter))
                    .map(semester => (
                      <SelectItem key={semester.id} value={semester.id}>{semester.semesterName}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {(() => {
              const filteredModules = modules.filter(module =>
                (moduleSessionFilter === 'all' || module.academicSessionId === moduleSessionFilter) &&
                (moduleProgramFilter === 'all' || module.programId === moduleProgramFilter) &&
                (moduleSemesterFilter === 'all' || module.semesterId === moduleSemesterFilter)
              );

              if (filteredModules.length === 0) {
                return (
                  <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <BookOpen className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">No modules found</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                        No modules found for the selected session, program, and semester. You can add a new module using the button above.
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button size="sm" onClick={() => openCreateModule()}>
                        <Plus className="w-4 h-4 mr-2" />Add Modules
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <div className="min-w-[900px] space-y-2">
                    <div className="grid grid-cols-7 gap-3 px-4 text-xs font-semibold text-muted-foreground">
                      <span>Code</span>
                      <span>Module</span>
                      <span>Type</span>
                      <span>Session</span>
                      <span>Program</span>
                      <span>Semester</span>
                      <span>Actions</span>
                    </div>
                    {filteredModules.map(module => (
                      <div key={module.id} className="grid grid-cols-7 gap-3 items-center border rounded-lg p-4 text-sm">
                        <span className="font-medium">{module.moduleCode}</span>
                        <span>{module.moduleName}</span>
                        <span><Badge variant="outline">{module.moduleType}</Badge></span>
                        <span>{displaySession(module.academicSessionId)}</span>
                        <span>{module.programName}</span>
                        <span>{module.semesterName}</span>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => openEbookDialog(module)}>Add E-Book</Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => openVideoDialog(module)}>Add Video</Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => handleEditModule(module)}>
                            <Edit className="w-3.5 h-3.5 mr-1" />Edit
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteModule(module)}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {activeSection === 'modules' && initialTab !== 'academic-modules' && initialTab !== 'academic-session' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>
                Modules{selectedSemesterId ? ` - ${semesters.find(semester => semester.id === selectedSemesterId)?.semesterName || 'Selected Semester'}` : ''}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Manage modules for the selected program</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => { setSelectedSemesterId(null); setActiveSection('semesters'); }}>
                Semesters
              </Button>
              <Button type="button" disabled={!selectedSemesterId} onClick={() => openCreateModule(selectedProgramId || undefined, selectedSemesterId || undefined)}>
                <Plus className="w-4 h-4 mr-2" />Create Module
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {moduleLoading ? <p className="py-8 text-center text-muted-foreground">Loading modules...</p> : modules.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No modules created for this program.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modules.map(module => (
                  <div key={module.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-semibold">{module.moduleName}</p><p className="text-sm text-muted-foreground">{module.moduleCode}</p></div>
                      <Badge variant="outline">{module.moduleType}</Badge>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEbookDialog(module)}>Add E-Book</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => openVideoDialog(module)}><Video className="w-3.5 h-3.5 mr-1" />Add Video</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => handleEditModule(module)}><Edit className="w-3.5 h-3.5 mr-1" />Edit</Button>
                      <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteModule(module)}><Trash2 className="w-3.5 h-3.5 mr-1" />Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === 'semesters' && initialTab !== 'academic-semesters' && initialTab !== 'academic-session' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle>Semester Management ({semesters.length})</CardTitle><p className="text-sm text-muted-foreground mt-1">Semesters for {programs.find(program => program.id === selectedProgramId)?.name || 'the selected program'}</p></div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setActiveSection('programs')}>
                <ChevronLeft className="w-4 h-4 mr-1" />Back to Programs
              </Button>
              <Button type="button" onClick={openCreateSemester} disabled={!selectedProgramId}><Plus className="w-4 h-4 mr-2" />Create Semester</Button>
            </div>
          </CardHeader>
          <CardContent>
            {semesterLoading ? <p className="py-8 text-center text-muted-foreground">Loading semesters...</p> : semesters.length === 0 ? <p className="py-8 text-center text-muted-foreground">No semesters created for this program.</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {semesters.map(semester => <div key={semester.id} className="rounded-lg border p-4 space-y-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{semester.semesterName}</p><p className="text-sm text-muted-foreground">Semester {semester.semesterNumber}</p></div><Badge variant={semester.status === 'active' ? 'default' : 'outline'}>{semester.status}</Badge></div><p className="text-sm text-muted-foreground">{new Date(semester.startDate).toLocaleDateString()} - {new Date(semester.endDate).toLocaleDateString()}</p><div className="flex gap-2"><Button type="button" size="sm" onClick={() => openSemesterModules(semester.id)}>Open</Button><Button type="button" variant="outline" size="sm" onClick={() => handleEditSemester(semester)}><Edit className="w-3.5 h-3.5 mr-1" />Edit</Button><Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteSemester(semester)}><Trash2 className="w-3.5 h-3.5 mr-1" />Delete</Button></div></div>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Academic Session' : 'Add Academic Session'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="sessionFrom">Session From</Label><Input id="sessionFrom" type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} required /></div>
            <div className="space-y-2"><Label htmlFor="sessionTo">Session To</Label><Input id="sessionTo" type="date" value={formData.endDate} min={formData.startDate || undefined} onChange={e => setFormData({ ...formData, endDate: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Status</Label><Select value={formData.status} onValueChange={status => setFormData({ ...formData, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Not Active</SelectItem></SelectContent></Select></div>
            <div className="flex gap-2"><Button type="submit" className="flex-1">{editingId ? 'Save Changes' : 'Add Session'}</Button><Button type="button" variant="outline" onClick={() => closeDialog(false)}>Cancel</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={programDialogOpen} onOpenChange={(open) => {
        setProgramDialogOpen(open);
        if (!open) {
          setEditingId(null);
          setProgramTemplateId('');
          setProgramFormSessionId('');
          setProgramForm({ name: '', courseName: '', duration: '', status: 'active', description: '' });
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Program' : programTemplateId ? 'Create Program from Template' : 'Create New Program'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update academic program information and assigned academic session'
                : 'Configure a new academic program under an academic session'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleProgramSubmit} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label>Academic Session *</Label>
              <Select
                value={programFormSessionId || selectedSessionId || (sessions[0]?.id || '')}
                onValueChange={setProgramFormSessionId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select academic session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map(session => (
                    <SelectItem key={session.id} value={session.id}>
                      {displaySession(session.id)} {session.status === 'active' ? '(Active)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!editingId && programs.length > 0 && (
              <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Start from Existing Program (Optional Template)
                </Label>
                <Select
                  value={programTemplateId || 'none'}
                  onValueChange={(val) => {
                    if (val === 'none') {
                      setProgramTemplateId('');
                      return;
                    }
                    const tmpl = programs.find(p => p.id === val);
                    if (tmpl) {
                      setProgramTemplateId(tmpl.id);
                      setProgramForm({
                        name: `${tmpl.name} (Copy)`,
                        courseName: tmpl.courseName || '',
                        duration: String(tmpl.duration || '1'),
                        status: tmpl.status || 'active',
                        description: tmpl.description || '',
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select existing program to clone..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Start from blank (No Template) --</SelectItem>
                    {programs.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.duration}y) · {displaySession(p.academicSessionId)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {programTemplateId && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer pt-1">
                    <Checkbox
                      checked={programCopySemesters}
                      onCheckedChange={checked => setProgramCopySemesters(Boolean(checked))}
                    />
                    <span>Also duplicate semesters and course modules from this program</span>
                  </label>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Program Name *</Label>
              <Input
                value={programForm.name}
                onChange={e => setProgramForm({ ...programForm, name: e.target.value })}
                placeholder="e.g. B.Tech Computer Science"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Course Name *</Label>
              <Input
                value={programForm.courseName}
                onChange={e => setProgramForm({ ...programForm, courseName: e.target.value })}
                placeholder="e.g. Computer Science & Engineering"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (Years) *</Label>
              <Input
                type="number"
                min="1"
                value={programForm.duration}
                onChange={e => setProgramForm({ ...programForm, duration: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={programForm.status} onValueChange={status => setProgramForm({ ...programForm, status })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Not Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                value={programForm.description}
                onChange={e => setProgramForm({ ...programForm, description: e.target.value })}
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Brief description of this program..."
              />
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <Button type="submit" className="flex-1">
                {editingId ? 'Update Program' : 'Create Program'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setProgramDialogOpen(false);
                  setEditingId(null);
                  setProgramTemplateId('');
                  setProgramFormSessionId('');
                  setProgramForm({ name: '', courseName: '', duration: '', status: 'active', description: '' });
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-primary" />
              Import Programs from Another Session
            </DialogTitle>
            <DialogDescription>
              Select an academic session to import programs from, then choose the specific programs you want to add to{' '}
              <span className="font-semibold text-foreground">{displaySession(selectedSessionId)}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40 border">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Target Session *</Label>
                {initialTab === 'academic-session' ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-semibold text-sm">{displaySession(selectedSessionId)}</span>
                    <Badge variant="outline" className="text-xs">Target</Badge>
                  </div>
                ) : (
                  <Select
                    value={selectedSessionId || ''}
                    onValueChange={(val) => {
                      setSelectedSessionId(val);
                      if (importSourceSessionId === val) {
                        const otherSessions = sessions.filter(s => s.id !== val);
                        setImportSourceSessionId(otherSessions[0]?.id || '');
                        setImportSelectedProgramIds([]);
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue placeholder="Select target session" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map(session => (
                        <SelectItem key={session.id} value={session.id}>
                          {displaySession(session.id)} {session.status === 'active' ? '(Active)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Source Academic Session *</Label>
                <Select
                  value={importSourceSessionId}
                  onValueChange={(val) => {
                    setImportSourceSessionId(val);
                    setImportSelectedProgramIds([]);
                  }}
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue placeholder="Select source session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.filter(s => s.id !== selectedSessionId).map(session => (
                      <SelectItem key={session.id} value={session.id}>
                        {displaySession(session.id)} {session.status === 'active' ? '(Active)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {importSourceSessionId ? (() => {
              const sourceSessionPrograms = programs.filter(p => p.academicSessionId === importSourceSessionId);
              const targetSessionProgramNames = new Set(
                programs
                  .filter(p => p.academicSessionId === selectedSessionId)
                  .map(p => p.name.trim().toLowerCase())
              );
              const filteredSource = sourceSessionPrograms.filter(p => {
                if (!importSearch.trim()) return true;
                const q = importSearch.toLowerCase();
                return p.name?.toLowerCase().includes(q) || (p.courseName || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q);
              });
              const allFilteredSelected = filteredSource.length > 0 && filteredSource.every(p => importSelectedProgramIds.includes(p.id));

              const toggleSelectAll = () => {
                if (allFilteredSelected) {
                  setImportSelectedProgramIds(current => current.filter(id => !filteredSource.some(p => p.id === id)));
                } else {
                  const toAdd = filteredSource.map(p => p.id);
                  setImportSelectedProgramIds(current => Array.from(new Set([...current, ...toAdd])));
                  setImportExpandedProgramIds(current => Array.from(new Set([...current, ...toAdd])));
                  toAdd.forEach(pid => {
                    fetchSemestersForImportProgram(pid);
                  });
                }
              };

              return (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search programs to import..."
                        value={importSearch}
                        onChange={e => setImportSearch(e.target.value)}
                        className="pl-8 h-9 text-sm"
                      />
                    </div>
                    {filteredSource.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={toggleSelectAll}
                        className="shrink-0 h-9"
                      >
                        {allFilteredSelected ? 'Deselect All' : 'Select All'}
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span>
                      Available in session: {sourceSessionPrograms.length} program(s)
                    </span>
                    <Badge variant="secondary" className="font-normal">
                      {importSelectedProgramIds.length} Selected
                    </Badge>
                  </div>

                  {filteredSource.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      {sourceSessionPrograms.length === 0
                        ? 'No programs found under the selected source session.'
                        : `No programs matched "${importSearch}".`}
                    </div>
                  ) : (
                    <div className="rounded-lg border divide-y max-h-[380px] overflow-y-auto">
                      {filteredSource.map(prog => {
                        const isChecked = importSelectedProgramIds.includes(prog.id);
                        const isExpanded = importExpandedProgramIds.includes(prog.id);
                        const alreadyExists = targetSessionProgramNames.has(prog.name.trim().toLowerCase());
                        const sems = importProgramSemesters[prog.id] || [];
                        const isLoadingSems = Boolean(importSemestersLoading[prog.id]);
                        const selectedSemIds = importSelectedSemesterIds[prog.id] !== undefined
                          ? importSelectedSemesterIds[prog.id]
                          : sems.map(s => s.id);
                        const selectedCount = selectedSemIds.length;
                        const semCount = prog._count?.semesterRecords ?? (Array.isArray(prog.semesters) ? prog.semesters.length : undefined);
                        const modCount = prog._count?.modules;

                        return (
                          <div key={prog.id} className={`transition-colors ${isChecked ? 'bg-primary/5' : ''}`}>
                            <div
                              onClick={() => toggleImportProgram(prog.id)}
                              className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => toggleImportProgram(prog.id)}
                                className="mt-1"
                                onClick={e => e.stopPropagation()}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap justify-between">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-sm leading-tight">{prog.name}</span>
                                    {alreadyExists && (
                                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-[10px] py-0">
                                        Exists in Target
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isChecked && (
                                      <Badge variant="secondary" className="text-xs font-normal">
                                        {selectedCount} of {sems.length > 0 ? sems.length : (semCount ?? 0)} Semesters
                                      </Badge>
                                    )}
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                      title={isExpanded ? 'Collapse semesters' : 'Expand semesters'}
                                      onClick={(e) => toggleExpandImportProgram(prog.id, e)}
                                    >
                                      <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </Button>
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                  {prog.courseName || 'Course name not provided'}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                                  <span>Duration: {prog.duration} Year(s)</span>
                                  {semCount !== undefined && <span>· {semCount} Semesters</span>}
                                  {modCount !== undefined && <span>· {modCount} Modules</span>}
                                </div>
                              </div>
                            </div>

                            {/* Show available semesters when program is expanded */}
                            {isExpanded && (
                              <div className="bg-muted/30 border-t px-4 py-3 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-primary" />
                                    Available Semesters under {prog.name}
                                  </span>
                                  {sems.length > 0 && (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="link"
                                        size="sm"
                                        className="h-auto p-0 text-xs text-primary font-medium"
                                        onClick={(e) => { e.stopPropagation(); selectAllSemestersForProgram(prog.id); }}
                                      >
                                        Select All
                                      </Button>
                                      <span className="text-muted-foreground">·</span>
                                      <Button
                                        type="button"
                                        variant="link"
                                        size="sm"
                                        className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                                        onClick={(e) => { e.stopPropagation(); deselectAllSemestersForProgram(prog.id); }}
                                      >
                                        Clear
                                      </Button>
                                    </div>
                                  )}
                                </div>

                                {isLoadingSems ? (
                                  <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                    <span>Loading available semesters...</span>
                                  </div>
                                ) : sems.length === 0 ? (
                                  <p className="text-xs text-muted-foreground italic py-1">
                                    No semesters configured for this program. Base program will be imported.
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                                    {sems.map((sem: any) => {
                                      const isSemChecked = selectedSemIds.includes(sem.id);
                                      return (
                                        <div
                                          key={sem.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleImportSemester(prog.id, sem.id);
                                          }}
                                          className={`flex items-center gap-2.5 p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                                            isSemChecked
                                              ? 'border-primary/50 bg-background shadow-xs font-medium text-foreground'
                                              : 'border-border/60 bg-muted/40 text-muted-foreground opacity-75 hover:opacity-100'
                                          }`}
                                        >
                                          <Checkbox
                                            checked={isSemChecked}
                                            onCheckedChange={() => toggleImportSemester(prog.id, sem.id)}
                                            onClick={e => e.stopPropagation()}
                                          />
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                              <span className="truncate">{sem.semesterName}</span>
                                              <Badge variant="outline" className="text-[10px] py-0 font-normal shrink-0">
                                                Sem {sem.semesterNumber}
                                              </Badge>
                                            </div>
                                            {sem.startDate && (
                                              <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-normal">
                                                {new Date(sem.startDate).toLocaleDateString()} - {new Date(sem.endDate).toLocaleDateString()}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer pt-1">
                    <Checkbox
                      checked={importIncludeDetails}
                      onCheckedChange={checked => setImportIncludeDetails(Boolean(checked))}
                    />
                    <span>Include semester records and modules when importing</span>
                  </label>
                </div>
              );
            })() : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Please select a source academic session above to view its programs.
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-3 border-t gap-2">
            <span className="text-xs text-muted-foreground">
              {importSelectedProgramIds.length > 0 ? (() => {
                const totalSems = importSelectedProgramIds.reduce((sum, pid) => {
                  const sems = importProgramSemesters[pid] || [];
                  const sel = importSelectedSemesterIds[pid] !== undefined ? importSelectedSemesterIds[pid].length : sems.length;
                  return sum + sel;
                }, 0);
                return `${importSelectedProgramIds.length} program(s) and ${totalSems} semester(s) selected`;
              })() : 'Select programs to import'}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setImportDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={importSelectedProgramIds.length === 0 || importLoading}
                onClick={handleImportPrograms}
              >
                {importLoading ? 'Importing...' : `Import Selected (${importSelectedProgramIds.length})`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={semesterDialogOpen} onOpenChange={closeSemesterDialog}>
        <DialogContent className="sm:max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSemesterId ? 'Edit Semester' : 'Add Semester'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSemesterSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="semesterSessionSelect">Academic Session *</Label>
                <Select
                  value={semesterForm.academicSessionId}
                  onValueChange={academicSessionId => {
                    setSemesterForm(prev => {
                      const prog = programs.find(p => p.id === prev.programId);
                      const nextProgramId = (prog && (!prog.academicSessionId || prog.academicSessionId === academicSessionId)) ? prev.programId : '';
                      return {
                        ...prev,
                        academicSessionId,
                        programId: nextProgramId,
                      };
                    });
                  }}
                  required
                >
                  <SelectTrigger id="semesterSessionSelect">
                    <SelectValue placeholder="Select Academic Session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map(session => (
                      <SelectItem key={session.id} value={session.id}>
                        {displaySession(session.id)} {session.status === 'active' ? '(Active)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="semesterProgramSelect">Program *</Label>
                <Select
                  value={semesterForm.programId}
                  onValueChange={programId => {
                    const selectedProg = programs.find(p => p.id === programId);
                    setSemesterForm(prev => ({
                      ...prev,
                      programId,
                      academicSessionId: selectedProg?.academicSessionId || prev.academicSessionId,
                    }));
                  }}
                  required
                >
                  <SelectTrigger id="semesterProgramSelect">
                    <SelectValue placeholder="Select Program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs
                      .filter(p => !semesterForm.academicSessionId || !p.academicSessionId || p.academicSessionId === semesterForm.academicSessionId)
                      .map(program => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name} {program.courseName ? `(${program.courseName})` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="semesterName">Semester Name *</Label>
                <Input
                  id="semesterName"
                  value={semesterForm.semesterName}
                  onChange={event => setSemesterForm({ ...semesterForm, semesterName: event.target.value })}
                  placeholder="e.g. First Semester"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="semesterNumber">Semester Number *</Label>
                <Input
                  id="semesterNumber"
                  type="number"
                  min="1"
                  value={semesterForm.semesterNumber}
                  onChange={event => setSemesterForm({ ...semesterForm, semesterNumber: event.target.value })}
                  placeholder="e.g. 1"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="semesterStartDate">Start Date *</Label>
                <Input
                  id="semesterStartDate"
                  type="date"
                  value={semesterForm.startDate}
                  onChange={event => setSemesterForm({ ...semesterForm, startDate: event.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="semesterEndDate">End Date *</Label>
                <Input
                  id="semesterEndDate"
                  type="date"
                  min={semesterForm.startDate || undefined}
                  value={semesterForm.endDate}
                  onChange={event => setSemesterForm({ ...semesterForm, endDate: event.target.value })}
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="semesterStatus">Status *</Label>
                <Select
                  value={semesterForm.status}
                  onValueChange={status => setSemesterForm({ ...semesterForm, status })}
                >
                  <SelectTrigger id="semesterStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => closeSemesterDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingSemesterId ? 'Update Semester' : 'Create Semester'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={examinationDialogOpen} onOpenChange={setExaminationDialogOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader><DialogTitle>{examinationStep === 1 ? 'Create Examination' : examinationStep === 2 ? 'Select Examination Modules' : 'Examination Schedule'}</DialogTitle></DialogHeader>
          {examinationStep === 1 ? <form onSubmit={event => { event.preventDefault(); setExaminationStep(2); }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Examination Name *</Label><Input value={examinationForm.examinationName} onChange={event => setExaminationForm({ ...examinationForm, examinationName: event.target.value })} required /></div>
              <div className="space-y-2"><Label>Examination Type *</Label><Select value={examinationForm.examinationType} onValueChange={examinationType => setExaminationForm({ ...examinationForm, examinationType })} required><SelectTrigger><SelectValue placeholder="Select examination type" /></SelectTrigger><SelectContent>{['Internal Examination', 'Mid Semester Examination', 'End Semester Examination', 'Supplementary Examination', 'Improvement Examination', 'Practical Examination', 'Model Examination'].map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Academic Session *</Label><Select value={examinationForm.academicSessionId} onValueChange={academicSessionId => setExaminationForm({ ...examinationForm, academicSessionId, programId: '', semesterId: '' })} required><SelectTrigger><SelectValue placeholder="Select academic session" /></SelectTrigger><SelectContent>{sessions.map(session => <SelectItem key={session.id} value={session.id}>{displaySession(session.id)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Program *</Label><Select value={examinationForm.programId} onValueChange={programId => setExaminationForm({ ...examinationForm, programId, semesterId: '' })} required><SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger><SelectContent>{examinationPrograms.map(program => <SelectItem key={program.id} value={program.id}>{program.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Semester *</Label><Select value={examinationForm.semesterId} onValueChange={semesterId => setExaminationForm({ ...examinationForm, semesterId })} required><SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger><SelectContent>{examinationSemesters.map(semester => <SelectItem key={semester.id} value={semester.id}>{semester.semesterName}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Start Date *</Label><Input type="date" value={examinationForm.startDate} onChange={event => setExaminationForm({ ...examinationForm, startDate: event.target.value })} required /></div>
              <div className="space-y-2"><Label>End Date *</Label><Input type="date" min={examinationForm.startDate || undefined} value={examinationForm.endDate} onChange={event => setExaminationForm({ ...examinationForm, endDate: event.target.value })} required /></div>
              <div className="space-y-2 md:col-span-2"><Label>Description</Label><textarea value={examinationForm.description} onChange={event => setExaminationForm({ ...examinationForm, description: event.target.value })} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-2"><Button type="submit" className="flex-1">Next -&gt;</Button><Button type="button" variant="outline" onClick={() => setExaminationDialogOpen(false)}>Cancel</Button></div>
          </form> : examinationStep === 2 ? <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{examinationForm.examinationName} | {programs.find(program => program.id === examinationForm.programId)?.name} | {examinationSemesters.find(semester => semester.id === examinationForm.semesterId)?.semesterName}</p>
            <div className="rounded-lg border divide-y">{examinationModules.length === 0 ? <p className="p-6 text-center text-muted-foreground">No modules found for this program and semester.</p> : examinationModules.map(module => <label key={module.id} className="flex items-center gap-3 p-4 cursor-pointer"><input type="checkbox" checked={selectedModuleIds.includes(module.id)} onChange={event => setSelectedModuleIds(current => event.target.checked ? [...current, module.id] : current.filter(id => id !== module.id))} /><span className="font-medium">{module.moduleCode}</span><span>{module.moduleName}</span></label>)}</div>
            <p className="text-sm text-muted-foreground">Selected: {selectedModuleIds.length}/{examinationModules.length}</p>
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setExaminationStep(1)}>&lt;- Back</Button><Button type="button" className="flex-1" onClick={goToSchedule}>Next -&gt;</Button></div>
          </div> : <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border"><div className="min-w-[950px]"><div className="grid grid-cols-[1.1fr_1.6fr_1fr_1fr_0.9fr_0.9fr_1fr] gap-3 border-b bg-muted/40 px-4 py-3 text-sm font-semibold"><span>Date</span><span>Module</span><span>Start</span><span>End</span><span>Maximum marks</span><span>Passing marks</span><span>Exam duration</span></div>{examinationSchedule.map((row, index) => <div key={`${row.moduleId}-${index}`} className="grid grid-cols-[1.1fr_1.6fr_1fr_1fr_0.9fr_0.9fr_1fr] gap-3 items-center border-b px-4 py-3 last:border-b-0"><Input type="date" value={row.date} min={examinationForm.startDate} max={examinationForm.endDate} onChange={event => updateScheduleRow(index, 'date', event.target.value)} /><Select value={row.moduleId} onValueChange={moduleId => updateScheduleRow(index, 'moduleId', moduleId)}><SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger><SelectContent>{examinationModules.map(module => <SelectItem key={module.id} value={module.id}>{module.moduleName}</SelectItem>)}</SelectContent></Select><Input type="time" value={row.startTime} onChange={event => updateScheduleRow(index, 'startTime', event.target.value)} /><Input type="time" value={row.endTime} onChange={event => updateScheduleRow(index, 'endTime', event.target.value)} /><Input type="number" min="0" value={row.maxMarks || ''} placeholder="100" onChange={event => updateScheduleRow(index, 'maxMarks', event.target.value)} /><Input type="number" min="0" value={row.passingMarks || ''} placeholder="40" onChange={event => updateScheduleRow(index, 'passingMarks', event.target.value)} /><Input type="number" min="1" value={row.examDuration || ''} placeholder="120" onChange={event => updateScheduleRow(index, 'examDuration', event.target.value)} /></div>)}</div></div>
            <Button type="button" variant="outline" onClick={addScheduleRow}>+ Add Schedule</Button>
            <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setExaminationStep(2)}>&lt;- Back</Button><Button type="button" className="flex-1" onClick={submitExamination}>Save Examination</Button></div>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={viewExaminationDialogOpen} onOpenChange={setViewExaminationDialogOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Examination</DialogTitle></DialogHeader>
          {selectedExamination ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground uppercase tracking-wide">Examination name</p><p className="mt-1 font-semibold">{selectedExamination.examinationName}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground uppercase tracking-wide">Type</p><p className="mt-1 font-semibold">{selectedExamination.examinationType}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground uppercase tracking-wide">Session</p><p className="mt-1 font-semibold">{displaySession(selectedExamination.academicSessionId)}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground uppercase tracking-wide">Program</p><p className="mt-1 font-semibold">{programs.find(program => program.id === selectedExamination.programId)?.name || selectedExamination.program?.name || 'Program not found'}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground uppercase tracking-wide">Semester</p><p className="mt-1 font-semibold">{semesters.find(semester => semester.id === selectedExamination.semesterId)?.semesterName || selectedExamination.semester?.semesterName || 'Semester not found'}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p><p className="mt-1 font-semibold">{selectedExamination.status}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground uppercase tracking-wide">Start date</p><p className="mt-1 font-semibold">{new Date(selectedExamination.startDate).toLocaleDateString()}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground uppercase tracking-wide">End date</p><p className="mt-1 font-semibold">{new Date(selectedExamination.endDate).toLocaleDateString()}</p></div>
                <div className="rounded-lg border p-3 md:col-span-2 xl:col-span-1"><p className="text-xs text-muted-foreground uppercase tracking-wide">Modules</p><p className="mt-1 font-semibold">{Array.isArray(selectedExamination.moduleIds) ? selectedExamination.moduleIds.length : 0}</p></div>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Description</p>
                <p className="mt-2 text-sm whitespace-pre-wrap">{selectedExamination.description || 'No description provided.'}</p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Selected modules</p>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(selectedExamination.moduleIds) && selectedExamination.moduleIds.length > 0 ? selectedExamination.moduleIds.map((moduleId: string) => {
                    const module = modules.find(item => item.id === moduleId);
                    return <Badge key={moduleId} variant="outline">{module?.moduleName || moduleId}</Badge>;
                  }) : <span className="text-sm text-muted-foreground">No modules selected.</span>}
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[1100px]">
                    <div className="grid grid-cols-[1.1fr_1.6fr_1fr_1fr_1.1fr_0.9fr_0.9fr_1fr] gap-3 border-b bg-muted/40 px-4 py-3 text-sm font-semibold">
                      <span>Date</span><span>Module</span><span>Start</span><span>End</span><span>Maximum marks</span><span>Passing marks</span><span>Exam duration</span>
                    </div>
                    {Array.isArray(selectedExamination.schedule) && selectedExamination.schedule.length > 0 ? selectedExamination.schedule.map((row: any, index: number) => {
                      const rowModule = modules.find(module => module.id === row.moduleId) || examinationModules.find(module => module.id === row.moduleId);
                      return (
                        <div key={`${row.moduleId || 'module'}-${index}`} className="grid grid-cols-[1.1fr_1.6fr_1fr_1fr_1.1fr_0.9fr_0.9fr_1fr] gap-3 items-center border-b px-4 py-3 last:border-b-0 text-sm">
                          <span>{row.date ? new Date(row.date).toLocaleDateString() : '-'}</span>
                          <span>{rowModule?.moduleName || row.moduleId || 'Not selected'}</span>
                          <span>{row.startTime || '-'}</span>
                          <span>{row.endTime || '-'}</span>
                          <span>{row.maxMarks ?? '-'}</span>
                          <span>{row.passingMarks ?? '-'}</span>
                          <span>{row.examDuration ? `${row.examDuration} mins` : '-'}</span>
                        </div>
                      );
                    }) : <div className="px-4 py-6 text-sm text-muted-foreground">No examination schedule created.</div>}
                  </div>
                </div>
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground">No examination selected.</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(ebookModule)} onOpenChange={open => { if (!open && !ebookUploading) setEbookModule(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{ebookEditingMaterialId ? 'Update E-Book' : 'Add E-Book'} - {ebookModule?.moduleName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={uploadModuleEbook} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ebookPdf">{ebookEditingMaterialId ? 'Replacement PDF document' : 'PDF document'}</Label>
              <Input
                key={ebookEditingMaterialId || 'new-ebook'}
                id="ebookPdf"
                type="file"
                accept="application/pdf,.pdf"
                onChange={event => setEbookFile(event.target.files?.[0] || null)}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={!ebookFile || ebookUploading}>
                {ebookUploading ? 'Saving...' : ebookEditingMaterialId ? 'Update E-Book' : 'Upload E-Book'}
              </Button>
              {ebookEditingMaterialId && <Button type="button" variant="outline" onClick={() => { setEbookEditingMaterialId(null); setEbookFile(null); }}>Cancel Update</Button>}
              <Button type="button" variant="outline" onClick={() => setEbookModule(null)} disabled={ebookUploading}>Close</Button>
            </div>
          </form>
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold">Uploaded Files</h3>
            {ebookLoading ? (
              <p className="text-sm text-muted-foreground">Loading E-Books...</p>
            ) : ebookMaterials.length === 0 ? (
              <p className="text-sm text-muted-foreground">No E-Books uploaded for this module.</p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {ebookMaterials.map(material => {
                  const fileUrl = material.fileUrl.startsWith('http')
                    ? material.fileUrl
                    : `${(import.meta.env.VITE_API_URL || '/api/v1').replace('/api/v1', '')}${material.fileUrl}`;
                  return (
                    <div key={material.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <a href={fileUrl} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-primary hover:underline">
                          {material.fileName}
                        </a>
                        <Badge variant="outline">{ebookModule?.moduleName}</Badge>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => { setEbookEditingMaterialId(material.id); setEbookFile(null); }}>Update</Button>
                        <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => deleteModuleEbook(material)}>Delete</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(videoModule)} onOpenChange={open => { if (!open && !moduleVideoUploading) setVideoModule(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Videos - {videoModule?.moduleName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={uploadModuleVideo} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="moduleVideo">Video file (10 MB maximum)</Label>
              <Input
                id="moduleVideo"
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
                onChange={event => setModuleVideoFile(event.target.files?.[0] || null)}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={!moduleVideoFile || moduleVideoUploading}>
                {moduleVideoUploading ? 'Uploading...' : 'Upload Video'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setVideoModule(null)} disabled={moduleVideoUploading}>Close</Button>
            </div>
          </form>
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold">Uploaded Videos</h3>
            {moduleVideoLoading ? (
              <p className="text-sm text-muted-foreground">Loading videos...</p>
            ) : videoMaterials.length === 0 ? (
              <p className="text-sm text-muted-foreground">No videos uploaded for this module.</p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {videoMaterials.map(material => {
                  const fileUrl = material.fileUrl.startsWith('http')
                    ? material.fileUrl
                    : `${(import.meta.env.VITE_API_URL || '/api/v1').replace('/api/v1', '')}${material.fileUrl}`;
                  return (
                    <div key={material.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <a href={fileUrl} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-primary hover:underline">
                          {material.fileName}
                        </a>
                        <Badge variant="outline">{videoModule?.moduleName}</Badge>
                      </div>
                      <Button type="button" size="sm" variant="outline" className="shrink-0 text-destructive hover:text-destructive" onClick={() => deleteModuleVideo(material)}>Delete</Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={moduleDialogOpen} onOpenChange={closeModuleDialog}>
        <DialogContent className="sm:max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingModuleId ? 'Edit Module' : 'Add Modules'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleModuleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="moduleSessionSelect">Academic Session *</Label>
                <Select
                  value={moduleForm.academicSessionId}
                  onValueChange={academicSessionId => {
                    setModuleForm(prev => {
                      const prog = programs.find(p => p.id === prev.programId);
                      const nextProgramId = (prog && (!prog.academicSessionId || prog.academicSessionId === academicSessionId)) ? prev.programId : '';
                      const nextSemesterId = nextProgramId ? prev.semesterId : '';
                      return {
                        ...prev,
                        academicSessionId,
                        programId: nextProgramId,
                        semesterId: nextSemesterId,
                      };
                    });
                  }}
                  required
                >
                  <SelectTrigger id="moduleSessionSelect">
                    <SelectValue placeholder="Select Academic Session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map(session => (
                      <SelectItem key={session.id} value={session.id}>
                        {displaySession(session.id)} {session.status === 'active' ? '(Active)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="moduleProgramSelect">Programs *</Label>
                <Select
                  value={moduleForm.programId}
                  onValueChange={async programId => {
                    const selectedProg = programs.find(p => p.id === programId);
                    setModuleForm(prev => ({
                      ...prev,
                      programId,
                      academicSessionId: selectedProg?.academicSessionId || prev.academicSessionId,
                      semesterId: '',
                    }));
                    try {
                      const res = await api.get(`/operations/programs/${programId}/semesters`);
                      const fetchedSemesters = (res.data.data || []).map((sem: any) => ({
                        ...sem,
                        programId,
                        programName: selectedProg?.name || '',
                        academicSessionId: sem.academicSessionId || selectedProg?.academicSessionId || '',
                      }));
                      setSemesters(prev => {
                        const other = prev.filter(s => s.programId !== programId);
                        return [...other, ...fetchedSemesters];
                      });
                    } catch (e) {
                      // ignore
                    }
                  }}
                  required
                >
                  <SelectTrigger id="moduleProgramSelect">
                    <SelectValue placeholder="Select Program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs
                      .filter(p => !moduleForm.academicSessionId || !p.academicSessionId || p.academicSessionId === moduleForm.academicSessionId)
                      .map(program => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name} {program.courseName ? `(${program.courseName})` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="moduleSemesterSelect">Semester *</Label>
                <Select
                  value={moduleForm.semesterId}
                  onValueChange={semesterId => {
                    const chosenSem = semesters.find(s => s.id === semesterId);
                    setModuleForm(prev => ({
                      ...prev,
                      semesterId,
                      programId: prev.programId || chosenSem?.programId || '',
                      academicSessionId: prev.academicSessionId || chosenSem?.academicSessionId || '',
                    }));
                  }}
                  required
                >
                  <SelectTrigger id="moduleSemesterSelect">
                    <SelectValue placeholder="Select Semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {semesters
                      .filter(s => {
                        if (moduleForm.programId && s.programId && s.programId !== moduleForm.programId) return false;
                        if (moduleForm.academicSessionId && s.academicSessionId && s.academicSessionId !== moduleForm.academicSessionId) return false;
                        return true;
                      })
                      .map(semester => (
                        <SelectItem key={semester.id} value={semester.id}>
                          {semester.semesterName} {semester.semesterNumber ? `(Sem ${semester.semesterNumber})` : ''} {semester.programName ? `- ${semester.programName}` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="moduleCode">Module Code *</Label>
                <Input
                  id="moduleCode"
                  value={moduleForm.moduleCode}
                  onChange={event => setModuleForm({ ...moduleForm, moduleCode: event.target.value })}
                  placeholder="e.g. CS101A"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="moduleName">Module Name *</Label>
                <Input
                  id="moduleName"
                  value={moduleForm.moduleName}
                  onChange={event => setModuleForm({ ...moduleForm, moduleName: event.target.value })}
                  placeholder="e.g. Data Structures"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="moduleTypeSelect">Module Type *</Label>
                <Select
                  value={
                    ['Core', 'Elective', 'Practical', 'Project'].find(
                      t => t.toLowerCase() === (moduleForm.moduleType || '').toLowerCase()
                    ) || moduleForm.moduleType
                  }
                  onValueChange={moduleType => setModuleForm({ ...moduleForm, moduleType })}
                  required
                >
                  <SelectTrigger id="moduleTypeSelect">
                    <SelectValue placeholder="Select module type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Core">Core</SelectItem>
                    <SelectItem value="Elective">Elective</SelectItem>
                    <SelectItem value="Practical">Practical</SelectItem>
                    <SelectItem value="Project">Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1">
                {editingModuleId ? 'Update Module' : 'Create Module'}
              </Button>
              <Button type="button" variant="outline" onClick={() => closeModuleDialog(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addNoteModalOpen} onOpenChange={open => { if (!open && !addNoteSaving) setAddNoteModalOpen(false); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Notes</DialogTitle>
            <DialogDescription>
              Upload notes or study materials for a module. Select the academic session, program, semester, and module.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddNoteSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="addNoteSession">Academic Session *</Label>
                <Select value={addNoteSessionId} onValueChange={handleAddNoteSessionChange}>
                  <SelectTrigger id="addNoteSession">
                    <SelectValue placeholder="Select Academic Session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map(session => (
                      <SelectItem key={session.id} value={session.id}>
                        <div className="flex items-center gap-2">
                          <span>{session.name || displaySession(session.id)}</span>
                          {session.status === 'active' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded-full border border-green-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              Active
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="addNoteProgram">Program *</Label>
                <Select
                  value={addNoteProgramId}
                  onValueChange={handleAddNoteProgramChange}
                  disabled={!addNoteSessionId}
                >
                  <SelectTrigger id="addNoteProgram">
                    <SelectValue placeholder={!addNoteSessionId ? "Select Academic Session first" : "Select Program"} />
                  </SelectTrigger>
                  <SelectContent>
                    {programs
                      .filter(p => !addNoteSessionId || p.academicSessionId === addNoteSessionId)
                      .map(program => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name} {program.code ? `(${program.code})` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="addNoteSemester">Semester *</Label>
                <Select
                  value={addNoteSemesterId}
                  onValueChange={handleAddNoteSemesterChange}
                  disabled={!addNoteProgramId || addNoteSemestersLoading}
                >
                  <SelectTrigger id="addNoteSemester">
                    <SelectValue placeholder={
                      !addNoteProgramId
                        ? "Select Program first"
                        : addNoteSemestersLoading
                        ? "Loading semesters..."
                        : "Select Semester"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {addNoteSemesters.map(semester => (
                      <SelectItem key={semester.id} value={semester.id}>
                        {semester.semesterName || `Semester ${semester.semesterNumber}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="addNoteModule">Module *</Label>
                <Select
                  value={addNoteModuleId}
                  onValueChange={setAddNoteModuleId}
                  disabled={!addNoteSemesterId || addNoteModulesLoading}
                >
                  <SelectTrigger id="addNoteModule">
                    <SelectValue placeholder={
                      !addNoteSemesterId
                        ? "Select Semester first"
                        : addNoteModulesLoading
                        ? "Loading modules..."
                        : "Select Module"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {addNoteModules.map(module => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.moduleCode ? `[${module.moduleCode}] ` : ''}{module.moduleName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="addNoteBookName">Book Name *</Label>
              <Input
                id="addNoteBookName"
                type="text"
                placeholder="Enter Book Name"
                value={addNoteBookName}
                onChange={e => setAddNoteBookName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="addNoteFile">Upload Note (Document, PDF, or Image) *</Label>
              <Input
                id="addNoteFile"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={e => setAddNoteFile(e.target.files?.[0] || null)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Accepted files: Document (.doc, .docx, .xls, .xlsx), PDF (.pdf), or Image (.png, .jpg, .jpeg) up to 100MB.
              </p>
            </div>

            <DialogFooter className="flex gap-2 sm:justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddNoteModalOpen(false)}
                disabled={addNoteSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addNoteSaving || !addNoteFile || !addNoteBookName.trim() || !addNoteModuleId}
              >
                {addNoteSaving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={videoModalOpen} onOpenChange={open => { if (!open && !videoSaving) { setVideoModalOpen(false); resetVideoForm(); } }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              {editingVideoId ? 'Update Video Class' : 'Add New Video Class'}
            </DialogTitle>
            <DialogDescription>
              {editingVideoId
                ? 'Update the video class details below.'
                : 'Fill in the details below to upload a new video class or provide a YouTube link.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleVideoSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Session Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="modal-video-session">Academic Session *</Label>
                <Select
                  value={videoForm.sessionId}
                  onValueChange={handleVideoSessionChange}
                >
                  <SelectTrigger id="modal-video-session">
                    <SelectValue placeholder="Select Session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name || displaySession(s.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Programs Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="modal-video-program">Program *</Label>
                <Select
                  value={videoForm.programId}
                  onValueChange={handleVideoProgramChange}
                  disabled={!videoForm.sessionId}
                >
                  <SelectTrigger id="modal-video-program">
                    <SelectValue
                      placeholder={
                        !videoForm.sessionId ? 'First select a session' : 'Select Program'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {programs
                      .filter(p => p.academicSessionId === videoForm.sessionId)
                      .map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Semester Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="modal-video-semester">Semester *</Label>
                <Select
                  value={videoForm.semesterId}
                  onValueChange={handleVideoSemesterChange}
                  disabled={!videoForm.programId || videoSemestersLoading}
                >
                  <SelectTrigger id="modal-video-semester">
                    <SelectValue
                      placeholder={
                        videoSemestersLoading
                          ? 'Loading semesters...'
                          : !videoForm.programId
                          ? 'First select a program'
                          : 'Select Semester'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {videoSemesters.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.semesterName || `Semester ${s.semesterNumber}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Module Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="modal-video-module">Module *</Label>
                <Select
                  value={videoForm.moduleId}
                  onValueChange={val => setVideoForm(prev => ({ ...prev, moduleId: val }))}
                  disabled={!videoForm.semesterId || videoModulesLoading}
                >
                  <SelectTrigger id="modal-video-module">
                    <SelectValue
                      placeholder={
                        videoModulesLoading
                          ? 'Loading modules...'
                          : !videoForm.semesterId
                          ? 'First select a semester'
                          : 'Select Module'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {videoModules.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.moduleCode ? `${m.moduleCode} - ${m.moduleName}` : m.moduleName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Video Title Field */}
            <div className="space-y-2">
              <Label htmlFor="modal-video-title">Video Title *</Label>
              <Input
                id="modal-video-title"
                placeholder="Enter video title"
                value={videoForm.title}
                onChange={e => setVideoForm(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>

            {/* Video Description Field */}
            <div className="space-y-2">
              <Label htmlFor="modal-video-description">Video Description</Label>
              <textarea
                id="modal-video-description"
                className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter video description..."
                value={videoForm.description}
                onChange={e => setVideoForm(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            {/* File Upload Field / YouTube Link */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="space-y-2">
                <Label htmlFor="modal-video-file">Upload Video File</Label>
                <Input
                  id="modal-video-file"
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska,video/*"
                  onChange={e => setVideoFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground">Supported formats: MP4, WebM, OGG, MOV (up to 100MB)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="modal-video-youtube">Or YouTube Video Link</Label>
                <Input
                  id="modal-video-youtube"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  value={videoForm.youtubeUrl}
                  onChange={e => setVideoForm(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Paste full YouTube video or share URL</p>
              </div>
            </div>

            <DialogFooter className="flex gap-2 sm:justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setVideoModalOpen(false); resetVideoForm(); }}
                disabled={videoSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={videoSaving}>
                {videoSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingVideoId ? 'Update Video Class' : 'Save Video Class'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Academic Event Modal */}
      <Dialog open={calendarModalOpen} onOpenChange={setCalendarModalOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingCalendarEventId ? 'Edit Academic Event' : 'Add Academic Event'}
            </DialogTitle>
            <DialogDescription>
              {editingCalendarEventId
                ? 'Update academic event details on the academic calendar.'
                : 'Fill in event details to display on the university academic calendar.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCalendarEventSubmit} className="space-y-4 pt-2">
            {/* Event Title */}
            <div className="space-y-1.5">
              <Label htmlFor="event-title">Event Title *</Label>
              <Input
                id="event-title"
                placeholder="e.g. Mid Semester Examination"
                value={calendarForm.title}
                onChange={e => setCalendarForm(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>

            {/* Event Category & Academic Year */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="event-category">Event Category *</Label>
                <Select
                  value={calendarForm.category}
                  onValueChange={val => setCalendarForm(prev => ({ ...prev, category: val }))}
                  required
                >
                  <SelectTrigger id="event-category" className="bg-background">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CALENDAR_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_CONFIG[cat]?.dot || 'bg-slate-400'}`} />
                          <span>{cat}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="event-session">Academic Year *</Label>
                <Select
                  value={calendarForm.academicSessionId}
                  onValueChange={val => setCalendarForm(prev => ({ ...prev, academicSessionId: val }))}
                  required
                >
                  <SelectTrigger id="event-session" className="bg-background">
                    <SelectValue placeholder="Select academic session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {displaySession(s.id)} {s.status === 'active' ? '(Active)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Program & Semester */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="event-program">Program</Label>
                <Select
                  value={calendarForm.programId || 'all'}
                  onValueChange={handleCalendarProgramChange}
                >
                  <SelectTrigger id="event-program" className="bg-background">
                    <SelectValue placeholder="All Programs (or select one)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Programs</SelectItem>
                    {programs
                      .filter(p => !calendarForm.academicSessionId || p.academicSessionId === calendarForm.academicSessionId)
                      .map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="event-semester">Semester</Label>
                <Select
                  value={calendarForm.semesterId || 'all'}
                  onValueChange={val => setCalendarForm(prev => ({ ...prev, semesterId: val === 'all' ? '' : val }))}
                  disabled={!calendarForm.programId || calendarForm.programId === 'all' || calendarModalSemestersLoading}
                >
                  <SelectTrigger id="event-semester" className="bg-background">
                    <SelectValue
                      placeholder={
                        calendarModalSemestersLoading
                          ? 'Loading semesters...'
                          : !calendarForm.programId || calendarForm.programId === 'all'
                          ? 'Select program first'
                          : 'All Semesters'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Semesters</SelectItem>
                    {calendarModalSemesters.map(sem => (
                      <SelectItem key={sem.id} value={sem.id}>
                        {sem.semesterName || `Semester ${sem.semesterNumber}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Start Date & End Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="event-start-date">Start Date *</Label>
                <Input
                  id="event-start-date"
                  type="date"
                  value={calendarForm.startDate}
                  onChange={e => {
                    const newStart = e.target.value;
                    setCalendarForm(prev => ({
                      ...prev,
                      startDate: newStart,
                      endDate: prev.endDate && prev.endDate < newStart ? newStart : prev.endDate,
                    }));
                  }}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="event-end-date">End Date *</Label>
                <Input
                  id="event-end-date"
                  type="date"
                  min={calendarForm.startDate || undefined}
                  value={calendarForm.endDate}
                  onChange={e => setCalendarForm(prev => ({ ...prev, endDate: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Start Time & End Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="event-start-time">Start Time (Optional)</Label>
                <Input
                  id="event-start-time"
                  type="time"
                  value={calendarForm.startTime}
                  onChange={e => setCalendarForm(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="event-end-time">End Time (Optional)</Label>
                <Input
                  id="event-end-time"
                  type="time"
                  min={
                    calendarForm.startDate === calendarForm.endDate && calendarForm.startTime
                      ? calendarForm.startTime
                      : undefined
                  }
                  value={calendarForm.endTime}
                  onChange={e => setCalendarForm(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="event-description">Description (Optional)</Label>
              <Textarea
                id="event-description"
                placeholder="Add notes, schedule, or instructions for this event..."
                value={calendarForm.description}
                onChange={e => setCalendarForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <DialogFooter className="flex gap-2 sm:justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCalendarModalOpen(false)}
                disabled={calendarSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={calendarSaving}
                className="bg-[#EF5A43] hover:bg-[#d94e39] text-white"
              >
                {calendarSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingCalendarEventId ? 'Update Event' : 'Save Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Event Details Dialog */}
      <Dialog
        open={Boolean(selectedCalendarEvent)}
        onOpenChange={open => {
          if (!open) setSelectedCalendarEvent(null);
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          {selectedCalendarEvent && (() => {
            const ev = selectedCalendarEvent;
            const cfg = CATEGORY_CONFIG[ev.category] || CATEGORY_CONFIG['Others'];
            const startStr = new Date(ev.startDate).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });
            const endStr = ev.endDate
              ? new Date(ev.endDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : startStr;

            return (
              <>
                <DialogHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.badgeBg}`}>
                      <span className={`h-2 w-2 rounded-full mr-1.5 ${cfg.dot}`} />
                      {ev.category}
                    </span>
                    <span className="text-xs text-muted-foreground">{displaySession(ev.academicSessionId)}</span>
                  </div>
                  <DialogTitle className="text-xl font-bold leading-snug">{ev.title}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2 text-sm">
                  <div className="rounded-lg bg-muted/40 p-3 space-y-2.5">
                    <div className="flex items-start gap-2.5 text-xs">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground">
                          {startStr === endStr ? startStr : `${startStr} - ${endStr}`}
                        </p>
                        {ev.startTime && (
                          <p className="text-muted-foreground mt-0.5">
                            {formatTimeDisplay(ev.startTime)}{ev.endTime ? ` - ${formatTimeDisplay(ev.endTime)}` : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    {ev.program && (
                      <div className="flex items-center gap-2.5 text-xs">
                        <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground">
                          {ev.program.name} {ev.semester ? `· ${ev.semester.semesterName || `Semester ${ev.semester.semesterNumber}`}` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {ev.description && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{ev.description}</p>
                    </div>
                  )}
                </div>

                <DialogFooter className="flex gap-2 sm:justify-between border-t pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={deletingCalendarEventId === ev.id}
                    onClick={() => handleDeleteCalendarEvent(ev.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {deletingCalendarEventId === ev.id ? 'Deleting...' : 'Delete'}
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setSelectedCalendarEvent(null)}>
                      Close
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleEditCalendarEvent(ev)}
                      className="bg-[#EF5A43] hover:bg-[#d94e39] text-white"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
