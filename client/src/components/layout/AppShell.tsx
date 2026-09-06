import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  User,
  Sparkles,
} from 'lucide-react';
import { MegaMenu } from './MegaMenu';
import RecordTimelineDrawer from '../audit/RecordTimelineDrawer';
import api from '../../lib/axios';
import { BrandLogo } from '../ui/BrandLogo';
import { GlobalCommandPalette } from '../common/GlobalCommandPalette';
import { CfoCopilotModal } from '../cfo/CfoCopilotModal';

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [selectedNavModule, setSelectedNavModule] = useState<string | null>(null);
  const [isCfoOpen, setIsCfoOpen] = useState(false);
  const [cfoInitialPrompt, setCfoInitialPrompt] = useState<string | undefined>(undefined);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleOpenCfo = (e: Event) => {
      const customEvent = e as CustomEvent<{ prompt?: string }>;
      if (customEvent.detail?.prompt) {
        setCfoInitialPrompt(customEvent.detail.prompt);
      }
      setIsCfoOpen(true);
    };
    window.addEventListener('open-cfo-copilot', handleOpenCfo);
    return () => window.removeEventListener('open-cfo-copilot', handleOpenCfo);
  }, []);

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

  const token = localStorage.getItem('urban_token');
  const isAuthenticated = localStorage.getItem('urban_logged_in') === 'true' && !!token;

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
      localStorage.removeItem('urban_token');
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

  // Customer contacts cannot access the internal admin/ERP side of the system (only client-facing portal)
  if (currentUser?.role === 'contact') {
    localStorage.removeItem('urban_logged_in');
    localStorage.removeItem('urban_token');
    localStorage.removeItem('urban_user');
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const isManager = currentUser?.role === 'manager';
  const navModules = isManager
    ? ['Sales', 'Purchase', 'Report', 'Tools']
    : ['Sales', 'Purchase', 'Account', 'Report', 'Tools'];

  // Determine active module
  const activeModule = ['sales', 'purchase', 'account', 'report', 'tools'].find((m) =>
    location.pathname.startsWith(`/${m}`)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--cream)' }}>
      {/* ── Top Navigation Bar ── */}
      <header
        ref={headerRef}
        className="no-print"
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

          {/* Right Header Controls: Clean, Uncluttered User Session */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, zIndex: 2 }}>
            {/* CFO Copilot AI Button */}
            <button
              type="button"
              onClick={() => {
                setCfoInitialPrompt(undefined);
                setIsCfoOpen(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                background: 'linear-gradient(135deg, rgba(235, 215, 190, 0.45) 0%, rgba(208, 174, 146, 0.25) 100%)',
                border: '1px solid rgba(208, 174, 146, 0.55)',
                borderRadius: 8,
                color: 'var(--brown-900)',
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                fontWeight: 650,
                cursor: 'pointer',
                transition: 'all 140ms ease',
                boxShadow: '0 1px 3px rgba(74, 58, 52, 0.05)',
              }}
              title="Open Local CFO Copilot (AI Financial Advisor & Anomaly Analyzer)"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(235, 215, 190, 0.7) 0%, rgba(208, 174, 146, 0.45) 100%)';
                e.currentTarget.style.borderColor = 'var(--brown-600)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(235, 215, 190, 0.45) 0%, rgba(208, 174, 146, 0.25) 100%)';
                e.currentTarget.style.borderColor = 'rgba(208, 174, 146, 0.55)';
              }}
            >
              <Sparkles size={13} color="#8A6740" />
              <span className="hidden sm:inline">CFO Copilot</span>
              <span
                style={{
                  fontSize: 9,
                  textTransform: 'uppercase',
                  padding: '1px 4px',
                  borderRadius: 4,
                  background: 'rgba(95, 112, 82, 0.15)',
                  color: '#4B5E3E',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                AI
              </span>
            </button>

            {currentUser && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '3px 6px 3px 10px',
                  background: 'rgba(235, 215, 190, 0.22)',
                  border: '1px solid rgba(208, 174, 146, 0.3)',
                  borderRadius: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--brown-900)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {currentUser.login_id || currentUser.full_name}
                </span>

                {currentUser.role && (
                  <span
                    style={{
                      fontSize: 9.5,
                      textTransform: 'uppercase',
                      padding: '1px 5px',
                      borderRadius: 4,
                      backgroundColor: 'rgba(74, 58, 52, 0.12)',
                      color: 'var(--brown-800)',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {currentUser.role}
                  </span>
                )}

                <div
                  style={{
                    width: 1,
                    height: 14,
                    backgroundColor: 'rgba(208, 174, 146, 0.4)',
                    margin: '0 2px',
                  }}
                />

                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    padding: 0,
                    color: 'var(--brown-600)',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                  }}
                  title="Sign Out"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(158, 74, 56, 0.12)';
                    e.currentTarget.style.color = 'var(--danger)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--brown-600)';
                  }}
                >
                  <LogOut size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

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

      <div className="no-print">
        <RecordTimelineDrawer />
        <GlobalCommandPalette />
        <CfoCopilotModal
          isOpen={isCfoOpen}
          onClose={() => setIsCfoOpen(false)}
          initialPrompt={cfoInitialPrompt}
        />
      </div>
    </div>
  );
}
