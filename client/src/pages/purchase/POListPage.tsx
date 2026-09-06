import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ListView, Column } from '../../components/ui/ListView';
import { PurchaseOrdersApi } from '../../api/purchaseOrders.api';
import { PurchaseOrder } from '@shared/schemas/purchaseOrder.schema';
import { StatusBadge } from '../../components/StatusBadge';
import { Money } from '../../components/Money';
import { ShoppingCart } from 'lucide-react';

interface POListPageProps {
  onSelectPO: (id: number) => void;
  onNewPO: () => void;
}

export const POListPage: React.FC<POListPageProps> = ({ onSelectPO, onNewPO }) => {
  const [searchParams] = useSearchParams();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPOs = async () => {
    try {
      setLoading(true);
      const data = await PurchaseOrdersApi.getAll();
      setPos(data);
    } catch (err) {
      console.error('Failed to load purchase orders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPOs();
  }, []);

  const statusParam = searchParams.get('status');
  const displayedPOs = pos.filter(p => {
    if (!statusParam || statusParam === 'all') return true;
    return p.status === statusParam;
  });

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'number',
      header: 'PO No.',
      className: 'font-mono text-xs font-semibold text-brown-700 w-32',
    },
    {
      key: 'vendor_name',
      header: 'Vendor',
      render: p => (
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-brown-400" />
          <span className="font-semibold text-brown-900">{p.vendor_name}</span>
        </div>
      ),
    },
    {
      key: 'po_date',
      header: 'PO Date',
      className: 'text-sm text-brown-600',
    },
    {
      key: 'total_amount',
      header: 'Total Amount',
      align: 'right',
      render: p => <Money amount={p.total_amount} className="font-bold text-brown-900" />,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: p => <StatusBadge status={p.status} />,
    },
  ];

  return (
    <ListView
      title="Purchase Order"
      subtitle="Commercial orders placed with material and goods suppliers"
      columns={columns}
      data={displayedPOs}
      loading={loading}
      onRowClick={p => p.id && onSelectPO(p.id)}
      onNew={onNewPO}
      includeArchived={false}
      onToggleArchived={() => {}}
    />
  );
};
