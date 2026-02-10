import { useState, useEffect, useReducer, useCallback } from "react";

// ─── Supabase Client ───
const SUPABASE_URL = "https://hlqbjomeomahoocexljp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhscWJqb21lb21haG9vY2V4bGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MTkwMTQsImV4cCI6MjA4NjE5NTAxNH0.X9biLUFgktgw6H8ytkfvF6gnITJCEwLiHMw71IcUhGk";

// Lightweight Supabase client (no SDK needed)
const supabase = {
  token: null,
  user: null,

  headers(extra = {}) {
    const h = {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      ...extra,
    };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  },

  async auth_signUp(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || data.msg || "Signup failed");
    if (data.access_token) {
      this.token = data.access_token;
      this.user = data.user;
    }
    return data;
  },

  async auth_signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error_description || data.msg || "Login failed");
    this.token = data.access_token;
    this.user = data.user;
    return data;
  },

  async auth_signOut() {
    if (this.token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: this.headers(),
      }).catch(() => {});
    }
    this.token = null;
    this.user = null;
  },

  async auth_getUser() {
    if (!this.token) return null;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: this.headers(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    this.user = data;
    return data;
  },

  // Database operations via PostgREST
  async from(table) {
    return {
      _table: table,
      _filters: [],
      _order: null,
      _limit: null,
      _single: false,

      eq(col, val) { this._filters.push(`${col}=eq.${val}`); return this; },
      order(col, opts = {}) { this._order = `${col}.${opts.ascending === false ? "desc" : "asc"}`; return this; },
      limit(n) { this._limit = n; return this; },
      single() { this._single = true; return this; },

      async select(cols = "*") {
        let url = `${SUPABASE_URL}/rest/v1/${this._table}?select=${cols}`;
        this._filters.forEach((f) => (url += `&${f}`));
        if (this._order) url += `&order=${this._order}`;
        if (this._limit) url += `&limit=${this._limit}`;
        const res = await fetch(url, {
          headers: {
            ...supabase.headers(),
            ...(this._single ? { Accept: "application/vnd.pgrst.object+json" } : {}),
          },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { data: null, error: err };
        }
        const data = await res.json();
        return { data, error: null };
      },

      async insert(rows) {
        const body = Array.isArray(rows) ? rows : [rows];
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${this._table}`, {
          method: "POST",
          headers: { ...supabase.headers(), Prefer: "return=representation" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { data: null, error: err };
        }
        const data = await res.json();
        return { data, error: null };
      },

      async update(values) {
        let url = `${SUPABASE_URL}/rest/v1/${this._table}?`;
        url += this._filters.join("&");
        const res = await fetch(url, {
          method: "PATCH",
          headers: { ...supabase.headers(), Prefer: "return=representation" },
          body: JSON.stringify(values),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { data: null, error: err };
        }
        const data = await res.json();
        return { data, error: null };
      },

      async delete() {
        let url = `${SUPABASE_URL}/rest/v1/${this._table}?`;
        url += this._filters.join("&");
        const res = await fetch(url, {
          method: "DELETE",
          headers: { ...supabase.headers(), Prefer: "return=representation" },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { data: null, error: err };
        }
        const data = await res.json();
        return { data, error: null };
      },
    };
  },

  // Storage operations
  async uploadFile(bucket, path, file) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${this.token}`,
      },
      body: file,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err };
    }
    const data = await res.json();
    return { data, error: null };
  },

  getPublicUrl(bucket, path) {
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  },

  async getSignedUrl(bucket, path, expiresIn = 3600) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ expiresIn }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return `${SUPABASE_URL}/storage/v1${data.signedURL}`;
  },
};

