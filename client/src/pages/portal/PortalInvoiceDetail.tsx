import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Decimal from 'decimal.js';
import StatusBadge from '../../components/ui/StatusBadge';
import { formatINR } from '../../lib/money';
import { loadRazorpayScript } from '../../lib/razorpay';
import api from '../../lib/axios';
import { Award, ShieldCheck, Printer, X, Sparkles, CheckCircle, Download } from 'lucide-react';
import { playWoodClick, playChimeSuccess } from '../../lib/soundEffects';

/* ─── types ──────────────────────────────────────────────────────────── */
interface InvoiceLine {
  lineNo: number;
  productName: string;
  qty: string;
  unitPrice: string;
  taxRate: string;
  total: string;
}

interface PaymentHistoryItem {
  allocationId: number;
  paymentId: number;
  paymentNumber: string;
  paymentDate: string;
  method: 'cash' | 'bank' | 'razorpay';
  direction: 'inbound' | 'outbound';
  amount: string;
  runningRemaining: string;
}

interface InvoiceDetail {
  id: number;
  number: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  paymentStatus: string;
  customerName?: string;
  lines: InvoiceLine[];
  payments: PaymentHistoryItem[];
}

type PayMethod = 'cash' | 'bank' | 'razorpay';
type PayStep = 'form' | 'confirm' | 'success';

