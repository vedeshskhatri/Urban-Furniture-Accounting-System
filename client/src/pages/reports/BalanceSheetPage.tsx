import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { ReportsApi, BalanceSheetReport } from '../../api/reports.api';
import Money from '../../components/ui/Money';
import LedgerDrilldownModal from './LedgerDrilldownModal';
import {
  Printer,
  Calendar,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Scale,
  ShieldCheck,
  BarChart3,
  PieChart as PieIcon,
  Layers,
} from 'lucide-react';

const ASSET_PALETTE = [
  '#5F7052', // Olive
  '#77574A', // Walnut mid
  '#C08A3E', // Amber
  '#A8836C', // Sand brown
  '#4A3A34', // Walnut dark
  '#9E4A38', // Terracotta
  '#D0AE92', // Light sand
];

function formatDisplayINR(num: number): string {
  if (Math.abs(num) >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  }
  if (Math.abs(num) >= 100000) {
    return `₹${(num / 100000).toFixed(2)} L`;
  }
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function BalanceSheetPage() {
  const navigate = useNavigate();
  const [asOfDate, setAsOfDate] = useState<string>('2026-09-06');
  const [selectedDrillAccount, setSelectedDrillAccount] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [activeViewMode, setActiveViewMode] = useState<'both' | 'charts' | 'statement'>('both');

  const {
    data: report,
    isLoading,
    refetch,
  } = useQuery<BalanceSheetReport>({
    queryKey: ['balance-sheet', asOfDate],
    queryFn: () => ReportsApi.getBalanceSheet(asOfDate),
  });

  const handlePrint = () => {
    window.print();
  };

  const isBalanced = report?.isBalanced ?? true;

  // Decimal-based financial metrics
  const totalAssetsDec = useMemo(() => new Decimal(report?.totalAssets || '0'), [report]);
  const totalLiabDec = useMemo(() => new Decimal(report?.totalLiabilities || '0'), [report]);
  const totalEquityDec = useMemo(() => new Decimal(report?.totalEquity || '0'), [report]);
  const totalClaimsDec = useMemo(() => totalLiabDec.plus(totalEquityDec), [totalLiabDec, totalEquityDec]);
  const curProfitDec = useMemo(() => new Decimal(report?.currentPeriodProfit || '0'), [report]);

  // Balance Equation Chart Data
  const equationChartData = useMemo(() => {
    return [
      {
        name: 'Total Assets',
        amount: totalAssetsDec.toNumber(),
        fill: '#5F7052', // Olive
      },
      {
        name: 'Total Claims (Liab + Eq)',
        amount: totalClaimsDec.toNumber(),
        fill: '#4A3A34', // Walnut
      },
    ];
  }, [totalAssetsDec, totalClaimsDec]);

  // Asset allocation donut data
  const assetDonutData = useMemo(() => {
    if (!report?.assets) return [];
    return report.assets
      .filter((a) => new Decimal(a.balance || '0').gt(0))
      .map((a, idx) => ({
        id: a.accountId,
        name: a.accountName,
        type: a.type,
        value: new Decimal(a.balance || '0').toNumber(),
        color: ASSET_PALETTE[idx % ASSET_PALETTE.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [report]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1080, margin: '0 auto', width: '100%' }}>
      {/* ── Top Control Bar (Hidden from Print) ── */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '10px 16px',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(208, 174, 146, 0.4)',
          boxShadow: '0 1px 3px rgba(74, 58, 52, 0.04)',
        }}
      >
        {/* Left: Connected Segmented Controls & Date Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(235, 215, 190, 0.2)',
              border: '1px solid rgba(208, 174, 146, 0.4)',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            <Calendar size={14} style={{ color: 'var(--brown-600)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown-700)' }}>As of:</span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                color: 'var(--brown-900)',
                outline: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(235, 215, 190, 0.3)',
              padding: 3,
              borderRadius: 8,
              border: '1px solid rgba(208, 174, 146, 0.3)',
              gap: 2,
            }}
          >
            {[
              { id: 'today', label: 'Today', date: '2026-09-06' },
              { id: 'month-end', label: 'This Month', date: '2026-09-30' },
              { id: 'q1', label: 'Q1 Close', date: '2026-06-30' },
              { id: 'fy26', label: 'FY 2026–27 Close', date: '2026-11-30' },
            ].map((preset) => {
              const isActive = asOfDate === preset.date;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setAsOfDate(preset.date)}
                  style={{
                    background: isActive ? 'var(--surface)' : 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    padding: '5px 12px',
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'var(--brown-900)' : 'var(--brown-700)',
                    cursor: 'pointer',
                    boxShadow: isActive ? '0 1px 2px rgba(74, 58, 52, 0.08)' : 'none',
                    transition: 'all 120ms ease',
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: View Switcher, Refresh & Print actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Visual Mode Selector */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(235, 215, 190, 0.3)',
              padding: 3,
              borderRadius: 8,
              border: '1px solid rgba(208, 174, 146, 0.3)',
              gap: 2,
            }}
          >
            <button
              type="button"
              onClick={() => setActiveViewMode('both')}
              style={{
                background: activeViewMode === 'both' ? 'var(--surface)' : 'transparent',
                border: 'none',
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: 11,
                fontWeight: 600,
                color: activeViewMode === 'both' ? 'var(--brown-900)' : 'var(--brown-600)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Layers size={13} />
              <span>Combined</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveViewMode('charts')}
              style={{
                background: activeViewMode === 'charts' ? 'var(--surface)' : 'transparent',
                border: 'none',
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: 11,
                fontWeight: 600,
                color: activeViewMode === 'charts' ? 'var(--brown-900)' : 'var(--brown-600)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <BarChart3 size={13} />
              <span>Visual Charts</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveViewMode('statement')}
              style={{
                background: activeViewMode === 'statement' ? 'var(--surface)' : 'transparent',
                border: 'none',
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: 11,
                fontWeight: 600,
                color: activeViewMode === 'statement' ? 'var(--brown-900)' : 'var(--brown-600)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>Statement</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--brown-700)',
              background: 'transparent',
              border: '1px solid rgba(208, 174, 146, 0.4)',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(235, 215, 190, 0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Refresh statement"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 600,
              color: '#FFFFFF',
              background: 'var(--brown-900)',
              border: '1px solid var(--brown-900)',
              borderRadius: 8,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(74, 58, 52, 0.15)',
              transition: 'all 120ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brown-800)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--brown-900)')}
          >
            <Printer size={13} />
            <span>Print Balance Sheet</span>
          </button>
        </div>
      </div>

      {/* ── Executive Balance & Solvency Visual Hub ── */}
      {(activeViewMode === 'charts' || activeViewMode === 'both') && (
        <div
          className="no-print"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: 'var(--surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(208, 174, 146, 0.4)',
            padding: '24px 28px',
            boxShadow: '0 1px 4px rgba(74, 58, 52, 0.04)',
          }}
        >
          {/* Solvency & Accounting Equation Summary Ribbon */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 14,
              paddingBottom: 18,
              borderBottom: '1px solid rgba(208, 174, 146, 0.3)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brown-500)' }}>
                Total Assets (A)
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--posted)' }}>
                ₹{totalAssetsDec.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              </span>
              <span style={{ fontSize: 11, color: 'var(--brown-600)' }}>All economic resources owned</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brown-500)' }}>
                Total Liabilities (B)
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: '#9E4A38' }}>
                ₹{totalLiabDec.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              </span>
              <span style={{ fontSize: 11, color: 'var(--brown-600)' }}>External vendor claims</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brown-500)' }}>
                Net Worth / Equity (C)
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--brown-900)' }}>
                ₹{totalEquityDec.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              </span>
              <span style={{ fontSize: 11, color: 'var(--brown-600)' }}>Capital + Retained earnings</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brown-500)' }}>
                Equilibrium Equation
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    background: isBalanced ? 'rgba(95, 112, 82, 0.12)' : 'rgba(158, 74, 56, 0.12)',
                    color: isBalanced ? 'var(--posted)' : '#9E4A38',
                  }}
                >
                  <ShieldCheck size={15} />
                  {isBalanced ? 'BALANCED (A = B + C)' : 'OUT OF EQUILIBRIUM'}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--brown-600)' }}>Double-entry invariant verified</span>
            </div>
          </div>

          {/* Interactive Visual Graphs Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 24, paddingTop: 6 }}>
            {/* Chart 1: The Accounting Balance Bar */}
            <div
              style={{
                background: 'rgba(235, 215, 190, 0.1)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(208, 174, 146, 0.35)',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart3 size={16} style={{ color: 'var(--brown-700)' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brown-900)' }}>
                    Capital Equation Equilibrium
                  </span>
                </div>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--brown-600)' }}>
                  Assets vs Total Obligations
                </span>
              </div>

              <div style={{ height: 230, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={equationChartData} margin={{ top: 12, right: 12, left: -10, bottom: 4 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#77574A', fontSize: 11, fontFamily: 'var(--font-body)' }}
                      axisLine={{ stroke: 'rgba(208, 174, 146, 0.5)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={formatDisplayINR}
                      tick={{ fill: '#77574A', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Balance']}
                      contentStyle={{
                        background: '#FFF',
                        borderRadius: 8,
                        border: '1px solid rgba(208, 174, 146, 0.5)',
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                      }}
                    />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                      {equationChartData.map((entry, index) => (
                        <Cell key={`eq-cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Asset Composition Donut */}
            <div
              style={{
                background: 'rgba(235, 215, 190, 0.1)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(208, 174, 146, 0.35)',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PieIcon size={16} style={{ color: 'var(--brown-700)' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brown-900)' }}>
                    Asset Capital Composition
                  </span>
                </div>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--brown-600)' }}>
                  Click slice to inspect ledger
                </span>
              </div>

              {assetDonutData.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', height: 230 }}>
                  <div style={{ width: '55%', height: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={assetDonutData}
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                          onClick={(data) => {
                            if (data?.id) setSelectedDrillAccount({ id: data.id, name: data.name });
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          {assetDonutData.map((entry, idx) => (
                            <Cell key={`asset-pie-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Balance']}
                          contentStyle={{
                            background: '#FFF',
                            borderRadius: 8,
                            border: '1px solid rgba(208, 174, 146, 0.5)',
                            fontSize: 12,
                            fontFamily: 'var(--font-mono)',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Slices Legend */}
                  <div
                    style={{
                      width: '45%',
                      maxHeight: 210,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      paddingLeft: 12,
                    }}
                  >
                    {assetDonutData.slice(0, 6).map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedDrillAccount({ id: item.id, name: item.name })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          fontSize: 11,
                          cursor: 'pointer',
                          padding: '3px 6px',
                          borderRadius: 4,
                          background: 'rgba(255,255,255,0.6)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--brown-800)', fontWeight: 500 }}>
                            {item.name}
                          </span>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brown-900)', flexShrink: 0 }}>
                          {formatDisplayINR(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ height: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brown-500)', fontSize: 13 }}>
                  No assets recorded as of this date.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Financial Statement Document Sheet (Pure Printable Document) ── */}
      {(activeViewMode === 'statement' || activeViewMode === 'both') && (
      <div
        className="printable-sheet print-avoid-break"
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 1px 4px rgba(74, 58, 52, 0.05)',
          border: '1px solid rgba(208, 174, 146, 0.4)',
          padding: '32px 36px',
        }}
      >
        {/* Document Formal Header */}
        <div
          style={{
            textAlign: 'center',
            borderBottom: '1.5px solid var(--brown-900)',
            paddingBottom: 14,
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--brown-500)',
              textTransform: 'uppercase',
            }}
          >
            Urban Furniture Private Limited
          </span>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--brown-900)',
              margin: '4px 0 2px 0',
            }}
          >
            Balance Sheet
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: 'var(--brown-700)',
              margin: 0,
            }}
          >
            As of {asOfDate}
          </p>
          <span
            style={{
              fontSize: 10,
              fontStyle: 'italic',
              color: 'var(--brown-500)',
              marginTop: 2,
              display: 'inline-block',
            }}
          >
            (All amounts in INR ₹ · Double-entry financial statement)
          </span>
        </div>

        {/* ── 2-Column Side-by-Side Statement ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'stretch' }}>
          {/* ── LEFT COLUMN: ASSETS ── */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: '1px solid rgba(208, 174, 146, 0.25)', paddingRight: 20 }}>
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                  borderBottom: '1px solid var(--brown-900)',
                  marginBottom: 8,
                }}
              >
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--brown-900)',
                    margin: 0,
                  }}
                >
                  Assets
                </h2>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--brown-500)', textTransform: 'uppercase' }}>
                  Amount (₹)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {report?.assets && report.assets.length > 0 ? (
                  report.assets.map((acc) => (
                    <div
                      key={acc.accountId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 4px',
                        borderBottom: '1px solid rgba(208, 174, 146, 0.15)',
                        fontSize: 13,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedDrillAccount({
                            id: acc.accountId,
                            name: acc.accountName,
                          })
                        }
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--brown-900)',
                          cursor: 'pointer',
                          fontWeight: 500,
                          padding: 0,
                          textAlign: 'left',
                          fontSize: 13,
                        }}
                        title="Click to drill down into ledger entries"
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {acc.accountName}
                      </button>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--brown-900)' }}>
                        <Money value={acc.balance} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '8px', fontSize: 12, color: 'var(--brown-500)', fontStyle: 'italic' }}>
                    No asset accounts recorded.
                  </div>
                )}
              </div>
            </div>

            {/* Total Assets */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 4px',
                borderTop: '1px solid var(--brown-900)',
                borderBottom: '3px double var(--brown-900)',
                fontWeight: 700,
                fontSize: 13,
                marginTop: 20,
              }}
            >
              <span style={{ color: 'var(--brown-900)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Assets
              </span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--brown-900)' }}>
                <Money value={report?.totalAssets || '0.00'} />
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: LIABILITIES & EQUITY ── */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              {/* Liabilities Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                  borderBottom: '1px solid var(--brown-900)',
                  marginBottom: 8,
                }}
              >
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--brown-900)',
                    margin: 0,
                  }}
                >
                  Liabilities & Equity
                </h2>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--brown-500)', textTransform: 'uppercase' }}>
                  Amount (₹)
                </span>
              </div>

              {/* 1. Liabilities List */}
              <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brown-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                  Current Liabilities
                </span>
                {report?.liabilities && report.liabilities.length > 0 ? (
                  report.liabilities.map((acc) => (
                    <div
                      key={acc.accountId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 4px',
                        borderBottom: '1px solid rgba(208, 174, 146, 0.15)',
                        fontSize: 13,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedDrillAccount({
                            id: acc.accountId,
                            name: acc.accountName,
                          })
                        }
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--brown-900)',
                          cursor: 'pointer',
                          fontWeight: 500,
                          padding: 0,
                          textAlign: 'left',
                          fontSize: 13,
                        }}
                        title="Click to drill down into ledger entries"
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {acc.accountName}
                      </button>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--brown-900)' }}>
                        <Money value={acc.balance} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '4px', fontSize: 12, color: 'var(--brown-500)', fontStyle: 'italic' }}>
                    No liabilities recorded.
                  </div>
                )}

                {/* Subtotal Liabilities */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 4px',
                    borderTop: '1px solid var(--brown-300)',
                    fontWeight: 600,
                    fontSize: 12,
                    color: 'var(--brown-700)',
                  }}
                >
                  <span style={{ textTransform: 'uppercase' }}>Subtotal Liabilities</span>
                  <div style={{ fontFamily: 'var(--font-mono)' }}>
                    <Money value={report?.totalLiabilities || '0.00'} />
                  </div>
                </div>
              </div>

              {/* 2. Capital & Equity List */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brown-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                  Capital & Reserves
                </span>
                {report?.capital && report.capital.length > 0 ? (
                  report.capital.map((acc) => (
                    <div
                      key={acc.accountId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 4px',
                        borderBottom: '1px solid rgba(208, 174, 146, 0.15)',
                        fontSize: 13,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedDrillAccount({
                            id: acc.accountId,
                            name: acc.accountName,
                          })
                        }
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--brown-900)',
                          cursor: 'pointer',
                          fontWeight: 500,
                          padding: 0,
                          textAlign: 'left',
                          fontSize: 13,
                        }}
                        title="Click to drill down into ledger entries"
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {acc.accountName}
                      </button>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--brown-900)' }}>
                        <Money value={acc.balance} />
                      </div>
                    </div>
                  ))
                ) : null}

                {/* Flowed Current Period Profit */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 4px',
                    borderBottom: '1px solid rgba(208, 174, 146, 0.15)',
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: 'var(--brown-900)' }}>
                    Current Period Profit (P&L)
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--brown-900)' }}>
                    <Money value={report?.currentPeriodProfit || '0.00'} />
                  </div>
                </div>

                {/* Subtotal Equity */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 4px',
                    borderTop: '1px solid var(--brown-300)',
                    fontWeight: 600,
                    fontSize: 12,
                    color: 'var(--brown-700)',
                  }}
                >
                  <span style={{ textTransform: 'uppercase' }}>Subtotal Equity</span>
                  <div style={{ fontFamily: 'var(--font-mono)' }}>
                    <Money value={report?.totalEquity || '0.00'} />
                  </div>
                </div>
              </div>
            </div>

            {/* Total Liabilities & Equity */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 4px',
                borderTop: '1px solid var(--brown-900)',
                borderBottom: '3px double var(--brown-900)',
                fontWeight: 700,
                fontSize: 13,
                marginTop: 20,
              }}
            >
              <span style={{ color: 'var(--brown-900)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Liabilities & Equity
              </span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--brown-900)' }}>
                <Money value={report?.totalEquity && report?.totalLiabilities ? new Decimal(report.totalLiabilities).plus(report.totalEquity).toFixed(2) : (report?.totalAssets || '0.00')} />
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── 4-Level Drilldown Modal (Hidden from Print) ── */}
      {selectedDrillAccount && (
        <LedgerDrilldownModal
          accountId={selectedDrillAccount.id}
          accountName={selectedDrillAccount.name}
          asOf={asOfDate}
          onClose={() => setSelectedDrillAccount(null)}
        />
      )}
    </div>
  );
}