// Helper to get a chainable query builder
const db = (table) => {
  const obj = {
    _table: table,
    _filters: [],
    _order: null,
    _limit: null,
    _single: false,

    eq(col, val) { this._filters.push(`${col}=eq.${val}`); return this; },
    neq(col, val) { this._filters.push(`${col}=neq.${val}`); return this; },
    order(col, opts = {}) { this._order = `${col}.${opts.ascending === false ? "desc" : "asc"}`; return this; },
    limit(n) { this._limit = n; return this; },
    single() { this._single = true; return this; },

    async select(cols = "*") {
      let url = `${SUPABASE_URL}/rest/v1/${this._table}?select=${cols}`;
      this._filters.forEach((f) => (url += `&${f}`));
      if (this._order) url += `&order=${this._order}`;
      if (this._limit) url += `&limit=${this._limit}`;
      const res = await fetch(url, {
        headers: {
          ...supabase.headers(),
          ...(this._single ? { Accept: "application/vnd.pgrst.object+json" } : {}),
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { data: null, error: err };
      }
      return { data: await res.json(), error: null };
    },

    async insert(rows) {
      const body = Array.isArray(rows) ? rows : [rows];
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${this._table}`, {
        method: "POST",
        headers: { ...supabase.headers(), Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { data: null, error: err };
      }
      return { data: await res.json(), error: null };
    },

    async update(values) {
      let url = `${SUPABASE_URL}/rest/v1/${this._table}?`;
      url += this._filters.join("&");
      const res = await fetch(url, {
        method: "PATCH",
        headers: { ...supabase.headers(), Prefer: "return=representation" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { data: null, error: err };
      }
      return { data: await res.json(), error: null };
    },

    async delete() {
      let url = `${SUPABASE_URL}/rest/v1/${this._table}?`;
      url += this._filters.join("&");
      const res = await fetch(url, {
        method: "DELETE",
        headers: { ...supabase.headers(), Prefer: "return=representation" },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { data: null, error: err };
      }
      return { data: await res.json(), error: null };
    },
  };
  return obj;
};


// ─── State Management ───
const initialState = {
  user: null,
  business: null,
  screen: "login",
  quotes: [],
  sequences: [],
  notification: null,
  loading: false,
};

function appReducer(state, action) {
  switch (action.type) {
    case "SET_USER":
      return { ...state, user: action.payload };
    case "SET_BUSINESS":
      return { ...state, business: action.payload, screen: "dashboard" };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "LOGOUT":
      return { ...initialState };
    case "SET_SCREEN":
      return { ...state, screen: action.payload };
    case "SET_QUOTES":
      return { ...state, quotes: action.payload };
    case "ADD_QUOTE":
      return { ...state, quotes: [action.payload, ...state.quotes], screen: "quotes" };
    case "UPDATE_QUOTE":
      return {
        ...state,
        quotes: state.quotes.map((q) =>
          q.id === action.payload.id ? { ...q, ...action.payload } : q
        ),
      };
    case "SET_SEQUENCES":
      return { ...state, sequences: action.payload };
    case "ADD_SEQUENCE":
      return { ...state, sequences: [action.payload, ...state.sequences] };
    case "UPDATE_SEQUENCE":
      return {
        ...state,
        sequences: state.sequences.map((s) =>
          s.id === action.payload.id ? { ...s, ...action.payload } : s
        ),
      };
    case "NOTIFY":
      return { ...state, notification: action.payload };
    case "CLEAR_NOTIFY":
      return { ...state, notification: null };
    default:
      return state;
  }
}

// ─── Theme ───
const theme = {
  bg: "#0C0F14",
  surface: "#151921",
  surfaceLight: "#1C2230",
  surfaceHover: "#232A3A",
  border: "#2A3244",
  borderLight: "#3A4560",
  accent: "#F59E0B",
  accentHover: "#D97706",
  accentSoft: "rgba(245, 158, 11, 0.12)",
  accentGlow: "rgba(245, 158, 11, 0.25)",
  green: "#22C55E",
  greenSoft: "rgba(34, 197, 94, 0.12)",
  red: "#EF4444",
  redSoft: "rgba(239, 68, 68, 0.12)",
  blue: "#3B82F6",
  blueSoft: "rgba(59, 130, 246, 0.12)",
  text: "#F1F3F7",
  textMuted: "#8B95A8",
  textDim: "#5C6578",
  font: "'DM Sans', sans-serif",
  fontDisplay: "'Playfair Display', serif",
};

const statusConfig = {
  draft: { label: "Draft", color: theme.textMuted, bg: "rgba(139,149,168,0.12)" },
  pending: { label: "Pending", color: theme.blue, bg: theme.blueSoft },
  sent: { label: "Sent", color: theme.accent, bg: theme.accentSoft },
  opened: { label: "Opened", color: "#A855F7", bg: "rgba(168,85,247,0.12)" },
  accepted: { label: "Accepted", color: theme.green, bg: theme.greenSoft },
  declined: { label: "Declined", color: theme.red, bg: theme.redSoft },
  feedback: { label: "Feedback", color: theme.blue, bg: theme.blueSoft },
};

const fonts = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Playfair+Display:wght@700;800&display=swap');`;

// ─── Utility Components ───
const Badge = ({ status }) => {
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px",
      borderRadius: 20, fontSize: 12, fontWeight: 600, letterSpacing: 0.3,
      color: config.color, background: config.bg, textTransform: "uppercase",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: config.color }} />
      {config.label}
    </span>
  );
};

const Button = ({ children, variant = "primary", size = "md", onClick, style = {}, disabled }) => {
  const base = {
    fontFamily: theme.font, fontWeight: 600, border: "none", cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 8,
    transition: "all 0.2s ease", opacity: disabled ? 0.5 : 1,
    fontSize: size === "sm" ? 13 : 14,
    padding: size === "sm" ? "8px 16px" : "12px 24px",
  };
  const variants = {
    primary: { background: theme.accent, color: "#000", boxShadow: `0 0 20px ${theme.accentGlow}` },
    secondary: { background: theme.surfaceLight, color: theme.text, border: `1px solid ${theme.border}` },
    ghost: { background: "transparent", color: theme.textMuted },
    danger: { background: theme.redSoft, color: theme.red },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
};

const Input = ({ label, value, onChange, type = "text", placeholder, textarea, style = {}, accept, onFileChange }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
    {label && <label style={{ fontSize: 13, fontWeight: 500, color: theme.textMuted, letterSpacing: 0.3 }}>{label}</label>}
    {textarea ? (
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{
          fontFamily: theme.font, fontSize: 14, padding: "12px 16px", borderRadius: 10,
          background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text,
          outline: "none", resize: "vertical", minHeight: 100,
        }} />
    ) : type === "file" ? (
      <input type="file" accept={accept} onChange={onFileChange}
        style={{
          fontFamily: theme.font, fontSize: 14, padding: "12px 16px", borderRadius: 10,
          background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, outline: "none",
        }} />
    ) : (
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{
          fontFamily: theme.font, fontSize: 14, padding: "12px 16px", borderRadius: 10,
          background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, outline: "none",
        }} />
    )}
  </div>
);

const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{
    background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16,
    padding: 24, transition: "all 0.2s ease", cursor: onClick ? "pointer" : "default", ...style,
  }}>
    {children}
  </div>
);

const Stat = ({ label, value, accent, icon }) => (
  <Card style={{ flex: 1, minWidth: 160 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 8, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: accent || theme.text, fontFamily: theme.fontDisplay }}>{value}</div>
      </div>
      <div style={{ fontSize: 24, opacity: 0.6 }}>{icon}</div>
    </div>
  </Card>
);

