import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay } from 'date-fns';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function HolidaysPanel() {
  const { user } = useAuth();
  const canManage = ['hr_admin', 'org_admin', 'superadmin'].includes(user?.role || '');
  const [holidays, setHolidays] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', date: '', type: 'national', description: '' });

  useEffect(() => { fetchHolidays(); }, []);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const res = await api.get('/hr/holidays');
      setHolidays(res.data.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/hr/holidays/${editingId}`, formData);
      } else {
        await api.post('/hr/holidays', formData);
      }
      setDialogOpen(false);
      resetForm();
      await fetchHolidays();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save holiday');
    }
  };

  const handleEdit = (h: any) => {
    setEditingId(h.id || h.id);
    setFormData({
      name: h.name || '',
      date: h.date ? String(h.date).slice(0, 10) : '',
      type: h.type || 'national',
      description: h.description || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this holiday?')) return;
    try {
      await api.delete(`/hr/holidays/${id}`);
      toast.success('Holiday deleted');
      fetchHolidays();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete holiday');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: '', date: '', type: 'national', description: '' });
  };

  const typeColors: any = {
    national: 'bg-blue-100 text-blue-800',
    regional: 'bg-purple-100 text-purple-800',
    company: 'bg-green-100 text-green-800',
  };
  const holidayTypeStyles = {
    national: 'bg-blue-100 text-blue-950 font-bold dark:bg-blue-900 dark:text-blue-100',
    regional: 'bg-purple-100 text-purple-950 font-bold dark:bg-purple-900 dark:text-purple-100',
    company: 'bg-amber-100 text-amber-950 font-bold dark:bg-amber-900 dark:text-amber-100',
  };
  const getHolidayDate = (value: string | Date) => {
    const dateText = String(value).slice(0, 10);
    const [year, month, day] = dateText.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  const validHolidays = holidays.filter(holiday => holiday?.id && holiday.date && !Number.isNaN(getHolidayDate(holiday.date).getTime()));
  const sortedHolidays = [...validHolidays].sort((a, b) => getHolidayDate(a.date).getTime() - getHolidayDate(b.date).getTime());
  const holidayDatesByType = {
    national: validHolidays.filter(holiday => holiday.type === 'national').map(holiday => getHolidayDate(holiday.date)),
    regional: validHolidays.filter(holiday => holiday.type === 'regional').map(holiday => getHolidayDate(holiday.date)),
    company: validHolidays.filter(holiday => holiday.type === 'company').map(holiday => getHolidayDate(holiday.date)),
  };
  const selectedDateHolidays = selectedDate
    ? sortedHolidays.filter(holiday => isSameDay(getHolidayDate(holiday.date), selectedDate))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Holiday Calendar</h2>
          <p className="text-muted-foreground">Company holidays and observances</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Add Holiday</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Holiday' : 'Add New Holiday'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Holiday Name</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="national">National</SelectItem>
                      <SelectItem value="regional">Regional</SelectItem>
                      <SelectItem value="company">Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
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

      <Card>
        <CardHeader>
          <CardTitle>Holiday Calendar</CardTitle>
          <p className="text-sm text-muted-foreground">Holiday dates are highlighted. Select a date to view its holiday details.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="space-y-8">
              <div className="grid gap-6 lg:grid-cols-[minmax(300px,auto)_1fr] lg:items-start">
                <div className="flex flex-col items-center rounded-xl border bg-muted/20 p-3 sm:p-5">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="w-full rounded-xl border bg-card shadow-sm [--cell-size:--spacing(11)] sm:[--cell-size:--spacing(12)]"
                  modifiers={holidayDatesByType}
                  modifiersClassNames={holidayTypeStyles}
                />
                  <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />National</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-purple-500" />Regional</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Company / special day</span>
                  </div>
                </div>

                <div className="min-h-[320px] rounded-xl border p-4 sm:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3 border-b pb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Selected date</p>
                      <h3 className="text-xl font-semibold">
                        {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'Choose a date'}
                      </h3>
                    </div>
                    <Badge variant="outline">{selectedDateHolidays.length} {selectedDateHolidays.length === 1 ? 'holiday' : 'holidays'}</Badge>
                  </div>
                  {selectedDateHolidays.length ? (
                    <div className="space-y-3">
                      {selectedDateHolidays.map((holiday) => (
                        <div key={holiday.id} className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 p-4">
                          <div className="space-y-1">
                            <div className="font-semibold">{holiday.name}</div>
                            {holiday.description && <div className="text-sm text-muted-foreground">{holiday.description}</div>}
                          </div>
                          <Badge className={typeColors[holiday.type] || ''}>{holiday.type || 'special'}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-48 flex-col items-center justify-center text-center text-muted-foreground">
                      <p className="font-medium">{selectedDate ? 'No holiday marked for this date' : 'Select a calendar date'}</p>
                      <p className="mt-1 text-sm">National, regional, and company holidays appear here.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold">All Holidays</h3>
                  <p className="text-sm text-muted-foreground">Special days are marked in amber on the calendar.</p>
                </div>
                {sortedHolidays.length === 0 ? (
                  <div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground">No holidays found</div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {sortedHolidays.map((h) => {
                      const d = getHolidayDate(h.date);
                      const isUpcoming = d >= new Date(new Date().setHours(0, 0, 0, 0));
                      return (
                      <div key={h.id} className="flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50">
                        <div className="flex items-center gap-4">
                          <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg ${isUpcoming ? 'bg-primary/10' : 'bg-muted'}`}>
                            <div className="text-xl font-bold">{d.getDate()}</div>
                            <div className="text-xs uppercase text-muted-foreground">{format(d, 'MMM')}</div>
                          </div>
                          <div>
                            <div className={`font-medium ${!isUpcoming ? 'text-muted-foreground' : ''}`}>{h.name}</div>
                            <div className="text-sm text-muted-foreground">{format(d, 'EEEE, MMMM d, yyyy')}</div>
                            {h.description && <div className="text-xs text-muted-foreground">{h.description}</div>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={typeColors[h.type] || ''}>{h.type || 'special'}</Badge>
                          {canManage && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(h)}><Edit className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(h.id)}><Trash2 className="w-4 h-4" /></Button>
                            </>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
