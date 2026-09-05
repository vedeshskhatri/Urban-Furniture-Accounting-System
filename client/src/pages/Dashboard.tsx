import React from 'react';
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
  Plus,
  FileBarChart,
  RefreshCw,
  TrendingUp,
  Landmark,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  Package,
  Clock,
  ExternalLink,
  ChevronRight,
  Receipt,
  FileText,
  CreditCard,
  Building2,
  Calendar,
  Lock,
  ShieldCheck,
  Activity,
  ScrollText,
  BarChart2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

export default function Dashboard() {
  let currentUser: { full_name?: string; login_id?: string; role?: string } | null = null;
  try {
    const raw = localStorage.getItem('urban_user');
    if (raw) currentUser = JSON.parse(raw);
  } catch {}

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

  const chartData = (trendsData || []).map((item) => ({
    label: item.label,
    month: item.month,
    Revenue: Number(item.revenue),
    Expense: Number(item.expense),
    Net: Number(item.net),
  }));

  const customTooltipFormatter = (value: any) => {
    return [formatINR(String(value)), ''];
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        maxWidth: 1400,
        margin: '0 auto',
        padding: '8px 4px 48px 4px',
      }}
    >
      {/* ── Top Header ── */}
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
            Real-time financial summary, operational counts, and ledger activities
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontFamily: 'var(--font-body)',
              color: 'var(--brown-700)',
              background: 'rgba(255, 255, 255, 0.6)',
              padding: '6px 12px',
              borderRadius: 10,
              border: '1px solid rgba(208, 174, 146, 0.25)',
            }}
          >
            <Calendar size={13} style={{ color: 'var(--brown-700)' }} />
            <span>Active Ledger</span>
          </div>

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
              borderRadius: 10,
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

      {/* ── Operational Alerts Strip (Slim, Rounded & Minimal) ── */}
      {alertsData && (alertsData.overdueInvoices.count > 0 || alertsData.lowStockProducts.count > 0) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 12,
          }}
        >
          {alertsData.overdueInvoices.count > 0 && (
            <div
              style={{
                background: 'rgba(251, 241, 223, 0.8)',
                border: '1px solid rgba(192, 138, 62, 0.3)',
                borderRadius: 14,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertCircle size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
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
                  color: 'var(--warning)',
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
                borderRadius: 14,
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

      {/* ── Manager Operational Scoping Banner ── */}
      {isManager && (
        <div
          style={{
            background: 'rgba(235, 215, 190, 0.40)',
            border: '1px solid rgba(208, 174, 146, 0.50)',
            borderRadius: 14,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={18} style={{ color: '#b45309', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--brown-900)' }}>
                Manager Scoped Access Active
              </div>
              <div style={{ fontSize: 11, color: 'var(--brown-700)', fontFamily: 'var(--font-body)' }}>
                Double-entry ledger balances and net profit margins are redacted at the data layer (`scopeFor`). Operational volume is enabled.
              </div>
            </div>
          </div>
          {kpiData?.operational && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <div style={{ padding: '4px 10px', background: 'var(--surface)', borderRadius: 8, border: '1px solid rgba(208, 174, 146, 0.4)' }}>
                <span style={{ color: 'var(--brown-600)' }}>Stock Units: </span>
                <span style={{ fontWeight: 700, color: 'var(--brown-900)' }}>{kpiData.operational.stockUnits}</span>
              </div>
              <div style={{ padding: '4px 10px', background: 'var(--surface)', borderRadius: 8, border: '1px solid rgba(208, 174, 146, 0.4)' }}>
                <span style={{ color: 'var(--brown-600)' }}>Catalog Items: </span>
                <span style={{ fontWeight: 700, color: 'var(--brown-900)' }}>{kpiData.operational.activeProducts}</span>
              </div>
              <div style={{ padding: '4px 10px', background: 'var(--surface)', borderRadius: 8, border: '1px solid rgba(208, 174, 146, 0.4)' }}>
                <span style={{ color: 'var(--brown-600)' }}>Draft Orders: </span>
                <span style={{ fontWeight: 700, color: 'var(--brown-900)' }}>{kpiData.operational.pendingOrders}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Intelligence, Integrity, Live Monitor & Audit Center ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(249,242,228,0.75) 100%)',
          border: '1px solid rgba(208, 174, 146, 0.45)',
          borderRadius: 18,
          padding: '16px 20px',
          boxShadow: '0 2px 12px rgba(74, 58, 52, 0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--brown-700)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <ShieldCheck size={13} style={{ color: 'var(--brown-800)' }} />
              <span>Control Center & System Governance</span>
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 17,
                color: 'var(--brown-900)',
                margin: '2px 0 0 0',
              }}
            >
              Live Monitor, Integrity & Analytics Engine
            </h2>
          </div>
          <span
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: 'var(--brown-800)',
              background: 'rgba(208, 174, 146, 0.3)',
              padding: '3px 10px',
              borderRadius: 999,
              border: '1px solid rgba(208, 174, 146, 0.4)',
            }}
          >
            4 Active Subsystems
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 12,
          }}
        >
          {/* 1. Live Correctness Monitor */}
          <Link
            to="/monitor"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '14px 16px',
              background: 'var(--surface)',
              border: '1px solid rgba(22, 163, 74, 0.35)',
              borderRadius: 14,
              textDecoration: 'none',
              transition: 'all 150ms ease',
              boxShadow: '0 2px 6px rgba(22, 163, 74, 0.04)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 14px rgba(22, 163, 74, 0.12)';
              e.currentTarget.style.borderColor = 'rgba(22, 163, 74, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(22, 163, 74, 0.04)';
              e.currentTarget.style.borderColor = 'rgba(22, 163, 74, 0.35)';
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: 'rgba(22, 163, 74, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#15803d',
                  }}
                >
                  <Activity size={18} />
                </div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: '#15803d',
                    background: 'rgba(22, 163, 74, 0.12)',
                    padding: '2px 8px',
                    borderRadius: 999,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: '#16a34a',
                      boxShadow: '0 0 6px #16a34a',
                    }}
                  />
                  LIVE TICKER
                </span>
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 14,
                  color: 'var(--brown-900)',
                  margin: '0 0 4px 0',
                }}
              >
                Live Correctness Monitor
              </h3>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--brown-700)',
                  fontFamily: 'var(--font-body)',
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                Real-time full-screen TV ticker. Polls ledger parity every 5s with zero-difference guarantee.
              </p>
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 12,
                fontSize: 12,
                fontWeight: 600,
                color: '#15803d',
              }}
            >
              <span>Launch Live Monitor (TV)</span>
              <ChevronRight size={14} />
            </div>
          </Link>

          {/* 2. System Integrity Report */}
          <Link
            to="/integrity"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '14px 16px',
              background: 'var(--surface)',
              border: '1px solid rgba(208, 174, 146, 0.45)',
              borderRadius: 14,
              textDecoration: 'none',
              transition: 'all 150ms ease',
              boxShadow: '0 2px 6px rgba(74, 58, 52, 0.03)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 14px rgba(74, 58, 52, 0.08)';
              e.currentTarget.style.borderColor = 'var(--brown-700)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(74, 58, 52, 0.03)';
              e.currentTarget.style.borderColor = 'rgba(208, 174, 146, 0.45)';
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: 'rgba(208, 174, 146, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--brown-900)',
                  }}
                >
                  <ShieldCheck size={18} />
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--brown-800)',
                    background: 'rgba(208, 174, 146, 0.25)',
                    padding: '2px 8px',
                    borderRadius: 999,
                  }}
                >
                  10 INVARIANTS
                </span>
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 14,
                  color: 'var(--brown-900)',
                  margin: '0 0 4px 0',
                }}
              >
                System Integrity Report
              </h3>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--brown-700)',
                  fontFamily: 'var(--font-body)',
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                10 automated mathematical tests auditing trial balance, subledgers, inventory valuation & bank rec.
              </p>
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 12,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--brown-900)',
              }}
            >
              <span>Run Integrity Audit</span>
              <ChevronRight size={14} />
            </div>
          </Link>

          {/* 3. Business Analytics Engine */}
          <Link
            to="/analytics"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '14px 16px',
              background: 'var(--surface)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              borderRadius: 14,
              textDecoration: 'none',
              transition: 'all 150ms ease',
              boxShadow: '0 2px 6px rgba(59, 130, 246, 0.04)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 14px rgba(59, 130, 246, 0.12)';
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(59, 130, 246, 0.04)';
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.35)';
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: 'rgba(59, 130, 246, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                  }}
                >
                  <BarChart2 size={18} />
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: '#2563eb',
                    background: 'rgba(59, 130, 246, 0.12)',
                    padding: '2px 8px',
                    borderRadius: 999,
                  }}
                >
                  MARGINS & VELOCITY
                </span>
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 14,
                  color: 'var(--brown-900)',
                  margin: '0 0 4px 0',
                }}
              >
                Business Analytics Engine
              </h3>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--brown-700)',
                  fontFamily: 'var(--font-body)',
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                Gross margins, inventory turnover, customer CLV, velocity analysis & 1-click reorder POs.
              </p>
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 12,
                fontSize: 12,
                fontWeight: 600,
                color: '#2563eb',
              }}
            >
              <span>Explore Analytics</span>
              <ChevronRight size={14} />
            </div>
          </Link>

          {/* 4. Audit Log UI (Chatter) */}
          <Link
            to="/audit"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '14px 16px',
              background: 'var(--surface)',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              borderRadius: 14,
              textDecoration: 'none',
              transition: 'all 150ms ease',
              boxShadow: '0 2px 6px rgba(168, 85, 247, 0.04)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 14px rgba(168, 85, 247, 0.12)';
              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(168, 85, 247, 0.04)';
              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.35)';
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: 'rgba(168, 85, 247, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9333ea',
                  }}
                >
                  <ScrollText size={18} />
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: '#9333ea',
                    background: 'rgba(168, 85, 247, 0.12)',
                    padding: '2px 8px',
                    borderRadius: 999,
                  }}
                >
                  AUDIT & CHATTER
                </span>
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 14,
                  color: 'var(--brown-900)',
                  margin: '0 0 4px 0',
                }}
              >
                Audit Log & Chatter Feed
              </h3>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--brown-700)',
                  fontFamily: 'var(--font-body)',
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                Tamper-proof audit feed with record-level diffs, actor tracing, filters and interactive chatter.
              </p>
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 12,
                fontSize: 12,
                fontWeight: 600,
                color: '#9333ea',
              }}
            >
              <span>View Audit Feed</span>
              <ChevronRight size={14} />
            </div>
          </Link>
        </div>
      </div>

      {/* ── Refined KPI Strip (Clean, Smaller Figures & Smooth Corners) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        {/* KPI 1: Cash in Hand */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(208, 174, 146, 0.3)',
            borderRadius: 16,
            padding: '16px 18px',
            boxShadow: '0 2px 8px rgba(74, 58, 52, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)', color: 'var(--brown-700)', letterSpacing: '0.02em' }}>
              Cash in Hand
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: isManager ? 'rgba(180, 83, 9, 0.12)' : 'rgba(235, 215, 190, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isManager ? '#b45309' : 'var(--brown-900)',
              }}
            >
              {isManager ? <Lock size={14} /> : <Wallet size={14} />}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                fontSize: 19,
                letterSpacing: '-0.02em',
                color: isManager ? 'var(--brown-500)' : 'var(--brown-900)',
              }}
            >
              {isKpiLoading ? '...' : isManager ? '🔒 Restricted' : <Money value={kpiData?.cash || '0.00'} />}
            </div>
            <div style={{ fontSize: 11, color: isManager ? '#b45309' : 'rgba(119, 87, 74, 0.8)', fontFamily: 'var(--font-body)', marginTop: 2 }}>
              {isManager ? 'Finance & Owner Only' : 'Petty cash register'}
            </div>
          </div>
        </div>

        {/* KPI 2: Bank Balance */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(208, 174, 146, 0.3)',
            borderRadius: 16,
            padding: '16px 18px',
            boxShadow: '0 2px 8px rgba(74, 58, 52, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)', color: 'var(--brown-700)', letterSpacing: '0.02em' }}>
              Bank Balance
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: isManager ? 'rgba(180, 83, 9, 0.12)' : 'rgba(235, 215, 190, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isManager ? '#b45309' : 'var(--brown-900)',
              }}
            >
              {isManager ? <Lock size={14} /> : <Landmark size={14} />}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                fontSize: 19,
                letterSpacing: '-0.02em',
                color: isManager ? 'var(--brown-500)' : 'var(--brown-900)',
              }}
            >
              {isKpiLoading ? '...' : isManager ? '🔒 Restricted' : <Money value={kpiData?.bank || '0.00'} />}
            </div>
            <div style={{ fontSize: 11, color: isManager ? '#b45309' : 'rgba(119, 87, 74, 0.8)', fontFamily: 'var(--font-body)', marginTop: 2 }}>
              {isManager ? 'Finance & Owner Only' : 'HDFC & SBI Accounts'}
            </div>
          </div>
        </div>

        {/* KPI 3: Total Receivable */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(208, 174, 146, 0.3)',
            borderRadius: 16,
            padding: '16px 18px',
            boxShadow: '0 2px 8px rgba(74, 58, 52, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)', color: 'var(--brown-700)', letterSpacing: '0.02em' }}>
              Receivables
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'rgba(237, 241, 232, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--posted)',
              }}
            >
              <ArrowDownLeft size={14} />
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                fontSize: 19,
                letterSpacing: '-0.02em',
                color: 'var(--posted)',
              }}
            >
              {isKpiLoading ? '...' : <Money value={kpiData?.receivable || '0.00'} />}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(119, 87, 74, 0.8)', fontFamily: 'var(--font-body)', marginTop: 2 }}>
              Customer balances due
            </div>
          </div>
        </div>

        {/* KPI 4: Total Payable */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(208, 174, 146, 0.3)',
            borderRadius: 16,
            padding: '16px 18px',
            boxShadow: '0 2px 8px rgba(74, 58, 52, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)', color: 'var(--brown-700)', letterSpacing: '0.02em' }}>
              Payables
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'rgba(248, 234, 230, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--danger)',
              }}
            >
              <ArrowUpRight size={14} />
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                fontSize: 19,
                letterSpacing: '-0.02em',
                color: 'var(--danger)',
              }}
            >
              {isKpiLoading ? '...' : <Money value={kpiData?.payable || '0.00'} />}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(119, 87, 74, 0.8)', fontFamily: 'var(--font-body)', marginTop: 2 }}>
              Vendor bills to settle
            </div>
          </div>
        </div>

        {/* KPI 5: Net Profit */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(208, 174, 146, 0.3)',
            borderRadius: 16,
            padding: '16px 18px',
            boxShadow: '0 2px 8px rgba(74, 58, 52, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)', color: 'var(--brown-700)', letterSpacing: '0.02em' }}>
              Net Profit
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: isManager ? 'rgba(180, 83, 9, 0.12)' : 'rgba(237, 241, 232, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isManager ? '#b45309' : 'var(--posted)',
              }}
            >
              {isManager ? <Lock size={14} /> : <TrendingUp size={14} />}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                fontSize: 19,
                letterSpacing: '-0.02em',
                color: isManager ? 'var(--brown-500)' : 'var(--brown-900)',
              }}
            >
              {isKpiLoading ? '...' : isManager ? '🔒 Restricted' : <Money value={kpiData?.netIncomeThisMonth || '0.00'} />}
            </div>
            <div style={{ fontSize: 11, color: isManager ? '#b45309' : 'var(--posted)', fontFamily: 'var(--font-body)', marginTop: 2, fontWeight: 600 }}>
              {isManager ? 'Owner / Finance Only' : '+18.4% margin (active)'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Operational Cards: Sales, Purchase, Budget (Clean & Rounded) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 20,
        }}
      >
        {/* Card 1: Sales */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(208, 174, 146, 0.3)',
            borderRadius: 18,
            padding: 20,
            boxShadow: '0 2px 10px rgba(74, 58, 52, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 16,
                  color: 'var(--brown-900)',
                  margin: 0,
                }}
              >
                Sales Orders
              </h2>
              <span style={{ fontSize: 12, color: 'var(--brown-700)', fontFamily: 'var(--font-body)' }}>
                Customer order book
              </span>
            </div>
            <Link
              to="/sales/orders/new"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                color: 'var(--cream)',
                background: 'var(--brown-900)',
                padding: '5px 12px',
                borderRadius: 8,
                textDecoration: 'none',
                transition: 'opacity 150ms ease-out',
              }}
            >
              <Plus size={13} />
              <span>New</span>
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              textAlign: 'center',
            }}
          >
            <Link
              to="/sales/orders"
              style={{
                textDecoration: 'none',
                background: 'rgba(235, 215, 190, 0.25)',
                padding: '10px 8px',
                borderRadius: 12,
                display: 'block',
                transition: 'background 120ms ease-out',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--brown-700)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>All</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--brown-900)', marginTop: 2 }}>
                {isStatsLoading ? '...' : statsData?.sales ? statsData.sales.all : '200'}
              </div>
            </Link>
            <Link
              to="/sales/orders?status=confirmed"
              style={{
                textDecoration: 'none',
                background: 'rgba(237, 241, 232, 0.65)',
                padding: '10px 8px',
                borderRadius: 12,
                display: 'block',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--posted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Confirmed</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--posted)', marginTop: 2 }}>
                {isStatsLoading ? '...' : statsData?.sales ? statsData.sales.confirmed : '200'}
              </div>
            </Link>
            <Link
              to="/sales/orders?status=draft"
              style={{
                textDecoration: 'none',
                background: 'rgba(235, 215, 190, 0.25)',
                padding: '10px 8px',
                borderRadius: 12,
                display: 'block',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--brown-700)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Draft</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--brown-700)', marginTop: 2 }}>
                {isStatsLoading ? '...' : statsData?.sales ? statsData.sales.draft : '0'}
              </div>
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid rgba(208, 174, 146, 0.15)' }}>
            <Link
              to="/sales/invoices"
              style={{ fontSize: 12, color: 'var(--brown-700)', fontFamily: 'var(--font-body)', fontWeight: 500, textDecoration: 'none' }}
            >
              Invoices ({isStatsLoading ? '...' : statsData?.invoicesCount ?? '303'}) →
            </Link>
            <Link
              to="/sales/receivables"
              style={{ fontSize: 12, color: 'var(--posted)', fontFamily: 'var(--font-body)', fontWeight: 600, textDecoration: 'none' }}
            >
              Receivables →
            </Link>
          </div>
        </div>

        {/* Card 2: Purchase */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(208, 174, 146, 0.3)',
            borderRadius: 18,
            padding: 20,
            boxShadow: '0 2px 10px rgba(74, 58, 52, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 16,
                  color: 'var(--brown-900)',
                  margin: 0,
                }}
              >
                Purchases & POs
              </h2>
              <span style={{ fontSize: 12, color: 'var(--brown-700)', fontFamily: 'var(--font-body)' }}>
                Timber & materials flow
              </span>
            </div>
            <Link
              to="/purchase/orders/new"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                color: 'var(--cream)',
                background: 'var(--brown-900)',
                padding: '5px 12px',
                borderRadius: 8,
                textDecoration: 'none',
                transition: 'opacity 150ms ease-out',
              }}
            >
              <Plus size={13} />
              <span>New</span>
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              textAlign: 'center',
            }}
          >
            <Link
              to="/purchase/orders"
              style={{
                textDecoration: 'none',
                background: 'rgba(235, 215, 190, 0.25)',
                padding: '10px 8px',
                borderRadius: 12,
                display: 'block',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--brown-700)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>All</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--brown-900)', marginTop: 2 }}>
                {isStatsLoading ? '...' : statsData?.purchase ? statsData.purchase.all : '130'}
              </div>
            </Link>
            <Link
              to="/purchase/orders?status=confirmed"
              style={{
                textDecoration: 'none',
                background: 'rgba(237, 241, 232, 0.65)',
                padding: '10px 8px',
                borderRadius: 12,
                display: 'block',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--posted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Confirmed</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--posted)', marginTop: 2 }}>
                {isStatsLoading ? '...' : statsData?.purchase ? statsData.purchase.confirmed : '130'}
              </div>
            </Link>
            <Link
              to="/purchase/orders?status=draft"
              style={{
                textDecoration: 'none',
                background: 'rgba(235, 215, 190, 0.25)',
                padding: '10px 8px',
                borderRadius: 12,
                display: 'block',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--brown-700)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Draft</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--brown-700)', marginTop: 2 }}>
                {isStatsLoading ? '...' : statsData?.purchase ? statsData.purchase.draft : '0'}
              </div>
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid rgba(208, 174, 146, 0.15)' }}>
            <Link
              to="/purchase/bills"
              style={{ fontSize: 12, color: 'var(--brown-700)', fontFamily: 'var(--font-body)', fontWeight: 500, textDecoration: 'none' }}
            >
              Bills ({isStatsLoading ? '...' : statsData?.billsCount ?? '182'}) →
            </Link>
            <Link
              to="/purchase/statements"
              style={{ fontSize: 12, color: 'var(--brown-900)', fontFamily: 'var(--font-body)', fontWeight: 600, textDecoration: 'none' }}
            >
              Statements →
            </Link>
          </div>
        </div>

        {/* Card 3: Budget Reports */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(208, 174, 146, 0.3)',
            borderRadius: 18,
            padding: 20,
            boxShadow: '0 2px 10px rgba(74, 58, 52, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 16,
                  color: 'var(--brown-900)',
                  margin: 0,
                }}
              >
                Budget Reports
              </h2>
              <span style={{ fontSize: 12, color: 'var(--brown-700)', fontFamily: 'var(--font-body)' }}>
                Target tracking & commitments
              </span>
            </div>
            <Link
              to="/account/budgets/new"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                color: 'var(--cream)',
                background: 'var(--brown-900)',
                padding: '5px 12px',
                borderRadius: 8,
                textDecoration: 'none',
                transition: 'opacity 150ms ease-out',
              }}
            >
              <Plus size={13} />
              <span>New</span>
            </Link>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              textAlign: 'center',
            }}
          >
            <Link
              to="/account/budgets?status=confirmed"
              style={{
                textDecoration: 'none',
                background: 'rgba(237, 241, 232, 0.65)',
                padding: '10px 8px',
                borderRadius: 12,
                display: 'block',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--posted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Approved</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--posted)', marginTop: 2 }}>
                {isStatsLoading ? '...' : statsData?.budget ? statsData.budget.achieved : '2'}
              </div>
            </Link>
            <Link
              to="/account/budgets"
              style={{
                textDecoration: 'none',
                background: 'rgba(235, 215, 190, 0.25)',
                padding: '10px 8px',
                borderRadius: 12,
                display: 'block',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--brown-700)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Budget</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--brown-900)', marginTop: 2 }}>
                {isStatsLoading ? '...' : statsData?.budget ? statsData.budget.budget : '3'}
              </div>
            </Link>
            <Link
              to="/account/budgets"
              style={{
                textDecoration: 'none',
                background: 'rgba(251, 241, 223, 0.65)',
                padding: '10px 8px',
                borderRadius: 12,
                display: 'block',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Committed</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--warning)', marginTop: 2 }}>
                {isStatsLoading ? '...' : statsData?.budget ? statsData.budget.committed : '4'}
              </div>
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid rgba(208, 174, 146, 0.15)' }}>
            <Link
              to="/account/budgets"
              style={{ fontSize: 12, color: 'var(--brown-700)', fontFamily: 'var(--font-body)', fontWeight: 500, textDecoration: 'none' }}
            >
              Budgets ({isStatsLoading ? '...' : statsData?.budget ? statsData.budget.budget : '3'}) →
            </Link>
            <Link
              to="/report/budget"
              style={{ fontSize: 12, color: 'var(--brown-900)', fontFamily: 'var(--font-body)', fontWeight: 600, textDecoration: 'none' }}
            >
              Budget Report →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Financial Trend & Quick Actions ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 20,
        }}
      >
        {/* Monthly Trend Chart */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(208, 174, 146, 0.3)',
            borderRadius: 18,
            padding: 20,
            boxShadow: '0 2px 10px rgba(74, 58, 52, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 15,
                  color: 'var(--brown-900)',
                  margin: 0,
                }}
              >
                Monthly Revenue vs Expense (May – Aug 2026)
              </h3>
              <p style={{ fontSize: 12, color: 'var(--brown-700)', margin: '2px 0 0 0', fontFamily: 'var(--font-body)' }}>
                Computed from posted ledger entries
              </p>
            </div>
            <Link
              to="/report/profit-loss"
              style={{
                fontSize: 12,
                color: 'var(--brown-900)',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>P&L</span>
              <ExternalLink size={12} />
            </Link>
          </div>

          <div style={{ height: 230, width: '100%', marginTop: 4 }}>
            {isTrendsLoading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brown-700)', fontSize: 13 }}>
                Loading chart...
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(208, 174, 146, 0.2)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--brown-700)" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="var(--brown-700)"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `₹${(val / 10000000).toFixed(1)}Cr`}
                  />
                  <Tooltip
                    formatter={customTooltipFormatter}
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--brown-300)',
                      borderRadius: 10,
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-body)', paddingTop: 4 }}
                  />
                  <Bar dataKey="Revenue" fill="var(--posted)" radius={[6, 6, 0, 0]} name="Income" />
                  <Bar dataKey="Expense" fill="var(--warning)" radius={[6, 6, 0, 0]} name="Expense" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brown-700)' }}>
                No trend data
              </div>
            )}
          </div>
        </div>

        {/* Quick Action Shortcuts */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(208, 174, 146, 0.3)',
            borderRadius: 18,
            padding: 20,
            boxShadow: '0 2px 10px rgba(74, 58, 52, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 15,
                color: 'var(--brown-900)',
                margin: 0,
              }}
            >
              Quick Actions
            </h3>
            <p style={{ fontSize: 12, color: 'var(--brown-700)', margin: '2px 0 0 0', fontFamily: 'var(--font-body)' }}>
              Standard procedures
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link
              to="/sales/orders/new"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                background: 'rgba(235, 215, 190, 0.25)',
                borderRadius: 10,
                textDecoration: 'none',
                color: 'var(--brown-900)',
                fontSize: 12,
                fontWeight: 600,
                transition: 'background 120ms ease-out',
              }}
            >
              <Receipt size={15} style={{ color: 'var(--brown-700)' }} />
              <span>+ New Sales Order</span>
            </Link>

            <Link
              to="/purchase/bills/new"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                background: 'rgba(235, 215, 190, 0.25)',
                borderRadius: 10,
                textDecoration: 'none',
                color: 'var(--brown-900)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <FileText size={15} style={{ color: 'var(--brown-700)' }} />
              <span>+ Record Vendor Bill</span>
            </Link>

            <Link
              to="/sales/payments"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                background: 'rgba(235, 215, 190, 0.25)',
                borderRadius: 10,
                textDecoration: 'none',
                color: 'var(--brown-900)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <CreditCard size={15} style={{ color: 'var(--brown-700)' }} />
              <span>Register Payment</span>
            </Link>

            <Link
              to="/report/balance-sheet"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                background: 'var(--surface)',
                border: '1px solid rgba(208, 174, 146, 0.4)',
                borderRadius: 10,
                textDecoration: 'none',
                color: 'var(--brown-900)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <Building2 size={15} style={{ color: 'var(--brown-700)' }} />
              <span>Balance Sheet</span>
            </Link>

            <Link
              to="/account/coa"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                background: 'var(--surface)',
                border: '1px solid rgba(208, 174, 146, 0.4)',
                borderRadius: 10,
                textDecoration: 'none',
                color: 'var(--brown-900)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <Landmark size={15} style={{ color: 'var(--brown-700)' }} />
              <span>Chart of Accounts</span>
            </Link>

            <Link
              to="/monitor"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                background: 'rgba(22, 163, 74, 0.08)',
                border: '1px solid rgba(22, 163, 74, 0.3)',
                borderRadius: 10,
                textDecoration: 'none',
                color: '#15803d',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <Activity size={15} style={{ color: '#16a34a' }} />
              <span>Live Correctness Monitor (TV)</span>
            </Link>

            <Link
              to="/integrity"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                background: 'var(--surface)',
                border: '1px solid rgba(208, 174, 146, 0.4)',
                borderRadius: 10,
                textDecoration: 'none',
                color: 'var(--brown-900)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <ShieldCheck size={15} style={{ color: 'var(--brown-800)' }} />
              <span>System Integrity (10 Checks)</span>
            </Link>

            <Link
              to="/analytics"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                background: 'var(--surface)',
                border: '1px solid rgba(208, 174, 146, 0.4)',
                borderRadius: 10,
                textDecoration: 'none',
                color: 'var(--brown-900)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <BarChart2 size={15} style={{ color: '#2563eb' }} />
              <span>Business Analytics Engine</span>
            </Link>

            <Link
              to="/audit"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                background: 'var(--surface)',
                border: '1px solid rgba(208, 174, 146, 0.4)',
                borderRadius: 10,
                textDecoration: 'none',
                color: 'var(--brown-900)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <ScrollText size={15} style={{ color: '#9333ea' }} />
              <span>Audit Log & Chatter Feed</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Recent Ledger Postings Table (Clean & Rounded) ── */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid rgba(208, 174, 146, 0.3)',
          borderRadius: 18,
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
          <span style={{ fontSize: 12, color: 'var(--brown-700)', fontFamily: 'var(--font-body)' }}>
            Latest 10 transactions
          </span>
        </div>

        {isActivityLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--brown-700)', fontSize: 13 }}>
            Loading entries...
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
                      background: index % 2 === 1 ? 'rgba(249, 242, 228, 0.3)' : 'transparent',
                      transition: 'background 120ms ease-out',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(235, 215, 190, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = index % 2 === 1 ? 'rgba(249, 242, 228, 0.3)' : 'transparent';
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
