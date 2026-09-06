import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  Box,
  CheckCircle2,
  Clock,
  CreditCard,
  ChevronRight,
  Armchair,
  Bed,
  Utensils,
  Briefcase,
  ShieldCheck,
  Compass,
  LogIn,
  Layers,
  ExternalLink,
  ArrowUpRight,
  BadgeAlert,
  Zap,
  ShoppingBag,
  FileText,
} from 'lucide-react';
import { usePortalAuth } from './PortalAuthGuard';
import { formatINR } from '../../lib/money';
import api from '../../lib/axios';
import { resolveProductImage, resolveProductModel } from '../../lib/productMedia';

interface InvoiceSummary {
  totalDue: string;
  totalInvoiced: string;
  count: number;
}

interface ProductItem {
  id: number;
  name: string;
  category: string;
  sales_price: string;
  mrp: string | null;
  image_url: string | null;
  model_url: string | null;
}

interface RecentInvoice {
  id: number;
  number: string;
  invoiceDate: string;
  total: string;
  amountDue: string;
  paymentStatus: string;
}

interface RecentOrder {
  id: number;
  number: string;
  orderDate: string;
  status: string;
  total: string;
  invoiceId: number | null;
  invoiceNumber: string | null;
  paymentStatus: string | null;
  amountDue: string | null;
  lines: Array<{
    id: number;
    productName: string;
    qty: string;
    unitPrice: string;
    total: string;
  }>;
}

const ROOMS = [
  {
    id: 'lounge',
    title: 'Minimalist Lounge',
    subtitle: 'Serene low-profile living collection',
    category: 'Seating & Tables',
    icon: Armchair,
    highlight: 'Velvet 3-Seater Sofa, Round Ash Coffee Table & Accent Chair',
    image: '/images/products/aspen-lounge-sofa.jpg',
    preset: 'lounge',
    piecesCount: 3,
  },
  {
    id: 'study',
    title: 'Executive Study',
    subtitle: 'Ergonomic precision meets solid hardwood',
    category: 'Storage & Work',
    icon: Briefcase,
    highlight: 'Oak Writing Desk, Mesh Executive Chair & 5-Tier Bookshelf',
    image: '/images/products/oakridge-writing-desk.jpg',
    preset: 'study',
    piecesCount: 3,
  },
  {
    id: 'bedroom',
    title: 'Zen Bedroom Suite',
    subtitle: 'Restful architecture in solid natural timber',
    category: 'Beds & Nightstands',
    icon: Bed,
    highlight: 'Upholstered Double Bed Frame, Nightstands & Solid Wood Drawers',
    image: '/images/products/upholstered-queen-bed.jpg',
    preset: 'bedroom',
    piecesCount: 3,
  },
  {
    id: 'dining',
    title: 'Nordic Dining Space',
    subtitle: 'Crafted dining tables & console storage',
    category: 'Dining & Kitchen',
    icon: Utensils,
    highlight: 'Solid Oak Dining Table, Marlow Console & Dining Seating',
    image: '/images/products/dining-table-oak.jpg',
    preset: 'lounge',
    piecesCount: 4,
  },
] as const;

