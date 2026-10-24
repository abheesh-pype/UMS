import { useState, useEffect } from 'react';
import { AlertTriangle, Plus, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Escalation {
  id: string;
  type: string;
  description: string;
  impact: string;
  status: string;
  currentLevel: number;
  maxLevel: number;
  raisedAt: string;
  chain: { level: number; role: string; action?: string; remarks?: string; actionAt?: string }[];
}

const STATUS_COLOR: Record<string, string> = {
  pending:  'bg-warning/10 text-warning',
  active:   'bg-warning/10 text-warning',
  resolved: 'bg-success/10 text-success',
};

const IMPACT_COLOR: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-500',
  high:     'bg-orange-500/10 text-orange-500',
  medium:   'bg-yellow-500/10 text-yellow-500',
  low:      'bg-blue-500/10 text-blue-500',
};

const TYPE_LABELS: Record<string, string> = {
  task_overdue:    'Task Overdue',
  approval_delay:  'Approval Delay',
  compliance:      'Compliance Issue',
  credential_reveal: 'Credential Issue',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return 'just now';
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function EmployeeEscalationsPanel() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: 'approval_delay' as string,
    description: '',
    impact: 'medium' as string,
  });

  const fetchEscalations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/escalations');
      // Show only escalations raised by the current user (server filters by org, we show all they can see)
      setEscalations(res.data.data || []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load your escalations');
      setEscalations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEscalations(); }, []);

  const handleSubmit = async () => {
    if (!form.description.trim()) {
      toast.error('Please describe the issue');
      return;
    }
    setSaving(true);
    try {
      await api.post('/escalations', {
        type: form.type,
        description: form.description,
        impact: form.impact,
      });
      toast.success('Escalation raised successfully');
      setShowForm(false);
      setForm({ type: 'approval_delay', description: '', impact: 'medium' });
      fetchEscalations();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to raise escalation');
    } finally {
      setSaving(false);
    }
  };

  const active = escalations.filter(e => ['pending', 'active'].includes(e.status)).length;
  const resolved = escalations.filter(e => e.status === 'resolved').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Escalations</h2>
          <p className="text-sm text-muted-foreground mt-1">Raise and track issues that need management attention</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchEscalations} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowForm(v => !v)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Escalation
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-warning/10 text-warning"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-bold">{active}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/10 text-success"><CheckCircle className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-bold">{resolved}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Resolved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary"><Clock className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-bold">{escalations.length}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Raise form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Raise a New Escalation</CardTitle>
            <CardDescription>Authorized department admins and management can review your escalation. You can track its status here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase">Issue Type</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                >
                  <option value="approval_delay">Approval Delay</option>
                  <option value="task_overdue">Task / Deadline Issue</option>
                  <option value="compliance">Compliance Issue</option>
                  <option value="credential_reveal">Credential / Access Issue</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase">Impact Level</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                  value={form.impact}
                  onChange={e => setForm(f => ({ ...f, impact: e.target.value }))}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase">Description</label>
              <textarea
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none"
                rows={4}
                placeholder="Describe the issue clearly — what happened, when, and what you need..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Submitting...' : 'Submit Escalation'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : escalations.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No escalations yet</p>
            <p className="text-sm mt-1">Use "Create Escalation" if you have an issue that needs attention.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {escalations.map(esc => (
            <Card
              key={esc.id}
              className={cn('transition-colors cursor-pointer', expanded === esc.id ? 'border-primary/40' : 'hover:border-primary/20')}
              onClick={() => setExpanded(expanded === esc.id ? null : esc.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Badge className={cn('text-[10px] uppercase font-bold', STATUS_COLOR[esc.status] || 'bg-muted text-muted-foreground')}>
                        {esc.status}
                      </Badge>
                      <Badge className={cn('text-[10px] uppercase font-bold', IMPACT_COLOR[esc.impact] || 'bg-muted text-muted-foreground')}>
                        {esc.impact}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {TYPE_LABELS[esc.type] || esc.type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{timeAgo(esc.raisedAt)}</span>
                    </div>
                    <p className="text-sm text-foreground line-clamp-2">{esc.description}</p>

                    {/* Level indicator */}
                    <div className="flex items-center gap-1 mt-3">
                      <span className="text-[10px] text-muted-foreground mr-1">Level:</span>
                      {Array.from({ length: esc.maxLevel }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'w-5 h-1.5 rounded-full',
                            i < esc.currentLevel ? 'bg-warning' : 'bg-muted'
                          )}
                        />
                      ))}
                      <span className="text-[10px] text-muted-foreground ml-1">{esc.currentLevel}/{esc.maxLevel}</span>
                    </div>
                  </div>
                </div>

                {/* Expanded chain */}
                {expanded === esc.id && (esc.chain?.length ?? 0) > 0 && (
                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activity Chain</p>
                    {(esc.chain || []).map((step, i) => (
                      <div key={i} className="flex items-start gap-3 text-xs">
                        <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 mt-0.5">
                          {step.level}
                        </div>
                        <div>
                          <span className="font-semibold capitalize">{step.role}</span>
                          {step.action && <span className="text-muted-foreground"> — {step.action}</span>}
                          {step.remarks && <p className="text-muted-foreground mt-0.5">{step.remarks}</p>}
                          {step.actionAt && <p className="text-muted-foreground/60 mt-0.5">{new Date(step.actionAt).toLocaleString()}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
