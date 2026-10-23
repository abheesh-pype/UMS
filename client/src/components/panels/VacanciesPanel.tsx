import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import api from '@/lib/api';

export function VacanciesPanel() {
  const [vacancies, setVacancies] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    designation: '',
    departmentId: '',
    count: '1',
    status: 'open',
    description: '',
  });

  useEffect(() => {
    fetchVacancies();
    fetchDepartments();
  }, []);

  const fetchVacancies = async () => {
    setLoading(true);
    try {
      const response = await api.get('/hr/vacancies');
      setVacancies(response.data.data || []);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to load vacancies');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      setDepartments(response.data.data || []);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to load departments');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/hr/vacancies/${editingId}`, {
          designation: formData.designation,
          departmentId: formData.departmentId,
          count: Number(formData.count),
          status: formData.status,
        });
      } else {
        await api.post('/hiring/request', {
          title: formData.designation,
          departmentId: formData.departmentId,
          count: Number(formData.count),
          description: formData.description,
        });
        alert('Hiring request submitted for HR approval. The vacancy will open after approval.');
      }
      setDialogOpen(false);
      resetForm();
      fetchVacancies();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save vacancy');
    }
  };

  const handleEdit = (vacancy: any) => {
    setEditingId(vacancy.id);
    setFormData({
      designation: vacancy.designation || '',
      departmentId: vacancy.departmentId || '',
      count: vacancy.count?.toString() || '1',
      status: vacancy.status || 'open',
      description: '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vacancy?')) return;
    try {
      await api.delete(`/hr/vacancies/${id}`);
      fetchVacancies();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete vacancy');
    }
  };

  const handleClose = async (id: string) => {
    if (!confirm('Close this vacancy?')) return;
    try {
      await api.put(`/hr/vacancies/${id}/close`);
      fetchVacancies();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to close vacancy');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      designation: '',
      departmentId: '',
      count: '1',
      status: 'open',
      description: '',
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      open: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
    };
    return <Badge className={variants[status] || ''}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Vacancy Management</h2>
          <p className="text-muted-foreground">Hiring requests open vacancies after HR approval. Candidate hiring is managed in Hiring &amp; Recruitment.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Request Opening</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Legacy Vacancy' : 'Request New Opening'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Job title / designation</Label>
                <Input value={formData.designation} onChange={(e) => setFormData({...formData, designation: e.target.value})} required placeholder="e.g., Software Engineer" />
              </div>
              <div>
                <Label>Department</Label>
                <Select value={formData.departmentId} onValueChange={(value) => setFormData({...formData, departmentId: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.filter(dept => dept?.id).map((dept) => (
                      <SelectItem key={dept.id} value={dept.id.toString()}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Number of Positions</Label>
                <Input type="number" min="1" step="1" value={formData.count} onChange={(e) => setFormData({...formData, count: e.target.value})} required />
              </div>
              {editingId ? (
                <div>
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label>Requirements / description</Label>
                  <Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Describe the role and hiring need" />
                </div>
              )}
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">{editingId ? 'Save Vacancy' : 'Submit for HR Approval'}</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Vacancies</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : vacancies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No vacancies found</div>
          ) : (
            <div className="space-y-4">
              {vacancies.map((vacancy) => {
                const vid = vacancy.id;
                const deptName = vacancy.department?.name || 'Department not set';
                const available = (vacancy.count || 0) - (vacancy.filled || 0);
                const linkedToHiringRequest = Boolean(vacancy.hiringRequestId);
                return (
                <div key={vid} className="p-4 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{vacancy.designation}</h3>
                        {getStatusBadge(vacancy.status)}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {deptName} • {vacancy.count} position(s) • {vacancy.filled || 0} filled • {available} available
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {vacancy.status === 'open' && !linkedToHiringRequest && (
                        <Button variant="ghost" size="sm" onClick={() => handleClose(vid)} title="Close legacy vacancy">
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      )}
                      {!linkedToHiringRequest && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(vacancy)} title="Edit legacy vacancy">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(vid)} title="Delete legacy vacancy">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
