import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  Users,
  WalletCards,
  Workflow,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const features = [
  {
    icon: GraduationCap,
    title: 'Student lifecycle',
    description: 'Manage applications, enrollment reviews, student records, and learning services from a connected workspace.',
    accent: 'bg-orange-100 text-orange-700',
  },
  {
    icon: Building2,
    title: 'Centers & admissions',
    description: 'Coordinate study-center onboarding, verification, program allocation, and admission workflows.',
    accent: 'bg-violet-100 text-violet-700',
  },
  {
    icon: BookOpen,
    title: 'Academic operations',
    description: 'Organize universities, programs, modules, sessions, examinations, and academic resources.',
    accent: 'bg-sky-100 text-sky-700',
  },
  {
    icon: WalletCards,
    title: 'Finance & payments',
    description: 'Keep fee structures, invoices, payments, expenses, payroll, and finance reviews in view.',
    accent: 'bg-emerald-100 text-emerald-700',
  },
  {
    icon: Users,
    title: 'People & HR',
    description: 'Support employee records, teams, attendance, leave, hiring, and payroll workflows.',
    accent: 'bg-rose-100 text-rose-700',
  },
  {
    icon: LayoutDashboard,
    title: 'Sales & leadership',
    description: 'Track leads, invite links, team activity, targets, and operational progress with role-based dashboards.',
    accent: 'bg-amber-100 text-amber-700',
  },
];

const workflowSteps = [
  { number: '01', title: 'Connect your teams', detail: 'Give each department a focused workspace and role-appropriate tools.' },
  { number: '02', title: 'Move work forward', detail: 'Keep admissions, center reviews, and finance approvals moving through clear stages.' },
  { number: '03', title: 'Stay informed', detail: 'Use dashboards, reports, announcements, and notifications to maintain visibility.' },
];

