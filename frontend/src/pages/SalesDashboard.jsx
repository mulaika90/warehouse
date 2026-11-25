import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { api, sendJson } from "../api.js";
import Button from "../components/Button.jsx";
import { DataTable, ErrorNotice, FormField, MetricGrid, PageHeading, Panel, StatusPill, useReveal } from "../components/WorkspaceUI.jsx";
import { showToast } from "../lib/alerts.js";

export default function SalesDashboard({ user, section, onNavigate }) {
  const [warehouses, setWarehouses] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [orderItems, setOrderItems] = useState([{ productId: "", quantity: "1" }]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useReveal(section, loading);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (section === "overview" || section === "catalog") {
        const [warehouseResult, catalogResult] = await Promise.all([api("/api/warehouses"), api("/api/warehouses/catalog")]);
        setWarehouses(warehouseResult.warehouses);
        setInventory(catalogResult.inventory);
        const availableWarehouses = new Set(warehouseResult.warehouses.map((item) => item._id));
        const catalog = catalogResult.inventory.filter((item) => availableWarehouses.has(item.warehouse?._id));
        const chosenWarehouse = warehouseResult.warehouses.some((item) => item._id === warehouseId)
          ? warehouseId : warehouseResult.warehouses[0]?._id || "";
        setWarehouseId(chosenWarehouse);
        const available = catalog.filter((item) => item.warehouse?._id === chosenWarehouse);
        setOrderItems((current) => current.map((item, index) => ({
          ...item,
          productId: available.some((product) => product.product?._id === item.productId)
            ? item.productId : available[index]?.product?._id || available[0]?.product?._id || ""
        })));
      }
      if (section === "overview" || section === "orders") {
        const { orders: results } = await api("/api/orders");
        setOrders(results);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [section, warehouseId]);

  useEffect(() => { load(); }, [load]);

  const selectedInventory = useMemo(() => inventory.filter((item) => item.warehouse?._id === warehouseId), [inventory, warehouseId]);
  const categories = useMemo(() => [...new Set(inventory.map((item) => item.product?.category || "General"))].sort(), [inventory]);
  const visibleInventory = useMemo(() => {
    const query = search.trim().toLowerCase();
    return inventory.filter((item) => {
      if (category !== "all" && (item.product?.category || "General") !== category) return false;
      return !query || [item.product?.name, item.product?.sku, item.product?.category, item.warehouse?.name, item.binLocation]
        .some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [inventory, search, category]);
  const activeOrders = useMemo(() => orders.filter((order) => !["fulfilled", "cancelled"].includes(order.status)).length, [orders]);
  const pendingOrders = useMemo(() => orders.filter((order) => order.status === "pending").length, [orders]);

  async function submitOrder(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/orders", sendJson("POST", {
        warehouseId,
        items: orderItems.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) }))
      }));
      await showToast("success", result.message);
      setOrderItems([{ productId: selectedInventory[0]?.product?._id || "", quantity: "1" }]);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder(order) {
    const confirmation = await Swal.fire({
      icon: "warning", title: "Cancel this order?",
      text: "Only pending, unprocessed orders can be cancelled.",
      showCancelButton: true, confirmButtonText: "Cancel order", confirmButtonColor: "#dc4f74"
    });
    if (!confirmation.isConfirmed) return;
    try {
      const result = await api(`/api/orders/${order._id}/cancel`, { method: "PATCH" });
      await showToast("success", result.message);
      await load();
    } catch (requestError) {
      await Swal.fire({ icon: "error", title: "Order was not cancelled", text: requestError.message });
    }
  }

  function updateOrderItem(index, key, value) {
    setOrderItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  const titles = {
    overview: ["Sales workspace", "Find available products and manage your order history."],
    catalog: ["Product catalog", "Search products by name, SKU, category, or warehouse."],
    orders: ["My orders", "Track order status and cancel an order while it is still pending."]
  };
  const [title, description] = titles[section] || titles.overview;

  return (
    <div className="dashboard-root" ref={rootRef}>
      <PageHeading eyebrow="SALES WORKSPACE" title={title} description={`Welcome, ${user.username}. ${description}`}
        action={section === "overview" && <Button onClick={() => onNavigate("catalog")}>Browse catalog <span>→</span></Button>} />
      <ErrorNotice message={error} onRetry={load} />
      {loading ? <div className="inventory-panel"><div className="table-loading">Loading sales workspace…</div></div> : null}
      {!loading && section === "overview" && (
        <>
          <MetricGrid metrics={[
            { label: "AVAILABLE PRODUCTS", value: inventory.length, description: "Stock lines across warehouses", icon: "▦" },
            { label: "ACTIVE ORDERS", value: activeOrders, description: "Orders not yet completed", icon: "▧" },
            { label: "PENDING", value: pendingOrders, description: "Orders awaiting processing", icon: "◷" }
          ]} />
          <Panel title="Recent orders" description="Your latest sales activity." action={<Button variant="outline" onClick={() => onNavigate("orders")}>Order history</Button>}>
            <OrderTable orders={orders.slice(0, 5)} onCancel={cancelOrder} />
          </Panel>
        </>
      )}
      {!loading && section === "catalog" && (
        <>
          <Panel title="Create a multi-product order" description="Available quantity and product pricing are checked by the server before an order is accepted.">
            {!selectedInventory.length ? <div className="inventory-empty"><strong>No stock is currently available</strong><p>An admin must create a warehouse and product, then a manager can record stock before you can place an order.</p></div> : (
              <form className="workspace-form" onSubmit={submitOrder}>
                <FormField label="Fulfill from">
                  <select value={warehouseId} onChange={(e) => {
                    setWarehouseId(e.target.value);
                    setOrderItems([{ productId: "", quantity: "1" }]);
                  }}>
                    {warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.name} · {warehouse.code}</option>)}
                  </select>
                </FormField>
                {orderItems.map((item, index) => {
                  const selected = selectedInventory.find((product) => product.product?._id === item.productId);
                  const availableOptions = selectedInventory.filter((entry) => entry.product?._id === item.productId || !orderItems.some((other, otherIndex) => otherIndex !== index && other.productId === entry.product?._id));
                  return (
                    <div className="request-item-row" key={`order-item-${index}`}>
                      <FormField label={`Product ${index + 1}`}>
                        <select value={item.productId} onChange={(e) => updateOrderItem(index, "productId", e.target.value)} required>
                          {availableOptions.map((entry) => <option key={entry.product?._id} value={entry.product?._id}>{entry.product?.name} · {entry.product?.sku} · {entry.quantity} in stock</option>)}
                        </select>
                      </FormField>
                      <FormField label={`Quantity (max ${selected?.quantity ?? 0})`}>
                        <input type="number" min="1" max={selected?.quantity || 1} step="1" value={item.quantity} onChange={(e) => updateOrderItem(index, "quantity", e.target.value)} required />
                      </FormField>
                      <span className="request-price">{`$${Number(selected?.product?.unitPrice || 0).toFixed(2)} each`}</span>
                      <button className="adjust-button" type="button" disabled={orderItems.length === 1} onClick={() => setOrderItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                    </div>
                  );
                })}
                <div className="row-actions">
                  <Button type="button" variant="outline" disabled={orderItems.length >= Math.min(50, selectedInventory.length)} onClick={() => {
                    const selectedIds = new Set(orderItems.map((item) => item.productId));
                    const nextProduct = selectedInventory.find((entry) => !selectedIds.has(entry.product?._id));
                    if (nextProduct) setOrderItems((current) => [...current, { productId: nextProduct.product._id, quantity: "1" }]);
                  }}>＋ Add product</Button>
                  <Button disabled={busy}>{busy ? "Creating order…" : "Submit sales order"}</Button>
                </div>
              </form>
            )}
          </Panel>
          <Panel title="Available inventory" description={`${visibleInventory.length} matching items`}>
            <div className="inventory-toolbar">
              <div className="inventory-filters">
                <label className="search-field"><span>⌕</span><input aria-label="Search product catalog" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, SKU, warehouse" /></label>
                <select aria-label="Filter product category" value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              </div>
            </div>
            <DataTable rows={visibleInventory} empty="No products match your search." columns={[
              { label: "Product", render: (row) => <div className="table-product"><img src={row.product?.image || undefined} alt="" /><div><strong>{row.product?.name}</strong><small>{row.product?.sku}</small></div></div> },
              { label: "Category", render: (row) => row.product?.category || "General" },
              { label: "Warehouse", render: (row) => row.warehouse?.name || "—" },
              { label: "Location", render: (row) => row.binLocation || "—" },
              { label: "Available", render: (row) => <strong className="quantity-value">{Number(row.quantity).toLocaleString()}</strong> },
              { label: "Unit price", render: (row) => `$${Number(row.product?.unitPrice || 0).toFixed(2)}` }
            ]} />
          </Panel>
        </>
      )}
      {!loading && section === "orders" && <Panel title="Order history"><OrderTable orders={orders} onCancel={cancelOrder} /></Panel>}
    </div>
  );
}

function OrderTable({ orders, onCancel }) {
  return <DataTable rows={orders} empty="No sales orders yet." columns={[
    { label: "Order", render: (row) => <strong>#{row._id.slice(-7).toUpperCase()}</strong> },
    { label: "Warehouse", render: (row) => row.warehouse?.name || "—" },
    { label: "Items", render: (row) => row.items?.map((item) => `${item.product?.name || "Product"} × ${item.quantity}`).join(", ") },
    { label: "Total", render: (row) => `$${Number(row.total).toFixed(2)}` },
    { label: "Status", render: (row) => <StatusPill status={row.status} /> },
    { label: "Submitted", render: (row) => new Date(row.createdAt).toLocaleDateString() },
    { label: "Action", render: (row) => row.status === "pending" ? <button className="adjust-button" type="button" onClick={() => onCancel(row)}>Cancel order</button> : "—" }
  ]} />;
}
