import { useState, useEffect } from 'react';
import { Building2, Upload, CheckCircle, AlertCircle, Loader2, CreditCard, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

interface University { id: string; name: string; code: string; }
interface Program { id: string; name: string; code: string; universityId: string; courseType: string; }
interface PaymentUni { id: string; name: string; code: string; fee: number | null; }
interface PaymentStatus {
  centerId: string;
  centerName: string;
  status: string;
  paymentProof: { url: string; uploadedAt: string; remarks?: string } | null;
  universities: PaymentUni[];
  totalFee: number;
}

export default function PublicRegisterPage() {
  const token = new URLSearchParams(window.location.search).get('token') || '';

  const [validating, setValidating] = useState(true);
  const [tokenError, setTokenError] = useState('');
  const [universities, setUniversities] = useState<University[]>([]);
  const [invitePrograms, setInvitePrograms] = useState<Program[]>([]);

  // Payment flow state
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);

  // Registration form state
  const [form, setForm] = useState({ name: '', code: '', address: '', contact: '', email: '' });
  const [selectedUnis, setSelectedUnis] = useState<string[]>([]);
  const [files, setFiles] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    if (!token) { setTokenError('No invite token found in the URL.'); setValidating(false); return; }

    const validateInvite = () => {
      axios.get(`${API_BASE}/public/invite/${token}`)
        .then(res => {
          if (res.data.data?.inviteType === 'student') {
            window.location.replace(`/apply?invite=${encodeURIComponent(token)}`);
            return;
          }
          setUniversities(res.data.data?.universityIds || []);
          setInvitePrograms(res.data.data?.programIds || []);
          setValidating(false);
        })
        .catch(err2 => {
          const msg = err2.response?.data?.message || 'Invalid or expired invite link.';
          setTokenError(msg);
          setValidating(false);
        });
    };

    // First check if there's already a center registered with this token
    axios.get(`${API_BASE}/public/payment-status/${token}`)
      .then(res => {
        const data: PaymentStatus = res.data.data;
        setPaymentStatus(data);
        setValidating(false);
      })
      .catch(err => {
        const status = err.response?.status;
        if (status === 404) {
          // No center yet — validate invite for registration
          validateInvite();
        } else if (status === 409 || status === 410) {
          // Invite already used or expired
          setTokenError(err.response?.data?.message || 'This invite link is no longer valid.');
          setValidating(false);
        } else {
          // Unknown error — still try to validate the invite token
          validateInvite();
        }
      });
  }, [token]);

  const toggleUni = (id: string) =>
    setSelectedUnis(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUnis.length === 0) { toast.error('Select at least one university'); return; }
    if (!files || files.length === 0) { toast.error('Upload at least one document'); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('token', token);
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      selectedUnis.forEach(id => fd.append('universityIds', id));
      Array.from(files).forEach(f => fd.append('documents', f));

      const res = await axios.post(`${API_BASE}/public/register`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.data?.credentials) {
        setCredentials(res.data.data.credentials);
      }
      setSuccess(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentFile) { toast.error('Please select a payment proof file'); return; }

    setSubmittingPayment(true);
    try {
      const fd = new FormData();
      fd.append('paymentProof', paymentFile);
      if (paymentRemarks) fd.append('remarks', paymentRemarks);

      await axios.post(`${API_BASE}/public/submit-payment/${token}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPaymentSubmitted(true);
      toast.success('Payment proof submitted successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit payment proof');
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">Invalid Invite Link</h2>
            <p className="text-muted-foreground">{tokenError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Center is active
  if (paymentStatus?.status === 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-bold mb-2">Registration Complete</h2>
            <p className="text-muted-foreground">
              {paymentStatus.centerName} is now active. Check your email for login credentials.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Center is rejected
  if (paymentStatus?.status === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">Application Rejected</h2>
            <p className="text-muted-foreground">
              Your application for {paymentStatus.centerName} has been rejected. Please contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Center pending verification or ops_verified — show submitted confirmation
  if (paymentStatus && paymentStatus.status !== 'pending_payment') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-bold mb-2">Application Submitted</h2>
            <p className="text-muted-foreground">
              Your registration for <strong>{paymentStatus.centerName}</strong> is under review.
            </p>
            <Badge className="mt-3" variant="outline">{paymentStatus.status.replace(/_/g, ' ')}</Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Registration success (just submitted)
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
            <h2 className="text-xl font-bold">Registration Submitted</h2>
            <p className="text-muted-foreground text-sm">
              Your study center registration has been submitted. Our operations team will review your documents.
            </p>
            {credentials && (
              <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/20 text-left space-y-3">
                <p className="text-sm font-semibold text-center">Your Portal Login Credentials</p>
                <p className="text-xs text-muted-foreground text-center">Save these — you'll need them to log in and complete payment after ops approval.</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2 border border-border">
                    <span className="text-xs text-muted-foreground">Email</span>
                    <span className="text-sm font-mono font-medium">{credentials.email}</span>
                  </div>
                  <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2 border border-border">
                    <span className="text-xs text-muted-foreground">Password</span>
                    <span className="text-sm font-mono font-medium">{credentials.password}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // PAYMENT STEP — center is pending_payment
  if (paymentStatus?.status === 'pending_payment') {
    if (paymentSubmitted || paymentStatus.paymentProof) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-md w-full">
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <h2 className="text-xl font-bold mb-2">Payment Proof Submitted</h2>
              <p className="text-muted-foreground">
                Your payment proof for <strong>{paymentStatus.centerName}</strong> has been submitted. Finance team will verify and activate your account.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-xl bg-primary/10 text-primary"><CreditCard className="w-6 h-6" /></div>
            <div>
              <h1 className="text-2xl font-bold">Authorisation Fee Payment</h1>
              <p className="text-muted-foreground text-sm">{paymentStatus.centerName}</p>
            </div>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Fee Breakdown</CardTitle>
              <CardDescription>Pay the authorisation fee for each selected university.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {paymentStatus.universities.map(u => (
                <div key={u.id} className="flex items-center justify-between text-sm py-1">
                  <span>{u.name} <span className="text-muted-foreground">({u.code})</span></span>
                  {u.fee !== null ? (
                    <span className="font-semibold">₹{u.fee.toLocaleString()}</span>
                  ) : (
                    <Badge variant="destructive" className="text-[10px]">Fee not configured</Badge>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between font-bold text-base pt-2 border-t border-border">
                <span>Total</span>
                <span>₹{paymentStatus.totalFee.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          <form onSubmit={handlePaymentSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upload Payment Proof</CardTitle>
                <CardDescription>Upload your bank transfer receipt or payment screenshot.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {paymentFile ? paymentFile.name : 'Click to upload payment receipt'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={e => setPaymentFile(e.target.files?.[0] || null)}
                  />
                </label>
                <div className="space-y-1">
                  <Label htmlFor="remarks">Remarks (optional)</Label>
                  <Input
                    id="remarks"
                    placeholder="e.g. Transaction ID, bank name..."
                    value={paymentRemarks}
                    onChange={e => setPaymentRemarks(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Button type="submit" className="w-full" disabled={submittingPayment || !paymentFile}>
              {submittingPayment
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                : 'Submit Payment Proof'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // REGISTRATION FORM
  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-xl bg-primary/10 text-primary"><Building2 className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-bold">Study Center Registration</h1>
            <p className="text-muted-foreground text-sm">Complete the form to register your center.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Center Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {(['name', 'code', 'address', 'contact', 'email'] as const).map(field => (
                <div key={field} className="space-y-1">
                  <Label htmlFor={field} className="capitalize">{field}</Label>
                  <Input
                    id={field}
                    type={field === 'email' ? 'email' : 'text'}
                    value={form[field]}
                    onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                    required
                    placeholder={`Enter ${field}`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Universities</CardTitle>
              <CardDescription>Select the universities you want to be associated with.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {universities.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <Checkbox
                    id={`uni-${u.id}`}
                    checked={selectedUnis.includes(u.id)}
                    onCheckedChange={() => toggleUni(u.id)}
                  />
                  <label htmlFor={`uni-${u.id}`} className="text-sm cursor-pointer">
                    {u.name} <span className="text-muted-foreground">({u.code})</span>
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>

          {invitePrograms.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Authorized Programs</CardTitle>
                <CardDescription>Programs you are authorized to offer at your center.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {invitePrograms.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                    <span className="text-sm">{p.name} <span className="text-muted-foreground text-xs">({p.code})</span></span>
                    <Badge variant="outline" className="text-[10px]">{p.courseType}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
              <CardDescription>Upload registration documents (PDF, images, etc.)</CardDescription>
            </CardHeader>
            <CardContent>
              <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {files && files.length > 0 ? `${files.length} file(s) selected` : 'Click to upload documents'}
                </span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  onChange={e => setFiles(e.target.files)}
                />
              </label>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : 'Submit Registration'}
          </Button>
        </form>
      </div>
    </div>
  );
}