export const PortalDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = usePortalAuth();

  const [activeRoom, setActiveRoom] = useState<'lounge' | 'bedroom' | 'dining' | 'study'>('lounge');
  const [invoiceSummary, setInvoiceSummary] = useState<InvoiceSummary>({
    totalDue: '0.00',
    totalInvoiced: '0.00',
    count: 0,
  });
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [activeActivityTab, setActiveActivityTab] = useState<'orders' | 'invoices'>('orders');
  const [featuredProducts, setFeaturedProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Preload architectural space images for instantaneous, flicker-free switching
    ROOMS.forEach((r) => {
      const img = new Image();
      img.src = r.image;
    });
  }, []);

  useEffect(() => {
    // 1. Fetch featured products
    api.get('/api/portal/catalogue')
      .then((res) => {
        if (res.data?.data && Array.isArray(res.data.data)) {
          // Enrich products with authentic imagery and 3D models
          const enriched = res.data.data.map((p: any) => ({
            ...p,
            image_url: resolveProductImage(p),
            model_url: p.model_url || resolveProductModel(p),
          }));

          // Pick 8 diverse pieces from different categories and different images (no duplicates)
          const distinctFeatured: any[] = [];
          const seenImages = new Set<string>();
          const seenCategories = new Set<string>();

          // Pass 1: One signature piece per category
          for (const p of enriched) {
            const img = p.image_url;
            const cat = p.category || 'Other';
            if (!seenCategories.has(cat) && !seenImages.has(img)) {
              seenCategories.add(cat);
              seenImages.add(img);
              distinctFeatured.push(p);
              if (distinctFeatured.length >= 8) break;
            }
          }

          // Pass 2: Fill remaining slots with pieces that have distinct images
          if (distinctFeatured.length < 8) {
            for (const p of enriched) {
              const img = p.image_url;
              if (!seenImages.has(img)) {
                seenImages.add(img);
                distinctFeatured.push(p);
                if (distinctFeatured.length >= 8) break;
              }
            }
          }

          // Fallback if needed
          if (distinctFeatured.length < 8) {
            for (const p of enriched) {
              if (!distinctFeatured.some((f) => f.id === p.id)) {
                distinctFeatured.push(p);
                if (distinctFeatured.length >= 8) break;
              }
            }
          }

          setFeaturedProducts(distinctFeatured.slice(0, 8));
        }
      })
      .catch(() => {});

    // 2. Fetch customer invoices & orders if authenticated
    if (user) {
      setLoading(true);
      Promise.all([
        api.get('/api/portal/invoices').catch(() => ({ data: { data: [] } })),
        api.get('/api/portal/orders').catch(() => ({ data: { data: [] } })),
      ])
        .then(([invRes, ordRes]) => {
          const invData = invRes.data?.data || [];
          if (Array.isArray(invData)) {
            let due = 0;
            let invoiced = 0;
            invData.forEach((inv: any) => {
              due += parseFloat(inv.amountDue || '0');
              invoiced += parseFloat(inv.total || '0');
            });
            setInvoiceSummary({
              totalDue: due.toFixed(2),
              totalInvoiced: invoiced.toFixed(2),
              count: invData.length,
            });
            setRecentInvoices(invData.slice(0, 4));
          }

          const ordData = ordRes.data?.data || [];
          if (Array.isArray(ordData)) {
            setRecentOrders(ordData.slice(0, 4));
          }
        })
        .finally(() => setLoading(false));
    }
  }, [user]);

  const currentRoom = ROOMS.find((r) => r.id === activeRoom) || ROOMS[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
      {/* ── 1. Hero Architectural Showcase Banner ── */}
      <div
        style={{
          position: 'relative',
          borderRadius: 24,
          overflow: 'hidden',
          backgroundColor: '#2E221D',
          color: '#FAF6F0',
          boxShadow: '0 20px 48px rgba(46, 34, 29, 0.16)',
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          height: 380,
          minHeight: 380,
          maxHeight: 380,
        }}
      >
        {/* Left: Atmospheric Branding & CTAs */}
        <div
          style={{
            padding: '48px 44px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            zIndex: 2,
            background: 'linear-gradient(135deg, rgba(46, 34, 29, 0.98) 0%, rgba(56, 42, 36, 0.92) 100%)',
          }}
        >
          <div>
            <div style={{ marginBottom: 12 }}>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'rgba(235, 215, 190, 0.75)',
                }}
              >
                Atelier Showroom &middot; 3D Studio
              </span>
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 36,
                lineHeight: 1.15,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: '#FAF6F0',
                margin: '0 0 14px',
              }}
            >
              {user ? `Welcome back, ${user.full_name}` : 'Handcrafted Living, Defined in 3D.'}
            </h1>

            <p
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: 'rgba(235, 215, 190, 0.85)',
                margin: 0,
                maxWidth: 440,
              }}
            >
              Curated solid teak, walnut, and linen furniture. Design rooms in 3D and review orders with ease.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 32, flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/portal/studio')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 22px',
                borderRadius: 10,
                backgroundColor: '#F9F2E4',
                color: '#2E221D',
                border: 'none',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.18)',
                transition: 'all 160ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.backgroundColor = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.backgroundColor = '#F9F2E4';
              }}
            >
              <Compass size={16} />
              <span>Launch 3D Room Studio</span>
              <ArrowRight size={14} />
            </button>

            <button
              onClick={() => navigate('/portal/catalogue')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 20px',
                borderRadius: 10,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#FAF6F0',
                border: '1px solid rgba(208, 174, 146, 0.4)',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                cursor: 'pointer',
                transition: 'all 160ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.16)';
                e.currentTarget.style.borderColor = '#FAF6F0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(208, 174, 146, 0.4)';
              }}
            >
              <Layers size={15} />
              <span>Browse Furniture Collection</span>
            </button>
          </div>
        </div>

        {/* Right: Architectural Imagery Showcase */}
        <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
          <img
            src="/images/products/aspen-lounge-sofa.jpg"
            alt="Atelier Showroom Showcase"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to right, rgba(46, 34, 29, 0.75) 0%, transparent 40%, rgba(46, 34, 29, 0.2) 100%)',
            }}
          />

          {/* Architectural Space Label */}
          <div
            style={{
              position: 'absolute',
              bottom: 20,
              right: 20,
              backgroundColor: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(16px)',
              padding: '6px 14px',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: '#2C221E', fontFamily: 'var(--font-display)' }}>
              Curated Atelier Showcase
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Financial Ledger Summary (When Authenticated) ── */}
      {user && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 18,
                  fontWeight: 800,
                  color: 'var(--brown-900)',
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                Account Ledger &amp; Invoices
              </h2>
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
                {invoiceSummary.count} Total Records
              </span>
            </div>

            <Link
              to="/portal/invoices"
              style={{
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color: 'var(--brown-900)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>View All Invoices</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {/* KPI 1: Outstanding Balance */}
            <div
              style={{
                backgroundColor: 'var(--surface)',
                borderRadius: 16,
                padding: '22px 24px',
                border: parseFloat(invoiceSummary.totalDue) > 0 ? '1px solid rgba(158, 74, 56, 0.4)' : '1px solid rgba(208, 174, 146, 0.35)',
                boxShadow: '0 4px 16px rgba(74, 58, 52, 0.05)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brown-600)' }}>
                  Outstanding Balance
                </span>
                {parseFloat(invoiceSummary.totalDue) > 0 ? (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)', backgroundColor: 'var(--danger-bg)', padding: '2px 8px', borderRadius: 999 }}>
                    Action Required
                  </span>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--posted)', backgroundColor: 'var(--posted-bg)', padding: '2px 8px', borderRadius: 999 }}>
                    All Clear
                  </span>
                )}
              </div>

              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 28,
                  fontWeight: 800,
                  color: parseFloat(invoiceSummary.totalDue) > 0 ? 'var(--danger)' : 'var(--posted)',
                  fontVariantNumeric: 'tabular-nums',
                  marginBottom: 12,
                }}
              >
                {formatINR(invoiceSummary.totalDue)}
              </div>

              {parseFloat(invoiceSummary.totalDue) > 0 ? (
                <button
                  onClick={() => navigate('/portal/invoices')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 999,
                    backgroundColor: 'var(--brown-900)',
                    color: 'var(--cream)',
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    cursor: 'pointer',
                    transition: 'all 140ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#2E221D';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--brown-900)';
                  }}
                >
                  <Zap size={12} color="#F2C94C" />
                  <span>Settle via Razorpay</span>
                </button>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--brown-600)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CheckCircle2 size={13} color="var(--posted)" />
                  <span>No outstanding dues on your account</span>
                </div>
              )}
            </div>

            {/* KPI 2: Total Invoiced */}
            <div
              style={{
                backgroundColor: 'var(--surface)',
                borderRadius: 16,
                padding: '22px 24px',
                border: '1px solid rgba(208, 174, 146, 0.35)',
                boxShadow: '0 4px 16px rgba(74, 58, 52, 0.05)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brown-600)', marginBottom: 8 }}>
                Total Lifetime Invoiced
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 28,
                  fontWeight: 800,
                  color: 'var(--brown-900)',
                  fontVariantNumeric: 'tabular-nums',
                  marginBottom: 12,
                }}
              >
                {formatINR(invoiceSummary.totalInvoiced)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--brown-600)' }}>
                Across {invoiceSummary.count} order invoice {invoiceSummary.count === 1 ? 'batch' : 'batches'}
              </div>
            </div>

            {/* KPI 3: Verified Client Status */}
            <div
              style={{
                backgroundColor: 'var(--surface)',
                borderRadius: 16,
                padding: '22px 24px',
                border: '1px solid rgba(208, 174, 146, 0.35)',
                boxShadow: '0 4px 16px rgba(74, 58, 52, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brown-600)', marginBottom: 8 }}>
                  Security &amp; Billing
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <ShieldCheck size={18} color="var(--posted)" />
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--brown-900)', fontFamily: 'var(--font-display)' }}>
                    Verified Client Account
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--brown-600)', margin: 0 }}>
                  Client Ledger synchronized with Urban Furniture ERP.
                </p>
              </div>

              <div style={{ marginTop: 12 }}>
                <Link
                  to="/portal/invoices"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--brown-700)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>Download Signed Invoices</span>
                  <ExternalLink size={11} />
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Orders & Live Invoices Panel */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 20,
              padding: '24px 28px',
              border: '1px solid rgba(208, 174, 146, 0.35)',
              boxShadow: '0 4px 16px rgba(74, 58, 52, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            {/* Header & Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brown-600)' }}>
                    Atelier Activity
                  </span>
                </div>
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 18,
                    fontWeight: 800,
                    color: 'var(--brown-900)',
                    margin: 0,
                  }}
                >
                  Your Active Orders &amp; Invoices
                </h3>
              </div>

              {/* Tab Switcher */}
              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  backgroundColor: 'rgba(240, 234, 224, 0.65)',
                  padding: 4,
                  borderRadius: 10,
                  border: '1px solid rgba(208, 174, 146, 0.45)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveActivityTab('orders')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: activeActivityTab === 'orders' ? 700 : 500,
                    fontFamily: 'var(--font-display)',
                    backgroundColor: activeActivityTab === 'orders' ? 'var(--brown-900)' : 'transparent',
                    color: activeActivityTab === 'orders' ? 'var(--cream)' : 'var(--brown-800)',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                  }}
                >
                  <ShoppingBag size={13} />
                  <span>Recent Orders ({recentOrders.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveActivityTab('invoices')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: activeActivityTab === 'invoices' ? 700 : 500,
                    fontFamily: 'var(--font-display)',
                    backgroundColor: activeActivityTab === 'invoices' ? 'var(--brown-900)' : 'transparent',
                    color: activeActivityTab === 'invoices' ? 'var(--cream)' : 'var(--brown-800)',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                  }}
                >
                  <FileText size={13} />
                  <span>Tax Invoices ({recentInvoices.length})</span>
                </button>
              </div>
            </div>

            {/* Tab 1: Recent Orders */}
            {activeActivityTab === 'orders' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentOrders.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--brown-600)', fontSize: 13 }}>
                    No sales orders found on your profile.
                  </div>
                ) : (
                  recentOrders.map((order) => {
                    const amountDue = parseFloat(order.amountDue || '0');
                    const hasInvoice = !!order.invoiceId;
                    const isSettled = order.paymentStatus === 'paid' || (hasInvoice && amountDue <= 0);

                    return (
                      <div
                        key={order.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 12,
                          padding: '12px 16px',
                          borderRadius: 12,
                          backgroundColor: 'rgba(251, 248, 242, 0.7)',
                          border: '1px solid rgba(208, 174, 146, 0.3)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              backgroundColor: 'rgba(235, 215, 190, 0.45)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--brown-800)',
                            }}
                          >
                            <ShoppingBag size={18} />
                          </div>

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 13.5, color: 'var(--brown-900)' }}>
                                {order.number}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 999,
                                  color: order.status === 'confirmed' ? 'var(--posted)' : 'var(--brown-700)',
                                  backgroundColor: order.status === 'confirmed' ? 'var(--posted-bg)' : 'rgba(208, 174, 146, 0.35)',
                                }}
                              >
                                {order.status === 'confirmed' ? 'Confirmed' : 'Draft'}
                              </span>
                            </div>

                            <div style={{ fontSize: 11, color: 'var(--brown-600)', marginTop: 2 }}>
                              {order.lines?.[0]?.productName
                                ? `${order.lines[0].productName} ${order.lines.length > 1 ? `+${order.lines.length - 1} more` : ''}`
                                : `${order.lines?.length || 0} pieces`}
                              {' • '}
                              {order.orderDate
                                ? new Date(order.orderDate).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : ''}
                            </div>
                          </div>
                        </div>

                        {/* Middle & Right */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 14, color: 'var(--brown-900)' }}>
                              {formatINR(order.total)}
                            </div>
                            <div style={{ fontSize: 10.5, color: hasInvoice ? (isSettled ? 'var(--posted)' : 'var(--danger)') : 'var(--brown-500)', fontWeight: 600 }}>
                              {hasInvoice
                                ? isSettled
                                  ? '✓ Invoice Settled'
                                  : `Invoice Due: ${formatINR(order.amountDue || '0')}`
                                : 'Pending Invoice'}
                            </div>
                          </div>

                          {hasInvoice && amountDue > 0 ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/portal/invoices/${order.invoiceId}`)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '7px 14px',
                                borderRadius: 8,
                                backgroundColor: 'var(--brown-900)',
                                color: 'var(--cream)',
                                border: 'none',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 120ms ease',
                              }}
                            >
                              <Zap size={11} color="#F2C94C" />
                              <span>Pay with Razorpay</span>
                            </button>
                          ) : hasInvoice ? (
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
                                color: 'var(--brown-800)',
                                border: '1px solid var(--brown-300)',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <span>View Receipt</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => navigate('/portal/orders')}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '6px 12px',
                                borderRadius: 8,
                                backgroundColor: 'transparent',
                                color: 'var(--brown-800)',
                                border: '1px solid var(--brown-300)',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <span>Details</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <Link
                    to="/portal/orders"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      color: 'var(--brown-900)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>View All Orders ({recentOrders.length})</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            )}

            {/* Tab 2: Recent Invoices */}
            {activeActivityTab === 'invoices' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentInvoices.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--brown-600)', fontSize: 13 }}>
                    No customer invoices found.
                  </div>
                ) : (
                  recentInvoices.map((inv) => {
                    const due = parseFloat(inv.amountDue || '0');
                    const isPaid = inv.paymentStatus === 'paid' || due <= 0;

                    return (
                      <div
                        key={inv.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 12,
                          padding: '12px 16px',
                          borderRadius: 12,
                          backgroundColor: 'rgba(251, 248, 242, 0.7)',
                          border: '1px solid rgba(208, 174, 146, 0.3)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              backgroundColor: 'rgba(235, 215, 190, 0.45)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--brown-800)',
                            }}
                          >
                            <FileText size={18} />
                          </div>

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 13.5, color: 'var(--brown-900)' }}>
                                {inv.number}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 999,
                                  color: isPaid ? 'var(--posted)' : 'var(--danger)',
                                  backgroundColor: isPaid ? 'var(--posted-bg)' : 'var(--danger-bg)',
                                }}
                              >
                                {isPaid ? 'Settled' : 'Payment Due'}
                              </span>
                            </div>

                            <div style={{ fontSize: 11, color: 'var(--brown-600)', marginTop: 2 }}>
                              Date:{' '}
                              {inv.invoiceDate
                                ? new Date(inv.invoiceDate).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : ''}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 14, color: 'var(--brown-900)' }}>
                              {formatINR(inv.total)}
                            </div>
                            <div style={{ fontSize: 10.5, color: isPaid ? 'var(--posted)' : 'var(--danger)', fontWeight: 600 }}>
                              {isPaid ? 'Cleared in General Ledger' : `Due: ${formatINR(inv.amountDue)}`}
                            </div>
                          </div>

                          {!isPaid ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/portal/invoices/${inv.id}`)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '7px 14px',
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
                              <span>Settle via Razorpay</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => navigate(`/portal/invoices/${inv.id}`)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '6px 12px',
                                borderRadius: 8,
                                backgroundColor: 'transparent',
                                color: 'var(--brown-800)',
                                border: '1px solid var(--brown-300)',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <span>View Receipt</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <Link
                    to="/portal/invoices"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      color: 'var(--brown-900)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>View All Invoices ({recentInvoices.length})</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 3. Interactive Room Archetypes Studio Switcher ── */}
      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderRadius: 24,
          padding: '32px',
          border: '1px solid rgba(208, 174, 146, 0.35)',
          boxShadow: '0 8px 24px rgba(74, 58, 52, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brown-600)' }}>
                3D Japandi Room Spaces
              </span>
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 800,
                color: 'var(--brown-900)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Explore Architectural Spaces
            </h2>
          </div>

          {/* Room Tab Switcher */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              backgroundColor: 'rgba(240, 234, 224, 0.65)',
              padding: 4,
              borderRadius: 10,
              border: '1px solid rgba(208, 174, 146, 0.45)',
            }}
          >
            {ROOMS.map((room) => {
              const Icon = room.icon;
              const isSelected = activeRoom === room.id;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveRoom(room.id);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 500,
                    fontFamily: 'var(--font-display)',
                    backgroundColor: isSelected ? 'var(--brown-900)' : 'transparent',
                    color: isSelected ? 'var(--cream)' : 'var(--brown-800)',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 2px 6px rgba(74, 58, 52, 0.18)' : 'none',
                    transition: 'background-color 140ms ease, color 140ms ease',
                    outline: 'none',
                  }}
                >
                  <Icon size={13} />
                  <span>{room.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Room Preview Card */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: '#FDFBF7',
            border: '1px solid rgba(208, 174, 146, 0.35)',
            height: 340,
            minHeight: 340,
            maxHeight: 340,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
            <img
              key={currentRoom.id}
              src={currentRoom.image}
              alt={currentRoom.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transition: 'opacity 200ms ease',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.94)',
                backdropFilter: 'blur(10px)',
                padding: '6px 12px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--brown-900)',
                fontFamily: 'var(--font-display)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {currentRoom.category}
            </div>
          </div>

          <div
            style={{
              padding: '26px 32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--posted)',
                  fontWeight: 700,
                  backgroundColor: 'var(--posted-bg)',
                  padding: '2px 8px',
                  borderRadius: 999,
                  textTransform: 'uppercase',
                }}
              >
                Verified Concept
              </span>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontWeight: 800,
                  color: 'var(--brown-900)',
                  margin: '10px 0 6px',
                }}
              >
                {currentRoom.title}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--brown-700)', lineHeight: 1.5, margin: '0 0 16px' }}>
                {currentRoom.subtitle}
              </p>

              <div
                style={{
                  backgroundColor: 'rgba(235, 215, 190, 0.35)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  border: '1px solid rgba(208, 174, 146, 0.3)',
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--brown-600)', marginBottom: 4 }}>
                  Curated Ensemble Includes:
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown-900)', lineHeight: 1.4 }}>
                  {currentRoom.highlight}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => navigate('/portal/studio')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '11px 20px',
                  borderRadius: 999,
                  backgroundColor: 'var(--brown-900)',
                  color: 'var(--cream)',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(74, 58, 52, 0.18)',
                  transition: 'all 140ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.backgroundColor = '#2E221D';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.backgroundColor = 'var(--brown-900)';
                }}
              >
                <Sparkles size={14} />
                <span>Customize in 3D Studio</span>
              </button>

              <button
                onClick={() => navigate('/portal/catalogue')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '11px 18px',
                  borderRadius: 999,
                  backgroundColor: 'transparent',
                  color: 'var(--brown-900)',
                  border: '1px solid rgba(208, 174, 146, 0.6)',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  cursor: 'pointer',
                  transition: 'all 140ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(235, 215, 190, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span>View Products</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Featured Furniture Showcase Grid ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 800,
                color: 'var(--brown-900)',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              Featured Masterpieces
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--brown-600)' }}>
              Handcrafted solid woods, organic linens, and architectural silhouettes with 3D models.
            </p>
          </div>

          <Link
            to="/portal/catalogue"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              color: 'var(--brown-900)',
              textDecoration: 'none',
              padding: '6px 14px',
              borderRadius: 999,
              backgroundColor: 'rgba(235, 215, 190, 0.4)',
              border: '1px solid rgba(208, 174, 146, 0.5)',
              transition: 'all 140ms ease',
            }}
          >
            <span>Explore Full Catalogue</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
          {featuredProducts.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/portal/catalogue/${p.id}`)}
              style={{
                backgroundColor: 'var(--surface)',
                borderRadius: 16,
                overflow: 'hidden',
                border: '1px solid rgba(208, 174, 146, 0.35)',
                boxShadow: '0 4px 16px rgba(74, 58, 52, 0.05)',
                cursor: 'pointer',
                transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                flexDirection: 'column',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 28px rgba(74, 58, 52, 0.12)';
                e.currentTarget.style.borderColor = 'var(--brown-700)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(74, 58, 52, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(208, 174, 146, 0.35)';
              }}
            >
              {/* Image Preview with 3D Pill */}
              <div style={{ position: 'relative', height: 180, overflow: 'hidden', backgroundColor: '#F6F2EC' }}>
                <img
                  src={p.image_url || resolveProductImage(p)}
                  alt={p.name}
                  onError={(e) => { e.currentTarget.src = resolveProductImage({ ...p, image_url: null }); }}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 300ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1.0)';
                  }}
                />

                {p.model_url && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      backgroundColor: 'rgba(74, 58, 52, 0.88)',
                      backdropFilter: 'blur(8px)',
                      color: 'var(--cream)',
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      padding: '3px 8px',
                      borderRadius: 999,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Box size={11} />
                    <span>3D Model</span>
                  </div>
                )}

                <div
                  style={{
                    position: 'absolute',
                    bottom: 10,
                    left: 10,
                    backgroundColor: 'rgba(255, 255, 255, 0.92)',
                    backdropFilter: 'blur(8px)',
                    color: 'var(--brown-900)',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {p.category}
                </div>
              </div>

              {/* Product Details */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                <div>
                  <h3
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--brown-900)',
                      margin: '0 0 8px',
                      lineHeight: 1.3,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                    title={p.name}
                  >
                    {p.name}
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 10 }}>
                  <div>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 16,
                        fontWeight: 800,
                        color: 'var(--brown-900)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatINR(p.sales_price)}
                    </span>
                    {p.mrp && parseFloat(p.mrp) > parseFloat(p.sales_price) && (
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--brown-500)',
                          textDecoration: 'line-through',
                          marginLeft: 6,
                        }}
                      >
                        {formatINR(p.mrp)}
                      </span>
                    )}
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      color: 'var(--brown-700)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    Inspect <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PortalDashboardPage;
