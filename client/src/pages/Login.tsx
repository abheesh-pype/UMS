import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Building2,
  GraduationCap,
  LayoutDashboard,
  Landmark,
  LibraryBig,
  MapPin,
  Microscope,
  Music2,
  Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import api from '@/lib/api';
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
    title: 'Academic discovery',
    description: 'Explore new interests, deepen your knowledge, and find a path that brings your ambitions to life.',
    accent: 'bg-[#f3ead7] text-[#8b6332]',
  },
  {
    icon: Microscope,
    title: 'Ideas into impact',
    description: 'Ask meaningful questions, follow your curiosity, and discover how knowledge can make a difference.',
    accent: 'bg-[#e6eee5] text-[#426c53]',
  },
  {
    icon: Users,
    title: 'A community to call your own',
    description: 'Meet people who challenge you, encourage you, and make the university experience unforgettable.',
    accent: 'bg-[#e7e9f0] text-[#535e7a]',
  },
];

const workflowSteps = [
  { number: '01', title: 'Discover your direction', detail: 'Take time to explore what interests you and where you would like your studies to lead.' },
  { number: '02', title: 'Prepare for your next step', detail: 'Learn about the application journey and gather the information you need to get started.' },
  { number: '03', title: 'Begin your university story', detail: 'Join a community where learning, new experiences, and future possibilities come together.' },
];