const Spinner = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
    <div style={{
      width: 32, height: 32, border: `3px solid ${theme.border}`, borderTopColor: theme.accent,
      borderRadius: "50%", animation: "spin 0.8s linear infinite",
    }} />
  </div>
);

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  const colors = { success: theme.green, error: theme.red, info: theme.blue };
  return (
    <div style={{
      position: "fixed", top: 24, right: 24, zIndex: 9999, padding: "14px 24px",
      borderRadius: 12, background: theme.surface, border: `1px solid ${colors[type] || theme.border}`,
      color: theme.text, fontSize: 14, fontFamily: theme.font, fontWeight: 500,
      boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${colors[type]}22`,
      animation: "slideIn 0.3s ease",
    }}>
      {message}
    </div>
  );
};

// ─── Auth Screen ───
const AuthScreen = ({ dispatch, isSignup }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [trade, setTrade] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email || !password) { setError("Please enter email and password"); return; }
    if (isSignup && (!businessName || !contactName)) { setError("Please fill in all required fields"); return; }
    
    setLoading(true);
    setError("");

    try {
      if (isSignup) {
        const authData = await supabase.auth_signUp(email, password);
        if (!authData.user) throw new Error("Signup failed — check your email for confirmation");

        // Create business record
        const { data: biz, error: bizErr } = await db("businesses").insert({
          user_id: authData.user.id,
          business_name: businessName,
          contact_name: contactName,
          email: email,
          trade: trade || null,
          subscription_status: "trialing",
        });

        if (bizErr) throw new Error("Account created but business profile failed. Try logging in.");

        // Create default follow-up sequence
        if (biz && biz[0]) {
          const { data: seq } = await db("follow_up_sequences").insert({
            business_id: biz[0].id,
            name: "Standard Follow-Up",
            is_active: true,
            is_default: true,
          });

          if (seq && seq[0]) {
            await db("sequence_steps").insert([
              { sequence_id: seq[0].id, step_order: 1, delay_days: 2, email_subject: "Following up on your quote", email_body: "Hi {name}, just checking in on the quote I sent through for {job}. Happy to answer any questions. Cheers, {business_name}" },
              { sequence_id: seq[0].id, step_order: 2, delay_days: 5, email_subject: "Any questions about your quote?", email_body: "Hey {name}, wanted to make sure you received the quote for {job}. Let me know if you'd like to go ahead or if anything needs adjusting. Cheers, {business_name}" },
              { sequence_id: seq[0].id, step_order: 3, delay_days: 10, email_subject: "Last chance — your quote for {job}", email_body: "Hi {name}, just a final follow-up on your quote for {job} (${amount}). This quote will expire in 5 days. Let me know either way! Cheers, {business_name}" },
            ]);
          }
        }

        dispatch({ type: "SET_USER", payload: authData.user });
        dispatch({ type: "SET_BUSINESS", payload: biz?.[0] || null });
        dispatch({ type: "NOTIFY", payload: { message: "Account created! Welcome to Wynflow 🎉", type: "success" } });
      } else {
        const authData = await supabase.auth_signIn(email, password);
        dispatch({ type: "SET_USER", payload: authData.user });

        // Fetch business profile
        const { data: biz } = await db("businesses").eq("user_id", authData.user.id).single().select();
        dispatch({ type: "SET_BUSINESS", payload: biz });
        dispatch({ type: "NOTIFY", payload: { message: "Welcome back! 👋", type: "success" } });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: `radial-gradient(ellipse at 30% 20%, rgba(245,158,11,0.08) 0%, transparent 50%),
                    radial-gradient(ellipse at 70% 80%, rgba(59,130,246,0.05) 0%, transparent 50%),
                    ${theme.bg}`,
      fontFamily: theme.font, padding: 20,
    }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover})`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
              boxShadow: `0 0 30px ${theme.accentGlow}`,
            }}>⚡</div>
            <span style={{ fontSize: 28, fontWeight: 700, color: theme.text, fontFamily: theme.fontDisplay }}>Wynflow</span>
          </div>
          <div style={{ fontSize: 15, color: theme.textMuted, lineHeight: 1.5 }}>
            {isSignup ? "Set up your account in 30 seconds" : "Welcome back — your quotes are waiting"}
          </div>
        </div>

        <Card style={{ padding: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {isSignup && (
              <>
                <Input label="Business Name *" value={businessName} onChange={setBusinessName} placeholder="e.g. Smith Plumbing Ltd" />
                <Input label="Your Name *" value={contactName} onChange={setContactName} placeholder="e.g. John Smith" />
                <Input label="Trade" value={trade} onChange={setTrade} placeholder="e.g. Plumber, Electrician, Builder" />
              </>
            )}
            <Input label="Email *" value={email} onChange={setEmail} type="email" placeholder="you@yourbusiness.co.nz" />
            <Input label="Password *" value={password} onChange={setPassword} type="password" placeholder="Min 6 characters" />

            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: theme.redSoft, color: theme.red, fontSize: 13 }}>
                {error}
              </div>
            )}

            <Button onClick={handleSubmit} disabled={loading}
              style={{ width: "100%", justifyContent: "center", marginTop: 8, padding: "14px 24px" }}>
              {loading ? "Please wait..." : isSignup ? "Create Account →" : "Sign In →"}
            </Button>
          </div>
        </Card>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: theme.textMuted }}>
          {isSignup ? "Already have an account? " : "Don't have an account? "}
          <span onClick={() => dispatch({ type: "SET_SCREEN", payload: isSignup ? "login" : "signup" })}
            style={{ color: theme.accent, cursor: "pointer", fontWeight: 600 }}>
            {isSignup ? "Sign in" : "Sign up free"}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Sidebar ───
