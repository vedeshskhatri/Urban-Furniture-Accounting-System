import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { ListView, Column } from '../../components/ui/ListView';
import { VendorBillsApi } from '../../api/vendorBills.api';
import { VendorBill } from '@shared/schemas/vendorBill.schema';
import { StatusBadge } from '../../components/StatusBadge';
import { Money } from '../../components/Money';
import { formatYAxisINR } from '../../lib/money';
import {
  FileText,
  Building2,
  Mic,
  Sparkles,
  BarChart3,
  PieChart as PieIcon,
  ChevronDown,
  ChevronUp,
  Clock,
  TrendingDown,
} from 'lucide-react';

const VENDOR_PALETTE = [
  '#4A3A34', // Walnut
  '#77574A', // Walnut mid
  '#9E4A38', // Terracotta
  '#C08A3E', // Amber
  '#5F7052', // Olive
  '#A8836C', // Sand
];

interface VendorBillListPageProps {
  onSelectBill: (id: number) => void;
  onNewBill: () => void;
}

export const VendorBillListPage: React.FC<VendorBillListPageProps> = ({ onSelectBill, onNewBill }) => {
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVisualHorizon, setShowVisualHorizon] = useState(true);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const data = await VendorBillsApi.getAll();
      setBills(data);
    } catch (err) {
      console.error('Failed to load vendor bills', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  // Aggregate metrics
  const { totalBilled, totalPaid, totalDue, settlementPct } = useMemo(() => {
    let billed = 0;
    let due = 0;
    for (const b of bills) {
      billed += parseFloat(b.grand_total || b.total_amount || '0');
      due += parseFloat(b.amount_due || '0');
    }
    const paid = Math.max(0, billed - due);
    const pct = billed > 0 ? ((paid / billed) * 100).toFixed(1) : '0.0';
    return {
      totalBilled: billed,
      totalPaid: paid,
      totalDue: due,
      settlementPct: pct,
    };
  }, [bills]);

  // Settlement horizon data
  const horizonChartData = useMemo(() => {
    return [
      {
        name: 'Total Invoiced',
        amount: totalBilled,
        fill: '#4A3A34',
      },
      {
        name: 'Paid & Disbursed',
        amount: totalPaid,
        fill: '#5F7052',
      },
      {
        name: 'Pending Payable',
        amount: totalDue,
        fill: '#9E4A38',
      },
    ];
  }, [totalBilled, totalPaid, totalDue]);

  // Vendor spend allocation donut
  const vendorPieData = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bills) {
      const v = b.vendor_name || 'Vendor';
      map.set(v, (map.get(v) || 0) + parseFloat(b.grand_total || b.total_amount || '0'));
    }
    return Array.from(map.entries())
      .map(([vendor, val]) => ({
        name: vendor,
        value: val,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((item, idx) => ({
        ...item,
        color: VENDOR_PALETTE[idx % VENDOR_PALETTE.length],
      }));
  }, [bills]);

  const columns: Column<VendorBill>[] = [
    {
      key: 'number',
      header: 'Bill No.',
      className: 'font-mono text-xs font-semibold text-brown-700 w-32',
    },
    {
      key: 'bill_reference',
      header: 'Vendor Ref',
      className: 'text-xs text-brown-500 font-mono',
      render: b => b.bill_reference || '—',
    },
    {
      key: 'vendor_name',
      header: 'Vendor',
      render: b => (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-brown-400" />
          <span className="font-semibold text-brown-900">{b.vendor_name}</span>
        </div>
      ),
    },
    {
      key: 'bill_date',
      header: 'Bill Date',
      className: 'text-sm text-brown-600',
    },
    {
      key: 'due_date',
      header: 'Due Date',
      className: 'text-sm text-brown-600',
    },
    {
      key: 'grand_total',
      header: 'Total Amount',
      align: 'right',
      render: b => <Money amount={b.grand_total || b.total_amount} className="font-bold text-brown-900" />,
    },
    {
      key: 'amount_due',
      header: 'Amount Due',
      align: 'right',
      render: b => <Money amount={b.amount_due} className="text-amber-800 font-medium" />,
    },
    {
      key: 'payment_status',
      header: 'Payment',
      align: 'center',
      render: b => <StatusBadge status={b.payment_status} />,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: b => <StatusBadge status={b.status} />,
    },
  ];

  return (
    <div className="w-full flex flex-col gap-4">
      {/* ── Executive Payables Horizon Suite ── */}
      {showVisualHorizon && (
        <div className="bg-surface border border-brown-300/70 rounded-[10px] p-5 shadow-xs flex flex-col gap-4">
          {/* KPI Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-3 border-b border-brown-200">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brown-500">Gross Procurement Outflow</span>
              <span className="text-xl font-bold font-mono text-brown-900 mt-0.5">
                ₹{totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-brown-600">Total {bills.length} vendor bills received</span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brown-500">Settled Disbursements</span>
              <span className="text-xl font-bold font-mono text-posted mt-0.5">
                ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-brown-600">Cleared out of bank accounts</span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brown-500">Outstanding Payables</span>
              <span className="text-xl font-bold font-mono text-danger mt-0.5">
                ₹{totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-brown-600">Pending settlement to suppliers</span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brown-500">Settlement Velocity</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xl font-bold font-mono text-brown-900">{settlementPct}%</span>
                <Clock className="w-4 h-4 text-posted" />
              </div>
              <span className="text-[11px] text-brown-600">Payables fulfillment ratio</span>
            </div>
          </div>

          {/* Recharts Visualizations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
            {/* Chart 1: Payables Settlement Horizon */}
            <div className="bg-brown-50/40 border border-brown-200/80 rounded-[8px] p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-brown-700" />
                  <span className="text-xs font-bold text-brown-900">Payables Settlement Horizon</span>
                </div>
                <span className="text-[11px] font-mono text-brown-600">Procurement Realization</span>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={horizonChartData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#77574A', fontSize: 10 }}
                      axisLine={{ stroke: 'rgba(208, 174, 146, 0.5)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={formatYAxisINR}
                      width={56}
                      tick={{ fill: '#77574A', fontSize: 9, fontFamily: 'monospace' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Amount']}
                      contentStyle={{
                        background: '#FFF',
                        borderRadius: 6,
                        border: '1px solid rgba(208, 174, 146, 0.5)',
                        fontSize: 11,
                        fontFamily: 'monospace',
                      }}
                    />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {horizonChartData.map((entry, index) => (
                        <Cell key={`horizon-cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Vendor Outflow Allocation Donut */}
            <div className="bg-brown-50/40 border border-brown-200/80 rounded-[8px] p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <PieIcon className="w-4 h-4 text-brown-700" />
                  <span className="text-xs font-bold text-brown-900">Top Supplier Outflow Share</span>
                </div>
                <span className="text-[11px] font-mono text-brown-600">Spend Distribution</span>
              </div>

              {vendorPieData.length > 0 ? (
                <div className="flex items-center h-44">
                  <div className="w-1/2 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={vendorPieData}
                          innerRadius={40}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {vendorPieData.map((entry, idx) => (
                            <Cell key={`vendor-cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Billed']}
                          contentStyle={{
                            background: '#FFF',
                            borderRadius: 6,
                            border: '1px solid rgba(208, 174, 146, 0.5)',
                            fontSize: 11,
                            fontFamily: 'monospace',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="w-1/2 flex flex-col gap-1.5 pl-2 overflow-y-auto max-h-40">
                    {vendorPieData.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between gap-1 text-[11px] px-2 py-1 rounded bg-brown-50/60"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="truncate text-brown-800">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono font-semibold text-brown-900">
                            ₹{item.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-brown-500 font-mono hidden sm:inline">
                            ({formatYAxisINR(item.value)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-44 flex items-center justify-center text-xs text-brown-500">
                  No vendor bills recorded.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ListView
        title="Purchase Bill"
        subtitle="Invoices received from vendors impacting accounts payable & stock"
        columns={columns}
        data={bills}
        loading={loading}
        onRowClick={b => b.id && onSelectBill(b.id)}
        onNew={onNewBill}
        extraControls={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowVisualHorizon(prev => !prev)}
              className="inline-flex items-center gap-1.5 bg-surface border border-brown-300 hover:bg-brown-100 text-brown-900 px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-brown-700" />
              <span>{showVisualHorizon ? 'Hide Charts' : 'Show Charts'}</span>
            </button>
            <button
              type="button"
              onClick={onNewBill}
              className="inline-flex items-center gap-1.5 bg-cream border border-brown-300 hover:bg-brown-100 text-brown-900 px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
              title="Create bill via offline voice dictation"
            >
              <Mic className="w-3.5 h-3.5 text-rose-600" />
              <span>Voice Bill</span>
            </button>
            <button
              type="button"
              onClick={onNewBill}
              className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-900 px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
              title="Scan invoice receipt using local OCR / regex"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Scan Receipt</span>
            </button>
          </div>
        }
        includeArchived={false}
        onToggleArchived={() => {}}
      />
    </div>
  );
};

