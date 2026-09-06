import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SalesOrderDTO } from '@shared/schemas/salesOrder';
import ListView, { ListColumn } from '../../components/ui/ListView';

export interface SalesOrderListPageProps {
  onSelectOrder?: (id: number) => void;
  onNewOrder?: () => void;
}

export const SalesOrderListPage: React.FC<SalesOrderListPageProps> = ({ onSelectOrder, onNewOrder }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<SalesOrderDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get('status') || 'all');

  useEffect(() => {
    const param = searchParams.get('status');
    if (param) setFilterStatus(param);
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/sales-orders')
      .then(res => res.json())
      .then(json => {
        if (json.data) setOrders(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = orders.filter(o => {
    if (filterStatus === 'all') return true;
    return o.status === filterStatus;
  });

  const tableData = filtered.map(order => ({
    ...order,
    customer: order.customerName || `Customer #${order.customerId}`,
    taxAmount: order.taxAmount ?? (order as any).taxTotal ?? '0.00',
    totalAmount: order.totalAmount ?? (order as any).total ?? '0.00',
  }));

  const columns: ListColumn<typeof tableData[0]>[] = [
    { label: 'SO Number', key: 'number', type: 'text', width: '18%' },
    { label: 'Customer', key: 'customer', type: 'text', width: '28%' },
    { label: 'Date', key: 'orderDate', type: 'date', width: '16%' },
    { label: 'Status', key: 'status', type: 'badge', width: '14%' },
    { label: 'Tax', key: 'taxAmount', type: 'money', width: '12%' },
    { label: 'Total Amount', key: 'totalAmount', type: 'money', width: '12%' },
  ];

  const filterSlot = (
    <div className="flex items-center gap-2">
      <select
        value={filterStatus}
        onChange={e => setFilterStatus(e.target.value)}
        className="bg-surface border border-brown-300 rounded-[6px] px-3 py-1.5 text-sm text-brown-900 focus:ring-2 focus:ring-brown-700 outline-none shadow-sm"
      >
        <option value="all">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="confirmed">Confirmed</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </div>
  );

  return (
    <ListView
      title="Sales order"
      subtitle="Commercial intent orders before customer billing"
      columns={columns}
      data={tableData}
      loading={loading}
      onRowClick={order => (onSelectOrder ? onSelectOrder(order.id) : navigate(`/sales/orders/${order.id}`))}
      onNew={onNewOrder ? onNewOrder : () => navigate('/sales/orders/new')}
      filterSlot={filterSlot}
      searchable
      emptyText="No sales orders found. Click + New Order to create one."
    />
  );
};

export default SalesOrderListPage;
