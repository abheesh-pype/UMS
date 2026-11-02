// Sidebar menus for the role dashboards. Kept apart from the dashboards so the app shell can
// build the menu without downloading every dashboard.

export function getOpsNavItems(isSubDeptManager: boolean) {
  return [
    { id: '__dashboard_section', label: 'Dashboard', isSection: true },
    { id: 'overview', label: 'Overview' },

    { id: '__operations_team_section', label: 'Operation Team', isSection: true },
    ...(isSubDeptManager ? [{ id: 'my_subdept', label: 'My Sub-Dept' }] : []),
    { id: 'my_team', label: 'My Team' },
    { id: 'targets', label: 'Target' },
    { id: 'tasks', label: 'Task' },

    { id: '__admission_section', label: 'Admission', isSection: true },
    { id: 'students', label: 'Students' },
    { id: 'enrollment_review', label: 'Enrollment Review' },
    { id: 'sessions', label: 'Admission Session' },
    // { id: 'status_requests', label: 'Student Status Requests' },
    { id: 'marks', label: 'Internal Marks' },

    { id: '__programs_section', label: 'Programs', isSection: true },
    { id: 'programs', label: 'Programs' },
    { id: 'program_allocations', label: 'Program Allocation' },

    { id: '__study_center_management_section', label: 'Study Center Management', isSection: true },
    { id: 'centers', label: 'Study Centers' },
    { id: 'center_admissions', label: 'Centers Admissions' },

    { id: '__verification_section', label: 'Verification', isSection: true },
    { id: 'pending_verification', label: 'Pending Verification' },

    { id: '__portal_section', label: 'My Portal', isSection: true },
    { id: 'my_leaves', label: 'My Leaves' },
    { id: 'leave_approvals', label: 'Leave Approvals' },
    { id: 'my_attendance', label: 'Attendance' },
    { id: 'team_attendance', label: 'Team Attendance' },
    { id: 'my_payslips', label: 'Pay Slips' },
    { id: 'my_documents', label: 'My Documents' },
    { id: 'manager_hiring', label: 'Hiring Requests' },
    { id: 'holidays', label: 'Holidays' },
    { id: 'announcements', label: 'Announcements' },
    { id: 'broadcast_notifications', label: 'Send Notifications' },
    { id: 'notice-board', label: 'Notice Board' },
    { id: 'polls', label: 'Polls' },
  ];
}

export function getHRNavItems() {
  return [
    { id: '__hr_section', label: 'HR Management', isSection: true },
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users' },
    { id: 'my_team', label: 'My Team' },
    { id: 'employees', label: 'Employees' },
    { id: 'leaves', label: 'Leave Requests' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'hiring', label: 'Hiring & Recruitment' },
    { id: 'candidate_pipeline', label: 'Candidate Pipeline' },
    { id: 'hiring_request', label: 'Hiring Request' },
    { id: 'vacancies', label: 'Vacancies' },
    { id: 'holidays', label: 'Holidays' },
    { id: 'complaints', label: 'Complaints' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'payroll-batches', label: 'Payroll Batches' },
    { id: 'salary-config', label: 'Salary Config' },
    { id: 'leave-alloc', label: 'Leave Allocation' },
    { id: 'announcements', label: 'Announcements' },
    { id: 'polls', label: 'Polls' },
    { id: 'org-chart', label: 'Hierarchy' },
    { id: 'managers', label: 'Managers' },
    { id: 'att-settings', label: 'Att. Settings' },
    { id: 'shift-settings', label: 'Shift Settings' },
    { id: 'activity_report', label: 'Activity Report' },
    { id: '__portal_section', label: 'My Portal', isSection: true },
    { id: 'my_leaves', label: 'My Leaves' },
    { id: 'leave_approvals', label: 'Leave Approvals' },
    { id: 'my_attendance', label: 'My Attendance' },
    { id: 'my_payslips', label: 'Pay Slips' },
    { id: 'my_documents', label: 'My Documents' },
    { id: 'notice-board', label: 'Notice Board' },
    { id: 'subdepartments', label: 'Sub-Departments' },
  ];
}

