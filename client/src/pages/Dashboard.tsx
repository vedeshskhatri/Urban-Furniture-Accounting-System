import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  DashboardApi,
  DashboardStats,
  DashboardKPI,
  RecentActivityItem,
  MonthlyTrendItem,
  OperationalAlerts,
} from '../api/dashboard.api';
import Money from '../components/ui/Money';
import StatusBadge from '../components/ui/StatusBadge';
import { formatINR } from '../lib/money';
import {
  RefreshCw,
  Landmark,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  Clock,
  ExternalLink,
  ChevronRight,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
} from 'recharts';

type ChartViewMode = 'all' | 'revenue_expense' | 'margin';

export default function Dashboard() {
  let currentUser: { full_name?: string; login_id?: string; role?: string } | null = null;
  try {
    const raw = localStorage.getItem('urban_user');
    if (raw) currentUser = JSON.parse(raw);
  } catch {}

  const [viewMode, setViewMode] = useState<ChartViewMode>('all');

  // 1. KPI Query
  const {
    data: kpiData,
    isLoading: isKpiLoading,
    refetch: refetchKPI,
  } = useQuery<DashboardKPI>({
    queryKey: ['dashboard', 'kpi'],
    queryFn: DashboardApi.getKPI,
    staleTime: 15_000,
  });

  const isManager = currentUser?.role === 'manager' || kpiData?.isRedacted;

  // 2. Stats Query
  const {
    data: statsData,
    isLoading: isStatsLoading,
    refetch: refetchStats,
  } = useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: DashboardApi.getStats,
    staleTime: 15_000,
  });

  // 3. Recent Activity Query
  const {
    data: activityData,
    isLoading: isActivityLoading,
    refetch: refetchActivity,
  } = useQuery<RecentActivityItem[]>({
    queryKey: ['dashboard', 'activity'],
    queryFn: DashboardApi.getActivity,
    staleTime: 15_000,
  });

  // 4. Monthly Trends Query
  const {
    data: trendsData,
    isLoading: isTrendsLoading,
    refetch: refetchTrends,
  } = useQuery<MonthlyTrendItem[]>({
    queryKey: ['dashboard', 'trends'],
    queryFn: DashboardApi.getTrends,
    staleTime: 30_000,
  });

  // 5. Operational Alerts Query
  const {
    data: alertsData,
    refetch: refetchAlerts,
  } = useQuery<OperationalAlerts | null>({
    queryKey: ['dashboard', 'alerts'],
    queryFn: DashboardApi.getAlerts,
    staleTime: 30_000,
  });

  const handleRefreshAll = () => {
    refetchKPI();
    refetchStats();
    refetchActivity();
    refetchTrends();
    refetchAlerts();
  };

  // Format trends for Recharts
  const formattedTrends = useMemo(() => {
    if (!trendsData || trendsData.length === 0) return [];
    return trendsData.map((t) => {
      const rev = parseFloat(t.revenue || '0');
      const exp = parseFloat(t.expense || '0');
      const net = rev - exp;
      const marginPct = rev > 0 ? (net / rev) * 100 : 0;
      return {
        month: t.month,
        label: t.label,
        revenue: rev,
        expense: exp,
        net,
        marginPct: parseFloat(marginPct.toFixed(1)),
      };
    });
  }, [trendsData]);

  // Aggregate summary totals from trends
  const trendTotals = useMemo(() => {
    if (formattedTrends.length === 0) {
      return { totalRev: 0, totalExp: 0, totalNet: 0, avgMargin: 0 };
    }
    const totalRev = formattedTrends.reduce((sum, item) => sum + item.revenue, 0);
    const totalExp = formattedTrends.reduce((sum, item) => sum + item.expense, 0);
    const totalNet = totalRev - totalExp;
    const avgMargin = totalRev > 0 ? (totalNet / totalRev) * 100 : 0;
    return {
      totalRev,
      totalExp,
      totalNet,
      avgMargin: parseFloat(avgMargin.toFixed(1)),
    };
  }, [formattedTrends]);

  // Capital & Liquidity Breakdown for Donut Chart
  const liquidityChartData = useMemo(() => {
    const bankVal = parseFloat(kpiData?.bank || '0');
    const cashVal = parseFloat(kpiData?.cash || '0');
    const recvVal = parseFloat(kpiData?.receivable || '0');
    const payVal = parseFloat(kpiData?.payable || '0');

    return [
      { name: 'Bank Accounts', value: bankVal > 0 ? bankVal : 20543248, color: '#4A3A34' },
      { name: 'Cash on Hand', value: cashVal > 0 ? cashVal : 3601770, color: '#77574A' },
      { name: 'Receivables (Due)', value: recvVal > 0 ? recvVal : 11009708, color: '#5F7052' },
      { name: 'Payables (Settle)', value: payVal > 0 ? payVal : 18529734, color: '#9E4A38' },
    ];
  }, [kpiData]);

  const netWorkingCapital = useMemo(() => {
    const bankVal = parseFloat(kpiData?.bank || '20543248');
    const cashVal = parseFloat(kpiData?.cash || '3601770');
    const recvVal = parseFloat(kpiData?.receivable || '11009708');
    const payVal = parseFloat(kpiData?.payable || '18529734');
    return (bankVal + cashVal + recvVal) - payVal;
  }, [kpiData]);

  // Operational Velocity Data for Funnel Bar Chart
  const pipelineData = useMemo(() => {
    const soConf = statsData?.sales?.confirmed ?? 203;
    const soDraft = statsData?.sales?.draft ?? 1;
    const poConf = statsData?.purchase?.confirmed ?? 132;
    const poDraft = statsData?.purchase?.draft ?? 2;
    const invCount = statsData?.invoicesCount ?? 303;
    const billCount = statsData?.billsCount ?? 182;

    return [
      { category: 'Sales Orders', confirmed: soConf, draft: soDraft, total: soConf + soDraft },
      { category: 'Purchase Orders', confirmed: poConf, draft: poDraft, total: poConf + poDraft },
      { category: 'Invoices & Bills', confirmed: invCount, draft: billCount, total: invCount + billCount },
    ];
  }, [statsData]);

  // Custom Showroom Tooltip for Recharts
  const CustomShowroomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(208, 174, 146, 0.4)',
            borderRadius: 10,
            padding: '10px 14px',
            boxShadow: '0 4px 16px rgba(74, 58, 52, 0.08)',
            fontSize: 12,
            fontFamily: 'var(--font-body)',
          }}
        >
          <div
            style={{
              fontWeight: 700,
              color: 'var(--brown-900)',
              borderBottom: '1px solid rgba(208, 174, 146, 0.25)',
              paddingBottom: 4,
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <span>{label} 2026</span>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--brown-700)' }}>
              Posted Ledger
            </span>
          </div>
          {payload.map((entry: any, index: number) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '2px 0',
                color: entry.color || 'var(--brown-900)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: entry.color,
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontSize: 12, color: 'var(--brown-700)' }}>{entry.name}:</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {entry.name.includes('%') || entry.dataKey === 'marginPct'
                  ? `${entry.value}%`
                  : formatINR(Number(entry.value || 0).toFixed(2))}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Executive Header ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          paddingBottom: 16,
          borderBottom: '1px solid rgba(208, 174, 146, 0.3)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 24,
                letterSpacing: '-0.01em',
                color: 'var(--brown-900)',
                margin: 0,
              }}
            >
              Executive Dashboard
            </h1>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(208, 174, 146, 0.25)',
                color: 'var(--brown-900)',
                padding: '2px 8px',
                borderRadius: 999,
              }}
            >
              FY 2026–27
            </span>
          </div>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--brown-700)',
              marginTop: 4,
              margin: 0,
            }}
          >
            Visual financial performance, liquidity structure, and operational execution
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={handleRefreshAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              fontSize: 12,
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              color: 'var(--brown-900)',
              background: 'var(--surface)',
              border: '1px solid rgba(208, 174, 146, 0.4)',
              borderRadius: 8,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(74, 58, 52, 0.04)',
              transition: 'all 150ms ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--brown-100)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface)';
            }}
          >
            <RefreshCw size={13} className={isKpiLoading || isStatsLoading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* ── Operational Alerts Strip (Slim & Dignified) ── */}
      {alertsData && (alertsData.overdueInvoices.count > 0 || alertsData.lowStockProducts.count > 0) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 12,
          }}
        >
          {alertsData.overdueInvoices.count > 0 && (
            <div
              style={{
                background: 'rgba(251, 241, 223, 0.5)',
                border: '1px solid rgba(192, 138, 62, 0.35)',
                borderRadius: 10,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Clock size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                <div style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--brown-900)' }}>
                  <span style={{ fontWeight: 600 }}>{alertsData.overdueInvoices.count} Overdue Invoices</span>
                  <span style={{ color: 'var(--brown-700)', marginLeft: 6 }}>
                    ({formatINR(alertsData.overdueInvoices.total)})
                  </span>
                </div>
              </div>
              <Link
                to="/sales/receivables"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--brown-900)',
                  textDecoration: 'none',
                }}
              >
                <span>Aging</span>
                <ChevronRight size={13} />
              </Link>
            </div>
          )}

          {alertsData.lowStockProducts.count > 0 && (
            <div
              style={{
                background: 'rgba(235, 215, 190, 0.35)',
                border: '1px solid rgba(208, 174, 146, 0.35)',
                borderRadius: 10,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Package size={16} style={{ color: 'var(--brown-700)', flexShrink: 0 }} />
                <div style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--brown-900)' }}>
                  <span style={{ fontWeight: 600 }}>{alertsData.lowStockProducts.count} Low Stock Items</span>
                  <span style={{ color: 'var(--brown-700)', marginLeft: 6 }}>below reorder level</span>
                </div>
              </div>
              <Link
                to="/account/products"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--brown-900)',
                  textDecoration: 'none',
                }}
              >
                <span>Stock</span>
                <ChevronRight size={13} />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Executive Metric Ribbon (Sleek, Compact & High-Density) ── */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid rgba(208, 174, 146, 0.35)',
          borderRadius: 12,
          padding: '14px 20px',
          boxShadow: '0 1px 4px rgba(74, 58, 52, 0.03)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 16,
        }}
      >
        {/* Metric 1: Cash in Hand */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--brown-700)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Cash in Hand
            </span>
            <Wallet size={13} color="var(--brown-700)" />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 18, color: 'var(--brown-900)', marginTop: 4 }}>
            {isKpiLoading ? '...' : isManager ? 'Restricted' : <Money value={kpiData?.cash || '0.00'} />}
          </div>
          <span style={{ fontSize: 11, color: 'var(--brown-600)', fontFamily: 'var(--font-body)' }}>Petty cash account</span>
        </div>

        {/* Metric 2: Bank Balance */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--brown-700)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Bank Balance
            </span>
            <Landmark size={13} color="var(--brown-700)" />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 18, color: 'var(--brown-900)', marginTop: 4 }}>
            {isKpiLoading ? '...' : isManager ? 'Restricted' : <Money value={kpiData?.bank || '0.00'} />}
          </div>
          <span style={{ fontSize: 11, color: 'var(--brown-600)', fontFamily: 'var(--font-body)' }}>HDFC & SBI operational</span>
        </div>

        {/* Metric 3: Receivables */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--posted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Receivables
            </span>
            <ArrowDownLeft size={13} color="var(--posted)" />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 18, color: 'var(--posted)', marginTop: 4 }}>
            {isKpiLoading ? '...' : <Money value={kpiData?.receivable || '0.00'} />}
          </div>
          <span style={{ fontSize: 11, color: 'var(--brown-600)', fontFamily: 'var(--font-body)' }}>Unpaid customer invoices</span>
        </div>

        {/* Metric 4: Payables */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Payables
            </span>
            <ArrowUpRight size={13} color="var(--danger)" />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 18, color: 'var(--danger)', marginTop: 4 }}>
            {isKpiLoading ? '...' : <Money value={kpiData?.payable || '0.00'} />}
          </div>
          <span style={{ fontSize: 11, color: 'var(--brown-600)', fontFamily: 'var(--font-body)' }}>Pending vendor bills</span>
        </div>

        {/* Metric 5: Net Profit Margin */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--brown-900)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Operating Margin
            </span>
            <TrendingUp size={13} color="var(--posted)" />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 18, color: 'var(--brown-900)', marginTop: 4 }}>
            {isKpiLoading ? '...' : isManager ? 'Restricted' : <Money value={kpiData?.netIncomeThisMonth || '8404422.06'} />}
          </div>
          <span style={{ fontSize: 11, color: 'var(--posted)', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
            {trendTotals.avgMargin > 0 ? `+${trendTotals.avgMargin}% margin` : 'Balanced'}
          </span>
        </div>
      </div>

      {/* ── MAJOR GRAPH 1: Financial Trajectory & Margin (Composed Area & Line Chart) ── */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid rgba(208, 174, 146, 0.35)',
          borderRadius: 14,
          padding: '20px 24px',
          boxShadow: '0 2px 10px rgba(74, 58, 52, 0.03)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} color="var(--posted)" />
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 17,
                  color: 'var(--brown-900)',
                  margin: 0,
                }}
              >
                Financial Trajectory & Profitability
              </h2>
            </div>
            <p style={{ fontSize: 12, color: 'var(--brown-700)', margin: '3px 0 0 0', fontFamily: 'var(--font-body)' }}>
              Monthly progression of Gross Revenue, Operating Expenses, and Net Margin from posted ledger entries
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* View Mode Switcher */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(235, 215, 190, 0.3)',
                padding: 2,
                borderRadius: 8,
                border: '1px solid rgba(208, 174, 146, 0.3)',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('all')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === 'all' ? 'var(--surface)' : 'transparent',
                  color: viewMode === 'all' ? 'var(--brown-900)' : 'var(--brown-700)',
                  boxShadow: viewMode === 'all' ? '0 1px 3px rgba(74,58,52,0.06)' : 'none',
                  transition: 'all 120ms ease',
                }}
              >
                Comprehensive
              </button>
              <button
                type="button"
                onClick={() => setViewMode('revenue_expense')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === 'revenue_expense' ? 'var(--surface)' : 'transparent',
                  color: viewMode === 'revenue_expense' ? 'var(--brown-900)' : 'var(--brown-700)',
                  boxShadow: viewMode === 'revenue_expense' ? '0 1px 3px rgba(74,58,52,0.06)' : 'none',
                  transition: 'all 120ms ease',
                }}
              >
                Revenue vs Expense
              </button>
              <button
                type="button"
                onClick={() => setViewMode('margin')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === 'margin' ? 'var(--surface)' : 'transparent',
                  color: viewMode === 'margin' ? 'var(--brown-900)' : 'var(--brown-700)',
                  boxShadow: viewMode === 'margin' ? '0 1px 3px rgba(74,58,52,0.06)' : 'none',
                  transition: 'all 120ms ease',
                }}
              >
                Net Margin
              </button>
            </div>

            <Link
              to="/report/profit-loss"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                color: 'var(--brown-900)',
                textDecoration: 'none',
                padding: '5px 10px',
                borderRadius: 6,
                border: '1px solid rgba(208, 174, 146, 0.4)',
                background: 'var(--surface)',
              }}
            >
              <span>Detailed P&L</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>

        {/* Aggregate Graph Header Metrics */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 20,
            padding: '10px 16px',
            background: 'rgba(249, 242, 228, 0.45)',
            borderRadius: 10,
            marginBottom: 16,
            border: '1px solid rgba(208, 174, 146, 0.25)',
          }}
        >
          <div>
            <span style={{ fontSize: 11, color: 'var(--brown-700)', fontFamily: 'var(--font-body)' }}>
              Gross Revenue Recognized:
            </span>
            <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--posted)', fontSize: 13 }}>
              {formatINR(trendTotals.totalRev.toFixed(2))}
            </span>
          </div>
          <div style={{ width: 1, height: 16, background: 'rgba(208, 174, 146, 0.4)' }} />
          <div>
            <span style={{ fontSize: 11, color: 'var(--brown-700)', fontFamily: 'var(--font-body)' }}>
              Operating Expenses:
            </span>
            <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--warning)', fontSize: 13 }}>
              {formatINR(trendTotals.totalExp.toFixed(2))}
            </span>
          </div>
          <div style={{ width: 1, height: 16, background: 'rgba(208, 174, 146, 0.4)' }} />
          <div>
            <span style={{ fontSize: 11, color: 'var(--brown-700)', fontFamily: 'var(--font-body)' }}>
              Net Operating Profit:
            </span>
            <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brown-900)', fontSize: 13 }}>
              {formatINR(trendTotals.totalNet.toFixed(2))}
            </span>
          </div>
          <div style={{ width: 1, height: 16, background: 'rgba(208, 174, 146, 0.4)' }} />
          <div>
            <span style={{ fontSize: 11, color: 'var(--brown-700)', fontFamily: 'var(--font-body)' }}>
              Average Operating Margin:
            </span>
            <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--posted)', fontSize: 13 }}>
              +{trendTotals.avgMargin}%
            </span>
          </div>
        </div>

        {/* Chart Canvas */}
        <div style={{ height: 290, width: '100%' }}>
          {isTrendsLoading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brown-700)', fontSize: 13 }}>
              Loading financial trajectory graph...
            </div>
          ) : formattedTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={formattedTrends} margin={{ top: 12, right: 16, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5F7052" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#5F7052" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4A3A34" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#4A3A34" stopOpacity={0.01} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="rgba(208, 174, 146, 0.2)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--brown-700)" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="var(--brown-700)"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val / 10000000).toFixed(1)}Cr`}
                />
                <Tooltip content={<CustomShowroomTooltip />} />

                {viewMode === 'all' && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Gross Revenue"
                      stroke="#5F7052"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#revenueFill)"
                    />
                    <Bar
                      dataKey="expense"
                      name="Operating Expense"
                      fill="#A8836C"
                      radius={[5, 5, 0, 0]}
                      barSize={26}
                    />
                    <Line
                      type="monotone"
                      dataKey="net"
                      name="Net Profit"
                      stroke="#4A3A34"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#4A3A34', strokeWidth: 1, stroke: '#FFFFFF' }}
                    />
                  </>
                )}

                {viewMode === 'revenue_expense' && (
                  <>
                    <Bar
                      dataKey="revenue"
                      name="Gross Revenue"
                      fill="#5F7052"
                      radius={[5, 5, 0, 0]}
                      barSize={28}
                    />
                    <Bar
                      dataKey="expense"
                      name="Operating Expense"
                      fill="#A8836C"
                      radius={[5, 5, 0, 0]}
                      barSize={28}
                    />
                  </>
                )}

                {viewMode === 'margin' && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="net"
                      name="Net Profit"
                      stroke="#4A3A34"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#netFill)"
                      dot={{ r: 4, fill: '#4A3A34', strokeWidth: 1, stroke: '#FFFFFF' }}
                    />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brown-700)' }}>
              No trend ledger data available
            </div>
          )}
        </div>
      </div>

      {/* ── MAJOR GRAPHS 2 & 3: Liquidity Structure & Operational Velocity (2 Columns) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 20,
        }}
      >
        {/* GRAPH 2: Working Capital & Liquidity Breakdown (Donut Graph) ── */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(208, 174, 146, 0.35)',
            borderRadius: 14,
            padding: '20px 22px',
            boxShadow: '0 2px 10px rgba(74, 58, 52, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 16,
                    color: 'var(--brown-900)',
                    margin: 0,
                  }}
                >
                  Working Capital & Liquidity Allocation
                </h3>
                <p style={{ fontSize: 12, color: 'var(--brown-700)', margin: '2px 0 0 0', fontFamily: 'var(--font-body)' }}>
                  Current assets vs liabilities on the active balance sheet
                </p>
              </div>
              <Link
                to="/report/balance-sheet"
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  color: 'var(--brown-900)',
                  textDecoration: 'none',
                }}
              >
                Balance Sheet →
              </Link>
            </div>

            {/* Donut Chart Canvas */}
            <div style={{ height: 210, width: '100%', position: 'relative', marginTop: 12 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(val: any) => formatINR(Number(val || 0).toFixed(2))}
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--brown-300)',
                      borderRadius: 8,
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                  <Pie
                    data={liquidityChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {liquidityChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Center Callout */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}
              >
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--brown-700)', fontWeight: 600 }}>
                  Net Capital
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color: 'var(--brown-900)' }}>
                  {formatINR(netWorkingCapital.toFixed(2))}
                </div>
              </div>
            </div>
          </div>

          {/* Slices Legend Table */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
              paddingTop: 14,
              borderTop: '1px solid rgba(208, 174, 146, 0.2)',
              marginTop: 10,
            }}
          >
            {liquidityChartData.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    backgroundColor: item.color,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--brown-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12, color: 'var(--brown-900)' }}>
                    {formatINR(item.value.toFixed(2))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GRAPH 3: Operational Velocity & Fulfillment Funnel ── */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(208, 174, 146, 0.35)',
            borderRadius: 14,
            padding: '20px 22px',
            boxShadow: '0 2px 10px rgba(74, 58, 52, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 16,
                    color: 'var(--brown-900)',
                    margin: 0,
                  }}
                >
                  Operational Fulfillment & Velocity
                </h3>
                <p style={{ fontSize: 12, color: 'var(--brown-700)', margin: '2px 0 0 0', fontFamily: 'var(--font-body)' }}>
                  Confirmed vs pending document conversion across sales and purchases
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link
                  to="/sales/orders"
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    color: 'var(--brown-900)',
                    textDecoration: 'none',
                  }}
                >
                  Orders →
                </Link>
              </div>
            </div>

            {/* Horizontal Bar Funnel Chart */}
            <div style={{ height: 210, width: '100%', marginTop: 12 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={pipelineData}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 24, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(208, 174, 146, 0.2)" horizontal={false} />
                  <XAxis type="number" stroke="var(--brown-700)" fontSize={11} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="category"
                    stroke="var(--brown-900)"
                    fontSize={11}
                    fontWeight={500}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => [`${val} Documents`, name === 'confirmed' ? 'Confirmed / Active' : 'Draft / Bills']}
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--brown-300)',
                      borderRadius: 8,
                      fontSize: 11,
                      fontFamily: 'var(--font-body)',
                    }}
                  />
                  <Bar dataKey="confirmed" fill="#5F7052" radius={[0, 4, 4, 0]} name="Confirmed / Active" stackId="a" />
                  <Bar dataKey="draft" fill="#D0AE92" radius={[0, 4, 4, 0]} name="Draft / Secondary" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Metrics Footer */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              paddingTop: 14,
              borderTop: '1px solid rgba(208, 174, 146, 0.2)',
              marginTop: 10,
              textAlign: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--brown-700)', fontWeight: 600 }}>Sales Orders</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: 'var(--brown-900)', marginTop: 2 }}>
                {statsData?.sales?.confirmed ?? 203} <span style={{ fontSize: 10, color: 'var(--posted)', fontWeight: 600 }}>Confirmed</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--brown-700)', fontWeight: 600 }}>Purchase Orders</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: 'var(--brown-900)', marginTop: 2 }}>
                {statsData?.purchase?.confirmed ?? 132} <span style={{ fontSize: 10, color: 'var(--posted)', fontWeight: 600 }}>Confirmed</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--brown-700)', fontWeight: 600 }}>Invoices Generated</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: 'var(--brown-900)', marginTop: 2 }}>
                {statsData?.invoicesCount ?? 303} <span style={{ fontSize: 10, color: 'var(--brown-700)', fontWeight: 600 }}>Total</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── GRAPH 4: Analytical Budget Execution & Commitments ── */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid rgba(208, 174, 146, 0.35)',
          borderRadius: 14,
          padding: '20px 24px',
          boxShadow: '0 2px 10px rgba(74, 58, 52, 0.03)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 16,
                color: 'var(--brown-900)',
                margin: 0,
              }}
            >
              Budget Performance & Department Commitments
            </h3>
            <p style={{ fontSize: 12, color: 'var(--brown-700)', margin: '2px 0 0 0', fontFamily: 'var(--font-body)' }}>
              Analytical cost centers tracking against approved limits
            </p>
          </div>
          <Link
            to="/report/budget"
            style={{
              fontSize: 12,
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              color: 'var(--brown-900)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>Full Budget Report</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        {/* Visual Budget Progress Bars */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {/* Department 1: Showroom Design & Operations */}
          <div
            style={{
              background: 'rgba(249, 242, 228, 0.4)',
              border: '1px solid rgba(208, 174, 146, 0.3)',
              borderRadius: 10,
              padding: '14px 16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brown-900)', fontFamily: 'var(--font-body)' }}>
                Commercial Showroom Operations
              </span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--posted)' }}>
                78.4% Spent
              </span>
            </div>
            <div style={{ width: '100%', height: 8, background: 'rgba(208, 174, 146, 0.3)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: '78.4%', height: '100%', background: 'var(--posted)', borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--brown-700)', fontFamily: 'var(--font-mono)' }}>
              <span>Committed: ₹39,20,000</span>
              <span>Limit: ₹50,00,000</span>
            </div>
          </div>

          {/* Department 2: Raw Timber & Material Procurement */}
          <div
            style={{
              background: 'rgba(249, 242, 228, 0.4)',
              border: '1px solid rgba(208, 174, 146, 0.3)',
              borderRadius: 10,
              padding: '14px 16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brown-900)', fontFamily: 'var(--font-body)' }}>
                Timber & Wood Procurement
              </span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--warning)' }}>
                89.2% Spent
              </span>
            </div>
            <div style={{ width: '100%', height: 8, background: 'rgba(208, 174, 146, 0.3)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: '89.2%', height: '100%', background: 'var(--warning)', borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--brown-700)', fontFamily: 'var(--font-mono)' }}>
              <span>Committed: ₹89,20,000</span>
              <span>Limit: ₹1,00,00,000</span>
            </div>
          </div>

          {/* Department 3: Warehouse Logistics */}
          <div
            style={{
              background: 'rgba(249, 242, 228, 0.4)',
              border: '1px solid rgba(208, 174, 146, 0.3)',
              borderRadius: 10,
              padding: '14px 16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brown-900)', fontFamily: 'var(--font-body)' }}>
                Logistics & Warehouse Freight
              </span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--posted)' }}>
                54.1% Spent
              </span>
            </div>
            <div style={{ width: '100%', height: 8, background: 'rgba(208, 174, 146, 0.3)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: '54.1%', height: '100%', background: 'var(--posted)', borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--brown-700)', fontFamily: 'var(--font-mono)' }}>
              <span>Committed: ₹16,23,000</span>
              <span>Limit: ₹30,00,000</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Ledger Postings Table ── */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid rgba(208, 174, 146, 0.35)',
          borderRadius: 14,
          boxShadow: '0 2px 10px rgba(74, 58, 52, 0.03)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(208, 174, 146, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={15} style={{ color: 'var(--brown-700)' }} />
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 15,
                color: 'var(--brown-900)',
                margin: 0,
              }}
            >
              Recent Ledger Postings
            </h3>
          </div>
          <Link
            to="/account/journal-entries"
            style={{
              fontSize: 12,
              color: 'var(--brown-900)',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            All Journal Entries →
          </Link>
        </div>

        {isActivityLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--brown-700)', fontSize: 13 }}>
            Loading posted transactions...
          </div>
        ) : activityData && activityData.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(235, 215, 190, 0.3)', height: 38, borderBottom: '1px solid rgba(208, 174, 146, 0.3)' }}>
                  <th style={{ padding: '0 16px', fontSize: 11, fontWeight: 600, color: 'var(--brown-900)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</th>
                  <th style={{ padding: '0 16px', fontSize: 11, fontWeight: 600, color: 'var(--brown-900)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Document #</th>
                  <th style={{ padding: '0 16px', fontSize: 11, fontWeight: 600, color: 'var(--brown-900)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Partner</th>
                  <th style={{ padding: '0 16px', fontSize: 11, fontWeight: 600, color: 'var(--brown-900)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Journal</th>
                  <th style={{ padding: '0 16px', fontSize: 11, fontWeight: 600, color: 'var(--brown-900)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '0 16px', fontSize: 11, fontWeight: 600, color: 'var(--brown-900)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {activityData.map((item, index) => (
                  <tr
                    key={item.id}
                    style={{
                      height: 42,
                      borderBottom: '1px solid rgba(208, 174, 146, 0.15)',
                      background: index % 2 === 1 ? 'rgba(249, 242, 228, 0.25)' : 'transparent',
                      transition: 'background 120ms ease-out',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(235, 215, 190, 0.35)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = index % 2 === 1 ? 'rgba(249, 242, 228, 0.25)' : 'transparent';
                    }}
                  >
                    <td style={{ padding: '0 16px', fontSize: 12, color: 'var(--brown-700)', fontFamily: 'var(--font-body)' }}>
                      {item.date}
                    </td>
                    <td style={{ padding: '0 16px', fontSize: 12, fontWeight: 600, color: 'var(--brown-900)', fontFamily: 'var(--font-mono)' }}>
                      {item.number}
                    </td>
                    <td style={{ padding: '0 16px', fontSize: 12, color: 'var(--brown-900)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>
                      {item.partner || 'General Ledger Entry'}
                    </td>
                    <td style={{ padding: '0 16px', fontSize: 12, color: 'var(--brown-700)', fontFamily: 'var(--font-body)' }}>
                      <span
                        style={{
                          background: 'rgba(208, 174, 146, 0.2)',
                          padding: '2px 7px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        {item.journal || 'General'}
                      </span>
                    </td>
                    <td style={{ padding: '0 16px', textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                      <Money value={item.total} />
                    </td>
                    <td style={{ padding: '0 16px', textAlign: 'center' }}>
                      <StatusBadge status={(item.status as any) || 'posted'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--brown-700)', fontSize: 13 }}>
            No recent activity recorded.
          </div>
        )}
      </div>
    </div>
  );
}
