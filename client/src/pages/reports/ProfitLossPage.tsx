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
import { ReportsApi, ProfitLossReport } from '../../api/reports.api';
import Money from '../../components/ui/Money';
import { formatYAxisINR } from '../../lib/money';
import LedgerDrilldownModal from './LedgerDrilldownModal';
import {
  Printer,
  Calendar,
  RefreshCw,
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  TrendingDown,
  Layers,
} from 'lucide-react';

const EXPENSE_PALETTE = [
  '#77574A',
  '#9E4A38',
  '#C08A3E',
  '#A8836C',
  '#5F7052',
  '#4A3A34',
  '#D0AE92',
  '#8C6D58',
];

const INCOME_PALETTE = [
  '#5F7052', // Olive
  '#4A3A34', // Walnut
  '#C08A3E', // Amber
  '#77574A', // Walnut mid
  '#A8836C', // Sand brown
  '#9E4A38', // Terracotta
  '#D0AE92',
];

export default function ProfitLossPage() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState<string>('2026-09-01');
  const [toDate, setToDate] = useState<string>('2026-09-30');
  const [selectedDrillAccount, setSelectedDrillAccount] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [activeViewMode, setActiveViewMode] = useState<'both' | 'charts' | 'statement'>('both');
  const [pnlCompositionMode, setPnlCompositionMode] = useState<'expenses' | 'income'>('expenses');

  const {
    data: report,
    isLoading,
    refetch,
  } = useQuery<ProfitLossReport>({
    queryKey: ['profit-loss', fromDate, toDate],
    queryFn: () => ReportsApi.getProfitAndLoss(fromDate, toDate),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const handlePrint = () => {
    window.print();
  };

  const isNetProfitPositive = report
    ? new Decimal(report.netProfit || '0').greaterThanOrEqualTo(0)
    : true;

  // Chart aggregates computed deterministically with Decimal.js
  const totalIncomeDec = useMemo(() => new Decimal(report?.totalIncome || '0'), [report]);
  const totalExpenseDec = useMemo(() => new Decimal(report?.totalExpenses || '0'), [report]);
  const netProfitDec = useMemo(() => new Decimal(report?.netProfit || '0'), [report]);

  const netMarginPct = useMemo(() => {
    if (totalIncomeDec.isZero()) return '0.0';
    return netProfitDec.div(totalIncomeDec).times(100).toFixed(1);
  }, [totalIncomeDec, netProfitDec]);

  // Waterfall / Bridge Bar Data
  const bridgeChartData = useMemo(() => {
    return [
      {
        name: 'Gross Revenue',
        amount: totalIncomeDec.toNumber(),
        fill: '#5F7052', // Olive
      },
      {
        name: 'Total Expense',
        amount: totalExpenseDec.toNumber(),
        fill: '#9E4A38', // Terracotta
      },
      {
        name: netProfitDec.gte(0) ? 'Net Profit' : 'Net Loss',
        amount: Math.abs(netProfitDec.toNumber()),
        fill: netProfitDec.gte(0) ? '#5F7052' : '#9E4A38',
      },
    ];
  }, [totalIncomeDec, totalExpenseDec, netProfitDec]);

  // Expense distribution donut data
  const expenseDonutData = useMemo(() => {
    if (!report?.expenses) return [];
    return report.expenses
      .filter((e) => new Decimal(e.total || '0').gt(0))
      .map((e, idx) => ({
        id: e.accountId,
        name: e.accountName,
        value: new Decimal(e.total || '0').toNumber(),
        color: EXPENSE_PALETTE[idx % EXPENSE_PALETTE.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [report]);

  // Income / Revenue distribution donut data (Mirroring the Income section of the statement)
  const incomeDonutData = useMemo(() => {
    if (!report?.income) return [];
    return report.income
      .filter((i) => new Decimal(i.total || '0').gt(0))
      .map((i, idx) => ({
        id: i.accountId,
        name: i.accountName,
        value: new Decimal(i.total || '0').toNumber(),
        color: INCOME_PALETTE[idx % INCOME_PALETTE.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [report]);

  const activePnlData = pnlCompositionMode === 'expenses' ? expenseDonutData : incomeDonutData;
  const activePnlTotal = pnlCompositionMode === 'expenses' ? totalExpenseDec.toNumber() : totalIncomeDec.toNumber();

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
        {/* Date Filter & Presets */}
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
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown-700)' }}>Period:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
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
            <span style={{ color: 'var(--brown-400)', fontSize: 12, fontWeight: 500 }}>to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
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
              {
                id: 'today',
                label: 'Today',
                from: '2026-09-06',
                to: '2026-09-06',
              },
              {
                id: 'month',
                label: 'This Month',
                from: '2026-09-01',
                to: '2026-09-30',
              },
              {
                id: 'quarter',
                label: 'This Quarter',
                from: '2026-07-01',
                to: '2026-09-30',
              },
              {
                id: 'fy26',
                label: 'FY 2026–27',
                from: '2026-04-01',
                to: '2027-03-31',
              },
            ].map((preset) => {
              const isActive = fromDate === preset.from && toDate === preset.to;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setFromDate(preset.from);
                    setToDate(preset.to);
                  }}
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

        {/* View Switcher & Action Buttons */}
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
            <span>Print Profit & Loss</span>
          </button>
        </div>
      </div>

      {/* ── Executive Visual Analytics Hub ── */}
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
          {/* Financial Summary Ribbon */}
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
                Total Revenue
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--posted)' }}>
                ₹{totalIncomeDec.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              </span>
              <span style={{ fontSize: 11, color: 'var(--brown-600)' }}>Invoiced gross turnover</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brown-500)' }}>
                Operating Expenses
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: '#9E4A38' }}>
                ₹{totalExpenseDec.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              </span>
              <span style={{ fontSize: 11, color: 'var(--brown-600)' }}>Total posted overheads</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brown-500)' }}>
                Net Operating Result
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 22,
                  fontWeight: 700,
                  color: netProfitDec.gte(0) ? 'var(--posted)' : '#9E4A38',
                }}
              >
                ₹{netProfitDec.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              </span>
              <span style={{ fontSize: 11, color: 'var(--brown-600)' }}>
                {netProfitDec.gte(0) ? 'Profitable operation' : 'Operating loss period'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brown-500)' }}>
                Net Profit Margin
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 22,
                    fontWeight: 700,
                    color: netProfitDec.gte(0) ? 'var(--posted)' : '#9E4A38',
                  }}
                >
                  {netMarginPct}%
                </span>
                {netProfitDec.gte(0) ? (
                  <TrendingUp size={18} style={{ color: 'var(--posted)' }} />
                ) : (
                  <TrendingDown size={18} style={{ color: '#9E4A38' }} />
                )}
              </div>
              <span style={{ fontSize: 11, color: 'var(--brown-600)' }}>Net margin on gross sales</span>
            </div>
          </div>

          {/* Interactive Visual Graphs Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 24, paddingTop: 6 }}>
            {/* Chart 1: Profitability Bridge & Margins */}
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
                    Profitability Flow & Margin
                  </span>
                </div>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--brown-600)' }}>
                  Revenue vs Outflow
                </span>
              </div>

              <div style={{ height: 230, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bridgeChartData} margin={{ top: 12, right: 12, left: -10, bottom: 4 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#77574A', fontSize: 11, fontFamily: 'var(--font-body)' }}
                      axisLine={{ stroke: 'rgba(208, 174, 146, 0.5)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={formatYAxisINR}
                      width={56}
                      tick={{ fill: '#77574A', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Amount']}
                      contentStyle={{
                        background: '#FFF',
                        borderRadius: 8,
                        border: '1px solid rgba(208, 174, 146, 0.5)',
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                      }}
                    />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                      {bridgeChartData.map((entry, index) => (
                        <Cell key={`bridge-cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Operating Expense & Income Allocation Donut */}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PieIcon size={16} style={{ color: 'var(--brown-700)' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brown-900)' }}>
                    {pnlCompositionMode === 'expenses' ? 'Expense Allocation by Category' : 'Revenue Streams by Category'}
                  </span>
                </div>

                {/* Segmented Switcher for Expenses vs Income */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: 'rgba(235, 215, 190, 0.35)',
                    padding: 2,
                    borderRadius: 6,
                    border: '1px solid rgba(208, 174, 146, 0.3)',
                    gap: 2,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPnlCompositionMode('expenses')}
                    style={{
                      background: pnlCompositionMode === 'expenses' ? 'var(--surface)' : 'transparent',
                      border: 'none',
                      borderRadius: 5,
                      padding: '3px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: pnlCompositionMode === 'expenses' ? 'var(--brown-900)' : 'var(--brown-600)',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                    }}
                  >
                    Expenses ({expenseDonutData.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPnlCompositionMode('income')}
                    style={{
                      background: pnlCompositionMode === 'income' ? 'var(--surface)' : 'transparent',
                      border: 'none',
                      borderRadius: 5,
                      padding: '3px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: pnlCompositionMode === 'income' ? 'var(--brown-900)' : 'var(--brown-600)',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                    }}
                  >
                    Revenue Streams ({incomeDonutData.length})
                  </button>
                </div>
              </div>

              {activePnlData.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', height: 230 }}>
                  <div style={{ width: '48%', height: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={activePnlData}
                          innerRadius={52}
                          outerRadius={78}
                          paddingAngle={3}
                          dataKey="value"
                          onClick={(data) => {
                            if (data?.id) setSelectedDrillAccount({ id: data.id, name: data.name });
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          {activePnlData.map((entry, idx) => (
                            <Cell key={`pnl-comp-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Amount']}
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

                  {/* Slices Legend with EXACT Indian currency matching the statement below */}
                  <div
                    style={{
                      width: '52%',
                      maxHeight: 210,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      paddingLeft: 6,
                    }}
                  >
                    {activePnlData.map((item) => {
                      const pct = activePnlTotal > 0
                        ? ((item.value / activePnlTotal) * 100).toFixed(1)
                        : '0.0';
                      return (
                        <div
                          key={item.name}
                          onClick={() => setSelectedDrillAccount({ id: item.id, name: item.name })}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 6,
                            fontSize: 11,
                            cursor: 'pointer',
                            padding: '4px 7px',
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.7)',
                            border: '1px solid rgba(208, 174, 146, 0.25)',
                          }}
                          title="Click to inspect ledger entries"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--brown-800)', fontWeight: 600 }}>
                              {item.name}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brown-900)' }}>
                              ₹{item.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--brown-600)', background: 'rgba(235, 215, 190, 0.35)', padding: '1px 4px', borderRadius: 3, fontWeight: 600 }}>
                              {pct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ height: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brown-500)', fontSize: 13 }}>
                  No entries recorded for this category in this date range.
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
            marginBottom: 20,
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
            Profit and Loss
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: 'var(--brown-700)',
              margin: 0,
            }}
          >
            For the period from {fromDate} to {toDate}
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

        {/* ── Statement Content ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 1. Revenue & Operating Income */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 0',
                borderBottom: '1px solid var(--brown-900)',
                marginBottom: 6,
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
                I. Revenue & Operating Income
              </h2>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--brown-500)', textTransform: 'uppercase' }}>
                Amount (₹)
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {report?.income && report.income.length > 0 ? (
                report.income.map((acc) => (
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
                      <Money value={acc.total} />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '8px', fontSize: 12, color: 'var(--brown-500)', fontStyle: 'italic' }}>
                  No income entries recorded in this period.
                </div>
              )}

              {/* Subtotal: Total Income */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 4px',
                  borderTop: '1px solid var(--brown-400)',
                  borderBottom: '1px solid var(--brown-400)',
                  fontWeight: 700,
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                <span style={{ color: 'var(--brown-900)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  Total Revenue (A)
                </span>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--brown-900)' }}>
                  <Money value={report?.totalIncome || '0.00'} />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Cost of Goods & Operating Expenses */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 0',
                borderBottom: '1px solid var(--brown-900)',
                marginBottom: 6,
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
                II. Cost of Goods & Operating Expenses
              </h2>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--brown-500)', textTransform: 'uppercase' }}>
                Amount (₹)
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {report?.expenses && report.expenses.length > 0 ? (
                report.expenses.map((acc) => (
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
                      <Money value={acc.total} />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '8px', fontSize: 12, color: 'var(--brown-500)', fontStyle: 'italic' }}>
                  No expense entries recorded in this period.
                </div>
              )}

              {/* Subtotal: Total Expenses */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 4px',
                  borderTop: '1px solid var(--brown-400)',
                  borderBottom: '1px solid var(--brown-400)',
                  fontWeight: 700,
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                <span style={{ color: 'var(--brown-900)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  Total Expenses (B)
                </span>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--brown-900)' }}>
                  <Money value={report?.totalExpenses || '0.00'} />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Net Profit / (Loss) Bottom Accounting Line */}
          <div
            style={{
              padding: '10px 4px',
              borderTop: '1.5px solid var(--brown-900)',
              borderBottom: '3px double var(--brown-900)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--brown-900)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Net {isNetProfitPositive ? 'Profit' : 'Loss'} for the Period (A − B)
              </span>
            </div>

            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--brown-900)',
              }}
            >
              <Money value={report?.netProfit || '0.00'} />
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
          from={fromDate}
          to={toDate}
          onClose={() => setSelectedDrillAccount(null)}
        />
      )}
    </div>
  );
}
