import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { History, X, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import RecordTimeline from './RecordTimeline';
import { AuditApi } from '../../api/audit.api';

/**
 * Route path segment -> { recordType, label }. Matches the second-to-last
 * segment of a form URL whose last segment is a numeric id, e.g.
 *   /account/contacts/42   -> contacts
 *   /sales/invoices/7      -> invoices
 *   /purchase/bills/12     -> bills
 */
const SEGMENT_MAP: Record<string, { type: string; label: string }> = {
  contacts: { type: 'contact', label: 'Contact' },
  products: { type: 'product', label: 'Product' },
  coa: { type: 'account', label: 'Account' },
  accounts: { type: 'account', label: 'Account' },
  journals: { type: 'journal', label: 'Journal' },
  analytics: { type: 'analytic', label: 'Analytic Account' },
  'journal-entries': { type: 'journal_entry', label: 'Journal Entry' },
  orders: { type: 'order', label: 'Order' }, // resolved below by module
  bills: { type: 'bill', label: 'Vendor Bill' },
  invoices: { type: 'invoice', label: 'Invoice' },
  budgets: { type: 'budget', label: 'Budget' },
  payments: { type: 'payment', label: 'Payment' },
};

function resolveTarget(pathname: string): { type: string; label: string; id: number } | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;

  const [mod, seg, maybeId] = parts;
  const rawId = maybeId ?? (parts.length === 2 ? parts[1] : undefined);
  const id = parseInt(rawId ?? '', 10);
  if (Number.isNaN(id) || id <= 0) return null;

  const MAP: Record<string, { type: string; label: string }> = {
    invoices: { type: 'customer_invoices', label: 'Customer Invoice' },
    bills: { type: 'vendor_bills', label: 'Vendor Bill' },
    budgets: { type: 'budgets', label: 'Budget' },
    'journal-entries': { type: 'journal_entries', label: 'Journal Entry' },
    contacts: { type: 'contacts', label: 'Contact' },
    products: { type: 'products', label: 'Product' },
    accounts: { type: 'accounts', label: 'Account' },
    coa: { type: 'accounts', label: 'Account' },
    journals: { type: 'journals', label: 'Journal' },
    analytics: { type: 'analytic_accounts', label: 'Analytic Account' },
  };

  let entry = MAP[seg];
  if (!entry) return null;

  // "orders" means SO under /sales and PO under /purchase
  if (seg === 'orders') {
    entry = mod === 'purchase' ? { type: 'purchase_orders', label: 'Purchase Order' } : { type: 'sales_orders', label: 'Sales Order' };
  }
  return { ...entry, id };
}

export default function RecordTimelineDrawer() {
  const { pathname } = useLocation();
  const target = resolveTarget(pathname);
  const [open, setOpen] = useState(false);

  // Close the drawer whenever we navigate to a different record.
  useEffect(() => setOpen(false), [pathname]);

  const { data: events } = useQuery({
    queryKey: ['audit-timeline', target?.type, target?.id],
    queryFn: () => AuditApi.recordTimeline(target!.type, target!.id),
    enabled: Boolean(target?.id),
    refetchOnWindowFocus: false,
  });

  if (!target) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Show record history"
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 120,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 16px',
          borderRadius: 999,
          background: 'var(--brown-900)',
          color: 'var(--cream)',
          border: 'none',
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          fontWeight: 600,
          boxShadow: 'var(--shadow-lg)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <History size={15} />
        <span>Chatter & History</span>
        {events && events.length > 0 && (
          <span
            style={{
              fontSize: 11,
              background: 'var(--gold, #c89d55)',
              color: 'var(--brown-950, #2c1810)',
              borderRadius: 999,
              padding: '1px 7px',
              fontWeight: 700,
            }}
          >
            {events.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(74,58,52,0.28)', zIndex: 130 }}
          />
          <aside
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'min(460px, 92vw)',
              background: 'var(--cream)',
              borderLeft: '1px solid var(--brown-300)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 131,
              display: 'flex',
              flexDirection: 'column',
              animation: 'none',
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px',
                borderBottom: '1px solid var(--brown-300)',
                background: 'var(--surface)',
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--brown-900)' }}>
                  {target.label} #{target.id}
                </div>
                <div style={{ fontSize: 12, color: 'var(--brown-700)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <span>Audit Trail & Activity</span>
                  <Link
                    to={`/audit?table=${encodeURIComponent(target.type)}`}
                    style={{ color: 'var(--brown-900)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                  >
                    All {target.label}s <ExternalLink size={11} />
                  </Link>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--brown-700)' }}
              >
                <X size={18} />
              </button>
            </header>
            <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
              <RecordTimeline recordType={target.type} recordId={target.id} />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
