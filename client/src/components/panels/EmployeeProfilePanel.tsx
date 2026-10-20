import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  User, Mail, Phone, Briefcase, Building2, Calendar,
  DollarSign, Target, TrendingUp, Star, Plus, Trash2, Edit,
  Save, RefreshCw, Award, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { isAxiosError } from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────
interface KPI {
  id?: string;
  title: string;
  description?: string;
  target: number;
  achieved: number;
  unit: string;
  period: string;
  status: 'on_track' | 'at_risk' | 'achieved' | 'missed';
}

interface KRA {
  id?: string;
  area: string;
  description?: string;
  weightage: number;
  rating?: number;
  remarks?: string;
}

interface SalaryConfig {
  basicSalary?: number;
  allowances?: { hra?: number; da?: number; ta?: number; medical?: number; other?: number };
  deductions?: { pf?: number; esi?: number; tds?: number; other?: number };
  lateDeductionPerMinute?: number;
}

interface ProfileData {
  profile: any;
  user: any;
  salaryConfig: SalaryConfig | null;
  reviews?: Array<{
    id: string;
    rating: number;
    remarks?: string | null;
    createdAt: string;
    reviewer?: { name?: string; role?: string };
  }>;
}

interface EmployeeSummary {
  id: string;
  name?: string;
  designation?: string;
  designationRef?: { title?: string };
  role?: string;
  status?: string;
  email?: string;
  phone?: string;
  userId?: string;
  department?: { name?: string };
  departmentId?: { name?: string };
  subDepartment?: { name?: string; parentDept?: { name?: string } };
  branch?: { name?: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const KPI_STATUS_COLORS: Record<string, string> = {
  on_track: 'bg-blue-100 text-blue-700',
  at_risk: 'bg-yellow-100 text-yellow-700',
  achieved: 'bg-green-100 text-green-700',
  missed: 'bg-red-100 text-red-700',
};

function StarRating({ value, onChange }: { value?: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          className={cn('transition-colors', onChange ? 'cursor-pointer' : 'cursor-default')}
        >
          <Star className={cn('w-4 h-4', n <= (value || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300')} />
        </button>
      ))}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><Icon className="w-4 h-4" /></div>
      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">{title}</h3>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words capitalize">{value == null || value === '' ? '—' : value}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  userId: string | null;
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  readOnly?: boolean;
  employee?: EmployeeSummary;
  adminAccess?: boolean;
}

export function EmployeeProfilePanel({ userId, open, onClose, onOpenChange, readOnly = false, employee, adminAccess = false }: Props) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('overview');

  // Edit states
  const [personalForm, setPersonalForm] = useState<any>({});
  const [employmentForm, setEmploymentForm] = useState<any>({});
  const [salaryForm, setSalaryForm] = useState<any>({});
  const [salaryConfigForm, setSalaryConfigForm] = useState<SalaryConfig>({});
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [kras, setKras] = useState<KRA[]>([]);
  const [reviewForm, setReviewForm] = useState<any>({});
  const [accountForm, setAccountForm] = useState({ name: '', email: '', phone: '', designation: '' });

  // KPI/KRA dialog
  const [kpiDialog, setKpiDialog] = useState(false);
  const [kraDialog, setKraDialog] = useState(false);
  const [editKpi, setEditKpi] = useState<KPI | null>(null);
  const [editKra, setEditKra] = useState<KRA | null>(null);
  const [kpiIdx, setKpiIdx] = useState<number | null>(null);
  const [kraIdx, setKraIdx] = useState<number | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const endpoint = readOnly
        ? `/hr/employee-profiles/${userId}/team`
        : adminAccess
          ? `/hr/employee-profiles/${userId}/admin`
          : `/hr/employee-profiles/${userId}`;
      const res = await api.get(endpoint);
      const d: ProfileData = res.data.data;
      setData(d);
      if (readOnly || adminAccess) {
        try {
          const reviewEndpoint = adminAccess
            ? `/hr/employee-profiles/${userId}/admin/reviews`
            : `/hr/employee-profiles/${userId}/team/reviews`;
          const reviewsResponse = await api.get(reviewEndpoint);
          setData(current => current
            ? { ...current, reviews: reviewsResponse.data.data || [] }
            : current);
        } catch (error: unknown) {
          toast.error(isAxiosError(error)
            ? error.response?.data?.message || error.message
            : 'Failed to load review history');
        }
      }
      const p = d.profile || {};
      const u = d.user || {};
      setAccountForm({
        name: u.name || '',
        email: u.email || '',
        phone: u.phone || '',
        designation: u.designation || '',
      });
      setPersonalForm({
        dateOfBirth: p.dateOfBirth ? p.dateOfBirth.split('T')[0] : '',
        gender: p.gender || '',
        bloodGroup: p.bloodGroup || '',
        address: p.address || '',
        city: p.city || '',
        state: p.state || '',
        pincode: p.pincode || '',
        emergencyName: p.emergencyContact?.name || '',
        emergencyPhone: p.emergencyContact?.phone || '',
        emergencyRelation: p.emergencyContact?.relation || '',
      });
      setEmploymentForm({
        employeeCode: p.employeeCode || u.userId || '',
        joinDate: p.joinDate ? p.joinDate.split('T')[0] : '',
        confirmationDate: p.confirmationDate ? p.confirmationDate.split('T')[0] : '',
        probationEndDate: p.probationEndDate ? p.probationEndDate.split('T')[0] : '',
        employmentType: p.employmentType || 'full_time',
        workLocation: p.workLocation || '',
        designation: u.designation || '',
        phone: u.phone || '',
      });
      setSalaryForm({
        ctc: p.ctc || '',
        basicSalary: p.basicSalary || '',
        bankName: p.bankName || '',
        bankAccountNo: p.bankAccountNo || '',
        ifscCode: p.ifscCode || '',
        panNumber: p.panNumber || '',
      });
      const sc = d.salaryConfig || {};
      setSalaryConfigForm({
        basicSalary: (sc).basicSalary || 0,
        allowances: (sc).allowances || { hra: 0, da: 0, ta: 0, medical: 0, other: 0 },
        deductions: (sc).deductions || { pf: 0, esi: 0, tds: 0, other: 0 },
        lateDeductionPerMinute: (sc).lateDeductionPerMinute || 0,
      });
      setKpis(p.kpis || []);
      setKras(p.kras || []);
      setReviewForm({
        lastReviewDate: p.lastReviewDate ? p.lastReviewDate.split('T')[0] : '',
        nextReviewDate: p.nextReviewDate ? p.nextReviewDate.split('T')[0] : '',
        overallRating: readOnly ? 0 : p.overallRating || 0,
        reviewRemarks: readOnly ? '' : p.reviewRemarks || '',
      });
    } catch (error: unknown) {
      if (readOnly) {
        setData({ user: employee || { id: userId }, profile: null, salaryConfig: null, reviews: [] });
      }
      toast.error(isAxiosError(error)
        ? error.response?.data?.message || error.message
        : 'Failed to load employee profile');
    } finally {
      setLoading(false);
    }
  }, [userId, readOnly, employee, adminAccess]);

  useEffect(() => {
    if (open && userId) { setTab('overview'); fetchProfile(); }
  }, [open, userId, fetchProfile]);

  // ─── Save handlers ────────────────────────────────────────────────────────
  const savePersonal = async () => {
    setSaving(true);
    try {
      await api.put(adminAccess
        ? `/hr/employee-profiles/${userId}/admin`
        : `/hr/employee-profiles/${userId}`, {
        ...(adminAccess ? accountForm : {}),
        dateOfBirth: personalForm.dateOfBirth || undefined,
        gender: personalForm.gender || undefined,
        bloodGroup: personalForm.bloodGroup || undefined,
        address: personalForm.address,
        city: personalForm.city,
        state: personalForm.state,
        pincode: personalForm.pincode,
        emergencyContact: {
          name: personalForm.emergencyName,
          phone: personalForm.emergencyPhone,
          relation: personalForm.emergencyRelation,
        },
      });
      toast.success('Personal info saved');
      fetchProfile();
    } catch { toast.error('Save failed'); } finally { setSaving(false); }
  };

  const saveEmployment = async () => {
    setSaving(true);
    try {
      if (adminAccess) {
        await api.put(`/hr/employee-profiles/${userId}/admin`, {
          phone: accountForm.phone,
          designation: accountForm.designation,
          employeeCode: employmentForm.employeeCode,
          joinDate: employmentForm.joinDate || undefined,
          confirmationDate: employmentForm.confirmationDate || undefined,
          probationEndDate: employmentForm.probationEndDate || undefined,
          employmentType: employmentForm.employmentType,
          workLocation: employmentForm.workLocation,
        });
      } else {
        await Promise.all([
          api.put(`/hr/employee-profiles/${userId}`, {
            employeeCode: employmentForm.employeeCode,
            joinDate: employmentForm.joinDate || undefined,
            confirmationDate: employmentForm.confirmationDate || undefined,
            probationEndDate: employmentForm.probationEndDate || undefined,
            employmentType: employmentForm.employmentType,
            workLocation: employmentForm.workLocation,
          }),
          api.put(`/users/${userId}`, {
            designation: employmentForm.designation,
            phone: employmentForm.phone,
          }),
        ]);
      }
      toast.success('Employment info saved');
      fetchProfile();
    } catch { toast.error('Save failed'); } finally { setSaving(false); }
  };

  const saveSalary = async () => {
    setSaving(true);
    try {
      await api.patch(adminAccess
        ? `/hr/employee-profiles/${userId}/admin/salary`
        : `/hr/employee-profiles/${userId}/salary`, {
        ...salaryForm,
        salaryConfig: salaryConfigForm,
      });
      toast.success('Salary details saved');
      fetchProfile();
    } catch { toast.error('Save failed'); } finally { setSaving(false); }
  };

  const saveKPIs = async () => {
    setSaving(true);
    try {
      await api.patch(adminAccess
        ? `/hr/employee-profiles/${userId}/admin/kpis`
        : `/hr/employee-profiles/${userId}/kpis`, { kpis });
      toast.success('KPIs saved');
    } catch { toast.error('Save failed'); } finally { setSaving(false); }
  };

  const saveKRAs = async () => {
    setSaving(true);
    try {
      await api.patch(adminAccess
        ? `/hr/employee-profiles/${userId}/admin/kras`
        : `/hr/employee-profiles/${userId}/kras`, { kras });
      toast.success('KRAs saved');
    } catch { toast.error('Save failed'); } finally { setSaving(false); }
  };

  const saveReview = async () => {
    setSaving(true);
    try {
      if (readOnly || adminAccess) {
        const response = await api.post(
          adminAccess
            ? `/hr/employee-profiles/${userId}/admin/reviews`
            : `/hr/employee-profiles/${userId}/team/reviews`,
          {
            rating: reviewForm.overallRating,
            remarks: reviewForm.reviewRemarks,
          },
        );
        const savedReview = response.data.data;
        setData(current => current
          ? { ...current, reviews: [savedReview, ...(current.reviews || [])] }
          : current);
        setReviewForm({ overallRating: 0, reviewRemarks: '' });
        toast.success('Review saved');
        return;
      }
      await api.put(`/hr/employee-profiles/${userId}`, reviewForm);
      toast.success('Review saved');
      fetchProfile();
    } catch (error: unknown) {
      toast.error(isAxiosError(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error ? error.message : 'Save failed');
    } finally { setSaving(false); }
  };

  // ─── KPI helpers ──────────────────────────────────────────────────────────
  const openAddKpi = () => { setEditKpi({ title: '', target: 100, achieved: 0, unit: '%', period: '', status: 'on_track' }); setKpiIdx(null); setKpiDialog(true); };
  const openEditKpi = (kpi: KPI, idx: number) => { setEditKpi({ ...kpi }); setKpiIdx(idx); setKpiDialog(true); };
  const saveKpiDialog = () => {
    if (!editKpi) return;
    const updated = [...kpis];
    if (kpiIdx !== null) updated[kpiIdx] = editKpi; else updated.push(editKpi);
    setKpis(updated);
    setKpiDialog(false);
  };
  const removeKpi = (idx: number) => setKpis(kpis.filter((_, i) => i !== idx));

  // ─── KRA helpers ──────────────────────────────────────────────────────────
  const openAddKra = () => { setEditKra({ area: '', weightage: 10, rating: undefined }); setKraIdx(null); setKraDialog(true); };
  const openEditKra = (kra: KRA, idx: number) => { setEditKra({ ...kra }); setKraIdx(idx); setKraDialog(true); };
  const saveKraDialog = () => {
    if (!editKra) return;
    const updated = [...kras];
    if (kraIdx !== null) updated[kraIdx] = editKra; else updated.push(editKra);
    setKras(updated);
    setKraDialog(false);
  };
  const removeKra = (idx: number) => setKras(kras.filter((_, i) => i !== idx));

  const totalKraWeightage = kras.reduce((s, k) => s + (k.weightage || 0), 0);
  const avgKraRating = kras.filter(k => k.rating).length
    ? (kras.reduce((s, k) => s + (k.rating || 0), 0) / kras.filter(k => k.rating).length).toFixed(1)
    : '—';

  const user = data?.user;
  const profile = data?.profile;
  const handleOpenChange = (value: boolean) => {
    if (!value) {
      if (onOpenChange) onOpenChange(false);
      else onClose?.();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-0">
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-5 border-b">
          <SheetHeader>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-xl font-bold truncate">{user?.name || 'Employee Profile'}</SheetTitle>
                <p className="text-sm text-muted-foreground mt-0.5">{user?.designation || user?.designationRef?.title || user?.role?.replace(/_/g, ' ')}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {(user?.department?.name || user?.departmentId?.name) && (
                    <Badge variant="outline" className="text-xs"><Building2 className="w-3 h-3 mr-1" />{user.department?.name || user.departmentId.name}</Badge>
                  )}
                  <Badge className={cn('text-xs', user?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
                    {user?.status?.replace('_', ' ')}
                  </Badge>
                  {profile?.employmentType && (
                    <Badge variant="outline" className="text-xs capitalize">{profile.employmentType.replace('_', ' ')}</Badge>
                  )}
                </div>
              </div>
              {!readOnly && (
                <Button size="sm" variant="ghost" onClick={fetchProfile} disabled={loading}>
                  <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                </Button>
              )}
            </div>
          </SheetHeader>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
          </div>
        ) : readOnly ? (
          <Tabs value={tab} onValueChange={setTab} className="flex flex-col h-full">
            <TabsList className="mx-6 mt-4 justify-start">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="review">Review</TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <TabsContent value="overview" className="space-y-4 mt-0">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Staff and Contact Details</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <ProfileField label="Name" value={user?.name} />
                    <ProfileField label="Employee ID" value={profile?.employeeCode || user?.userId} />
                    <ProfileField label="Email" value={user?.email} />
                    <ProfileField label="Phone" value={user?.phone} />
                    <ProfileField label="Role" value={user?.role?.replace(/_/g, ' ')} />
                    <ProfileField label="Designation" value={user?.designation || user?.designationRef?.title} />
                    <ProfileField label="Department" value={user?.department?.name || user?.subDepartment?.parentDept?.name} />
                    <ProfileField label="Team" value={user?.subDepartment?.name} />
                    <ProfileField label="Branch" value={user?.branch?.name} />
                    <ProfileField label="Status" value={user?.status?.replace(/_/g, ' ')} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Personal Details</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <ProfileField label="Date of Birth" value={profile?.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : undefined} />
                    <ProfileField label="Gender" value={profile?.gender} />
                    <ProfileField label="Blood Group" value={profile?.bloodGroup} />
                    <ProfileField label="Address" value={[profile?.address, profile?.city, profile?.state, profile?.pincode].filter(Boolean).join(', ')} />
                    <ProfileField label="Emergency Contact" value={profile?.emergencyContact?.name} />
                    <ProfileField label="Emergency Phone" value={profile?.emergencyContact?.phone} />
                    <ProfileField label="Emergency Relation" value={profile?.emergencyContact?.relation} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Employment Details</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <ProfileField label="Employment Type" value={profile?.employmentType?.replace(/_/g, ' ')} />
                    <ProfileField label="Employment Status" value={profile?.employmentRole?.replace(/_/g, ' ')} />
                    <ProfileField label="Induction Status" value={profile?.inductionStatus?.replace(/_/g, ' ')} />
                    <ProfileField label="Work Location" value={profile?.workLocation} />
                    <ProfileField label="Join Date" value={profile?.joinDate ? new Date(profile.joinDate).toLocaleDateString() : undefined} />
                    <ProfileField label="Confirmation Date" value={profile?.confirmationDate ? new Date(profile.confirmationDate).toLocaleDateString() : undefined} />
                    <ProfileField label="Probation End Date" value={profile?.probationEndDate ? new Date(profile.probationEndDate).toLocaleDateString() : undefined} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Salary and Bank Details</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <ProfileField label="Annual CTC" value={profile?.ctc != null ? `₹${Number(profile.ctc).toLocaleString()}` : undefined} />
                    <ProfileField label="Monthly Basic Salary" value={profile?.basicSalary != null ? `₹${Number(profile.basicSalary).toLocaleString()}` : undefined} />
                    <ProfileField label="Bank Name" value={profile?.bankName} />
                    <ProfileField label="Account Number" value={profile?.bankAccountNo} />
                    <ProfileField label="IFSC Code" value={profile?.ifscCode} />
                    <ProfileField label="PAN Number" value={profile?.panNumber} />
                    <ProfileField label="Payroll Basic" value={data?.salaryConfig?.basicSalary != null ? `₹${data.salaryConfig.basicSalary.toLocaleString()}` : undefined} />
                    <ProfileField label="Allowances" value={data?.salaryConfig?.allowances ? JSON.stringify(data.salaryConfig.allowances) : undefined} />
                    <ProfileField label="Deductions" value={data?.salaryConfig?.deductions ? JSON.stringify(data.salaryConfig.deductions) : undefined} />
                    <ProfileField label="Late Deduction / Minute" value={data?.salaryConfig?.lateDeductionPerMinute} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Performance Summary</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <ProfileField label="Overall Rating" value={profile?.overallRating} />
                    <ProfileField label="Last Review Date" value={profile?.lastReviewDate ? new Date(profile.lastReviewDate).toLocaleDateString() : undefined} />
                    <ProfileField label="Next Review Date" value={profile?.nextReviewDate ? new Date(profile.nextReviewDate).toLocaleDateString() : undefined} />
                    <ProfileField label="Review Remarks" value={profile?.reviewRemarks} />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="review" className="space-y-4 mt-0">
                <SectionTitle icon={Star} title="Add Staff Review" />
                <div>
                  <Label className="mb-2 block">Rating</Label>
                  <StarRating value={reviewForm.overallRating} onChange={value => setReviewForm({ ...reviewForm, overallRating: value })} />
                </div>
                <div>
                  <Label>Review Remarks</Label>
                  <Textarea rows={4} value={reviewForm.reviewRemarks} onChange={event => setReviewForm({ ...reviewForm, reviewRemarks: event.target.value })} placeholder="Share feedback about this staff member..." />
                </div>
                <Button onClick={saveReview} disabled={saving || !reviewForm.overallRating} className="w-full">
                  <Save className="w-4 h-4 mr-2" />{saving ? 'Saving Review...' : 'Save Review'}
                </Button>
                <SectionTitle icon={Award} title={`Review History (${data?.reviews?.length || 0})`} />
                {!data?.reviews?.length ? (
                  <p className="text-sm text-muted-foreground">No reviews have been added yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.reviews.map(review => (
                      <Card key={review.id}>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <StarRating value={review.rating} />
                            <span className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-sm">{review.remarks || 'No remarks provided.'}</p>
                          <p className="text-xs text-muted-foreground">
                            Rated by <span className="font-medium text-foreground">{review.reviewer?.name || 'Staff member'}</span>
                            {review.reviewer?.role && ` · ${review.reviewer.role.replace(/_/g, ' ')}`}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="flex flex-col h-full">
            <TabsList className="flex-wrap h-auto gap-1 mx-6 mt-4 justify-start bg-transparent border-b rounded-none pb-0">
              {['overview', 'personal', 'employment', 'salary', 'kpi', 'kra', 'review'].map(t => (
                <TabsTrigger key={t} value={t} className="capitalize rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                  {t === 'kpi' ? 'KPI' : t === 'kra' ? 'KRA' : t.charAt(0).toUpperCase() + t.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* ── OVERVIEW ── */}
              <TabsContent value="overview" className="space-y-4 mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card><CardContent className="pt-4 space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Contact</p>
                    <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground" />{user?.email}</div>
                    {user?.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" />{user.phone}</div>}
                  </CardContent></Card>
                  <Card><CardContent className="pt-4 space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Employment</p>
                    <div className="flex items-center gap-2 text-sm"><Briefcase className="w-4 h-4 text-muted-foreground" />{profile?.employeeCode || user?.userId || '—'}</div>
                    {profile?.joinDate && <div className="flex items-center gap-2 text-sm"><Calendar className="w-4 h-4 text-muted-foreground" />Joined {new Date(profile.joinDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
                  </CardContent></Card>
                </div>

                {/* KPI Summary */}
                {kpis.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4" />KPI Summary</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {kpis.map((kpi, i) => {
                        const pct = Math.min(100, Math.round((kpi.achieved / kpi.target) * 100));
                        return (
                          <div key={i}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium">{kpi.title}</span>
                              <span className="text-muted-foreground">{kpi.achieved}/{kpi.target} {kpi.unit}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : 'bg-yellow-500')} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* KRA Summary */}
                {kras.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Award className="w-4 h-4" />KRA Summary · Avg Rating: {avgKraRating}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {kras.map((kra, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                            <div>
                              <p className="text-sm font-medium">{kra.area}</p>
                              <p className="text-xs text-muted-foreground">Weightage: {kra.weightage}%</p>
                            </div>
                            <StarRating value={kra.rating} />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Review info */}
                {(profile?.overallRating || profile?.nextReviewDate) && (
                  <Card>
                    <CardContent className="pt-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Overall Rating</p>
                        <StarRating value={profile.overallRating} />
                      </div>
                      {profile.nextReviewDate && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Next Review</p>
                          <p className="text-sm font-medium">{new Date(profile.nextReviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ── PERSONAL ── */}
              <TabsContent value="personal" className="space-y-4 mt-0">
                {adminAccess && (
                  <>
                    <SectionTitle icon={User} title="Account Information" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>Name</Label><Input value={accountForm.name} onChange={event => setAccountForm({ ...accountForm, name: event.target.value })} /></div>
                      <div><Label>Email</Label><Input type="email" value={accountForm.email} onChange={event => setAccountForm({ ...accountForm, email: event.target.value })} /></div>
                      <div><Label>Phone</Label><Input value={accountForm.phone} onChange={event => setAccountForm({ ...accountForm, phone: event.target.value })} /></div>
                    </div>
                  </>
                )}
                <SectionTitle icon={User} title="Personal Information" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>Date of Birth</Label><Input type="date" value={personalForm.dateOfBirth} onChange={e => setPersonalForm({ ...personalForm, dateOfBirth: e.target.value })} /></div>
                  <div><Label>Gender</Label>
                    <Select value={personalForm.gender} onValueChange={v => setPersonalForm({ ...personalForm, gender: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Blood Group</Label><Input value={personalForm.bloodGroup} onChange={e => setPersonalForm({ ...personalForm, bloodGroup: e.target.value })} placeholder="A+, B-, O+" /></div>
                  <div className="col-span-2"><Label>Address</Label><Input value={personalForm.address} onChange={e => setPersonalForm({ ...personalForm, address: e.target.value })} /></div>
                  <div><Label>City</Label><Input value={personalForm.city} onChange={e => setPersonalForm({ ...personalForm, city: e.target.value })} /></div>
                  <div><Label>State</Label><Input value={personalForm.state} onChange={e => setPersonalForm({ ...personalForm, state: e.target.value })} /></div>
                  <div><Label>Pincode</Label><Input value={personalForm.pincode} onChange={e => setPersonalForm({ ...personalForm, pincode: e.target.value })} /></div>
                </div>
                <SectionTitle icon={AlertCircle} title="Emergency Contact" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><Label>Name</Label><Input value={personalForm.emergencyName} onChange={e => setPersonalForm({ ...personalForm, emergencyName: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={personalForm.emergencyPhone} onChange={e => setPersonalForm({ ...personalForm, emergencyPhone: e.target.value })} /></div>
                  <div><Label>Relation</Label><Input value={personalForm.emergencyRelation} onChange={e => setPersonalForm({ ...personalForm, emergencyRelation: e.target.value })} placeholder="Spouse, Parent..." /></div>
                </div>
                <Button onClick={savePersonal} disabled={saving} className="w-full"><Save className="w-4 h-4 mr-2" />Save Personal Info</Button>
              </TabsContent>

              {/* ── EMPLOYMENT ── */}
              <TabsContent value="employment" className="space-y-4 mt-0">
                <SectionTitle icon={Briefcase} title="Employment Details" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>Employee Code</Label><Input value={employmentForm.employeeCode} onChange={e => setEmploymentForm({ ...employmentForm, employeeCode: e.target.value })} /></div>
                  <div><Label>Designation</Label><Input value={adminAccess ? accountForm.designation : employmentForm.designation} onChange={e => adminAccess ? setAccountForm({ ...accountForm, designation: e.target.value }) : setEmploymentForm({ ...employmentForm, designation: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={adminAccess ? accountForm.phone : employmentForm.phone} onChange={e => adminAccess ? setAccountForm({ ...accountForm, phone: e.target.value }) : setEmploymentForm({ ...employmentForm, phone: e.target.value })} /></div>
                  <div><Label>Employment Type</Label>
                    <Select value={employmentForm.employmentType} onValueChange={v => setEmploymentForm({ ...employmentForm, employmentType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_time">Full Time</SelectItem>
                        <SelectItem value="part_time">Part Time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="intern">Intern</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Join Date</Label><Input type="date" value={employmentForm.joinDate} onChange={e => setEmploymentForm({ ...employmentForm, joinDate: e.target.value })} /></div>
                  <div><Label>Confirmation Date</Label><Input type="date" value={employmentForm.confirmationDate} onChange={e => setEmploymentForm({ ...employmentForm, confirmationDate: e.target.value })} /></div>
                  <div><Label>Probation End Date</Label><Input type="date" value={employmentForm.probationEndDate} onChange={e => setEmploymentForm({ ...employmentForm, probationEndDate: e.target.value })} /></div>
                  <div><Label>Work Location</Label><Input value={employmentForm.workLocation} onChange={e => setEmploymentForm({ ...employmentForm, workLocation: e.target.value })} placeholder="Head Office, Remote..." /></div>
                </div>
                <Button onClick={saveEmployment} disabled={saving} className="w-full"><Save className="w-4 h-4 mr-2" />Save Employment Info</Button>
              </TabsContent>

              {/* ── SALARY ── */}
              <TabsContent value="salary" className="space-y-4 mt-0">
                <SectionTitle icon={DollarSign} title="Salary & Bank Details" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>CTC (Annual ₹)</Label><Input type="number" value={salaryForm.ctc} onChange={e => setSalaryForm({ ...salaryForm, ctc: e.target.value })} /></div>
                  <div><Label>Basic Salary (Monthly ₹)</Label><Input type="number" value={salaryForm.basicSalary} onChange={e => setSalaryForm({ ...salaryForm, basicSalary: e.target.value })} /></div>
                  <div><Label>Bank Name</Label><Input value={salaryForm.bankName} onChange={e => setSalaryForm({ ...salaryForm, bankName: e.target.value })} /></div>
                  <div><Label>Account Number</Label><Input value={salaryForm.bankAccountNo} onChange={e => setSalaryForm({ ...salaryForm, bankAccountNo: e.target.value })} /></div>
                  <div><Label>IFSC Code</Label><Input value={salaryForm.ifscCode} onChange={e => setSalaryForm({ ...salaryForm, ifscCode: e.target.value })} /></div>
                  <div><Label>PAN Number</Label><Input value={salaryForm.panNumber} onChange={e => setSalaryForm({ ...salaryForm, panNumber: e.target.value })} /></div>
                </div>

                <SectionTitle icon={TrendingUp} title="Salary Structure (Payroll Config)" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>Basic (₹/mo)</Label><Input type="number" value={salaryConfigForm.basicSalary || ''} onChange={e => setSalaryConfigForm({ ...salaryConfigForm, basicSalary: Number(e.target.value) })} /></div>
                  <div><Label>HRA (₹)</Label><Input type="number" value={salaryConfigForm.allowances?.hra || ''} onChange={e => setSalaryConfigForm({ ...salaryConfigForm, allowances: { ...salaryConfigForm.allowances, hra: Number(e.target.value) } })} /></div>
                  <div><Label>DA (₹)</Label><Input type="number" value={salaryConfigForm.allowances?.da || ''} onChange={e => setSalaryConfigForm({ ...salaryConfigForm, allowances: { ...salaryConfigForm.allowances, da: Number(e.target.value) } })} /></div>
                  <div><Label>TA (₹)</Label><Input type="number" value={salaryConfigForm.allowances?.ta || ''} onChange={e => setSalaryConfigForm({ ...salaryConfigForm, allowances: { ...salaryConfigForm.allowances, ta: Number(e.target.value) } })} /></div>
                  <div><Label>Medical (₹)</Label><Input type="number" value={salaryConfigForm.allowances?.medical || ''} onChange={e => setSalaryConfigForm({ ...salaryConfigForm, allowances: { ...salaryConfigForm.allowances, medical: Number(e.target.value) } })} /></div>
                  <div><Label>Other Allowance (₹)</Label><Input type="number" value={salaryConfigForm.allowances?.other || ''} onChange={e => setSalaryConfigForm({ ...salaryConfigForm, allowances: { ...salaryConfigForm.allowances, other: Number(e.target.value) } })} /></div>
                  <div><Label>PF Deduction (₹)</Label><Input type="number" value={salaryConfigForm.deductions?.pf || ''} onChange={e => setSalaryConfigForm({ ...salaryConfigForm, deductions: { ...salaryConfigForm.deductions, pf: Number(e.target.value) } })} /></div>
                  <div><Label>ESI (₹)</Label><Input type="number" value={salaryConfigForm.deductions?.esi || ''} onChange={e => setSalaryConfigForm({ ...salaryConfigForm, deductions: { ...salaryConfigForm.deductions, esi: Number(e.target.value) } })} /></div>
                  <div><Label>TDS (₹)</Label><Input type="number" value={salaryConfigForm.deductions?.tds || ''} onChange={e => setSalaryConfigForm({ ...salaryConfigForm, deductions: { ...salaryConfigForm.deductions, tds: Number(e.target.value) } })} /></div>
                  <div><Label>Late Deduction (₹/min)</Label><Input type="number" step="0.01" value={salaryConfigForm.lateDeductionPerMinute || ''} onChange={e => setSalaryConfigForm({ ...salaryConfigForm, lateDeductionPerMinute: Number(e.target.value) })} /></div>
                </div>

                {/* Gross / Net preview */}
                {(salaryConfigForm.basicSalary || 0) > 0 && (() => {
                  const gross = (salaryConfigForm.basicSalary || 0) + Object.values(salaryConfigForm.allowances || {}).reduce((s, v) => s + (v || 0), 0);
                  const net = gross - Object.values(salaryConfigForm.deductions || {}).reduce((s, v) => s + (v || 0), 0);
                  return (
                    <div className="flex gap-4 p-3 rounded-xl bg-muted/50 text-sm">
                      <div><span className="text-muted-foreground">Gross: </span><span className="font-bold">₹{gross.toLocaleString()}</span></div>
                      <div><span className="text-muted-foreground">Net: </span><span className="font-bold text-green-600">₹{net.toLocaleString()}</span></div>
                    </div>
                  );
                })()}

                <Button onClick={saveSalary} disabled={saving} className="w-full"><Save className="w-4 h-4 mr-2" />Save Salary Details</Button>
              </TabsContent>

              {/* ── KPI ── */}
              <TabsContent value="kpi" className="space-y-4 mt-0">
                <div className="flex items-center justify-between">
                  <SectionTitle icon={Target} title={`KPIs (${kpis.length})`} />
                  <Button size="sm" onClick={openAddKpi}><Plus className="w-4 h-4 mr-1" />Add KPI</Button>
                </div>
                {kpis.length === 0 ? (
                  <div className="border-2 border-dashed rounded-xl p-10 text-center text-muted-foreground">
                    <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No KPIs defined yet. Add the first one.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {kpis.map((kpi, i) => {
                      const pct = Math.min(100, Math.round((kpi.achieved / kpi.target) * 100));
                      return (
                        <Card key={i}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-semibold text-sm">{kpi.title}</p>
                                {kpi.description && <p className="text-xs text-muted-foreground mt-0.5">{kpi.description}</p>}
                                <p className="text-xs text-muted-foreground mt-0.5">Period: {kpi.period}</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Badge className={cn('text-[10px]', KPI_STATUS_COLORS[kpi.status])}>{kpi.status.replace('_', ' ')}</Badge>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditKpi(kpi, i)}><Edit className="w-3.5 h-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeKpi(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : 'bg-yellow-500')} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs font-bold min-w-[80px] text-right">{kpi.achieved}/{kpi.target} {kpi.unit} ({pct}%)</span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
                {kpis.length > 0 && <Button onClick={saveKPIs} disabled={saving} className="w-full"><Save className="w-4 h-4 mr-2" />Save KPIs</Button>}
              </TabsContent>

              {/* ── KRA ── */}
              <TabsContent value="kra" className="space-y-4 mt-0">
                <div className="flex items-center justify-between">
                  <SectionTitle icon={Award} title={`KRAs (${kras.length})`} />
                  <Button size="sm" onClick={openAddKra}><Plus className="w-4 h-4 mr-1" />Add KRA</Button>
                </div>
                {totalKraWeightage !== 100 && kras.length > 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Total weightage is {totalKraWeightage}% — should be 100%
                  </div>
                )}
                {kras.length === 0 ? (
                  <div className="border-2 border-dashed rounded-xl p-10 text-center text-muted-foreground">
                    <Award className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No KRAs defined yet. Add key result areas.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {kras.map((kra, i) => (
                      <Card key={i}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm">{kra.area}</p>
                                <Badge variant="outline" className="text-[10px]">{kra.weightage}%</Badge>
                              </div>
                              {kra.description && <p className="text-xs text-muted-foreground mt-0.5">{kra.description}</p>}
                              <div className="flex items-center gap-3 mt-2">
                                <StarRating value={kra.rating} onChange={v => { const u = [...kras]; u[i] = { ...u[i], rating: v }; setKras(u); }} />
                                {kra.remarks && <p className="text-xs text-muted-foreground italic">"{kra.remarks}"</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditKra(kra, i)}><Edit className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeKra(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                {kras.length > 0 && <Button onClick={saveKRAs} disabled={saving} className="w-full"><Save className="w-4 h-4 mr-2" />Save KRAs</Button>}
              </TabsContent>

              {/* ── REVIEW ── */}
              <TabsContent value="review" className="space-y-4 mt-0">
                <SectionTitle icon={Star} title="Performance Review" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>Last Review Date</Label><Input type="date" value={reviewForm.lastReviewDate} onChange={e => setReviewForm({ ...reviewForm, lastReviewDate: e.target.value })} /></div>
                  <div><Label>Next Review Date</Label><Input type="date" value={reviewForm.nextReviewDate} onChange={e => setReviewForm({ ...reviewForm, nextReviewDate: e.target.value })} /></div>
                </div>
                <div>
                  <Label className="mb-2 block">Overall Rating</Label>
                  <StarRating value={reviewForm.overallRating} onChange={v => setReviewForm({ ...reviewForm, overallRating: v })} />
                </div>
                <div>
                  <Label>Review Remarks</Label>
                  <Textarea rows={4} value={reviewForm.reviewRemarks} onChange={e => setReviewForm({ ...reviewForm, reviewRemarks: e.target.value })} placeholder="Performance summary, achievements, areas of improvement..." />
                </div>
                <Button onClick={saveReview} disabled={saving} className="w-full"><Save className="w-4 h-4 mr-2" />Save Review</Button>
                {(adminAccess || readOnly) && (
                  <div className="space-y-3 pt-3">
                    <SectionTitle icon={Award} title={`Review History (${data?.reviews?.length || 0})`} />
                    {!data?.reviews?.length ? (
                      <p className="text-sm text-muted-foreground">No reviews have been added yet.</p>
                    ) : data.reviews.map(review => (
                      <Card key={review.id}>
                        <CardContent className="space-y-2 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <StarRating value={review.rating} />
                            <span className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-sm">{review.remarks || 'No remarks provided.'}</p>
                          <p className="text-xs text-muted-foreground">
                            Rated by <span className="font-medium text-foreground">{review.reviewer?.name || 'Staff member'}</span>
                            {review.reviewer?.role && ` · ${review.reviewer.role.replace(/_/g, ' ')}`}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

            </div>
          </Tabs>
        )}

        {/* KPI Dialog */}
        <Dialog open={kpiDialog} onOpenChange={setKpiDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{kpiIdx !== null ? 'Edit KPI' : 'Add KPI'}</DialogTitle></DialogHeader>
            {editKpi && (
              <div className="space-y-3 py-2">
                <div><Label>Title *</Label><Input value={editKpi.title} onChange={e => setEditKpi({ ...editKpi, title: e.target.value })} /></div>
                <div><Label>Description</Label><Input value={editKpi.description || ''} onChange={e => setEditKpi({ ...editKpi, description: e.target.value })} /></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div><Label>Target</Label><Input type="number" value={editKpi.target} onChange={e => setEditKpi({ ...editKpi, target: Number(e.target.value) })} /></div>
                  <div><Label>Achieved</Label><Input type="number" value={editKpi.achieved} onChange={e => setEditKpi({ ...editKpi, achieved: Number(e.target.value) })} /></div>
                  <div><Label>Unit</Label><Input value={editKpi.unit} onChange={e => setEditKpi({ ...editKpi, unit: e.target.value })} placeholder="%, ₹, count" /></div>
                </div>
                <div><Label>Period</Label><Input value={editKpi.period} onChange={e => setEditKpi({ ...editKpi, period: e.target.value })} placeholder="Q1 2025, FY 2025..." /></div>
                <div><Label>Status</Label>
                  <Select value={editKpi.status} onValueChange={v => setEditKpi({ ...editKpi, status: v as KPI['status'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on_track">On Track</SelectItem>
                      <SelectItem value="at_risk">At Risk</SelectItem>
                      <SelectItem value="achieved">Achieved</SelectItem>
                      <SelectItem value="missed">Missed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setKpiDialog(false)}>Cancel</Button>
              <Button onClick={saveKpiDialog} disabled={!editKpi?.title || !editKpi?.period}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* KRA Dialog */}
        <Dialog open={kraDialog} onOpenChange={setKraDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{kraIdx !== null ? 'Edit KRA' : 'Add KRA'}</DialogTitle></DialogHeader>
            {editKra && (
              <div className="space-y-3 py-2">
                <div><Label>Key Result Area *</Label><Input value={editKra.area} onChange={e => setEditKra({ ...editKra, area: e.target.value })} placeholder="e.g. Customer Satisfaction, Revenue Growth" /></div>
                <div><Label>Description</Label><Input value={editKra.description || ''} onChange={e => setEditKra({ ...editKra, description: e.target.value })} /></div>
                <div><Label>Weightage (%)</Label><Input type="number" min={1} max={100} value={editKra.weightage} onChange={e => setEditKra({ ...editKra, weightage: Number(e.target.value) })} /></div>
                <div>
                  <Label className="mb-2 block">Rating (1–5)</Label>
                  <StarRating value={editKra.rating} onChange={v => setEditKra({ ...editKra, rating: v })} />
                </div>
                <div><Label>Remarks</Label><Textarea rows={2} value={editKra.remarks || ''} onChange={e => setEditKra({ ...editKra, remarks: e.target.value })} /></div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setKraDialog(false)}>Cancel</Button>
              <Button onClick={saveKraDialog} disabled={!editKra?.area}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </SheetContent>
    </Sheet>
  );
}
