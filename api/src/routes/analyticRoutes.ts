import { Router, Request, Response } from 'express';
import { AccountService } from '../services/accountService';
import { AuthenticatedRequest } from '../middleware/auth';
import { sendSuccess, sendError } from '../utils/response';

export const analyticRouter = Router();

// GET /api/analytic-accounts
analyticRouter.get('/', async (req: Request, res: Response) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const rawType = typeof req.query.type === 'string' ? req.query.type : undefined;
    const type = rawType && rawType !== 'all' ? rawType : undefined;
    const analytics = await AccountService.getAllAnalytics(includeArchived, type);
    return sendSuccess(res, analytics);
  } catch (err: any) {
    return sendError(res, 'FETCH_FAILED', err.message);
  }
});

// GET /api/analytic-accounts/:id
analyticRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return sendError(res, 'INVALID_ID', 'ID must be an integer');

    const item = await AccountService.getAnalyticById(id);
    if (!item) return sendError(res, 'NOT_FOUND', 'Analytic account not found', 404);

    return sendSuccess(res, item);
  } catch (err: any) {
    return sendError(res, 'FETCH_FAILED', err.message);
  }
});

// POST /api/analytic-accounts
analyticRouter.post('/', async (req: Request, res: Response) => {
  try {
    const item = await AccountService.createAnalytic(req.body, (req as AuthenticatedRequest).user?.id);
    return sendSuccess(res, item, 201);
  } catch (err: any) {
    return sendError(res, 'CREATE_FAILED', err.message);
  }
});

// PUT /api/analytic-accounts/:id
analyticRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return sendError(res, 'INVALID_ID', 'ID must be an integer');

    const updated = await AccountService.updateAnalytic(id, req.body, (req as AuthenticatedRequest).user?.id);
    if (!updated) return sendError(res, 'NOT_FOUND', 'Analytic account not found', 404);

    return sendSuccess(res, updated);
  } catch (err: any) {
    return sendError(res, 'UPDATE_FAILED', err.message);
  }
});

// PATCH /api/analytic-accounts/:id/archive
analyticRouter.patch('/:id/archive', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return sendError(res, 'INVALID_ID', 'ID must be an integer');

    const isArchived = req.body.is_archived !== undefined ? Boolean(req.body.is_archived) : true;
    const item = await AccountService.archiveAnalytic(id, isArchived, (req as AuthenticatedRequest).user?.id);
    if (!item) return sendError(res, 'NOT_FOUND', 'Analytic account not found', 404);

    return sendSuccess(res, item);
  } catch (err: any) {
    return sendError(res, 'ARCHIVE_FAILED', err.message);
  }
});