const Sidebar = ({ screen, dispatch, business }) => {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "quotes", label: "Quotes", icon: "📋" },
    { id: "sequences", label: "Follow-Ups", icon: "🔄" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  const handleLogout = async () => {
    await supabase.auth_signOut();
    dispatch({ type: "LOGOUT" });
  };

  return (
    <div style={{
      width: 260, background: theme.surface, borderRight: `1px solid ${theme.border}`,
      display: "flex", flexDirection: "column", padding: "24px 16px", flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 36 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover})`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          boxShadow: `0 0 20px ${theme.accentGlow}`,
        }}>⚡</div>
        <span style={{ fontSize: 20, fontWeight: 700, color: theme.text, fontFamily: theme.fontDisplay }}>Wynflow</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {navItems.map((item) => (
          <div key={item.id} onClick={() => dispatch({ type: "SET_SCREEN", payload: item.id })}
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 500,
              background: screen === item.id ? theme.accentSoft : "transparent",
              color: screen === item.id ? theme.accent : theme.textMuted,
            }}>
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            {item.label}
          </div>
        ))}
      </div>

      <div style={{
        padding: "16px 14px", borderRadius: 12, background: theme.surfaceLight,
        border: `1px solid ${theme.border}`,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: theme.text, marginBottom: 2 }}>{business?.business_name}</div>
        <div style={{ fontSize: 12, color: theme.textMuted }}>{business?.email}</div>
        <div onClick={handleLogout}
          style={{ fontSize: 12, color: theme.red, cursor: "pointer", marginTop: 10, fontWeight: 500 }}>
          Sign out
        </div>
      </div>
    </div>
  );
};

// ─── Dashboard ───
const Dashboard = ({ quotes, dispatch }) => {
  const total = quotes.length;
  const pending = quotes.filter((q) => q.status === "sent" || q.status === "pending" || q.status === "opened").length;
  const accepted = quotes.filter((q) => q.status === "accepted").length;
  const revenue = quotes.filter((q) => q.status === "accepted").reduce((sum, q) => sum + parseFloat(q.amount || 0), 0);
  const recentQuotes = [...quotes].slice(0, 5);

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>Dashboard</h1>
        <p style={{ fontSize: 14, color: theme.textMuted, margin: "8px 0 0" }}>Here's what's happening with your quotes</p>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
        <Stat label="Total Quotes" value={total} icon="📋" />
        <Stat label="Awaiting Response" value={pending} accent={theme.accent} icon="⏳" />
        <Stat label="Won" value={accepted} accent={theme.green} icon="✅" />
        <Stat label="Revenue Won" value={`$${revenue.toLocaleString()}`} accent={theme.green} icon="💰" />
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
        <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "newQuote" })}>+ New Quote</Button>
        <Button variant="secondary" onClick={() => dispatch({ type: "SET_SCREEN", payload: "sequences" })}>Manage Follow-Ups</Button>
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: 0 }}>Recent Quotes</h3>
          <span onClick={() => dispatch({ type: "SET_SCREEN", payload: "quotes" })}
            style={{ fontSize: 13, color: theme.accent, cursor: "pointer", fontWeight: 500 }}>View all →</span>
        </div>
        {recentQuotes.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: theme.textMuted }}>
            No quotes yet — create your first one!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {recentQuotes.map((q) => (
              <div key={q.id}
                onClick={() => dispatch({ type: "SET_SCREEN", payload: "quoteDetail:" + q.id })}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.surfaceLight)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, background: theme.surfaceLight,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 700, color: theme.accent,
                  }}>
                    {q.customer_name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{q.customer_name}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted }}>{q.job_title}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>${parseFloat(q.amount || 0).toLocaleString()}</span>
                  <Badge status={q.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ─── Quotes List ───
const QuotesList = ({ quotes, dispatch }) => {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = quotes.filter((q) => {
    if (filter !== "all" && q.status !== filter) return false;
    if (search && !q.customer_name?.toLowerCase().includes(search.toLowerCase()) && !q.job_title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>Quotes</h1>
          <p style={{ fontSize: 14, color: theme.textMuted, margin: "8px 0 0" }}>{quotes.length} total quotes</p>
        </div>
        <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "newQuote" })}>+ New Quote</Button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {["all", "draft", "sent", "opened", "accepted", "declined"].map((f) => (
          <span key={f} onClick={() => setFilter(f)}
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
              background: filter === f ? theme.accentSoft : theme.surfaceLight,
              color: filter === f ? theme.accent : theme.textMuted,
              border: `1px solid ${filter === f ? theme.accent + "33" : theme.border}`,
              textTransform: "capitalize",
            }}>
            {f}
          </span>
        ))}
        <div style={{ flex: 1 }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quotes..."
          style={{
            fontFamily: theme.font, fontSize: 13, padding: "8px 16px", borderRadius: 8,
            background: theme.surfaceLight, border: `1px solid ${theme.border}`, color: theme.text, outline: "none", width: 200,
          }} />
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 80px",
          padding: "14px 20px", borderBottom: `1px solid ${theme.border}`, fontSize: 12,
          fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.5,
        }}>
          <span>Customer</span><span>Job</span><span>Amount</span><span>Status</span><span></span>
        </div>
        {filtered.map((q) => (
          <div key={q.id}
            onClick={() => dispatch({ type: "SET_SCREEN", payload: "quoteDetail:" + q.id })}
            style={{
              display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 80px",
              padding: "16px 20px", borderBottom: `1px solid ${theme.border}08`, cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = theme.surfaceLight)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{q.customer_name}</div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>{q.customer_email}</div>
            </div>
            <div style={{ fontSize: 14, color: theme.text, display: "flex", alignItems: "center" }}>{q.job_title}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.text, display: "flex", alignItems: "center" }}>${parseFloat(q.amount || 0).toLocaleString()}</div>
            <div style={{ display: "flex", alignItems: "center" }}><Badge status={q.status} /></div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <span style={{ fontSize: 18, color: theme.textDim }}>→</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 48, textAlign: "center", color: theme.textMuted, fontSize: 14 }}>
            {quotes.length === 0 ? "No quotes yet — create your first one!" : "No quotes match your filter"}
          </div>
        )}
      </Card>
    </div>
  );
};

// ─── New Quote Form ───
const NewQuoteForm = ({ dispatch, business, sequences }) => {
  const [form, setForm] = useState({
    customerName: "", customerEmail: "", customerPhone: "",
    jobTitle: "", description: "", amount: "", sequenceId: sequences.find(s => s.is_default)?.id || sequences[0]?.id || "",
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const update = (key, val) => setForm({ ...form, [key]: val });

  const handleCreate = async () => {
    if (!form.customerName || !form.jobTitle || !form.amount) {
      dispatch({ type: "NOTIFY", payload: { message: "Please fill in customer name, job title, and amount", type: "error" } });
      return;
    }
    if (!form.customerEmail) {
      dispatch({ type: "NOTIFY", payload: { message: "Customer email is required for sending quotes", type: "error" } });
      return;
    }

    setLoading(true);
    try {
      let pdfUrl = null;
      let pdfFilename = null;

      // Upload PDF if provided
      if (pdfFile) {
        pdfFilename = `${Date.now()}-${pdfFile.name}`;
        const uploadPath = `${business.id}/${pdfFilename}`;
        const { error: uploadErr } = await supabase.uploadFile("quote-pdfs", uploadPath, pdfFile);
        if (uploadErr) {
          console.error("PDF upload error:", uploadErr);
        } else {
          pdfUrl = uploadPath;
        }
      }

      // Calculate first follow-up date
      let nextFollowUp = null;
      if (form.sequenceId) {
        const { data: steps } = await db("sequence_steps").eq("sequence_id", form.sequenceId).order("step_order").limit(1).select();
        if (steps && steps[0]) {
          const d = new Date();
          d.setDate(d.getDate() + steps[0].delay_days);
          nextFollowUp = d.toISOString();
        }
      }

      const { data: newQuote, error: quoteErr } = await db("quotes").insert({
        business_id: business.id,
        quote_number: "",  // Auto-generated by trigger
        customer_name: form.customerName,
        customer_email: form.customerEmail,
        customer_phone: form.customerPhone || null,
        job_title: form.jobTitle,
        description: form.description || null,
        amount: parseFloat(form.amount),
        pdf_url: pdfUrl,
        pdf_filename: pdfFilename,
        status: "sent",
        sent_at: new Date().toISOString(),
        sequence_id: form.sequenceId || null,
        next_follow_up_at: nextFollowUp,
      });

      if (quoteErr) throw new Error("Failed to create quote");

      dispatch({ type: "ADD_QUOTE", payload: newQuote[0] });
      dispatch({ type: "NOTIFY", payload: { message: `Quote sent to ${form.customerName}! Follow-ups scheduled. 🚀`, type: "success" } });
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: err.message, type: "error" } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <span onClick={() => dispatch({ type: "SET_SCREEN", payload: "quotes" })}
          style={{ fontSize: 14, color: theme.textMuted, cursor: "pointer" }}>← Back to Quotes</span>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: theme.text, margin: "8px 0 0", fontFamily: theme.fontDisplay }}>New Quote</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 20px" }}>Customer Details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Customer Name *" value={form.customerName} onChange={(v) => update("customerName", v)} placeholder="e.g. John Smith" />
            <Input label="Email *" value={form.customerEmail} onChange={(v) => update("customerEmail", v)} type="email" placeholder="john@email.com" />
            <Input label="Phone" value={form.customerPhone} onChange={(v) => update("customerPhone", v)} placeholder="021 555 1234" />
          </div>
        </Card>

        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 20px" }}>Job Details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Job Title *" value={form.jobTitle} onChange={(v) => update("jobTitle", v)} placeholder="e.g. Kitchen Renovation" />
            <Input label="Description" value={form.description} onChange={(v) => update("description", v)} textarea placeholder="Describe the job scope..." />
            <Input label="Quote Amount ($) *" value={form.amount} onChange={(v) => update("amount", v)} type="number" placeholder="0.00" />
          </div>
        </Card>

        {/* PDF Upload */}
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Quote PDF</h3>
          <p style={{ fontSize: 13, color: theme.textMuted, margin: "0 0 16px" }}>Upload your quote document to attach to the email</p>
          <Input label="Upload PDF" type="file" accept=".pdf" onFileChange={(e) => setPdfFile(e.target.files[0])} />
          {pdfFile && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: theme.greenSoft, color: theme.green, fontSize: 13 }}>
              📎 {pdfFile.name} ({(pdfFile.size / 1024).toFixed(0)} KB)
            </div>
          )}
        </Card>

        {/* Follow-up Sequence */}
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Follow-Up Sequence</h3>
          <p style={{ fontSize: 13, color: theme.textMuted, margin: "0 0 16px" }}>Choose an automated sequence to chase this quote</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {sequences.map((seq) => (
              <div key={seq.id} onClick={() => update("sequenceId", seq.id)}
                style={{
                  padding: "14px 20px", borderRadius: 12, cursor: "pointer",
                  background: form.sequenceId === seq.id ? theme.accentSoft : theme.surfaceLight,
                  border: `1px solid ${form.sequenceId === seq.id ? theme.accent + "44" : theme.border}`,
                }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: form.sequenceId === seq.id ? theme.accent : theme.text }}>{seq.name}</div>
              </div>
            ))}
            <div onClick={() => update("sequenceId", "")}
              style={{
                padding: "14px 20px", borderRadius: 12, cursor: "pointer",
                background: !form.sequenceId ? theme.redSoft : theme.surfaceLight,
                border: `1px solid ${!form.sequenceId ? theme.red + "44" : theme.border}`,
              }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: !form.sequenceId ? theme.red : theme.text }}>No Follow-Up</div>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
        <Button variant="secondary" onClick={() => dispatch({ type: "SET_SCREEN", payload: "quotes" })}>Cancel</Button>
        <Button onClick={handleCreate} disabled={loading}>
          {loading ? "Sending..." : "Send Quote & Start Follow-Ups →"}
        </Button>
      </div>
    </div>
  );
};

// ─── Quote Detail ───
const QuoteDetail = ({ quoteId, quotes, sequences, dispatch, business }) => {
  const quote = quotes.find((q) => q.id === quoteId);
  const [steps, setSteps] = useState([]);
  const [responses, setResponses] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!quote) return;
    if (quote.sequence_id) {
      db("sequence_steps").eq("sequence_id", quote.sequence_id).order("step_order").select()
        .then(({ data }) => setSteps(data || []));
    }
    db("quote_responses").eq("quote_id", quote.id).select()
      .then(({ data }) => setResponses(data || []));
    db("follow_up_logs").eq("quote_id", quote.id).order("sent_at").select()
      .then(({ data }) => setLogs(data || []));
  }, [quote?.id]);

  if (!quote) return <div style={{ color: theme.textMuted, padding: 48 }}>Quote not found</div>;

  const updateStatus = async (status) => {
    const updates = { status, follow_up_paused: status === "accepted" || status === "declined" };
    if (status === "accepted") updates.responded_at = new Date().toISOString();
    if (status === "declined") updates.responded_at = new Date().toISOString();

    await db("quotes").eq("id", quote.id).update(updates);
    dispatch({ type: "UPDATE_QUOTE", payload: { id: quote.id, ...updates } });
    dispatch({ type: "NOTIFY", payload: { message: `Quote marked as ${status}`, type: "success" } });
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <span onClick={() => dispatch({ type: "SET_SCREEN", payload: "quotes" })}
          style={{ fontSize: 14, color: theme.textMuted, cursor: "pointer", display: "block", marginBottom: 8 }}>← Back to Quotes</span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>{quote.job_title}</h1>
            <p style={{ fontSize: 14, color: theme.textMuted, margin: "8px 0 0" }}>Quote {quote.quote_number} • Created {new Date(quote.created_at).toLocaleDateString()}</p>
          </div>
          <Badge status={quote.status} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Customer</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><div style={{ fontSize: 12, color: theme.textMuted }}>Name</div><div style={{ fontSize: 15, color: theme.text, fontWeight: 500 }}>{quote.customer_name}</div></div>
            <div><div style={{ fontSize: 12, color: theme.textMuted }}>Email</div><div style={{ fontSize: 15, color: theme.text }}>{quote.customer_email}</div></div>
            {quote.customer_phone && <div><div style={{ fontSize: 12, color: theme.textMuted }}>Phone</div><div style={{ fontSize: 15, color: theme.text }}>{quote.customer_phone}</div></div>}
          </div>
        </Card>

        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Quote Details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>Amount</div>
              <div style={{ fontSize: 28, color: theme.accent, fontWeight: 700, fontFamily: theme.fontDisplay }}>${parseFloat(quote.amount || 0).toLocaleString()}</div>
            </div>
            {quote.description && <div><div style={{ fontSize: 12, color: theme.textMuted }}>Description</div><div style={{ fontSize: 14, color: theme.text, lineHeight: 1.5 }}>{quote.description}</div></div>}
            {quote.pdf_filename && (
              <div>
                <div style={{ fontSize: 12, color: theme.textMuted }}>Attached PDF</div>
                <div style={{ fontSize: 14, color: theme.accent }}>📎 {quote.pdf_filename}</div>
              </div>
            )}
          </div>
        </Card>

        {/* Follow-up Timeline */}
        <Card style={{ gridColumn: "1 / -1" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 20px" }}>Follow-Up Timeline</h3>
          {steps.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {steps.map((step, i) => {
                const completed = i < (quote.current_step || 0);
                const isNext = i === (quote.current_step || 0);
                return (
                  <div key={i} style={{ display: "flex", gap: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 24 }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
                        background: completed ? theme.green : isNext ? theme.accent : theme.border,
                        boxShadow: isNext ? `0 0 10px ${theme.accentGlow}` : "none",
                      }} />
                      {i < steps.length - 1 && <div style={{ width: 2, flex: 1, background: completed ? theme.green + "44" : theme.border, minHeight: 40 }} />}
                    </div>
                    <div style={{ paddingBottom: 24 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: completed ? theme.green : isNext ? theme.accent : theme.textMuted }}>
                        {completed ? "✓ Sent" : isNext ? "⏳ Next up" : "Scheduled"} — Day {step.delay_days}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: theme.text, marginTop: 4 }}>
                        {step.email_subject.replace("{job}", quote.job_title)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: 14, color: theme.textMuted }}>No automated follow-up sequence assigned</p>
          )}
        </Card>

        {/* Customer Responses */}
        {responses.length > 0 && (
          <Card style={{ gridColumn: "1 / -1" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Customer Responses</h3>
            {responses.map((r, i) => (
              <div key={i} style={{
                padding: "12px 16px", borderRadius: 10, background: theme.surfaceLight,
                border: `1px solid ${theme.border}`, marginBottom: 8,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: r.response_type === "book_in" ? theme.green : r.response_type === "decline" ? theme.red : theme.blue }}>
                  {r.response_type === "book_in" ? "✅ Booked In" : r.response_type === "decline" ? "❌ Declined" : "💬 Feedback"}
                </div>
                {r.feedback_text && <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 6 }}>{r.feedback_text}</div>}
                <div style={{ fontSize: 11, color: theme.textDim, marginTop: 4 }}>{new Date(r.responded_at).toLocaleString()}</div>
              </div>
            ))}
          </Card>
        )}

        {/* Actions */}
        <Card style={{ gridColumn: "1 / -1" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Actions</h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button onClick={() => updateStatus("accepted")} style={{ background: theme.greenSoft, color: theme.green }}>✓ Mark Accepted</Button>
            <Button onClick={() => updateStatus("declined")} variant="danger">✗ Mark Declined</Button>
            <Button variant="secondary" onClick={async () => {
              const newStep = (quote.current_step || 0) + 1;
              await db("quotes").eq("id", quote.id).update({ current_step: newStep });
              dispatch({ type: "UPDATE_QUOTE", payload: { id: quote.id, current_step: newStep } });
              dispatch({ type: "NOTIFY", payload: { message: "Follow-up triggered! 📧", type: "success" } });
            }}>📧 Send Follow-Up Now</Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

// ─── Sequences Manager ───
const SequencesManager = ({ sequences, business, dispatch }) => {
  const [editing, setEditing] = useState(null);
  const [steps, setSteps] = useState({});
  const [newStep, setNewStep] = useState({ delay: "", subject: "", template: "" });

  const loadSteps = async (seqId) => {
    const { data } = await db("sequence_steps").eq("sequence_id", seqId).order("step_order").select();
    setSteps((prev) => ({ ...prev, [seqId]: data || [] }));
  };

  useEffect(() => {
    sequences.forEach((s) => loadSteps(s.id));
  }, [sequences.length]);

  const toggleSequence = async (seq) => {
    await db("follow_up_sequences").eq("id", seq.id).update({ is_active: !seq.is_active });
    dispatch({ type: "UPDATE_SEQUENCE", payload: { id: seq.id, is_active: !seq.is_active } });
  };

  const addStep = async (seqId) => {
    if (!newStep.delay || !newStep.subject || !newStep.template) return;
    const currentSteps = steps[seqId] || [];
    const { data } = await db("sequence_steps").insert({
      sequence_id: seqId,
      step_order: currentSteps.length + 1,
      delay_days: parseInt(newStep.delay),
      email_subject: newStep.subject,
      email_body: newStep.template,
    });
    if (data) {
      setSteps((prev) => ({ ...prev, [seqId]: [...(prev[seqId] || []), data[0]] }));
      setNewStep({ delay: "", subject: "", template: "" });
      dispatch({ type: "NOTIFY", payload: { message: "Step added!", type: "success" } });
    }
  };

  const createSequence = async () => {
    const { data } = await db("follow_up_sequences").insert({
      business_id: business.id,
      name: "New Sequence",
      is_active: false,
      is_default: false,
    });
    if (data) {
      dispatch({ type: "ADD_SEQUENCE", payload: data[0] });
      setEditing(data[0].id);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>Follow-Up Sequences</h1>
        <p style={{ fontSize: 14, color: theme.textMuted, margin: "8px 0 0" }}>Configure automated email follow-ups. Use {"{name}"}, {"{job}"}, {"{amount}"}, {"{business_name}"} as placeholders.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {sequences.map((seq) => (
          <Card key={seq.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: theme.text, margin: 0 }}>{seq.name}</h3>
                <span style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: seq.is_active ? theme.greenSoft : theme.redSoft,
                  color: seq.is_active ? theme.green : theme.red,
                }}>
                  {seq.is_active ? "ACTIVE" : "PAUSED"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button size="sm" variant={seq.is_active ? "danger" : "primary"} onClick={() => toggleSequence(seq)}>
                  {seq.is_active ? "Pause" : "Activate"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setEditing(editing === seq.id ? null : seq.id); }}>
                  {editing === seq.id ? "Close" : "Edit Steps"}
                </Button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(steps[seq.id] || []).map((step, i) => (
                <div key={step.id} style={{
                  padding: "14px 18px", borderRadius: 10, background: theme.surfaceLight,
                  border: `1px solid ${theme.border}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 8, background: theme.accentSoft,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, color: theme.accent,
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 13, color: theme.textMuted }}>Day {step.delay_days}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: theme.text, marginTop: 10 }}>{step.email_subject}</div>
                  <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 6, lineHeight: 1.5 }}>{step.email_body}</div>
                </div>
              ))}
            </div>

            {editing === seq.id && (
              <div style={{ marginTop: 16, padding: 20, borderRadius: 12, background: theme.bg, border: `1px dashed ${theme.border}` }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: theme.text, margin: "0 0 14px" }}>Add New Step</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Input label="Delay (days after quote sent)" value={newStep.delay} onChange={(v) => setNewStep({ ...newStep, delay: v })} type="number" placeholder="e.g. 7" />
                  <Input label="Email Subject" value={newStep.subject} onChange={(v) => setNewStep({ ...newStep, subject: v })} placeholder="e.g. Following up on {job}" />
                  <Input label="Email Body" value={newStep.template} onChange={(v) => setNewStep({ ...newStep, template: v })} textarea placeholder="Hi {name}, ..." />
                  <Button size="sm" onClick={() => addStep(seq.id)}>+ Add Step</Button>
                </div>
              </div>
            )}
          </Card>
        ))}

        <Card style={{ border: `1px dashed ${theme.border}`, textAlign: "center", padding: 40, cursor: "pointer" }} onClick={createSequence}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>+</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: theme.textMuted }}>Create New Sequence</div>
        </Card>
      </div>
    </div>
  );
};

