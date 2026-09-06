import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Eye,
  Search,
  Layers,
  ArrowRight,
  ChevronRight,
  Check,
  X,
  Compass,
  ArrowUpDown,
  Armchair,
  Bed,
  Utensils,
  Package,
  Lamp,
  Palette,
  Grid,
  LayoutGrid,
  Sparkles,
  ShieldCheck,
  Truck,
  CheckCircle2,
} from 'lucide-react';
import { formatINR } from '../../lib/money';
import api from '../../lib/axios';
import { playWoodClick } from '../../lib/soundEffects';
import { resolveProductImage, resolveProductModel } from '../../lib/productMedia';

export interface CatalogueProduct {
  id: number;
  name: string;
  sku: string | null;
  category: string | null;
  sales_price: string;
  mrp: string | null;
  tax_rate: string;
  stock_qty: string;
  model_url: string | null;
  image_url: string | null;
}

const CATEGORIES = [
  { id: 'All', label: 'All Pieces', icon: Layers },
  { id: 'Seating', label: 'Seating & Sofas', icon: Armchair },
  { id: 'Tables', label: 'Dining & Desks', icon: Utensils },
  { id: 'Storage', label: 'Storage & TV', icon: Package },
  { id: 'Beds', label: 'Beds & Suites', icon: Bed },
  { id: 'Lighting', label: 'Lighting', icon: Lamp },
  { id: 'Decor', label: 'Rugs & Decor', icon: Palette },
] as const;

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name-asc';
type GridDensity = 'dense' | 'spacious';

const WOOD_FINISHES = [
  { name: 'Light Oak', color: '#D8C5A8', border: '#C0AD92', desc: 'Natural White Oak with matte oil finish' },
  { name: 'Heritage Teak', color: '#C28247', border: '#A66B35', desc: 'Indonesian reclaimed teak' },
  { name: 'Dark Walnut', color: '#4A3326', border: '#35241A', desc: 'American Black Walnut' },
  { name: 'Smoked Charcoal', color: '#2C2D2F', border: '#1D1E1F', desc: 'Ebonized ash with open wood grain' },
];

