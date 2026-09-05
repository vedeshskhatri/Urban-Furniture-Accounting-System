import React from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { usePortalAuth } from './PortalAuthGuard';
import { ChairIcon } from '../../components/ui/BrandLogo';
import {
  LayoutDashboard,
  Layers,
  Sparkles,
  Receipt,
  LogOut,
  LogIn,
  ArrowUpRight,
  ShieldCheck,
  Compass,
  Search,
} from 'lucide-react';
import { GlobalCommandPalette } from '../../components/common/GlobalCommandPalette';
import { LiveLedgerAuditBadge } from '../../components/common/LiveLedgerAuditBadge';
import { DemoRoleSwitcher } from '../../components/common/DemoRoleSwitcher';

export const PortalLayout: React.FC = () => {
  const { user, logout } = usePortalAuth();
  const navigate = useNavigate();

  /* True when internal staff member has authenticated on the main app */
  const isInternalStaff = localStorage.getItem('urban_logged_in') === 'true';

  const handleLogout = async () => {
    await logout();
    navigate('/login?portal=customer', { replace: true });
  };

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'CU';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #FBF8F2 0%, #F5EFE6 100%)',
        color: 'var(--brown-900)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* ── Unified Luxury Header Navigation Bar ── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backgroundColor: 'rgba(252, 250, 246, 0.88)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid rgba(214, 198, 180, 0.35)',
          boxShadow: '0 4px 24px -2px rgba(44, 34, 30, 0.04)',
          transition: 'all 200ms ease',
        }}
      >
        <div
          style={{
            maxWidth: '92rem',
            margin: '0 auto',
            padding: '0 32px',
            height: 68,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
          }}
        >
          {/* Left: Refined Architectural Brand Mark */}
          <Link
            to="/portal"
            style={{
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: 'var(--brown-900, #261914)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 3px 10px rgba(38, 25, 20, 0.2)',
                flexShrink: 0,
                transition: 'transform 180ms ease',
              }}
            >
              <ChairIcon size={22} color="#FBF9F5" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 15,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    color: 'var(--brown-900)',
                    lineHeight: 1,
                  }}
                >
                  URBAN FURNITURE
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#8C6D53',
                    backgroundColor: 'rgba(140, 109, 83, 0.12)',
                    border: '1px solid rgba(140, 109, 83, 0.25)',
                    padding: '2px 7px',
                    borderRadius: 4,
                    lineHeight: 1.2,
                  }}
                >
                  ATELIER
                </span>
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--brown-600)',
                  letterSpacing: '0.03em',
                }}
              >
                Client Showroom &amp; Ledger
              </div>
            </div>
          </Link>

          {/* Center: Sleek Minimalist Navigation Tabs */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              backgroundColor: 'rgba(240, 234, 224, 0.55)',
              padding: '4px',
              borderRadius: 12,
              border: '1px solid rgba(214, 198, 180, 0.5)',
              boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.03)',
            }}
          >
            {/* Dashboard */}
            <NavLink
              to="/portal"
              end
              style={({ isActive }) => ({
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 15px',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'var(--font-display)',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#FFFFFF' : 'var(--brown-700)',
                backgroundColor: isActive ? 'var(--brown-900)' : 'transparent',
                textDecoration: 'none',
                boxShadow: isActive ? '0 2px 8px rgba(38, 25, 20, 0.18)' : 'none',
                transition: 'all 160ms cubic-bezier(0.16, 1, 0.3, 1)',
              })}
            >
              <LayoutDashboard size={14} />
              <span>Dashboard</span>
            </NavLink>

            {/* Furniture Catalogue */}
            <NavLink
              to="/portal/catalogue"
              style={({ isActive }) => ({
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 15px',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'var(--font-display)',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#FFFFFF' : 'var(--brown-700)',
                backgroundColor: isActive ? 'var(--brown-900)' : 'transparent',
                textDecoration: 'none',
                boxShadow: isActive ? '0 2px 8px rgba(38, 25, 20, 0.18)' : 'none',
                transition: 'all 160ms cubic-bezier(0.16, 1, 0.3, 1)',
              })}
            >
              <Layers size={14} />
              <span>Furniture Catalogue</span>
            </NavLink>

            {/* 3D Studio */}
            <NavLink
              to="/portal/studio"
              style={({ isActive }) => ({
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 15px',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'var(--font-display)',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#FFFFFF' : 'var(--brown-700)',
                backgroundColor: isActive ? 'var(--brown-900)' : 'transparent',
                textDecoration: 'none',
                boxShadow: isActive ? '0 2px 8px rgba(38, 25, 20, 0.18)' : 'none',
                transition: 'all 160ms cubic-bezier(0.16, 1, 0.3, 1)',
              })}
            >
              <Sparkles size={14} />
              <span>3D Studio</span>
            </NavLink>

            {/* My Invoices (when authenticated) */}
            {user && (
              <NavLink
                to="/portal/invoices"
                style={({ isActive }) => ({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '7px 15px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: 'var(--font-display)',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#FFFFFF' : 'var(--brown-700)',
                  backgroundColor: isActive ? 'var(--brown-900)' : 'transparent',
                  textDecoration: 'none',
                  boxShadow: isActive ? '0 2px 8px rgba(38, 25, 20, 0.18)' : 'none',
                  transition: 'all 160ms cubic-bezier(0.16, 1, 0.3, 1)',
                })}
              >
                <Receipt size={14} />
                <span>My Invoices</span>
              </NavLink>
            )}
          </nav>

          {/* Right: Actions & User Session */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <LiveLedgerAuditBadge />
            <DemoRoleSwitcher />

            {/* Back to ERP for staff */}
            {isInternalStaff && (
              <a
                href="/dashboard"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  color: '#5C3D2E',
                  backgroundColor: 'rgba(235, 215, 190, 0.35)',
                  border: '1px solid rgba(208, 174, 146, 0.4)',
                  textDecoration: 'none',
                  transition: 'all 140ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--brown-900)';
                  e.currentTarget.style.color = 'var(--cream)';
                  e.currentTarget.style.borderColor = 'var(--brown-900)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(235, 215, 190, 0.35)';
                  e.currentTarget.style.color = '#5C3D2E';
                  e.currentTarget.style.borderColor = 'rgba(208, 174, 146, 0.4)';
                }}
                title="Switch to Internal Accounting ERP"
              >
                <span>Staff ERP</span>
                <ArrowUpRight size={12} />
              </a>
            )}

            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Client Profile Cardlet */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '4px 12px 4px 4px',
                    borderRadius: 10,
                    backgroundColor: 'rgba(255, 255, 255, 0.75)',
                    border: '1px solid rgba(214, 198, 180, 0.45)',
                    boxShadow: '0 1px 4px rgba(44, 34, 30, 0.03)',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: 'var(--brown-900)',
                      color: 'var(--cream)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {initials}
                  </div>
                  <div style={{ lineHeight: 1.15 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: 'var(--brown-900)',
                        fontFamily: 'var(--font-display)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {user.full_name}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--brown-600)',
                        fontFamily: 'var(--font-mono)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: '50%',
                          backgroundColor: '#2E7D32',
                          display: 'inline-block',
                        }}
                      />
                      Verified Client
                    </div>
                  </div>
                </div>

                {/* Sign Out Button */}
                <button
                  onClick={handleLogout}
                  title="Sign out of customer portal"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                    border: '1px solid rgba(214, 198, 180, 0.45)',
                    color: 'var(--brown-700)',
                    cursor: 'pointer',
                    transition: 'all 140ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--danger-bg)';
                    e.currentTarget.style.color = 'var(--danger)';
                    e.currentTarget.style.borderColor = 'var(--danger)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.6)';
                    e.currentTarget.style.color = 'var(--brown-700)';
                    e.currentTarget.style.borderColor = 'rgba(214, 198, 180, 0.45)';
                  }}
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/login?portal=customer')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 8,
                  backgroundColor: 'var(--brown-900)',
                  color: 'var(--cream)',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(74, 58, 52, 0.18)',
                  transition: 'all 140ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(74, 58, 52, 0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(74, 58, 52, 0.18)';
                }}
              >
                <LogIn size={13} />
                <span>Client Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content Viewport ── */}
      <main
        style={{
          flex: 1,
          maxWidth: '92rem',
          width: '100%',
          margin: '0 auto',
          padding: '32px 28px 72px',
          fontFamily: 'var(--font-body)',
        }}
      >
        <Outlet />
      </main>

      {/* ── Architectural Studio Footer ── */}
      <footer
        style={{
          padding: '24px 28px',
          borderTop: '1px solid rgba(208, 174, 146, 0.25)',
          backgroundColor: 'rgba(249, 242, 228, 0.8)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div
          style={{
            maxWidth: '92rem',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            fontSize: 12,
            color: 'var(--brown-600)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontWeight: 600, color: 'var(--brown-900)' }}>Urban Furniture Showroom</span>
            <span>&bull;</span>
            <span>Handcrafted Solid Wood &amp; Architectural Interiors</span>
            <span>&bull;</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--posted)' }}>
              <ShieldCheck size={13} /> Secure Verified Portal Surface
            </span>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--brown-500)' }}>
            Double-Entry Ledger &bull; Razorpay Instant Gateway &bull; 2026 Edition
          </div>
        </div>
      </footer>
      <GlobalCommandPalette />
    </div>
  );
};

export default PortalLayout;
