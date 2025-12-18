import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { OfflineSyncProvider } from "@/contexts/OfflineSyncContext";
import { PrinterProvider } from "@/contexts/PrinterContext";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Tables from "./pages/Tables";
import Orders from "./pages/Orders";
import Menu from "./pages/Menu";
import Profile from "./pages/Profile";
import Stock from "./pages/Stock";
import CashRegister from "./pages/CashRegister";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Install from "./pages/Install";
import Counter from "./pages/Counter";
import Customers from "./pages/Customers";
import OrderManagement from "./pages/OrderManagement";
import KDS from "./pages/KDS";
import ClosingHistory from "./pages/ClosingHistory";
import CancellationHistory from "./pages/CancellationHistory";
import Performance from "./pages/Performance";
import ReopenHistory from "./pages/ReopenHistory";
import AuditDashboard from "./pages/AuditDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <OfflineSyncProvider>
        <PrinterProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
              <Route path="/" element={<Navigate to="/auth" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/tables" element={<Tables />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/menu" element={<Menu />} />
                <Route path="/stock" element={<Stock />} />
                <Route path="/cash-register" element={<CashRegister />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/install" element={<Install />} />
                <Route path="/counter" element={<Counter />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/order-management" element={<OrderManagement />} />
                <Route path="/kds" element={<KDS />} />
                <Route path="/closing-history" element={<ClosingHistory />} />
                <Route path="/cancellation-history" element={<CancellationHistory />} />
                <Route path="/performance" element={<Performance />} />
                <Route path="/reopen-history" element={<ReopenHistory />} />
                <Route path="/audit-dashboard" element={<AuditDashboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </PrinterProvider>
      </OfflineSyncProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
