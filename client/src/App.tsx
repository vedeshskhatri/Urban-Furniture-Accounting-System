import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import CreateUser from './pages/CreateUser';
import KitchenSink from './pages/KitchenSink';
import LandingPage from './pages/LandingPage';

// Sales Module
import SalesIndexPage from './pages/sales/SalesIndexPage';
import SalesOrderListPage from './pages/sales/SalesOrderListPage';
import SalesOrderFormPage from './pages/sales/SalesOrderFormPage';
import CustomerInvoiceListPage from './pages/sales/CustomerInvoiceListPage';
import CustomerInvoiceFormPage from './pages/sales/CustomerInvoiceFormPage';
import ReceivablesPage from './pages/sales/ReceivablesPage';
import RegisterPaymentPage from './pages/sales/RegisterPaymentPage';
import { VoiceBillPage } from './pages/sales/VoiceBillPage';

// Purchase Module
import PurchaseIndexPage from './pages/purchase/PurchaseIndexPage';
import {
  POListRoute,
  POFormRoute,
  VendorBillListRoute,
  VendorBillFormRoute,
  VendorStatementRoute,
} from './pages/purchase/PurchaseRoutes';

// Master / Account Module
import AccountIndexPage from './pages/master/AccountIndexPage';
import {
  AccountListRoute,
  AccountFormRoute,
  ContactListRoute,
  ContactKanbanRoute,
  ContactFormRoute,
  ProductListRoute,
  ProductKanbanRoute,
  ProductFormRoute,
  JournalListRoute,
  JournalFormRoute,
  JournalEntryListRoute,
  JournalEntryFormRoute,
  AnalyticListRoute,
  AnalyticKanbanRoute,
  AnalyticFormRoute,
} from './pages/master/AccountRoutes';
import BudgetListPage from './pages/budget/BudgetListPage';
import BudgetFormPage from './pages/budget/BudgetFormPage';

// Reports Module
import ReportsIndexPage from './pages/reports/ReportsIndexPage';
import BalanceSheetPage from './pages/reports/BalanceSheetPage';
import ProfitLossPage from './pages/reports/ProfitLossPage';
import BudgetReportPage from './pages/reports/BudgetReportPage';
import VerifyPage from './pages/reports/VerifyPage';
import AnalyticsPage from './pages/reports/AnalyticsPage';
import GstReportPage from './pages/reports/GstReportPage';

// Customer Portal
import PortalApp from './pages/portal/PortalApp';

// Live Monitor (full-screen, no shell)
import MonitorPage from './pages/MonitorPage';

// System Integrity (10-check live audit)
import IntegrityPage from './pages/IntegrityPage';

// Audit Log (chatter)
import AuditFeedPage from './pages/AuditFeedPage';

// Business Tools: Template Library
import TemplateLibraryPage from './pages/templates/TemplateLibraryPage';
import AdminTemplateManagementPage from './pages/templates/AdminTemplateManagementPage';

