import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { PortalAuthProvider, PortalAuthGuard } from './PortalAuthGuard';
import { PortalLayout } from './PortalLayout';
import { PortalLogin } from './PortalLogin';
import { PortalInviteAccept } from './PortalInviteAccept';
import { PortalInvoiceList } from './PortalInvoiceList';
import { PortalInvoiceDetail } from './PortalInvoiceDetail';
import { PortalBillList } from './PortalBillList';
import { PortalBillDetail } from './PortalBillDetail';
import { PortalPaymentList } from './PortalPaymentList';
import { PortalCataloguePage } from './PortalCataloguePage';
import { PortalProductViewerPage } from './PortalProductViewerPage';
import { PortalDashboardPage } from './PortalDashboardPage';
import { PortalRoomStudioPage } from './PortalRoomStudioPage';
import { PortalOrderList } from './PortalOrderList';

/**
 * Portal route tree.
 *
 * Public Standalone – /portal/login, /portal/accept-invite
 * Portal Surface (wrapped by PortalLayout with sub-header navigation)
 *   - Overview Dashboard: /portal, /portal/dashboard
 *   - Interactive 3D Room Studio: /portal/studio, /portal/planner
 *   - Public browseable catalogue: /portal/catalogue, /portal/catalogue/:id
 *   - Authenticated customer & vendor (behind PortalAuthGuard):
 *       /portal/orders,
 *       /portal/invoices, /portal/invoices/:id,
 *       /portal/payments,
 *       /portal/bills, /portal/bills/:id
 */
export const PortalApp: React.FC = () => {
  return (
    <PortalAuthProvider>
      <Routes>
        {/* ── Public standalone auth routes ── */}
        <Route path="login" element={<Navigate to="/login?portal=customer" replace />} />
        <Route path="accept-invite" element={<PortalInviteAccept />} />

        {/* ── All portal pages inside PortalLayout (Top Header + Nav Bar + Footer) ── */}
        <Route element={<PortalLayout />}>
          {/* Customer Studio Dashboard */}
          <Route index element={<PortalDashboardPage />} />
          <Route path="dashboard" element={<PortalDashboardPage />} />

          {/* Interactive Japandi 3D Room Studio Planner */}
          <Route path="studio" element={<PortalRoomStudioPage />} />
          <Route path="planner" element={<PortalRoomStudioPage />} />

          {/* Public catalogue routes */}
          <Route path="catalogue" element={<PortalCataloguePage />} />
          <Route path="catalogue/:id" element={<PortalProductViewerPage />} />

          {/* Authenticated customer & vendor routes */}
          <Route element={<PortalAuthGuard />}>
            <Route path="orders" element={<PortalOrderList />} />
            <Route path="invoices" element={<PortalInvoiceList />} />
            <Route path="invoices/:id" element={<PortalInvoiceDetail />} />
            <Route path="payments" element={<PortalPaymentList />} />
            <Route path="bills" element={<PortalBillList />} />
            <Route path="bills/:id" element={<PortalBillDetail />} />
          </Route>
        </Route>

        {/* Fallback inside /portal/* */}
        <Route path="*" element={<Navigate to="catalogue" replace />} />
      </Routes>
    </PortalAuthProvider>
  );
};

export default PortalApp;
