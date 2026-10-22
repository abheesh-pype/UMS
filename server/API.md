# ERP System API Documentation

## Base URL
```
http://localhost:5000/api/v1
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "count": 10  // For list endpoints
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message here"
}
```

## Endpoints

### Authentication

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "ceo@edutechglobal.com",
  "password": "ceo123"
}

Response:
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "jwt_token_here",
    "refreshToken": "refresh_token_here"
  }
}
```

#### Register User
```http
POST /auth/register
Content-Type: application/json
Authorization: Bearer <token>

{
  "organizationId": "org_id",
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "employee",
  "departmentId": "dept_id"
}
```

#### Get Current User
```http
GET /auth/me
Authorization: Bearer <token>
```

#### Update Profile
```http
PUT /auth/updatedetails
Authorization: Bearer <token>

{
  "name": "Updated Name",
  "phone": "+1234567890"
}
```

#### Update Password
```http
PUT /auth/updatepassword
Authorization: Bearer <token>

{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

### Organizations (Superadmin Only)

#### List Organizations
```http
GET /organizations
Authorization: Bearer <token>
```

#### Create Organization
```http
POST /organizations
Authorization: Bearer <token>

{
  "name": "New Organization",
  "email": "org@example.com",
  "phone": "+1234567890",
  "address": "123 Street, City"
}
```

#### Assign License
```http
PUT /organizations/:id/license
Authorization: Bearer <token>

{
  "licenseId": "license_id",
  "durationMonths": 12
}
```

### Departments

#### List Departments
```http
GET /departments
Authorization: Bearer <token>
```

#### Create Department
```http
POST /departments
Authorization: Bearer <token>

{
  "name": "Marketing",
  "type": "custom",
  "features": ["campaigns", "analytics"]
}
```

### Users

#### List Users
```http
GET /users?role=employee&departmentId=dept_id&status=active
Authorization: Bearer <token>
```

#### Create User
```http
POST /users
Authorization: Bearer <token>

{
  "email": "newuser@example.com",
  "password": "password123",
  "name": "New User",
  "role": "employee",
  "departmentId": "dept_id",
  "designation": "Executive",
  "reportingTo": "manager_id"
}
```

### Tasks

#### List Tasks
```http
GET /tasks?assignedTo=user_id&status=pending&priority=high
Authorization: Bearer <token>
```

#### Create Task
```http
POST /tasks
Authorization: Bearer <token>

{
  "title": "Complete Report",
  "description": "Prepare monthly report",
  "assignedTo": "user_id",
  "departmentId": "dept_id",
  "priority": "high",
  "deadline": "2024-12-31T23:59:59Z"
}
```

#### Complete Task
```http
PUT /tasks/:id/complete
Authorization: Bearer <token>

{
  "evidence": ["file1.pdf", "file2.pdf"],
  "remarks": "Task completed successfully"
}
```

### Students

#### List Students
```http
GET /students?centerId=center_id&status=active&programId=program_id
Authorization: Bearer <token>
```

#### Create Student
```http
POST /students
Authorization: Bearer <token>

{
  "centerId": "center_id",
  "enrollmentNo": "ENR2024001",
  "name": "Student Name",
  "email": "student@example.com",
  "phone": "+1234567890",
  "address": "Student Address",
  "programId": "program_id"
}
```

#### Approve Student
```http
PUT /students/:id/approve
Authorization: Bearer <token>
```

### HR Module

#### Leave Requests

##### List Leaves
```http
GET /hr/leaves?status=pending&employeeId=user_id
Authorization: Bearer <token>
```

##### Create Leave Request
```http
POST /hr/leaves
Authorization: Bearer <token>

{
  "type": "casual",
  "startDate": "2024-12-25",
  "endDate": "2024-12-27",
  "reason": "Personal work"
}
```

##### Approve/Reject Leave
```http
PUT /hr/leaves/:id/approve
Authorization: Bearer <token>

{
  "action": "approve",
  "remarks": "Approved"
}
```

#### Attendance

##### List Attendance
```http
GET /hr/attendance?employeeId=user_id&date=2024-12-01
Authorization: Bearer <token>
```

##### Mark Attendance
```http
POST /hr/attendance
Authorization: Bearer <token>

{
  "employeeId": "user_id",
  "date": "2024-12-01",
  "status": "present",
  "checkIn": "2024-12-01T09:00:00Z",
  "checkOut": "2024-12-01T18:00:00Z"
}
```

#### Vacancies

##### List Vacancies
```http
GET /hr/vacancies?status=open
Authorization: Bearer <token>
```

##### Create Vacancy
```http
POST /hr/vacancies
Authorization: Bearer <token>

{
  "departmentId": "dept_id",
  "designation": "Software Engineer",
  "count": 5
}
```

#### Complaints

##### List Complaints
```http
GET /hr/complaints?status=open
Authorization: Bearer <token>
```

##### Create Complaint
```http
POST /hr/complaints
Authorization: Bearer <token>

{
  "subject": "Complaint Subject",
  "description": "Detailed description",
  "category": "workplace"
}
```

#### Holidays

##### List Holidays
```http
GET /hr/holidays
Authorization: Bearer <token>
```

##### Create Holiday
```http
POST /hr/holidays
Authorization: Bearer <token>

{
  "name": "New Year",
  "date": "2025-01-01",
  "type": "national"
}
```

### Finance Module

#### Invoices

##### List Invoices
```http
GET /finance/invoices?status=pending&centerId=center_id
Authorization: Bearer <token>
```

##### Create Invoice
```http
POST /finance/invoices
Authorization: Bearer <token>

{
  "centerId": "center_id",
  "studentId": "student_id",
  "invoiceNo": "INV2024001",
  "amount": 10000,
  "tax": 1800,
  "total": 11800,
  "items": [
    {
      "description": "Tuition Fee",
      "quantity": 1,
      "rate": 10000,
      "amount": 10000
    }
  ]
}
```

#### Payments

##### Record Payment
```http
POST /finance/payments
Authorization: Bearer <token>

{
  "invoiceId": "invoice_id",
  "amount": 11800,
  "method": "bank_transfer",
  "referenceNo": "TXN123456"
}
```

##### Manage Student Payment Receipts
```http
POST /finance/student-payments/{enrollmentId}/receipt
PUT /finance/student-payments/{enrollmentId}/receipts/{receiptId}
DELETE /finance/student-payments/{enrollmentId}/receipts/{receiptId}
Authorization: ******
```

Recording or changing a student receipt synchronizes it with the enrollment invoice and recalculates the invoice balance. Deleting a receipt also removes its linked invoice payment.

Finance approval of a study-centre admission payment proof creates a paid authorization invoice and receipt using the configured university authorization fees.

#### Expenses

##### List Expenses
```http
GET /finance/expenses?status=pending
Authorization: Bearer <token>
```

##### Create Expense Claim
```http
POST /finance/expenses
Authorization: Bearer <token>

{
  "amount": 500,
  "category": "travel",
  "description": "Client meeting travel",
  "receipts": ["receipt1.pdf"]
}
```

##### Approve Expense
```http
PUT /finance/expenses/:id/approve
Authorization: Bearer <token>

{
  "action": "approve",
  "remarks": "Approved"
}
```

#### Targets

##### List Targets
```http
GET /finance/targets?employeeId=user_id
Authorization: Bearer <token>
```

##### Create Target
```http
POST /finance/targets
Authorization: Bearer <token>

{
  "employeeId": "user_id",
  "type": "revenue",
  "period": "2024-Q4",
  "target": 1000000,
  "incentive": 50000
}
```

#### Fee Structures

##### List Fee Structures
```http
GET /finance/fees?programId=program_id
Authorization: Bearer <token>
```

##### Create Fee Structure
```http
POST /finance/fees
Authorization: Bearer <token>

{
  "programId": "program_id",
  "registrationFee": 5000,
  "tuitionFee": 50000,
  "examFee": 2000,
  "gstPercentage": 18
}
```

### Operations Module

#### Universities

##### List Universities
```http
GET /operations/universities?status=active
Authorization: Bearer <token>
```

##### Create University
```http
POST /operations/universities
Authorization: Bearer <token>

{
  "name": "University Name",
  "code": "UNI001",
  "address": "University Address",
  "contact": "+1234567890"
}
```

#### Programs

##### List Programs
```http
GET /operations/programs?universityId=uni_id
Authorization: Bearer <token>
```

##### Create Program
```http
POST /operations/programs
Authorization: Bearer <token>

{
  "universityId": "uni_id",
  "name": "Bachelor of Science",
  "code": "BSC001",
  "duration": 36
}
```

#### Study Centers

##### List Centers
```http
GET /operations/centers?status=pending
Authorization: Bearer <token>
```

##### Create Center
```http
POST /operations/centers
Authorization: Bearer <token>

{
  "name": "Center Name",
  "code": "CTR001",
  "address": "Center Address",
  "contact": "+1234567890",
  "email": "center@example.com"
}
```

##### Approve Center
```http
PUT /operations/centers/:id/approve
Authorization: Bearer <token>
```

#### Admission Sessions

##### List Sessions
```http
GET /operations/sessions?status=approved
Authorization: Bearer <token>
```

##### Create Session
```http
POST /operations/sessions
Authorization: Bearer <token>

{
  "subDepartmentId": "subdept_id",
  "name": "Winter 2024",
  "startDate": "2024-12-01",
  "endDate": "2025-03-31",
  "examDate": "2025-04-15"
}
```

##### Approve Session
```http
PUT /operations/sessions/:id/approve
Authorization: Bearer <token>
```

#### Internal Marks

##### List Marks
```http
GET /operations/marks?studentId=student_id
Authorization: Bearer <token>
```

##### Create Mark Entry
```http
POST /operations/marks
Authorization: Bearer <token>

{
  "studentId": "student_id",
  "subjectId": "subject_id",
  "marks": 85,
  "maxMarks": 100,
  "examType": "internal"
}
```

#### Announcements

##### List Announcements
```http
GET /operations/announcements?type=ops
Authorization: Bearer <token>
```

##### Create Announcement
```http
POST /operations/announcements
Authorization: Bearer <token>

{
  "title": "Important Notice",
  "content": "Announcement content here",
  "type": "ops",
  "priority": "high",
  "expiresAt": "2024-12-31"
}
```

### Sales Module

#### Leads

##### List Leads
```http
GET /sales/leads?status=new&referredBy=user_id
Authorization: Bearer <token>
```

##### Create Lead
```http
POST /sales/leads
Authorization: Bearer <token>

{
  "centerName": "Potential Center",
  "contactName": "Contact Person",
  "email": "contact@example.com",
  "phone": "+1234567890",
  "address": "Lead Address",
  "source": "website",
  "notes": "Interested in partnership"
}
```

##### Convert Lead
```http
PUT /sales/leads/:id/convert
Authorization: Bearer <token>
```

### Dashboard

#### Get Metrics
```http
GET /dashboard/metrics
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "totalEmployees": 150,
    "totalStudents": 5000,
    "totalCenters": 25,
    "pendingTasks": 12,
    "overdueTasks": 3,
    "activeEscalations": 2
  }
}
```

### Escalations

#### List Escalations
```http
GET /escalations?status=active&type=task_overdue
Authorization: Bearer <token>
```

#### Update Escalation
```http
PUT /escalations/:id
Authorization: Bearer <token>

{
  "action": "resolve",
  "remarks": "Issue resolved"
}
```

## Query Parameters

Most list endpoints support filtering:
- `status` - Filter by status
- `role` - Filter by role (users)
- `departmentId` - Filter by department
- `employeeId` - Filter by employee
- `centerId` - Filter by center
- `programId` - Filter by program
- `date` - Filter by date

## Error Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

- 100 requests per 15 minutes per IP address
- Exceeding limit returns 429 Too Many Requests

## File Uploads

Use multipart/form-data for file uploads:
```http
POST /upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: <binary_data>
```

Supported formats: JPEG, PNG, PDF, DOC, DOCX, XLS, XLSX
Max file size: 10MB
