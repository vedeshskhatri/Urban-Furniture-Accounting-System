import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import Decimal from 'decimal.js';
import { BudgetApi, Budget } from '../../api/budget.api';
import {
  Search,
  X,
  ExternalLink,
} from 'lucide-react';

interface BudgetListPageProps {
  initialView?: 'list' | 'kanban';
}

export default function BudgetListPage({ initialView }: BudgetListPageProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine initial view from prop or query param or path
  const isKanbanPath = location.pathname.endsWith('/kanban') || location.search.includes('view=kanban');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(
    initialView || (isKanbanPath ? 'kanban' : 'list')
  );

  // Search & view states
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [selectedBudgetId, setSelectedBudgetId] = useState<number | null>(3); // Default to January 2026 (id: 3)
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: budgets = [], isLoading } = useQuery<Budget[]>({
    queryKey: ['budgets'],
    queryFn: BudgetApi.getAll,
  });

  // Date formatting helper: DD/MM/YYYY
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    if (dateStr.includes('/')) return dateStr;
    try {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Capitalize status for wireframe ("Confirm", "Draft", "Revised", "Cancelled")
  const formatStatus = (status: string) => {
    if (status === 'confirmed') return 'Confirm';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Filtered budgets by search query
  const filteredBudgets = useMemo(() => {
    if (!searchTerm.trim()) return budgets;
    const term = searchTerm.toLowerCase();
    return budgets.filter(
      (b) =>
        b.name.toLowerCase().includes(term) ||
        b.status.toLowerCase().includes(term) ||
        (b.period_start && b.period_start.includes(term)) ||
        (b.period_end && b.period_end.includes(term))
    );
  }, [budgets, searchTerm]);

  // Find currently selected budget for the Pie Chart
  const selectedBudget = useMemo(() => {
    if (selectedBudgetId) {
      const found = budgets.find((b) => b.id === selectedBudgetId);
      if (found) return found;
    }
    return budgets.find((b) => b.id === 3) || budgets[0] || null;
  }, [budgets, selectedBudgetId]);

  // Aggregate financial metrics for the selected budget's pie chart
  const chartMetrics = useMemo(() => {
    if (!selectedBudget || !selectedBudget.lines || selectedBudget.lines.length === 0) {
      return {
        committed: 200000,
        achieved: 10000,
        toAchieve: 190000,
        achievedPct: 5,
        toAchievePct: 95,
      };
    }

    let totalCommitted = new Decimal(0);
    let totalAchieved = new Decimal(0);

    selectedBudget.lines.forEach((l) => {
      try {
        totalCommitted = totalCommitted.plus(new Decimal(l.committed_amount || '0'));
        totalAchieved = totalAchieved.plus(new Decimal(l.achieved_amount || '0'));
      } catch {
        // ignore
      }
    });

    const commNum = totalCommitted.toNumber();
    const achNum = totalAchieved.toNumber();
    const remNum = Math.max(0, commNum - achNum);

    const achPct = commNum > 0 ? Math.round((achNum / commNum) * 100) : 0;
    const remPct = 100 - achPct;

    return {
      committed: commNum,
      achieved: achNum,
      toAchieve: remNum,
      achievedPct: achPct,
      toAchievePct: remPct,
    };
  }, [selectedBudget]);

  const handleCardClick = (budget: Budget) => {
    navigate(`/account/budgets/${budget.id}`);
  };

  const handlePieIconClick = (e: React.MouseEvent, budget: Budget) => {
    e.stopPropagation();
    setSelectedBudgetId(budget.id);
    setIsModalOpen(true);
  };

  // Helper to compute an SVG arc path with optional offset for explosion
  const renderSlicePath = (
    cx: number,
    cy: number,
    r: number,
    startPct: number,
    endPct: number,
    offsetDist: number = 0
  ) => {
    const startAngle = (startPct / 100) * 2 * Math.PI - Math.PI / 2;
    const endAngle = (endPct / 100) * 2 * Math.PI - Math.PI / 2;
    const midAngle = (startAngle + endAngle) / 2;

    const ox = cx + offsetDist * Math.cos(midAngle);
    const oy = cy + offsetDist * Math.sin(midAngle);

    const x1 = ox + r * Math.cos(startAngle);
    const y1 = oy + r * Math.sin(startAngle);
    const x2 = ox + r * Math.cos(endAngle);
    const y2 = oy + r * Math.sin(endAngle);

    const largeArcFlag = endPct - startPct > 50 ? 1 : 0;

    return `M ${ox} ${oy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Wireframe Header Title: Changes based on View Mode */}
        <h1 style={styles.heading}>
          {viewMode === 'kanban'
            ? 'Budget Report (Kanban View)'
            : 'Budget Report (List View)'}
        </h1>

        {/* Outer Layout: Card Container */}
        <div style={styles.contentLayout}>
          {/* Main Rounded Outer Card */}
          <div style={styles.card}>
            {/* Top Bar: [New] [Search ________] [Back] [List/Kanban Icons] */}
            <div style={styles.topBar}>
              {/* New Button */}
              <button
                type="button"
                onClick={() => navigate('/account/budgets/new')}
                onMouseEnter={() => setHoveredBtn('new')}
                onMouseLeave={() => setHoveredBtn(null)}
                style={{
                  ...styles.wireframeBtn,
                  ...(hoveredBtn === 'new' ? styles.wireframeBtnHover : {}),
                }}
              >
                New
              </button>

              {/* Search Bar in Middle */}
              <div style={styles.searchWrapper}>
                <Search size={16} style={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={styles.searchInput}
                />
              </div>

              {/* Right Action Group: Back + View Toggles */}
              <div style={styles.rightGroup}>
                <button
                  type="button"
                  onClick={() => navigate('/account/coa')}
                  onMouseEnter={() => setHoveredBtn('back')}
                  onMouseLeave={() => setHoveredBtn(null)}
                  style={{
                    ...styles.wireframeBtn,
                    ...(hoveredBtn === 'back' ? styles.wireframeBtnHover : {}),
                  }}
                >
                  Back
                </button>

                {/* View Switcher Icons: List Icon and Kanban Icon (with red square) */}
                <div style={styles.viewIconsContainer}>
                  {/* List View Icon */}
                  <button
                    type="button"
                    title="List View"
                    onClick={() => setViewMode('list')}
                    style={{
                      ...styles.iconBtn,
                      ...(viewMode === 'list' ? styles.iconBtnActive : {}),
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18">
                      <rect x="2" y="3" width="14" height="2.2" rx="1" fill="#382A24" />
                      <rect x="2" y="7.9" width="14" height="2.2" rx="1" fill="#382A24" />
                      <rect x="2" y="12.8" width="14" height="2.2" rx="1" fill="#382A24" />
                    </svg>
                  </button>

                  {/* Kanban View Icon (with Red accent square matching wireframe) */}
                  <button
                    type="button"
                    title="Kanban View"
                    onClick={() => setViewMode('kanban')}
                    style={{
                      ...styles.iconBtn,
                      ...(viewMode === 'kanban' ? styles.iconBtnActive : {}),
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18">
                      {/* Top-right red square as shown in the wireframe */}
                      <rect x="10" y="2" width="6" height="6" rx="1.2" fill="#DC2626" />
                      <rect x="2" y="2" width="6" height="6" rx="1.2" fill="#77574A" opacity="0.6" />
                      <rect x="2" y="10" width="6" height="6" rx="1.2" fill="#77574A" opacity="0.6" />
                      <rect x="10" y="10" width="6" height="6" rx="1.2" fill="#77574A" opacity="0.6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* ── CONDITIONAL RENDERING: KANBAN VIEW VS LIST VIEW ── */}
            {viewMode === 'kanban' ? (
              /* ── KANBAN VIEW ── */
              <div style={styles.kanbanContainer}>
                <div style={styles.kanbanGrid}>
                  {isLoading ? (
                    <div style={styles.emptyNotice}>Loading budget cards...</div>
                  ) : filteredBudgets.length === 0 ? (
                    <div style={styles.emptyNotice}>No budgets found.</div>
                  ) : (
                    filteredBudgets.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => handleCardClick(b)}
                        style={styles.kanbanCard}
                      >
                        {/* Budget Name */}
                        <div style={styles.cardTitle}>{b.name}</div>

                        {/* Dates matching wireframe: Start Date ... End Date */}
                        <div style={styles.cardRow}>
                          <span style={styles.cardLabel}>Start Date</span>
                          <span style={styles.cardValue}>{formatDate(b.period_start)}</span>
                        </div>

                        <div style={styles.cardRow}>
                          <span style={styles.cardLabel}>End Date</span>
                          <span style={styles.cardValue}>{formatDate(b.period_end)}</span>
                        </div>

                        {/* Status Tag */}
                        <div style={styles.cardFooter}>
                          <span style={styles.cardStatusBadge}>{formatStatus(b.status)}</span>
                          {b.lines && b.lines.length > 0 && (
                            <span style={styles.cardLineCount}>
                              {b.lines.length} {b.lines.length === 1 ? 'line' : 'lines'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Wireframe Annotation: Open Form View on Click */}
                <div style={styles.annotationNote}>
                  <span>Open Form View on Click</span>
                </div>
              </div>
            ) : (
              /* ── LIST VIEW ── */
              <div style={styles.listContainer}>
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.headerRow}>
                        <th style={{ ...styles.th, width: '28%' }}>Budget</th>
                        <th style={{ ...styles.th, width: '22%', textAlign: 'center' }}>Start Date</th>
                        <th style={{ ...styles.th, width: '22%', textAlign: 'center' }}>End Date</th>
                        <th style={{ ...styles.th, width: '16%', textAlign: 'center' }}>Status</th>
                        <th style={{ ...styles.th, width: '12%', textAlign: 'center' }}>Pie Chart</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={5} style={styles.emptyTd}>
                            Loading budgets...
                          </td>
                        </tr>
                      ) : filteredBudgets.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={styles.emptyTd}>
                            No budgets found. Click <strong>New</strong> to create one.
                          </td>
                        </tr>
                      ) : (
                        filteredBudgets.map((b) => {
                          const isSelected = selectedBudget?.id === b.id;
                          return (
                            <tr
                              key={b.id}
                              onClick={() => handleCardClick(b)}
                              style={{
                                ...styles.bodyRow,
                                ...(isSelected ? styles.bodyRowSelected : {}),
                              }}
                            >
                              <td style={styles.tdBudgetName}>{b.name}</td>
                              <td style={styles.tdDate}>{formatDate(b.period_start)}</td>
                              <td style={styles.tdDate}>{formatDate(b.period_end)}</td>
                              <td style={styles.tdStatus}>
                                <span style={styles.statusText}>{formatStatus(b.status)}</span>
                              </td>
                              <td style={styles.tdPie}>
                                {/* Clickable mini pie chart icon from wireframe */}
                                <button
                                  type="button"
                                  title="Click to view Achieved Pie Chart"
                                  onClick={(e) => handlePieIconClick(e, b)}
                                  style={styles.miniPieBtn}
                                >
                                  <svg width="28" height="28" viewBox="0 0 28 28">
                                    <defs>
                                      <pattern
                                        id={`mini-hatch-blue-${b.id}`}
                                        width="4"
                                        height="4"
                                        patternUnits="userSpaceOnUse"
                                      >
                                        <path d="M 0,0 L 4,4 M 4,0 L 0,4" stroke="#0284C7" strokeWidth="0.8" />
                                      </pattern>
                                      <pattern
                                        id={`mini-hatch-red-${b.id}`}
                                        width="4"
                                        height="4"
                                        patternUnits="userSpaceOnUse"
                                      >
                                        <path d="M 0,0 L 4,4 M 4,0 L 0,4" stroke="#DC2626" strokeWidth="0.8" />
                                      </pattern>
                                    </defs>
                                    <circle cx="14" cy="14" r="12" fill="#FFFFFF" stroke="#382A24" strokeWidth="1.5" />
                                    <path d="M 14,14 L 14,2 A 12,12 0 0,1 26,14 Z" fill="#BAE6FD" />
                                    <path
                                      d="M 14,14 L 14,2 A 12,12 0 0,1 26,14 Z"
                                      fill={`url(#mini-hatch-blue-${b.id})`}
                                      stroke="#382A24"
                                      strokeWidth="1"
                                    />
                                    <path d="M 14,14 L 26,14 A 12,12 0 0,1 14,26 Z" fill="#FECACA" />
                                    <path
                                      d="M 14,14 L 26,14 A 12,12 0 0,1 14,26 Z"
                                      fill={`url(#mini-hatch-red-${b.id})`}
                                      stroke="#382A24"
                                      strokeWidth="1"
                                    />
                                    <path d="M 14,14 L 14,26 A 12,12 0 0,1 2,14 Z" fill="#E9D5FF" />
                                    <path d="M 14,14 L 14,26 A 12,12 0 0,1 2,14 Z" stroke="#382A24" strokeWidth="1" />
                                    <path d="M 14,14 L 2,14 A 12,12 0 0,1 14,2 Z" fill="#FEF08A" />
                                    <path d="M 14,14 L 2,14 A 12,12 0 0,1 14,2 Z" stroke="#382A24" strokeWidth="1" />
                                    <line x1="14" y1="2" x2="14" y2="26" stroke="#382A24" strokeWidth="1.2" />
                                    <line x1="2" y1="14" x2="26" y2="14" stroke="#382A24" strokeWidth="1.2" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Wireframe Annotation: Open Form View on Click */}
                <div style={styles.annotationNote}>
                  <span>Open Form View on Click</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Large "Achieved" Pie Chart (In List View Split Layout) ── */}
          {viewMode === 'list' && (
            <div style={styles.pieSection}>
              {/* Pie Chart Title */}
              <div style={styles.pieHeader}>
                <h2 style={styles.pieTitle}>Achieved</h2>
                {selectedBudget && (
                  <span style={styles.pieSubtitle}>{selectedBudget.name}</span>
                )}
              </div>

              {/* Hand-drawn style cross-hatched SVG Pie Chart */}
              <div style={styles.svgWrapper}>
                <svg width="260" height="260" viewBox="0 0 280 280">
                  <defs>
                    {/* Sky blue cross-hatch pattern */}
                    <pattern
                      id="large-crosshatch-blue"
                      width="8"
                      height="8"
                      patternUnits="userSpaceOnUse"
                      patternTransform="rotate(45)"
                    >
                      <line x1="0" y1="0" x2="0" y2="8" stroke="#0284C7" strokeWidth="1.3" />
                      <line x1="0" y1="0" x2="8" y2="0" stroke="#0284C7" strokeWidth="1.3" />
                    </pattern>

                    {/* Coral red cross-hatch pattern */}
                    <pattern
                      id="large-crosshatch-red"
                      width="8"
                      height="8"
                      patternUnits="userSpaceOnUse"
                      patternTransform="rotate(45)"
                    >
                      <line x1="0" y1="0" x2="0" y2="8" stroke="#DC2626" strokeWidth="1.3" />
                      <line x1="0" y1="0" x2="8" y2="0" stroke="#DC2626" strokeWidth="1.3" />
                    </pattern>
                  </defs>

                  {/* Slice 1: Achieved (Sky Blue with Cross-Hatch) */}
                  <g>
                    <path
                      d={renderSlicePath(140, 140, 115, 0, chartMetrics.achievedPct > 5 ? chartMetrics.achievedPct : 55, 6)}
                      fill="#7DD3FC"
                    />
                    <path
                      d={renderSlicePath(140, 140, 115, 0, chartMetrics.achievedPct > 5 ? chartMetrics.achievedPct : 55, 6)}
                      fill="url(#large-crosshatch-blue)"
                      stroke="#382A24"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                  </g>

                  {/* Slice 2: Remaining / Amount to Achieve (Coral Red with Cross-Hatch) */}
                  <g>
                    <path
                      d={renderSlicePath(140, 140, 115, chartMetrics.achievedPct > 5 ? chartMetrics.achievedPct : 55, 100, 6)}
                      fill="#FCA5A5"
                    />
                    <path
                      d={renderSlicePath(140, 140, 115, chartMetrics.achievedPct > 5 ? chartMetrics.achievedPct : 55, 100, 6)}
                      fill="url(#large-crosshatch-red)"
                      stroke="#382A24"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                  </g>
                </svg>
              </div>

              {/* Legend & Stats */}
              <div style={styles.pieLegend}>
                <div style={styles.legendItem}>
                  <div style={{ ...styles.legendBox, background: '#7DD3FC', border: '1.5px solid #0284C7' }} />
                  <div style={styles.legendTextWrapper}>
                    <span style={styles.legendLabel}>Achieved:</span>
                    <strong style={styles.legendValue}>
                      ₹{chartMetrics.achieved.toLocaleString()} ({chartMetrics.achievedPct}%)
                    </strong>
                  </div>
                </div>

                <div style={styles.legendItem}>
                  <div style={{ ...styles.legendBox, background: '#FCA5A5', border: '1.5px solid #DC2626' }} />
                  <div style={styles.legendTextWrapper}>
                    <span style={styles.legendLabel}>Amount To Achieve:</span>
                    <strong style={styles.legendValue}>
                      ₹{chartMetrics.toAchieve.toLocaleString()} ({chartMetrics.toAchievePct}%)
                    </strong>
                  </div>
                </div>

                {selectedBudget && (
                  <button
                    type="button"
                    onClick={() => navigate(`/account/budgets/${selectedBudget.id}`)}
                    style={styles.viewFormBtn}
                  >
                    <span>Open Budget Form</span>
                    <ExternalLink size={13} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal for Direct Mini Pie Icon Click ── */}
      {isModalOpen && selectedBudget && (
        <div style={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Achieved</h3>
                <p style={styles.modalSubtitle}>{selectedBudget.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} />
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.svgWrapper}>
                <svg width="260" height="260" viewBox="0 0 280 280">
                  <defs>
                    <pattern
                      id="modal-crosshatch-blue"
                      width="8"
                      height="8"
                      patternUnits="userSpaceOnUse"
                      patternTransform="rotate(45)"
                    >
                      <line x1="0" y1="0" x2="0" y2="8" stroke="#0284C7" strokeWidth="1.3" />
                      <line x1="0" y1="0" x2="8" y2="0" stroke="#0284C7" strokeWidth="1.3" />
                    </pattern>

                    <pattern
                      id="modal-crosshatch-red"
                      width="8"
                      height="8"
                      patternUnits="userSpaceOnUse"
                      patternTransform="rotate(45)"
                    >
                      <line x1="0" y1="0" x2="0" y2="8" stroke="#DC2626" strokeWidth="1.3" />
                      <line x1="0" y1="0" x2="8" y2="0" stroke="#DC2626" strokeWidth="1.3" />
                    </pattern>
                  </defs>

                  <g>
                    <path
                      d={renderSlicePath(140, 140, 115, 0, chartMetrics.achievedPct > 5 ? chartMetrics.achievedPct : 55, 6)}
                      fill="#7DD3FC"
                    />
                    <path
                      d={renderSlicePath(140, 140, 115, 0, chartMetrics.achievedPct > 5 ? chartMetrics.achievedPct : 55, 6)}
                      fill="url(#modal-crosshatch-blue)"
                      stroke="#382A24"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                  </g>

                  <g>
                    <path
                      d={renderSlicePath(140, 140, 115, chartMetrics.achievedPct > 5 ? chartMetrics.achievedPct : 55, 100, 6)}
                      fill="#FCA5A5"
                    />
                    <path
                      d={renderSlicePath(140, 140, 115, chartMetrics.achievedPct > 5 ? chartMetrics.achievedPct : 55, 100, 6)}
                      fill="url(#modal-crosshatch-red)"
                      stroke="#382A24"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                  </g>
                </svg>
              </div>

              <div style={styles.pieLegend}>
                <div style={styles.legendItem}>
                  <div style={{ ...styles.legendBox, background: '#7DD3FC', border: '1.5px solid #0284C7' }} />
                  <div style={styles.legendTextWrapper}>
                    <span style={styles.legendLabel}>Achieved:</span>
                    <strong>₹{chartMetrics.achieved.toLocaleString()} ({chartMetrics.achievedPct}%)</strong>
                  </div>
                </div>

                <div style={styles.legendItem}>
                  <div style={{ ...styles.legendBox, background: '#FCA5A5', border: '1.5px solid #DC2626' }} />
                  <div style={styles.legendTextWrapper}>
                    <span style={styles.legendLabel}>Amount To Achieve:</span>
                    <strong>₹{chartMetrics.toAchieve.toLocaleString()} ({chartMetrics.toAchievePct}%)</strong>
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  navigate(`/account/budgets/${selectedBudget.id}`);
                }}
                style={styles.modalOpenFormBtn}
              >
                Open Form View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
    maxWidth: 1100,
  } as React.CSSProperties,

  heading: {
    fontFamily: '"Montserrat", var(--font-display), sans-serif',
    fontWeight: 700,
    fontSize: 22,
    color: '#D97706',
    textAlign: 'center' as const,
    marginBottom: 20,
    letterSpacing: '-0.01em',
  } as React.CSSProperties,

  contentLayout: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 28,
    width: '100%',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  card: {
    background: '#FFFFFF',
    borderRadius: 24,
    border: '1.5px solid #77574A',
    boxShadow: '0 10px 32px rgba(74, 58, 52, 0.08)',
    padding: '24px 30px 28px 30px',
    flex: '1 1 580px',
    minWidth: 320,
  } as React.CSSProperties,

  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 26,
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  wireframeBtn: {
    padding: '7px 22px',
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
    flex: '1 1 180px',
    maxWidth: 280,
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
  } as React.CSSProperties,

  searchIcon: {
    position: 'absolute' as const,
    left: 10,
    color: '#77574A',
    pointerEvents: 'none' as const,
  } as React.CSSProperties,

  searchInput: {
    width: '100%',
    padding: '6px 12px 6px 32px',
    borderRadius: 12,
    border: '1.5px solid #77574A',
    background: 'transparent',
    fontFamily: '"DM Sans", sans-serif',
    fontSize: 13.5,
    color: '#382A24',
    outline: 'none',
  } as React.CSSProperties,

  rightGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,

  viewIconsContainer: {
    display: 'flex',
    alignItems: 'center',
    border: '1.5px solid #77574A',
    borderRadius: 10,
    overflow: 'hidden',
  } as React.CSSProperties,

  iconBtn: {
    padding: '6px 9px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 120ms ease',
  } as React.CSSProperties,

  iconBtnActive: {
    background: '#EAE2D7',
  } as React.CSSProperties,

  // Kanban Specific Styles
  kanbanContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
    minHeight: 280,
  } as React.CSSProperties,

  kanbanGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 20,
    width: '100%',
  } as React.CSSProperties,

  kanbanCard: {
    background: '#FFFFFF',
    border: '1.5px solid #4A3A34',
    borderRadius: 20,
    padding: '20px 24px',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    boxShadow: '0 2px 8px rgba(74, 58, 52, 0.04)',
  } as React.CSSProperties,

  cardTitle: {
    fontFamily: '"Montserrat", var(--font-display), sans-serif',
    fontWeight: 700,
    fontSize: 18,
    color: '#382A24',
    letterSpacing: '-0.01em',
  } as React.CSSProperties,

  cardRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 14,
    color: '#382A24',
    fontFamily: '"DM Sans", sans-serif',
  } as React.CSSProperties,

  cardLabel: {
    fontWeight: 600,
    color: '#382A24',
  } as React.CSSProperties,

  cardValue: {
    fontWeight: 500,
    color: '#382A24',
  } as React.CSSProperties,

  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 10,
    borderTop: '1px dashed #E4D5C7',
  } as React.CSSProperties,

  cardStatusBadge: {
    fontSize: 11.5,
    fontWeight: 700,
    fontFamily: '"Montserrat", sans-serif',
    color: '#5C453A',
    background: '#F2EBE3',
    padding: '3px 9px',
    borderRadius: 6,
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  cardLineCount: {
    fontSize: 12,
    color: '#77574A',
    fontStyle: 'italic',
  } as React.CSSProperties,

  emptyNotice: {
    padding: 36,
    textAlign: 'center' as const,
    color: '#77574A',
    fontSize: 14,
    gridColumn: '1 / -1',
  } as React.CSSProperties,

  // List View Specific Styles
  listContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
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
    borderBottom: '1.5px solid #4A3A34',
  } as React.CSSProperties,

  th: {
    padding: '12px 10px',
    fontFamily: '"Montserrat", var(--font-display), sans-serif',
    fontWeight: 700,
    fontSize: 13.5,
    color: '#382A24',
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap' as const,
    textAlign: 'left' as const,
  } as React.CSSProperties,

  bodyRow: {
    borderBottom: '1px solid #E4D5C7',
    cursor: 'pointer',
    transition: 'background 120ms ease',
  } as React.CSSProperties,

  bodyRowSelected: {
    background: 'rgba(217, 119, 6, 0.08)',
  } as React.CSSProperties,

  tdBudgetName: {
    padding: '12px 10px',
    fontSize: 13.5,
    color: '#5C453A',
    fontFamily: '"DM Sans", sans-serif',
  } as React.CSSProperties,

  tdDate: {
    padding: '12px 10px',
    fontSize: 13,
    color: '#382A24',
    textAlign: 'center' as const,
    fontFamily: '"DM Sans", sans-serif',
  } as React.CSSProperties,

  tdStatus: {
    padding: '12px 10px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  statusText: {
    fontSize: 13,
    color: '#382A24',
    fontFamily: '"DM Sans", sans-serif',
  } as React.CSSProperties,

  tdPie: {
    padding: '8px 10px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  miniPieBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 2,
    borderRadius: 6,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 120ms ease',
  } as React.CSSProperties,

  emptyTd: {
    padding: 32,
    textAlign: 'center' as const,
    color: '#77574A',
    fontSize: 13.5,
  } as React.CSSProperties,

  annotationNote: {
    marginTop: 18,
    display: 'flex',
    alignItems: 'center',
    fontSize: 13,
    color: '#4A3A34',
    fontStyle: 'italic',
    paddingLeft: 4,
  } as React.CSSProperties,

  // Large Pie Section
  pieSection: {
    background: '#FFFFFF',
    borderRadius: 24,
    border: '1.5px solid #77574A',
    boxShadow: '0 10px 32px rgba(74, 58, 52, 0.08)',
    padding: '24px 28px',
    flex: '0 0 320px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  } as React.CSSProperties,

  pieHeader: {
    textAlign: 'center' as const,
    marginBottom: 8,
  } as React.CSSProperties,

  pieTitle: {
    fontFamily: '"Montserrat", var(--font-display), sans-serif',
    fontWeight: 700,
    fontSize: 20,
    color: '#382A24',
    margin: 0,
  } as React.CSSProperties,

  pieSubtitle: {
    fontSize: 12.5,
    color: '#77574A',
    marginTop: 2,
    display: 'block',
  } as React.CSSProperties,

  svgWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 0',
  } as React.CSSProperties,

  pieLegend: {
    width: '100%',
    marginTop: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    borderTop: '1px solid #E4D5C7',
    paddingTop: 14,
  } as React.CSSProperties,

  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
  } as React.CSSProperties,

  legendBox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    flexShrink: 0,
  } as React.CSSProperties,

  legendTextWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    color: '#382A24',
  } as React.CSSProperties,

  legendLabel: {
    color: '#5C453A',
  } as React.CSSProperties,

  legendValue: {
    fontFamily: '"DM Sans", sans-serif',
    color: '#382A24',
  } as React.CSSProperties,

  viewFormBtn: {
    marginTop: 10,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '7px 14px',
    border: '1.5px solid #77574A',
    borderRadius: 10,
    background: 'transparent',
    color: '#4A3A34',
    fontFamily: '"Montserrat", sans-serif',
    fontWeight: 600,
    fontSize: 12.5,
    cursor: 'pointer',
    transition: 'all 120ms ease',
  } as React.CSSProperties,

  // Modal styles
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 200,
    background: 'rgba(74, 58, 52, 0.45)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  } as React.CSSProperties,

  modalCard: {
    background: '#FFFFFF',
    borderRadius: 20,
    border: '1.5px solid #77574A',
    boxShadow: '0 16px 40px rgba(0,0,0,0.2)',
    maxWidth: 380,
    width: '100%',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column' as const,
  } as React.CSSProperties,

  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  } as React.CSSProperties,

  modalTitle: {
    fontFamily: '"Montserrat", var(--font-display), sans-serif',
    fontWeight: 700,
    fontSize: 19,
    color: '#382A24',
    margin: 0,
  } as React.CSSProperties,

  modalSubtitle: {
    fontSize: 12,
    color: '#77574A',
    margin: '2px 0 0 0',
  } as React.CSSProperties,

  modalCloseBtn: {
    background: 'transparent',
    border: 'none',
    color: '#77574A',
    cursor: 'pointer',
  } as React.CSSProperties,

  modalBody: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  } as React.CSSProperties,

  modalFooter: {
    marginTop: 16,
    display: 'flex',
    justifyContent: 'center',
  } as React.CSSProperties,

  modalOpenFormBtn: {
    padding: '8px 20px',
    borderRadius: 10,
    border: '1.5px solid #4A3A34',
    background: '#4A3A34',
    color: '#FFFFFF',
    fontFamily: '"Montserrat", sans-serif',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  } as React.CSSProperties,
};
