import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { toast } from 'sonner';

export function ManagerHiringPanel() {
  const [requests, setRequests] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', departmentId: '', count: '1', description: '' });
  const [departments, setDepartments] = useState<any[]>([]);

  const fetchData = async () => {
    const [requestsResult, departmentsResult] = await Promise.allSettled([
      api.get('/hiring/manager-requests'),
      api.get('/departments'),
    ]);

    if (requestsResult.status === 'fulfilled') {
      setRequests(requestsResult.value.data.data || []);
    } else {
      toast.error(requestsResult.reason.response?.data?.message || 'Failed to load your hiring requests');
    }

    if (departmentsResult.status === 'fulfilled') {
      setDepartments(departmentsResult.value.data.data || []);
    } else {
      toast.error(departmentsResult.reason.response?.data?.message || 'Failed to load departments for hiring requests');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/hiring/request', formData);
      toast.success('Hiring request submitted for HR approval');
      setIsOpen(false);
      setFormData({ title: '', departmentId: '', count: '1', description: '' });
      await fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to create request');
    }
  };

  const columns = [
    { key: 'title', header: 'Title' },
    { key: 'department', header: 'Department', render: (r: any) => r.department?.name || 'N/A' },
    { key: 'count', header: 'Count' },
    { key: 'description', header: 'Requirements', render: (r: any) => r.description || 'Not specified' },
    { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status.replace(/_/g, ' ')}</Badge> },
    { key: 'vacancy', header: 'Opening', render: (r: any) => r.vacancy ? `${r.vacancy.filled}/${r.vacancy.count} filled` : r.status === 'approved' ? 'Opening pending' : '—' },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>My Hiring Requests</CardTitle>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>Raise Hiring Request</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Raise Hiring Request</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                </div>
                <div>
                  <Label>Department</Label>
                  <Select value={formData.departmentId} onValueChange={v => setFormData({ ...formData, departmentId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                    <SelectContent>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Number of positions</Label>
                  <Input type="number" required min="1" step="1" value={formData.count} onChange={e => setFormData({ ...formData, count: e.target.value })} />
                </div>
                <div>
                  <Label>Requirements / description</Label>
                  <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                </div>
                <Button type="submit">Submit Request</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={requests} />
        </CardContent>
      </Card>
    </div>
  );
}
