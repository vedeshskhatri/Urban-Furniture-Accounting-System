import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface MegaMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateCustom?: (tab: string, view: string) => void;
}

interface ColumnData {
  title: string;
  items: {
    label: string;
    to: string;
    tab?: string;
    view?: string;
  }[];
}

const MEGA_MENU_COLUMNS: ColumnData[] = [
  {
    title: 'Sales',
    items: [
      { label: 'Sales order', to: '/sales/orders', tab: 'Sales', view: 'so-list' },
      { label: 'Sale Invoice', to: '/sales/invoices', tab: 'Sales', view: 'inv-list' },
      { label: 'Receipt', to: '/sales/payments', tab: 'Sales', view: 'register-payment' },
      { label: 'e-Bill Assistant (Voice/Chat)', to: '/sales/voice-bill', tab: 'Sales', view: 'voice-bill' },
    ],
  },
  {
    title: 'Purchase',
    items: [
      { label: 'Purchase Order', to: '/purchase/orders', tab: 'Purchase', view: 'po-list' },
      { label: 'Purchase Bill', to: '/purchase/bills', tab: 'Purchase', view: 'bill-list' },
      { label: 'Payment', to: '/purchase/statements', tab: 'Purchase', view: 'vendor-statement' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Contact', to: '/account/contacts', tab: 'Account', view: 'contact-list' },
      { label: 'Product', to: '/account/products', tab: 'Account', view: 'product-list' },
      { label: 'Analyticals', to: '/account/analytics', tab: 'Account', view: 'analytic-list' },
      { label: 'Analytical Budget', to: '/account/budgets', tab: 'Account', view: 'budget-list' },
      { label: 'Chart of Account', to: '/account/coa', tab: 'Account', view: 'account-list' },
      { label: 'Journals', to: '/account/journals', tab: 'Account', view: 'journal-list' },
      { label: 'Journal Entries', to: '/account/journal-entries', tab: 'Account', view: 'journal-entry-list' },
    ],
  },
  {
    title: 'Report',
    items: [
      { label: 'Balancesheet', to: '/report/balance-sheet', tab: 'Report', view: 'report-balancesheet' },
      { label: 'Profit and Loss', to: '/report/profit-loss', tab: 'Report', view: 'report-pnl' },
      { label: 'Budget Report', to: '/report/budget', tab: 'Report', view: 'report-budget' },
      { label: 'GST Returns (GSTR-1 / 3B)', to: '/report/gst', tab: 'Report', view: 'report-gst' },
      { label: 'Business Analytics Engine', to: '/analytics', tab: 'Report', view: 'analytics' },
      { label: 'System Integrity Report (10/10)', to: '/integrity', tab: 'Report', view: 'integrity' },
      { label: 'Live Correctness Monitor (Ticker)', to: '/monitor', tab: 'Report', view: 'monitor' },
      { label: 'Audit Log & Chatter Feed', to: '/audit', tab: 'Report', view: 'audit' },
      { label: 'CFO Copilot (Offline AI Advisor)', to: '#cfo-copilot', tab: 'Report', view: 'cfo-copilot' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { label: 'Template Library', to: '/tools/templates', tab: 'Tools', view: 'templates' },
      { label: 'My Saved Sheets', to: '/tools/templates?tab=saved', tab: 'Tools', view: 'saved-templates' },
      { label: 'Template Settings', to: '/tools/templates/manage', tab: 'Tools', view: 'manage-templates' },
    ],
  },
];

export const MegaMenu: React.FC<MegaMenuProps> = ({
  isOpen,
  onClose,
  onNavigateCustom,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  let navigate: ReturnType<typeof useNavigate> | null = null;
  let location: ReturnType<typeof useLocation> | null = null;

  try {
    navigate = useNavigate();
    location = useLocation();
  } catch {
    // If rendered outside router context
  }

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleMousedown = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleMousedown);
    document.addEventListener('keydown', handleKeydown);

    return () => {
      document.removeEventListener('mousedown', handleMousedown);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [isOpen, onClose]);

  // Lock background scroll completely whenever MegaMenu is open
  useEffect(() => {
    if (!isOpen) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const preventScroll = (e: WheelEvent | TouchEvent) => {
      if (cardRef.current && cardRef.current.contains(e.target as Node)) {
        return;
      }
      e.preventDefault();
    };

    window.addEventListener('wheel', preventScroll, { passive: false });
    window.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      window.removeEventListener('wheel', preventScroll);
      window.removeEventListener('touchmove', preventScroll);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleItemClick = (item: { to: string; tab?: string; view?: string }) => {
    if (item.to === '#cfo-copilot') {
      window.dispatchEvent(new CustomEvent('open-cfo-copilot'));
      onClose();
      return;
    }
    if (onNavigateCustom && item.tab && item.view) {
      onNavigateCustom(item.tab, item.view);
    } else if (navigate) {
      navigate(item.to);
    }
    onClose();
  };

  return (
    <>
      {/* Translucent backdrop click interceptor */}
      <div
        onClick={onClose}
        onWheel={(e) => e.preventDefault()}
        onTouchMove={(e) => e.preventDefault()}
        style={{
          position: 'fixed',
          top: 56,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(74, 58, 52, 0.10)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          zIndex: 990,
        }}
      />

      {/* Floating Card Container */}
      <div style={styles.overlay}>
        <div ref={cardRef} style={styles.card} role="dialog" aria-modal="true">
          {/* Top Header Row with 4 Module Titles */}
          <div style={styles.headerRow}>
            {MEGA_MENU_COLUMNS.map(col => (
              <div key={col.title} style={styles.colHeader}>
                <span>{col.title}</span>
              </div>
            ))}
          </div>

          {/* Continuous Horizontal Line running across all columns */}
          <div style={styles.dividerLine} />

          {/* 4 Vertical Columns containing exact wireframe items */}
          <div style={styles.contentGrid}>
            {MEGA_MENU_COLUMNS.map(col => (
              <div key={col.title} style={styles.columnList}>
                {col.items.map(item => {
                  const isActive = location?.pathname === item.to;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleItemClick(item)}
                      style={{
                        ...styles.menuItemBtn,
                        ...(isActive ? styles.menuItemBtnActive : {}),
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          e.currentTarget.style.color = '#382A24';
                          e.currentTarget.style.transform = 'translateX(2px)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          e.currentTarget.style.color = '#5C453A';
                          e.currentTarget.style.transform = 'translateX(0px)';
                        }
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

const styles = {
  overlay: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    paddingTop: 10,
    zIndex: 1000,
    pointerEvents: 'auto' as const,
  },

  card: {
    background: '#FFFFFF',
    borderRadius: 24,
    border: '1.5px solid #5C453A',
    boxShadow: '0 16px 40px rgba(74, 58, 52, 0.16)',
    padding: '24px 28px 28px 28px',
    width: '100%',
    maxWidth: 960,
    position: 'relative' as const,
  } as React.CSSProperties,

  headerRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 16,
    paddingBottom: 14,
  } as React.CSSProperties,

  colHeader: {
    fontFamily: '"Montserrat", var(--font-display), sans-serif',
    fontWeight: 700,
    fontSize: 16,
    color: '#382A24',
    letterSpacing: '-0.01em',
  } as React.CSSProperties,

  dividerLine: {
    width: '100%',
    height: 0,
    borderBottom: '1.5px solid #5C453A',
    marginBottom: 18,
  } as React.CSSProperties,

  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 16,
  } as React.CSSProperties,

  columnList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  } as React.CSSProperties,

  menuItemBtn: {
    border: 'none',
    background: 'transparent',
    padding: '3px 0',
    textAlign: 'left' as const,
    fontFamily: '"DM Sans", var(--font-body), sans-serif',
    fontSize: 14.5,
    fontWeight: 500,
    color: '#5C453A',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 120ms ease',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  menuItemBtnActive: {
    fontWeight: 700,
    color: '#382A24',
    textDecoration: 'underline',
  } as React.CSSProperties,
};