export function Login() {
  const { login } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login((email || '').trim(), (password || '').trim());
      if (!success) setError('Invalid email/User ID or password');
    } catch (error: any) {
      const responseData = error.response?.data;
      const serverMessage = typeof responseData === 'string'
        ? responseData
        : responseData?.message;
      setError(serverMessage || 'Unable to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f7f1] text-[#173b34]">
      <header className="relative z-10 border-b border-[#dce8df] bg-[#f9fbf7]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="#home" className="flex items-center gap-3" aria-label="UMS home">
            <img src="/logo.png" alt="" className="h-10 w-10 rounded-xl object-contain" />
            <span className="text-xl font-bold tracking-tight text-[#173b34]">UMS</span>
            <span className="hidden border-l border-[#cad9cf] pl-3 text-xs font-medium text-[#60766b] sm:inline">
              University Management System
            </span>
          </a>
          <nav aria-label="Main navigation" className="flex items-center gap-3 sm:gap-7">
            <a href="#platform" className="hidden text-sm font-medium text-[#526b60] transition hover:text-[#173b34] sm:inline">Platform</a>
            <a href="#workflows" className="hidden text-sm font-medium text-[#526b60] transition hover:text-[#173b34] sm:inline">How it works</a>
            <a href="#portals" className="hidden text-sm font-medium text-[#526b60] transition hover:text-[#173b34] sm:inline">Workspaces</a>
            <button
              type="button"
              className="whitespace-nowrap rounded-full border border-[#b8cbbf] bg-transparent px-3.5 py-2.5 text-sm font-semibold text-[#285448] transition hover:bg-[#e7efe8] sm:px-4"
            >
              Enroll now
            </button>
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-[#173b34] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#24564a]"
            >
              Sign in <ArrowUpRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </header>

      <section id="home" className="relative isolate overflow-hidden bg-[#173b34] text-white">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[38rem] w-[38rem] rounded-full bg-[#a9dc77]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-44 left-[30%] h-[32rem] w-[32rem] rounded-full bg-[#35a78a]/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1fr_0.95fr] lg:gap-16 lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-1.5 text-xs font-semibold text-[#d8f0bf]">
              <span className="h-2 w-2 rounded-full bg-[#b6e47a]" />
              One connected platform for education
            </div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.06] tracking-[-0.055em] sm:text-6xl lg:text-[4.5rem]">
              Every part of
              <span className="mt-1 block text-[#b6e47a]">education, in sync.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-[#c5d8d0] sm:text-lg sm:leading-8">
              A calmer way to run your institution. Connect academic operations, admissions, finance, people, and student services in one shared workspace.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#platform"
                className="inline-flex items-center gap-2 rounded-full bg-[#b6e47a] px-5 py-3 text-sm font-bold text-[#173b34] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#c6ed94]"
              >
                Explore the platform <ArrowRight className="h-4 w-4" />
              </a>
              <div className="inline-flex items-center gap-2 px-2 py-3 text-sm font-medium text-[#d2e1db]">
                <ShieldCheck className="h-4 w-4 text-[#b6e47a]" />
                Role-based workspaces
              </div>
            </div>
            <div className="mt-12 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/15 pt-6 text-sm text-[#d2e1db]">
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#b6e47a]" />Connected workflows</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#b6e47a]" />Department dashboards</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#b6e47a]" />Student self-service</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:pl-4">
            <div className="absolute -right-2 top-4 h-24 w-24 rounded-full border border-[#b6e47a]/30 sm:-right-4 sm:h-32 sm:w-32" />
            <div className="absolute -bottom-5 left-2 h-20 w-20 rounded-full bg-[#b6e47a]/20 blur-xl sm:left-0" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#f8fbf6] p-4 text-[#173b34] shadow-2xl shadow-black/20 sm:rounded-[2rem] sm:p-6">
              <div className="flex items-center justify-between border-b border-[#e5ece6] pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#173b34] text-[#b6e47a]">
                    <LayoutDashboard className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Institution overview</p>
                    <p className="mt-0.5 text-[10px] text-[#71847a]">Your work, all in one view</p>
                  </div>
                </div>
                <span className="rounded-full bg-[#e9f3e4] px-2.5 py-1 text-[10px] font-semibold text-[#3f704b]">Live workspace</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5 py-4 sm:gap-3">
                {[
                  { label: 'Students', count: '01', color: 'bg-[#e6f1de]', icon: GraduationCap },
                  { label: 'Admissions', count: '02', color: 'bg-[#e1f1ed]', icon: ClipboardCheck },
                  { label: 'Departments', count: '06', color: 'bg-[#eeebf8]', icon: Building2 },
                ].map(({ label, count, color, icon: Icon }) => (
                  <div key={label} className="rounded-2xl border border-[#e8eee9] bg-white p-3 sm:p-4">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${color}`}>
                      <Icon className="h-4 w-4 text-[#285448]" />
                    </div>
                    <p className="mt-3 text-xl font-bold tracking-tight">{count}</p>
                    <p className="mt-0.5 text-[10px] text-[#71847a] sm:text-xs">{label}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-[#e8eee9] bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold">A shared path forward</p>
                    <p className="mt-1 text-[10px] text-[#71847a]">From first application to active student</p>
                  </div>
                  <Workflow className="h-5 w-5 text-[#438a68]" />
                </div>
                <div className="mt-5 flex items-center">
                  {[
                    { label: 'Apply', done: true },
                    { label: 'Review', done: true },
                    { label: 'Enroll', done: false },
                    { label: 'Learn', done: false },
                  ].map((step, index) => (
                    <div key={step.label} className="flex min-w-0 flex-1 items-center last:flex-none">
                      <div className="flex flex-col items-center gap-2">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${step.done ? 'bg-[#438a68] text-white' : 'border border-[#d8e4db] bg-[#f7faf7] text-[#71847a]'}`}>
                          {step.done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                        </span>
                        <span className="text-[9px] font-medium text-[#71847a] sm:text-[10px]">{step.label}</span>
                      </div>
                      {index < 3 && <span className={`mx-1 mb-5 h-px flex-1 ${index === 0 ? 'bg-[#438a68]' : 'bg-[#dce7de]'}`} />}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#eaf3e6] p-3.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#438a68]">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold">The right tools for every team</p>
                  <p className="mt-0.5 text-[10px] text-[#60766b]">A clearer view, from campus to classroom</p>
                </div>
              </div>
            </div>
            <div className="absolute -left-5 top-1/2 hidden -translate-y-1/2 items-center gap-2 rounded-2xl border border-[#e5ece6] bg-white px-4 py-3 text-xs font-semibold text-[#285448] shadow-xl shadow-black/10 sm:flex">
              <span className="rounded-lg bg-[#e9f3e4] p-1.5 text-[#438a68]"><CalendarDays className="h-4 w-4" /></span>
              One connected journey
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#dce8df] bg-[#f9fbf7]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-5 px-5 py-6 sm:px-8 md:grid-cols-4 md:gap-8">
          {[
            { icon: Building2, label: 'Institution operations' },
            { icon: GraduationCap, label: 'Academic journeys' },
            { icon: WalletCards, label: 'Finance workflows' },
            { icon: Users, label: 'People & teams' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 text-sm font-medium text-[#526b60]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e7efe8] text-[#285448]">
                <Icon className="h-4 w-4" />
              </span>
              {label}
            </div>
          ))}
        </div>
      </section>

      <section id="platform" className="scroll-mt-16 px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#438a68]">The platform</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#173b34] sm:text-5xl">
              Everything connected. Everyone in sync.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#60766b]">
              Bring essential institutional work into one flexible system, with focused tools for every team.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description, accent }) => (
              <article key={title} className="group rounded-3xl border border-[#dce8df] bg-[#fbfdf9] p-6 transition hover:-translate-y-1 hover:border-[#a7c4ae] hover:shadow-xl hover:shadow-[#173b34]/5 sm:p-7">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-[#173b34]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#60766b]">{description}</p>
                <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-[#8aa094] transition group-hover:text-[#438a68]">
                  Built into your workspace <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="workflows" className="scroll-mt-16 bg-[#e5efdf] px-5 py-20 text-[#173b34] sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#438a68]">Less chasing. More clarity.</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Work moves forward when everyone sees the next step.
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-[#60766b] sm:text-base">
              From a new student application to a center review, UMS helps teams follow shared processes and stay aligned.
            </p>
          </div>
          <div className="divide-y divide-[#cdddcf]">
            {workflowSteps.map(step => (
              <div key={step.number} className="grid gap-3 py-5 sm:grid-cols-[4rem_1fr] sm:gap-5">
                <span className="font-mono text-sm font-bold text-[#438a68]">{step.number}</span>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#60766b]">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="portals" className="scroll-mt-16 px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#438a68]">Made for every role</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#173b34] sm:text-4xl">
              The right view for the right people.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#60766b]">
              Department dashboards and role-based navigation help people focus on the work that belongs to them.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: ClipboardCheck, title: 'Operations', detail: 'Centers, student records, admissions, and reviews' },
              { icon: WalletCards, title: 'Finance', detail: 'Fees, invoices, payments, expenses, and approvals' },
              { icon: Users, title: 'HR & teams', detail: 'Employees, attendance, leave, hiring, and payroll' },
              { icon: GraduationCap, title: 'Students', detail: 'A student portal for academic and campus information' },
              { icon: Building2, title: 'Sales & centers', detail: 'Leads, referrals, onboarding, and center progress' },
              { icon: Megaphone, title: 'Leadership', detail: 'Dashboards, reports, announcements, and visibility' },
            ].map(({ icon: Icon, title, detail }) => (
              <div key={title} className="flex gap-4 rounded-2xl border border-[#dce8df] bg-[#fbfdf9] p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e7efe8] text-[#285448]">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[#173b34]">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#71847a]">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 sm:pb-24">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 rounded-[2rem] bg-[#173b34] px-7 py-9 text-white sm:px-12 sm:py-12 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b6e47a]">A clearer way to work</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Bring your institution’s work together.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#c5d8d0]">
              Sign in to open your UMS workspace and continue where your team needs you.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#b6e47a] px-5 py-3 text-sm font-bold text-[#173b34] transition hover:bg-[#c6ed94]"
          >
            Go to sign in <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <footer className="border-t border-[#dce8df] bg-[#f9fbf7] px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-xs text-[#71847a] sm:flex-row">
          <div className="flex items-center gap-2 font-semibold text-[#285448]">
            <img src="/logo.png" alt="" className="h-6 w-6 rounded-md object-contain" />
            UMS · University Management System
          </div>
          <div className="flex items-center gap-5">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Built around connected workflows</span>
            <span className="hidden items-center gap-1.5 sm:inline-flex"><FileText className="h-3.5 w-3.5" />One institutional workspace</span>
          </div>
        </div>
      </footer>

      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-[#dce8df] bg-[#fbfdf9] p-7 sm:p-9">
          <DialogHeader className="mb-2">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#173b34] text-[#b6e47a]">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#438a68]">Your workspace awaits</p>
            <DialogTitle className="text-2xl font-semibold tracking-tight text-[#173b34]">Sign in to UMS</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-[#71847a]">
              Use your email address or User ID to access your account.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#38574b]">
                Email address or User ID
              </label>
              <Input
                id="email"
                type="text"
                placeholder="name@institution.edu or User ID"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 border-[#d4e1d7] bg-white focus:border-[#438a68] focus:ring-[#438a68]"
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#38574b]">
                Password
              </label>
              <PasswordInput
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 border-[#d4e1d7] bg-white focus:border-[#438a68] focus:ring-[#438a68]"
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-[#173b34] font-semibold text-white hover:bg-[#24564a]"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign in to your account'}
              {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>
          <p className="mt-1 text-center text-xs leading-5 text-[#8a9a91]">
            Your account determines the workspace and tools available to you.
          </p>
        </DialogContent>
      </Dialog>
    </main>
  );
}
