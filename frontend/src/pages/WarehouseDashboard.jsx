import { useCallback, useEffect, useMemo, useState } from "react";
import { api, sendJson } from "../api.js";
import { DataTable, ErrorNotice, MetricGrid, PageHeading, Panel, ProductEditForm, ProductForm, StatusPill, StockActions, useReveal } from "../components/WorkspaceUI.jsx";
import { showToast } from "../lib/alerts.js";
import Button from "../components/Button.jsx";

export default function WarehouseDashboard({ user, section, onNavigate }) {
  const [warehouses, setWarehouses] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [search, setSearch] = useState("");
  const rootRef = useReveal(section, loading);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (["overview", "inventory", "low-stock"].includes(section)) {
        const [warehouseResult, inventoryResult] = await Promise.all([
          api("/api/warehouses"), api(section === "low-stock" ? "/api/warehouses/low-stock" : "/api/warehouses/catalog")
        ]);
        setWarehouses(warehouseResult.warehouses);
        setInventory(inventoryResult.inventory);
      } else if (section === "movements") {
        const { transactions: results } = await api("/api/warehouses/transactions?limit=250");
        setTransactions(results || []);
      } else if (section === "orders") {
        const { orders: results } = await api("/api/orders");
        setOrders(results);
      } else if (section === "requests") {
        const { requests: results } = await api("/api/warehouses/supply-requests");
        setRequests(results);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => { load(); }, [load]);

  const filteredInventory = useMemo(() => {
    const query = search.trim().toLowerCase();
    return inventory.filter((item) => !query || [item.product?.name, item.product?.sku, item.product?.category, item.warehouse?.name, item.binLocation]
      .some((value) => String(value || "").toLowerCase().includes(query)));
  }, [inventory, search]);
  const lowCount = useMemo(() => inventory.filter((item) => item.quantity <= item.reorderLevel).length, [inventory]);
  const totalUnits = useMemo(() => inventory.reduce((sum, item) => sum + Number(item.quantity || 0), 0), [inventory]);
  const inboundUnits = useMemo(() => transactions.filter((item) => ["receipt", "supply_receipt"].includes(item.type)).reduce((sum, item) => sum + Number(item.quantity || 0), 0), [transactions]);
  const outboundUnits = useMemo(() => transactions.filter((item) => ["stock_out", "order_fulfillment"].includes(item.type)).reduce((sum, item) => sum + Number(item.quantity || 0), 0), [transactions]);

  async function updateOrder(order, status) {
    try {
      const result = await api(`/api/orders/${order._id}/status`, sendJson("PATCH", { status }));
      await showToast("success", result.message);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function reviewRequest(request, status) {
    try {
      const result = await api(`/api/warehouses/supply-requests/${request._id}/review`, sendJson("PATCH", { status }));
      await showToast("success", result.message);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const titles = {
    overview: ["Warehouse overview", "A live view of stock and activity across your assigned warehouses."],
    inventory: ["Assigned inventory", "Search products and record stock as it arrives or leaves."],
    "low-stock": ["Low-stock watch", "Items at or below their reorder point need attention."],
    movements: ["Stock history", "Review the transactions recorded in your warehouses."],
    requests: ["Supply requests", "Review incoming product requests from suppliers."],
    orders: ["Sales orders", "Process orders and confirm fulfillment after dispatch."]
  };
  const [title, description] = titles[section] || titles.overview;

  return (
    <div className="dashboard-root" ref={rootRef}>
      <PageHeading eyebrow="WAREHOUSE OPERATIONS" title={title} description={`Good to see you, ${user.username}. ${description}`}
        action={["inventory", "overview"].includes(section) && <Button onClick={() => setShowProductForm((current) => !current)}>{showProductForm ? "Close form" : "＋ Add product"}</Button>} />
      <ErrorNotice message={error} onRetry={load} />
      {showProductForm && <Panel title="Add a product" description="Upload the product image and choose one of your assigned warehouses."><ProductForm warehouses={warehouses} onSaved={async (message) => { setShowProductForm(false); await showToast("success", message); await load(); }} /></Panel>}
      {editingProduct && <Panel title={`Edit ${editingProduct.name}`} description="Replace product images through ImageKit."><ProductEditForm product={editingProduct} onCancel={() => setEditingProduct(null)} onSaved={async (message) => { setEditingProduct(null); await showToast("success", message); await load(); }} /></Panel>}
      {loading ? <div className="inventory-panel"><div className="table-loading">Loading warehouse data…</div></div> : null}
      {!loading && section === "overview" && (
        <>
          <MetricGrid metrics={[
            { label: "WAREHOUSES", value: warehouses.length, description: "Assigned locations", icon: "▤" },
            { label: "PRODUCT LINES", value: inventory.length, description: "Tracked inventory records", icon: "▦" },
            { label: "UNITS ON HAND", value: totalUnits.toLocaleString(), description: "Across assigned warehouses", icon: "⇅" },
            { label: "LOW STOCK", value: lowCount, description: "Items at reorder point", icon: "◷" }
          ]} />
          <Panel title="Needs your attention" description="Low-stock items across your assigned warehouses." action={<Button variant="outline" onClick={() => onNavigate("low-stock")}>View low stock</Button>}>
            <InventoryTable inventory={inventory.filter((item) => item.quantity <= item.reorderLevel).slice(0, 7)} onSaved={async (message) => { await showToast("success", message); await load(); }} onEdit={setEditingProduct} empty="All assigned inventory is above its reorder point." />
          </Panel>
        </>
      )}
      {!loading && ["inventory", "low-stock"].includes(section) && (
        <Panel title={section === "low-stock" ? "Items to replenish" : "All assigned inventory"} description={`${filteredInventory.length} inventory records`} >
          <div className="inventory-toolbar">
            <span className="toolbar-subtitle">Filter by product, SKU, or warehouse</span>
            <label className="search-field"><span>⌕</span><input aria-label="Search inventory" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search inventory" /></label>
          </div>
          <InventoryTable inventory={filteredInventory} onSaved={async (message) => { await showToast("success", message); await load(); }} onEdit={setEditingProduct} empty={section === "low-stock" ? "Nothing needs restocking right now." : "No inventory found."} />
        </Panel>
      )}
      {!loading && section === "movements" && (
        <>
          <MetricGrid metrics={[
            { label: "RECENT MOVEMENTS", value: transactions.length, description: "Latest recorded transactions", icon: "↗" },
            { label: "RECEIVED UNITS", value: inboundUnits.toLocaleString(), description: "Receipts in the recent transaction list", icon: "↓" },
            { label: "OUTBOUND UNITS", value: outboundUnits.toLocaleString(), description: "Stock-outs and processed orders", icon: "↑" }
          ]} />
          <Panel title="Recent transactions"><DataTable rows={transactions} empty="No stock transactions recorded." columns={[
        { label: "Product", render: (row) => <div className="table-product"><strong>{row.product?.name}</strong><small>{row.product?.sku}</small></div> },
        { label: "Warehouse", render: (row) => row.warehouse?.name || "—" },
        { label: "Movement", render: (row) => <StatusPill status={row.type} /> },
        { label: "Quantity", key: "quantity" }, { label: "Before → after", render: (row) => `${row.beforeQuantity} → ${row.afterQuantity}` },
        { label: "Note", key: "note" }, { label: "When", render: (row) => new Date(row.createdAt).toLocaleString() }
          ]} /></Panel>
        </>
      )}
      {!loading && section === "requests" && <Panel title="Supplier requests"><DataTable rows={requests} empty="No supplier requests to review." columns={[
        { label: "Supplier", render: (row) => <div className="table-product"><strong>{row.supplier?.username}</strong><small>{row.supplier?.email}</small></div> },
        { label: "Warehouse", render: (row) => row.warehouse?.name || "—" },
        { label: "Products", render: (row) => row.items?.map((item) => `${item.product?.name || "Product"} × ${item.quantity}`).join(", ") },
        { label: "Status", render: (row) => <StatusPill status={row.status} /> },
        { label: "Review", render: (row) => row.status === "pending" ? <div className="row-actions"><button className="adjust-button" type="button" onClick={() => reviewRequest(row, "approved")}>Approve</button><button className="adjust-button" type="button" onClick={() => reviewRequest(row, "rejected")}>Reject</button></div> : row.reviewNote || "—" }
      ]} /></Panel>}
      {!loading && section === "orders" && <Panel title="Assigned warehouse orders"><DataTable rows={orders} empty="No sales orders in your assigned warehouses." columns={[
        { label: "Order", render: (row) => <strong>#{row._id.slice(-7).toUpperCase()}</strong> },
        { label: "Representative", render: (row) => row.salesRep?.username || "—" },
        { label: "Warehouse", render: (row) => row.warehouse?.name || "—" },
        { label: "Items", render: (row) => row.items?.map((item) => `${item.product?.name || "Product"} × ${item.quantity}`).join(", ") },
        { label: "Total", render: (row) => `$${Number(row.total).toFixed(2)}` },
        { label: "Status", render: (row) => <StatusPill status={row.status} /> },
        { label: "Action", render: (row) => row.status === "pending" ? <button className="adjust-button" type="button" onClick={() => updateOrder(row, "processing")}>Process order</button> : row.status === "processing" ? <button className="adjust-button" type="button" onClick={() => updateOrder(row, "fulfilled")}>Fulfill</button> : "—" }
      ]} /></Panel>}
    </div>
  );
}

function InventoryTable({ inventory, onSaved, onEdit, empty }) {
  return <DataTable rows={inventory} empty={empty} columns={[
    { label: "Product", render: (row) => <div className="table-product"><img src={row.product?.image || undefined} alt="" /><div><strong>{row.product?.name}</strong><small>{row.product?.sku}</small></div></div> },
    { label: "Category", render: (row) => row.product?.category || "General" },
    { label: "Warehouse", render: (row) => row.warehouse?.name || "—" },
    { label: "Location", render: (row) => row.binLocation || "—" },
    { label: "On hand", render: (row) => <strong className="quantity-value">{Number(row.quantity).toLocaleString()}</strong> },
    { label: "Status", render: (row) => <StatusPill status={row.quantity <= row.reorderLevel ? "low_stock" : "in_stock"} /> },
    { label: "Actions", render: (row) => <div className="row-actions"><button type="button" className="adjust-button" onClick={() => onEdit(row.product)}>Edit</button><StockActions entry={row} onSaved={onSaved} /></div> }
  ]} />;
}
