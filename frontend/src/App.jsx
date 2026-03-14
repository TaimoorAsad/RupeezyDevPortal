import React, { useState, useEffect } from "react";
import { Routes, Route, NavLink, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  Briefcase,
  Wallet,
  Activity,
  ShoppingCart,
  LogOut,
  Wifi,
  WifiOff,
  Menu,
  X,
  ChevronRight,
  Clock,
  AlertTriangle,
  CandlestickChart,
  BarChart3,
  CalendarClock,
} from "lucide-react";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";

import AuthSetup   from "./components/AuthSetup";
import DemoBanner  from "./components/DemoBanner";
import OrderForm   from "./components/OrderForm";
import OrderBook   from "./components/OrderBook";
import Positions   from "./components/Positions";
import Holdings    from "./components/Holdings";
import Funds       from "./components/Funds";
import Watchlist   from "./components/Watchlist";
import BasketOrder from "./components/BasketOrder";
import CandleChart      from "./components/CandleChart";
import Analytics        from "./components/Analytics";
import ScheduledOrders  from "./components/ScheduledOrders";

// ── Navigation items ──────────────────────────────────────────────────────────
const NAV = [
  { path: "/",          label: "Dashboard",    icon: LayoutDashboard },
  { path: "/chart",     label: "Chart",        icon: CandlestickChart },
  { path: "/analytics", label: "Analytics",    icon: BarChart3 },
  { path: "/orders",    label: "Orders",       icon: BookOpen },
  { path: "/positions", label: "Positions",    icon: TrendingUp },
  { path: "/holdings",  label: "Holdings",     icon: Briefcase },
  { path: "/funds",     label: "Funds",        icon: Wallet },
  { path: "/watchlist", label: "Watchlist",    icon: Activity },
  { path: "/basket",    label: "Basket Order", icon: ShoppingCart },
  { path: "/scheduled", label: "Scheduled",    icon: CalendarClock },
];

