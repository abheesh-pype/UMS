import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { toast } from 'sonner';

interface PortalField {
  name: string;
  type: string;
  required: boolean;
  min: number | string | null;
  max: number | string | null;
  options: string[];
}

interface CandidateForm {
  fields: PortalField[];
  categories: string[];
  subCategories: { name: string; category: string }[];
  candidate: { candidate_id: string; category: string; sub_category: string; fields: Record<string, string> } | null;
}

const isNameField = (field: PortalField) => /^candidate name/i.test(field.name.trim());
const isEmailField = (field: PortalField) => field.type === 'Email';
const isDateOfBirthField = (field: PortalField) => /^(dob|date of birth|birth date)/i.test(field.name.trim());
const INPUT_TYPES: Record<string, string> = { Email: 'email', Date: 'date', Number: 'number' };

// Fields come from the Exam Portal, so anything added there appears here. Name and email always come from UMS.
export function ExportCandidateDialog({ student, onClose, onExported }: {
  student: any;
  onClose: () => void;
  onExported: (candidateId: string) => void;
}) {
  const [form, setForm] = useState<CandidateForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [error, setError] = useState('');
  const initialised = useRef(false);

  const loadForm = useCallback(async () => {
    setLoadError('');
    try {
      const response = await api.get(`/operations/students/${student.id}/exam-candidate`);
      const data: CandidateForm = response.data.data;
      setForm(data);
      // Only the first load fills the form in; a later reload just adds new fields and keeps what was typed.
      setValues(current => {
        const next = { ...current };
        data.fields.forEach(field => {
          if (next[field.name] !== undefined) return;
          next[field.name] = data.candidate?.fields?.[field.name]
            ?? (isDateOfBirthField(field) ? String(student.dob || '').slice(0, 10) : '');
        });
        return next;
      });
      if (!initialised.current) {
        initialised.current = true;
        const programName = student.program?.name || '';
        const chosen = data.candidate?.category || programName;
        const nextCategory = data.categories.includes(chosen) ? chosen : '';
        setCategory(nextCategory);
        const chosenSub = data.candidate?.sub_category || student.specialisation || '';
        setSubCategory(data.subCategories.some(item => item.category === nextCategory && item.name === chosenSub) ? chosenSub : '');
      }
    } catch (loadFailure: any) {
      // A failed refresh keeps the form that is already open.
      if (!initialised.current) setLoadError(loadFailure.response?.data?.message || 'Could not load the Add Candidate form from the Exam Portal');
    } finally {
      setLoading(false);
    }
  }, [student]);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  // Categories and extra fields are added in the portal, in another tab: pick them up on coming back.
  useEffect(() => {
    const onFocus = () => loadForm();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadForm]);

  const openPortalForExtraInfo = async () => {
    const win = window.open('about:blank', '_blank');
    if (!win) {
      toast.error('Allow pop-ups to open the Exam Portal');
      return;
    }
    setOpeningPortal(true);
    try {
      const response = await api.post('/operations/exam-portal/staff-launch');
      win.opener = null;
      win.location.href = response.data.data.launchUrl;
    } catch (openError: any) {
      win.close();
      toast.error(openError.response?.data?.message || 'Could not open the Exam Portal');
    } finally {
      setOpeningPortal(false);
    }
  };

  const editableFields = (form?.fields || []).filter(field => !isNameField(field) && !isEmailField(field));
  const availableSubCategories = (form?.subCategories || []).filter(item => item.category === category);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const missing = editableFields.find(field => field.required && !values[field.name]?.trim());
    if (missing) {
      setError(`${missing.name} is required`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await api.post(`/operations/students/${student.id}/exam-candidate`, {
        category,
        subCategory,
        fields: Object.fromEntries(editableFields.map(field => [field.name, values[field.name] ?? ''])),
      });
      const result = response.data.data;
      if (result.candidateId) onExported(result.candidateId);
      toast.success(`${student.name} ${result.outcome === 'created' ? 'added to' : 'updated on'} the Exam Portal${result.candidateId ? `. Candidate ID: ${result.candidateId}` : ''}`);
      onClose();
    } catch (saveError: any) {
      setError(saveError.response?.data?.message || 'Could not export this student to the Exam Portal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Add Candidate</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading the form from the Exam Portal...</p>
        ) : loadError || !form ? (
          <div className="py-8 text-center">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button className="mt-3" variant="outline" onClick={() => { setLoading(true); loadForm(); }}>Try again</Button>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={save}>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={value => { setCategory(value); setSubCategory(''); }}>
                  <SelectTrigger className="w-full" aria-label="Category">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {form.categories.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    {form.categories.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">No categories on the Exam Portal yet.</p>}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-2">
                <Label>Sub-Category</Label>
                <Select value={subCategory} onValueChange={setSubCategory}>
                  <SelectTrigger className="w-full" aria-label="Sub-Category">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubCategories.map(item => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}
                    {availableSubCategories.length === 0 && (
                      <p className="px-2 py-3 text-sm text-muted-foreground">
                        {category ? 'No sub-categories for this category on the Exam Portal yet.' : 'Select a category first.'}
                      </p>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <p className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground md:self-end">
                {form.candidate?.candidate_id
                  ? `This student is already on the Exam Portal. Candidate ID: ${form.candidate.candidate_id}. Saving updates the record.`
                  : 'Candidate ID will be generated automatically as a unique 6-digit number.'}
              </p>
              {form.fields.map(field => {
                const id = `candidate-${field.name.replace(/\W+/g, '-')}`;
                const fromUms = isNameField(field) ? student.name : isEmailField(field) ? student.email : null;
                return (
                  <div className="min-w-0 space-y-2" key={field.name}>
                    <Label htmlFor={id}>{field.name}{field.required ? ' *' : ''}</Label>
                    {fromUms !== null ? (
                      <Input id={id} value={fromUms || ''} readOnly className="bg-muted" />
                    ) : field.type === 'Dropdown' ? (
                      <Select value={values[field.name] || ''} onValueChange={value => setValues(current => ({ ...current, [field.name]: value }))}>
                        <SelectTrigger id={id} className="w-full" aria-label={field.name}>
                          <SelectValue placeholder="Choose" />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={id}
                        type={INPUT_TYPES[field.type] || 'text'}
                        min={field.type === 'Number' && field.min != null ? String(field.min) : undefined}
                        max={field.type === 'Number' && field.max != null ? String(field.max) : undefined}
                        value={values[field.name] || ''}
                        onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Name and email come from the student's UMS record. Change them in UMS.</p>
              {!category && <p>If no category is chosen, the program name "{student.program?.name}" is used as the category.</p>}
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Close</Button>
              <Button type="button" variant="outline" disabled={openingPortal} onClick={openPortalForExtraInfo}>
                {openingPortal ? 'Opening...' : 'Add Extra Info'}
              </Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
