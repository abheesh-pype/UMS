import { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { toast } from 'sonner';

// Signs the current UMS user into the Exam Portal with the role an admin assigned to them.
export function ExamPortalAccessPanel() {
  const [opening, setOpening] = useState(false);
  const [portalRole, setPortalRole] = useState<string | null>(null);

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

  return (
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
  );
}
