import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../lib/axios';
import { ChairIcon } from '../components/ui/BrandLogo';
import PasswordStrengthMeter, { calculatePasswordStrength } from '../components/PasswordStrengthMeter';

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    loginId: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [btnHover, setBtnHover] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setForm(f => ({ ...f, [key]: e.target.value }));
  };

  // Real-time criteria evaluations
  const loginIdLen = form.loginId.length;
  const isLoginIdValid = loginIdLen >= 6 && loginIdLen <= 12;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const passwordStrength = calculatePasswordStrength(form.password);
  const doPasswordsMatch = form.password.length > 0 && form.password === form.confirmPassword;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.loginId.trim()) {
      setError('Please enter a Login Id.');
      return;
    }
    if (!isLoginIdValid) {
      setError(`Login Id must be between 6 and 12 characters (currently ${loginIdLen}).`);
      return;
    }
    if (!form.email.trim()) {
      setError('Please enter an Email Id.');
      return;
    }
    if (!isEmailValid) {
      setError('Please provide a valid Email Id (e.g. user@example.com).');
      return;
    }
    if (!form.password) {
      setError('Please enter a Password.');
      return;
    }
    if (!passwordStrength.isValid) {
      setError('Password must be greater than 8 characters and contain at least one lowercase letter, one uppercase letter, and one special character.');
      return;
    }
    if (!form.confirmPassword) {
      setError('Please re-enter your password to confirm.');
      return;
    }
    if (!doPasswordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/signup', {
        login_id: form.loginId.trim(),
        loginId: form.loginId.trim(),
        email: form.email.trim(),
        password: form.password,
        full_name: form.loginId.trim(),
        name: form.loginId.trim(),
        role: 'accountant',
      });
      setSuccess('Account created successfully! Redirecting to login…');
      setTimeout(() => {
        navigate('/login', { state: { prefilledLoginId: form.loginId.trim() } });
      }, 1200);
    } catch (err: unknown) {
      const errObj = (err as { response?: { data?: { error?: { message?: string; fields?: Record<string, string> } } } })?.response?.data?.error;
      const fieldError = errObj?.fields ? Object.values(errObj.fields)[0] : null;
      setError(fieldError || errObj?.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={{ width: '100%', maxWidth: 490 }}>
        <h2 style={styles.pageTitle}>Sign Up Page</h2>

        <div style={styles.card}>
          {/* App Brand Logo container */}
          <div style={styles.appLogoBox}>
            <div style={styles.logoBadge}>
              <ChairIcon size={24} color="var(--cream, #F9F2E4)" />
            </div>
            <div style={styles.logoTextCol}>
              <span style={styles.appLogoText}>Urban Furniture</span>
              <span style={styles.appLogoSub}>Registration</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={styles.form} noValidate>
            {/* Enter Login Id - */}
            <div style={styles.fieldBlock}>
              <div style={styles.row}>
                <label htmlFor="loginId" style={styles.rowLabel}>
                  Enter Login Id -
                </label>
                <div style={styles.inputContainer}>
                  <input
                    id="loginId"
                    type="text"
                    autoComplete="username"
                    value={form.loginId}
                    onChange={set('loginId')}
                    required
                    minLength={6}
                    maxLength={12}
                    placeholder="6 to 12 characters"
                    style={styles.lineInput}
                  />
                </div>
              </div>
              {form.loginId.length > 0 && (
                <div style={styles.fieldHelper}>
                  <span
                    style={{
                      color: isLoginIdValid ? '#16A34A' : '#DC2626',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {isLoginIdValid ? (
                      <>
                        <CheckCircle2 size={12} /> Valid Login Id ({loginIdLen}/12)
                      </>
                    ) : (
                      <>
                        <AlertCircle size={12} /> {loginIdLen < 6 ? `Need ${6 - loginIdLen} more characters (min 6)` : 'Max 12 characters'}
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Enter Email Id - */}
            <div style={styles.fieldBlock}>
              <div style={styles.row}>
                <label htmlFor="email" style={styles.rowLabel}>
                  Enter Email Id -
                </label>
                <div style={styles.inputContainer}>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={set('email')}
                    required
                    placeholder="email@example.com"
                    style={styles.lineInput}
                  />
                </div>
              </div>
            </div>

            {/* Enter Password - */}
            <div style={styles.fieldBlock}>
              <div style={styles.row}>
                <label htmlFor="password" style={styles.rowLabel}>
                  Enter Password -
                </label>
                <div style={styles.inputContainer}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={set('password')}
                    required
                    placeholder="> 8 chars, A-Z, a-z, special"
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

              {/* Live Password Strength Meter & Animation */}
              {form.password.length > 0 && (
                <PasswordStrengthMeter password={form.password} showChecklist={true} />
              )}
            </div>

            {/* Re-Enter Password - */}
            <div style={styles.fieldBlock}>
              <div style={styles.row}>
                <label htmlFor="confirmPassword" style={styles.rowLabel}>
                  Re-Enter Password -
                </label>
                <div style={styles.inputContainer}>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={set('confirmPassword')}
                    required
                    placeholder="Re-type password"
                    style={styles.lineInput}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.toggleBtn}
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              {form.confirmPassword.length > 0 && (
                <div style={styles.fieldHelper}>
                  <span
                    style={{
                      color: doPasswordsMatch ? '#16A34A' : '#DC2626',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {doPasswordsMatch ? (
                      <>
                        <CheckCircle2 size={12} /> Passwords match
                      </>
                    ) : (
                      <>
                        <AlertCircle size={12} /> Passwords do not match
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div role="alert" style={styles.errorBox}>
                <p style={styles.errorText}>{error}</p>
              </div>
            )}

            {success && (
              <div role="status" style={styles.successBox}>
                <p style={styles.successText}>{success}</p>
              </div>
            )}

            {/* Wireframe Centered Button: SIGN UP */}
            <div style={styles.btnWrapper}>
              <button
                type="submit"
                disabled={loading}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                style={{
                  ...styles.wireframeBtn,
                  background: btnHover ? 'var(--brown-900, #4A3A34)' : 'transparent',
                  color: btnHover ? 'var(--cream, #F9F2E4)' : 'var(--brown-900, #4A3A34)',
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'CREATING ACCOUNT…' : 'SIGN UP'}
              </button>
            </div>

            {/* Wireframe footer links */}
            <div style={styles.linksRow}>
              <Link to="/forgot-password" style={styles.link}>
                Forgot Password
              </Link>
              <span style={styles.linkDivider}>|</span>
              <Link to="/login" style={styles.link}>
                Sign In
              </Link>
              <span style={styles.linkDivider}>|</span>
              <Link to="/create-user" style={styles.link}>
                Create User
              </Link>
            </div>
          </form>
        </div>
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
    padding: '32px 20px',
    fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
  } as React.CSSProperties,
  pageTitle: {
    fontFamily: 'var(--font-display, "Montserrat", sans-serif)',
    fontWeight: 700,
    fontSize: 22,
    color: 'var(--brown-900, #4A3A34)',
    textAlign: 'center' as const,
    marginBottom: 16,
  } as React.CSSProperties,
  card: {
    background: 'var(--surface, #FFFFFF)',
    borderRadius: 22,
    border: '1.5px solid var(--brown-400, #B8977E)',
    boxShadow: '0 8px 28px rgba(74, 58, 52, 0.08)',
    padding: '36px 40px 32px 40px',
    width: '100%',
    maxWidth: 490,
  } as React.CSSProperties,
  appLogoBox: {
    width: 190,
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
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 18,
  },
  fieldBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
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
  fieldHelper: {
    display: 'flex',
    justifyContent: 'flex-end',
    fontSize: '0.72rem',
    marginTop: 4,
    paddingRight: 4,
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
    padding: '10px 14px',
    marginTop: 2,
  } as React.CSSProperties,
  errorText: {
    fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
    fontSize: 12,
    color: 'var(--danger, #9E4A38)',
    margin: 0,
    fontWeight: 600,
    lineHeight: 1.4,
  } as React.CSSProperties,
  successBox: {
    background: '#ECFDF5',
    border: '1px solid #10B981',
    borderRadius: 8,
    padding: '10px 14px',
    marginTop: 2,
  } as React.CSSProperties,
  successText: {
    fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
    fontSize: 12,
    color: '#047857',
    margin: 0,
    fontWeight: 600,
  } as React.CSSProperties,
  btnWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: 8,
  } as React.CSSProperties,
  wireframeBtn: {
    minWidth: 160,
    padding: '10px 28px',
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
    marginTop: 8,
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
};
