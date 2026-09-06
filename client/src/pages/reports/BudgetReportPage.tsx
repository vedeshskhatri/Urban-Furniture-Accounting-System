import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ReportsApi, BudgetReportData } from '../../api/reports.api';
import { BudgetApi, Budget } from '../../api/budget.api';
import Money from '../../components/ui/Money';
import {
  Printer,
  FileBarChart,
  RefreshCw,
  X,
  ArrowUpRight,
} from 'lucide-react';

const PALETTE = {
  achieved: '#5F7052', // --posted
  remaining: '#C08A3E', // --warning
};

export default function BudgetReportPage() {
  const [selectedBudgetId, setSelectedBudgetId] = useState<number>(1);
  const [drillDownLineId, setDrillDownLineId] = useState<number | null>(null);
  const [drillDownData, setDrillDownData] = useState<{ line: any; documents: any[] } | null>(null);
  const [isDrillDownLoading, setIsDrillDownLoading] = useState<boolean>(false);

  // Load all available budgets
  const { data: budgets = [], refetch: refetchBudgets } = useQuery<Budget[]>({
    queryKey: ['budgets-list'],
    queryFn: () => BudgetApi.getAll(),
  });

  // Default to first budget if none or missing
  useEffect(() => {
    if (budgets.length > 0 && !budgets.some((b) => b.id === selectedBudgetId)) {
      setSelectedBudgetId(budgets[0].id);
    }
  }, [budgets, selectedBudgetId]);

  // Load report data for selected budget
  const {
    data: report,
    isLoading,
    refetch: refetchReport,
  } = useQuery<BudgetReportData>({
    queryKey: ['budget-report', selectedBudgetId],
    queryFn: () => ReportsApi.getBudgetReport(selectedBudgetId),
    enabled: !!selectedBudgetId,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDrillDown = async (lineId: number) => {
    setDrillDownLineId(lineId);
    setIsDrillDownLoading(true);
    try {
      const data = await ReportsApi.getBudgetLineDocuments(lineId);
      setDrillDownData(data);
    } catch {
      setDrillDownData(null);
    } finally {
      setIsDrillDownLoading(false);
    }
  };

  const achievedNum = parseFloat(report?.totals?.achieved || '0');
  const toAchieveNum = parseFloat(report?.totals?.toAchieve || '0');
  const achievedPct = report?.totals?.achievedPct || 0;

  // Recharts pie data without awkward label lines
  const pieData = [
    {
      name: 'Achieved to Date',
      value: Math.max(0, achievedNum),
      color: PALETTE.achieved,
    },
    {
      name: 'Remaining',
      value: Math.max(0, toAchieveNum),
      color: PALETTE.remaining,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1000, margin: '0 auto', width: '100%' }}>
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
        {/* Budget Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            <FileBarChart size={14} style={{ color: 'var(--brown-600)' }} />
            <label htmlFor="budgetSelector" style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown-700)' }}>
              Analytical Budget:
            </label>
            <select
              id="budgetSelector"
              value={selectedBudgetId}
              onChange={(e) => setSelectedBudgetId(parseInt(e.target.value, 10))}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: 13,
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                color: 'var(--brown-900)',
                outline: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {budgets.length > 0 ? (
                budgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.status.toUpperCase()})
                  </option>
                ))
              ) : (
                <option value={1}>FY2026 Operations Budget</option>
              )}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => {
              refetchBudgets();
              refetchReport();
            }}
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
            title="Refresh report"
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
            <span>Print Budget Report</span>
          </button>
        </div>
      </div>

      {/* ── Financial Statement Document Sheet (Pure Printable Document) ── */}
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
            {report?.budgetName || 'Analytical Budget Performance Report'}
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: 'var(--brown-700)',
              margin: 0,
            }}
          >
            {report?.periodStart && report?.periodEnd
              ? `Period: ${String(report.periodStart).split('T')[0]} to ${String(report.periodEnd).split('T')[0]}`
              : 'Analytical Commitment & Achievement Tracking'}
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
            (All amounts in INR ₹ · Click any achieved amount to inspect source documents)
          </span>
        </div>

        {/* ── Summary KPI Strip ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              border: '1px solid rgba(208, 174, 146, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brown-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Committed Budget
            </span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--brown-900)', marginTop: 2 }}>
              <Money value={report?.totals?.committed || '0.00'} />
            </div>
          </div>

          <div
            style={{
              border: '1px solid rgba(208, 174, 146, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--posted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Achieved to Date
            </span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--posted)', marginTop: 2 }}>
              <Money value={report?.totals?.achieved || '0.00'} />
            </div>
          </div>

          <div
            style={{
              border: '1px solid rgba(208, 174, 146, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: toAchieveNum >= 0 ? 'var(--warning)' : 'var(--posted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {toAchieveNum >= 0 ? 'Remaining' : 'Target Surpassed'}
            </span>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 15,
                fontWeight: 700,
                color: toAchieveNum >= 0 ? 'var(--warning)' : 'var(--posted)',
                marginTop: 2,
              }}
            >
              <Money value={Math.abs(toAchieveNum).toFixed(2)} />
            </div>
          </div>

          <div
            style={{
              border: '1px solid rgba(208, 174, 146, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brown-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Progress Rate
            </span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--brown-900)', marginTop: 2 }}>
              {achievedPct.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* ── Visual Progress Breakdown (Hidden in print if needed or cleanly rendered) ── */}
        <div
          className="print-avoid-break"
          style={{
            display: 'grid',
            gridTemplateColumns: '180px 1fr',
            gap: 24,
            alignItems: 'center',
            border: '1px solid rgba(208, 174, 146, 0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '14px 18px',
            marginBottom: 20,
          }}
        >
          {/* Donut Chart with Center Metric */}
          <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={58}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, '']}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--brown-300)', borderRadius: 'var(--radius-sm)', fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
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
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--brown-900)' }}>
                {achievedPct.toFixed(0)}%
              </div>
              <div style={{ fontSize: 9, color: 'var(--brown-600)', textTransform: 'uppercase', fontWeight: 600 }}>
                Spent
              </div>
            </div>
          </div>

          {/* Per-Analytic Progress Meters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--brown-700)' }}>
              Analytic Account Progress Breakdown
            </span>
            {report?.lines && report.lines.length > 0 ? (
              report.lines.map((line) => {
                const pct = Math.min(100, Math.max(0, line.achievedPct || 0));
                return (
                  <div key={line.budgetLineId} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--brown-900)', fontWeight: 500 }}>
                        {line.analyticAccountName}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--brown-700)', fontSize: 11 }}>
                        <Money value={line.achievedAmount} /> / <Money value={line.committedAmount} /> ({(line.achievedPct || 0).toFixed(0)}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 4, background: 'rgba(208, 174, 146, 0.25)', borderRadius: 2, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: (line.achievedPct || 0) >= 100 ? 'var(--posted)' : 'var(--brown-700)',
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : null}
          </div>
        </div>

        {/* ── Detailed Table ── */}
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
              Analytic Budget Lines
            </h2>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(235, 215, 190, 0.15)', height: 32, borderBottom: '1px solid var(--brown-300)' }}>
                <th style={{ padding: '0 8px', fontSize: 10, fontWeight: 700, color: 'var(--brown-700)', textTransform: 'uppercase' }}>Analytic Account</th>
                <th style={{ padding: '0 8px', fontSize: 10, fontWeight: 700, color: 'var(--brown-700)', textTransform: 'uppercase', width: 80 }}>Type</th>
                <th style={{ padding: '0 8px', fontSize: 10, fontWeight: 700, color: 'var(--brown-700)', textTransform: 'uppercase', textAlign: 'right' }}>Committed</th>
                <th style={{ padding: '0 8px', fontSize: 10, fontWeight: 700, color: 'var(--brown-700)', textTransform: 'uppercase', textAlign: 'right' }}>Achieved</th>
                <th style={{ padding: '0 8px', fontSize: 10, fontWeight: 700, color: 'var(--brown-700)', textTransform: 'uppercase', textAlign: 'right' }}>%</th>
                <th style={{ padding: '0 8px', fontSize: 10, fontWeight: 700, color: 'var(--brown-700)', textTransform: 'uppercase', textAlign: 'right' }}>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {report?.lines && report.lines.length > 0 ? (
                report.lines.map((line) => (
                  <tr key={line.budgetLineId} style={{ height: 36, borderBottom: '1px solid rgba(208, 174, 146, 0.15)', fontSize: 13 }}>
                    <td style={{ padding: '0 8px', color: 'var(--brown-900)', fontWeight: 500 }}>
                      {line.analyticAccountName}
                    </td>
                    <td style={{ padding: '0 8px', fontSize: 11, color: 'var(--brown-600)', textTransform: 'capitalize' }}>
                      {line.analyticType}
                    </td>
                    <td style={{ padding: '0 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      <Money value={line.committedAmount} />
                    </td>
                    <td style={{ padding: '0 8px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => handleDrillDown(line.budgetLineId)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--brown-900)',
                          cursor: 'pointer',
                          fontWeight: 500,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 13,
                          padding: 0,
                        }}
                        title="Click to drill down into source documents"
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        <Money value={line.achievedAmount} />
                      </button>
                    </td>
                    <td style={{ padding: '0 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {(line.achievedPct || 0).toFixed(1)}%
                    </td>
                    <td style={{ padding: '0 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      <Money value={line.amountToAchieve} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: 16, textAlign: 'center', color: 'var(--brown-500)', fontSize: 12 }}>
                    No budget lines recorded.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr
                style={{
                  height: 38,
                  fontWeight: 700,
                  borderTop: '1px solid var(--brown-900)',
                  borderBottom: '3px double var(--brown-900)',
                }}
              >
                <td colSpan={2} style={{ padding: '0 8px', fontSize: 11, textTransform: 'uppercase', color: 'var(--brown-900)' }}>
                  Total
                </td>
                <td style={{ padding: '0 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                  <Money value={report?.totals?.committed || '0.00'} />
                </td>
                <td style={{ padding: '0 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                  <Money value={report?.totals?.achieved || '0.00'} />
                </td>
                <td style={{ padding: '0 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                  {(report?.totals?.achievedPct || 0).toFixed(1)}%
                </td>
                <td style={{ padding: '0 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                  <Money value={report?.totals?.toAchieve || '0.00'} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Drill-Down Document Inspection Modal (Hidden from Print) ── */}
      {drillDownLineId !== null && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(74, 58, 52, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={() => {
            setDrillDownLineId(null);
            setDrillDownData(null);
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              maxWidth: 800,
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--brown-300)',
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(208, 174, 146, 0.4)', paddingBottom: 14, marginBottom: 16 }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--brown-900)', margin: 0 }}>
                  Source Documents for {drillDownData?.line?.analytic_account_name || 'Budget Line'}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--brown-700)' }}>
                  {drillDownData?.line?.budget_name} ({drillDownData?.line?.analytic_type?.toUpperCase()})
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDrillDownLineId(null);
                  setDrillDownData(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--brown-700)',
                  padding: 4,
                  borderRadius: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            {isDrillDownLoading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--brown-700)', fontSize: 13 }}>
                Loading source documents...
              </div>
            ) : drillDownData?.documents && drillDownData.documents.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(249, 242, 228, 0.6)', height: 34, borderBottom: '1px solid var(--brown-300)' }}>
                    <th style={{ padding: '0 10px', fontSize: 11, fontWeight: 600, color: 'var(--brown-700)', textTransform: 'uppercase' }}>Document</th>
                    <th style={{ padding: '0 10px', fontSize: 11, fontWeight: 600, color: 'var(--brown-700)', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '0 10px', fontSize: 11, fontWeight: 600, color: 'var(--brown-700)', textTransform: 'uppercase' }}>Partner</th>
                    <th style={{ padding: '0 10px', fontSize: 11, fontWeight: 600, color: 'var(--brown-700)', textTransform: 'uppercase', textAlign: 'right' }}>Doc Total</th>
                    <th style={{ padding: '0 10px', fontSize: 11, fontWeight: 600, color: 'var(--brown-700)', textTransform: 'uppercase', textAlign: 'right' }}>Line Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {drillDownData.documents.map((doc: any, i: number) => (
                    <tr key={i} style={{ height: 38, borderBottom: '1px solid rgba(208, 174, 146, 0.2)' }}>
                      <td style={{ padding: '0 10px', fontWeight: 600, color: 'var(--brown-900)' }}>
                        {doc.number}
                      </td>
                      <td style={{ padding: '0 10px', color: 'var(--brown-700)' }}>
                        {doc.date ? String(doc.date).split('T')[0] : '—'}
                      </td>
                      <td style={{ padding: '0 10px', color: 'var(--brown-900)' }}>
                        {doc.partner_name || '—'}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        <Money value={doc.document_total || '0.00'} />
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'right', fontWeight: 700, color: 'var(--posted)', fontFamily: 'var(--font-mono)' }}>
                        <Money value={doc.line_amount || '0.00'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--brown-700)', fontSize: 13 }}>
                No posted documents found contributing to this budget line yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
