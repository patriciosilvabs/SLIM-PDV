import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { OfflineSyncProvider } from "@/contexts/OfflineSyncContext";
import { PrinterProvider } from "@/contexts/PrinterContext";
import { PrintQueueListener } from "@/components/PrintQueueListener";
import { RequireTenant } from "@/components/auth/RequireTenant";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
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
import ShareReceiver from "./pages/ShareReceiver";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <OfflineSyncProvider>
        <PrinterProvider>
          <PrintQueueListener />
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/auth" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/onboarding" element={<Onboarding />} />
                
                {/* Protected routes - require tenant */}
                <Route path="/dashboard" element={<RequireTenant><Dashboard /></RequireTenant>} />
                <Route path="/tables" element={<RequireTenant><Tables /></RequireTenant>} />
                <Route path="/orders" element={<RequireTenant><Orders /></RequireTenant>} />
                <Route path="/menu" element={<RequireTenant><Menu /></RequireTenant>} />
                <Route path="/stock" element={<RequireTenant><Stock /></RequireTenant>} />
                <Route path="/cash-register" element={<RequireTenant><CashRegister /></RequireTenant>} />
                <Route path="/reports" element={<RequireTenant><Reports /></RequireTenant>} />
                <Route path="/settings" element={<RequireTenant><Settings /></RequireTenant>} />
                <Route path="/settings/:section" element={<RequireTenant><Settings /></RequireTenant>} />
                <Route path="/install" element={<RequireTenant><Install /></RequireTenant>} />
                <Route path="/counter" element={<RequireTenant><Counter /></RequireTenant>} />
                <Route path="/customers" element={<RequireTenant><Customers /></RequireTenant>} />
                <Route path="/order-management" element={<RequireTenant><OrderManagement /></RequireTenant>} />
                <Route path="/kds" element={<RequireTenant><KDS /></RequireTenant>} />
                <Route path="/closing-history" element={<RequireTenant><ClosingHistory /></RequireTenant>} />
                <Route path="/cancellation-history" element={<RequireTenant><CancellationHistory /></RequireTenant>} />
                <Route path="/performance" element={<RequireTenant><Performance /></RequireTenant>} />
                <Route path="/reopen-history" element={<RequireTenant><ReopenHistory /></RequireTenant>} />
                <Route path="/audit-dashboard" element={<RequireTenant><AuditDashboard /></RequireTenant>} />
                <Route path="/share-receiver" element={<RequireTenant><ShareReceiver /></RequireTenant>} />
                <Route path="/profile" element={<RequireTenant><Profile /></RequireTenant>} />
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
