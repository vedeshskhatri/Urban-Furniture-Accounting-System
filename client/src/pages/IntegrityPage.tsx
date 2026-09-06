import React, { useCallback, useMemo, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  Play,
  FileDown,
} from 'lucide-react';
import { IntegrityApi, IntegrityCheck, IntegrityReport } from '../api/integrity.api';

const CHECK_LABELS: Array<{ id: string; label: string }> = [
  { id: 'trial_balance', label: 'Trial balance (posted debits = posted credits)' },
  { id: 'balance_sheet_equation', label: 'Balance sheet equation (Assets = Liabilities + Equity)' },
  { id: 'net_profit_in_equity', label: 'Net profit carried into Balance Sheet equity' },
  { id: 'line_level_integrity', label: 'Line-level integrity (one of debit / credit per line)' },
  { id: 'unbalanced_posted_entries', label: 'Unbalanced posted entries' },
  { id: 'payment_over_allocation', label: 'Payment over-allocation' },
  { id: 'stock_reconciliation', label: 'Stock reconciliation (cached qty = Σ stock moves)' },
  { id: 'sequence_gaps', label: 'Document sequence gaps (Bill / Inv / P)' },
  { id: 'orphan_ledger_entries', label: 'Orphan ledger entries' },
  { id: 'analytic_coverage', label: 'Analytic coverage of confirmed lines' },
];

type RowState =
  | { phase: 'idle' }
  | { phase: 'running' }
  | { phase: 'done'; check: IntegrityCheck };

const STATUS_META = {
  pass: { color: 'var(--posted)', bg: 'var(--posted-bg)', Icon: CheckCircle2, word: 'PASS' },
  fail: { color: 'var(--danger)', bg: 'var(--danger-bg)', Icon: XCircle, word: 'FAIL' },
  unknown: { color: 'var(--brown-700)', bg: 'var(--brown-100)', Icon: HelpCircle, word: 'UNKNOWN' },
} as const;

