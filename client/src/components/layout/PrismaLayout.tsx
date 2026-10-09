import { useState, useEffect } from 'react';
import { 
  Database, 
  ChevronRight, 
  LogOut, 
  Search, 
  Sun, 
  Moon,
  LayoutDashboard,
  Users,
  CheckCircle2,
  Building2,
  GraduationCap,
  FileText,
  TrendingUp,
  UserCircle,
  Settings,
  ShieldCheck,
  Calendar,
  MessageSquare,
  Wallet,
  Clock,
  Menu,
  GitBranch,
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface TableItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  isSection?: boolean;
  children?: TableItem[];
}

interface PrismaLayoutProps {
  children: React.ReactNode;
  tables: string[] | TableItem[];
  activeTable: string;
  onTableChange: (table: string) => void;
  onLogout?: () => void;
  userName?: string;
  userRole?: string;
  userDesignation?: string;
  userId?: string;
  organizationId?: string;
  schema?: string;
}

export function PrismaLayout({
  children,
  tables,
  activeTable,
  onTableChange,
  onLogout,
  userName,
  userRole,
  userDesignation,
  userId,
  organizationId,
  schema = 'public'
}: PrismaLayoutProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark') || 
           localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Normalize tables to TableItem format with enhanced icons
  const normalizedTables: TableItem[] = tables.map(table => {
    if (typeof table === 'string') {
      return {
        id: table,
        label: table.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        icon: getLucideIcon(table)
      };
    }
    if (table.isSection) return table;
    // If icon is a string (emoji), replace with lucide icon
    return {
      ...table,
      icon: typeof table.icon === 'string' ? getLucideIcon(table.id) : (table.icon ?? getLucideIcon(table.id))
    };
  });

  const filteredTables = normalizedTables.filter(table =>
    table.isSection ||
    table.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    table.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function getLucideIcon(tableId: string): React.ReactNode {
    const iconClass = "w-4 h-4";
    switch (tableId) {
      case 'dashboard':
      case 'overview': return <LayoutDashboard className={iconClass} />;
      case 'users':
      case 'managers': return <Users className={iconClass} />;
      case 'students':
      case 'enroll_student': return <GraduationCap className={iconClass} />;
      case 'student_payment_log':
      case 'invoices':
      case 'program_fees':
      case 'fees':
      case 'fee_structures':
      case 'enrollment_review':
      case 'leave-alloc': return <FileText className={iconClass} />;
      case 'leads':
      case 'targets':
      case 'performance': return <TrendingUp className={iconClass} />;
      case 'employees': return <UserCircle className={iconClass} />;
      case 'departments':
      case 'universities':
      case 'study_centers':
      case 'study-centers':
      case 'branches': return <Building2 className={iconClass} />;
      case 'organizations': return <ShieldCheck className={iconClass} />;
      case 'tasks':
      case 'my_tasks': return <CheckCircle2 className={iconClass} />;
      case 'calendar':
      case 'sessions':
      case 'admission_sessions':
      case 'holidays':
      case 'leaves':
      case 'leave_requests':
      case 'my_leaves':
      case 'vacancies': return <Calendar className={iconClass} />;
      case 'complaints':
      case 'notice_board':
      case 'notice-board': return <MessageSquare className={iconClass} />;
      case 'payroll':
      case 'my_payslips':
      case 'payslips':
      case 'wallet_topups':
      case 'center_wallet': return <Wallet className={iconClass} />;
      case 'attendance':
      case 'my_attendance':
      case 'pending_payment':
      case 'center_rereg_report':
      case 'auth_fees': return <Clock className={iconClass} />;
      case 'hierarchy':
      case 'my_subdept':
      case 'sub_departments':
      case 'subdepartments': return <GitBranch className={iconClass} />;
      case 'announcements': return <Bell className={iconClass} />;
      case 'programs':
      case 'ld_portal':
      case 'ld-portal':
      case 'center_enrollments':
      case 'enrollments_finance': return <GraduationCap className={iconClass} />;
      case 'student-notifications': return <Bell className={iconClass} />;
      case 'student-active-session': return <Calendar className={iconClass} />;
      case 'student-examination-portal': return <FileText className={iconClass} />;
      case 'licenses': return <ShieldCheck className={iconClass} />;
      case 'centers':
      case 'pending_verification': return <ShieldCheck className={iconClass} />;
      case 'program_allocations':
      case 'payroll-batches':
      case 'payroll_batches': return <FileText className={iconClass} />;
      case 'marks': return <FileText className={iconClass} />;
      case 'polls':
      case 'my_team': return <Users className={iconClass} />;
      case 'salary-config':
      case 'att-settings': return <Settings className={iconClass} />;
      case 'org-chart': return <GitBranch className={iconClass} />;
      case 'invite_links': return <TrendingUp className={iconClass} />;
      case 'escalations': return <FileText className={iconClass} />;
      case 'expenses':
      case 'payments': return <Wallet className={iconClass} />;
      default: return <FileText className={iconClass} />;
    }
  }

  const activeTableItem = normalizedTables.find(t => !t.isSection && t.id === activeTable) || normalizedTables.find(t => !t.isSection);

  return (
    <div className="h-screen flex bg-background font-sans overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Premium Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 flex flex-col border-r shadow-xl z-50 transition-transform duration-300 lg:relative lg:translate-x-0",
        "bg-sidebar border-sidebar-border text-sidebar-foreground",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center px-6 gap-3 border-b border-sidebar-border relative">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-orange-300 flex items-center justify-center shadow-lg shadow-primary/20">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-sidebar-foreground">UMS</span>
            <span className="text-[10px] text-sidebar-foreground/50 uppercase font-bold tracking-widest">UMS</span>
          </div>
          {/* Mobile Close Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden ml-auto h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setIsSidebarOpen(false)}
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </Button>
        </div>

        <div className="p-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sidebar-foreground/30 group-focus-within:text-sidebar-primary transition-colors" />
            <input
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-4 bg-sidebar-accent/50 border border-transparent rounded-lg text-xs text-sidebar-foreground outline-none focus:border-sidebar-primary/30 transition-all placeholder:text-sidebar-foreground/30"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 space-y-1 pb-4">
          <div className="px-3 mb-2">
            <span className="text-[10px] font-bold text-sidebar-foreground/40 uppercase tracking-widest">Main Navigation</span>
          </div>
          {filteredTables.map((table) => {
            if (table.isSection) {
              return (
                <div key={table.id} className="px-3 pt-4 pb-1">
                  <span className="text-[10px] font-bold text-sidebar-foreground/40 uppercase tracking-widest">{table.label}</span>
                </div>
              );
            }
            const isActive = activeTable === table.id;
            const hasChildren = Boolean(table.children?.length);
            const isExpanded = expandedItems[table.id] ?? (hasChildren && Boolean(table.children?.some(child => child.id === activeTable)));
            return (
              <div key={table.id}>
                <button
                  onClick={() => hasChildren
                    ? setExpandedItems(current => ({ ...current, [table.id]: !isExpanded }))
                    : onTableChange(table.id)}
                  className={cn(
                    'w-full px-4 py-2.5 rounded-lg text-left text-sm transition-all duration-200 flex items-center gap-3 group',
                    isActive
                      ? 'bg-sidebar-primary/15 text-sidebar-primary font-semibold shadow-sm ring-1 ring-sidebar-primary/10'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <div className={cn(
                    "p-1.5 rounded-md transition-colors shrink-0",
                    isActive
                      ? "bg-sidebar-primary text-white"
                      : "bg-sidebar-accent text-sidebar-foreground/60 group-hover:text-sidebar-foreground"
                  )}>
                    {table.icon}
                  </div>
                  <span className="truncate">{table.label}</span>
                  {hasChildren ? <ChevronRight className={cn('ml-auto w-4 h-4 transition-transform', isExpanded && 'rotate-90')} /> : isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary shrink-0" />
                  )}
                </button>
                {hasChildren && isExpanded && (
                  <div className="ml-8 mt-1 space-y-1 border-l border-sidebar-border pl-2">
                    {table.children?.map(child => (
                      <button
                        key={child.id}
                        onClick={() => onTableChange(child.id)}
                        className={cn(
                          'w-full px-3 py-2 rounded-lg text-left text-xs transition-colors',
                          activeTable === child.id
                            ? 'bg-sidebar-primary/20 text-sidebar-primary font-semibold'
                            : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                        )}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border bg-sidebar-accent/20">
          <div className="flex items-center gap-3 px-2 py-2 mb-4">
            <div className="w-9 h-9 rounded-full bg-sidebar-primary/20 border border-sidebar-primary/30 flex items-center justify-center text-sidebar-primary font-bold shrink-0">
              {userName?.charAt(0) || 'U'}
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">{userName || 'Unknown User'}</p>
              <span className="text-[10px] text-sidebar-foreground/50 font-medium truncate capitalize">{userDesignation || userRole?.replace(/_/g, ' ')}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center gap-2 h-8 rounded-lg bg-sidebar-accent/50 border border-sidebar-border text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors text-xs"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={onLogout}
              className="flex items-center justify-center gap-2 h-8 rounded-lg text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors text-xs"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 flex items-center px-2 sm:px-4 lg:px-8 gap-2 sm:gap-4 bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-20">
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden shrink-0" 
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <div className="p-2 rounded-xl bg-primary/10 text-primary hidden sm:flex shrink-0">
              {activeTableItem?.icon}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30 hidden sm:block shrink-0" />
            <span className="text-base sm:text-lg font-bold text-foreground truncate hidden xs:block">{activeTableItem?.label}</span>
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-4 shrink-0">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg border border-border">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{schema}</span>
            </div>
            
            <div className="h-8 w-px bg-border mx-1" />
            
            <NotificationBell userId={userId} organizationId={organizationId} onNavigate={onTableChange} />
            
            {/* Settings dropdown */}
            <div className="relative">
              <button
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => setIsSettingsOpen(o => !o)}
                title="Settings"
              >
                <Settings className="w-5 h-5 text-muted-foreground" />
              </button>
              {isSettingsOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsSettingsOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-popover border border-border rounded-xl shadow-xl z-40 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settings</p>
                    </div>
                    <div className="p-1">
                      <button
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors text-left"
                        onClick={() => { onTableChange('att-settings'); setIsSettingsOpen(false); }}
                      >
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        Attendance Settings
                      </button>
                      <button
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors text-left"
                        onClick={() => { onTableChange('salary-config'); setIsSettingsOpen(false); }}
                      >
                        <Settings className="w-4 h-4 text-muted-foreground" />
                        Salary Config
                      </button>
                      <button
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors text-left"
                        onClick={() => { onTableChange('leave-alloc'); setIsSettingsOpen(false); }}
                      >
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        Leave Allocation
                      </button>
                      <button
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors text-left"
                        onClick={() => { onTableChange('study-centre-customisation'); setIsSettingsOpen(false); }}
                      >
                        <Settings className="w-4 h-4 text-muted-foreground" />
                        Customisation
                      </button>
                    </div>
                    <div className="p-1 border-t border-border">
                      <button
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors text-left"
                        onClick={() => { toggleTheme(); setIsSettingsOpen(false); }}
                      >
                        {isDarkMode ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
                        {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                      </button>
                      <button
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left"
                        onClick={() => { onLogout?.(); setIsSettingsOpen(false); }}
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-auto p-4 lg:p-8 bg-[radial-gradient(circle_at_top_right,hsl(30_82%_73%_/_0.14),transparent_30%),hsl(var(--background))]">
          <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
