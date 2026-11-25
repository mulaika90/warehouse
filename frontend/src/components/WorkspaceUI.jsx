import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import Swal from "sweetalert2";
import { api } from "../api.js";
import Button from "./Button.jsx";

function normalizeSkuInput(value) {
  return value.toUpperCase().replace(/\s+/g, "-").replace(/^-+/, "");
}

export function useReveal(section, loading) {
  const rootRef = useRef(null);
  useLayoutEffect(() => {
    if (!rootRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const context = gsap.context(() => {
      gsap.fromTo(".reveal", { autoAlpha: 0, y: 12 }, {
        autoAlpha: 1, y: 0, duration: 0.38, stagger: 0.045, ease: "power2.out", clearProps: "all"
      });
    }, rootRef);
    return () => context.revert();
  }, [section, loading]);
  return rootRef;
}

export function PageHeading({ eyebrow = "STOCKWISE WORKSPACE", title, description, action }) {
  return (
    <section className="dashboard-heading reveal">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </section>
  );
}

export function MetricGrid({ metrics }) {
  return (
    <section className="metric-grid">
      {metrics.map((metric, index) => (
        <article className="metric-card reveal" key={metric.label}>
          <div className="metric-card-top">
            <span className={`metric-icon metric-icon-${["green", "blue", "amber"][index % 3]}`}>{metric.icon}</span>
            <span className="metric-caption">{metric.label}</span>
          </div>
          <strong>{metric.value}</strong>
          <span>{metric.description}</span>
        </article>
      ))}
    </section>
  );
}

export function DataTable({ columns, rows, empty = "Nothing to show yet." }) {
  return (
    <div className="inventory-table-wrap">
      {rows.length ? (
        <table className="inventory-table workspace-table">
          <thead><tr>{columns.map((column) => <th key={column.label}>{column.label}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row._id || row.id || `${row.email || row.name || row.sku || "row"}-${index}`}>
                {columns.map((column) => <td key={column.label}>{column.render ? column.render(row) : row[column.key] ?? "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div className="inventory-empty"><span className="empty-box">▤</span><strong>{empty}</strong></div>}
    </div>
  );
}

export function StatusPill({ status }) {
  const label = String(status || "unknown").replaceAll("_", " ");
  return <span className={`status-pill status-${String(status || "").toLowerCase()}`}>{label}</span>;
}

export function ErrorNotice({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="dashboard-error" role="alert">
      <div><strong>Couldn’t load this workspace</strong><p>{message}</p></div>
      {onRetry && <Button variant="outline" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function LoadingState({ text = "Loading workspace…" }) {
  return <div className="table-loading">{text}</div>;
}

export function Panel({ title, description, eyebrow, action, children }) {
  return (
    <section className="inventory-panel workspace-panel reveal">
      <div className="panel-heading">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function FormField({ label, children, className = "" }) {
  return <label className={`workspace-field ${className}`}>{label}{children}</label>;
}

export function ProductForm({ warehouses, suppliers = [], onSaved }) {
  const [form, setForm] = useState({
    name: "", sku: "", category: "", unitPrice: "0", warehouseId: warehouses[0]?._id || "",
    supplierId: "", quantity: "0", reorderLevel: "5", binLocation: "", desc: "", image: null
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!form.warehouseId && warehouses.length) {
      setForm((current) => ({ ...current, warehouseId: warehouses[0]._id }));
    }
  }, [form.warehouseId, warehouses]);

  function update(event) {
    const { name, value, files } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === "image" ? files?.[0] || null : name === "sku" ? normalizeSkuInput(value) : value
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = new FormData();
    for (const [key, value] of Object.entries(form)) {
      if (value !== null && value !== "") body.append(key, value);
    }
    try {
      const result = await api("/api/product/create", { method: "POST", body });
      setForm((current) => ({ ...current, name: "", sku: "", category: "", unitPrice: "0", quantity: "0", reorderLevel: "5", binLocation: "", desc: "", image: null }));
      await onSaved(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="workspace-form" onSubmit={submit}>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="workspace-form-grid">
        <FormField label="Product name"><input name="name" value={form.name} onChange={update} maxLength="120" required /></FormField>
        <FormField label="SKU"><input name="sku" value={form.sku} onChange={update} maxLength="40" pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,39}" placeholder="e.g. WIDGET-001" autoComplete="off" title="Use 2–40 letters or numbers, with optional hyphens or underscores." required /><span className="muted-note">Spaces are converted to hyphens.</span></FormField>
        <FormField label="Category"><input name="category" value={form.category} onChange={update} maxLength="60" required /></FormField>
        <FormField label="Unit price"><input name="unitPrice" type="number" min="0" step="0.01" value={form.unitPrice} onChange={update} required /></FormField>
        <FormField label="Warehouse"><select name="warehouseId" value={form.warehouseId} onChange={update} required><option value="" disabled>{warehouses.length ? "Select a warehouse" : "No warehouses yet — create one first"}</option>{warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.name} · {warehouse.code}</option>)}</select></FormField>
        {suppliers.length > 0 && <FormField label="Supplier"><select name="supplierId" value={form.supplierId} onChange={update}><option value="">No supplier</option>{suppliers.map((supplier) => <option key={supplier.user?._id} value={supplier.user?._id}>{supplier.companyName}</option>)}</select></FormField>}
        <FormField label="Opening quantity"><input name="quantity" type="number" min="0" max="1000000" step="1" value={form.quantity} onChange={update} required /></FormField>
        <FormField label="Reorder point"><input name="reorderLevel" type="number" min="0" max="1000000" step="1" value={form.reorderLevel} onChange={update} required /></FormField>
        <FormField label="Bin location"><input name="binLocation" value={form.binLocation} onChange={update} maxLength="100" /></FormField>
        <FormField label="Product image"><input name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={update} required /></FormField>
        <FormField label="Description" className="workspace-field-wide"><textarea name="desc" value={form.desc} onChange={update} maxLength="1000" rows="2" required /></FormField>
      </div>
      <Button disabled={busy || warehouses.length === 0}>{busy ? "Saving product…" : "Add product"}</Button>
      {!warehouses.length && <span className="muted-note">An admin must create a warehouse first. Managers also need it assigned to their account.</span>}
    </form>
  );
}

export function ProductEditForm({ product, suppliers = [], onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: product.name || "",
    sku: product.sku || "",
    category: product.category || "",
    desc: product.desc || "",
    unitPrice: String(product.unitPrice || 0),
    supplierId: typeof product.supplier === "string" ? product.supplier : product.supplier?._id || "",
    image: null
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function update(event) {
    const { name, value, files } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === "image" ? files?.[0] || null : name === "sku" ? normalizeSkuInput(value) : value
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = new FormData();
    for (const [key, value] of Object.entries(form)) {
      if (value !== null && value !== "") body.append(key, value);
    }
    if (suppliers.length && !form.supplierId) body.append("supplierId", "");
    try {
      const result = await api(`/api/product/${product._id}`, { method: "PATCH", body });
      await onSaved(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="workspace-form" onSubmit={submit}>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="workspace-form-grid">
        <FormField label="Product name"><input name="name" value={form.name} onChange={update} maxLength="120" required /></FormField>
        <FormField label="SKU"><input name="sku" value={form.sku} onChange={update} maxLength="40" pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,39}" placeholder="e.g. WIDGET-001" autoComplete="off" title="Use 2–40 letters or numbers, with optional hyphens or underscores." required /><span className="muted-note">Spaces are converted to hyphens.</span></FormField>
        <FormField label="Category"><input name="category" value={form.category} onChange={update} maxLength="60" required /></FormField>
        <FormField label="Unit price"><input name="unitPrice" type="number" min="0" step="0.01" value={form.unitPrice} onChange={update} required /></FormField>
        {suppliers.length > 0 && <FormField label="Supplier"><select name="supplierId" value={form.supplierId} onChange={update}><option value="">No supplier</option>{suppliers.map((supplier) => <option key={supplier.user?._id} value={supplier.user?._id}>{supplier.companyName}</option>)}</select></FormField>}
        <FormField label="Replace product image"><input name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={update} /></FormField>
        <FormField label="Description" className="workspace-field-wide"><textarea name="desc" value={form.desc} onChange={update} maxLength="1000" rows="2" required /></FormField>
      </div>
      <div className="row-actions"><Button disabled={busy}>{busy ? "Saving changes…" : "Save product"}</Button><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button></div>
    </form>
  );
}

export function StockActions({ entry, onSaved }) {
  async function record(type) {
    const currentQuantity = Number(entry.quantity || 0);
    const dark = document.documentElement.dataset.theme === "dark";
    const result = await Swal.fire({
      title: type === "receipt" ? "Receive stock" : "Record stock out",
      text: `${entry.product?.name || "Product"} · current stock ${currentQuantity.toLocaleString()} units`,
      input: "number",
      inputAttributes: { min: "1", max: "1000000", step: "1", inputmode: "numeric" },
      showCancelButton: true,
      confirmButtonText: type === "receipt" ? "Record receipt" : "Record stock out",
      confirmButtonColor: "#895de8",
      background: dark ? "#17131f" : "#ffffff",
      color: dark ? "#f0eafa" : "#272231",
      inputValidator(value) {
        const quantity = Number(value);
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) return "Enter a whole number between 1 and 1,000,000.";
        if (type === "stock_out" && quantity > currentQuantity) return "Stock cannot be reduced below zero.";
        return undefined;
      }
    });
    if (!result.isConfirmed) return;
    try {
      const response = await api(`/api/warehouses/${entry.warehouse._id}/transactions`, {
        method: "POST",
        body: JSON.stringify({ productId: entry.product._id, type, quantity: Number(result.value) })
      });
      await onSaved(response.message);
    } catch (error) {
      await Swal.fire({ icon: "error", title: "Stock was not updated", text: error.message, background: dark ? "#17131f" : "#ffffff", color: dark ? "#f0eafa" : "#272231" });
    }
  }

  return <div className="row-actions"><button type="button" className="adjust-button" onClick={() => record("receipt")}>Receive</button><button type="button" className="adjust-button" onClick={() => record("stock_out")}>Stock out</button></div>;
}
