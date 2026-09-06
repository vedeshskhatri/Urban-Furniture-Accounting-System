import { Router, Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { AuditService } from '../services/auditService';
import { AuthenticatedRequest } from '../middleware/auth';

export const auditRouter = Router();

/** The global feed + facets are admin-only; the per-record timeline is open to internal staff. */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if ((req as AuthenticatedRequest).user?.role !== 'admin') {
    return sendError(res, 'FORBIDDEN', 'Audit feed is restricted to administrators', 403);
  }
  next();
}

/**
 * GET /api/audit?table=&recordId=&userId=&action=&from=&to=&limit=&offset=
 * Global audit feed. Admin only (enforced at mount). Newest first, paginated.
 */
auditRouter.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const toInt = (v: unknown) => (v === undefined ? undefined : parseInt(String(v), 10));
    const result = await AuditService.query({
      table: req.query.table ? String(req.query.table) : undefined,
      recordId: toInt(req.query.recordId),
      userId: toInt(req.query.userId),
      action: req.query.action ? String(req.query.action) : undefined,
      from: req.query.from ? String(req.query.from) : undefined,
      to: req.query.to ? String(req.query.to) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
      limit: toInt(req.query.limit),
      offset: toInt(req.query.offset),
    });
    return sendSuccess(res, result);
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    return sendError(res, 'AUDIT_ERROR', error.message || 'Failed to fetch audit logs', 500);
  }
});

/**
 * GET /api/audit/facets — distinct tables and actions for the filter bar.
 */
auditRouter.get('/facets', requireAdmin, async (_req: Request, res: Response) => {
  try {
    return sendSuccess(res, await AuditService.getFacets());
  } catch (error: any) {
    return sendError(res, 'AUDIT_ERROR', error.message || 'Failed to fetch facets', 500);
  }
});

/**
 * GET /api/audit/record/:table/:id — one record's own history, oldest first.
 * Used by the <RecordTimeline> component on every form.
 */
auditRouter.get('/record/:table/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return sendError(res, 'INVALID_ID', 'Record id must be an integer', 400);
    const rows = await AuditService.getRecordTimeline(String(req.params.table), id);
    return sendSuccess(res, rows);
  } catch (error: any) {
    return sendError(res, 'AUDIT_ERROR', error.message || 'Failed to fetch record timeline', 500);
  }
});
