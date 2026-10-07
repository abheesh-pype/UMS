import axios, { type AxiosInstance, type AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const isLoginRequest = error.config?.url?.includes('/auth/login');
        const authFailureMessages = ['Not authorized', 'Invalid token', 'User not found'];
        const isAuthenticationFailure = authFailureMessages.includes(
          (error.response?.data as { message?: string } | undefined)?.message || ''
        );

        if (error.response?.status === 401 && !isLoginRequest && isAuthenticationFailure) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Generic HTTP methods for direct access
  get(url: string, config?: any) {
    return this.api.get(url, config);
  }

  post(url: string, data?: any, config?: any) {
    return this.api.post(url, data, config);
  }

  put(url: string, data?: any, config?: any) {
    return this.api.put(url, data, config);
  }

  delete(url: string, config?: any) {
    return this.api.delete(url, config);
  }

  patch(url: string, data?: any, config?: any) {
    return this.api.patch(url, data, config);
  }

  // Auth
  async login(email: string, password: string) {
    const response = await this.api.post('/auth/login', { email, password });
    return response.data;
  }

  async register(userData: any) {
    const response = await this.api.post('/auth/register', userData);
    return response.data;
  }

  async getMe() {
    const response = await this.api.get('/auth/me');
    return response.data;
  }

  async updateProfile(data: any) {
    const response = await this.api.put('/auth/updatedetails', data);
    return response.data;
  }

  async updatePassword(currentPassword: string, newPassword: string) {
    const response = await this.api.put('/auth/updatepassword', {
      currentPassword,
      newPassword,
    });
    return response.data;
  }

  // Organizations
  async getOrganizations() {
    const response = await this.api.get('/organizations');
    return response.data;
  }

  async createOrganization(data: any) {
    const response = await this.api.post('/organizations', data);
    return response.data;
  }

  async updateOrganization(id: string, data: any) {
    const response = await this.api.put(`/organizations/${id}`, data);
    return response.data;
  }

  async assignLicense(orgId: string, licenseId: string, durationMonths: number) {
    const response = await this.api.put(`/organizations/${orgId}/license`, {
      licenseId,
      durationMonths,
    });
    return response.data;
  }

  // Licenses
  async getLicenses() {
    const response = await this.api.get('/licenses');
    return response.data;
  }

  async createLicense(data: any) {
    const response = await this.api.post('/licenses', data);
    return response.data;
  }

  // Departments
  async getDepartments() {
    const response = await this.api.get('/departments');
    return response.data;
  }

  async createDepartment(data: any) {
    const response = await this.api.post('/departments', data);
    return response.data;
  }

  // Users
  async getUsers(params?: any) {
    const response = await this.api.get('/users', { params });
    return response.data;
  }

  async createUser(data: any) {
    const response = await this.api.post('/users', data);
    return response.data;
  }

  async updateUser(id: string, data: any) {
    const response = await this.api.put(`/users/${id}`, data);
    return response.data;
  }

  // Tasks
  async getTasks(params?: any) {
    const response = await this.api.get('/tasks', { params });
    return response.data;
  }

  async createTask(data: any) {
    const response = await this.api.post('/tasks', data);
    return response.data;
  }

  async completeTask(id: string, data: any) {
    const response = await this.api.put(`/tasks/${id}/complete`, data);
    return response.data;
  }

  // Students
  async getStudents(params?: any) {
    const response = await this.api.get('/students', { params });
    return response.data;
  }

  async createStudent(data: any) {
    const response = await this.api.post('/students', data);
    return response.data;
  }

  async approveStudent(id: string) {
    const response = await this.api.put(`/students/${id}/approve`);
    return response.data;
  }

  // HR
  async getLeaveRequests(params?: any) {
    const response = await this.api.get('/hr/leaves', { params });
    return response.data;
  }

  async createLeaveRequest(data: any) {
    const response = await this.api.post('/hr/leaves', data);
    return response.data;
  }

  async approveLeave(id: string, action: 'approve' | 'reject', remarks?: string) {
    const response = await this.api.put(`/hr/leaves/${id}/approve`, {
      action,
      remarks,
    });
    return response.data;
  }

  async getAttendance(params?: any) {
    const response = await this.api.get('/attendance', { params });
    return response.data;
  }

  async getVacancies() {
    const response = await this.api.get('/hr/vacancies');
    return response.data;
  }

  async createVacancy(data: any) {
    const response = await this.api.post('/hr/vacancies', data);
    return response.data;
  }

  async getComplaints(params?: any) {
    const response = await this.api.get('/hr/complaints', { params });
    return response.data;
  }

  async createComplaint(data: any) {
    const response = await this.api.post('/hr/complaints', data);
    return response.data;
  }

  async getHolidays() {
    const response = await this.api.get('/hr/holidays');
    return response.data;
  }

  // Finance
  async getInvoices(params?: any) {
    const response = await this.api.get('/finance/invoices', { params });
    return response.data;
  }

  async createInvoice(data: any) {
    const response = await this.api.post('/finance/invoices', data);
    return response.data;
  }

  async getPayments(params?: any) {
    const response = await this.api.get('/finance/payments', { params });
    return response.data;
  }

  async createPayment(data: any) {
    const response = await this.api.post('/finance/payments', data);
    return response.data;
  }

  async getExpenses(params?: any) {
    const response = await this.api.get('/finance/expenses', { params });
    return response.data;
  }

  async approveExpense(id: string, action: 'approve' | 'reject', remarks?: string) {
    const response = await this.api.put(`/finance/expenses/${id}/approve`, {
      action,
      remarks,
    });
    return response.data;
  }

  async getTargets(params?: any) {
    const response = await this.api.get('/finance/targets', { params });
    return response.data;
  }

  async createTarget(data: any) {
    const response = await this.api.post('/finance/targets', data);
    return response.data;
  }

  // Operations
  async getUniversities(params?: any) {
    const response = await this.api.get('/operations/universities', { params });
    return response.data;
  }

  async createUniversity(data: any) {
    const response = await this.api.post('/operations/universities', data);
    return response.data;
  }

  async getPrograms(params?: any) {
    const response = await this.api.get('/operations/programs', { params });
    return response.data;
  }

  async getStudyCenters(params?: any) {
    const response = await this.api.get('/operations/centers', { params });
    return response.data;
  }

  async approveStudyCenter(id: string) {
    const response = await this.api.put(`/operations/centers/${id}/approve`);
    return response.data;
  }

  async getAdmissionSessions(params?: any) {
    const response = await this.api.get('/operations/sessions', { params });
    return response.data;
  }

  async getInternalMarks(params?: any) {
    const response = await this.api.get('/operations/marks', { params });
    return response.data;
  }

  async getAnnouncements(params?: any) {
    const response = await this.api.get('/operations/announcements', { params });
    return response.data;
  }

  // Sales
  async getLeads(params?: any) {
    const response = await this.api.get('/sales/leads', { params });
    return response.data;
  }

  async createLead(data: any) {
    const response = await this.api.post('/sales/leads', data);
    return response.data;
  }

  async convertLead(id: string) {
    const response = await this.api.put(`/sales/leads/${id}/convert`);
    return response.data;
  }

  // Dashboard
  async getDashboardMetrics() {
    const response = await this.api.get('/dashboard/metrics');
    return response.data;
  }

  // Escalations
  async getEscalations(params?: any) {
    const response = await this.api.get('/escalations', { params });
    return response.data;
  }

  async updateEscalation(id: string, action: string, remarks?: string) {
    const response = await this.api.put(`/escalations/${id}`, {
      action,
      remarks,
    });
    return response.data;
  }
}

export const api = new ApiService();
export default api;
