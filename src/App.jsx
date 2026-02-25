import { useState, useEffect, useReducer, useCallback } from "react";
import { LayoutDashboard, FileText, RefreshCw, Settings as SettingsIcon, Upload, Send, Bot, ClipboardList, Paperclip, CheckCircle2, BarChart3, Lock, Clock, DollarSign, ChevronLeft, ChevronRight, Menu, X, ArrowRight, Star, Mail, Plus, Search, Check, XCircle, MessageSquare, Globe, Cpu, Wrench } from "lucide-react";

// ─── SEO Helper ───
const SEO_CONFIG = {
  home: { title: "Wynflow — Quote Management & Automated Follow-Ups for NZ Businesses", description: "Send quotes, automate follow-ups, and win more jobs. Built for New Zealand trades and service businesses.", canonical: "https://www.wynflow.co.nz" },
  about: { title: "About Wynflow — Built by a Kiwi, for Kiwi Businesses", description: "Born from watching a Napier carpet layer lose jobs to forgotten follow-ups. Wynflow automates quote follow-ups so NZ tradies never lose a job to silence again.", canonical: "https://www.wynflow.co.nz/about" },
  pricing: { title: "Wynflow Pricing — Free Trial, No Credit Card Required", description: "Simple pricing for NZ businesses. Send quotes, automate follow-ups, and track customer responses.", canonical: "https://www.wynflow.co.nz/pricing" },
};
const useSEO = (screen) => {
  useEffect(() => {
    const config = SEO_CONFIG[screen];
    if (!config) return;
    document.title = config.title;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", config.description);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.setAttribute("rel", "canonical"); document.head.appendChild(canonical); }
    canonical.setAttribute("href", config.canonical);
    const ogTags = { "og:title": config.title, "og:description": config.description, "og:url": config.canonical };
    Object.entries(ogTags).forEach(([prop, content]) => { let tag = document.querySelector(`meta[property="${prop}"]`); if (tag) tag.setAttribute("content", content); });
  }, [screen]);
};

// ─── Mobile Detection Hook ───
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
};

// ─── Supabase Client ───
const SUPABASE_URL = "https://hlqbjomeomahoocexljp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhscWJqb21lb21haG9vY2V4bGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MTkwMTQsImV4cCI6MjA4NjE5NTAxNH0.X9biLUFgktgw6H8ytkfvF6gnITJCEwLiHMw71IcUhGk";

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
  screen: "home",
  prevScreen: "dashboard",
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
      return { ...state, screen: action.payload, prevScreen: state.screen };
    case "GO_BACK":
      return { ...state, screen: state.prevScreen || "dashboard" };
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

// ─── Logo ───
const WYNFLOW_LOGO = "/logo.png";

const WynflowLogo = ({ size = 36 }) => (
  <img src={WYNFLOW_LOGO} alt="Wynflow" style={{ width: size, height: size, borderRadius: size * 0.28, objectFit: "cover" }} />
);

// ─── Theme ───
const theme = {
  bg: "#0A0E17",
  surface: "#111827",
  surfaceLight: "#1A2235",
  surfaceHover: "#212D42",
  border: "#253040",
  borderLight: "#354560",
  accent: "#14B8A6",
  accentHover: "#0D9488",
  accentSoft: "rgba(20, 184, 166, 0.12)",
  accentGlow: "rgba(20, 184, 166, 0.25)",
  accentBlue: "#3B82F6",
  accentBlueSoft: "rgba(59, 130, 246, 0.12)",
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
  opened: { label: "Opened", color: theme.accentBlue, bg: theme.accentBlueSoft },
  accepted: { label: "Accepted", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  booked: { label: "Booked", color: theme.green, bg: theme.greenSoft },
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
    fontSize: size === "sm" ? 13 : size === "lg" ? 16 : 14,
    padding: size === "sm" ? "8px 16px" : size === "lg" ? "16px 32px" : "12px 24px",
  };
  const variants = {
    primary: { background: theme.accent, color: "#000", boxShadow: `0 0 20px ${theme.accentGlow}` },
    secondary: { background: theme.surfaceLight, color: theme.text, border: `1px solid ${theme.border}` },
    ghost: { background: "transparent", color: theme.textMuted },
    danger: { background: theme.redSoft, color: theme.red },
  };
  return <button onClick={onClick} disabled={disabled}
    onMouseEnter={e => { if (!disabled) { e.currentTarget.style.transform = "translateY(-1px)"; if (variant === "primary") e.currentTarget.style.boxShadow = `0 4px 24px ${theme.accentGlow}`; }}}
    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; if (variant === "primary") e.currentTarget.style.boxShadow = `0 0 20px ${theme.accentGlow}`; }}
    style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
};

const Input = ({ label, value, onChange, type = "text", placeholder, textarea, style = {}, accept, onFileChange }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
    {label && <label style={{ fontSize: 13, fontWeight: 500, color: theme.textMuted, letterSpacing: 0.3 }}>{label}</label>}
    {textarea ? (
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{
          fontFamily: theme.font, fontSize: 14, padding: "12px 16px", borderRadius: 10,
          background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text,
          outline: "none", resize: "vertical", minHeight: 100, transition: "border-color 0.2s ease",
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
    padding: 24, transition: "all 0.25s ease", cursor: onClick ? "pointer" : "default", ...style,
  }}
  onMouseEnter={onClick ? (e) => { e.currentTarget.style.borderColor = theme.accent + "33"; } : undefined}
  onMouseLeave={onClick ? (e) => { e.currentTarget.style.borderColor = theme.border; } : undefined}>
    {children}
  </div>
);

const Stat = ({ label, value, accent, icon: Icon }) => (
  <Card style={{ flex: 1, minWidth: 140 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 8, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: accent || theme.text, fontFamily: theme.fontDisplay }}>{value}</div>
      </div>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: theme.surfaceLight, display: "flex", alignItems: "center", justifyContent: "center" }}>{Icon && <Icon size={20} color={theme.textMuted} />}</div>
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

// ════════════════════════════════════════
// PUBLIC PAGES
// ════════════════════════════════════════

const Navbar = ({ dispatch, transparent }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  return (
    <nav style={{ position:transparent?"absolute":"relative",top:0,left:0,right:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"space-between",padding:isMobile?"16px 20px":"20px 48px",background:transparent?"transparent":theme.surface,borderBottom:transparent?"none":`1px solid ${theme.border}`,fontFamily:theme.font }}>
      <div style={{ display:"flex",alignItems:"center",gap:10,cursor:"pointer" }} onClick={() => dispatch({ type:"SET_SCREEN",payload:"home" })}>
        <div style={{ width:36,height:36,borderRadius:10,overflow:"hidden" }}><WynflowLogo size={36} /></div>
        <span style={{ fontSize:22,fontWeight:700,color:theme.text,fontFamily:theme.fontDisplay }}>Wynflow</span>
      </div>
      {isMobile ? (
        <>
          <div onClick={() => setMenuOpen(!menuOpen)} style={{ color:theme.text,cursor:"pointer",padding:8 }}>{menuOpen ? <X size={24} /> : <Menu size={24} />}</div>
          {menuOpen && (
            <div style={{ position:"absolute",top:"100%",left:0,right:0,background:theme.surface,borderBottom:`1px solid ${theme.border}`,padding:"16px 20px",display:"flex",flexDirection:"column",gap:16,zIndex:200 }}>
              {[["home","Home"],["about","About"],["pricing","Pricing"]].map(([id,label]) => (
                <span key={id} onClick={() => { dispatch({ type:"SET_SCREEN",payload:id }); setMenuOpen(false); }} style={{ fontSize:16,fontWeight:500,color:theme.textMuted,cursor:"pointer" }}>{label}</span>
              ))}
              <Button size="sm" variant="secondary" onClick={() => { dispatch({ type:"SET_SCREEN",payload:"login" }); setMenuOpen(false); }}>Log In</Button>
              <Button size="sm" onClick={() => { dispatch({ type:"SET_SCREEN",payload:"signup" }); setMenuOpen(false); }}>Get Started Free</Button>
            </div>
          )}
        </>
      ) : (
        <div style={{ display:"flex",alignItems:"center",gap:32 }}>
          {[["home","Home"],["about","About"],["pricing","Pricing"]].map(([id,label]) => (
            <span key={id} onClick={() => dispatch({ type:"SET_SCREEN",payload:id })} style={{ fontSize:14,fontWeight:500,color:theme.textMuted,cursor:"pointer",transition:"color 0.2s" }} onMouseEnter={e=>e.target.style.color=theme.text} onMouseLeave={e=>e.target.style.color=theme.textMuted}>{label}</span>
          ))}
          <Button size="sm" variant="secondary" onClick={() => dispatch({ type:"SET_SCREEN",payload:"login" })}>Log In</Button>
          <Button size="sm" onClick={() => dispatch({ type:"SET_SCREEN",payload:"signup" })}>Get Started Free</Button>
        </div>
      )}
    </nav>
  );
};

const Footer = ({ dispatch }) => {
  const isMobile = useIsMobile();
  return (
  <footer style={{ padding:isMobile?"40px 20px 24px":"64px 48px 32px",background:theme.surface,borderTop:`1px solid ${theme.border}`,fontFamily:theme.font }}>
    <div style={{ display:"flex",justifyContent:"space-between",maxWidth:1100,margin:"0 auto",flexWrap:"wrap",gap:isMobile?32:48,flexDirection:isMobile?"column":"row" }}>
      <div style={{ maxWidth:300 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:16 }}>
          <div style={{ width:32,height:32,borderRadius:8,overflow:"hidden" }}><WynflowLogo size={32} /></div>
          <span style={{ fontSize:18,fontWeight:700,color:theme.text,fontFamily:theme.fontDisplay }}>Wynflow</span>
        </div>
        <p style={{ fontSize:13,color:theme.textMuted,lineHeight:1.6 }}>Automated quote delivery and follow-up for businesses. Send quotes, chase customers, win more jobs — on autopilot.</p>
      </div>
      <div>
        <h4 style={{ fontSize:13,fontWeight:600,color:theme.text,marginBottom:16,textTransform:"uppercase",letterSpacing:1 }}>Product</h4>
        {["home","pricing","about"].map(p => <div key={p} onClick={() => dispatch({ type:"SET_SCREEN",payload:p })} style={{ fontSize:14,color:theme.textMuted,cursor:"pointer",marginBottom:10,textTransform:"capitalize" }}>{p}</div>)}
      </div>
      <div>
        <h4 style={{ fontSize:13,fontWeight:600,color:theme.text,marginBottom:16,textTransform:"uppercase",letterSpacing:1 }}>Company</h4>
        <div style={{ fontSize:14,color:theme.textMuted,marginBottom:10 }}>Auckland, New Zealand</div>
        <div style={{ fontSize:14,color:theme.accent }}>jesse@wynflow.co.nz</div>
      </div>
    </div>
    <div style={{ maxWidth:1100,margin:"48px auto 0",paddingTop:24,borderTop:`1px solid ${theme.border}`,textAlign:"center",fontSize:13,color:theme.textDim }}>© 2026 Wynflow. All rights reserved.</div>
  </footer>
  );
};

