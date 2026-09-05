import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  LucideIcon,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  User,
  Users,
  Package,
  Landmark,
  BookOpen,
  BookText,
  PieChart,
  FileBarChart,
  ShoppingCart,
  Receipt,
  DollarSign,
  CreditCard,
  ShoppingBag,
  FileText,
  FileCheck,
  Scale,
  TrendingUp,
  ShieldCheck,
  ScrollText,
  BarChart2,
  FileSpreadsheet,
  FolderCheck,
  Activity,
} from 'lucide-react';
import { MegaMenu } from './MegaMenu';
import RecordTimelineDrawer from '../audit/RecordTimelineDrawer';
import api from '../../lib/axios';
import { BrandLogo } from '../ui/BrandLogo';
import { GlobalCommandPalette } from '../common/GlobalCommandPalette';
import { LiveLedgerAuditBadge } from '../common/LiveLedgerAuditBadge';
import { DemoRoleSwitcher } from '../common/DemoRoleSwitcher';

interface SubNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const MODULE_SUBNAV_MAP: Record<string, SubNavItem[]> = {
  account: [
    { label: 'Contacts', to: '/account/contacts', icon: Users },
    { label: 'Products & Services', to: '/account/products', icon: Package },
    { label: 'Chart of Accounts', to: '/account/coa', icon: Landmark },
    { label: 'Journals', to: '/account/journals', icon: BookOpen },
    { label: 'Journal Entries', to: '/account/journal-entries', icon: BookText },
    { label: 'Analyticals', to: '/account/analytics', icon: PieChart },
    { label: 'Analytical Budget', to: '/account/budgets', icon: FileBarChart },
  ],
  sales: [
    { label: 'Sales Orders', to: '/sales/orders', icon: ShoppingCart },
    { label: 'Customer Invoices', to: '/sales/invoices', icon: Receipt },
    { label: 'Receivables', to: '/sales/receivables', icon: DollarSign },
    { label: 'Register Payment', to: '/sales/payments', icon: CreditCard },
  ],
  purchase: [
    { label: 'Purchase Orders', to: '/purchase/orders', icon: ShoppingBag },
    { label: 'Vendor Bills', to: '/purchase/bills', icon: FileText },
    { label: 'Vendor Statements', to: '/purchase/statements', icon: FileCheck },
  ],
  report: [
    { label: 'Balance Sheet', to: '/report/balance-sheet', icon: Scale },
    { label: 'Profit & Loss', to: '/report/profit-loss', icon: TrendingUp },
    { label: 'Budget Performance', to: '/report/budget', icon: FileBarChart },
    { label: 'Analytics Engine', to: '/analytics', icon: BarChart2 },
    { label: 'System Integrity', to: '/integrity', icon: ShieldCheck },
    { label: 'Live Monitor', to: '/monitor', icon: Activity },
    { label: 'Audit Log & Chatter', to: '/audit', icon: ScrollText },
  ],
  tools: [
    { label: 'Template Library', to: '/tools/templates', icon: FileSpreadsheet },
    { label: 'My Saved Templates', to: '/tools/templates?tab=saved', icon: FolderCheck },
    { label: 'Template Management', to: '/tools/templates/manage', icon: ShieldCheck, adminOnly: true },
  ],
};

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [selectedNavModule, setSelectedNavModule] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  // Close mega menu on route change
  useEffect(() => {
    setIsMegaMenuOpen(false);
    setSelectedNavModule(null);
  }, [location.pathname]);

  const handleNavModuleClick = (menuName: string) => {
    if (isMegaMenuOpen && selectedNavModule === menuName) {
      setIsMegaMenuOpen(false);
      setSelectedNavModule(null);
    } else {
      setSelectedNavModule(menuName);
      setIsMegaMenuOpen(true);
    }
  };

  const isAuthenticated = localStorage.getItem('urban_logged_in') === 'true';

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Ignore network failure on logout
    } finally {
      localStorage.removeItem('urban_logged_in');
      localStorage.removeItem('urban_user');
      navigate('/login', { replace: true });
    }
  };

  let currentUser: { full_name?: string; login_id?: string; role?: string } | null = null;
  try {
    const raw = localStorage.getItem('urban_user');
    if (raw) currentUser = JSON.parse(raw);
  } catch {
    // Ignore JSON error
  }

  const isManager = currentUser?.role === 'manager';
  const navModules = isManager
    ? ['Sales', 'Purchase', 'Report', 'Tools']
    : ['Sales', 'Purchase', 'Account', 'Report', 'Tools'];

  // Determine active module and whether sub-nav should be displayed
  const activeModule = ['sales', 'purchase', 'account', 'report', 'tools'].find((m) =>
    location.pathname.startsWith(`/${m}`)
  );

  const isFormView =
    location.pathname.endsWith('/new') ||
    /\/\d+$/.test(location.pathname);

  const currentSubNav = activeModule
    ? (MODULE_SUBNAV_MAP[activeModule] ?? []).filter((it) => !it.adminOnly || currentUser?.role === 'admin')
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--cream)' }}>
      {/* ── Top Navigation Bar ── */}
      <header
        ref={headerRef}
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid rgba(208, 174, 146, 0.35)',
          boxShadow: '0 1px 4px rgba(74, 58, 52, 0.04)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: '0 auto',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 56,
            position: 'relative',
          }}
        >
          {/* Left: Brand Logo */}
          <div style={{ display: 'flex', alignItems: 'center', height: '100%', zIndex: 2 }}>
            <NavLink
              to="/dashboard"
              onClick={() => {
                setIsMegaMenuOpen(false);
                setSelectedNavModule(null);
              }}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 18,
                color: 'var(--brown-900)',
                letterSpacing: '-0.01em',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                zIndex: 2,
                whiteSpace: 'nowrap',
              }}
            >
              <BrandLogo size={24} variant="dark" />
            </NavLink>
          </div>

          {/* Center: Module Navigation Headings shifted slightly leftwards for optical balance */}
          <nav
            style={{
              position: 'absolute',
              left: '44%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              height: '100%',
              gap: 4,
              zIndex: 2,
            }}
          >
            {navModules.map((menuName) => {
              const isCurrentRoute = location.pathname.startsWith(`/${menuName.toLowerCase()}`);
              const isSelected = isMegaMenuOpen && selectedNavModule === menuName;

              return (
                <button
                  key={menuName}
                  type="button"
                  onClick={() => handleNavModuleClick(menuName)}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: isSelected || isCurrentRoute ? 700 : 500,
                    fontSize: 14,
                    color: isSelected || isCurrentRoute ? 'var(--brown-900)' : 'var(--brown-700)',
                    background: isSelected ? 'rgba(235, 215, 190, 0.45)' : 'transparent',
                    border: 'none',
                    borderBottom: isCurrentRoute
                      ? '2px solid var(--brown-900)'
                      : isSelected
                      ? '2px solid var(--brown-600)'
                      : '2px solid transparent',
                    padding: '0 14px',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                    transition: 'all 120ms ease-out',
                    outline: 'none',
                    borderRadius: '6px 6px 0 0',
                    whiteSpace: 'nowrap',
                  }}
                  title={`Open ${menuName} menu`}
                >
                  <span>{menuName}</span>
                  <ChevronDown
                    size={13}
                    style={{
                      transform: isSelected ? 'rotate(180deg)' : 'none',
                      transition: 'transform 150ms ease-out',
                      opacity: isSelected ? 1 : 0.6,
                    }}
                  />
                </button>
              );
            })}
          </nav>

          {/* Unified 4-Column Mega Menu matching wireframe */}
          <MegaMenu
            isOpen={isMegaMenuOpen}
            onClose={() => {
              setIsMegaMenuOpen(false);
              setSelectedNavModule(null);
            }}
          />

          {/* Right Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, zIndex: 2 }}>
            <LiveLedgerAuditBadge />
            <DemoRoleSwitcher />
            <Link
              to="/monitor"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 11px',
                fontSize: 12,
                fontWeight: 600,
                color: '#15803d',
                background: 'rgba(22, 163, 74, 0.08)',
                border: '1px solid rgba(22, 163, 74, 0.25)',
                borderRadius: 8,
                textDecoration: 'none',
                transition: 'all 120ms ease-out',
              }}
              title="Open Live Correctness Monitor (Real-time TV Screen)"
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: '#16a34a',
                  display: 'inline-block',
                  boxShadow: '0 0 6px #16a34a',
                }}
              />
              <Activity size={13} />
              <span>Live Monitor</span>
            </Link>

            <NavLink
              to="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: location.pathname === '/dashboard' ? 'var(--brown-900)' : 'var(--brown-700)',
                background: location.pathname === '/dashboard' ? 'rgba(235, 215, 190, 0.35)' : 'transparent',
                borderRadius: 8,
                textDecoration: 'none',
              }}
            >
              <LayoutDashboard size={14} />
              <span>Dashboard</span>
            </NavLink>

            {currentUser && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  background: 'rgba(235, 215, 190, 0.25)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--brown-900)',
                  fontWeight: 600,
                }}
              >
                <User size={13} color="var(--brown-700)" />
                <span>{currentUser.login_id || currentUser.full_name}</span>
                {currentUser.role && (
                  <span
                    style={{
                      fontSize: 10,
                      textTransform: 'uppercase',
                      padding: '1px 6px',
                      borderRadius: 999,
                      backgroundColor:
                        currentUser.role === 'admin'
                          ? 'var(--brown-900)'
                          : currentUser.role === 'manager'
                          ? '#b45309'
                          : 'var(--posted)',
                      color: 'var(--cream)',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {currentUser.role}
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 11px',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--brown-800)',
                background: 'transparent',
                border: '1px solid var(--brown-400)',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
              title="Sign Out"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Sub-Navigation Secondary Toolbar (Flush underneath Header) ── */}
      {currentSubNav && !isFormView && (
        <nav
          aria-label="Module Navigation"
          style={{
            background: 'var(--surface)',
            borderBottom: '1px solid rgba(208, 174, 146, 0.35)',
            boxShadow: '0 1px 2px rgba(74, 58, 52, 0.02)',
            position: 'sticky',
            top: 56,
            zIndex: 90,
          }}
        >
          <div
            style={{
              maxWidth: 1400,
              margin: '0 auto',
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              overflowX: 'auto',
              height: 44,
            }}
          >
            {currentSubNav.map(({ label, to, icon: Icon }) => {
              const isActive =
                location.pathname === to ||
                (to !== `/${activeModule}` && location.pathname.startsWith(`${to}/`));

              return (
                <NavLink
                  key={to}
                  to={to}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: 'var(--font-body)',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--brown-900)' : 'var(--brown-700)',
                    background: isActive ? 'rgba(235, 215, 190, 0.45)' : 'transparent',
                    border: isActive ? '1px solid rgba(208, 174, 146, 0.5)' : '1px solid transparent',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    transition: 'all 120ms ease',
                  }}
                >
                  <Icon size={14} style={{ opacity: isActive ? 1 : 0.7 }} />
                  <span>{label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}

      {/* ── Page Content ── */}
      <main
        style={{
          flex: 1,
          maxWidth: 1400,
          width: '100%',
          margin: '0 auto',
          padding: '24px 24px 48px 24px',
        }}
      >
        <Outlet />
      </main>

      <RecordTimelineDrawer />
      <GlobalCommandPalette />
    </div>
  );
}