// ─── Settings ───
const Settings = ({ business, dispatch }) => {
  const [businessName, setBusinessName] = useState(business?.business_name || "");
  const [contactName, setContactName] = useState(business?.contact_name || "");
  const [email, setEmail] = useState(business?.email || "");
  const [trade, setTrade] = useState(business?.trade || "");
  const [phone, setPhone] = useState(business?.phone || "");
  const [saving, setSaving] = useState(false);

  const saveSettings = async () => {
    setSaving(true);
    await db("businesses").eq("id", business.id).update({
      business_name: businessName,
      contact_name: contactName,
      email: email,
      trade: trade,
      phone: phone,
    });
    dispatch({ type: "SET_BUSINESS", payload: { ...business, business_name: businessName, contact_name: contactName, email, trade, phone } });
    dispatch({ type: "NOTIFY", payload: { message: "Settings saved!", type: "success" } });
    setSaving(false);
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>Settings</h1>
        <p style={{ fontSize: 14, color: theme.textMuted, margin: "8px 0 0" }}>Manage your business profile</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 20px" }}>Business Profile</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Business Name" value={businessName} onChange={setBusinessName} />
            <Input label="Contact Name" value={contactName} onChange={setContactName} />
            <Input label="Email" value={email} onChange={setEmail} type="email" />
            <Input label="Phone" value={phone} onChange={setPhone} />
            <Input label="Trade" value={trade} onChange={setTrade} />
            <Button onClick={saveSettings} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 20px" }}>Email Configuration</h3>
          <div style={{ padding: "14px 18px", borderRadius: 10, background: theme.accentSoft, border: `1px solid ${theme.accent}22` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.accent, marginBottom: 8 }}>How emails work</div>
            <div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.6 }}>
              All quote emails are sent from <strong style={{ color: theme.text }}>Wynflow</strong> on behalf of your business.
              Your customers will see your business name in the email and can reply directly to your email address.
            </div>
          </div>
          <div style={{ marginTop: 16, padding: "14px 18px", borderRadius: 10, background: theme.surfaceLight }}>
            <div style={{ fontSize: 13, color: theme.textMuted }}>Emails sent from:</div>
            <div style={{ fontSize: 14, color: theme.text, fontWeight: 500, marginTop: 4 }}>Wynflow &lt;quotes@wynflow.com&gt;</div>
            <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 8 }}>On behalf of:</div>
            <div style={{ fontSize: 14, color: theme.accent, fontWeight: 500, marginTop: 4 }}>{businessName}</div>
            <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 8 }}>Reply-to:</div>
            <div style={{ fontSize: 14, color: theme.text, fontWeight: 500, marginTop: 4 }}>{email}</div>
          </div>
        </Card>

        <Card style={{ gridColumn: "1 / -1" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Subscription</h3>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>
                {business?.subscription_status === "trialing" ? "Free Trial" : "Wynflow Pro"}
              </div>
              <div style={{ fontSize: 13, color: theme.textMuted }}>
                {business?.subscription_status === "trialing"
                  ? "You're on a free trial — upgrade anytime"
                  : "Unlimited quotes • Unlimited follow-ups • Priority support"}
              </div>
            </div>
            <div style={{
              padding: "8px 16px", borderRadius: 8,
              background: business?.subscription_status === "active" ? theme.greenSoft : theme.accentSoft,
              color: business?.subscription_status === "active" ? theme.green : theme.accent,
              fontSize: 13, fontWeight: 600, textTransform: "capitalize",
            }}>
              {business?.subscription_status || "trialing"}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// ─── Main App ───
export default function WynflowApp() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { user, business, screen, quotes, sequences, notification, loading } = state;

  // Load data when business is set
  const loadData = useCallback(async () => {
    if (!business) return;
    dispatch({ type: "SET_LOADING", payload: true });

    const [quotesRes, seqRes] = await Promise.all([
      db("quotes").eq("business_id", business.id).order("created_at", { ascending: false }).select(),
      db("follow_up_sequences").eq("business_id", business.id).select(),
    ]);

    if (quotesRes.data) dispatch({ type: "SET_QUOTES", payload: quotesRes.data });
    if (seqRes.data) dispatch({ type: "SET_SEQUENCES", payload: seqRes.data });
    dispatch({ type: "SET_LOADING", payload: false });
  }, [business?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Refresh quotes when navigating back to quotes/dashboard
  useEffect(() => {
    if (business && (screen === "dashboard" || screen === "quotes")) {
      loadData();
    }
  }, [screen]);

  const screenParts = screen.split(":");
  const activeScreen = screenParts[0];
  const detailId = screenParts[1];

  // Auth screens
  if (!business && (screen === "login" || screen === "signup")) {
    return (
      <>
        <style>{fonts}{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: ${theme.bg}; }
          input:focus, textarea:focus { border-color: ${theme.accent} !important; box-shadow: 0 0 0 2px ${theme.accentGlow}; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 3px; }
          @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        {notification && <Toast message={notification.message} type={notification.type} onClose={() => dispatch({ type: "CLEAR_NOTIFY" })} />}
        <AuthScreen dispatch={dispatch} isSignup={screen === "signup"} />
      </>
    );
  }

  if (!business) {
    dispatch({ type: "SET_SCREEN", payload: "login" });
    return null;
  }

  const renderContent = () => {
    if (loading) return <Spinner />;
    switch (activeScreen) {
      case "dashboard": return <Dashboard quotes={quotes} dispatch={dispatch} />;
      case "quotes": return <QuotesList quotes={quotes} dispatch={dispatch} />;
      case "newQuote": return <NewQuoteForm dispatch={dispatch} business={business} sequences={sequences} />;
      case "sequences": return <SequencesManager sequences={sequences} business={business} dispatch={dispatch} />;
      case "quoteDetail": return <QuoteDetail quoteId={detailId} quotes={quotes} sequences={sequences} dispatch={dispatch} business={business} />;
      case "settings": return <Settings business={business} dispatch={dispatch} />;
      default: return <Dashboard quotes={quotes} dispatch={dispatch} />;
    }
  };

  return (
    <>
      <style>{fonts}{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: ${theme.bg}; }
        input:focus, textarea:focus { border-color: ${theme.accent} !important; box-shadow: 0 0 0 2px ${theme.accentGlow}; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 3px; }
        @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      {notification && <Toast message={notification.message} type={notification.type} onClose={() => dispatch({ type: "CLEAR_NOTIFY" })} />}
      <div style={{ display: "flex", height: "100vh", fontFamily: theme.font, color: theme.text, overflow: "hidden" }}>
        <Sidebar screen={activeScreen} dispatch={dispatch} business={business} />
        <div style={{ flex: 1, overflow: "auto", padding: "32px 40px" }}>
          {renderContent()}
        </div>
      </div>
    </>
  );
}
