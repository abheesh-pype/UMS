import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, FileCheck2, Loader2, Upload } from 'lucide-react';
import { EnrollStudentPanel } from '@/components/panels/EnrollStudentPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ApplicationStatus {
  studentName: string;
  studentEmail: string;
  program: { name: string; code: string } | null;
  session: { name: string } | null;
  status: string;
  departmentRemarks?: string | null;
  financeRemarks?: string | null;
  statusHistory: { status: string; timestamp?: string; note?: string }[];
  paymentAmount: number | null;
  canSubmitPayment: boolean;
  paymentProofSubmitted: boolean;
}

const statusText = (status: string) => status.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const rejectedStatuses = new Set(['rejected', 'department_rejected', 'ops_rejected', 'finance_rejected', 'rejected_from_finance']);
const financeStatuses = new Set(['pending_finance_review', 'finance_review', 'pending_payment', 'finance_resubmitted']);
const PUBLIC_APPLICATION_STATUS_CREDENTIALS_KEY = 'publicApplicationStatusCredentials';

export default function PublicStudentApplicationPage() {
  const path = window.location.pathname;
  const token = path.startsWith('/application-status/') ? path.slice('/application-status/'.length) : '';
  const [credentialsFromSignIn] = useState(() => {
    const storedCredentials = sessionStorage.getItem(PUBLIC_APPLICATION_STATUS_CREDENTIALS_KEY);
    sessionStorage.removeItem(PUBLIC_APPLICATION_STATUS_CREDENTIALS_KEY);
    if (!storedCredentials) return null;
    try {
      const parsedCredentials = JSON.parse(storedCredentials);
      return typeof parsedCredentials.email === 'string' && typeof parsedCredentials.password === 'string'
        ? parsedCredentials
        : null;
    } catch {
      return null;
    }
  });
  const [isStatusView, setIsStatusView] = useState(path === '/application-status' || path.startsWith('/application-status/'));
  const [application, setApplication] = useState<ApplicationStatus | null>(null);
  const [loading, setLoading] = useState(Boolean(token || credentialsFromSignIn));
  const [credentialEmail, setCredentialEmail] = useState(credentialsFromSignIn?.email || '');
  const [credentialPassword, setCredentialPassword] = useState(credentialsFromSignIn?.password || '');
  const [statusAccessError, setStatusAccessError] = useState('');
  const [showCredentials, setShowCredentials] = useState(false);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [remarks, setRemarks] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const { login } = useAuth();

  const fetchStatus = useCallback(async (credentials?: { email: string; password: string }) => {
    const access = credentials || { email: credentialEmail, password: credentialPassword };
    if (!token && (!access.email || !access.password)) return;
    setStatusAccessError('');
    try {
      const response = token
        ? await api.get(`/public/student-applications/${token}`)
        : await api.post('/public/student-applications/status', access);
      setApplication(response.data.data);
    } catch (error: any) {
      setApplication(null);
      const message = error.response?.data?.message || 'Could not load application status';
      setStatusAccessError(message);
      if (token) toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [credentialEmail, credentialPassword, token]);

  useEffect(() => {
    if (!token && !(isStatusView && credentialEmail && credentialPassword)) return;
    void fetchStatus();
    const refresh = window.setInterval(fetchStatus, 30000);
    return () => window.clearInterval(refresh);
  }, [credentialEmail, credentialPassword, fetchStatus, isStatusView, token]);

  const handleCheckStatus = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setApplication(null);
    await fetchStatus({ email: credentialEmail, password: credentialPassword });
  };

  const submitPaymentProof = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paymentFile) {
      toast.error('Select a payment receipt or screenshot first');
      return;
    }
    const formData = new FormData();
    formData.append('paymentProof', paymentFile);
    formData.append('remarks', remarks);
    if (!token) {
      formData.append('email', credentialEmail);
      formData.append('password', credentialPassword);
    }
    setSubmittingPayment(true);
    try {
      const endpoint = token
        ? `/public/student-applications/${token}/payment-proof`
        : '/public/student-applications/payment-proof';
      await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPaymentFile(null);
      setRemarks('');
      toast.success('Payment proof submitted for Finance verification');
      await fetchStatus();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit payment proof');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleApplicationSubmitted = async (result?: { trackingToken?: string; studentEmail?: string; initialPassword?: string }) => {
    if (!result?.trackingToken || !result.studentEmail || !result.initialPassword) {
      toast.error('Application was submitted, but its status access could not be prepared. Contact admissions.');
      return;
    }
    setCredentialEmail(result.studentEmail);
    setCredentialPassword(result.initialPassword);
    setShowCredentials(true);
    setIsStatusView(true);
    window.history.pushState({}, '', '/application-status');
    setLoading(true);
    await fetchStatus({ email: result.studentEmail, password: result.initialPassword });
  };

  const openStudentPortal = async () => {
    try {
      const success = await login(credentialEmail, credentialPassword);
      if (success) {
        window.location.assign('/');
      } else {
        toast.error('Student portal sign-in is not available yet. Contact admissions if your application is approved.');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Student portal sign-in is not available yet');
    }
  };

  if (!isStatusView) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Student Application</h1>
              <p className="mt-1 text-sm text-muted-foreground">Complete the student record to apply for admission.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setIsStatusView(true);
                window.history.pushState({}, '', '/application-status');
              }}>Check application status</Button>
              <Button variant="outline" onClick={() => window.location.assign('/')}>Back to home</Button>
            </div>
          </div>
          <EnrollStudentPanel mode="public" onSubmitted={handleApplicationSubmitted} />
        </div>
      </main>
    );
  }

  if (isStatusView && !application && !loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Check application status</CardTitle>
            <CardDescription>Sign in with the email address and date of birth used on your application.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCheckStatus} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="application-email">Student ID / email</Label>
                <Input id="application-email" type="email" autoComplete="username" value={credentialEmail} onChange={event => setCredentialEmail(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="application-dob">Password (date of birth)</Label>
                <Input id="application-dob" type="date" autoComplete="current-password" value={credentialPassword} onChange={event => setCredentialPassword(event.target.value)} required />
              </div>
              {statusAccessError && <p role="alert" className="text-sm text-destructive">{statusAccessError}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking...</> : 'View application status'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => {
                setIsStatusView(false);
                setStatusAccessError('');
                window.history.pushState({}, '', '/apply');
              }}>Back to enrollment form</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></main>;
  }

  if (!application) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="py-10 text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
            <h1 className="text-xl font-bold">Application link unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">Check the status link or contact admissions for help.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const isRejected = rejectedStatuses.has(application.status);
  const isEnrolled = application.status === 'enrolled';
  const financeRejected = ['finance_rejected', 'rejected_from_finance', 'rejected'].includes(application.status);
  const progressStep = isEnrolled ? 3 : financeStatuses.has(application.status) || financeRejected ? 2 : 1;
  const steps = [
    { label: 'Application submitted', icon: FileCheck2 },
    { label: 'Operations review', icon: Clock3 },
    { label: 'Finance approval', icon: CheckCircle2 },
  ];

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Application Status</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your application progress is refreshed automatically.</p>
        </div>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{application.studentName}</CardTitle>
                <CardDescription className="mt-1">{application.studentEmail}</CardDescription>
              </div>
              <Badge variant={isEnrolled ? 'default' : isRejected ? 'destructive' : 'secondary'}>
                {statusText(application.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <p><span className="text-muted-foreground">Program:</span> {application.program?.name || '—'}</p>
              <p><span className="text-muted-foreground">Session:</span> {application.session?.name || '—'}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {steps.map((step, index) => {
                const number = index + 1;
                const completed = !isRejected && progressStep >= number;
                const Icon = step.icon;
                return (
                  <div key={step.label} className={`rounded-lg border p-3 ${completed ? 'border-primary/40 bg-primary/5' : 'bg-muted/20'}`}>
                    <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full ${completed ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-medium">{step.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isRejected && number === progressStep ? 'Action required' : completed ? 'Complete' : 'Waiting'}
                    </p>
                  </div>
                );
              })}
            </div>

            {isRejected && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
                <p className="font-semibold">Application was not approved</p>
                {(application.departmentRemarks || application.financeRemarks) && (
                  <p className="mt-1 text-muted-foreground">{application.departmentRemarks || application.financeRemarks}</p>
                )}
              </div>
            )}

            {isEnrolled && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-sm">
                <p className="font-semibold">Final approval complete — your student portal is now available.</p>
                <p className="mt-1 text-muted-foreground">Sign in with your email address as your user ID and your date of birth in YYYY-MM-DD format as the initial password.</p>
                <Button className="mt-3" onClick={openStudentPortal}>Open student portal</Button>
              </div>
            )}

            {showCredentials && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
                <p className="font-semibold">Save your student sign-in details</p>
                <p className="mt-1">Student ID: <strong>{credentialEmail}</strong></p>
                <p>Password (DOB): <strong>{credentialPassword}</strong></p>
                <p className="mt-1 text-muted-foreground">Portal access will become available after final Finance approval.</p>
              </div>
            )}

            {application.canSubmitPayment && (
              <div className="space-y-4 border-t pt-5">
                <div>
                  <h2 className="font-semibold">Payment for Finance verification</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {application.paymentAmount
                      ? `Amount due: ₹${Number(application.paymentAmount).toLocaleString('en-IN')}. Upload your payment receipt or screenshot.`
                      : 'Upload the required payment proof for Finance verification.'}
                  </p>
                  {application.paymentProofSubmitted && (
                    <p className="mt-2 text-sm text-green-700">Payment proof received; Finance verification is pending.</p>
                  )}
                </div>
                <form onSubmit={submitPaymentProof} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="student-payment-proof">Payment receipt / screenshot</Label>
                    <Input
                      id="student-payment-proof"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={event => setPaymentFile(event.target.files?.[0] || null)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-payment-remarks">Transaction reference or remarks (optional)</Label>
                    <Input id="student-payment-remarks" value={remarks} onChange={event => setRemarks(event.target.value)} />
                  </div>
                  <Button type="submit" disabled={submittingPayment || !paymentFile}>
                    {submittingPayment ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : <><Upload className="mr-2 h-4 w-4" />Submit payment proof</>}
                  </Button>
                </form>
              </div>
            )}

            {application.statusHistory.length > 0 && (
              <div className="border-t pt-5">
                <h2 className="mb-3 font-semibold">Status history</h2>
                <div className="space-y-3">
                  {application.statusHistory.map((item, index) => (
                    <div key={`${item.status}-${item.timestamp || index}`} className="flex gap-3 text-sm">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <div>
                        <p className="font-medium">{statusText(item.status)}</p>
                        {item.note && <p className="text-muted-foreground">{item.note}</p>}
                        {item.timestamp && <p className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <div className="text-center">
          <Button variant="ghost" onClick={() => {
            setApplication(null);
            setShowCredentials(false);
            setStatusAccessError('');
            setCredentialPassword('');
            setIsStatusView(true);
            window.history.pushState({}, '', '/application-status');
          }}>Sign out of status</Button>
          <Button variant="ghost" onClick={() => window.location.assign('/')}>Return to university home</Button>
        </div>
      </div>
    </main>
  );
}