const HomePage = ({ dispatch }) => {
  const isMobile = useIsMobile();
  return (
  <div>
    <div style={{ minHeight:isMobile?"auto":"90vh",display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",background:`radial-gradient(ellipse at 30% 20%,rgba(20,184,166,0.1) 0%,transparent 50%),radial-gradient(ellipse at 70% 80%,rgba(59,130,246,0.06) 0%,transparent 50%),${theme.bg}`,padding:isMobile?"100px 20px 60px":"120px 48px 80px" }}>
      <div style={{ maxWidth:800 }}>
        <div style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"8px 20px",borderRadius:30,background:theme.accentSoft,border:`1px solid ${theme.accent}22`,marginBottom:isMobile?20:32 }}><WynflowLogo size={18} /><span style={{ fontSize:13,fontWeight:600,color:theme.accent }}>Built for NZ Businesses</span></div>
        <h1 style={{ fontSize:isMobile?36:64,fontWeight:800,color:theme.text,lineHeight:1.1,marginBottom:isMobile?16:24,fontFamily:theme.fontDisplay }}>Stop Chasing Quotes.<br /><span style={{ color:theme.accent }}>Start Winning Jobs.</span></h1>
        <p style={{ fontSize:isMobile?16:20,color:theme.textMuted,lineHeight:1.6,maxWidth:600,margin:"0 auto 40px" }}>Upload your quote, hit send, and let Wynflow handle the follow-ups. Automated emails chase your customers so you can focus on what you do best.</p>
        <div style={{ display:"flex",gap:12,justifyContent:"center",flexDirection:isMobile?"column":"row",alignItems:"center" }}><Button size={isMobile?"md":"lg"} onClick={() => dispatch({ type:"SET_SCREEN",payload:"signup" })}>Start Free Trial →</Button><Button size={isMobile?"md":"lg"} variant="secondary" onClick={() => dispatch({ type:"SET_SCREEN",payload:"pricing" })}>View Pricing</Button></div>
        <p style={{ fontSize:13,color:theme.textDim,marginTop:16 }}>No credit card required • 14-day free trial • Cancel anytime</p>
      </div>
    </div>
    <div style={{ padding:isMobile?"60px 20px":"100px 48px",background:theme.surface }}>
      <div style={{ maxWidth:1100,margin:"0 auto",textAlign:"center" }}>
        <h2 style={{ fontSize:isMobile?28:40,fontWeight:700,color:theme.text,marginBottom:16,fontFamily:theme.fontDisplay }}>How It Works</h2>
        <p style={{ fontSize:16,color:theme.textMuted,marginBottom:isMobile?40:64,maxWidth:500,margin:"0 auto 64px" }}>Three simple steps to never chase a quote again</p>
        <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:isMobile?20:32 }}>
          {[{num:"01",Icon:Upload,title:"Upload Your Quote",desc:"Create your quote however you normally do. Save it as a file and upload it to Wynflow."},{num:"02",Icon:Send,title:"Hit Send",desc:"Add the customer's email, job title and amount. Wynflow sends a branded email with your quote and response buttons."},{num:"03",Icon:Bot,title:"Wynflow Chases",desc:"If they don't respond, automated follow-ups kick in. When they click Book In, Decline, or Feedback — you're notified."}].map((step,i) => {
            const StepIcon = step.Icon;
            return (
            <div key={i} style={{ padding:isMobile?24:40,borderRadius:20,background:theme.bg,border:`1px solid ${theme.border}`,textAlign:"left",transition:"all 0.3s ease" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = theme.accent + "44"; e.currentTarget.style.transform = "translateY(-4px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.transform = "translateY(0)"; }}>
              <div style={{ fontSize:48,fontWeight:800,color:theme.accent,fontFamily:theme.fontDisplay,opacity:0.3,marginBottom:8 }}>{step.num}</div>
              <div style={{ width:48,height:48,borderRadius:12,background:theme.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16 }}><StepIcon size={24} color={theme.accent} /></div>
              <h3 style={{ fontSize:20,fontWeight:700,color:theme.text,marginBottom:12 }}>{step.title}</h3>
              <p style={{ fontSize:14,color:theme.textMuted,lineHeight:1.7 }}>{step.desc}</p>
            </div>
            );
          })}
        </div>
      </div>
    </div>
    <div style={{ padding:isMobile?"60px 20px":"100px 48px",background:theme.bg }}>
      <div style={{ maxWidth:1100,margin:"0 auto" }}>
        <div style={{ textAlign:"center",marginBottom:isMobile?40:64 }}><h2 style={{ fontSize:isMobile?28:40,fontWeight:700,color:theme.text,marginBottom:16,fontFamily:theme.fontDisplay }}>Everything You Need</h2><p style={{ fontSize:16,color:theme.textMuted }}>Built for service businesses who are sick of chasing quotes</p></div>
        <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:isMobile?16:24 }}>
          {[{Icon:ClipboardList,title:"Quote Dashboard",desc:"See every quote at a glance — who's opened it, who's responded, and what needs attention."},{Icon:RefreshCw,title:"Automated Follow-Ups",desc:"Set it and forget it. Configure email sequences that chase at day 2, 5, 10 — whatever works."},{Icon:Paperclip,title:"File Attachments",desc:"Upload your quote file and it gets attached to the email automatically."},{Icon:CheckCircle2,title:"One-Click Responses",desc:"Customers click Book In, Decline, or Give Feedback right in the email."},{Icon:BarChart3,title:"Track Everything",desc:"Know when emails are opened, which quotes are pending, and your win rate."},{Icon:Lock,title:"Secure & Private",desc:"Your data is encrypted and isolated. Bank-grade security."}].map((f,i) => {
            const FIcon = f.Icon;
            return (
            <div key={i} style={{ padding:isMobile?20:32,borderRadius:16,background:theme.surface,border:`1px solid ${theme.border}`,display:"flex",gap:16,transition:"all 0.3s ease" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = theme.accent + "33"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; }}>
              <div style={{ width:44,height:44,borderRadius:12,background:theme.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><FIcon size={20} color={theme.accent} /></div>
              <div><h3 style={{ fontSize:16,fontWeight:600,color:theme.text,marginBottom:8 }}>{f.title}</h3><p style={{ fontSize:14,color:theme.textMuted,lineHeight:1.6 }}>{f.desc}</p></div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
    <div style={{ padding:isMobile?"60px 20px":"100px 48px",background:theme.surface }}>
      <div style={{ maxWidth:900,margin:"0 auto",textAlign:"center" }}>
        <h2 style={{ fontSize:isMobile?28:40,fontWeight:700,color:theme.text,marginBottom:isMobile?32:64,fontFamily:theme.fontDisplay }}>Trusted by Businesses Across NZ</h2>
        <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:isMobile?16:24 }}>
          {[{name:"Mike R.",trade:"Plumber, Auckland",quote:"I used to spend 30 minutes a day chasing quotes. Now Wynflow does it while I'm on the job. Won 3 extra jobs last month."},{name:"Sarah T.",trade:"Interior Designer, Wellington",quote:"The customer response buttons are genius. People actually reply now. My conversion went from 40% to 65%."},{name:"Dave L.",trade:"Builder, Christchurch",quote:"Dead simple to use. Upload the quote, add the email, done. Exactly what busy businesses need."}].map((t,i) => (
            <div key={i} style={{ padding:isMobile?20:32,borderRadius:16,background:theme.bg,border:`1px solid ${theme.border}`,textAlign:"left" }}>
              <div style={{ display:"flex",gap:4,marginBottom:16 }}>{[1,2,3,4,5].map(s=><Star key={s} size={16} color={theme.accent} fill={theme.accent} />)}</div>
              <p style={{ fontSize:14,color:theme.textMuted,lineHeight:1.7,marginBottom:20,fontStyle:"italic" }}>"{t.quote}"</p>
              <div style={{ fontSize:14,fontWeight:600,color:theme.text }}>{t.name}</div>
              <div style={{ fontSize:12,color:theme.textDim }}>{t.trade}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div style={{ padding:isMobile?"60px 20px":"100px 48px",textAlign:"center",background:`radial-gradient(ellipse at 50% 50%,rgba(20,184,166,0.12) 0%,transparent 60%),${theme.bg}` }}>
      <h2 style={{ fontSize:isMobile?32:44,fontWeight:700,color:theme.text,marginBottom:16,fontFamily:theme.fontDisplay }}>Ready to Win More Jobs?</h2>
      <p style={{ fontSize:isMobile?16:18,color:theme.textMuted,marginBottom:40 }}>Join hundreds of NZ businesses who've stopped chasing and started winning.</p>
      <Button size="lg" onClick={() => dispatch({ type:"SET_SCREEN",payload:"signup" })}>Start Your Free Trial →</Button>
    </div>
    <Footer dispatch={dispatch} />
  </div>
  );
};

const AboutPage = ({ dispatch }) => {
  const isMobile = useIsMobile();
  const stats = [
    { value: "2%", label: "of sales happen on first contact", color: theme.red },
    { value: "80%", label: "of deals need 5+ follow-ups to close", color: theme.accent },
    { value: "44%", label: "of salespeople give up after just one follow-up", color: theme.red },
    { value: "50%", label: "boost in replies from just one follow-up email", color: theme.green },
  ];
  return (
  <div>
    <div style={{ padding:isMobile?"100px 20px 60px":"140px 48px 80px",textAlign:"center",background:`radial-gradient(ellipse at 50% 30%,rgba(20,184,166,0.08) 0%,transparent 50%),${theme.bg}` }}>
      <h1 style={{ fontSize:isMobile?36:52,fontWeight:700,color:theme.text,marginBottom:20,fontFamily:theme.fontDisplay }}>The Story Behind Wynflow</h1>
      <p style={{ fontSize:isMobile?16:18,color:theme.textMuted,maxWidth:600,margin:"0 auto",lineHeight:1.6 }}>Built from a real problem, by someone who watched it happen every day.</p>
    </div>
    <div style={{ padding:isMobile?"40px 20px":"80px 48px",background:theme.surface }}>
      <div style={{ maxWidth:720,margin:"0 auto" }}>
        <div style={{ padding:isMobile?24:48,borderRadius:20,background:theme.bg,border:`1px solid ${theme.border}`,marginBottom:isMobile?32:64 }}>
          <div style={{ width:56,height:56,borderRadius:16,overflow:"hidden",marginBottom:24 }}><WynflowLogo size={56} /></div>
          <h2 style={{ fontSize:isMobile?22:28,fontWeight:700,color:theme.text,marginBottom:20,fontFamily:theme.fontDisplay,lineHeight:1.3 }}>It started with my dad's carpet shop.</h2>
          <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
            <p style={{ fontSize:15,color:theme.textMuted,lineHeight:1.8,margin:0 }}>My dad ran a flooring business in Napier for years. Great at his trade, terrible at admin. I'd watch him spend his evenings at the kitchen table — measuring jobs, working out pricing, sending off quotes.</p>
            <p style={{ fontSize:15,color:theme.textMuted,lineHeight:1.8,margin:0 }}>Then nothing. If the customer didn't respond straight away, the quote would just sit there. He'd get busy with the next job, the next measure, the next customer. By the time he thought about following up, he either couldn't find the quote or the customer had already gone with someone else.</p>
            <p style={{ fontSize:15,color:theme.textMuted,lineHeight:1.8,margin:0 }}>One Christmas he told me: <span style={{ color:theme.text,fontWeight:500 }}>"If you want to get me something, get me a robot that does my quoting."</span> He was joking — but it stuck with me.</p>
            <p style={{ fontSize:15,color:theme.textMuted,lineHeight:1.8,margin:0 }}>I started digging into it and realised it wasn't just him. Across every trade, every industry, the data tells the same story: businesses don't lose work because they're too expensive. They lose it because they're too slow to follow up.</p>
            <p style={{ fontSize:15,color:theme.textMuted,lineHeight:1.8,margin:0 }}>That's where Wynflow came from — a system that sends your quotes, chases your customers automatically, and lets you track every single one from sent to booked.</p>
          </div>
        </div>
        <h2 style={{ fontSize:isMobile?24:32,fontWeight:700,color:theme.text,marginBottom:12,fontFamily:theme.fontDisplay,textAlign:"center" }}>The Data Doesn't Lie</h2>
        <p style={{ fontSize:15,color:theme.textMuted,textAlign:"center",marginBottom:isMobile?32:48,maxWidth:500,margin:"0 auto",lineHeight:1.6 }}>The research is clear: following up is the single biggest thing you can do to win more work.</p>
        <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:isMobile?12:16,marginBottom:isMobile?32:64 }}>
          {stats.map((s,i) => (
            <div key={i} style={{ padding:isMobile?16:24,borderRadius:16,background:theme.bg,border:`1px solid ${theme.border}`,textAlign:"center" }}>
              <div style={{ fontSize:isMobile?28:40,fontWeight:800,color:s.color,fontFamily:theme.fontDisplay,marginBottom:8 }}>{s.value}</div>
              <div style={{ fontSize:12,color:theme.textMuted,lineHeight:1.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div style={{ padding:isMobile?"40px 20px":"80px 48px",background:theme.bg }}>
      <div style={{ maxWidth:720,margin:"0 auto" }}>
        <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:isMobile?24:48,alignItems:"start",marginBottom:isMobile?40:64 }}>
          <div>
            <div style={{ width:44,height:44,borderRadius:12,background:"rgba(239,68,68,0.1)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16 }}><XCircle size={22} color={theme.red} /></div>
            <h3 style={{ fontSize:isMobile?20:24,fontWeight:700,color:theme.text,marginBottom:12,fontFamily:theme.fontDisplay }}>The Problem</h3>
            <p style={{ fontSize:15,color:theme.textMuted,lineHeight:1.8 }}>Service businesses spend hours scoping jobs and writing quotes — only to let them die in someone's inbox. Research shows that 92% of people stop following up after just four attempts, even though most deals need five or more touchpoints. The first person to follow up wins the job 35-50% of the time.</p>
          </div>
          <div>
            <div style={{ width:44,height:44,borderRadius:12,background:"rgba(34,197,94,0.1)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16 }}><CheckCircle2 size={22} color={theme.green} /></div>
            <h3 style={{ fontSize:isMobile?20:24,fontWeight:700,color:theme.text,marginBottom:12,fontFamily:theme.fontDisplay }}>The Solution</h3>
            <p style={{ fontSize:15,color:theme.textMuted,lineHeight:1.8 }}>Wynflow takes the chasing out of your hands. Upload your quote, hit send, and our automated system follows up at exactly the right intervals — professional, consistent, and hands-free. You get notified the moment a customer responds. No more lost jobs from forgotten follow-ups.</p>
          </div>
        </div>
        <div style={{ padding:isMobile?32:56,borderRadius:24,background:`linear-gradient(135deg, rgba(20,184,166,0.08), rgba(20,184,166,0.02))`,border:`1px solid ${theme.accent}22`,textAlign:"center",marginBottom:isMobile?40:64 }}>
          <div style={{ fontSize:isMobile?56:80,fontWeight:800,color:theme.accent,fontFamily:theme.fontDisplay,lineHeight:1 }}>70%</div>
          <p style={{ fontSize:isMobile?15:17,color:theme.textMuted,marginTop:16,maxWidth:500,margin:"16px auto 0",lineHeight:1.6 }}>increase in conversion rates just by making a few extra follow-up attempts. Most businesses leave this on the table.</p>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:isMobile?16:24,marginBottom:isMobile?40:64 }}>
          {[
            { icon: Clock, stat: "5 mins", desc: "Responding within 5 minutes makes you 9x more likely to convert a lead" },
            { icon: Mail, stat: "3 emails", desc: "Three follow-up emails hit the sweet spot with a 9.2% reply rate" },
            { icon: BarChart3, stat: "35-50%", desc: "of jobs go to the vendor who responds first — speed wins" },
          ].map((item,i) => {
            const ItemIcon = item.icon;
            return (
            <div key={i} style={{ padding:isMobile?20:28,borderRadius:16,background:theme.surface,border:`1px solid ${theme.border}`,textAlign:"center" }}>
              <div style={{ width:44,height:44,borderRadius:12,background:theme.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px" }}><ItemIcon size={20} color={theme.accent} /></div>
              <div style={{ fontSize:isMobile?24:32,fontWeight:800,color:theme.text,fontFamily:theme.fontDisplay,marginBottom:8 }}>{item.stat}</div>
              <p style={{ fontSize:13,color:theme.textMuted,lineHeight:1.5 }}>{item.desc}</p>
            </div>
            );
          })}
        </div>
      </div>
    </div>
    <div style={{ padding:isMobile?"40px 20px":"80px 48px",background:theme.surface }}>
      <div style={{ maxWidth:720,margin:"0 auto" }}>
        <div style={{ padding:isMobile?24:48,borderRadius:20,background:theme.bg,border:`1px solid ${theme.border}`,textAlign:"center" }}>
          <h2 style={{ fontSize:isMobile?24:32,fontWeight:700,color:theme.text,marginBottom:16,fontFamily:theme.fontDisplay }}>Built by a Kiwi, for Kiwi Businesses</h2>
          <p style={{ fontSize:15,color:theme.textMuted,lineHeight:1.8,maxWidth:560,margin:"0 auto 8px" }}>I'm Jesse — a young Kiwi based in Auckland. I built Wynflow because I saw firsthand how much time and money small businesses waste on things that should be automatic.</p>
          <p style={{ fontSize:15,color:theme.textMuted,lineHeight:1.8,maxWidth:560,margin:"0 auto 24px" }}>Wynflow is built specifically for how NZ businesses actually work. No complicated setup, no enterprise pricing, no fluff. Just send your quote and let the system do the chasing. New Zealand has over 600,000 small businesses — 97% of all businesses in the country. Most of them are too busy doing the work to chase the paperwork. That's what Wynflow is for.</p>
          <div style={{ display:"flex",gap:isMobile?16:32,justifyContent:"center",marginTop:32,flexWrap:"wrap" }}>
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center" }}><div style={{ width:48,height:48,borderRadius:12,background:theme.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:8 }}><Globe size={22} color={theme.accent} /></div><div style={{ fontSize:13,color:theme.textMuted }}>100% NZ Built</div></div>
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center" }}><div style={{ width:48,height:48,borderRadius:12,background:theme.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:8 }}><Cpu size={22} color={theme.accent} /></div><div style={{ fontSize:13,color:theme.textMuted }}>AI-Powered</div></div>
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center" }}><div style={{ width:48,height:48,borderRadius:12,background:theme.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:8 }}><Wrench size={22} color={theme.accent} /></div><div style={{ fontSize:13,color:theme.textMuted }}>Made for Business</div></div>
          </div>
        </div>
      </div>
    </div>
    <div style={{ padding:isMobile?"40px 20px":"80px 48px",background:theme.bg,textAlign:"center" }}>
      <h2 style={{ fontSize:isMobile?28:36,fontWeight:700,color:theme.text,marginBottom:16,fontFamily:theme.fontDisplay }}>Stop Losing Jobs to Silence</h2>
      <p style={{ fontSize:16,color:theme.textMuted,marginBottom:32,maxWidth:440,margin:"0 auto 32px" }}>Your quotes deserve a follow-up. Your customers expect one. Let Wynflow handle it.</p>
      <Button size="lg" onClick={() => dispatch({ type:"SET_SCREEN",payload:"signup" })}>Start Your Free Trial →</Button>
    </div>
    <Footer dispatch={dispatch} />
  </div>
  );
};

const PricingPage = ({ dispatch }) => {
  const isMobile = useIsMobile();
  return (
  <div>
    <div style={{ padding:isMobile?"100px 20px 60px":"140px 48px 80px",textAlign:"center",background:`radial-gradient(ellipse at 50% 30%,rgba(20,184,166,0.08) 0%,transparent 50%),${theme.bg}` }}>
      <h1 style={{ fontSize:isMobile?36:52,fontWeight:700,color:theme.text,marginBottom:20,fontFamily:theme.fontDisplay }}>Simple, Honest Pricing</h1>
      <p style={{ fontSize:isMobile?16:18,color:theme.textMuted,maxWidth:500,margin:"0 auto",lineHeight:1.6 }}>No hidden fees. No lock-in contracts. 14-day free trial on every plan.</p>
    </div>
    <div style={{ padding:isMobile?"0 20px 60px":"0 48px 100px",background:theme.bg }}>
      <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:isMobile?20:32,maxWidth:800,margin:"0 auto" }}>
        {[
          {name:"Starter",price:"29",desc:"Everything you need to win more jobs",features:["Unlimited quotes","1 follow-up sequence","File attachments","Customer response buttons","Email support","Quote dashboard"],highlighted:true,active:true},
          {name:"Pro",price:"49",desc:"For businesses who want the full toolkit",features:["Everything in Starter","Unlimited sequences","Custom email messages","Advanced analytics","Custom email branding","Team access (up to 3 users)","Priority support"],highlighted:false,active:false},
        ].map((plan,i) => (
          <div key={i} style={{ padding:isMobile?28:40,borderRadius:20,background:theme.surface,border:`${plan.highlighted?"2px":"1px"} solid ${plan.highlighted?theme.accent:theme.border}`,position:"relative",transform:plan.highlighted && !isMobile?"scale(1.03)":"none",boxShadow:plan.highlighted?`0 0 40px ${theme.accentGlow}`:"none",transition:"all 0.3s ease" }}>
            {plan.highlighted && <div style={{ position:"absolute",top:-14,left:"50%",transform:"translateX(-50%)",padding:"6px 20px",borderRadius:20,background:theme.accent,color:"#000",fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:1 }}>Most Popular</div>}
            <h3 style={{ fontSize:22,fontWeight:700,color:theme.text,marginBottom:8 }}>{plan.name}</h3>
            <p style={{ fontSize:13,color:theme.textMuted,marginBottom:24 }}>{plan.desc}</p>
            <div style={{ marginBottom:32 }}><span style={{ fontSize:52,fontWeight:800,color:theme.text,fontFamily:theme.fontDisplay }}>${plan.price}</span><span style={{ fontSize:16,color:theme.textMuted }}>/month</span></div>
            {plan.active ? (
              <Button onClick={() => dispatch({ type:"SET_SCREEN",payload:"signup" })} variant={plan.highlighted?"primary":"secondary"} style={{ width:"100%",justifyContent:"center",padding:"14px 24px",marginBottom:32 }}>Start Free Trial</Button>
            ) : (
              <div style={{ width:"100%",textAlign:"center",padding:"14px 24px",marginBottom:32,borderRadius:10,background:theme.surfaceLight,border:`1px solid ${theme.border}`,color:theme.textMuted,fontWeight:600,fontSize:15 }}>Coming Soon</div>
            )}
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>{plan.features.map((f,j) => <div key={j} style={{ display:"flex",alignItems:"center",gap:10,fontSize:14,color:plan.active ? theme.textMuted : theme.textMuted + "88" }}><span style={{ color:plan.active ? theme.green : theme.textMuted,fontSize:16 }}>✓</span> {f}</div>)}</div>
          </div>
        ))}
      </div>
    </div>
    <div style={{ padding:"80px 48px",background:theme.surface }}>
      <div style={{ maxWidth:700,margin:"0 auto" }}>
        <h2 style={{ fontSize:36,fontWeight:700,color:theme.text,marginBottom:48,textAlign:"center",fontFamily:theme.fontDisplay }}>Frequently Asked Questions</h2>
        {[{q:"Is there really a free trial?",a:"Yes! 14 days, full access, no credit card needed."},{q:"Can I cancel anytime?",a:"Absolutely. No lock-in contracts, no cancellation fees."},{q:"Do my customers know it's automated?",a:"Emails come from Wynflow on behalf of your business. They look professional and personal."},{q:"What if I already have quoting software?",a:"Keep using it! Just export your quote and upload to Wynflow. We handle delivery and chasing."},{q:"Is my data secure?",a:"100%. Bank-grade encryption, every business's data is completely isolated."}].map((faq,i) => (
          <div key={i} style={{ padding:"24px 0",borderBottom:`1px solid ${theme.border}` }}><h3 style={{ fontSize:16,fontWeight:600,color:theme.text,marginBottom:8 }}>{faq.q}</h3><p style={{ fontSize:14,color:theme.textMuted,lineHeight:1.7 }}>{faq.a}</p></div>
        ))}
      </div>
    </div>
    <div style={{ padding:"80px 48px",background:theme.bg,textAlign:"center" }}>
      <h2 style={{ fontSize:36,fontWeight:700,color:theme.text,marginBottom:16,fontFamily:theme.fontDisplay }}>Still Not Sure?</h2>
      <p style={{ fontSize:16,color:theme.textMuted,marginBottom:32 }}>Start your free trial — no credit card, no commitment.</p>
      <Button size="lg" onClick={() => dispatch({ type:"SET_SCREEN",payload:"signup" })}>Start Free Trial →</Button>
    </div>
    <Footer dispatch={dispatch} />
  </div>
  );
};

// ════════════════════════════════════════
// AUTH
// ════════════════════════════════════════

const setCookie = (name, value, minutes) => {
  const expires = new Date(Date.now() + minutes * 60000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(JSON.stringify(value))}; expires=${expires}; path=/; SameSite=Strict`;
};
const getCookie = (name) => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) try { return JSON.parse(decodeURIComponent(match[2])); } catch { return null; }
  return null;
};
const clearCookies = () => {
  document.cookie = "wynflow_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  document.cookie = "wynflow_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  document.cookie = "wynflow_business=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
};

const AuthScreen = ({ dispatch, isSignup }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [trade, setTrade] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleReset = async () => {
    if (!email) { setError("Please enter your email address"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Failed to send reset email");
      setResetSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!email || !password) { setError("Please enter email and password"); return; }
    if (isSignup && (!businessName || !contactName)) { setError("Please fill in all required fields"); return; }
    setLoading(true);
    setError("");
    try {
      if (isSignup) {
        const authData = await supabase.auth_signUp(email, password);
        if (!authData.user) throw new Error("Signup failed — please try again");
        if (!authData.access_token) throw new Error("An account with this email already exists. Try signing in instead.");
        const { data: biz, error: bizErr } = await db("businesses").insert({
          user_id: authData.user.id,
          business_name: businessName,
          contact_name: contactName,
          email: email,
          trade: trade || null,
          subscription_status: "trialing",
        });
        if (bizErr || !biz || !biz[0]) {
          const { data: existingBiz } = await db("businesses").eq("user_id", authData.user.id).single().select();
          if (existingBiz) {
            dispatch({ type: "SET_USER", payload: authData.user });
            dispatch({ type: "SET_BUSINESS", payload: existingBiz });
            setCookie("wynflow_token", supabase.token, 30);
            setCookie("wynflow_user", authData.user, 30);
            setCookie("wynflow_business", existingBiz, 30);
            dispatch({ type: "NOTIFY", payload: { message: "Welcome to Wynflow!", type: "success" } });
          } else {
            throw new Error("Account created but business profile failed. Please try logging in.");
          }
          setLoading(false);
          return;
        }
        const bizRecord = biz[0];
        if (bizRecord) {
          const { data: seq } = await db("follow_up_sequences").insert({
            business_id: bizRecord.id,
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
        dispatch({ type: "SET_BUSINESS", payload: bizRecord });
        setCookie("wynflow_token", supabase.token, 30);
        setCookie("wynflow_user", authData.user, 30);
        setCookie("wynflow_business", bizRecord, 30);
        dispatch({ type: "NOTIFY", payload: { message: "Account created! Welcome to Wynflow!", type: "success" } });
        fetch("https://wynfallautomation.app.n8n.cloud/webhook/new-business", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ business_name: businessName, contact_name: contactName, email, trade }),
        }).catch(() => {});
      } else {
        const authData = await supabase.auth_signIn(email, password);
        if (!authData.user) throw new Error("Login failed — check your email and password");
        dispatch({ type: "SET_USER", payload: authData.user });
        let biz = null;
        const { data: bizSingle, error: bizErr } = await db("businesses").eq("user_id", authData.user.id).single().select();
        if (bizSingle && !bizErr) {
          biz = bizSingle;
        } else {
          const { data: bizArray } = await db("businesses").eq("user_id", authData.user.id).select();
          if (bizArray && bizArray.length > 0) biz = bizArray[0];
        }
        if (!biz) throw new Error("No business profile found for this account. Please sign up instead.");
        dispatch({ type: "SET_BUSINESS", payload: biz });
        setCookie("wynflow_token", supabase.token, 30);
        setCookie("wynflow_user", authData.user, 30);
        setCookie("wynflow_business", biz, 30);
        dispatch({ type: "NOTIFY", payload: { message: "Welcome back!", type: "success" } });
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
      background: `radial-gradient(ellipse at 30% 20%, rgba(20,184,166,0.08) 0%, transparent 50%),
                    radial-gradient(ellipse at 70% 80%, rgba(59,130,246,0.05) 0%, transparent 50%),
                    ${theme.bg}`,
      fontFamily: theme.font, padding: 20,
    }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, overflow: "hidden" }}><WynflowLogo size={48} /></div>
            <span style={{ fontSize: 28, fontWeight: 700, color: theme.text, fontFamily: theme.fontDisplay }}>Wynflow</span>
          </div>
          <div style={{ fontSize: 15, color: theme.textMuted, lineHeight: 1.5 }}>
            {isSignup ? "Set up your account in 30 seconds" : "Welcome back — your quotes are waiting"}
          </div>
        </div>
        <Card style={{ padding: 32 }}>
          {resetMode ? (
            resetSent ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <CheckCircle2 size={48} color={theme.green} style={{ marginBottom: 16 }} />
                <h3 style={{ fontSize: 18, fontWeight: 600, color: theme.text, margin: "0 0 8px" }}>Check Your Email</h3>
                <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.6, margin: "0 0 20px" }}>
                  We've sent a password reset link to <strong style={{ color: theme.text }}>{email}</strong>.
                </p>
                <Button variant="secondary" onClick={() => { setResetMode(false); setResetSent(false); }}
                  style={{ width: "100%", justifyContent: "center" }}>Back to Sign In</Button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ textAlign: "center", marginBottom: 8 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: theme.text, margin: "0 0 8px" }}>Reset Password</h3>
                  <p style={{ fontSize: 14, color: theme.textMuted }}>Enter your email and we'll send you a reset link</p>
                </div>
                <Input label="Email *" value={email} onChange={setEmail} type="email" />
                {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: theme.redSoft, color: theme.red, fontSize: 13 }}>{error}</div>}
                <Button onClick={handleReset} disabled={loading}
                  style={{ width: "100%", justifyContent: "center", padding: "14px 24px" }}>
                  {loading ? "Sending..." : "Send Reset Link →"}
                </Button>
                <div style={{ textAlign: "center" }}>
                  <span onClick={() => { setResetMode(false); setError(""); }}
                    style={{ fontSize: 13, color: theme.accent, cursor: "pointer", fontWeight: 500 }}>Back to Sign In</span>
                </div>
              </div>
            )
          ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {isSignup && (
              <>
                <Input label="Business Name *" value={businessName} onChange={setBusinessName} />
                <Input label="Your Name *" value={contactName} onChange={setContactName} />
                <Input label="Industry" value={trade} onChange={setTrade} />
              </>
            )}
            <Input label="Email *" value={email} onChange={setEmail} type="email" />
            <Input label="Password *" value={password} onChange={setPassword} type="password" />
            {!isSignup && (
              <div style={{ textAlign: "right", marginTop: -10 }}>
                <span onClick={() => { setResetMode(true); setError(""); }}
                  style={{ fontSize: 13, color: theme.accent, cursor: "pointer" }}>Forgot password?</span>
              </div>
            )}
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
          )}
        </Card>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: theme.textMuted }}>
          {isSignup ? "Already have an account? " : "Don't have an account? "}
          <span onClick={() => dispatch({ type: "SET_SCREEN", payload: isSignup ? "login" : "signup" })}
            style={{ color: theme.accent, cursor: "pointer", fontWeight: 600 }}>
            {isSignup ? "Sign in" : "Sign up free"}
          </span>
          <span style={{ margin: "0 8px", color: theme.textDim }}>•</span>
          <span onClick={() => dispatch({ type: "SET_SCREEN", payload: "home" })}
            style={{ color: theme.textMuted, cursor: "pointer" }}>Back to home</span>
        </div>
      </div>
    </div>
  );
};

// ─── Sidebar ───
const Sidebar = ({ screen, dispatch, business }) => {
  const isMobile = useIsMobile();
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "quotes", label: "Quotes", icon: FileText },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "sequences", label: "Follow-Ups", icon: RefreshCw },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  const handleLogout = async () => {
    await supabase.auth_signOut();
    clearCookies();
    dispatch({ type: "LOGOUT" });
  };

  if (isMobile) {
    return (
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: theme.surface, borderTop: `1px solid ${theme.border}`,
        display: "flex", justifyContent: "space-around", padding: "8px 0 12px",
      }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
          <div key={item.id} onClick={() => dispatch({ type: "SET_SCREEN", payload: item.id })}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              cursor: "pointer", padding: "4px 12px",
              color: screen === item.id ? theme.accent : theme.textMuted,
            }}>
            <Icon size={20} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>{item.label}</span>
          </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{
      width: 260, background: theme.surface, borderRight: `1px solid ${theme.border}`,
      display: "flex", flexDirection: "column", padding: "24px 16px", flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 36 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, overflow: "hidden" }}><WynflowLogo size={36} /></div>
        <span style={{ fontSize: 20, fontWeight: 700, color: theme.text, fontFamily: theme.fontDisplay }}>Wynflow</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
          <div key={item.id} onClick={() => dispatch({ type: "SET_SCREEN", payload: item.id })}
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 500,
              background: screen === item.id ? theme.accentSoft : "transparent",
              color: screen === item.id ? theme.accent : theme.textMuted,
              transition: "all 0.2s ease",
            }}>
            <Icon size={18} />
            {item.label}
          </div>
          );
        })}
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
  const isMobile = useIsMobile();
  const total = quotes.length;
  const pending = quotes.filter((q) => q.status === "sent" || q.status === "pending" || q.status === "opened").length;
  const accepted = quotes.filter((q) => q.status === "accepted").length;
  const booked = quotes.filter((q) => q.status === "booked").length;
  const revenue = quotes.filter((q) => q.status === "accepted" || q.status === "booked").reduce((sum, q) => sum + parseFloat(q.amount || 0), 0);
  const recentQuotes = [...quotes].slice(0, 5);

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>Dashboard</h1>
        <p style={{ fontSize: 14, color: theme.textMuted, margin: "8px 0 0" }}>Here's what's happening with your quotes</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr 1fr", gap: 12, marginBottom: 32 }}>
        <Stat label="Total Quotes" value={total} icon={FileText} />
        <Stat label="Awaiting Response" value={pending} accent={theme.accent} icon={Clock} />
        <Stat label="Accepted" value={accepted} accent="#F59E0B" icon={CheckCircle2} />
        <Stat label="Booked" value={booked} accent={theme.green} icon={Check} />
        <Stat label="Revenue" value={`$${revenue.toLocaleString()}`} accent={theme.green} icon={DollarSign} />
      </div>
      {accepted > 0 && (
        <div onClick={() => dispatch({ type: "SET_SCREEN", payload: "quotes" })}
          style={{
            padding: "14px 20px", borderRadius: 10, marginBottom: 20, cursor: "pointer",
            background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
          <Clock size={18} color="#F59E0B" />
          <span style={{ fontSize: 14, color: "#F59E0B", fontWeight: 500 }}>
            {accepted} accepted quote{accepted > 1 ? "s" : ""} need{accepted === 1 ? "s" : ""} to be booked in — call your customer{accepted > 1 ? "s" : ""}!
          </span>
        </div>
      )}
      <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
        <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "newQuote" })}><Plus size={16} /> New Quote</Button>
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
  const isMobile = useIsMobile();
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
        <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "newQuote" })}><Plus size={16} /> New Quote</Button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {["all", "sent", "opened", "accepted", "booked", "declined"].map((f) => (
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
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          style={{
            fontFamily: theme.font, fontSize: 13, padding: "8px 16px", borderRadius: 8,
            background: theme.surfaceLight, border: `1px solid ${theme.border}`, color: theme.text, outline: "none", width: 200,
          }} />
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {!isMobile && (
        <div style={{
          display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 80px",
          padding: "14px 20px", borderBottom: `1px solid ${theme.border}`, fontSize: 12,
          fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.5,
        }}>
          <span>Customer</span><span>Job</span><span>Amount</span><span>Status</span><span></span>
        </div>
        )}
        {filtered.map((q) => (
          <div key={q.id}
            onClick={() => dispatch({ type: "SET_SCREEN", payload: "quoteDetail:" + q.id })}
            style={isMobile ? {
              padding: "16px 20px", borderBottom: `1px solid ${theme.border}08`, cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            } : {
              display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 80px",
              padding: "16px 20px", borderBottom: `1px solid ${theme.border}08`, cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = theme.surfaceLight)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {isMobile ? (
              <>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{q.customer_name}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>{q.job_title}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>${parseFloat(q.amount || 0).toLocaleString()}</span>
                  <Badge status={q.status} />
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
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

// ─── Analytics ───
const Analytics = ({ quotes }) => {
  const isMobile = useIsMobile();
  
  // Quote stats
  const total = quotes.length;
  const sent = quotes.filter(q => q.status === "sent" || q.status === "opened").length;
  const accepted = quotes.filter(q => q.status === "accepted").length;
  const booked = quotes.filter(q => q.status === "booked").length;
  const declined = quotes.filter(q => q.status === "declined").length;
  const won = accepted + booked;
  const responded = won + declined;
  const winRate = responded > 0 ? Math.round((won / responded) * 100) : 0;
  const totalRevenue = quotes.filter(q => q.status === "accepted" || q.status === "booked").reduce((sum, q) => sum + parseFloat(q.amount || 0), 0);
  const avgQuoteValue = total > 0 ? Math.round(totalRevenue / Math.max(won, 1)) : 0;

  // Follow-up effectiveness: which step did they accept on?
  const acceptedQuotes = quotes.filter(q => q.status === "accepted" || q.status === "booked");
  const stepCounts = {};
  acceptedQuotes.forEach(q => {
    const step = q.current_step || 0;
    const label = step === 0 ? "Before follow-ups" : `After follow-up ${step}`;
    stepCounts[label] = (stepCounts[label] || 0) + 1;
  });
  const stepData = Object.entries(stepCounts).sort((a, b) => {
    if (a[0] === "Before follow-ups") return -1;
    if (b[0] === "Before follow-ups") return 1;
    return a[0].localeCompare(b[0]);
  });

  // Monthly trend
  const monthlyData = {};
  quotes.forEach(q => {
    if (!q.created_at) return;
    const d = new Date(q.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyData[key]) monthlyData[key] = { sent: 0, won: 0, declined: 0, revenue: 0 };
    monthlyData[key].sent++;
    if (q.status === "accepted" || q.status === "booked") { monthlyData[key].won++; monthlyData[key].revenue += parseFloat(q.amount || 0); }
    if (q.status === "declined") monthlyData[key].declined++;
  });
  const months = Object.entries(monthlyData).sort((a, b) => a[0].localeCompare(b[0]));

  // Response time
  const responseTimes = quotes.filter(q => q.sent_at && q.responded_at).map(q => {
    const sent = new Date(q.sent_at);
    const resp = new Date(q.responded_at);
    return Math.round((resp - sent) / (1000 * 60 * 60 * 24));
  });
  const avgResponseDays = responseTimes.length > 0 ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : null;

  const BarSimple = ({ value, max, color, label, count }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: theme.textMuted, marginBottom: 4 }}>
        <span>{label}</span><span style={{ fontWeight: 600, color: theme.text }}>{count}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: theme.surfaceLight, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${max > 0 ? (value / max) * 100 : 0}%`, borderRadius: 4, background: color, transition: "width 0.5s" }} />
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>Analytics</h1>
        <p style={{ fontSize: 14, color: theme.textMuted, margin: "8px 0 0" }}>See how your quotes are performing</p>
      </div>

      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <Stat label="Win Rate" value={`${winRate}%`} accent={theme.green} icon={BarChart3} />
        <Stat label="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} accent={theme.green} icon={DollarSign} />
        <Stat label="Avg Quote Value" value={`$${avgQuoteValue.toLocaleString()}`} accent={theme.accent} icon={DollarSign} />
        {avgResponseDays !== null && <Stat label="Avg Response Time" value={`${avgResponseDays}d`} accent={theme.accent} icon={Clock} />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24, marginBottom: 24 }}>
        {/* Quote funnel */}
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 20px" }}>Quote Funnel</h3>
          <BarSimple label="Total Sent" value={total} max={total} color={theme.accent} count={total} />
          <BarSimple label="Awaiting Response" value={sent} max={total} color={theme.blue} count={sent} />
          <BarSimple label="Accepted" value={accepted} max={total} color="#F59E0B" count={accepted} />
          <BarSimple label="Booked" value={booked} max={total} color={theme.green} count={booked} />
          <BarSimple label="Declined" value={declined} max={total} color={theme.red} count={declined} />
        </Card>

        {/* Which follow-up converts */}
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 8px" }}>When Do Customers Accept?</h3>
          <p style={{ fontSize: 13, color: theme.textMuted, margin: "0 0 20px" }}>Which follow-up email triggered the acceptance</p>
          {stepData.length > 0 ? (
            stepData.map(([label, count]) => (
              <BarSimple key={label} label={label} value={count} max={Math.max(...stepData.map(s => s[1]))} color={theme.accent} count={count} />
            ))
          ) : (
            <p style={{ fontSize: 14, color: theme.textDim, textAlign: "center", padding: 20 }}>No accepted quotes yet</p>
          )}
        </Card>
      </div>

      {/* Monthly trend */}
      {months.length > 0 && (
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 20px" }}>Monthly Overview</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  {["Month", "Sent", "Won", "Declined", "Revenue"].map(h => (
                    <th key={h} style={{ textAlign: h === "Month" ? "left" : "right", padding: "10px 12px", borderBottom: `1px solid ${theme.border}`, color: theme.textMuted, fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map(([month, data]) => (
                  <tr key={month}>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}08`, color: theme.text, fontWeight: 500 }}>{new Date(month + "-01").toLocaleDateString("en-NZ", { month: "short", year: "numeric" })}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}08`, color: theme.textMuted, textAlign: "right" }}>{data.sent}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}08`, color: theme.green, textAlign: "right", fontWeight: 600 }}>{data.won}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}08`, color: theme.red, textAlign: "right" }}>{data.declined}</td>
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${theme.border}08`, color: theme.green, textAlign: "right", fontWeight: 600 }}>${data.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

// ─── New Quote Form ───
const NewQuoteForm = ({ dispatch, business, sequences }) => {
  const isMobile = useIsMobile();
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
      if (pdfFile) {
        pdfFilename = `${Date.now()}-${pdfFile.name}`;
        const uploadPath = `${business.id}/${pdfFilename}`;
        const { error: uploadErr } = await supabase.uploadFile("quote-pdfs", uploadPath, pdfFile);
        if (!uploadErr) pdfUrl = uploadPath;
      }
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
        quote_number: "",
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
      await fetch("https://wynfallautomation.app.n8n.cloud/webhook/send-quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_id: newQuote[0].id }),
      });
      dispatch({ type: "ADD_QUOTE", payload: newQuote[0] });
      dispatch({ type: "NOTIFY", payload: { message: `Quote sent to ${form.customerName}! Follow-ups scheduled.`, type: "success" } });
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: err.message, type: "error" } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <span onClick={() => dispatch({ type: "GO_BACK" })}
          style={{ fontSize: 14, color: theme.textMuted, cursor: "pointer" }}>← Back</span>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: theme.text, margin: "8px 0 0", fontFamily: theme.fontDisplay }}>New Quote</h1>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24 }}>
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 20px" }}>Customer Details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Customer Name *" value={form.customerName} onChange={(v) => update("customerName", v)} />
            <Input label="Email *" value={form.customerEmail} onChange={(v) => update("customerEmail", v)} type="email" />
            <Input label="Phone (optional)" value={form.customerPhone} onChange={(v) => update("customerPhone", v)} />
          </div>
        </Card>
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 20px" }}>Job Details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Job Title *" value={form.jobTitle} onChange={(v) => update("jobTitle", v)} />
            <Input label="Description" value={form.description} onChange={(v) => update("description", v)} textarea />
            <Input label="Quote Amount ($) *" value={form.amount} onChange={(v) => update("amount", v)} type="number" />
          </div>
        </Card>
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Quote File</h3>
          <p style={{ fontSize: 13, color: theme.textMuted, margin: "0 0 16px" }}>Upload your quote to attach to the email</p>
          <Input label="Upload File" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onFileChange={(e) => setPdfFile(e.target.files[0])} />
          {pdfFile && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: theme.greenSoft, color: theme.green, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <Paperclip size={14} /> {pdfFile.name} ({(pdfFile.size / 1024).toFixed(0)} KB)
            </div>
          )}
        </Card>
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
  const isMobile = useIsMobile();
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
    const updates = { status, follow_up_paused: status === "accepted" || status === "declined" || status === "booked" };
    if (status === "accepted" || status === "declined") updates.responded_at = new Date().toISOString();
    if (status === "booked") updates.booked_at = new Date().toISOString();
    await db("quotes").eq("id", quote.id).update(updates);
    dispatch({ type: "UPDATE_QUOTE", payload: { id: quote.id, ...updates } });
    const messages = {
      accepted: "Quote marked as accepted — now call and book it in!",
      booked: "Job booked! Nice one.",
      declined: "Quote marked as declined",
    };
    dispatch({ type: "NOTIFY", payload: { message: messages[status] || `Quote marked as ${status}`, type: "success" } });
    if (status === "booked") dispatch({ type: "GO_BACK" });
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <span onClick={() => dispatch({ type: "GO_BACK" })}
          style={{ fontSize: 14, color: theme.textMuted, cursor: "pointer", display: "block", marginBottom: 8 }}>← Back</span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>{quote.job_title}</h1>
            <p style={{ fontSize: 14, color: theme.textMuted, margin: "8px 0 0" }}>Quote {quote.quote_number} • Created {new Date(quote.created_at).toLocaleDateString()}{quote.sent_at ? ` • Sent ${new Date(quote.sent_at).toLocaleDateString()}` : ""}</p>
          </div>
          <Badge status={quote.status} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24 }}>
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
                <div style={{ fontSize: 12, color: theme.textMuted }}>Attached File</div>
                <div style={{ fontSize: 14, color: theme.accent, display: "flex", alignItems: "center", gap: 6 }}><Paperclip size={14} /> {quote.pdf_filename}</div>
              </div>
            )}
          </div>
        </Card>
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
                        {completed ? "Sent" : isNext ? "Next up" : "Scheduled"} — Day {step.delay_days}
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
        {responses.length > 0 && (
          <Card style={{ gridColumn: "1 / -1" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Customer Responses</h3>
            {responses.map((r, i) => (
              <div key={i} style={{
                padding: "12px 16px", borderRadius: 10, background: theme.surfaceLight,
                border: `1px solid ${theme.border}`, marginBottom: 8,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: r.response_type === "book_in" ? theme.green : r.response_type === "decline" ? theme.red : theme.blue, display: "flex", alignItems: "center", gap: 6 }}>
                  {r.response_type === "book_in" ? <><Check size={16} /> Booked In</> : r.response_type === "decline" ? <><XCircle size={16} /> Declined</> : <><MessageSquare size={16} /> Feedback</>}
                </div>
                {r.feedback_text && <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 6 }}>{r.feedback_text}</div>}
                <div style={{ fontSize: 11, color: theme.textDim, marginTop: 4 }}>{new Date(r.responded_at).toLocaleString()}</div>
              </div>
            ))}
          </Card>
        )}
        {quote.status === "accepted" && (
        <Card style={{ gridColumn: "1 / -1", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <Clock size={20} color="#F59E0B" />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#F59E0B", margin: 0 }}>Action Required</h3>
          </div>
          <p style={{ fontSize: 14, color: theme.textMuted, margin: "0 0 16px", lineHeight: 1.5 }}>
            <strong>{quote.customer_name}</strong> has accepted this quote! Call them to confirm the job and lock in a date, then mark it as booked below.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, padding: 16, borderRadius: 10, background: theme.surfaceLight }}>
            {quote.customer_phone && <div style={{ fontSize: 14, color: theme.text }}><strong>Phone:</strong> <a href={"tel:" + quote.customer_phone} style={{ color: theme.accent }}>{quote.customer_phone}</a></div>}
            <div style={{ fontSize: 14, color: theme.text }}><strong>Email:</strong> <a href={"mailto:" + quote.customer_email} style={{ color: theme.accent }}>{quote.customer_email}</a></div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button onClick={() => updateStatus("booked")} style={{ background: theme.green, color: "#fff", display: "inline-flex", alignItems: "center", gap: 6 }}><Check size={16} /> Mark as Booked</Button>
            <Button onClick={() => updateStatus("declined")} variant="danger" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><XCircle size={16} /> Actually Declined</Button>
          </div>
        </Card>
        )}
        {quote.status === "booked" && (
        <Card style={{ gridColumn: "1 / -1", background: theme.greenSoft, border: `1px solid ${theme.green}33` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <CheckCircle2 size={24} color={theme.green} />
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.green, margin: 0 }}>Job Booked!</h3>
              <p style={{ fontSize: 13, color: theme.textMuted, margin: "4px 0 0" }}>
                {quote.booked_at ? `Booked on ${new Date(quote.booked_at).toLocaleDateString()}` : "This job has been confirmed and booked in."}
              </p>
            </div>
          </div>
        </Card>
        )}
        {quote.status !== "accepted" && quote.status !== "declined" && quote.status !== "booked" && (
        <Card style={{ gridColumn: "1 / -1" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Actions</h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button onClick={() => updateStatus("accepted")} style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B", display: "inline-flex", alignItems: "center", gap: 6 }}><Check size={16} /> Mark Accepted</Button>
            <Button onClick={() => updateStatus("declined")} variant="danger" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><XCircle size={16} /> Mark Declined</Button>
            <Button variant="secondary" onClick={async () => {
              if (!window.confirm("Are you sure you want to send a follow-up email to " + quote.customer_name + "?")) return;
              try {
                await fetch("https://wynfallautomation.app.n8n.cloud/webhook/send-follow-up", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ quote_id: quote.id, current_step: quote.current_step || 0, sequence_id: quote.sequence_id }),
                });
                const newStep = (quote.current_step || 0) + 1;
                await db("quotes").eq("id", quote.id).update({ current_step: newStep });
                dispatch({ type: "UPDATE_QUOTE", payload: { id: quote.id, current_step: newStep } });
                dispatch({ type: "NOTIFY", payload: { message: "Follow-up email sent!", type: "success" } });
              } catch (err) {
                dispatch({ type: "NOTIFY", payload: { message: "Failed to send follow-up", type: "error" } });
              }
            }}><Mail size={16} /> Send Follow-Up Now</Button>
          </div>
        </Card>
        )}
      </div>
    </div>
  );
};

// ─── Sequences Manager ───
const SequencesManager = ({ sequences, business, dispatch }) => {
  const isMobile = useIsMobile();
  const [steps, setSteps] = useState({});
  const [editingStep, setEditingStep] = useState(null);
  const [editForm, setEditForm] = useState({ delay_days: "", email_subject: "", email_body: "" });
  const [adding, setAdding] = useState(null);
  const [newStep, setNewStep] = useState({ delay: "", subject: "", body: "" });
  const [saving, setSaving] = useState(false);
  const MAX_STEPS = 5;

  const exampleData = { name: "Sarah", job: "Kitchen Renovation", amount: "4,500", business_name: business?.business_name || "Your Business" };

  const previewText = (text) => text
    .replace(/{name}/g, exampleData.name)
    .replace(/{job}/g, exampleData.job)
    .replace(/{amount}/g, exampleData.amount)
    .replace(/{business_name}/g, exampleData.business_name);

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
    dispatch({ type: "NOTIFY", payload: { message: seq.is_active ? "Sequence paused" : "Sequence activated!", type: "success" } });
  };

  const startEdit = (step) => {
    setEditingStep(step.id);
    setEditForm({ delay_days: step.delay_days, email_subject: step.email_subject, email_body: step.email_body });
    setAdding(null);
  };

  const saveEdit = async (stepId) => {
    setSaving(true);
    await db("sequence_steps").eq("id", stepId).update({
      delay_days: parseInt(editForm.delay_days),
      email_subject: editForm.email_subject,
      email_body: editForm.email_body,
    });
    const seqId = Object.keys(steps).find(k => steps[k].some(s => s.id === stepId));
    if (seqId) {
      setSteps(prev => ({
        ...prev,
        [seqId]: prev[seqId].map(s => s.id === stepId ? { ...s, ...editForm, delay_days: parseInt(editForm.delay_days) } : s)
      }));
    }
    setEditingStep(null);
    setSaving(false);
    dispatch({ type: "NOTIFY", payload: { message: "Step updated!", type: "success" } });
  };

  const deleteStep = async (seqId, stepId) => {
    await db("sequence_steps").eq("id", stepId).delete();
    const remaining = (steps[seqId] || []).filter(s => s.id !== stepId);
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].step_order !== i + 1) {
        await db("sequence_steps").eq("id", remaining[i].id).update({ step_order: i + 1 });
        remaining[i].step_order = i + 1;
      }
    }
    setSteps(prev => ({ ...prev, [seqId]: remaining }));
    setEditingStep(null);
    dispatch({ type: "NOTIFY", payload: { message: "Step removed", type: "success" } });
  };

  const moveStep = async (seqId, index, direction) => {
    const current = [...(steps[seqId] || [])];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= current.length) return;
    [current[index], current[newIndex]] = [current[newIndex], current[index]];
    for (let i = 0; i < current.length; i++) {
      current[i].step_order = i + 1;
      await db("sequence_steps").eq("id", current[i].id).update({ step_order: i + 1 });
    }
    setSteps(prev => ({ ...prev, [seqId]: current }));
  };

  const addStep = async (seqId) => {
    if (!newStep.delay || !newStep.subject || !newStep.body) {
      dispatch({ type: "NOTIFY", payload: { message: "Please fill in all fields", type: "error" } });
      return;
    }
    const currentSteps = steps[seqId] || [];
    if (currentSteps.length >= MAX_STEPS) {
      dispatch({ type: "NOTIFY", payload: { message: `Maximum ${MAX_STEPS} steps on Starter plan`, type: "error" } });
      return;
    }
    setSaving(true);
    const { data } = await db("sequence_steps").insert({
      sequence_id: seqId,
      step_order: currentSteps.length + 1,
      delay_days: parseInt(newStep.delay),
      email_subject: newStep.subject,
      email_body: newStep.body,
    });
    if (data) {
      setSteps(prev => ({ ...prev, [seqId]: [...(prev[seqId] || []), data[0]] }));
      setNewStep({ delay: "", subject: "", body: "" });
      setAdding(null);
      dispatch({ type: "NOTIFY", payload: { message: "Step added!", type: "success" } });
    }
    setSaving(false);
  };

  const EmailPreview = ({ subject, body }) => (
    <div style={{ marginTop: 12, borderRadius: 10, overflow: "hidden", border: `1px solid ${theme.border}` }}>
      <div style={{ padding: "8px 12px", background: theme.surfaceLight, borderBottom: `1px solid ${theme.border}`, fontSize: 11, color: theme.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Email Preview</div>
      <div style={{ padding: 16, background: "#ffffff", borderRadius: "0 0 10px 10px" }}>
        <div style={{ borderBottom: "3px solid #14B8A6", paddingBottom: 12, marginBottom: 12, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Subject</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#0A0E17" }}>{previewText(subject || "")}</div>
        </div>
        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-line" }}>{previewText(body || "")}</div>
        <div style={{ marginTop: 12, padding: 10, background: "#f9fafb", borderRadius: 6 }}>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Quote for: <strong>Kitchen Renovation</strong> — <strong style={{ color: "#14B8A6" }}>$4,500</strong></div>
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12 }}>
          <span style={{ padding: "6px 16px", borderRadius: 6, background: "#22C55E", color: "#fff", fontSize: 11, fontWeight: 600 }}>Book It In</span>
          <span style={{ padding: "6px 16px", borderRadius: 6, background: "#EF4444", color: "#fff", fontSize: 11, fontWeight: 600 }}>Decline</span>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>Follow-Up Sequences</h1>
        <p style={{ fontSize: 14, color: theme.textMuted, margin: "8px 0 0" }}>Customise the automated emails that chase your quotes. Up to {MAX_STEPS} steps per sequence.</p>
      </div>

      <Card style={{ marginBottom: 20, padding: isMobile ? 16 : 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 10 }}>Available Placeholders</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[{ tag: "{name}", desc: "Customer name" }, { tag: "{job}", desc: "Job title" }, { tag: "{amount}", desc: "Quote amount" }, { tag: "{business_name}", desc: "Your business name" }].map(p => (
            <span key={p.tag} style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 12,
              background: theme.accentSoft, color: theme.accent, fontFamily: "monospace",
            }}>{p.tag} <span style={{ color: theme.textMuted, fontFamily: theme.font }}>= {p.desc}</span></span>
          ))}
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {sequences.map((seq) => {
          const seqSteps = steps[seq.id] || [];
          return (
          <Card key={seq.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", marginBottom: 20, flexDirection: isMobile ? "column" : "row", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: theme.text, margin: 0 }}>{seq.name}</h3>
                <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: seq.is_active ? theme.greenSoft : theme.redSoft, color: seq.is_active ? theme.green : theme.red }}>{seq.is_active ? "ACTIVE" : "PAUSED"}</span>
                <span style={{ fontSize: 12, color: theme.textDim }}>{seqSteps.length}/{MAX_STEPS} steps</span>
              </div>
              <Button size="sm" variant={seq.is_active ? "danger" : "primary"} onClick={() => toggleSequence(seq)}>
                {seq.is_active ? "Pause" : "Activate"}
              </Button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {seqSteps.map((step, i) => (
                <div key={step.id}>
                  {i > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0 6px 13px" }}>
                      <div style={{ width: 2, height: 20, background: theme.border }} />
                      <span style={{ fontSize: 11, color: theme.textDim }}>+{step.delay_days} days</span>
                    </div>
                  )}
                  <div style={{
                    padding: "16px 18px", borderRadius: 10, background: editingStep === step.id ? theme.bg : theme.surfaceLight,
                    border: `1px solid ${editingStep === step.id ? theme.accent + "44" : theme.border}`,
                  }}>
                    {editingStep === step.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "flex", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
                          <div style={{ flex: "0 0 100px" }}><Input label="Delay (days)" value={editForm.delay_days} onChange={v => setEditForm({ ...editForm, delay_days: v })} type="number" /></div>
                          <div style={{ flex: 1 }}><Input label="Subject Line" value={editForm.email_subject} onChange={v => setEditForm({ ...editForm, email_subject: v })} /></div>
                        </div>
                        <Input label="Email Body" value={editForm.email_body} onChange={v => setEditForm({ ...editForm, email_body: v })} textarea />
                        <EmailPreview subject={editForm.email_subject} body={editForm.email_body} />
                        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
                          <Button size="sm" variant="danger" onClick={() => deleteStep(seq.id, step.id)}><XCircle size={14} /> Delete</Button>
                          <div style={{ display: "flex", gap: 8 }}>
                            <Button size="sm" variant="secondary" onClick={() => setEditingStep(null)}>Cancel</Button>
                            <Button size="sm" onClick={() => saveEdit(step.id)} disabled={saving}><Check size={14} /> {saving ? "Saving..." : "Save"}</Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ cursor: "pointer" }} onClick={() => startEdit(step)}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ width: 28, height: 28, borderRadius: 8, background: theme.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: theme.accent }}>{i + 1}</span>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{step.email_subject}</div>
                              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{i === 0 ? `${step.delay_days} days after quote sent` : `${step.delay_days} days after previous`}</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 4 }}>
                            {i > 0 && <button onClick={(e) => { e.stopPropagation(); moveStep(seq.id, i, -1); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: theme.textMuted, fontSize: 16 }}>↑</button>}
                            {i < seqSteps.length - 1 && <button onClick={(e) => { e.stopPropagation(); moveStep(seq.id, i, 1); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: theme.textMuted, fontSize: 16 }}>↓</button>}
                          </div>
                        </div>
                        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 8, lineHeight: 1.5, whiteSpace: "pre-line" }}>{step.email_body}</div>
                        <div style={{ fontSize: 11, color: theme.textDim, marginTop: 8 }}>Click to edit</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {seqSteps.length < MAX_STEPS ? (
              adding === seq.id ? (
                <div style={{ marginTop: 16, padding: 20, borderRadius: 12, background: theme.bg, border: `1px dashed ${theme.accent}44` }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: theme.text, margin: "0 0 14px" }}>Add Follow-Up Step {seqSteps.length + 1}</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
                      <div style={{ flex: "0 0 100px" }}><Input label="Delay (days)" value={newStep.delay} onChange={v => setNewStep({ ...newStep, delay: v })} type="number" placeholder="e.g. 3" /></div>
                      <div style={{ flex: 1 }}><Input label="Subject Line" value={newStep.subject} onChange={v => setNewStep({ ...newStep, subject: v })} placeholder="e.g. Following up on your quote for {job}" /></div>
                    </div>
                    <Input label="Email Body" value={newStep.body} onChange={v => setNewStep({ ...newStep, body: v })} textarea placeholder="e.g. Hi {name}, just checking in on the quote for {job}. Cheers, {business_name}" />
                    <EmailPreview subject={newStep.subject} body={newStep.body} />
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <Button size="sm" variant="secondary" onClick={() => { setAdding(null); setNewStep({ delay: "", subject: "", body: "" }); }}>Cancel</Button>
                      <Button size="sm" onClick={() => addStep(seq.id)} disabled={saving}><Plus size={14} /> {saving ? "Adding..." : "Add Step"}</Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div onClick={() => { setAdding(seq.id); setEditingStep(null); }}
                  style={{ marginTop: 16, padding: "14px 18px", borderRadius: 10, border: `1px dashed ${theme.border}`, textAlign: "center", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = theme.accent; e.currentTarget.style.background = theme.accentSoft; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.textMuted }}><Plus size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />Add Step ({seqSteps.length}/{MAX_STEPS})</span>
                </div>
              )
            ) : (
              <div style={{ marginTop: 16, padding: "12px 18px", borderRadius: 10, background: theme.accentSoft, textAlign: "center" }}>
                <span style={{ fontSize: 13, color: theme.accent, fontWeight: 500 }}>Maximum {MAX_STEPS} steps reached on Starter plan</span>
              </div>
            )}
          </Card>
          );
        })}
      </div>
    </div>
  );
};

// ─── Settings ───
const Settings = ({ business, dispatch }) => {
  const isMobile = useIsMobile();
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
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24 }}>
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

// ─── Onboarding Tutorial ───
const OnboardingTutorial = ({ business, onComplete }) => {
  const [step, setStep] = useState(0);
  const isMobile = useIsMobile();
  const steps = [
    { title: "Welcome to Wynflow!", desc: `Hey ${business?.contact_name || "there"}! Let's get you set up in 30 seconds.`, icon: "👋", content: "Wynflow sends your quotes to customers and automatically follows up if they don't respond. No more lost jobs from forgotten emails." },
    { title: "Step 1: Send a Quote", desc: "Click 'New Quote' to get started", icon: "📤", content: "Enter your customer's details, the job title, and the amount. Upload a quote PDF if you have one — or just send without. Hit send and the customer gets a branded email with your quote." },
    { title: "Step 2: Wynflow Chases", desc: "Automated follow-ups do the hard work", icon: "🤖", content: "If your customer doesn't respond, Wynflow sends follow-up emails automatically — day 2, day 5, day 10. You can customise the timing and wording in the Follow-Ups tab." },
    { title: "Step 3: Book the Job", desc: "They respond, you close it", icon: "✅", content: "Your customer clicks 'Book It In' or 'Decline' right in the email. You get notified instantly. Once accepted, call them to confirm the job and mark it as 'Booked' in your dashboard." },
  ];
  const s = steps[step];
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(4px)" }}>
      <div style={{ width: "100%", maxWidth: 500, background: theme.surface, borderRadius: 20, overflow: "hidden", border: `1px solid ${theme.border}` }}>
        <div style={{ background: `linear-gradient(135deg, ${theme.bg}, ${theme.surfaceLight})`, padding: isMobile ? "32px 24px" : "40px 40px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{s.icon}</div>
          <h2 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: theme.text, margin: "0 0 8px", fontFamily: theme.fontDisplay }}>{s.title}</h2>
          <p style={{ fontSize: 14, color: theme.accent, fontWeight: 500, margin: 0 }}>{s.desc}</p>
        </div>
        <div style={{ padding: isMobile ? "24px 24px 20px" : "32px 40px 24px" }}>
          <p style={{ fontSize: 15, color: theme.textMuted, lineHeight: 1.7, margin: "0 0 28px" }}>{s.content}</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
            {steps.map((_, i) => (<div key={i} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, background: i === step ? theme.accent : theme.border, transition: "all 0.3s" }} />))}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            {step > 0 && <Button variant="secondary" size="sm" onClick={() => setStep(step - 1)}>Back</Button>}
            {step < steps.length - 1 ? <Button size="sm" onClick={() => setStep(step + 1)}>Next →</Button> : <Button onClick={onComplete}>Let's Go! →</Button>}
          </div>
          {step < steps.length - 1 && <div style={{ textAlign: "center", marginTop: 12 }}><span onClick={onComplete} style={{ fontSize: 12, color: theme.textDim, cursor: "pointer" }}>Skip tutorial</span></div>}
        </div>
      </div>
    </div>
  );
};

// ─── Main App ───
// ✅ FIX: useIsMobile() is now called at the TOP of WynflowApp,
//    before any conditional returns, to comply with React's Rules of Hooks.
export default function WynflowApp() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { user, business, screen, quotes, sequences, notification, loading } = state;

  // ✅ ALL hooks must be called before any conditional returns
  const isMobile = useIsMobile();
  useSEO(screen);
  const [showOnboarding, setShowOnboarding] = useState(false);

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

  // Restore session on mount
  useEffect(() => {
    const savedToken = getCookie("wynflow_token");
    const savedUser = getCookie("wynflow_user");
    const savedBusiness = getCookie("wynflow_business");
    if (savedToken && savedUser && savedBusiness) {
      supabase.token = savedToken;
      supabase.user = savedUser;
      dispatch({ type: "SET_USER", payload: savedUser });
      dispatch({ type: "SET_BUSINESS", payload: savedBusiness });
    } else {
      const path = window.location.pathname.replace(/^\//, "").toLowerCase();
      const routes = { "about": "about", "pricing": "pricing", "login": "login", "signup": "signup" };
      if (routes[path]) dispatch({ type: "SET_SCREEN", payload: routes[path] });
    }
  }, []);

  useEffect(() => {
    const publicPages = { home: "/", about: "/about", pricing: "/pricing" };
    if (publicPages[screen] !== undefined && !business) {
      window.history.replaceState(null, "", publicPages[screen]);
    }
  }, [screen, business]);

  useEffect(() => { loadData(); }, [loadData]);

  // Show onboarding for new users
  useEffect(() => {
    if (business && !getCookie("wynflow_onboarded")) {
      setShowOnboarding(true);
    }
  }, [business?.id]);

  useEffect(() => {
    if (business && (screen === "dashboard" || screen === "quotes")) {
      loadData();
    }
  }, [screen]);

  const screenParts = screen.split(":");
  const activeScreen = screenParts[0];
  const detailId = screenParts[1];

  const globalStyles = `${fonts}
    * { margin:0;padding:0;box-sizing:border-box; }
    body { background:${theme.bg}; }
    html { scroll-behavior:smooth; }
    input:focus,textarea:focus { border-color:${theme.accent} !important;box-shadow:0 0 0 2px ${theme.accentGlow}; }
    ::-webkit-scrollbar { width:6px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:${theme.border};border-radius:3px; }
    @keyframes slideIn { from{transform:translateX(100px);opacity:0} to{transform:translateX(0);opacity:1} }
    @keyframes spin { to{transform:rotate(360deg)} }
    @media (max-width: 767px) {
      .mobile-stack { grid-template-columns: 1fr !important; }
      .mobile-hide { display: none !important; }
      .mobile-full { grid-column: 1 / -1 !important; }
    }
  `;

  // Public pages (conditional returns AFTER all hooks)
  if (["home","about","pricing"].includes(screen)) {
    return (
      <>
        <style>{globalStyles}</style>
        {notification && <Toast message={notification.message} type={notification.type} onClose={() => dispatch({ type: "CLEAR_NOTIFY" })} />}
        <div style={{ fontFamily: theme.font, color: theme.text }}>
          <Navbar dispatch={dispatch} transparent={screen === "home"} />
          {screen === "home" && <HomePage dispatch={dispatch} />}
          {screen === "about" && <AboutPage dispatch={dispatch} />}
          {screen === "pricing" && <PricingPage dispatch={dispatch} />}
        </div>
      </>
    );
  }

  if (!business) {
    if (screen === "login" || screen === "signup") {
      return (
        <>
          <style>{globalStyles}</style>
          {notification && <Toast message={notification.message} type={notification.type} onClose={() => dispatch({ type: "CLEAR_NOTIFY" })} />}
          <AuthScreen dispatch={dispatch} isSignup={screen === "signup"} />
        </>
      );
    }
    return (
      <>
        <style>{globalStyles}</style>
        {notification && <Toast message={notification.message} type={notification.type} onClose={() => dispatch({ type: "CLEAR_NOTIFY" })} />}
        <div style={{ fontFamily: theme.font, color: theme.text }}>
          <Navbar dispatch={dispatch} transparent />
          <HomePage dispatch={dispatch} />
        </div>
      </>
    );
  }

  const renderContent = () => {
    if (loading) return <Spinner />;
    switch (activeScreen) {
      case "dashboard": return <Dashboard quotes={quotes} dispatch={dispatch} />;
      case "quotes": return <QuotesList quotes={quotes} dispatch={dispatch} />;
      case "analytics": return <Analytics quotes={quotes} />;
      case "newQuote": return <NewQuoteForm dispatch={dispatch} business={business} sequences={sequences} />;
      case "sequences": return <SequencesManager sequences={sequences} business={business} dispatch={dispatch} />;
      case "quoteDetail": return <QuoteDetail quoteId={detailId} quotes={quotes} sequences={sequences} dispatch={dispatch} business={business} />;
      case "settings": return <Settings business={business} dispatch={dispatch} />;
      default: return <Dashboard quotes={quotes} dispatch={dispatch} />;
    }
  };

  return (
    <>
      <style>{globalStyles}</style>
      {notification && <Toast message={notification.message} type={notification.type} onClose={() => dispatch({ type: "CLEAR_NOTIFY" })} />}
      {showOnboarding && <OnboardingTutorial business={business} onComplete={() => { setShowOnboarding(false); setCookie("wynflow_onboarded", "true", 365); }} />}
      <div style={{ display: "flex", height: "100vh", fontFamily: theme.font, color: theme.text, overflow: "hidden", flexDirection: isMobile ? "column" : "row" }}>
        <Sidebar screen={activeScreen} dispatch={dispatch} business={business} />
        <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "20px 16px 80px" : "32px 40px" }}>
          {renderContent()}
        </div>
      </div>
    </>
  );
}
