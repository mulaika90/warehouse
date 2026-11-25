import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { api, sendJson } from "../api.js";
import Button from "../components/Button.jsx";
import {
  DataTable, ErrorNotice, FormField, MetricGrid, PageHeading, Panel, ProductForm,
  ProductEditForm, StatusPill, useReveal
} from "../components/WorkspaceUI.jsx";
import { showToast } from "../lib/alerts.js";

const emptyData = { stats: null, users: [], warehouses: [], suppliers: [], inventory: [], lowStock: [], transactions: [], orders: [], requests: [] };
const accountRoles = [
  { value: "admin", label: "Admin" },
  { value: "warehouse_manager", label: "Warehouse manager" },
  { value: "supplier", label: "Supplier" },
  { value: "sales_rep", label: "Sales representative" }
];

export default function AdminDashboard({ user, section, onNavigate }) {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warehouseForm, setWarehouseForm] = useState({ name: "", code: "", address: "" });
  const [userForm, setUserForm] = useState({ username: "", email: "", password: "", role: "warehouse_manager", assignedWarehouseIds: [] });
  const [editingUser, setEditingUser] = useState(null);
  const [userDetailsForm, setUserDetailsForm] = useState({ username: "", email: "", password: "" });
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [busy, setBusy] = useState(false);
  const rootRef = useReveal(section, loading);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (section === "overview") {
        const { stats } = await api("/api/admin/stats");
        setData((current) => ({ ...current, stats }));
      } else if (section === "users") {
        const [users, warehouses] = await Promise.all([api("/api/admin/users"), api("/api/admin/warehouses")]);
        setData((current) => ({ ...current, users: users.users, warehouses: warehouses.warehouses }));
      } else if (section === "warehouses") {
        const { warehouses } = await api("/api/admin/warehouses?includeInactive=true");
        setData((current) => ({ ...current, warehouses }));
      } else if (section === "products") {
        const [inventory, warehouses, suppliers] = await Promise.all([
          api("/api/warehouses/catalog"), api("/api/admin/warehouses"), api("/api/admin/suppliers")
        ]);
        setData((current) => ({ ...current, inventory: inventory.inventory, warehouses: warehouses.warehouses, suppliers: suppliers.suppliers }));
      } else if (section === "low-stock") {
        const { inventory } = await api("/api/warehouses/low-stock");
        setData((current) => ({ ...current, lowStock: inventory }));
      } else if (section === "suppliers") {
        const { suppliers } = await api("/api/admin/suppliers");
        setData((current) => ({ ...current, suppliers }));
      } else if (section === "activity") {
        const { transactions } = await api("/api/admin/transactions");
        setData((current) => ({ ...current, transactions }));
      } else if (section === "orders") {
        const { orders } = await api("/api/admin/orders");
        setData((current) => ({ ...current, orders }));
      } else if (section === "requests") {
        const { requests } = await api("/api/admin/supply-requests");
        setData((current) => ({ ...current, requests }));
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => { load(); }, [load]);

  async function saveWarehouse(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const path = editingWarehouse ? `/api/admin/warehouses/${editingWarehouse._id}` : "/api/admin/warehouses";
      const result = await api(path, sendJson(editingWarehouse ? "PATCH" : "POST", warehouseForm));
      setWarehouseForm({ name: "", code: "", address: "" });
      setEditingWarehouse(null);
      await showToast("success", result.message);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveUser(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api("/api/admin/users", sendJson("POST", userForm));
      setUserForm({ username: "", email: "", password: "", role: "warehouse_manager", assignedWarehouseIds: [] });
      await showToast("success", result.message);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveUserDetails(event) {
    event.preventDefault();
    if (!editingUser) return;
    setBusy(true);
    try {
      const updates = { username: userDetailsForm.username, email: userDetailsForm.email };
      if (userDetailsForm.password) updates.password = userDetailsForm.password;
      const result = await api(`/api/admin/users/${editingUser._id}`, sendJson("PATCH", updates));
      setEditingUser(null);
      setUserDetailsForm({ username: "", email: "", password: "" });
      await showToast("success", result.message);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateUserRole(target, role, assignedWarehouseIds = (target.assignedWarehouses || []).map((item) => item._id)) {
    try {
      const warehouses = role === "warehouse_manager" ? assignedWarehouseIds : [];
      await api(`/api/admin/users/${target._id}`, sendJson("PATCH", { role, assignedWarehouseIds: warehouses }));
      await showToast("success", role === target.role ? "Warehouse assignments updated." : "User role updated.");
      await load();
    } catch (requestError) {
      await Swal.fire({ icon: "error", title: "User was not updated", text: requestError.message });
    }
  }

  async function toggleUser(target) {
    try {
      await api(`/api/admin/users/${target._id}`, sendJson("PATCH", { isActive: !target.isActive }));
      await showToast("success", `Account ${target.isActive ? "deactivated" : "activated"}.`);
      await load();
    } catch (requestError) {
      await Swal.fire({ icon: "error", title: "Account was not updated", text: requestError.message });
    }
  }

  async function deleteUser(target) {
    const confirmation = await Swal.fire({
      icon: "warning", title: "Delete this account?",
      text: "Accounts with warehouse history or assignments can only be deactivated.",
      showCancelButton: true, confirmButtonText: "Delete account", confirmButtonColor: "#dc4f74"
    });
    if (!confirmation.isConfirmed) return;
    try {
      const result = await api(`/api/admin/users/${target._id}`, { method: "DELETE" });
      await showToast("success", result.message);
      await load();
    } catch (requestError) {
      await Swal.fire({ icon: "error", title: "Account was not deleted", text: requestError.message });
    }
  }

  async function toggleWarehouse(warehouse) {
    try {
      await api(`/api/admin/warehouses/${warehouse._id}`, sendJson("PATCH", { isActive: !warehouse.isActive }));
      await showToast("success", `Warehouse ${warehouse.isActive ? "deactivated" : "activated"}.`);
      await load();
    } catch (requestError) {
      await Swal.fire({ icon: "error", title: "Warehouse was not updated", text: requestError.message });
    }
  }

  async function deleteWarehouse(warehouse) {
    const confirmation = await Swal.fire({
      icon: "warning", title: "Delete this warehouse?",
      text: "Warehouses with stock, orders, or history must be deactivated instead.",
      showCancelButton: true, confirmButtonText: "Delete warehouse", confirmButtonColor: "#dc4f74"
    });
    if (!confirmation.isConfirmed) return;
    try {
      const result = await api(`/api/admin/warehouses/${warehouse._id}`, { method: "DELETE" });
      await showToast("success", result.message);
      await load();
    } catch (requestError) {
      await Swal.fire({ icon: "error", title: "Warehouse was not deleted", text: requestError.message });
    }
  }

  async function deleteProduct(product) {
    const confirmation = await Swal.fire({
      icon: "warning", title: "Delete this product?",
      text: `${product.name} and its history will be removed only if it has no transactions or stock.`,
      showCancelButton: true, confirmButtonText: "Delete product", confirmButtonColor: "#dc4f74"
    });
    if (!confirmation.isConfirmed) return;
    try {
      await api(`/api/product/${product._id}`, { method: "DELETE" });
      await showToast("success", "Product deleted.");
      await load();
    } catch (requestError) {
      await Swal.fire({ icon: "error", title: "Product was not deleted", text: requestError.message });
    }
  }

  async function updateOrder(order, status) {
    try {
      const result = await api(`/api/admin/orders/${order._id}/status`, sendJson("PATCH", { status }));
      await showToast("success", result.message);
      await load();
    } catch (requestError) {
      await Swal.fire({ icon: "error", title: "Order status was not updated", text: requestError.message });
    }
  }

  async function reviewRequest(request, status) {
    try {
      const result = await api(`/api/admin/supply-requests/${request._id}/review`, sendJson("PATCH", { status }));
      await showToast("success", result.message);
      await load();
    } catch (requestError) {
      await Swal.fire({ icon: "error", title: "Request was not reviewed", text: requestError.message });
    }
  }

  const headings = {
    overview: ["Command center", "Your operation, at a glance."],
    users: ["Team & access", "Create accounts, assign roles, and manage access."],
    warehouses: ["Warehouses", "Create locations and keep active sites up to date."],
    products: ["Product catalog", "Manage products across your warehouse network."],
    suppliers: ["Suppliers", "Review supplier profiles and associated products."],
    "low-stock": ["Low-stock alerts", "Review products at or below their reorder point."],
    activity: ["Stock activity", "A complete record of warehouse stock movements."],
    orders: ["Sales orders", "Review, process, and fulfill orders from every warehouse."],
    requests: ["Supply requests", "Approve or reject incoming supplier requests."]
  };
  const [title, description] = headings[section] || headings.overview;

  return (
    <div className="dashboard-root" ref={rootRef}>
      <PageHeading eyebrow="ADMINISTRATION" title={title} description={`Welcome, ${user.username}. ${description}`}
        action={section === "products" && !data.warehouses.length && <Button onClick={() => onNavigate("warehouses")}>Create warehouse</Button>} />
      <ErrorNotice message={error} onRetry={load} />
      {loading ? <div className="inventory-panel"><div className="table-loading">Loading your workspace…</div></div> : null}
      {!loading && section === "overview" && data.stats && (
        <MetricGrid metrics={[
          { label: "TEAM", value: data.stats.users, description: "Active warehouse accounts", icon: "♙" },
          { label: "PRODUCTS", value: data.stats.products, description: "Items in the catalog", icon: "▦" },
          { label: "WAREHOUSES", value: data.stats.warehouses, description: "Warehouse locations", icon: "▤" },
          { label: "SUPPLIERS", value: data.stats.suppliers, description: "Registered companies", icon: "◉" },
          { label: "ORDERS", value: data.stats.orders, description: "Sales orders recorded", icon: "▧" },
          { label: "LOW STOCK", value: data.stats.lowStock, description: "Items at reorder point", icon: "◷" }
        ]} />
      )}
      {!loading && section === "users" && (
        <>
          <Panel title="Create a team account" description="Admins create warehouse manager and administrator accounts; suppliers and sales reps register themselves.">
            <form className="workspace-form" onSubmit={saveUser}>
              <div className="workspace-form-grid">
                <FormField label="Name"><input value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} minLength="2" maxLength="80" required /></FormField>
                <FormField label="Email"><input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required /></FormField>
                <FormField label="Temporary password"><input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} minLength="8" required /></FormField>
                <FormField label="Role"><select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value, assignedWarehouseIds: [] })}>{accountRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></FormField>
                {userForm.role === "warehouse_manager" && <FormField label="Assigned warehouses"><select multiple value={userForm.assignedWarehouseIds} onChange={(e) => setUserForm({ ...userForm, assignedWarehouseIds: Array.from(e.target.selectedOptions, (option) => option.value) })}>{!data.warehouses.length && <option disabled>No warehouses yet — create one first</option>}{data.warehouses.map((item) => <option key={item._id} value={item._id}>{item.name} · {item.code}</option>)}</select>{!data.warehouses.length && <span className="muted-note">Create a warehouse first, then assign it here so this manager can access inventory.</span>}</FormField>}
              </div>
              <Button disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
            </form>
          </Panel>
          <Panel title="All accounts" description="Role changes take effect immediately; account history is preserved when access is disabled.">
            {editingUser && <form className="workspace-form" onSubmit={saveUserDetails}>
              <div className="workspace-form-grid">
                <FormField label="Name"><input value={userDetailsForm.username} onChange={(e) => setUserDetailsForm({ ...userDetailsForm, username: e.target.value })} minLength="2" maxLength="80" required /></FormField>
                <FormField label="Email"><input type="email" value={userDetailsForm.email} onChange={(e) => setUserDetailsForm({ ...userDetailsForm, email: e.target.value })} required /></FormField>
                <FormField label="Reset password (optional)"><input type="password" value={userDetailsForm.password} onChange={(e) => setUserDetailsForm({ ...userDetailsForm, password: e.target.value })} minLength={userDetailsForm.password ? "8" : undefined} placeholder="Leave blank to keep current password" /></FormField>
              </div>
              <div className="row-actions"><Button disabled={busy}>{busy ? "Saving…" : "Save user changes"}</Button><Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button></div>
            </form>}
            <DataTable rows={data.users} empty="No accounts yet." columns={[
              { label: "Name", render: (row) => <div className="table-product"><strong>{row.username}</strong><small>{row.email}</small></div> },
              { label: "Details", render: (row) => <button className="adjust-button" type="button" onClick={() => { setEditingUser(row); setUserDetailsForm({ username: row.username, email: row.email, password: "" }); }}>Edit</button> },
              { label: "Role", render: (row) => <select className="inline-select" value={row.role} onChange={(e) => updateUserRole(row, e.target.value)}>{accountRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select> },
              { label: "Assigned warehouses", render: (row) => row.role === "warehouse_manager" ? <WarehouseAssignments user={row} warehouses={data.warehouses} onSave={(ids) => updateUserRole(row, row.role, ids)} /> : "—" },
              { label: "Status", render: (row) => <StatusPill status={row.isActive ? "active" : "inactive"} /> },
              { label: "Access", render: (row) => <button className="adjust-button" type="button" disabled={row._id === user.id} onClick={() => toggleUser(row)}>{row.isActive ? "Deactivate" : "Activate"}</button> },
              { label: "Delete", render: (row) => <button className="adjust-button" type="button" disabled={row._id === user.id} onClick={() => deleteUser(row)}>Delete</button> }
            ]} />
          </Panel>
        </>
      )}
      {!loading && section === "warehouses" && (
        <>
          <Panel title={editingWarehouse ? "Update warehouse" : "Add a warehouse"} description="Use a unique code to identify each location.">
            <form className="workspace-form" onSubmit={saveWarehouse}>
              <div className="workspace-form-grid">
                <FormField label="Warehouse name"><input value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} maxLength="100" required /></FormField>
                <FormField label="Code"><input value={warehouseForm.code} onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value.toUpperCase() })} maxLength="30" pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,29}" required /></FormField>
                <FormField label="Address"><input value={warehouseForm.address} onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })} maxLength="250" /></FormField>
              </div>
              <div className="row-actions"><Button disabled={busy}>{busy ? "Saving…" : editingWarehouse ? "Save changes" : "Add warehouse"}</Button>{editingWarehouse && <Button type="button" variant="outline" onClick={() => { setEditingWarehouse(null); setWarehouseForm({ name: "", code: "", address: "" }); }}>Cancel</Button>}</div>
            </form>
          </Panel>
          <Panel title="Warehouse locations">
            <DataTable rows={data.warehouses} empty="No warehouses created." columns={[
              { label: "Warehouse", render: (row) => <div className="table-product"><strong>{row.name}</strong><small>{row.code}</small></div> },
              { label: "Address", key: "address" },
              { label: "Status", render: (row) => <StatusPill status={row.isActive ? "active" : "inactive"} /> },
              { label: "Actions", render: (row) => <div className="row-actions"><button className="adjust-button" type="button" onClick={() => { setEditingWarehouse(row); setWarehouseForm({ name: row.name, code: row.code, address: row.address || "" }); }}>Edit</button><button className="adjust-button" type="button" onClick={() => toggleWarehouse(row)}>{row.isActive ? "Deactivate" : "Activate"}</button><button className="adjust-button" type="button" onClick={() => deleteWarehouse(row)}>Delete</button></div> }
            ]} />
          </Panel>
        </>
      )}
      {!loading && section === "products" && (
        <>
          {editingProduct && <Panel title={`Edit ${editingProduct.name}`} description="Replace product images through ImageKit."><ProductEditForm product={editingProduct} suppliers={data.suppliers} onCancel={() => setEditingProduct(null)} onSaved={async (message) => { setEditingProduct(null); await showToast("success", message); await load(); }} /></Panel>}
          <Panel title="Add a product" description="Images are securely uploaded through ImageKit.">
            <ProductForm warehouses={data.warehouses} suppliers={data.suppliers} onSaved={async (message) => { await showToast("success", message); await load(); }} />
          </Panel>
          <Panel title="Warehouse inventory" description="Product stock is listed by warehouse.">
            <DataTable rows={data.inventory} empty="No inventory found." columns={[
              { label: "Product", render: (row) => <div className="table-product"><img src={row.product?.image || undefined} alt="" /><div><strong>{row.product?.name}</strong><small>{row.product?.sku}</small></div></div> },
              { label: "Category", render: (row) => row.product?.category || "General" },
              { label: "Warehouse", render: (row) => row.warehouse?.name || "—" },
              { label: "On hand", render: (row) => Number(row.quantity).toLocaleString() },
              { label: "Price", render: (row) => `$${Number(row.product?.unitPrice || 0).toFixed(2)}` },
              { label: "Action", render: (row) => <div className="row-actions"><button className="adjust-button" type="button" onClick={() => setEditingProduct(row.product)}>Edit</button><button className="adjust-button" type="button" onClick={() => deleteProduct(row.product)}>Delete</button></div> }
            ]} />
          </Panel>
        </>
      )}
      {!loading && section === "suppliers" && <Panel title="Supplier directory"><DataTable rows={data.suppliers} empty="Supplier profiles will appear here after signup." columns={[
        { label: "Company", render: (row) => <div className="table-product">{row.logoUrl && <img src={row.logoUrl} alt="" />}<div><strong>{row.companyName}</strong><small>{row.user?.username} · {row.user?.email}</small></div></div> },
        { label: "Phone", key: "phone" }, { label: "Address", key: "address" },
        { label: "Account", render: (row) => <StatusPill status={row.user?.isActive ? "active" : "inactive"} /> }
      ]} /></Panel>}
      {!loading && section === "low-stock" && <Panel title="Products requiring replenishment"><DataTable rows={data.lowStock} empty="All products are above their reorder level." columns={[
        { label: "Product", render: (row) => <div className="table-product"><img src={row.product?.image || undefined} alt="" /><div><strong>{row.product?.name}</strong><small>{row.product?.sku}</small></div></div> },
        { label: "Warehouse", render: (row) => row.warehouse?.name || "—" },
        { label: "On hand", render: (row) => Number(row.quantity).toLocaleString() },
        { label: "Reorder at", render: (row) => Number(row.reorderLevel).toLocaleString() },
        { label: "Status", render: () => <StatusPill status="low_stock" /> }
      ]} /></Panel>}
      {!loading && section === "activity" && <Panel title="Recent stock transactions"><DataTable rows={data.transactions} empty="No stock transactions recorded." columns={[
        { label: "Product", render: (row) => <div className="table-product"><strong>{row.product?.name}</strong><small>{row.product?.sku}</small></div> },
        { label: "Warehouse", render: (row) => row.warehouse?.name || "—" }, { label: "Movement", render: (row) => <StatusPill status={row.type} /> },
        { label: "Quantity", key: "quantity" }, { label: "Before → after", render: (row) => `${row.beforeQuantity} → ${row.afterQuantity}` },
        { label: "Performed by", render: (row) => row.performedBy?.username || "—" }, { label: "Date", render: (row) => new Date(row.createdAt).toLocaleString() }
      ]} /></Panel>}
      {!loading && section === "orders" && <Panel title="All sales orders"><DataTable rows={data.orders} empty="No sales orders yet." columns={[
        { label: "Order", render: (row) => <strong>#{row._id.slice(-7).toUpperCase()}</strong> },
        { label: "Representative", render: (row) => row.salesRep?.username || "—" }, { label: "Warehouse", render: (row) => row.warehouse?.name || "—" },
        { label: "Items", render: (row) => row.items?.length || 0 }, { label: "Total", render: (row) => `$${Number(row.total).toFixed(2)}` },
        { label: "Status", render: (row) => <StatusPill status={row.status} /> },
        { label: "Action", render: (row) => row.status === "pending" ? <button className="adjust-button" type="button" onClick={() => updateOrder(row, "processing")}>Process order</button> : row.status === "processing" ? <button className="adjust-button" type="button" onClick={() => updateOrder(row, "fulfilled")}>Fulfill</button> : "—" }
      ]} /></Panel>}
      {!loading && section === "requests" && <Panel title="Supplier requests"><DataTable rows={data.requests} empty="No supplier requests yet." columns={[
        { label: "Supplier", render: (row) => row.supplier?.username || "—" }, { label: "Warehouse", render: (row) => row.warehouse?.name || "—" },
        { label: "Products", render: (row) => row.items?.map((item) => `${item.product?.name || "Product"} × ${item.quantity}`).join(", ") },
        { label: "Status", render: (row) => <StatusPill status={row.status} /> }, { label: "Submitted", render: (row) => new Date(row.createdAt).toLocaleDateString() },
        { label: "Review", render: (row) => row.status === "pending" ? <div className="row-actions"><button className="adjust-button" type="button" onClick={() => reviewRequest(row, "approved")}>Approve</button><button className="adjust-button" type="button" onClick={() => reviewRequest(row, "rejected")}>Reject</button></div> : row.reviewNote || "—" }
      ]} /></Panel>}
    </div>
  );
}

function WarehouseAssignments({ user, warehouses, onSave }) {
  const [selected, setSelected] = useState((user.assignedWarehouses || []).map((warehouse) => warehouse._id));
  useEffect(() => {
    setSelected((user.assignedWarehouses || []).map((warehouse) => warehouse._id));
  }, [user.assignedWarehouses]);
  return (
    <div className="row-actions">
      <select className="inline-select" multiple value={selected} onChange={(event) => setSelected(Array.from(event.target.selectedOptions, (option) => option.value))} aria-label={`Assign warehouses to ${user.username}`}>
        {!warehouses.length && <option disabled>No warehouses yet — create one first</option>}
        {warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.name} · {warehouse.code}</option>)}
      </select>
      {!warehouses.length && <span className="muted-note">Create a warehouse first.</span>}
      <button className="adjust-button" type="button" onClick={() => onSave(selected)}>Save</button>
    </div>
  );
}
