import { useState } from "react";
import Button from "./Button.jsx";

export default function AuthPage({ onAuthenticate, error, connectionError, onRetry, theme, onToggleTheme }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ identity: "", username: "", email: "", role: "sales_rep", password: "" });
  const [busy, setBusy] = useState(false);

  function update(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await onAuthenticate(form, mode);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <a className="brand brand-on-dark" href="/" aria-label="Stockwise warehouse home">
          <span className="brand-mark">S</span><span>stockwise</span>
        </a>
        <div className="login-story-copy">
          <span className="eyebrow">WAREHOUSE OPERATIONS, MADE CLEAR</span>
          <h1>Know your stock.<br /><span>Move with confidence.</span></h1>
          <p>One calm workspace to keep every item accounted for and every stock decision in view.</p>
          <div className="login-promise"><span className="promise-icon">✓</span> A clearer view of your warehouse, every day</div>
        </div>
        <div className="story-grid story-grid-one" />
        <div className="story-grid story-grid-two" />
        <div className="story-orb story-orb-one" />
        <div className="story-orb story-orb-two" />
      </section>

      <section className="login-panel">
        <button type="button" className="auth-theme-toggle" onClick={onToggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
          {theme === "light" ? "☾" : "☀"}<span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
        </button>
        <div className="login-card">
          <a className="brand login-mobile-brand" href="/" aria-label="Stockwise warehouse home">
            <span className="brand-mark">S</span><span>stockwise</span>
          </a>
          <span className="eyebrow">{mode === "login" ? "YOUR WAREHOUSE WORKSPACE" : "GET STARTED"}</span>
          <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="login-subtitle">{mode === "login" ? "Sign in to your Stockwise workspace." : "Join Stockwise as a supplier or sales representative."}</p>
          {connectionError && (
            <div className="connection-banner" role="status">
              <span className="connection-icon">!</span>
              <div><strong>Warehouse service is offline</strong><p>{connectionError}</p><button type="button" onClick={onRetry}>Retry connection</button></div>
            </div>
          )}
          {error && <div className="form-error" role="alert">{error}</div>}
          <form onSubmit={submit} className="login-form">
            {mode === "signup" ? (
              <>
                <label htmlFor="username">Your name</label>
                <input id="username" name="username" value={form.username} onChange={update} autoComplete="name" minLength="2" maxLength="80" placeholder="Enter your name" required />
                <label htmlFor="email">Email address</label>
                <input id="email" name="email" type="email" value={form.email} onChange={update} autoComplete="email" placeholder="you@company.com" required />
                <label htmlFor="role">I am a</label>
                <select id="role" name="role" value={form.role} onChange={update}>
                  <option value="sales_rep">Sales representative</option>
                  <option value="supplier">Supplier</option>
                </select>
              </>
            ) : (
              <>
                <label htmlFor="identity">Email or username</label>
                <input id="identity" name="identity" value={form.identity} onChange={update} autoComplete="username" placeholder="Enter your email or username" required />
              </>
            )}
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" value={form.password} onChange={update} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength="8" placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"} required />
            <Button className="full-width login-submit" disabled={busy}>{busy ? (mode === "login" ? "Signing in…" : "Creating account…") : (mode === "login" ? "Sign in to Stockwise" : "Create account")}<span aria-hidden="true">→</span></Button>
          </form>
          <div className="login-divider"><span /></div>
          <p className="login-footnote"><span className="secure-dot" /> {mode === "login" ? "Secure access for your warehouse team" : "Admin and warehouse manager accounts are created by an administrator"}</p>
          <button type="button" className="auth-mode-toggle" onClick={() => { setMode((current) => current === "login" ? "signup" : "login"); setForm({ identity: "", username: "", email: "", role: "sales_rep", password: "" }); }}>
            {mode === "login" ? "New to Stockwise? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
        <div className="login-footer">© {new Date().getFullYear()} Stockwise <span>·</span> Inventory, in focus.</div>
      </section>
    </main>
  );
}
