import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserCheck, Shield, Sparkles, ChevronDown, Check, ArrowRight } from 'lucide-react';
import api from '../../lib/axios';
import { playWoodClick, playChimeSuccess } from '../../lib/soundEffects';

interface RoleOption {
  id: 'admin' | 'contact';
  label: string;
  roleTitle: string;
  loginId: string;
  password: string;
  landingPage: string;
  description: string;
}

const ROLES: RoleOption[] = [
  {
    id: 'admin',
    label: 'Admin / CFO',
    roleTitle: 'Full ERP & Double-Entry Ledgers',
    loginId: 'adminuf',
    password: 'Admin@12345',
    landingPage: '/dashboard',
    description: 'Access Sales, Purchases, P&L, Balance Sheet, Chart of Accounts, and System Integrity Audit.',
  },
  {
    id: 'contact',
    label: 'Customer Client',
    roleTitle: 'Neha Desai (Contact #22)',
    loginId: 'clientuf',
    password: 'Client@12345',
    landingPage: '/portal/catalogue',
    description: 'Access Atelier Showroom, 3D Room Planner, Invoices, and Direct Checkout Ledger.',
  },
];

export const DemoRoleSwitcher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isPortal = location.pathname.startsWith('/portal');
  const currentRoleId = isPortal ? 'contact' : 'admin';
  const currentRole = ROLES.find((r) => r.id === currentRoleId) || ROLES[0];

  const handleSelectRole = async (role: RoleOption) => {
    if (role.id === currentRoleId && !switching) {
      setIsOpen(false);
      return;
    }

    setSwitching(true);
    playWoodClick(1.0);

    try {
      if (role.id === 'contact') {
        const res = await api.post('/api/portal/login', {
          login_id: role.loginId,
          password: role.password,
        });

        if (res.data?.data) {
          const { user, token } = res.data.data;
          localStorage.setItem('urban_portal_token', token);
          localStorage.setItem('urban_portal_user', JSON.stringify(user));
          // Clear admin session to prevent leakage
          localStorage.removeItem('urban_logged_in');
          localStorage.removeItem('urban_user');

          playChimeSuccess();
          setIsOpen(false);
          navigate(role.landingPage, { replace: true });
          window.location.reload();
        }
      } else {
        const res = await api.post('/api/auth/login', {
          login_id: role.loginId,
          password: role.password,
        });

        if (res.data?.data) {
          const { user, token } = res.data.data;
          localStorage.setItem('urban_token', token);
          localStorage.setItem('urban_user', JSON.stringify(user));
          localStorage.setItem('urban_logged_in', 'true');
          // Clear customer portal session to prevent leakage
          localStorage.removeItem('urban_portal_token');
          localStorage.removeItem('urban_portal_user');

          playChimeSuccess();
          setIsOpen(false);
          navigate(role.landingPage, { replace: true });
          window.location.reload();
        }
      }
    } catch (err) {
      console.error('Failed to switch demo role:', err);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => {
          playWoodClick(0.9);
          setIsOpen((prev) => !prev);
        }}
        title="Hackathon Screening Role Switcher"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 6,
          border: '1px solid rgba(208, 174, 146, 0.5)',
          backgroundColor: '#FFFFFF',
          color: 'var(--brown-900)',
          fontSize: 11,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 1px 4px rgba(44, 34, 30, 0.06)',
          transition: 'all 120ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--brown-700)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(208, 174, 146, 0.5)';
        }}
      >
        <Sparkles size={12} color="#C28247" />
        <span style={{ color: 'var(--brown-600)', fontWeight: 500 }}>Demo Role:</span>
        <span>{currentRole.label}</span>
        <ChevronDown size={11} color="var(--brown-600)" />
      </button>

      {isOpen && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 120 }}
          />

          <div
            style={{
              position: 'absolute',
              top: '115%',
              right: 0,
              width: 290,
              backgroundColor: '#FAF7F2',
              borderRadius: 10,
              border: '1px solid rgba(208, 174, 146, 0.55)',
              boxShadow: '0 12px 32px rgba(44, 34, 30, 0.18)',
              padding: 10,
              zIndex: 130,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              animation: 'fadeIn 120ms ease-out',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--brown-600)',
                letterSpacing: '0.08em',
                padding: '4px 6px 0',
              }}
            >
              1-Click Role Impersonator (Screening Mode)
            </div>

            {ROLES.map((role) => {
              const isSelected = role.id === currentRoleId;
              return (
                <button
                  key={role.id}
                  onClick={() => handleSelectRole(role)}
                  disabled={switching}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 3,
                    padding: '8px 10px',
                    borderRadius: 7,
                    border: isSelected ? '1px solid var(--brown-900)' : '1px solid rgba(208, 174, 146, 0.35)',
                    backgroundColor: isSelected ? 'rgba(208, 174, 146, 0.22)' : '#FFFFFF',
                    cursor: switching ? 'wait' : 'pointer',
                    textAlign: 'left',
                    transition: 'all 120ms ease',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = '#FAF7F2';
                      e.currentTarget.style.borderColor = 'var(--brown-700)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                      e.currentTarget.style.borderColor = 'rgba(208, 174, 146, 0.35)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--brown-900)' }}>
                      {role.label}
                    </span>
                    {isSelected ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--posted)', fontWeight: 700 }}>
                        <Check size={12} /> Active
                      </span>
                    ) : (
                      <ArrowRight size={12} color="var(--brown-500)" />
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--brown-700)', fontFamily: 'var(--font-body)', lineHeight: 1.3 }}>
                    {role.roleTitle}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
