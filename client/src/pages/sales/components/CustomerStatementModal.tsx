import React, { useState, useEffect } from 'react';

export interface StatementLineItem {
  id: number;
  date: string;
  type: 'invoice' | 'payment';
  ref: string;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface CustomerStatement {
  customerId: number;
  customerName: string;
  customerEmail: string | null;
  customerMobile: string | null;
  totalInvoiced: string;
  totalPaid: string;
  currentBalance: string;
  lines: StatementLineItem[];
}

interface CustomerStatementModalProps {
  customerId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerStatementModal: React.FC<CustomerStatementModalProps> = ({
  customerId,
  isOpen,
  onClose,
}) => {
  const [statement, setStatement] = useState<CustomerStatement | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !customerId) {
      setStatement(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetch(`/api/receivables/statements/${customerId}`)
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          setStatement(json.data);
        } else if (json.error) {
          setError(json.error.message);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [isOpen, customerId]);

  const handlePrintStatement = () => {
    if (!statement) return;

    const rowsHtml = statement.lines
      .map(
        (l) => `
      <tr>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E5DFD7; font-family: monospace; font-size: 12px;">${l.date}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E5DFD7;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; background: ${
            l.type === 'invoice' ? '#F2ECE4' : '#E6F4EA'
          }; color: ${l.type === 'invoice' ? '#5C453A' : '#137333'};">
            ${l.type}
          </span>
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E5DFD7; font-family: monospace; font-weight: 600; font-size: 12px;">${l.ref}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E5DFD7; font-size: 12px; color: #574F45;">${l.description || '-'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E5DFD7; text-align: right; font-family: monospace; font-size: 12px;">${
          l.debit !== '0.00' ? `₹${l.debit}` : '—'
        }</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E5DFD7; text-align: right; font-family: monospace; font-size: 12px; color: #137333;">${
          l.credit !== '0.00' ? `₹${l.credit}` : '—'
        }</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #E5DFD7; text-align: right; font-family: monospace; font-weight: 700; font-size: 12px;">₹${
          l.runningBalance
        }</td>
      </tr>
    `
      )
      .join('');

    const html = `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Statement - ${statement.customerName}</title>
      <style>
        @page { size: A4; margin: 12mm 15mm 15mm 15mm; }
        @media print {
          .no-print-bar { display: none !important; }
          body { background: #FFFFFF !important; padding: 0 !important; }
          .sheet { box-shadow: none !important; margin: 0 !important; padding: 0 !important; }
        }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #26211C; background: #FAF8F5; margin: 0; padding: 0; font-size: 13px; line-height: 1.5; }
        .no-print-bar { position: sticky; top: 0; background: #382A24; color: #FAF8F5; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 10px rgba(0,0,0,0.18); z-index: 9999; }
        .print-btn { background: #EBD7BE; color: #382A24; border: 1px solid #D0AE92; font-weight: 700; padding: 8px 18px; border-radius: 6px; cursor: pointer; font-size: 13px; }
        .close-btn { background: transparent; color: #EBD7BE; border: 1px solid rgba(235, 215, 190, 0.4); padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }
        .sheet { max-width: 820px; margin: 24px auto; background: #FFFFFF; padding: 36px 40px; border-radius: 8px; box-shadow: 0 2px 12px rgba(74, 58, 52, 0.08); }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #26211C; padding-bottom: 16px; margin-bottom: 24px; }
        .brand { font-size: 20px; font-weight: 800; color: #26211C; letter-spacing: -0.02em; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
        .summary-box { background: #FAF8F5; border: 1px solid #E5DFD7; border-radius: 8px; padding: 12px 16px; }
        .summary-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #7B7267; margin-bottom: 4px; }
        .summary-val { font-size: 18px; font-weight: 700; font-family: monospace; color: #26211C; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #F2ECE4; padding: 8px 10px; border-bottom: 2px solid #D5CCC0; font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #4A4237; text-align: left; }
        .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #E5DFD7; font-size: 11px; color: #7B7267; text-align: center; }
      </style>
    </head>
    <body>
      <div class="no-print-bar">
        <div style="font-size: 13px; font-weight: 600;">
          <span style="color: #EBD7BE; font-weight: 800;">URBAN FURNITURE</span> &nbsp;•&nbsp; Official Customer Statement (${statement.customerName})
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
          <button type="button" class="close-btn" onclick="window.close()">✕ Close</button>
        </div>
      </div>

      <div class="sheet">
        <div class="header">
          <div>
            <div class="brand">URBAN FURNITURE</div>
            <div style="color: #7B7267; font-size: 12px; margin-top: 2px;">Accounting System &amp; Enterprise Ledger</div>
            <div style="margin-top: 12px; font-size: 14px; font-weight: 700;">Statement For: ${statement.customerName}</div>
            <div style="color: #574F45; font-size: 12px;">Customer ID: #${statement.customerId}</div>
            ${statement.customerEmail ? `<div style="color: #574F45; font-size: 12px;">Email: ${statement.customerEmail}</div>` : ''}
            ${statement.customerMobile ? `<div style="color: #574F45; font-size: 12px;">Mobile: ${statement.customerMobile}</div>` : ''}
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: 800; color: #26211C;">STATEMENT OF ACCOUNT</div>
            <div style="font-size: 12px; color: #7B7267; margin-top: 4px;">Date: ${new Date().toLocaleDateString('en-IN')}</div>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-box">
            <div class="summary-label">Total Invoiced</div>
            <div class="summary-val">₹${statement.totalInvoiced}</div>
          </div>
          <div class="summary-box">
            <div class="summary-label">Total Received</div>
            <div class="summary-val" style="color: #137333;">₹${statement.totalPaid}</div>
          </div>
          <div class="summary-box">
            <div class="summary-label">Closing Balance Due</div>
            <div class="summary-val" style="color: ${Number(statement.currentBalance) > 0 ? '#C5221F' : '#137333'};">₹${statement.currentBalance}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 85px;">Date</th>
              <th style="width: 70px;">Type</th>
              <th style="width: 100px;">Reference</th>
              <th>Description</th>
              <th style="width: 90px; text-align: right;">Debit (₹)</th>
              <th style="width: 90px; text-align: right;">Credit (₹)</th>
              <th style="width: 100px; text-align: right;">Balance (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          Generated deterministically by Urban Furniture Accounting Engine · Strictly Offline &amp; Immutable
        </div>
      </div>

      <script>
        window.addEventListener('DOMContentLoaded', function() {
          setTimeout(function() {
            try { window.print(); } catch (e) {}
          }, 350);
        });
      </script>
    </body>
    </html>`;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-brown-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface border border-brown-300 rounded-[12px] shadow-lg max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-brown-200 flex items-center justify-between bg-cream/50">
          <div>
            <h2 className="text-lg font-bold font-display text-brown-900">
              Customer Account Statement
            </h2>
            <p className="text-xs text-brown-600">
              Chronological invoices and payments with immutable running balance
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-brown-500 hover:text-brown-900 p-1.5 rounded-md hover:bg-brown-100 transition-colors text-lg font-bold leading-none"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 text-center text-brown-500">
              Generating statement ledger...
            </div>
          ) : error ? (
            <div className="p-4 bg-danger-bg border border-danger/30 text-danger rounded-md text-sm">
              {error}
            </div>
          ) : statement ? (
            <div>
              {/* Partner Overview Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-brown-50 border border-brown-200 rounded-[8px] mb-6">
                <div>
                  <span className="text-[11px] font-semibold text-brown-500 uppercase tracking-wider block">
                    Customer
                  </span>
                  <span className="font-bold text-brown-900 text-sm block">
                    {statement.customerName}
                  </span>
                  <span className="text-xs text-brown-600 font-mono block">
                    {statement.customerEmail || 'No email registered'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-brown-500 uppercase tracking-wider block">
                    Total Billed / Settled
                  </span>
                  <span className="text-xs text-brown-700 block">
                    Invoiced: <strong className="font-mono text-brown-900">₹{Number(statement.totalInvoiced).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </span>
                  <span className="text-xs text-posted block">
                    Paid: <strong className="font-mono">₹{Number(statement.totalPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-brown-500 uppercase tracking-wider block">
                    Current Outstanding
                  </span>
                  <span className={`text-base font-bold font-mono ${Number(statement.currentBalance) > 0 ? 'text-danger' : 'text-posted'}`}>
                    ₹{Number(statement.currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Statement Ledger Table */}
              <div className="border border-brown-300 rounded-[8px] overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-brown-100 text-brown-900 font-semibold border-b border-brown-300">
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Reference</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5 text-right font-mono-num">Debit (+)</th>
                      <th className="p-2.5 text-right font-mono-num">Credit (−)</th>
                      <th className="p-2.5 text-right font-mono-num">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brown-100">
                    {statement.lines.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-brown-500">
                          No accounting activity recorded for this customer yet.
                        </td>
                      </tr>
                    ) : (
                      statement.lines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-brown-50/70">
                          <td className="p-2.5 font-mono text-brown-700">{line.date}</td>
                          <td className="p-2.5 uppercase text-[10px] font-bold">
                            <span className={line.type === 'invoice' ? 'text-brown-900' : 'text-posted'}>
                              {line.type}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono font-semibold text-brown-900">{line.ref}</td>
                          <td className="p-2.5 text-brown-600">{line.description}</td>
                          <td className="p-2.5 text-right font-mono text-brown-900">
                            {Number(line.debit) > 0 ? `₹${Number(line.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="p-2.5 text-right font-mono text-posted">
                            {Number(line.credit) > 0 ? `₹${Number(line.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-brown-900 bg-brown-50/40">
                            ₹{Number(line.runningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-brown-200 bg-cream/30 flex items-center justify-between">
          <span className="text-[11px] text-brown-500 font-mono">
            Immutable Double-Entry Ledger Verification
          </span>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrintStatement}
              className="px-3.5 py-1.5 text-xs font-semibold text-brown-800 hover:text-brown-900 border border-brown-300 rounded-[6px] hover:bg-brown-100 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>🖨️ Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold bg-brown-900 text-cream rounded-[6px] hover:bg-brown-700 transition-colors shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