export function App() {
  return (
    <Routes>
      {/* ── Auth (no shell) ── */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/create-user" element={<CreateUser />} />

      {/* ── Customer Portal (Restricted Surface — no shell) ── */}
      <Route path="/portal/*" element={<PortalApp />} />

      {/* ── Live Ledger Monitor (full-screen dark board — no shell) ── */}
      <Route path="/monitor" element={<MonitorPage />} />

      {/* ── Kitchen sink (no shell — full-page design system preview) ── */}
      <Route path="/kitchen-sink" element={<KitchenSink />} />

      {/* ── Public Landing Page (Root Entrypoint) ── */}
      <Route path="/" element={<LandingPage />} />

      {/* ── Main ERP App Shell ── */}
      <Route element={<AppShell />}>
        <Route path="dashboard" element={<Dashboard />} />

        {/* ── Sales Module ── */}
        <Route path="sales" element={<SalesIndexPage />}>
          <Route index element={<Navigate to="orders" replace />} />
          <Route path="orders" element={<SalesOrderListPage />} />
          <Route path="orders/new" element={<SalesOrderFormPage />} />
          <Route path="orders/:id" element={<SalesOrderFormPage />} />
          <Route path="invoices" element={<CustomerInvoiceListPage />} />
          <Route path="invoices/new" element={<CustomerInvoiceFormPage />} />
          <Route path="invoices/:id" element={<CustomerInvoiceFormPage />} />
          <Route path="receivables" element={<ReceivablesPage />} />
          <Route path="payments" element={<RegisterPaymentPage />} />
          <Route path="voice-bill" element={<VoiceBillPage />} />
        </Route>

        {/* ── Purchase Module ── */}
        <Route path="purchase" element={<PurchaseIndexPage />}>
          <Route index element={<Navigate to="orders" replace />} />
          <Route path="orders" element={<POListRoute />} />
          <Route path="orders/new" element={<POFormRoute />} />
          <Route path="orders/:id" element={<POFormRoute />} />
          <Route path="bills" element={<VendorBillListRoute />} />
          <Route path="bills/new" element={<VendorBillFormRoute />} />
          <Route path="bills/:id" element={<VendorBillFormRoute />} />
          <Route path="statements" element={<VendorStatementRoute />} />
          <Route path="statements/:id" element={<VendorStatementRoute />} />
        </Route>

        {/* ── Account & Master Data Module ── */}
        <Route path="account" element={<AccountIndexPage />}>
          <Route index element={<Navigate to="coa" replace />} />
          <Route path="coa" element={<AccountListRoute />} />
          <Route path="coa/new" element={<AccountFormRoute />} />
          <Route path="coa/:id" element={<AccountFormRoute />} />
          <Route path="budgets" element={<BudgetListPage />} />
          <Route path="budgets/kanban" element={<BudgetListPage initialView="kanban" />} />
          <Route path="budgets/new" element={<BudgetFormPage />} />
          <Route path="budgets/:id" element={<BudgetFormPage />} />
          <Route path="contacts" element={<ContactListRoute />} />
          <Route path="contacts/kanban" element={<ContactKanbanRoute />} />
          <Route path="contacts/new" element={<ContactFormRoute />} />
          <Route path="contacts/:id" element={<ContactFormRoute />} />
          <Route path="products" element={<ProductListRoute />} />
          <Route path="products/new" element={<ProductFormRoute />} />
          <Route path="products/kanban" element={<ProductKanbanRoute />} />
          <Route path="products/:id" element={<ProductFormRoute />} />
          <Route path="journals" element={<JournalListRoute />} />
          <Route path="journals/new" element={<JournalFormRoute />} />
          <Route path="journals/:id" element={<JournalFormRoute />} />
          <Route path="journal-entries" element={<JournalEntryListRoute />} />
          <Route path="journal-entries/new" element={<JournalEntryFormRoute />} />
          <Route path="journal-entries/:id" element={<JournalEntryFormRoute />} />

          <Route path="analytics" element={<AnalyticListRoute />} />
          <Route path="analytics/kanban" element={<AnalyticKanbanRoute />} />
          <Route path="analytics/new" element={<AnalyticFormRoute />} />
          <Route path="analytics/:id" element={<AnalyticFormRoute />} />
        </Route>

        {/* ── Business Analytics Engine ── */}
        <Route path="analytics" element={<AnalyticsPage />} />

        {/* ── Reports Module ── */}
        <Route path="report" element={<ReportsIndexPage />}>
          <Route index element={<Navigate to="balance-sheet" replace />} />
          <Route path="balance-sheet" element={<BalanceSheetPage />} />
          <Route path="profit-loss" element={<ProfitLossPage />} />
          <Route path="budget" element={<BudgetReportPage />} />
          <Route path="gst" element={<GstReportPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
        </Route>

        {/* ── Business Tools: Template Library ── */}
        <Route path="tools">
          <Route index element={<Navigate to="templates" replace />} />
          <Route path="templates" element={<TemplateLibraryPage />} />
          <Route path="templates/manage" element={<AdminTemplateManagementPage />} />
        </Route>
        <Route path="templates" element={<Navigate to="/tools/templates" replace />} />

        {/* ── System Ledger Audit (/verify) ── */}
        <Route path="verify" element={<VerifyPage />} />

        {/* ── System Integrity (10-check live audit) ── */}
        <Route path="integrity" element={<IntegrityPage />} />

        {/* ── Audit Log (chatter) ── */}
        <Route path="audit" element={<AuditFeedPage />} />
      </Route>

      {/* ── Fallback ── */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
