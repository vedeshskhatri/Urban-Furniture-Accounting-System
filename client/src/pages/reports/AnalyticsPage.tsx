/**
 * AnalyticsPage — /analytics and /report/analytics
 *
 * Deterministic, rule-based retail analytics engine.
 * Strictly NOT AI, NOT ML. No models, no forecasts, no intelligence.
 * All figures computed directly from posted journal entries and confirmed documents.
 *
 * Four Tabs:
 *   1. Products   — Profitability & loss-finder (worst margin first, loss/thin/healthy badges, drilldown)
 *   2. Inventory  — ABC classification (Pareto donut), Velocity, Dead stock, GMROI, 4-month linear trend
 *   3. Customers  — DSO, Concentration risk, Aging, Payment reliability, invoice drilldown
 *   4. Reorder    — Rule-based reorder suggestions with 1-click Purchase Order creation
 *
 * Design System: docs/Design.md
 *   - Cream/walnut warm theme
 *   - Montserrat for headings and KPI numbers
 *   - DM Sans for body and table text
 *   - IBM Plex Mono for right-aligned tabular numbers
 *   - Footer on every tab: "All figures computed directly from posted journal entries. No estimates."
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatINR, formatIndianNumber } from '../../lib/money';
import {
  Package,
  Layers,
  Users,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Search,
  ChevronRight,
  X,
  FileText,
  Loader2,
  ExternalLink,
  ShieldAlert,
  Info,
} from 'lucide-react';
import {
  AnalyticsApi,
  ProductProfitabilityRow,
  ProductInvoiceDrilldownRow,
  InventoryAnalyticsResponse,
  CustomerAnalyticsResponse,
  CustomerInvoiceDrilldownRow,
  ReorderSuggestionRow,
  CreatedPOResult,
} from '../../api/analytics.api';

/* ── Formatting Helpers ──────────────────────────────────────────────── */

function fmtMoney(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return '₹0.00';
  return formatINR(val);
}

function fmtQty(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return '0.00';
  return formatIndianNumber(val);
}

/* ── Style Tokens (from docs/Design.md) ────────────────────────────────── */

const STYLES = {
  container: {
    padding: '28px 36px 48px',
    maxWidth: 1400,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 24,
    fontFamily: 'var(--font-body)',
    color: 'var(--brown-900)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap' as const,
    gap: 16,
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--brown-900)',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    color: 'var(--brown-700)',
    marginTop: 4,
    margin: 0,
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid rgba(208, 174, 146, 0.4)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-sm)',
    padding: '20px 24px',
  },
  tableCard: {
    background: 'var(--surface)',
    border: '1px solid rgba(208, 174, 146, 0.4)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--brown-900)',
    margin: 0,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--brown-700)',
  },
  kpiValue: {
    fontFamily: 'var(--font-mono)',
    fontVariantNumeric: 'tabular-nums',
    fontSize: 26,
    fontWeight: 600,
    color: 'var(--brown-900)',
    marginTop: 6,
  },
  tableHeaderCell: {
    padding: '12px 16px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: 'var(--brown-700)',
    background: 'var(--cream)',
    borderBottom: '1px solid rgba(208, 174, 146, 0.4)',
  },
  tableCell: {
    padding: '12px 16px',
    fontSize: 13,
    borderBottom: '1px solid rgba(208, 174, 146, 0.25)',
  },
  tableCellMono: {
    padding: '12px 16px',
    fontSize: 13,
    fontFamily: 'var(--font-mono)',
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right' as const,
    borderBottom: '1px solid rgba(208, 174, 146, 0.25)',
  },
  footerNotice: {
    marginTop: 32,
    padding: '14px 20px',
    background: 'var(--cream)',
    border: '1px solid rgba(208, 174, 146, 0.4)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 13,
    color: 'var(--brown-700)',
    textAlign: 'center' as const,
    fontWeight: 500,
    letterSpacing: '0.01em',
  },
};

/* ── Badges ──────────────────────────────────────────────────────────── */

function FlagBadge({ flag }: { flag: 'loss' | 'thin' | 'healthy' }) {
  if (flag === 'loss') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          borderRadius: 'var(--radius-sm)',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          background: 'var(--danger-bg)',
          color: 'var(--danger)',
        }}
      >
        <AlertTriangle size={12} /> Loss-Making
      </span>
    );
  }
  if (flag === 'thin') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          borderRadius: 'var(--radius-sm)',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          background: 'var(--warning-bg)',
          color: 'var(--warning)',
        }}
      >
        <AlertCircle size={12} /> Thin Margin
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        background: 'var(--posted-bg)',
        color: 'var(--posted)',
      }}
    >
      <CheckCircle2 size={12} /> Healthy
    </span>
  );
}

function ReliabilityBadge({ status }: { status: 'reliable' | 'slow' | 'risk' }) {
  if (status === 'risk') {
    return (
      <span
        style={{
          padding: '3px 8px',
          borderRadius: 'var(--radius-sm)',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          background: 'var(--danger-bg)',
          color: 'var(--danger)',
        }}
      >
        Risk (&gt;60d / 90d+)
      </span>
    );
  }
  if (status === 'slow') {
    return (
      <span
        style={{
          padding: '3px 8px',
          borderRadius: 'var(--radius-sm)',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          background: 'var(--warning-bg)',
          color: 'var(--warning)',
        }}
      >
        Slow (31-60d)
      </span>
    );
  }
  return (
    <span
      style={{
        padding: '3px 8px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        background: 'var(--posted-bg)',
        color: 'var(--posted)',
      }}
    >
      Reliable (≤30d)
    </span>
  );
}

