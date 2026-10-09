# ERP System Backend

Single-tenant university ERP backend built with Node.js, Express, TypeScript, and PostgreSQL.

## Features

- 🏛️ Single organization and single university
- 🔐 JWT-based authentication and role-based authorization
- 📊 Real-time dashboard metrics
- 🚨 Automated escalation system for overdue tasks
- 📝 Comprehensive audit logging
- 🔄 RESTful API design
- 📁 File upload support
- 🛡️ Security best practices (Helmet, CORS, Rate Limiting)
- ⚡ Performance optimization (Compression, Caching)

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: Helmet, CORS, bcryptjs
- **File Upload**: Multer
- **Scheduling**: node-cron
- **Validation**: express-validator

## Prerequisites

- Node.js >= 18.x
- PostgreSQL
- npm or yarn

## Installation

1. Clone the repository:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:5173
```

## Database Setup

1. Create the PostgreSQL database and configure its `DATABASE_URL` in `.env`.

2. Apply the database migrations:
```bash
npx prisma migrate deploy
```

3. To load demo data:
```bash
npm run seed
```

`npm run seed` clears existing application data before loading demo data. For
your own organization, university, and superadmin credentials, use the
protected `reset-single-tenant` process below instead.

This will create:
- Sample licenses (Basic, Premium, Enterprise)
- Superadmin account
- One organization (EduTech Global by default)
- One university (EduTech University by default)
- Departments (Operations, Finance, HR, Sales)
- Sample users for each role

The application supports one organization and one university. Override the seeded
names and university code with `SEED_ORGANIZATION_NAME`, `SEED_UNIVERSITY_NAME`,
and `SEED_UNIVERSITY_CODE`.

### Starting over with a new organization and university

The reset command truncates application tables, preserves Prisma migration
history, and creates one organization, one university, and one superadmin. It
does not run automatically. Set the following variables in the server
environment before running it:

```env
RESET_DATABASE_HOST=your_database_host
RESET_DATABASE_NAME=your_database_name
RESET_DATABASE_CONFIRMATION=WIPE your_database_host/your_database_name
RESET_ORGANIZATION_NAME=Your Organization
RESET_UNIVERSITY_NAME=Your University
RESET_UNIVERSITY_CODE=YOUR-CODE
RESET_SUPERADMIN_EMAIL=admin@example.edu
RESET_SUPERADMIN_NAME=Super Admin
RESET_SUPERADMIN_PASSWORD=use-a-unique-password-of-12-or-more-characters
```

Then, from the `server` directory, apply migrations and run the reset command:

```bash
npx prisma migrate deploy
npm run reset-single-tenant
```

The command verifies the configured database host and connected database name,
and requires the exact confirmation string shown above. In production, it also
requires `ALLOW_DB_RESET=true`. Never run it against a database whose data must
be retained.

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

## API Documentation

### Base URL
```
http://localhost:5000/api/v1
```

### Authentication Endpoints

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "ceo@edutechglobal.com",
  "password": "ceo123"
}
```

#### Get Current User
```http
GET /api/v1/auth/me
Authorization: Bearer <token>
```

### Main Modules

#### Organizations
- `GET /api/v1/organizations` - Get the single organization
- `POST /api/v1/organizations` - Create an organization only when none exists
- `GET /api/v1/organizations/:id` - Get organization details
- `PUT /api/v1/organizations/:id` - Update organization
- `PUT /api/v1/organizations/:id/license` - Assign license

#### Departments
- `GET /api/v1/departments` - List departments
- `POST /api/v1/departments` - Create department
- `PUT /api/v1/departments/:id` - Update department

#### Users
- `GET /api/v1/users` - List users
- `POST /api/v1/users` - Create user
- `GET /api/v1/users/:id` - Get user details
- `PUT /api/v1/users/:id` - Update user

#### Tasks
- `GET /api/v1/tasks` - List tasks
- `POST /api/v1/tasks` - Create task
- `PUT /api/v1/tasks/:id/complete` - Complete task

#### Students
- `GET /api/v1/students` - List students
- `POST /api/v1/students` - Create student
- `PUT /api/v1/students/:id/approve` - Approve student

