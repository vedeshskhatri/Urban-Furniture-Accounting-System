import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Printer,
  Download,
  RefreshCw,
  Calendar,
  Receipt,
  Layers,
  PackageCheck,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { formatINR } from '../../lib/money';
import api from '../../lib/axios';

/* ────────────────────────────────────────────────────────────────────────
   Types (mirror api/src/services/gstReturnService.ts)
   ──────────────────────────────────────────────────────────────────────── */

interface Gstr1Data {
  period: string;
  b2bCount: number;
  b2cCount: number;
  totalInvoices: number;
  totalTaxableValue: string;
  totalCgst: string;
  totalSgst: string;
  totalIgst: string;
  totalTax: string;
  totalInvoiceValue: string;
  b2bRecords: Array<{
    invoiceId: number; invoiceNumber: string; invoiceDate: string;
    buyerGstin: string; buyerName: string; placeOfSupply: string; supplyType: string;
    invoiceValue: string; taxableValue: string; cgstAmount: string; sgstAmount: string; igstAmount: string;
  }>;
  b2cRecords: Array<{
    invoiceId: number; invoiceNumber: string; invoiceDate: string;
    buyerName: string; placeOfSupply: string;
    invoiceValue: string; taxableValue: string; cgstAmount: string; sgstAmount: string; igstAmount: string;
  }>;
  hsnSummary: Array<{
    hsnCode: string; description: string; totalQty: string; taxableValue: string;
    cgstAmount: string; sgstAmount: string; igstAmount: string; totalTax: string;
  }>;
  docSummary: {
    docType: string; fromSerial: string; toSerial: string;
    totalCount: number; cancelledCount: number; netIssued: number;
  };
}

interface Gstr3BTable { taxableValue: string; igst: string; cgst: string; sgst: string; cess: string; }
interface Gstr3BData {
  period: string;
  outwardSupplies: Gstr3BTable; itcAvailable: Gstr3BTable; netTaxPayable: Gstr3BTable;
}

interface Gstr2BData {
  period: string;
  billCount: number; registeredVendorCount: number;
  totalTaxableValue: string; totalCgst: string; totalSgst: string; totalIgst: string;
  totalItc: string; totalInvoiceValue: string;
  records: Array<{
    billId: number; billNumber: string; billReference: string | null; billDate: string;
    vendorName: string; vendorGstin: string; placeOfSupply: string; supplyType: string;
    taxableValue: string; cgstAmount: string; sgstAmount: string; igstAmount: string;
    totalTax: string; invoiceValue: string; itcEligible: boolean;
  }>;
}

interface EWayBillRecord {
  invoiceId: number; invoiceNumber: string; invoiceDate: string;
  customerName: string; customerGstin: string; destination: string;
  totalValue: string; ewayBillNo: string; validUntil: string;
  status: string; vehicleNo: string; transporter: string;
}

/* ────────────────────────────────────────────────────────────────────────
   Period / filing-calendar helpers
   ──────────────────────────────────────────────────────────────────────── */

const APP_TODAY = new Date('2026-09-06T00:00:00');
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface PeriodOption { key: string; label: string; year?: number; month?: number; }

// FY 2026-27 runs Apr 2026 → Mar 2027.
const PERIODS: PeriodOption[] = [
  { key: 'FY', label: 'Full Year — FY 2026-27' },
  ...Array.from({ length: 12 }, (_, i) => {
    const m = ((3 + i) % 12) + 1;
    const y = 3 + i < 12 ? 2026 : 2027;
    return { key: `${y}-${String(m).padStart(2, '0')}`, label: `${MONTHS_LONG[m - 1]} ${y}`, year: y, month: m };
  }),
];

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function filingSchedule(period: PeriodOption) {
  if (!period.month || !period.year) return null;
  const nextMonth = period.month === 12 ? 1 : period.month + 1;
  const nextYear = period.month === 12 ? period.year + 1 : period.year;
  const label = (dt: Date) => `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()}`;

  const build = (name: string, day: number, note: string) => {
    const dt = new Date(nextYear, nextMonth - 1, day);
    const delta = daysBetween(APP_TODAY, dt);
    let status: 'upcoming' | 'due-soon' | 'overdue' | 'filed';
    if (delta < -5) status = 'filed';
    else if (delta < 0) status = 'overdue';
    else if (delta <= 7) status = 'due-soon';
    else status = 'upcoming';
    return { name, note, dueLabel: label(dt), delta, status };
  };

  return [
    build('GSTR-1', 11, 'Outward supplies · invoice-level'),
    build('GSTR-2B', 14, 'Auto-drafted ITC statement'),
    build('GSTR-3B', 20, 'Summary return · tax payment'),
  ];
}

