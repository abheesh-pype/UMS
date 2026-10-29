import React, { useEffect, useState, useMemo } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api from '@/lib/api';
import { toast } from 'sonner';

export const CALENDAR_CATEGORIES = [
  'Classes & Teaching',
  'Assessment & Assignments',
  'University Events',
  'Meetings',
  'Examinations',
  'Holidays',
  'Administrative Deadlines',
  'Others',
] as const;

export const CATEGORY_CONFIG: Record<string, {
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

interface AcademicCalendarPanelProps {
  readOnly?: boolean;
}

export function AcademicCalendarPanel({ readOnly = true }: AcademicCalendarPanelProps) {
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'agenda'>('month');

  // Filter States
  const [calFilterSession, setCalFilterSession] = useState('all');
  const [calFilterSemester, setCalFilterSemester] = useState('all');
  const [calFilterCategory, setCalFilterCategory] = useState('all');
  const [calFilterDepartment, setCalFilterDepartment] = useState('all');

  // Auxiliary data
  const [sessions, setSessions] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);

  // Selected event for modal view
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<any | null>(null);

  const fetchCalendarEvents = async (customFilters?: {
    academicSessionId?: string;
    semesterId?: string;
    category?: string;
    departmentId?: string;
  }) => {
    setCalendarLoading(true);
    try {
      const activeSession = customFilters?.academicSessionId !== undefined ? customFilters.academicSessionId : calFilterSession;
      const activeSemester = customFilters?.semesterId !== undefined ? customFilters.semesterId : calFilterSemester;
      const activeCategory = customFilters?.category !== undefined ? customFilters.category : calFilterCategory;
      const activeDept = customFilters?.departmentId !== undefined ? customFilters.departmentId : calFilterDepartment;

      const params: any = {};
      if (activeSession && activeSession !== 'all') params.academicSessionId = activeSession;
      if (activeSemester && activeSemester !== 'all') params.semesterId = activeSemester;
      if (activeCategory && activeCategory !== 'all') params.category = activeCategory;
      if (activeDept && activeDept !== 'all') params.departmentId = activeDept;

      const response = await api.get('/operations/academic-calendar', { params });
      setCalendarEvents(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load academic calendar');
    } finally {
      setCalendarLoading(false);
    }
  };

  const fetchAuxiliaryData = async () => {
    try {
      const [sessionsRes, deptsRes, progsRes] = await Promise.all([
        api.get('/operations/sessions').catch(() => ({ data: { data: [] } })),
        api.get('/departments').catch(() => ({ data: [] })),
        api.get('/operations/programs').catch(() => ({ data: { data: [] } })),
      ]);

      const rawSessions = sessionsRes.data?.data || [];
      setSessions(rawSessions);

      const rawDepts = Array.isArray(deptsRes.data) ? deptsRes.data : deptsRes.data?.data || [];
      setDepartments(rawDepts);

      const rawProgs = progsRes.data?.data || [];
      setPrograms(rawProgs);

      // Collect semesters from programs
      const sems: any[] = [];
      rawProgs.forEach((p: any) => {
        if (Array.isArray(p.semesterRecords)) {
          p.semesterRecords.forEach((sem: any) => {
            sems.push({
              ...sem,
              academicSessionId: sem.academicSessionId || p.academicSessionId || p.admissionSessions?.[0]?.id || p.academicSession?.id,
              programId: sem.programId || p.id,
            });
          });
        }
      });
      setSemesters(sems);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchCalendarEvents();
    fetchAuxiliaryData();
  }, []);

  const applyCalendarFilters = () => {
    fetchCalendarEvents();
  };

  const resetCalendarFilters = () => {
    setCalFilterSession('all');
    setCalFilterSemester('all');
    setCalFilterCategory('all');
    setCalFilterDepartment('all');
    fetchCalendarEvents({
      academicSessionId: 'all',
      semesterId: 'all',
      category: 'all',
      departmentId: 'all',
    });
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

  const displaySession = (sessionId: string | null | undefined, fallbackSessionObj?: any) => {
    const session = sessions.find(item => item.id === sessionId) || fallbackSessionObj;
    if (session) {
      if (session.name) return session.name;
      if (session.startDate && session.endDate) {
        return `${new Date(session.startDate).getFullYear()} - ${new Date(session.endDate).getFullYear()}`;
      }
    }
    return 'Academic Session';
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
    setCalendarDate(new Date());
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

  const extractDateKey = (val: any) => {
    if (!val) return '';
    if (typeof val === 'string') {
      const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) return match[1];
    }
    try {
      return new Date(val).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const getCalendarEventsForDate = (dateKey: string) => {
    return calendarEvents.filter(event => {
      if (!event.startDate) return false;
      const startKey = extractDateKey(event.startDate);
      const endKey = event.endDate ? extractDateKey(event.endDate) : startKey;
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

  // Deriving filter options
  const filterSessions = useMemo(() => {
    const map = new Map<string, any>();
    sessions.forEach(s => map.set(s.id, s));
    calendarEvents.forEach(e => {
      if (e.academicSession && !map.has(e.academicSession.id)) {
        map.set(e.academicSession.id, e.academicSession);
      }
    });
    return Array.from(map.values());
  }, [sessions, calendarEvents]);

  const filterSemesters = useMemo(() => {
    const map = new Map<string, any>();
    semesters.forEach(s => map.set(s.id, s));
    calendarEvents.forEach(e => {
      if (e.semester) {
        const existing = map.get(e.semester.id);
        const academicSessionId =
          e.semester.academicSessionId ||
          e.academicSessionId ||
          e.academicSession?.id ||
          existing?.academicSessionId;
        map.set(e.semester.id, {
          ...(existing || {}),
          ...e.semester,
          academicSessionId,
        });
      }
    });

    let list = Array.from(map.values());

    // Filter based on academic year (academic session) filter
    if (calFilterSession && calFilterSession !== 'all') {
      list = list.filter(sem => String(sem.academicSessionId) === String(calFilterSession));
    }

    return list.sort((a, b) => (a.semesterNumber || 0) - (b.semesterNumber || 0));
  }, [semesters, calendarEvents, calFilterSession]);

  // Keep selected semester in sync if session filter changes
  useEffect(() => {
    if (calFilterSemester !== 'all') {
      const exists = filterSemesters.some(sem => String(sem.id) === String(calFilterSemester));
      if (!exists) {
        setCalFilterSemester('all');
      }
    }
  }, [filterSemesters, calFilterSemester]);

  const filterDepartments = useMemo(() => {
    const map = new Map<string, any>();
    departments.forEach(d => map.set(d.id, d));
    programs.forEach(p => {
      if (!map.has(p.id)) map.set(p.id, p);
    });
    calendarEvents.forEach(e => {
      if (e.department && !map.has(e.department.id)) {
        map.set(e.department.id, e.department);
      }
      if (e.program && !map.has(e.program.id)) {
        map.set(e.program.id, e.program);
      }
    });
    return Array.from(map.values());
  }, [departments, programs, calendarEvents]);

  const todayDateKey = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Calendar className="h-6 w-6 text-[#EF5A43]" />
            Academic Calendar
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            View all academic events, examinations, holidays and important dates.
          </p>
        </div>
      </div>

      {/* Top Filter Bar */}
      <Card className="shadow-xs border border-border/70">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end">
            {/* Academic Year / Session */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Academic Year</Label>
              <Select 
                value={calFilterSession} 
                onValueChange={(val) => {
                  setCalFilterSession(val);
                  setCalFilterSemester('all');
                }}
              >
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="All Sessions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  {filterSessions.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {displaySession(s.id, s)}
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
                  {filterSemesters.map(sem => (
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

            {/* Department / Program */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Department / Program</Label>
              <Select value={calFilterDepartment} onValueChange={setCalFilterDepartment}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {filterDepartments.map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
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
                      const isToday = cell.dateKey === todayDateKey;

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
                            day.dateKey === todayDateKey
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
                              onClick={() => setSelectedCalendarEvent(ev)}
                            >
                              View Details
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
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Event Details Dialog (Read-Only for Students) */}
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
                    <span className="text-xs text-muted-foreground">{displaySession(ev.academicSessionId, ev.academicSession)}</span>
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

                <DialogFooter className="flex gap-2 sm:justify-end border-t pt-3">
                  <Button type="button" variant="outline" onClick={() => setSelectedCalendarEvent(null)}>
                    Close
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
