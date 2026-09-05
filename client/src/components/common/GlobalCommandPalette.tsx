import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Compass,
  Layers,
  Receipt,
  Scale,
  TrendingUp,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  BookOpen,
  FileText,
  Landmark,
  FileBarChart,
  X,
  ArrowRight,
  Box,
  UserCheck,
  Activity,
  ScrollText,
} from 'lucide-react';
import { playWoodClick } from '../../lib/soundEffects';
import api from '../../lib/axios';

interface PaletteItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Products' | 'Actions' | 'Accounting';
  icon: React.ElementType;
  action: () => void;
  badge?: string;
}

export const GlobalCommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [products, setProducts] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Listen for global keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        playWoodClick(1.0);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Load product catalog for live search once
  useEffect(() => {
    if (isOpen && products.length === 0) {
      api.get('/api/portal/catalogue')
        .then((res) => {
          if (res.data?.data) {
            setProducts(res.data.data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, products.length]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Static navigation and actions
  const staticItems: PaletteItem[] = useMemo(() => [
    {
      id: 'studio',
      title: '3D Room Studio Planner',
      subtitle: 'Arrange furniture & test finishes in 3D space',
      category: 'Navigation',
      icon: Compass,
      action: () => navigate('/portal/studio'),
      badge: '3D Interactive',
    },
    {
      id: 'catalogue',
      title: 'Furniture Catalogue',
      subtitle: 'Browse all 37 curated handcrafted pieces',
      category: 'Navigation',
      icon: Layers,
      action: () => navigate('/portal/catalogue'),
    },
    {
      id: 'dashboard',
      title: 'Customer Atelier Dashboard',
      subtitle: 'Recent designs, proposals, and ledger summary',
      category: 'Navigation',
      icon: Layers,
      action: () => navigate('/portal/dashboard'),
    },
    {
      id: 'invoices',
      title: 'Customer Invoices & Payments',
      subtitle: 'View bills, receipts, and settle balances',
      category: 'Navigation',
      icon: Receipt,
      action: () => navigate('/portal/invoices'),
    },
    {
      id: 'erp-sales-orders',
      title: 'Sales Orders (ERP)',
      subtitle: 'Manage client quotes and order confirmations',
      category: 'Accounting',
      icon: ShoppingCart,
      action: () => navigate('/sales/orders'),
    },
    {
      id: 'erp-invoices',
      title: 'Customer Invoices (ERP)',
      subtitle: 'Revenue recognition and receivables tracking',
      category: 'Accounting',
      icon: Receipt,
      action: () => navigate('/sales/invoices'),
    },
    {
      id: 'erp-po',
      title: 'Purchase Orders',
      subtitle: 'Vendor procurement and raw material requisitions',
      category: 'Accounting',
      icon: ShoppingBag,
      action: () => navigate('/purchase/orders'),
    },
    {
      id: 'erp-bills',
      title: 'Vendor Bills & Payables',
      subtitle: 'Record supplier expenses and schedule disbursements',
      category: 'Accounting',
      icon: FileText,
      action: () => navigate('/purchase/bills'),
    },
    {
      id: 'erp-balance-sheet',
      title: 'Balance Sheet',
      subtitle: 'Real-time Assets, Liabilities, and Equity',
      category: 'Accounting',
      icon: Scale,
      action: () => navigate('/report/balance-sheet'),
      badge: 'Real-Time',
    },
    {
      id: 'erp-pnl',
      title: 'Profit & Loss Statement',
      subtitle: 'Net income, COGS, and operating margins',
      category: 'Accounting',
      icon: TrendingUp,
      action: () => navigate('/report/profit-loss'),
    },
    {
      id: 'erp-coa',
      title: 'Chart of Accounts',
      subtitle: 'All 8 double-entry financial account types',
      category: 'Accounting',
      icon: Landmark,
      action: () => navigate('/account/coa'),
    },
    {
      id: 'erp-budgets',
      title: 'Analytical Budget Reports',
      subtitle: 'Period commitments vs actual posted achievements',
      category: 'Accounting',
      icon: FileBarChart,
      action: () => navigate('/report/budget'),
    },
    {
      id: 'erp-integrity',
      title: 'System Integrity & Double-Entry Audit',
      subtitle: 'Verify debit = credit across all journal entries',
      category: 'Actions',
      icon: ShieldCheck,
      action: () => navigate('/integrity'),
      badge: 'Diff 0.00',
    },
    {
      id: 'erp-audit',
      title: 'Audit Log & Record Chatter',
      subtitle: 'Immutable record timeline and user activity',
      category: 'Actions',
      icon: ScrollText,
      action: () => navigate('/audit'),
    },
  ], [navigate]);

  // Product items based on search query
  const productItems: PaletteItem[] = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
      .slice(0, 6)
      .map((p) => ({
        id: `prod-${p.id}`,
        title: p.name,
        subtitle: `${p.category || 'Furniture'} • ₹${parseFloat(p.sales_price).toLocaleString('en-IN')}`,
        category: 'Products' as const,
        icon: Box,
        action: () => {
          if (p.model_url) {
            navigate(`/portal/studio?model=${encodeURIComponent(p.model_url)}`);
          } else {
            navigate(`/portal/catalogue/${p.id}`);
          }
        },
        badge: p.model_url ? '3D Ready' : undefined,
      }));
  }, [query, products, navigate]);

  // Filtered items
  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return staticItems;
    }
    const q = query.toLowerCase();
    const matchedStatic = staticItems.filter(
      (item) => item.title.toLowerCase().includes(q) || (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
    return [...productItems, ...matchedStatic];
  }, [query, staticItems, productItems]);

  // Handle keyboard navigation inside the palette
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredItems[selectedIndex];
      if (target) {
        playWoodClick(1.0);
        target.action();
        setIsOpen(false);
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      onClick={() => setIsOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(38, 25, 20, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        animation: 'fadeIn 140ms ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 640,
          backgroundColor: '#FAF7F2',
          borderRadius: 14,
          border: '1px solid rgba(208, 174, 146, 0.5)',
          boxShadow: '0 24px 64px -12px rgba(44, 34, 30, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '72vh',
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderBottom: '1px solid rgba(208, 174, 146, 0.35)',
            backgroundColor: '#FFFFFF',
          }}
        >
          <Search size={18} color="var(--brown-600)" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, pieces, double-entry reports, or 3D models..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            style={{
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              color: 'var(--brown-900)',
              width: '100%',
            }}
          />
          {query ? (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brown-600)' }}
            >
              <X size={16} />
            </button>
          ) : (
            <kbd
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                backgroundColor: 'rgba(208, 174, 146, 0.25)',
                color: 'var(--brown-600)',
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid rgba(208, 174, 146, 0.4)',
              }}
            >
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div
          style={{
            overflowY: 'auto',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {filteredItems.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--brown-600)' }}>
              <Search size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>No matching commands or pieces</div>
              <div style={{ fontSize: 12, color: 'var(--brown-500)', marginTop: 4 }}>
                Try searching for &ldquo;Studio&rdquo;, &ldquo;Balance Sheet&rdquo;, &ldquo;Sofa&rdquo;, or &ldquo;Integrity&rdquo;
              </div>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    playWoodClick(1.0);
                    item.action();
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(208, 174, 146, 0.22)' : 'transparent',
                    border: isSelected ? '1px solid rgba(208, 174, 146, 0.45)' : '1px solid transparent',
                    transition: 'all 80ms ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        backgroundColor: isSelected ? 'var(--brown-900)' : 'rgba(208, 174, 146, 0.25)',
                        color: isSelected ? 'var(--cream)' : 'var(--brown-800)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 120ms ease',
                      }}
                    >
                      <Icon size={16} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--brown-900)',
                          fontFamily: 'var(--font-display)',
                        }}
                      >
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div
                          style={{
                            fontSize: 11.5,
                            color: 'var(--brown-600)',
                            fontFamily: 'var(--font-body)',
                          }}
                        >
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.badge && (
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: 'var(--font-mono)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: 'var(--posted-bg)',
                          color: 'var(--posted)',
                          fontWeight: 700,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--brown-500)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {item.category}
                    </span>
                    <ArrowRight size={13} color="var(--brown-400)" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Quick Navigation Hints */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid rgba(208, 174, 146, 0.3)',
            backgroundColor: '#F3EFE9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--brown-600)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div style={{ display: 'flex', gap: 14 }}>
            <span><kbd style={{ padding: '1px 4px', background: '#FFFFFF', borderRadius: 3, border: '1px solid #D1C5B8' }}>↑↓</kbd> Navigate</span>
            <span><kbd style={{ padding: '1px 4px', background: '#FFFFFF', borderRadius: 3, border: '1px solid #D1C5B8' }}>↵</kbd> Select</span>
            <span><kbd style={{ padding: '1px 4px', background: '#FFFFFF', borderRadius: 3, border: '1px solid #D1C5B8' }}>esc</kbd> Dismiss</span>
          </div>
          <div>Urban Furniture Command Center</div>
        </div>
      </div>
    </div>
  );
};
