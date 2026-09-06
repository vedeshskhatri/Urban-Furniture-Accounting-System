import React, { useState, useEffect } from 'react';
import { ContactsApi } from '../../api/contacts.api';
import { Contact } from '@shared/schemas/contact.schema';
import { Money } from '../../components/Money';
import { ArrowLeft, Home, Printer, FileText, Calendar, Building2, Mail, Phone } from 'lucide-react';

interface VendorStatementPageProps {
  contactId: number;
  onBack: () => void;
  onHome: () => void;
}

export const VendorStatementPage: React.FC<VendorStatementPageProps> = ({
  contactId,
  onBack,
  onHome,
}) => {
  const [statement, setStatement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    ContactsApi.getStatement(contactId)
      .then(data => setStatement(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [contactId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-brown-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brown-700"></div>
        <span className="ml-3 text-sm font-medium">Generating partner statement...</span>
      </div>
    );
  }

  if (error || !statement) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200">
          <p className="font-semibold">Unable to load statement</p>
          <p className="text-sm mt-1">{error || 'Vendor not found'}</p>
          <button
            onClick={onBack}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  const { contact, total_billed, total_paid, closing_balance, lines } = statement;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between no-print print:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 hover:bg-brown-100 text-brown-600 rounded-lg transition-colors"
            title="Back to Contact"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={onHome}
            className="p-2 hover:bg-brown-100 text-brown-600 rounded-lg transition-colors"
            title="Home"
          >
            <Home className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-heading font-bold text-brown-900">Payment</h1>
            <p className="text-xs text-brown-500">Ledger Activity &amp; Running Balance</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 bg-surface hover:bg-brown-50 text-brown-800 border border-brown-300 px-3.5 py-1.5 rounded-lg text-sm font-medium shadow-xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print / Export PDF
          </button>
        </div>
      </div>

      {/* Statement Card */}
      <div className="printable-sheet bg-surface rounded-2xl border border-brown-200/80 shadow-sm p-8 print:border-none print:shadow-none print:p-0">
        {/* Statement Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between border-b border-brown-200/80 pb-6 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-brown-700 text-cream flex items-center justify-center font-heading font-bold text-lg">
                {contact.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-heading font-bold text-brown-900">{contact.name}</h2>
                <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-brown-500 bg-brown-100/70 px-2 py-0.5 rounded">
                  {contact.type}
                </span>
              </div>
            </div>

            <div className="text-xs text-brown-600 space-y-1 mt-3">
              {contact.address && <p>{contact.address}</p>}
              {(contact.city || contact.state || contact.pincode) && (
                <p>
                  {[contact.city, contact.state, contact.pincode].filter(Boolean).join(', ')}
                </p>
              )}
              {contact.email && (
                <p className="flex items-center gap-1.5 text-brown-500">
                  <Mail className="w-3.5 h-3.5" /> {contact.email}
                </p>
              )}
              {contact.mobile && (
                <p className="flex items-center gap-1.5 text-brown-500">
                  <Phone className="w-3.5 h-3.5" /> {contact.mobile}
                </p>
              )}
              {contact.gstin && (
                <p className="font-mono text-brown-700">GSTIN: {contact.gstin}</p>
              )}
            </div>
          </div>

          <div className="text-right flex flex-col items-end">
            <div className="text-xs font-semibold text-brown-400 uppercase tracking-wider">Statement Date</div>
            <div className="text-sm font-medium text-brown-900">{new Date().toLocaleDateString('en-GB')}</div>

            <div className="mt-4 bg-brown-50 border border-brown-200/80 rounded-xl p-3 text-right">
              <span className="text-xs font-semibold text-brown-600 uppercase tracking-wider block">Net Balance Due</span>
              <Money amount={closing_balance} className="text-xl font-heading font-bold text-brown-900" />
            </div>
          </div>
        </div>

        {/* Metrics Summary Row */}
        <div className="grid grid-cols-3 gap-4 my-6">
          <div className="p-4 bg-brown-50/50 rounded-xl border border-brown-200/60">
            <span className="text-xs font-semibold text-brown-500 uppercase tracking-wider block mb-1">Total Invoiced / Billed</span>
            <Money amount={total_billed} className="text-lg font-heading font-bold text-brown-900" />
          </div>
          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/60">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block mb-1">Total Paid / Settled</span>
            <Money amount={total_paid} className="text-lg font-heading font-bold text-emerald-800" />
          </div>
          <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/60">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider block mb-1">Outstanding Balance</span>
            <Money amount={closing_balance} className="text-lg font-heading font-bold text-amber-900" />
          </div>
        </div>

        {/* Chronological Statement Table */}
        <div className="border border-brown-200/80 rounded-xl overflow-hidden bg-surface mt-6">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brown-100/70 border-b border-brown-200 text-xs font-semibold text-brown-700 uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Document #</th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4 text-center">Type</th>
                <th className="py-3 px-4 text-right">Debit (₹)</th>
                <th className="py-3 px-4 text-right">Credit (₹)</th>
                <th className="py-3 px-4 text-right">Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brown-100 text-sm">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-brown-400 text-xs">
                    No confirmed transactions recorded for this partner yet.
                  </td>
                </tr>
              ) : (
                lines.map((l: any, idx: number) => (
                  <tr key={idx} className="hover:bg-brown-50/40">
                    <td className="py-3 px-4 font-mono text-xs text-brown-700">{l.date}</td>
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-brown-900">{l.doc_number}</td>
                    <td className="py-3 px-4 text-xs text-brown-600">{l.reference}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                          l.type === 'bill'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {l.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs">
                      {l.debit !== '0.00' ? <Money amount={l.debit} /> : <span className="text-brown-300">-</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs">
                      {l.credit !== '0.00' ? <Money amount={l.credit} className="text-emerald-700" /> : <span className="text-brown-300">-</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-bold text-brown-900">
                      <Money amount={l.running_balance} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-brown-50 font-heading font-bold border-t-2 border-brown-300 text-sm">
                <td colSpan={4} className="py-3 px-4 text-right text-brown-700">
                  Ending Outstanding Balance:
                </td>
                <td className="py-3 px-4 text-right font-mono text-xs">
                  <Money amount={total_billed} />
                </td>
                <td className="py-3 px-4 text-right font-mono text-xs text-emerald-700">
                  <Money amount={total_paid} />
                </td>
                <td className="py-3 px-4 text-right font-mono text-sm text-brown-900">
                  <Money amount={closing_balance} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
