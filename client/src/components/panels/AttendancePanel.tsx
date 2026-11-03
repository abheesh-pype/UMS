import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, CalendarIcon, LayoutList, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { toast } from 'sonner';

const formatTime = (value?: string | null) =>
  value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';

// Report rows carry a plain YYYY-MM-DD date; personal records carry a timestamp
const parseRecordDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);

const formatRecordDate = (value: string) => parseRecordDate(value).toLocaleDateString();

const formatDuration = (hours?: number | null) => {
  const totalMinutes = Math.max(0, Math.round((hours || 0) * 60));
  return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, '0')}m`;
};

export function AttendancePanel({ isPersonalView = false, isTeamView = false }: { isPersonalView?: boolean; isTeamView?: boolean }) {
  const { user } = useAuth();
  const DEPT_MANAGER_ROLES = ['ops_admin', 'finance_admin', 'sales_admin', 'center_admin', 'ops_sub_admin'];
  const isBranchManager = Boolean((user as any)?.branchId);
  const isHR = ['hr_admin', 'org_admin', 'superadmin', 'ceo'].includes(user?.role || '') && !isPersonalView;
  const isDeptManager = (DEPT_MANAGER_ROLES.includes(user?.role || '') || isBranchManager || isHR || isTeamView) && !isPersonalView;
  const canViewAll = isDeptManager;
  
  const [attendance, setAttendance] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Date Filtering & View Mode States
  const [dateFilter, setDateFilter] = useState<Date | undefined>(new Date());
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(canViewAll ? today : '');
  const [endDate, setEndDate] = useState(canViewAll ? today : '');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    status: 'present',
    checkIn: '09:00',
    checkOut: '18:00',
    notes: ''
  });

  useEffect(() => {
    if (canViewAll) fetchEmployees();
  }, [canViewAll]);

  useEffect(() => {
    fetchAttendance();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewAll, startDate, endDate]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      // Team / organization view: every employee for every day, unmarked days reported as absent
      const endpoint = canViewAll ? '/hr/attendance/report' : '/hr/attendance/my';
      const response = await api.get(endpoint, {
        params: canViewAll
          ? { startDate: startDate || undefined, endDate: endDate || undefined }
          : undefined,
      });
      setAttendance(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/users');
      const allUsers = response.data.data || [];
      setEmployees(allUsers.filter((u: any) => u.role !== 'student'));
    } catch (error) {
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const toISO = (date: string, time: string) => {
        if (!date || !time) return undefined;
        return new Date(`${date}T${time}:00`).toISOString();
      };
      const payload: any = {
        employeeId: formData.employeeId,
        date: new Date(formData.date).toISOString(),
        status: formData.status,
        notes: formData.notes,
      };
      if (formData.checkIn) payload.checkIn = toISO(formData.date, formData.checkIn);
      if (formData.checkOut) payload.checkOut = toISO(formData.date, formData.checkOut);

      if (editingId) {
        await api.put(`/hr/attendance/${editingId}`, payload);
      } else {
        await api.post('/hr/attendance', payload);
      }
      setDialogOpen(false);
      resetForm();
      fetchAttendance();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save attendance');
    }
  };

  const handleEdit = (record: any) => {
    const recId = record.id || record.id;
    const empId = record.employeeId?.id || record.employeeId?.id || record.employeeId || '';
    setEditingId(recId);
    setFormData({
      employeeId: empId?.toString() || '',
      date: record.date ? new Date(record.date).toISOString().split('T')[0] : '',
      status: record.status || 'present',
      checkIn: record.checkIn ? new Date(record.checkIn).toTimeString().slice(0, 5) : '09:00',
      checkOut: record.checkOut ? new Date(record.checkOut).toTimeString().slice(0, 5) : '18:00',
      notes: record.notes || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this attendance record?')) return;
    try {
      await api.delete(`/hr/attendance/${id}`);
      fetchAttendance();
    } catch (error) {
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      employeeId: '',
      date: new Date().toISOString().split('T')[0],
      status: 'present',
      checkIn: '09:00',
      checkOut: '18:00',
      notes: ''
    });
  };

  const handleMarkUnmarked = (record: any) => {
    setEditingId(null);
    setFormData({
      employeeId: record.userId || record.employeeId?.id || '',
      date: record.date,
      status: 'present',
      checkIn: '09:00',
      checkOut: '18:00',
      notes: ''
    });
    setDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      present: 'bg-green-100 text-green-800',
      absent: 'bg-red-100 text-red-800',
      late: 'bg-yellow-100 text-yellow-800',
      half_day: 'bg-blue-100 text-blue-800',
      leave: 'bg-purple-100 text-purple-800',
      not_marked: 'bg-muted text-muted-foreground',
    };
    return <Badge className={variants[status] || ''}>{status?.replace('_', ' ')}</Badge>;
  };

  const filteredAttendance = attendance.filter(rec => {
    if (!rec || (!rec.id && !rec.id)) return false;
    if (canViewAll) {
      const name = (rec.employeeId?.name || '').toLowerCase();
      if (search.trim() && !name.includes(search.trim().toLowerCase())) return false;
      if (statusFilter === 'absent') return rec.status === 'absent';
      if (statusFilter === 'present') return rec.status !== 'absent';
      return true;
    }
    if (!dateFilter) return true;
    const recDate = parseRecordDate(rec.date);
    return recDate.getDate() === dateFilter.getDate() && 
           recDate.getMonth() === dateFilter.getMonth() && 
           recDate.getFullYear() === dateFilter.getFullYear();
  });

  const handleDateSelect = (date: Date | undefined) => {
    setDateFilter(date);
    if (canViewAll && date) {
      const selectedDate = format(date, 'yyyy-MM-dd');
      setStartDate(selectedDate);
      setEndDate(selectedDate);
    }
  };

  const recordsTitle = canViewAll
    ? startDate && endDate
      ? `${format(new Date(`${startDate}T00:00:00`), 'PPP')} - ${format(new Date(`${endDate}T00:00:00`), 'PPP')}`
      : startDate
        ? `From ${format(new Date(`${startDate}T00:00:00`), 'PPP')}`
        : endDate
          ? `Through ${format(new Date(`${endDate}T00:00:00`), 'PPP')}`
          : 'All Dates'
    : dateFilter
      ? format(dateFilter, 'PPP')
      : 'All Dates';

  const renderRecordsList = () => {
    if (loading) return <div className="text-center py-8">Loading...</div>;
    const recordsToDisplay = filteredAttendance;
    if (recordsToDisplay.length === 0) return <div className="text-center py-8 text-muted-foreground">No attendance records found for this date range.</div>;
    
    return (
      <div className="space-y-2">
        {recordsToDisplay.map((record) => {
          const recId = record.id || record.id;
          return (
            <div key={recId} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
              <div className="flex-1">
                <div className="font-medium">
                  {record.employeeId?.name || record.employee?.name || record.user?.name || 'Unknown'}
                </div>
                {canViewAll && (record.employeeId?.department?.name || record.employeeId?.designation) && (
                  <div className="text-xs text-muted-foreground">
                    {[record.employeeId?.designation, record.employeeId?.subDepartment?.name || record.employeeId?.department?.name].filter(Boolean).join(' · ')}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  {formatRecordDate(record.date)}
                  {record.isUnmarked
                    ? ' • Attendance not marked'
                    : ` • In ${formatTime(record.checkIn)} - Out ${record.checkOut ? formatTime(record.checkOut) : (record.checkIn ? 'Not punched out' : '--')}`}
                  {!record.isUnmarked && record.checkIn && ` • Total ${formatDuration(record.workingHours)}`}
                </div>
                {record.notes && <div className="text-xs text-muted-foreground mt-1">{record.notes}</div>}
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(record.status)}
                {isHR && record.isUnmarked && (
                  <Button variant="outline" size="sm" onClick={() => handleMarkUnmarked(record)}>
                    Mark
                  </Button>
                )}
                {isHR && !record.isUnmarked && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(record)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(recId)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Attendance {canViewAll ? 'Management' : 'Records'}</h2>
          <p className="text-muted-foreground">{canViewAll ? 'Track and manage employee attendance' : 'Your attendance history'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as any)} className="border rounded-md">
            <ToggleGroupItem value="list" aria-label="List view" className="px-3">
              <LayoutList className="w-4 h-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="calendar" aria-label="Calendar view" className="px-3">
              <CalendarDays className="w-4 h-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          
          {canViewAll ? (
            <div className="flex items-center gap-2">
              <Label htmlFor="attendance-start-date" className="sr-only">Start date</Label>
              <Input
                id="attendance-start-date"
                type="date"
                aria-label="Start date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-auto"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Label htmlFor="attendance-end-date" className="sr-only">End date</Label>
              <Input
                id="attendance-end-date"
                type="date"
                aria-label="End date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-auto"
              />
            </div>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !dateFilter && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFilter ? format(dateFilter, "PPP") : <span>Filter by date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={dateFilter}
                  onSelect={handleDateSelect}
                  initialFocus
                />
                <div className="p-2 border-t flex justify-center">
                  <Button variant="ghost" size="sm" onClick={() => setDateFilter(undefined)} className="w-full">
                    Clear filter
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {isHR && (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Mark Attendance</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingId ? 'Edit Attendance' : 'Mark Attendance'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Employee</Label>
                    <Select value={formData.employeeId} onValueChange={(value) => setFormData({...formData, employeeId: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.filter(emp => emp && (emp.id || emp.id)).map((emp) => (
                          <SelectItem key={emp.id || emp.id} value={(emp.id || emp.id).toString()}>
                            {emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="present">Present</SelectItem>
                        <SelectItem value="absent">Absent</SelectItem>
                        <SelectItem value="late">Late</SelectItem>
                        <SelectItem value="half_day">Half Day</SelectItem>
                        <SelectItem value="leave">Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Check In</Label>
                      <Input type="time" value={formData.checkIn} onChange={(e) => setFormData({...formData, checkIn: e.target.value})} />
                    </div>
                    <div>
                      <Label>Check Out</Label>
                      <Input type="time" value={formData.checkOut} onChange={(e) => setFormData({...formData, checkOut: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Input value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="Optional notes" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">Save</Button>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {canViewAll && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Employees</p>
              <p className="text-2xl font-bold">{new Set(attendance.map(rec => rec.userId)).size}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Present</p>
              <p className="text-2xl font-bold text-green-600">{attendance.filter(rec => rec.status !== 'absent').length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Absent</p>
              <p className="text-2xl font-bold text-red-600">{attendance.filter(rec => rec.status === 'absent').length}</p>
            </CardContent></Card>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search employee"
              aria-label="Search employee"
              className="sm:max-w-xs"
            />
            <Select value={statusFilter} onValueChange={value => setStatusFilter(value as 'all' | 'present' | 'absent')}>
              <SelectTrigger className="sm:w-40" aria-label="Attendance status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {viewMode === 'calendar' ? (
        <div className="grid md:grid-cols-[auto_1fr] gap-6">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Calendar</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              <Calendar
                mode="single"
                selected={dateFilter}
                onSelect={handleDateSelect}
                className="rounded-md border shadow-sm"
                modifiers={{
                  present: attendance.filter(a => a.status === 'present').map(a => parseRecordDate(a.date)),
                  absent: attendance.filter(a => a.status === 'absent').map(a => parseRecordDate(a.date)),
                  late: attendance.filter(a => a.status === 'late').map(a => parseRecordDate(a.date)),
                  half_day: attendance.filter(a => a.status === 'half_day').map(a => parseRecordDate(a.date)),
                  leave: attendance.filter(a => a.status === 'leave').map(a => parseRecordDate(a.date)),
                }}
                modifiersClassNames={{
                  present: 'bg-green-100 text-green-900 font-bold',
                  absent: 'bg-red-100 text-red-900 font-bold',
                  late: 'bg-yellow-100 text-yellow-900 font-bold',
                  half_day: 'bg-blue-100 text-blue-900 font-bold',
                  leave: 'bg-purple-100 text-purple-900 font-bold',
                }}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{recordsTitle} Records</CardTitle>
            </CardHeader>
            <CardContent>
              {renderRecordsList()}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{recordsTitle} Records</CardTitle>
          </CardHeader>
          <CardContent>
            {renderRecordsList()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
