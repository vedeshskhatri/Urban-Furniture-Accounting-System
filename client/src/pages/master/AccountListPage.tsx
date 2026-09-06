import React, { useState, useEffect } from 'react';
import { AccountsApi } from '../../api/accounts.api';
import { Account, AccountType } from '@shared/schemas/account.schema';
import { useNavigate } from 'react-router-dom';

interface AccountListPageProps {
  onSelectAccount: (id: number) => void;
  onNewAccount: () => void;
  onBack?: () => void;
  onHome?: () => void;
}

export const AccountListPage: React.FC<AccountListPageProps> = ({
  onSelectAccount,
  onNewAccount,
  onBack,
  onHome,
}) => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const data = await AccountsApi.getAll(includeArchived);
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load accounts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [includeArchived]);

  // Format type display according to wireframe
  const formatType = (type: AccountType): string => {
    switch (type) {
      case 'asset':
      case 'bank':
      case 'cash':
        return 'Assets';
      case 'liability':
        return 'Liabilities';
      case 'income':
        return 'Income';
      case 'expense':
      case 'other_expense':
        return 'Expense';
      case 'capital':
        return 'Capital';
      default:
        return String(type);
    }
  };

  const formatAccountName = (name: string): string => {
    if (name.endsWith('A/c') || name.endsWith('a/c') || name.endsWith('Account')) {
      return name;
    }
    return `${name} A/c`;
  };

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  const handleHome = () => {
    if (onHome) onHome();
    else navigate('/dashboard');
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Wireframe Title: Chart of Accounts (List View) */}
        <div style={styles.titleWrapper}>
          <h1 style={styles.heading}>Chart of Accounts</h1>
          <span style={styles.subtext}>Master general ledger account hierarchy and balance classifications</span>
        </div>

        {/* Outer Card */}
        <div style={styles.card}>
          {/* Top Action Bar: [New] [Confirm] [Archived] ... [Home] [Back] */}
          <div style={styles.topBar}>
            {/* Left Button Group */}
            <div style={styles.leftBtnGroup}>
              <button
                type="button"
                onClick={onNewAccount}
                onMouseEnter={() => setHoveredBtn('new')}
                onMouseLeave={() => setHoveredBtn(null)}
                style={{
                  ...styles.wireframeBtn,
                  ...(hoveredBtn === 'new' ? styles.wireframeBtnHover : {}),
                }}
              >
                New
              </button>

              <button
                type="button"
                onClick={() => fetchAccounts()}
                onMouseEnter={() => setHoveredBtn('confirm')}
                onMouseLeave={() => setHoveredBtn(null)}
                style={{
                  ...styles.wireframeBtn,
                  ...(hoveredBtn === 'confirm' ? styles.wireframeBtnHover : {}),
                }}
                title="Refresh & Confirm Configuration"
              >
                Confirm
              </button>

              <button
                type="button"
                onClick={() => setIncludeArchived(prev => !prev)}
                onMouseEnter={() => setHoveredBtn('archived')}
                onMouseLeave={() => setHoveredBtn(null)}
                style={{
                  ...styles.wireframeBtn,
                  ...(includeArchived ? styles.wireframeBtnActive : {}),
                  ...(hoveredBtn === 'archived' && !includeArchived ? styles.wireframeBtnHover : {}),
                }}
                title="Toggle viewing archived accounts"
              >
                {includeArchived ? 'Active Accounts' : 'Archived'}
              </button>
            </div>

            {/* Right Button Group */}
            <div style={styles.rightBtnGroup}>
              <button
                type="button"
                onClick={handleHome}
                onMouseEnter={() => setHoveredBtn('home')}
                onMouseLeave={() => setHoveredBtn(null)}
                style={{
                  ...styles.wireframeBtn,
                  ...(hoveredBtn === 'home' ? styles.wireframeBtnHover : {}),
                }}
              >
                Home
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
          </div>

          {/* Table Content */}
          {loading ? (
            <div style={styles.loadingContainer}>Loading chart of accounts...</div>
          ) : accounts.length === 0 ? (
            <div style={styles.emptyContainer}>No accounts configured yet.</div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.headerRow}>
                    <th style={{ ...styles.th, textAlign: 'left', width: '55%' }}>Account Name</th>
                    <th style={{ ...styles.th, textAlign: 'left', width: '45%' }}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(acc => (
                    <tr
                      key={acc.id}
                      onClick={() => acc.id && onSelectAccount(acc.id)}
                      style={styles.bodyRow}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAF7F4')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={styles.tdName}>
                        {formatAccountName(acc.name)}
                      </td>
                      <td style={styles.tdType}>
                        {formatType(acc.type)}
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

  titleWrapper: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 16,
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  heading: {
    fontFamily: '"Montserrat", var(--font-display), sans-serif',
    fontWeight: 700,
    fontSize: 21,
    color: '#382A24',
    letterSpacing: '-0.01em',
    margin: 0,
  } as React.CSSProperties,

  subtext: {
    fontFamily: '"DM Sans", sans-serif',
    fontSize: 13,
    color: '#C05621',
    fontWeight: 500,
    fontStyle: 'italic',
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
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  leftBtnGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,

  rightBtnGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,

  wireframeBtn: {
    padding: '6px 18px',
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

  wireframeBtnActive: {
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
};
