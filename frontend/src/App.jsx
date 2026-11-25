import { useCallback, useEffect, useState } from "react";
import { api, sendJson } from "./api.js";
import AppShell from "./components/AppShell.jsx";
import AuthPage from "./components/AuthPage.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import SupplierDashboard from "./pages/SupplierDashboard.jsx";
import SalesDashboard from "./pages/SalesDashboard.jsx";
import WarehouseDashboard from "./pages/WarehouseDashboard.jsx";

function getInitialTheme() {
  try {
    return localStorage.getItem("stockwise-theme") || "dark";
  } catch {
    return "dark";
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [theme, setTheme] = useState(getInitialTheme);
  const [section, setSection] = useState("overview");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("stockwise-theme", theme);
    } catch {
      // The selected theme still applies for this session when storage is unavailable.
    }
  }, [theme]);

  const restoreSession = useCallback(async () => {
    setLoading(true);
    setConnectionError("");
    try {
      const { user: currentUser } = await api("/api/auth/me");
      setUser(currentUser);
      setAuthError("");
    } catch (error) {
      if (error.status !== 401) setConnectionError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  async function authenticate(form, mode) {
    setAuthError("");
    setConnectionError("");
    try {
      const path = mode === "signup" ? "/api/auth/register" : "/api/auth/login";
      const result = await api(path, sendJson("POST", form));
      setUser(result.user);
    } catch (error) {
      setAuthError(error.message);
    }
  }

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
      setSection("overview");
      setAuthError("");
    } catch (error) {
      setAuthError(error.message);
    }
  }

  if (loading) {
    return <main className="loading-screen"><span className="loading-mark">S</span><span>Opening your warehouse…</span></main>;
  }

  if (!user) {
    return (
      <AuthPage
        onAuthenticate={authenticate}
        error={authError}
        connectionError={connectionError}
        onRetry={restoreSession}
        theme={theme}
        onToggleTheme={() => setTheme((current) => current === "light" ? "dark" : "light")}
      />
    );
  }

  return (
    <AppShell
      user={user}
      section={section}
      setSection={setSection}
      theme={theme}
      onToggleTheme={() => setTheme((current) => current === "light" ? "dark" : "light")}
      onLogout={logout}
    >
      {user.role === "admin" && <AdminDashboard user={user} section={section} onNavigate={setSection} />}
      {user.role === "warehouse_manager" && <WarehouseDashboard user={user} section={section} onNavigate={setSection} />}
      {user.role === "supplier" && <SupplierDashboard user={user} section={section} onNavigate={setSection} />}
      {user.role === "sales_rep" && <SalesDashboard user={user} section={section} />}
    </AppShell>
  );
}