export default function IntegrityPage() {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [running, setRunning] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const runAll = useCallback(async () => {
    setRunning(true);
    setError(null);
    setReport(null);
    setRevealed(0);
    try {
      const data = await IntegrityApi.runAll();
      // Stagger the reveal so each check visibly resolves — the checks have
      // already run server-side; this is presentation only.
      for (let i = 1; i <= data.checks.length; i++) {
        await new Promise((r) => setTimeout(r, 140));
        setRevealed(i);
      }
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run integrity checks');
    } finally {
      setRunning(false);
    }
  }, []);

  const downloadPdf = useCallback(async () => {
    setDownloading(true);
    try {
      await IntegrityApi.downloadPdf();
    } catch {
      setError('PDF export failed');
    } finally {
      setDownloading(false);
    }
  }, []);

  const rows: RowState[] = useMemo(() => {
    return CHECK_LABELS.map((meta, idx) => {
      if (report && idx < revealed) {
        const check = report.checks.find((c) => c.id === meta.id);
        if (check) return { phase: 'done', check };
      }
      if (running || (report && idx >= revealed)) return { phase: 'running' };
      return { phase: 'idle' };
    });
  }, [report, revealed, running]);

  const doneChecks = rows.filter((r): r is { phase: 'done'; check: IntegrityCheck } => r.phase === 'done');
  const passedCount = doneChecks.filter((r) => r.check.status === 'pass').length;
  const allDone = report !== null && !running && revealed >= CHECK_LABELS.length;

  const summaryColor = !allDone
    ? 'var(--brown-700)'
    : passedCount === CHECK_LABELS.length
    ? 'var(--posted)'
    : 'var(--danger)';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', padding: '24px 16px 64px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--posted-bg)',
              border: '1px solid var(--posted)',
              padding: '5px 14px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--posted)',
            }}
          >
            <ShieldCheck size={15} />
            <span>System Integrity Report</span>
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 32,
              lineHeight: '40px',
              color: 'var(--brown-900)',
              margin: '12px 0 4px',
            }}
          >
            Ten live checks against the database
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--brown-700)', margin: 0, maxWidth: 640 }}>
            The accounting equation, sequence integrity, stock reconciliation, payment over-allocation. Every row below is a
            real query — nothing is hardcoded.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
          <button
            type="button"
            onClick={runAll}
            disabled={running}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 22px',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              color: 'var(--cream)',
              background: 'var(--brown-900)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: running ? 'default' : 'pointer',
              opacity: running ? 0.7 : 1,
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            <span>{running ? 'Running checks…' : 'Run All Checks'}</span>
          </button>

          <button
            type="button"
            onClick={downloadPdf}
            disabled={!allDone || downloading}
            title={allDone ? 'Export PDF' : 'Run the checks first'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 18px',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              color: 'var(--brown-900)',
              background: 'var(--surface)',
              border: '1px solid var(--brown-300)',
              borderRadius: 'var(--radius-sm)',
              cursor: !allDone || downloading ? 'default' : 'pointer',
              opacity: !allDone || downloading ? 0.5 : 1,
            }}
          >
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Summary */}
      <div
        style={{
          marginTop: 24,
          display: 'flex',
          alignItems: 'baseline',
          gap: 16,
          flexWrap: 'wrap',
          background: 'var(--surface)',
          border: `2px solid ${summaryColor}`,
          borderRadius: 'var(--radius-md)',
          padding: '18px 24px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 40,
            lineHeight: '44px',
            color: summaryColor,
          }}
        >
          {allDone ? passedCount : doneChecks.length} / {CHECK_LABELS.length}
        </span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 600, color: 'var(--brown-900)' }}>
          {allDone
            ? passedCount === CHECK_LABELS.length
              ? 'checks passed'
              : `checks passed · ${CHECK_LABELS.length - passedCount} need attention`
            : running
            ? 'checks running…'
            : 'checks — not yet run'}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: 'var(--brown-700)',
          }}
        >
          {report ? `Run at ${new Date(report.runAt).toLocaleString()}` : '—'}
        </span>
      </div>

      {error && (
        <div
          style={{
            marginTop: 16,
            padding: '12px 16px',
            background: 'var(--danger-bg)',
            borderLeft: '4px solid var(--danger)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--danger)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {/* Rows */}
      <div style={{ marginTop: 20, border: '1px solid var(--brown-300)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {rows.map((row, idx) => (
          <IntegrityRow key={CHECK_LABELS[idx].id} index={idx} fallbackLabel={CHECK_LABELS[idx].label} row={row} />
        ))}
      </div>
    </div>
  );
}

function IntegrityRow({
  index,
  fallbackLabel,
  row,
}: {
  index: number;
  fallbackLabel: string;
  row: RowState;
}) {
  const zebra = index % 2 === 1;
  const baseStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '52px 1fr 200px 120px',
    alignItems: 'center',
    gap: 12,
    padding: '16px 20px',
    borderBottom: index < 9 ? '1px solid var(--brown-300)' : 'none',
    background: zebra ? 'rgba(249, 242, 228, 0.5)' : 'var(--surface)',
    transition: 'background 150ms ease-out',
  };

  const num = (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--brown-700)' }}>
      {String(index + 1).padStart(2, '0')}
    </span>
  );

  if (row.phase !== 'done') {
    const isRunning = row.phase === 'running';
    return (
      <div style={baseStyle}>
        {num}
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--brown-900)', fontWeight: 500 }}>
          {fallbackLabel}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--brown-300)' }}>—</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--brown-700)', fontSize: 12, fontWeight: 700 }}>
          {isRunning ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>RUNNING</span>
            </>
          ) : (
            <span style={{ color: 'var(--brown-300)' }}>IDLE</span>
          )}
        </span>
      </div>
    );
  }

  const { check } = row;
  const meta = STATUS_META[check.status];
  const { Icon } = meta;

  return (
    <div style={{ ...baseStyle, background: zebra ? 'rgba(249, 242, 228, 0.5)' : 'var(--surface)' }}>
      {num}
      <div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--brown-900)', fontWeight: 600 }}>
          {check.label}
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--brown-700)', marginTop: 3 }}>
          {check.detail}
        </div>
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
          fontSize: 16,
          fontWeight: 500,
          color: 'var(--brown-900)',
        }}
      >
        {check.value}
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '5px 12px',
          borderRadius: 999,
          background: meta.bg,
          color: meta.color,
          border: `1px solid ${meta.color}`,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.05em',
          justifySelf: 'start',
        }}
      >
        <Icon size={15} />
        {meta.word}
      </span>
    </div>
  );
}
