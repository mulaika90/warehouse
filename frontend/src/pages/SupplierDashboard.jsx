import { useCallback, useEffect, useMemo, useState } from "react";
import { api, sendJson } from "../api.js";
import Button from "../components/Button.jsx";
import { DataTable, ErrorNotice, FormField, MetricGrid, PageHeading, Panel, StatusPill, useReveal } from "../components/WorkspaceUI.jsx";
import { showToast } from "../lib/alerts.js";

const blankProfile = { companyName: "", phone: "", address: "", logo: null };

export default function SupplierDashboard({ user, section, onNavigate }) {
  const [profile, setProfile] = useState(null);
  const [products, setProducts] = useState([]);
  const [requestProducts, setRequestProducts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [profileForm, setProfileForm] = useState(blankProfile);
  const [requestForm, setRequestForm] = useState({ warehouseId: "", note: "", items: [{ productId: "", quantity: "1" }] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useReveal(section, loading);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (section === "overview") {
        const [profileResult, productResult, requestResult] = await Promise.all([
          api("/api/suppliers/profile"), api("/api/suppliers/products"), api("/api/suppliers/requests")
        ]);
        setProfile(profileResult.profile);
        setProducts(productResult.products);
        setRequests(requestResult.requests);
        if (profileResult.profile) setProfileForm({ companyName: profileResult.profile.companyName, phone: profileResult.profile.phone || "", address: profileResult.profile.address || "", logo: null });
      } else if (section === "profile") {
        const { profile: result } = await api("/api/suppliers/profile");
        setProfile(result);
        if (result) setProfileForm({ companyName: result.companyName, phone: result.phone || "", address: result.address || "", logo: null });
      } else if (section === "products") {
        const { products: results } = await api("/api/suppliers/products");
        setProducts(results);
      } else if (section === "requests") {
        const [requestResult, productResult, warehouseResult, catalogResult] = await Promise.all([
          api("/api/suppliers/requests"), api("/api/suppliers/products"), api("/api/warehouses"), api("/api/suppliers/catalog")
        ]);
        setRequests(requestResult.requests);
        setProducts(productResult.products);
        setRequestProducts(catalogResult.products);
        setWarehouses(warehouseResult.warehouses);
        setRequestForm((current) => ({
          ...current,
          warehouseId: current.warehouseId || warehouseResult.warehouses[0]?._id || "",
          items: current.items.map((item, index) => ({ ...item, productId: item.productId || catalogResult.products[index]?._id || catalogResult.products[0]?._id || "" }))
        }));
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => { load(); }, [load]);

  const pendingCount = useMemo(() => requests.filter((request) => request.status === "pending").length, [requests]);
  const titles = {
    overview: ["Supplier workspace", "Your company profile, associated products, and delivery requests."],
    profile: ["Company profile", "Keep your supplier details and company logo up to date."],
    products: ["Associated products", "Products connected to your supplier account."],
    requests: ["Supply requests", "Submit deliveries and follow each request through review."]
  };
  const [title, description] = titles[section] || titles.overview;

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = new FormData();
    body.append("companyName", profileForm.companyName);
    body.append("phone", profileForm.phone);
    body.append("address", profileForm.address);
    if (profileForm.logo) body.append("logo", profileForm.logo);
    try {
      const result = await api("/api/suppliers/profile", { method: "PUT", body });
      setProfile(result.profile);
      await showToast("success", result.message);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitRequest(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/suppliers/requests", sendJson("POST", {
        warehouseId: requestForm.warehouseId,
        note: requestForm.note,
        items: requestForm.items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) }))
      }));
      await showToast("success", result.message);
      setRequestForm((current) => ({ ...current, note: "", items: [{ productId: requestProducts[0]?._id || "", quantity: "1" }] }));
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function updateRequestItem(index, key, value) {
    setRequestForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)
    }));
  }

  return (
    <div className="dashboard-root" ref={rootRef}>
      <PageHeading eyebrow="SUPPLIER PORTAL" title={title} description={`Welcome, ${profile?.companyName || user.username}. ${description}`} />
      <ErrorNotice message={error} onRetry={load} />
      {loading ? <div className="inventory-panel"><div className="table-loading">Loading supplier data…</div></div> : null}
      {!loading && section === "overview" && profile && (
        <MetricGrid metrics={[
          { label: "PRODUCTS", value: products.length, description: "Products associated with you", icon: "▦" },
          { label: "SUPPLY REQUESTS", value: requests.length, description: "Requests submitted", icon: "⌁" },
          { label: "PENDING", value: pendingCount, description: "Awaiting warehouse review", icon: "◷" }
        ]} />
      )}
      {!loading && section === "overview" && !profile && (
        <Panel title="Set up your supplier profile" description="Add your company information before submitting supply requests." action={<Button onClick={() => onNavigate("profile")}>Create profile</Button>}>
          <div className="inventory-empty"><span className="empty-box">◉</span><strong>Complete your company profile</strong><p>Share your company name, contact details, and logo.</p></div>
        </Panel>
      )}
      {!loading && section === "overview" && profile && (
        <Panel title="Recent supply requests" description="Track the latest request decisions." action={<Button onClick={() => onNavigate("requests")}>Manage requests</Button>}>
          <DataTable rows={requests.slice(0, 5)} empty="No supply requests submitted yet." columns={[
            { label: "Request", render: (row) => <strong>#{row._id.slice(-7).toUpperCase()}</strong> },
            { label: "Warehouse", render: (row) => row.warehouse?.name || "—" },
            { label: "Products", render: (row) => row.items?.map((item) => `${item.product?.name || "Product"} × ${item.quantity}`).join(", ") },
            { label: "Status", render: (row) => <StatusPill status={row.status} /> },
            { label: "Submitted", render: (row) => new Date(row.createdAt).toLocaleDateString() }
          ]} />
        </Panel>
      )}
      {!loading && section === "profile" && (
        <Panel title="Company details" description="Your logo is uploaded securely with ImageKit.">
          <form className="workspace-form" onSubmit={saveProfile}>
            <div className="workspace-form-grid">
              <FormField label="Company name"><input value={profileForm.companyName} onChange={(e) => setProfileForm({ ...profileForm, companyName: e.target.value })} maxLength="120" required /></FormField>
              <FormField label="Phone"><input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} maxLength="40" /></FormField>
              <FormField label="Address"><input value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} maxLength="250" /></FormField>
              <FormField label="Company logo"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setProfileForm({ ...profileForm, logo: e.target.files?.[0] || null })} /></FormField>
            </div>
            {profile?.logoUrl && <img className="supplier-logo-preview" src={profile.logoUrl || undefined} alt={`${profile.companyName} logo`} />}
            <Button disabled={busy}>{busy ? "Saving profile…" : profile ? "Save changes" : "Create supplier profile"}</Button>
          </form>
        </Panel>
      )}
      {!loading && section === "products" && <Panel title="My products" description="These are the items assigned to your supplier account."><DataTable rows={products} empty="No products are associated with your account yet." columns={[
        { label: "Product", render: (row) => <div className="table-product"><img src={row.image || undefined} alt="" /><div><strong>{row.name}</strong><small>{row.sku}</small></div></div> },
        { label: "Category", key: "category" }, { label: "Unit price", render: (row) => `$${Number(row.unitPrice || 0).toFixed(2)}` },
        { label: "Description", key: "desc" }
      ]} /></Panel>}
      {!loading && section === "requests" && (
        <>
          <Panel title="Submit a supply request" description="Choose products from the catalog. Warehouse staff review requests before stock is changed.">
            {!profile ? <div className="inventory-empty"><strong>Create your company profile first</strong><p>Set up your profile before submitting stock requests.</p></div> : (
              <form className="workspace-form" onSubmit={submitRequest}>
                <div className="workspace-form-grid">
                  <FormField label="Deliver to"><select value={requestForm.warehouseId} onChange={(e) => setRequestForm({ ...requestForm, warehouseId: e.target.value })} required><option value="" disabled>{warehouses.length ? "Select a warehouse" : "No warehouses available yet"}</option>{warehouses.map((item) => <option key={item._id} value={item._id}>{item.name} · {item.code}</option>)}</select></FormField>
                  <FormField label="Note (optional)"><input value={requestForm.note} onChange={(e) => setRequestForm({ ...requestForm, note: e.target.value })} maxLength="500" placeholder="Delivery date or details" /></FormField>
                </div>
                {requestForm.items.map((item, index) => {
                  const choices = requestProducts.filter((product) => product._id === item.productId || !requestForm.items.some((other, otherIndex) => otherIndex !== index && other.productId === product._id));
                  return (
                    <div className="request-item-row" key={`request-item-${index}`}>
                      <FormField label={`Product ${index + 1}`}><select value={item.productId} onChange={(e) => updateRequestItem(index, "productId", e.target.value)} required><option value="" disabled>{choices.length ? "Select a product" : "No products in catalog yet"}</option>{choices.map((product) => <option key={product._id} value={product._id}>{product.name} · {product.sku}</option>)}</select></FormField>
                      <FormField label="Quantity"><input type="number" min="1" max="1000000" step="1" value={item.quantity} onChange={(e) => updateRequestItem(index, "quantity", e.target.value)} required /></FormField>
                      <button className="adjust-button" type="button" disabled={requestForm.items.length === 1} onClick={() => setRequestForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}>Remove</button>
                    </div>
                  );
                })}
                <div className="row-actions">
                  <Button type="button" variant="outline" disabled={requestProducts.length === 0 || requestForm.items.length >= Math.min(50, requestProducts.length)} onClick={() => {
                    const selectedIds = new Set(requestForm.items.map((item) => item.productId));
                    const nextProduct = requestProducts.find((product) => !selectedIds.has(product._id));
                    if (nextProduct) setRequestForm((current) => ({ ...current, items: [...current.items, { productId: nextProduct._id, quantity: "1" }] }));
                  }}>＋ Add product</Button>
                  <Button disabled={busy || requestProducts.length === 0 || warehouses.length === 0}>{busy ? "Submitting…" : "Submit request"}</Button>
                </div>
              </form>
            )}
          </Panel>
          <Panel title="Request history"><DataTable rows={requests} empty="No supply requests submitted." columns={[
            { label: "Request", render: (row) => <strong>#{row._id.slice(-7).toUpperCase()}</strong> },
            { label: "Warehouse", render: (row) => row.warehouse?.name || "—" },
            { label: "Products", render: (row) => row.items?.map((item) => `${item.product?.name || "Product"} × ${item.quantity}`).join(", ") },
            { label: "Status", render: (row) => <StatusPill status={row.status} /> },
            { label: "Review note", key: "reviewNote" },
            { label: "Submitted", render: (row) => new Date(row.createdAt).toLocaleDateString() }
          ]} /></Panel>
        </>
      )}
    </div>
  );
}
