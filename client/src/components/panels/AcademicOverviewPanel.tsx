import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Layers,
  ListTree,
  UserCheck,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  BarListCard,
  ChartTooltip,
  countBy,
  figure,
  OverviewMetric,
  OverviewTile,
  PriorityActions,
  StatusStat,
  useOverviewData,
} from '@/components/panels/SalesOverviewCharts';

type Navigate = (tab: string) => void;

const SERIES = [
  { key: 'ebooks', label: 'E-Books', color: 'var(--viz-series-1)' },
  { key: 'videos', label: 'Video classes', color: 'var(--viz-series-2)' },
] as const;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
};

function ContentChart({ sessions, ebooks, videos, onNavigate }: {
  sessions: any[] | null | undefined;
  ebooks: any[] | null | undefined;
  videos: any[] | null | undefined;
  onNavigate: Navigate;
}) {
  const loading = sessions === undefined || ebooks === undefined || videos === undefined;
  const failed = sessions === null || (ebooks === null && videos === null);
  const rows = [...(sessions || [])]
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, 6)
    .reverse()
    .map(session => ({
      label: session.name,
      ebooks: (ebooks || []).filter(item => item.session?.id === session.id).length,
      videos: (videos || []).filter(item => item.sessionId === session.id).length,
    }));
  const hasData = rows.some(row => row.ebooks > 0 || row.videos > 0);

  return (
    <Card
      className="cursor-pointer border-none bg-card/60 shadow-xl backdrop-blur-xl transition-colors hover:border-primary/30 lg:col-span-2"
      onClick={() => onNavigate('academic-ebooks')}
    >
      <CardHeader>
        <CardTitle>Content Overview</CardTitle>
        <CardDescription>E-Books and video classes in the latest 6 academic sessions — click to manage E-Books</CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        {loading ? (
          <div className="h-[280px] animate-pulse rounded-lg bg-muted" aria-label="Loading content" />
        ) : failed ? (
          <p className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">Could not load this chart.</p>
        ) : !hasData ? (
          <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <BarChart3 className="h-10 w-10 opacity-20" />
            <p className="text-sm">No study content in these sessions yet</p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-4">
              {SERIES.map(series => (
                <span key={series.key} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.color }} />
                  {series.label}
                </span>
              ))}
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} barGap={2} margin={{ top: 10, right: 20, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                  {SERIES.map(series => (
                    <Bar key={series.key} dataKey={series.key} name={series.label} fill={series.color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <details className="mt-3 text-sm" onClick={event => event.stopPropagation()}>
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">View as table</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-4 font-medium">Session</th>
                      {SERIES.map(series => <th key={series.key} className="py-1 pr-4 font-medium">{series.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.label} className="border-t">
                        <td className="py-1 pr-4">{row.label}</td>
                        <td className="py-1 pr-4">{row.ebooks}</td>
                        <td className="py-1 pr-4">{row.videos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ContentCoverage({ programs, ebooks, videos, onNavigate }: {
  programs: any[] | null | undefined;
  ebooks: any[] | null | undefined;
  videos: any[] | null | undefined;
  onNavigate: Navigate;
}) {
  const total = programs?.length || 0;
  const withEbooks = new Set((ebooks || []).map(item => item.programId));
  const withVideos = new Set((videos || []).map(item => item.programId));
  const countWith = (has: (program: any) => boolean) => (programs || []).filter(has).length;

  return (
    <Card
      className="cursor-pointer border-none bg-card/60 shadow-xl backdrop-blur-xl transition-colors hover:border-primary/30"
      onClick={() => onNavigate('academic-programs')}
    >
      <CardHeader>
        <CardTitle>Program Setup</CardTitle>
        <CardDescription>How complete each program's content is</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pb-6">
        {programs === undefined || ebooks === undefined || videos === undefined ? (
          <div className="h-56 animate-pulse rounded-lg bg-muted" aria-label="Loading program setup" />
        ) : programs === null || ebooks === null || videos === null ? (
          <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">Could not load this section.</p>
        ) : (
          <>
            <StatusStat label="With modules" count={countWith(program => (program._count?.modules || 0) > 0)} total={total} color="bg-success" unit="program" />
            <StatusStat label="With E-Books" count={countWith(program => withEbooks.has(program.id))} total={total} color="bg-info" unit="program" />
            <StatusStat label="With video classes" count={countWith(program => withVideos.has(program.id))} total={total} color="bg-warning" unit="program" />
            <div className="mt-3 border-t border-border pt-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium">Total Programs</span>
                <span className="text-sm font-bold">{total}</span>
              </div>
              <p className="text-xs text-muted-foreground">Click to view all programs</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingSchedule({ examinations, classes, events, onNavigate }: {
  examinations: any[] | null | undefined;
  classes: any[] | null | undefined;
  events: any[] | null | undefined;
  onNavigate: Navigate;
}) {
  const loading = examinations === undefined || classes === undefined || events === undefined;
  const failed = examinations === null && classes === null && events === null;
  const upcoming = useMemo(() => {
    const today = startOfToday();
    return [
      ...(examinations || []).map(item => ({
        id: `exam-${item.id}`, title: item.examinationName, kind: 'Examination', detail: item.program?.name,
        start: item.startDate, end: item.endDate, tab: 'academic-examination-scheduled', badge: 'bg-primary/10 text-primary',
      })),
      ...(classes || []).map(item => ({
        id: `class-${item.id}`, title: item.title, kind: 'Live class', detail: item.programName || item.program?.name,
        start: item.startsAt, end: item.startsAt, tab: 'academic-scheduled-classes', badge: 'bg-info/10 text-info',
      })),
      ...(events || []).map(item => ({
        id: `event-${item.id}`, title: item.title, kind: item.category || 'Calendar', detail: item.program?.name,
        start: item.startDate, end: item.endDate || item.startDate, tab: 'academic-calendar', badge: 'bg-muted text-muted-foreground',
      })),
    ]
      .filter(item => new Date(item.end).getTime() >= today)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 5);
  }, [examinations, classes, events]);

  return (
    <Card className="cursor-pointer transition-colors hover:border-primary/30 lg:col-span-2" onClick={() => onNavigate('academic-calendar')}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Upcoming Schedule</CardTitle>
        <Button size="sm" variant="ghost" onClick={event => { event.stopPropagation(); onNavigate('academic-calendar'); }}>
          View All <ArrowUpRight className="ml-1 h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 pb-6">
        {loading ? (
          [1, 2, 3, 4].map(item => <div key={item} className="h-12 animate-pulse rounded-lg bg-muted" />)
        ) : failed ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Could not load this section.</p>
        ) : upcoming.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">Nothing scheduled</p>
          </div>
        ) : upcoming.map(item => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
            onClick={event => { event.stopPropagation(); onNavigate(item.tab); }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {(item.title || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{item.title || 'Untitled'}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {[item.detail, new Date(item.start).toLocaleDateString()].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', item.badge)}>{item.kind}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Every figure reads an endpoint the Academic panel's own pages use, so the numbers match those pages.
export function AcademicOverviewPanel({ onNavigate }: { onNavigate: Navigate }) {
  const list = (path: string) => async (): Promise<any[]> => (await api.get(path)).data.data || [];
  const sessions = useOverviewData(list('/operations/sessions'), []);
  const programs = useOverviewData(list('/operations/programs'), []);
  const ebooks = useOverviewData(list('/operations/ebooks'), []);
  const videos = useOverviewData(list('/operations/video-classes'), []);
  const classes = useOverviewData(list('/operations/scheduled-classes'), []);
  const examinations = useOverviewData(list('/operations/examinations'), []);
  const registrations = useOverviewData(list('/operations/examinations/registrations'), []);
  const events = useOverviewData(list('/operations/academic-calendar'), []);

  const activeSessions = (sessions || []).filter(session => session.status === 'active');
  const activeSessionIds = new Set(activeSessions.map(session => session.id));
  const programsInActive = (programs || []).filter(program => activeSessionIds.has(program.academicSessionId)).length;
  const draftExams = (examinations || []).filter(exam => exam.status === 'draft').length;
  const sumCount = (key: string) => (rows: any[]) => rows.reduce((sum, program) => sum + (program._count?.[key] || 0), 0);
  const withoutSemesters = (programs || []).filter(program => !program._count?.semesterRecords).length;
  const withoutModules = (programs || []).filter(program => !program._count?.modules).length;

  const actions = [
    ...(sessions && activeSessions.length === 0 ? [{ title: 'No Active Session', text: 'Activate an academic session.', tab: 'academic-session', style: 'error' as const }] : []),
    ...(draftExams > 0 ? [{ title: 'Draft Examinations', text: `${plural(draftExams, 'examination')} still in draft.`, tab: 'academic-examination-scheduled', style: 'warning' as const }] : []),
    ...(withoutSemesters > 0 ? [{ title: 'Programs Without Semesters', text: `${plural(withoutSemesters, 'program')} with no semesters.`, tab: 'academic-semesters', style: 'primary' as const }] : []),
    ...(withoutModules > 0 ? [{ title: 'Programs Without Modules', text: `${plural(withoutModules, 'program')} with no modules.`, tab: 'academic-modules', style: 'primary' as const }] : []),
  ];

  const tiles = [
    { label: 'Semesters', value: figure(programs, sumCount('semesterRecords')), icon: <Layers className="h-4 w-4" />, tab: 'academic-semesters' },
    { label: 'Modules', value: figure(programs, sumCount('modules')), icon: <ListTree className="h-4 w-4" />, tab: 'academic-modules' },
    { label: 'E-Books', value: figure(ebooks, rows => rows.length), icon: <BookOpen className="h-4 w-4" />, tab: 'academic-ebooks' },
    { label: 'Video Classes', value: figure(videos, rows => rows.length), icon: <Video className="h-4 w-4" />, tab: 'academic-video-classes' },
    { label: 'Scheduled Classes', value: figure(classes, rows => rows.length), icon: <CalendarClock className="h-4 w-4" />, tab: 'academic-scheduled-classes' },
    { label: 'Registered Students', value: figure(registrations, rows => rows.length), icon: <UserCheck className="h-4 w-4" />, tab: 'academic-examination-registered' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
        <p className="mt-1 text-muted-foreground">Academic sessions, programs, content and examinations</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <OverviewMetric
          title="Academic Sessions"
          value={figure(sessions, rows => rows.length)}
          sub={sessions ? (activeSessions.length ? `Active: ${activeSessions.map(session => session.name).join(', ')}` : 'No active session') : 'Sessions'}
          trend={sessions ? `${activeSessions.length} active` : undefined}
          trendType={sessions ? (activeSessions.length ? 'up' : 'warn') : undefined}
          icon={<CalendarDays className="h-5 w-5" />}
          color="primary"
          onClick={() => onNavigate('academic-session')}
        />
        <OverviewMetric
          title="Programs"
          value={figure(programs, rows => rows.length)}
          sub={programs && sessions ? `${programsInActive} in the active session` : 'All sessions'}
          trend={programs ? `${(programs || []).filter(program => program.status === 'active').length} active` : undefined}
          trendType={programs ? 'up' : undefined}
          icon={<GraduationCap className="h-5 w-5" />}
          color="success"
          onClick={() => onNavigate('academic-programs')}
        />
        <OverviewMetric
          title="Examinations"
          value={figure(examinations, rows => rows.length)}
          sub={registrations ? plural(registrations.length, 'registered student') : 'Examinations'}
          trend={examinations ? (draftExams > 0 ? `${draftExams} in draft` : examinations.length ? 'None in draft' : 'None created yet') : undefined}
          trendType={examinations && examinations.length ? (draftExams > 0 ? 'warn' : 'up') : undefined}
          icon={<ClipboardList className="h-5 w-5" />}
          color="warning"
          onClick={() => onNavigate('academic-examination-scheduled')}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map(({ tab, ...tile }) => <OverviewTile key={tab} {...tile} onClick={() => onNavigate(tab)} />)}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ContentChart sessions={sessions} ebooks={ebooks} videos={videos} onNavigate={onNavigate} />
        <ContentCoverage programs={programs} ebooks={ebooks} videos={videos} onNavigate={onNavigate} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <UpcomingSchedule examinations={examinations} classes={classes} events={events} onNavigate={onNavigate} />
        <PriorityActions
          actions={actions}
          loading={[sessions, programs, examinations].some(section => section === undefined)}
          onNavigate={onNavigate}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <BarListCard
          title="Programs by Course Type"
          description="All programs, grouped by course type"
          rows={programs && countBy(programs, program => program.courseType)}
          emptyMessage="No programs yet."
          onClick={() => onNavigate('academic-programs')}
        />
        <BarListCard
          title="Examinations by Type"
          description="All examinations, grouped by type"
          rows={examinations && countBy(examinations, exam => exam.examinationType)}
          emptyMessage="No examinations yet."
          onClick={() => onNavigate('academic-examination-scheduled')}
        />
        <BarListCard
          title="Calendar Events"
          description="Academic calendar, grouped by category"
          rows={events && countBy(events, event => event.category)}
          emptyMessage="No calendar events yet."
          onClick={() => onNavigate('academic-calendar')}
        />
      </div>
    </div>
  );
}
