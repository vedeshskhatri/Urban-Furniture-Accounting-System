import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { authRouter } from './routes/authRoutes';
import { journalEntryRouter } from './routes/journalEntryRoutes';
import { salesOrderRouter } from './routes/salesOrderRoutes';
import { invoiceRouter } from './routes/invoiceRoutes';
import { paymentRouter } from './routes/paymentRoutes';
import { receivablesRouter } from './routes/receivablesRoutes';
import { portalRouter } from './routes/portalRoutes';
import { contactRouter } from './routes/contactRoutes';
import { reportRouter } from './routes/reportRoutes';
import { agingRouter } from './routes/agingRoutes';
import { ledgerRouter } from './routes/ledgerRoutes';
import { verifyRouter } from './routes/verifyRoutes';
import { auditRouter } from './routes/auditRoutes';
import { productRouter } from './routes/productRoutes';
import { accountRouter, journalRouter } from './routes/accountRoutes';
import { analyticRouter } from './routes/analyticRoutes';
import { poRouter } from './routes/purchaseOrderRoutes';
import { billRouter } from './routes/vendorBillRoutes';
import { budgetRouter } from './routes/budgetRoutes';
import { dashboardRouter } from './routes/dashboardRoutes';
import { voiceBillRouter } from './routes/voiceBillRoutes';
import { integrityRouter } from './routes/integrityRoutes';
import { analyticsRouter } from './routes/analyticsRoutes';
import { templateRouter } from './routes/templateRoutes';
import { gstRouter } from './routes/gstRoutes';
import { cfoCopilotRouter } from './routes/cfoCopilotRoutes';
import { requireAuth, requireInternalUser } from './middleware/auth';
import { requireRole } from './middleware/role';
import { sendError } from './utils/response';

dotenv.config();

export const app: Express = express();

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

const allowedOrigins = [
  corsOrigin,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      // Explicit allowed origins
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Allow localhost on any port, or local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
      if (
        /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
          origin
        )
      ) {
        return callback(null, true);
      }
      // Permissive fallback in development so team members on LAN / tunnels can connect seamlessly
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Prevent browser caching of financial API responses (receivables, invoices, aging)
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Health check (public)
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public / Portal routes
app.use('/api/auth', authRouter);
app.use('/api/portal', portalRouter);

// ALL internal data routes require valid authentication & internal staff role
app.use('/api/journal-entries', requireAuth, requireInternalUser, journalEntryRouter);
app.use('/api/sales-orders', requireAuth, requireInternalUser, salesOrderRouter);
app.use('/api/invoices', requireAuth, requireInternalUser, invoiceRouter);
app.use('/api/payments', requireAuth, requireInternalUser, paymentRouter);
app.use('/api/receivables', requireAuth, requireInternalUser, receivablesRouter);
app.use('/api/aging', requireAuth, requireInternalUser, agingRouter);
app.use('/api/contacts', requireAuth, requireInternalUser, contactRouter);
app.use('/api/reports', requireAuth, requireInternalUser, reportRouter);
app.use('/api/ledger', requireAuth, requireInternalUser, ledgerRouter);
app.use('/api/verify', requireAuth, requireInternalUser, verifyRouter);
app.use('/api/audit', requireAuth, requireInternalUser, auditRouter);
app.use('/api/products', requireAuth, requireInternalUser, productRouter);
app.use('/api/accounts', requireAuth, requireInternalUser, accountRouter);
app.use('/api/journals', requireAuth, requireInternalUser, journalRouter);
app.use('/api/analytic-accounts', requireAuth, requireInternalUser, analyticRouter);
app.use('/api/purchase-orders', requireAuth, requireInternalUser, poRouter);
app.use('/api/bills', requireAuth, requireInternalUser, billRouter);
app.use('/api/vendor-bills', requireAuth, requireInternalUser, billRouter);
app.use('/api/budgets', requireAuth, requireInternalUser, budgetRouter);
app.use('/api/dashboard', requireAuth, requireInternalUser, dashboardRouter);
app.use('/api/voice-bill', requireAuth, requireInternalUser, voiceBillRouter);
app.use('/api/integrity', requireAuth, requireRole('admin'), integrityRouter);
app.use('/api/analytics', requireAuth, requireInternalUser, analyticsRouter);
app.use('/api/templates', requireAuth, requireInternalUser, templateRouter);
app.use('/api/gst', requireAuth, requireInternalUser, gstRouter);
app.use('/api/cfo-copilot', requireAuth, requireInternalUser, cfoCopilotRouter);


// 404 handler
app.use((req: Request, res: Response) => {
  sendError(res, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`, 404);
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled server error:', err);
  sendError(res, 'INTERNAL_ERROR', err.message || 'Internal server error', 500);
});
