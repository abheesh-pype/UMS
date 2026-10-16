import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BookOpen, 
  Download, 
  FileText, 
  ClipboardList, 
  LogOut, 
  MapPin, 
  School,
  FileDown,
  Maximize,
  Minimize
} from 'lucide-react';
import { toast } from 'sonner';

const readStudentExamPortals = () => {
  try {
    const createdPortals = JSON.parse(localStorage.getItem('academic-created-exam-portals') || '{}');
    const portals = Object.values(createdPortals).filter((portal: any) => portal.isOpen !== false);
    if (portals.length > 0) return portals;
    const activePortal = JSON.parse(localStorage.getItem('active-student-exam-portal') || 'null');
    return activePortal && activePortal.isOpen !== false ? [activePortal] : [];
  } catch {
    return [];
  }
};

const studentVideoClasses = [
  { number: 1, section: 'Introduction' },
  { number: 2, section: 'Fundamentals' },
  { number: 3, section: 'Core Concepts' },
  { number: 4, section: 'Key Principles' },
  { number: 5, section: 'Methods and Applications' },
  { number: 6, section: 'Worked Examples' },
  { number: 7, section: 'Practice and Review' },
  { number: 8, section: 'Advanced Topics' },
  { number: 9, section: 'Summary and Further Study' },
];

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
  const [selectedSemester, setSelectedSemester] = useState<string>('1');
  const [selectedVideoClass, setSelectedVideoClass] = useState(studentVideoClasses[0]);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [activeSection, setActiveSection] = useState<'portal' | 'notifications' | 'active-session' | 'examination-portal' | 'video-classes'>(
    initialTab === 'notifications' || initialTab === 'active-session' || initialTab === 'examination-portal' || initialTab === 'video-classes'
      ? initialTab
      : 'portal'
  );
  const [selectedExamination, setSelectedExamination] = useState<any>(null);
  const [examinationLoadingId, setExaminationLoadingId] = useState<string | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [registrationExamination, setRegistrationExamination] = useState<any>(null);
  const [registeredExaminationIds, setRegisteredExaminationIds] = useState<string[]>([]);
  const [studentExamPortals, setStudentExamPortals] = useState<any[]>(readStudentExamPortals);
  const [registrationForm, setRegistrationForm] = useState({
    fullName: '',
    enrollmentNo: '',
    email: '',
    phone: '',
  });
  const [registrationConfirmed, setRegistrationConfirmed] = useState(false);

  useEffect(() => {
    setActiveSection(
      initialTab === 'notifications' || initialTab === 'active-session' || initialTab === 'examination-portal' || initialTab === 'video-classes'
        ? initialTab
        : 'portal'
    );
  }, [initialTab]);

  useEffect(() => {
    fetchStudentData();
  }, []);

  useEffect(() => {
    const updateFullscreenState = () => {
      setIsVideoFullscreen(document.fullscreenElement === videoContainerRef.current);
    };
    document.addEventListener('fullscreenchange', updateFullscreenState);
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState);
  }, []);

  useEffect(() => {
    const refreshExamPortal = () => {
      setStudentExamPortals(readStudentExamPortals());
    };
    window.addEventListener('storage', refreshExamPortal);
    return () => window.removeEventListener('storage', refreshExamPortal);
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
  const totalSemesters = program?.duration ? program.duration * 2 : 1;
  const semesterList = Array.from({ length: totalSemesters }, (_, i) => (i + 1).toString());

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'syllabus':
        return <FileText className="w-5 h-5 text-indigo-500" />;
      case 'question_paper':
        return <ClipboardList className="w-5 h-5 text-amber-500" />;
      default:
        return <BookOpen className="w-5 h-5 text-emerald-500" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'syllabus':
        return 'Syllabus';
      case 'question_paper':
        return 'Question Paper';
      default:
        return 'Study Material';
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <div className="flex">
        <div className="flex-1 min-w-0">
        {activeSection === 'notifications' ? (
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
              <CardDescription>Access your examination portal.</CardDescription>
            </CardHeader>
            <CardContent>
              {studentExamPortals.length > 0 ? (
                <div className="space-y-4">
                  {studentExamPortals.map((portal: any) => (
                    <div key={portal.examinationId || portal.code} className="rounded-lg border p-4 space-y-4">
                      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                        <div><span className="text-muted-foreground">Examination</span><p className="font-medium">{portal.examinationName}</p></div>
                        <div><span className="text-muted-foreground">Type</span><p className="font-medium">{portal.examinationType}</p></div>
                        <div><span className="text-muted-foreground">Program</span><p className="font-medium">{portal.programName}</p></div>
                        <div><span className="text-muted-foreground">Date</span><p className="font-medium">{portal.examDate}</p></div>
                        <div><span className="text-muted-foreground">Session</span><p className="font-medium">{portal.examSession}</p></div>
                        <div><span className="text-muted-foreground">Time</span><p className="font-medium">{portal.examTime}</p></div>
                        <div><span className="text-muted-foreground">Exam Code</span><p className="font-medium font-mono">{portal.code}</p></div>
                      </div>
                      <Button onClick={() => toast.info('Open Portal is not available yet.')}>Open Portal</Button>
                    </div>
                  ))}
                </div>
              ) : <p className="py-8 text-center text-sm text-muted-foreground">No examination portal has been opened yet.</p>}
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
              {student.activeSession ? (
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="font-semibold">{student.activeSession.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(student.activeSession.startDate).toLocaleDateString()} - {new Date(student.activeSession.endDate).toLocaleDateString()}
                  </p>
                  <Badge variant="outline">{student.activeSession.status}</Badge>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">No active admission session is assigned.</p>
              )}
            </CardContent>
          </Card>
        </main>
      ) : activeSection === 'video-classes' ? (
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Class {selectedVideoClass.number}: {selectedVideoClass.section}</CardTitle>
                  <CardDescription>Watch the selected class video.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div ref={videoContainerRef} className="relative aspect-video overflow-hidden rounded-lg border bg-black">
                    <iframe
                      key={selectedVideoClass.number}
                      className="h-full w-full"
                      src="https://www.youtube.com/embed/NRk4fzgsmEQ?controls=0&rel=0&modestbranding=1"
                      title={`Class ${selectedVideoClass.number}: ${selectedVideoClass.section}`}
                      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="absolute bottom-3 right-3 z-10"
                      aria-label={isVideoFullscreen ? 'Exit full screen' : 'View video full screen'}
                      title={isVideoFullscreen ? 'Exit full screen' : 'View full screen'}
                      onClick={() => {
                        const container = videoContainerRef.current;
                        if (!container) return;
                        if (document.fullscreenElement === container) {
                          document.exitFullscreen().catch(() => {
                            toast.error('Unable to exit full screen');
                          });
                          return;
                        }
                        if (!container.requestFullscreen) {
                          toast.error('Full screen is not supported by this browser');
                          return;
                        }
                        container.requestFullscreen().catch(() => {
                          toast.error('Unable to open full screen');
                        });
                      }}
                    >
                      {isVideoFullscreen
                        ? <Minimize className="h-4 w-4" />
                        : <Maximize className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                  <CardDescription>Notes for the selected class.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="min-h-32 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                    No notes available.
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card className="h-fit lg:sticky lg:top-20">
              <CardHeader>
                <CardTitle>Classes</CardTitle>
                <CardDescription>Class number and section</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {studentVideoClasses.map(videoClass => (
                  <Button
                    key={videoClass.number}
                    type="button"
                    variant={selectedVideoClass.number === videoClass.number ? 'default' : 'outline'}
                    className="h-auto w-full justify-start py-3 text-left"
                    onClick={() => setSelectedVideoClass(videoClass)}
                  >
                    <span className="flex flex-col items-start gap-1">
                      <span>Class {videoClass.number}</span>
                      <span className="text-xs font-normal opacity-80">{videoClass.section}</span>
                    </span>
                  </Button>
                ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      ) : (
      <>
      {/* Hero Welcome Section */}
      <section className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {student.name}!</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Access your academic resources, syllabus, and study materials here.
          </p>
        </div>
      </section>

      {/* Main Grid Content */}
      <main className="container mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Academic & Center Details */}
        <div className="space-y-6">
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

        {/* Right Column: Semesters & Materials */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-xl">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Study Materials</CardTitle>
                <CardDescription>Select a semester to download files</CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 self-start sm:self-center">
                Active Session
              </Badge>
            </CardHeader>
            <CardContent>
              {totalSemesters > 0 ? (
                <Tabs value={selectedSemester} onValueChange={setSelectedSemester} className="space-y-6">
                  <TabsList className="flex flex-wrap gap-1 bg-muted p-1 h-auto justify-start">
                    {semesterList.map((sem) => (
                      <TabsTrigger key={sem} value={sem} className="py-1.5 px-3">
                        Semester {sem}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {semesterList.map((sem) => {
                    const filteredMaterials = materials.filter(
                      (m) => m.semesterNumber === sem
                    );

                    return (
                      <TabsContent key={sem} value={sem} className="space-y-4 outline-none">
                        {filteredMaterials.length === 0 ? (
                          <div className="text-center py-12 border border-dashed rounded-xl bg-muted/10">
                            <FileDown className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="font-semibold text-muted-foreground">No Materials Available</p>
                            <p className="text-xs text-muted-foreground/80 mt-1 max-w-sm mx-auto">
                              No study materials, syllabus, or question papers have been uploaded for Semester {sem} yet.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredMaterials.map((m) => (
                              <div
                                key={m.id}
                                className="flex items-start justify-between p-4 border rounded-xl hover:bg-muted/30 transition-all duration-200 group"
                              >
                                <div className="flex gap-3">
                                  <div className="p-2.5 rounded-lg bg-background border mt-0.5">
                                    {getCategoryIcon(m.category)}
                                  </div>
                                  <div className="space-y-1">
                                    <h4 className="font-semibold text-sm line-clamp-1 leading-snug">
                                      {m.title}
                                    </h4>
                                    {m.description && (
                                      <p className="text-xs text-muted-foreground line-clamp-1">
                                        {m.description}
                                      </p>
                                    )}
                                    <div className="flex flex-wrap gap-2 pt-1.5">
                                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                                        {getCategoryLabel(m.category)}
                                      </Badge>
                                      {m.uploader?.name && (
                                        <span className="text-[10px] text-muted-foreground">
                                          By {m.uploader.name}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDownload(m)}
                                  className="rounded-full opacity-60 hover:opacity-100 group-hover:bg-primary/10 group-hover:text-primary transition-all shrink-0"
                                  title="Download File"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground text-sm">No semesters found in your program structure.</p>
                </div>
              )}
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
