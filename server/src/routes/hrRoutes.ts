// @ts-nocheck
import express from 'express';
import {
  getLeaveRequests,
  getLeaveRequest,
  createLeaveRequest,
  updateLeaveRequest,
  deleteLeaveRequest,
  approveLeave,
  deptApproveLeave,
  hrApproveLeave,
  getLeaveStats,
  getMyLeaves,
  getVacancies,
  getVacancy,
  createVacancy,
  updateVacancy,
  deleteVacancy,
  closeVacancy,
  validateVacancyForHiring,
  fillVacancyPosition,
  getVacancyStats,
  getComplaints,
  getComplaint,
  createComplaint,
  updateComplaint,
  deleteComplaint,
  resolveComplaint,
  replyToComplaint,
  getHolidays,
  getHoliday,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../controllers/hrController.js';
import {
  getAttendance,
  getAttendanceById,
  markAttendance,
  updateAttendance,
  deleteAttendance,
  getMyAttendance,
  getMyAttendanceSummary,
  getActivityReport,
} from '../controllers/attendanceController.js';
import {
  getAdminTeamMembers,
  getAdminEmployeeProfile,
  getAdminEmployeeReviews,
  updateAdminEmployeeProfile,
  updateAdminEmployeeSalary,
  updateAdminEmployeeKPIs,
  updateAdminEmployeeKRAs,
  createAdminEmployeeReview,
  getEmployeeProfile,
  getDepartmentEmployeeProfile,
  getDepartmentEmployeeReviews,
  createDepartmentEmployeeReview,
  upsertEmployeeProfile,
  updateKPIs,
  updateKRAs,
  updateSalaryDetails,
} from '../controllers/employeeProfileController.js';
import {
  getPolls,
  createPoll,
  updatePoll,
  deletePoll,
  votePoll,
} from '../controllers/pollController.js';
import {
  getSalaryConfigs,
  getSalaryConfig,
  upsertSalaryConfig,
  deleteSalaryConfig,
  getLeaveAllocations,
  getLeaveAllocation,
  getMyLeaveAllocation,
  upsertLeaveAllocation,
  bulkInitLeaveAllocations,
  generateSmartPayroll,
} from '../controllers/salaryController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

const authorizeDepartmentLeaveApprover = (req: any, res: any, next: any) => {
  if (req.user?.branchId) {
    return next();
  }
  return authorize('hr_admin', 'ops_admin', 'finance_admin', 'sales_admin', 'center_admin', 'ops_sub_admin', 'org_admin', 'ceo')(req, res, next);
};

// Leave Requests
router.route('/leaves').get(getLeaveRequests).post(createLeaveRequest);
router.route('/leaves/stats').get(authorize('hr_admin', 'dept_admin', 'ceo', 'org_admin', 'superadmin'), getLeaveStats);
router.get('/leaves/my', getMyLeaves);
router.route('/leaves/:id')
  .get(getLeaveRequest)
  .put(updateLeaveRequest)
  .delete(deleteLeaveRequest);
router.put('/leaves/:id/approve', authorize('hr_admin', 'ops_admin', 'finance_admin', 'sales_admin', 'center_admin', 'org_admin', 'ceo'), approveLeave);
router.patch('/leaves/:id/dept-approve', authorizeDepartmentLeaveApprover, deptApproveLeave);
router.patch('/leaves/:id/hr-approve', authorize('hr_admin', 'org_admin', 'ceo'), hrApproveLeave);

// Attendance
router.get('/attendance/my', getMyAttendance);
router.get('/attendance/my-summary', getMyAttendanceSummary);
router.get('/attendance/activity-report', authorize('hr_admin', 'ceo', 'org_admin'), getActivityReport);
router.route('/attendance').get(authorize('hr_admin', 'org_admin', 'ceo'), getAttendance).post(authorize('hr_admin'), markAttendance);
router.route('/attendance/:id')
  .get(getAttendanceById)
  .put(authorize('hr_admin'), updateAttendance)
  .delete(authorize('hr_admin'), deleteAttendance);

// Vacancies
router.route('/vacancies').get(getVacancies).post(authorize('hr_admin', 'ceo', 'org_admin', 'superadmin'), createVacancy);
router.route('/vacancies/stats').get(authorize('hr_admin', 'ceo', 'org_admin', 'superadmin'), getVacancyStats);
router.route('/vacancies/:id')
  .get(getVacancy)
  .put(authorize('hr_admin', 'ceo', 'org_admin', 'superadmin'), updateVacancy)
  .delete(authorize('hr_admin', 'ceo', 'org_admin', 'superadmin'), deleteVacancy);
router.put('/vacancies/:id/close', authorize('hr_admin', 'ceo', 'org_admin', 'superadmin'), closeVacancy);
router.get('/vacancies/:id/validate', authorize('hr_admin', 'ceo', 'org_admin', 'superadmin'), validateVacancyForHiring);
router.patch('/vacancies/:id/fill', authorize('hr_admin', 'ceo', 'org_admin', 'superadmin'), fillVacancyPosition);

// Complaints
router.route('/complaints').get(getComplaints).post(createComplaint);
router.route('/complaints/:id')
  .get(getComplaint)
  .put(authorize('hr_admin'), updateComplaint)
  .delete(authorize('hr_admin'), deleteComplaint);
router.put('/complaints/:id/resolve', authorize('hr_admin'), resolveComplaint);
router.put('/complaints/:id/reply', authorize('hr_admin'), replyToComplaint);

// Holidays
router.route('/holidays').get(getHolidays).post(authorize('hr_admin'), createHoliday);
router.route('/holidays/:id')
  .get(getHoliday)
  .put(authorize('hr_admin'), updateHoliday)
  .delete(authorize('hr_admin'), deleteHoliday);

// Salary Configuration (per employee)
router.get('/salary-configs', authorize('hr_admin', 'org_admin', 'ceo', 'superadmin'), getSalaryConfigs);
router.route('/salary-configs/:userId')
  .get(authorize('hr_admin', 'org_admin', 'ceo', 'superadmin'), getSalaryConfig)
  .put(authorize('hr_admin', 'org_admin', 'ceo', 'superadmin'), upsertSalaryConfig)
  .delete(authorize('hr_admin', 'org_admin', 'ceo', 'superadmin'), deleteSalaryConfig);

// Leave Allocations
router.get('/leave-allocations', authorize('hr_admin', 'org_admin', 'ceo', 'superadmin'), getLeaveAllocations);
router.post('/leave-allocations/bulk-init', authorize('hr_admin', 'org_admin', 'ceo', 'superadmin'), bulkInitLeaveAllocations);
router.get('/leave-allocations/my', getMyLeaveAllocation);
router.route('/leave-allocations/:userId')
  .get(authorize('hr_admin', 'org_admin', 'ceo', 'superadmin'), getLeaveAllocation)
  .put(authorize('hr_admin', 'org_admin', 'ceo', 'superadmin'), upsertLeaveAllocation);

// Smart Payroll Generation (uses salary configs + late deductions)
router.post('/payroll/generate-smart', authorize('hr_admin', 'org_admin', 'ceo', 'superadmin'), generateSmartPayroll);

// Employee Profiles (KPI / KRA / Salary details)
const employeeProfileAdminRoles = ['org_admin', 'university_admin'];
router.get('/employee-profiles/admin/team', authorize(...employeeProfileAdminRoles), getAdminTeamMembers);
router.get('/employee-profiles/:userId/admin', authorize(...employeeProfileAdminRoles), getAdminEmployeeProfile);
router.get('/employee-profiles/:userId/admin/reviews', authorize(...employeeProfileAdminRoles), getAdminEmployeeReviews);
router.put('/employee-profiles/:userId/admin', authorize(...employeeProfileAdminRoles), updateAdminEmployeeProfile);
router.patch('/employee-profiles/:userId/admin/salary', authorize(...employeeProfileAdminRoles), updateAdminEmployeeSalary);
router.patch('/employee-profiles/:userId/admin/kpis', authorize(...employeeProfileAdminRoles), updateAdminEmployeeKPIs);
router.patch('/employee-profiles/:userId/admin/kras', authorize(...employeeProfileAdminRoles), updateAdminEmployeeKRAs);
router.post('/employee-profiles/:userId/admin/reviews', authorize(...employeeProfileAdminRoles), createAdminEmployeeReview);
router.get(
  '/employee-profiles/:userId/team',
  authorize(
    'ops_admin',
    'finance_admin',
    'sales_admin',
    'ops_sub_admin',
    'ops_subadmin',
    'operation_subadmin',
    'operations_sub_admin',
    'operations_subadmin',
    'finance_sub_admin',
    'finance_subadmin',
    'sales_sub_admin',
    'sales_subadmin',
    'employee',
    'bde',
  ),
  getDepartmentEmployeeProfile,
);
router.get(
  '/employee-profiles/:userId/team/reviews',
  authorize(
    'ops_admin',
    'finance_admin',
    'sales_admin',
    'ops_sub_admin',
    'ops_subadmin',
    'operation_subadmin',
    'operations_sub_admin',
    'operations_subadmin',
    'finance_sub_admin',
    'finance_subadmin',
    'sales_sub_admin',
    'sales_subadmin',
    'employee',
    'bde',
  ),
  getDepartmentEmployeeReviews,
);
router.post(
  '/employee-profiles/:userId/team/reviews',
  authorize(
    'ops_admin',
    'finance_admin',
    'sales_admin',
    'ops_sub_admin',
    'ops_subadmin',
    'operation_subadmin',
    'operations_sub_admin',
    'operations_subadmin',
    'finance_sub_admin',
    'finance_subadmin',
    'sales_sub_admin',
    'sales_subadmin',
    'employee',
    'bde',
  ),
  createDepartmentEmployeeReview,
);
router.get('/employee-profiles/:userId', authorize('hr_admin'), getEmployeeProfile);
router.put('/employee-profiles/:userId', authorize('hr_admin'), upsertEmployeeProfile);
router.patch('/employee-profiles/:userId/kpis', authorize('hr_admin'), updateKPIs);
router.patch('/employee-profiles/:userId/kras', authorize('hr_admin'), updateKRAs);
router.patch('/employee-profiles/:userId/salary', authorize('hr_admin'), updateSalaryDetails);

// Announcements (HR creates, all org members can read)
router.get('/announcements', getAnnouncements);
router.post('/announcements', authorize('hr_admin'), createAnnouncement);
router.put('/announcements/:id', authorize('hr_admin'), updateAnnouncement);
router.delete('/announcements/:id', authorize('hr_admin'), deleteAnnouncement);

// Polls (HR creates, all org members can view and vote)
router.get('/polls', getPolls);
router.post('/polls', authorize('hr_admin'), createPoll);
router.put('/polls/:id', authorize('hr_admin'), updatePoll);
router.delete('/polls/:id', authorize('hr_admin'), deletePoll);
router.post('/polls/:id/vote', votePoll);

export default router;
