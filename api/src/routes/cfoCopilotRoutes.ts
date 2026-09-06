import { Router, Request, Response } from 'express';
import { CfoCopilotService, CfoQueryRequest } from '../services/cfoCopilotService';
import { sendSuccess, sendError } from '../utils/response';

export const cfoCopilotRouter = Router();

/**
 * GET /api/cfo-copilot/snapshot
 * Retrieves real-time financial ledger snapshot computed directly from Postgres
 */
cfoCopilotRouter.get('/snapshot', async (_req: Request, res: Response) => {
  try {
    const snapshot = await CfoCopilotService.getFinancialSnapshot();
    return sendSuccess(res, snapshot);
  } catch (err: any) {
    console.error('[CfoCopilot] Error generating financial snapshot:', err);
    return sendError(res, 'CFO_SNAPSHOT_FAILED', err.message || 'Failed to aggregate financial snapshot', 500);
  }
});

/**
 * POST /api/cfo-copilot/query
 * Analyzes executive query with local Ollama qwen2.5:7b using real-time ledger context
 */
cfoCopilotRouter.post('/query', async (req: Request, res: Response) => {
  try {
    const { message, focus, history } = req.body as CfoQueryRequest;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return sendError(res, 'INVALID_INPUT', 'Query message is required', 400);
    }

    const response = await CfoCopilotService.queryCfoCopilot({
      message: message.trim(),
      focus,
      history,
    });

    return sendSuccess(res, response);
  } catch (err: any) {
    console.error('[CfoCopilot] Error processing query:', err);
    return sendError(res, 'CFO_QUERY_FAILED', err.message || 'Failed to process CFO copilot query', 500);
  }
});
