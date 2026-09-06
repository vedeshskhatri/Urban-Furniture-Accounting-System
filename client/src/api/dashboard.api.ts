import api from '../lib/axios';

export interface DashboardStats {
  sales: {
    all: number;
    confirmed: number;
    draft: number;
  };
  purchase: {
    all: number;
    confirmed: number;
    draft: number;
  };
  budget: {
    achieved: number;
    budget: number;
    committed: number;
  };
  invoicesCount?: number;
  billsCount?: number;
}

export interface DashboardKPI {
  cash: string;
  bank: string;
  receivable: string;
  payable: string;
  netIncomeThisMonth: string;
  isRedacted?: boolean;
  role?: string;
  operational?: {
    stockUnits: number;
    activeProducts: number;
    pendingOrders: number;
  };
}

export interface RecentActivityItem {
  id: string | number;
  date: string;
  number: string;
  partner?: string | null;
  journal?: string;
  total: string;
  status: 'draft' | 'posted' | 'confirmed' | 'paid' | 'partial' | 'not_paid' | 'cancelled' | 'revised';
  type?: string;
}

export interface MonthlyTrendItem {
  month: string;
  label: string;
  revenue: string;
  expense: string;
  net: string;
}

export interface OperationalAlerts {
  overdueInvoices: {
    count: number;
    total: string;
  };
  lowStockProducts: {
    count: number;
  };
  pendingDrafts: {
    salesOrders: number;
    purchaseOrders: number;
  };
}

export const DashboardApi = {
  /**
   * GET /api/dashboard/stats
   * Counts for Sales, Purchase, Budget
   */
  getStats: async (period?: string): Promise<DashboardStats> => {
    const params = period ? `?period=${encodeURIComponent(period)}` : '';
    const res = await api.get<{ data: DashboardStats; error: any }>(`/api/dashboard/stats${params}`);
    if (res.data.error) {
      throw new Error(res.data.error.message || 'Failed to fetch dashboard stats');
    }
    return res.data.data;
  },

  /**
   * GET /api/dashboard/kpi
   * Financial balances and monthly income (all strings)
   */
  getKPI: async (period?: string): Promise<DashboardKPI> => {
    const params = period ? `?period=${encodeURIComponent(period)}` : '';
    const res = await api.get<{ data: DashboardKPI; error: any }>(`/api/dashboard/kpi${params}`);
    if (res.data.error) {
      throw new Error(res.data.error.message || 'Failed to fetch KPI data');
    }
    return res.data.data;
  },

  /**
   * GET recent activity
   * Queries /api/dashboard/activity or falls back to /api/journal-entries
   */
  getActivity: async (): Promise<RecentActivityItem[]> => {
    try {
      const res = await api.get<{ data: RecentActivityItem[]; error: any }>('/api/dashboard/activity');
      if (res.data.data && Array.isArray(res.data.data)) {
        return res.data.data;
      }
    } catch {
      // Fallback to journal-entries endpoint
    }

    const jeRes = await api.get<{ data: any[]; error: any }>('/api/journal-entries');
    if (jeRes.data?.data && Array.isArray(jeRes.data.data)) {
      return jeRes.data.data.slice(0, 10).map((item) => ({
        id: item.id,
        date: item.date || item.created_at || new Date().toISOString().split('T')[0],
        number: item.entry_number || item.number || `JE-${item.id}`,
        partner: item.partner_name || item.partner || 'General Entry',
        journal: item.journal_name || item.journal || 'General',
        total: String(item.total_debit || item.total || '0.00'),
        status: (item.status as any) || 'posted',
      }));
    }

    return [];
  },

  /**
   * GET /api/dashboard/trends
   * Revenue vs Expense breakdown
   */
  getTrends: async (period?: string): Promise<MonthlyTrendItem[]> => {
    try {
      const params = period ? `?period=${encodeURIComponent(period)}` : '';
      const res = await api.get<{ data: MonthlyTrendItem[]; error: any }>(`/api/dashboard/trends${params}`);
      if (res.data.data && Array.isArray(res.data.data)) {
        return res.data.data;
      }
    } catch (err) {
      console.error('Failed to fetch dashboard trends', err);
    }
    return [];
  },

  /**
   * GET /api/dashboard/alerts
   * Overdue invoices and inventory alerts
   */
  getAlerts: async (): Promise<OperationalAlerts | null> => {
    try {
      const res = await api.get<{ data: OperationalAlerts; error: any }>('/api/dashboard/alerts');
      if (res.data.data) {
        return res.data.data;
      }
    } catch (err) {
      console.error('Failed to fetch dashboard alerts', err);
    }
    return null;
  },
};