export function getFinanceNavItems() {
  return [
    { id: '__dashboard_section', label: 'Dashboard', isSection: true },
    { id: 'overview', label: 'Overview' },
    { id: 'my_team', label: 'My Team' },
    { id: 'tasks', label: 'Task' },
    { id: 'manager_hiring', label: 'Hiring Requests' },
    { id: 'escalations', label: 'Escalation' },

    { id: '__fee_payment_section', label: 'Fee & Payment Management', isSection: true },
    { id: 'university_fees', label: 'University Fee' },
    { id: 'fees', label: 'Fee Structure' },
    { id: 'invoices', label: 'Invoice' },
    { id: 'payments', label: 'Payment' },
    { id: 'bank_details', label: 'Bank Details' },
    { id: 'student_payment_log', label: 'Student Payment Log' },
    { id: 'pending_payment', label: 'Pending Payment' },
    // { id: 'wallet_topups', label: 'Wallet Top Ups' },

    { id: '__student_admission_finance_section', label: 'Student & Admission Finance', isSection: true },
    { id: 'students', label: 'Students' },
    { id: 'admission_sessions', label: 'Admission Session' },
    { id: 'enrollments_finance', label: 'Enrollment' },
    { id: 'rereg_report_admission', label: 'Re-Registration Report' },
    { id: 'auth_fees', label: 'Auth Fee' },
    { id: 'program_fees', label: 'Program Fee' },

    { id: '__study_center_finance_section', label: 'Study Centre Finance', isSection: true },
    { id: 'study_centers', label: 'Study Centre' },
    { id: 'center_admissions', label: 'Centre Admission' },
    // { id: 'status_requests', label: 'Status Request' },
    // { id: 'commissions', label: 'Commission' },

    { id: '__accounting_reports_section', label: 'Accounting & Financial Reports', isSection: true },
    { id: 'expenses', label: 'Expense' },
    { id: 'income_expenditure', label: 'Income & Expenditure' },
    { id: 'profit_loss', label: 'Profit & Loss' },
    { id: 'total_report', label: 'Total Data Report' },

    { id: '__payroll_section', label: 'Payroll & Employee Finance', isSection: true },
    { id: 'payroll', label: 'Payroll' },
    { id: 'payroll-batches', label: 'Payroll Batches' },
    { id: 'salary_approvals', label: 'Salary Approvals' },
    { id: 'leaves', label: 'Leave Request' },

    { id: '__targets_section', label: 'Targets & Performance', isSection: true },
    { id: 'targets', label: 'Target' },
    { id: 'sales_targets', label: 'Sales Targets' },

    { id: '__reports_section', label: 'Reports', isSection: true },
    { id: 'rereg_report', label: 'Re-Registration Report' },

    { id: '__portal_section', label: 'My Portal', isSection: true },
    { id: 'my_leaves', label: 'My Leaves' },
    { id: 'leave_approvals', label: 'Leave Approvals' },
    { id: 'my_attendance', label: 'My Attendance' },
    { id: 'team_attendance', label: 'Team Attendance' },
    { id: 'my_payslips', label: 'Pay Slips' },
    { id: 'my_documents', label: 'My Documents' },
    { id: 'holidays', label: 'Holidays' },
    { id: 'notice-board', label: 'Notice Board' },
    { id: 'broadcast_notifications', label: 'Send Notifications' },
    { id: 'subdepartments', label: 'Sub-Departments' },
  ];
}

export function getSalesNavItems(includeStudentEnrollment = true) {
  return [
    { id: '__dashboard_section', label: 'Dashboard', isSection: true },
    { id: 'overview', label: 'Overview' },

    { id: '__sales_team_section', label: 'Sales Team', isSection: true },
    { id: 'targets', label: 'Target' },
    { id: 'my_team', label: 'My Team' },
    { id: 'tasks', label: 'Task' },

    { id: '__admission_section', label: 'Admission', isSection: true },
    { id: 'invite_links', label: 'Invite Link' },
    ...(includeStudentEnrollment ? [{ id: 'student_enrollment', label: 'Student Enrollment' }] : []),

    { id: '__study_center_management_section', label: 'Study Center Management', isSection: true },
    { id: 'study_centre', label: 'Study Center' },
    { id: 'center_admissions', label: 'Center Admission' },
    { id: 'center_onboarding', label: 'Center Onboarding Status' },

    { id: '__verification_section', label: 'Verification', isSection: true },
    { id: 'pending_center_verification', label: 'Pending Verification' },

    { id: '__portal_section', label: 'My Portal', isSection: true },
    { id: 'my_leaves', label: 'My Leaves' },
    { id: 'leave_approvals', label: 'Leave Approvals' },
    { id: 'my_attendance', label: 'Attendance' },
    { id: 'team_attendance', label: 'Team Attendance' },
    { id: 'my_payslips', label: 'Pay Slips' },
    { id: 'my_documents', label: 'My Documents' },
    { id: 'manager_hiring', label: 'Hiring Requests' },
    { id: 'holidays', label: 'Holidays' },
    { id: 'announcements', label: 'Announcements' },
    { id: 'notice-board', label: 'Notice Board' },
  ];
}

export function getBranchManagerNavItems() {
  return [
    { id: '__branch_section', label: 'Branch Overview', isSection: true },
    { id: 'overview', label: 'Overview' },
    { id: '__sales_section', label: 'Sales', isSection: true },
    { id: 'leads', label: 'Leads' },
    { id: 'targets', label: 'Targets' },
    { id: 'invite_links', label: 'Invite Links' },
    { id: 'my_team', label: 'My Team' },
    { id: 'branch_centers_sales', label: 'Study Centers (Sales)' },
    { id: '__ops_section', label: 'Operations', isSection: true },
    { id: 'students', label: 'Students' },
    { id: 'universities', label: 'Universities' },
    { id: 'programs', label: 'Programs' },
    { id: 'centers', label: 'Study Centers' },
    { id: 'pending_verification', label: 'Pending Verification' },
    { id: 'enrollment_review', label: 'Enrollment Review' },
    { id: 'sessions', label: 'Admission Sessions' },
    { id: '__shared_section', label: 'Management', isSection: true },
    { id: 'tasks', label: 'Tasks' },
    { id: 'announcements', label: 'Announcements' },
    { id: '__portal_section', label: 'My Portal', isSection: true },
    { id: 'my_leaves', label: 'My Leaves' },
    { id: 'leave_approvals', label: 'Leave Approvals' },
    { id: 'my_attendance', label: 'Attendance' },
    { id: 'team_attendance', label: 'Team Attendance' },
    { id: 'my_payslips', label: 'Pay Slips' },
    { id: 'my_documents', label: 'My Documents' },
    { id: 'manager_hiring', label: 'Hiring Requests' },
    { id: 'holidays', label: 'Holidays' },
    { id: 'notice-board', label: 'Notice Board' },
  ];
}

export function getUniversityNavItems() {
  return [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'team', label: 'Team' },
    { id: 'targets', label: 'Targets' },
    {
      id: 'students',
      label: 'Students',
      children: [
        { id: 'enrolled_students', label: 'Enrolled Students' },
      ],
    },
    { id: 'pending_center_verification', label: 'Pending Verification' },
    { id: 'manager_hiring', label: 'Hiring Requests' },
    { id: 'integration', label: 'Integration' },
  ];
}
