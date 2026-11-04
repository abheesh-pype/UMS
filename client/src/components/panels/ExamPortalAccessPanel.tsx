import { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { toast } from 'sonner';

// Signs the current UMS user into the Exam Portal with the role an admin assigned to them.
export function ExamPortalAccessPanel() {
  const [opening, setOpening] = useState(false);
  const [portalRole, setPortalRole] = useState<string | null>(null);
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    api.get('/operations/exam-portal/my-access')
      .then(response => setPortalRole(response.data.data.portalRole || null))
      .catch(() => setPortalRole(null));
  }, []);

  const open = async () => {
    // Opened inside the click so pop-up blockers allow it, then pointed at the single-use sign-in link.
    const win = window.open('about:blank', '_blank');
    if (!win) { toast.error('Allow pop-ups to open the Exam Portal'); return; }
    setOpening(true);
    try {
      const response = await api.post('/operations/exam-portal/staff-launch');
      win.opener = null;
      win.location.href = response.data.data.launchUrl;
    } catch (error: any) {
      win.close();
      toast.error(error.response?.data?.message || 'Could not open the Exam Portal');
    } finally {
      setOpening(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) { toast.error('The password must be at least 8 characters'); return; }
    if (password !== confirm) { toast.error('The passwords do not match'); return; }
    setSavingPassword(true);
    try {
      const response = await api.post('/operations/exam-portal/password', { password });
      toast.success(`Saved. Sign in on the Exam Portal login page with ${response.data.data.email}.`);
      setPassword('');
      setConfirm('');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Could not save the Exam Portal password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Exam Portal</CardTitle>
        <CardDescription>
          Opens the Exam Portal in a new tab, already signed in with your UMS account{portalRole ? ` as ${portalRole}` : ''}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={open} disabled={opening}>
          {opening ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
          Open Exam Portal
        </Button>
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle>Exam Portal login password</CardTitle>
        <CardDescription>
          Optional. Choose a password to also sign in on the Exam Portal's own login page, using {user?.email || 'your UMS email'} as the username. Signing in through UMS keeps working either way.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={savePassword} className="max-w-sm space-y-3">
          <div className="space-y-2">
            <Label htmlFor="portal-password">New password</Label>
            <Input id="portal-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="portal-password-confirm">Confirm password</Label>
            <Input id="portal-password-confirm" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirm} onChange={event => setConfirm(event.target.value)} required />
          </div>
          <Button type="submit" variant="outline" disabled={savingPassword}>
            {savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save password
          </Button>
        </form>
      </CardContent>
    </Card>
    </div>
  );
}
