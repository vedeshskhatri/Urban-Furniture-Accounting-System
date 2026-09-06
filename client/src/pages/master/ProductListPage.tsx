import React, { useState, useEffect } from 'react';
import { ProductsApi, type InventoryAnalytics } from '../../api/products.api';
import { Product } from '@shared/schemas/product.schema';
import { Money } from '../../components/Money';
import { List, LayoutGrid, Image as ImageIcon, TrendingUp, AlertTriangle, Building, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface ProductListPageProps {
  onSelectProduct: (id: number) => void;
  onNewProduct: () => void;
  onBack?: () => void;
  initialViewMode?: 'list' | 'kanban';
}

export const ProductListPage: React.FC<ProductListPageProps> = ({
  onSelectProduct,
  onNewProduct,
  onBack,
  initialViewMode = 'list',
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(initialViewMode);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  // Inventory Velocity & Analytics State
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analytics, setAnalytics] = useState<InventoryAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const toggleAnalytics = async () => {
    const nextState = !showAnalytics;
    setShowAnalytics(nextState);
    if (nextState && !analytics) {
      try {
        setLoadingAnalytics(true);
        const data = await ProductsApi.getInventoryAnalytics();
        setAnalytics(data);
      } catch (err) {
        console.error('Failed to load inventory analytics', err);
      } finally {
        setLoadingAnalytics(false);
      }
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await ProductsApi.getAll(false, 'all', 'all');
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = products.filter(p => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.type && p.type.toLowerCase().includes(q))
    );
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map(p => p.id!).filter(Boolean));
    }
  };

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const isAllSelected =
    filteredProducts.length > 0 && selectedIds.length === filteredProducts.length;

  const formatPrice = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '0';
    return num.toLocaleString('en-IN');
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Title matching wireframe: Product Master List View / Product Master Kanban View */}
        <h1 style={styles.heading}>
          {viewMode === 'list' ? 'Product Master List View' : 'Product Master Kanban View'}
        </h1>

        {/* Outer Wireframe Card */}
        <div style={styles.card}>
          {/* Top Action Bar */}
          <div style={styles.topBar}>
            {/* Left: New & Velocity Analytics Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={onNewProduct}
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
                onClick={toggleAnalytics}
                style={{
                  ...styles.wireframeBtn,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: showAnalytics ? 'var(--brown-900)' : 'var(--cream)',
                  color: showAnalytics ? 'var(--cream)' : 'var(--brown-900)',
                  borderColor: 'var(--brown-900)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                <TrendingUp size={14} />
                <span>Stock Velocity & Analytics</span>
                {showAnalytics ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>

            {/* Center: Search Bar */}
            <div style={styles.searchWrapper}>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search products, SKU, category..."
                style={styles.searchInput}
              />
            </div>

            {/* Right: Back Button & View Switcher */}
            <div style={styles.rightGroup}>
              <button
                type="button"
                onClick={onBack || (() => window.history.back())}
                onMouseEnter={() => setHoveredBtn('back')}
                onMouseLeave={() => setHoveredBtn(null)}
                style={{
                  ...styles.wireframeBtn,
                  ...(hoveredBtn === 'back' ? styles.wireframeBtnHover : {}),
                }}
              >
                Back
              </button>

              {/* View Switcher Icons matching wireframe */}
              <div style={styles.switcherContainer}>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  title="Shift to List View"
                  style={{
                    ...styles.switchBtn,
                    ...(viewMode === 'list' ? styles.switchBtnActive : {}),
                  }}
                >
                  <List size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('kanban')}
                  title="Shift to Kanban View"
                  style={{
                    ...styles.switchBtn,
                    ...(viewMode === 'kanban' ? styles.switchBtnActive : {}),
                  }}
                >
                  <LayoutGrid size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Inventory Velocity & Analytics Panel ── */}
          {showAnalytics && (
            <div
              style={{
                borderBottom: '1px solid #D0AE92',
                backgroundColor: 'rgba(247, 243, 238, 0.95)',
                padding: '16px 20px',
              }}
            >
              {loadingAnalytics ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#5C453A' }}>
                  Loading real-time inventory analytics...
                </div>
              ) : analytics ? (
                <div>
                  {/* KPI Stat Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        padding: '10px 14px',
                        backgroundColor: '#FFF',
                        borderRadius: 8,
                        border: '1px solid rgba(208, 174, 146, 0.4)',
                      }}
                    >
                      <div style={{ fontSize: 11, color: '#77574A', textTransform: 'uppercase', fontWeight: 600 }}>
                        Total Stock On Hand
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#382A24' }}>
                        {analytics.summary.totalStockUnits.toLocaleString()} Units
                      </div>
                      <div style={{ fontSize: 11, color: '#5C453A' }}>
                        Across {analytics.summary.totalCatalogItems} active catalog products
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '10px 14px',
                        backgroundColor: '#FFF',
                        borderRadius: 8,
                        border: '1px solid rgba(208, 174, 146, 0.4)',
                      }}
                    >
                      <div style={{ fontSize: 11, color: 'var(--posted)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <TrendingUp size={13} />
                        Fast-Moving Lines
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--posted)' }}>
                        {analytics.summary.fastMoverCount} Items
                      </div>
                      <div style={{ fontSize: 11, color: '#5C453A' }}>
                        High turnover velocity from invoice dispatches
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '10px 14px',
                        backgroundColor: '#FFF',
                        borderRadius: 8,
                        border: '1px solid rgba(208, 174, 146, 0.4)',
                      }}
                    >
                      <div style={{ fontSize: 11, color: '#b45309', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={13} />
                        Slow-Moving / Clearance Alerts
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#b45309' }}>
                        {analytics.summary.slowMoverCount} Items
                      </div>
                      <div style={{ fontSize: 11, color: '#5C453A' }}>
                        Idle inventory with zero sales movement
                      </div>
                    </div>

                    {/* Location Breakdown */}
                    {analytics.locationBreakdown.map((loc) => (
                      <div
                        key={loc.code}
                        style={{
                          padding: '10px 14px',
                          backgroundColor: '#FFF',
                          borderRadius: 8,
                          border: '1px solid rgba(208, 174, 146, 0.4)',
                        }}
                      >
                        <div style={{ fontSize: 11, color: '#77574A', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Building size={13} />
                          {loc.code} ({loc.percentage}%)
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#382A24' }}>
                          {loc.total_units.toLocaleString()} Units
                        </div>
                        <div style={{ fontSize: 11, color: '#5C453A' }}>
                          {loc.location_name}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Fast vs Slow Movers Side-by-Side Tables */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
                    {/* Fast Movers Column */}
                    <div
                      style={{
                        backgroundColor: '#FFF',
                        borderRadius: 8,
                        border: '1px solid rgba(208, 174, 146, 0.4)',
                        padding: 14,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--posted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <TrendingUp size={15} />
                          Top Velocity Dispatches (Fast-Moving)
                        </span>
                        <span style={{ fontSize: 11, color: '#77574A', fontFamily: 'var(--font-mono)' }}>
                          Verified Outbound Moves
                        </span>
                      </div>
                      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #eee', color: '#77574A' }}>
                              <th style={{ textAlign: 'left', padding: '4px 6px' }}>Product</th>
                              <th style={{ textAlign: 'left', padding: '4px 6px' }}>SKU</th>
                              <th style={{ textAlign: 'right', padding: '4px 6px' }}>Sold</th>
                              <th style={{ textAlign: 'right', padding: '4px 6px' }}>Velocity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.fastMoving.map((p) => (
                              <tr key={p.id} style={{ borderBottom: '1px solid #f9f9f9', cursor: 'pointer' }} onClick={() => onSelectProduct(p.id)}>
                                <td style={{ padding: '6px', fontWeight: 600, color: '#382A24' }}>{p.name}</td>
                                <td style={{ padding: '6px', fontFamily: 'var(--font-mono)', color: '#77574A' }}>{p.sku || '—'}</td>
                                <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: 'var(--posted)', fontFamily: 'var(--font-mono)' }}>
                                  {p.units_sold} units
                                </td>
                                <td style={{ padding: '6px', textAlign: 'right' }}>
                                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, backgroundColor: 'rgba(54, 83, 20, 0.12)', color: 'var(--posted)', fontWeight: 700 }}>
                                    {p.velocity_status === 'high_velocity' ? '🔥 HIGH' : 'STEADY'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Slow Movers Column */}
                    <div
                      style={{
                        backgroundColor: '#FFF',
                        borderRadius: 8,
                        border: '1px solid rgba(208, 174, 146, 0.4)',
                        padding: 14,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#b45309', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <AlertTriangle size={15} />
                          Clearance & Stagnant Stock Alerts
                        </span>
                        <span style={{ fontSize: 11, color: '#77574A', fontFamily: 'var(--font-mono)' }}>
                          Idle On-Hand
                        </span>
                      </div>
                      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #eee', color: '#77574A' }}>
                              <th style={{ textAlign: 'left', padding: '4px 6px' }}>Product</th>
                              <th style={{ textAlign: 'left', padding: '4px 6px' }}>SKU</th>
                              <th style={{ textAlign: 'right', padding: '4px 6px' }}>Stock</th>
                              <th style={{ textAlign: 'right', padding: '4px 6px' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.slowMoving.map((p) => (
                              <tr key={p.id} style={{ borderBottom: '1px solid #f9f9f9', cursor: 'pointer' }} onClick={() => onSelectProduct(p.id)}>
                                <td style={{ padding: '6px', fontWeight: 600, color: '#382A24' }}>{p.name}</td>
                                <td style={{ padding: '6px', fontFamily: 'var(--font-mono)', color: '#77574A' }}>{p.sku || '—'}</td>
                                <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: '#b45309', fontFamily: 'var(--font-mono)' }}>
                                  {p.stock_qty}
                                </td>
                                <td style={{ padding: '6px', textAlign: 'right' }}>
                                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, backgroundColor: 'rgba(180, 83, 9, 0.12)', color: '#b45309', fontWeight: 700 }}>
                                    {p.clearance_recommended ? `-${p.clearance_discount_pct}% CLEARANCE` : 'MONITOR'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Body Content */}
          {loading ? (
            <div style={styles.loadingContainer}>
              <span>Loading products...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div style={styles.emptyContainer}>
              <p style={styles.emptyText}>No products found. Click "New" to create one.</p>
            </div>
          ) : viewMode === 'list' ? (
            /* ═════════════ EXACT WIREFRAME LIST VIEW TABLE ═════════════ */
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.headerRow}>
                    <th style={{ ...styles.th, width: 70, textAlign: 'center' }}>
                      <span style={{ display: 'block', marginBottom: 4 }}>Select</span>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        style={styles.checkbox}
                        aria-label="Select all"
                      />
                    </th>
                    <th style={{ ...styles.th, textAlign: 'left' }}>Product</th>
                    <th style={{ ...styles.th, textAlign: 'left' }}>Category</th>
                    <th style={{ ...styles.th, textAlign: 'left' }}>Type</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Sales Price</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => {
                    const isSelected = selectedIds.includes(p.id!);
                    return (
                      <tr
                        key={p.id}
                        onClick={() => p.id && onSelectProduct(p.id)}
                        style={styles.bodyRow}
                      >
                        {/* Select Checkbox */}
                        <td
                          style={{ ...styles.td, textAlign: 'center' }}
                          onClick={e => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => toggleSelect(p.id!, e as any)}
                            style={styles.checkbox}
                          />
                        </td>

                        {/* Product Name */}
                        <td style={{ ...styles.td, fontWeight: 600, color: '#382A24' }}>
                          {p.name}
                        </td>

                        {/* Category */}
                        <td style={{ ...styles.td, color: '#5C453A' }}>
                          {p.category || 'General'}
                        </td>

                        {/* Type: Capitalized (Goods, Service, Combo) */}
                        <td style={{ ...styles.td, color: '#5C453A', textTransform: 'capitalize' }}>
                          {p.type}
                        </td>

                        {/* Sales Price */}
                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600, color: '#382A24' }}>
                          {formatPrice(p.sales_price)}
                        </td>

                        {/* Cost */}
                        <td style={{ ...styles.td, textAlign: 'right', color: '#5C453A' }}>
                          {formatPrice(p.cost_price)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ═════════════ EXACT WIREFRAME KANBAN VIEW ═════════════ */
            <div style={styles.kanbanGrid}>
              {filteredProducts.map(p => (
                <div
                  key={p.id}
                  onClick={() => p.id && onSelectProduct(p.id)}
                  style={styles.kanbanCard}
                >
                  {/* Left: Wireframe Rounded Image box with "Image" */}
                  <div style={styles.kanbanImgBox}>
                    <span style={styles.kanbanImgText}>Image</span>
                  </div>

                  {/* Right: Wireframe Details */}
                  <div style={styles.kanbanDetails}>
                    <div style={styles.kanbanTitle}>{p.name}</div>
                    <div style={styles.kanbanPriceLine}>
                      <span>Sales Price {formatPrice(p.sales_price)}</span>
                    </div>
                    <div style={styles.kanbanCostLine}>
                      <span>Cost {formatPrice(p.cost_price)}</span>
                    </div>
                  </div>
                </div>
              ))}
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
    maxWidth: 960,
  } as React.CSSProperties,

  heading: {
    fontFamily: '"Montserrat", var(--font-display), sans-serif',
    fontWeight: 700,
    fontSize: 22,
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
    marginBottom: 28,
  } as React.CSSProperties,

  wireframeBtn: {
    padding: '7px 24px',
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

  searchWrapper: {
    flex: 1,
    maxWidth: 320,
    margin: '0 12px',
  } as React.CSSProperties,

  searchInput: {
    width: '100%',
    border: '1.5px solid #77574A',
    borderRadius: 12,
    background: 'transparent',
    padding: '6px 16px',
    fontFamily: '"DM Sans", var(--font-body), sans-serif',
    fontSize: 13,
    color: '#4A3A34',
    outline: 'none',
  } as React.CSSProperties,

  rightGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  } as React.CSSProperties,

  switcherContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px',
    borderRadius: 10,
    background: 'rgba(235, 215, 190, 0.35)',
    border: '1px solid #D2B79F',
  } as React.CSSProperties,

  switchBtn: {
    padding: '5px 8px',
    borderRadius: 7,
    border: 'none',
    background: 'transparent',
    color: '#77574A',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 120ms ease',
  } as React.CSSProperties,

  switchBtnActive: {
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
  } as React.CSSProperties,

  emptyText: {
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
    padding: '12px 14px',
    fontFamily: '"Montserrat", var(--font-display), sans-serif',
    fontWeight: 700,
    fontSize: 13.5,
    color: '#382A24',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  bodyRow: {
    borderBottom: '1px solid #E4D5C7',
    cursor: 'pointer',
    transition: 'background 120ms ease',
  } as React.CSSProperties,

  td: {
    padding: '14px',
    fontSize: 13.5,
    verticalAlign: 'middle' as const,
  } as React.CSSProperties,

  checkbox: {
    width: 16,
    height: 16,
    accentColor: '#4A3A34',
    cursor: 'pointer',
    borderRadius: 4,
  } as React.CSSProperties,

  kanbanGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: 24,
    marginTop: 8,
  } as React.CSSProperties,

  kanbanCard: {
    background: '#FFFFFF',
    border: '1.5px solid #77574A',
    borderRadius: 18,
    padding: '20px 22px',
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    cursor: 'pointer',
    transition: 'all 140ms ease',
    boxShadow: '0 2px 8px rgba(74, 58, 52, 0.04)',
  } as React.CSSProperties,

  kanbanImgBox: {
    width: 76,
    height: 76,
    borderRadius: 14,
    border: '1.5px solid #77574A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#FAF7F4',
    flexShrink: 0,
  } as React.CSSProperties,

  kanbanImgText: {
    fontFamily: '"DM Sans", sans-serif',
    fontSize: 13,
    color: '#77574A',
    fontWeight: 500,
  } as React.CSSProperties,

  kanbanDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  } as React.CSSProperties,

  kanbanTitle: {
    fontFamily: '"Montserrat", var(--font-display), sans-serif',
    fontSize: 17,
    fontWeight: 700,
    color: '#382A24',
    marginBottom: 4,
  } as React.CSSProperties,

  kanbanPriceLine: {
    fontSize: 13.5,
    color: '#5C453A',
    fontWeight: 600,
  } as React.CSSProperties,

  kanbanCostLine: {
    fontSize: 13.5,
    color: '#77574A',
  } as React.CSSProperties,
};
