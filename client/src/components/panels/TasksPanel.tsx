import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, CheckCircle, Users, Upload, Paperclip } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';

interface Task {
  id?: string;
  title: string;
  description: string;
  assignedTo: any;
  assignedBy: any;
  departmentId?: any;
  priority: string;
  status: string;
  deadline: string;
  completedAt?: string;
  remarks?: string;
  evidence?: string[];
}

interface SubUser {
  id: string;
  name: string;
  email: string;
  designation?: string;
  role?: string;
  departmentId?: string;
}

export function TasksPanel() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subordinates, setSubordinates] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [completingTask, setCompletingTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'medium',
    deadline: '',
  });

  const [completeData, setCompleteData] = useState({ remarks: '', files: null as FileList | null });

  useEffect(() => {
    fetchTasks();
    fetchSubordinates();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tasks');
      setTasks(res.data.data || []);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const fetchSubordinates = async () => {
    try {
      const res = await api.get('/tasks/assignable-users');
      setSubordinates(res.data.data || []);
    } catch (e) {
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assignedTo) return;

    // Auto-derive departmentId from the selected subordinate
    const selectedUser = subordinates.find(s => s.id === formData.assignedTo);
    const payload: any = { ...formData };
    if (selectedUser?.departmentId) {
      payload.departmentId = selectedUser.departmentId;
    }

    try {
      if (editingTask) {
        await api.put(`/tasks/${editingTask.id || editingTask.id}`, payload);
      } else {
        await api.post('/tasks', payload);
      }
      setDialogOpen(false);
      resetForm();
      fetchTasks();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to save task.');
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTask) return;
    try {
      const fd = new FormData();
      fd.append('remarks', completeData.remarks);
      if (completeData.files) {
        Array.from(completeData.files).forEach(f => fd.append('evidence', f));
      }
      await api.put(`/tasks/${completingTask.id || completingTask.id}/complete`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCompleteDialogOpen(false);
      setCompleteData({ remarks: '', files: null });
      setCompletingTask(null);
      fetchTasks();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to complete task.');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      fetchTasks();
    } catch (e) {
    }
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      assignedTo: task.assignedTo || '',
      priority: task.priority,
      deadline: task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '',
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', assignedTo: '', priority: 'medium', deadline: '' });
    setEditingTask(null);
  };

  const priorityColor = (p: string) => ({
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  }[p] || 'bg-gray-100 text-gray-800');

  const statusColor = (s: string) => ({
    completed: 'bg-green-100 text-green-800',
    in_progress: 'bg-blue-100 text-blue-800',
    overdue: 'bg-red-100 text-red-800',
    pending: 'bg-gray-100 text-gray-800',
  }[s] || 'bg-gray-100 text-gray-800');

  const currentUserId = user?.id || (user)?.id;
  const isTaskAdmin = [
    'superadmin',
    'org_admin',
    'ceo',
    'hr_admin',
    'finance_admin',
    'ops_admin',
    'sales_admin',
  ].includes(user?.role || '');
  const getUserId = (value: any) => value?.id || value;

  const filteredTasks = (() => {
    switch (activeTab) {
      case 'my': return tasks.filter(t => getUserId(t.assignedTo) === currentUserId);
      case 'pending': return tasks.filter(t =>
        (!isTaskAdmin || getUserId((t as any).createdBy) === currentUserId)
        && t.status !== 'completed'
      );
      case 'completed': return tasks.filter(t =>
        (!isTaskAdmin || getUserId((t as any).createdBy) === currentUserId)
        && t.status === 'completed'
      );
      default: return tasks;
    }
  })();

  if (loading) return (
    <Card><CardContent className="p-8 text-center text-muted-foreground">Loading tasks...</CardContent></Card>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Task Management</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Assign and track tasks for your team</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Assign Task</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingTask ? 'Edit Task' : 'Assign New Task'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Task Title</Label>
                <Input
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  required placeholder="e.g., Prepare monthly report"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  required placeholder="Detailed task description..." rows={3}
                />
              </div>
              <div>
                <Label>Assign To</Label>
                <Select
                  value={formData.assignedTo}
                  onValueChange={v => setFormData({ ...formData, assignedTo: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {subordinates.length === 0 ? (
                      <SelectItem value="__none__" disabled>No direct reports found</SelectItem>
                    ) : (
                      subordinates.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}{s.designation ? ` — ${s.designation}` : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Priority</Label>
                  <Select value={formData.priority} onValueChange={v => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Deadline</Label>
                  <Input
                    type="date"
                    value={formData.deadline}
                    onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                <Button type="submit" disabled={!formData.assignedTo || formData.assignedTo === '__none__'}>
                  {editingTask ? 'Update' : 'Assign'} Task
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Tasks</TabsTrigger>
            <TabsTrigger value="my">My Task</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="completed">Complete</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No tasks found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map(task => {
                  const taskId = task.id || '';
                  const isAssignedByMe = getUserId((task as any).createdBy) === currentUserId;
                  const isAssignedToMe = getUserId(task.assignedTo) === currentUserId;
                  return (
                    <div key={taskId} className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{task.title}</h3>
                          <Badge className={priorityColor(task.priority)}>{task.priority}</Badge>
                          <Badge className={statusColor(task.status)}>{task.status.replace('_', ' ')}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>To: {(task as any).assignee?.name || 'Unknown'}</span>
                          <span>By: {(task as any).assigner?.name || 'Unknown'}</span>
                          <span>Due: {new Date(task.deadline).toLocaleDateString()}</span>
                        </div>
                        {task.remarks && <p className="text-xs text-muted-foreground mt-1 italic">{task.remarks}</p>}
                        {task.evidence && task.evidence.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {task.evidence.map((url, i) => (
                              <a
                                key={i}
                                href={url.startsWith('/') ? `${url}` : url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <Paperclip className="w-3 h-3" />Evidence {i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        {isAssignedToMe && task.status !== 'completed' && (
                          <Button variant="outline" size="sm" onClick={() => { setCompletingTask(task); setCompleteDialogOpen(true); }}>
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        {isAssignedByMe && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(task)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDelete(taskId)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Complete Task Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Complete Task</DialogTitle></DialogHeader>
          {completingTask && (
            <div className="mb-3 p-3 bg-muted rounded-lg">
              <p className="font-semibold">{completingTask.title}</p>
              <p className="text-sm text-muted-foreground">{completingTask.description}</p>
            </div>
          )}
          <form onSubmit={handleComplete} className="space-y-4">
            <div>
              <Label>Completion Remarks</Label>
              <Textarea
                value={completeData.remarks}
                onChange={e => setCompleteData({ ...completeData, remarks: e.target.value })}
                placeholder="Notes about completion..." rows={3}
              />
            </div>
            <div>
              <Label>Evidence / Screenshots (optional)</Label>
              <label className="flex flex-col items-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors mt-1">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {completeData.files && completeData.files.length > 0
                    ? `${completeData.files.length} file(s) selected`
                    : 'Click to upload screenshots or files'}
                </span>
                <span className="text-xs text-muted-foreground">PNG, JPG, PDF, DOC — up to 5 files</span>
                <input
                  type="file"
                  multiple
                  accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={e => setCompleteData({ ...completeData, files: e.target.files })}
                />
              </label>
              {completeData.files && completeData.files.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {Array.from(completeData.files).map((f, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                      <Paperclip className="w-3 h-3" />{f.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setCompleteDialogOpen(false); setCompleteData({ remarks: '', files: null }); }}>Cancel</Button>
              <Button type="submit">Mark as Complete</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
