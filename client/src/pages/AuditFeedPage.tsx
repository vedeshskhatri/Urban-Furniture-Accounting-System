import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { AuditApi, AuditRow } from '../api/audit.api';
import { actionMeta, clockTime, diffFields, fmtValue, relativeTime, tableLabel } from '../lib/audit';

const PAGE = 30;

const selectStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  padding: '7px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--brown-300)',
  background: 'var(--surface)',
  color: 'var(--brown-900)',
};

export default function AuditFeedPage() {
  const [table, setTable] = useState('');
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data: facets } = useQuery({
    queryKey: ['audit-facets'],
    queryFn: AuditApi.facets,
    refetchOnWindowFocus: false,
  });

  const filters = useMemo(
    () => ({
      table: table || undefined,
      action: action || undefined,
      userId: userId ? Number(userId) : undefined,
      from: from || undefined,
      to: to ? `${to}T23:59:59` : undefined,
    }),
    [table, action, userId, from, to]
  );

  // Reset the page whenever a filter changes.
  useEffect(() => {
    setRows([]);
    setOffset(0);
    setExpanded(new Set());
  }, [filters]);

  const { data, isFetching } = useQuery({
    queryKey: ['audit-feed', filters, offset],
    queryFn: () => AuditApi.feed({ ...filters, limit: PAGE, offset }),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!data) return;
    setRows((prev) => (offset === 0 ? data.rows : [...prev, ...data.rows]));
  }, [data, offset]);

  const total = data?.total ?? 0;
  const loadMore = useCallback(() => setOffset((o) => o + PAGE), []);
  const toggle = (id: number) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', padding: '24px 16px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <ScrollText size={20} color="var(--brown-700)" />
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 28,
            color: 'var(--brown-900)',
            margin: 0,
          }}
        >
          Audit Log & Chatter Feed
        </h1>
      </div>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--brown-700)', margin: '0 0 20px' }}>
        Every state change in the system: who did what, to which record, and when.
      </p>

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          background: 'var(--surface)',
          border: '1px solid var(--brown-300)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          marginBottom: 16,
        }}
      >
        <Filter size={15} color="var(--brown-700)" />
        <select style={selectStyle} value={table} onChange={(e) => setTable(e.target.value)}>
          <option value="">All records</option>
          {(facets?.tables ?? []).map((t) => (
            <option key={t} value={t}>
              {tableLabel(t)}
            </option>
          ))}
        </select>
        <select style={selectStyle} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          {(facets?.actions ?? []).map((a) => (
            <option key={a} value={a}>
              {actionMeta(a).label}
            </option>
          ))}
        </select>
        <select style={selectStyle} value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">All users</option>
          {(facets?.users ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <label style={{ fontSize: 12, color: 'var(--brown-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
          From
          <input type="date" style={selectStyle} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--brown-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
          To
          <input type="date" style={selectStyle} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {(table || action || userId || from || to) && (
          <button
            type="button"
            onClick={() => {
              setTable('');
              setAction('');
              setUserId('');
              setFrom('');
              setTo('');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--brown-700)',
              fontSize: 12,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--brown-700)', fontFamily: 'var(--font-mono)' }}>
          {total} event{total === 1 ? '' : 's'}
        </span>
      </div>

      {/* Timeline */}
      <div style={{ border: '1px solid var(--brown-300)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--surface)' }}>
        {rows.length === 0 && !isFetching && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--brown-700)', fontSize: 14 }}>No audit events match these filters.</div>
        )}
        {rows.map((row, i) => {
          const meta = actionMeta(row.action);
          const Icon = meta.icon;
          const isOpen = expanded.has(row.id);
          const changes = diffFields(row.before_data, row.after_data);
          return (
            <div key={row.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--brown-300)' }}>
              <button
                type="button"
                onClick={() => toggle(row.id)}
                style={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: i % 2 ? 'rgba(249,242,228,0.5)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-body)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brown-100)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 ? 'rgba(249,242,228,0.5)' : 'transparent')}
              >
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
                  }}
                >
                  <Icon size={13} color={meta.color} />
                </span>
                <span style={{ fontSize: 13, color: 'var(--brown-900)', minWidth: 0 }}>
                  <strong>{row.user_name || row.user_login || 'System'}</strong> {meta.verb}{' '}
                  <strong>
                    {tableLabel(row.table_name)} #{row.record_id}
                  </strong>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--brown-700)', whiteSpace: 'nowrap' }}
                    title={new Date(row.created_at).toLocaleString()}
                  >
                    {relativeTime(row.created_at)}
                  </span>
                  {isOpen ? <ChevronDown size={15} color="var(--brown-700)" /> : <ChevronRight size={15} color="var(--brown-700)" />}
                </span>
              </button>

              {isOpen && (
                <div style={{ padding: '4px 16px 16px 56px', background: i % 2 ? 'rgba(249,242,228,0.5)' : 'transparent' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--brown-700)', marginBottom: 8 }}>
                    {new Date(row.created_at).toLocaleString()} · {clockTime(row.created_at)}
                  </div>
                  {changes.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--brown-700)' }}>No field-level detail recorded.</div>
                  ) : (
                    <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%', maxWidth: 640 }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: 'var(--brown-700)' }}>
                          <th style={{ padding: '4px 8px', fontWeight: 600 }}>Field</th>
                          <th style={{ padding: '4px 8px', fontWeight: 600 }}>Before</th>
                          <th style={{ padding: '4px 8px', fontWeight: 600 }}>After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {changes.map((c) => (
                          <tr
                            key={c.key}
                            style={{
                              background: c.changed ? 'var(--warning-bg)' : 'transparent',
                              borderTop: '1px solid var(--brown-300)',
                            }}
                          >
                            <td style={{ padding: '4px 8px', fontFamily: 'var(--font-mono)', color: 'var(--brown-900)' }}>{c.key}</td>
                            <td style={{ padding: '4px 8px', fontFamily: 'var(--font-mono)', color: 'var(--brown-700)' }}>{fmtValue(c.before)}</td>
                            <td
                              style={{
                                padding: '4px 8px',
                                fontFamily: 'var(--font-mono)',
                                color: c.changed ? 'var(--brown-900)' : 'var(--brown-700)',
                                fontWeight: c.changed ? 600 : 400,
                              }}
                            >
                              {fmtValue(c.after)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {rows.length < total && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            type="button"
            onClick={loadMore}
            disabled={isFetching}
            style={{
              padding: '9px 20px',
              fontSize: 13,
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              color: 'var(--brown-900)',
              background: 'var(--surface)',
              border: '1px solid var(--brown-300)',
              borderRadius: 'var(--radius-sm)',
              cursor: isFetching ? 'default' : 'pointer',
            }}
          >
            {isFetching ? 'Loading…' : `Load more (${rows.length} / ${total})`}
          </button>
        </div>
      )}
    </div>
  );
}
