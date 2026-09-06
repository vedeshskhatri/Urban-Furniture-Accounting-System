import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool';
import { AuthService } from './authService';

let io: SocketIOServer | null = null;

export interface LedgerChangedPayload {
  totalDebit: string;
  totalCredit: string;
  difference: string;
  entryCount: number;
  lineCount: number;
  lastEntry: {
    number: string;
    date: string;
    time?: string;
    journal: string;
  } | null;
}

/**
 * Parses raw Cookie header string into key-value map.
 */
function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach((c) => {
    const [rawKey, ...rawVal] = c.trim().split('=');
    if (rawKey) {
      cookies[rawKey] = decodeURIComponent(rawVal.join('='));
    }
  });
  return cookies;
}

/**
 * Initializes Socket.IO on the HTTP server with httpOnly cookie authentication.
 */
export function initSocketIO(server: http.Server): SocketIOServer {
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const allowedOrigins = [
    corsOrigin,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
  ];

  io = new SocketIOServer(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required');
  }

  // Authenticate socket connection via the SAME httpOnly 'token' cookie used by Express
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookieHeader(socket.handshake.headers.cookie);
      const token =
        cookies.token ||
        (socket.handshake.headers.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.slice(7)
          : null);

      if (!token) {
        return next(new Error('Authentication required: missing token cookie'));
      }

      const decoded = jwt.verify(token, JWT_SECRET) as { id: number; role?: string };
      const user = await AuthService.getUserById(decoded.id);
      if (!user) {
        return next(new Error('Authentication failed: user no longer exists'));
      }

      socket.data.user = user;
      next();
    } catch (err: any) {
      return next(new Error(`Authentication failed: ${err.message}`));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id} (user: ${socket.data.user?.login_id})`);

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

/**
 * Queries current verified ledger state from DB. All money figures are strings.
 */
export async function fetchLedgerIntegrityPayload(): Promise<LedgerChangedPayload> {
  const summaryRes = await pool.query<{
    total_debit: string;
    total_credit: string;
    difference: string;
  }>(`
    SELECT
      COALESCE(SUM(jel.debit), 0)::numeric(14,2)::text AS total_debit,
      COALESCE(SUM(jel.credit), 0)::numeric(14,2)::text AS total_credit,
      (COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0))::numeric(14,2)::text AS difference
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id
    WHERE je.status = 'posted';
  `);

  const countsRes = await pool.query<{
    entry_count: number;
    line_count: number;
  }>(`
    SELECT 
      (SELECT count(*)::int FROM journal_entries WHERE status = 'posted') AS entry_count,
      (SELECT count(*)::int FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.entry_id WHERE je.status = 'posted') AS line_count;
  `);

  const lastEntryRes = await pool.query<{
    number: string;
    date: string;
    time: string;
    journal: string;
  }>(`
    SELECT 
      je.number,
      to_char(je.entry_date, 'YYYY-MM-DD') AS date,
      to_char(je.created_at, 'HH24:MI:SS') AS time,
      j.name AS journal
    FROM journal_entries je
    JOIN journals j ON j.id = je.journal_id
    WHERE je.status = 'posted'
    ORDER BY je.id DESC
    LIMIT 1;
  `);

  const row = summaryRes.rows[0];
  const countRow = countsRes.rows[0];
  const lastEntryRow = lastEntryRes.rows[0];

  return {
    totalDebit: row ? row.total_debit : '0.00',
    totalCredit: row ? row.total_credit : '0.00',
    difference: row ? row.difference : '0.00',
    entryCount: countRow ? countRow.entry_count : 0,
    lineCount: countRow ? countRow.line_count : 0,
    lastEntry: lastEntryRow
      ? {
          number: lastEntryRow.number,
          date: lastEntryRow.date,
          time: lastEntryRow.time,
          journal: lastEntryRow.journal,
        }
      : null,
  };
}

/**
 * Emits 'ledger:changed' broadcast to all authenticated Socket.IO clients.
 * Called strictly at the END of postingService.postDocument() AFTER commit.
 */
export async function emitLedgerChanged(payload?: LedgerChangedPayload): Promise<void> {
  if (!io) {
    return;
  }
  try {
    const data = payload || (await fetchLedgerIntegrityPayload());
    io.emit('ledger:changed', data);
    console.log('[Socket.IO] Broadcasted ledger:changed ->', {
      difference: data.difference,
      entryCount: data.entryCount,
      lastEntry: data.lastEntry?.number,
    });
  } catch (err) {
    console.error('[Socket.IO] Failed to broadcast ledger:changed:', err);
  }
}
