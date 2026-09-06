import Decimal from 'decimal.js';

/**
 * Format a decimal string as Indian Rupees.
 * Uses hand-rolled grouping — Intl.NumberFormat('en-IN') silently falls back
 * to Western grouping inside Docker's small-icu Node build.
 *
 * Input must always be a string, e.g. "200000.50"
 * Output: "₹2,00,000.50"
 */
export function formatINR(value: string): string {
  const d = new Decimal(value);
  const neg = d.isNegative();
  const [int, dec] = d.abs().toFixed(2).split('.');
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3);
  const grouped = rest
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3
    : last3;
  return `${neg ? '-' : ''}₹${grouped}.${dec}`;
}

/** Parse a string to Decimal safely. Never call parseFloat. */
export function toDecimal(value: string): Decimal {
  return new Decimal(value);
}

/**
 * Abbreviated INR formatter for KPI summary cards.
 * ≥ 1 Cr  → "₹X.XXCr"
 * ≥ 1 L   → "₹X.XXL"
 * < 1 L   → full formatINR
 */
export function formatINRCompact(value: string): string {
  const d = new Decimal(value);
  const neg = d.isNegative();
  const abs = d.abs();
  const prefix = neg ? '-' : '';

  if (abs.gte(10_000_000)) {
    return `${prefix}₹${abs.div(10_000_000).toFixed(2)}Cr`;
  }
  if (abs.gte(100_000)) {
    return `${prefix}₹${abs.div(100_000).toFixed(2)}L`;
  }
  return formatINR(value);
}

/**
 * Clean, human-readable Indian Rupee tick formatter for chart Y-axes.
 * Accurately scales dynamically across Cr, L, and K without producing
 * awkward repeats like "₹0.0Cr".
 */
export function formatYAxisINR(val: number | string): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n) || n === 0 || Math.abs(n) < 0.01) {
    return '₹0';
  }
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  if (abs >= 10_000_000) {
    const cr = abs / 10_000_000;
    const formatted = cr >= 10 ? cr.toFixed(1) : cr.toFixed(2);
    return `${sign}₹${parseFloat(formatted)} Cr`;
  }
  if (abs >= 100_000) {
    const l = abs / 100_000;
    const formatted = l >= 10 ? l.toFixed(1) : l.toFixed(2);
    return `${sign}₹${parseFloat(formatted)} L`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    const formatted = k >= 10 ? k.toFixed(0) : k.toFixed(1);
    return `${sign}₹${parseFloat(formatted)} K`;
  }
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}
