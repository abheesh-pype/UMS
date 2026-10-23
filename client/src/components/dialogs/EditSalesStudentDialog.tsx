import { useState, useEffect } from 'react';
import {
  AlertCircle,
  RefreshCw,
  Upload,
  Plus,
  Trash2,
  FileText,
  GraduationCap,
  User,
  CheckCircle,
  Clock,
  ShieldAlert,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Program {
  id: string;
  name: string;
  code: string;
  specialisations?: string[];
  university?: { id: string; name: string; code: string };
}

interface Session {
  id: string;
  name: string;
  programId?: string | null;
}

interface EducationDetail {
  qualification: string;
  institution: string;
  passingYear: string;
  percentage?: string;
}

interface DocumentFile {
  name: string;
  url: string;
  reqName?: string;
}

interface EditSalesStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollment: any | null;
  onSuccess?: () => void;
}

export function EditSalesStudentDialog({
  open,
  onOpenChange,
  enrollment,
  onSuccess,
}: EditSalesStudentDialogProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'personal' | 'education' | 'documents'>('basic');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    studentName: '',
    studentEmail: '',
    studentPhone: '',
    studentAddress: '',
    programId: '',
    sessionId: '',
    specialisation: '',
    abcId: '',
    debId: '',
    dob: '',
    religion: '',
    caste: '',
    fatherName: '',
    motherName: '',
    parentMobile: '',
    studentPhoto: '',
    pincode: '',
    alternativePhone: '',
    maritalStatus: '',
    currentlyWorking: '',
  });

  const [educationalDetails, setEducationalDetails] = useState<EducationDetail[]>([]);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);

  const [tempEdu, setTempEdu] = useState<EducationDetail>({
    qualification: '',
    institution: '',
    passingYear: '',
    percentage: '',
  });

  // Fetch programs once on dialog open
  useEffect(() => {
    if (!open) return;
    const fetchPrograms = async () => {
      setLoadingMetadata(true);
      try {
        const res = await api.get('/sales/enrollment-programs');
        setPrograms(res.data.data || []);
      } catch (err: any) {
        console.error('Failed to load programs:', err);
      } finally {
        setLoadingMetadata(false);
      }
    };
    fetchPrograms();
  }, [open]);

  // Load enrollment data into form whenever enrollment changes
  useEffect(() => {
    if (!enrollment) return;

    setForm({
      studentName: enrollment.studentName || '',
      studentEmail: enrollment.studentEmail || '',
      studentPhone: enrollment.studentPhone || '',
      studentAddress: enrollment.studentAddress || '',
      programId: enrollment.programId || enrollment.program?.id || '',
      sessionId: enrollment.sessionId || enrollment.session?.id || '',
      specialisation: enrollment.specialisation || '',
      abcId: enrollment.abcId || '',
      debId: enrollment.debId || '',
      dob: enrollment.dob || '',
      religion: enrollment.religion || '',
      caste: enrollment.caste || '',
      fatherName: enrollment.fatherName || '',
      motherName: enrollment.motherName || '',
      parentMobile: enrollment.parentMobile || '',
      studentPhoto: enrollment.studentPhoto || '',
      pincode: enrollment.pincode || '',
      alternativePhone: enrollment.alternativePhone || '',
      maritalStatus: enrollment.maritalStatus || '',
      currentlyWorking: enrollment.currentlyWorking || '',
    });

    try {
      const edu = Array.isArray(enrollment.educationalDetails)
        ? enrollment.educationalDetails
        : typeof enrollment.educationalDetails === 'string'
        ? JSON.parse(enrollment.educationalDetails)
        : [];
      setEducationalDetails(edu);
    } catch {
      setEducationalDetails([]);
    }

    try {
      const docs = Array.isArray(enrollment.documents)
        ? enrollment.documents
        : typeof enrollment.documents === 'string'
        ? JSON.parse(enrollment.documents)
        : [];
      setDocuments(docs);
    } catch {
      setDocuments([]);
    }

    setActiveTab('basic');
  }, [enrollment]);

  // Fetch sessions when programId changes
  useEffect(() => {
    if (!form.programId) {
      setSessions([]);
      return;
    }
    const fetchSessions = async () => {
      try {
        const res = await api.get(`/sales/enrollment-sessions?programId=${form.programId}`);
        setSessions(res.data.data || []);
      } catch (err) {
        console.error('Failed to load sessions:', err);
      }
    };
    fetchSessions();
  }, [form.programId]);

  const selectedProgramObj = programs.find((p) => p.id === form.programId) || (enrollment?.program as Program);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, docName?: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/enrollment/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const fileUrl = res.data.url;

      if (docName === 'Student Photo') {
        setForm((prev) => ({ ...prev, studentPhoto: fileUrl }));
      }

      setDocuments((prev) => {
        const filtered = docName ? prev.filter((d) => d.name !== docName && d.reqName !== docName) : prev;
        return [...filtered, { name: docName || file.name, url: fileUrl, reqName: docName || file.name }];
      });

      toast.success(`${docName || file.name} uploaded successfully`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'File upload failed');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleAddEducation = () => {
    if (!tempEdu.qualification.trim() || !tempEdu.institution.trim() || !tempEdu.passingYear.trim()) {
      toast.error('Please enter qualification, institution and passing year');
      return;
    }
    setEducationalDetails((prev) => [...prev, { ...tempEdu }]);
    setTempEdu({ qualification: '', institution: '', passingYear: '', percentage: '' });
  };

  const handleRemoveEducation = (index: number) => {
    setEducationalDetails((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollment?.id) return;

    // Validate required fields
    if (!form.studentName.trim()) {
      toast.error('Student Name is required');
      setActiveTab('basic');
      return;
    }
    if (!form.studentEmail.trim()) {
      toast.error('Student Email is required');
      setActiveTab('basic');
      return;
    }
    if (!form.studentPhone.trim()) {
      toast.error('Student Phone is required');
      setActiveTab('basic');
      return;
    }
    if (!form.studentAddress.trim()) {
      toast.error('Student Address is required');
      setActiveTab('basic');
      return;
    }
    if (!form.programId) {
      toast.error('Please select an academic program');
      setActiveTab('basic');
      return;
    }
    if (!form.sessionId) {
      toast.error('Please select an admission session');
      setActiveTab('basic');
      return;
    }

    if (!form.abcId.trim()) {
      toast.error('ABC ID is required');
      setActiveTab('personal');
      return;
    }
    if (!/^\d{12}$/.test(form.abcId)) {
      toast.error('ABC ID must be exactly 12 digits');
      setActiveTab('personal');
      return;
    }
    if (!form.debId.trim()) {
      toast.error('DEB ID is required');
      setActiveTab('personal');
      return;
    }
    if (!/^\d{12}$/.test(form.debId)) {
      toast.error('DEB ID must be exactly 12 digits');
      setActiveTab('personal');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        educationalDetails,
        documents,
      };

      await api.put(`/sales/student-applications/${enrollment.id}/resubmit`, payload);
      toast.success('Enrollment updated and re-submitted to Operations successfully!');
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update and re-submit enrollment');
    } finally {
      setSubmitting(false);
    }
  };

  if (!enrollment) return null;

  const rejectionRemarks = enrollment.departmentRemarks || enrollment.financeRemarks;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-xl">Edit &amp; Re-Submit Application</DialogTitle>
            <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-400/40">
              Rejected by Operations
            </Badge>
          </div>
          <DialogDescription>
            Correct the rejected student details and re-submit the application to Operations for verification.
          </DialogDescription>
        </DialogHeader>

        {/* Operations Feedback Banner */}
        {rejectionRemarks && (
          <div className="rounded-lg border border-red-300/60 bg-red-50 p-4 text-sm dark:bg-red-950/30 dark:border-red-900/50">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold text-red-700 dark:text-red-400">Operations Feedback / Reason for Rejection:</p>
                <p className="mt-1 text-red-600 dark:text-red-300">{rejectionRemarks}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="basic">Basic &amp; Program</TabsTrigger>
              <TabsTrigger value="personal">Personal Details</TabsTrigger>
              <TabsTrigger value="education">Education</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            {/* Tab 1: Basic & Program Details */}
            <TabsContent value="basic" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-name">Student Full Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="edit-name"
                    value={form.studentName}
                    onChange={(e) => setForm({ ...form, studentName: e.target.value })}
                    placeholder="Enter student full name"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-email">Student Email <span className="text-destructive">*</span></Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={form.studentEmail}
                    onChange={(e) => setForm({ ...form, studentEmail: e.target.value })}
                    placeholder="student@example.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-phone">Phone Number <span className="text-destructive">*</span></Label>
                  <Input
                    id="edit-phone"
                    value={form.studentPhone}
                    onChange={(e) => setForm({ ...form, studentPhone: e.target.value.replace(/\D/g, '') })}
                    placeholder="10-digit mobile number"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-alt-phone">Alternative Phone</Label>
                  <Input
                    id="edit-alt-phone"
                    value={form.alternativePhone}
                    onChange={(e) => setForm({ ...form, alternativePhone: e.target.value.replace(/\D/g, '') })}
                    placeholder="Optional secondary phone"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-address">Address <span className="text-destructive">*</span></Label>
                  <Input
                    id="edit-address"
                    value={form.studentAddress}
                    onChange={(e) => setForm({ ...form, studentAddress: e.target.value })}
                    placeholder="Street / City / State"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-pincode">Pincode</Label>
                  <Input
                    id="edit-pincode"
                    value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                    placeholder="e.g. 560001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-program">Program <span className="text-destructive">*</span></Label>
                  <select
                    id="edit-program"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.programId}
                    onChange={(e) => setForm({ ...form, programId: e.target.value, sessionId: '', specialisation: '' })}
                    required
                  >
                    <option value="">Select Academic Program</option>
                    {programs.map((prog) => (
                      <option key={prog.id} value={prog.id}>
                        {prog.name} ({prog.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-session">Admission Session <span className="text-destructive">*</span></Label>
                  <select
                    id="edit-session"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.sessionId}
                    onChange={(e) => setForm({ ...form, sessionId: e.target.value })}
                    required
                    disabled={!form.programId}
                  >
                    <option value="">{form.programId ? 'Select Admission Session' : 'First Select Program'}</option>
                    {sessions.map((sess) => (
                      <option key={sess.id} value={sess.id}>
                        {sess.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedProgramObj?.specialisations && selectedProgramObj.specialisations.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-spec">Specialisation Combo (Optional)</Label>
                  <select
                    id="edit-spec"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.specialisation}
                    onChange={(e) => setForm({ ...form, specialisation: e.target.value })}
                  >
                    <option value="">Select Specialisation Combo</option>
                    {selectedProgramObj.specialisations.map((spec, i) => (
                      <option key={i} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </TabsContent>

            {/* Tab 2: Personal Details */}
            <TabsContent value="personal" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-dob">Date of Birth</Label>
                  <Input
                    id="edit-dob"
                    type="date"
                    value={form.dob}
                    onChange={(e) => setForm({ ...form, dob: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-marital">Marital Status</Label>
                  <select
                    id="edit-marital"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.maritalStatus}
                    onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
                  >
                    <option value="">Select Status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-working">Currently Working</Label>
                  <select
                    id="edit-working"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.currentlyWorking}
                    onChange={(e) => setForm({ ...form, currentlyWorking: e.target.value })}
                  >
                    <option value="">Select Option</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-religion">Religion</Label>
                  <Input
                    id="edit-religion"
                    value={form.religion}
                    onChange={(e) => setForm({ ...form, religion: e.target.value })}
                    placeholder="e.g. Hindu, Muslim, Christian"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-caste">Caste / Category</Label>
                  <Input
                    id="edit-caste"
                    value={form.caste}
                    onChange={(e) => setForm({ ...form, caste: e.target.value })}
                    placeholder="e.g. General, OBC, SC, ST"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-father">Father's Name</Label>
                  <Input
                    id="edit-father"
                    value={form.fatherName}
                    onChange={(e) => setForm({ ...form, fatherName: e.target.value })}
                    placeholder="Father full name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-mother">Mother's Name</Label>
                  <Input
                    id="edit-mother"
                    value={form.motherName}
                    onChange={(e) => setForm({ ...form, motherName: e.target.value })}
                    placeholder="Mother full name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-parent-mobile">Parent's Mobile</Label>
                  <Input
                    id="edit-parent-mobile"
                    value={form.parentMobile}
                    onChange={(e) => setForm({ ...form, parentMobile: e.target.value.replace(/\D/g, '') })}
                    placeholder="Parent mobile number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-abc">ABC ID (Academic Bank of Credits) <span className="text-destructive">*</span></Label>
                  <Input
                    id="edit-abc"
                    maxLength={12}
                    value={form.abcId}
                    onChange={(e) => setForm({ ...form, abcId: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                    placeholder="12-digit ABC ID"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">Must be exactly 12 numeric digits</p>
                  <a
                    href="https://www.digilocker.gov.in/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Create ABC ID through DigiLocker
                  </a>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-deb">DEB ID (Distance Education Bureau) <span className="text-destructive">*</span></Label>
                  <Input
                    id="edit-deb"
                    maxLength={12}
                    value={form.debId}
                    onChange={(e) => setForm({ ...form, debId: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                    placeholder="12-digit DEB ID"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">Must be exactly 12 numeric digits</p>
                  <a
                    href="https://deb.ugc.ac.in/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Create DEB ID using ABC ID
                  </a>
                </div>
              </div>
            </TabsContent>

            {/* Tab 3: Educational History */}
            <TabsContent value="education" className="space-y-4 pt-4">
              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-primary" /> Add Educational Qualification
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Qualification</Label>
                    <Input
                      placeholder="e.g. 10th, 12th, B.Sc"
                      value={tempEdu.qualification}
                      onChange={(e) => setTempEdu({ ...tempEdu, qualification: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Institution</Label>
                    <Input
                      placeholder="School / College"
                      value={tempEdu.institution}
                      onChange={(e) => setTempEdu({ ...tempEdu, institution: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Passing Year</Label>
                    <Input
                      placeholder="e.g. 2021"
                      value={tempEdu.passingYear}
                      onChange={(e) => setTempEdu({ ...tempEdu, passingYear: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1 flex gap-1 items-center">
                    <div className="flex-1">
                      <Label className="text-xs">Percentage / GPA</Label>
                      <Input
                        placeholder="e.g. 82%"
                        value={tempEdu.percentage}
                        onChange={(e) => setTempEdu({ ...tempEdu, percentage: e.target.value })}
                      />
                    </div>
                    <Button type="button" size="icon" className="h-9 w-9 shrink-0" onClick={handleAddEducation}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {educationalDetails.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg border-dashed">
                  No educational qualifications added yet. Add at least 10th/12th qualification.
                </div>
              ) : (
                <div className="space-y-2">
                  {educationalDetails.map((edu, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm"
                    >
                      <div>
                        <span className="font-semibold text-foreground mr-2">{edu.qualification}</span>
                        <span className="text-muted-foreground">{edu.institution}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({edu.passingYear}{edu.percentage ? ` · ${edu.percentage}` : ''})
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveEducation(idx)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Tab 4: Documents Upload */}
            <TabsContent value="documents" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  'Student Photo',
                  'Aadhaar Card',
                  '10th Marksheet',
                  '12th Marksheet',
                  'Degree Certificate',
                  'Other Document',
                ].map((docName) => {
                  const alreadyUploaded = documents.some(
                    (d) => d.name === docName || d.reqName === docName || (docName === 'Student Photo' && form.studentPhoto)
                  );
                  return (
                    <div
                      key={docName}
                      className="flex flex-col justify-between p-3 border rounded-xl bg-card hover:bg-muted/10 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{docName}</span>
                        {alreadyUploaded && (
                          <Badge variant="outline" className="border-green-400 bg-green-500/10 text-green-700 text-[10px]">
                            Uploaded
                          </Badge>
                        )}
                      </div>
                      <label className="mt-2.5 flex items-center justify-center border border-dashed rounded-lg py-2 hover:bg-muted/30 cursor-pointer transition-colors text-xs text-muted-foreground">
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                        {alreadyUploaded ? 'Replace File' : 'Choose & Upload File'}
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, docName)}
                          disabled={uploading}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>

              {documents.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <Label className="text-xs font-semibold">Attached Documents ({documents.length})</Label>
                  <div className="space-y-1.5">
                    {documents.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30 text-xs"
                      >
                        <span className="font-medium truncate max-w-[280px]">{doc.name || doc.reqName}</span>
                        <div className="flex items-center gap-2">
                          <a
                            href={doc.url.startsWith('/') ? doc.url : `/uploads/${doc.url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-primary hover:underline font-semibold"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" /> View
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveDocument(idx)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary text-primary-foreground font-semibold"
              disabled={submitting || uploading}
            >
              {submitting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Re-submitting...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Re-Submit to Operations
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
