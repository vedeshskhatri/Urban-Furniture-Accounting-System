import api from '../lib/axios';

export interface AuditRow {
  id: number;
  table_name: string;
  record_id: number;
  action: string;
  user_id: number | null;
  user_login: string | null;
  user_name: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditQueryParams {
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

export interface AuditStats {
  total: number;
  today: number;
  security: number;
  commercial: number;
}

export const AuditApi = {
  feed: async (params: AuditQueryParams): Promise<{ rows: AuditRow[]; total: number }> => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
    });
    const res = await api.get<{ data: { rows: AuditRow[]; total: number }; error: unknown }>(
      `/api/audit?${qs.toString()}`
    );
    return res.data?.data ?? { rows: [], total: 0 };
  },

  facets: async (): Promise<{
    tables: string[];
    actions: string[];
    users: Array<{ id: number; name: string }>;
    stats: AuditStats;
  }> => {
    const res = await api.get<{
      data: {
        tables: string[];
        actions: string[];
        users: Array<{ id: number; name: string }>;
        stats: AuditStats;
      };
      error: unknown;
    }>('/api/audit/facets');
    return res.data?.data ?? { tables: [], actions: [], users: [], stats: { total: 0, today: 0, security: 0, commercial: 0 } };
  },

  recordTimeline: async (table: string, recordId: number): Promise<AuditRow[]> => {
    const res = await api.get<{ data: AuditRow[]; error: unknown }>(
      `/api/audit/record/${encodeURIComponent(table)}/${recordId}`
    );
    return res.data?.data ?? [];
  },
};
