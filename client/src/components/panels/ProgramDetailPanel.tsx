import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Upload, FileText, BookOpen, File, Trash2, Download,
  Clock, GraduationCap, Layers, Tag, Search,
  Loader2, Eye, Edit, X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

interface Program {
  id: string; name: string; code: string; courseType: string;
  duration: number; hasSemesters: boolean; semesters: { number: number; name: string; durationMonths: number }[];
  status: string; universityId: any; subDepartmentId?: any; courseName?: string;
  description?: string; specialisations?: string[];
  certificateRequirements?: { name: string; isMandatory: boolean }[];
}

interface Material {
  id: string; title: string; description: string;
  category: string; fileUrl: string; fileName: string;
  fileSize?: number; mimeType?: string; semesterNumber?: string | number;
  uploadedBy?: { id: string; name: string; email: string };
  uploader?: { id: string; name: string; email: string };
  createdAt: string;
}

const CATEGORIES = [
  { value: 'syllabus', label: 'Syllabus', icon: '📋', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  { value: 'study_material', label: 'Study Material', icon: '📚', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  { value: 'question_paper', label: 'Question Paper', icon: '📝', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  { value: 'reference', label: 'Reference', icon: '🔗', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  { value: 'ebook', label: 'E-Book', icon: '📖', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
  { value: 'video_class', label: 'Video Class', icon: '🎬', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
  { value: 'video', label: 'Uploaded Class', icon: '🎥', color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20' },
  { value: 'other', label: 'Other', icon: '📁', color: 'bg-gray-500/10 text-gray-600 border-gray-500/20' },
];

const COURSE_COLORS: Record<string, { color: string; bg: string }> = {
  'Skill Course':    { color: '#7c3aed', bg: '#f5f3ff' },
  'Online Degree':   { color: '#2563eb', bg: '#eff6ff' },
  'B.Voc Degree':    { color: '#0891b2', bg: '#ecfeff' },
  'Credit Transfer': { color: '#16a34a', bg: '#f0fdf4' },
};

function getMaterialUrl(fileUrl: string) {
  return fileUrl.startsWith('http') ? fileUrl : `${API_BASE.replace('/api/v1', '')}${fileUrl}`;
}

function getVideoEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    }
    if (parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com') {
      const videoId = parsed.searchParams.get('v');
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }
  } catch {
    return '';
  }
  return '';
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(months: number) {
  if (months < 12) return `${months} months`;
  if (months % 12 === 0) return `${months / 12} year${months / 12 > 1 ? 's' : ''}`;
  return `${Math.floor(months / 12)}y ${months % 12}m`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
  if (mimeType.includes('image')) return <Eye className="w-5 h-5 text-blue-500" />;
  if (mimeType.includes('word') || mimeType.includes('doc')) return <FileText className="w-5 h-5 text-blue-700" />;
  if (mimeType.includes('sheet') || mimeType.includes('xls')) return <FileText className="w-5 h-5 text-green-600" />;
  return <File className="w-5 h-5 text-gray-500" />;
}

/**
 * Program Detail Panel — shows a single program's information and its materials.
 * - Ops/admin users can upload, edit, and delete materials.
 * - Center admins can view and download materials.
 */
export function ProgramDetailPanel({
  programId,
  initialSemester,
  onBack,
}: {
  programId: string;
  initialSemester?: string;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const canManage = ['ops_admin', 'ops_sub_admin', 'org_admin', 'superadmin', 'employee'].includes(user?.role || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [program, setProgram] = useState<Program | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, Material[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedSemester, setSelectedSemester] = useState<string>(initialSemester || 'all');

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    title: '', description: '', category: 'study_material', semesterNumber: '',
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/operations/programs/${programId}/detail`);
      const responseData = res.data.data;
      const detail = responseData.program
        ? responseData
        : { program: responseData, materials: [] };
      if (!detail.program) {
        throw new Error('Program details were not returned by the server');
      }
      const loadedMaterials = (detail.materials || []).map((material: Material) => ({
        ...material,
        uploadedBy: material.uploadedBy || material.uploader,
      }));
      setProgram(detail.program);
      setMaterials(loadedMaterials);
      setByCategory(detail.byCategory || {});
      setLoadError('');
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Failed to load program detail';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchDetail(); }, [programId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile && !editingId) { toast.error('Please select a file'); return; }
    if (!uploadForm.title.trim()) { toast.error('Title is required'); return; }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('title', uploadForm.title);
      fd.append('description', uploadForm.description);
      fd.append('category', uploadForm.category);
      if (uploadForm.semesterNumber) fd.append('semesterNumber', uploadForm.semesterNumber);
      if (uploadFile) fd.append('file', uploadFile);

      if (editingId) {
        await api.put(`/operations/programs/${programId}/materials/${editingId}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Material updated');
      } else {
        await api.post(`/operations/programs/${programId}/materials`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Material uploaded');
      }

      setUploadDialogOpen(false);
      resetUploadForm();
      fetchDetail();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (materialId: string) => {
    if (!confirm('Delete this material?')) return;
    try {
      await api.delete(`/operations/programs/${programId}/materials/${materialId}`);
      toast.success('Material deleted');
      fetchDetail();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleEdit = (m: Material) => {
    setEditingId(m.id);
    setUploadForm({
      title: m.title,
      description: m.description,
      category: m.category,
      semesterNumber: m.semesterNumber ? String(m.semesterNumber) : '',
    });
    setUploadFile(null);
    setUploadDialogOpen(true);
  };

  const resetUploadForm = () => {
    setEditingId(null);
    setUploadForm({ 
      title: '', 
      description: '', 
      category: 'study_material', 
      semesterNumber: selectedSemester === 'all' ? '' : selectedSemester 
    });
    setUploadFile(null);
  };

  const handleDownload = (m: Material) => {
    const url = m.fileUrl.startsWith('http') ? m.fileUrl : `${API_BASE.replace('/api/v1', '')}${m.fileUrl}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = m.fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Filter materials
  const filtered = materials.filter(m => {
    const matchSearch = !searchTerm ||
      m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.fileName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = activeTab === 'all' || m.category === activeTab;
    let materialSemester = String(m.semesterNumber || '');
    if (m.category === 'video_class' && m.description) {
      try {
        const metadata = JSON.parse(m.description);
        const matchedSemester = program?.semesters?.find(semester =>
          semester.name === metadata.semesterName
          || String(semester.number) === metadata.semesterName?.replace(/\D/g, '')
        );
        if (matchedSemester) materialSemester = String(matchedSemester.number);
      } catch {
        // Keep the material's saved semester number when description is not metadata.
      }
    }
    const matchSemester = selectedSemester === 'all' || materialSemester === selectedSemester;
    return matchSearch && matchCategory && matchSemester;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>{loadError || 'Program not found'}</p>
        {loadError && <Button variant="outline" className="mt-4" onClick={fetchDetail}>Retry</Button>}
        <Button variant="ghost" className="mt-4" onClick={onBack}>Go Back</Button>
      </div>
    );
  }

  const ctMeta = COURSE_COLORS[program.courseType] || COURSE_COLORS['Online Degree'];
  const uniName = typeof program.universityId === 'object'
    ? program.universityId?.name
    : (program as any).university?.name;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Back + Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="mt-1 shrink-0">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{program.name}</h1>
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{program.code}</span>
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: ctMeta.bg, color: ctMeta.color }}>
                {program.courseType}
              </span>
              <Badge variant={program.status === 'active' ? 'default' : 'secondary'}>{program.status}</Badge>
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground flex-wrap">
              {uniName && <span className="flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" /> {uniName}</span>}
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatDuration(program.duration)}</span>
              {program.hasSemesters && program.semesters?.length > 0 && (
                <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> {program.semesters.length} semesters</span>
              )}
              {program.subDepartmentId && (
                <span className="flex items-center gap-1 text-violet-600">
                  <Tag className="w-3.5 h-3.5" />
                  {typeof program.subDepartmentId === 'object' ? program.subDepartmentId.name : program.subDepartmentId}
                </span>
              )}
            </div>
          </div>
        </div>

        {canManage && (
          <Button onClick={() => { resetUploadForm(); setUploadDialogOpen(true); }} className="shrink-0">
            <Upload className="w-4 h-4 mr-2" /> Upload Material
          </Button>
        )}
      </div>

      {(program.courseName || program.description || program.specialisations?.length || program.certificateRequirements?.length) && (
        <Card>
          <CardContent className="p-5 space-y-4">
            {program.courseName && (
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Course Name</p>
                <p className="mt-1">{program.courseName}</p>
              </div>
            )}
            {program.description && (
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Description</p>
                <p className="mt-1 whitespace-pre-wrap">{program.description}</p>
              </div>
            )}
            {!!program.specialisations?.length && (
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Specialisations</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {program.specialisations.map((specialisation, index) => (
                    <Badge key={`${specialisation}-${index}`} variant="secondary">{specialisation}</Badge>
                  ))}
                </div>
              </div>
            )}
            {!!program.certificateRequirements?.length && (
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Certificate Requirements</p>
                <ul className="mt-2 space-y-1">
                  {program.certificateRequirements.map((requirement, index) => (
                    <li key={`${requirement.name}-${index}`} className="text-sm">
                      {requirement.name}
                      <span className="ml-2 text-muted-foreground">
                        {requirement.isMandatory ? 'Required' : 'Optional'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Semester breakdown if applicable */}
      {program.hasSemesters && program.semesters?.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-1">
          <div 
            onClick={() => setSelectedSemester('all')} 
            className={cn(
              "border rounded-lg px-3 py-1.5 text-center shrink-0 min-w-[100px] cursor-pointer transition-all hover:bg-muted/50 text-xs font-semibold",
              selectedSemester === 'all' ? "border-primary bg-primary/5 text-primary" : "bg-card"
            )}
          >
            All Semesters
          </div>
          {program.semesters.map(s => (
            <div 
              key={s.number} 
              onClick={() => setSelectedSemester(String(s.number))}
              className={cn(
                "border rounded-lg px-3 py-1.5 text-center shrink-0 min-w-[100px] cursor-pointer transition-all hover:bg-muted/50 text-xs font-semibold",
                selectedSemester === String(s.number) ? "border-primary bg-primary/5 text-primary" : "bg-card"
              )}
            >
              {s.name}
            </div>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {CATEGORIES.map(cat => {
          const count = byCategory[cat.value]?.length || 0;
          return (
            <Card key={cat.value} className={cn(
              'cursor-pointer transition-all hover:border-primary/30',
              activeTab === cat.value && 'border-primary ring-1 ring-primary/20'
            )} onClick={() => setActiveTab(activeTab === cat.value ? 'all' : cat.value)}>
              <CardContent className="p-3 flex items-center gap-3">
                <span className="text-lg">{cat.icon}</span>
                <div>
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-[10px] text-muted-foreground">{cat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search materials..."
            className="pl-9"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        {activeTab !== 'all' && (
          <Button variant="ghost" size="sm" onClick={() => setActiveTab('all')}>
            <X className="w-3.5 h-3.5 mr-1" /> Clear filter
          </Button>
        )}
      </div>

      {/* Materials list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-semibold text-lg mb-1">No Materials Found</p>
            <p className="text-sm">
              {materials.length === 0
                ? canManage
                  ? 'Upload syllabus, study materials, and question papers for this program.'
                  : 'No study materials have been uploaded for this program yet.'
                : 'No materials match your search or filter.'}
            </p>
            {canManage && materials.length === 0 && (
              <Button className="mt-4" onClick={() => { resetUploadForm(); setUploadDialogOpen(true); }}>
                <Upload className="w-4 h-4 mr-2" /> Upload First Material
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => {
            const catMeta = CATEGORIES.find(c => c.value === m.category) || CATEGORIES[CATEGORIES.length - 1];
            const mimeType = m.mimeType || '';
            const materialUrl = getMaterialUrl(m.fileUrl);
            const isVideo = m.category === 'video_class' || m.category === 'video';
            let videoDescription = m.description || '';
            if (m.category === 'video_class' && videoDescription) {
              try {
                const metadata = JSON.parse(videoDescription);
                videoDescription = metadata.text || metadata.description || '';
              } catch {
                // Keep the saved description when it is plain text.
              }
            }
            const videoUrl = m.category === 'video_class' && m.fileUrl.startsWith('http')
              ? getVideoEmbedUrl(m.fileUrl)
              : '';
            return (
              <Card key={m.id} className="group hover:border-primary/20 transition-colors">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      {getFileIcon(mimeType || m.fileName || '')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{m.title}</span>
                        <Badge className={cn('text-[10px] border', catMeta.color)}>
                          {catMeta.icon} {catMeta.label}
                        </Badge>
                        {m.semesterNumber && (
                          <Badge variant="outline" className="text-[10px]">Sem {m.semesterNumber}</Badge>
                        )}
                      </div>
                      {m.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{m.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                        <span>{m.fileName || 'Uploaded material'}</span>
                        {m.fileSize ? <>
                          <span>•</span>
                          <span>{formatBytes(m.fileSize)}</span>
                        </> : null}
                        <span>•</span>
                        <span>by {m.uploadedBy?.name || 'Unknown'}</span>
                        <span>•</span>
                        <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                      </div>
                      {isVideo && videoDescription && (
                        <p className="mt-1 text-xs text-muted-foreground">{videoDescription}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => isVideo
                        ? window.open(materialUrl, '_blank', 'noopener,noreferrer')
                        : handleDownload(m)}
                      title={isVideo ? 'Open video class' : 'Download'}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    {canManage && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(m)} title="Edit">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(m.id)} title="Delete"
                          className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
                {isVideo && (
                  <div className="border-t bg-muted/20 p-4">
                    {videoUrl ? (
                      <div className="aspect-video overflow-hidden rounded-lg bg-black">
                        <iframe
                          src={videoUrl}
                          title={m.title}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <video controls preload="metadata" className="max-h-[28rem] w-full rounded-lg bg-black">
                        <source src={materialUrl} type={mimeType || undefined} />
                        Your browser does not support video playback.
                      </video>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload / Edit Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => { setUploadDialogOpen(open); if (!open) resetUploadForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Material' : 'Upload Program Material'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input
                placeholder="e.g. Semester 1 Syllabus — Computer Science"
                value={uploadForm.title}
                onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                placeholder="Brief description of the material"
                value={uploadForm.description}
                onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category *</Label>
                <Select value={uploadForm.category} onValueChange={v => setUploadForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {program?.hasSemesters && program.semesters?.length > 0 && (
                <div className="space-y-1">
                  <Label>Semester <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Select
                    value={uploadForm.semesterNumber || 'none'}
                    onValueChange={v => setUploadForm(f => ({ ...f, semesterNumber: v === 'none' ? '' : v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All / General</SelectItem>
                      {program.semesters.map(s => (
                        <SelectItem key={s.number} value={String(s.number)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label>{editingId ? 'Replace File' : 'File *'}</Label>
              <label className={cn(
                'flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors',
                uploadFile ? 'border-primary/50 bg-primary/5' : 'hover:border-primary/30'
              )}>
                <Upload className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground text-center">
                  {uploadFile
                    ? `${uploadFile.name} (${formatBytes(uploadFile.size)})`
                    : editingId ? 'Click to replace file (optional)' : 'Click to select a file'}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={uploading}>
                {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</> : editingId ? 'Save Changes' : 'Upload Material'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
