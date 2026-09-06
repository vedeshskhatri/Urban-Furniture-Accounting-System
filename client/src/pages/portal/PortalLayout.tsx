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
  User,
} from 'lucide-react';
import { GlobalCommandPalette } from '../../components/common/GlobalCommandPalette';

export const PortalLayout: React.FC = () => {
  const { user, logout } = usePortalAuth();
  const navigate = useNavigate();

  /* True when internal staff member has authenticated on the main app */
  const isInternalStaff = localStorage.getItem('urban_logged_in') === 'true';

  const handleLogout = async () => {
    await logout();
    navigate('/login?portal=customer', { replace: true });
  };

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
      {/* ── Top Navigation Bar (Harmonized with Admin ERP) ── */}
      <header
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid rgba(208, 174, 146, 0.35)',
          boxShadow: '0 1px 4px rgba(74, 58, 52, 0.04)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
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
            <Link
              to="/portal"
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 7,
                  backgroundColor: '#1F1714',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(31, 23, 20, 0.15)',
                  flexShrink: 0,
                }}
              >
                <ChairIcon size={16} color="#FAF7F2" />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 13.5,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    color: '#1F1714',
                    lineHeight: 1.1,
                  }}
                >
                  URBAN FURNITURE
                </span>
                <span
                  style={{
                    fontSize: 8.5,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#8C7362',
                    lineHeight: 1,
                  }}
                >
                  Atelier Showroom
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Navigation Headings */}
          <nav
            style={{
              position: 'absolute',
              left: '48%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              height: '100%',
              gap: 4,
              zIndex: 2,
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
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'var(--font-display)',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--brown-900)' : 'var(--brown-700)',
                backgroundColor: isActive ? 'rgba(235, 215, 190, 0.35)' : 'transparent',
                textDecoration: 'none',
                transition: 'background 120ms ease, color 120ms ease',
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
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'var(--font-display)',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--brown-900)' : 'var(--brown-700)',
                backgroundColor: isActive ? 'rgba(235, 215, 190, 0.35)' : 'transparent',
                textDecoration: 'none',
                transition: 'background 120ms ease, color 120ms ease',
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
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontFamily: 'var(--font-display)',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--brown-900)' : 'var(--brown-700)',
                backgroundColor: isActive ? 'rgba(235, 215, 190, 0.35)' : 'transparent',
                textDecoration: 'none',
                transition: 'background 120ms ease, color 120ms ease',
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
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: 'var(--font-display)',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--brown-900)' : 'var(--brown-700)',
                  backgroundColor: isActive ? 'rgba(235, 215, 190, 0.35)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'background 120ms ease, color 120ms ease',
                })}
              >
                <Receipt size={14} />
                <span>My Invoices</span>
              </NavLink>
            )}
          </nav>

          {/* Right Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, zIndex: 2 }}>
            {/* Quick Spotlight Search Trigger */}
            <button
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
              }}
              title="Quick Search & Command Palette (⌘K)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 8,
                fontSize: 12,
                fontFamily: 'var(--font-display)',
                color: 'var(--brown-700)',
                backgroundColor: 'rgba(235, 215, 190, 0.25)',
                border: '1px solid rgba(208, 174, 146, 0.4)',
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              <Search size={13} color="var(--brown-700)" />
              <span style={{ fontSize: 11.5, fontWeight: 600 }}>Search</span>
              <kbd
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  padding: '1px 4px',
                  borderRadius: 4,
                  backgroundColor: 'rgba(74, 58, 52, 0.08)',
                  color: 'var(--brown-700)',
                  fontWeight: 600,
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
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--brown-800)',
                  backgroundColor: 'rgba(235, 215, 190, 0.25)',
                  border: '1px solid rgba(208, 174, 146, 0.4)',
                  textDecoration: 'none',
                  transition: 'all 140ms ease',
                }}
                title="Switch to Internal Accounting ERP"
              >
                <span>Staff ERP</span>
                <ArrowUpRight size={12} />
              </a>
            )}

            {user ? (
              <>
                {/* Client Profile Cardlet */}
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
                  <span>{user.full_name}</span>
                  <span
                    style={{
                      fontSize: 10,
                      textTransform: 'uppercase',
                      padding: '1px 6px',
                      borderRadius: 999,
                      backgroundColor: 'var(--brown-900)',
                      color: 'var(--cream)',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    CLIENT
                  </span>
                </div>

                {/* Sign Out Button matching Admin ERP */}
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
              </>
            ) : (
              <Link
                to="/login?portal=customer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--cream)',
                  backgroundColor: 'var(--brown-900)',
                  textDecoration: 'none',
                  transition: 'all 120ms ease',
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
