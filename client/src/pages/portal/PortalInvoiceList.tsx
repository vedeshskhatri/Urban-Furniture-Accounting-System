import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Decimal from 'decimal.js';
import StatusBadge from '../../components/ui/StatusBadge';
import { formatINR } from '../../lib/money';
import { loadRazorpayScript } from '../../lib/razorpay';
import api from '../../lib/axios';
import {
  Receipt,
  FileText,
  CreditCard,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  ArrowRight,
  Download,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  X,
  Sparkles,
} from 'lucide-react';

export interface PortalInvoiceListItem {
  id: number;
  number: string;
  invoiceDate: string;
  dueDate: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  paymentStatus: string;
}

export const PortalInvoiceList: React.FC = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<PortalInvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [successNotice, setSuccessNotice] = useState<{
    message: string;
    pdfUrl?: string;
    emailSent?: boolean;
    recipient?: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'due' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchInvoices = useCallback(() => {
    setLoading(true);
    api.get('/api/portal/invoices')
      .then((res) => {
        if (res.data?.data) {
          setInvoices(res.data.data);
        } else if (res.data?.error) {
          setError(res.data.error.message);
        }
      })
      .catch((err) => setError(err?.response?.data?.error?.message || err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleInitiateRazorpay = async (row: PortalInvoiceListItem) => {
    setPayingId(row.id);
    setActionError(null);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error('Could not load Razorpay Payment Gateway SDK');
      }

      const orderRes = await api.post(`/api/portal/invoices/${row.id}/razorpay/create-order`, {
        amount: new Decimal(row.amountDue).toFixed(2),
      });
      const order = orderRes.data?.data;
      if (!order) {
        throw new Error(orderRes.data?.error?.message || 'Failed to create Razorpay payment order');
      }

      const rzpKey =
        (window as any).__VITE_RAZORPAY_KEY_ID__ ||
        (import.meta as any).env?.VITE_RAZORPAY_KEY_ID ||
        'rzp_test_TYL9FJAZxMYoFc';

      const orderId = order.orderId || order.id;

      const rzp = new (window as any).Razorpay({
        key: rzpKey,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'Urban Furniture',
        description: `Payment for Invoice ${row.number}`,
        order_id: orderId,
        theme: { color: '#4A3A34' },
        handler: async (response: any) => {
          try {
            const verifyRes = await api.post(`/api/portal/invoices/${row.id}/razorpay/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id || orderId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: new Decimal(row.amountDue).toFixed(2),
            });
            if (verifyRes.data?.error) {
              throw new Error(verifyRes.data.error.message || 'Payment signature verification failed');
            }

            const resData = verifyRes.data?.data;
            const pdfUrl = resData?.pdfUrl || `/api/portal/invoices/${row.id}/pdf`;
            const emailSent = resData?.email?.success;
            const recipient = resData?.email?.recipient;

            setSuccessNotice({
              message: `Payment ${response.razorpay_payment_id} verified & posted to General Ledger!`,
              pdfUrl,
              emailSent,
              recipient,
            });

            try {
              window.open(pdfUrl, '_blank');
            } catch {
              // Browser popup blocker fallback handled by banner
            }
            fetchInvoices();
          } catch (vErr: any) {
            setActionError(vErr?.response?.data?.error?.message || vErr.message || 'Signature verification failed');
          } finally {
            setPayingId(null);
          }
        },
        modal: {
          ondismiss: () => {
            setPayingId(null);
          },
        },
      });

      rzp.open();
    } catch (err: any) {
      setActionError(err.message || 'Razorpay initialization failed');
      setPayingId(null);
    }
  };

  /* ── Derived KPIs ── */
  const totalCount = invoices.length;

  const amountOutstanding = useMemo(() => {
    return invoices
      .filter((i) => i.paymentStatus !== 'paid')
      .reduce((acc, i) => acc.plus(new Decimal(i.amountDue || '0')), new Decimal(0))
      .toFixed(2);
  }, [invoices]);

  const amountPaidTotal = useMemo(() => {
    return invoices
      .reduce((acc, i) => acc.plus(new Decimal(i.amountPaid || '0')), new Decimal(0))
      .toFixed(2);
  }, [invoices]);

  const amountInvoicedTotal = useMemo(() => {
    return invoices
      .reduce((acc, i) => acc.plus(new Decimal(i.total || '0')), new Decimal(0))
      .toFixed(2);
  }, [invoices]);

  const dueInvoicesCount = useMemo(() => {
    return invoices.filter((i) => parseFloat(i.amountDue || '0') > 0).length;
  }, [invoices]);

  // Filtered list
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // 1. Status filter
      if (filterStatus === 'due' && parseFloat(inv.amountDue || '0') <= 0) return false;
      if (filterStatus === 'paid' && inv.paymentStatus !== 'paid') return false;

      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = inv.number.toLowerCase().includes(q);
        const matchDate = inv.invoiceDate?.includes(q);
        if (!matchNum && !matchDate) return false;
      }

      return true;
    });
  }, [invoices, filterStatus, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, width: '100%' }}>
      {/* ── 1. Showroom Billing Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 20,
          borderBottom: '1px solid rgba(208, 174, 146, 0.3)',
          paddingBottom: 24,
        }}
      >
        <div>
          <div style={{ marginBottom: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--brown-600)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Account Statement
            </span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 32,
              fontWeight: 800,
              color: 'var(--brown-900)',
              letterSpacing: '-0.02em',
              margin: '0 0 6px',
            }}
          >
            Invoices &amp; Settlements
          </h1>

          <p style={{ margin: 0, fontSize: 14, color: 'var(--brown-700)', maxWidth: 580, lineHeight: 1.5 }}>
            Review official invoices, download statements, and settle balances.
          </p>
        </div>
      </div>

      {/* ── 2. Success / Error Banners ── */}
      {successNotice && (
        <div
          style={{
            padding: '16px 20px',
            background: 'rgba(95, 112, 82, 0.12)',
            border: '1px solid var(--posted)',
            borderRadius: 14,
            color: 'var(--posted)',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 14,
            boxShadow: '0 2px 8px rgba(95, 112, 82, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <CheckCircle2 size={20} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{successNotice.message}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--brown-800)', marginTop: 2 }}>
                {successNotice.emailSent
                  ? `Official signed PDF receipt emailed to ${successNotice.recipient}.`
                  : 'Official signed GST PDF receipt generated and ready for instant download.'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {successNotice.pdfUrl && (
              <a
                href={successNotice.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  borderRadius: 8,
                  backgroundColor: 'var(--brown-900)',
                  color: 'var(--cream)',
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  boxShadow: '0 2px 6px rgba(74, 58, 52, 0.18)',
                  transition: 'all 120ms ease',
                }}
              >
                <Download size={13} />
                <span>Download PDF Receipt</span>
              </a>
            )}

            <button
              onClick={() => setSuccessNotice(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--posted)',
                display: 'flex',
                padding: 4,
              }}
              title="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <div
          style={{
            padding: '14px 18px',
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger)',
            borderRadius: 14,
            color: 'var(--danger)',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--danger)',
              display: 'flex',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── 3. KPI Summary Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
        {/* Outstanding Dues */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 18,
            padding: '24px',
            border: parseFloat(amountOutstanding) > 0 ? '1px solid rgba(158, 74, 56, 0.45)' : '1px solid rgba(208, 174, 146, 0.35)',
            boxShadow: '0 4px 16px rgba(74, 58, 52, 0.05)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brown-600)' }}>
              Outstanding Balance
            </span>
            {parseFloat(amountOutstanding) > 0 ? (
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', padding: '2px 8px', borderRadius: 999 }}>
                {dueInvoicesCount} Due
              </span>
            ) : (
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--posted)', backgroundColor: 'var(--posted-bg)', padding: '2px 8px', borderRadius: 999 }}>
                Paid in Full
              </span>
            )}
          </div>

          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 28,
              fontWeight: 800,
              color: parseFloat(amountOutstanding) > 0 ? 'var(--danger)' : 'var(--posted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatINR(amountOutstanding)}
          </div>
        </div>

        {/* Total Settled / Paid */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 18,
            padding: '24px',
            border: '1px solid rgba(208, 174, 146, 0.35)',
            boxShadow: '0 4px 16px rgba(74, 58, 52, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brown-600)' }}>
              Total Settled
            </span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--posted)' }}>
              Cleared
            </span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--posted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatINR(amountPaidTotal)}
          </div>
        </div>

        {/* Total Invoiced Volume */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 18,
            padding: '24px',
            border: '1px solid rgba(208, 174, 146, 0.35)',
            boxShadow: '0 4px 16px rgba(74, 58, 52, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brown-600)' }}>
              Total Invoiced
            </span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--brown-500)' }}>
              {totalCount} {totalCount === 1 ? 'bill' : 'bills'}
            </span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--brown-900)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatINR(amountInvoicedTotal)}
          </div>
        </div>
      </div>

      {/* ── 4. Filter & Search Toolbar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          padding: '10px 16px',
          borderRadius: 16,
          border: '1px solid rgba(208, 174, 146, 0.4)',
          boxShadow: '0 2px 8px rgba(74, 58, 52, 0.04)',
        }}
      >
        {/* Status Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setFilterStatus('all')}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: filterStatus === 'all' ? 700 : 500,
              fontFamily: 'var(--font-display)',
              backgroundColor: filterStatus === 'all' ? 'var(--brown-900)' : 'transparent',
              color: filterStatus === 'all' ? 'var(--cream)' : 'var(--brown-800)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
          >
            All Invoices ({totalCount})
          </button>

          <button
            onClick={() => setFilterStatus('due')}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: filterStatus === 'due' ? 700 : 500,
              fontFamily: 'var(--font-display)',
              backgroundColor: filterStatus === 'due' ? 'var(--brown-900)' : 'transparent',
              color: filterStatus === 'due' ? 'var(--cream)' : 'var(--brown-800)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
          >
            Outstanding Dues ({dueInvoicesCount})
          </button>

          <button
            onClick={() => setFilterStatus('paid')}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: filterStatus === 'paid' ? 700 : 500,
              fontFamily: 'var(--font-display)',
              backgroundColor: filterStatus === 'paid' ? 'var(--brown-900)' : 'transparent',
              color: filterStatus === 'paid' ? 'var(--cream)' : 'var(--brown-800)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
          >
            Fully Settled ({totalCount - dueInvoicesCount})
          </button>
        </div>

        {/* Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#FAF7F2',
            padding: '6px 14px',
            borderRadius: 999,
            border: '1px solid rgba(208, 174, 146, 0.45)',
            width: 260,
          }}
        >
          <Search size={14} color="var(--brown-600)" />
          <input
            type="text"
            placeholder="Search invoice number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: 12,
              fontFamily: 'var(--font-body)',
              color: 'var(--brown-900)',
              width: '100%',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                color: 'var(--brown-600)',
                display: 'flex',
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── 5. Invoices List / Table ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--brown-600)' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Loading accounting invoices...</div>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 20,
            padding: '64px 32px',
            textAlign: 'center',
            border: '1px solid rgba(208, 174, 146, 0.35)',
          }}
        >
          <Receipt size={36} color="var(--brown-500)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--brown-900)', margin: '0 0 6px' }}>
            No invoices found
          </h3>
          <p style={{ fontSize: 13, color: 'var(--brown-600)', margin: 0 }}>
            No invoice records match your active search or status filter.
          </p>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 20,
            overflow: 'hidden',
            border: '1px solid rgba(208, 174, 146, 0.35)',
            boxShadow: '0 4px 16px rgba(74, 58, 52, 0.05)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr
                style={{
                  backgroundColor: 'rgba(235, 215, 190, 0.4)',
                  borderBottom: '1px solid rgba(208, 174, 146, 0.4)',
                }}
              >
                <th style={{ padding: '14px 20px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)', textTransform: 'uppercase', color: 'var(--brown-800)', letterSpacing: '0.04em' }}>
                  Invoice #
                </th>
                <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)', textTransform: 'uppercase', color: 'var(--brown-800)', letterSpacing: '0.04em' }}>
                  Dates
                </th>
                <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)', textTransform: 'uppercase', color: 'var(--brown-800)', letterSpacing: '0.04em' }}>
                  Status
                </th>
                <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)', textTransform: 'uppercase', color: 'var(--brown-800)', letterSpacing: '0.04em', textAlign: 'right' }}>
                  Total Invoiced
                </th>
                <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)', textTransform: 'uppercase', color: 'var(--brown-800)', letterSpacing: '0.04em', textAlign: 'right' }}>
                  Paid Amount
                </th>
                <th style={{ padding: '14px 16px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)', textTransform: 'uppercase', color: 'var(--brown-800)', letterSpacing: '0.04em', textAlign: 'right' }}>
                  Outstanding
                </th>
                <th style={{ padding: '14px 20px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)', textTransform: 'uppercase', color: 'var(--brown-800)', letterSpacing: '0.04em', textAlign: 'right' }}>
                  Action &amp; Settle
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((row, idx) => {
                const due = new Decimal(row.amountDue || '0');
                const isPaying = payingId === row.id;
                const isEven = idx % 2 === 0;

                return (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/portal/invoices/${row.id}`)}
                    style={{
                      backgroundColor: isEven ? '#FFFFFF' : 'rgba(249, 246, 240, 0.5)',
                      borderBottom: '1px solid rgba(208, 174, 146, 0.25)',
                      cursor: 'pointer',
                      transition: 'background 120ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(235, 215, 190, 0.35)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isEven ? '#FFFFFF' : 'rgba(249, 246, 240, 0.5)';
                    }}
                  >
                    {/* Invoice Number */}
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText size={15} color="var(--brown-600)" />
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--brown-900)' }}>
                          {row.number}
                        </span>
                      </div>
                    </td>

                    {/* Dates */}
                    <td style={{ padding: '16px 16px', fontSize: 12 }}>
                      <div style={{ fontWeight: 600, color: 'var(--brown-900)' }}>
                        {row.invoiceDate ? new Date(row.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--brown-500)', marginTop: 2 }}>
                        Due: {row.dueDate ? new Date(row.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '16px 16px' }}>
                      <StatusBadge
                        status={
                          row.paymentStatus === 'paid'
                            ? 'paid'
                            : row.paymentStatus === 'partial'
                            ? 'partial'
                            : 'not_paid'
                        }
                      />
                    </td>

                    {/* Total Invoiced */}
                    <td
                      style={{
                        padding: '16px 16px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--brown-900)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatINR(row.total)}
                    </td>

                    {/* Paid Amount */}
                    <td
                      style={{
                        padding: '16px 16px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--posted)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatINR(row.amountPaid)}
                    </td>

                    {/* Outstanding */}
                    <td
                      style={{
                        padding: '16px 16px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 14,
                        fontWeight: 800,
                        color: due.gt(0) ? 'var(--danger)' : 'var(--posted)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatINR(row.amountDue)}
                    </td>

                    {/* Action & Settle Buttons */}
                    <td style={{ padding: '16px 20px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                        {due.gt(0) ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInitiateRazorpay(row);
                            }}
                            disabled={isPaying}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '7px 14px',
                              borderRadius: 999,
                              backgroundColor: 'var(--brown-900)',
                              color: 'var(--cream)',
                              border: 'none',
                              fontSize: 12,
                              fontWeight: 700,
                              fontFamily: 'var(--font-display)',
                              cursor: isPaying ? 'wait' : 'pointer',
                              boxShadow: '0 2px 8px rgba(74, 58, 52, 0.18)',
                              transition: 'all 140ms ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isPaying) e.currentTarget.style.backgroundColor = '#2E221D';
                            }}
                            onMouseLeave={(e) => {
                              if (!isPaying) e.currentTarget.style.backgroundColor = 'var(--brown-900)';
                            }}
                          >
                            <Zap size={12} color="#F2C94C" />
                            <span>{isPaying ? 'Processing…' : 'Pay via Razorpay'}</span>
                          </button>
                        ) : (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              fontFamily: 'var(--font-display)',
                              color: 'var(--posted)',
                              backgroundColor: 'var(--posted-bg)',
                              padding: '5px 12px',
                              borderRadius: 999,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <CheckCircle2 size={13} />
                            <span>Settled</span>
                          </span>
                        )}

                        <a
                          href={`/api/portal/invoices/${row.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download signed PDF invoice"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(235, 215, 190, 0.4)',
                            border: '1px solid rgba(208, 174, 146, 0.5)',
                            color: 'var(--brown-800)',
                            textDecoration: 'none',
                            transition: 'all 120ms ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--brown-900)';
                            e.currentTarget.style.color = 'var(--cream)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(235, 215, 190, 0.4)';
                            e.currentTarget.style.color = 'var(--brown-800)';
                          }}
                        >
                          <Download size={13} />
                        </a>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/portal/invoices/${row.id}`);
                          }}
                          title="View detailed lines"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: 'transparent',
                            border: '1px solid rgba(208, 174, 146, 0.4)',
                            color: 'var(--brown-700)',
                            cursor: 'pointer',
                            transition: 'all 120ms ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--brown-900)';
                            e.currentTarget.style.color = 'var(--brown-900)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(208, 174, 146, 0.4)';
                            e.currentTarget.style.color = 'var(--brown-700)';
                          }}
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PortalInvoiceList;