/* ─── helpers ────────────────────────────────────────────────────────── */
function MetaField({ label, value, mono = false, color }: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  color?: string;
}) {
  return (
    <div>
      <p style={{ fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--brown-600)', margin: '0 0 4px' }}>
        {label}
      </p>
      <p style={{ fontSize: 14, fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)', fontWeight: 600, color: color ?? 'var(--brown-900)', margin: 0, fontVariantNumeric: mono ? 'tabular-nums' : undefined }}>
        {value}
      </p>
    </div>
  );
}

function MethodToggle({ value, onChange }: { value: PayMethod; onChange: (m: PayMethod) => void }) {
  const btn = (m: PayMethod, label: string) => {
    const active = value === m;
    return (
      <button
        type="button"
        onClick={() => onChange(m)}
        style={{
          flex: 1,
          padding: '8px 0',
          fontSize: 12,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          border: '1px solid',
          borderColor: active ? 'var(--brown-900)' : 'var(--brown-300)',
          background: active ? 'var(--brown-900)' : 'var(--surface)',
          color: active ? 'var(--cream)' : 'var(--brown-700)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          transition: 'all 120ms ease-out',
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {btn('razorpay', '⚡ Razorpay Online')}
      {btn('bank', '🏦 Bank Transfer')}
      {btn('cash', '💵 Cash')}
    </div>
  );

}

/* ─── main component ─────────────────────────────────────────────────── */
export const PortalInvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invoiceId = Number(id);

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* payment inline-panel state */
  const [panelOpen, setPanelOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>('bank');
  const [payAmount, setPayAmount] = useState('');
  const [payStep, setPayStep] = useState<PayStep>('form');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccessMsg, setPaySuccessMsg] = useState<string | null>(null);

  /* PDF download loading */
  const [pdfLoading, setPdfLoading] = useState(false);

  /* Certificate modal state */
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [certLoading, setCertLoading] = useState(false);
  const [certificate, setCertificate] = useState<any | null>(null);

  // Step-by-step Back Handler ("one by one back")
  const handleBack = useCallback(() => {
    // 1. If certificate modal is open, close it
    if (certModalOpen) {
      setCertModalOpen(false);
      return;
    }
    // 2. If payment inline-panel is open, close it
    if (panelOpen) {
      setPanelOpen(false);
      setPayStep('form');
      setPayError(null);
      return;
    }
    // 3. Otherwise navigate back in history one step
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/portal/invoices');
    }
  }, [certModalOpen, panelOpen, navigate]);

  // Intercept browser back button when certificate modal or payment panel is open
  useEffect(() => {
    if (certModalOpen || panelOpen) {
      window.history.pushState({ invoiceModal: true }, '');
      const handlePop = () => {
        if (certModalOpen) {
          setCertModalOpen(false);
          return;
        }
        if (panelOpen) {
          setPanelOpen(false);
          setPayStep('form');
          setPayError(null);
          return;
        }
      };
      window.addEventListener('popstate', handlePop);
      return () => {
        window.removeEventListener('popstate', handlePop);
      };
    }
  }, [certModalOpen, panelOpen]);

  const handleOpenCertificate = async () => {
    playWoodClick(1.1);
    setCertLoading(true);
    try {
      const res = await api.get(`/api/portal/invoices/${invoiceId}/certificate`);
      if (res.data?.data) {
        setCertificate(res.data.data);
        playChimeSuccess();
        setCertModalOpen(true);
      }
    } catch (err: any) {
      console.error('Failed to load certificate:', err);
    } finally {
      setCertLoading(false);
    }
  };

  const fetchInvoice = () => {
    setLoading(true);
    api.get(`/api/portal/invoices/${invoiceId}`)
      .then(res => {
        if (res.data?.data) {
          setInvoice(res.data.data);
          setPayAmount(res.data.data.amountDue || '0.00');
        } else if (res.data?.error) {
          setError(res.data.error.message);
        }
      })
      .catch(err => setError(err?.response?.data?.error?.message || err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchInvoice(); }, [invoiceId]);

  /* ── payment handlers ── */
  const openPanel = () => {
    if (!invoice) return;
    setPayAmount(invoice.amountDue);
    setPayStep('form');
    setPayError(null);
    setPaySuccessMsg(null);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setPayStep('form');
    setPayError(null);
  };

  const handlePayFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPayError(null);
    const amt = new Decimal(payAmount || '0');
    if (amt.lte(0)) { setPayError('Amount must be greater than zero'); return; }
    if (invoice && amt.gt(new Decimal(invoice.amountDue))) {
      setPayError(`Cannot exceed outstanding amount of ${formatINR(invoice.amountDue)}`);
      return;
    }
    setPayStep('confirm');
  };

  const handlePayConfirm = async () => {
    setPaySubmitting(true);
    setPayError(null);

    if (payMethod === 'razorpay') {
      try {
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) throw new Error('Could not load Razorpay SDK');

        const orderRes = await api.post(`/api/portal/invoices/${invoiceId}/razorpay/create-order`, {
          amount: new Decimal(payAmount).toFixed(2),
        });
        const order = orderRes.data?.data;
        if (!order) throw new Error(orderRes.data?.error?.message || 'Failed to create Razorpay order');

        const rzpKey = (window as any).__VITE_RAZORPAY_KEY_ID__ || (import.meta as any).env?.VITE_RAZORPAY_KEY_ID || 'rzp_test_TYL9FJAZxMYoFc';

        const orderId = order.orderId || order.id;

        const rzp = new (window as any).Razorpay({
          key: rzpKey,
          amount: order.amount,
          currency: order.currency || 'INR',
          name: 'Urban Furniture',
          description: `Payment for Invoice ${invoice?.number ?? invoiceId}`,
          order_id: orderId,
          prefill: {
            name: invoice?.customerName || '',
          },
          theme: { color: '#77574A' },
          handler: async (response: any) => {
            try {
              const verifyRes = await api.post(`/api/portal/invoices/${invoiceId}/razorpay/verify-payment`, {
                razorpay_order_id: response.razorpay_order_id || orderId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                amount: new Decimal(payAmount).toFixed(2),
              });
              if (verifyRes.data?.error) throw new Error(verifyRes.data.error.message || 'Verification failed');

              setPaySuccessMsg(`Payment ${response.razorpay_payment_id} verified & posted to General Ledger! PDF receipt emailed.`);
              setPayStep('success');
              setTimeout(() => { closePanel(); fetchInvoice(); }, 1800);
            } catch (vErr: any) {
              setPayError(vErr?.response?.data?.error?.message || vErr.message || 'Signature verification failed');
              setPayStep('form');
            }
          },
          modal: {
            ondismiss: () => {
              setPaySubmitting(false);
            },
          },
        });
        rzp.open();
        return;
      } catch (err: any) {
        setPayError(err?.response?.data?.error?.message || err.message || 'Razorpay initiation failed');
        setPayStep('form');
        setPaySubmitting(false);
        return;
      }
    }

    try {
      const res = await api.post(`/api/portal/invoices/${invoiceId}/pay`, {
        amount: new Decimal(payAmount).toFixed(2),
        method: payMethod,
      });
      if (res.data?.error) throw new Error(res.data.error.message || 'Payment failed');
      setPaySuccessMsg(`${formatINR(new Decimal(payAmount).toFixed(2))} via ${payMethod === 'bank' ? 'Bank Transfer' : 'Cash'} recorded successfully.`);
      setPayStep('success');
      setTimeout(() => { closePanel(); fetchInvoice(); }, 1800);

    } catch (err: any) {
      setPayError(err?.response?.data?.error?.message || err.message || 'Payment submission failed');
      setPayStep('form');
    } finally {
      setPaySubmitting(false);
    }
  };

  /* ── PDF download ── */
  const handleDownloadPdf = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      const token = localStorage.getItem('urban_token') || localStorage.getItem('urban_portal_token');
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/portal/invoices/${invoiceId}/pdf`, {
        credentials: 'include',
        headers,
      });
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/pdf')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Invoice-${invoice?.number ?? invoiceId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        /* fallback: server returned HTML (Puppeteer unavailable) — open print view */
        const html = await res.text();
        const win = window.open('', '_blank');
        if (win) { win.document.write(html); win.document.close(); win.print(); }
      }
    } catch {
      /* silently open in new tab as last resort */
      window.open(`/api/portal/invoices/${invoiceId}/pdf`, '_blank');
    } finally {
      setPdfLoading(false);
    }
  };

  /* ─── loading / error states ─────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ padding: '64px 0', textAlign: 'center', color: 'var(--brown-600)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
        Loading invoice details…
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div style={{ padding: '32px 0', fontFamily: 'var(--font-body)' }}>
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', padding: '24px', color: 'var(--danger)' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, margin: '0 0 8px' }}>Access Error</p>
          <p style={{ fontSize: 13, margin: '0 0 16px' }}>{error || 'Invoice not found or unauthorized'}</p>
          <button
            onClick={handleBack}
            style={{ padding: '6px 14px', background: 'var(--surface)', border: '1px solid var(--brown-300)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600, color: 'var(--brown-900)', cursor: 'pointer' }}
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  const isFullyPaid = new Decimal(invoice.amountDue).lte(0);
  const paidPct = new Decimal(invoice.total).gt(0)
    ? Math.min(100, new Decimal(invoice.amountPaid).div(invoice.total).mul(100).toNumber())
    : 0;

  const methodLabel = payMethod === 'bank' ? 'Bank Transfer' : 'Cash';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: 'var(--font-body)' }}>

      {/* ── Sticky top bar ────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 16px',
          background: 'var(--surface)',
          border: '1px solid rgba(208, 174, 146, 0.4)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-sm)',
          position: 'sticky',
          top: 80, /* clear the portal header */
          zIndex: 20,
        }}
      >
        {/* Left: back + invoice number + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button
            onClick={handleBack}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--brown-700)', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            ← Back
          </button>
          <div style={{ width: 1, height: 16, background: 'var(--brown-300)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color: 'var(--brown-900)' }}>
            {invoice.number}
          </span>
          <StatusBadge
            status={
              invoice.paymentStatus === 'paid' ? 'paid'
              : invoice.paymentStatus === 'partial' ? 'partial'
              : 'not_paid'
            }
          />
        </div>

        {/* Right: action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleOpenCertificate}
            disabled={certLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              fontSize: 12,
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              background: 'rgba(74, 58, 52, 0.06)',
              border: '1px solid rgba(208, 174, 146, 0.6)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--brown-900)',
              cursor: certLoading ? 'wait' : 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 120ms ease-out',
            }}
          >
            <Award size={14} color="var(--posted)" />
            <span>{certLoading ? 'Loading…' : 'Provenance Certificate'}</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600,
              background: 'var(--surface)', border: '1px solid var(--brown-300)', borderRadius: 'var(--radius-sm)',
              color: 'var(--brown-800)', cursor: pdfLoading ? 'wait' : 'pointer',
              boxShadow: 'var(--shadow-sm)', transition: 'background 120ms ease-out',
              opacity: pdfLoading ? 0.65 : 1,
            }}
          >
            <span>📄</span>
            <span>{pdfLoading ? 'Generating…' : 'Download PDF'}</span>
          </button>

          {!isFullyPaid && (
            <button
              onClick={openPanel}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700,
                background: 'var(--brown-900)', border: 'none', borderRadius: 'var(--radius-sm)',
                color: 'var(--cream)', cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
                transition: 'background 120ms ease-out', letterSpacing: '0.04em',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--brown-700)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--brown-900)')}
            >
              <span>⚡</span>
              <span>Record Payment</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

          {/* Invoice header */}
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(208, 174, 146, 0.4)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '24px 28px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--brown-500)', margin: '0 0 6px' }}>
              Official Tax Invoice
            </p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, color: 'var(--brown-900)', margin: '0 0 20px' }}>
              {invoice.number}
            </h1>

            {/* Meta fields grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px 24px' }}>
              <MetaField label="Invoice Date" value={invoice.invoiceDate} mono />
              <MetaField label="Due Date" value={invoice.dueDate || 'Immediate'} mono />
              {invoice.customerName && <MetaField label="Billed To" value={invoice.customerName} />}
            </div>
          </div>

          {/* Line items table */}
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(208, 174, 146, 0.4)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(208, 174, 146, 0.4)' }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--brown-900)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Billed Items
              </p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--brown-100)' }}>
                    {['#', 'Product / Description', 'Qty', 'Unit Price', 'Tax', 'Total'].map((h, i) => (
                      <th key={i} style={{
                        padding: '10px 14px', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brown-700)',
                        textAlign: i === 0 ? 'center' : i >= 2 ? 'right' : 'left',
                        borderBottom: '1px solid rgba(208, 174, 146, 0.4)', whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map(line => (
                    <tr key={line.lineNo} style={{ borderBottom: '1px solid rgba(208, 174, 146, 0.22)' }}>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--brown-500)' }}>{line.lineNo}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--brown-900)' }}>{line.productName}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--brown-800)', fontVariantNumeric: 'tabular-nums' }}>{line.qty}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--brown-800)', fontVariantNumeric: 'tabular-nums' }}>{formatINR(line.unitPrice)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--brown-600)', fontVariantNumeric: 'tabular-nums' }}>{line.taxRate}%</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--brown-900)', fontVariantNumeric: 'tabular-nums' }}>{formatINR(line.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Subtotal / Tax / Total summary */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px', borderTop: '1px solid rgba(208, 174, 146, 0.4)' }}>
              <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Subtotal', value: invoice.subtotal, color: 'var(--brown-700)', size: 13 },
                  { label: 'GST / Tax', value: invoice.taxTotal, color: 'var(--brown-700)', size: 13 },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: row.size, color: row.color }}>
                    <span style={{ fontFamily: 'var(--font-body)' }}>{row.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{formatINR(row.value)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: 'var(--brown-900)', paddingTop: 8, borderTop: '2px solid var(--brown-300)', marginTop: 2 }}>
                  <span style={{ fontFamily: 'var(--font-body)' }}>Grand Total</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{formatINR(invoice.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* Payment status card */}
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(208, 174, 146, 0.4)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '20px' }}>
            <p style={{ margin: '0 0 16px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brown-700)' }}>
              Payment Status
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Invoice Total', value: invoice.total, color: 'var(--brown-900)' },
                { label: 'Amount Paid', value: invoice.amountPaid, color: 'var(--posted)' },
                { label: 'Outstanding', value: invoice.amountDue, color: isFullyPaid ? 'var(--posted)' : 'var(--danger)', bold: true },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--brown-600)' }}>{row.label}</span>
                  <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: row.bold ? 700 : 500, color: row.color, fontVariantNumeric: 'tabular-nums' }}>
                    {formatINR(row.value)}
                  </span>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div style={{ marginTop: 14, height: 6, borderRadius: 99, background: 'var(--brown-100)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${paidPct}%`, background: 'var(--posted)', borderRadius: 99, transition: 'width 400ms ease-out' }} />
            </div>
            <p style={{ marginTop: 6, fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--brown-500)', textAlign: 'right' }}>
              {paidPct.toFixed(0)}% paid
            </p>
          </div>

          {/* ── Inline payment panel ─────────────────────────────────── */}
          {panelOpen && (
            <div style={{ background: 'var(--surface)', border: '1px solid rgba(208, 174, 146, 0.4)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brown-700)' }}>
                  Record Payment
                </p>
                <button onClick={closePanel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--brown-500)', lineHeight: 1, padding: 2 }}>✕</button>
              </div>

              {payError && (
                <div style={{ padding: '8px 12px', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: 12, fontFamily: 'var(--font-body)', marginBottom: 12 }}>
                  {payError}
                </div>
              )}

              {payStep === 'success' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', background: 'var(--posted-bg)', border: '1px solid var(--posted)', borderRadius: 'var(--radius-sm)', color: 'var(--posted)', fontSize: 13, fontFamily: 'var(--font-body)' }}>
                  <div style={{ fontWeight: 600 }}>✓ {paySuccessMsg}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <a
                      href={`/api/portal/invoices/${invoiceId}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 14px',
                        borderRadius: 6,
                        backgroundColor: 'var(--brown-900)',
                        color: 'var(--cream)',
                        textDecoration: 'none',
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      <Download size={13} />
                      <span>Download Official PDF Receipt</span>
                    </a>
                  </div>
                </div>
              )}

              {payStep === 'form' && (
                <form onSubmit={handlePayFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Method toggle */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--brown-700)', marginBottom: 8 }}>
                      Payment Method
                    </label>
                    <MethodToggle value={payMethod} onChange={setPayMethod} />
                  </div>

                  {/* Amount input */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--brown-700)', marginBottom: 6 }}>
                      Amount (₹)
                    </label>
                    <input
                      type="text"
                      required
                      value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', background: 'var(--cream)', border: '1px solid var(--brown-300)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 15, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brown-900)', outline: 'none', fontVariantNumeric: 'tabular-nums' }}
                    />
                    <p style={{ margin: '5px 0 0', fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--brown-500)' }}>
                      Outstanding: {formatINR(invoice.amountDue)}. Partial payment allowed.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={closePanel} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brown-600)' }}>
                      Cancel
                    </button>
                    <button type="submit" style={{ padding: '7px 16px', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.04em', background: 'var(--brown-900)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                      Review →
                    </button>
                  </div>
                </form>
              )}

              {payStep === 'confirm' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Confirmation summary */}
                  <div style={{ background: 'var(--cream)', border: '1px solid var(--brown-300)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 10px', fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--brown-600)', fontWeight: 600 }}>
                      Confirm this payment?
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--brown-700)' }}>Amount</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color: 'var(--brown-900)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatINR(new Decimal(payAmount).toFixed(2))}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--brown-700)' }}>Method</span>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600, color: 'var(--brown-900)' }}>{methodLabel}</span>
                    </div>
                    <p style={{ margin: '10px 0 0', fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--brown-500)' }}>
                      This will post a ledger entry and update the invoice balance immediately.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setPayStep('form')} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brown-600)' }}>
                      ← Edit
                    </button>
                    <button
                      onClick={handlePayConfirm}
                      disabled={paySubmitting}
                      style={{ padding: '7px 16px', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.04em', background: paySubmitting ? 'var(--brown-600)' : 'var(--posted)', color: 'var(--cream)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: paySubmitting ? 'wait' : 'pointer', opacity: paySubmitting ? 0.72 : 1 }}
                    >
                      {paySubmitting ? 'Processing…' : 'Confirm Payment'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment history */}
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(208, 174, 146, 0.4)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(208, 174, 146, 0.4)' }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brown-700)' }}>
                Payment History
              </p>
            </div>

            {invoice.payments.length === 0 ? (
              <div style={{ padding: '24px 20px', textAlign: 'center', fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--brown-500)' }}>
                No payments recorded yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--brown-100)' }}>
                      {['Date', 'Ref #', 'Method', 'Amount', 'Remaining'].map((h, i) => (
                        <th key={i} style={{ padding: '8px 14px', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brown-700)', textAlign: i >= 3 ? 'right' : 'left', borderBottom: '1px solid rgba(208, 174, 146, 0.4)', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.map(p => (
                      <tr key={p.allocationId} style={{ borderBottom: '1px solid rgba(208, 174, 146, 0.20)' }}>
                        <td style={{ padding: '8px 14px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--brown-700)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{p.paymentDate}</td>
                        <td style={{ padding: '8px 14px', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--brown-900)', whiteSpace: 'nowrap' }}>{p.paymentNumber}</td>
                        <td style={{ padding: '8px 14px' }}>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600, textTransform: 'capitalize', padding: '2px 8px', borderRadius: 99, background: 'var(--brown-100)', color: 'var(--brown-800)' }}>
                            {p.method}
                          </span>
                        </td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--posted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatINR(p.amount)}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--brown-600)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatINR(p.runningRemaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Responsive: collapse to single column on small screens ─────── */}
      <style>{`
        @media (max-width: 768px) {
          .portal-detail-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* ── Certificate of Handcrafted Authenticity Modal ──────────────── */}
      {certModalOpen && certificate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(74, 58, 52, 0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setCertModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFDF9',
              borderRadius: 'var(--radius-md)',
              border: '2px solid #C4975A',
              boxShadow: '0 25px 60px rgba(74, 58, 52, 0.35)',
              maxWidth: 580,
              width: '100%',
              padding: 36,
              position: 'relative',
              textAlign: 'center',
              backgroundImage: 'radial-gradient(circle at center, rgba(196, 151, 90, 0.04) 0%, transparent 70%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setCertModalOpen(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brown-600)' }}
            >
              <X size={18} />
            </button>

            {/* Emblem Seal */}
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                backgroundColor: '#F7EEDB',
                border: '2px solid #C4975A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                color: '#8A6229',
              }}
            >
              <ShieldCheck size={28} />
            </div>

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8A6229', marginBottom: 4 }}>
              URBAN FURNITURE ARCHITECTURAL ATELIER
            </div>

            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--brown-900)', margin: '0 0 6px', letterSpacing: '0.02em' }}>
              Certificate of Handcrafted Authenticity
            </h2>

            <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--brown-600)', margin: '0 0 20px' }}>
              {certificate.certificateNumber} · Verified Record #{invoiceId}
            </p>

            <div style={{ borderTop: '1px solid #E2D2BC', borderBottom: '1px solid #E2D2BC', padding: '16px 0', marginBottom: 20, textAlign: 'left' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--brown-500)', letterSpacing: '0.05em' }}>
                    Certified Owner
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brown-900)', marginTop: 2 }}>
                    {certificate.issuedTo}
                  </div>
                  {certificate.cityState && (
                    <div style={{ fontSize: 11, color: 'var(--brown-600)' }}>{certificate.cityState}</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--brown-500)', letterSpacing: '0.05em' }}>
                    Issue Date & Status
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brown-900)', marginTop: 2 }}>
                    {certificate.issueDate}
                  </div>
                  <div style={{ fontSize: 11, color: certificate.isSettled ? 'var(--posted)' : 'var(--warning)', fontWeight: 600 }}>
                    {certificate.isSettled ? '✓ Fully Settled & Backed' : 'Pending Payment Confirmation'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--brown-700)', fontWeight: 700, marginBottom: 8 }}>
                Certified Pieces & Wood Provenance:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {certificate.items.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'rgba(247, 238, 219, 0.5)',
                      borderRadius: 4,
                      border: '1px solid rgba(196, 151, 90, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--brown-900)' }}>{item.productName}</div>
                      <div style={{ fontSize: 10, color: 'var(--brown-600)' }}>
                        Provenance: {item.woodSpecies} · Serial: {item.serialNumber}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 10, color: '#8A6229', fontWeight: 600 }}>
                      {item.warranty}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--brown-900)' }}>
                  Urban Furniture Verification Seal
                </div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--brown-500)' }}>
                  100% Zero-VOC Oils · Sustainable Forest Certified
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--brown-900)',
                    color: 'var(--cream)',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Printer size={13} />
                  Print Certificate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