const PUBLIC_APPLICATION_STATUS_CREDENTIALS_KEY = 'publicApplicationStatusCredentials';

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

    const credentials = {
      email: email.trim(),
      password,
    };
    let loginError: any;

    try {
      const success = await login(credentials.email, credentials.password);
      if (success) {
        setIsLoading(false);
        return;
      }
    } catch (error: any) {
      loginError = error;
    }

    try {
      const response = await api.post('/public/student-applications/status', credentials);
      if (response.data.success) {
        sessionStorage.setItem(PUBLIC_APPLICATION_STATUS_CREDENTIALS_KEY, JSON.stringify(credentials));
        window.location.assign('/application-status');
        return;
      }
    } catch (statusError: any) {
      const statusMessage = statusError.response?.data?.message;
      if (statusMessage && statusError.response?.status !== 401) {
        setError(statusMessage);
        setIsLoading(false);
        return;
      }
    }

    if (loginError?.response?.status && loginError.response.status !== 401) {
      const responseData = loginError.response?.data;
      const serverMessage = typeof responseData === 'string'
        ? responseData
        : responseData?.message;
      setError(serverMessage || 'Invalid email/user ID or password. Applicants can check status using their email and date of birth.');
    } else {
      setError('Invalid email/user ID or password. Applicants can check status using their email and date of birth.');
    }
    setIsLoading(false);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f7f1] text-[#173b34]">
      <header className="relative z-10 border-b border-[#dce8df] bg-[#f9fbf7]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="#home" className="flex shrink-0 items-center gap-3" aria-label="UMS University home">
            <img src="/logo.png" alt="" className="h-10 w-10 rounded-xl object-contain" />
            <span className="text-xl font-bold tracking-tight text-[#173b34]">UMS</span>
            <span className="hidden border-l border-[#cad9cf] pl-3 text-xs font-medium text-[#60766b] sm:inline">
              University
            </span>
          </a>
          <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-4 lg:gap-7">
            <a href="#academics" className="hidden text-sm font-medium text-[#526b60] transition hover:text-[#173b34] lg:inline">Academics</a>
            <a href="#admissions" className="hidden text-sm font-medium text-[#526b60] transition hover:text-[#173b34] lg:inline">Admissions</a>
            <a href="#campus" className="hidden text-sm font-medium text-[#526b60] transition hover:text-[#173b34] lg:inline">Campus life</a>
            <button
              type="button"
              onClick={() => window.location.assign('/apply')}
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

      <section id="home" className="relative isolate overflow-hidden bg-[#f0eee5] text-[#1c342d]">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[38rem] w-[38rem] rounded-full bg-[#d9e1ce]/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-44 left-[30%] h-[32rem] w-[32rem] rounded-full bg-[#e8dcc2]/50 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1fr_0.95fr] lg:gap-16 lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#8b7045]">
              <span className="h-px w-8 bg-[#b5965d]" />
              Welcome to UMS University
            </div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.06] tracking-[-0.055em] sm:text-6xl lg:text-[4.5rem]">
              Find your place.
              <span className="mt-2 block font-serif font-normal italic text-[#8b7045]">Shape your future.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-[#5e685f] sm:text-lg sm:leading-8">
              A university is more than a place to study. It is where curiosity finds direction, ideas become action, and lifelong possibilities begin.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#academics"
                className="inline-flex items-center gap-2 rounded-full bg-[#244b3c] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#244b3c]/15 transition hover:-translate-y-0.5 hover:bg-[#183a2e]"
              >
                Discover university life <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#admissions" className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-[#344b3f] transition hover:bg-white/70">
                Admissions <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-10 flex items-center gap-3 border-t border-[#d8d3c7] pt-5 text-sm text-[#657066]">
              <MapPin className="h-4 w-4 shrink-0 text-[#8b7045]" />
              <span>A community for learning, discovery, and new beginnings</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl">
            <div className="absolute -right-4 -top-5 h-28 w-28 rounded-full border border-[#b5965d]/40 sm:-right-6 sm:-top-7 sm:h-36 sm:w-36" />
            <div className="relative overflow-hidden rounded-[1.5rem] border-[7px] border-white bg-[#dfe7d9] shadow-2xl shadow-[#31483a]/15 sm:rounded-[2rem] sm:border-[10px]">
              <svg viewBox="0 0 720 520" role="img" aria-label="Illustration of a university campus" className="block h-auto w-full">
                <defs>
                  <linearGradient id="campus-sky" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#d9e7e0" />
                    <stop offset="100%" stopColor="#f1ead9" />
                  </linearGradient>
                  <linearGradient id="campus-building" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#f7f1e4" />
                    <stop offset="100%" stopColor="#d9cfb9" />
                  </linearGradient>
                </defs>
                <rect width="720" height="520" fill="url(#campus-sky)" />
                <circle cx="575" cy="106" r="47" fill="#e8c98d" opacity=".75" />
                <path d="M0 312 Q156 252 318 307 T720 286 V520 H0Z" fill="#a9bda0" />
                <path d="M0 356 Q171 297 343 348 T720 322 V520 H0Z" fill="#748f70" />
                <path d="M201 278 L360 176 L519 278Z" fill="#78694f" />
                <path d="M226 271 L360 190 L494 271Z" fill="#a58a61" />
                <rect x="230" y="270" width="260" height="151" fill="url(#campus-building)" />
                <rect x="205" y="410" width="310" height="19" fill="#a58a61" />
                <rect x="194" y="428" width="332" height="13" fill="#78694f" />
                <rect x="346" y="224" width="28" height="45" rx="14" fill="#d9cfb9" />
                <path d="M351 261 V239 A9 9 0 0 1 369 239 V261Z" fill="#657c6a" />
                {[258, 310, 362, 414, 466].map(x => (
                  <g key={x}>
                    <rect x={x} y="289" width="26" height="111" fill="#b8a98c" />
                    <path d={`M${x + 2} 315 V301 A11 11 0 0 1 ${x + 24} 301 V315Z`} fill="#748b78" />
                    <rect x={x + 2} y="328" width="22" height="23" fill="#748b78" />
                    <rect x={x + 2} y="358" width="22" height="23" fill="#748b78" />
                    <rect x={x - 2} y="286" width="30" height="6" fill="#8e7b5d" />
                    <rect x={x - 2} y="398" width="30" height="6" fill="#8e7b5d" />
                  </g>
                ))}
                <rect x="331" y="351" width="58" height="69" fill="#897552" />
                <path d="M340 419 V372 A20 20 0 0 1 380 372 V419Z" fill="#536b59" />
                <path d="M0 445 Q174 403 360 445 T720 426 V520 H0Z" fill="#526f55" />
                <path d="M318 520 L347 435 H373 L402 520Z" fill="#d7c79f" />
                <g fill="#47654d">
                  <circle cx="120" cy="338" r="57" /><circle cx="78" cy="367" r="44" /><circle cx="150" cy="379" r="39" />
                  <circle cx="588" cy="329" r="63" /><circle cx="644" cy="365" r="48" /><circle cx="560" cy="379" r="42" />
                </g>
                <g fill="#806d4c">
                  <rect x="111" y="371" width="17" height="66" /><rect x="582" y="365" width="18" height="70" />
                </g>
              </svg>
              <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-2xl border border-white/70 bg-[#fffefa]/95 px-4 py-3 shadow-lg backdrop-blur sm:bottom-6 sm:left-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e7ede2] text-[#345b43]">
                  <Landmark className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xs font-bold text-[#263c30]">A place to belong</span>
                  <span className="mt-0.5 block text-[10px] text-[#72776b]">Learn · Connect · Become</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#e8e3d8] bg-[#fffefa]">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:gap-8">
          {[
            { icon: BookOpen, label: 'Learning with purpose' },
            { icon: Microscope, label: 'Curiosity and discovery' },
            { icon: Music2, label: 'Ideas and creativity' },
            { icon: Users, label: 'A welcoming community' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 text-sm font-medium text-[#536358]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8e4d7] text-[#755f3c]">
                <Icon className="h-4 w-4" />
              </span>
              {label}
            </div>
          ))}
        </div>
      </section>

      <section id="academics" className="scroll-mt-16 px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8b7045]">The university experience</p>
            <h2 className="mt-4 font-serif text-3xl font-medium leading-tight tracking-[-0.035em] text-[#1c342d] sm:text-5xl">
              Come curious. Leave ready for what’s next.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#687268]">
              Discover the people, ideas, and opportunities that make a university journey your own.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description, accent }) => (
              <article key={title} className="rounded-3xl border border-[#e8e3d8] bg-[#fffefa] p-6 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#31483a]/5 sm:p-8">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 font-serif text-xl font-semibold text-[#263c30]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#687268]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="admissions" className="scroll-mt-16 bg-[#e9ede3] px-5 py-20 text-[#1c342d] sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8b7045]">Admissions</p>
            <h2 className="mt-4 font-serif text-3xl font-medium leading-tight tracking-[-0.035em] sm:text-5xl">
              Your next chapter starts with a first step.
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-[#5f6b60] sm:text-base">
              Whether you are just beginning to explore or ready to apply, take your time and find the path that feels right for you.
            </p>
          </div>
          <div className="divide-y divide-[#d0d8cb]">
            {workflowSteps.map(step => (
              <div key={step.number} className="grid gap-3 py-5 sm:grid-cols-[4rem_1fr] sm:gap-5">
                <span className="font-mono text-sm font-bold text-[#8b7045]">{step.number}</span>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#5f6b60]">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="campus" className="scroll-mt-16 px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8b7045]">Life at university</p>
            <h2 className="mt-4 font-serif text-3xl font-medium leading-tight tracking-[-0.035em] text-[#1c342d] sm:text-4xl">
              There is room to find your own way.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#687268]">
              Learning happens in many ways. Make the most of the spaces, people, and experiences that surround you.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: LibraryBig, title: 'Discover ideas', detail: 'Follow your curiosity and make learning your own.' },
              { icon: Microscope, title: 'Explore possibilities', detail: 'Look beyond the familiar and ask new questions.' },
              { icon: Users, title: 'Find your community', detail: 'Build connections that make this place yours.' },
              { icon: GraduationCap, title: 'Grow with purpose', detail: 'Develop knowledge and confidence for what comes next.' },
              { icon: Music2, title: 'Make and create', detail: 'Bring your perspective, creativity, and energy.' },
              { icon: MapPin, title: 'Make campus your own', detail: 'Find the spaces and experiences that inspire you.' },
            ].map(({ icon: Icon, title, detail }) => (
              <div key={title} className="flex gap-4 rounded-2xl border border-[#e8e3d8] bg-[#fffefa] p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8e4d7] text-[#755f3c]">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[#263c30]">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#72776b]">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 sm:pb-24">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 rounded-[2rem] bg-[#244b3c] px-7 py-9 text-white sm:px-12 sm:py-12 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e2c58d]">Your next chapter</p>
            <h2 className="mt-3 font-serif text-3xl font-medium leading-tight tracking-[-0.035em] sm:text-4xl">
              Ready to make this your place?
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#e0e8df]">
              Take the first step toward a university experience filled with learning, possibility, and new beginnings.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.assign('/apply')}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#e2c58d] px-5 py-3 text-sm font-bold text-[#243b30] transition hover:bg-[#edd5a5]"
          >
            Enroll now <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <footer className="border-t border-[#e8e3d8] bg-[#fffefa] px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-xs text-[#72776b] sm:flex-row">
          <div className="flex items-center gap-2 font-semibold text-[#344b3f]">
            <img src="/logo.png" alt="" className="h-6 w-6 rounded-md object-contain" />
            UMS University
          </div>
          <span>A place for learning, discovery, and possibility.</span>
        </div>
      </footer>

      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-[#dce8df] bg-[#fbfdf9] p-7 sm:p-9">
          <DialogHeader className="mb-2">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#244b3c] text-[#e2c58d]">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8b7045]">University community</p>
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
            Sign in to access your university account and services.
          </p>
          <div className="mt-4 border-t border-[#e1e9e1] pt-4 text-center">
            <p className="text-sm text-[#71847a]">Applied directly from the landing page?</p>
            <Button
              type="button"
              variant="link"
              className="mt-1 h-auto p-0 font-semibold text-[#24564a]"
              onClick={() => {
                setLoginOpen(false);
                window.location.assign('/application-status');
              }}
            >
              Check application status with email and date of birth
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
