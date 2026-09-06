import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '../../lib/money';
import api from '../../lib/axios';
import {
  ShoppingBag,
  FileText,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Sparkles,
  X,
} from 'lucide-react';

export interface OrderLineItem {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  qty: string;
  unitPrice: string;
  taxRate: string;
  total: string;
}

export interface PortalOrderListItem {
  id: number;
  number: string;
  orderDate: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  subtotal: string;
  taxTotal: string;
  total: string;
  invoiceId: number | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
  paymentStatus: 'not_paid' | 'partial' | 'paid' | null;
  amountDue: string | null;
  lines: OrderLineItem[];
}

export const PortalOrderList: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PortalOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'confirmed' | 'draft' | 'due'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());

  const fetchOrders = useCallback(() => {
    setLoading(true);
    api.get('/api/portal/orders')
      .then((res) => {
        if (res.data?.data) {
          setOrders(res.data.data);
          // Auto-expand the first order for immediate visibility
          if (res.data.data.length > 0) {
            setExpandedOrders(new Set([res.data.data[0].id]));
          }
        } else if (res.data?.error) {
          setError(res.data.error.message);
        }
      })
      .catch((err) => setError(err?.response?.data?.error?.message || err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const toggleExpand = (orderId: number) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // KPIs
  const totalOrders = orders.length;
  const confirmedCount = orders.filter((o) => o.status === 'confirmed').length;
  const unpaidInvoicesCount = orders.filter(
    (o) => o.invoiceId && (o.paymentStatus === 'not_paid' || o.paymentStatus === 'partial') && parseFloat(o.amountDue || '0') > 0
  ).length;
  const totalVolume = orders.reduce((sum, o) => sum + parseFloat(o.total || '0'), 0);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Filter tab
      if (filterStatus === 'confirmed' && o.status !== 'confirmed') return false;
      if (filterStatus === 'draft' && o.status !== 'draft') return false;
      if (filterStatus === 'due') {
        const hasDue = o.invoiceId && parseFloat(o.amountDue || '0') > 0;
        if (!hasDue) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNumber = o.number.toLowerCase().includes(q);
        const matchesInvoice = o.invoiceNumber?.toLowerCase().includes(q);
        const matchesProduct = o.lines?.some((l) =>
          l.productName.toLowerCase().includes(q) || l.sku.toLowerCase().includes(q)
        );
        if (!matchesNumber && !matchesInvoice && !matchesProduct) return false;
      }

      return true;
    });
  }, [orders, filterStatus, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 1280, margin: '0 auto' }}>
      {/* ── 1. Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--brown-600)',
              }}
            >
              Customer Order Hub
            </span>
            <span style={{ fontSize: 11, color: 'var(--brown-400)' }}>•</span>
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--brown-600)',
                backgroundColor: 'rgba(208, 174, 146, 0.3)',
                padding: '2px 8px',
                borderRadius: 999,
              }}
            >
              Real-time Database Sync
            </span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--brown-900)',
              margin: '0 0 6px',
              letterSpacing: '-0.02em',
            }}
          >
            My Furniture Orders
          </h1>
          <p style={{ fontSize: 14, color: 'var(--brown-700)', margin: 0, maxWidth: 640 }}>
            Every Sales Order entered on the atelier console is recorded in PostgreSQL and synced here. Review your ordered items, inspect linked invoices, and settle balances seamlessly via Razorpay.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/portal/catalogue')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 999,
            backgroundColor: 'var(--brown-900)',
            color: 'var(--cream)',
            border: 'none',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(46, 34, 29, 0.15)',
            transition: 'all 140ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#1F1714';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--brown-900)';
          }}
        >
          <Sparkles size={14} color="#F2C94C" />
          <span>Browse Atelier Catalogue</span>
        </button>
      </div>

      {/* Error alert */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid rgba(158, 74, 56, 0.3)',
            borderRadius: 12,
            color: 'var(--danger)',
            fontSize: 13,
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* ── 2. KPI Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {/* Total Orders */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 18,
            padding: '22px 24px',
            border: '1px solid rgba(208, 174, 146, 0.35)',
            boxShadow: '0 4px 16px rgba(74, 58, 52, 0.05)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brown-600)', marginBottom: 10 }}>
            Total Orders Placed
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 800, color: 'var(--brown-900)' }}>
            {totalOrders}
          </div>
          <div style={{ fontSize: 12, color: 'var(--brown-500)', marginTop: 4 }}>
            Recorded in Database
          </div>
        </div>

        {/* Confirmed Orders */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 18,
            padding: '22px 24px',
            border: '1px solid rgba(208, 174, 146, 0.35)',
            boxShadow: '0 4px 16px rgba(74, 58, 52, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brown-600)' }}>
              Confirmed Orders
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--posted)', backgroundColor: 'var(--posted-bg)', padding: '2px 8px', borderRadius: 999 }}>
              Verified
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 800, color: 'var(--posted)' }}>
            {confirmedCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--brown-500)', marginTop: 4 }}>
            {totalOrders - confirmedCount} in draft review
          </div>
        </div>

        {/* Action Required: Unpaid Invoices */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 18,
            padding: '22px 24px',
            border: unpaidInvoicesCount > 0 ? '1px solid rgba(158, 74, 56, 0.4)' : '1px solid rgba(208, 174, 146, 0.35)',
            boxShadow: '0 4px 16px rgba(74, 58, 52, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brown-600)' }}>
              Pending Invoices
            </span>
            {unpaidInvoicesCount > 0 ? (
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', padding: '2px 8px', borderRadius: 999 }}>
                Action Required
              </span>
            ) : (
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--posted)', backgroundColor: 'var(--posted-bg)', padding: '2px 8px', borderRadius: 999 }}>
                All Clear
              </span>
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 800, color: unpaidInvoicesCount > 0 ? 'var(--danger)' : 'var(--posted)' }}>
            {unpaidInvoicesCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--brown-500)', marginTop: 4 }}>
            Invoices awaiting payment
          </div>
        </div>

        {/* Total Order Value */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 18,
            padding: '22px 24px',
            border: '1px solid rgba(208, 174, 146, 0.35)',
            boxShadow: '0 4px 16px rgba(74, 58, 52, 0.05)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brown-600)', marginBottom: 10 }}>
            Cumulative Order Value
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 800, color: 'var(--brown-900)' }}>
            {formatINR(totalVolume.toFixed(2))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--brown-500)', marginTop: 4 }}>
            Inclusive of 18% GST
          </div>
        </div>
      </div>

      {/* ── 3. Filters & Search Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          backgroundColor: 'var(--surface)',
          padding: '12px 20px',
          borderRadius: 16,
          border: '1px solid rgba(208, 174, 146, 0.35)',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
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
            All Orders ({totalOrders})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('confirmed')}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: filterStatus === 'confirmed' ? 700 : 500,
              fontFamily: 'var(--font-display)',
              backgroundColor: filterStatus === 'confirmed' ? 'var(--brown-900)' : 'transparent',
              color: filterStatus === 'confirmed' ? 'var(--cream)' : 'var(--brown-800)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
          >
            Confirmed ({confirmedCount})
          </button>

          <button
            type="button"
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
            Pending Settlement ({unpaidInvoicesCount})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('draft')}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: filterStatus === 'draft' ? 700 : 500,
              fontFamily: 'var(--font-display)',
              backgroundColor: filterStatus === 'draft' ? 'var(--brown-900)' : 'transparent',
              color: filterStatus === 'draft' ? 'var(--cream)' : 'var(--brown-800)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
          >
            Draft ({totalOrders - confirmedCount})
          </button>
        </div>

        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#FAF7F2',
            padding: '6px 14px',
            borderRadius: 999,
            border: '1px solid rgba(208, 174, 146, 0.45)',
            width: 280,
          }}
        >
          <Search size={14} color="var(--brown-600)" />
          <input
            type="text"
            placeholder="Search order number or piece..."
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

      {/* ── 4. Orders List ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--brown-600)' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Syncing orders from PostgreSQL...</div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 20,
            padding: '64px 32px',
            textAlign: 'center',
            border: '1px solid rgba(208, 174, 146, 0.35)',
          }}
        >
          <ShoppingBag size={40} color="var(--brown-500)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--brown-900)', margin: '0 0 6px' }}>
            No orders found
          </h3>
          <p style={{ fontSize: 13, color: 'var(--brown-600)', margin: '0 0 18px' }}>
            No order records match your active search or status filter.
          </p>
          <button
            type="button"
            onClick={() => navigate('/portal/catalogue')}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              backgroundColor: 'var(--brown-900)',
              color: 'var(--cream)',
              border: 'none',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Explore Catalogue
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrders.has(order.id);
            const hasInvoice = !!order.invoiceId;
            const amountDue = parseFloat(order.amountDue || '0');
            const isSettled = order.paymentStatus === 'paid' || (hasInvoice && amountDue <= 0);

            return (
              <div
                key={order.id}
                style={{
                  backgroundColor: 'var(--surface)',
                  borderRadius: 18,
                  border: '1px solid rgba(208, 174, 146, 0.35)',
                  boxShadow: '0 4px 16px rgba(74, 58, 52, 0.04)',
                  overflow: 'hidden',
                  transition: 'all 140ms ease',
                }}
              >
                {/* Header Row */}
                <div
                  style={{
                    padding: '18px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 16,
                    backgroundColor: isExpanded ? 'rgba(235, 215, 190, 0.2)' : 'transparent',
                    borderBottom: isExpanded ? '1px solid rgba(208, 174, 146, 0.3)' : 'none',
                  }}
                >
                  {/* Left: Order number & Date */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button
                      type="button"
                      onClick={() => toggleExpand(order.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'var(--brown-700)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 16, color: 'var(--brown-900)' }}>
                          {order.number}
                        </span>

                        {order.status === 'confirmed' ? (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: 999,
                              color: 'var(--posted)',
                              backgroundColor: 'var(--posted-bg)',
                            }}
                          >
                            Confirmed Order
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: 999,
                              color: 'var(--brown-700)',
                              backgroundColor: 'rgba(208, 174, 146, 0.35)',
                            }}
                          >
                            Draft Order
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--brown-600)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={12} />
                        <span>
                          Ordered on{' '}
                          {order.orderDate
                            ? new Date(order.orderDate).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </span>
                        <span>•</span>
                        <span>{order.lines.length} {order.lines.length === 1 ? 'piece' : 'pieces'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Linked Invoice Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {hasInvoice ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          backgroundColor: 'rgba(240, 234, 224, 0.65)',
                          padding: '6px 14px',
                          borderRadius: 10,
                          border: '1px solid rgba(208, 174, 146, 0.45)',
                        }}
                      >
                        <FileText size={14} color="var(--brown-700)" />
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brown-800)' }}>
                            Invoice: <span style={{ fontFamily: 'var(--font-mono)' }}>{order.invoiceNumber}</span>
                          </div>
                          <div style={{ fontSize: 10.5, color: isSettled ? 'var(--posted)' : 'var(--danger)', fontWeight: 600 }}>
                            {isSettled
                              ? '✓ Fully Settled'
                              : `Due: ${formatINR(order.amountDue || '0')}`}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--brown-600)',
                          backgroundColor: 'rgba(208, 174, 146, 0.2)',
                          padding: '6px 12px',
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Clock size={12} />
                        <span>Awaiting Invoice Generation</span>
                      </div>
                    )}
                  </div>

                  {/* Right: Order Total & Primary Action Button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brown-500)', fontWeight: 700 }}>
                        Order Total
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: 'var(--brown-900)' }}>
                        {formatINR(order.total)}
                      </div>
                    </div>

                    {/* Pay / View Invoice Button */}
                    {hasInvoice ? (
                      amountDue > 0 ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/portal/invoices/${order.invoiceId}`)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '9px 16px',
                            borderRadius: 10,
                            backgroundColor: 'var(--brown-900)',
                            color: 'var(--cream)',
                            border: 'none',
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: 'var(--font-display)',
                            cursor: 'pointer',
                            boxShadow: '0 3px 8px rgba(46, 34, 29, 0.18)',
                            transition: 'all 120ms ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#1F1714';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--brown-900)';
                          }}
                        >
                          <Zap size={13} color="#F2C94C" />
                          <span>Pay via Razorpay</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigate(`/portal/invoices/${order.invoiceId}`)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '9px 16px',
                            borderRadius: 10,
                            backgroundColor: 'rgba(235, 215, 190, 0.45)',
                            color: 'var(--brown-900)',
                            border: '1px solid rgba(208, 174, 146, 0.6)',
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: 'var(--font-display)',
                            cursor: 'pointer',
                            transition: 'all 120ms ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(235, 215, 190, 0.8)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(235, 215, 190, 0.45)';
                          }}
                        >
                          <CheckCircle2 size={13} color="var(--posted)" />
                          <span>View Receipt</span>
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleExpand(order.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '9px 16px',
                          borderRadius: 10,
                          backgroundColor: 'rgba(235, 215, 190, 0.3)',
                          color: 'var(--brown-800)',
                          border: '1px solid rgba(208, 174, 146, 0.4)',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <span>{isExpanded ? 'Hide Details' : 'View Pieces'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Line Items Breakdown */}
                {isExpanded && (
                  <div style={{ padding: '20px 24px', backgroundColor: '#FAF8F5' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brown-600)', marginBottom: 12 }}>
                      Ordered Pieces &amp; Specifications
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(208, 174, 146, 0.35)', textAlign: 'left', color: 'var(--brown-700)' }}>
                            <th style={{ padding: '8px 12px', fontWeight: 700, textTransform: 'uppercase', fontSize: 10.5 }}>Furniture Piece</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700, textTransform: 'uppercase', fontSize: 10.5 }}>SKU</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700, textTransform: 'uppercase', fontSize: 10.5, textAlign: 'center' }}>Qty</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700, textTransform: 'uppercase', fontSize: 10.5, textAlign: 'right' }}>Unit Price</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700, textTransform: 'uppercase', fontSize: 10.5, textAlign: 'right' }}>GST Rate</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700, textTransform: 'uppercase', fontSize: 10.5, textAlign: 'right' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.lines.map((line, lIdx) => (
                            <tr
                              key={line.id || lIdx}
                              style={{
                                borderBottom: lIdx === order.lines.length - 1 ? 'none' : '1px solid rgba(208, 174, 146, 0.2)',
                              }}
                            >
                              <td style={{ padding: '12px', fontWeight: 600, color: 'var(--brown-900)' }}>
                                {line.productName}
                              </td>
                              <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', color: 'var(--brown-600)', fontSize: 11 }}>
                                {line.sku}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                {parseFloat(line.qty)}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--brown-800)' }}>
                                {formatINR(line.unitPrice)}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--brown-600)' }}>
                                {parseFloat(line.taxRate)}%
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brown-900)' }}>
                                {formatINR(line.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Invoice Link footer banner inside drawer */}
                    {hasInvoice && (
                      <div
                        style={{
                          marginTop: 16,
                          padding: '12px 16px',
                          borderRadius: 12,
                          backgroundColor: 'rgba(235, 215, 190, 0.35)',
                          border: '1px solid rgba(208, 174, 146, 0.45)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <FileText size={15} color="var(--brown-800)" />
                          <span style={{ fontSize: 12, color: 'var(--brown-900)', fontWeight: 600 }}>
                            Linked Tax Invoice: <strong style={{ fontFamily: 'var(--font-mono)' }}>{order.invoiceNumber}</strong>
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {amountDue > 0 ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/portal/invoices/${order.invoiceId}`)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 14px',
                                borderRadius: 8,
                                backgroundColor: 'var(--brown-900)',
                                color: 'var(--cream)',
                                border: 'none',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              <Zap size={11} color="#F2C94C" />
                              <span>Settle {formatINR(order.amountDue || '0')} with Razorpay</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => navigate(`/portal/invoices/${order.invoiceId}`)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '6px 12px',
                                borderRadius: 8,
                                backgroundColor: 'transparent',
                                color: 'var(--brown-900)',
                                border: '1px solid var(--brown-400)',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <span>View Receipt &amp; PDF</span>
                              <ExternalLink size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PortalOrderList;
