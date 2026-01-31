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
import ItemCancellationHistory from "./pages/ItemCancellationHistory";
import Performance from "./pages/Performance";
import ReopenHistory from "./pages/ReopenHistory";
import AuditDashboard from "./pages/AuditDashboard";
import ShareReceiver from "./pages/ShareReceiver";
import AcceptInvite from "./pages/AcceptInvite";
import Production from "./pages/Production";
import NotFound from "./pages/NotFound";

// Platform Admin Pages
import PlatformDashboard from "./pages/platform/PlatformDashboard";
import PlatformTenants from "./pages/platform/PlatformTenants";
import PlatformSubscriptions from "./pages/platform/PlatformSubscriptions";
import PlatformAdmins from "./pages/platform/PlatformAdmins";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <OfflineSyncProvider>
        <PrinterProvider>
          <TooltipProvider>
            <PrintQueueListener />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/auth" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/invite/:token" element={<AcceptInvite />} />
                
                {/* Platform Admin routes */}
                <Route path="/platform" element={<PlatformDashboard />} />
                <Route path="/platform/tenants" element={<PlatformTenants />} />
                <Route path="/platform/subscriptions" element={<PlatformSubscriptions />} />
                <Route path="/platform/admins" element={<PlatformAdmins />} />
                
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
                <Route path="/item-cancellation-history" element={<RequireTenant><ItemCancellationHistory /></RequireTenant>} />
                <Route path="/performance" element={<RequireTenant><Performance /></RequireTenant>} />
                <Route path="/reopen-history" element={<RequireTenant><ReopenHistory /></RequireTenant>} />
                <Route path="/audit-dashboard" element={<RequireTenant><AuditDashboard /></RequireTenant>} />
                <Route path="/share-receiver" element={<RequireTenant><ShareReceiver /></RequireTenant>} />
                <Route path="/profile" element={<RequireTenant><Profile /></RequireTenant>} />
                <Route path="/production" element={<RequireTenant><Production /></RequireTenant>} />
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
