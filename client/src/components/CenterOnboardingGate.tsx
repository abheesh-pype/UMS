import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, Upload, CreditCard, Building2, AlertCircle, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CenterStatus {
  centerId: string;
  centerName: string;
  status: string;
  paymentProof: { url: string; uploadedAt: string; remarks?: string } | null;
  opsRemarks: string | null;
  paymentRemarks: string | null;
  universities: { id: string; name: string; code: string; fee: number | null }[];
  totalFee: number;
}

interface Props {
  children: React.ReactNode;
}

const normalizeCenterStatus = (status?: string | null) =>
  status?.trim().toLowerCase().replace(/[\s-]+/g, '_') || null;

export function CenterOnboardingGate({ children }: Props) {
  const { user } = useAuth();
  const [centerStatus, setCenterStatus] = useState<string | null>(normalizeCenterStatus((user)?.centerStatus));
  const [data, setData] = useState<CenterStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showReuploadForm, setShowReuploadForm] = useState(false);
  const [showProofPreview, setShowProofPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.role !== 'center_admin') { setLoading(false); return; }
    const fetchCenterStatus = async (showLoader = false) => {
      if (showLoader) setLoading(true);
      try {
        const r = await api.get('/enrollment/my-center-status');
        setData(r.data.data);
        setCenterStatus(normalizeCenterStatus(r.data.data.status));
      } catch {
      } finally {
        if (showLoader) setLoading(false);
      }
    };

    fetchCenterStatus(true);
    const statusRefresh = window.setInterval(() => fetchCenterStatus(), 10000);
    return () => window.clearInterval(statusRefresh);
  }, [user]);

  // If center is active, render the real dashboard
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (centerStatus === 'active' || !centerStatus) {
    return <>{children}</>;
  }

  const openProofPicker = () => {
    setError('');
    setSuccess('');
    setShowReuploadForm(true);
    setTimeout(() => fileRef.current?.click(), 50);
  };

  const handlePaymentSubmit = async (e: React.FormEvent, isReupload = false) => {
    e.preventDefault();
    if (!file) { setError('Please select a payment proof file'); return; }
    setError(''); setSuccess(''); setSubmitting(true);
    try {
      const form = new FormData();
      form.append('proofFile', file);
      if (remarks) form.append('remarks', remarks);
      await api.post('/enrollment/submit-payment', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess(isReupload ? 'Payment proof updated successfully. Awaiting finance verification.' : 'Payment proof submitted. Awaiting finance verification.');
      setFile(null);
      setRemarks('');
      setShowReuploadForm(false);
      const r = await api.get('/enrollment/my-center-status');
      setData(r.data.data);
      setCenterStatus(normalizeCenterStatus(r.data.data.status));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit payment proof');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <Building2 className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">{data?.centerName || 'Study Center Portal'}</h1>
          <p className="text-muted-foreground">Complete your onboarding to access the portal</p>
        </div>

        {/* Status Steps */}
        <div className="flex items-center justify-between px-4">
          <Step label="Registration" done />
          <div className="flex-1 h-px bg-border mx-2" />
          <Step
            label={['ops_verified', 'pending_payment', 'finance_resubmitted', 'finance_rejected', 'rejected_from_finance', 'active'].includes(centerStatus) ? 'Ops Approved' : 'Ops Review'}
            done={['ops_verified', 'pending_payment', 'finance_resubmitted', 'finance_rejected', 'rejected_from_finance', 'active'].includes(centerStatus)}
            active={centerStatus === 'pending_verification'}
          />
          <div className="flex-1 h-px bg-border mx-2" />
          <Step
            label="Payment"
            done={centerStatus === 'active'}
            active={['pending_payment', 'finance_resubmitted', 'finance_rejected', 'rejected_from_finance', 'ops_verified'].includes(centerStatus)}
          />
          <div className="flex-1 h-px bg-border mx-2" />
          <Step label="Active" done={centerStatus === 'active'} />
        </div>

        {/* Status-specific content */}
        {centerStatus === 'pending_verification' && (
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <Clock className="w-10 h-10 text-yellow-500 mx-auto" />
              <h2 className="text-lg font-semibold">Documents Under Review</h2>
              <p className="text-muted-foreground text-sm">
                Our operations team is reviewing your submitted documents and center details.
                You will be notified once the review is complete.
              </p>
              <Badge variant="outline" className="text-yellow-600 border-yellow-400">Pending Ops Verification</Badge>
            </CardContent>
          </Card>
        )}

        {centerStatus === 'ops_verified' && (
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
              <h2 className="text-lg font-semibold">Documents Approved</h2>
              <p className="text-muted-foreground text-sm">
                Your documents have been verified. Payment details are being configured.
                You will be able to submit payment shortly.
              </p>
              <Badge variant="outline" className="text-green-600 border-green-400">Ops Verified</Badge>
            </CardContent>
          </Card>
        )}

        {['pending_payment', 'finance_resubmitted', 'finance_rejected', 'rejected_from_finance'].includes(centerStatus || '') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Authorization Fee Payment
              </CardTitle>
              <Badge variant="outline" className="w-fit">
                {centerStatus === 'finance_resubmitted'
                  ? 'Resubmitted to Finance'
                  : ['finance_rejected', 'rejected_from_finance'].includes(centerStatus || '')
                    ? 'Rejected by Finance'
                    : 'Pending Finance Verification'}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {data?.paymentProof ? (
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 space-y-3">
                  <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium text-sm">
                      {['finance_rejected', 'rejected_from_finance'].includes(centerStatus || '')
                        ? 'Payment proof was rejected by Finance'
                        : centerStatus === 'finance_resubmitted'
                          ? 'Resubmitted to Finance — awaiting verification'
                          : 'Payment proof submitted — awaiting finance verification'}
                    </span>
                  </div>
                  {['finance_rejected', 'rejected_from_finance'].includes(centerStatus || '') && data?.paymentRemarks && (
                    <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      <p className="font-semibold">Finance rejection reason</p>
                      <p>{data.paymentRemarks}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Submitted on {new Date(data.paymentProof.uploadedAt).toLocaleDateString()}
                  </p>
                  {data.paymentProof.url && (
                    <>
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowProofPreview(true)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Payment Proof
                      </Button>
                      <Dialog open={showProofPreview} onOpenChange={setShowProofPreview}>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Payment Proof</DialogTitle>
                          </DialogHeader>
                          <img
                            src={data.paymentProof.url.startsWith('http') || data.paymentProof.url.startsWith('data:')
                              ? data.paymentProof.url
                              : `${window.location.origin}${data.paymentProof.url}`}
                            alt="Uploaded payment proof"
                            className="max-h-[75vh] w-full rounded-md border object-contain bg-muted"
                          />
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                  {centerStatus !== 'finance_rejected' && centerStatus !== 'rejected_from_finance' && (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={openProofPicker}>
                        Re-upload image
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3 font-medium">University</th>
                            <th className="text-right p-3 font-medium">Auth Fee</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data?.universities || []).map(u => (
                            <tr key={u.id} className="border-t border-border">
                              <td className="p-3">{u.name} <span className="text-muted-foreground">({u.code})</span></td>
                              <td className="p-3 text-right">
                                {u.fee !== null ? `₹${u.fee.toLocaleString()}` : <span className="text-muted-foreground">TBD</span>}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t border-border bg-muted/30 font-semibold">
                            <td className="p-3">Total</td>
                            <td className="p-3 text-right">₹{(data?.totalFee || 0).toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm space-y-1">
                    <p className="font-medium text-blue-800 dark:text-blue-300">Bank Transfer Details</p>
                    <p className="text-muted-foreground">Please transfer the total amount to the university's bank account and upload the payment screenshot below.</p>
                  </div>
                </>
              )}

              {(showReuploadForm || !data?.paymentProof || centerStatus === 'finance_rejected' || centerStatus === 'rejected_from_finance' || centerStatus === 'finance_resubmitted') && (
                <form onSubmit={(e) => handlePaymentSubmit(e, !!data?.paymentProof)} className="space-y-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">Payment Screenshot / Proof *</label>
                    <div
                      onClick={() => fileRef.current?.click()}
                      className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      {file ? (
                        <p className="text-sm text-primary font-medium">{file.name}</p>
                      ) : (
                        <>
                          <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">{data?.paymentProof ? 'Click to choose a new payment proof' : 'Click to upload payment proof'}</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={e => setFile(e.target.files?.[0] || null)}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-1">Remarks (optional)</label>
                    <input
                      type="text"
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      placeholder="Transaction ID, bank name, etc."
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4" /> {error}
                    </div>
                  )}
                  {success && (
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                      <CheckCircle className="w-4 h-4" /> {success}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={submitting} className="flex-1 min-w-[180px]">
                      {submitting ? 'Submitting...' : data?.paymentProof ? 'Save new payment proof' : 'Submit Payment Proof'}
                    </Button>
                    {data?.paymentProof && (
                      <Button type="button" variant="outline" onClick={() => { setShowReuploadForm(false); setFile(null); setError(''); setSuccess(''); }}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        {centerStatus === 'rejected' && (
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <XCircle className="w-10 h-10 text-red-500 mx-auto" />
              <h2 className="text-lg font-semibold">Application Rejected</h2>
              {(data?.opsRemarks || data?.paymentRemarks) && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-left">
                  <p className="font-medium text-red-700 dark:text-red-400 mb-1">Reason:</p>
                  <p className="text-muted-foreground">{data.opsRemarks || data.paymentRemarks}</p>
                </div>
              )}
              <p className="text-muted-foreground text-sm">Please contact support for further assistance.</p>
              <Badge variant="destructive">Rejected</Badge>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Step({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
        done ? 'bg-green-500 border-green-500 text-white' :
        active ? 'bg-primary border-primary text-primary-foreground' :
        'bg-background border-border text-muted-foreground'
      }`}>
        {done ? <CheckCircle className="w-4 h-4" /> : active ? '●' : '○'}
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
    </div>
  );
}
