// @ts-nocheck
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { connectDatabase, prisma } from './config/database.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { startEscalationCron } from './services/escalationService.js';
import { initializeSocket } from './config/socket.js';
import { startAllCronJobs } from './services/cronService.js';

// Load env vars
dotenv.config();

// Import routes
import authRoutes from './routes/authRoutes.js';
import organizationRoutes from './routes/organizationRoutes.js';
import licenseRoutes from './routes/licenseRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import userRoutes from './routes/userRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import hrRoutes from './routes/hrRoutes.js';
import hiringRoutes from './routes/hiringRoutes.js';
import financeRoutes from './routes/financeRoutes.js';
import operationsRoutes from './routes/operationsRoutes.js';
import salesRoutes from './routes/salesRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import escalationRoutes from './routes/escalationRoutes.js';
import payrollRoutes from './routes/payrollRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
// New enhancement routes
import ceoRoutes from './routes/ceoRoutes.js';
import orgAdminRoutes from './routes/orgAdminRoutes.js';
import subDepartmentRoutes from './routes/subDepartmentRoutes.js';
import credentialRoutes from './routes/credentialRoutes.js';
import editDeleteRoutes from './routes/editDeleteRoutes.js';
import reregRoutes from './routes/reregRoutes.js';
import referralRoutes from './routes/referralRoutes.js';
import sessionRequestRoutes from './routes/sessionRequestRoutes.js';
import gstRoutes from './routes/gstRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import incentiveRoutes from './routes/incentiveRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import debugRoutes from './routes/debugRoutes.js';
import enrollmentRoutes from './routes/enrollmentRoutes.js';
import commissionRoutes from './routes/commissionRoutes.js';

const app: Application = express();
app.set('trust proxy', 1);

// Connect to database
connectDatabase();

// Security middleware
app.use(helmet());

// CORS
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5578')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Serve uploaded files
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_PATH || './uploads')));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) return false;
    try {
      jwt.verify(authorization.slice(7), process.env.JWT_SECRET || 'secret');
      return true;
    } catch {
      return false;
    }
  },
});

app.use('/api', limiter);

// API version
const API_VERSION = process.env.API_VERSION || 'v1';

// Mount routes
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/organizations`, organizationRoutes);
app.use(`/api/${API_VERSION}/licenses`, licenseRoutes);
app.use(`/api/${API_VERSION}/departments`, departmentRoutes);
app.use(`/api/${API_VERSION}/users`, userRoutes);
app.use(`/api/${API_VERSION}/tasks`, taskRoutes);
app.use(`/api/${API_VERSION}/students`, studentRoutes);
app.use(`/api/${API_VERSION}/hr`, hrRoutes);
app.use(`/api/${API_VERSION}/hiring`, hiringRoutes);
app.use(`/api/${API_VERSION}/finance`, financeRoutes);
app.use(`/api/${API_VERSION}/operations`, operationsRoutes);
app.use(`/api/${API_VERSION}/sales`, salesRoutes);
app.use(`/api/${API_VERSION}/dashboard`, dashboardRoutes);
app.use(`/api/${API_VERSION}/escalations`, escalationRoutes);
app.use(`/api/${API_VERSION}/payroll`, payrollRoutes);
app.use(`/api/${API_VERSION}/attendance`, attendanceRoutes);
// New enhancement routes
app.use(`/api/${API_VERSION}/ceo`, ceoRoutes);
app.use(`/api/${API_VERSION}/org`, orgAdminRoutes);
app.use(`/api/${API_VERSION}/sub-departments`, subDepartmentRoutes);
app.use(`/api/${API_VERSION}/subdepartments`, subDepartmentRoutes);
app.use(`/api/${API_VERSION}/credentials`, credentialRoutes);
app.use(`/api/${API_VERSION}/edit-delete`, editDeleteRoutes);
app.use(`/api/${API_VERSION}/rereg`, reregRoutes);
app.use(`/api/${API_VERSION}/referrals`, referralRoutes);
app.use(`/api/${API_VERSION}/sessions`, sessionRequestRoutes);
app.use(`/api/${API_VERSION}/gst`, gstRoutes);
app.use(`/api/${API_VERSION}/incentives`, incentiveRoutes);
app.use(`/api/${API_VERSION}/notifications`, notificationRoutes);
app.use(`/api/${API_VERSION}/public`, publicRoutes);
app.use(`/api/${API_VERSION}/enrollment`, enrollmentRoutes);
app.use(`/api/${API_VERSION}/backups`, backupRoutes);
app.use(`/api/${API_VERSION}/commissions`, commissionRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      message: 'ERP System API is running',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'ERP System API is running, but database is disconnected',
      database: 'disconnected',
      error: (error as any).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Error handlers
app.use(notFound);
app.use(errorHandler);

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.io
if (process.env.NODE_ENV !== 'test') {
  initializeSocket(httpServer);
  console.log('✅ Socket.io initialized');
}

// Start cron jobs
if (process.env.NODE_ENV !== 'test') {
  startAllCronJobs();
}

const PORT = process.env.PORT || 5000;

const server = httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 ERP System Server Running                           ║
║                                                           ║
║   Environment: ${process.env.NODE_ENV || 'development'}                              ║
║   Port: ${PORT}                                              ║
║   API Version: ${API_VERSION}                                       ║
║                                                           ║
║   📚 API Docs: http://localhost:${PORT}/api/${API_VERSION}           ║
║   ❤️  Health: http://localhost:${PORT}/health                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error(`❌ Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

export default app;
