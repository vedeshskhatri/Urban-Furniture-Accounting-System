import {
  Plus,
  Pencil,
  CheckCircle2,
  BookCheck,
  Undo2,
  XCircle,
  Wallet,
  Archive,
  RefreshCw,
  Trash2,
  LogIn,
  ShieldAlert,
  Circle,
  type LucideIcon,
} from 'lucide-react';

export const ACTION_META: Record<string, { label: string; verb: string; icon: LucideIcon; color: string }> = {
  create: { label: 'Created', verb: 'created', icon: Plus, color: 'var(--posted)' },
  update: { label: 'Updated', verb: 'updated', icon: Pencil, color: 'var(--brown-700)' },
  confirm: { label: 'Confirmed', verb: 'confirmed', icon: CheckCircle2, color: 'var(--posted)' },
  post: { label: 'Posted', verb: 'posted', icon: BookCheck, color: 'var(--posted)' },
  reverse: { label: 'Reversed', verb: 'reversed', icon: Undo2, color: 'var(--danger)' },
  cancel: { label: 'Cancelled', verb: 'cancelled', icon: XCircle, color: 'var(--danger)' },
  pay: { label: 'Payment recorded', verb: 'recorded a payment on', icon: Wallet, color: 'var(--posted)' },
  archive: { label: 'Archived', verb: 'archived', icon: Archive, color: 'var(--brown-700)' },
  revise: { label: 'Revised', verb: 'revised', icon: RefreshCw, color: 'var(--warning)' },
  delete: { label: 'Deleted', verb: 'deleted', icon: Trash2, color: 'var(--danger)' },
  login: { label: 'Signed in', verb: 'signed in', icon: LogIn, color: 'var(--brown-700)' },
  login_failed: { label: 'Failed sign-in', verb: 'failed to sign in', icon: ShieldAlert, color: 'var(--danger)' },
};

export function actionMeta(action: string) {
  return ACTION_META[action] ?? { label: action, verb: action, icon: Circle, color: 'var(--brown-700)' };
}

const TABLE_LABELS: Record<string, string> = {
  contacts: 'Contact',
  products: 'Product',
  accounts: 'Account',
  journals: 'Journal',
  analytic_accounts: 'Analytic Account',
  purchase_orders: 'Purchase Order',
  vendor_bills: 'Vendor Bill',
  sales_orders: 'Sales Order',
  customer_invoices: 'Invoice',
  payments: 'Payment',
  budgets: 'Budget',
  journal_entries: 'Journal Entry',
  users: 'User',
};

export function tableLabel(table: string): string {
  return TABLE_LABELS[table] ?? table;
}

export function recordLink(table: string, id: number): string | null {
  switch (table) {
    case 'customer_invoices':
      return `/sales/invoices/${id}`;
    case 'sales_orders':
      return `/sales/orders/${id}`;
    case 'vendor_bills':
      return `/purchase/bills/${id}`;
    case 'purchase_orders':
      return `/purchase/orders/${id}`;
    case 'journal_entries':
      return `/account/journal-entries/${id}`;
    case 'budgets':
      return `/account/budgets/${id}`;
    case 'products':
      return `/account/products/${id}`;
    case 'contacts':
      return `/account/contacts/${id}`;
    case 'accounts':
      return `/account/coa/${id}`;
    case 'journals':
      return `/account/journals/${id}`;
    case 'analytic_accounts':
      return `/account/analytics/${id}`;
    default:
      return null;
  }
}

export type AuditCategory = 'all' | 'commercial' | 'orders' | 'finance' | 'master' | 'security';

export const CATEGORY_TABLES: Record<Exclude<AuditCategory, 'all'>, string[]> = {
  commercial: ['customer_invoices', 'vendor_bills'],
  orders: ['sales_orders', 'purchase_orders'],
  finance: ['journal_entries', 'payments', 'budgets', 'accounts'],
  master: ['products', 'contacts', 'journals', 'analytic_accounts'],
  security: ['users'],
};

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 45) return 'just now';
  if (secs < 90) return 'a minute ago';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} mo ago`;
  return `${Math.round(months / 12)} yr ago`;
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Field-level diff between before/after JSON blobs. */
export interface FieldChange {
  key: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

export function diffFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): FieldChange[] {
  const keys = new Set<string>([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const rows: FieldChange[] = [];
  for (const key of keys) {
    const b = before?.[key];
    const a = after?.[key];
    rows.push({ key, before: b, after: a, changed: JSON.stringify(b) !== JSON.stringify(a) });
  }
  return rows.sort((x, y) => Number(y.changed) - Number(x.changed) || x.key.localeCompare(y.key));
}

export function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return s === '{}' ? '—' : s;
  }
  return String(v);
}
