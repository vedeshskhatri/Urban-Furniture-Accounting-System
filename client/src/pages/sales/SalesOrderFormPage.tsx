import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FormButtons } from './components/FormButtons';
import { StatusBadge } from '../../components/StatusBadge';
import { SalesLineItemGrid, GridLine } from './components/SalesLineItemGrid';
import { BlockingWarning } from './components/Warnings';
import { SalesOrderDTO } from '@shared/schemas/salesOrder';

export interface SalesOrderFormPageProps {
  orderId?: number | null;
  onBack?: () => void;
  onSaved?: (id: number) => void;
}

export const SalesOrderFormPage: React.FC<SalesOrderFormPageProps> = ({ orderId: propOrderId, onBack, onSaved }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const orderId = propOrderId !== undefined ? propOrderId : (id ? parseInt(id, 10) : null);

  const [order, setOrder] = useState<SalesOrderDTO | null>(null);
  const [customerId, setCustomerId] = useState<number>(0);
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [lines, setLines] = useState<GridLine[]>([]);
  const [contacts, setContacts] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: number; name: string; sku: string; sales_price: string; tax_rate: string }>>([]);
  const [analytics, setAnalytics] = useState<Array<{ id: number; name: string }>>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Load dropdown data
  useEffect(() => {
    fetch('/api/contacts?type=customer')
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          const seen = new Set<string>();
          const unique = json.data.filter((c: any) => {
            const key = `${(c.name || '').toLowerCase().trim()}::${(c.email || '').toLowerCase().trim()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setContacts(unique);
        }
      })
      .catch(() => {});

    fetch('/api/products')
      .then(res => res.json())
      .then(json => {
        if (json.data) setProducts(json.data);
      })
      .catch(() => {});

    fetch('/api/analytic-accounts')
      .then(res => res.json())
      .then(json => {
        if (json.data) setAnalytics(json.data);
      })
      .catch(() => {});
  }, []);

  // Load existing order if orderId provided
  useEffect(() => {
    if (orderId) {
      setLoading(true);
      fetch(`/api/sales-orders/${orderId}`)
        .then(res => res.json())
        .then(json => {
          if (json.data) {
            const o: SalesOrderDTO = json.data;
            setOrder(o);
            setCustomerId(o.customerId);
            setOrderDate(o.orderDate);
            setLines(o.lines.map(l => ({
              productId: l.productId,
              analyticAccountId: l.analyticAccountId || null,
              qty: l.qty,
              unitPrice: l.unitPrice,
              taxRate: l.taxRate,
              taxAmount: l.taxAmount,
              subtotal: l.subtotal,
              total: l.total,
            })));
          } else if (json.error) {
            setError(json.error.message);
          }
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    } else {
      // New form initialization
      setOrder(null);
      setCustomerId(0);
      setOrderDate(new Date().toISOString().split('T')[0]);
      setLines([
        {
          productId: 0,
          analyticAccountId: null,
          qty: '1',
          unitPrice: '0.00',
          taxRate: '18.00',
        },
      ]);
    }
  }, [orderId]);

  const handleSaveDraft = async () => {
    if (!customerId) {
      setError('Please select a customer.');
      return;
    }
    if (lines.length === 0 || lines.some(l => !l.productId || Number(l.qty) <= 0)) {
      setError('Please provide valid products and quantities for all lines.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sales-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          orderDate,
          lines,
        }),
      });
      const json = await res.json();
      if (json.data) {
        setOrder(json.data);
        setInfoMsg(`Sales Order ${json.data.number} created as Draft.`);
        navigate(`/sales/orders/${json.data.id}`, { replace: true });
      } else {
        setError(json.error?.message || 'Failed to save Sales Order');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrder = async () => {
    if (!order?.id) return;
    if (!customerId) {
      setError('Please select a customer.');
      return;
    }
    if (lines.length === 0 || lines.some(l => !l.productId || Number(l.qty) <= 0)) {
      setError('Please provide valid products and quantities for all lines.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sales-orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          orderDate,
          lines,
        }),
      });
      const json = await res.json();
      if (json.data) {
        setOrder(json.data);
        setInfoMsg(`Sales Order ${json.data.number} updated successfully.`);
      } else {
        setError(json.error?.message || 'Failed to update Sales Order');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!order?.id) {
      await handleSaveDraft();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sales-orders/${order.id}/confirm`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.data) {
        setOrder(json.data);
        setInfoMsg(`Sales Order ${json.data.number} Confirmed! Commercial intent recorded with zero journal entries.`);
      } else {
        setError(json.error?.message || 'Failed to confirm Sales Order');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!order?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sales-orders/${order.id}/create-invoice`, {
        method: 'POST',
      });
      const json = await res.json();
      const targetId = json.data?.id || json.data?.invoiceId;
      if (targetId) {
        navigate(`/sales/invoices/${targetId}`);
      } else {
        setError(json.error?.message || 'Failed to create Customer Invoice');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isInvoiced = Boolean(order?.isInvoiced || order?.invoiceId);
  const isConfirmed = order?.status === 'confirmed';
  const isDraft = !order || order.status === 'draft';
  const isLocked = isInvoiced;

  return (
    <div className="max-w-5xl mx-auto pb-16">
      {/* Sticky Button Row */}
      <FormButtons
        onBack={() => navigate('/sales/orders')}
        onNew={() => {
          navigate('/sales/orders/new');
        }}
        onSaveDraft={!order ? handleSaveDraft : undefined}
        onSave={order && !isLocked ? handleUpdateOrder : undefined}
        onConfirm={isDraft ? handleConfirm : undefined}
        onCreateInvoice={isConfirmed && !isInvoiced ? handleCreateInvoice : undefined}
        onViewInvoice={order?.invoiceId ? () => navigate(`/sales/invoices/${order.invoiceId}`) : undefined}
        canConfirm={lines.length > 0 && customerId > 0}
        canCreateInvoice={isConfirmed && !isInvoiced}
        canSave={lines.length > 0 && customerId > 0}
        isDraft={isDraft}
        isConfirmed={isConfirmed}
        isInvoiced={isInvoiced}
        invoiceNumber={order?.invoiceNumber}
        isLoading={loading}
      />

      <div className="px-6">
        {/* Warnings / Alerts */}
        {error && <BlockingWarning message={error} />}
        {infoMsg && (
          <div className="p-4 bg-posted-bg border border-posted/30 text-posted rounded-md mb-4 text-sm font-medium">
            ✓ {infoMsg}
          </div>
        )}

        {/* State Notice Banners */}
        {isInvoiced && (
          <div className="p-4 bg-brown-100 border border-brown-300 text-brown-900 rounded-[10px] mb-4 text-sm font-medium flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="text-base">🔒</span>
              <span>
                <strong>Permanently Locked:</strong> Customer Invoice <strong>{order?.invoiceNumber}</strong> has already been generated. This Sales Order is permanently locked against further edits.
              </span>
            </div>
            {order?.invoiceId && (
              <button
                type="button"
                onClick={() => navigate(`/sales/invoices/${order.invoiceId}`)}
                className="px-3.5 py-1.5 bg-brown-900 text-cream text-xs font-semibold rounded-[6px] hover:bg-brown-800 transition-colors cursor-pointer shadow-sm flex-shrink-0"
              >
                Open Invoice →
              </button>
            )}
          </div>
        )}

        {isConfirmed && !isInvoiced && (
          <div className="p-3.5 bg-amber-50 border border-amber-300/80 text-amber-900 rounded-[10px] mb-4 text-xs font-medium flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-sm">📝</span>
              <span>
                <strong>Sales Order Confirmed:</strong> You can still edit products, quantities, prices, or customer details and click <strong>"Save Changes"</strong> before the invoice is created. Once <strong>"Create Invoice"</strong> is clicked, this order will be permanently locked.
              </span>
            </div>
          </div>
        )}

        {/* Document Header Card */}
        <div className="bg-surface border border-brown-300 rounded-[10px] p-6 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 border-b border-brown-100 gap-4">
            <div>
              <span className="text-xs font-semibold text-brown-500 uppercase tracking-wider">Sales Order</span>
              <h1 className="text-2xl font-bold font-display text-brown-900 mt-1">
                {order ? order.number : 'New Draft Order'}
              </h1>
            </div>
            <StatusBadge status={(order?.status as any) || 'draft'} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* Customer Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown-700 mb-1.5">
                Customer Name *
              </label>
              <select
                disabled={isLocked}
                value={customerId}
                onChange={e => setCustomerId(Number(e.target.value))}
                className={`w-full bg-surface border border-brown-300 rounded-[6px] px-3 py-2 text-brown-900 focus:ring-2 focus:ring-brown-700 outline-none text-sm ${
                  isLocked ? 'opacity-60 cursor-not-allowed bg-brown-50' : ''
                }`}
              >
                <option value={0} disabled>Select Customer...</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.email ? `(${c.email})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Order Date */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown-700 mb-1.5">
                SO Date *
              </label>
              <input
                type="date"
                disabled={isLocked}
                value={orderDate}
                onChange={e => setOrderDate(e.target.value)}
                className={`w-full bg-surface border border-brown-300 rounded-[6px] px-3 py-2 text-brown-900 focus:ring-2 focus:ring-brown-700 outline-none text-sm ${
                  isLocked ? 'opacity-60 cursor-not-allowed bg-brown-50' : ''
                }`}
              />
            </div>
          </div>
        </div>

        {/* Line Items Grid */}
        <div className="mb-6">
          <h2 className="text-base font-bold font-display text-brown-900 mb-2">Order Line Items</h2>
          <SalesLineItemGrid
            lines={lines}
            products={products}
            analytics={analytics}
            onChange={setLines}
            disabled={isLocked}
          />
        </div>
      </div>
    </div>
  );
};
export default SalesOrderFormPage;
