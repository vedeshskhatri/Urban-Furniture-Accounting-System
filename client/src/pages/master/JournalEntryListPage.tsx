import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export interface JournalEntryListItem {
  id: number;
  date: string;
  number: string;
  partner?: string | null;
  partner_name?: string | null;
  journal?: string;
  journal_name?: string;
  total: string | number;
  status: 'draft' | 'posted' | 'reversed';
}

interface JournalEntryListPageProps {
  onSelectEntry?: (id: number) => void;
  onNewEntry?: () => void;
  onBack?: () => void;
}

export const JournalEntryListPage: React.FC<JournalEntryListPageProps> = ({
  onSelectEntry,
  onNewEntry,
  onBack,
}) => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<JournalEntryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/journal-entries', { credentials: 'include' });
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        setEntries(json.data);
      } else {
        // Fallback default wireframe data if empty
        setEntries([]);
      }
    } catch (err) {
      console.error('Failed to load journal entries', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const formatDate = (dStr: string) => {
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dStr;
    }
  };

  const formatAmount = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '0';
    return num.toLocaleString('en-IN');
  };

  const handleRowClick = (id: number) => {
    if (onSelectEntry) onSelectEntry(id);
    else navigate(`/account/journal-entries/${id}`);
  };

  const handleNew = () => {
    if (onNewEntry) onNewEntry();
    else navigate('/account/journal-entries/new');
  };

  const handleBack = () => {
    if (onBack) onBack();
    else navigate('/account');
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Wireframe Header Title: Journal Entries (List View) */}
        <h1 style={styles.heading}>Journal Entries (List View)</h1>

        {/* Outer Card */}
        <div style={styles.card}>
          {/* Top Bar: [New] ... [Back] */}
          <div style={styles.topBar}>
            <button
              type="button"
              onClick={handleNew}
              onMouseEnter={() => setHoveredBtn('new')}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                ...styles.newBtn,
                ...(hoveredBtn === 'new' ? styles.newBtnHover : {}),
              }}
            >
              New
            </button>

            <button
              type="button"
              onClick={handleBack}
              onMouseEnter={() => setHoveredBtn('back')}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                ...styles.wireframeBtn,
                ...(hoveredBtn === 'back' ? styles.wireframeBtnHover : {}),
              }}
            >
              Back
            </button>
          </div>

          {/* Table Content */}
          {loading ? (
            <div style={styles.loadingContainer}>Loading journal entries...</div>
          ) : entries.length === 0 ? (
            <div style={styles.emptyContainer}>
              No journal entries found. Click "New" to create and post a journal entry.
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.headerRow}>
                    <th style={{ ...styles.th, textAlign: 'left', width: '12%' }}>Date</th>
                    <th style={{ ...styles.th, textAlign: 'left', width: '22%' }}>Number</th>
                    <th style={{ ...styles.th, textAlign: 'left', width: '22%' }}>Partner</th>
                    <th style={{ ...styles.th, textAlign: 'left', width: '18%' }}>Journal</th>
                    <th style={{ ...styles.th, textAlign: 'right', width: '14%' }}>Total</th>
                    <th style={{ ...styles.th, textAlign: 'center', width: '12%' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => {
                    const isPosted = e.status === 'posted';
                    const isDraft = e.status === 'draft';
                    return (
                      <tr
                        key={e.id}
                        onClick={() => handleRowClick(e.id)}
                        style={styles.bodyRow}
                        onMouseEnter={evt => (evt.currentTarget.style.background = '#FAF7F4')}
                        onMouseLeave={evt => (evt.currentTarget.style.background = 'transparent')}
                      >
                        <td style={styles.tdDate}>{formatDate(e.date)}</td>
                        <td style={styles.tdNumber}>{e.number}</td>
                        <td style={styles.tdPartner}>{e.partner || e.partner_name || '—'}</td>
                        <td style={styles.tdJournal}>{e.journal || e.journal_name || 'General'}</td>
                        <td style={styles.tdTotal}>Rs. {formatAmount(e.total)}</td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <span
                            style={{
                              ...styles.statusBadge,
                              ...(isPosted
                                ? styles.statusPosted
                                : isDraft
                                ? styles.statusDraft
                                : styles.statusReversed),
                            }}
                          >
                            {isPosted ? 'Posted' : isDraft ? 'Draft' : e.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'flex-start',
    background: 'var(--cream, #F9F2E4)',
    padding: '36px 20px 48px 20px',
    fontFamily: '"DM Sans", var(--font-body), sans-serif',
  } as React.CSSProperties,

  container: {
    width: '100%',
    maxWidth: 820,
  } as React.CSSProperties,

  heading: {
    fontFamily: '"Montserrat", var(--font-display), sans-serif',
    fontWeight: 700,
    fontSize: 21,
    color: '#382A24',
    textAlign: 'center' as const,
    marginBottom: 18,
    letterSpacing: '-0.01em',
  } as React.CSSProperties,

  card: {
    background: '#FFFFFF',
    borderRadius: 24,
    border: '1.5px solid #77574A',
    boxShadow: '0 10px 32px rgba(74, 58, 52, 0.08)',
    padding: '28px 36px 36px 36px',
    width: '100%',
  } as React.CSSProperties,

  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
  } as React.CSSProperties,

  newBtn: {
    padding: '7px 28px',
    border: '1.5px solid #5A4050',
    borderRadius: 12,
    fontFamily: '"Montserrat", var(--font-display), sans-serif',
    fontWeight: 700,
    fontSize: 13,
    color: '#FFFFFF',
    background: '#5F4655',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    outline: 'none',
    boxShadow: '0 2px 6px rgba(95, 70, 85, 0.25)',
  } as React.CSSProperties,

  newBtnHover: {
    background: '#483441',
    borderColor: '#483441',
  } as React.CSSProperties,

  wireframeBtn: {
    padding: '6px 22px',
    border: '1.5px solid #4A3A34',
    borderRadius: 12,
    fontFamily: '"Montserrat", var(--font-display), sans-serif',
    fontWeight: 700,
    fontSize: 13,
    color: '#4A3A34',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    outline: 'none',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  wireframeBtnHover: {
    background: '#4A3A34',
    color: '#FFFFFF',
  } as React.CSSProperties,

  loadingContainer: {
    padding: '48px 0',
    textAlign: 'center' as const,
    color: '#8C6A58',
    fontSize: 14,
  } as React.CSSProperties,

  emptyContainer: {
    padding: '48px 0',
    textAlign: 'center' as const,
    color: '#A8836C',
    fontSize: 14,
  } as React.CSSProperties,

  tableWrapper: {
    width: '100%',
    overflowX: 'auto' as const,
  } as React.CSSProperties,

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  } as React.CSSProperties,

  headerRow: {
    borderBottom: '1.5px solid #77574A',
  } as React.CSSProperties,

  th: {
    padding: '12px 14px',
    fontFamily: '"Montserrat", var(--font-display), sans-serif',
    fontWeight: 700,
    fontSize: 13.5,
    color: '#382A24',
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  bodyRow: {
    borderBottom: '1px solid #E4D5C7',
    cursor: 'pointer',
    transition: 'background 120ms ease',
  } as React.CSSProperties,

  td: {
    padding: '12px 14px',
    fontSize: 13.5,
  } as React.CSSProperties,

  tdDate: {
    padding: '12px 14px',
    fontSize: 13.5,
    color: '#5C453A',
  } as React.CSSProperties,

  tdNumber: {
    padding: '12px 14px',
    fontSize: 13.5,
    fontWeight: 600,
    color: '#9B2C2C',
    fontFamily: '"DM Sans", monospace',
  } as React.CSSProperties,

  tdPartner: {
    padding: '12px 14px',
    fontSize: 13.5,
    color: '#382A24',
    fontWeight: 500,
  } as React.CSSProperties,

  tdJournal: {
    padding: '12px 14px',
    fontSize: 13.5,
    color: '#5C453A',
  } as React.CSSProperties,

  tdTotal: {
    padding: '12px 14px',
    fontSize: 13.5,
    fontWeight: 600,
    color: '#382A24',
    textAlign: 'right' as const,
  } as React.CSSProperties,

  statusBadge: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
  } as React.CSSProperties,

  statusPosted: {
    background: '#E6FFFA',
    color: '#234E52',
    border: '1px solid #81E6D9',
  } as React.CSSProperties,

  statusDraft: {
    background: '#EBF8FF',
    color: '#2B6CB0',
    border: '1px solid #BEE3F8',
  } as React.CSSProperties,

  statusReversed: {
    background: '#FFF5F5',
    color: '#C53030',
    border: '1px solid #FEB2B2',
  } as React.CSSProperties,
};
