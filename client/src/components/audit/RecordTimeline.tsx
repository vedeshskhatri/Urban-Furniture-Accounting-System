import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, ChevronDown, ChevronRight } from 'lucide-react';
import { AuditApi, AuditRow } from '../../api/audit.api';
import { actionMeta, clockTime, diffFields, fmtValue, relativeTime } from '../../lib/audit';

/** Friendly recordType -> audit_log.table_name */
const TYPE_TO_TABLE: Record<string, string> = {
  contact: 'contacts',
  product: 'products',
  account: 'accounts',
  journal: 'journals',
  analytic: 'analytic_accounts',
  analytic_account: 'analytic_accounts',
  po: 'purchase_orders',
  purchase_order: 'purchase_orders',
  bill: 'vendor_bills',
  vendor_bill: 'vendor_bills',
  so: 'sales_orders',
  sales_order: 'sales_orders',
  invoice: 'customer_invoices',
  customer_invoice: 'customer_invoices',
  payment: 'payments',
  budget: 'budgets',
  journal_entry: 'journal_entries',
  je: 'journal_entries',
};

const RELATED_DOC = (row: AuditRow): { label: string; href?: string } | null => {
  const d = (row.after_data ?? {}) as Record<string, any>;
  if (row.table_name === 'payments' && d.number) return { label: String(d.number) };
  if (d.journalEntryId) return { label: `JE #${d.journalEntryId}`, href: `/account/journal-entries/${d.journalEntryId}` };
  if (d.revisedId) return { label: `→ Budget #${d.revisedId}`, href: `/account/budgets/${d.revisedId}` };
  if (d.number) return { label: String(d.number) };
  return null;
};

export default function RecordTimeline({
  recordType,
  recordId,
  compact = false,
}: {
  recordType: string;
  recordId?: number | string;
  compact?: boolean;
}) {
  const table = TYPE_TO_TABLE[recordType] ?? recordType;
  const id = typeof recordId === 'string' ? parseInt(recordId, 10) : recordId;
  const enabled = Boolean(id && !Number.isNaN(id));
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (rowId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(rowId) ? next.delete(rowId) : next.add(rowId);
      return next;
    });
  };

  const { data, isLoading } = useQuery<AuditRow[]>({
    queryKey: ['audit-timeline', table, id],
    queryFn: () => AuditApi.recordTimeline(table, id as number),
    enabled,
    refetchOnWindowFocus: false,
  });

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  void now;

  return (
    <section
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--brown-300)',
        borderRadius: 'var(--radius-md)',
        padding: compact ? '12px 14px' : '16px 18px',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <History size={15} color="var(--brown-700)" />
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--brown-900)',
            }}
          >
            Record Audit Trail
          </h3>
        </div>
        {data && data.length > 0 && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              background: 'var(--cream)',
              border: '1px solid var(--brown-300)',
              borderRadius: 999,
              padding: '2px 8px',
              color: 'var(--brown-700)',
            }}
          >
            {data.length} event{data.length === 1 ? '' : 's'}
          </span>
        )}
      </header>

      {!enabled || (data && data.length === 0) ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--brown-700)' }}>No activity recorded yet.</p>
      ) : isLoading ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--brown-700)' }}>Loading…</p>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative' }}>
          {(data ?? []).map((row, i) => {
            const meta = actionMeta(row.action);
            const Icon = meta.icon;
            const rel = RELATED_DOC(row);
            const last = i === (data?.length ?? 0) - 1;
            const changes = diffFields(row.before_data, row.after_data);
            const isOpen = expanded.has(row.id);

            return (
              <li key={row.id} style={{ display: 'flex', gap: 12, paddingBottom: last ? 0 : 16, position: 'relative' }}>
                {/* rail */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: 'var(--cream)',
                      border: `1px solid ${meta.color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={13} color={meta.color} />
                  </span>
                  {!last && <span style={{ flex: 1, width: 1, background: 'var(--brown-300)', marginTop: 2 }} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 13, color: 'var(--brown-900)' }}>{meta.label}</strong>
                    <span style={{ fontSize: 13, color: 'var(--brown-900)' }}>
                      {row.user_name || row.user_login || 'System'}
                    </span>
                    <span
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--brown-700)' }}
                      title={new Date(row.created_at).toLocaleString()}
                    >
                      {clockTime(row.created_at)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--brown-700)' }}>· {relativeTime(row.created_at)}</span>
                    {rel &&
                      (rel.href ? (
                        <a
                          href={rel.href}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--brown-700)', textDecoration: 'underline' }}
                        >
                          {rel.label}
                        </a>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--brown-700)' }}>{rel.label}</span>
                      ))}

                    {changes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggle(row.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--brown-700)',
                          fontSize: 11,
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                          marginLeft: 'auto',
                        }}
                      >
                        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {changes.filter((c) => c.changed).length > 0
                          ? `${changes.filter((c) => c.changed).length} changed`
                          : 'Snapshot'}
                      </button>
                    )}
                  </div>

                  {isOpen && changes.length > 0 && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--cream)',
                        border: '1px solid var(--brown-300)',
                        fontSize: 11,
                      }}
                    >
                      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                        <tbody>
                          {changes.slice(0, 10).map((c) => (
                            <tr key={c.key} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                              <td style={{ padding: '3px 6px', fontFamily: 'var(--font-mono)', color: 'var(--brown-900)' }}>{c.key}</td>
                              <td style={{ padding: '3px 6px', fontFamily: 'var(--font-mono)', color: 'var(--brown-700)' }}>{fmtValue(c.before)}</td>
                              <td style={{ padding: '3px 6px', fontFamily: 'var(--font-mono)', color: c.changed ? 'var(--posted)' : 'var(--brown-700)', fontWeight: c.changed ? 600 : 400 }}>
                                {fmtValue(c.after)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
