import Button from "./Button.jsx";

const roleLabels = {
  admin: "Administrator",
  warehouse_manager: "Warehouse manager",
  supplier: "Supplier",
  sales_rep: "Sales representative"
};
const navigationByRole = {
  admin: [
    { id: "overview", label: "Overview", icon: "⌂" },
    { id: "users", label: "Team", icon: "♙" },
    { id: "warehouses", label: "Warehouses", icon: "▤" },
    { id: "products", label: "Products", icon: "▦" },
    { id: "suppliers", label: "Suppliers", icon: "◉" },
    { id: "low-stock", label: "Low-stock alerts", icon: "◷" },
    { id: "activity", label: "Stock activity", icon: "↗" },
    { id: "orders", label: "Sales orders", icon: "▧" },
    { id: "requests", label: "Supply requests", icon: "⌁" }
  ],
  warehouse_manager: [
    { id: "overview", label: "Overview", icon: "⌂" },
    { id: "inventory", label: "Inventory", icon: "▦" },
    { id: "low-stock", label: "Low stock", icon: "◷" },
    { id: "movements", label: "Stock history", icon: "↗" },
    { id: "requests", label: "Supply requests", icon: "⌁" },
    { id: "orders", label: "Sales orders", icon: "▧" }
  ],
  supplier: [
    { id: "overview", label: "Overview", icon: "⌂" },
    { id: "profile", label: "Company profile", icon: "♙" },
    { id: "products", label: "My products", icon: "▦" },
    { id: "requests", label: "Supply requests", icon: "⌁" }
  ],
  sales_rep: [
    { id: "overview", label: "Overview", icon: "⌂" },
    { id: "catalog", label: "Product catalog", icon: "▦" },
    { id: "orders", label: "My orders", icon: "▧" }
  ]
};

export default function AppShell({ user, section, setSection, theme, onToggleTheme, onLogout, children }) {
  const navigation = navigationByRole[user.role] || navigationByRole.sales_rep;
  const activeSection = navigation.some((item) => item.id === section) ? section : "overview";
  const sectionName = navigation.find((item) => item.id === activeSection)?.label || "Overview";
  return (
    <div className="warehouse-app">
      <aside className="warehouse-sidebar">
        <a className="brand" href="/" aria-label="Stockwise home">
          <span className="brand-mark">S</span><span>stockwise</span>
        </a>
        <div className="sidebar-workspace">
          <span className="workspace-eyebrow">WORKSPACE</span>
          <span className="warehouse-label"><span className="warehouse-label-icon">▤</span> {roleLabels[user.role]} <span className="chevron">⌄</span></span>
        </div>
        <nav className="warehouse-nav" aria-label="Warehouse navigation">
          {navigation.map((item) => (
            <button type="button" key={item.id} className={`warehouse-nav-link ${activeSection === item.id ? "warehouse-nav-active" : ""}`} aria-current={activeSection === item.id ? "page" : undefined} onClick={() => setSection(item.id)}>
              <span className="warehouse-nav-icon">{item.icon}</span><span>{item.label}</span>
              {item.id === "low-stock" && <span className="nav-alert-indicator" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <div className="tip-symbol">✳</div>
            <strong>Inventory, in focus</strong>
            <p>Keep an eye on items that need a restock before they slow you down.</p>
          </div>
          <div className="sidebar-account">
            <span className="account-avatar">{user.username.slice(0, 1).toUpperCase()}</span>
            <span className="account-copy"><strong>{user.username}</strong><small>{roleLabels[user.role]}</small></span>
            <button type="button" className="account-menu" onClick={onLogout} aria-label="Sign out" title="Sign out">↗</button>
          </div>
        </div>
      </aside>

      <main className="warehouse-main">
        <header className="warehouse-topbar">
          <div className="topbar-location"><span>Workspace</span><span className="slash">/</span><strong>{sectionName}</strong></div>
          <div className="topbar-tools">
            <span className="topbar-date">{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
            <span className="topbar-divider" />
            <button type="button" className="theme-toggle" onClick={onToggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`} title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
              <span className="theme-icon">{theme === "light" ? "☾" : "☀"}</span><span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
            </button>
            <Button variant="outline" className="topbar-signout" onClick={onLogout}>Sign out</Button>
          </div>
        </header>
        <div className="warehouse-content">{children}</div>
      </main>
    </div>
  );
}
