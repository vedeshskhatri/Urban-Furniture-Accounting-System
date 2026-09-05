import React from 'react';
import Decimal from 'decimal.js';
import { calculateLineTax } from '@shared/schemas/money';

export interface InvoiceGridLine {
  productId: number;
  accountId: number;
  analyticAccountId: number | null;
  qty: string;
  unitPrice: string;
  taxRate: string;
  subtotal?: string;
  taxAmount?: string;
  total?: string;
}

interface InvoiceLineGridProps {
  lines: InvoiceGridLine[];
  products: Array<{
    id: number;
    name: string;
    sku: string;
    sales_price: string;
    cost_price?: string;
    mrp?: string | null;
    tax_rate: string;
  }>;
  accounts: Array<{ id: number; name: string; type: string }>;
  analytics: Array<{ id: number; name: string }>;
  onChange: (lines: InvoiceGridLine[]) => void;
  disabled?: boolean;
}

export const InvoiceLineGrid: React.FC<InvoiceLineGridProps> = ({
  lines,
  products,
  accounts,
  analytics,
  onChange,
  disabled = false,
}) => {
  const defaultIncomeAccount = accounts.find(a => a.name === 'Sales Income' || a.type === 'income');

  const handleLineChange = (index: number, field: keyof InvoiceGridLine, value: any) => {
    const updated = [...lines];
    const current = { ...updated[index], [field]: value };

    if (field === 'productId') {
      const prod = products.find(p => p.id === Number(value));
      if (prod) {
        current.unitPrice = String(prod.sales_price || '0.00');
        current.taxRate = String(prod.tax_rate || '18.00');
      }
    }

    const calcs = calculateLineTax(current.qty || '1', current.unitPrice || '0.00', current.taxRate || '18.00');
    current.subtotal = calcs.subtotal;
    current.taxAmount = calcs.taxAmount;
    current.total = calcs.total;

    updated[index] = current;
    onChange(updated);
  };

  const addRow = () => {
    if (disabled) return;
    const defaultProduct = products[0];
    const unitPrice = defaultProduct ? String(defaultProduct.sales_price) : '0.00';
    const taxRate = defaultProduct ? String(defaultProduct.tax_rate) : '18.00';
    const calcs = calculateLineTax('1', unitPrice, taxRate);

    onChange([
      ...lines,
      {
        productId: defaultProduct ? defaultProduct.id : 0,
        accountId: defaultIncomeAccount ? defaultIncomeAccount.id : 6,
        analyticAccountId: null,
        qty: '1',
        unitPrice,
        taxRate,
        subtotal: calcs.subtotal,
        taxAmount: calcs.taxAmount,
        total: calcs.total,
      },
    ]);
  };

  const removeRow = (index: number) => {
    if (disabled || lines.length <= 1) return;
    onChange(lines.filter((_, i) => i !== index));
  };

  // Grand totals
  const grandSubtotal = lines.reduce((acc, l) => acc.plus(l.subtotal || '0'), new Decimal(0)).toFixed(2);
  const grandTax = lines.reduce((acc, l) => acc.plus(l.taxAmount || '0'), new Decimal(0)).toFixed(2);
  const grandTotal = lines.reduce((acc, l) => acc.plus(l.total || '0'), new Decimal(0)).toFixed(2);

  return (
    <div className="bg-surface border border-brown-300 rounded-[12px] p-6 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-brown-300 bg-brown-100/60 text-brown-900 font-semibold text-xs uppercase tracking-wider">
              <th className="py-3 px-3 w-12 text-center">#</th>
              <th className="py-3 px-3 min-w-[280px]">Product *</th>
              <th className="py-3 px-3 min-w-[230px]">Chart of Account *</th>
              <th className="py-3 px-3 min-w-[200px]">Budget Analytics</th>
              <th className="py-3 px-3 w-28 min-w-[90px] text-center">Qty *</th>
              <th className="py-3 px-3 w-48 min-w-[170px] text-right">Unit Price *</th>
              <th className="py-3 px-3 w-28 min-w-[100px] text-center">Tax (%)</th>
              <th className="py-3 px-3 w-36 min-w-[130px] text-right font-mono-num">Line Total</th>
              {!disabled && <th className="py-3 px-2 w-10 text-center"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-brown-100">
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-brown-50/50 transition-colors">
                <td className="py-3.5 px-3 text-center text-brown-500 font-mono text-xs select-none">
                  {idx + 1}
                </td>
                <td className="py-3.5 px-3">
                  <select
                    disabled={disabled}
                    value={line.productId}
                    onChange={e => handleLineChange(idx, 'productId', Number(e.target.value))}
                    className="w-full bg-surface border border-brown-300 rounded-[8px] px-3 py-2 text-brown-900 focus:ring-2 focus:ring-brown-700 focus:border-brown-700 outline-none text-sm transition-shadow disabled:bg-brown-50/50"
                  >
                    <option value={0} disabled>Select product...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-3.5 px-3">
                  <select
                    disabled={disabled}
                    value={line.accountId}
                    onChange={e => handleLineChange(idx, 'accountId', Number(e.target.value))}
                    className="w-full bg-surface border border-brown-300 rounded-[8px] px-3 py-2 text-brown-900 focus:ring-2 focus:ring-brown-700 focus:border-brown-700 outline-none text-sm transition-shadow disabled:bg-brown-50/50"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-3.5 px-3">
                  <select
                    disabled={disabled}
                    value={line.analyticAccountId || ''}
                    onChange={e => handleLineChange(idx, 'analyticAccountId', e.target.value ? Number(e.target.value) : null)}
                    className="w-full bg-surface border border-brown-300 rounded-[8px] px-3 py-2 text-brown-900 focus:ring-2 focus:ring-brown-700 focus:border-brown-700 outline-none text-sm transition-shadow disabled:bg-brown-50/50"
                  >
                    <option value="">No Analytic Distribution</option>
                    {analytics.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-3.5 px-3">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    disabled={disabled}
                    value={line.qty}
                    onChange={e => handleLineChange(idx, 'qty', e.target.value)}
                    className="w-full text-center bg-surface border border-brown-300 rounded-[8px] px-2.5 py-2 text-brown-900 font-mono focus:ring-2 focus:ring-brown-700 focus:border-brown-700 outline-none text-sm transition-shadow disabled:bg-brown-50/50"
                  />
                </td>
                <td className="py-3.5 px-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brown-500 text-xs font-mono select-none pointer-events-none">
                      ₹
                    </span>
                    <input
                      type="text"
                      disabled={disabled}
                      value={line.unitPrice}
                      onChange={e => handleLineChange(idx, 'unitPrice', e.target.value)}
                      className="w-full text-right pl-7 pr-3 bg-surface border border-brown-300 rounded-[8px] py-2 text-brown-900 font-mono focus:ring-2 focus:ring-brown-700 focus:border-brown-700 outline-none text-sm transition-shadow disabled:bg-brown-50/50"
                    />
                  </div>
                  {(() => {
                    const p = products.find(prod => prod.id === line.productId);
                    if (!p) return null;
                    const uPrice = new Decimal(line.unitPrice || '0');
                    const pMrp = p.mrp ? new Decimal(p.mrp) : null;
                    const pCost = p.cost_price ? new Decimal(p.cost_price) : null;
                    const isOverMrp = pMrp && pMrp.greaterThan(0) && uPrice.greaterThan(pMrp);
                    const lineProfit = pCost && pCost.greaterThan(0) ? uPrice.minus(pCost).times(new Decimal(line.qty || '1')) : null;

                    return (
                      <div className="space-y-1 mt-1.5 flex flex-col items-end">
                        {isOverMrp && (
                          <span className="text-[10px] font-semibold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 inline-block whitespace-nowrap shadow-2xs">
                            ⚠️ Exceeds MRP (₹{p.mrp})
                          </span>
                        )}
                        {lineProfit && (
                          <span className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-full border inline-block whitespace-nowrap shadow-2xs ${
                            lineProfit.greaterThanOrEqualTo(0)
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : 'text-rose-700 bg-rose-50 border-rose-200 font-semibold'
                          }`}>
                            {lineProfit.greaterThanOrEqualTo(0) ? 'Profit: +₹' : 'Loss: -₹'}{lineProfit.abs().toFixed(2)}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </td>
                <td className="py-3.5 px-3">
                  <select
                    disabled={disabled}
                    value={line.taxRate}
                    onChange={e => handleLineChange(idx, 'taxRate', e.target.value)}
                    className="w-full text-center bg-surface border border-brown-300 rounded-[8px] px-2 py-2 text-brown-900 font-mono text-sm focus:ring-2 focus:ring-brown-700 focus:border-brown-700 outline-none transition-shadow disabled:bg-brown-50/50"
                  >
                    <option value="0.00">0%</option>
                    <option value="5.00">5%</option>
                    <option value="12.00">12%</option>
                    <option value="18.00">18%</option>
                    <option value="28.00">28%</option>
                  </select>
                </td>
                <td className="py-3.5 px-3 text-right font-mono font-bold text-brown-900 text-sm whitespace-nowrap">
                  ₹{line.total || '0.00'}
                </td>
                {!disabled && (
                  <td className="py-3.5 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      disabled={lines.length <= 1}
                      title="Remove line"
                      className="p-1 rounded-md text-brown-400 hover:text-danger hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-brown-400 disabled:cursor-not-allowed transition-colors text-sm font-bold"
                    >
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!disabled && (
        <div className="mt-4">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-brown-900 bg-brown-100/80 hover:bg-brown-200 border border-brown-300/80 rounded-[8px] transition-colors shadow-2xs"
          >
            <span>+</span>
            <span>Add Line Item</span>
          </button>
        </div>
      )}

      {/* Footer Calculation & Gross Margin Breakdown */}
      {(() => {
        let totalCogs = new Decimal(0);
        lines.forEach(l => {
          const p = products.find(prod => prod.id === l.productId);
          if (p && p.cost_price) {
            totalCogs = totalCogs.plus(new Decimal(p.cost_price).times(new Decimal(l.qty || '1')));
          }
        });
        const grandProfit = new Decimal(grandSubtotal).minus(totalCogs);
        const marginPct = new Decimal(grandSubtotal).greaterThan(0)
          ? grandProfit.dividedBy(new Decimal(grandSubtotal)).times(100).toFixed(1)
          : '0.0';

        return (
          <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="p-3.5 bg-cream/60 rounded-[8px] border border-brown-200 text-xs space-y-1">
              <div className="font-bold text-brown-900 flex items-center gap-1.5">
                <span>📊 Estimated Gross Margin:</span>
                <span className={`font-mono font-bold ${grandProfit.greaterThanOrEqualTo(0) ? 'text-emerald-700' : 'text-rose-700'}`}>
                  ₹{grandProfit.toFixed(2)} ({marginPct}%)
                </span>
              </div>
              <div className="text-brown-600">
                Total COGS (Cost Basis): <span className="font-mono text-brown-800 font-semibold">₹{totalCogs.toFixed(2)}</span>
              </div>
            </div>

            <div className="w-72 bg-brown-50 p-4 rounded-[8px] border border-brown-200 space-y-2 text-sm">
              <div className="flex justify-between text-brown-700">
                <span>Subtotal:</span>
                <span className="font-mono">₹{grandSubtotal}</span>
              </div>
              <div className="flex justify-between text-brown-700">
                <span>GST Tax:</span>
                <span className="font-mono">₹{grandTax}</span>
              </div>
              <div className="pt-2 border-t border-brown-300 flex justify-between font-bold text-brown-900 text-base">
                <span>Total:</span>
                <span className="font-mono">₹{grandTotal}</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
