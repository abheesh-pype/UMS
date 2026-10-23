import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/dashboard/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import html2pdf from 'html2pdf.js';
import { OfferLetterDocument } from './OfferLetterDocument';
import { Plus, UserPlus } from 'lucide-react';

export function HiringPanel() {
  const [requests, setRequests] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [candidateDialogOpen, setCandidateDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [candidateForm, setCandidateForm] = useState({ name: '', email: '', phone: '', offerLetterUrl: '' });
  const [submittingCandidate, setSubmittingCandidate] = useState(false);
  
  const fetchRequests = async () => {
    try {
      const res = await api.get('/hiring/requests');
      setRequests(res.data.data || []);
      const allCandidates = (res.data.data || []).flatMap((req: any) =>
        (req.candidates || []).map((candidate: any) => ({
          ...candidate,
          hiringRequest: { title: req.title, department: req.department },
        }))
      );
      setCandidates(allCandidates);
    } catch (e: any) {
      toast.error('Failed to fetch hiring data');
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleUpdateReqStatus = async (id: string, status: string) => {
    try {
      await api.put(`/hiring/requests/${id}/status`, {
        status,
        hrRemarks: status === 'rejected' ? 'Rejected by HR' : '',
      });
      toast.success(status === 'approved'
        ? 'Request approved and vacancy opened'
        : 'Hiring request rejected');
      fetchRequests();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update request');
    }
  };

  const openCandidateDialog = (request: any) => {
    setSelectedRequest(request);
    setCandidateForm({ name: '', email: '', phone: '', offerLetterUrl: '' });
    setCandidateDialogOpen(true);
  };

  const handleAddCandidate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRequest) return;
    setSubmittingCandidate(true);
    try {
      await api.post('/hiring/candidates', {
        ...candidateForm,
        hiringRequestId: selectedRequest.id,
      });
      toast.success('Candidate added to the approved hiring request');
      setCandidateDialogOpen(false);
      setSelectedRequest(null);
      await fetchRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add candidate');
    } finally {
      setSubmittingCandidate(false);
    }
  };

  const handleUpdateCandidate = async (id: string, status: string, options: any = {}) => {
    try {
      await api.put(`/hiring/candidates/${id}/status`, { status, ...options });
      toast.success(`Candidate status updated to ${status}`);
      fetchRequests();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update candidate');
    }
  };

  const requestColumns = [
    { key: 'title', header: 'Title' },
    { key: 'department', header: 'Department', render: (r: any) => r.department?.name || 'N/A' },
    { key: 'description', header: 'Requirements', render: (r: any) => r.description || 'Not specified' },
    { key: 'count', header: 'Positions' },
    { key: 'candidates', header: 'Candidates', render: (r: any) => `${(r.candidates || []).filter((c: any) => c.status !== 'rejected').length} / ${r.count}` },
    { key: 'createdAt', header: 'Requested', render: (r: any) => format(new Date(r.createdAt), 'MMM dd, yyyy') },
    { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status.replace(/_/g, ' ')}</Badge> },
    { key: 'requester', header: 'Requested By', render: (r: any) => r.requester?.name || 'Unknown' },
    { key: 'vacancy', header: 'Opening', render: (r: any) => r.vacancy ? `${r.vacancy.filled}/${r.vacancy.count} filled` : r.status === 'approved' ? 'Opening pending' : '—' },
    { 
      key: 'actions', 
      header: 'Actions', 
      render: (r: any) => (
        <div className="flex gap-2 flex-wrap">
          {r.status === 'pending_hr_approval' && (
            <>
              <Button size="sm" onClick={() => handleUpdateReqStatus(r.id, 'approved')}>Approve</Button>
              <Button size="sm" variant="destructive" onClick={() => handleUpdateReqStatus(r.id, 'rejected')}>Reject</Button>
            </>
          )}
          {r.status === 'approved' && (r.candidates || []).filter((c: any) => c.status !== 'rejected').length < r.count && (
            <Button size="sm" variant="outline" onClick={() => openCandidateDialog(r)}>
              <UserPlus className="w-4 h-4 mr-1" /> Add Candidate
            </Button>
          )}
        </div>
      ) 
    }
  ];

  const [pdfData, setPdfData] = useState<any>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const generatePDF = (candidate: any, type: 'offer' | 'appointment') => {
    // Standardize data for the template
    const templateData = {
      id: candidate.id,
      candidateName: candidate.name,
      candidateEmail: candidate.email,
      designation: candidate.hiringRequest?.title || 'Employee',
      department: candidate.hiringRequest?.department?.name || 'General',
      joiningDate: candidate.joinDate || new Date().toISOString(),
      salary: candidate.salary || 600000 // default for demo
    };

    setPdfData(templateData);
    setDownloadingPdf(true);

    setTimeout(() => {
      const element = document.getElementById(`offer-letter-${candidate.id}`);
      if (element) {
        html2pdf()
          .set({
            margin: 10,
            filename: `${type.charAt(0).toUpperCase() + type.slice(1)}_Letter_${candidate.name}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          })
          .from(element)
          .save()
          .then(() => setDownloadingPdf(false))
          .catch(() => {
            toast.error('Failed to generate PDF');
            setDownloadingPdf(false);
          });
      }
    }, 100);
  };

  const candidateColumns = [
    { key: 'name', header: 'Candidate Name' },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    { key: 'hiringRequest', header: 'Position', render: (r: any) => `${r.hiringRequest?.title || 'N/A'} · ${r.hiringRequest?.department?.name || 'N/A'}` },
    { key: 'status', header: 'Status', render: (r: any) => <Badge variant="outline">{r.status.replace(/_/g, ' ')}</Badge> },
    { key: 'joinDate', header: 'Joining Date', render: (r: any) => r.joinDate ? format(new Date(r.joinDate), 'MMM dd, yyyy') : '—' },
    { 
      key: 'documents', 
      header: 'Documents', 
      render: (r: any) => (
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => generatePDF(r, 'offer')}>Offer Letter</Button>
          {(r.status === 'joined' || r.status === 'appointment_sent' || r.status === 'induction_pending' || r.status === 'induction_completed') && (
            <Button size="sm" variant="outline" onClick={() => generatePDF(r, 'appointment')}>Appointment Letter</Button>
          )}
        </div>
      ) 
    },
    { 
      key: 'actions', 
      header: 'Actions', 
      render: (r: any) => (
        <div className="flex gap-2 flex-wrap">
          {r.status === 'offer_sent' && (
            <>
              <Button size="sm" onClick={() => handleUpdateCandidate(r.id, 'joined', { joinDate: new Date().toISOString() })}>Mark Joined</Button>
              <Button size="sm" variant="destructive" onClick={() => handleUpdateCandidate(r.id, 'rejected')}>Reject</Button>
            </>
          )}
          {r.status === 'joined' && (
             <Button size="sm" onClick={() => handleUpdateCandidate(r.id, 'appointment_sent')}>Send Appointment</Button>
          )}
          {r.status === 'appointment_sent' && (
             <Button size="sm" onClick={() => handleUpdateCandidate(r.id, 'induction_pending')}>Schedule Induction</Button>
          )}
          {r.status === 'induction_pending' && (
             <Button size="sm" onClick={() => handleUpdateCandidate(r.id, 'induction_completed')}>Complete Induction</Button>
          )}
        </div>
      ) 
    }
  ];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Requests ({requests.length})</TabsTrigger>
          <TabsTrigger value="candidates">Candidate Pipeline ({candidates.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Hiring Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable columns={requestColumns} data={requests} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="candidates">
          <Card>
            <CardHeader>
              <CardTitle>Candidate Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable columns={candidateColumns} data={candidates} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={candidateDialogOpen} onOpenChange={setCandidateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Candidate</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedRequest?.title} · {selectedRequest?.department?.name}
            </p>
          </DialogHeader>
          <form onSubmit={handleAddCandidate} className="space-y-4">
            <div>
              <Label htmlFor="candidate-name">Full name</Label>
              <Input id="candidate-name" value={candidateForm.name} onChange={event => setCandidateForm({ ...candidateForm, name: event.target.value })} required />
            </div>
            <div>
              <Label htmlFor="candidate-email">Email</Label>
              <Input id="candidate-email" type="email" value={candidateForm.email} onChange={event => setCandidateForm({ ...candidateForm, email: event.target.value })} required />
            </div>
            <div>
              <Label htmlFor="candidate-phone">Phone</Label>
              <Input id="candidate-phone" type="tel" value={candidateForm.phone} onChange={event => setCandidateForm({ ...candidateForm, phone: event.target.value })} required />
            </div>
            <div>
              <Label htmlFor="offer-letter-url">Offer letter URL (optional)</Label>
              <Input id="offer-letter-url" type="url" value={candidateForm.offerLetterUrl} onChange={event => setCandidateForm({ ...candidateForm, offerLetterUrl: event.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCandidateDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submittingCandidate}>
                <Plus className="w-4 h-4 mr-1" />{submittingCandidate ? 'Adding...' : 'Add Candidate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Hidden PDF Container */}
      <div className="hidden">
        {pdfData && <OfferLetterDocument data={pdfData} />}
      </div>
    </div>
  );
}
