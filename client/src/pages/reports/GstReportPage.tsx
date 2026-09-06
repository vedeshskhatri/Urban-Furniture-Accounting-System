import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Printer,
  Download,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  Truck,
  CheckCircle2,
  Calendar,
  Building2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Receipt,
  Layers,
} from 'lucide-react';
import { formatINR } from '../../lib/money';

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
    invoiceId: number;
    invoiceNumber: string;
    invoiceDate: string;
    buyerGstin: string;
    buyerName: string;
    placeOfSupply: string;
    supplyType: string;
    invoiceValue: string;
    taxableValue: string;
    cgstAmount: string;
    sgstAmount: string;
    igstAmount: string;
  }>;
  b2cRecords: Array<{
    invoiceId: number;
    invoiceNumber: string;
    invoiceDate: string;
    buyerName: string;
    placeOfSupply: string;
    invoiceValue: string;
    taxableValue: string;
    cgstAmount: string;
    sgstAmount: string;
    igstAmount: string;
  }>;
  hsnSummary: Array<{
    hsnCode: string;
    description: string;
    totalQty: string;
    taxableValue: string;
    cgstAmount: string;
    sgstAmount: string;
    igstAmount: string;
    totalTax: string;
  }>;
  docSummary: {
    docType: string;
    fromSerial: string;
    toSerial: string;
    totalCount: number;
    cancelledCount: number;
    netIssued: number;
  };
}

interface Gstr3BData {
  period: string;
  sellerGstin: string;
  sellerName: string;
  outwardSupplies: {
    taxableValue: string;
    igst: string;
    cgst: string;
    sgst: string;
    cess: string;
  };
  itcAvailable: {
    taxableValue: string;
    igst: string;
    cgst: string;
    sgst: string;
    cess: string;
  };
  netTaxPayable: {
    taxableValue: string;
    igst: string;
    cgst: string;
    sgst: string;
    cess: string;
  };
}

interface EWayBillRecord {
  invoiceId: number;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerGstin: string;
  destination: string;
  totalValue: string;
  ewayBillNo: string;
  validUntil: string;
  status: string;
  vehicleNo: string;
  transporter: string;
}