export const PortalCataloguePage: React.FC = () => {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting State
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [onlyWith3D, setOnlyWith3D] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [gridDensity, setGridDensity] = useState<GridDensity>('dense');
  const [currentPage, setCurrentPage] = useState(1);

  // Quick View Modal
  const [quickViewProduct, setQuickViewProduct] = useState<CatalogueProduct | null>(null);
  const [selectedQuickFinish, setSelectedQuickFinish] = useState<string>('Light Oak');

  const itemsPerPage = gridDensity === 'dense' ? 16 : 12;

  // Keyboard shortcut for Cmd+K / search focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        if (!['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName)) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      } else if (e.key === 'Escape' && quickViewProduct) {
        setQuickViewProduct(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickViewProduct]);

  useEffect(() => {
    setLoading(true);
    api.get('/api/portal/catalogue')
      .then((res) => {
        if (res.data?.data) {
          const enriched = res.data.data.map((p: CatalogueProduct) => ({
            ...p,
            image_url: resolveProductImage(p),
            model_url: p.model_url || resolveProductModel(p),
          }));
          setProducts(enriched);
        }
      })
      .catch((err) => {
        setError(err?.response?.data?.error?.message || err.message || 'Error loading catalogue');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Filter & Sort Pipeline
  const filteredAndSorted = useMemo(() => {
    let list = products.filter((p) => {
      // 1. Category
      if (activeCategory !== 'All' && p.category?.toLowerCase() !== activeCategory.toLowerCase()) {
        return false;
      }
      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku?.toLowerCase().includes(q);
        if (!matchName && !matchSku) return false;
      }
      // 3. In stock
      if (onlyInStock) {
        const stock = parseFloat(p.stock_qty) || 0;
        if (stock <= 0) return false;
      }
      // 4. 3D Model available
      if (onlyWith3D) {
        if (!p.model_url) return false;
      }
      return true;
    });

    // Sort
    if (sortBy === 'price-asc') {
      list.sort((a, b) => parseFloat(a.sales_price) - parseFloat(b.sales_price));
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => parseFloat(b.sales_price) - parseFloat(a.sales_price));
    } else if (sortBy === 'name-asc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [products, activeCategory, searchQuery, onlyInStock, onlyWith3D, sortBy]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: products.length };
    products.forEach((p) => {
      const c = p.category || 'Other';
      counts[c] = (counts[c] || 0) + 1;
    });
    return counts;
  }, [products]);

  // Model count stats
  const totalWith3D = useMemo(() => {
    return products.filter((p) => Boolean(p.model_url)).length;
  }, [products]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredAndSorted.length / itemsPerPage) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSorted.slice(start, start + itemsPerPage);
  }, [filteredAndSorted, currentPage, itemsPerPage]);

  const handleCategoryChange = (cat: string) => {
    playWoodClick(1.0);
    setActiveCategory(cat);
    setCurrentPage(1);
  };

  const handleOpenQuickView = (e: React.MouseEvent, product: CatalogueProduct) => {
    e.stopPropagation();
    playWoodClick(0.9);
    setQuickViewProduct(product);
    setSelectedQuickFinish('Light Oak');
  };

  const handleLaunch3DStudio = (e: React.MouseEvent, modelUrl: string) => {
    e.stopPropagation();
    playWoodClick(1.1);
    navigate(`/portal/studio?model=${encodeURIComponent(modelUrl)}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', minHeight: '80vh' }}>
      {/* ── Modern Architectural Masthead Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 20,
          borderBottom: '1px solid rgba(208, 174, 146, 0.35)',
          paddingBottom: 22,
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
              Atelier Collection &middot; {products.length} Pieces
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
            Furniture Catalogue
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: 'var(--brown-700)',
              maxWidth: 580,
              lineHeight: 1.5,
            }}
          >
            Handcrafted solid wood furniture designed for architectural living.
          </p>
        </div>

        {/* Action Header: 3D Room Studio CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => {
              playWoodClick(1.0);
              navigate('/portal/studio');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              backgroundColor: 'var(--brown-900)',
              color: 'var(--cream)',
              borderRadius: 8,
              border: 'none',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(44, 34, 30, 0.18)',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 5px 16px rgba(44, 34, 30, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 3px 10px rgba(44, 34, 30, 0.18)';
            }}
          >
            <Compass size={15} />
            <span>Launch 3D Room Studio</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* ── Category Navigation Tabs ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 2,
          scrollbarWidth: 'none',
        }}
      >
        {CATEGORIES.map((cat) => {
          const isSelected = activeCategory === cat.id;
          const Icon = cat.icon;
          const count = categoryCounts[cat.id] || 0;

          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 14px',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: isSelected ? 700 : 500,
                fontFamily: 'var(--font-display)',
                backgroundColor: isSelected ? 'var(--brown-900)' : 'rgba(255, 255, 255, 0.9)',
                color: isSelected ? 'var(--cream)' : 'var(--brown-900)',
                border: '1px solid',
                borderColor: isSelected ? 'var(--brown-900)' : 'rgba(208, 174, 146, 0.45)',
                boxShadow: isSelected ? '0 2px 6px rgba(44, 34, 30, 0.15)' : 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 140ms ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = 'var(--brown-700)';
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = 'rgba(208, 174, 146, 0.45)';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                }
              }}
            >
              <Icon size={14} />
              <span>{cat.label}</span>
              <span
                style={{
                  fontSize: 10.5,
                  fontFamily: 'var(--font-mono)',
                  padding: '1px 6px',
                  borderRadius: 4,
                  backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : 'rgba(208, 174, 146, 0.25)',
                  color: isSelected ? 'var(--cream)' : 'var(--brown-700)',
                  fontWeight: 600,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Search & Filter Controls Toolbar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '8px 14px',
          borderRadius: 10,
          border: '1px solid rgba(208, 174, 146, 0.4)',
          boxShadow: '0 2px 8px rgba(44, 34, 30, 0.04)',
        }}
      >
        {/* Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#FAF7F2',
            padding: '6px 12px',
            borderRadius: 7,
            border: '1px solid rgba(208, 174, 146, 0.45)',
            flex: '1 1 240px',
            maxWidth: 380,
          }}
        >
          <Search size={14} color="var(--brown-600)" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search piece name, wood species, SKU..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: 12.5,
              fontFamily: 'var(--font-body)',
              color: 'var(--brown-900)',
              width: '100%',
            }}
          />
          {!searchQuery ? (
            <kbd
              style={{
                fontSize: 9.5,
                fontFamily: 'var(--font-mono)',
                backgroundColor: 'rgba(208, 174, 146, 0.25)',
                color: 'var(--brown-600)',
                padding: '2px 5px',
                borderRadius: 4,
                border: '1px solid rgba(208, 174, 146, 0.4)',
                userSelect: 'none',
              }}
            >
              ⌘K
            </kbd>
          ) : (
            <button
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                color: 'var(--brown-600)',
                display: 'flex',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Toggles & Sort Options */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* In-Stock Toggle */}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              color: 'var(--brown-900)',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={onlyInStock}
              onChange={(e) => {
                setOnlyInStock(e.target.checked);
                setCurrentPage(1);
              }}
              style={{ accentColor: 'var(--brown-900)', cursor: 'pointer' }}
            />
            <span>In Stock Only</span>
          </label>

          {/* 3D Model Quick Filter */}
          <button
            onClick={() => {
              playWoodClick(0.9);
              setOnlyWith3D((v) => !v);
              setCurrentPage(1);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 9px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              backgroundColor: onlyWith3D ? 'var(--brown-900)' : 'transparent',
              color: onlyWith3D ? 'var(--cream)' : 'var(--brown-800)',
              border: '1px solid',
              borderColor: onlyWith3D ? 'var(--brown-900)' : 'rgba(208, 174, 146, 0.5)',
              cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
          >
            <Box size={12} />
            <span>3D Ready</span>
          </button>

          {/* Sort Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <ArrowUpDown size={12} color="var(--brown-600)" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              style={{
                border: '1px solid rgba(208, 174, 146, 0.45)',
                borderRadius: 6,
                padding: '4px 8px',
                backgroundColor: '#FAF7F2',
                fontSize: 11.5,
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                color: 'var(--brown-900)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="default">Curated Order</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name-asc">Alphabetical (A–Z)</option>
            </select>
          </div>

          {/* Grid Layout Density Switcher */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#FAF7F2',
              border: '1px solid rgba(208, 174, 146, 0.45)',
              borderRadius: 6,
              padding: 2,
            }}
          >
            <button
              onClick={() => {
                playWoodClick(0.9);
                setGridDensity('dense');
              }}
              title="4-Column Compact Grid"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 7px',
                borderRadius: 4,
                border: 'none',
                backgroundColor: gridDensity === 'dense' ? 'var(--brown-900)' : 'transparent',
                color: gridDensity === 'dense' ? 'var(--cream)' : 'var(--brown-700)',
                cursor: 'pointer',
              }}
            >
              <Grid size={13} />
            </button>
            <button
              onClick={() => {
                playWoodClick(0.9);
                setGridDensity('spacious');
              }}
              title="3-Column Editorial Grid"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 7px',
                borderRadius: 4,
                border: 'none',
                backgroundColor: gridDensity === 'spacious' ? 'var(--brown-900)' : 'transparent',
                color: gridDensity === 'spacious' ? 'var(--cream)' : 'var(--brown-700)',
                cursor: 'pointer',
              }}
            >
              <LayoutGrid size={13} />
            </button>
          </div>

          <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--brown-600)', minWidth: 55, textAlign: 'right' }}>
            {filteredAndSorted.length} {filteredAndSorted.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>

      {/* ── Product Collection Grid ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '90px 0', color: 'var(--brown-600)' }}>
          <div
            style={{
              display: 'inline-block',
              width: 32,
              height: 32,
              border: '3px solid rgba(74, 58, 52, 0.18)',
              borderTop: '3px solid var(--brown-900)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: 12,
            }}
          />
          <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-display)' }}>Loading atelier pieces...</div>
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            padding: '64px 32px',
            textAlign: 'center',
            border: '1px solid rgba(208, 174, 146, 0.4)',
            boxShadow: '0 2px 10px rgba(44, 34, 30, 0.04)',
          }}
        >
          <Box size={36} color="var(--brown-400)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--brown-900)', margin: '0 0 6px' }}>
            No pieces match your search or filters
          </h3>
          <p style={{ fontSize: 13, color: 'var(--brown-600)', margin: '0 0 18px' }}>
            Try resetting your search query, or unchecking the &ldquo;In Stock Only&rdquo; and &ldquo;3D Ready&rdquo; filters.
          </p>
          <button
            onClick={() => {
              playWoodClick(0.9);
              setSearchQuery('');
              setActiveCategory('All');
              setOnlyInStock(false);
              setOnlyWith3D(false);
            }}
            style={{
              padding: '8px 18px',
              borderRadius: 6,
              backgroundColor: 'var(--brown-900)',
              color: 'var(--cream)',
              border: 'none',
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              cursor: 'pointer',
            }}
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: gridDensity === 'dense' ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
            gap: gridDensity === 'dense' ? 18 : 24,
          }}
        >
          {paginatedProducts.map((product) => {
            const price = parseFloat(product.sales_price);
            const mrp = product.mrp ? parseFloat(product.mrp) : null;
            const hasSavings = mrp && mrp > price;
            const savingsPercent = hasSavings ? Math.round(((mrp - price) / mrp) * 100) : 0;
            const stock = parseFloat(product.stock_qty) || 0;
            const isStocked = stock > 0;

            return (
              <div
                key={product.id}
                onClick={() => navigate(`/portal/catalogue/${product.id}`)}
                className="group"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '1px solid rgba(208, 174, 146, 0.38)',
                  boxShadow: '0 2px 8px rgba(44, 34, 30, 0.04)',
                  cursor: 'pointer',
                  transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 10px 24px rgba(44, 34, 30, 0.09)';
                  e.currentTarget.style.borderColor = 'var(--brown-600)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(44, 34, 30, 0.04)';
                  e.currentTarget.style.borderColor = 'rgba(208, 174, 146, 0.38)';
                }}
              >
                {/* Product Photo Showcase */}
                <div
                  style={{
                    position: 'relative',
                    height: gridDensity === 'dense' ? 220 : 270,
                    overflow: 'hidden',
                    backgroundColor: '#F7F3EE',
                  }}
                >
                  <img
                    src={resolveProductImage(product)}
                    alt={product.name}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 360ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.04)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1.0)';
                    }}
                  />

                  {/* Top-Left Category Badge */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      left: 10,
                      backgroundColor: 'rgba(255, 255, 255, 0.94)',
                      backdropFilter: 'blur(6px)',
                      color: 'var(--brown-900)',
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
                    }}
                  >
                    {product.category || 'Atelier'}
                  </div>

                  {/* Top-Right 3D Badge */}
                  {product.model_url && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        backgroundColor: 'rgba(38, 25, 20, 0.92)',
                        backdropFilter: 'blur(6px)',
                        color: 'var(--cream)',
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: 'var(--font-display)',
                        padding: '3px 8px',
                        borderRadius: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.14)',
                      }}
                    >
                      <Box size={11} />
                      <span>3D Ready</span>
                    </div>
                  )}

                  {/* Floating Action Overlay on Hover */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 8,
                      left: 8,
                      right: 8,
                      display: 'flex',
                      gap: 6,
                      zIndex: 5,
                    }}
                  >
                    <button
                      onClick={(e) => handleOpenQuickView(e, product)}
                      title="Quick Preview Specs & Finishes"
                      style={{
                        flex: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        padding: '6px 10px',
                        borderRadius: 6,
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(208, 174, 146, 0.5)',
                        color: 'var(--brown-900)',
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: 'var(--font-display)',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                        transition: 'all 120ms ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#FFFFFF';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      <Eye size={12} />
                      <span>Quick View</span>
                    </button>

                    {product.model_url && (
                      <button
                        onClick={(e) => handleLaunch3DStudio(e, product.model_url!)}
                        title="Place & Arrange in 3D Studio"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          padding: '6px 10px',
                          borderRadius: 6,
                          backgroundColor: 'rgba(38, 25, 20, 0.92)',
                          backdropFilter: 'blur(8px)',
                          border: 'none',
                          color: 'var(--cream)',
                          fontSize: 11,
                          fontWeight: 700,
                          fontFamily: 'var(--font-display)',
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                          transition: 'all 120ms ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--brown-900)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(38, 25, 20, 0.92)';
                          e.currentTarget.style.transform = 'none';
                        }}
                      >
                        <Compass size={12} />
                        <span>3D Room</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Content & Specifications */}
                <div
                  style={{
                    padding: '14px 16px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    {/* SKU Code */}
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--brown-500)',
                        letterSpacing: '0.04em',
                        marginBottom: 4,
                      }}
                    >
                      {product.sku || `UF-${product.id}`}
                    </div>

                    {/* Product Name */}
                    <h3
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 14.5,
                        fontWeight: 500,
                        color: 'var(--brown-800)',
                        margin: '0 0 8px',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        height: 40,
                        letterSpacing: '-0.01em',
                      }}
                      title={product.name}
                    >
                      {product.name}
                    </h3>

                    {/* Hardwood Finish Dots */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 12 }}>
                      {WOOD_FINISHES.map((f) => (
                        <span
                          key={f.name}
                          title={f.name}
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: '50%',
                            backgroundColor: f.color,
                            border: `1px solid ${f.border}`,
                            display: 'inline-block',
                          }}
                        />
                      ))}
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 500, color: 'var(--brown-600)', marginLeft: 4 }}>
                        4 Finishes
                      </span>
                    </div>
                  </div>

                  <div>
                    {/* Price & Savings Pill */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 16.5,
                          fontWeight: 600,
                          color: 'var(--brown-800)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatINR(product.sales_price)}
                      </span>

                      {hasSavings && (
                        <>
                          <span
                            style={{
                              fontSize: 12,
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--brown-500)',
                              textDecoration: 'line-through',
                            }}
                          >
                            {formatINR(product.mrp!)}
                          </span>
                          <span
                            style={{
                              fontSize: 9.5,
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--posted)',
                              backgroundColor: 'var(--posted-bg)',
                              padding: '1px 5px',
                              borderRadius: 3,
                              fontWeight: 700,
                            }}
                          >
                            -{savingsPercent}%
                          </span>
                        </>
                      )}
                    </div>

                    {/* Stock Status & Direct Link Chevron */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 8,
                        borderTop: '1px solid rgba(208, 174, 146, 0.25)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: 'var(--font-body)',
                          color: isStocked ? 'var(--posted)' : 'var(--brown-600)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor: isStocked ? 'var(--posted)' : 'var(--brown-400)',
                          }}
                        />
                        <span>{isStocked ? `${Math.round(stock)} ready to ship` : 'Made to order'}</span>
                      </span>

                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          fontFamily: 'var(--font-display)',
                          color: 'var(--brown-800)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        Details <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Grid Pagination ── */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginTop: 16,
            paddingBottom: 24,
          }}
        >
          <button
            onClick={() => {
              playWoodClick(0.9);
              setCurrentPage((p) => Math.max(1, p - 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={currentPage === 1}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid rgba(208, 174, 146, 0.45)',
              backgroundColor: currentPage === 1 ? 'transparent' : '#FFFFFF',
              color: currentPage === 1 ? 'var(--brown-400)' : 'var(--brown-900)',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            }}
          >
            &larr; Previous
          </button>

          <span
            style={{
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: 'var(--brown-700)',
              padding: '0 8px',
            }}
          >
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => {
              playWoodClick(0.9);
              setCurrentPage((p) => Math.min(totalPages, p + 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={currentPage === totalPages}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid rgba(208, 174, 146, 0.45)',
              backgroundColor: currentPage === totalPages ? 'transparent' : '#FFFFFF',
              color: currentPage === totalPages ? 'var(--brown-400)' : 'var(--brown-900)',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            Next &rarr;
          </button>
        </div>
      )}

      {/* ── Interactive Quick View Modal ── */}
      {quickViewProduct && (
        <div
          onClick={() => setQuickViewProduct(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(38, 25, 20, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FAF7F2',
              borderRadius: 14,
              maxWidth: 780,
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.28)',
              border: '1px solid rgba(208, 174, 146, 0.5)',
              display: 'grid',
              gridTemplateColumns: '1fr 1.15fr',
              position: 'relative',
              animation: 'fadeIn 180ms ease-out',
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setQuickViewProduct(null)}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(208, 174, 146, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--brown-900)',
                zIndex: 10,
              }}
            >
              <X size={16} />
            </button>

            {/* Left Image Column */}
            <div
              style={{
                position: 'relative',
                height: '100%',
                minHeight: 380,
                backgroundColor: '#F3ECE1',
              }}
            >
              <img
                src={resolveProductImage(quickViewProduct)}
                alt={quickViewProduct.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 14,
                  left: 14,
                  backgroundColor: 'rgba(255, 255, 255, 0.92)',
                  backdropFilter: 'blur(6px)',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: 'var(--brown-900)',
                  textTransform: 'uppercase',
                }}
              >
                {quickViewProduct.category || 'Atelier Collection'}
              </div>
            </div>

            {/* Right Information Column */}
            <div
              style={{
                padding: '32px 28px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10.5,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--brown-600)',
                    marginBottom: 4,
                  }}
                >
                  SKU: {quickViewProduct.sku || `UF-${quickViewProduct.id}`}
                </div>

                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 21,
                    fontWeight: 600,
                    color: 'var(--brown-800)',
                    margin: '0 0 12px',
                    lineHeight: 1.3,
                  }}
                >
                  {quickViewProduct.name}
                </h2>

                {/* Price */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 21,
                      fontWeight: 600,
                      color: 'var(--brown-800)',
                    }}
                  >
                    {formatINR(quickViewProduct.sales_price)}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--brown-500)' }}>
                    +{quickViewProduct.tax_rate}% GST Included
                  </span>
                </div>

                {/* Hardwood Finish Selector */}
                <div style={{ marginBottom: 18 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: 'var(--brown-600)',
                      marginBottom: 8,
                      letterSpacing: '0.08em',
                    }}
                  >
                    FINISH: <span style={{ color: 'var(--brown-900)' }}>{selectedQuickFinish}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {WOOD_FINISHES.map((f) => {
                      const isSelected = selectedQuickFinish === f.name;
                      return (
                        <button
                          key={f.name}
                          onClick={() => {
                            playWoodClick(0.9);
                            setSelectedQuickFinish(f.name);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '5px 10px',
                            borderRadius: 6,
                            border: `1px solid ${isSelected ? 'var(--brown-900)' : 'rgba(208, 174, 146, 0.45)'}`,
                            backgroundColor: isSelected ? 'rgba(208, 174, 146, 0.25)' : '#FFFFFF',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontFamily: 'var(--font-display)',
                            color: 'var(--brown-900)',
                            fontWeight: isSelected ? 700 : 500,
                          }}
                        >
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              backgroundColor: f.color,
                              border: `1px solid ${f.border}`,
                            }}
                          />
                          <span>{f.name.split(' ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Trust Highlights */}
                <div
                  style={{
                    borderTop: '1px solid rgba(208, 174, 146, 0.3)',
                    borderBottom: '1px solid rgba(208, 174, 146, 0.3)',
                    padding: '10px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: 11.5,
                    color: 'var(--brown-800)',
                    fontFamily: 'var(--font-body)',
                    marginBottom: 20,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={14} color="var(--posted)" />
                    <span>Solid Hardwood Mortise &amp; Tenon Joinery</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Truck size={14} color="var(--posted)" />
                    <span>
                      {parseFloat(quickViewProduct.stock_qty || '0') > 0
                        ? `${Math.round(parseFloat(quickViewProduct.stock_qty))} units ready to dispatch in 48 hours`
                        : 'Made-to-order craft with certified timber tracking'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    navigate(`/portal/catalogue/${quickViewProduct.id}`);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 8,
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--brown-900)',
                    color: 'var(--brown-900)',
                    fontSize: 12.5,
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <span>Full Specifications</span>
                  <ArrowRight size={13} />
                </button>

                {quickViewProduct.model_url && (
                  <button
                    onClick={(e) => handleLaunch3DStudio(e, quickViewProduct.model_url!)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 8,
                      backgroundColor: 'var(--brown-900)',
                      border: 'none',
                      color: 'var(--cream)',
                      fontSize: 12.5,
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: '0 3px 10px rgba(44, 34, 30, 0.2)',
                    }}
                  >
                    <Compass size={14} />
                    <span>Place in 3D Studio</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortalCataloguePage;
