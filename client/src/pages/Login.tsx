import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Building2, UserCheck } from 'lucide-react';
import api from '../lib/axios';
import { BrandLogo, ChairIcon } from '../components/ui/BrandLogo';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const portalParam = searchParams.get('portal');

  const [activePortal, setActivePortal] = useState<'admin' | 'customer'>(() => {
    if (portalParam === 'customer') return 'customer';
    return 'admin';
  });

  // Admin Form State
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [btnHover, setBtnHover] = useState(false);

  // Customer Form State
  const [customerLoginId, setCustomerLoginId] = useState('');
  const [customerPassword, setCustomerPassword] = useState('');
  const [showCustomerPassword, setShowCustomerPassword] = useState(false);
  const [customerError, setCustomerError] = useState('');
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerBtnHover, setCustomerBtnHover] = useState(false);

  useEffect(() => {
    if (portalParam === 'customer') {
      setActivePortal('customer');
    } else {
      setActivePortal('admin');
    }
  }, [portalParam]);

  const selectPortal = (portal: 'admin' | 'customer') => {
    setActivePortal(portal);
    if (portal === 'admin') {
      setSearchParams({});
    } else {
      setSearchParams({ portal });
    }
    setError('');
    setCustomerError('');
  };

  const handleAdminSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', {
        login_id: loginId.trim(),
        loginId: loginId.trim(),
        password,
      });
      // Purge any conflicting portal session tokens
      localStorage.removeItem('urban_portal_token');
      localStorage.removeItem('urban_portal_user');

      localStorage.setItem('urban_logged_in', 'true');
      if (res.data?.data?.token) {
        localStorage.setItem('urban_token', res.data.data.token);
      }
      if (res.data?.data?.user) {
        localStorage.setItem('urban_user', JSON.stringify(res.data.data.user));
      }
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || (err?.message ? `Connection error: ${err.message}` : 'Invalid Login Id or Password');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCustomerError('');
    setCustomerLoading(true);
    try {
      const res = await api.post('/api/portal/login', {
        login_id: customerLoginId.trim(),
        loginId: customerLoginId.trim(),
        password: customerPassword,
      });
      // Purge any conflicting admin session tokens
      localStorage.removeItem('urban_token');
      localStorage.removeItem('urban_logged_in');
      localStorage.removeItem('urban_user');

      localStorage.setItem('urban_portal_user', JSON.stringify(res.data?.data?.user));
      if (res.data?.data?.token) {
        localStorage.setItem('urban_portal_token', res.data.data.token);
      }
      navigate('/portal', { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Invalid Login Id or Password';
      setCustomerError(msg);
    } finally {
      setCustomerLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={{ width: '100%', maxWidth: 490 }}>
        {/* Back to Home Link */}
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center' }}>
          <Link
            to="/"
            style={{
              fontSize: 12,
              fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
              color: 'var(--brown-600, #77574A)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            &larr; Back to Urban Furniture Home
          </Link>
        </div>

        {/* Top 2-Portal Switcher Tabs */}
        <div style={styles.topPortalSwitcher}>
          <button
            type="button"
            onClick={() => selectPortal('admin')}
            style={{
              ...styles.portalSwitchBtn,
              ...(activePortal === 'admin' ? styles.portalSwitchBtnActive : {}),
            }}
          >
            <Building2 size={15} />
            <span>Admin & Staff</span>
          </button>
          <button
            type="button"
            onClick={() => selectPortal('customer')}
            style={{
              ...styles.portalSwitchBtn,
              ...(activePortal === 'customer' ? styles.portalSwitchBtnActive : {}),
            }}
          >
            <UserCheck size={15} />
            <span>Customer Portal</span>
          </button>
        </div>

        {/* ── ADMIN LOGIN FORM ── */}
        {activePortal === 'admin' ? (
          <div style={styles.card}>
            {/* App Brand Logo container */}
            <div style={styles.appLogoBox}>
              <div style={styles.logoBadge}>
                <ChairIcon size={24} color="var(--cream, #F9F2E4)" />
              </div>
              <div style={styles.logoTextCol}>
                <span style={styles.appLogoText}>Urban Furniture</span>
                <span style={styles.appLogoSub}>Double-Entry ERP</span>
              </div>
            </div>

            {/* Navigation Tabs: Sign In / Create Account */}
            <div style={styles.tabHeader}>
              <span style={styles.activeTab}>Sign In</span>
              <Link to="/create-user" style={styles.inactiveTab}>
                Create Account
              </Link>
            </div>

            {/* Quick-fill helper */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'var(--cream, #F9F2E4)',
                borderRadius: 6,
                marginBottom: 16,
                border: '1px dashed var(--brown-300, #D0AE92)',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: 'var(--brown-700, #77574A)' }}>
                Demo: <strong>adminuf</strong> / <strong>Admin@12345</strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLoginId('adminuf');
                  setPassword('Admin@12345');
                  setError('');
                }}
                style={{
                  background: 'var(--brown-900, #4A3A34)',
                  color: 'var(--cream, #F9F2E4)',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Auto-Fill
              </button>
            </div>

            <form onSubmit={handleAdminSubmit} style={styles.form} noValidate>
              {/* Login Id - */}
              <div style={styles.row}>
                <label htmlFor="adminLoginId" style={styles.rowLabel}>
                  Login Id -
                </label>
                <div style={styles.inputContainer}>
                  <input
                    id="adminLoginId"
                    type="text"
                    autoComplete="username"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    required
                    minLength={6}
                    maxLength={12}
                    style={styles.lineInput}
                  />
                </div>
              </div>

              {/* Password - */}
              <div style={styles.row}>
                <label htmlFor="adminPassword" style={styles.rowLabel}>
                  Password -
                </label>
                <div style={styles.inputContainer}>
                  <input
                    id="adminPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={styles.lineInput}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={styles.toggleBtn}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" style={styles.errorBox}>
                  <p style={styles.errorText}>{error}</p>
                </div>
              )}

              {/* Centered Button: SIGN IN */}
              <div style={styles.btnWrapper}>
                <button
                  type="submit"
                  disabled={loading || !loginId || !password}
                  onMouseEnter={() => setBtnHover(true)}
                  onMouseLeave={() => setBtnHover(false)}
                  style={{
                    ...styles.wireframeBtn,
                    background: btnHover ? 'var(--brown-900, #4A3A34)' : 'transparent',
                    color: btnHover ? 'var(--cream, #F9F2E4)' : 'var(--brown-900, #4A3A34)',
                    opacity: loading || !loginId || !password ? 0.6 : 1,
                    cursor: loading || !loginId || !password ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'SIGNING IN…' : 'SIGN IN'}
                </button>
              </div>

              {/* Links footer */}
              <div style={styles.linksRow}>
                <Link to="/forgot-password" style={styles.link}>
                  Forgot Password
                </Link>
                <span style={styles.linkDivider}>|</span>
                <Link to="/signup" style={styles.link}>
                  Sign Up
                </Link>
                <span style={styles.linkDivider}>|</span>
                <Link to="/create-user" style={styles.link}>
                  Create Account
                </Link>
              </div>
            </form>
          </div>
        ) : (
          /* ── CUSTOMER LOGIN FORM ── */
          <div style={styles.card}>
            {/* App Brand Logo container */}
            <div style={styles.appLogoBox}>
              <div style={styles.logoBadge}>
                <ChairIcon size={24} color="var(--cream, #F9F2E4)" />
              </div>
              <div style={styles.logoTextCol}>
                <span style={styles.appLogoText}>Urban Furniture</span>
                <span style={styles.appLogoSub}>Customer Portal</span>
              </div>
            </div>

            <p style={styles.customerNotice}>
              Restricted to invited customer contacts & client representatives
            </p>

            {/* Quick-fill helper */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'var(--cream, #F9F2E4)',
                borderRadius: 6,
                marginBottom: 16,
                border: '1px dashed var(--brown-300, #D0AE92)',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: 'var(--brown-700, #77574A)' }}>
                Demo: <strong>clientuf</strong> / <strong>Client@12345</strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCustomerLoginId('clientuf');
                  setCustomerPassword('Client@12345');
                  setCustomerError('');
                }}
                style={{
                  background: 'var(--brown-900, #4A3A34)',
                  color: 'var(--cream, #F9F2E4)',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Auto-Fill
              </button>
            </div>

            <form onSubmit={handleCustomerSubmit} style={styles.form} noValidate>
              {/* Customer Login Id - */}
              <div style={styles.row}>
                <label htmlFor="custLoginId" style={styles.rowLabel}>
                  Login Id / Email -
                </label>
                <div style={styles.inputContainer}>
                  <input
                    id="custLoginId"
                    type="text"
                    autoComplete="username"
                    value={customerLoginId}
                    onChange={(e) => setCustomerLoginId(e.target.value)}
                    placeholder="e.g. rohit or client@email.com"
                    required
                    style={styles.lineInput}
                  />
                </div>
              </div>

              {/* Password - */}
              <div style={styles.row}>
                <label htmlFor="custPassword" style={styles.rowLabel}>
                  Password -
                </label>
                <div style={styles.inputContainer}>
                  <input
                    id="custPassword"
                    type={showCustomerPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={customerPassword}
                    onChange={(e) => setCustomerPassword(e.target.value)}
                    required
                    style={styles.lineInput}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCustomerPassword(!showCustomerPassword)}
                    style={styles.toggleBtn}
                    tabIndex={-1}
                    aria-label={showCustomerPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCustomerPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {customerError && (
                <div role="alert" style={styles.errorBox}>
                  <p style={styles.errorText}>{customerError}</p>
                </div>
              )}

              {/* Centered Button: SIGN IN */}
              <div style={styles.btnWrapper}>
                <button
                  type="submit"
                  disabled={customerLoading || !customerLoginId || !customerPassword}
                  onMouseEnter={() => setCustomerBtnHover(true)}
                  onMouseLeave={() => setCustomerBtnHover(false)}
                  style={{
                    ...styles.wireframeBtn,
                    background: customerBtnHover ? 'var(--brown-900, #4A3A34)' : 'transparent',
                    color: customerBtnHover ? 'var(--cream, #F9F2E4)' : 'var(--brown-900, #4A3A34)',
                    opacity: customerLoading || !customerLoginId || !customerPassword ? 0.6 : 1,
                    cursor: customerLoading || !customerLoginId || !customerPassword ? 'not-allowed' : 'pointer',
                  }}
                >
                  {customerLoading ? 'AUTHENTICATING…' : 'SIGN IN TO PORTAL'}
                </button>
              </div>

              {/* Customer Footer Option */}
              <div style={styles.tokenActivationRow}>
                <span style={styles.tokenNotice}>Have an invitation token?</span>
                <Link to="/portal/accept-invite" style={styles.tokenLink}>
                  Activate Account with Token &rarr;
                </Link>
              </div>

              <div style={{ marginTop: 14, textAlign: 'center' }}>
                <Link
                  to="/portal/catalogue"
                  style={{
                    fontSize: 12,
                    fontFamily: 'var(--font-display, "Montserrat", sans-serif)',
                    fontWeight: 600,
                    color: 'var(--brown-900, #4A3A34)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span>Browse Furniture Catalogue (No login needed)</span>
                  <span>→</span>
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--cream, #F9F2E4)',
    padding: '40px 20px',
    fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
  } as React.CSSProperties,

  topPortalSwitcher: {
    display: 'flex',
    gap: 8,
    background: 'rgba(235, 215, 190, 0.45)',
    border: '1px solid var(--brown-300, #D0AE92)',
    borderRadius: 14,
    padding: 5,
    marginBottom: 16,
  } as React.CSSProperties,

  portalSwitchBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '8px 14px',
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: 'var(--brown-700, #77574A)',
    fontWeight: 600,
    fontSize: 13,
    fontFamily: 'var(--font-display, "Montserrat", sans-serif)',
    cursor: 'pointer',
    transition: 'all 150ms ease',
  } as React.CSSProperties,

  portalSwitchBtnActive: {
    background: 'var(--brown-900, #4A3A34)',
    color: 'var(--cream, #F9F2E4)',
    fontWeight: 700,
    boxShadow: '0 2px 6px rgba(74, 58, 52, 0.15)',
  } as React.CSSProperties,

  card: {
    background: 'var(--surface, #FFFFFF)',
    borderRadius: 22,
    border: '1.5px solid var(--brown-400, #B8977E)',
    boxShadow: '0 8px 28px rgba(74, 58, 52, 0.08)',
    padding: '36px 40px 32px 40px',
    width: '100%',
  } as React.CSSProperties,

  appLogoBox: {
    width: 195,
    height: 56,
    margin: '0 auto 30px auto',
    border: '1.5px solid var(--brown-700, #77574A)',
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    background: 'rgba(235, 215, 190, 0.3)',
  } as React.CSSProperties,

  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: 'var(--brown-900, #4A3A34)',
    color: 'var(--cream, #F9F2E4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: 'var(--font-display, "Montserrat", sans-serif)',
    fontWeight: 700,
    fontSize: 14,
  } as React.CSSProperties,

  logoTextCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
  },

  appLogoText: {
    fontFamily: 'var(--font-display, "Montserrat", sans-serif)',
    fontWeight: 700,
    fontSize: 14,
    color: 'var(--brown-900, #4A3A34)',
    lineHeight: 1.2,
  } as React.CSSProperties,

  appLogoSub: {
    fontSize: 10,
    color: 'var(--brown-600, #8C6A58)',
    fontWeight: 500,
    letterSpacing: '0.02em',
    lineHeight: 1.2,
    marginTop: 2,
  } as React.CSSProperties,

  customerNotice: {
    fontSize: 12,
    color: 'var(--brown-600, #8C6A58)',
    textAlign: 'center' as const,
    marginBottom: 24,
  } as React.CSSProperties,

  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 22,
  },

  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  } as React.CSSProperties,

  rowLabel: {
    fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
    fontWeight: 600,
    fontSize: 14,
    color: 'var(--brown-900, #4A3A34)',
    whiteSpace: 'nowrap' as const,
    minWidth: 155,
  } as React.CSSProperties,

  inputContainer: {
    flex: 1,
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
  },

  lineInput: {
    width: '100%',
    border: 'none',
    borderBottom: '1.5px solid var(--brown-700, #77574A)',
    borderRadius: 0,
    background: 'transparent',
    padding: '6px 24px 6px 4px',
    fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
    fontSize: 14,
    color: 'var(--brown-900, #4A3A34)',
    outline: 'none',
    transition: 'border-color 150ms ease',
  } as React.CSSProperties,

  toggleBtn: {
    position: 'absolute' as const,
    right: 2,
    background: 'none',
    border: 'none',
    color: 'var(--brown-500, #A8836C)',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorBox: {
    background: 'var(--danger-bg, #F8EAE6)',
    border: '1px solid var(--danger, #9E4A38)',
    borderRadius: 8,
    padding: '8px 12px',
    marginTop: -4,
  } as React.CSSProperties,

  errorText: {
    fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
    fontSize: 12,
    color: 'var(--danger, #9E4A38)',
    margin: 0,
    fontWeight: 500,
  } as React.CSSProperties,

  btnWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: 8,
  } as React.CSSProperties,

  wireframeBtn: {
    minWidth: 150,
    padding: '9px 24px',
    border: '1.5px solid var(--brown-900, #4A3A34)',
    borderRadius: 12,
    fontFamily: 'var(--font-display, "Montserrat", sans-serif)',
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    transition: 'all 150ms ease',
  } as React.CSSProperties,

  linksRow: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
    fontSize: 13,
  } as React.CSSProperties,

  link: {
    color: 'var(--brown-700, #77574A)',
    textDecoration: 'none',
    fontWeight: 500,
    fontSize: 13,
    transition: 'color 150ms ease',
  } as React.CSSProperties,

  linkDivider: {
    color: 'var(--brown-300, #D0AE92)',
    fontWeight: 300,
  } as React.CSSProperties,

  tabHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    background: 'rgba(235, 215, 190, 0.45)',
    border: '1px solid var(--brown-300, #D0AE92)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  } as React.CSSProperties,

  activeTab: {
    flex: 1,
    textAlign: 'center' as const,
    padding: '7px 14px',
    background: 'var(--brown-900, #4A3A34)',
    color: 'var(--cream, #F9F2E4)',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 13,
    fontFamily: 'var(--font-display, "Montserrat", sans-serif)',
    letterSpacing: '0.02em',
    boxShadow: '0 1px 3px rgba(74, 58, 52, 0.15)',
  } as React.CSSProperties,

  inactiveTab: {
    flex: 1,
    textAlign: 'center' as const,
    padding: '7px 14px',
    color: 'var(--brown-700, #77574A)',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 13,
    fontFamily: 'var(--font-display, "Montserrat", sans-serif)',
    letterSpacing: '0.02em',
    textDecoration: 'none',
    transition: 'background-color 150ms ease, color 150ms ease',
  } as React.CSSProperties,

  tokenActivationRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingTop: 12,
    borderTop: '1px solid rgba(208, 174, 146, 0.35)',
  } as React.CSSProperties,

  tokenNotice: {
    fontSize: 11,
    color: 'var(--brown-600, #8C6A58)',
  } as React.CSSProperties,

  tokenLink: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--brown-800, #5E453A)',
    textDecoration: 'none',
  } as React.CSSProperties,
};
