import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ScrollText,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  Download,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  FileCheck2,
  Calendar,
  Layers,
  Check,
  ChevronsUpDown,
} from 'lucide-react';
import { AuditApi, AuditRow } from '../api/audit.api';
import {
  actionMeta,
  clockTime,
  diffFields,
  fmtValue,
  recordLink,
  relativeTime,
  tableLabel,
  AuditCategory,
  CATEGORY_TABLES,
} from '../lib/audit';

const PAGE = 40;

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
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTable = searchParams.get('table') || '';
  const initialRecordId = searchParams.get('recordId') || '';

  const [category, setCategory] = useState<AuditCategory>('all');
  const [table, setTable] = useState(initialTable);
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [isLive, setIsLive] = useState(false);

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: facets, refetch: refetchFacets } = useQuery({
    queryKey: ['audit-facets'],
    queryFn: AuditApi.facets,
    refetchOnWindowFocus: false,
  });

  // Category tab click handler
  const handleCategoryChange = (cat: AuditCategory) => {
    setCategory(cat);
    if (cat === 'all') {
      setTable('');
    } else {
      const allowed = CATEGORY_TABLES[cat];
      if (!allowed.includes(table)) {
        setTable('');
      }
    }
  };

  const filters = useMemo(
    () => ({
      table: table || undefined,
      recordId: initialRecordId ? Number(initialRecordId) : undefined,
      action: action || undefined,
      userId: userId ? Number(userId) : undefined,
      search: debouncedSearch || undefined,
      from: from || undefined,
      to: to ? `${to}T23:59:59` : undefined,
    }),
    [table, initialRecordId, action, userId, debouncedSearch, from, to]
  );

  // Reset offset and rows on filter changes
  useEffect(() => {
    setRows([]);
    setOffset(0);
    setExpanded(new Set());
  }, [filters]);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['audit-feed', filters, offset],
    queryFn: () => AuditApi.feed({ ...filters, limit: PAGE, offset }),
    refetchOnWindowFocus: false,
    refetchInterval: isLive ? 8000 : false,
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

  const toggleAll = () => {
    if (expanded.size >= rows.length && rows.length > 0) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(rows.map((r) => r.id)));
    }
  };

  // CSV Export utility
  const handleExportCsv = () => {
    if (rows.length === 0) return;
    const headers = ['ID', 'Timestamp', 'User', 'Action', 'Entity', 'Record ID', 'Changes'];
    const csvRows = [headers.join(',')];

    for (const r of rows) {
      const changes = diffFields(r.before_data, r.after_data)
        .filter((c) => c.changed)
        .map((c) => `${c.key}: ${fmtValue(c.before)} -> ${fmtValue(c.after)}`)
        .join('; ');

      const rowData = [
        r.id,
        `"${new Date(r.created_at).toISOString()}"`,
        `"${r.user_name || r.user_login || 'System'}"`,
        `"${r.action}"`,
        `"${r.table_name}"`,
        r.record_id,
        `"${changes.replace(/"/g, '""')}"`,
      ];
      csvRows.push(rowData.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `audit-feed-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter available tables based on active category
  const filteredTables = useMemo(() => {
    const allTables = facets?.tables ?? [];
    if (category === 'all') return allTables;
    return allTables.filter((t) => CATEGORY_TABLES[category].includes(t));
  }, [facets?.tables, category]);

  const stats = facets?.stats ?? { total: 0, today: 0, security: 0, commercial: 0 };

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', width: '100%', padding: '24px 16px 64px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <ScrollText size={22} color="var(--brown-700)" />
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
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--brown-700)', margin: 0 }}>
            Real-time immutable ledger audit trail: every transaction, mutation, and authentication event across the system.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Live stream toggle */}
          <button
            type="button"
            onClick={() => setIsLive((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--brown-300)',
              background: isLive ? '#f0fdf4' : 'var(--surface)',
              color: isLive ? '#15803d' : 'var(--brown-900)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isLive ? '#22c55e' : '#9ca3af',
                boxShadow: isLive ? '0 0 8px #22c55e' : 'none',
              }}
            />
            {isLive ? 'Live Streaming' : 'Live Off'}
          </button>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => {
              refetch();
              refetchFacets();
            }}
            disabled={isFetching}
            title="Refresh feed"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--brown-300)',
              background: 'var(--surface)',
              color: 'var(--brown-900)',
              fontSize: 12,
              cursor: isFetching ? 'default' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>

          {/* CSV Export */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={rows.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--brown-300)',
              background: 'var(--brown-900)',
              color: 'var(--cream)',
              fontSize: 12,
              fontWeight: 600,
              cursor: rows.length === 0 ? 'not-allowed' : 'pointer',
              opacity: rows.length === 0 ? 0.6 : 1,
            }}
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--brown-300)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ background: 'var(--cream)', padding: 10, borderRadius: 'var(--radius-sm)', color: 'var(--brown-700)' }}>
            <Layers size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--brown-700)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              Total Audited Events
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--brown-900)' }}>
              {stats.total.toLocaleString()}
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--brown-300)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ background: 'var(--cream)', padding: 10, borderRadius: 'var(--radius-sm)', color: 'var(--brown-700)' }}>
            <Calendar size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--brown-700)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              Today's Activity
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--brown-900)' }}>
              {stats.today.toLocaleString()}
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--brown-300)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ background: 'var(--cream)', padding: 10, borderRadius: 'var(--radius-sm)', color: 'var(--posted)' }}>
            <FileCheck2 size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--brown-700)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              Commercial Invoices & Bills
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--posted)' }}>
              {stats.commercial.toLocaleString()}
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--brown-300)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ background: '#fef2f2', padding: 10, borderRadius: 'var(--radius-sm)', color: '#dc2626' }}>
            <ShieldAlert size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--brown-700)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              Security & Exceptions
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: '#dc2626' }}>
              {stats.security.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {[
          { id: 'all', label: 'All Events' },
          { id: 'commercial', label: 'Commercial (Invoices & Bills)' },
          { id: 'orders', label: 'Orders (Sales & Purchase)' },
          { id: 'finance', label: 'Financials & Ledger' },
          { id: 'master', label: 'Master Data' },
          { id: 'security', label: 'Security & Access' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => handleCategoryChange(t.id as AuditCategory)}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              border: category === t.id ? '1px solid var(--brown-900)' : '1px solid var(--brown-300)',
              background: category === t.id ? 'var(--brown-900)' : 'var(--surface)',
              color: category === t.id ? 'var(--cream)' : 'var(--brown-900)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter and Search bar */}
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

        {/* Search input */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} color="var(--brown-500)" style={{ position: 'absolute', left: 10 }} />
          <input
            type="text"
            placeholder="Search document, user, changes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              ...selectStyle,
              paddingLeft: 30,
              width: 230,
            }}
          />
        </div>

        <select style={selectStyle} value={table} onChange={(e) => setTable(e.target.value)}>
          <option value="">{category === 'all' ? 'All records' : `All in ${category}`}</option>
          {filteredTables.map((t) => (
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

        {(table || action || userId || from || to || searchTerm || initialRecordId) && (
          <button
            type="button"
            onClick={() => {
              setCategory('all');
              setTable('');
              setAction('');
              setUserId('');
              setSearchTerm('');
              setDebouncedSearch('');
              setFrom('');
              setTo('');
              setSearchParams({});
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
            Clear filters
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {rows.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--brown-700)',
                fontSize: 12,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ChevronsUpDown size={14} />
              {expanded.size >= rows.length ? 'Collapse all' : 'Expand all'}
            </button>
          )}

          <span style={{ fontSize: 12, color: 'var(--brown-700)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {total} event{total === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div
        style={{
          border: '1px solid var(--brown-300)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          background: 'var(--surface)',
        }}
      >
        {rows.length === 0 && !isFetching && (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--brown-700)', fontSize: 14 }}>
            No audit events match these filters. Try broadening your criteria.
          </div>
        )}

        {rows.map((row, i) => {
          const meta = actionMeta(row.action);
          const Icon = meta.icon;
          const isOpen = expanded.has(row.id);
          const changes = diffFields(row.before_data, row.after_data);
          const link = recordLink(row.table_name, row.record_id);

          return (
            <div key={row.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--brown-300)' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: i % 2 ? 'rgba(249,242,228,0.45)' : 'transparent',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {/* Action icon */}
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

                {/* Event description */}
                <div style={{ fontSize: 13, color: 'var(--brown-900)', minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <strong>{row.user_name || row.user_login || 'System'}</strong>
                  <span style={{ color: 'var(--brown-700)' }}>{meta.verb}</span>

                  {link ? (
                    <Link
                      to={link}
                      style={{
                        fontWeight: 700,
                        color: 'var(--brown-900)',
                        textDecoration: 'underline',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        background: 'rgba(200,157,85,0.15)',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                      }}
                      title={`Open ${tableLabel(row.table_name)} #${row.record_id}`}
                    >
                      {tableLabel(row.table_name)} #{row.record_id}
                      <ExternalLink size={11} />
                    </Link>
                  ) : (
                    <strong>
                      {tableLabel(row.table_name)} #{row.record_id}
                    </strong>
                  )}

                  {changes.length > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        background: 'var(--cream)',
                        border: '1px solid var(--brown-300)',
                        borderRadius: 999,
                        padding: '1px 7px',
                        color: 'var(--brown-700)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {changes.filter((c) => c.changed).length} changed field{changes.filter((c) => c.changed).length === 1 ? '' : 's'}
                    </span>
                  )}
                </div>

                {/* Timestamp & Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--brown-700)', whiteSpace: 'nowrap' }}
                    title={new Date(row.created_at).toLocaleString()}
                  >
                    {relativeTime(row.created_at)}
                  </span>

                  <button
                    type="button"
                    onClick={() => toggle(row.id)}
                    aria-label={isOpen ? 'Collapse details' : 'Expand details'}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--brown-700)',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                </div>
              </div>

              {/* Collapsible Diff View */}
              {isOpen && (
                <div style={{ padding: '8px 16px 16px 56px', background: i % 2 ? 'rgba(249,242,228,0.45)' : 'transparent' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--brown-700)', marginBottom: 8 }}>
                    {new Date(row.created_at).toLocaleString()} · {clockTime(row.created_at)}
                  </div>

                  {changes.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--brown-700)' }}>No field-level detail recorded for this event.</div>
                  ) : (
                    <div
                      style={{
                        border: '1px solid var(--brown-300)',
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden',
                        maxWidth: 720,
                        background: 'var(--surface)',
                      }}
                    >
                      <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', background: 'var(--cream)', color: 'var(--brown-700)', borderBottom: '1px solid var(--brown-300)' }}>
                            <th style={{ padding: '6px 10px', fontWeight: 600 }}>Field</th>
                            <th style={{ padding: '6px 10px', fontWeight: 600 }}>Previous State</th>
                            <th style={{ padding: '6px 10px', fontWeight: 600 }}>New State</th>
                          </tr>
                        </thead>
                        <tbody>
                          {changes.map((c) => (
                            <tr
                              key={c.key}
                              style={{
                                background: c.changed ? 'rgba(234, 179, 8, 0.08)' : 'transparent',
                                borderTop: '1px solid var(--brown-300)',
                              }}
                            >
                              <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', color: 'var(--brown-900)', fontWeight: 500 }}>
                                {c.key}
                              </td>
                              <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)' }}>
                                {c.changed && c.before !== null && c.before !== undefined ? (
                                  <span style={{ textDecoration: 'line-through', color: '#b91c1c', opacity: 0.85 }}>
                                    {fmtValue(c.before)}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--brown-500)' }}>{fmtValue(c.before)}</span>
                                )}
                              </td>
                              <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)' }}>
                                {c.changed ? (
                                  <span style={{ color: '#15803d', fontWeight: 600, background: '#f0fdf4', padding: '1px 6px', borderRadius: 4 }}>
                                    {fmtValue(c.after)}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--brown-700)' }}>{fmtValue(c.after)}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination / Load more */}
      {rows.length < total && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            type="button"
            onClick={loadMore}
            disabled={isFetching}
            style={{
              padding: '9px 24px',
              fontSize: 13,
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              color: 'var(--brown-900)',
              background: 'var(--surface)',
              border: '1px solid var(--brown-300)',
              borderRadius: 'var(--radius-sm)',
              cursor: isFetching ? 'default' : 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {isFetching ? 'Loading audit records…' : `Load more records (${rows.length} / ${total})`}
          </button>
        </div>
      )}
    </div>
  );
}