// ── Auth callback handler ─────────────────────────────────────────────────────
function AuthCallback() {
  const [params] = useSearchParams();
  const { checkStatus } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const status = params.get("auth");
    if (status === "success") {
      toast.success("Authenticated with Rupeezy!");
      checkStatus().then(() => navigate("/", { replace: true }));
    } else {
      navigate("/setup", { replace: true });
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="loading loading-spinner loading-lg text-primary" />
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function TokenExpiry() {
  const { tokenExpiresAt } = useAuth();
  const [remaining, setRemaining] = React.useState("");

  React.useEffect(() => {
    if (!tokenExpiresAt) return;
    const tick = () => {
      const secs = Math.max(0, tokenExpiresAt - Math.floor(Date.now() / 1000));
      if (secs === 0) { setRemaining("Expired"); return; }
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      setRemaining(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tokenExpiresAt]);

  if (!tokenExpiresAt) return null;
  const secs = tokenExpiresAt - Math.floor(Date.now() / 1000);
  const warn = secs < 900; // < 15 min

  return (
    <div className={`flex items-center gap-1.5 text-xs px-4 py-1.5 border-b border-base-300 ${warn ? "text-error" : "text-base-content/40"}`}>
      {warn ? <AlertTriangle className="w-3 h-3 shrink-0" /> : <Clock className="w-3 h-3 shrink-0" />}
      <span>Token expires in {remaining}</span>
    </div>
  );
}

function Sidebar({ open, onClose }) {
  const { wsConnected, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/setup");
    toast("Logged out.");
  };

  return (
    <>
      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-60 bg-base-200 border-r border-base-300 z-40
          flex flex-col transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:z-auto`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-base-300">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">R</span>
            </div>
            <div>
              <div className="font-bold text-sm leading-none">Rupeezy</div>
              <div className="text-xs text-base-content/40 leading-none mt-0.5">Dashboard</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-xs lg:hidden" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* WS status */}
        <div className="px-4 py-2 border-b border-base-300">
          <div className={`flex items-center gap-1.5 text-xs ${wsConnected ? "text-success" : "text-warning"}`}>
            {wsConnected
              ? <><Wifi className="w-3 h-3" /><span>Live feed connected</span></>
              : <><WifiOff className="w-3 h-3" /><span>Feed disconnected</span></>
            }
          </div>
        </div>

        <TokenExpiry />

        {/* Nav links */}
        <nav className="flex-1 py-2 overflow-y-auto scrollbar-thin">
          {NAV.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors mx-2 rounded-lg
                ${isActive
                  ? "bg-primary/15 text-primary font-semibold"
                  : "text-base-content/70 hover:bg-base-300 hover:text-base-content"
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="w-3 h-3 opacity-30" />
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-base-300">
          <button
            className="btn btn-ghost btn-sm w-full justify-start gap-2 text-error hover:bg-error/10"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Dashboard (main overview page) ───────────────────────────────────────────
function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 h-full">
      {/* Left: Order form */}
      <div className="xl:col-span-1 min-h-[500px]">
        <OrderForm onOrderPlaced={() => setRefreshKey((k) => k + 1)} />
      </div>

      {/* Right: Order book */}
      <div className="xl:col-span-2 min-h-[500px]">
        <OrderBook key={refreshKey} />
      </div>
    </div>
  );
}

// ── Main app shell ────────────────────────────────────────────────────────────
function AppShell() {
  const { authenticated, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    if (!loading && !authenticated && window.location.pathname !== "/setup") {
      // Allow callback route to handle itself
      if (window.location.pathname !== "/" || !params.get("auth")) {
        navigate("/setup");
      }
    }
  }, [authenticated, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/setup"    element={<AuthSetup />} />
      <Route path="/callback" element={<AuthCallback />} />
      <Route
        path="/*"
        element={
          !authenticated ? (
            <AuthSetup />
          ) : (
            <div className="flex h-screen overflow-hidden">
              <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <DemoBanner />

              {/* Top bar */}
                <header className="h-14 border-b border-base-300 bg-base-200 flex items-center px-4 gap-3 flex-shrink-0">
                  <button
                    className="btn btn-ghost btn-sm lg:hidden"
                    onClick={() => setSidebarOpen(true)}
                  >
                    <Menu className="w-5 h-5" />
                  </button>

                  {/* Breadcrumb */}
                  <div className="flex-1 text-sm text-base-content/60 hidden sm:block">
                    {NAV.find((n) =>
                      n.path === "/" + window.location.pathname.split("/")[1] ||
                      (n.path === "/" && window.location.pathname === "/")
                    )?.label ?? "Dashboard"}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="badge badge-outline badge-xs text-base-content/50">
                      Rupeezy Vortex
                    </div>
                  </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                  <Routes>
                    <Route path="/"           element={<Dashboard />} />
                    <Route path="/chart"      element={<div className="h-[calc(100vh-7rem)]"><CandleChart /></div>} />
                    <Route path="/analytics"  element={<div className="h-[calc(100vh-7rem)] overflow-y-auto"><Analytics /></div>} />
                    <Route path="/orders"     element={<div className="h-[calc(100vh-7rem)]"><OrderBook /></div>} />
                    <Route path="/positions"  element={<div className="h-[calc(100vh-7rem)]"><Positions /></div>} />
                    <Route path="/holdings"   element={<div className="h-[calc(100vh-7rem)]"><Holdings /></div>} />
                    <Route path="/funds"      element={<Funds />} />
                    <Route path="/watchlist"  element={<div className="h-[calc(100vh-7rem)]"><Watchlist /></div>} />
                    <Route path="/basket"     element={<div className="h-[calc(100vh-7rem)]"><BasketOrder /></div>} />
                    <Route path="/scheduled"  element={<div className="h-[calc(100vh-7rem)] overflow-y-auto"><ScheduledOrders /></div>} />
                  </Routes>
                </main>
              </div>
            </div>
          )
        }
      />
    </Routes>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppShell />
      </SocketProvider>
    </AuthProvider>
  );
}
