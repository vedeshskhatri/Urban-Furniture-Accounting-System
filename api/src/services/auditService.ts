import { pool } from '../db/pool';
import { PoolClient } from 'pg';

export type AuditAction =
  | 'create'
  | 'update'
  | 'confirm'
  | 'post'
  | 'reverse'
  | 'cancel'
  | 'pay'
  | 'archive'
  | 'revise'
  | 'delete'
  | 'login'
  | 'login_failed';

export interface AuditLogEntry {
  tableName: string;
  recordId: number;
  action: AuditAction;
  userId?: number | null;
  beforeData?: any;
  afterData?: any;
}

export interface AuditFilters {
  table?: string;
  recordId?: number;
  userId?: number;
  action?: string;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

const REDACTED_KEYS = ['password_hash', 'password', 'invite_token', 'token'];

/**
 * Strip secrets from any object we are about to persist to audit_log.
 * password_hash must NEVER land in the audit trail.
 */
export function sanitizeAuditData(data: any): any {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) return data.map(sanitizeAuditData);
  if (typeof data !== 'object') return data;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (REDACTED_KEYS.includes(k)) continue;
    out[k] = v && typeof v === 'object' ? sanitizeAuditData(v) : v;
  }
  return out;
}

export class AuditService {
  /**
   * Writes an entry to audit_log. Pass the transaction client so the audit row
   * is committed atomically with the change it describes.
   */
  static async log(entry: AuditLogEntry, client?: PoolClient): Promise<number> {
    const query = `
      INSERT INTO audit_log (table_name, record_id, action, user_id, before_data, after_data)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id;
    `;
    const before = sanitizeAuditData(entry.beforeData);
    const after = sanitizeAuditData(entry.afterData);
    const params = [
      entry.tableName,
      entry.recordId,
      entry.action,
      entry.userId || null,
      before !== undefined && before !== null ? JSON.stringify(before) : null,
      after !== undefined && after !== null ? JSON.stringify(after) : null,
    ];

    const executor = client || pool;
    const res = await executor.query(query, params);
    return res.rows[0].id;
  }

  /**
   * Global audit feed with filters + pagination + text search. Returns { rows, total }.
   */
  static async query(filters: AuditFilters, scope?: Record<string, any>): Promise<{ rows: any[]; total: number }> {
    if (scope && scope.allowed === false) {
      return { rows: [], total: 0 };
    }

    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;
    const searchPattern = filters.search ? `%${filters.search.trim()}%` : null;

    const where = `
      WHERE ($1::text IS NULL OR al.table_name = $1::text)
        AND ($2::int  IS NULL OR al.record_id = $2::int)
        AND ($3::int  IS NULL OR al.user_id = $3::int)
        AND ($4::text IS NULL OR al.action = $4::text)
        AND ($5::timestamptz IS NULL OR al.created_at >= $5::timestamptz)
        AND ($6::timestamptz IS NULL OR al.created_at <= $6::timestamptz)
        AND ($7::text IS NULL OR (
          al.table_name ILIKE $7
          OR al.record_id::text ILIKE $7
          OR al.action ILIKE $7
          OR u.full_name ILIKE $7
          OR u.login_id ILIKE $7
          OR al.after_data::text ILIKE $7
          OR al.before_data::text ILIKE $7
        ))
    `;
    const whereParams = [
      filters.table ?? null,
      filters.recordId ?? null,
      filters.userId ?? null,
      filters.action ?? null,
      filters.from ?? null,
      filters.to ?? null,
      searchPattern,
    ];

    const rowsRes = await pool.query(
      `
      SELECT
        al.id,
        al.table_name,
        al.record_id,
        al.action,
        al.user_id,
        u.login_id AS user_login,
        u.full_name AS user_name,
        al.before_data,
        al.after_data,
        al.created_at
      FROM audit_log al
      LEFT JOIN users u ON u.id = al.user_id
      ${where}
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT $8 OFFSET $9;
      `,
      [...whereParams, limit, offset]
    );

    const countRes = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM audit_log al
      LEFT JOIN users u ON u.id = al.user_id
      ${where};
      `,
      whereParams
    );

    return { rows: rowsRes.rows, total: countRes.rows[0].total };
  }

  /**
   * Per-record history, oldest first, for the <RecordTimeline> component.
   */
  static async getRecordTimeline(tableName: string, recordId: number): Promise<any[]> {
    const res = await pool.query(
      `
      SELECT
        al.id,
        al.table_name,
        al.record_id,
        al.action,
        al.user_id,
        u.login_id AS user_login,
        u.full_name AS user_name,
        al.before_data,
        al.after_data,
        al.created_at
      FROM audit_log al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.table_name = $1 AND al.record_id = $2
      ORDER BY al.created_at ASC, al.id ASC;
      `,
      [tableName, recordId]
    );
    return res.rows;
  }

  /**
   * Distinct tables / actions / users present, for populating the filter bar and KPI summary.
   */
  static async getFacets(): Promise<{
    tables: string[];
    actions: string[];
    users: Array<{ id: number; name: string }>;
    stats: { total: number; today: number; security: number; commercial: number };
  }> {
    const res = await pool.query(`
      SELECT
        ARRAY(SELECT DISTINCT table_name FROM audit_log ORDER BY table_name) AS tables,
        ARRAY(SELECT DISTINCT action FROM audit_log ORDER BY action) AS actions;
    `);
    const usersRes = await pool.query(`
      SELECT DISTINCT u.id, COALESCE(u.full_name, u.login_id) AS name
      FROM audit_log al JOIN users u ON u.id = al.user_id
      ORDER BY name;
    `);
    const statsRes = await pool.query<{
      total: number;
      today: number;
      security: number;
      commercial: number;
    }>(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS today,
        COUNT(*) FILTER (WHERE action IN ('login_failed', 'reverse', 'cancel', 'delete'))::int AS security,
        COUNT(*) FILTER (WHERE table_name IN ('customer_invoices', 'vendor_bills', 'sales_orders', 'purchase_orders'))::int AS commercial
      FROM audit_log;
    `);

    return {
      tables: res.rows[0]?.tables ?? [],
      actions: res.rows[0]?.actions ?? [],
      users: usersRes.rows,
      stats: statsRes.rows[0] ?? { total: 0, today: 0, security: 0, commercial: 0 },
    };
  }

  /**
   * @deprecated use query() — kept for existing callers.
   */
  static async getAuditLogs(tableName?: string, recordId?: number, limit = 100, offset = 0, scope?: Record<string, any>) {
    const { rows } = await AuditService.query({ table: tableName, recordId, limit, offset }, scope);
    return rows;
  }
}