/* ────────────────────────────────────────────────────────────────────────
   Shared style fragments — matches ProfitLossPage / BalanceSheetPage
   ──────────────────────────────────────────────────────────────────────── */

const HAIRLINE = '1px solid rgba(208, 174, 146, 0.4)';

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1080, margin: '0 auto', width: '100%' } as React.CSSProperties,
  bar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
    padding: '10px 16px', background: 'var(--surface)', borderRadius: 'var(--radius-md)',
    border: HAIRLINE, boxShadow: '0 1px 3px rgba(74, 58, 52, 0.04)',
  } as React.CSSProperties,
  pill: {
    display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(235, 215, 190, 0.2)',
    border: HAIRLINE, padding: '6px 12px', borderRadius: 8, fontSize: 13,
  } as React.CSSProperties,
  segWrap: {
    display: 'inline-flex', alignItems: 'center', background: 'rgba(235, 215, 190, 0.3)',
    padding: 3, borderRadius: 8, border: '1px solid rgba(208, 174, 146, 0.3)', gap: 2,
  } as React.CSSProperties,
  iconBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600,
    color: 'var(--brown-700)', background: 'transparent', border: HAIRLINE, borderRadius: 8, cursor: 'pointer',
  } as React.CSSProperties,
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600,
    color: '#FFFFFF', background: 'var(--brown-900)', border: '1px solid var(--brown-900)', borderRadius: 8,
    cursor: 'pointer', boxShadow: '0 1px 2px rgba(74, 58, 52, 0.15)',
  } as React.CSSProperties,
  card: {
    background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: HAIRLINE,
    boxShadow: '0 1px 4px rgba(74, 58, 52, 0.04)',
  } as React.CSSProperties,
  sectionHead: {
    fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: 'var(--brown-900)', margin: 0,
  } as React.CSSProperties,
  kpiLabel: {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brown-500)',
  } as React.CSSProperties,
  kpiValue: {
    fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 20, fontWeight: 700, color: 'var(--brown-900)',
  } as React.CSSProperties,
  kpiSub: { fontSize: 11, color: 'var(--brown-600)' } as React.CSSProperties,
  th: {
    padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: 'var(--brown-600)', whiteSpace: 'nowrap', textAlign: 'left',
  } as React.CSSProperties,
  td: {
    padding: '10px 12px', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
    fontSize: 12.5, color: 'var(--brown-900)', verticalAlign: 'middle', whiteSpace: 'nowrap',
  } as React.CSSProperties,
};

/* ────────────────────────────────────────────────────────────────────────
   Small presentational components
   ──────────────────────────────────────────────────────────────────────── */

const Kpi: React.FC<{ label: string; value: string; sub?: string; accent?: 'green' | 'blue' | 'danger' | 'dark' }> = ({
  label, value, sub, accent,
}) => {
  const dark = accent === 'dark';
  const valColor =
    accent === 'green' ? 'var(--posted)'
    : accent === 'blue' ? '#3E6B8A'
    : accent === 'danger' ? 'var(--danger)'
    : dark ? '#FFFFFF'
    : 'var(--brown-900)';
  return (
    <div
      style={{
        ...s.card,
        border: dark ? '1px solid var(--brown-900)' : HAIRLINE,
        background: dark ? 'var(--brown-900)' : 'var(--surface)',
        padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}
    >
      <span style={{ ...s.kpiLabel, color: dark ? 'rgba(240,225,200,0.75)' : 'var(--brown-500)' }}>{label}</span>
      <span style={{ ...s.kpiValue, color: valColor }}>{value}</span>
      {sub && <span style={{ ...s.kpiSub, color: dark ? 'rgba(240,225,200,0.65)' : 'var(--brown-600)' }}>{sub}</span>}
    </div>
  );
};

const SupplyTag: React.FC<{ type: string }> = ({ type }) => {
  const intra = type === 'INTRA_STATE';
  return (
    <span
      style={{
        fontSize: 9.5, fontWeight: 700, fontFamily: 'var(--font-body)', letterSpacing: '0.05em',
        padding: '1px 5px', borderRadius: 4,
        background: intra ? 'var(--posted-bg)' : 'rgba(62, 107, 138, 0.12)',
        color: intra ? 'var(--posted)' : '#3E6B8A',
      }}
    >
      {intra ? 'INTRA' : 'INTER'}
    </span>
  );
};

const Section: React.FC<{ title: string; note?: string; count?: number; children: React.ReactNode }> = ({
  title, note, count, children,
}) => (
  <div style={s.card}>
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '12px 16px', borderBottom: HAIRLINE,
      }}
    >
      <div>
        <h3 style={s.sectionHead}>{title}</h3>
        {note && <span style={{ fontSize: 11, color: 'var(--brown-500)' }}>{note}</span>}
      </div>
      {typeof count === 'number' && (
        <span
          style={{
            fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--brown-700)',
            background: 'rgba(235, 215, 190, 0.4)', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap',
          }}
        >
          {count} {count === 1 ? 'row' : 'rows'}
        </span>
      )}
    </div>
    {children}
  </div>
);

