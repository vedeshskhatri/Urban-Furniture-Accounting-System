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
import { PortalAmbientAudioBadge } from '../../components/portal/PortalAmbientAudioBadge';
import { ambientMusic } from '../../lib/ambientMusic';

export const PortalLayout: React.FC = () => {
  const { user, logout } = usePortalAuth();
  const navigate = useNavigate();

  // Silence any playing ambient music whenever user leaves the Customer Portal
  React.useEffect(() => {
    return () => {
      ambientMusic.stopAndSilence();
    };
  }, []);

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
          backgroundColor: 'rgba(253, 250, 246, 0.92)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderBottom: '1px solid rgba(214, 198, 180, 0.35)',
          boxShadow: '0 2px 16px -2px rgba(44, 34, 30, 0.03)',
          transition: 'all 200ms ease',
        }}
      >
        <div
          style={{
            maxWidth: '92rem',
            margin: '0 auto',
            padding: '0 28px',
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
          }}
        >
          {/* Left: Refined Architectural Brand Mark */}
          <Link
            to="/portal"
            style={{
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                backgroundColor: '#1F1714',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(31, 23, 20, 0.18)',
                flexShrink: 0,
              }}
            >
              <ChairIcon size={18} color="#FAF7F2" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#1F1714',
                  lineHeight: 1.1,
                }}
              >
                URBAN FURNITURE
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: '#8C7362',
                  lineHeight: 1,
                }}
              >
                Atelier Showroom
              </span>
            </div>
          </Link>

          {/* Center: Sleek Minimalist Navigation Tabs */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {/* Dashboard Overview */}
            <NavLink
              to="/portal"
              end
              style={({ isActive }) => ({
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 7,
                fontSize: 13,
                fontFamily: 'var(--font-display)',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#FAF7F2' : '#5C4A3E',
                backgroundColor: isActive ? '#1F1714' : 'transparent',
                textDecoration: 'none',
                boxShadow: isActive ? '0 2px 8px rgba(31, 23, 20, 0.18)' : 'none',
                transition: 'all 150ms cubic-bezier(0.16, 1, 0.3, 1)',
              })}
            >
              <LayoutDashboard size={14} />
              <span>Overview</span>
            </NavLink>

            {/* Furniture Catalogue */}
            <NavLink
              to="/portal/catalogue"
              style={({ isActive }) => ({
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 7,
                fontSize: 13,
                fontFamily: 'var(--font-display)',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#FAF7F2' : '#5C4A3E',
                backgroundColor: isActive ? '#1F1714' : 'transparent',
                textDecoration: 'none',
                boxShadow: isActive ? '0 2px 8px rgba(31, 23, 20, 0.18)' : 'none',
                transition: 'all 150ms cubic-bezier(0.16, 1, 0.3, 1)',
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
                gap: 6,
                padding: '6px 14px',
                borderRadius: 7,
                fontSize: 13,
                fontFamily: 'var(--font-display)',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#FAF7F2' : '#5C4A3E',
                backgroundColor: isActive ? '#1F1714' : 'transparent',
                textDecoration: 'none',
                boxShadow: isActive ? '0 2px 8px rgba(31, 23, 20, 0.18)' : 'none',
                transition: 'all 150ms cubic-bezier(0.16, 1, 0.3, 1)',
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
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 7,
                  fontSize: 13,
                  fontFamily: 'var(--font-display)',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#FAF7F2' : '#5C4A3E',
                  backgroundColor: isActive ? '#1F1714' : 'transparent',
                  textDecoration: 'none',
                  boxShadow: isActive ? '0 2px 8px rgba(31, 23, 20, 0.18)' : 'none',
                  transition: 'all 150ms cubic-bezier(0.16, 1, 0.3, 1)',
                })}
              >
                <Receipt size={14} />
                <span>My Invoices</span>
              </NavLink>
            )}
          </nav>

          {/* Right: Actions & User Session */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* Steady Lounge Ambient Music Audio Controller */}
            <PortalAmbientAudioBadge />

            {/* Quick Spotlight Search Trigger */}
            <button
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
              }}
              title="Quick Search & Command Palette (⌘K)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '5px 10px',
                borderRadius: 7,
                fontSize: 12,
                fontFamily: 'var(--font-display)',
                color: '#6E5A4E',
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                border: '1px solid rgba(214, 198, 180, 0.45)',
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              <Search size={13} color="#8C7362" />
              <span style={{ fontSize: 11.5 }}>Search</span>
              <kbd
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  padding: '1px 4px',
                  borderRadius: 3,
                  backgroundColor: 'rgba(140, 115, 98, 0.1)',
                  color: '#8C7362',
                }}
              >
                ⌘K
              </kbd>
            </button>

            {/* Back to ERP for staff */}
            {isInternalStaff && (
              <a
                href="/dashboard"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 10px',
                  borderRadius: 7,
                  fontSize: 11.5,
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  color: '#5C3D2E',
                  backgroundColor: 'rgba(235, 215, 190, 0.35)',
                  border: '1px solid rgba(208, 174, 146, 0.4)',
                  textDecoration: 'none',
                  transition: 'all 140ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1F1714';
                  e.currentTarget.style.color = '#FAF7F2';
                  e.currentTarget.style.borderColor = '#1F1714';
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Client Profile Cardlet */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 10px 4px 4px',
                    borderRadius: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    border: '1px solid rgba(214, 198, 180, 0.45)',
                    boxShadow: '0 1px 3px rgba(44, 34, 30, 0.03)',
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      backgroundColor: '#1F1714',
                      color: '#FAF7F2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10.5,
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {initials}
                  </div>
                  <div style={{ lineHeight: 1.2 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#1F1714',
                        fontFamily: 'var(--font-display)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {user.full_name}
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
                    width: 30,
                    height: 30,
                    borderRadius: 7,
                    border: '1px solid rgba(214, 198, 180, 0.45)',
                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                    color: '#8C7362',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(192, 57, 43, 0.08)';
                    e.currentTarget.style.color = '#C0392B';
                    e.currentTarget.style.borderColor = 'rgba(192, 57, 43, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
                    e.currentTarget.style.color = '#8C7362';
                    e.currentTarget.style.borderColor = 'rgba(214, 198, 180, 0.45)';
                  }}
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <Link
                to="/login?portal=customer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  color: '#FAF7F2',
                  backgroundColor: '#1F1714',
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(31, 23, 20, 0.16)',
                  transition: 'all 140ms ease',
                }}
              >
                <LogIn size={13} />
                <span>Client Sign In</span>
              </Link>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 600, color: 'var(--brown-900)' }}>Urban Furniture Atelier</span>
            <span>&middot;</span>
            <span>Handcrafted solid wood furniture</span>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--brown-500)' }}>
            Showroom Portal
          </div>
        </div>
      </footer>
      <GlobalCommandPalette />
    </div>
  );
};

export default PortalLayout;