export const GstReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'gstr1' | 'gstr3b' | 'eway'>('gstr1');
  const [loading, setLoading] = useState<boolean>(true);
  const [gstr1, setGstr1] = useState<Gstr1Data | null>(null);
  const [gstr3b, setGstr3b] = useState<Gstr3BData | null>(null);
  const [ewayBills, setEwayBills] = useState<EWayBillRecord[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res1, res3b, resEwb] = await Promise.all([
        fetch('/api/gst/gstr-1').then(r => r.json()),
        fetch('/api/gst/gstr-3b').then(r => r.json()),
        fetch('/api/gst/eway-bills').then(r => r.json()),
      ]);

      if (res1.data) setGstr1(res1.data);
      if (res3b.data) setGstr3b(res3b.data);
      if (resEwb.data) setEwayBills(resEwb.data);
    } catch (err) {
      console.error('Failed to load GST data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!gstr1) return;
    let csv = 'Type,Invoice No,Date,Party,GSTIN,Place of Supply,Taxable Value,CGST,SGST,IGST,Total Value\n';
    
    // Add B2B
    gstr1.b2bRecords.forEach(r => {
      csv += `B2B,"${r.invoiceNumber}","${r.invoiceDate}","${r.buyerName}","${r.buyerGstin}","${r.placeOfSupply}",${r.taxableValue},${r.cgstAmount},${r.sgstAmount},${r.igstAmount},${r.invoiceValue}\n`;
    });

    // Add B2C
    gstr1.b2cRecords.forEach(r => {
      csv += `B2C,"${r.invoiceNumber}","${r.invoiceDate}","${r.buyerName}","URP-CONSUMER","${r.placeOfSupply}",${r.taxableValue},${r.cgstAmount},${r.sgstAmount},${r.igstAmount},${r.invoiceValue}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GSTR1_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20">
      {/* Print Controls / Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brown-200">
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

        <div className="flex items-center gap-2.5 no-print">
          <button
            type="button"
            onClick={loadData}
            className="p-2 border border-brown-300 rounded-lg text-brown-700 hover:bg-brown-100 transition shadow-sm cursor-pointer"
            title="Refresh Data"
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

      {/* Tab Navigation */}
      <div className="flex border-b border-brown-200 mt-6 no-print gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('gstr1')}
          className={`px-5 py-2.5 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'gstr1'
              ? 'border-brown-900 text-brown-900 bg-brown-50/50'
              : 'border-transparent text-brown-600 hover:text-brown-900'
          }`}
        >
          <Receipt className="w-4 h-4" />
          GSTR-1 (Outward Supplies)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gstr3b')}
          className={`px-5 py-2.5 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'gstr3b'
              ? 'border-brown-900 text-brown-900 bg-brown-50/50'
              : 'border-transparent text-brown-600 hover:text-brown-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          GSTR-3B (Monthly Summary &amp; Net Tax)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('eway')}
          className={`px-5 py-2.5 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'eway'
              ? 'border-brown-900 text-brown-900 bg-brown-50/50'
              : 'border-transparent text-brown-600 hover:text-brown-900'
          }`}
        >
          <Truck className="w-4 h-4" />
          E-Way Bill Registry ({ewayBills.length})
        </button>
      </div>

      {/* Printable Sheet Container */}
      <div className="printable-sheet mt-6">
        {/* ========================================================= */}
        {/* TAB 1: GSTR-1 (OUTWARD SUPPLIES) */}
        {/* ========================================================= */}
        {activeTab === 'gstr1' && gstr1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* KPI Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
              <div className="p-4 bg-surface border border-brown-200 rounded-[10px] shadow-sm">
                <span className="text-[11px] font-semibold text-brown-500 uppercase tracking-wider block">
                  Taxable Turnover
                </span>
                <span className="text-base font-bold font-mono text-brown-900 mt-1 block">
                  ₹{Number(gstr1.totalTaxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-brown-500 mt-0.5 block">{gstr1.totalInvoices} Confirmed Invoices</span>
              </div>

              <div className="p-4 bg-surface border border-brown-200 rounded-[10px] shadow-sm">
                <span className="text-[11px] font-semibold text-brown-500 uppercase tracking-wider block">
                  Central Tax (CGST)
                </span>
                <span className="text-base font-bold font-mono text-emerald-800 mt-1 block">
                  ₹{Number(gstr1.totalCgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-emerald-700 mt-0.5 block">50% Intra-State Rate</span>
              </div>

              <div className="p-4 bg-surface border border-brown-200 rounded-[10px] shadow-sm">
                <span className="text-[11px] font-semibold text-brown-500 uppercase tracking-wider block">
                  State Tax (SGST)
                </span>
                <span className="text-base font-bold font-mono text-emerald-800 mt-1 block">
                  ₹{Number(gstr1.totalSgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-emerald-700 mt-0.5 block">50% Intra-State Rate</span>
              </div>

              <div className="p-4 bg-surface border border-brown-200 rounded-[10px] shadow-sm">
                <span className="text-[11px] font-semibold text-brown-500 uppercase tracking-wider block">
                  Integrated Tax (IGST)
                </span>
                <span className="text-base font-bold font-mono text-blue-800 mt-1 block">
                  ₹{Number(gstr1.totalIgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-blue-700 mt-0.5 block">Inter-State Supply</span>
              </div>

              <div className="p-4 bg-brown-900 text-cream rounded-[10px] shadow-sm">
                <span className="text-[11px] font-semibold text-amber-200 uppercase tracking-wider block">
                  Total Tax Liability
                </span>
                <span className="text-base font-bold font-mono text-white mt-1 block">
                  ₹{Number(gstr1.totalTax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-amber-200/80 mt-0.5 block">Total GST on Outward Sales</span>
              </div>
            </div>

            {/* Table 4: B2B Invoices */}
            <div className="bg-surface border border-brown-200 rounded-[10px] overflow-hidden shadow-sm">
              <div className="p-4 bg-brown-50/70 border-b border-brown-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-brown-900">
                    Table 4: Taxable Outward Supplies made to Registered Persons (B2B)
                  </h3>
                  <span className="text-xs text-brown-500">Invoices issued to clients with registered GSTIN</span>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 bg-brown-200 text-brown-800 rounded">
                  {gstr1.b2bRecords.length} Entries
                </span>
              </div>

              {gstr1.b2bRecords.length === 0 ? (
                <div className="p-8 text-center text-brown-500 text-sm">
                  No B2B invoices recorded yet with a registered GSTIN. All walk-in and unregistered sales appear under Table 5/7 (B2C).
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-brown-100/50 border-b border-brown-200 text-brown-700 uppercase font-semibold">
                        <th className="p-3">Buyer GSTIN</th>
                        <th className="p-3">Receiver Name</th>
                        <th className="p-3">Invoice No</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Place of Supply</th>
                        <th className="p-3 text-right">Taxable Val</th>
                        <th className="p-3 text-right">CGST</th>
                        <th className="p-3 text-right">SGST</th>
                        <th className="p-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brown-100 font-mono">
                      {gstr1.b2bRecords.map((r, i) => (
                        <tr key={i} className="hover:bg-brown-50/40">
                          <td className="p-3 font-bold text-brown-900">{r.buyerGstin}</td>
                          <td className="p-3 font-sans text-brown-800">{r.buyerName}</td>
                          <td className="p-3 font-bold text-brown-900">
                            <button
                              type="button"
                              onClick={() => navigate(`/sales/invoices/${r.invoiceId}`)}
                              className="hover:underline text-brown-900"
                            >
                              {r.invoiceNumber}
                            </button>
                          </td>
                          <td className="p-3 text-brown-600">{r.invoiceDate}</td>
                          <td className="p-3 font-sans text-brown-600">{r.placeOfSupply}</td>
                          <td className="p-3 text-right">₹{Number(r.taxableValue).toFixed(2)}</td>
                          <td className="p-3 text-right text-emerald-800">₹{Number(r.cgstAmount).toFixed(2)}</td>
                          <td className="p-3 text-right text-emerald-800">₹{Number(r.sgstAmount).toFixed(2)}</td>
                          <td className="p-3 text-right font-bold text-brown-900">₹{Number(r.invoiceValue).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Table 5 & 7: B2C Supplies */}
            <div className="bg-surface border border-brown-200 rounded-[10px] overflow-hidden shadow-sm">
              <div className="p-4 bg-brown-50/70 border-b border-brown-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-brown-900">
                    Table 5 &amp; 7: Taxable Outward Supplies to Unregistered Persons (B2C)
                  </h3>
                  <span className="text-xs text-brown-500">Retail clients, showroom walk-ins and unregistered entities</span>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 bg-brown-200 text-brown-800 rounded">
                  {gstr1.b2cRecords.length} Entries
                </span>
              </div>

              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-brown-100/50 border-b border-brown-200 text-brown-700 uppercase font-semibold sticky top-0 bg-white">
                      <th className="p-3">Customer</th>
                      <th className="p-3">Invoice No</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Place of Supply</th>
                      <th className="p-3 text-right">Taxable Val</th>
                      <th className="p-3 text-right">CGST</th>
                      <th className="p-3 text-right">SGST</th>
                      <th className="p-3 text-right">Total Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brown-100 font-mono">
                    {gstr1.b2cRecords.map((r, i) => (
                      <tr key={i} className="hover:bg-brown-50/40">
                        <td className="p-3 font-sans text-brown-800">{r.buyerName}</td>
                        <td className="p-3 font-bold text-brown-900">
                          <button
                            type="button"
                            onClick={() => navigate(`/sales/invoices/${r.invoiceId}`)}
                            className="hover:underline text-brown-900"
                          >
                            {r.invoiceNumber}
                          </button>
                        </td>
                        <td className="p-3 text-brown-600">{r.invoiceDate}</td>
                        <td className="p-3 font-sans text-brown-600">{r.placeOfSupply}</td>
                        <td className="p-3 text-right">₹{Number(r.taxableValue).toFixed(2)}</td>
                        <td className="p-3 text-right text-emerald-800">₹{Number(r.cgstAmount).toFixed(2)}</td>
                        <td className="p-3 text-right text-emerald-800">₹{Number(r.sgstAmount).toFixed(2)}</td>
                        <td className="p-3 text-right font-bold text-brown-900">₹{Number(r.invoiceValue).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 12: HSN Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface border border-brown-200 rounded-[10px] p-4 shadow-sm">
                <h3 className="text-sm font-bold text-brown-900 mb-2">
                  Table 12: HSN-Wise Summary of Outward Supplies
                </h3>
                {gstr1.hsnSummary.map((hsn, i) => (
                  <div key={i} className="p-3 bg-brown-50/50 rounded-lg border border-brown-100 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-sm text-brown-900">HSN {hsn.hsnCode}</span>
                      <span className="font-mono text-brown-600">Total Qty: {hsn.totalQty} Units</span>
                    </div>
                    <p className="text-brown-700">{hsn.description}</p>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-brown-200/60 font-mono">
                      <div>
                        <span className="text-[10px] text-brown-500 block">Taxable</span>
                        <strong>₹{Number(hsn.taxableValue).toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-brown-500 block">CGST+SGST</span>
                        <strong className="text-emerald-800">
                          ₹{(Number(hsn.cgstAmount) + Number(hsn.sgstAmount)).toFixed(2)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-brown-500 block">Total Tax</span>
                        <strong className="text-brown-900">₹{Number(hsn.totalTax).toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Table 13: Documents Summary */}
              <div className="bg-surface border border-brown-200 rounded-[10px] p-4 shadow-sm">
                <h3 className="text-sm font-bold text-brown-900 mb-2">
                  Table 13: Documents Issued during the Period
                </h3>
                <div className="p-3 bg-brown-50/50 rounded-lg border border-brown-100 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-brown-900">{gstr1.docSummary.docType}</span>
                    <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[10px]">
                      VALID
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 font-mono">
                    <div>
                      <span className="text-[10px] text-brown-500 block">From Serial No</span>
                      <strong>{gstr1.docSummary.fromSerial}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-brown-500 block">To Serial No</span>
                      <strong>{gstr1.docSummary.toSerial}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-brown-500 block">Total Issued</span>
                      <strong>{gstr1.docSummary.totalCount} Documents</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-brown-500 block">Cancelled</span>
                      <strong>{gstr1.docSummary.cancelledCount}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: GSTR-3B (MONTHLY RETURN & NET TAX) */}
        {/* ========================================================= */}
        {activeTab === 'gstr3b' && gstr3b && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Net Tax Liability Banner */}
            <div className="p-5 bg-gradient-to-r from-brown-900 to-stone-900 text-cream rounded-[12px] shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-200">
                  Government Electronic Cash Ledger Settlement
                </span>
                <h2 className="text-xl font-bold font-display text-white mt-1">
                  Net Tax Payable in Cash (Post ITC Set-Off)
                </h2>
                <p className="text-xs text-amber-100/80 mt-1">
                  Computed by subtracting Eligible ITC (Inward Vendor Bills) from Total Outward Sales Tax Liability.
                </p>
              </div>

              <div className="flex items-center gap-4 bg-white/10 p-3 rounded-lg border border-white/20">
                <div>
                  <span className="text-[10px] text-amber-200 uppercase block">Total Cash Outflow</span>
                  <span className="text-2xl font-extrabold font-mono text-white">
                    ₹{(
                      Number(gstr3b.netTaxPayable.cgst) +
                      Number(gstr3b.netTaxPayable.sgst) +
                      Number(gstr3b.netTaxPayable.igst)
                    ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="h-8 w-px bg-white/20" />
                <div className="text-right text-xs">
                  <div className="text-emerald-300 font-mono">CGST: ₹{Number(gstr3b.netTaxPayable.cgst).toFixed(2)}</div>
                  <div className="text-emerald-300 font-mono">SGST: ₹{Number(gstr3b.netTaxPayable.sgst).toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Section 3.1 & Section 4 Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Section 3.1: Outward Supplies */}
              <div className="bg-surface border border-brown-200 rounded-[10px] p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-brown-200">
                  <h3 className="text-sm font-bold text-brown-900">
                    3.1 Outward Taxable Supplies (Liability)
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                    SALES
                  </span>
                </div>

                <div className="space-y-2.5 text-xs font-mono">
                  <div className="flex justify-between p-2 bg-brown-50/50 rounded">
                    <span className="font-sans text-brown-700">Total Taxable Value</span>
                    <strong>₹{Number(gstr3b.outwardSupplies.taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-brown-50/50 rounded">
                    <span className="font-sans text-brown-700">Integrated Tax (IGST)</span>
                    <strong className="text-blue-800">₹{Number(gstr3b.outwardSupplies.igst).toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-brown-50/50 rounded">
                    <span className="font-sans text-brown-700">Central Tax (CGST)</span>
                    <strong className="text-emerald-800">₹{Number(gstr3b.outwardSupplies.cgst).toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-brown-50/50 rounded">
                    <span className="font-sans text-brown-700">State Tax (SGST)</span>
                    <strong className="text-emerald-800">₹{Number(gstr3b.outwardSupplies.sgst).toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* Section 4: Eligible ITC */}
              <div className="bg-surface border border-brown-200 rounded-[10px] p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-brown-200">
                  <h3 className="text-sm font-bold text-brown-900">
                    4. Eligible Input Tax Credit (ITC Offset)
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                    PURCHASES
                  </span>
                </div>

                <div className="space-y-2.5 text-xs font-mono">
                  <div className="flex justify-between p-2 bg-emerald-50/50 rounded">
                    <span className="font-sans text-brown-700">Taxable Inward Purchases</span>
                    <strong>₹{Number(gstr3b.itcAvailable.taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-emerald-50/50 rounded">
                    <span className="font-sans text-brown-700">Available ITC (IGST)</span>
                    <strong className="text-blue-800">₹{Number(gstr3b.itcAvailable.igst).toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-emerald-50/50 rounded">
                    <span className="font-sans text-brown-700">Available ITC (CGST)</span>
                    <strong className="text-emerald-800">₹{Number(gstr3b.itcAvailable.cgst).toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between p-2 bg-emerald-50/50 rounded">
                    <span className="font-sans text-brown-700">Available ITC (SGST)</span>
                    <strong className="text-emerald-800">₹{Number(gstr3b.itcAvailable.sgst).toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 6.1: Net Tax Breakdown Table */}
            <div className="bg-surface border border-brown-200 rounded-[10px] overflow-hidden shadow-sm">
              <div className="p-4 bg-brown-50/70 border-b border-brown-200">
                <h3 className="text-sm font-bold text-brown-900">
                  6.1 Payment of Tax (Net Ledger Offset Computation)
                </h3>
              </div>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-brown-100/50 border-b border-brown-200 text-brown-700 uppercase font-semibold">
                    <th className="p-3">Tax Head</th>
                    <th className="p-3 text-right">Gross Outward Tax</th>
                    <th className="p-3 text-right">Eligible ITC Offset</th>
                    <th className="p-3 text-right font-bold text-brown-900">Net Tax Payable in Cash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brown-100 font-mono">
                  <tr>
                    <td className="p-3 font-sans font-semibold text-brown-900">Integrated Tax (IGST)</td>
                    <td className="p-3 text-right">₹{Number(gstr3b.outwardSupplies.igst).toFixed(2)}</td>
                    <td className="p-3 text-right text-emerald-700">- ₹{Number(gstr3b.itcAvailable.igst).toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-brown-900">₹{Number(gstr3b.netTaxPayable.igst).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-sans font-semibold text-brown-900">Central Tax (CGST)</td>
                    <td className="p-3 text-right">₹{Number(gstr3b.outwardSupplies.cgst).toFixed(2)}</td>
                    <td className="p-3 text-right text-emerald-700">- ₹{Number(gstr3b.itcAvailable.cgst).toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-brown-900">₹{Number(gstr3b.netTaxPayable.cgst).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-sans font-semibold text-brown-900">State Tax (SGST)</td>
                    <td className="p-3 text-right">₹{Number(gstr3b.outwardSupplies.sgst).toFixed(2)}</td>
                    <td className="p-3 text-right text-emerald-700">- ₹{Number(gstr3b.itcAvailable.sgst).toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-brown-900">₹{Number(gstr3b.netTaxPayable.sgst).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: E-WAY BILL REGISTRY */}
        {/* ========================================================= */}
        {activeTab === 'eway' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-surface border border-brown-200 rounded-[10px] overflow-hidden shadow-sm">
              <div className="p-4 bg-brown-50/70 border-b border-brown-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-brown-900">
                    Statutory E-Way Bill Consignment Registry (Rule 138)
                  </h3>
                  <span className="text-xs text-brown-500">
                    Consignments exceeding ₹50,000 threshold requiring registered transport credentials
                  </span>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-900 rounded border border-blue-200">
                  {ewayBills.length} Active Shipments
                </span>
              </div>

              {ewayBills.length === 0 ? (
                <div className="p-12 text-center text-brown-500 text-sm">
                  No confirmed invoices exceeding the statutory ₹50,000 threshold.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-brown-100/50 border-b border-brown-200 text-brown-700 uppercase font-semibold">
                        <th className="p-3">E-Way Bill No</th>
                        <th className="p-3">Invoice No</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Consignee</th>
                        <th className="p-3">Destination</th>
                        <th className="p-3">Vehicle / Logistics</th>
                        <th className="p-3">Valid Until</th>
                        <th className="p-3 text-right">Consignment Val</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brown-100 font-mono">
                      {ewayBills.map((ewb, i) => (
                        <tr key={i} className="hover:bg-brown-50/40">
                          <td className="p-3 font-bold text-blue-900">
                            <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded">
                              {ewb.ewayBillNo}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-brown-900">
                            <button
                              type="button"
                              onClick={() => navigate(`/sales/invoices/${ewb.invoiceId}`)}
                              className="hover:underline text-brown-900"
                            >
                              {ewb.invoiceNumber}
                            </button>
                          </td>
                          <td className="p-3 text-brown-600">{ewb.invoiceDate}</td>
                          <td className="p-3 font-sans text-brown-800">
                            <strong>{ewb.customerName}</strong>
                            <div className="text-[10px] text-brown-500 font-mono">{ewb.customerGstin}</div>
                          </td>
                          <td className="p-3 font-sans text-brown-600">{ewb.destination}</td>
                          <td className="p-3 text-brown-700">
                            <span className="font-bold">{ewb.vehicleNo}</span>
                            <div className="text-[10px] text-brown-500 font-sans">{ewb.transporter}</div>
                          </td>
                          <td className="p-3 text-emerald-700 font-bold">
                            {ewb.validUntil}
                            <span className="block text-[10px] text-emerald-600 font-normal">Active (48h)</span>
                          </td>
                          <td className="p-3 text-right font-bold text-brown-900 text-sm">
                            ₹{Number(ewb.totalValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-center">
                            <a
                              href={`/api/invoices/${ewb.invoiceId}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-surface border border-brown-300 rounded text-brown-700 hover:bg-brown-100 text-[11px] font-sans inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3 h-3" />
                              Pass
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GstReportPage;