const Table: React.FC<{ head: string[]; rightFrom?: number; rows: React.ReactNode[][]; maxHeight?: number }> = ({
  head, rightFrom = 999, rows, maxHeight,
}) => (
  <div style={{ overflowX: 'auto', ...(maxHeight ? { maxHeight, overflowY: 'auto' } : {}) }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: 'rgba(235, 215, 190, 0.25)', borderBottom: HAIRLINE }}>
          {head.map((h, i) => (
            <th key={i} style={{ ...s.th, textAlign: i >= rightFrom ? 'right' : 'left', position: maxHeight ? 'sticky' : 'static', top: 0 }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, ri) => (
          <tr key={ri} style={{ borderBottom: '1px solid var(--brown-100)' }}>
            {cells.map((c, ci) => (
              <td key={ci} style={{ ...s.td, textAlign: ci >= rightFrom ? 'right' : 'left' }}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const InvoiceLink: React.FC<{ id: number; label: string; onGo: (p: string) => void }> = ({ id, label, onGo }) => (
  <button
    type="button"
    onClick={() => onGo(`/sales/invoices/${id}`)}
    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12.5, color: 'var(--brown-900)' }}
    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
  >
    {label}
  </button>
);

const StateBlock: React.FC<{ empty: string }> = ({ empty }) => (
  <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--brown-500)', fontSize: 13 }}>{empty}</div>
);

/* ────────────────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────────────────── */

type TabKey = 'gstr1' | 'gstr2b' | 'gstr3b' | 'eway';

const TABS: Array<{ k: TabKey; label: string; Icon: typeof Receipt }> = [
  { k: 'gstr1', label: 'GSTR-1', Icon: Receipt },
  { k: 'gstr2b', label: 'GSTR-2B', Icon: PackageCheck },
  { k: 'gstr3b', label: 'GSTR-3B', Icon: Layers },
  { k: 'eway', label: 'E-Way Bills', Icon: Truck },
];

export const GstReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('gstr1');
  const [periodKey, setPeriodKey] = useState<string>('2026-09');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gstr1, setGstr1] = useState<Gstr1Data | null>(null);
  const [gstr2b, setGstr2b] = useState<Gstr2BData | null>(null);
  const [gstr3b, setGstr3b] = useState<Gstr3BData | null>(null);
  const [ewayBills, setEwayBills] = useState<EWayBillRecord[]>([]);

  const period = useMemo(() => PERIODS.find((p) => p.key === periodKey) || PERIODS[0], [periodKey]);
  const schedule = useMemo(() => filingSchedule(period), [period]);
  const params = useMemo(
    () => (period.year && period.month ? { year: period.year, month: period.month } : {}),
    [period],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r1, r2b, r3b, rEwb] = await Promise.all([
        api.get('/api/gst/gstr-1', { params }).then((r) => r.data),
        api.get('/api/gst/gstr-2b', { params }).then((r) => r.data),
        api.get('/api/gst/gstr-3b', { params }).then((r) => r.data),
        api.get('/api/gst/eway-bills', { params }).then((r) => r.data),
      ]);
      if (r1?.error || r2b?.error || r3b?.error) {
        throw new Error(r1?.error?.message || r2b?.error?.message || r3b?.error?.message || 'GST engine error');
      }
      setGstr1(r1?.data ?? null);
      setGstr2b(r2b?.data ?? null);
      setGstr3b(r3b?.data ?? null);
      setEwayBills(Array.isArray(rEwb?.data) ? rEwb.data : []);
    } catch (err) {
      console.error('Failed to load GST data:', err);
      setError(err instanceof Error ? err.message : 'Failed to reach the GST engine');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePrint = () => window.print();

  const handleExportCsv = () => {
    let csv = '';
    let name = 'GST_Export';
    const tag = period.label.replace(/[^\w]+/g, '_');
    if (activeTab === 'gstr1' && gstr1) {
      name = `GSTR1_${tag}`;
      csv = 'Section,Invoice No,Date,Party,GSTIN,Place of Supply,Supply,Taxable,CGST,SGST,IGST,Invoice Value\n';
      gstr1.b2bRecords.forEach((r) => {
        csv += `B2B,"${r.invoiceNumber}",${r.invoiceDate},"${r.buyerName}",${r.buyerGstin},"${r.placeOfSupply}",${r.supplyType},${r.taxableValue},${r.cgstAmount},${r.sgstAmount},${r.igstAmount},${r.invoiceValue}\n`;
      });
      gstr1.b2cRecords.forEach((r) => {
        csv += `B2C,"${r.invoiceNumber}",${r.invoiceDate},"${r.buyerName}",URP,"${r.placeOfSupply}",,${r.taxableValue},${r.cgstAmount},${r.sgstAmount},${r.igstAmount},${r.invoiceValue}\n`;
      });
    } else if (activeTab === 'gstr2b' && gstr2b) {
      name = `GSTR2B_${tag}`;
      csv = 'Bill No,Reference,Date,Vendor,GSTIN,Place of Supply,Supply,ITC Eligible,Taxable,CGST,SGST,IGST,Bill Value\n';
      gstr2b.records.forEach((r) => {
        csv += `"${r.billNumber}","${r.billReference || ''}",${r.billDate},"${r.vendorName}",${r.vendorGstin},"${r.placeOfSupply}",${r.supplyType},${r.itcEligible ? 'YES' : 'NO'},${r.taxableValue},${r.cgstAmount},${r.sgstAmount},${r.igstAmount},${r.invoiceValue}\n`;
      });
    } else if (activeTab === 'eway') {
      name = `EWayBills_${tag}`;
      csv = 'E-Way Bill No,Invoice No,Date,Consignee,GSTIN,Destination,Vehicle,Transporter,Valid Until,Consignment Value\n';
      ewayBills.forEach((e) => {
        csv += `${e.ewayBillNo},"${e.invoiceNumber}",${e.invoiceDate},"${e.customerName}",${e.customerGstin},"${e.destination}",${e.vehicleNo},"${e.transporter}",${e.validUntil},${e.totalValue}\n`;
      });
    } else if (activeTab === 'gstr3b' && gstr3b) {
      name = `GSTR3B_${tag}`;
      csv = 'Tax Head,Outward Tax,Eligible ITC,Net Payable in Cash\n';
      (['igst', 'cgst', 'sgst'] as const).forEach((h) => {
        csv += `${h.toUpperCase()},${gstr3b.outwardSupplies[h]},${gstr3b.itcAvailable[h]},${gstr3b.netTaxPayable[h]}\n`;
      });
    }
    if (!csv) return;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const netCashPayable = gstr3b
    ? Number(gstr3b.netTaxPayable.cgst) + Number(gstr3b.netTaxPayable.sgst) + Number(gstr3b.netTaxPayable.igst)
    : 0;

  return (
    <div style={s.page}>
      {/* ── Control bar ── */}
      <div className="no-print" style={s.bar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={s.pill}>
            <Calendar size={14} style={{ color: 'var(--brown-600)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown-700)' }}>Return period</span>
            <select
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
              style={{
                border: 'none', background: 'transparent', fontFamily: 'var(--font-mono)', fontSize: 12,
                fontWeight: 700, color: 'var(--brown-900)', outline: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <span style={{ fontSize: 11, color: 'var(--brown-500)', fontFamily: 'var(--font-mono)' }}>
            27AABCU9603R1ZM · Urban Furniture Pvt Ltd · Maharashtra (27)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={loadData} style={s.iconBtn} title="Refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button type="button" onClick={handleExportCsv} style={s.iconBtn}>
            <Download size={13} />
            <span>Export CSV</span>
          </button>
          <button type="button" onClick={handlePrint} style={s.primaryBtn}>
            <Printer size={13} />
            <span>Print CA Sheet</span>
          </button>
        </div>
      </div>

      {/* ── Document header ── */}
      <div style={{ ...s.card, padding: '20px 24px' }}>
        <span
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--posted)', fontFamily: 'var(--font-body)',
          }}
        >
          Indian GST Compliance Engine · Rule 138 · offline
        </span>
        <h1
          style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--brown-900)',
            margin: '4px 0 2px 0', letterSpacing: '-0.01em',
          }}
        >
          GST Compliance &amp; Tax Return Center
        </h1>
        <p style={{ fontSize: 12, color: 'var(--brown-600)', margin: 0 }}>
          {period.label} · returns computed from confirmed invoices &amp; vendor bills
        </p>
      </div>

      {/* ── Filing calendar strip ── */}
      {schedule && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {schedule.map((f) => {
            const meta = {
              filed: { bd: 'var(--brown-200)', bg: 'rgba(235, 215, 190, 0.2)', fg: 'var(--brown-600)', Icon: CheckCircle2, word: 'Window closed' },
              overdue: { bd: 'rgba(158, 74, 56, 0.4)', bg: 'var(--danger-bg)', fg: 'var(--danger)', Icon: AlertTriangle, word: 'Overdue' },
              'due-soon': { bd: 'rgba(192, 138, 62, 0.4)', bg: 'var(--warning-bg)', fg: 'var(--warning)', Icon: Clock, word: 'Due soon' },
              upcoming: { bd: 'rgba(95, 112, 82, 0.35)', bg: 'var(--posted-bg)', fg: 'var(--posted)', Icon: Clock, word: 'Upcoming' },
            }[f.status];
            const Icon = meta.Icon;
            return (
              <div key={f.name} style={{ ...s.card, border: `1px solid ${meta.bd}`, background: meta.bg, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--brown-900)' }}>{f.name}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: meta.fg }}>
                    <Icon size={12} />{meta.word}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--brown-600)', margin: '2px 0 0 0' }}>{f.note}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(208,174,146,0.35)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--brown-800)' }}>Due {f.dueLabel}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: meta.fg }}>
                    {f.delta > 0 ? `${f.delta}d left` : f.delta === 0 ? 'today' : `${Math.abs(f.delta)}d ago`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tab segmented control ── */}
      <div className="no-print" style={{ ...s.segWrap, alignSelf: 'flex-start' }}>
        {TABS.map(({ k, label, Icon }) => {
          const active = activeTab === k;
          const badge =
            k === 'gstr2b' && gstr2b ? gstr2b.billCount
            : k === 'eway' ? ewayBills.length
            : k === 'gstr1' && gstr1 ? gstr1.totalInvoices
            : null;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setActiveTab(k)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, background: active ? 'var(--surface)' : 'transparent',
                border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: active ? 700 : 500,
                color: active ? 'var(--brown-900)' : 'var(--brown-600)', cursor: 'pointer',
                boxShadow: active ? '0 1px 2px rgba(74, 58, 52, 0.08)' : 'none', transition: 'all 120ms ease',
              }}
            >
              <Icon size={13} />
              <span>{label}</span>
              {badge != null && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: active ? 'var(--brown-500)' : 'var(--brown-400)' }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Body ── */}
      <div className="printable-sheet" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ ...s.card, height: 82, opacity: 0.5 }} className="animate-pulse" />
              ))}
            </div>
            <div style={{ ...s.card, height: 260, opacity: 0.4 }} className="animate-pulse" />
          </>
        ) : error ? (
          <div style={{ ...s.card, padding: '36px 16px', textAlign: 'center', borderColor: 'rgba(158, 74, 56, 0.35)' }}>
            <AlertTriangle size={26} style={{ color: 'var(--danger)' }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--brown-900)', margin: '10px 0 2px 0' }}>Could not load GST data</p>
            <p style={{ fontSize: 12, color: 'var(--brown-500)', margin: 0 }}>{error}</p>
            <button type="button" onClick={loadData} style={{ ...s.primaryBtn, margin: '14px auto 0 auto' }}>
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        ) : (
          <>
            {/* ═══ GSTR-1 ═══ */}
            {activeTab === 'gstr1' && gstr1 && (
              gstr1.totalInvoices === 0 ? (
                <div style={s.card}><StateBlock empty={`No confirmed outward invoices for ${gstr1.period}.`} /></div>
              ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <Kpi label="Taxable Turnover" value={formatINR(gstr1.totalTaxableValue)} sub={`${gstr1.totalInvoices} invoices`} />
                  <Kpi label="CGST" value={formatINR(gstr1.totalCgst)} sub="Central · intra-state" accent="green" />
                  <Kpi label="SGST" value={formatINR(gstr1.totalSgst)} sub="State · intra-state" accent="green" />
                  <Kpi label="IGST" value={formatINR(gstr1.totalIgst)} sub="Integrated · inter-state" accent="blue" />
                  <Kpi label="Total Tax Liability" value={formatINR(gstr1.totalTax)} sub="on outward supplies" accent="dark" />
                </div>

                <Section
                  title="Table 4 · Supplies to Registered Persons (B2B)"
                  note="Invoices to clients holding a GSTIN"
                  count={gstr1.b2bRecords.length}
                >
                  {gstr1.b2bRecords.length === 0 ? (
                    <StateBlock empty="No B2B invoices this period. Unregistered sales appear under Table 5/7." />
                  ) : (
                    <Table
                      head={['Buyer GSTIN', 'Receiver', 'Invoice', 'Date', 'Place of Supply', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total']}
                      rightFrom={5}
                      maxHeight={gstr1.b2bRecords.length > 12 ? 460 : undefined}
                      rows={gstr1.b2bRecords.map((r) => [
                        <strong>{r.buyerGstin}</strong>,
                        <span style={{ fontFamily: 'var(--font-body)' }}>{r.buyerName}</span>,
                        <InvoiceLink id={r.invoiceId} label={r.invoiceNumber} onGo={navigate} />,
                        r.invoiceDate,
                        <span style={{ fontFamily: 'var(--font-body)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>{r.placeOfSupply}<SupplyTag type={r.supplyType} /></span>,
                        formatINR(r.taxableValue),
                        <span style={{ color: 'var(--posted)' }}>{formatINR(r.cgstAmount)}</span>,
                        <span style={{ color: 'var(--posted)' }}>{formatINR(r.sgstAmount)}</span>,
                        <span style={{ color: '#3E6B8A' }}>{formatINR(r.igstAmount)}</span>,
                        <strong>{formatINR(r.invoiceValue)}</strong>,
                      ])}
                    />
                  )}
                </Section>

                <Section
                  title="Table 5 & 7 · Supplies to Unregistered Persons (B2C)"
                  note="Retail clients, showroom walk-ins and unregistered entities"
                  count={gstr1.b2cRecords.length}
                >
                  {gstr1.b2cRecords.length === 0 ? (
                    <StateBlock empty="No B2C invoices this period." />
                  ) : (
                    <Table
                      head={['Customer', 'Invoice', 'Date', 'Place of Supply', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total']}
                      rightFrom={4}
                      maxHeight={gstr1.b2cRecords.length > 12 ? 460 : undefined}
                      rows={gstr1.b2cRecords.map((r) => [
                        <span style={{ fontFamily: 'var(--font-body)' }}>{r.buyerName}</span>,
                        <InvoiceLink id={r.invoiceId} label={r.invoiceNumber} onGo={navigate} />,
                        r.invoiceDate,
                        <span style={{ fontFamily: 'var(--font-body)' }}>{r.placeOfSupply}</span>,
                        formatINR(r.taxableValue),
                        <span style={{ color: 'var(--posted)' }}>{formatINR(r.cgstAmount)}</span>,
                        <span style={{ color: 'var(--posted)' }}>{formatINR(r.sgstAmount)}</span>,
                        <span style={{ color: '#3E6B8A' }}>{formatINR(r.igstAmount)}</span>,
                        <strong>{formatINR(r.invoiceValue)}</strong>,
                      ])}
                    />
                  )}
                </Section>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                  <Section title="Table 12 · HSN-Wise Summary" count={gstr1.hsnSummary.length}>
                    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {gstr1.hsnSummary.map((h, i) => (
                        <div key={i} style={{ padding: 12, background: 'rgba(235, 215, 190, 0.18)', border: '1px solid var(--brown-100)', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--brown-900)' }}>HSN {h.hsnCode}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--brown-600)' }}>Qty {Number(h.totalQty).toLocaleString('en-IN')}</span>
                          </div>
                          <p style={{ fontSize: 11.5, color: 'var(--brown-700)', margin: '3px 0 0 0' }}>{h.description}</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(208,174,146,0.35)', fontFamily: 'var(--font-mono)' }}>
                            <div><span style={{ fontSize: 9.5, color: 'var(--brown-500)', display: 'block' }}>TAXABLE</span><strong style={{ fontSize: 12 }}>{formatINR(h.taxableValue)}</strong></div>
                            <div><span style={{ fontSize: 9.5, color: 'var(--brown-500)', display: 'block' }}>CGST+SGST</span><strong style={{ fontSize: 12, color: 'var(--posted)' }}>{formatINR(Number(h.cgstAmount) + Number(h.sgstAmount))}</strong></div>
                            <div><span style={{ fontSize: 9.5, color: 'var(--brown-500)', display: 'block' }}>IGST</span><strong style={{ fontSize: 12, color: '#3E6B8A' }}>{formatINR(h.igstAmount)}</strong></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>

                  <Section title="Table 13 · Documents Issued">
                    <div style={{ padding: 12 }}>
                      <div style={{ padding: 12, background: 'rgba(235, 215, 190, 0.18)', border: '1px solid var(--brown-100)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown-900)', fontFamily: 'var(--font-body)' }}>{gstr1.docSummary.docType}</span>
                          <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--posted)', background: 'var(--posted-bg)', padding: '2px 6px', borderRadius: 4 }}>VALID SERIES</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10, fontFamily: 'var(--font-mono)' }}>
                          <div><span style={{ fontSize: 9.5, color: 'var(--brown-500)', display: 'block' }}>FROM SERIAL</span><strong style={{ fontSize: 12 }}>{gstr1.docSummary.fromSerial}</strong></div>
                          <div><span style={{ fontSize: 9.5, color: 'var(--brown-500)', display: 'block' }}>TO SERIAL</span><strong style={{ fontSize: 12 }}>{gstr1.docSummary.toSerial}</strong></div>
                          <div><span style={{ fontSize: 9.5, color: 'var(--brown-500)', display: 'block' }}>TOTAL ISSUED</span><strong style={{ fontSize: 12 }}>{gstr1.docSummary.totalCount}</strong></div>
                          <div><span style={{ fontSize: 9.5, color: 'var(--brown-500)', display: 'block' }}>CANCELLED</span><strong style={{ fontSize: 12 }}>{gstr1.docSummary.cancelledCount}</strong></div>
                        </div>
                      </div>
                    </div>
                  </Section>
                </div>
              </>
              )
            )}

            {/* ═══ GSTR-2B ═══ */}
            {activeTab === 'gstr2b' && gstr2b && (
              gstr2b.billCount === 0 ? (
                <div style={s.card}><StateBlock empty={`No confirmed vendor bills for ${gstr2b.period}.`} /></div>
              ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <Kpi label="Inward Taxable Value" value={formatINR(gstr2b.totalTaxableValue)} sub={`${gstr2b.billCount} vendor bills`} />
                  <Kpi label="ITC · CGST" value={formatINR(gstr2b.totalCgst)} accent="green" />
                  <Kpi label="ITC · SGST" value={formatINR(gstr2b.totalSgst)} accent="green" />
                  <Kpi label="ITC · IGST" value={formatINR(gstr2b.totalIgst)} accent="blue" />
                  <Kpi label="Total Eligible ITC" value={formatINR(gstr2b.totalItc)} sub={`${gstr2b.registeredVendorCount} registered vendors`} accent="dark" />
                </div>

                <Section
                  title="Auto-Drafted Inward Supply Statement"
                  note="ITC is credited only for vendors with a valid GSTIN — others are shown but blocked"
                  count={gstr2b.records.length}
                >
                  <Table
                    head={['Bill No', 'Date', 'Vendor', 'GSTIN', 'Place of Supply', 'ITC', 'Taxable', 'CGST', 'SGST', 'IGST', 'Bill Value']}
                    rightFrom={6}
                    maxHeight={gstr2b.records.length > 12 ? 500 : undefined}
                    rows={gstr2b.records.map((r) => {
                      const dim = r.itcEligible ? 'var(--brown-900)' : 'var(--brown-400)';
                      return [
                        <strong>{r.billNumber}</strong>,
                        r.billDate,
                        <span style={{ fontFamily: 'var(--font-body)' }}>{r.vendorName}</span>,
                        <span style={{ color: dim, fontWeight: r.itcEligible ? 700 : 400 }}>{r.vendorGstin}</span>,
                        <span style={{ fontFamily: 'var(--font-body)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>{r.placeOfSupply}<SupplyTag type={r.supplyType} /></span>,
                        <span
                          style={{
                            fontSize: 9.5, fontWeight: 700, fontFamily: 'var(--font-body)', padding: '1px 5px', borderRadius: 4,
                            background: r.itcEligible ? 'var(--posted-bg)' : 'rgba(235, 215, 190, 0.4)',
                            color: r.itcEligible ? 'var(--posted)' : 'var(--brown-500)',
                          }}
                        >
                          {r.itcEligible ? 'ELIGIBLE' : 'BLOCKED'}
                        </span>,
                        formatINR(r.taxableValue),
                        <span style={{ color: r.itcEligible ? 'var(--posted)' : 'var(--brown-400)' }}>{formatINR(r.cgstAmount)}</span>,
                        <span style={{ color: r.itcEligible ? 'var(--posted)' : 'var(--brown-400)' }}>{formatINR(r.sgstAmount)}</span>,
                        <span style={{ color: r.itcEligible ? '#3E6B8A' : 'var(--brown-400)' }}>{formatINR(r.igstAmount)}</span>,
                        <strong>{formatINR(r.invoiceValue)}</strong>,
                      ];
                    })}
                  />
                </Section>
              </>
              )
            )}

            {/* ═══ GSTR-3B ═══ */}
            {activeTab === 'gstr3b' && gstr3b && (
              <>
                <div style={{ ...s.card, background: 'var(--brown-900)', border: '1px solid var(--brown-900)', padding: '20px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,225,200,0.7)' }}>
                      Electronic Cash Ledger Settlement · {gstr3b.period}
                    </span>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#FFFFFF', margin: '4px 0 2px 0' }}>
                      Net Tax Payable in Cash (post-ITC set-off)
                    </h2>
                    <p style={{ fontSize: 11.5, color: 'rgba(240,225,200,0.65)', margin: 0 }}>
                      Outward tax liability minus eligible Input Tax Credit from inward vendor bills.
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 10, color: 'rgba(240,225,200,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block' }}>Total cash outflow</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, color: '#FFFFFF' }}>{formatINR(netCashPayable)}</span>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(240,225,200,0.75)', marginTop: 2 }}>
                      CGST {formatINR(gstr3b.netTaxPayable.cgst)} · SGST {formatINR(gstr3b.netTaxPayable.sgst)} · IGST {formatINR(gstr3b.netTaxPayable.igst)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                  <Gstr3BBlock title="3.1 · Outward Taxable Supplies" tag="LIABILITY" table={gstr3b.outwardSupplies} />
                  <Gstr3BBlock title="4 · Eligible Input Tax Credit" tag="OFFSET" table={gstr3b.itcAvailable} />
                </div>

                <Section title="6.1 · Payment of Tax (net ledger offset)">
                  <Table
                    head={['Tax Head', 'Gross Outward Tax', 'Eligible ITC Offset', 'Net Payable in Cash']}
                    rightFrom={1}
                    rows={(['igst', 'cgst', 'sgst'] as const).map((h) => [
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600 }}>{h.toUpperCase()}</span>,
                      formatINR(gstr3b.outwardSupplies[h]),
                      <span style={{ color: 'var(--posted)' }}>− {formatINR(gstr3b.itcAvailable[h])}</span>,
                      <strong>{formatINR(gstr3b.netTaxPayable[h])}</strong>,
                    ])}
                  />
                </Section>
              </>
            )}

            {/* ═══ E-Way ═══ */}
            {activeTab === 'eway' && (
              <Section
                title="E-Way Bill Consignment Registry · Rule 138"
                note="Consignments above the ₹50,000 threshold"
                count={ewayBills.length}
              >
                {ewayBills.length === 0 ? (
                  <StateBlock empty={`No confirmed invoices above ₹50,000 in ${period.label}.`} />
                ) : (
                  <Table
                    head={['E-Way Bill', 'Invoice', 'Date', 'Consignee', 'Destination', 'Vehicle / Logistics', 'Valid Until', 'Consignment Value']}
                    rightFrom={7}
                    maxHeight={ewayBills.length > 12 ? 500 : undefined}
                    rows={ewayBills.map((e) => [
                      <span style={{ background: 'rgba(62, 107, 138, 0.1)', border: '1px solid rgba(62,107,138,0.3)', borderRadius: 4, padding: '1px 6px', fontWeight: 700, color: '#3E6B8A' }}>{e.ewayBillNo}</span>,
                      <InvoiceLink id={e.invoiceId} label={e.invoiceNumber} onGo={navigate} />,
                      e.invoiceDate,
                      <span style={{ fontFamily: 'var(--font-body)' }}><strong>{e.customerName}</strong><span style={{ display: 'block', fontSize: 10, color: 'var(--brown-500)', fontFamily: 'var(--font-mono)' }}>{e.customerGstin}</span></span>,
                      <span style={{ fontFamily: 'var(--font-body)' }}>{e.destination}</span>,
                      <span><strong>{e.vehicleNo}</strong><span style={{ display: 'block', fontSize: 10, color: 'var(--brown-500)', fontFamily: 'var(--font-body)' }}>{e.transporter}</span></span>,
                      <span style={{ color: 'var(--posted)', fontWeight: 700 }}>{e.validUntil}<span style={{ display: 'block', fontSize: 9.5, fontWeight: 400, color: 'var(--brown-500)' }}>active 48h</span></span>,
                      <strong>{formatINR(e.totalValue)}</strong>,
                    ])}
                  />
                )}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/* ── GSTR-3B 3.1 / 4 breakdown block ── */
const Gstr3BBlock: React.FC<{ title: string; tag: string; table: Gstr3BTable }> = ({ title, tag, table }) => (
  <div style={s.card}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: HAIRLINE }}>
      <h3 style={s.sectionHead}>{title}</h3>
      <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: 'var(--font-body)', color: 'var(--brown-600)', background: 'rgba(235, 215, 190, 0.4)', padding: '2px 6px', borderRadius: 4 }}>{tag}</span>
    </div>
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {([
        ['Total Taxable Value', table.taxableValue, 'var(--brown-900)'],
        ['Integrated Tax (IGST)', table.igst, '#3E6B8A'],
        ['Central Tax (CGST)', table.cgst, 'var(--posted)'],
        ['State Tax (SGST)', table.sgst, 'var(--posted)'],
      ] as const).map(([label, val, color]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'rgba(235, 215, 190, 0.18)', borderRadius: 'var(--radius-sm)' }}>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--brown-700)' }}>{label}</span>
          <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color }}>{formatINR(val)}</strong>
        </div>
      ))}
    </div>
  </div>
);

export default GstReportPage;
