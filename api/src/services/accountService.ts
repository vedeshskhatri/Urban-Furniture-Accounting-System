import { pool } from '../db/pool';
import { withTransaction } from '../db/withTransaction';
import { AuditService } from './auditService';

export interface AccountDTO {
  id: number;
  name: string;
  type: string;
  is_archived: boolean;
  created_at: string;
  balance?: string;
  total_debit?: string;
  total_credit?: string;
}

export interface JournalDTO {
  id: number;
  name: string;
  type: string;
  default_account_id: number;
  default_account_name?: string;
  is_archived: boolean;
  created_at: string;
}

export interface AnalyticAccountDTO {
  id: number;
  name: string;
  type: 'income' | 'expense';
  is_archived: boolean;
  created_at: string;
}

export class AccountService {
  // --- Accounts ---
  static async getAllAccounts(includeArchived = false, type?: string): Promise<AccountDTO[]> {
    let query = `
      SELECT
        a.*,
        COALESCE(tb.balance, 0)::TEXT AS balance,
        COALESCE(tb.total_debit, 0)::TEXT AS total_debit,
        COALESCE(tb.total_credit, 0)::TEXT AS total_credit
      FROM accounts a
      LEFT JOIN v_trial_balance tb ON tb.account_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (!includeArchived) {
      query += ' AND a.is_archived = false';
    }
    if (type) {
      params.push(type);
      query += ` AND a.type = $${params.length}`;
    }
    query += ' ORDER BY a.id ASC';
    const res = await pool.query(query, params);
    return res.rows;
  }

  static async getAccountById(id: number): Promise<AccountDTO | null> {
    const res = await pool.query('SELECT * FROM accounts WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  static async createAccount(input: { name: string; type: string }, userId?: number): Promise<AccountDTO> {
    return withTransaction(async (tx) => {
      const res = await tx.query(
        'INSERT INTO accounts (name, type) VALUES ($1, $2) RETURNING *',
        [input.name, input.type]
      );
      const row = res.rows[0];
      await AuditService.log(
        { tableName: 'accounts', recordId: row.id, action: 'create', userId, afterData: row },
        tx
      );
      return row;
    });
  }

  static async updateAccount(id: number, input: { name?: string; type?: string }, userId?: number): Promise<AccountDTO | null> {
    const fields: string[] = [];
    const values: any[] = [];
    if (input.name) {
      values.push(input.name);
      fields.push(`name = $${values.length}`);
    }
    if (input.type) {
      values.push(input.type);
      fields.push(`type = $${values.length}`);
    }
    if (fields.length === 0) return this.getAccountById(id);
    return withTransaction(async (tx) => {
      const before = (await tx.query('SELECT * FROM accounts WHERE id = $1', [id])).rows[0] || null;
      values.push(id);
      const res = await tx.query(
        `UPDATE accounts SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values
      );
      const row = res.rows[0] || null;
      if (row) {
        await AuditService.log(
          { tableName: 'accounts', recordId: id, action: 'update', userId, beforeData: before, afterData: row },
          tx
        );
      }
      return row;
    });
  }

  static async archiveAccount(id: number, isArchived = true, userId?: number): Promise<AccountDTO | null> {
    return withTransaction(async (tx) => {
      const res = await tx.query(
        'UPDATE accounts SET is_archived = $1 WHERE id = $2 RETURNING *',
        [isArchived, id]
      );
      const row = res.rows[0] || null;
      if (row) {
        await AuditService.log(
          { tableName: 'accounts', recordId: id, action: 'archive', userId, afterData: { is_archived: isArchived } },
          tx
        );
      }
      return row;
    });
  }

  // --- Journals ---
  static async getAllJournals(includeArchived = false, type?: string): Promise<JournalDTO[]> {
    let query = `
      SELECT j.*, a.name AS default_account_name 
      FROM journals j 
      LEFT JOIN accounts a ON j.default_account_id = a.id 
      WHERE 1=1
    `;
    const params: any[] = [];
    if (!includeArchived) {
      query += ' AND j.is_archived = false';
    }
    if (type) {
      params.push(type);
      query += ` AND j.type = $${params.length}`;
    }
    query += ' ORDER BY j.id ASC';
    const res = await pool.query(query, params);
    return res.rows;
  }

  static async getJournalById(id: number): Promise<JournalDTO | null> {
    const res = await pool.query(
      `SELECT j.*, a.name AS default_account_name 
       FROM journals j 
       LEFT JOIN accounts a ON j.default_account_id = a.id 
       WHERE j.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  static async createJournal(input: { name: string; type: string; default_account_id: number }, userId?: number): Promise<JournalDTO> {
    const id = await withTransaction(async (tx) => {
      const res = await tx.query(
        'INSERT INTO journals (name, type, default_account_id) VALUES ($1, $2, $3) RETURNING *',
        [input.name, input.type, input.default_account_id]
      );
      const row = res.rows[0];
      await AuditService.log(
        { tableName: 'journals', recordId: row.id, action: 'create', userId, afterData: row },
        tx
      );
      return row.id as number;
    });
    return this.getJournalById(id) as Promise<JournalDTO>;
  }

  static async updateJournal(id: number, input: { name?: string; type?: string; default_account_id?: number }, userId?: number): Promise<JournalDTO | null> {
    const fields: string[] = [];
    const values: any[] = [];
    if (input.name) {
      values.push(input.name);
      fields.push(`name = $${values.length}`);
    }
    if (input.type) {
      values.push(input.type);
      fields.push(`type = $${values.length}`);
    }
    if (input.default_account_id) {
      values.push(input.default_account_id);
      fields.push(`default_account_id = $${values.length}`);
    }
    if (fields.length === 0) return this.getJournalById(id);
    const ok = await withTransaction(async (tx) => {
      const before = (await tx.query('SELECT * FROM journals WHERE id = $1', [id])).rows[0] || null;
      values.push(id);
      const res = await tx.query(
        `UPDATE journals SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values
      );
      if (!res.rows[0]) return false;
      await AuditService.log(
        { tableName: 'journals', recordId: id, action: 'update', userId, beforeData: before, afterData: res.rows[0] },
        tx
      );
      return true;
    });
    if (!ok) return null;
    return this.getJournalById(id);
  }

  static async archiveJournal(id: number, isArchived = true, userId?: number): Promise<JournalDTO | null> {
    return withTransaction(async (tx) => {
      const res = await tx.query(
        'UPDATE journals SET is_archived = $1 WHERE id = $2 RETURNING *',
        [isArchived, id]
      );
      const row = res.rows[0] || null;
      if (row) {
        await AuditService.log(
          { tableName: 'journals', recordId: id, action: 'archive', userId, afterData: { is_archived: isArchived } },
          tx
        );
      }
      return row;
    });
  }

  // --- Analytic Accounts ---
  static async getAllAnalytics(includeArchived = false, type?: string): Promise<AnalyticAccountDTO[]> {
    let query = 'SELECT * FROM analytic_accounts WHERE 1=1';
    const params: any[] = [];
    if (!includeArchived) {
      query += ' AND is_archived = false';
    }
    if (type && type !== 'all') {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }
    query += ' ORDER BY id ASC';
    const res = await pool.query(query, params);
    return res.rows;
  }

  static async getAnalyticById(id: number): Promise<AnalyticAccountDTO | null> {
    const res = await pool.query('SELECT * FROM analytic_accounts WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  static async createAnalytic(input: { name: string; type: 'income' | 'expense' }, userId?: number): Promise<AnalyticAccountDTO> {
    return withTransaction(async (tx) => {
      const res = await tx.query(
        'INSERT INTO analytic_accounts (name, type) VALUES ($1, $2) RETURNING *',
        [input.name, input.type]
      );
      const row = res.rows[0];
      await AuditService.log(
        { tableName: 'analytic_accounts', recordId: row.id, action: 'create', userId, afterData: row },
        tx
      );
      return row;
    });
  }

  static async updateAnalytic(id: number, input: { name?: string; type?: 'income' | 'expense' }, userId?: number): Promise<AnalyticAccountDTO | null> {
    const fields: string[] = [];
    const values: any[] = [];
    if (input.name) {
      values.push(input.name);
      fields.push(`name = $${values.length}`);
    }
    if (input.type) {
      values.push(input.type);
      fields.push(`type = $${values.length}`);
    }
    if (fields.length === 0) return this.getAnalyticById(id);
    return withTransaction(async (tx) => {
      const before = (await tx.query('SELECT * FROM analytic_accounts WHERE id = $1', [id])).rows[0] || null;
      values.push(id);
      const res = await tx.query(
        `UPDATE analytic_accounts SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values
      );
      const row = res.rows[0] || null;
      if (row) {
        await AuditService.log(
          { tableName: 'analytic_accounts', recordId: id, action: 'update', userId, beforeData: before, afterData: row },
          tx
        );
      }
      return row;
    });
  }

  static async archiveAnalytic(id: number, isArchived = true, userId?: number): Promise<AnalyticAccountDTO | null> {
    return withTransaction(async (tx) => {
      const res = await tx.query(
        'UPDATE analytic_accounts SET is_archived = $1 WHERE id = $2 RETURNING *',
        [isArchived, id]
      );
      const row = res.rows[0] || null;
      if (row) {
        await AuditService.log(
          { tableName: 'analytic_accounts', recordId: id, action: 'archive', userId, afterData: { is_archived: isArchived } },
          tx
        );
      }
      return row;
    });
  }
}