function TrendIndicator({ trend }: { trend: 'rising' | 'flat' | 'declining' }) {
  if (trend === 'rising') {
    return (
      <span
        title="4-month linear trend: rising"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--posted)',
        }}
      >
        <TrendingUp size={14} /> Rising
      </span>
    );
  }
  if (trend === 'declining') {
    return (
      <span
        title="4-month linear trend: declining"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--danger)',
        }}
      >
        <TrendingDown size={14} /> Declining
      </span>
    );
  }
  return (
    <span
      title="4-month linear trend: flat"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--brown-500)',
      }}
    >
      <Minus size={14} /> Flat
    </span>
  );
}

/* ── Main Component ──────────────────────────────────────────────────── */

export default function AnalyticsPage() {
  const queryClient = useQueryClient();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'products' | 'inventory' | 'customers' | 'reorder'>('products');

  // Date filters
  const [fromDate, setFromDate] = useState<string>('2026-01-01');
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Product filters
  const [productSearch, setProductSearch] = useState<string>('');
  const [productFlagFilter, setProductFlagFilter] = useState<'all' | 'loss' | 'thin' | 'healthy'>('all');

  // Customer filters
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [customerReliabilityFilter, setCustomerReliabilityFilter] = useState<'all' | 'reliable' | 'slow' | 'risk'>('all');

  // Drilldown states
  const [drillProduct, setDrillProduct] = useState<{ id: number; name: string } | null>(null);
  const [drillCustomer, setDrillCustomer] = useState<{ id: number; name: string } | null>(null);

  // PO creation notification
  const [poSuccess, setPoSuccess] = useState<CreatedPOResult | null>(null);

  /* ── Data Queries ── */

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['analytics-products', fromDate, toDate],
    queryFn: () => AnalyticsApi.getProducts(fromDate, toDate),
  });

  const { data: inventory, isLoading: loadingInventory } = useQuery({
    queryKey: ['analytics-inventory', fromDate, toDate],
    queryFn: () => AnalyticsApi.getInventory(fromDate, toDate),
  });

  const { data: customerData, isLoading: loadingCustomers } = useQuery({
    queryKey: ['analytics-customers', fromDate, toDate],
    queryFn: () => AnalyticsApi.getCustomers(fromDate, toDate),
  });

  const { data: reorderList = [], isLoading: loadingReorder } = useQuery({
    queryKey: ['analytics-reorder'],
    queryFn: () => AnalyticsApi.getReorder(),
  });

  // Drilldown queries
  const { data: productInvoices = [], isLoading: loadingProductInvoices } = useQuery({
    queryKey: ['analytics-product-invoices', drillProduct?.id, fromDate, toDate],
    queryFn: () => (drillProduct ? AnalyticsApi.getProductInvoices(drillProduct.id, fromDate, toDate) : []),
    enabled: !!drillProduct,
  });

  const { data: customerInvoices = [], isLoading: loadingCustomerInvoices } = useQuery({
    queryKey: ['analytics-customer-invoices', drillCustomer?.id],
    queryFn: () => (drillCustomer ? AnalyticsApi.getCustomerInvoices(drillCustomer.id) : []),
    enabled: !!drillCustomer,
  });

  // Create PO Mutation
  const createPoMutation = useMutation({
    mutationFn: (vars: { productId: number; qty?: number }) =>
      AnalyticsApi.createReorderPO(vars.productId, vars.qty),
    onSuccess: (result) => {
      setPoSuccess(result);
      queryClient.invalidateQueries({ queryKey: ['analytics-reorder'] });
      setTimeout(() => setPoSuccess(null), 8000);
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to create Purchase Order');
    },
  });

  /* ── Header KPI Computations ── */

  const portfolio = customerData?.portfolio;

  let totalRevenue = new Decimal(0);
  let totalCogs = new Decimal(0);
  let totalGrossMargin = new Decimal(0);

  for (const p of products) {
    totalRevenue = totalRevenue.plus(new Decimal(p.revenue || '0'));
    totalCogs = totalCogs.plus(new Decimal(p.cogs || '0'));
    totalGrossMargin = totalGrossMargin.plus(new Decimal(p.grossMargin || '0'));
  }

  const overallMarginPct = totalRevenue.gt(0)
    ? totalGrossMargin.div(totalRevenue).times(100).toFixed(2)
    : '0.00';

  /* ── Presets ── */

  const setPreset = (preset: 'fy26' | 'last30' | 'last90' | 'all') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (preset === 'fy26') {
      setFromDate('2026-04-01');
      setToDate('2027-03-31');
    } else if (preset === 'last30') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setFromDate(d.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (preset === 'last90') {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      setFromDate(d.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (preset === 'all') {
      setFromDate('2026-01-01');
      setToDate(todayStr);
    }
  };

  /* ── Filtered Products ── */

  const filteredProducts = products.filter((p) => {
    if (productFlagFilter !== 'all' && p.flag !== productFlagFilter) return false;
    if (productSearch) {
      const q = productSearch.toLowerCase();
      const matchName = p.productName.toLowerCase().includes(q);
      const matchSku = p.sku ? p.sku.toLowerCase().includes(q) : false;
      const matchCat = p.category ? p.category.toLowerCase().includes(q) : false;
      return matchName || matchSku || matchCat;
    }
    return true;
  });

  /* ── Filtered Customers ── */

  const customersList = customerData?.customers || [];
  const filteredCustomers = customersList.filter((c) => {
    if (customerReliabilityFilter !== 'all' && c.paymentReliability !== customerReliabilityFilter) return false;
    if (customerSearch) {
      const q = customerSearch.toLowerCase();
      const matchName = c.customerName.toLowerCase().includes(q);
      const matchEmail = c.email ? c.email.toLowerCase().includes(q) : false;
      return matchName || matchEmail;
    }
    return true;
  });

  return (
    <div style={STYLES.container}>
      {/* ── Page Header Strip ── */}
      <div style={STYLES.header}>
        <div>
          <h1 style={STYLES.title}>Business Analytics Engine</h1>
          <p style={STYLES.subtitle}>
            Rule-based, deterministic retail ledger analytics &amp; margin analysis
          </p>
        </div>

        {/* Period Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              onClick={() => setPreset('all')}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(208, 174, 146, 0.4)',
                background: 'var(--surface)',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setPreset('last90')}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(208, 174, 146, 0.4)',
                background: 'var(--surface)',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Last 90d
            </button>
            <button
              type="button"
              onClick={() => setPreset('last30')}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(208, 174, 146, 0.4)',
                background: 'var(--surface)',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Last 30d
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--surface)',
              border: '1px solid rgba(208, 174, 146, 0.4)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 10px',
            }}
          >
            <Calendar size={14} style={{ color: 'var(--brown-500)' }} />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--brown-900)',
                outline: 'none',
              }}
            />
            <span style={{ color: 'var(--brown-300)' }}>–</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--brown-900)',
                outline: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        <div style={STYLES.card}>
          <div style={STYLES.label}>Total Revenue (Period)</div>
          <div style={STYLES.kpiValue}>{fmtMoney(totalRevenue.toString())}</div>
          <div style={{ fontSize: 12, color: 'var(--brown-700)', marginTop: 4 }}>
            From confirmed customer invoices
          </div>
        </div>

        <div style={STYLES.card}>
          <div style={STYLES.label}>Total Gross Margin</div>
          <div style={{ ...STYLES.kpiValue, color: 'var(--posted)' }}>
            {fmtMoney(totalGrossMargin.toString())}
          </div>
          <div style={{ fontSize: 12, color: 'var(--brown-700)', marginTop: 4 }}>
            Revenue minus product COGS
          </div>
        </div>

        <div style={STYLES.card}>
          <div style={STYLES.label}>Gross Margin %</div>
          <div
            style={{
              ...STYLES.kpiValue,
              color: parseFloat(overallMarginPct) > 15 ? 'var(--posted)' : 'var(--warning)',
            }}
          >
            {overallMarginPct}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--brown-700)', marginTop: 4 }}>
            Target benchmark: &gt; 15%
          </div>
        </div>

        <div style={STYLES.card}>
          <div style={STYLES.label}>Days Sales Outstanding (DSO)</div>
          <div style={{ ...STYLES.kpiValue, color: 'var(--brown-900)' }}>
            {portfolio?.dso ?? '—'} <span style={{ fontSize: 16 }}>days</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--brown-700)', marginTop: 4 }}>
            Receivables turnover pace
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid rgba(208, 174, 146, 0.4)',
          paddingBottom: 2,
        }}
      >
        {[
          { id: 'products', label: 'Products', icon: Package, count: products.length },
          { id: 'inventory', label: 'Inventory', icon: Layers, count: inventory?.items.length },
          { id: 'customers', label: 'Customers', icon: Users, count: customersList.length },
          {
            id: 'reorder',
            label: 'Reorder',
            icon: ShoppingCart,
            badge: reorderList.filter((r) => r.isReorderNeeded).length,
          },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                background: isActive ? 'var(--surface)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--brown-900)' : '3px solid transparent',
                borderRadius: '6px 6px 0 0',
                color: isActive ? 'var(--brown-900)' : 'var(--brown-700)',
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span
                  style={{
                    background: 'var(--danger)',
                    color: '#fff',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 7px',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Success PO creation alert ── */}
      {poSuccess && (
        <div
          style={{
            padding: '14px 20px',
            background: 'var(--posted-bg)',
            border: '1px solid var(--posted)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={20} style={{ color: 'var(--posted)' }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--posted)' }}>
                Draft Purchase Order {poSuccess.poNumber} Created Successfully
              </div>
              <div style={{ fontSize: 13, color: 'var(--brown-900)' }}>
                Vendor: <strong>{poSuccess.vendorName}</strong> · Total: <strong>{fmtMoney(poSuccess.total)}</strong> · Verified NO journal entry posted.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPoSuccess(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--brown-700)',
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: PRODUCTS (Profitability & Loss-Finder)
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'products' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Controls */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--surface)',
                  border: '1px solid rgba(208, 174, 146, 0.4)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 12px',
                  width: '100%',
                  maxWidth: 360,
                }}
              >
                <Search size={15} style={{ color: 'var(--brown-500)' }} />
                <input
                  type="text"
                  placeholder="Filter by product, SKU, or category..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: 13,
                    width: '100%',
                    fontFamily: 'var(--font-body)',
                  }}
                />
              </div>

              {/* Status Filter */}
              <select
                value={productFlagFilter}
                onChange={(e) => setProductFlagFilter(e.target.value as any)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(208, 174, 146, 0.4)',
                  background: 'var(--surface)',
                  fontSize: 13,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--brown-900)',
                }}
              >
                <option value="all">All Margins</option>
                <option value="loss">Loss-Making (&lt; 0%)</option>
                <option value="thin">Thin Margin (0 - 15%)</option>
                <option value="healthy">Healthy Margin (&gt; 15%)</option>
              </select>
            </div>

            <div style={{ fontSize: 13, color: 'var(--brown-700)' }}>
              Showing <strong>{filteredProducts.length}</strong> products · Sorted worst-margin-first
            </div>
          </div>

          {/* Table */}
          <div style={STYLES.tableCard}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'left' }}>Product / Category</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Units</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Avg Price</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Revenue</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>COGS</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Gross Margin</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Margin %</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'center' }}>Classification</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'center' }}>Drilldown</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingProducts ? (
                    <tr>
                      <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--brown-500)' }}>
                        <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                        Computing product profitability from ledger records...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--brown-500)' }}>
                        No products match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isLoss = p.flag === 'loss';
                      return (
                        <tr
                          key={p.productId}
                          onClick={() => setDrillProduct({ id: p.productId, name: p.productName })}
                          style={{
                            cursor: 'pointer',
                            background: isLoss ? 'rgba(158, 74, 56, 0.04)' : undefined,
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brown-100)')}
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = isLoss ? 'rgba(158, 74, 56, 0.04)' : '')
                          }
                        >
                          <td style={STYLES.tableCell}>
                            <div style={{ fontWeight: 600, color: 'var(--brown-900)' }}>{p.productName}</div>
                            <div style={{ fontSize: 11, color: 'var(--brown-500)' }}>
                              {p.sku || 'SKU-—'} · {p.category || 'Standard'} · Cost: {fmtMoney(p.costPrice)}
                            </div>
                          </td>
                          <td style={STYLES.tableCellMono}>{fmtQty(p.unitsSold)}</td>
                          <td style={STYLES.tableCellMono}>{fmtMoney(p.avgSalePrice)}</td>
                          <td style={STYLES.tableCellMono}>{fmtMoney(p.revenue)}</td>
                          <td style={STYLES.tableCellMono}>{fmtMoney(p.cogs)}</td>
                          <td
                            style={{
                              ...STYLES.tableCellMono,
                              color: isLoss ? 'var(--danger)' : 'var(--brown-900)',
                              fontWeight: 600,
                            }}
                          >
                            {fmtMoney(p.grossMargin)}
                          </td>
                          <td
                            style={{
                              ...STYLES.tableCellMono,
                              color: isLoss ? 'var(--danger)' : p.flag === 'thin' ? 'var(--warning)' : 'var(--posted)',
                              fontWeight: 700,
                            }}
                          >
                            {p.marginPct}%
                          </td>
                          <td style={{ ...STYLES.tableCell, textAlign: 'center' }}>
                            <FlagBadge flag={p.flag} />
                          </td>
                          <td style={{ ...STYLES.tableCell, textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDrillProduct({ id: p.productId, name: p.productName });
                              }}
                              style={{
                                padding: '4px 8px',
                                background: 'transparent',
                                border: '1px solid rgba(208, 174, 146, 0.5)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 11,
                                cursor: 'pointer',
                                color: 'var(--brown-700)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              Invoices <ChevronRight size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: INVENTORY (ABC, Velocity, Dead Stock, GMROI, Trend)
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* ABC Pareto + Velocity Overview */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: 20,
            }}
          >
            {/* ABC Donut Card */}
            <div style={STYLES.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={STYLES.sectionTitle}>ABC Classification (Pareto)</div>
                  <div style={{ fontSize: 12, color: 'var(--brown-700)', marginTop: 2 }}>
                    A: top 80% revenue · B: next 15% · C: bottom 5%
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', marginTop: 16, gap: 24, flexWrap: 'wrap' }}>
                <div style={{ width: 180, height: 180 }}>
                  {inventory?.summary && (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Class A (0-80%)', value: parseFloat(inventory.summary.revenueA) },
                            { name: 'Class B (80-95%)', value: parseFloat(inventory.summary.revenueB) },
                            { name: 'Class C (95-100%)', value: parseFloat(inventory.summary.revenueC) },
                          ]}
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          <Cell fill="#4A3A34" />
                          <Cell fill="#A8836C" />
                          <Cell fill="#D0AE92" />
                        </Pie>
                        <RechartsTooltip formatter={(val: any) => fmtMoney(val)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 2, background: '#4A3A34' }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Class A (Core Engines)</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      <strong>{inventory?.summary.countA}</strong> products · {fmtMoney(inventory?.summary.revenueA)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 2, background: '#A8836C' }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Class B (Mid-Tier)</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      <strong>{inventory?.summary.countB}</strong> products · {fmtMoney(inventory?.summary.revenueB)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 2, background: '#D0AE92' }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Class C (Long Tail)</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      <strong>{inventory?.summary.countC}</strong> products · {fmtMoney(inventory?.summary.revenueC)}
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: '1px solid rgba(208, 174, 146, 0.3)',
                      paddingTop: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: 'var(--brown-700)',
                    }}
                  >
                    <span>Total Evaluated: {inventory?.summary.totalProducts} goods</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {fmtMoney(inventory?.summary.totalRevenue)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Inventory Holding Summary */}
            <div style={STYLES.card}>
              <div style={STYLES.sectionTitle}>Capital Allocation &amp; Turn</div>
              <div style={{ fontSize: 12, color: 'var(--brown-700)', marginTop: 2 }}>
                Deterministic capital tie-up derived from live stock moves
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                  marginTop: 20,
                }}
              >
                <div
                  style={{
                    padding: 16,
                    background: 'var(--cream)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={STYLES.label}>Dead Stock Capital</div>
                  <div style={{ ...STYLES.kpiValue, fontSize: 22, color: 'var(--danger)' }}>
                    {fmtMoney(
                      inventory?.deadStock
                        .reduce((acc, i) => acc.plus(new Decimal(i.tiedUpCapital)), new Decimal(0))
                        .toString()
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--brown-700)', marginTop: 4 }}>
                    {inventory?.deadStock.length} items with &gt;60d without sale
                  </div>
                </div>

                <div
                  style={{
                    padding: 16,
                    background: 'var(--cream)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={STYLES.label}>Poor Return Lines (GMROI &lt; 1)</div>
                  <div style={{ ...STYLES.kpiValue, fontSize: 22, color: 'var(--warning)' }}>
                    {inventory?.gmroiItems.filter((i) => i.gmroiFlag === 'poor_return').length}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--brown-700)', marginTop: 4 }}>
                    Cost more to hold than they generate in margin
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 20,
                  fontSize: 12,
                  color: 'var(--brown-700)',
                  lineHeight: 1.5,
                  padding: '10px 14px',
                  background: 'rgba(208, 174, 146, 0.15)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <strong>4-Month Linear Trend:</strong> Computed via deterministic least-squares regression over monthly confirmed invoices. Labeled strictly as <em>trend</em>, not a predictive forecast.
              </div>
            </div>
          </div>

          {/* Section 2: Dead Stock Table */}
          <div style={STYLES.tableCard}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(208, 174, 146, 0.4)',
                background: 'var(--cream)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={STYLES.sectionTitle}>Dead Stock (Tied-Up Capital)</h3>
                <div style={{ fontSize: 12, color: 'var(--brown-700)', marginTop: 2 }}>
                  Products with 0 sales in period OR no movement for &gt; 60 days
                </div>
              </div>
              <span
                style={{
                  background: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {inventory?.deadStock.length} Items Flagged
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'left' }}>Product</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Stock Qty</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Cost Price</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Tied-Up Capital</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Days Since Sale</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'center' }}>4-Month Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory?.deadStock.slice(0, 10).map((item) => (
                    <tr key={item.productId}>
                      <td style={STYLES.tableCell}>
                        <div style={{ fontWeight: 600 }}>{item.productName}</div>
                        <div style={{ fontSize: 11, color: 'var(--brown-500)' }}>
                          {item.sku || 'SKU-—'} · Class {item.abcClass}
                        </div>
                      </td>
                      <td style={STYLES.tableCellMono}>{fmtQty(item.stockQty)}</td>
                      <td style={STYLES.tableCellMono}>{fmtMoney(item.costPrice)}</td>
                      <td
                        style={{
                          ...STYLES.tableCellMono,
                          fontWeight: 700,
                          color: 'var(--danger)',
                        }}
                      >
                        {fmtMoney(item.tiedUpCapital)}
                      </td>
                      <td style={STYLES.tableCellMono}>
                        {item.daysSinceLastSale !== null ? `${item.daysSinceLastSale} days` : 'No sales in period'}
                      </td>
                      <td style={{ ...STYLES.tableCell, textAlign: 'center' }}>
                        <TrendIndicator trend={item.linearTrend} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: GMROI Table */}
          <div style={STYLES.tableCard}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(208, 174, 146, 0.4)',
                background: 'var(--cream)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={STYLES.sectionTitle}>GMROI (Gross Margin Return on Inventory Investment)</h3>
                <div style={{ fontSize: 12, color: 'var(--brown-700)', marginTop: 2 }}>
                  GMROI = Gross Margin / Avg Inventory Holding Cost. Values &lt; 1.0 indicate inventory costs exceed returns.
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'left' }}>Product</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Gross Margin</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Holding Cost</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>GMROI Ratio</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'center' }}>Return Status</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'center' }}>4-Month Linear Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory?.gmroiItems.slice(0, 15).map((item) => {
                    const isPoor = item.gmroiFlag === 'poor_return';
                    return (
                      <tr key={item.productId} style={{ background: isPoor ? 'rgba(192, 138, 62, 0.04)' : undefined }}>
                        <td style={STYLES.tableCell}>
                          <div style={{ fontWeight: 600 }}>{item.productName}</div>
                          <div style={{ fontSize: 11, color: 'var(--brown-500)' }}>
                            {item.sku || 'SKU-—'} · Class {item.abcClass}
                          </div>
                        </td>
                        <td style={STYLES.tableCellMono}>{fmtMoney(item.grossMargin)}</td>
                        <td style={STYLES.tableCellMono}>{fmtMoney(item.avgInventoryCost)}</td>
                        <td
                          style={{
                            ...STYLES.tableCellMono,
                            fontWeight: 700,
                            color: isPoor ? 'var(--danger)' : 'var(--posted)',
                          }}
                        >
                          {item.gmroi ?? '—'}
                        </td>
                        <td style={{ ...STYLES.tableCell, textAlign: 'center' }}>
                          {isPoor ? (
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background: 'var(--danger-bg)',
                                color: 'var(--danger)',
                              }}
                            >
                              Poor Return (&lt;1.0)
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background: 'var(--posted-bg)',
                                color: 'var(--posted)',
                              }}
                            >
                              Acceptable
                            </span>
                          )}
                        </td>
                        <td style={{ ...STYLES.tableCell, textAlign: 'center' }}>
                          <TrendIndicator trend={item.linearTrend} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 3: CUSTOMERS & RECEIVABLES PROFILES
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'customers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Portfolio Metric Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16,
            }}
          >
            <div style={STYLES.card}>
              <div style={STYLES.label}>Days Sales Outstanding (DSO)</div>
              <div style={{ ...STYLES.kpiValue, color: 'var(--brown-900)' }}>
                {portfolio?.dso ?? '0.0'} <span style={{ fontSize: 16 }}>days</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--brown-700)', marginTop: 4 }}>
                Formula: (Total Receivables / Total Revenue) × {portfolio?.daysInPeriod ?? 120} days
              </div>
            </div>

            <div style={STYLES.card}>
              <div style={STYLES.label}>Concentration Risk</div>
              <div
                style={{
                  ...STYLES.kpiValue,
                  color: portfolio?.hasConcentrationRisk ? 'var(--danger)' : 'var(--posted)',
                }}
              >
                {portfolio?.top3SharePct}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--brown-700)', marginTop: 4 }}>
                {portfolio?.hasConcentrationRisk ? (
                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                    <ShieldAlert size={12} style={{ display: 'inline' }} /> Alert: Top 3 customers exceed 40% of revenue
                  </span>
                ) : (
                  <span style={{ color: 'var(--posted)', fontWeight: 600 }}>
                    <CheckCircle2 size={12} style={{ display: 'inline' }} /> Healthy: Top 3 customers within 40% limit
                  </span>
                )}
              </div>
            </div>

            <div style={STYLES.card}>
              <div style={STYLES.label}>Payment Reliability Breakdown</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--posted)', fontFamily: 'var(--font-mono)' }}>
                    {portfolio?.reliabilityCounts.reliable ?? 0}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--brown-700)' }}>Reliable</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>
                    {portfolio?.reliabilityCounts.slow ?? 0}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--brown-700)' }}>Slow</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
                    {portfolio?.reliabilityCounts.risk ?? 0}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--brown-700)' }}>At Risk</div>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Table Filter Strip */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--surface)',
                  border: '1px solid rgba(208, 174, 146, 0.4)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 12px',
                  width: '100%',
                  maxWidth: 360,
                }}
              >
                <Search size={15} style={{ color: 'var(--brown-500)' }} />
                <input
                  type="text"
                  placeholder="Filter by customer name or email..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: 13,
                    width: '100%',
                    fontFamily: 'var(--font-body)',
                  }}
                />
              </div>

              <select
                value={customerReliabilityFilter}
                onChange={(e) => setCustomerReliabilityFilter(e.target.value as any)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(208, 174, 146, 0.4)',
                  background: 'var(--surface)',
                  fontSize: 13,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--brown-900)',
                }}
              >
                <option value="all">All Reliability</option>
                <option value="reliable">Reliable (≤ 30d)</option>
                <option value="slow">Slow (31 - 60d)</option>
                <option value="risk">Risk (&gt; 60d / 90d+ Overdue)</option>
              </select>
            </div>

            <div style={{ fontSize: 13, color: 'var(--brown-700)' }}>
              Showing <strong>{filteredCustomers.length}</strong> customer accounts
            </div>
          </div>

          {/* Customer Table */}
          <div style={STYLES.tableCard}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'left' }}>Customer</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Invoiced</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Paid</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Outstanding</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Avg Days to Pay</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Oldest Unpaid</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Revenue Share</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'center' }}>Reliability</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'center' }}>Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingCustomers ? (
                    <tr>
                      <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--brown-500)' }}>
                        <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                        Analyzing customer payment histories...
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--brown-500)' }}>
                        No customers match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => (
                      <tr
                        key={c.customerId}
                        onClick={() => setDrillCustomer({ id: c.customerId, name: c.customerName })}
                        style={{ cursor: 'pointer', transition: 'background 0.1s ease' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brown-100)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                      >
                        <td style={STYLES.tableCell}>
                          <div style={{ fontWeight: 600 }}>{c.customerName}</div>
                          <div style={{ fontSize: 11, color: 'var(--brown-500)' }}>
                            {c.email || 'No email'} · {c.invoiceCount} invoices
                          </div>
                        </td>
                        <td style={STYLES.tableCellMono}>{fmtMoney(c.totalInvoiced)}</td>
                        <td style={STYLES.tableCellMono}>{fmtMoney(c.totalPaid)}</td>
                        <td
                          style={{
                            ...STYLES.tableCellMono,
                            fontWeight: 600,
                            color: new Decimal(c.outstanding).gt(0) ? 'var(--danger)' : 'var(--posted)',
                          }}
                        >
                          {fmtMoney(c.outstanding)}
                        </td>
                        <td style={STYLES.tableCellMono}>{c.avgDaysToPay} days</td>
                        <td style={STYLES.tableCellMono}>
                          {c.oldestUnpaidDays !== null ? `${c.oldestUnpaidDays} days` : '0 days (settled)'}
                        </td>
                        <td style={STYLES.tableCellMono}>{c.revenueShare}%</td>
                        <td style={{ ...STYLES.tableCell, textAlign: 'center' }}>
                          <ReliabilityBadge status={c.paymentReliability} />
                        </td>
                        <td style={{ ...STYLES.tableCell, textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDrillCustomer({ id: c.customerId, name: c.customerName });
                            }}
                            style={{
                              padding: '4px 8px',
                              background: 'transparent',
                              border: '1px solid rgba(208, 174, 146, 0.5)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 11,
                              cursor: 'pointer',
                              color: 'var(--brown-700)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            View <ChevronRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 4: REORDER SUGGESTIONS (Closes the Loop -> PO Creation)
          ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'reorder' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Formula Callout Banner */}
          <div
            style={{
              padding: '14px 20px',
              background: 'var(--surface)',
              border: '1px solid rgba(208, 174, 146, 0.4)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ShoppingCart size={22} style={{ color: 'var(--brown-700)' }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--brown-900)' }}>
                  Rule-Based Procurement Engine
                </div>
                <div style={{ fontSize: 13, color: 'var(--brown-700)' }}>
                  Formula: <code>Reorder Point = (Units/Day × 14 Lead Days) + Safety Stock (7 days)</code>. Suggested Qty covers 2 lead cycles minus current stock.
                </div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: 'var(--brown-700)' }}>
              <strong>{reorderList.filter((r) => r.isReorderNeeded).length}</strong> products below reorder point
            </div>
          </div>

          {/* Table */}
          <div style={STYLES.tableCard}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'left' }}>Product</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Stock Qty</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Units / Day</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Reorder Point</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Suggested Qty</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Cost Price</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'left' }}>Last Supplier</th>
                    <th style={{ ...STYLES.tableHeaderCell, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingReorder ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--brown-500)' }}>
                        <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                        Evaluating inventory depletion rates...
                      </td>
                    </tr>
                  ) : reorderList.filter((r) => r.isReorderNeeded).length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--posted)' }}>
                        <CheckCircle2 size={24} style={{ margin: '0 auto 8px' }} />
                        All inventory levels are above their calculated reorder threshold.
                      </td>
                    </tr>
                  ) : (
                    reorderList
                      .filter((r) => r.isReorderNeeded)
                      .slice(0, 25)
                      .map((item) => {
                        const isCreating =
                          createPoMutation.isPending &&
                          createPoMutation.variables?.productId === item.productId;
                        return (
                          <tr key={item.productId}>
                            <td style={STYLES.tableCell}>
                              <div style={{ fontWeight: 600 }}>{item.productName}</div>
                              <div style={{ fontSize: 11, color: 'var(--brown-500)' }}>
                                {item.sku || 'SKU-—'} · {item.category || 'Standard'}
                              </div>
                            </td>
                            <td
                              style={{
                                ...STYLES.tableCellMono,
                                color: new Decimal(item.stockQty).lte(0) ? 'var(--danger)' : 'var(--warning)',
                                fontWeight: 600,
                              }}
                            >
                              {fmtQty(item.stockQty)}
                            </td>
                            <td style={STYLES.tableCellMono}>{item.unitsPerDay} / day</td>
                            <td style={STYLES.tableCellMono}>{item.reorderPoint}</td>
                            <td
                              style={{
                                ...STYLES.tableCellMono,
                                fontWeight: 700,
                                color: 'var(--brown-900)',
                              }}
                            >
                              {item.suggestedQty}
                            </td>
                            <td style={STYLES.tableCellMono}>{fmtMoney(item.costPrice)}</td>
                            <td style={STYLES.tableCell}>
                              <span style={{ fontWeight: 500, color: 'var(--brown-900)' }}>
                                {item.lastVendorName || 'Azure Furniture (Default)'}
                              </span>
                            </td>
                            <td style={{ ...STYLES.tableCell, textAlign: 'center' }}>
                              <button
                                type="button"
                                disabled={isCreating}
                                onClick={() =>
                                  createPoMutation.mutate({
                                    productId: item.productId,
                                    qty: parseInt(item.suggestedQty, 10),
                                  })
                                }
                                style={{
                                  padding: '6px 14px',
                                  background: 'var(--brown-900)',
                                  color: 'var(--cream)',
                                  border: 'none',
                                  borderRadius: 'var(--radius-sm)',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  fontFamily: 'var(--font-body)',
                                  cursor: isCreating ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  boxShadow: 'var(--shadow-sm)',
                                }}
                              >
                                {isCreating ? (
                                  <>
                                    <Loader2 size={13} className="animate-spin" /> Creating...
                                  </>
                                ) : (
                                  <>Create Purchase Order</>
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer Notice (Carried on EVERY tab verbatim) ── */}
      <div style={STYLES.footerNotice}>
        All figures computed directly from posted journal entries. No estimates.
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          DRILLDOWN MODAL 1: Product Invoices
          ═══════════════════════════════════════════════════════════════════ */}
      {drillProduct && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300,
            background: 'rgba(74, 58, 52, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setDrillProduct(null)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              maxWidth: 900,
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid rgba(208, 174, 146, 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 24px',
                background: 'var(--cream)',
                borderBottom: '1px solid rgba(208, 174, 146, 0.4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--brown-700)' }}>
                  Product Margin Drilldown
                </div>
                <h3 style={{ margin: '4px 0 0', fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--brown-900)' }}>
                  {drillProduct.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDrillProduct(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brown-700)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              {loadingProductInvoices ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--brown-500)' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                  Loading line-item transactions...
                </div>
              ) : productInvoices.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--brown-500)' }}>
                  No confirmed invoice lines found for this product in the selected period.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...STYLES.tableHeaderCell, textAlign: 'left' }}>Invoice #</th>
                      <th style={{ ...STYLES.tableHeaderCell, textAlign: 'left' }}>Date</th>
                      <th style={{ ...STYLES.tableHeaderCell, textAlign: 'left' }}>Customer</th>
                      <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Qty</th>
                      <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Unit Price</th>
                      <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Revenue</th>
                      <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>COGS</th>
                      <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productInvoices.map((inv) => {
                      const isLossLine = parseFloat(inv.marginPct) < 0;
                      return (
                        <tr key={inv.invoiceId + '-' + inv.invoiceNumber}>
                          <td style={{ ...STYLES.tableCell, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {inv.invoiceNumber}
                          </td>
                          <td style={STYLES.tableCell}>{inv.invoiceDate}</td>
                          <td style={STYLES.tableCell}>{inv.customerName}</td>
                          <td style={STYLES.tableCellMono}>{fmtQty(inv.qty)}</td>
                          <td style={STYLES.tableCellMono}>{fmtMoney(inv.unitPrice)}</td>
                          <td style={STYLES.tableCellMono}>{fmtMoney(inv.subtotal)}</td>
                          <td style={STYLES.tableCellMono}>{fmtMoney(inv.cogs)}</td>
                          <td
                            style={{
                              ...STYLES.tableCellMono,
                              fontWeight: 700,
                              color: isLossLine ? 'var(--danger)' : 'var(--posted)',
                            }}
                          >
                            {inv.marginPct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 24px',
                background: 'var(--cream)',
                borderTop: '1px solid rgba(208, 174, 146, 0.4)',
                fontSize: 12,
                color: 'var(--brown-700)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Total Lines: {productInvoices.length}</span>
              <span>All figures computed directly from posted customer invoices</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          DRILLDOWN MODAL 2: Customer Invoices
          ═══════════════════════════════════════════════════════════════════ */}
      {drillCustomer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300,
            background: 'rgba(74, 58, 52, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setDrillCustomer(null)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              maxWidth: 900,
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid rgba(208, 174, 146, 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 24px',
                background: 'var(--cream)',
                borderBottom: '1px solid rgba(208, 174, 146, 0.4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--brown-700)' }}>
                  Customer Receivables Drilldown
                </div>
                <h3 style={{ margin: '4px 0 0', fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--brown-900)' }}>
                  {drillCustomer.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDrillCustomer(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brown-700)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              {loadingCustomerInvoices ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--brown-500)' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                  Loading customer invoices...
                </div>
              ) : customerInvoices.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--brown-500)' }}>
                  No confirmed invoices found for this customer.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...STYLES.tableHeaderCell, textAlign: 'left' }}>Invoice #</th>
                      <th style={{ ...STYLES.tableHeaderCell, textAlign: 'left' }}>Invoice Date</th>
                      <th style={{ ...STYLES.tableHeaderCell, textAlign: 'left' }}>Due Date</th>
                      <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Total</th>
                      <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Paid</th>
                      <th style={{ ...STYLES.tableHeaderCell, textAlign: 'right' }}>Due</th>
                      <th style={{ ...STYLES.tableHeaderCell, textAlign: 'center' }}>Payment Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerInvoices.map((inv) => (
                      <tr key={inv.invoiceId}>
                        <td style={{ ...STYLES.tableCell, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {inv.number}
                        </td>
                        <td style={STYLES.tableCell}>{inv.invoiceDate}</td>
                        <td style={STYLES.tableCell}>{inv.dueDate || '—'}</td>
                        <td style={STYLES.tableCellMono}>{fmtMoney(inv.total)}</td>
                        <td style={STYLES.tableCellMono}>{fmtMoney(inv.amountPaid)}</td>
                        <td
                          style={{
                            ...STYLES.tableCellMono,
                            fontWeight: 600,
                            color: new Decimal(inv.amountDue).gt(0) ? 'var(--danger)' : 'var(--posted)',
                          }}
                        >
                          {fmtMoney(inv.amountDue)}
                        </td>
                        <td style={{ ...STYLES.tableCell, textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background:
                                inv.paymentStatus === 'paid'
                                  ? 'var(--posted-bg)'
                                  : inv.paymentStatus === 'partial'
                                  ? 'var(--warning-bg)'
                                  : 'var(--danger-bg)',
                              color:
                                inv.paymentStatus === 'paid'
                                  ? 'var(--posted)'
                                  : inv.paymentStatus === 'partial'
                                  ? 'var(--warning)'
                                  : 'var(--danger)',
                            }}
                          >
                            {inv.paymentStatus.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 24px',
                background: 'var(--cream)',
                borderTop: '1px solid rgba(208, 174, 146, 0.4)',
                fontSize: 12,
                color: 'var(--brown-700)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Total Invoices: {customerInvoices.length}</span>
              <span>Directly backed by payment allocations view</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
