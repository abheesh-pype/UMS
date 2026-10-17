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
  Minimize
} from 'lucide-react';
import { toast } from 'sonner';

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
  const enrolledSemesters = (program?.semesterRecords || [])
    .filter((semester: any) => semester.academicSessionId === enrolledSessionId)
    .sort((a, b) => a.semesterNumber - b.semesterNumber);
  const semesterList = enrolledSemesters.map((semester: any) => String(semester.semesterNumber));
  const activeSemester = semesterList.includes(selectedSemester) ? selectedSemester : semesterList[0];
  const enrolledModules = (program?.modules || []).filter(
    (module: any) => module.academicSessionId === enrolledSessionId
  );
  const getVideoMetadata = (material: { category: string; description?: string | null }) => {
    if (material.category === 'video_class') {
      try {
        const metadata = JSON.parse(material.description || '{}');
        return {
          moduleId: metadata.moduleId || '',
          sessionId: metadata.sessionId || '',
        };
      } catch {
        return { moduleId: '', sessionId: '' };
      }
    }
    return {
      moduleId: material.description?.match(/^Module: ([\w-]+) - /)?.[1] || '',
      sessionId: '',
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
  const getVideosForModule = (module: { id: string }) => materials.filter(material => {
    if (material.category !== 'video_class' && material.category !== 'video') return false;
    const metadata = getVideoMetadata(material);
    return metadata.moduleId === module.id
      && (!metadata.sessionId || metadata.sessionId === enrolledSessionId);
  });
  const videoApiBase = import.meta.env.VITE_API_URL || '/api/v1';
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
                      <h3 className="font-semibold">Invoices</h3>
                      <div className="space-y-2">
                        {studentPaymentInfo.invoices.map((invoice: any) => (
                          <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                            <div>
                              <p className="font-medium">{invoice.invoiceNo}</p>
                              {invoice.dueDate && <p className="text-xs text-muted-foreground">Due {new Date(invoice.dueDate).toLocaleDateString()}</p>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-medium">{formatPaymentAmount(invoice.amount)}</span>
                              <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>{invoice.status}</Badge>
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
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Active Session</CardTitle>
              <CardDescription>Your admission session from the enrolled student record.</CardDescription>
            </CardHeader>
            <CardContent>
              {enrolledSession ? (
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="font-semibold">{enrolledSession.name}</p>
                  {enrolledSession.startDate && enrolledSession.endDate && (
                    <p className="text-sm text-muted-foreground">
                      {new Date(enrolledSession.startDate).toLocaleDateString()} - {new Date(enrolledSession.endDate).toLocaleDateString()}
                    </p>
                  )}
                  {enrolledSession.status && <Badge variant="outline">{enrolledSession.status}</Badge>}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No active admission session is assigned.</p>
              )}
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
        <main className="container mx-auto max-w-screen-2xl px-4 py-10">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                Video Classes
              </CardTitle>
              <CardDescription>
                {program?.name || 'Your program'} · {enrolledSession?.name || 'Current session'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {semesterList.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No semesters are available for your enrolled session.
                </p>
              ) : (
                <Tabs
                  value={activeSemester}
                  onValueChange={value => {
                    setSelectedSemester(value);
                    setSelectedVideoClassId(null);
                    setSelectedVideoMaterialId(null);
                  }}
                  className="space-y-5"
                >
                  <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-muted p-1">
                    {enrolledSemesters.map((semester: any) => (
                      <TabsTrigger key={semester.id} value={String(semester.semesterNumber)} className="px-4 py-2">
                        {semester.semesterName}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {enrolledSemesters.map((semester: any) => {
                    const semesterModules = enrolledModules.filter(
                      (module: any) => module.semesterId === semester.id
                    );
                    const semesterVideos = semesterModules.flatMap(module =>
                      getVideosForModule(module).map(material => ({ module, material }))
                    );
                    const selectedSemesterVideo = semesterVideos.find(
                      ({ material }) => material.id === selectedVideoMaterialId
                    );
                    const selectedVideoUrl = selectedSemesterVideo
                      ? selectedSemesterVideo.material.fileUrl.startsWith('http')
                        ? selectedSemesterVideo.material.fileUrl
                        : `${videoApiBase.replace('/api/v1', '')}${selectedSemesterVideo.material.fileUrl}`
                      : '';
                    const selectedVideoEmbedUrl = selectedVideoUrl ? getYouTubeEmbedUrl(selectedVideoUrl) : '';
                    return (
                      <TabsContent key={semester.id} value={String(semester.semesterNumber)} className="outline-none">
                        {semesterModules.length === 0 ? (
                          <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                            No modules are available for {semester.semesterName}.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
                            <Card className="min-w-0 overflow-hidden">
                              {selectedSemesterVideo ? (
                                <>
                                  <CardHeader>
                                    <CardTitle className="truncate">
                                      {selectedSemesterVideo.material.title || selectedSemesterVideo.material.fileName}
                                    </CardTitle>
                                    <CardDescription>
                                      {selectedSemesterVideo.module.moduleName}
                                      {selectedSemesterVideo.module.moduleCode ? ` · ${selectedSemesterVideo.module.moduleCode}` : ''}
                                    </CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                    <div ref={videoContainerRef} className="relative aspect-video overflow-hidden rounded-lg border bg-black">
                                      {selectedVideoEmbedUrl ? (
                                        <iframe
                                          key={selectedSemesterVideo.material.id}
                                          className="h-full w-full"
                                          src={selectedVideoEmbedUrl}
                                          title={selectedSemesterVideo.material.title || selectedSemesterVideo.material.fileName}
                                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                          allowFullScreen
                                        />
                                      ) : (
                                        <video
                                          key={selectedSemesterVideo.material.id}
                                          className="h-full w-full"
                                          src={selectedVideoUrl}
                                          title={selectedSemesterVideo.material.title || selectedSemesterVideo.material.fileName}
                                          controls
                                          playsInline
                                          preload="metadata"
                                        />
                                      )}
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="secondary"
                                        className="absolute bottom-3 right-3 z-10"
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
                                  </CardContent>
                                </>
                              ) : (
                                <CardContent className="flex aspect-video flex-col items-center justify-center gap-3 p-8 text-center">
                                  <Video className="h-10 w-10 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium">Choose a video to start watching</p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      Select a class from {semester.semesterName} on the right.
                                    </p>
                                  </div>
                                </CardContent>
                              )}
                            </Card>
                            <Card className="min-w-0 lg:sticky lg:top-20">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">Upcoming videos</CardTitle>
                                <CardDescription>{program?.name || 'Your program'} · {semester.semesterName}</CardDescription>
                              </CardHeader>
                              <CardContent className="max-h-[78vh] overflow-y-auto pt-0">
                                <Accordion
                                  type="single"
                                  collapsible
                                  value={selectedVideoClassId || ''}
                                  onValueChange={value => {
                                    setSelectedVideoClassId(value || null);
                                    setSelectedVideoMaterialId(null);
                                  }}
                                  className="divide-y"
                                >
                                  {semesterModules.map(module => {
                                    const moduleVideos = getVideosForModule(module);
                                    return (
                                      <AccordionItem key={module.id} value={module.id}>
                                        <AccordionTrigger className="gap-2 py-3 text-left hover:no-underline">
                                          <span className="min-w-0 flex-1">
                                            <span className="block truncate font-medium">{module.moduleName}</span>
                                            <span className="mt-1 block text-xs font-normal text-muted-foreground">
                                              {module.moduleCode}{module.moduleType ? ` · ${module.moduleType}` : ''}
                                            </span>
                                          </span>
                                          <Badge variant="secondary" className="shrink-0">
                                            {moduleVideos.length}
                                          </Badge>
                                        </AccordionTrigger>
                                        <AccordionContent className="space-y-2 pb-3">
                                          {moduleVideos.length === 0 ? (
                                            <p className="px-2 py-2 text-xs text-muted-foreground">
                                              No videos uploaded for this module yet.
                                            </p>
                                          ) : moduleVideos.map(material => (
                                            <Button
                                              key={material.id}
                                              type="button"
                                              variant={selectedVideoMaterialId === material.id ? 'default' : 'ghost'}
                                              className="h-auto w-full justify-start whitespace-normal px-2 py-2 text-left"
                                              onClick={() => setSelectedVideoMaterialId(material.id)}
                                            >
                                              <Video className="mr-2 h-4 w-4 shrink-0" />
                                              <span className="line-clamp-2">
                                                {material.title || material.fileName}
                                              </span>
                                            </Button>
                                          ))}
                                        </AccordionContent>
                                      </AccordionItem>
                                    );
                                  })}
                                </Accordion>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}
            </CardContent>
          </Card>
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
        </div>
      </div>
    </div>
  );
}
