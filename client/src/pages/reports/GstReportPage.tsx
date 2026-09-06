import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Printer,
  Download,
  Truck,
  RefreshCw,
  Receipt,
  Layers,
  PackageCheck,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { formatINR } from '../../lib/money';
import api from '../../lib/axios';

/* ────────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────────── */

interface Gstr1Data {
  period: string;
  sellerGstin: string;
  sellerName: string;
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
  period: string; sellerGstin: string; sellerName: string;
  outwardSupplies: Gstr3BTable; itcAvailable: Gstr3BTable; netTaxPayable: Gstr3BTable;
}

interface Gstr2BData {
  period: string; sellerGstin: string; sellerName: string;
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
   Period helpers — GST returns are filed for a calendar month.
   The demo timeline is anchored to Sep 2026.
   ──────────────────────────────────────────────────────────────────────── */

const APP_TODAY = new Date('2026-09-06T00:00:00');
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface PeriodOption { key: string; label: string; year?: number; month?: number; }

// FY 2026-27 runs Apr 2026 → Mar 2027.
const PERIODS: PeriodOption[] = [
  { key: 'FY', label: 'Full Year — FY 2026-27' },
  ...Array.from({ length: 12 }, (_, i) => {
    const m = ((3 + i) % 12) + 1;
    const y = 3 + i < 12 ? 2026 : 2027;
    return { key: `${y}-${String(m).padStart(2, '0')}`, label: `${MONTH_NAMES[m - 1]} ${y}`, year: y, month: m };
  }),
];

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Statutory due dates for the period being filed. */
function filingSchedule(period: PeriodOption) {
  if (!period.month || !period.year) return null;
  const nextMonth = period.month === 12 ? 1 : period.month + 1;
  const nextYear = period.month === 12 ? period.year + 1 : period.year;
  const due = (d: number) => new Date(nextYear, nextMonth - 1, d);
  const label = (dt: Date) => `${dt.getDate()} ${MONTH_NAMES[dt.getMonth()]} ${dt.getFullYear()}`;

  const build = (name: string, day: number, note: string) => {
    const dt = due(day);
    const delta = daysBetween(APP_TODAY, dt);
    let status: 'upcoming' | 'due-soon' | 'overdue' | 'filed';
    if (delta < -5) status = 'filed';
    else if (delta < 0) status = 'overdue';
    else if (delta <= 7) status = 'due-soon';
    else status = 'upcoming';
    return { name, note, dueLabel: label(dt), delta, status };
  };

  return [
    build('GSTR-1', 11, 'Outward supplies — invoice-level'),
    build('GSTR-2B', 14, 'Auto-drafted ITC statement'),
    build('GSTR-3B', 20, 'Summary return + tax payment'),
  ];
}

/* ────────────────────────────────────────────────────────────────────────
   Small presentational helpers
   ──────────────────────────────────────────────────────────────────────── */

const Kpi: React.FC<{ label: string; value: string; sub?: string; tone?: 'default' | 'green' | 'blue' | 'dark' }> = ({
  label, value, sub, tone = 'default',
}) => {
  const toneClass = tone === 'dark' ? 'bg-brown-900 text-cream border-brown-900' : 'bg-surface border-brown-200';
  const valueClass =
    tone === 'green' ? 'text-emerald-800'
    : tone === 'blue' ? 'text-blue-800'
    : tone === 'dark' ? 'text-white'
    : 'text-brown-900';
  return (
    <div className={`p-4 rounded-[10px] border shadow-sm ${toneClass}`}>
      <span className={`text-[11px] font-semibold uppercase tracking-wider block ${tone === 'dark' ? 'text-amber-200' : 'text-brown-500'}`}>
        {label}
      </span>
      <span className={`text-base font-bold font-mono mt-1 block ${valueClass}`}>{value}</span>
      {sub && <span className={`text-[10px] mt-0.5 block ${tone === 'dark' ? 'text-amber-200/80' : 'text-brown-500'}`}>{sub}</span>}
    </div>
  );
};

const StateChip: React.FC<{ type: string }> = ({ type }) => (
  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
    type === 'INTRA_STATE' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
  }`}>
    {type === 'INTRA_STATE' ? 'INTRA' : 'INTER'}
  </span>
);

/* ────────────────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────────────────── */

type TabKey = 'gstr1' | 'gstr2b' | 'gstr3b' | 'eway';

export const GstReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('gstr1');
  const [periodKey, setPeriodKey] = useState<string>('2026-09');
  const [loading, setLoading] = useState<boolean>(true);
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
      const [res1, res2b, res3b, resEwb] = await Promise.all([
        api.get('/api/gst/gstr-1', { params }).then((r) => r.data),
        api.get('/api/gst/gstr-2b', { params }).then((r) => r.data),
        api.get('/api/gst/gstr-3b', { params }).then((r) => r.data),
        api.get('/api/gst/eway-bills', { params }).then((r) => r.data),
      ]);
      if (res1?.error || res2b?.error || res3b?.error) {
        throw new Error(res1?.error?.message || res2b?.error?.message || res3b?.error?.message || 'GST engine error');
      }
      setGstr1(res1?.data ?? null);
      setGstr2b(res2b?.data ?? null);
      setGstr3b(res3b?.data ?? null);
      setEwayBills(Array.isArray(resEwb?.data) ? resEwb.data : []);
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
    const tag = period.label.replace(/\s+/g, '_');
    if (activeTab === 'gstr1' && gstr1) {
      name = `GSTR1_${tag}`;
      csv = 'Section,Invoice No,Date,Party,GSTIN,Place of Supply,Supply,Taxable Value,CGST,SGST,IGST,Invoice Value\n';
      gstr1.b2bRecords.forEach((r) => {
        csv += `B2B,"${r.invoiceNumber}",${r.invoiceDate},"${r.buyerName}",${r.buyerGstin},"${r.placeOfSupply}",${r.supplyType},${r.taxableValue},${r.cgstAmount},${r.sgstAmount},${r.igstAmount},${r.invoiceValue}\n`;
      });
      gstr1.b2cRecords.forEach((r) => {
        csv += `B2C,"${r.invoiceNumber}",${r.invoiceDate},"${r.buyerName}",URP,"${r.placeOfSupply}",,${r.taxableValue},${r.cgstAmount},${r.sgstAmount},${r.igstAmount},${r.invoiceValue}\n`;
      });
    } else if (activeTab === 'gstr2b' && gstr2b) {
      name = `GSTR2B_${tag}`;
      csv = 'Bill No,Reference,Date,Vendor,GSTIN,Place of Supply,Supply,ITC Eligible,Taxable Value,CGST,SGST,IGST,Bill Value\n';
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
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20">
      {/* ── Header / Action bar ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-6 border-b border-brown-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wide">
              Official Indian GST Engine
            </span>
            <span className="text-xs text-brown-500 font-mono">Rule 138 Compliant • 100% Offline</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-brown-900 mt-1">
            GST Compliance &amp; Tax Return Center
          </h1>
          <p className="text-xs text-brown-600 mt-1">
            Taxpayer: <strong className="text-brown-900">Urban Furniture Pvt Ltd</strong> &nbsp;•&nbsp; GSTIN:{' '}
            <strong className="font-mono text-brown-900">27AABCU9603R1ZM</strong> &nbsp;•&nbsp; State:{' '}
            <strong>Maharashtra (27)</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 no-print">
          <label className="flex items-center gap-2 text-xs font-semibold text-brown-700 bg-surface border border-brown-300 rounded-lg px-2.5 py-1.5 shadow-sm">
            <CalendarClock className="w-4 h-4 text-brown-500" />
            <select
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
              className="bg-transparent text-brown-900 font-bold outline-none cursor-pointer"
            >
              {PERIODS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={loadData}
            className="p-2 border border-brown-300 rounded-lg text-brown-700 hover:bg-brown-100 transition shadow-sm cursor-pointer"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 text-xs font-semibold bg-surface border border-brown-300 rounded-lg text-brown-800 hover:bg-brown-100 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4 text-brown-600" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 text-xs font-semibold bg-brown-900 text-cream rounded-lg hover:bg-brown-800 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print CA Submission Sheet
          </button>
        </div>
      </div>

      {/* ── Filing calendar strip ── */}
      {schedule && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          {schedule.map((s) => {
            const meta = {
              filed: { cls: 'border-brown-200 bg-brown-50/40', chip: 'bg-brown-200 text-brown-700', Icon: CheckCircle2, word: 'WINDOW PASSED' },
              overdue: { cls: 'border-red-300 bg-red-50', chip: 'bg-red-200 text-red-900', Icon: AlertTriangle, word: 'OVERDUE' },
              'due-soon': { cls: 'border-amber-300 bg-amber-50', chip: 'bg-amber-200 text-amber-900', Icon: CalendarClock, word: 'DUE SOON' },
              upcoming: { cls: 'border-emerald-200 bg-emerald-50/50', chip: 'bg-emerald-100 text-emerald-800', Icon: CalendarClock, word: 'UPCOMING' },
            }[s.status];
            const Icon = meta.Icon;
            return (
              <div key={s.name} className={`rounded-[10px] border p-3.5 shadow-sm ${meta.cls}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-brown-900">{s.name}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${meta.chip}`}>
                    <Icon className="w-3 h-3" />{meta.word}
                  </span>
                </div>
                <p className="text-[11px] text-brown-600 mt-0.5">{s.note}</p>
                <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-brown-200/60">
                  <span className="text-xs font-mono text-brown-800">Due {s.dueLabel}</span>
                  <span className="text-[11px] font-semibold text-brown-600">
                    {s.delta > 0 ? `in ${s.delta}d` : s.delta === 0 ? 'today' : `${Math.abs(s.delta)}d ago`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex flex-wrap border-b border-brown-200 mt-6 no-print gap-1">
        {([
          { k: 'gstr1', label: 'GSTR-1 (Outward Supplies)', Icon: Receipt },
          { k: 'gstr2b', label: `GSTR-2B (Inward ITC)${gstr2b ? ` (${gstr2b.billCount})` : ''}`, Icon: PackageCheck },
          { k: 'gstr3b', label: 'GSTR-3B (Summary & Net Tax)', Icon: Layers },
          { k: 'eway', label: `E-Way Bill Registry (${ewayBills.length})`, Icon: Truck },
        ] as const).map(({ k, label, Icon }) => (
          <button
            key={k}
            type="button"
            onClick={() => setActiveTab(k as TabKey)}
            className={`px-5 py-2.5 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === k
                ? 'border-brown-900 text-brown-900 bg-brown-50/50'
                : 'border-transparent text-brown-600 hover:text-brown-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Body ── */}
      <div className="printable-sheet mt-6">
        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 rounded-[10px] bg-brown-100/60 animate-pulse" />
              ))}
            </div>
            <div className="h-64 rounded-[10px] bg-brown-100/50 animate-pulse" />
          </div>
        ) : error ? (
          <div className="p-10 text-center bg-surface border border-red-200 rounded-[10px]">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="text-sm font-semibold text-brown-900 mt-3">Could not load GST data</p>
            <p className="text-xs text-brown-500 mt-1">{error}</p>
            <button
              type="button"
              onClick={loadData}
              className="mt-4 px-4 py-2 text-xs font-semibold bg-brown-900 text-cream rounded-lg hover:bg-brown-800 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : (
          <>
            {/* ═══ GSTR-1 ═══ */}
            {activeTab === 'gstr1' && gstr1 && (
              gstr1.totalInvoices === 0 ? (
                <EmptyState label={`No confirmed outward invoices for ${gstr1.period}.`} />
              ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                  <Kpi label="Taxable Turnover" value={formatINR(gstr1.totalTaxableValue)} sub={`${gstr1.totalInvoices} invoices`} />
                  <Kpi label="Central Tax (CGST)" value={formatINR(gstr1.totalCgst)} sub="Intra-state 50%" tone="green" />
                  <Kpi label="State Tax (SGST)" value={formatINR(gstr1.totalSgst)} sub="Intra-state 50%" tone="green" />
                  <Kpi label="Integrated Tax (IGST)" value={formatINR(gstr1.totalIgst)} sub="Inter-state supply" tone="blue" />
                  <Kpi label="Total Tax Liability" value={formatINR(gstr1.totalTax)} sub="GST on outward sales" tone="dark" />
                </div>

                <SectionCard
                  title="Table 4 — Taxable Outward Supplies to Registered Persons (B2B)"
                  subtitle="Invoices issued to clients with a registered GSTIN"
                  count={gstr1.b2bRecords.length}
                >
                  {gstr1.b2bRecords.length === 0 ? (
                    <div className="p-8 text-center text-brown-500 text-sm">
                      No B2B invoices in this period. Unregistered &amp; walk-in sales appear under Table 5/7 (B2C).
                    </div>
                  ) : (
                    <DataTable
                      head={['Buyer GSTIN', 'Receiver', 'Invoice', 'Date', 'Place of Supply', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total']}
                      rightFrom={5}
                      rows={gstr1.b2bRecords.map((r) => [
                        <span className="font-bold text-brown-900">{r.buyerGstin}</span>,
                        <span className="font-sans">{r.buyerName}</span>,
                        <InvoiceLink id={r.invoiceId} label={r.invoiceNumber} navigate={navigate} />,
                        r.invoiceDate,
                        <span className="font-sans flex items-center gap-1.5">{r.placeOfSupply}<StateChip type={r.supplyType} /></span>,
                        formatINR(r.taxableValue),
                        <span className="text-emerald-800">{formatINR(r.cgstAmount)}</span>,
                        <span className="text-emerald-800">{formatINR(r.sgstAmount)}</span>,
                        <span className="text-blue-800">{formatINR(r.igstAmount)}</span>,
                        <span className="font-bold text-brown-900">{formatINR(r.invoiceValue)}</span>,
                      ])}
                    />
                  )}
                </SectionCard>

                <SectionCard
                  title="Table 5 &amp; 7 — Taxable Outward Supplies to Unregistered Persons (B2C)"
                  subtitle="Retail clients, showroom walk-ins and unregistered entities"
                  count={gstr1.b2cRecords.length}
                >
                  {gstr1.b2cRecords.length === 0 ? (
                    <div className="p-8 text-center text-brown-500 text-sm">No B2C invoices in this period.</div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      <DataTable
                        head={['Customer', 'Invoice', 'Date', 'Place of Supply', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total']}
                        rightFrom={4}
                        rows={gstr1.b2cRecords.map((r) => [
                          <span className="font-sans">{r.buyerName}</span>,
                          <InvoiceLink id={r.invoiceId} label={r.invoiceNumber} navigate={navigate} />,
                          r.invoiceDate,
                          <span className="font-sans">{r.placeOfSupply}</span>,
                          formatINR(r.taxableValue),
                          <span className="text-emerald-800">{formatINR(r.cgstAmount)}</span>,
                          <span className="text-emerald-800">{formatINR(r.sgstAmount)}</span>,
                          <span className="text-blue-800">{formatINR(r.igstAmount)}</span>,
                          <span className="font-bold text-brown-900">{formatINR(r.invoiceValue)}</span>,
                        ])}
                      />
                    </div>
                  )}
                </SectionCard>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <SectionCard title="Table 12 — HSN-Wise Summary of Outward Supplies" count={gstr1.hsnSummary.length}>
                    <div className="p-3 space-y-2">
                      {gstr1.hsnSummary.map((h, i) => (
                        <div key={i} className="p-3 bg-brown-50/50 rounded-lg border border-brown-100 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-bold text-sm text-brown-900">HSN {h.hsnCode}</span>
                            <span className="font-mono text-brown-600">Qty {Number(h.totalQty).toLocaleString('en-IN')}</span>
                          </div>
                          <p className="text-brown-700 mt-0.5">{h.description}</p>
                          <div className="grid grid-cols-3 gap-2 pt-2 mt-1 border-t border-brown-200/60 font-mono">
                            <div><span className="text-[10px] text-brown-500 block">Taxable</span><strong>{formatINR(h.taxableValue)}</strong></div>
                            <div><span className="text-[10px] text-brown-500 block">CGST+SGST</span><strong className="text-emerald-800">{formatINR(Number(h.cgstAmount) + Number(h.sgstAmount))}</strong></div>
                            <div><span className="text-[10px] text-brown-500 block">IGST</span><strong className="text-blue-800">{formatINR(h.igstAmount)}</strong></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title="Table 13 — Documents Issued during the Period">
                    <div className="p-3">
                      <div className="p-3 bg-brown-50/50 rounded-lg border border-brown-100 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-brown-900">{gstr1.docSummary.docType}</span>
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">VALID SERIES</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 font-mono">
                          <div><span className="text-[10px] text-brown-500 block">From Serial</span><strong>{gstr1.docSummary.fromSerial}</strong></div>
                          <div><span className="text-[10px] text-brown-500 block">To Serial</span><strong>{gstr1.docSummary.toSerial}</strong></div>
                          <div><span className="text-[10px] text-brown-500 block">Total Issued</span><strong>{gstr1.docSummary.totalCount}</strong></div>
                          <div><span className="text-[10px] text-brown-500 block">Cancelled</span><strong>{gstr1.docSummary.cancelledCount}</strong></div>
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                </div>
              </div>
              )
            )}

            {/* ═══ GSTR-2B ═══ */}
            {activeTab === 'gstr2b' && gstr2b && (
              gstr2b.billCount === 0 ? (
                <EmptyState label={`No confirmed vendor bills for ${gstr2b.period}.`} />
              ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                  <Kpi label="Inward Taxable Value" value={formatINR(gstr2b.totalTaxableValue)} sub={`${gstr2b.billCount} vendor bills`} />
                  <Kpi label="ITC — Central (CGST)" value={formatINR(gstr2b.totalCgst)} tone="green" />
                  <Kpi label="ITC — State (SGST)" value={formatINR(gstr2b.totalSgst)} tone="green" />
                  <Kpi label="ITC — Integrated (IGST)" value={formatINR(gstr2b.totalIgst)} tone="blue" />
                  <Kpi label="Total Eligible ITC" value={formatINR(gstr2b.totalItc)} sub={`${gstr2b.registeredVendorCount} registered vendors`} tone="dark" />
                </div>

                <SectionCard
                  title="Auto-Drafted Inward Supply Statement (from Vendor Bills)"
                  subtitle="ITC is claimable only against vendors with a valid GSTIN — others are listed but excluded from the credit pool"
                  count={gstr2b.records.length}
                >
                  <div className="max-h-[32rem] overflow-y-auto">
                    <DataTable
                      head={['Bill No', 'Date', 'Vendor', 'GSTIN', 'Place of Supply', 'ITC', 'Taxable', 'CGST', 'SGST', 'IGST', 'Bill Value']}
                      rightFrom={6}
                      rows={gstr2b.records.map((r) => [
                        <span className="font-bold text-brown-900">{r.billNumber}</span>,
                        r.billDate,
                        <span className="font-sans">{r.vendorName}</span>,
                        <span className={r.itcEligible ? 'font-bold text-brown-900' : 'text-brown-400'}>{r.vendorGstin}</span>,
                        <span className="font-sans flex items-center gap-1.5">{r.placeOfSupply}<StateChip type={r.supplyType} /></span>,
                        r.itcEligible
                          ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">ELIGIBLE</span>
                          : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brown-100 text-brown-500">BLOCKED</span>,
                        formatINR(r.taxableValue),
                        <span className={r.itcEligible ? 'text-emerald-800' : 'text-brown-400'}>{formatINR(r.cgstAmount)}</span>,
                        <span className={r.itcEligible ? 'text-emerald-800' : 'text-brown-400'}>{formatINR(r.sgstAmount)}</span>,
                        <span className={r.itcEligible ? 'text-blue-800' : 'text-brown-400'}>{formatINR(r.igstAmount)}</span>,
                        <span className="font-bold text-brown-900">{formatINR(r.invoiceValue)}</span>,
                      ])}
                    />
                  </div>
                </SectionCard>
              </div>
              )
            )}

            {/* ═══ GSTR-3B ═══ */}
            {activeTab === 'gstr3b' && gstr3b && (
              <div className="space-y-6">
                <div className="p-5 bg-gradient-to-r from-brown-900 to-stone-900 text-cream rounded-[12px] shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-200">
                      Electronic Cash Ledger Settlement — {gstr3b.period}
                    </span>
                    <h2 className="text-xl font-bold font-display text-white mt-1">Net Tax Payable in Cash (Post-ITC Set-Off)</h2>
                    <p className="text-xs text-amber-100/80 mt-1">
                      Outward tax liability minus eligible Input Tax Credit from inward vendor bills.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 bg-white/10 p-3 rounded-lg border border-white/20">
                    <div>
                      <span className="text-[10px] text-amber-200 uppercase block">Total Cash Outflow</span>
                      <span className="text-2xl font-extrabold font-mono text-white">{formatINR(netCashPayable)}</span>
                    </div>
                    <div className="h-8 w-px bg-white/20" />
                    <div className="text-right text-[11px] font-mono text-emerald-300">
                      <div>CGST {formatINR(gstr3b.netTaxPayable.cgst)}</div>
                      <div>SGST {formatINR(gstr3b.netTaxPayable.sgst)}</div>
                      <div>IGST {formatINR(gstr3b.netTaxPayable.igst)}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ThreeBBlock title="3.1 — Outward Taxable Supplies (Liability)" tag="SALES" tone="amber" table={gstr3b.outwardSupplies} />
                  <ThreeBBlock title="4 — Eligible Input Tax Credit (Offset)" tag="PURCHASES" tone="emerald" table={gstr3b.itcAvailable} />
                </div>

                <SectionCard title="6.1 — Payment of Tax (Net Ledger Offset Computation)">
                  <DataTable
                    head={['Tax Head', 'Gross Outward Tax', 'Eligible ITC Offset', 'Net Payable in Cash']}
                    rightFrom={1}
                    rows={(['igst', 'cgst', 'sgst'] as const).map((h) => [
                      <span className="font-sans font-semibold text-brown-900">{h.toUpperCase()}</span>,
                      formatINR(gstr3b.outwardSupplies[h]),
                      <span className="text-emerald-700">− {formatINR(gstr3b.itcAvailable[h])}</span>,
                      <span className="font-bold text-brown-900">{formatINR(gstr3b.netTaxPayable[h])}</span>,
                    ])}
                  />
                </SectionCard>
              </div>
            )}

            {/* ═══ E-Way ═══ */}
            {activeTab === 'eway' && (
              <SectionCard
                title="Statutory E-Way Bill Consignment Registry (Rule 138)"
                subtitle="Consignments exceeding the ₹50,000 threshold requiring registered transport credentials"
                count={ewayBills.length}
              >
                {ewayBills.length === 0 ? (
                  <div className="p-12 text-center text-brown-500 text-sm">
                    No confirmed invoices above ₹50,000 in {period.label}.
                  </div>
                ) : (
                  <DataTable
                    head={['E-Way Bill', 'Invoice', 'Date', 'Consignee', 'Destination', 'Vehicle / Logistics', 'Valid Until', 'Consignment Value']}
                    rightFrom={7}
                    rows={ewayBills.map((e) => [
                      <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded font-bold text-blue-900">{e.ewayBillNo}</span>,
                      <InvoiceLink id={e.invoiceId} label={e.invoiceNumber} navigate={navigate} />,
                      e.invoiceDate,
                      <span className="font-sans"><strong>{e.customerName}</strong><div className="text-[10px] text-brown-500">{e.customerGstin}</div></span>,
                      <span className="font-sans">{e.destination}</span>,
                      <span><strong>{e.vehicleNo}</strong><div className="text-[10px] text-brown-500 font-sans">{e.transporter}</div></span>,
                      <span className="text-emerald-700 font-bold">{e.validUntil}<span className="block text-[10px] font-normal text-emerald-600">Active (48h)</span></span>,
                      <span className="font-bold text-brown-900">{formatINR(e.totalValue)}</span>,
                    ])}
                  />
                )}
              </SectionCard>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────
   Reusable bits
   ──────────────────────────────────────────────────────────────────────── */

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="p-12 text-center bg-surface border border-brown-200 rounded-[10px]">
    <Layers className="w-8 h-8 text-brown-300 mx-auto" />
    <p className="text-sm text-brown-500 mt-3">{label}</p>
    <p className="text-xs text-brown-400 mt-1">Pick another period from the selector above.</p>
  </div>
);

const SectionCard: React.FC<{ title: string; subtitle?: string; count?: number; children: React.ReactNode }> = ({
  title, subtitle, count, children,
}) => (
  <div className="bg-surface border border-brown-200 rounded-[10px] overflow-hidden shadow-sm">
    <div className="p-4 bg-brown-50/70 border-b border-brown-200 flex items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-bold text-brown-900" dangerouslySetInnerHTML={{ __html: title }} />
        {subtitle && <span className="text-xs text-brown-500">{subtitle}</span>}
      </div>
      {typeof count === 'number' && (
        <span className="text-xs font-bold px-2 py-0.5 bg-brown-200 text-brown-800 rounded shrink-0">{count} entries</span>
      )}
    </div>
    {children}
  </div>
);

const DataTable: React.FC<{ head: string[]; rows: React.ReactNode[][]; rightFrom?: number }> = ({
  head, rows, rightFrom = 999,
}) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-xs border-collapse">
      <thead>
        <tr className="bg-brown-100/50 border-b border-brown-200 text-brown-700 uppercase font-semibold sticky top-0">
          {head.map((h, i) => (
            <th key={i} className={`p-3 ${i >= rightFrom ? 'text-right' : ''}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-brown-100 font-mono">
        {rows.map((cells, ri) => (
          <tr key={ri} className="hover:bg-brown-50/40">
            {cells.map((c, ci) => (
              <td key={ci} className={`p-3 ${ci >= rightFrom ? 'text-right' : ''}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const InvoiceLink: React.FC<{ id: number; label: string; navigate: (p: string) => void }> = ({ id, label, navigate }) => (
  <button type="button" onClick={() => navigate(`/sales/invoices/${id}`)} className="hover:underline font-bold text-brown-900">
    {label}
  </button>
);

const ThreeBBlock: React.FC<{ title: string; tag: string; tone: 'amber' | 'emerald'; table: Gstr3BTable }> = ({
  title, tag, tone, table,
}) => (
  <div className="bg-surface border border-brown-200 rounded-[10px] p-5 shadow-sm space-y-4">
    <div className="flex items-center justify-between pb-3 border-b border-brown-200">
      <h3 className="text-sm font-bold text-brown-900">{title}</h3>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${tone === 'amber' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
        {tag}
      </span>
    </div>
    <div className="space-y-2.5 text-xs font-mono">
      {([
        ['Total Taxable Value', table.taxableValue, ''],
        ['Integrated Tax (IGST)', table.igst, 'text-blue-800'],
        ['Central Tax (CGST)', table.cgst, 'text-emerald-800'],
        ['State Tax (SGST)', table.sgst, 'text-emerald-800'],
      ] as const).map(([label, val, cls]) => (
        <div key={label} className={`flex justify-between p-2 rounded ${tone === 'amber' ? 'bg-brown-50/50' : 'bg-emerald-50/50'}`}>
          <span className="font-sans text-brown-700">{label}</span>
          <strong className={cls}>{formatINR(val)}</strong>
        </div>
      ))}
    </div>
  </div>
);

export default GstReportPage;
