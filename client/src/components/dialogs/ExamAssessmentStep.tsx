import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';

interface AssessmentOptions {
  examinations: string[];
  questionCategories: string[];
  subCategories: string[];
  topics: string[];
  languages: string[];
  difficultyLevels: string[];
  questionTypes: string[];
  assessment: any | null;
}

interface SectionDraft {
  key: number;
  name: string;
  questionType: string;
  questionCount: string;
  correctMark: string;
  wrongMark: string;
  difficultyLevel: string;
}

export interface AssessmentDraft {
  examination: string;
  name: string;
  startDate: string;
  endDate: string;
  totalTime: string;
  lastLogin: string;
  questionCategory: string;
  subCategory: string;
  topic: string;
  questionLanguage: string;
  passMark: string;
  sections: SectionDraft[];
}

const ANY_DIFFICULTY = '__any__';
const FIELD_HEIGHT = 'h-11';
const blankSection = (key: number): SectionDraft => ({ key, name: '', questionType: '', questionCount: '', correctMark: '', wrongMark: '', difficultyLevel: '' });
const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));

// The value a datetime-local input needs, in the viewer's own time zone.
const localDateTime = (value: unknown) => {
  const date = new Date(text(value));
  if (!text(value) || Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const totalMarkOf = (sections: SectionDraft[]) => sections.reduce((total, section) => {
  const count = Number(section.questionCount);
  const mark = Number(section.correctMark);
  return count > 0 && mark >= 0 ? total + count * mark : total;
}, 0);

// The same rules the portal applies to its own form.
const findProblem = (draft: AssessmentDraft) => {
  if (!draft.examination) return 'Choose an examination.';
  if (!draft.name.trim()) return 'Enter the assessment name.';
  if (draft.startDate && draft.endDate && new Date(draft.endDate) <= new Date(draft.startDate)) return 'Assessment end date must be later than its start date.';
  const wholePositive = (value: string) => Number.isInteger(Number(value)) && Number(value) >= 1;
  if ((draft.totalTime && !wholePositive(draft.totalTime)) || (draft.lastLogin && !wholePositive(draft.lastLogin))) return 'Total time and last login time must be positive whole numbers.';
  if (draft.totalTime && Number(draft.totalTime) > 1440) return 'Total time cannot be more than 1440 minutes.';
  if (!draft.questionCategory) return 'Choose a question category.';
  if (!draft.subCategory) return 'Choose a sub-category.';
  const names = new Set<string>();
  for (const [index, section] of draft.sections.entries()) {
    const wrongMark = section.wrongMark.trim() ? Number(section.wrongMark) : 0;
    if (!section.questionType || !wholePositive(section.questionCount) || !section.correctMark.trim()
      || !(Number(section.correctMark) >= 0) || !Number.isFinite(wrongMark) || wrongMark > 0) {
      return `Complete the question type, question count, and valid marks for section ${index + 1}.`;
    }
    const name = section.name.trim().toLowerCase();
    if (name && names.has(name)) return `Section name "${section.name.trim()}" is duplicated.`;
    if (name) names.add(name);
  }
  if (draft.passMark.trim() && !(Number(draft.passMark) >= 0 && Number(draft.passMark) <= totalMarkOf(draft.sections))) {
    return 'Pass Mark must be zero or greater and cannot exceed Total Mark.';
  }
  return '';
};

// Keeps a saved value visible when its choice has since been switched off on the portal.
const withCurrent = (options: string[], current: string) => [...new Set(current ? [...options, current] : options)];

// A small label sitting on the field's top border, as on the portal's form.
function FloatingField({ label, htmlFor, children, className = '' }: { label: string; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <label htmlFor={htmlFor} className="absolute -top-2 left-3 z-10 bg-background px-1 text-[11px] leading-4 text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function PortalSelect({ label, value, options, placeholder = 'Choose', empty, onChange }: {
  label: string;
  value: string;
  options: string[];
  placeholder?: string;
  empty: string;
  onChange: (value: string) => void;
}) {
  const choices = withCurrent(options, value);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full min-w-0 data-[size=default]:h-11" aria-label={label}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {choices.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
        {choices.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">{empty}</p>}
      </SelectContent>
    </Select>
  );
}

// The Exam Portal's assessment form, the first screen of Create Examination.
// Its choices come from the portal. It is saved as that portal's assessment at the end of the examination steps.
export function ExamAssessmentStep({ examinationId, defaults, draft, onDraftChange, onClose, onNext, onSkip }: {
  examinationId: string | null;
  defaults: { name: string; startDate: string; endDate: string; totalTime: string };
  draft: AssessmentDraft | null;
  onDraftChange: (draft: AssessmentDraft) => void;
  onClose: () => void;
  onNext: (assessment: Record<string, unknown>) => void;
  onSkip: () => void;
}) {
  const [options, setOptions] = useState<AssessmentOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [problem, setProblem] = useState('');
  const hasDraft = useRef(Boolean(draft));

  const loadOptions = useCallback(async () => {
    setLoadError('');
    try {
      const response = await api.get('/operations/exam-portal/assessment-form', { params: examinationId ? { examinationId } : {} });
      const data: AssessmentOptions = response.data.data;
      setOptions(data);
      // Only the first load fills the form in; a later reload just refreshes the choices and keeps what was typed.
      if (!hasDraft.current) {
        hasDraft.current = true;
        const stored = data.assessment;
        const sections = Array.isArray(stored?.sections) ? stored.sections : [];
        onDraftChange({
          examination: data.examinations.includes(stored?.examination) ? stored.examination : '',
          name: text(stored?.name) || defaults.name,
          startDate: localDateTime(stored?.start_date) || defaults.startDate,
          endDate: localDateTime(stored?.end_date) || defaults.endDate,
          totalTime: text(stored?.total_time) || defaults.totalTime,
          lastLogin: text(stored?.last_login),
          questionCategory: text(stored?.question_category),
          subCategory: text(stored?.sub_category),
          topic: text(stored?.topic),
          questionLanguage: text(stored?.question_language),
          passMark: text(stored?.pass_mark),
          sections: sections.length ? sections.map((section: any, key: number) => ({
            key,
            name: text(section?.name),
            questionType: text(section?.question_type),
            questionCount: text(section?.question_count),
            correctMark: text(section?.correct_mark),
            wrongMark: text(section?.wrong_mark),
            difficultyLevel: text(section?.difficulty_level),
          })) : [blankSection(0)],
        });
      }
    } catch (failure: any) {
      // A failed refresh keeps the form that is already open.
      if (!hasDraft.current) setLoadError(failure.response?.data?.message || 'Could not load the assessment form from the Exam Portal');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examinationId]);

  useEffect(() => { loadOptions(); }, [loadOptions]);

  // Choices are added in the portal, in another tab: pick them up on coming back.
  useEffect(() => {
    const onFocus = () => loadOptions();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadOptions]);

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Loading the form from the Exam Portal...</p>;

  if (loadError || !options || !draft) {
    return (
      <div className="space-y-4 py-4 text-center">
        <p className="text-sm text-destructive" role="alert">{loadError || 'Could not load the assessment form from the Exam Portal'}</p>
        <p className="text-sm text-muted-foreground">You can try again, or continue without it and add the assessment later by editing the examination.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          <Button type="button" variant="outline" onClick={() => { setLoading(true); loadOptions(); }}>Try again</Button>
          <Button type="button" onClick={onSkip}>Continue without assessment</Button>
        </div>
      </div>
    );
  }

  const update = (changes: Partial<AssessmentDraft>) => onDraftChange({ ...draft, ...changes });
  const updateSection = (key: number, changes: Partial<SectionDraft>) => update({
    sections: draft.sections.map(section => (section.key === key ? { ...section, ...changes } : section)),
  });
  const totalMark = totalMarkOf(draft.sections);
  const missingChoices = !options.examinations.length || !options.questionCategories.length || !options.subCategories.length;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = findProblem(draft);
    setProblem(found);
    if (found) return;
    onNext({
      examination: draft.examination,
      name: draft.name.trim(),
      startDate: draft.startDate ? new Date(draft.startDate).toISOString() : '',
      endDate: draft.endDate ? new Date(draft.endDate).toISOString() : '',
      totalTime: draft.totalTime,
      lastLogin: draft.lastLogin,
      questionCategory: draft.questionCategory,
      subCategory: draft.subCategory,
      topic: draft.topic,
      questionLanguage: draft.questionLanguage,
      passMark: draft.passMark,
      sections: draft.sections.map(section => ({
        name: section.name,
        question_type: section.questionType,
        question_count: section.questionCount,
        correct_mark: section.correctMark,
        wrong_mark: section.wrongMark,
        difficulty_level: section.difficultyLevel,
      })),
    });
  };

  return (
    <form className="space-y-5 pt-2" onSubmit={submit} noValidate>
      <FloatingField label="Examination">
        <PortalSelect label="Examination" value={draft.examination} options={options.examinations} empty="No examinations on the Exam Portal yet." onChange={examination => update({ examination })} />
      </FloatingField>
      <FloatingField label="Name" htmlFor="assessment-name">
        <Input id="assessment-name" className={FIELD_HEIGHT} value={draft.name} placeholder="Name" onChange={event => update({ name: event.target.value })} />
      </FloatingField>
      <div className="grid items-start gap-4 md:grid-cols-[2fr_1fr_1fr]">
        <div className="flex flex-wrap items-center gap-2">
          <FloatingField label="Assessment Date" htmlFor="assessment-start" className="flex-1 basis-44">
            <Input id="assessment-start" className={FIELD_HEIGHT} type="datetime-local" aria-label="Assessment start date" value={draft.startDate} onChange={event => update({ startDate: event.target.value })} />
          </FloatingField>
          <span className="text-xs text-muted-foreground">to</span>
          <Input className={`min-w-0 flex-1 basis-44 ${FIELD_HEIGHT}`} type="datetime-local" aria-label="Assessment end date" value={draft.endDate} onChange={event => update({ endDate: event.target.value })} />
        </div>
        <FloatingField label="Total Time (in Mins)" htmlFor="assessment-total-time">
          <Input id="assessment-total-time" className={FIELD_HEIGHT} type="number" min="1" max="1440" placeholder="Total Time (in Mins)" value={draft.totalTime} onChange={event => update({ totalTime: event.target.value })} />
        </FloatingField>
        <FloatingField label="Last Login Time (in Mins)" htmlFor="assessment-last-login">
          <Input id="assessment-last-login" className={FIELD_HEIGHT} type="number" min="1" placeholder="Last Login Time (in Mins)" value={draft.lastLogin} onChange={event => update({ lastLogin: event.target.value })} />
          <p className="mt-1 text-xs text-muted-foreground">Leave blank to allow anytime login.</p>
        </FloatingField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FloatingField label="Question Category">
          <PortalSelect label="Question Category" value={draft.questionCategory} options={options.questionCategories} empty="No question categories on the Exam Portal yet." onChange={questionCategory => update({ questionCategory })} />
        </FloatingField>
        <FloatingField label="Sub-Category">
          <PortalSelect label="Sub-Category" value={draft.subCategory} options={options.subCategories} empty="No sub-categories on the Exam Portal yet." onChange={subCategory => update({ subCategory })} />
        </FloatingField>
        <FloatingField label="Topic">
          <PortalSelect label="Topic" value={draft.topic} options={options.topics} empty="No topics on the Exam Portal yet." onChange={topic => update({ topic })} />
        </FloatingField>
        <FloatingField label="Question Language">
          <PortalSelect label="Question Language" value={draft.questionLanguage} options={options.languages} empty="No languages on the Exam Portal yet." onChange={questionLanguage => update({ questionLanguage })} />
        </FloatingField>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-medium">Sections</h3>
        <Button type="button" size="icon" aria-label="Add section" onClick={() => update({ sections: [...draft.sections, blankSection(Math.max(...draft.sections.map(section => section.key)) + 1)] })}>+</Button>
      </div>
      <div className="space-y-4">
        {draft.sections.map((section, index) => (
          <div className="space-y-3" key={section.key}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Section {index + 1}</span>
              {index > 0 && (
                <Button type="button" variant="ghost" size="sm" aria-label={`Remove section ${index + 1}`} onClick={() => update({ sections: draft.sections.filter(item => item.key !== section.key) })}>× Remove</Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr]">
              <Input className={FIELD_HEIGHT} aria-label={`Section ${index + 1} name`} placeholder="Name" value={section.name} onChange={event => updateSection(section.key, { name: event.target.value })} />
              <PortalSelect label={`Section ${index + 1} question type`} value={section.questionType} options={options.questionTypes} placeholder="Question Type" empty="No question types." onChange={questionType => updateSection(section.key, { questionType })} />
              <Input className={FIELD_HEIGHT} type="number" min="1" step="1" aria-label={`Section ${index + 1} question count`} placeholder="Question Count" value={section.questionCount} onChange={event => updateSection(section.key, { questionCount: event.target.value })} />
              <Input className={FIELD_HEIGHT} type="number" min="0" step="any" aria-label={`Section ${index + 1} correct mark`} placeholder="Correct Mark" value={section.correctMark} onChange={event => updateSection(section.key, { correctMark: event.target.value })} />
              <Input className={FIELD_HEIGHT} type="number" max="0" step="any" aria-label={`Section ${index + 1} wrong mark`} placeholder="Wrong Mark (0 or negative)" value={section.wrongMark} onChange={event => updateSection(section.key, { wrongMark: event.target.value })} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm">Difficulty Level</p>
              <Select value={section.difficultyLevel || ANY_DIFFICULTY} onValueChange={value => updateSection(section.key, { difficultyLevel: value === ANY_DIFFICULTY ? '' : value })}>
                <SelectTrigger className="w-full data-[size=default]:h-11" aria-label={`Section ${index + 1} difficulty level`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_DIFFICULTY}>Any difficulty</SelectItem>
                  {withCurrent(options.difficultyLevels, section.difficultyLevel).map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-5 border-t pt-5">
        <FloatingField label="Total Mark" htmlFor="assessment-total-mark">
          <Input id="assessment-total-mark" className={FIELD_HEIGHT} type="number" value={totalMark} readOnly />
        </FloatingField>
        <FloatingField label="Pass Mark" htmlFor="assessment-pass-mark">
          <Input id="assessment-pass-mark" className={FIELD_HEIGHT} type="number" min="0" max={totalMark} step="any" placeholder="Enter Pass Mark" value={draft.passMark} onChange={event => update({ passMark: event.target.value })} />
        </FloatingField>
      </div>

      {missingChoices && (
        <p className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
          The Exam Portal needs at least one examination, question category and sub-category before this form can be completed. Add them there and return to this tab, or continue without the assessment.
        </p>
      )}
      {problem && <p className="text-sm text-destructive" role="alert">{problem}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onClose}>CLOSE</Button>
        {(missingChoices || examinationId) && (
          <Button type="button" variant="outline" onClick={onSkip}>Continue without assessment</Button>
        )}
        <Button type="submit">Next -&gt;</Button>
      </div>
    </form>
  );
}
