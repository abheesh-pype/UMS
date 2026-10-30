// ERP System Types

export type UserRole = 
  | 'superadmin' 
  | 'org_admin' 
  | 'ceo' 
  | 'ops_admin' 
  | 'ops_sub_admin' 
  | 'finance_admin' 
  | 'hr_admin' 
  | 'sales_admin' 
  | 'university_admin'
  | 'bde' 
  | 'center_admin' 
  | 'academic_admin'
  | 'employee'
  | 'staff';

export type DepartmentType = 'operations' | 'finance' | 'hr' | 'sales' | 'academic' | 'custom';
export type SubDepartmentType = 'openschool' | 'online' | 'skill' | 'bvoc';

export interface Organization {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  logo?: string;
  status: 'active' | 'inactive' | 'suspended';
  licenseId?: string;
  licenseExpiry?: Date;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface License {
  id: string;
  name: string;
  type: 'basic' | 'premium' | 'enterprise';
  features: string[];
  maxUsers: number;
  maxStorage: number;
  durationMonths: number;
  price: number;
  status: 'active' | 'inactive';
}

export interface LicenseAssignment {
  id: string;
  organizationId: string;
  licenseId: string;
  assignedAt: Date;
  expiresAt: Date;
  status: 'active' | 'expired' | 'revoked';
}

export interface Department {
  id: string;
  organizationId: string;
  name: string;
  type: DepartmentType;
  subType?: SubDepartmentType;
  features: string[];
  permissions: Permission[];
  status: 'active' | 'inactive';
  createdAt: Date;
}

export interface Permission {
  id: string;
  name: string;
  module: string;
  actions: ('create' | 'read' | 'update' | 'delete' | 'approve')[];
}

export interface User {
  id: string;
  organizationId: string;
  universityId?: string;
  studyCenterId?: string;
  departmentId?: string;
  subDepartmentId?: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  designation?: string;
  reportingTo?: string;
  status: 'active' | 'inactive' | 'on_leave';
  lastLogin?: Date;
  createdAt: Date;
}

export interface Employee extends User {
  employeeId: string;
  joinDate: Date;
  salary?: number;
  attendance?: AttendanceRecord[];
  leaves?: LeaveRequest[];
  tasks?: Task[];
  performance?: PerformanceMetric;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: Date;
  status: 'present' | 'absent' | 'half_day' | 'leave';
  checkIn?: Date;
  checkOut?: Date;
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: 'sick' | 'casual' | 'earned' | 'unpaid';
  startDate: Date;
  endDate: Date;
  reason: string;
  status: 'pending' | 'dept_approved' | 'approved' | 'rejected';
  deptAdminRemarks?: string;
  hrRemarks?: string;
  appliedAt: Date;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  assignedBy: string;
  departmentId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  deadline: Date;
  completedAt?: Date;
  evidence?: string[];
  remarks?: string;
  escalatedTo?: string;
  createdAt: Date;
}

export interface PerformanceMetric {
  employeeId: string;
  taskCompletionRate: number;
  avgCompletionTime: number;
  productivityScore: number;
  attendanceRate: number;
  period: string;
}

export interface Vacancy {
  id: string;
  departmentId: string;
  designation: string;
  count: number;
  filled: number;
  status: 'open' | 'closed';
  createdAt: Date;
}

export interface University {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address?: string;
  contact?: string;
  programs: Program[];
  status: 'active' | 'inactive';
}

export interface Program {
  id: string;
  universityId: string;
  name: string;
  code: string;
  duration: number;
  feeStructure: FeeStructure;
  syllabus?: Syllabus;
  status: 'active' | 'inactive';
}

export interface FeeStructure {
  id: string;
  programId: string;
  registrationFee: number;
  tuitionFee: number;
  examFee: number;
  otherCharges: Record<string, number>;
  gstPercentage: number;
}

export interface Syllabus {
  id: string;
  programId: string;
  subjects: Subject[];
  totalMarks: number;
  passingMarks: number;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  credits: number;
  maxMarks: number;
}

export interface StudyCenter {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address: string;
  contact: string;
  email: string;
  status: 'pending' | 'active' | 'inactive' | 'suspended';
  approvedBy?: string;
  approvedAt?: Date;
  referredBy?: string;
  students: Student[];
  invoices: Invoice[];
  credentials?: CenterCredentials;
}

export interface CenterCredentials {
  username: string;
  password: string;
  revealedAt?: Date;
  revealedBy?: string;
  ipAddress?: string;
}

export interface Student {
  id: string;
  centerId: string;
  organizationId: string;
  enrollmentNo: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  programId: string;
  sessionId?: string;
  status: 'pending' | 'active' | 'inactive' | 'completed';
  joinDate: Date;
  fees: StudentFee[];
  marks: InternalMark[];
  reregStatus?: REREGStatus;
}

export interface REREGStatus {
  semester: number;
  status: 'pending' | 'completed' | 'carry_forward';
  feePaid: boolean;
  completedAt?: Date;
}

export interface StudentFee {
  id: string;
  studentId: string;
  type: 'registration' | 'tuition' | 'exam' | 'miscellaneous';
  amount: number;
  paid: number;
  pending: number;
  dueDate: Date;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
}

export interface InternalMark {
  id: string;
  studentId: string;
  subjectId: string;
  marks: number;
  maxMarks: number;
  examType: 'internal' | 'practical' | 'assignment';
  enteredBy: string;
  enteredAt: Date;
}

export interface Invoice {
  id: string;
  centerId: string;
  studentId?: string;
  invoiceNo: string;
  amount: number;
  tax: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  items: InvoiceItem[];
  createdAt: Date;
  paidAt?: Date;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface PaymentEntry {
  id: string;
  invoiceId: string;
  amount: number;
  method: 'cash' | 'cheque' | 'bank_transfer' | 'upi' | 'card';
  referenceNo?: string;
  receivedBy: string;
  receivedAt: Date;
  notes?: string;
}

export interface ExpenseClaim {
  id: string;
  employeeId: string;
  amount: number;
  category: string;
  description: string;
  receipts: string[];
  status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
  submittedAt: Date;
}

export interface Lead {
  id: string;
  organizationId: string;
  centerName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  source: string;
  referredBy?: string;
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'converted' | 'lost';
  notes: string;
  createdAt: Date;
  convertedAt?: Date;
}

export interface Deal {
  id: string;
  leadId: string;
  value: number;
  stage: string;
  probability: number;
  expectedCloseDate: Date;
  actualCloseDate?: Date;
  status: 'open' | 'won' | 'lost';
}

export interface Touchpoint {
  id: string;
  leadId: string;
  type: 'call' | 'email' | 'meeting' | 'visit';
  notes: string;
  scheduledAt?: Date;
  completedAt?: Date;
  createdBy: string;
}

export interface Quotation {
  id: string;
  leadId: string;
  items: QuotationItem[];
  subtotal: number;
  tax: number;
  total: number;
  validUntil: Date;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  createdAt: Date;
}

export interface QuotationItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Target {
  id: string;
  organizationId: string;
  departmentId?: string;
  employeeId?: string;
  centerId?: string;
  type: 'revenue' | 'students' | 'centers';
  period: string;
  target: number;
  achieved: number;
  incentive?: number;
}

export interface IncentiveStructure {
  id: string;
  targetId: string;
  minAchievement: number;
  maxAchievement: number;
  incentiveAmount: number;
  incentivePercentage?: number;
}

export interface Announcement {
  id: string;
  organizationId: string;
  departmentId?: string;
  title: string;
  content: string;
  type: 'general' | 'hr' | 'ops' | 'finance' | 'sales';
  priority: 'low' | 'medium' | 'high';
  postedBy: string;
  postedAt: Date;
  expiresAt?: Date;
}

export interface Holiday {
  id: string;
  organizationId: string;
  name: string;
  date: Date;
  type: 'national' | 'regional' | 'company';
  description?: string;
}

export interface Complaint {
  id: string;
  employeeId: string;
  subject: string;
  description: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  submittedAt: Date;
  resolvedAt?: Date;
  resolution?: string;
}

export interface Escalation {
  id: string;
  type: 'task_overdue' | 'approval_delay' | 'compliance' | 'credential_reveal';
  entityId: string;
  entityType: string;
  raisedBy: string;
  raisedAt: Date;
  currentLevel: number;
  maxLevel: number;
  status: 'active' | 'resolved';
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  chain: EscalationChainItem[];
}

export interface EscalationChainItem {
  level: number;
  role: string;
  userId?: string;
  action?: string;
  actionAt?: Date;
  remarks?: string;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  timestamp: Date;
}

export interface DashboardMetrics {
  totalOrganizations?: number;
  activeLicenses?: number;
  expiredLicenses?: number;
  totalRevenue?: number;
  
  totalEmployees?: number;
  presentToday?: number;
  onLeave?: number;
  pendingLeaves?: number;
  
  totalStudents?: number;
  pendingAdmissions?: number;
  activeStudents?: number;
  completedStudents?: number;
  
  totalCenters?: number;
  pendingCenters?: number;
  activeCenters?: number;
  
  pendingTasks?: number;
  overdueTasks?: number;
  completedTasks?: number;
  
  monthlyRevenue?: number;
  pendingInvoices?: number;
  overdueInvoices?: number;
  
  totalLeads?: number;
  convertedLeads?: number;
  pendingLeads?: number;
  
  escalations?: number;
  criticalIssues?: number;
}

export interface AdmissionSession {
  id: string;
  organizationId: string;
  subDepartmentId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  examDate?: Date;
  status: 'pending' | 'approved' | 'active' | 'closed';
  approvedBy?: string;
}
