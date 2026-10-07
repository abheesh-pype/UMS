import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Edit, Trash2, MapPin, Upload, Download, AlertTriangle, CheckCircle2, Copy, Search, Settings, ChevronDown, ChevronRight, Building2, GitBranch, ArrowLeft, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import * as XLSX from 'xlsx';

interface AssignableOpsUser {
  id: string;
  name: string;
  role: string;
  departmentId?: string | null;
  subDepartmentId?: string | null;
  designationId?: string | null;
  reportingTo?: string | null;
}

export function StudyCentersPanel({ salesMode = false, operationsMode = false, financeMode = false, universityAdminMode = false }: { salesMode?: boolean; operationsMode?: boolean; financeMode?: boolean; universityAdminMode?: boolean }) {
  const { user } = useAuth();
  const canWrite = ['org_admin', 'superadmin', 'ops_admin', 'ops_sub_admin', 'sales_admin', 'bde', 'employee'].includes(user?.role || '');
  const canCreateCenter = (operationsMode && user?.role === 'ops_admin')
    || (salesMode && ['sales_admin', 'bde'].includes(user?.role || ''))
    || (universityAdminMode && user?.role === 'org_admin');
  const canViewOperationsCenters = operationsMode
    && ['ops_admin', 'ops_sub_admin', 'employee'].includes(user?.role || '');
  const isFinanceEmployee = user?.role === 'employee'
    && (((user as any)?.department?.type || (user as any)?.subDepartment?.parentDept?.type) === 'finance');
  const canViewFinanceCenters = financeMode
    && ['finance_admin', 'finance_sub_admin'].includes(user?.role || '') || financeMode && isFinanceEmployee;
  const [centers, setCenters] = useState<any[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<any | null>(null);
  const [selectedCenterStatus, setSelectedCenterStatus] = useState('');
  const [savingCenterStatus, setSavingCenterStatus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [team, setTeam] = useState<any[]>([]);
  const [assignableOpsUsers, setAssignableOpsUsers] = useState<AssignableOpsUser[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    contact: '',
    email: '',
    status: 'pending',
    referredById: '',
    branchName: '',
    coordinatorName: ''
  });
  const [universities, setUniversities] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [operationsCenterView, setOperationsCenterView] = useState<'progress' | 'rejected'>('progress');
  const [financeCenterView, setFinanceCenterView] = useState<'active' | 'rejected'>('active');
  const [universityFilter, setUniversityFilter] = useState('');
  // Branch-level settings state
  const [branchConfigOpen, setBranchConfigOpen] = useState(false);
  const [branchConfigName, setBranchConfigName] = useState('');
  const [branchAllowInternalMarks, setBranchAllowInternalMarks] = useState(false);
  const [branchFieldConfig, setBranchFieldConfig] = useState<Record<string, 'required'|'optional'|'hidden'>>({});
  // Expanded branches state
  const [expandedBranches, setExpandedBranches] = useState<Record<string, boolean>>({});
  const [creds, setCreds] = useState<{ userId: string; password: string } | null>(null);
  const [showCreds, setShowCreds] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importCenters, setImportCenters] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any | null>(null);
  const [importReferredById, setImportReferredById] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);

  // Form Config customization state
  const [configOpen, setConfigOpen] = useState(false);
  const [configCenterId, setConfigCenterId] = useState<string | null>(null);
  const [fieldConfig, setFieldConfig] = useState<Record<string, 'required' | 'optional' | 'hidden'>>({});
  const [allowInternalMarks, setAllowInternalMarks] = useState(false);

  const CUSTOMISABLE_FIELDS = [
    { key: 'abcId', label: 'ABCID' },
    { key: 'debId', label: 'DEBID' },
    { key: 'dob', label: 'Date of Birth (DOB)' },
    { key: 'religion', label: 'Religion' },
    { key: 'caste', label: 'Caste' },
    { key: 'fatherName', label: "Father's Name" },
    { key: 'motherName', label: "Mother's Name" },
    { key: 'parentMobile', label: "Parent's Mobile Number" },
    { key: 'studentPhoto', label: 'Student Photo' },
    { key: 'pincode', label: 'Pincode' },
    { key: 'alternativePhone', label: 'Alternative Phone' },
    { key: 'doc_aadhaar', label: 'Document: Aadhaar Card' },
    { key: 'doc_10th', label: 'Document: 10th Certificate' },
    { key: 'doc_12th', label: 'Document: 12th Certificate' },
    { key: 'doc_degree', label: 'Document: Degree Certificate' }
  ];

  const handleOpenConfig = (c: any) => {
    setConfigCenterId(c.id);
    setAllowInternalMarks(!!c.allowInternalMarks);
    let currentConfig: Record<string, any> = {};
    if (c.customEnrollmentFields) {
      currentConfig = typeof c.customEnrollmentFields === 'string' 
        ? JSON.parse(c.customEnrollmentFields) 
        : c.customEnrollmentFields;
    }
    const initialConfig: Record<string, any> = {};
    CUSTOMISABLE_FIELDS.forEach(f => {
      initialConfig[f.key] = (currentConfig)[f.key] || 'optional';
    });
    setFieldConfig(initialConfig as Record<string, 'hidden' | 'required' | 'optional'>);
    setConfigOpen(true);
  };

  const handleSaveConfig = async () => {
    if (!configCenterId) return;
    try {
      await api.put(`/operations/centers/${configCenterId}`, {
        customEnrollmentFields: fieldConfig,
        allowInternalMarks
      });
      toast.success('Enrollment form customization saved successfully!');
      setConfigOpen(false);
      fetchCenters();
    } catch (err: any) {
      toast.error('Failed to save configuration');
    }
  };

  const fetchCenters = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (canViewOperationsCenters) {
        params.set('status', operationsCenterView);
      } else if (canViewFinanceCenters) {
        params.set('status', financeCenterView);
      } else if (statusFilter && statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (universityFilter && universityFilter !== 'all') params.set('universityId', universityFilter);
      const query = params.toString();
      const q = query ? `?${query}` : '';
      const res = await api.get(`/operations/centers${q}`);
      setCenters(res.data.data || []);
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Failed to load study centers');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, universityFilter, operationsCenterView, financeCenterView, canViewOperationsCenters, canViewFinanceCenters]);

  const fetchUniversities = useCallback(async () => {
    try {
      const res = await api.get('/operations/universities');
      setUniversities(res.data.data || []);
    } catch (err) {
    }
  }, []);

  useEffect(() => {
    fetchCenters();
    fetchUniversities();
    api.get('/sales/team-members')
      .then(res => setTeam(res.data.data || []))
      .catch(() => setTeam([]));
    if (operationsMode && user?.role === 'ops_admin') {
      Promise.all([
        api.get('/users'),
        api.get('/departments'),
        api.get('/sub-departments'),
        api.get('/org/designations'),
      ])
        .then(([usersRes, departmentsRes, subDepartmentsRes, designationsRes]) => {
          const users = (usersRes.data.data || []) as AssignableOpsUser[];
          const departments = (departmentsRes.data.data || []) as Array<{ id: string; type?: string | null }>;
          const subDepartments = (subDepartmentsRes.data.data || []) as Array<{ id: string; parentDeptId: string | { id: string } }>;
          const designations = (designationsRes.data.data || []) as Array<{
            id: string;
            departmentId?: string | { id: string } | null;
            subDepartmentId?: string | { id: string } | null;
            parentDesignationId?: string | { id: string } | null;
            filledBy?: Array<{ id: string }>;
          }>;
          const getRelationId = (value?: string | { id: string } | null) =>
            typeof value === 'string' ? value : value?.id || '';
          const operationsDepartmentIds = new Set(
            departments
              .filter(department => department.type?.trim().toLowerCase() === 'operations')
              .map(department => department.id)
          );
          const subDepartmentParentIds = new Map<string, string>();
          subDepartments.forEach(subDepartment => {
            subDepartmentParentIds.set(subDepartment.id, getRelationId(subDepartment.parentDeptId));
          });
          const operationsSubDepartmentIds = new Set(
            [...subDepartmentParentIds.entries()]
              .filter(([, parentDepartmentId]) => operationsDepartmentIds.has(parentDepartmentId))
              .map(([subDepartmentId]) => subDepartmentId)
          );

          const admin = users.find(candidate => candidate.id === user.id);
          const getUserDepartmentId = (candidate?: AssignableOpsUser) => {
            if (!candidate) return '';
            return candidate.departmentId
              || subDepartmentParentIds.get(candidate.subDepartmentId || '')
              || getRelationId(designations.find(node => node.id === candidate.designationId)?.departmentId)
              || subDepartmentParentIds.get(getRelationId(designations.find(node => node.id === candidate.designationId)?.subDepartmentId))
              || '';
          };
          const adminDepartmentId = getUserDepartmentId(admin);
          const subordinateIds = new Set<string>();
          let managerIds = [user.id];
          while (managerIds.length > 0) {
            const nextReports = users
              .filter(candidate => candidate.reportingTo && managerIds.includes(candidate.reportingTo))
              .map(candidate => candidate.id)
              .filter(id => !subordinateIds.has(id));
            nextReports.forEach(id => subordinateIds.add(id));
            managerIds = nextReports;
          }

          const adminDesignationId = admin?.designationId || '';
          const subordinateDesignationIds = new Set<string>();
          let parentDesignationIds = adminDesignationId ? [adminDesignationId] : [];
          while (parentDesignationIds.length > 0) {
            const childDesignations = designations
              .filter(node => parentDesignationIds.includes(getRelationId(node.parentDesignationId)))
              .map(node => node.id)
              .filter(id => !subordinateDesignationIds.has(id));
            childDesignations.forEach(id => subordinateDesignationIds.add(id));
            parentDesignationIds = childDesignations;
          }
          designations
            .filter(node => subordinateDesignationIds.has(node.id))
            .flatMap(node => node.filledBy || [])
            .forEach(assignedUser => subordinateIds.add(assignedUser.id));

          setAssignableOpsUsers(users.filter(candidate => {
            const candidateDepartmentId = getUserDepartmentId(candidate);
            const belongsToOperations = operationsDepartmentIds.has(candidateDepartmentId)
              && (!adminDepartmentId || candidateDepartmentId === adminDepartmentId)
              && (!candidate.subDepartmentId || operationsSubDepartmentIds.has(candidate.subDepartmentId));
            const isAssignableRole = candidate.role === 'ops_sub_admin' || candidate.role === 'employee';
            return subordinateIds.has(candidate.id) && belongsToOperations && isAssignableRole;
          }));
        })
        .catch(() => setAssignableOpsUsers([]));
    }
  }, [fetchCenters, fetchUniversities, operationsMode, user?.id, user?.role]);

  const downloadTemplate = () => {
    const templateData = [
      {
        Name: 'Delhi Study Center',
        Code: 'DSC001',
        Email: 'delhi.admin@example.com',
        Contact: '+91-9876543210',
        City: 'New Delhi',
        State: 'Delhi',
        Address: '123 Karol Bagh'
      },
      {
        Name: 'Mumbai Study Center',
        Code: 'MSC001',
        Email: 'mumbai.admin@example.com',
        Contact: '+91-9876543211',
        City: 'Mumbai',
        State: 'Maharashtra',
        Address: '456 Andheri West'
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, 'study_centers_import_template.xlsx');
  };

  const salesTeam = team.filter((m: any) =>
    ['sales_admin', 'bde', 'employee', 'ops_admin'].includes(m.role)
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const parsedData: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (parsedData.length === 0) {
          toast.error('The uploaded file is empty');
          return;
        }

        // Map excel headers to fields
        const mappedCenters = parsedData.map((row: any) => ({
          name: row.Name || row.name || '',
          code: row.Code || row.code || '',
          email: row.Email || row.email || '',
          contact: row.Contact || row.contact || '',
          city: row.City || row.city || '',
          state: row.State || row.state || '',
          address: row.Address || row.address || ''
        }));

        // Client-side validation
        const errors: any[] = [];
        const codes = new Set();
        const emails = new Set();

        mappedCenters.forEach((c, index) => {
          const rowNum = index + 2;
          if (!c.name) errors.push({ row: rowNum, message: 'Name is missing' });
          if (!c.code) {
            errors.push({ row: rowNum, message: 'Code is missing' });
          } else {
            const codeStr = c.code.toString().trim().toUpperCase();
            if (codes.has(codeStr)) {
              errors.push({ row: rowNum, message: `Duplicate Code in sheet: ${c.code}` });
            }
            codes.add(codeStr);
          }

          if (!c.email) {
            errors.push({ row: rowNum, message: 'Email is missing' });
          } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(c.email)) {
              errors.push({ row: rowNum, message: `Invalid email format: ${c.email}` });
            }
            if (emails.has(c.email.toLowerCase())) {
              errors.push({ row: rowNum, message: `Duplicate Email in sheet: ${c.email}` });
            }
            emails.add(c.email.toLowerCase());
          }
        });

        setImportCenters(mappedCenters);
        setImportErrors(errors);
        setImportSummary(null);
      } catch (err: any) {
        toast.error('Failed to parse Excel file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportSubmit = async () => {
    if (importCenters.length === 0) return;
    setImporting(true);
    try {
      const centersWithSales = importCenters.map(c => ({
        ...c,
        referredById: importReferredById || null
      }));
      const res = await api.post('/operations/centers/bulk-import', { centers: centersWithSales });
      setImportSummary(res.data.data);
      toast.success(`Successfully imported ${res.data.data.successCount} study centers`);
      fetchCenters();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bulk import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        referredById: formData.referredById === '__none__' || !formData.referredById ? null : formData.referredById
      };
      if (editingId) {
        await api.put(`/operations/centers/${editingId}`, payload);
        toast.success('Center updated');
      } else {
        const res = await api.post('/operations/centers', payload);
        if (res.data.data.credentials) {
          setCreds(res.data.data.credentials);
          setShowCreds(true);
        }
        toast.success('Center created successfully');
      }
      setDialogOpen(false);
      resetForm();
      fetchCenters();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save center');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleEdit = (c: any) => {
    setEditingId(c.id);
    setFormData({
      name: c.name || '',
      code: c.code || '',
      address: c.address || '',
      contact: c.contact || '',
      email: c.email || '',
      status: c.status || 'pending',
      referredById: c.referredBy || '',
      branchName: c.branchName || '',
      coordinatorName: c.coordinatorName || ''
    });
    setDialogOpen(true);
  };

  const handleOpenDetails = (center: any) => {
    setSelectedCenter(center);
    setSelectedCenterStatus(center.status || 'pending_verification');
  };

  const handleSaveCenterStatus = async () => {
    if (!selectedCenter || !selectedCenterStatus) return;
    setSavingCenterStatus(true);
    try {
      if (selectedCenterStatus === 'active') {
        await api.put(`/operations/centers/${selectedCenter.id}/approve`);
      } else {
        await api.put(`/operations/centers/${selectedCenter.id}`, { status: selectedCenterStatus });
      }
      const updatedCenter = { ...selectedCenter, status: selectedCenterStatus };
      setSelectedCenter(updatedCenter);
      setCenters(previous => previous.map(center => center.id === updatedCenter.id ? updatedCenter : center));
      toast.success('Study center status updated');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update study center status');
    } finally {
      setSavingCenterStatus(false);
    }
  };

  const handleAssignCenter = async (center: { id: string }, userId: string) => {
    const assignedUser = assignableOpsUsers.find(candidate => candidate.id === userId);
    try {
      await api.put(`/operations/centers/${center.id}`, {
        assignedOperationsUserId: userId === '__none__' ? null : userId,
      });
      setCenters(previous => previous.map(item => item.id === center.id
        ? { ...item, assignedOperationsUserId: userId === '__none__' ? null : userId, assignedOperationsUser: assignedUser || null }
        : item));
      toast.success(userId === '__none__' ? 'Study center unassigned' : 'Study center assigned');
    } catch {
      toast.error('Failed to assign study center');
    }
  };

  const handleOpenBranchConfig = (branchName: string, centersInBranch: any[]) => {
    setBranchConfigName(branchName);
    const first = centersInBranch[0] || {};
    setBranchAllowInternalMarks(!!first.allowInternalMarks);
    const currentConfig = typeof first.customEnrollmentFields === 'string'
      ? (JSON.parse(first.customEnrollmentFields) || {})
      : (first.customEnrollmentFields || {});
    const cfg: Record<string, any> = {};
    CUSTOMISABLE_FIELDS.forEach(f => { cfg[f.key] = currentConfig[f.key] || 'optional'; });
    setBranchFieldConfig(cfg);
    setBranchConfigOpen(true);
  };

  const handleSaveBranchConfig = async () => {
    try {
      const res = await api.put('/operations/centers/branch-settings', {
        branchName: branchConfigName,
        allowInternalMarks: branchAllowInternalMarks,
        customEnrollmentFields: branchFieldConfig
      });
      toast.success(res.data.message || 'Branch settings saved!');
      setBranchConfigOpen(false);
      fetchCenters();
    } catch (err: any) {
      toast.error('Failed to save branch settings');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this study center?')) return;
    try {
      await api.delete(`/operations/centers/${id}`);
      fetchCenters();
    } catch (_err) {
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: '', code: '', address: '', contact: '', email: '', status: 'pending', referredById: '', branchName: '', coordinatorName: '' });
  };

  // Helper to get center's effective branch name
  const getEffectiveBranch = (c: any) => {
    return c.referrer?.branch?.name || c.referrer?.designationRef?.branch?.name || c.branchName?.trim() || '';
  };

  // Derive unique branch names for datalist autocomplete
  const existingBranchNames = useMemo(() =>
    [...new Set(centers.map((c: any) => getEffectiveBranch(c)).filter(Boolean))]
  , [centers]);

  // Group centers by branchName
  const branchGroups = useMemo(() => {
    const filtered = centers.filter((c: any) => {
      const q = searchQuery.toLowerCase();
      const effBranch = getEffectiveBranch(c);
      return !q || c.name?.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) || c.address?.toLowerCase().includes(q) ||
        effBranch.toLowerCase().includes(q) || c.referrer?.name?.toLowerCase().includes(q);
    });
    const groups: Record<string, any[]> = {};
    filtered.forEach((c: any) => {
      const key = getEffectiveBranch(c) || '__unassigned__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    return groups;
  }, [centers, searchQuery]);

  const selectedCenterUniversities = selectedCenter
    ? universities.filter(university => (selectedCenter.universityIds || []).includes(university.id))
    : [];

  if (selectedCenter) {
    const effectiveBranch = getEffectiveBranch(selectedCenter);
    const canViewCredentials = ['org_admin', 'superadmin', 'ceo'].includes(user?.role || '');
    const paymentProof = selectedCenter.paymentProof as { url?: string; uploadedAt?: string; remarks?: string } | null | undefined;
    const rawPaymentProofUrl = typeof selectedCenter.paymentProof === 'string'
      ? selectedCenter.paymentProof
      : paymentProof?.url || '';
    const paymentProofUrl = rawPaymentProofUrl.startsWith('http') || rawPaymentProofUrl.startsWith('data:')
      ? rawPaymentProofUrl
      : rawPaymentProofUrl.startsWith('/')
        ? `${window.location.origin}${rawPaymentProofUrl}`
        : `${window.location.origin}/${rawPaymentProofUrl.replace(/^\.?\//, '')}`;
    const isPaymentImage = /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(paymentProofUrl);
    const detailRows = [
      ['Center Name', selectedCenter.name],
      ['Center Code', selectedCenter.code],
      ['Email', selectedCenter.email],
      ['Contact', selectedCenter.contact],
      ['Coordinator', selectedCenter.coordinatorName],
      ['Address', selectedCenter.address],
      ['City', selectedCenter.city],
      ['State', selectedCenter.state],
      ['Branch', effectiveBranch],
      ['Created', selectedCenter.createdAt ? new Date(selectedCenter.createdAt).toLocaleString() : undefined],
      ['Last Updated', selectedCenter.updatedAt ? new Date(selectedCenter.updatedAt).toLocaleString() : undefined],
    ];

    return (
      <>
        {proofPreviewUrl && (
          <Dialog open={!!proofPreviewUrl} onOpenChange={(open) => !open && setProofPreviewUrl(null)}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden border-0 bg-transparent shadow-none">
              <div className="rounded-2xl border bg-background p-2 shadow-2xl">
                <img
                  src={proofPreviewUrl}
                  alt="Payment proof preview"
                  className="max-h-[80vh] w-full rounded-xl object-contain bg-muted"
                />
              </div>
            </DialogContent>
          </Dialog>
        )}

        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <Button variant="ghost" className="px-0 mb-2" onClick={() => setSelectedCenter(null)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Study Centers
              </Button>
              <h2 className="text-2xl font-bold">{selectedCenter.name}</h2>
              <p className="text-muted-foreground">Complete study center details and university associations</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedCenterStatus} onValueChange={setSelectedCenterStatus} disabled={operationsMode || financeMode}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue placeholder="Change status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="pending_verification">Pending Verification</SelectItem>
                  <SelectItem value="pending_payment">Pending Payment</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              {!financeMode && (
                <Button onClick={handleSaveCenterStatus} disabled={operationsMode || savingCenterStatus || selectedCenterStatus === selectedCenter.status}>
                  {savingCenterStatus ? 'Saving...' : 'Save Status'}
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Study Center Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {detailRows.map(([label, value]) => (
                  <div key={label} className="border-b pb-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium text-sm mt-1">{value || 'Not provided'}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Current Status</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Badge className="text-sm">{selectedCenter.status || 'Not provided'}</Badge>
                <div>
                  <p className="text-xs text-muted-foreground">Internal Marks</p>
                  <p className="font-medium text-sm mt-1">{selectedCenter.allowInternalMarks ? 'Enabled' : 'Disabled'}</p>
                </div>
                {canViewCredentials && selectedCenter.credentials && (
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                    <p className="text-sm font-semibold">Center Credentials</p>
                    <p className="text-xs"><span className="text-muted-foreground">User ID:</span> {selectedCenter.credentials.userId || 'Not provided'}</p>
                    <p className="text-xs"><span className="text-muted-foreground">Password:</span> {selectedCenter.credentials.password || 'Not provided'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Linked Universities ({selectedCenterUniversities.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedCenterUniversities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No universities are assigned to this study center.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedCenterUniversities.map(university => (
                    <div key={university.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{university.name}</p>
                          <p className="text-xs text-muted-foreground">Code: {university.code}</p>
                        </div>
                        <Badge variant="outline">{university.status || 'Not provided'}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">{university.address || 'Address not provided'}</p>
                      <p className="text-xs text-muted-foreground">Category: {university.category || 'Not provided'}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Assignments and Configuration</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Assigned University IDs</p><p className="font-medium mt-1">{(selectedCenter.universityIds || []).length || 'None'}</p></div>
              <div><p className="text-xs text-muted-foreground">Assigned Program IDs</p><p className="font-medium mt-1">{(selectedCenter.programIds || []).length || 'None'}</p></div>
              <div><p className="text-xs text-muted-foreground">Enrollment Field Configuration</p><p className="font-medium mt-1">{selectedCenter.customEnrollmentFields ? 'Configured' : 'Default'}</p></div>
              <div><p className="text-xs text-muted-foreground">Operations Remarks</p><p className="font-medium mt-1">{selectedCenter.opsRemarks || 'None'}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Payment Status</p>
                  <Badge className="mt-2">{selectedCenter.status || 'Not provided'}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Submitted On</p>
                  <p className="font-medium text-sm mt-2">
                    {paymentProof?.uploadedAt ? new Date(paymentProof.uploadedAt).toLocaleString() : 'Not submitted'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payment Review Remarks</p>
                  <p className="font-medium text-sm mt-2">{selectedCenter.paymentRemarks || 'No review remarks'}</p>
                </div>
              </div>

              <div className="border-t pt-5">
                <p className="text-sm font-semibold mb-3">Submitted Payment Proof</p>
                {paymentProofUrl ? (
                  <div className="space-y-3">
                    {isPaymentImage && (
                      <button
                        type="button"
                        onClick={() => setProofPreviewUrl(paymentProofUrl)}
                        className="block w-fit cursor-pointer rounded-lg border bg-muted p-1 hover:opacity-90 transition-opacity"
                      >
                        <img
                          src={paymentProofUrl}
                          alt={`Payment proof for ${selectedCenter.name}`}
                          className="max-h-96 max-w-full rounded-md border object-contain bg-muted"
                        />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setProofPreviewUrl(paymentProofUrl)}
                      className="inline-flex items-center text-sm text-primary hover:underline"
                    >
                      {isPaymentImage ? 'Open payment image' : 'Open submitted payment proof'}
                    </button>
                    {paymentProof?.remarks && (
                      <div className="rounded-lg border bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Submitted by study center</p>
                        <p className="text-sm mt-1">{paymentProof.remarks}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No payment screenshot or proof has been submitted.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Study Center Management</h2>
          <p className="text-muted-foreground">Manage study centers and locations</p>
        </div>
        {(canWrite || canViewFinanceCenters) && (
          <div className="flex items-center gap-2">
            {canWrite && !operationsMode && (
              <Button
                onClick={() => {
                  setImportCenters([]);
                  setImportErrors([]);
                  setImportSummary(null);
                  setImportReferredById('');
                  setIsImportDialogOpen(true);
                }}
                variant="outline"
              >
                <Upload className="w-4 h-4 mr-2" />
                Bulk Import
              </Button>
            )}
            {canViewOperationsCenters && (
              <>
                <Button
                  variant={operationsCenterView === 'progress' ? 'default' : 'outline'}
                  onClick={() => setOperationsCenterView('progress')}
                >
                  Progress
                </Button>
                <Button
                  variant={operationsCenterView === 'rejected' ? 'default' : 'outline'}
                  onClick={() => setOperationsCenterView('rejected')}
                >
                  Rejected
                </Button>
              </>
            )}
            {canViewFinanceCenters && (
              <>
                <Button
                  variant={financeCenterView === 'active' ? 'default' : 'outline'}
                  onClick={() => setFinanceCenterView('active')}
                >
                  Active
                </Button>
                <Button
                  variant={financeCenterView === 'rejected' ? 'default' : 'outline'}
                  onClick={() => setFinanceCenterView('rejected')}
                >
                  Rejected
                </Button>
              </>
            )}
            {canCreateCenter && (
              <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Study Center
              </Button>
            )}
          </div>
        )}
      </div>

      {canWrite && (
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Study Center' : 'Add New Study Center'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Center Name</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div>
                  <Label>Center Code</Label>
                  <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} required />
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Contact (Phone)</Label>
                  <Input value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} required />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                </div>
              </div>
              <div>
                <Label>Coordinator Name (optional)</Label>
                <Input value={formData.coordinatorName} onChange={(e) => setFormData({ ...formData, coordinatorName: e.target.value })} />
              </div>
               {team.length > 0 && (
                <div>
                  <Label>Assigned Sales Agent</Label>
                  <Select value={formData.referredById} onValueChange={(v) => setFormData({ ...formData, referredById: v })}>
                    <SelectTrigger><SelectValue placeholder="Select a sales representative..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {team.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.role?.replace(/_/g, ' ')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger disabled={salesMode || operationsMode}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Branch Name <span className="text-xs text-muted-foreground font-normal">(groups centers together)</span></Label>
                <Input
                  list="branch-names-list"
                  placeholder="e.g. Kochi Branch, Delhi North…"
                  value={formData.branchName}
                  onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                />
                <datalist id="branch-names-list">
                  {existingBranchNames.map((b: any) => <option key={b} value={b} />)}
                </datalist>
                <p className="text-xs text-muted-foreground mt-1">Type or select an existing branch to group this center under it.</p>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Save</Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Credentials Dialog */}
      <Dialog open={showCreds} onOpenChange={setShowCreds}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              Center Created Successfully
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              New center admin credentials have been generated. Please copy and share them with the center administrator.
            </p>
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-lg space-y-1">
                <Label className="text-xs text-muted-foreground">User ID</Label>
                <div className="flex items-center justify-between font-mono font-bold">
                  <span>{creds?.userId}</span>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(creds?.userId || '', 'User ID')}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg space-y-1">
                <Label className="text-xs text-muted-foreground">Password</Label>
                <div className="flex items-center justify-between font-mono font-bold">
                  <span>{creds?.password}</span>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(creds?.password || '', 'Password')}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
              Note: This password will not be shown again. Ensure you have copied it correctly.
            </p>
          </div>
          <Button onClick={() => setShowCreds(false)} className="w-full">Done</Button>
        </DialogContent>
      </Dialog>

      {/* Branch-Grouped Center List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle>
              Study Centers ({centers.length} total · {Object.keys(branchGroups).filter(k => k !== '__unassigned__').length} branches)
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              {!canViewOperationsCenters && !canViewFinanceCenters && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="pending_verification">Pending Verification</SelectItem>
                  <SelectItem value="pending_payment">Pending Payment</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              )}
              <Select value={universityFilter} onValueChange={setUniversityFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Universities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Universities</SelectItem>
                  {universities.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search centers or branches…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : Object.keys(branchGroups).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No centers match your search.' : 'No study centers found'}
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(branchGroups)
                .sort(([a], [b]) => a === '__unassigned__' ? 1 : b === '__unassigned__' ? -1 : a.localeCompare(b))
                .map(([branchKey, branchCenters]) => {
                  const isUnassigned = branchKey === '__unassigned__';
                  const isExpanded = expandedBranches[branchKey] !== false; // default expanded
                  const allInternalMarks = branchCenters.every((c: any) => c.allowInternalMarks);
                  return (
                    <div key={branchKey} className="border rounded-xl overflow-hidden">
                      {/* Branch Header */}
                      <div
                        className={`flex items-center justify-between px-4 py-3 cursor-pointer select-none ${
                          isUnassigned ? 'bg-muted/40' : 'bg-primary/5 border-b border-primary/10'
                        }`}
                        onClick={() => setExpandedBranches(prev => ({ ...prev, [branchKey]: !isExpanded }))}
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          {isUnassigned
                            ? <Building2 className="w-4 h-4 text-muted-foreground" />
                            : <GitBranch className="w-4 h-4 text-primary" />}
                          <span className={`font-semibold text-sm ${isUnassigned ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {isUnassigned ? 'Unassigned Centers' : branchKey}
                          </span>
                          <Badge variant="secondary" className="text-xs">{branchCenters.length} center{branchCenters.length !== 1 ? 's' : ''}</Badge>
                          {!isUnassigned && allInternalMarks && (
                            <Badge variant="outline" className="text-xs border-violet-400 text-violet-600 bg-violet-50">Internal Marks ✓</Badge>
                          )}
                        </div>
                        {!isUnassigned && (user?.role === 'org_admin' || user?.role === 'superadmin') && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1.5 text-xs"
                            onClick={(e) => { e.stopPropagation(); handleOpenBranchConfig(branchKey, branchCenters); }}
                          >
                            <Settings className="w-3.5 h-3.5" />
                            Branch Settings
                          </Button>
                        )}
                      </div>

                      {/* Centers under this branch */}
                      {isExpanded && (
                        <div className="divide-y">
                          {branchCenters.map((c: any) => (
                            <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <MapPin className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <div className="font-medium text-sm">{c.name}</div>
                                  <div className="text-xs text-muted-foreground">Code: {c.code}{c.email ? ` • ${c.email}` : ''}</div>
                                  {c.referrer && (
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      Agent: <span className="font-semibold text-foreground">{c.referrer.name}</span>
                                    </div>
                                  )}
                                  {c.address && <div className="text-xs text-muted-foreground">{c.address}</div>}
                                  {c.credentials && (user?.role === 'org_admin' || user?.role === 'superadmin' || user?.role === 'ceo') && (
                                    <div className="text-xs text-muted-foreground mt-1 p-1.5 bg-muted rounded border inline-block">
                                      <span className="font-semibold text-foreground">ID:</span> <span className="font-mono">{c.credentials.userId}</span>
                                      {' | '}<span className="font-semibold text-foreground">Pass:</span> <span className="font-mono">{c.credentials.password}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap justify-end">
                                <Badge className="text-xs">{c.status}</Badge>
                                {c.allowInternalMarks && (
                                  <Badge variant="outline" className="text-xs border-violet-400 text-violet-600 bg-violet-50">Marks ✓</Badge>
                                )}
                                {operationsMode && user?.role === 'ops_admin' && (
                                  <Select
                                    value={assignableOpsUsers.some(candidate => candidate.id === c.assignedOperationsUserId) ? c.assignedOperationsUserId : '__none__'}
                                    onValueChange={(value) => handleAssignCenter(c, value)}
                                    disabled={operationsCenterView === 'rejected'}
                                  >
                                    <SelectTrigger className="w-[170px]" aria-label="Assigned To">
                                      <SelectValue placeholder="Assigned To" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">Unassigned</SelectItem>
                                      {assignableOpsUsers.map(candidate => (
                                        <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                <Button variant="outline" size="sm" onClick={() => handleOpenDetails(c)}>
                                  <Eye className="w-3.5 h-3.5 mr-1" />
                                  More
                                </Button>
                                {canWrite && (
                                  <>
                                    {(user?.role === 'org_admin' || user?.role === 'superadmin') && (
                                      <Button variant="ghost" size="sm" onClick={() => handleOpenConfig(c)} title="Center Settings">
                                        <Settings className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(c)}><Edit className="w-4 h-4" /></Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4" /></Button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {!operationsMode && (
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col p-0 gap-0 sm:max-w-2xl">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>Bulk Import Study Centers</DialogTitle>
            <DialogDescription>
              Upload an Excel (.xlsx, .xls) or CSV file containing study center details.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Step 1: Template and File Upload */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border bg-muted/40">
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Need a template?</h4>
                <p className="text-xs text-muted-foreground">Download the Excel template to prepare your study center details.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} className="w-full sm:w-auto">
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="importSalesUser" className="text-sm font-semibold">Assign Sales User <span className="text-muted-foreground font-normal">(optional — applied to all imported centers)</span></Label>
              <Select
                value={importReferredById || '__none__'}
                onValueChange={(v) => setImportReferredById(v === '__none__' ? '' : v)}
              >
                <SelectTrigger id="importSalesUser">
                  <SelectValue placeholder="Select a sales user (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {salesTeam.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} <span className="text-muted-foreground text-xs ml-1">({m.role?.replace(/_/g, ' ')})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="importCentersFile" className="text-sm font-semibold">Select Excel/CSV File</Label>
              <Input
                id="importCentersFile"
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
            </div>

            {/* Validation Errors */}
            {importErrors.length > 0 && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  Please fix the following {importErrors.length} errors in your file:
                </div>
                <ul className="list-disc pl-5 space-y-1 text-xs max-h-40 overflow-y-auto">
                  {importErrors.map((err, idx) => (
                    <li key={idx}>
                      <strong>Row {err.row}:</strong> {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Summary display after import */}
            {importSummary && (
              <div className={`p-4 rounded-lg border text-sm space-y-3 ${importSummary.failedCount > 0 ? 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300' : 'bg-green-500/10 border-green-500/20 text-green-800 dark:text-green-300'}`}>
                <div className="flex items-center gap-2 font-semibold text-base">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Import Completed
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="p-2 rounded bg-background/50">
                    <div className="font-bold text-lg">{importSummary.total}</div>
                    <div className="text-xs text-muted-foreground">Total Rows</div>
                  </div>
                  <div className="p-2 rounded bg-background/50">
                    <div className="font-bold text-lg text-green-600 dark:text-green-400">{importSummary.successCount}</div>
                    <div className="text-xs text-muted-foreground">Succeeded</div>
                  </div>
                  <div className="p-2 rounded bg-background/50">
                    <div className="font-bold text-lg text-destructive">{importSummary.failedCount}</div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                </div>

                {importSummary.errors.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-muted">
                    <div className="font-semibold text-xs">Import Warnings/Failures:</div>
                    <ul className="list-disc pl-5 space-y-1 text-xs max-h-40 overflow-y-auto">
                      {importSummary.errors.map((err: any, idx: number) => (
                        <li key={idx}>
                          <strong>Row {err.row} (Code: {err.code}):</strong> {err.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Preview parsed centers */}
            {importCenters.length > 0 && !importSummary && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Preview ({importCenters.length} centers parsed)</h4>
                </div>
                <div className="rounded-md border max-h-60 overflow-auto">
<div className="overflow-x-auto w-full">
<table className="w-full text-sm">
                    <thead className="bg-muted/80 sticky top-0 font-semibold text-muted-foreground border-b text-left">
                      <tr>
                        <th className="p-2 pl-3">Row</th>
                        <th className="p-2">Name</th>
                        <th className="p-2">Code</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Contact</th>
                        <th className="p-2">Location</th>
                        <th className="p-2">Sales User</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importCenters.map((c, idx) => {
                        const assignedSales = salesTeam.find((m: any) => m.id === importReferredById);
                        return (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="p-2 pl-3 text-muted-foreground text-xs">{idx + 2}</td>
                            <td className="p-2 font-medium">{c.name}</td>
                            <td className="p-2 font-mono text-xs">{c.code}</td>
                            <td className="p-2 text-xs truncate max-w-[150px]">{c.email}</td>
                            <td className="p-2 text-xs">{c.contact || '-'}</td>
                            <td className="p-2 text-xs text-muted-foreground">
                              {c.city || c.state ? `${c.city}, ${c.state}` : '-'}
                            </td>
                            <td className="p-2 text-xs">
                              {assignedSales
                                ? <span className="text-primary font-medium">{assignedSales.name}</span>
                                : <span className="text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
</div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 pt-4 border-t bg-muted/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsImportDialogOpen(false)}
            >
              {importSummary ? 'Close' : 'Cancel'}
            </Button>
            {importCenters.length > 0 && !importSummary && (
              <Button
                type="button"
                onClick={handleImportSubmit}
                disabled={importErrors.length > 0 || importing}
              >
                {importing ? 'Importing...' : `Import ${importCenters.length} Centers`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {/* Branch-Level Settings Dialog */}
      <Dialog open={branchConfigOpen} onOpenChange={setBranchConfigOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              Branch Settings — {branchConfigName}
            </DialogTitle>
            <DialogDescription>
              These settings will be applied to <strong>all centers</strong> under the "{branchConfigName}" branch simultaneously.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground border-b pb-2">Enrollment Form Fields</p>
            <div className="grid grid-cols-1 md:grid-cols-3 font-semibold text-xs text-muted-foreground pb-2">
              <span className="col-span-1">Field Name</span>
              <span className="col-span-2 text-right">Requirement Status</span>
            </div>
            {CUSTOMISABLE_FIELDS.map(field => (
              <div key={field.key} className="grid grid-cols-1 md:grid-cols-3 items-center border-b pb-3 pt-1 text-sm">
                <span className="col-span-1 font-medium">{field.label}</span>
                <div className="col-span-2 flex justify-end gap-3">
                  {['required', 'optional', 'hidden'].map(status => (
                    <label key={status} className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name={`branch-${field.key}`}
                        value={status}
                        checked={branchFieldConfig[field.key] === status}
                        onChange={() => setBranchFieldConfig({ ...branchFieldConfig, [field.key]: status as 'required' | 'optional' | 'hidden' })}
                        className="h-3.5 w-3.5 text-primary focus:ring-primary border-gray-300"
                      />
                      <span className="capitalize">{status}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="border-t pt-4 mt-2 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pb-1">Feature Access</p>
              <div className="flex items-start gap-3 p-3 rounded-xl border bg-violet-50/60 border-violet-200">
                <input
                  id="branch-allow-internal-marks"
                  type="checkbox"
                  checked={branchAllowInternalMarks}
                  onChange={e => setBranchAllowInternalMarks(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500 cursor-pointer"
                />
                <div>
                  <label htmlFor="branch-allow-internal-marks" className="text-sm font-semibold text-slate-800 cursor-pointer">
                    Enable Internal Marks
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enables the <strong>Internal Marks</strong> tab for all centers in this branch.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t mt-4 gap-2">
            <Button type="button" variant="outline" onClick={() => setBranchConfigOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleSaveBranchConfig} className="flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" />
              Apply to All Centers in Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Branch Settings</DialogTitle>
            <DialogDescription>
              Configure enrollment form fields and feature access for this study center branch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground border-b pb-2">Enrollment Form Fields</p>
            <div className="grid grid-cols-1 md:grid-cols-3 font-semibold text-xs text-muted-foreground pb-2">
              <span className="col-span-1">Field Name</span>
              <span className="col-span-2 text-right">Requirement Status</span>
            </div>

            {CUSTOMISABLE_FIELDS.map(field => (
              <div key={field.key} className="grid grid-cols-1 md:grid-cols-3 items-center border-b pb-3 pt-1 text-sm">
                <span className="col-span-1 font-medium">{field.label}</span>
                <div className="col-span-2 flex justify-end gap-3">
                  {['required', 'optional', 'hidden'].map(status => (
                    <label key={status} className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name={field.key}
                        value={status}
                        checked={fieldConfig[field.key] === status}
                        onChange={() => setFieldConfig({ ...fieldConfig, [field.key]: status } as Record<string, 'hidden' | 'required' | 'optional'>)}
                        className="h-3.5 w-3.5 text-primary focus:ring-primary border-gray-300"
                      />
                      <span className="capitalize">{status}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="border-t pt-4 mt-2 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pb-1">Feature Access</p>
              <div className="flex items-start gap-3 p-3 rounded-xl border bg-violet-50/60 border-violet-200">
                <input
                  id="allow-internal-marks"
                  type="checkbox"
                  checked={allowInternalMarks}
                  onChange={e => setAllowInternalMarks(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500 cursor-pointer"
                />
                <div>
                  <label htmlFor="allow-internal-marks" className="text-sm font-semibold text-slate-800 cursor-pointer">
                    Enable Internal Marks
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    When enabled, the <strong>Internal Marks</strong> tab will appear in this branch's Study Center Portal for submitting student marks.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t mt-4">
            <Button type="button" variant="outline" onClick={() => setConfigOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveConfig}>
              Save Config
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
