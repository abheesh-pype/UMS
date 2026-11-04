import type { ComponentType, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Award,
  Bell,
  BookOpen,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  GraduationCap,
  MapPin,
  School,
  UserRound,
  Video,
} from 'lucide-react';

type IconType = ComponentType<{ className?: string }>;

// Loading and failed figures are labelled as such, so nothing is ever shown as a false zero.
interface Figure {
  loading: boolean;
  failed: boolean;
  text: string;
  detail: string;
}

interface StudentDashboardOverviewProps {
  student: any;
  program: any;
  session: any;
  semesters: any[];
  modules: any[];
  videoCount: number;
  ebookCount: number;
  fees: Figure;
  examinations: Figure;
  classes: Figure;
  results: Figure;
  outstandingAmount: number;
  formatAmount: (value: number) => string;
  exams: any[];
  scheduledClasses: any[];
  unreadNotifications: number;
  upcomingEvents: any[];
  onNavigate: (table: string) => void;
}

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : '');
const titleCase = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());

function DetailList({ title, icon: Icon, rows }: { title: string; icon: IconType; rows: [string, ReactNode][] }) {
  const filled = rows.filter(([, value]) => value !== null && value !== undefined && value !== '');
  return (
    <section className="min-w-0 space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h3>
      {filled.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not provided.</p>
      ) : (
        <dl className="space-y-2.5">
          {filled.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5 border-b pb-2.5 last:border-0 last:pb-0 sm:flex-row sm:justify-between sm:gap-4">
              <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-words text-sm font-medium sm:text-right">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function StatTile({ title, icon: Icon, figure, action, onAction }: {
  title: string;
  icon: IconType;
  figure: Figure;
  action: string;
  onAction: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-2xl font-bold">{figure.loading ? '…' : figure.failed ? 'Unavailable' : figure.text}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {figure.loading ? 'Loading' : figure.failed ? 'Could not load this right now' : figure.detail}
          </p>
        </div>
        <Button variant="outline" size="sm" className="w-full justify-between" onClick={onAction}>
          {action}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function StudentDashboardOverview({
  student,
  program,
  session,
  semesters,
  modules,
  videoCount,
  ebookCount,
  fees,
  examinations,
  classes,
  results,
  outstandingAmount,
  formatAmount,
  exams,
  scheduledClasses,
  unreadNotifications,
  upcomingEvents,
  onNavigate,
}: StudentDashboardOverviewProps) {
  const center = student.center;
  const centerLocation = [center?.city, center?.state].filter(Boolean).join(', ');
  const initials = String(student.name || '?').trim().split(/\s+/).slice(0, 2).map((part: string) => part[0]?.toUpperCase()).join('');

  // Next steps come only from the student's real pending items
  const nextClass = scheduledClasses[0];
  const examsToWrite = exams.filter(exam => exam.readyToLaunch);
  const examsToRegister = exams.filter(exam => !exam.readyToLaunch && !exam.registered);
  const steps: { key: string; icon: IconType; title: string; detail: string; action: string; onClick: () => void }[] = [];
  if (!fees.loading && !fees.failed && outstandingAmount > 0) {
    steps.push({
      key: 'fees', icon: CreditCard, title: 'Clear your outstanding fees', detail: `${formatAmount(outstandingAmount)} is pending on your invoices.`,
      action: 'View Payments', onClick: () => onNavigate('student-payment-info'),
    });
  }
  if (examsToWrite.length > 0) {
    steps.push({
      key: 'exam-write', icon: GraduationCap, title: 'Write your examination', detail: `${examsToWrite[0].examinationName}${examsToWrite.length > 1 ? ` and ${examsToWrite.length - 1} more` : ''} ready to write.`,
      action: 'Open Exam Portal', onClick: () => onNavigate('student-examination-portal'),
    });
  }
  if (examsToRegister.length > 0) {
    steps.push({
      key: 'exam-register', icon: FileText, title: 'Register for your examination', detail: 'Open the examination notification to complete your registration.',
      action: 'Go to Notifications', onClick: () => onNavigate('student-notifications'),
    });
  }
  if (nextClass) {
    steps.push({
      key: 'class', icon: Video, title: 'Attend your next live class', detail: `${nextClass.title} on ${new Date(nextClass.startsAt).toLocaleString()}.`,
      action: 'View Classes', onClick: () => onNavigate('student-scheduled-classes'),
    });
  }
  if (unreadNotifications > 0) {
    steps.push({
      key: 'notifications', icon: Bell, title: 'Read your notifications', detail: `You have ${unreadNotifications} unread notification${unreadNotifications === 1 ? '' : 's'}.`,
      action: 'Open Notifications', onClick: () => onNavigate('student-notifications'),
    });
  }
  const stillLoading = fees.loading || examinations.loading || classes.loading;

  const eventTarget = (source: string) => (
    source === 'examination' ? 'student-examination-portal' : source === 'class' ? 'student-scheduled-classes' : 'student-academic-calendar'
  );

  const quickLinks: { label: string; detail: string; icon: IconType; table: string }[] = [
    { label: 'Active Sessions', detail: session?.name || 'Your session', icon: CalendarCheck, table: 'student-active-session' },
    { label: 'Video Classes', detail: `${videoCount} available`, icon: Video, table: 'student-video-classes' },
    { label: 'E-Books', detail: `${ebookCount} available`, icon: BookOpen, table: 'student-e-books' },
    { label: 'Academic Calendar', detail: 'Dates and events', icon: Calendar, table: 'student-academic-calendar' },
    { label: 'Results', detail: 'Published marks', icon: Award, table: 'student-result' },
    { label: 'Documents', detail: 'Your enrollment files', icon: FileText, table: 'student-documents' },
  ];

  return (
    <main className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary" aria-hidden="true">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Hello {student.name}, welcome to Student Portal</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {student.status && <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>{titleCase(student.status)}</Badge>}
              <span>Enrollment No: <span className="font-medium text-foreground">{student.enrollmentNo}</span></span>
              {program?.name && <span>· {program.name}</span>}
              {session?.name && <span>· {session.name}</span>}
            </div>
          </div>
          {steps[0] && (
            <Button className="shrink-0" onClick={steps[0].onClick}>
              {steps[0].action}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile title="Fees outstanding" icon={CreditCard} figure={fees} action="View Payments" onAction={() => onNavigate('student-payment-info')} />
        <StatTile title="Examinations" icon={GraduationCap} figure={examinations} action="Open Exam Portal" onAction={() => onNavigate('student-examination-portal')} />
        <StatTile title="Live classes" icon={Video} figure={classes} action="View Classes" onAction={() => onNavigate('student-scheduled-classes')} />
        <StatTile title="Results" icon={Award} figure={results} action="View Results" onAction={() => onNavigate('student-result')} />
      </div>

      <Card>
        <CardHeader className="pt-6">
          <CardTitle className="text-lg">Student Details</CardTitle>
          <CardDescription>Your registered details</CardDescription>
        </CardHeader>
        <CardContent className="pb-6">
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            <DetailList
              title="Academic"
              icon={School}
              rows={[
                ['Enrolled Program', program?.name],
                ['Program Code', program?.code],
                ['University', program?.university?.name],
                ['Specialisation', student.specialisation],
                ['Active Session', session?.name || 'Not assigned'],
                ['Program Duration', program?.duration ? `${program.duration} Years` : ''],
                ['Enrollment No', student.enrollmentNo],
                ['University Enrollment No', student.uniEnrollmentNumber],
                ['ABC ID', student.abcId],
                ['DEB ID', student.debId],
                ['Enrolled On', formatDate(student.enrolledAt || student.joinDate)],
              ]}
            />
            <DetailList
              title="Personal & Contact"
              icon={UserRound}
              rows={[
                ['Name', student.name],
                ['Registered Email', student.email],
                ['Phone Number', student.phone],
                ['Alternative Phone', student.alternativePhone],
                ["Father's Name", student.fatherName],
                ["Mother's Name", student.motherName],
                ['Parent Mobile', student.parentMobile],
                ['Address', student.address],
                ['Pincode', student.pincode],
              ]}
            />
            <DetailList
              title="Study Center"
              icon={MapPin}
              rows={center ? [
                ['Name', center.name],
                ['Code', center.code],
                ['Location', centerLocation],
                ['Address', center.address],
                ['Contact', center.contact],
                ['Email', center.email],
              ] : [['Study Center', 'Direct admission']]}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="pt-6">
            <CardTitle className="text-lg">What to do next</CardTitle>
            <CardDescription>Pending items on your account</CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            {steps.length > 0 ? (
              <ul className="divide-y">
                {steps.map(step => (
                  <li key={step.key} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <step.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{step.title}</p>
                        <p className="break-words text-xs text-muted-foreground">{step.detail}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0" onClick={step.onClick}>{step.action}</Button>
                  </li>
                ))}
              </ul>
            ) : stillLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Checking your pending items...</p>
            ) : (
              <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                You have nothing pending right now.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pt-6">
            <CardTitle className="text-lg">Upcoming</CardTitle>
            <CardDescription>Classes, examinations and calendar events</CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            {upcomingEvents.length > 0 ? (
              <ul className="divide-y">
                {upcomingEvents.map(event => (
                  <li key={`${event.source}-${event.id}`} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{event.category} · {formatDate(event.startDate)}{event.time ? ` · ${event.time}` : ''}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="shrink-0 self-start sm:self-auto" onClick={() => onNavigate(eventTarget(event.source))}>
                      View
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing is scheduled yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pt-6">
            <CardTitle className="text-lg">Program Structure</CardTitle>
            <CardDescription>{semesters.length} semester{semesters.length === 1 ? '' : 's'} · {modules.length} module{modules.length === 1 ? '' : 's'}</CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            {semesters.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Semester</th>
                      <th className="px-4 py-2.5 text-right font-medium">Modules</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {semesters.map(semester => (
                      <tr key={semester.id}>
                        <td className="px-4 py-2.5">{semester.semesterName || `Semester ${semester.semesterNumber}`}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{modules.filter(module => module.semester?.id === semester.id).length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">Your program structure has not been published yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pt-6">
            <CardTitle className="text-lg">Quick Access</CardTitle>
            <CardDescription>Go to your study material and records</CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {quickLinks.map(link => (
                <button
                  key={link.table}
                  type="button"
                  onClick={() => onNavigate(link.table)}
                  className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <link.icon className="h-5 w-5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{link.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{link.detail}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
