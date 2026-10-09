import { useState, useEffect } from 'react';
import { GraduationCap, RefreshCw, Upload, Plus, Trash2, FileText, Edit, ShieldAlert, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Program {
  id: string;
  name: string;
  code: string;
  specialisations?: string[];
  certificateRequirements?: { name: string; isMandatory: boolean }[];
  university?: { id: string; name: string; code: string; category?: string };
  programFeeStructure?: {
    level: string;
    admissionSessionId?: string | null;
    baseFee: number;
    currency: string;
    billingCycle?: string;
    gstPercentage?: number;
    additionalFees: { label: string; amount: number }[];
  }[];
}

interface WalletData {
  balance: number;
}

interface EducationDetail {
  qualification: string;
  institution: string;
  passingYear: string;
  percentage: string;
}

interface DocumentFile {
  name: string;
  url: string;
  reqName?: string;
}

interface Session {
  id: string;
  name: string;
  programId?: string | null;
}

export function EnrollStudentPanel() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  const [centerConfig, setCenterConfig] = useState<any>(null);
  
  const [activeStep, setActiveStep] = useState(1);
  
  const [form, setForm] = useState<Record<string, string>>({
    studentName: '',
    studentEmail: '',
    studentPhone: '',
    studentAddress: '',
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
    admissionDate: new Date().toISOString().substring(0, 10),
    pincode: '',
    alternativePhone: '',
    maritalStatus: '',
    currentlyWorking: ''
  });

  // Dynamic lists for documents and education details
  const [educationList, setEducationList] = useState<EducationDetail[]>([]);
  const [documentList, setDocumentList] = useState<DocumentFile[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'installment' | 'full_payment'>('installment');
  
  // Single entry helper state for educational details form
  const [tempEdu, setTempEdu] = useState<EducationDetail>({
    qualification: '',
    institution: '',
    passingYear: '',
    percentage: ''
  });

  const [uploading, setUploading] = useState(false);
  
  // Confirmation Dialog Step
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Email Validation
  const [emailUnique, setEmailUnique] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [progsRes, walletRes, centerRes] = await Promise.all([
        api.get('/enrollment/programs'),
        api.get('/enrollment/wallet'),
        api.get('/enrollment/my-center-status').catch(() => ({ data: { data: null } }))
      ]);
      setPrograms(progsRes.data.data || []);
      setWallet(walletRes.data.data);
      setCenterConfig(centerRes.data.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const fetchSessions = async (programId: string) => {
    try {
      const res = await api.get(`/enrollment/sessions?programId=${programId}`);
      setSessions(res.data.data || []);
    } catch (e) {
      toast.error('Failed to load admission sessions for this program');
    }
  };

  useEffect(() => {
    if (selectedProgram?.id) {
      fetchSessions(selectedProgram.id);
    } else {
      setSessions([]);
    }
  }, [selectedProgram?.id]);

  useEffect(() => {
    setSelectedSessionId('');
  }, [selectedProgram]);

  useEffect(() => {
    setEmailUnique(null);
  }, [form.studentEmail, selectedProgram, selectedSessionId]);

  const checkEmail = async () => {
    if (!form.studentEmail || !selectedProgram || !selectedSessionId) return;
    setCheckingEmail(true);
    try {
      const res = await api.post('/enrollment/check-email', {
        studentEmail: form.studentEmail,
        programId: selectedProgram.id,
        sessionId: selectedSessionId
      });
      setEmailUnique(res.data.isUnique);
      if (!res.data.isUnique) {
        toast.error(res.data.message || 'Email already in use for this intake');
      }
    } catch (e) {}
    setCheckingEmail(false);
  };

  const getTotalFee = (p: Program, pm?: string) => {
    if (!p.programFeeStructure || p.programFeeStructure.length === 0) return 0;
    
    // Find fee structure for the selected session
    let fs = p.programFeeStructure.find(
      f => f.level === 'program' && f.admissionSessionId === selectedSessionId
    );
    
    // Fallback 1: Any program level fee structure
    if (!fs) {
      fs = p.programFeeStructure.find(f => f.level === 'program');
    }
    
    // Fallback 2: Any fee structure
    if (!fs) {
      fs = p.programFeeStructure[0];
    }
    
    let subtotal = 0;
    
    let breakdowns = (fs as any).feeBreakdown;
    if (typeof breakdowns === 'string') {
      try { breakdowns = JSON.parse(breakdowns); } catch (e) { breakdowns = []; }
    }
    
    const addFees = Array.isArray(fs.additionalFees) ? fs.additionalFees : [];
    const nonGstFees = addFees.filter(f => f.label !== 'GST');
    const additionalFeesTotal = nonGstFees.reduce((s, f) => s + f.amount, 0);

    const method = pm || paymentMethod;

    if (breakdowns && Array.isArray(breakdowns) && breakdowns.length > 0) {
      const getBreakdownAddFees = (b: any) => {
        if (typeof b.additionalFees !== 'string' || b.additionalFees.trim() === '') return 0;
        return b.additionalFees.split(',').reduce((sum: number, s: string) => {
          const parts = s.trim().split(':');
          return sum + (Number(parts[1]) || 0);
        }, 0);
      };

      if (method === 'full_payment') {
        const fullFee = Number((fs as any).fullProgramFee || 0);
        if (fullFee > 0) {
          subtotal = fullFee + additionalFeesTotal;
        } else {
          const examFees = breakdowns.reduce((sum: number, b: any) => sum + Number(b.examFee || 0), 0);
          const baseFees = breakdowns.reduce((sum: number, b: any) => sum + Number(b.baseFee || 0), 0);
          const bdAddFees = breakdowns.reduce((sum: number, b: any) => sum + getBreakdownAddFees(b), 0);
          subtotal = baseFees + examFees + additionalFeesTotal + bdAddFees;
        }
      } else {
        const b = breakdowns[0]; // first payment config
        subtotal = Number(b.baseFee || 0) + Number(b.examFee || 0) + additionalFeesTotal + getBreakdownAddFees(b);
      }
    } else {
      subtotal = fs.baseFee + additionalFeesTotal;
    }

    const gstEntry = addFees.find(f => f.label === 'GST');
    const gstAmount = gstEntry ? Math.round((subtotal * gstEntry.amount) / 100) : 0;
    
    return subtotal + gstAmount;
  };


  const getBillingCycleText = (p: Program) => {
    if (!p.programFeeStructure || p.programFeeStructure.length === 0) return '';
    const cycle = p.programFeeStructure[0].billingCycle;
    if (cycle === 'per_year') return ' / year';
    if (cycle === 'per_semester') return ' / sem';
    if (cycle === 'full_program') return ' / program';
    return ` / ${cycle}`;
  };

  const handleAddEducation = () => {
    if (!tempEdu.qualification.trim() || !tempEdu.institution.trim() || !tempEdu.passingYear.trim()) {
      toast.error('Please fill qualification, institution, and passing year.');
      return;
    }
    setEducationList([...educationList, tempEdu]);
    setTempEdu({ qualification: '', institution: '', passingYear: '', percentage: '' });
  };

  const handleRemoveEducation = (index: number) => {
    setEducationList(educationList.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, reqName?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await api.post('/enrollment/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        if (reqName) {
          setDocumentList(prev => [...prev.filter(d => d.reqName !== reqName), { name: res.data.filename || file.name, url: res.data.url, reqName }]);
        } else {
          setDocumentList(prev => [...prev, { name: res.data.filename || file.name, url: res.data.url }]);
        }
        toast.success('Document uploaded successfully');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const res = await api.post('/enrollment/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setForm(prev => ({ ...prev, studentPhoto: res.data.url }));
        toast.success('Student photo uploaded successfully');
      }
    } catch (err: any) {
      toast.error('Student photo upload failed');
    } finally {
      setUploading(false);
    }
  };

  const isFieldMandatory = (key: string, defaultRequired: boolean = false) => {
    // Check if the university made it optional (for Premium universities)
    const uniOptFields = selectedProgram?.university?.optionalFields;
    if (uniOptFields) {
      try {
        const parsedOpt = typeof uniOptFields === 'string' ? JSON.parse(uniOptFields) : uniOptFields;
        if (Array.isArray(parsedOpt) && parsedOpt.includes(key)) {
          return false;
        }
      } catch (e) {}
    }
    
    // Check center config
    const config = centerConfig?.customEnrollmentFields;
    const parsedConfig = typeof config === 'string' ? JSON.parse(config) : config;
    const status = parsedConfig?.[key];
    
    if (status === 'required') return true;
    if (status === 'optional') return false;
    return defaultRequired;
  };

  const renderField = (key: string, label: string, type: 'text' | 'date' | 'file' | 'number' | 'tel' | 'select' = 'text', options?: string[]) => {
    const config = centerConfig?.customEnrollmentFields;
    const parsedConfig = typeof config === 'string' ? JSON.parse(config) : config;
    const status = parsedConfig?.[key] || 'optional';

    if (status === 'hidden') return null;

    const isRequired = isFieldMandatory(key, false);

    if (type === 'file') {
      return (
        <div key={key} className="space-y-1">
          <Label className="flex items-center gap-1">
            {label} {isRequired && <span className="text-destructive">*</span>}
          </Label>
          <div className="flex gap-3 items-center pt-1.5">
            {form.studentPhoto ? (
              <Badge className="bg-green-100 text-green-800">Uploaded</Badge>
            ) : (
              <span className="text-xs text-muted-foreground">No photo uploaded</span>
            )}
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploading}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Button type="button" variant="outline" size="sm" disabled={uploading}>
                <Upload className="w-3.5 h-3.5 mr-1" />
                Upload Photo
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (type === 'select' && options) {
      return (
        <div key={key} className="space-y-1">
          <Label>
            {label} {isRequired && <span className="text-destructive">*</span>}
          </Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={(form as any)[key] || ''}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            required={isRequired}
          >
            <option value="" disabled>Select {label}</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      );
    }

    return (
      <div key={key} className="space-y-1">
        <Label>
          {label} {isRequired && <span className="text-destructive">*</span>}
        </Label>
        <Input
          type={type}
          inputMode={type === 'number' || type === 'tel' ? 'numeric' : undefined}
          value={(form as any)[key]}
          onChange={e => {
            let val = e.target.value;
            if (key.toLowerCase().includes('phone')) val = val.replace(/\D/g, '');
            setForm(f => ({ ...f, [key]: val }));
          }}
          placeholder={`Enter ${label.toLowerCase()}`}
          required={isRequired}
        />
      </div>
    );
  };

  const triggerConfirm = () => {
    if (!selectedProgram) return;
    if (!selectedSessionId) {
      toast.error('Please select an intake admission session');
      return;
    }
    if (selectedProgram.specialisations && selectedProgram.specialisations.length > 0 && !form.specialisation.trim()) {
      toast.error('Please select a specialisation combo');
      return;
    }
    
    // Validate standard base required fields
    const baseRequired = ['studentName', 'studentEmail', 'studentPhone', 'studentAddress'];
    const missing = [];
    for (const key of baseRequired) {
      if (!(form as any)[key]?.trim()) {
        missing.push(key);
      }
    }
    
    // Validate branch customized required fields
    const config = centerConfig?.customEnrollmentFields;
    const parsedConfig = typeof config === 'string' ? JSON.parse(config) : config;
    if (parsedConfig && typeof parsedConfig === 'object' && !Array.isArray(parsedConfig)) {
      for (const [field, requirement] of Object.entries(parsedConfig)) {
        if (requirement === 'required' && !field.startsWith('doc_')) {
          const val = (form as any)[field];
          if (val === undefined || val === null || String(val).trim() === '') {
            missing.push(field);
          }
        }
      }
    }

    if (missing.length > 0) {
      toast.error(`Missing required fields: ${missing.join(', ')}`);
      return;
    }
    setConfirmOpen(true);
  };

  const handleEnroll = async () => {
    if (!selectedProgram) return;
    if (!selectedSessionId) {
      toast.error('Please select an intake admission session');
      return;
    }
    if (selectedProgram.specialisations && selectedProgram.specialisations.length > 0 && !form.specialisation.trim()) {
      toast.error('Please select a specialisation combo');
      return;
    }
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      await api.post('/enrollment/enroll', { 
        ...form, 
        programId: selectedProgram.id,
        sessionId: selectedSessionId,
        documents: documentList,
        educationalDetails: educationList,
        paymentMethod: paymentMethod,
        totalFee: getTotalFee(selectedProgram)
      });
      toast.success('Enrollment submitted successfully');
      setForm({ 
        studentName: '', 
        studentEmail: '', 
        studentPhone: '', 
        studentAddress: '', 
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
        admissionDate: new Date().toISOString().substring(0, 10)
      });
      setSelectedSessionId('');
      setEducationList([]);
      setDocumentList([]);
      setSelectedProgram(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Enrollment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const validateStep = (stepNum: number) => {
    if (stepNum === 1) {
      if (!selectedProgram) {
        toast.error('Please select a Program');
        return false;
      }
      if (!selectedProgram.university) {
        toast.error('The selected program has no parent university');
        return false;
      }
      if (!selectedSessionId) {
        toast.error('Please select an intake session');
        return false;
      }
      if (selectedProgram.specialisations && selectedProgram.specialisations.length > 0 && !form.specialisation.trim()) {
        toast.error('Please select a specialisation combo');
        return false;
      }
      // Check customized fields for Step 1
      const config = centerConfig?.customEnrollmentFields;
      const parsedConfig = typeof config === 'string' ? JSON.parse(config) : config;
      if (parsedConfig && typeof parsedConfig === 'object' && !Array.isArray(parsedConfig)) {
        for (const field of ['admissionDate', 'abcId', 'debId']) {
          if (isFieldMandatory(field, false)) {
            const val = (form as any)[field];
            if (val === undefined || val === null || String(val).trim() === '') {
              toast.error(`Field '${field}' is required by this center's configuration`);
              return false;
            }
          }
        }
      }
    } else if (stepNum === 2) {
      // Validate Step 2: studentName, studentEmail, studentPhone, studentAddress
      const baseRequired = ['studentName', 'studentEmail', 'studentPhone', 'studentAddress'];
      for (const key of baseRequired) {
        if (isFieldMandatory(key, true) && !(form as any)[key]?.trim()) {
          toast.error(`Field '${key.replace('student', '')}' is required`);
          return false;
        }
      }
      if (emailUnique === false) {
        toast.error('An application with this email already exists for the selected program & intake.');
        return false;
      }
      // Check customized fields for Step 2
      const config = centerConfig?.customEnrollmentFields;
      const parsedConfig = typeof config === 'string' ? JSON.parse(config) : config;
      if (parsedConfig && typeof parsedConfig === 'object' && !Array.isArray(parsedConfig)) {
        for (const field of ['pincode', 'alternativePhone', 'religion', 'caste', 'dob']) {
          if (isFieldMandatory(field, false)) {
            const val = (form as any)[field];
            if (val === undefined || val === null || String(val).trim() === '') {
              toast.error(`Field '${field}' is required by this center's configuration`);
              return false;
            }
          }
        }
      }
    } else if (stepNum === 3) {
      // Validate Step 3: fatherName, motherName, parentMobile, studentPhoto
      const config = centerConfig?.customEnrollmentFields;
      const parsedConfig = typeof config === 'string' ? JSON.parse(config) : config;
      if (parsedConfig && typeof parsedConfig === 'object' && !Array.isArray(parsedConfig)) {
        for (const field of ['fatherName', 'motherName', 'parentMobile', 'studentPhoto']) {
          if (isFieldMandatory(field, false)) {
            const val = (form as any)[field];
            if (val === undefined || val === null || String(val).trim() === '') {
              toast.error(`Field '${field}' is required by this center's configuration`);
              return false;
            }
          }
        }
      }
    } else if (stepNum === 4) {
      // Validate mandatory documents
      if (selectedProgram?.certificateRequirements) {
        const mandatoryReqs = selectedProgram.certificateRequirements.filter((r: any) => r.isMandatory);
        for (const req of mandatoryReqs) {
          if (!documentList.some(d => d.reqName === req.name)) {
            toast.error(`Please upload mandatory document: ${req.name}`);
            return false;
          }
        }
      }
      
      const config = centerConfig?.customEnrollmentFields;
      if (config) {
        const cConfig = typeof config === 'string' ? JSON.parse(config) : config;
        const branchDocs = [
          { key: 'doc_aadhaar', label: 'Aadhaar Card' },
          { key: 'doc_10th', label: '10th Certificate' },
          { key: 'doc_12th', label: '12th Certificate' },
          { key: 'doc_degree', label: 'Degree Certificate' }
        ];
        
        for (const doc of branchDocs) {
          if (cConfig[doc.key] === 'required') {
            if (!documentList.some(d => d.reqName === doc.label)) {
              toast.error(`Please upload required branch document: ${doc.label}`);
              return false;
            }
          }
        }
      }
    }
    return true;
  };

  const balance = wallet?.balance || 0;

  return (
    <div className="space-y-6">
      {/* Stepper Header */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">Add New Student Record</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Please fill all required student documents and info step-by-step.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Wallet Balance</p>
              <p className="text-lg font-extrabold text-primary">₹{balance.toLocaleString()}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Dynamic Multi-Step Navigation Buttons */}
        <div className="flex flex-wrap items-center justify-start gap-2.5">
          {[
            { step: 1, label: 'Admission Info', icon: GraduationCap },
            { step: 2, label: 'Personal Details', icon: Edit },
            { step: 3, label: 'Family Info', icon: Plus },
            { step: 4, label: 'Documents', icon: FileText }
          ].map((item) => {
            const IconComp = item.icon;
            const isActive = activeStep === item.step;
            const isCompleted = activeStep > item.step;
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => {
                  if (item.step < activeStep) {
                    setActiveStep(item.step);
                  } else if (item.step > activeStep) {
                    let canGo = true;
                    for (let s = activeStep; s < item.step; s++) {
                      if (!validateStep(s)) {
                        canGo = false;
                        break;
                      }
                    }
                    if (canGo) {
                      setActiveStep(item.step);
                    }
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold transition-all border",
                  isActive 
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : isCompleted
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                )}
              >
                <IconComp className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Step Panel Content */}
      <Card className="border shadow-sm rounded-2xl">
        <CardContent className="p-6">
          {activeStep === 1 && (
            <div className="space-y-6">
              <h3 className="font-semibold text-slate-800 text-sm border-b pb-2">Step 1: Program & Session Allocation</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label>Program <span className="text-destructive">*</span></Label>
                  <select
                    value={selectedProgram?.id || ''}
                    onChange={e => {
                      const p = programs.find(x => x.id === e.target.value);
                      setSelectedProgram(p || null);
                    }}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="">
                      {programs.length > 0 ? '-- Select Program --' : 'No allocated programs available'}
                    </option>
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code}) - {p.university?.name || 'University'}
                      </option>
                    ))}
                  </select>
                  {programs.length === 0 && (
                    <p className="text-xs text-destructive">
                      No active programs are allocated to this study center. Please contact Operations.
                    </p>
                  )}
                </div>

                {selectedProgram && (
                  <div className="space-y-1.5">
                    <Label>Intake Admission Session <span className="text-destructive">*</span></Label>
                    <select
                      value={selectedSessionId}
                      onChange={e => setSelectedSessionId(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">-- Select Intake Session --</option>
                      {sessions.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedProgram && selectedProgram.specialisations && selectedProgram.specialisations.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Specialisation Combo <span className="text-destructive">*</span></Label>
                    <select
                      value={form.specialisation}
                      onChange={e => setForm(f => ({ ...f, specialisation: e.target.value }))}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">-- Select Specialisation Combo --</option>
                      {selectedProgram.specialisations.map((spec, idx) => (
                        <option key={idx} value={spec}>
                          {spec}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {renderField('admissionDate', 'Admission Date', 'date')}
                {renderField('abcId', 'ABCID')}
                {renderField('debId', 'DEBID')}
              </div>
              
              {/* Fee Summary Panel */}
              {selectedProgram && selectedSessionId && (
                <div className="mt-6 flex flex-col gap-4">
                  <div className="p-4 border rounded-xl shadow-sm bg-slate-50 dark:bg-slate-900/50">
                    <h4 className="text-sm font-semibold mb-3">Select Payment Method</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div 
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'full_payment' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-slate-300 dark:hover:border-slate-700'}`}
                        onClick={() => setPaymentMethod('full_payment')}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <input type="radio" checked={paymentMethod === 'full_payment'} onChange={() => setPaymentMethod('full_payment')} className="accent-primary" />
                          <span className="font-semibold text-sm">One-Time Payment</span>
                        </div>
                        <p className="text-xs text-muted-foreground ml-5">Pay full program fee upfront including all tuition.</p>
                      </div>
                      <div 
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'installment' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-slate-300 dark:hover:border-slate-700'}`}
                        onClick={() => setPaymentMethod('installment')}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <input type="radio" checked={paymentMethod === 'installment'} onChange={() => setPaymentMethod('installment')} className="accent-primary" />
                          <span className="font-semibold text-sm">Installment ({getBillingCycleText(selectedProgram).replace('/', '').trim()})</span>
                        </div>
                        <p className="text-xs text-muted-foreground ml-5">Pay the first installment plus registration fee.</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between shadow-sm">
                    <div>
                      <h4 className="text-sm font-semibold text-indigo-900 flex items-center gap-1.5">
                        Required Enrollment Fee
                      </h4>
                      <p className="text-xs text-indigo-700/80 mt-0.5 max-w-md">
                        Initial payment due for enrollment based on configured pricing structure.
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-indigo-700/70 font-semibold uppercase tracking-wider mb-0.5">Amount to Pay</p>
                      <div className="text-2xl font-black text-indigo-700">
                        ₹{getTotalFee(selectedProgram).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-6">
              <h3 className="font-semibold text-slate-800 text-sm border-b pb-2">Step 2: Candidate Personal Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Full Name {isFieldMandatory('studentName', true) && <span className="text-destructive">*</span>}</Label>
                  <Input value={form.studentName} onChange={e => setForm(f => ({ ...f, studentName: e.target.value }))} placeholder="Student's name" />
                </div>
                <div className="space-y-1">
                  <Label>Email Address {isFieldMandatory('studentEmail', true) && <span className="text-destructive">*</span>}</Label>
                  <Input type="email" value={form.studentEmail} onChange={e => setForm(f => ({ ...f, studentEmail: e.target.value }))} onBlur={checkEmail} placeholder="student@example.com" />
                  {checkingEmail && <p className="text-xs text-muted-foreground mt-1 animate-pulse">Checking email availability...</p>}
                  {emailUnique === false && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><ShieldAlert className="w-3 h-3"/> Email already registered for this intake.</p>}
                  {emailUnique === true && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><Check className="w-3 h-3"/> Email available.</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number {isFieldMandatory('studentPhone', true) && <span className="text-destructive">*</span>}</Label>
                  <Input type="tel" inputMode="numeric" pattern="[0-9]*" value={form.studentPhone} onChange={e => setForm(f => ({ ...f, studentPhone: e.target.value.replace(/\D/g, '') }))} placeholder="Primary phone" />
                </div>
                {renderField('dob', 'Date of Birth', 'date')}
                <div className="space-y-1 md:col-span-2">
                  <Label>Home Address {isFieldMandatory('studentAddress', true) && <span className="text-destructive">*</span>}</Label>
                  <Input value={form.studentAddress} onChange={e => setForm(f => ({ ...f, studentAddress: e.target.value }))} placeholder="Permanent address" />
                </div>
                {renderField('pincode', 'Pincode')}
                {renderField('alternativePhone', 'Alternative Phone', 'tel')}
                {renderField('religion', 'Religion', 'select', ['Hindu', 'Muslim', 'Sikh', 'Christian', 'Jain'])}
                {renderField('caste', 'Caste / Category', 'select', ['General', 'OEC', 'OBC', 'SC', 'ST', 'Other'])}
                {renderField('maritalStatus', 'Marital Status', 'select', ['Single', 'Married', 'Divorced', 'Widowed'])}
                {renderField('currentlyWorking', 'Currently Working', 'select', ['Yes', 'No'])}
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-6">
              <h3 className="font-semibold text-slate-800 text-sm border-b pb-2">Step 3: Family Information & Photo</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField('fatherName', "Father's Name")}
                {renderField('motherName', "Mother's Name")}
                {renderField('parentMobile', "Mobile Number", 'tel')}
                {renderField('studentPhoto', 'Student Photo', 'file')}
              </div>
            </div>
          )}

          {activeStep === 4 && (
            <div className="space-y-6">
              <h3 className="font-semibold text-slate-800 text-sm border-b pb-2">Step 4: Academic Background & Uploads</h3>
              
              {/* Qualifications */}
              <div className="space-y-3">
                <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider block">Qualifications History</Label>
                {educationList.length > 0 && (
                  <div className="space-y-2 border rounded-xl p-3 bg-slate-50/50">
                    {educationList.map((edu, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border text-sm shadow-sm">
                        <div>
                          <p className="font-semibold text-slate-700">{edu.qualification}</p>
                          <p className="text-xs text-muted-foreground">{edu.institution} ({edu.passingYear}) {edu.percentage ? `· ${edu.percentage}%` : ''}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveEducation(idx)}>
                          <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border">
                  <div>
                    <Label className="text-xs">Qualification</Label>
                    <Input 
                      placeholder="e.g. 10th / 12th / BCA" 
                      value={tempEdu.qualification} 
                      onChange={e => setTempEdu({ ...tempEdu, qualification: e.target.value })} 
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Institution</Label>
                    <Input 
                      placeholder="School / College Name" 
                      value={tempEdu.institution} 
                      onChange={e => setTempEdu({ ...tempEdu, institution: e.target.value })} 
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Passing Year</Label>
                    <Input 
                      placeholder="e.g. 2024" 
                      value={tempEdu.passingYear} 
                      onChange={e => setTempEdu({ ...tempEdu, passingYear: e.target.value })} 
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Percentage / CGPA (Optional)</Label>
                    <Input 
                      placeholder="e.g. 85%" 
                      value={tempEdu.percentage} 
                      onChange={e => setTempEdu({ ...tempEdu, percentage: e.target.value })} 
                    />
                  </div>
                  <Button type="button" variant="outline" size="sm" className="md:col-span-2 w-full mt-1" onClick={handleAddEducation}>
                    <Plus className="w-4 h-4 mr-2" /> Add Qualification
                  </Button>
                </div>
              </div>

              {/* Upload Documents */}
              <div className="space-y-3 pt-4 border-t">
                <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider block">Documents (SSLC, Plus Two, Aadhaar, etc.)</Label>
                
                {selectedProgram?.certificateRequirements && selectedProgram.certificateRequirements.length > 0 && (
                  <div className="space-y-3 mb-6">
                    <p className="text-sm font-medium text-slate-700">Required Program Certificates</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedProgram.certificateRequirements.map((req: any, idx: number) => {
                        const existingDoc = documentList.find(d => d.reqName === req.name);
                        return (
                          <div key={idx} className="bg-white border rounded-lg p-3 shadow-sm flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm text-slate-700">{req.name} {req.isMandatory && <span className="text-destructive">*</span>}</span>
                              {existingDoc ? (
                                <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-200 h-5 px-1.5"><Check className="w-3 h-3 mr-1"/> Uploaded</Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-400 h-5 px-1.5">Pending</Badge>
                              )}
                            </div>
                            {existingDoc ? (
                              <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded border">
                                <span className="truncate max-w-[150px] font-medium">{existingDoc.name}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <a href={existingDoc.url} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">View</a>
                                  <button type="button" onClick={() => setDocumentList(documentList.filter(d => d !== existingDoc))} className="text-red-500 hover:text-red-700 px-1 font-medium">Remove</button>
                                </div>
                              </div>
                            ) : (
                              <div className="relative border border-dashed rounded flex flex-col items-center justify-center p-3 hover:bg-slate-50 cursor-pointer transition-colors bg-slate-50/50">
                                <Input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileUpload(e, req.name)} disabled={uploading} />
                                <Upload className="w-4 h-4 text-slate-400 mb-1" />
                                <span className="text-xs font-medium text-slate-500">Upload {req.name}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Branch Configured Documents */}
                {(() => {
                  const config = centerConfig?.customEnrollmentFields;
                  const cConfig = typeof config === 'string' ? JSON.parse(config) : (config || {});
                  const branchDocs = [
                    { key: 'doc_aadhaar', label: 'Aadhaar Card' },
                    { key: 'doc_10th', label: '10th Certificate' },
                    { key: 'doc_12th', label: '12th Certificate' },
                    { key: 'doc_degree', label: 'Degree Certificate' }
                  ];
                  
                  const activeDocs = branchDocs.filter(d => (cConfig[d.key] || 'optional') !== 'hidden');
                  if (activeDocs.length === 0) return null;

                  return (
                    <div className="space-y-3 mb-6">
                      <p className="text-sm font-medium text-slate-700">Required Branch Certificates</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeDocs.map((doc, idx) => {
                          const existingDoc = documentList.find(d => d.reqName === doc.label);
                          const isMandatory = cConfig[doc.key] === 'required';
                          return (
                            <div key={idx} className="bg-white border rounded-lg p-3 shadow-sm flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm text-slate-700">{doc.label} {isMandatory && <span className="text-destructive">*</span>}</span>
                                {existingDoc ? (
                                  <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-200 h-5 px-1.5"><Check className="w-3 h-3 mr-1"/> Uploaded</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-slate-400 h-5 px-1.5">Pending</Badge>
                                )}
                              </div>
                              {existingDoc ? (
                                <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded border">
                                  <span className="truncate max-w-[150px] font-medium">{existingDoc.name}</span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <a href={existingDoc.url} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">View</a>
                                    <button type="button" onClick={() => setDocumentList(documentList.filter(d => d !== existingDoc))} className="text-red-500 hover:text-red-700 px-1 font-medium">Remove</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="relative border border-dashed rounded flex flex-col items-center justify-center p-3 hover:bg-slate-50 cursor-pointer transition-colors bg-slate-50/50">
                                  <Input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleFileUpload(e, doc.label)} disabled={uploading} />
                                  <Upload className="w-4 h-4 text-slate-400 mb-1" />
                                  <span className="text-xs font-medium text-slate-500">Upload {doc.label}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="pt-2 border-t mt-4">
                  <p className="text-sm font-medium text-slate-700 mb-2">Additional Documents</p>
                  {documentList.filter(d => !d.reqName).length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      {documentList.filter(d => !d.reqName).map((doc, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border text-sm shadow-sm">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            <span className="truncate font-medium text-slate-700">{doc.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline px-2 font-medium">View</a>
                            <Button variant="ghost" size="sm" onClick={() => setDocumentList(documentList.filter(d => d !== doc))}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="relative border-2 border-dashed rounded-xl p-6 hover:bg-slate-50 transition-all flex flex-col items-center justify-center cursor-pointer bg-white">
                    <Input 
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={e => handleFileUpload(e)} 
                      disabled={uploading} 
                    />
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="text-sm font-semibold text-slate-600">{uploading ? 'Uploading...' : 'Click or drag files here to upload extra documents'}</p>
                    <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG up to 10MB</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stepper Footer Controls */}
          <div className="flex items-center justify-between border-t pt-5 mt-8 bg-slate-50/50 -mx-6 -mb-6 p-6 rounded-b-2xl">
            <Button
              type="button"
              variant="outline"
              disabled={activeStep === 1}
              onClick={() => setActiveStep(activeStep - 1)}
              className="flex items-center gap-1 text-slate-600"
            >
              &larr; Back
            </Button>
            
            <span className="text-xs font-semibold text-slate-500">
              Step {activeStep} of 4
            </span>

            {activeStep < 4 ? (
              <Button
                type="button"
                onClick={() => {
                  if (validateStep(activeStep)) {
                    setActiveStep(activeStep + 1);
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1"
              >
                Next &rarr;
              </Button>
            ) : (
              <Button
                type="button"
                onClick={triggerConfirm}
                disabled={!selectedProgram || submitting || (selectedProgram?.university?.category === 'direct_iits' && balance < getTotalFee(selectedProgram))}
                className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 font-semibold"
              >
                <GraduationCap className="w-4.5 h-4.5" />
                {submitting ? 'Enrolling...' : 'Submit Application'}
              </Button>
            )}
          </div>
          {activeStep === 4 && selectedProgram && selectedProgram?.university?.category === 'direct_iits' && balance < getTotalFee(selectedProgram) && (
            <p className="text-xs text-destructive text-center mt-3">Insufficient wallet balance. Please top up first.</p>
          )}
        </CardContent>
      </Card>

      {/* Confirmation & Edit Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <ShieldAlert className="w-6 h-6 text-amber-500" /> Verify Application Details
            </DialogTitle>
            <DialogDescription>
              Please review all student details, educational history, and uploaded files carefully before submitting.
            </DialogDescription>
          </DialogHeader>

          {selectedProgram && (
            <div className="space-y-6 py-4">
              {/* Basic Details */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-foreground">Basic Profile</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/40 p-4 rounded-xl border text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Student Name</span>
                    <span className="font-semibold text-foreground">{form.studentName}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Email Address</span>
                    <span className="font-semibold text-foreground">{form.studentEmail}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Phone Number</span>
                    <span className="font-semibold text-foreground">{form.studentPhone}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Residential Address</span>
                    <span className="font-semibold text-foreground">{form.studentAddress}</span>
                  </div>
                </div>
              </div>

              {/* Course selection info */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-foreground">Program & Intake Selection</h4>
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-primary">{selectedProgram.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Code: {selectedProgram.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-base text-primary">₹{getTotalFee(selectedProgram).toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{getBillingCycleText(selectedProgram).replace('/', '')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Educational List */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-foreground">Educational History</h4>
                {educationList.length > 0 ? (
                  <div className="space-y-2">
                    {educationList.map((edu, idx) => (
                      <div key={idx} className="bg-muted/10 p-3 rounded-lg border text-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        <div className="col-span-1">
                          <span className="text-xs text-muted-foreground block">Qualification</span>
                          <span className="font-semibold">{edu.qualification}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-xs text-muted-foreground block">Institution</span>
                          <span className="font-medium">{edu.institution}</span>
                        </div>
                        <div className="col-span-1 text-right">
                          <span className="text-xs text-muted-foreground block">Passing / %</span>
                          <span className="font-medium">{edu.passingYear} {edu.percentage ? `· ${edu.percentage}%` : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic bg-muted/15 p-3 rounded-lg border">No educational history credentials provided.</p>
                )}
              </div>

              {/* Uploaded Documents */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-foreground">Uploaded Proofs & Documents</h4>
                {documentList.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {documentList.map((doc, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-muted/10 p-2.5 rounded-lg border text-sm">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate font-medium">{doc.name}</span>
                        </div>
                        <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline font-semibold flex-shrink-0">View</a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic bg-muted/15 p-3 rounded-lg border">No files uploaded.</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 border-t pt-4">
            <Button variant="outline" className="flex items-center gap-1.5" onClick={() => setConfirmOpen(false)}>
              <Edit className="w-4 h-4" /> Edit Details
            </Button>
            <Button className="premium-gradient text-white flex items-center gap-1.5" onClick={handleEnroll} disabled={submitting}>
              <Check className="w-4 h-4" /> Confirm & Submit Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