#### HR Module
- `GET /api/v1/hr/leaves` - List leave requests
- `POST /api/v1/hr/leaves` - Create leave request
- `PUT /api/v1/hr/leaves/:id/approve` - Approve leave
- `GET /api/v1/hr/attendance` - Get attendance records
- `GET /api/v1/hr/vacancies` - List vacancies
- `GET /api/v1/hr/complaints` - List complaints
- `GET /api/v1/hr/holidays` - List holidays

#### Finance Module
- `GET /api/v1/finance/invoices` - List invoices
- `POST /api/v1/finance/invoices` - Create invoice
- `GET /api/v1/finance/payments` - List payments
- `POST /api/v1/finance/payments` - Record payment
- `GET /api/v1/finance/expenses` - List expense claims
- `PUT /api/v1/finance/expenses/:id/approve` - Approve expense
- `GET /api/v1/finance/targets` - List targets
- `GET /api/v1/finance/fees` - List fee structures

#### Operations Module
- `GET /api/v1/operations/universities` - Get the single university
- `POST /api/v1/operations/universities` - Create a university only when none exists
- `GET /api/v1/operations/programs` - List programs
- `GET /api/v1/operations/centers` - List study centers
- `PUT /api/v1/operations/centers/:id/approve` - Approve center
- `GET /api/v1/operations/sessions` - List admission sessions
- `GET /api/v1/operations/marks` - List internal marks
- `GET /api/v1/operations/announcements` - List announcements

#### Sales Module
- `GET /api/v1/sales/leads` - List leads
- `POST /api/v1/sales/leads` - Create lead
- `PUT /api/v1/sales/leads/:id/convert` - Convert lead

#### Dashboard
- `GET /api/v1/dashboard/metrics` - Get dashboard metrics

#### Escalations
- `GET /api/v1/escalations` - List escalations
- `PUT /api/v1/escalations/:id` - Update escalation

## User Roles

1. **Superadmin**: Full system access, manages organizations and licenses
2. **Org Admin**: Organization-level management, creates departments
3. **CEO**: Organization-wide visibility, handles escalations
4. **Ops Admin**: Operations department management
5. **Finance Admin**: Finance department management, approvals
6. **HR Admin**: HR department management
7. **Sales Admin**: Sales department management
8. **Employee**: Personal dashboard, tasks, leaves

## Default Login Credentials

After running `npm run seed`:

| Role | Email | Password |
|------|-------|----------|
| Superadmin | superadmin@erp.com | superadmin123 |
| Org Admin | admin@edutechglobal.com | orgadmin123 |
| CEO | ceo@edutechglobal.com | ceo123 |
| Ops Admin | ops.admin@edutechglobal.com | opsadmin123 |
| Finance Admin | finance.admin@edutechglobal.com | finance123 |
| HR Admin | hr.admin@edutechglobal.com | hradmin123 |
| Sales Admin | sales.admin@edutechglobal.com | sales123 |
| Employee | ops.executive@edutechglobal.com | employee123 |

## Automated Features

### Escalation System
- Runs every hour via cron job
- Checks for overdue tasks
- Automatically escalates to CEO after grace period (default: 48 hours)
- Creates escalation records with full chain

### Audit Logging
- Automatic logging of all create/update/delete operations
- Tracks user, IP address, old/new values
- Searchable audit trail

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Role-based access control
- Rate limiting (100 requests per 15 minutes)
- Helmet security headers
- CORS protection
- Input validation
- Prisma query parameterization

## Project Structure

```
server/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom middleware
│   ├── prisma/          # Prisma schema and migrations
│   ├── routes/          # API routes
│   ├── scripts/         # Utility scripts
│   ├── services/        # Business logic
│   ├── utils/           # Helper functions
│   └── server.ts        # Entry point
├── uploads/             # File uploads
├── .env.example         # Environment template
├── package.json
└── tsconfig.json
```

## Error Handling

All errors are handled centrally with appropriate HTTP status codes:
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

## Performance

- PostgreSQL indexes on frequently queried fields
- Compression middleware for response optimization
- Efficient query population
- Pagination support (can be added to list endpoints)

## Testing

```bash
# Run tests (to be implemented)
npm test
```

## Deployment

### Production Checklist
- [ ] Set strong JWT_SECRET
- [ ] Configure production PostgreSQL connection string
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS
- [ ] Configure proper CORS origins
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Set up CI/CD pipeline

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open an issue on GitHub.
