import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { POListPage } from './POListPage';
import { POFormPage } from './POFormPage';
import { VendorBillListPage } from './VendorBillListPage';
import { VendorBillFormPage } from './VendorBillFormPage';
import { VendorStatementPage } from '../master/VendorStatementPage';
import { ContactsApi } from '../../api/contacts.api';
import { Contact } from '@shared/schemas/contact.schema';

export const POListRoute: React.FC = () => {
  const navigate = useNavigate();
  return (
    <POListPage
      onSelectPO={id => navigate(`/purchase/orders/${id}`)}
      onNewPO={() => navigate('/purchase/orders/new')}
    />
  );
};

export const POFormRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const poId = id && id !== 'new' ? parseInt(id, 10) : null;

  return (
    <POFormPage
      poId={poId}
      onBack={() => navigate('/purchase/orders')}
      onHome={() => navigate('/purchase/orders')}
      onSaved={savedId => navigate(`/purchase/orders/${savedId}`)}
      onCreateBillSuccess={billId => navigate(`/purchase/bills/${billId}`)}
    />
  );
};

export const VendorBillListRoute: React.FC = () => {
  const navigate = useNavigate();
  return (
    <VendorBillListPage
      onSelectBill={id => navigate(`/purchase/bills/${id}`)}
      onNewBill={() => navigate('/purchase/bills/new')}
    />
  );
};

export const VendorBillFormRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const billId = id && id !== 'new' ? parseInt(id, 10) : null;

  return (
    <VendorBillFormPage
      billId={billId}
      onBack={() => navigate('/purchase/bills')}
      onHome={() => navigate('/purchase/bills')}
      onSaved={savedId => navigate(`/purchase/bills/${savedId}`)}
      onViewPO={poId => navigate(`/purchase/orders/${poId}`)}
    />
  );
};

export const VendorStatementRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<Contact[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<number>(id ? parseInt(id, 10) : 0);

  useEffect(() => {
    ContactsApi.getAll(false, 'vendor')
      .then(list => {
        setVendors(list);
        if (!selectedVendorId && list.length > 0) {
          setSelectedVendorId(list[0].id!);
        }
      })
      .catch(console.error);
  }, []);

  return (
    <div className="w-full flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold font-display text-brown-900">Vendor Statements</h1>
        <p className="text-sm text-brown-700">Supplier ledger activity, disbursements &amp; running balances</p>
      </div>

      {/* Vendor Selector Ribbon */}
      <div className="bg-surface border border-brown-300 rounded-[10px] p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-brown-700">
            Select Vendor:
          </label>
          <select
            value={selectedVendorId}
            onChange={e => {
              const vId = Number(e.target.value);
              setSelectedVendorId(vId);
              navigate(`/purchase/statements/${vId}`);
            }}
            className="bg-surface border border-brown-300 rounded-[6px] px-3 py-1.5 text-sm text-brown-900 font-medium focus:ring-2 focus:ring-brown-700 outline-none"
          >
            {vendors.map(v => (
              <option key={v.id} value={v.id}>
                {v.name} {v.email ? `(${v.email})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedVendorId > 0 && (
        <VendorStatementPage
          contactId={selectedVendorId}
          onBack={() => navigate('/purchase/bills')}
          onHome={() => navigate('/purchase/orders')}
        />
      )}
    </div>
  );
};
