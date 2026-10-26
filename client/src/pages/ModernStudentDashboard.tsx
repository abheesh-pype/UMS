import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  BookOpen, 
  Download, 
  FileText,
  LogOut, 
  MapPin, 
  School,
  Video,
  Calendar,
  Clock,
  ExternalLink,
  Maximize,
  Minimize,
  Printer,
  GraduationCap,
  Layers,
  CalendarCheck,
  CalendarClock,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  Play,
  PlayCircle,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { InvoicePrintModal } from '@/components/dialogs/InvoicePrintModal';

interface StudentAssessmentResult {
  assessment_id: string;
  assessment_name: string;
  examination: string;
  obtained_mark: number;
  total_mark: number;
  pass_mark: number | null;
  passed: boolean | null;
  evaluated_at: string;
}

interface ModernStudentDashboardProps {
  initialTab?: string;
}

export function ModernStudentDashboard({ initialTab }: ModernStudentDashboardProps) {
  const { logout } = useAuth();
  const [student, setStudent] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scheduledClasses, setScheduledClasses] = useState<any[]>([]);
  const [scheduledClassesLoading, setScheduledClassesLoading] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<string>('1');
  const [selectedVideoClassId, setSelectedVideoClassId] = useState<string | null>(null);
  const [selectedVideoMaterialId, setSelectedVideoMaterialId] = useState<string | null>(null);
  const [videoFilterSemester, setVideoFilterSemester] = useState<string>('all');
  const [videoSearchQuery, setVideoSearchQuery] = useState<string>('');
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [activeSection, setActiveSection] = useState<'portal' | 'notifications' | 'active-session' | 'examination-portal' | 'payment-info' | 'video-classes' | 'scheduled-classes' | 'e-books' | 'results' | 'documents'>(
    initialTab === 'notifications' || initialTab === 'active-session' || initialTab === 'examination-portal' || initialTab === 'payment-info' || initialTab === 'video-classes' || initialTab === 'scheduled-classes' || initialTab === 'e-books' || initialTab === 'results' || initialTab === 'documents'
      ? initialTab
      : 'portal'
  );
  const [selectedExamination, setSelectedExamination] = useState<any>(null);
  const [examinationLoadingId, setExaminationLoadingId] = useState<string | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [registrationExamination, setRegistrationExamination] = useState<any>(null);
  const [registeredExaminationIds, setRegisteredExaminationIds] = useState<string[]>([]);
  // const [studentExamPortals, setStudentExamPortals] = useState<any[]>(readStudentExamPortals);
  const [selectedStudentInvoiceForPrint, setSelectedStudentInvoiceForPrint] = useState<any | null>(null);
  const [studentExaminations, setStudentExaminations] = useState<any[]>([]);
  const [studentExaminationsLoading, setStudentExaminationsLoading] = useState(false);
  const [launchingExaminationId, setLaunchingExaminationId] = useState<string | null>(null);
  const examPortalLoaded = useRef(false);
  const [registrationForm, setRegistrationForm] = useState({
    fullName: '',
    enrollmentNo: '',
    email: '',
    phone: '',
  });
  const [registrationConfirmed, setRegistrationConfirmed] = useState(false);
  const [selectedEbookModuleId, setSelectedEbookModuleId] = useState<string | null>(null);
  const [studentResults, setStudentResults] = useState<StudentAssessmentResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState('');
  const [studentDocuments, setStudentDocuments] = useState<any[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState('');
  const [studentPaymentInfo, setStudentPaymentInfo] = useState<any>(null);
  const [paymentInfoLoading, setPaymentInfoLoading] = useState(false);
  const [paymentInfoError, setPaymentInfoError] = useState('');
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);


  useEffect(() => {
    setActiveSection(
      initialTab === 'notifications' || initialTab === 'active-session' || initialTab === 'examination-portal' || initialTab === 'payment-info' || initialTab === 'video-classes' || initialTab === 'scheduled-classes' || initialTab === 'e-books' || initialTab === 'results' || initialTab === 'documents'
        ? initialTab
        : 'portal'
    );
  }, [initialTab]);

  useEffect(() => {
    fetchStudentData();
  }, []);

  const fetchStudentResults = useCallback(async () => {
    setResultsLoading(true);
    setResultsError('');
    try {
      const response = await api.get('/students/results');
      setStudentResults(response.data.results || []);
    } catch (error: unknown) {
      setResultsError(error instanceof Error ? error.message : 'Failed to load results.');
    } finally {
      setResultsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection !== 'results') return;
    fetchStudentResults();
  }, [activeSection, fetchStudentResults]);

  const fetchStudentDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setDocumentsError('');
    try {
      const response = await api.get('/students/documents');
      setStudentDocuments(response.data.data || []);
    } catch (error: any) {
      setDocumentsError(error.response?.data?.message || 'Failed to load enrollment documents.');
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection !== 'documents') return;
    fetchStudentDocuments();
  }, [activeSection, fetchStudentDocuments]);

  const fetchStudentPaymentInfo = useCallback(async () => {
    setPaymentInfoLoading(true);
    setPaymentInfoError('');
    try {
      const response = await api.get('/students/payment-info');
      setStudentPaymentInfo(response.data.data || null);
    } catch (error: any) {
      setPaymentInfoError(error.response?.data?.message || 'Failed to load payment information.');
    } finally {
      setPaymentInfoLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection !== 'payment-info') return;
    fetchStudentPaymentInfo();
  }, [activeSection, fetchStudentPaymentInfo]);

  useEffect(() => {
    if (activeSection !== 'scheduled-classes') return;
    setScheduledClassesLoading(true);
    api.get('/students/scheduled-classes')
      .then(response => setScheduledClasses(response.data.data || []))
      .catch((error: any) => {
        toast.error(error.response?.data?.message || 'Failed to load scheduled classes');
      })
      .finally(() => setScheduledClassesLoading(false));
  }, [activeSection]);

  const fetchStudentExaminations = useCallback(async () => {
    if (!examPortalLoaded.current) setStudentExaminationsLoading(true);
    try {
      const response = await api.get('/students/examinations');
      setStudentExaminations(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load examinations');
    } finally {
      setStudentExaminationsLoading(false);
      examPortalLoaded.current = true;
    }
  }, []);

  useEffect(() => {
    if (activeSection !== 'examination-portal') return;
    fetchStudentExaminations();
    const refreshTimer = window.setInterval(fetchStudentExaminations, 60000);
    return () => window.clearInterval(refreshTimer);
  }, [activeSection, fetchStudentExaminations]);

  const fetchVideoMaterials = useCallback(async () => {
    if (!student?.program?.id) return;
    try {
      const res = await api.get(`/operations/programs/${student.program.id}/materials`);
      setMaterials(res.data.data || []);
    } catch {
      // ignore
    }
  }, [student?.program?.id]);

  useEffect(() => {
    if (activeSection === 'video-classes' && materials.length === 0) {
      fetchVideoMaterials();
    }
  }, [activeSection, fetchVideoMaterials, materials.length]);

  const fetchAcademicEvents = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const response = await api.get('/operations/academic-calendar');
      setCalendarEvents(response.data.data || []);
    } catch (error) {
      console.error('Failed to load academic events:', error);
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'active-session') {
      fetchAcademicEvents();
      if (studentExaminations.length === 0) {
        fetchStudentExaminations();
      }
    }
  }, [activeSection, fetchAcademicEvents, fetchStudentExaminations, studentExaminations.length]);

  const launchExamination = async (examinationId: string) => {
    const launchWindow = window.open('about:blank', '_blank');
    if (!launchWindow) {
      toast.error('Allow pop-ups to open the examination portal');
      return;
    }
    setLaunchingExaminationId(examinationId);
    try {
      const response = await api.post(`/students/examinations/${examinationId}/launch`);
      launchWindow.opener = null;
      launchWindow.location.href = response.data.data.launchUrl;
    } catch (error: any) {
      launchWindow.close();
      toast.error(error.response?.data?.message || 'Failed to launch examination');
    } finally {
      setLaunchingExaminationId(null);
    }
  };

  useEffect(() => {
    const updateFullscreenState = () => {
      setIsVideoFullscreen(document.fullscreenElement === videoContainerRef.current);
    };
    document.addEventListener('fullscreenchange', updateFullscreenState);
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState);
  }, []);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      // getStudents returns only the logged-in student's record
      const studentRes = await api.get('/students');
      if (studentRes.data.data && studentRes.data.data.length > 0) {
        const studentInfo = studentRes.data.data[0];
        setStudent(studentInfo);

        // Render the portal as soon as the profile is available. Materials are secondary.
        setLoading(false);

        if (studentInfo.program?.id) {
          try {
            const materialsRes = await api.get(`/operations/programs/${studentInfo.program.id}/materials`);
            setMaterials(materialsRes.data.data || []);
          } catch {
            setMaterials([]);
          }
        }
        return;
      }
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data.data || []);
      setUnreadNotifications(response.data.unreadCount || 0);
    } catch (error) {
      toast.error('Failed to load notifications');
    }
  };

  const openNotifications = () => {
    setActiveSection('notifications');
    fetchNotifications();
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(previous => previous.map(notification => ({ ...notification, read: true })));
      setUnreadNotifications(0);
    } catch (error) {
      toast.error('Failed to mark notifications as read');
    }
  };

  const viewExaminationDetails = async (notification: any) => {
    const examinationId = notification.link?.startsWith('examinations/')
      ? notification.link.replace('examinations/', '')
      : '';
    if (!examinationId) return;
    setExaminationLoadingId(examinationId);
    try {
      const response = await api.get(`/students/examinations/${examinationId}`);
      setSelectedExamination(response.data.data);
      if (response.data.data?.registered) {
        setRegisteredExaminationIds(current => current.includes(examinationId) ? current : [...current, examinationId]);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load examination details');
    } finally {
      setExaminationLoadingId(null);
    }
  };

  const openRegistrationForm = async (notification: any) => {
    const examinationId = notification.link?.startsWith('examinations/')
      ? notification.link.replace('examinations/', '')
      : '';
    if (!examinationId) return;
    if (registeredExaminationIds.includes(examinationId)) {
      toast.info('You are already registered for this examination');
      return;
    }

    setRegistrationForm({
      fullName: student?.name || '',
      enrollmentNo: student?.enrollmentNo || '',
      email: student?.email || '',
      phone: student?.phone || '',
    });
    setRegistrationConfirmed(false);
    setExaminationLoadingId(notification.id);
    try {
      const response = await api.get(`/students/examinations/${examinationId}`);
      setRegistrationExamination(response.data.data);
      if (response.data.data?.registered) {
        setRegisteredExaminationIds(current => current.includes(examinationId) ? current : [...current, examinationId]);
        toast.info('You are already registered for this examination');
        return;
      }
      setRegistrationOpen(true);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load examination details');
    } finally {
      setExaminationLoadingId(null);
    }
  };

  const submitRegistration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!registrationExamination) return;
    try {
      await api.post(`/students/examinations/${registrationExamination.id}/register`, { ...registrationForm, confirmed: registrationConfirmed });
      toast.success('Examination registration completed');
      setRegisteredExaminationIds(current => current.includes(registrationExamination.id) ? current : [...current, registrationExamination.id]);
      setRegistrationOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to register for examination');
    }
  };

  const handleDownload = (m: any) => {
    const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
    const serverUrl = apiBase.replace('/api/v1', '');
    const url = m.fileUrl.startsWith('http') ? m.fileUrl : `${serverUrl}${m.fileUrl}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = m.fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatResultDate = (value: string) => new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const paymentCurrency = /^[A-Z]{3}$/.test(studentPaymentInfo?.currency || '')
    ? studentPaymentInfo.currency
    : 'INR';
  const formatPaymentAmount = (value: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: paymentCurrency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
  const totalReceived = (studentPaymentInfo?.payments || [])
    .filter((payment: any) => payment.status === 'paid')
    .reduce((total: number, payment: any) => total + (Number(payment.amount) || 0), 0);
  const outstandingInvoices = (studentPaymentInfo?.invoices || [])
    .filter((invoice: any) => invoice.status !== 'paid')
    .reduce((total: number, invoice: any) => total + (Number(invoice.amount) || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground text-sm font-medium">Loading your Student Portal...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CardTitle className="text-red-500">Profile Not Found</CardTitle>
            <CardDescription>We could not retrieve your active student record.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please contact your study center or operations department to ensure your enrollment has been fully verified and promoted to an active student account.
            </p>
            <Button variant="outline" className="w-full" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" /> Log Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const program = student.program;
  const enrolledSessionId = student.sessionId || student.activeSession?.id || program?.academicSessionId;
  const enrolledSession = student.activeSession || program?.academicSession;
  const sessionSemesters = (program?.semesterRecords || [])
    .filter((semester: any) => !enrolledSessionId || semester.academicSessionId === enrolledSessionId)
    .sort((a: any, b: any) => a.semesterNumber - b.semesterNumber);
  const enrolledSemesters = sessionSemesters.length > 0
    ? sessionSemesters
    : (program?.semesterRecords || []).sort((a: any, b: any) => a.semesterNumber - b.semesterNumber);
  const semesterList = enrolledSemesters.map((semester: any) => String(semester.semesterNumber));
  const activeSemester = semesterList.includes(selectedSemester) ? selectedSemester : (semesterList[0] || '1');
  const sessionModules = (program?.modules || []).filter(
    (module: any) => !enrolledSessionId || module.academicSessionId === enrolledSessionId
  );
  const enrolledModules = sessionModules.length > 0
    ? sessionModules
    : (program?.modules || []);
  const displaySemesters = enrolledSemesters;

  const upcomingCalendarEvents = calendarEvents
    .filter((event: any) => {
      if (event.academicSessionId && enrolledSessionId && event.academicSessionId !== enrolledSessionId) {
        return false;
      }
      if (event.programId && program?.id && event.programId !== program.id) {
        return false;
      }
      return true;
    })
    .map((event: any) => ({
      id: event.id,
      title: event.title,
      category: event.category || 'Academic',
      startDate: event.startDate,
      endDate: event.endDate,
      time: event.startTime ? `${event.startTime}${event.endTime ? ` - ${event.endTime}` : ''}` : null,
      description: event.description,
      source: 'calendar',
    }));

  const upcomingExamEvents = (studentExaminations || []).map((exam: any) => ({
    id: exam.id,
    title: exam.examinationName,
    category: 'Examination',
    startDate: exam.startDate,
    endDate: exam.endDate,
    time: exam.examinationType || null,
    description: exam.readyToLaunch ? 'Ready to write' : 'Scheduled Examination',
    source: 'examination',
  }));

  const upcomingClassEvents = (scheduledClasses || []).map((sc: any) => ({
    id: sc.id,
    title: sc.title,
    category: 'Live Class',
    startDate: sc.startsAt,
    endDate: sc.endsAt,
    time: new Date(sc.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    description: sc.module?.moduleName || sc.academicSession?.name,
    source: 'class',
  }));

  const combinedAcademicEvents = [...upcomingCalendarEvents, ...upcomingExamEvents, ...upcomingClassEvents]
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const getEventBadgeClass = (category: string) => {
    const c = (category || '').toLowerCase();
    if (c.includes('exam')) return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
    if (c.includes('holiday')) return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    if (c.includes('class')) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    if (c.includes('admission')) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    return 'bg-primary/10 text-primary border-primary/20';
  };
  const studentSessionIds = new Set<string>();
  if (student?.sessionId) studentSessionIds.add(student.sessionId);
  if (student?.activeSession?.id) studentSessionIds.add(student.activeSession.id);
  (student?.enrollments || []).forEach((e: any) => {
    if (e.sessionId) studentSessionIds.add(e.sessionId);
    if (e.session?.id) studentSessionIds.add(e.session.id);
  });
  if (program?.academicSessionId) studentSessionIds.add(program.academicSessionId);
  if (program?.academicSession?.id) studentSessionIds.add(program.academicSession.id);

  const studentSessionNames = new Set<string>();
  if (enrolledSession?.name) studentSessionNames.add(enrolledSession.name.toLowerCase().trim());
  if (program?.academicSession?.name) studentSessionNames.add(program.academicSession.name.toLowerCase().trim());
  (student?.enrollments || []).forEach((e: any) => {
    if (e.session?.name) studentSessionNames.add(e.session.name.toLowerCase().trim());
  });

  const getVideoMetadata = (material: { category: string; description?: string | null }) => {
    if (material.category === 'video_class') {
      try {
        const metadata = JSON.parse(material.description || '{}');
        return {
          text: metadata.text || '',
          moduleId: metadata.moduleId || '',
          moduleName: metadata.moduleName || '',
          sessionId: metadata.sessionId || '',
          sessionName: metadata.sessionName || '',
          semesterId: metadata.semesterId || '',
          semesterName: metadata.semesterName || '',
          programId: metadata.programId || '',
          programName: metadata.programName || '',
          youtubeUrl: metadata.youtubeUrl || '',
        };
      } catch {
        return {
          text: material.description || '',
          moduleId: '',
          moduleName: '',
          sessionId: '',
          sessionName: '',
          semesterId: '',
          semesterName: '',
          programId: '',
          programName: '',
          youtubeUrl: '',
        };
      }
    }
    const match = material.description?.match(/^Module: ([\w-]+) - (.*)$/);
    return {
      text: material.description || '',
      moduleId: match ? match[1] : (material.description?.match(/^Module: ([\w-]+) - /)?.[1] || ''),
      moduleName: match ? match[2] : '',
      sessionId: '',
      sessionName: '',
      semesterId: '',
      semesterName: '',
      programId: '',
      programName: '',
      youtubeUrl: '',
    };
  };

  const getYouTubeEmbedUrl = (url: string) => {
    try {
      const parsedUrl = new URL(url);
      const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, '');
      let videoId = '';
      if (host === 'youtu.be') {
        videoId = parsedUrl.pathname.split('/').filter(Boolean)[0] || '';
      } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
        videoId = parsedUrl.searchParams.get('v') || parsedUrl.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] || '';
      }
      return /^[\w-]{11}$/.test(videoId) ? `https://www.youtube.com/embed/${videoId}` : '';
    } catch {
      return '';
    }
  };

  const videoApiBase = import.meta.env.VITE_API_URL || '/api/v1';

  // Process and extract all video classes for the enrolled session
  const allSessionVideos = materials
    .filter(material => material.category === 'video_class' || material.category === 'video')
    .map(material => {
      const metadata = getVideoMetadata(material);
      const rawUrl = material.fileUrl || metadata.youtubeUrl || '';
      const videoUrl = rawUrl.startsWith('http')
        ? rawUrl
        : `${videoApiBase.replace('/api/v1', '')}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
      const embedUrl = getYouTubeEmbedUrl(videoUrl);

      // Resolve semester display name
      const matchedSemester = (program?.semesterRecords || []).find(
        (s: any) => s.id === metadata.semesterId || String(s.semesterNumber) === String(metadata.semesterId)
      );
      const semesterDisplayName = metadata.semesterName || matchedSemester?.semesterName || (material.semesterNumber ? `Semester ${material.semesterNumber}` : 'General');
      const semesterNumberVal = matchedSemester?.semesterNumber || (material.semesterNumber ? Number(material.semesterNumber) : null);

      // Resolve module display name
      const matchedModule = (program?.modules || []).find((m: any) => m.id === metadata.moduleId);
      const moduleDisplayName = metadata.moduleName || matchedModule?.moduleName || 'Curriculum Class';

      return {
        id: material.id,
        title: material.title || material.fileName || 'Video Lecture',
        description: metadata.text || material.description || '',
        sessionId: metadata.sessionId,
        sessionName: metadata.sessionName || enrolledSession?.name || '',
        programId: metadata.programId || material.programId,
        semesterId: metadata.semesterId || matchedSemester?.id || '',
        semesterName: semesterDisplayName,
        semesterNumber: semesterNumberVal,
        moduleId: metadata.moduleId || matchedModule?.id || '',
        moduleName: moduleDisplayName,
        videoUrl,
        embedUrl,
        fileName: material.fileName,
        createdAt: material.createdAt,
        rawMaterial: material,
      };
    })
    .filter(video => {
      // Must match student's program if set
      if (video.programId && program?.id && video.programId !== program.id) {
        return false;
      }
      // If video has session attached, check if it matches student's sessions
      if (video.sessionId && studentSessionIds.size > 0) {
        if (studentSessionIds.has(video.sessionId)) return true;
      }
      if (video.sessionName && studentSessionNames.size > 0) {
        if (studentSessionNames.has(video.sessionName.toLowerCase().trim())) return true;
      }
      // If video has no explicit session restriction, it belongs to the program
      return true;
    });

  const activeVideo = allSessionVideos.find(v => v.id === selectedVideoMaterialId)
    || allSessionVideos[0]
    || null;

  const semesterFilterOptions = Array.from(
    new Set(allSessionVideos.map(v => v.semesterName).filter(Boolean))
  );

  const displayedVideos = allSessionVideos.filter(video => {
    if (videoFilterSemester !== 'all' && video.semesterName !== videoFilterSemester && String(video.semesterNumber) !== videoFilterSemester) {
      return false;
    }
    if (videoSearchQuery.trim()) {
      const q = videoSearchQuery.toLowerCase();
      const matchTitle = video.title.toLowerCase().includes(q);
      const matchMod = video.moduleName.toLowerCase().includes(q);
      const matchDesc = video.description.toLowerCase().includes(q);
      if (!matchTitle && !matchMod && !matchDesc) return false;
    }
    return true;
  });

  const getVideosForModule = (module: { id: string }) => materials.filter(material => {
    if (material.category !== 'video_class' && material.category !== 'video') return false;
    const metadata = getVideoMetadata(material);
    return metadata.moduleId === module.id;
  });
  const selectedEbookModule = enrolledModules.find((module: any) => module.id === selectedEbookModuleId);
  const selectedModuleEbooks = materials.filter(
    material => material.category === 'ebook'
      && selectedEbookModule
      && material.description === `Module: ${selectedEbookModule.id} - ${selectedEbookModule.moduleName}`
  );

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <div className="flex">
        <div className="flex-1 min-w-0">
        {activeSection === 'payment-info' ? (
        <main className="container mx-auto max-w-7xl px-4 py-8">
          <Card className="border-none shadow-xl">
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
              <CardDescription>
                {studentPaymentInfo?.program || program?.name || 'Your program'}
                {studentPaymentInfo?.session ? ` · ${studentPaymentInfo.session}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {paymentInfoLoading ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Loading your payment information...</p>
              ) : paymentInfoError ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-destructive">{paymentInfoError}</p>
                  <Button className="mt-3" variant="outline" onClick={fetchStudentPaymentInfo}>Try again</Button>
                </div>
              ) : !studentPaymentInfo ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Payment information is not available.</p>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Configured program fees</p>
                        <p className="mt-1 text-xl font-bold">{formatPaymentAmount(studentPaymentInfo.totalConfigured)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Payments received</p>
                        <p className="mt-1 text-xl font-bold">{formatPaymentAmount(totalReceived)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">Outstanding invoices</p>
                        <p className="mt-1 text-xl font-bold">{formatPaymentAmount(outstandingInvoices)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <section className="space-y-3">
                    <div>
                      <h3 className="font-semibold">Configured fee breakdown</h3>
                      <p className="text-sm text-muted-foreground">
                        {studentPaymentInfo.billingCycle
                          ? `Billing cycle: ${studentPaymentInfo.billingCycle.replaceAll('_', ' ')}`
                          : 'Configured fees for your enrolled program'}
                      </p>
                    </div>
                    {studentPaymentInfo.feeItems?.length ? (
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 text-left">
                            <tr>
                              <th className="px-4 py-3 font-medium">Fee</th>
                              <th className="px-4 py-3 text-right font-medium">Configured amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {studentPaymentInfo.feeItems.map((item: any, index: number) => (
                              <tr key={`${item.label}-${index}`}>
                                <td className="px-4 py-3">{item.label}</td>
                                <td className="px-4 py-3 text-right font-medium">{formatPaymentAmount(item.amount)}</td>
                              </tr>
                            ))}
                            <tr className="bg-muted/30 font-semibold">
                              <td className="px-4 py-3">Total configured</td>
                              <td className="px-4 py-3 text-right">{formatPaymentAmount(studentPaymentInfo.totalConfigured)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        No program or university fee structure is configured for this enrollment yet.
                      </p>
                    )}
                  </section>

                  {studentPaymentInfo.installments?.length > 0 && (
                    <section className="space-y-3">
                      <h3 className="font-semibold">Scheduled fees</h3>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {studentPaymentInfo.installments.map((installment: any) => (
                          <Card key={installment.name}>
                            <CardContent className="space-y-3 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium">{installment.name}</span>
                                <span className="font-semibold">{formatPaymentAmount(installment.amount)}</span>
                              </div>
                              {installment.dueDate && (
                                <p className="text-xs text-muted-foreground">
                                  Due: {new Date(installment.dueDate).toLocaleDateString()}
                                </p>
                              )}
                              <div className="space-y-1 border-t pt-2">
                                {installment.items.map((item: any, index: number) => (
                                  <div key={`${item.label}-${index}`} className="flex justify-between gap-3 text-xs text-muted-foreground">
                                    <span>{item.label}</span>
                                    <span>{formatPaymentAmount(item.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="space-y-3">
                    <div>
                      <h3 className="font-semibold">Payment history</h3>
                      <p className="text-sm text-muted-foreground">Payments recorded for your enrollment, invoices, and university fees.</p>
                    </div>
                    {studentPaymentInfo.payments?.length ? (
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 text-left">
                            <tr>
                              <th className="px-4 py-3 font-medium">Date</th>
                              <th className="px-4 py-3 font-medium">Description</th>
                              <th className="px-4 py-3 font-medium">Method</th>
                              <th className="px-4 py-3 text-right font-medium">Amount</th>
                              <th className="px-4 py-3 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {studentPaymentInfo.payments.map((payment: any) => (
                              <tr key={payment.id}>
                                <td className="whitespace-nowrap px-4 py-3">{new Date(payment.date).toLocaleDateString()}</td>
                                <td className="px-4 py-3">
                                  <div>{payment.description}</div>
                                  {payment.referenceNo && <div className="text-xs text-muted-foreground">Ref: {payment.referenceNo}</div>}
                                </td>
                                <td className="px-4 py-3">{payment.method || '-'}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right font-medium">{formatPaymentAmount(payment.amount)}</td>
                                <td className="px-4 py-3">
                                  <Badge variant={payment.status === 'paid' ? 'default' : 'secondary'}>{payment.status}</Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        No payments have been recorded yet.
                      </p>
                    )}
                  </section>

                  {studentPaymentInfo.invoices?.length > 0 && (
                    <section className="space-y-3">
                      <div>
                        <h3 className="font-semibold">Fee Invoices & Statements</h3>
                        <p className="text-xs text-muted-foreground">Official university invoices generated for your academic course and enrollment.</p>
                      </div>
                      <div className="space-y-2">
                        {studentPaymentInfo.invoices.map((invoice: any) => (
                          <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm bg-card hover:border-primary/40 transition-colors shadow-xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <p className="font-bold font-mono text-foreground">{invoice.invoiceNo}</p>
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  {invoice.invoiceType || 'Tuition Fee'}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {invoice.financialYear || 'FY 2026-27'} · {invoice.period || 'Academic Fee'}
                                {invoice.dueDate && ` · Due: ${new Date(invoice.dueDate).toLocaleDateString()}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className="font-bold text-base font-mono block">
                                  {formatPaymentAmount(invoice.total || invoice.amount)}
                                </span>
                                {invoice.balanceAmount > 0 && invoice.status !== 'paid' ? (
                                  <span className="text-[11px] text-rose-600 font-mono block">
                                    Bal: {formatPaymentAmount(invoice.balanceAmount)}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-emerald-600 font-semibold block">
                                    Fully Paid
                                  </span>
                                )}
                              </div>
                              <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'} className="capitalize font-semibold text-xs">
                                {invoice.status?.replace('_', ' ')}
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedStudentInvoiceForPrint(invoice)}
                                className="gap-1.5 text-xs font-semibold"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                <span>View & Print</span>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </main>
        ) : activeSection === 'notifications' ? (
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Updates and announcements for your student account.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={markAllNotificationsRead} disabled={unreadNotifications === 0}>
                  Mark all read
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No notifications yet.</div>
              ) : (
                notifications.map(notification => (
                  <div key={notification.id} className={`rounded-lg border p-4 ${notification.read ? 'bg-background' : 'bg-primary/5 border-primary/20'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{notification.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                      </div>
                      {!notification.read && <Badge>New</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                    {notification.link?.startsWith('examinations/') && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewExaminationDetails(notification)}
                          disabled={examinationLoadingId === notification.id}
                        >
                          {examinationLoadingId === notification.id ? 'Loading...' : 'View Details'}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openRegistrationForm(notification)}
                          disabled={examinationLoadingId === notification.id || registeredExaminationIds.includes(notification.link.replace('examinations/', ''))}
                        >
                          {registeredExaminationIds.includes(notification.link.replace('examinations/', '')) ? 'Registered' : examinationLoadingId === notification.id ? 'Loading...' : 'Register'}
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </main>
      ) : activeSection === 'examination-portal' ? (
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Examination Portal</CardTitle>
              <CardDescription>Registered examinations for your active program and session.</CardDescription>
            </CardHeader>
            <CardContent>
              {studentExaminationsLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading examinations...</p>
              ) : studentExaminations.length > 0 ? (
                <div className="space-y-4">
                  {studentExaminations.map((examination: any) => (
                    <div key={examination.id} className="rounded-lg border p-4 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{examination.examinationName}</h3>
                          <p className="text-sm text-muted-foreground">{examination.examinationType}</p>
                        </div>
                        <Badge variant={examination.readyToLaunch ? 'default' : 'secondary'}>
                          {examination.readyToLaunch ? 'Ready to write' : examination.registered ? 'Not open yet' : 'Registration required'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                        <div><span className="text-muted-foreground">Session</span><p className="font-medium">{examination.academicSession?.name || '—'}</p></div>
                        <div><span className="text-muted-foreground">Program</span><p className="font-medium">{examination.program?.name || '—'}</p></div>
                        <div><span className="text-muted-foreground">Semester</span><p className="font-medium">{examination.semester?.semesterName || '—'}</p></div>
                        <div><span className="text-muted-foreground">Exam period</span><p className="font-medium">{new Date(examination.startDate).toLocaleDateString()} – {new Date(examination.endDate).toLocaleDateString()}</p></div>
                      </div>
                      <Button
                        onClick={() => launchExamination(examination.id)}
                        disabled={!examination.readyToLaunch || launchingExaminationId === examination.id}
                      >
                        {launchingExaminationId === examination.id ? 'Connecting...' : 'Open Exam Portal'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : <p className="py-8 text-center text-sm text-muted-foreground">No examinations are currently assigned to your active program and session.</p>}
            </CardContent>
          </Card>
        </main>
      ) : activeSection === 'results' ? (
        <main className="container mx-auto max-w-7xl px-4 py-8">
          <Card className="border-none shadow-xl">
            <CardHeader>
              <CardTitle>Your Results</CardTitle>
              <CardDescription>Evaluated results published for your student account.</CardDescription>
            </CardHeader>
            <CardContent>
              {resultsLoading ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Loading your results...</p>
              ) : resultsError ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-destructive">{resultsError}</p>
                  <Button className="mt-3" variant="outline" onClick={fetchStudentResults}>
                    Try again
                  </Button>
                </div>
              ) : studentResults.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No evaluated results have been published yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Examination</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assessment</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Marks</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Result</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evaluated On</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentResults.map((result, index) => (
                        <tr key={result.assessment_id} className={`border-t transition-colors hover:bg-muted/40 ${index % 2 ? 'bg-muted/15' : ''}`}>
                          <td className="px-4 py-3">{result.examination || '-'}</td>
                          <td className="px-4 py-3 font-medium">{result.assessment_name || '-'}</td>
                          <td className="px-4 py-3">{result.obtained_mark} / {result.total_mark}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-start gap-1">
                              <Badge className={result.passed === true
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
                                : result.passed === false
                                  ? 'bg-red-100 text-red-800 hover:bg-red-100'
                                  : 'bg-muted text-muted-foreground hover:bg-muted'}>
                                {result.passed === true ? 'Passed' : result.passed === false ? 'Failed' : 'Pass mark not set'}
                              </Badge>
                              {result.pass_mark != null && (
                                <span className="text-xs text-muted-foreground">Pass mark: {result.pass_mark}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">{formatResultDate(result.evaluated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      ) : activeSection === 'documents' ? (
        <main className="container mx-auto max-w-7xl px-4 py-8">
          <Card className="border-none shadow-xl">
            <CardHeader>
              <CardTitle>Enrollment Documents</CardTitle>
              <CardDescription>Documents submitted with your student enrollment.</CardDescription>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Loading your documents...</p>
              ) : documentsError ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-destructive">{documentsError}</p>
                  <Button className="mt-3" variant="outline" onClick={fetchStudentDocuments}>Try again</Button>
                </div>
              ) : studentDocuments.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No enrollment documents have been uploaded.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {studentDocuments.map(document => {
                    const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
                    const fileUrl = document.url.startsWith('http')
                      ? document.url
                      : `${apiBase.replace('/api/v1', '')}${document.url.startsWith('/') ? '' : '/'}${document.url}`;
                    return (
                      <Card key={document.id} className="flex flex-col">
                        <CardContent className="flex flex-1 flex-col gap-4 p-5">
                          <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-primary/10 p-3">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="break-words font-semibold">{document.name}</h3>
                              <p className="mt-1 text-sm text-muted-foreground">{document.requirement || 'Enrollment document'}</p>
                            </div>
                          </div>
                          <div className="mt-auto space-y-1 border-t pt-3 text-xs text-muted-foreground">
                            <p>Program: {document.program || '-'}</p>
                            <p>Session: {document.session || '-'}</p>
                          </div>
                          <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                            <Download className="h-4 w-4" /> View / Download
                          </a>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      ) : activeSection === 'active-session' ? (
        <main className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
          {/* Main Card: Academic overview */}
          <Card className="border-none shadow-xl bg-card/70 backdrop-blur-xl overflow-hidden">
            <CardHeader className="border-b bg-muted/30 pb-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1.5 py-1 px-2.5 text-xs font-semibold uppercase tracking-wider bg-primary/10 text-primary border-primary/20">
                      <Sparkles className="w-3.5 h-3.5" /> Academic Status
                    </Badge>
                    {enrolledSession?.status && (
                      <Badge variant="outline" className="text-xs capitalize border-green-500/30 text-green-600 dark:text-green-400 bg-green-500/10">
                        ● {enrolledSession.status} Session
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2.5 pt-1">
                    <GraduationCap className="h-7 w-7 text-primary shrink-0" />
                    Academic overview
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground max-w-2xl">
                    Comprehensive overview of your enrolled session, semester progression, active program details, and upcoming academic timeline.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2.5 self-start sm:self-center">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      fetchStudentData();
                      fetchAcademicEvents();
                      fetchStudentExaminations();
                    }}
                    disabled={calendarLoading}
                    className="gap-2 shadow-sm"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', calendarLoading && 'animate-spin')} />
                    Refresh Overview
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {/* The 4-Item Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. Student Taken Session */}
                <Card className="border border-border/70 hover:border-primary/40 transition-all duration-300 shadow-sm hover:shadow-md bg-background/60 backdrop-blur flex flex-col justify-between">
                  <div>
                    <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <CalendarCheck className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Enrolled Session</p>
                            <h3 className="text-base font-semibold text-foreground">Taken Academic Session</h3>
                          </div>
                        </div>
                        {enrolledSession?.status ? (
                          <Badge variant="secondary" className="capitalize text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                            {enrolledSession.status}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Active</Badge>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="pt-5 space-y-4">
                      {enrolledSession ? (
                        <>
                          <div>
                            <p className="text-lg font-bold text-foreground tracking-tight">
                              {enrolledSession.name}
                            </p>
                            {enrolledSession.startDate && enrolledSession.endDate ? (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                <Calendar className="w-3.5 h-3.5 text-primary" />
                                <span>
                                  {new Date(enrolledSession.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  {' — '}
                                  {new Date(enrolledSession.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-1">Current Academic Cycle</p>
                            )}
                          </div>

                          {/* Progress bar if dates exist */}
                          {(() => {
                            if (!enrolledSession.startDate || !enrolledSession.endDate) return null;
                            const start = new Date(enrolledSession.startDate).getTime();
                            const end = new Date(enrolledSession.endDate).getTime();
                            const now = Date.now();
                            if (isNaN(start) || isNaN(end) || end <= start) return null;
                            const pct = now <= start ? 0 : now >= end ? 100 : Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
                            return (
                              <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 border border-border/50">
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground font-medium">Session Timeline Progress</span>
                                  <span className="font-semibold text-primary">{pct}% Completed</span>
                                </div>
                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500" 
                                    style={{ width: `${pct}%` }} 
                                  />
                                </div>
                              </div>
                            );
                          })()}

                          {/* Session Metadata Grid */}
                          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                            <div className="rounded-lg border bg-muted/20 p-2.5 space-y-0.5">
                              <span className="text-muted-foreground">Enrollment No.</span>
                              <p className="font-semibold text-foreground truncate">{student.enrollmentNo || 'N/A'}</p>
                            </div>
                            <div className="rounded-lg border bg-muted/20 p-2.5 space-y-0.5">
                              <span className="text-muted-foreground">Admission Date</span>
                              <p className="font-semibold text-foreground">
                                {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'Active'}
                              </p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          <p>No active admission session record is currently linked to this student profile.</p>
                        </div>
                      )}
                    </CardContent>
                  </div>

                  <div className="px-6 pb-4 pt-1 border-t border-border/30 text-xs text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                    <span>Primary academic session registered for coursework and exams</span>
                  </div>
                </Card>

                {/* 2. That Session Contained Semester */}
                <Card className="border border-border/70 hover:border-emerald-500/40 transition-all duration-300 shadow-sm hover:shadow-md bg-background/60 backdrop-blur flex flex-col justify-between">
                  <div>
                    <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <Layers className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Curriculum Structure</p>
                            <h3 className="text-base font-semibold text-foreground">Contained Semesters</h3>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                          {displaySemesters.length} Semesters Total
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-5 space-y-4">
                      {/* Current Semester Highlight Banner */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <div className="flex items-center gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          <div>
                            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Your Current Level</p>
                            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                              Semester {student.currentSemester || 1}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                          In Progress
                        </Badge>
                      </div>

                      {/* Semesters List */}
                      {displaySemesters.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Semesters in this session curriculum:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                            {displaySemesters.map((sem: any) => {
                              const isCurrent = (student.currentSemester || 1) === sem.semesterNumber;
                              const moduleCount = enrolledModules.filter((m: any) => m.semesterId === sem.id).length;
                              return (
                                <div
                                  key={sem.id || sem.semesterNumber}
                                  className={cn(
                                    'p-2.5 rounded-lg border text-xs transition-colors flex items-center justify-between gap-2',
                                    isCurrent 
                                      ? 'border-emerald-500/60 bg-emerald-50/50 dark:bg-emerald-950/20 font-medium' 
                                      : 'border-border/60 bg-muted/20 hover:bg-muted/40'
                                  )}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 truncate">
                                      <span className="font-semibold text-foreground truncate">
                                        {sem.semesterName || `Semester ${sem.semesterNumber}`}
                                      </span>
                                      {isCurrent && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-emerald-500/50 text-emerald-600 bg-emerald-500/10">
                                          Current
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      {moduleCount > 0 ? `${moduleCount} Modules / Subjects` : 'Core Curriculum'}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="py-6 text-center text-xs text-muted-foreground">
                          Semester configuration for this session is being assigned.
                        </p>
                      )}
                    </CardContent>
                  </div>

                  <div className="px-6 pb-4 pt-1 border-t border-border/30 text-xs text-muted-foreground flex items-center justify-between">
                    <span>Total Enrolled Modules: <strong className="text-foreground">{enrolledModules.length}</strong></span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs text-emerald-600 hover:text-emerald-700 p-0"
                      onClick={() => setActiveSection('e-books')}
                    >
                      View Syllabus <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </Button>
                  </div>
                </Card>

                {/* 3. Currently Active Program In It */}
                <Card className="border border-border/70 hover:border-violet-500/40 transition-all duration-300 shadow-sm hover:shadow-md bg-background/60 backdrop-blur flex flex-col justify-between">
                  <div>
                    <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                            <School className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Degree Program</p>
                            <h3 className="text-base font-semibold text-foreground">Currently Active Program</h3>
                          </div>
                        </div>
                        {program?.code && (
                          <Badge variant="secondary" className="font-mono text-xs bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20">
                            {program.code}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="pt-5 space-y-4">
                      {program ? (
                        <>
                          <div>
                            <p className="text-lg font-bold text-foreground tracking-tight">
                              {program.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {program.programType || 'Undergraduate Degree'} · {program.duration || 0} Year Program
                            </p>
                          </div>

                          {/* Program Attributes Grid */}
                          <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
                            <div className="p-2.5 rounded-lg border border-border/50 bg-muted/20 space-y-0.5">
                              <span className="text-muted-foreground block">Degree / Type</span>
                              <span className="font-semibold text-foreground">{program.programType || 'Standard Degree'}</span>
                            </div>
                            <div className="p-2.5 rounded-lg border border-border/50 bg-muted/20 space-y-0.5">
                              <span className="text-muted-foreground block">Program Duration</span>
                              <span className="font-semibold text-foreground">{program.duration || 0} Years ({(program.duration || 0) * 2} Sem.)</span>
                            </div>
                            <div className="p-2.5 rounded-lg border border-border/50 bg-muted/20 space-y-0.5">
                              <span className="text-muted-foreground block">Study Center</span>
                              <span className="font-semibold text-foreground truncate block">{student.center?.name || 'Direct / University'}</span>
                            </div>
                            <div className="p-2.5 rounded-lg border border-border/50 bg-muted/20 space-y-0.5">
                              <span className="text-muted-foreground block">Center Code</span>
                              <span className="font-semibold text-foreground">{student.center?.code || 'MAIN-01'}</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          <p>No program is assigned to this profile.</p>
                        </div>
                      )}
                    </CardContent>
                  </div>

                  <div className="px-6 pb-4 pt-1 border-t border-border/30 text-xs text-muted-foreground flex items-center justify-between">
                    <span className="truncate">University: <strong className="text-foreground">{program?.university?.name || 'University Management'}</strong></span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs text-violet-600 hover:text-violet-700 p-0"
                      onClick={() => setActiveSection('video-classes')}
                    >
                      Video Classes <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </Button>
                  </div>
                </Card>

                {/* 4. Next Academic Events Info */}
                <Card className="border border-border/70 hover:border-amber-500/40 transition-all duration-300 shadow-sm hover:shadow-md bg-background/60 backdrop-blur flex flex-col justify-between">
                  <div>
                    <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <CalendarClock className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Timeline & Milestones</p>
                            <h3 className="text-base font-semibold text-foreground">Next Academic Events</h3>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                          {combinedAcademicEvents.length} Upcoming
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-5 space-y-3">
                      {calendarLoading ? (
                        <div className="py-10 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
                          <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                          <span>Loading upcoming academic schedule...</span>
                        </div>
                      ) : combinedAcademicEvents.length > 0 ? (
                        <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                          {combinedAcademicEvents.slice(0, 4).map((event: any, idx: number) => {
                            const eventDate = new Date(event.startDate);
                            const formattedDate = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            return (
                              <div
                                key={event.id || idx}
                                className="p-3 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors flex items-start gap-3"
                              >
                                <div className="p-2 rounded-lg bg-background border border-border/60 shrink-0 text-center min-w-[50px]">
                                  <p className="text-[10px] uppercase font-bold text-muted-foreground">
                                    {eventDate.toLocaleDateString('en-US', { month: 'short' })}
                                  </p>
                                  <p className="text-base font-extrabold text-foreground leading-none mt-0.5">
                                    {eventDate.getDate()}
                                  </p>
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <h4 className="text-xs font-bold text-foreground truncate">{event.title}</h4>
                                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 capitalize shrink-0', getEventBadgeClass(event.category))}>
                                      {event.category}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <Clock className="w-3 h-3 text-muted-foreground" />
                                    <span>{event.time || formattedDate}</span>
                                  </div>
                                  {event.description && (
                                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                                      {event.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-8 text-center space-y-2">
                          <Calendar className="w-8 h-8 text-muted-foreground/50 mx-auto" />
                          <p className="text-xs font-medium text-foreground">No Upcoming Academic Events Scheduled</p>
                          <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                            Examination notices, session commencements, and academic milestones for this session will appear here.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </div>

                  <div className="px-6 pb-4 pt-1 border-t border-border/30 text-xs text-muted-foreground flex items-center justify-between">
                    <span>Timeline updates sync with academic calendar</span>
                    {combinedAcademicEvents.some((e: any) => e.source === 'examination') ? (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs text-amber-600 hover:text-amber-700 p-0"
                        onClick={() => setActiveSection('examination-portal')}
                      >
                        Exam Portal <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </Button>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs text-muted-foreground hover:text-foreground p-0"
                        onClick={fetchAcademicEvents}
                      >
                        Refresh <RefreshCw className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </Card>

              </div>
            </CardContent>
          </Card>
        </main>
      ) : activeSection === 'e-books' ? (
        <main className="container mx-auto max-w-7xl px-4 py-8">
          <Card className="border-none shadow-xl">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>E-Books</CardTitle>
                <CardDescription>
                  {program?.name || 'Program'}{enrolledSession?.name ? ` · ${enrolledSession.name}` : ''}
                </CardDescription>
              </div>
              <Badge variant="outline">Enrolled Session</Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              {semesterList.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No semesters are available for your enrolled session.
                </p>
              ) : (
                <Tabs value={activeSemester} onValueChange={value => { setSelectedSemester(value); setSelectedEbookModuleId(null); }} className="space-y-6">
                  <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-muted p-1">
                    {enrolledSemesters.map(semester => (
                      <TabsTrigger key={semester.id} value={String(semester.semesterNumber)} className="px-3 py-1.5">
                        {semester.semesterName}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {enrolledSemesters.map(semester => {
                    const semesterModules = enrolledModules.filter(
                      module => module.semesterId === semester.id
                    );
                    return (
                      <TabsContent key={semester.id} value={String(semester.semesterNumber)} className="space-y-5 outline-none">
                        {semesterModules.length === 0 ? (
                          <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                            No modules are available for {semester.semesterName}.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {semesterModules.map((module: any) => (
                              <Button
                                key={module.id}
                                type="button"
                                variant={selectedEbookModuleId === module.id ? 'default' : 'outline'}
                                className="h-auto min-h-20 justify-start whitespace-normal p-4 text-left"
                                onClick={() => setSelectedEbookModuleId(module.id)}
                              >
                                <span className="flex flex-col items-start gap-1">
                                  <span>{module.moduleName}</span>
                                  <span className="text-xs font-normal opacity-75">{module.moduleCode}</span>
                                </span>
                              </Button>
                            ))}
                          </div>
                        )}
                        {selectedEbookModule && selectedEbookModule.semesterId === semester.id && (
                          <section className="space-y-3 border-t pt-5">
                            <h3 className="font-semibold">{selectedEbookModule.moduleName} E-Books</h3>
                            {selectedModuleEbooks.length === 0 ? (
                              <p className="py-6 text-center text-sm text-muted-foreground">
                                No E-Books have been uploaded for this module.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                {selectedModuleEbooks.map(material => (
                                  <div key={material.id} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                                    <div className="flex min-w-0 items-center gap-3">
                                      <BookOpen className="h-5 w-5 shrink-0 text-primary" />
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">{material.fileName}</p>
                                        <p className="text-xs text-muted-foreground">{material.title}</p>
                                      </div>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" onClick={() => handleDownload(material)}>
                                      <Download className="mr-2 h-4 w-4" /> Download
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </section>
                        )}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}
            </CardContent>
          </Card>
        </main>
      ) : activeSection === 'scheduled-classes' ? (
        <main className="container mx-auto max-w-5xl px-4 py-8">
          <div className="mb-6">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Calendar className="h-6 w-6 text-primary" />
              Scheduled Classes
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upcoming live classes scheduled for your enrollment.
            </p>
          </div>
          {scheduledClassesLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading scheduled classes...</p>
          ) : scheduledClasses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No upcoming classes have been scheduled for you.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {scheduledClasses.map(scheduledClass => (
                <Card key={scheduledClass.id}>
                  <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="rounded-full bg-primary/10 p-3 text-primary">
                        <Video className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold">{scheduledClass.title}</h2>
                          <Badge variant="secondary">Upcoming</Badge>
                        </div>
                        <div className="grid gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
                          <p><span className="font-medium text-foreground">Session:</span> {scheduledClass.academicSession.name}</p>
                          <p><span className="font-medium text-foreground">Program:</span> {scheduledClass.program.name}</p>
                          <p><span className="font-medium text-foreground">Semester:</span> {scheduledClass.semester.semesterName}</p>
                          <p><span className="font-medium text-foreground">Module:</span> {scheduledClass.module.moduleName}</p>
                        </div>
                        <p className="flex items-center gap-2 text-sm font-medium text-primary">
                          <Clock className="h-4 w-4" />
                          {new Date(scheduledClass.startsAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="shrink-0"
                      onClick={() => window.open(scheduledClass.meetingUrl, '_blank', 'noopener,noreferrer')}
                    >
                      Join Class
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      ) : activeSection === 'video-classes' ? (
        <main className="container mx-auto max-w-screen-2xl px-4 py-8 space-y-6">
          {/* Header Card */}
          <Card className="border shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Video className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold flex items-center gap-3">
                        Video Classes
                        <Badge variant="outline" className="font-semibold text-xs bg-primary/5 text-primary border-primary/20">
                          {allSessionVideos.length} {allSessionVideos.length === 1 ? 'Video' : 'Videos'} Available
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-sm mt-0.5">
                        {program?.name || 'Your Program'}
                        {(enrolledSession?.name || student?.activeSession?.name) ? (
                          <span className="font-medium text-foreground/80">
                            {' '}· Enrolled Session: {enrolledSession?.name || student?.activeSession?.name}
                          </span>
                        ) : null}
                      </CardDescription>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative min-w-[200px] sm:min-w-[260px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search enrolled video classes..."
                      value={videoSearchQuery}
                      onChange={(e) => setVideoSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    onClick={() => {
                      fetchVideoMaterials();
                      toast.success('Refreshing video classes...');
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Semester filter tabs/pills if multiple semesters exist */}
              {semesterFilterOptions.length > 0 && (
                <div className="flex items-center gap-2 pt-4 flex-wrap border-t mt-4">
                  <span className="text-xs font-medium text-muted-foreground mr-1">Filter by Semester:</span>
                  <Button
                    variant={videoFilterSemester === 'all' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs rounded-full px-3"
                    onClick={() => setVideoFilterSemester('all')}
                  >
                    All Semesters ({allSessionVideos.length})
                  </Button>
                  {semesterFilterOptions.map((semName) => {
                    const count = allSessionVideos.filter(v => v.semesterName === semName).length;
                    return (
                      <Button
                        key={semName}
                        variant={videoFilterSemester === semName ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs rounded-full px-3"
                        onClick={() => setVideoFilterSemester(semName)}
                      >
                        {semName} ({count})
                      </Button>
                    );
                  })}
                </div>
              )}
            </CardHeader>
          </Card>

          {/* Videos Grid / Player Layout */}
          {allSessionVideos.length === 0 ? (
            <Card className="border border-dashed py-16 text-center">
              <CardContent className="flex flex-col items-center justify-center gap-3">
                <div className="p-4 rounded-full bg-muted text-muted-foreground">
                  <Video className="h-10 w-10" />
                </div>
                <h3 className="font-semibold text-lg">No Video Classes Uploaded Yet</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  There are currently no recorded lectures or video classes available for your enrolled session in {program?.name || 'this program'}.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-2"
                  onClick={() => fetchVideoMaterials()}
                >
                  <RefreshCw className="h-4 w-4" />
                  Check for Updates
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Video Player & Active Video Information */}
              <div className="lg:col-span-8 space-y-4">
                <Card className="overflow-hidden border shadow-sm">
                  {activeVideo ? (
                    <>
                      {/* Video Player Box */}
                      <div ref={videoContainerRef} className="relative aspect-video w-full bg-black overflow-hidden group">
                        {activeVideo.embedUrl ? (
                          <iframe
                            key={activeVideo.id}
                            className="h-full w-full"
                            src={activeVideo.embedUrl}
                            title={activeVideo.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : activeVideo.videoUrl ? (
                          <video
                            key={activeVideo.id}
                            className="h-full w-full"
                            src={activeVideo.videoUrl}
                            title={activeVideo.title}
                            controls
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
                            Video source not available
                          </div>
                        )}

                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="absolute bottom-3 right-3 z-10 opacity-80 group-hover:opacity-100 transition-opacity bg-black/70 hover:bg-black text-white border-white/20"
                          aria-label={isVideoFullscreen ? 'Exit full screen' : 'View video full screen'}
                          title={isVideoFullscreen ? 'Exit full screen' : 'View video full screen'}
                          onClick={() => {
                            const container = videoContainerRef.current;
                            if (!container) return;
                            if (document.fullscreenElement === container) {
                              document.exitFullscreen().catch(() => toast.error('Unable to exit full screen'));
                              return;
                            }
                            if (!container.requestFullscreen) {
                              toast.error('Full screen is not supported by this browser');
                              return;
                            }
                            container.requestFullscreen().catch(() => toast.error('Unable to open full screen'));
                          }}
                        >
                          {isVideoFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                        </Button>
                      </div>

                      {/* Video Details */}
                      <CardContent className="p-5 space-y-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="font-semibold text-xs">
                              {activeVideo.semesterName}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {activeVideo.moduleName}
                            </Badge>
                            {activeVideo.sessionName ? (
                              <Badge variant="outline" className="text-xs bg-muted/60">
                                Session: {activeVideo.sessionName}
                              </Badge>
                            ) : null}
                          </div>

                          <h2 className="text-xl font-bold tracking-tight text-foreground">
                            {activeVideo.title}
                          </h2>

                          {activeVideo.description && (
                            <p className="text-sm text-muted-foreground whitespace-pre-line bg-muted/30 p-3.5 rounded-lg border">
                              {activeVideo.description}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </>
                  ) : (
                    <CardContent className="flex aspect-video flex-col items-center justify-center gap-3 p-8 text-center">
                      <PlayCircle className="h-12 w-12 text-muted-foreground animate-pulse" />
                      <div>
                        <p className="font-semibold text-base">Select a video to start watching</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Choose any video class from the playlist on the right.
                        </p>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>

              {/* Right Column: Playlist of Enrolled Session Videos */}
              <div className="lg:col-span-4 space-y-3">
                <Card className="border shadow-sm">
                  <CardHeader className="pb-3 border-b">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Play className="h-4 w-4 text-primary fill-primary" />
                        Session Playlist
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs font-semibold">
                        {displayedVideos.length} {displayedVideos.length === 1 ? 'class' : 'classes'}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      All video lectures for your enrolled session
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-3">
                    {displayedVideos.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        {videoSearchQuery
                          ? 'No videos match your search query.'
                          : 'No videos found in this semester.'}
                      </div>
                    ) : (
                      <div className="max-h-[640px] overflow-y-auto space-y-2 pr-1">
                        {displayedVideos.map((video, idx) => {
                          const isCurrent = activeVideo?.id === video.id;
                          return (
                            <button
                              key={video.id}
                              type="button"
                              onClick={() => setSelectedVideoMaterialId(video.id)}
                              className={cn(
                                'w-full text-left p-3 rounded-lg border transition-all duration-200 flex items-start gap-3 group',
                                isCurrent
                                  ? 'bg-primary/10 border-primary text-foreground shadow-sm ring-1 ring-primary/30'
                                  : 'bg-card hover:bg-muted/70 hover:border-muted-foreground/30 border-border text-foreground'
                              )}
                            >
                              <div
                                className={cn(
                                  'shrink-0 w-8 h-8 rounded-md flex items-center justify-center mt-0.5 transition-colors',
                                  isCurrent
                                    ? 'bg-primary text-primary-foreground font-bold'
                                    : 'bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary'
                                )}
                              >
                                {isCurrent ? (
                                  <PlayCircle className="h-4 w-4 animate-pulse" />
                                ) : (
                                  <span className="text-xs font-semibold">{idx + 1}</span>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Badge
                                    variant={isCurrent ? 'default' : 'outline'}
                                    className="text-[10px] px-1.5 py-0 h-4 font-normal"
                                  >
                                    {video.semesterName}
                                  </Badge>
                                  {isCurrent && (
                                    <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                                      Playing
                                    </span>
                                  )}
                                </div>
                                <h4
                                  className={cn(
                                    'text-sm font-semibold leading-snug line-clamp-2 transition-colors',
                                    isCurrent ? 'text-primary' : 'group-hover:text-primary'
                                  )}
                                >
                                  {video.title}
                                </h4>
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {video.moduleName}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </main>
      ) : (
      <>
      {/* Hero Welcome Section */}
      <section className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold tracking-tight">Hello {student.name}, welcome to Student Portal</h1>
        </div>
      </section>

      {/* Main Grid Content */}
      <main className="container mx-auto max-w-7xl px-4 mt-8">
        {/* Left Column: Academic & Center Details */}
        <div className="max-w-md space-y-6">
          <Card className="border-none shadow-xl bg-card/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg">Academic Profile</CardTitle>
              <CardDescription>Your registered details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <School className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Enrolled Program</p>
                  <p className="font-semibold text-sm">{program?.name || 'N/A'}</p>
                  {program?.code && (
                    <Badge variant="secondary" className="mt-1">
                      {program.code}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Active Session</p>
                  <p className="font-semibold text-sm">{enrolledSession?.name || 'Not assigned'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Study Center</p>
                  <p className="font-semibold text-sm">{student.center?.name || 'N/A'}</p>
                  {student.center?.code && (
                    <span className="text-xs text-muted-foreground mt-0.5 block">Code: {student.center.code}</span>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Enrollment No:</span>
                  <span className="font-medium">{student.enrollmentNo}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Registered Email:</span>
                  <span className="font-medium">{student.email}</span>
                </div>
                {student.phone && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Phone Number:</span>
                    <span className="font-medium">{student.phone}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Program Duration:</span>
                  <span className="font-medium">{program?.duration || 0} Years</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </main>
      </>
      )}
      <Dialog open={Boolean(selectedExamination)} onOpenChange={open => !open && setSelectedExamination(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedExamination?.examinationName || 'Examination Details'}</DialogTitle>
          </DialogHeader>
          {selectedExamination && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Examination ID</span><p className="font-medium break-all">{selectedExamination.id}</p></div>
              <div><span className="text-muted-foreground">Organization ID</span><p className="font-medium break-all">{selectedExamination.organizationId}</p></div>
              <div><span className="text-muted-foreground">Examination Type</span><p className="font-medium">{selectedExamination.examinationType}</p></div>
              <div><span className="text-muted-foreground">Status</span><p className="font-medium">{selectedExamination.status}</p></div>
              <div><span className="text-muted-foreground">Session</span><p className="font-medium">{selectedExamination.academicSession?.name}</p></div>
              <div><span className="text-muted-foreground">Program</span><p className="font-medium">{selectedExamination.program?.name}</p></div>
              <div><span className="text-muted-foreground">Semester</span><p className="font-medium">{selectedExamination.semester?.semesterName}</p></div>
              <div><span className="text-muted-foreground">Start Date</span><p className="font-medium">{new Date(selectedExamination.startDate).toLocaleDateString()}</p></div>
              <div><span className="text-muted-foreground">End Date</span><p className="font-medium">{new Date(selectedExamination.endDate).toLocaleDateString()}</p></div>
              <div className="sm:col-span-2"><span className="text-muted-foreground">Description</span><p className="font-medium">{selectedExamination.description || 'No description provided.'}</p></div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Modules</span>
                {selectedExamination.modules?.length ? (
                  <div className="mt-1 space-y-2">
                    {selectedExamination.modules.map((module: any) => (
                      <div key={module.id} className="rounded-md border p-3">
                        <p className="font-medium">{module.moduleName}</p>
                        <p className="text-xs text-muted-foreground">{module.moduleCode} · {module.moduleType}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-muted-foreground">No modules assigned.</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Schedule</span>
                {Array.isArray(selectedExamination.schedule) && selectedExamination.schedule.length > 0 ? (
                  <div className="mt-1 space-y-2">
                    {selectedExamination.schedule.map((item: any, index: number) => {
                      const module = selectedExamination.modules?.find((entry: any) => entry.id === item.moduleId);
                      return (
                        <div key={`${item.moduleId || 'schedule'}-${index}`} className="rounded-md border p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div><span className="text-xs text-muted-foreground">Module</span><p className="font-medium">{module?.moduleName || item.moduleId || 'Not assigned'}</p></div>
                          <div><span className="text-xs text-muted-foreground">Date</span><p className="font-medium">{item.date ? new Date(item.date).toLocaleDateString() : 'Not set'}</p></div>
                          <div><span className="text-xs text-muted-foreground">Time</span><p className="font-medium">{item.startTime || 'Not set'} - {item.endTime || 'Not set'}</p></div>
                          <div><span className="text-xs text-muted-foreground">Maximum Marks</span><p className="font-medium">{item.maxMarks ?? 'Not set'}</p></div>
                          <div><span className="text-xs text-muted-foreground">Passing Marks</span><p className="font-medium">{item.passingMarks ?? 'Not set'}</p></div>
                          <div><span className="text-xs text-muted-foreground">Duration</span><p className="font-medium">{item.examDuration ? `${item.examDuration} minutes` : 'Not set'}</p></div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-1 text-muted-foreground">No schedule assigned.</p>
                )}
              </div>
              <div><span className="text-muted-foreground">Created At</span><p className="font-medium">{new Date(selectedExamination.createdAt).toLocaleString()}</p></div>
              <div><span className="text-muted-foreground">Updated At</span><p className="font-medium">{new Date(selectedExamination.updatedAt).toLocaleString()}</p></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={registrationOpen} onOpenChange={setRegistrationOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Examination Registration</DialogTitle>
            <DialogDescription>Verify the examination details and complete the required student fields.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitRegistration}>
            {registrationExamination && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <h3 className="font-semibold">Examination Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Examination Name</span><p className="font-medium">{registrationExamination.examinationName}</p></div>
                  <div><span className="text-muted-foreground">Examination Type</span><p className="font-medium">{registrationExamination.examinationType}</p></div>
                  <div><span className="text-muted-foreground">Session</span><p className="font-medium">{registrationExamination.academicSession?.name}</p></div>
                  <div><span className="text-muted-foreground">Program</span><p className="font-medium">{registrationExamination.program?.name}</p></div>
                  <div><span className="text-muted-foreground">Semester</span><p className="font-medium">{registrationExamination.semester?.semesterName}</p></div>
                  <div><span className="text-muted-foreground">Status</span><p className="font-medium">{registrationExamination.status}</p></div>
                  <div><span className="text-muted-foreground">Start Date</span><p className="font-medium">{new Date(registrationExamination.startDate).toLocaleDateString()}</p></div>
                  <div><span className="text-muted-foreground">End Date</span><p className="font-medium">{new Date(registrationExamination.endDate).toLocaleDateString()}</p></div>
                </div>
                {registrationExamination.description && (
                  <div className="text-sm"><span className="text-muted-foreground">Description</span><p className="font-medium">{registrationExamination.description}</p></div>
                )}
                {registrationExamination.modules?.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Modules</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {registrationExamination.modules.map((module: any) => (
                        <Badge key={module.id} variant="outline">{module.moduleCode} - {module.moduleName} ({module.moduleType})</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {registrationExamination.schedule?.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Schedule</span>
                    <div className="mt-1 space-y-2">
                      {registrationExamination.schedule.map((item: any, index: number) => {
                        const module = registrationExamination.modules?.find((entry: any) => entry.id === item.moduleId);
                        return (
                          <div key={`${item.moduleId || 'schedule'}-${index}`} className="rounded-md border p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <span>Module: <strong>{module?.moduleName || item.moduleId || 'Not assigned'}</strong></span>
                            <span>Date: <strong>{item.date ? new Date(item.date).toLocaleDateString() : 'Not set'}</strong></span>
                            <span>Time: <strong>{item.startTime || 'Not set'} - {item.endTime || 'Not set'}</strong></span>
                            <span>Maximum Marks: <strong>{item.maxMarks ?? 'Not set'}</strong></span>
                            <span>Passing Marks: <strong>{item.passingMarks ?? 'Not set'}</strong></span>
                            <span>Duration: <strong>{item.examDuration ? `${item.examDuration} minutes` : 'Not set'}</strong></span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Student Details</h3>
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration-full-name">Full Name *</Label>
              <Input
                id="registration-full-name"
                value={registrationForm.fullName}
                onChange={event => setRegistrationForm({ ...registrationForm, fullName: event.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration-enrollment-no">Enrollment Number *</Label>
              <Input
                id="registration-enrollment-no"
                value={registrationForm.enrollmentNo}
                onChange={event => setRegistrationForm({ ...registrationForm, enrollmentNo: event.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration-email">Email *</Label>
              <Input
                id="registration-email"
                type="email"
                value={registrationForm.email}
                onChange={event => setRegistrationForm({ ...registrationForm, email: event.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration-phone">Phone Number *</Label>
              <Input
                id="registration-phone"
                type="tel"
                value={registrationForm.phone}
                onChange={event => setRegistrationForm({ ...registrationForm, phone: event.target.value })}
                required
              />
            </div>
            <label className="flex items-start gap-2 text-sm border-t pt-4">
              <input
                type="checkbox"
                checked={registrationConfirmed}
                onChange={event => setRegistrationConfirmed(event.target.checked)}
                required
                className="mt-1"
              />
              <span>I confirm that the examination details shown above are correct.</span>
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRegistrationOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!registrationConfirmed}>Register</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <InvoicePrintModal
        open={Boolean(selectedStudentInvoiceForPrint)}
        onOpenChange={(open) => {
          if (!open) setSelectedStudentInvoiceForPrint(null);
        }}
        invoice={selectedStudentInvoiceForPrint}
      />
        </div>
      </div>
    </div>
  );
}
