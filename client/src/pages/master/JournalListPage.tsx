import React, { useState, useEffect } from 'react';
import { AccountsApi } from '../../api/accounts.api';
import { Journal } from '@shared/schemas/account.schema';
import { useNavigate } from 'react-router-dom';

interface JournalListPageProps {
  onSelectJournal: (id: number) => void;
  onNewJournal: () => void;
  onBack?: () => void;
}

export const JournalListPage: React.FC<JournalListPageProps> = ({
  onSelectJournal,
  onNewJournal,
  onBack,
}) => {
  const navigate = useNavigate();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const fetchJournals = async () => {
    try {
      setLoading(true);
      const data = await AccountsApi.getAllJournals(false);
      setJournals(data);
    } catch (err) {
      console.error('Failed to load journals', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournals();
  }, []);

  const formatAccountName = (name?: string): string => {
    if (!name) return '—';
    if (name.endsWith('A/c') || name.endsWith('a/c') || name.endsWith('Account')) {
      return name;
    }
    return `${name} A/c`;
  };

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.heading}>Journals</h1>

        {/* Outer Card */}
        <div style={styles.card}>
          {/* Top Bar: [New] ... [Back] */}
          <div style={styles.topBar}>
            <button
              type="button"
              onClick={onNewJournal}
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
            <div style={styles.loadingContainer}>Loading journals...</div>
          ) : journals.length === 0 ? (
            <div style={styles.emptyContainer}>No journals configured yet. Click "New" to create one.</div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.headerRow}>
                    <th style={{ ...styles.th, textAlign: 'left', width: '35%' }}>Journal Name</th>
                    <th style={{ ...styles.th, textAlign: 'left', width: '30%' }}>Type</th>
                    <th style={{ ...styles.th, textAlign: 'left', width: '35%' }}>Default Account</th>
                  </tr>
                </thead>
                <tbody>
                  {journals.map(j => (
                    <tr
                      key={j.id}
                      onClick={() => j.id && onSelectJournal(j.id)}
                      style={styles.bodyRow}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAF7F4')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={styles.tdName}>
                        {j.name}
                      </td>
                      <td style={styles.tdType}>
                        {j.type.charAt(0).toUpperCase() + j.type.slice(1)}
                      </td>
                      <td style={styles.tdAccount}>
                        {formatAccountName(j.default_account_name)}
                      </td>
                    </tr>
                  ))}
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
    maxWidth: 780,
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
    padding: '12px 16px',
    fontFamily: '"Montserrat", var(--font-display), sans-serif',
    fontWeight: 700,
    fontSize: 14,
    color: '#382A24',
    letterSpacing: '-0.01em',
  } as React.CSSProperties,

  bodyRow: {
    borderBottom: '1px solid #E4D5C7',
    cursor: 'pointer',
    transition: 'background 120ms ease',
  } as React.CSSProperties,

  tdName: {
    padding: '12px 16px',
    fontSize: 14,
    fontWeight: 600,
    color: '#382A24',
  } as React.CSSProperties,

  tdType: {
    padding: '12px 16px',
    fontSize: 14,
    color: '#5C453A',
  } as React.CSSProperties,

  tdAccount: {
    padding: '12px 16px',
    fontSize: 14,
    color: '#382A24',
    fontWeight: 500,
  } as React.CSSProperties,
};
