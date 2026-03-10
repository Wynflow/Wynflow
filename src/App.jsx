import { useState, useEffect, useReducer, useCallback } from "react";
import { LayoutDashboard, FileText, RefreshCw, Settings as SettingsIcon, Upload, Send, Bot, ClipboardList, Paperclip, CheckCircle2, BarChart3, Lock, Clock, DollarSign, ChevronLeft, ChevronRight, Menu, X, ArrowRight, Star, Mail, Plus, Search, Check, XCircle, MessageSquare, Globe, Cpu, Wrench, HelpCircle, Camera, UserCheck } from "lucide-react";

// ─── SEO Helper ───
const SEO_CONFIG = {
  home: { title: "Wynflow — AI Quote Generator & Automated Follow-Ups for NZ Tradies", description: "Generate quotes from photos with AI, send them in seconds, and let automated follow-ups chase your customers for you. The #1 quoting tool built for New Zealand tradies.", canonical: "https://www.wynflow.co.nz" },
  about: { title: "About Wynflow — AI-Powered Quoting Built by a Kiwi, for Kiwi Tradies", description: "Born from watching a Napier carpet layer lose jobs to forgotten follow-ups. Wynflow combines AI photo quoting with automated follow-ups so NZ tradies never lose a job to silence again.", canonical: "https://www.wynflow.co.nz/about" },
  pricing: { title: "Wynflow Pricing — AI Quoting from $29/mo | Free 14-Day Trial", description: "AI-powered quote generation, automated follow-ups, and a full quote dashboard from $29/mo. No credit card required. Built for NZ tradies.", canonical: "https://www.wynflow.co.nz/pricing" },
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
    else h["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;
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
  requested: { label: "Requested", color: "#14B8A6", bg: "rgba(20,184,166,0.12)" },
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
    secondary: { background: "rgba(255,255,255,0.06)", color: "#F1F3F7", border: "1px solid rgba(255,255,255,0.08)" },
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
    {label && <label style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.4)", letterSpacing: 0.3 }}>{label}</label>}
    {textarea ? (
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{
          fontFamily: theme.font, fontSize: 14, padding: "12px 16px", borderRadius: 10,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#F1F3F7",
          outline: "none", resize: "vertical", minHeight: 100, transition: "border-color 0.2s ease",
        }} />
    ) : type === "file" ? (
      <input type="file" accept={accept} onChange={onFileChange}
        style={{
          fontFamily: theme.font, fontSize: 14, padding: "12px 16px", borderRadius: 10,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#F1F3F7", outline: "none",
        }} />
    ) : (
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{
          fontFamily: theme.font, fontSize: 14, padding: "12px 16px", borderRadius: 10,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#F1F3F7", outline: "none",
        }} />
    )}
  </div>
);

const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16,
    padding: 24, transition: "all 0.25s ease", cursor: onClick ? "pointer" : "default", ...style,
  }}
  onMouseEnter={onClick ? (e) => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.2)"; } : undefined}
  onMouseLeave={onClick ? (e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; } : undefined}>
    {children}
  </div>
);

const Stat = ({ label, value, accent, icon: Icon }) => (
  <Card style={{ flex: 1, minWidth: 0, padding: typeof window !== "undefined" && window.innerWidth < 768 ? 14 : 24 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        <div style={{ fontSize: typeof window !== "undefined" && window.innerWidth < 768 ? 20 : 28, fontWeight: 700, color: accent || theme.text, fontFamily: theme.fontDisplay }}>{value}</div>
      </div>
      {Icon && <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={16} color={theme.textMuted} /></div>}
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
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: theme.green, error: theme.red, info: theme.blue };
  const isMobileToast = typeof window !== "undefined" && window.innerWidth < 768;
  return (
    <div style={{
      position: "fixed", top: isMobileToast ? 12 : 24, zIndex: 9999, padding: isMobileToast ? "12px 16px" : "14px 24px",
      borderRadius: 12, background: theme.surface, border: `1px solid ${colors[type] || theme.border}`,
      color: theme.text, fontSize: isMobileToast ? 13 : 14, fontFamily: theme.font, fontWeight: 500,
      boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${colors[type]}22`,
      animation: "slideIn 0.3s ease",
      ...(isMobileToast ? { left: 12, right: 12 } : { right: 24 }),
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
  const [scrolled, setScrolled] = useState(false);
  const isMobile = useIsMobile();
  useEffect(() => {
    if (!transparent) return;
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [transparent]);
  const navBg = transparent ? (scrolled ? "rgba(10,14,23,0.85)" : "transparent") : theme.surface;
  const navBorder = transparent ? (scrolled ? `1px solid ${theme.border}` : "none") : `1px solid ${theme.border}`;
  return (
    <nav style={{ position:transparent?"fixed":"relative",top:0,left:0,right:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"space-between",padding:isMobile?"14px 20px":"16px 48px",background:navBg,borderBottom:navBorder,fontFamily:theme.font,backdropFilter:transparent&&scrolled?"blur(16px) saturate(180%)":"none",WebkitBackdropFilter:transparent&&scrolled?"blur(16px) saturate(180%)":"none",transition:"all 0.3s ease" }}>
      <div style={{ display:"flex",alignItems:"center",gap:10,cursor:"pointer" }} onClick={() => dispatch({ type:"SET_SCREEN",payload:"home" })}>
        <div style={{ width:32,height:32,borderRadius:8,overflow:"hidden" }}><WynflowLogo size={32} /></div>
        <span style={{ fontSize:20,fontWeight:700,color:theme.text,fontFamily:theme.font,letterSpacing:"-0.02em" }}>Wynflow</span>
      </div>
      {isMobile ? (
        <>
          <div onClick={() => setMenuOpen(!menuOpen)} style={{ color:theme.text,cursor:"pointer",padding:8 }}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</div>
          {menuOpen && (
            <div style={{ position:"absolute",top:"100%",left:0,right:0,background:"rgba(10,14,23,0.98)",borderBottom:`1px solid ${theme.border}`,padding:"20px 20px",display:"flex",flexDirection:"column",gap:16,zIndex:200,backdropFilter:"blur(16px)" }}>
              {[["home","Home"],["about","About"],["pricing","Pricing"]].map(([id,label]) => (
                <span key={id} onClick={() => { dispatch({ type:"SET_SCREEN",payload:id }); setMenuOpen(false); }} style={{ fontSize:15,fontWeight:500,color:theme.textMuted,cursor:"pointer" }}>{label}</span>
              ))}
              <Button size="sm" variant="secondary" onClick={() => { dispatch({ type:"SET_SCREEN",payload:"login" }); setMenuOpen(false); }}>Log In</Button>
              <Button size="sm" onClick={() => { dispatch({ type:"SET_SCREEN",payload:"signup" }); setMenuOpen(false); }}>Get Started Free</Button>
            </div>
          )}
        </>
      ) : (
        <div style={{ display:"flex",alignItems:"center",gap:28 }}>
          {[["home","Home"],["about","About"],["pricing","Pricing"]].map(([id,label]) => (
            <span key={id} onClick={() => dispatch({ type:"SET_SCREEN",payload:id })} style={{ fontSize:13,fontWeight:500,color:theme.textMuted,cursor:"pointer",transition:"color 0.2s",letterSpacing:"0.01em" }} onMouseEnter={e=>e.target.style.color=theme.text} onMouseLeave={e=>e.target.style.color=theme.textMuted}>{label}</span>
          ))}
          <span onClick={() => dispatch({ type:"SET_SCREEN",payload:"login" })} style={{ fontSize:13,fontWeight:500,color:theme.textMuted,cursor:"pointer",transition:"color 0.2s" }} onMouseEnter={e=>e.target.style.color=theme.text} onMouseLeave={e=>e.target.style.color=theme.textMuted}>Log In</span>
          <button onClick={() => dispatch({ type:"SET_SCREEN",payload:"signup" })} style={{ fontFamily:theme.font,fontSize:13,fontWeight:600,padding:"8px 20px",borderRadius:8,background:theme.accent,color:"#000",border:"none",cursor:"pointer",transition:"all 0.2s",letterSpacing:"0.01em" }}
            onMouseEnter={e=>{e.currentTarget.style.background=theme.accentHover;e.currentTarget.style.transform="translateY(-1px)";}}
            onMouseLeave={e=>{e.currentTarget.style.background=theme.accent;e.currentTarget.style.transform="translateY(0)";}}>
            Get Started Free
          </button>
        </div>
      )}
    </nav>
  );
};

const Footer = ({ dispatch }) => {
  const isMobile = useIsMobile();
  return (
  <footer style={{ padding:isMobile?"40px 20px 24px":"64px 48px 32px",background:theme.bg,borderTop:`1px solid rgba(255,255,255,0.06)`,fontFamily:theme.font }}>
    <div style={{ display:"flex",justifyContent:"space-between",maxWidth:1100,margin:"0 auto",flexWrap:"wrap",gap:isMobile?32:48,flexDirection:isMobile?"column":"row" }}>
      <div style={{ maxWidth:300 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:16 }}>
          <div style={{ width:28,height:28,borderRadius:7,overflow:"hidden" }}><WynflowLogo size={28} /></div>
          <span style={{ fontSize:17,fontWeight:700,color:theme.text,fontFamily:theme.font,letterSpacing:"-0.02em" }}>Wynflow</span>
        </div>
        <p style={{ fontSize:13,color:"rgba(255,255,255,0.4)",lineHeight:1.7 }}>AI-powered quoting and automated follow-ups for NZ tradies. Send quotes, chase customers, win more jobs — on autopilot.</p>
      </div>
      <div>
        <h4 style={{ fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.3)",marginBottom:16,textTransform:"uppercase",letterSpacing:"0.1em" }}>Product</h4>
        {["home","pricing","about"].map(p => <div key={p} onClick={() => dispatch({ type:"SET_SCREEN",payload:p })} style={{ fontSize:14,color:"rgba(255,255,255,0.5)",cursor:"pointer",marginBottom:10,textTransform:"capitalize",transition:"color 0.2s" }} onMouseEnter={e=>e.target.style.color="#fff"} onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.5)"}>{p}</div>)}
      </div>
      <div>
        <h4 style={{ fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.3)",marginBottom:16,textTransform:"uppercase",letterSpacing:"0.1em" }}>Company</h4>
        <div style={{ fontSize:14,color:"rgba(255,255,255,0.5)",marginBottom:10 }}>Auckland, New Zealand</div>
        <div style={{ fontSize:14,color:theme.accent,transition:"opacity 0.2s",cursor:"pointer" }} onMouseEnter={e=>e.target.style.opacity="0.8"} onMouseLeave={e=>e.target.style.opacity="1"}>jesse@wynflow.co.nz</div>
      </div>
    </div>
    <div style={{ maxWidth:1100,margin:"48px auto 0",paddingTop:24,borderTop:"1px solid rgba(255,255,255,0.06)",textAlign:"center",fontSize:12,color:"rgba(255,255,255,0.25)",letterSpacing:"0.02em" }}>2026 Wynflow. All rights reserved.</div>
  </footer>
  );
};

const EmailPreviewModal = ({ onClose }) => {
  const isMobile = useIsMobile();
  return (
    <div onClick={onClose} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
        <div style={{ background: "#ffffff", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ background: "#ffffff", padding: "28px 32px", textAlign: "center", borderBottom: "3px solid #14B8A6" }}>
            <img src="https://www.wynflow.co.nz/logo.png" alt="Wynflow" style={{ width: 44, height: "auto", marginBottom: 10 }} />
            <h1 style={{ color: "#0A0E17", margin: 0, fontSize: 22, fontWeight: 700 }}>Quote from Smith's Plumbing</h1>
          </div>
          <div style={{ padding: 32 }}>
            <p style={{ fontSize: 16, color: "#374151", margin: "0 0 8px" }}>Hi Sarah,</p>
            <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.6, margin: "0 0 24px" }}>Please find attached our quote for <strong>Bathroom Renovation</strong>.</p>
            <div style={{ background: "#f9fafb", borderRadius: 10, padding: 20, margin: "0 0 24px" }}>
              <table style={{ width: "100%" }}><tbody>
                <tr><td style={{ color: "#6b7280", fontSize: 14, padding: "4px 0" }}>Job:</td><td style={{ color: "#111827", fontSize: 14, fontWeight: 600, textAlign: "right" }}>Bathroom Renovation</td></tr>
                <tr><td style={{ color: "#6b7280", fontSize: 14, padding: "4px 0" }}>Amount:</td><td style={{ color: "#14B8A6", fontSize: 20, fontWeight: 700, textAlign: "right" }}>$4,500</td></tr>
                <tr><td style={{ color: "#6b7280", fontSize: 14, padding: "4px 0" }}>Quote #:</td><td style={{ color: "#111827", fontSize: 14, textAlign: "right" }}>WF-0042</td></tr>
              </tbody></table>
            </div>
            <div style={{ textAlign: "center", margin: "0 0 16px" }}>
              <span style={{ display: "inline-block", background: "#22C55E", color: "#fff", padding: "16px 48px", borderRadius: 8, fontWeight: 700, fontSize: 16 }}>Accept Quote</span>
            </div>
            <div style={{ textAlign: "center", margin: "0 0 24px" }}>
              <span style={{ color: "#9ca3af", fontSize: 13, textDecoration: "underline" }}>No thanks</span>
            </div>
            <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "24px 0" }} />
            <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" }}>Sent via <span style={{ color: "#14B8A6" }}>Wynflow</span> on behalf of Smith's Plumbing</p>
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <span onClick={onClose} style={{ fontSize: 14, color: "#fff", cursor: "pointer", fontWeight: 500 }}>Close preview ×</span>
        </div>
      </div>
    </div>
  );
};

const useInView = (threshold = 0.15) => {
  const [ref, setRef] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    if (!ref) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } }, { threshold });
    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref, threshold]);
  return [setRef, isVisible];
};

const FadeIn = ({ children, delay = 0, style = {} }) => {
  const [ref, isVisible] = useInView(0.08);
  return (
    <div ref={ref} style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? "translateY(0)" : "translateY(20px)", transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s`, ...style }}>
      {children}
    </div>
  );
};

const HomePage = ({ dispatch }) => {
  const isMobile = useIsMobile();

  const features = [
    { Icon: Globe, title: "Live Quote Request Link", desc: "Share your personal link on social media, Google Business, or your website — customers request quotes directly." },
    { Icon: Cpu, title: "AI Quote Generation", desc: "Generate a professional quote in seconds using AI, right from your dashboard." },
    { Icon: RefreshCw, title: "Automated Follow-ups", desc: "Automatically follow up with customers who haven't responded." },
    { Icon: BarChart3, title: "Analytics Dashboard", desc: "Track your quotes, conversion rates, and revenue in one place." },
    { Icon: Mail, title: "Professional Emails", desc: "Customers receive branded emails with one-click Accept or Decline buttons built in." },
    { Icon: MessageSquare, title: "Feedback Capture", desc: "When customers decline, they tell you why — so you can adjust your pricing and win more next time." },
  ];

  const steps = [
    { num: "01", Icon: Cpu, title: "Snap Photos, Add Notes, Get a Quote", desc: "Take photos on site and add your notes — access issues, customer preferences, anything relevant. Wynflow's AI analyses your photos, notes, rates, and trade to generate an accurate, itemised quote with materials, labour, and pricing." },
    { num: "02", Icon: Send, title: "Review & Send", desc: "Check the AI-generated quote, tweak anything you want, and hit send. Your customer gets a professional email with one-click Accept or Decline buttons." },
    { num: "03", Icon: Bot, title: "Automated Follow-Ups", desc: "If they don't respond, Wynflow chases automatically — day 2, day 5, day 10. Personalised emails that sound like you, not a robot. You're on the tools, not on your phone." },
  ];

  return (
  <div style={{ background: theme.bg, overflowX: "hidden" }}>

    {/* ── Hero ── */}
    <div style={{ position: "relative", minHeight: isMobile ? "auto" : "100vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: isMobile ? "120px 20px 80px" : "160px 48px 120px" }}>
      {/* Gradient orbs */}
      <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "60%", height: "60%", background: "radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "50%", height: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />
      {/* Grid pattern overlay */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)", backgroundSize: "64px 64px", pointerEvents: "none", maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)", WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)" }} />

      <div style={{ maxWidth: 720, position: "relative", zIndex: 1 }}>
        <FadeIn>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 100, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)", marginBottom: isMobile ? 24 : 32 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: theme.accent, boxShadow: `0 0 8px ${theme.accent}` }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: theme.accent, letterSpacing: "0.02em" }}>AI-Powered Quoting for NZ Tradies</span>
          </div>
        </FadeIn>
        <FadeIn delay={0.08}>
          <h1 style={{ fontSize: isMobile ? 40 : 72, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.05, marginBottom: isMobile ? 20 : 28, fontFamily: theme.font, letterSpacing: "-0.03em" }}>
            Quote Faster. Chase Smarter.<br /><span style={{ background: `linear-gradient(135deg, ${theme.accent}, #5EEAD4)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Win More Jobs.</span>
          </h1>
        </FadeIn>
        <FadeIn delay={0.16}>
          <p style={{ fontSize: isMobile ? 16 : 19, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: 560, margin: "0 auto 44px", fontWeight: 400, letterSpacing: "0.01em" }}>Wynflow's AI generates accurate quotes from your job site photos and notes — scope, materials, labour, the lot. Then automated follow-ups chase your customers until they say yes. You stay on the tools, we handle the paperwork.</p>
        </FadeIn>
        <FadeIn delay={0.24}>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexDirection: isMobile ? "column" : "row", alignItems: "center" }}>
            <button onClick={() => dispatch({ type: "SET_SCREEN", payload: "signup" })} style={{ fontFamily: theme.font, fontSize: 15, fontWeight: 600, padding: isMobile ? "14px 32px" : "14px 36px", borderRadius: 10, background: theme.accent, color: "#000", border: "none", cursor: "pointer", transition: "all 0.2s", boxShadow: `0 0 24px rgba(20,184,166,0.3), 0 0 60px rgba(20,184,166,0.1)`, letterSpacing: "0.01em", width: isMobile ? "100%" : "auto" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#5EEAD4"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 32px rgba(20,184,166,0.4), 0 0 80px rgba(20,184,166,0.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = theme.accent; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 0 24px rgba(20,184,166,0.3), 0 0 60px rgba(20,184,166,0.1)"; }}>
              Start Free Trial
              <ArrowRight size={16} style={{ display: "inline", verticalAlign: "middle", marginLeft: 8 }} />
            </button>
            <button onClick={() => dispatch({ type: "SET_SCREEN", payload: "pricing" })} style={{ fontFamily: theme.font, fontSize: 15, fontWeight: 500, padding: isMobile ? "14px 32px" : "14px 36px", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", transition: "all 0.2s", letterSpacing: "0.01em", width: isMobile ? "100%" : "auto" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}>
              View Pricing
            </button>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 20, letterSpacing: "0.04em" }}>No credit card required  ·  14-day free trial  ·  Cancel anytime</p>
        </FadeIn>
      </div>

      {/* Bottom gradient fade to features */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 120, background: "linear-gradient(to bottom, transparent, #0A0E17)", pointerEvents: "none" }} />
    </div>

    {/* ── Divider line ── */}
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 48px" }}>
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(20,184,166,0.3), transparent)" }} />
    </div>

    {/* ── Features Grid ── */}
    <div style={{ padding: isMobile ? "80px 20px" : "120px 48px", position: "relative" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: isMobile ? 48 : 72 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 16 }}>Features</p>
            <h2 style={{ fontSize: isMobile ? 30 : 44, fontWeight: 700, color: "#FFFFFF", marginBottom: 16, fontFamily: theme.font, letterSpacing: "-0.03em", lineHeight: 1.15 }}>Everything you need to<br />win more jobs</h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "rgba(255,255,255,0.45)", maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>AI smarts meets tradie simplicity. No complicated setup, no fluff.</p>
          </div>
        </FadeIn>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: isMobile ? 12 : 16 }}>
          {features.map((f, i) => {
            const FIcon = f.Icon;
            return (
              <FadeIn key={i} delay={0.06 * i}>
                <div style={{ padding: isMobile ? 24 : 28, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", transition: "all 0.35s cubic-bezier(0.16,1,0.3,1)", height: "100%", cursor: "default" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(20,184,166,0.25)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                    <FIcon size={20} color={theme.accent} strokeWidth={1.5} />
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: "#FFFFFF", marginBottom: 6, fontFamily: theme.font, letterSpacing: "-0.01em" }}>{f.title}</h3>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </div>

    {/* ── Divider ── */}
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 48px" }}>
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
    </div>

    {/* ── How It Works ── */}
    <div style={{ padding: isMobile ? "80px 20px" : "120px 48px", position: "relative" }}>
      {/* Subtle gradient orb */}
      <div style={{ position: "absolute", top: "20%", right: "-5%", width: "40%", height: "60%", background: "radial-gradient(circle, rgba(20,184,166,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: isMobile ? 48 : 72 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 16 }}>How it works</p>
            <h2 style={{ fontSize: isMobile ? 30 : 44, fontWeight: 700, color: "#FFFFFF", marginBottom: 16, fontFamily: theme.font, letterSpacing: "-0.03em", lineHeight: 1.15 }}>From site visit to signed quote<br />in minutes — not hours</h2>
          </div>
        </FadeIn>

        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 0 }}>
          {steps.map((step, i) => {
            const StepIcon = step.Icon;
            return (
              <FadeIn key={i} delay={0.1 * i}>
                <div style={{ display: isMobile ? "block" : "flex", alignItems: "flex-start", gap: 40, padding: isMobile ? 24 : "48px 0", borderBottom: i < steps.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none", ...(isMobile ? { borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" } : {}) }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: isMobile ? 16 : 0, minWidth: isMobile ? "auto" : 80 }}>
                    <span style={{ fontSize: isMobile ? 36 : 56, fontWeight: 700, color: "rgba(20,184,166,0.15)", fontFamily: theme.font, letterSpacing: "-0.04em", lineHeight: 1 }}>{step.num}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flex: 1 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                      <StepIcon size={20} color={theme.accent} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 600, color: "#FFFFFF", marginBottom: 8, fontFamily: theme.font, letterSpacing: "-0.01em" }}>{step.title}</h3>
                      <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, margin: 0, maxWidth: 600 }}>{step.desc}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </div>

    {/* ── CTA ── */}
    <div style={{ padding: isMobile ? "80px 20px" : "120px 48px", textAlign: "center", position: "relative" }}>
      {/* Glow behind CTA */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "80%", height: "80%", background: "radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 60%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto" }}>
        <FadeIn>
          <div style={{ padding: isMobile ? "48px 24px" : "72px 64px", borderRadius: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <h2 style={{ fontSize: isMobile ? 28 : 40, fontWeight: 700, color: "#FFFFFF", marginBottom: 16, fontFamily: theme.font, letterSpacing: "-0.03em", lineHeight: 1.15 }}>Snap a Photo. Get a Quote.<br />Win the Job.</h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "rgba(255,255,255,0.45)", marginBottom: 36, lineHeight: 1.6 }}>Join NZ tradies using AI to turn job site photos and notes into accurate quotes in minutes — then close more jobs on autopilot.</p>
            <button onClick={() => dispatch({ type: "SET_SCREEN", payload: "signup" })} style={{ fontFamily: theme.font, fontSize: 15, fontWeight: 600, padding: "14px 40px", borderRadius: 10, background: theme.accent, color: "#000", border: "none", cursor: "pointer", transition: "all 0.2s", boxShadow: `0 0 24px rgba(20,184,166,0.3), 0 0 60px rgba(20,184,166,0.1)`, letterSpacing: "0.01em" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#5EEAD4"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 32px rgba(20,184,166,0.4), 0 0 80px rgba(20,184,166,0.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = theme.accent; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 0 24px rgba(20,184,166,0.3), 0 0 60px rgba(20,184,166,0.1)"; }}>
              Start Your Free Trial
              <ArrowRight size={16} style={{ display: "inline", verticalAlign: "middle", marginLeft: 8 }} />
            </button>
          </div>
        </FadeIn>
      </div>
    </div>

    <Footer dispatch={dispatch} />
  </div>
  );
};

// ─── Request Quote Page (Public) ───
const RequestQuotePage = ({ businessId }) => {
  const isMobile = useIsMobile();
  const [form, setForm] = useState({ name: "", email: "", phone: "", jobTitle: "", description: "" });
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState(null);


  useEffect(() => {
    if (businessId) {
      fetch(`https://wynfallautomation.app.n8n.cloud/webhook/get-business-name?id=${businessId}`)
        .then(r => r.json())
        .then(data => {
          if (data.business_name) setBusinessName(data.business_name);
          else setError("Business not found");
        })
        .catch(() => setError("Business not found"));
    }
  }, [businessId]);

  const handlePhotoAdd = (e) => {
    const files = Array.from(e.target.files).slice(0, 5 - photos.length);
    setPhotos(prev => [...prev, ...files]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreviews(prev => [...prev, ev.target.result]);
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const compressImage = (file, maxSize = 1200) => new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.phone || !form.jobTitle || !form.description) {
      setError("Please fill in all required fields");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const photoData = [];
      for (const photo of photos) {
        const compressed = await compressImage(photo);
        photoData.push({ name: photo.name, type: "image/jpeg", data: compressed });
      }
      const res = await fetch("https://wynfallautomation.app.n8n.cloud/webhook/quote-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          customer_name: form.name,
          customer_email: form.email,
          customer_phone: form.phone,
          job_title: form.jobTitle,
          description: form.description || null,
          photos: photoData,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      setError("Something went wrong — please try again or contact the business directly.");
    } finally {
      setLoading(false);
    }
  };

  if (error === "Business not found") {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ textAlign: "center", color: theme.textMuted }}>
          <h1 style={{ fontSize: 24, color: theme.text, fontFamily: theme.fontDisplay }}>Page not found</h1>
          <p style={{ marginTop: 8 }}>This quote request link is invalid.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 480, background: theme.surface, borderRadius: 20, overflow: "hidden", border: `1px solid ${theme.border}`, textAlign: "center" }}>
          <div style={{ padding: "40px 32px", background: `linear-gradient(135deg, ${theme.bg}, ${theme.surfaceLight})` }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.text, margin: "0 0 12px", fontFamily: theme.fontDisplay }}>Request Sent!</h1>
            <p style={{ fontSize: 15, color: theme.textMuted, lineHeight: 1.6 }}>
              Thanks {form.name.split(" ")[0]}! <strong style={{ color: theme.text }}>{businessName}</strong> has received your request and will be in touch soon.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 500, background: theme.surface, borderRadius: 20, overflow: "hidden", border: `1px solid ${theme.border}` }}>
        <div style={{ padding: "28px 32px", textAlign: "center", borderBottom: `3px solid ${theme.accent}` }}>
          <WynflowLogo size={36} />
          {businessName && <h1 style={{ fontSize: 20, fontWeight: 700, color: theme.text, margin: "12px 0 0", fontFamily: theme.fontDisplay }}>Request a Quote from {businessName}</h1>}
          <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 8 }}>Fill in your details, add photos if you can, and we'll get back to you</p>
        </div>
        <div style={{ padding: isMobile ? 24 : 32 }}>
          {error && error !== "Business not found" && <div style={{ padding: "10px 14px", borderRadius: 8, background: theme.redSoft, color: theme.red, fontSize: 13, marginBottom: 16 }}>{error}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label="Your Name *" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Kim Smith" />
            <Input label="Email *" value={form.email} onChange={v => setForm({ ...form, email: v })} type="email" placeholder="e.g. kim@email.com" />
            <Input label="Phone *" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="e.g. 021 123 4567" />
            <Input label="What do you need done? *" value={form.jobTitle} onChange={v => setForm({ ...form, jobTitle: v })} placeholder="e.g. Bathroom renovation, fix leaking tap, etc." />
            <Input label="Extra details *" value={form.description} onChange={v => setForm({ ...form, description: v })} textarea placeholder="e.g. Size of area, urgency, specific requirements..." />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: theme.textMuted, marginBottom: 8 }}>Photos (optional, up to 5)</div>
              <p style={{ fontSize: 12, color: theme.textDim, margin: "0 0 10px" }}>Photos help us scope the job and get you a more accurate quote faster</p>
              {photoPreviews.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: photoPreviews.length === 1 ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  {photoPreviews.map((src, i) => (
                    <div key={i} style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: `1px solid ${theme.border}`, aspectRatio: "4/3" }}>
                      <img src={src} alt={`Photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length < 5 && (
                <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "16px 20px", borderRadius: 12, border: `2px dashed ${theme.border}`, cursor: "pointer", color: theme.textMuted, fontSize: 14, transition: "border-color 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = theme.accent}
                  onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}>
                  <Upload size={18} /> {photos.length > 0 ? "Add More Photos" : "Add Photos"}
                  <input type="file" accept="image/*" multiple onChange={handlePhotoAdd} style={{ display: "none" }} />
                </label>
              )}
            </div>
            <Button onClick={handleSubmit} disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "14px 24px", marginTop: 4 }}>
              {loading ? "Submitting & analysing..." : "Request Quote →"}
            </Button>
          </div>
          <p style={{ fontSize: 11, color: theme.textDim, textAlign: "center", marginTop: 16 }}>
            Powered by <a href="https://www.wynflow.co.nz" style={{ color: theme.accent }} target="_blank" rel="noopener">Wynflow</a>
          </p>
        </div>
      </div>
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
  <div style={{ background: theme.bg }}>
    <div style={{ padding:isMobile?"120px 20px 80px":"160px 48px 100px",textAlign:"center",position:"relative" }}>
      <div style={{ position:"absolute",top:"-20%",left:"-10%",width:"50%",height:"60%",background:"radial-gradient(circle, rgba(20,184,166,0.06) 0%, transparent 70%)",pointerEvents:"none" }} />
      <FadeIn>
        <p style={{ fontSize:13,fontWeight:600,color:theme.accent,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:16 }}>Our Story</p>
        <h1 style={{ fontSize:isMobile?36:56,fontWeight:700,color:"#FFFFFF",marginBottom:20,fontFamily:theme.font,letterSpacing:"-0.03em" }}>The Story Behind Wynflow</h1>
        <p style={{ fontSize:isMobile?16:18,color:"rgba(255,255,255,0.45)",maxWidth:560,margin:"0 auto",lineHeight:1.7 }}>Built from a real problem, by someone who watched it happen every day.</p>
      </FadeIn>
    </div>
    <div style={{ maxWidth:1100,margin:"0 auto",padding:"0 48px" }}><div style={{ height:1,background:"linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} /></div>
    <div style={{ padding:isMobile?"60px 20px":"100px 48px" }}>
      <div style={{ maxWidth:720,margin:"0 auto" }}>
        <FadeIn>
          <div style={{ padding:isMobile?24:48,borderRadius:16,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",marginBottom:isMobile?32:64 }}>
            <div style={{ width:48,height:48,borderRadius:12,overflow:"hidden",marginBottom:24 }}><WynflowLogo size={48} /></div>
            <h2 style={{ fontSize:isMobile?22:28,fontWeight:700,color:"#FFFFFF",marginBottom:20,fontFamily:theme.font,letterSpacing:"-0.02em",lineHeight:1.3 }}>It started with my dad's carpet shop.</h2>
            <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
              <p style={{ fontSize:15,color:"rgba(255,255,255,0.45)",lineHeight:1.8,margin:0 }}>My dad ran a flooring business in Napier for years. Great at his trade, terrible at admin. I'd watch him spend his evenings at the kitchen table — measuring jobs, working out pricing, sending off quotes.</p>
              <p style={{ fontSize:15,color:"rgba(255,255,255,0.45)",lineHeight:1.8,margin:0 }}>Then nothing. If the customer didn't respond straight away, the quote would just sit there. He'd get busy with the next job, the next measure, the next customer. By the time he thought about following up, he either couldn't find the quote or the customer had already gone with someone else.</p>
              <p style={{ fontSize:15,color:"rgba(255,255,255,0.45)",lineHeight:1.8,margin:0 }}>One Christmas he told me: <span style={{ color:"#FFFFFF",fontWeight:500 }}>"If you want to get me something, get me a robot that does my quoting."</span> He was joking — but it stuck with me.</p>
              <p style={{ fontSize:15,color:"rgba(255,255,255,0.45)",lineHeight:1.8,margin:0 }}>I started digging into it and realised it wasn't just him. Across every trade, every industry, the data tells the same story: businesses don't lose work because they're too expensive. They lose it because they're too slow to follow up.</p>
              <p style={{ fontSize:15,color:"rgba(255,255,255,0.45)",lineHeight:1.8,margin:0 }}>That's where Wynflow came from — a system that sends your quotes, chases your customers automatically, and lets you track every single one from sent to booked.</p>
            </div>
          </div>
        </FadeIn>
        <FadeIn>
          <div style={{ textAlign:"center",marginBottom:isMobile?32:48 }}>
            <p style={{ fontSize:13,fontWeight:600,color:theme.accent,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:16 }}>The Data</p>
            <h2 style={{ fontSize:isMobile?24:36,fontWeight:700,color:"#FFFFFF",marginBottom:12,fontFamily:theme.font,letterSpacing:"-0.02em" }}>The Data Doesn't Lie</h2>
            <p style={{ fontSize:15,color:"rgba(255,255,255,0.4)",maxWidth:500,margin:"0 auto",lineHeight:1.6 }}>The research is clear: following up is the single biggest thing you can do to win more work.</p>
          </div>
        </FadeIn>
        <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:isMobile?12:16,marginBottom:isMobile?32:64 }}>
          {stats.map((s,i) => (
            <FadeIn key={i} delay={0.06*i}>
              <div style={{ padding:isMobile?16:24,borderRadius:14,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",textAlign:"center",height:"100%" }}>
                <div style={{ fontSize:isMobile?28:40,fontWeight:700,color:s.color,fontFamily:theme.font,letterSpacing:"-0.03em",marginBottom:8 }}>{s.value}</div>
                <div style={{ fontSize:12,color:"rgba(255,255,255,0.4)",lineHeight:1.5 }}>{s.label}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </div>
    <div style={{ maxWidth:1100,margin:"0 auto",padding:"0 48px" }}><div style={{ height:1,background:"linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} /></div>
    <div style={{ padding:isMobile?"60px 20px":"100px 48px" }}>
      <div style={{ maxWidth:720,margin:"0 auto" }}>
        <FadeIn>
          <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:isMobile?24:48,alignItems:"start",marginBottom:isMobile?40:64 }}>
            <div>
              <div style={{ width:40,height:40,borderRadius:10,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.15)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16 }}><XCircle size={20} color={theme.red} strokeWidth={1.5} /></div>
              <h3 style={{ fontSize:isMobile?20:24,fontWeight:700,color:"#FFFFFF",marginBottom:12,fontFamily:theme.font,letterSpacing:"-0.02em" }}>The Problem</h3>
              <p style={{ fontSize:15,color:"rgba(255,255,255,0.4)",lineHeight:1.8 }}>Service businesses spend hours scoping jobs and writing quotes — only to let them die in someone's inbox. Research shows that 92% of people stop following up after just four attempts, even though most deals need five or more touchpoints. The first person to follow up wins the job 35-50% of the time.</p>
            </div>
            <div>
              <div style={{ width:40,height:40,borderRadius:10,background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.15)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16 }}><CheckCircle2 size={20} color={theme.green} strokeWidth={1.5} /></div>
              <h3 style={{ fontSize:isMobile?20:24,fontWeight:700,color:"#FFFFFF",marginBottom:12,fontFamily:theme.font,letterSpacing:"-0.02em" }}>The Solution</h3>
              <p style={{ fontSize:15,color:"rgba(255,255,255,0.4)",lineHeight:1.8 }}>Wynflow uses AI to generate quotes from job site photos — scope, materials, labour, all calculated from your rates and your trade. Then our automated system follows up at exactly the right intervals — professional, consistent, and hands-free. You get notified the moment a customer responds. No more lost jobs from slow quoting or forgotten follow-ups.</p>
            </div>
          </div>
        </FadeIn>
        <FadeIn>
          <div style={{ padding:isMobile?32:56,borderRadius:16,background:"rgba(20,184,166,0.04)",border:"1px solid rgba(20,184,166,0.12)",textAlign:"center",marginBottom:isMobile?40:64 }}>
            <div style={{ fontSize:isMobile?56:80,fontWeight:700,background:`linear-gradient(135deg, ${theme.accent}, #5EEAD4)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",fontFamily:theme.font,letterSpacing:"-0.04em",lineHeight:1 }}>70%</div>
            <p style={{ fontSize:isMobile?15:17,color:"rgba(255,255,255,0.4)",marginTop:16,maxWidth:500,margin:"16px auto 0",lineHeight:1.6 }}>increase in conversion rates just by making a few extra follow-up attempts. Most businesses leave this on the table.</p>
          </div>
        </FadeIn>
        <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:isMobile?16:16,marginBottom:isMobile?40:64 }}>
          {[
            { icon: Clock, stat: "5 mins", desc: "Responding within 5 minutes makes you 9x more likely to convert a lead" },
            { icon: Mail, stat: "3 emails", desc: "Three follow-up emails hit the sweet spot with a 9.2% reply rate" },
            { icon: BarChart3, stat: "35-50%", desc: "of jobs go to the vendor who responds first — speed wins" },
          ].map((item,i) => {
            const ItemIcon = item.icon;
            return (
            <FadeIn key={i} delay={0.08*i}>
              <div style={{ padding:isMobile?20:28,borderRadius:14,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",textAlign:"center",height:"100%" }}>
                <div style={{ width:40,height:40,borderRadius:10,background:"rgba(20,184,166,0.1)",border:"1px solid rgba(20,184,166,0.15)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px" }}><ItemIcon size={18} color={theme.accent} strokeWidth={1.5} /></div>
                <div style={{ fontSize:isMobile?24:32,fontWeight:700,color:"#FFFFFF",fontFamily:theme.font,letterSpacing:"-0.03em",marginBottom:8 }}>{item.stat}</div>
                <p style={{ fontSize:13,color:"rgba(255,255,255,0.4)",lineHeight:1.5 }}>{item.desc}</p>
              </div>
            </FadeIn>
            );
          })}
        </div>
      </div>
    </div>
    <div style={{ maxWidth:1100,margin:"0 auto",padding:"0 48px" }}><div style={{ height:1,background:"linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} /></div>
    <div style={{ padding:isMobile?"60px 20px":"100px 48px" }}>
      <div style={{ maxWidth:720,margin:"0 auto" }}>
        <FadeIn>
          <div style={{ padding:isMobile?24:48,borderRadius:16,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",textAlign:"center" }}>
            <h2 style={{ fontSize:isMobile?24:32,fontWeight:700,color:"#FFFFFF",marginBottom:16,fontFamily:theme.font,letterSpacing:"-0.02em" }}>Built by a Kiwi, for Kiwi Businesses</h2>
            <p style={{ fontSize:15,color:"rgba(255,255,255,0.4)",lineHeight:1.8,maxWidth:560,margin:"0 auto 8px" }}>I'm Jesse — a young Kiwi based in Auckland. I built Wynflow because I saw firsthand how much time and money small businesses waste on things that should be automatic.</p>
            <p style={{ fontSize:15,color:"rgba(255,255,255,0.4)",lineHeight:1.8,maxWidth:560,margin:"0 auto 24px" }}>Wynflow is built specifically for how NZ businesses actually work. No complicated setup, no enterprise pricing, no fluff. Snap photos, get an AI-generated quote, send it, and let automated follow-ups do the chasing. New Zealand has over 600,000 small businesses — 97% of all businesses in the country. Most of them are too busy doing the work to chase the paperwork. That's what Wynflow is for.</p>
            <div style={{ display:"flex",gap:isMobile?16:32,justifyContent:"center",marginTop:32,flexWrap:"wrap" }}>
              {[{icon:Globe,label:"100% NZ Built"},{icon:Cpu,label:"AI-Powered"},{icon:Wrench,label:"Made for Business"}].map((b,i) => {
                const BIcon = b.icon;
                return (
                <div key={i} style={{ display:"flex",flexDirection:"column",alignItems:"center" }}>
                  <div style={{ width:44,height:44,borderRadius:12,background:"rgba(20,184,166,0.1)",border:"1px solid rgba(20,184,166,0.15)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:8 }}><BIcon size={20} color={theme.accent} strokeWidth={1.5} /></div>
                  <div style={{ fontSize:13,color:"rgba(255,255,255,0.4)" }}>{b.label}</div>
                </div>
                );
              })}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
    <div style={{ padding:isMobile?"60px 20px":"100px 48px",textAlign:"center",position:"relative" }}>
      <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"60%",height:"80%",background:"radial-gradient(circle, rgba(20,184,166,0.06) 0%, transparent 60%)",pointerEvents:"none" }} />
      <FadeIn>
        <div style={{ position:"relative",zIndex:1,maxWidth:600,margin:"0 auto",padding:isMobile?"48px 24px":"64px 48px",borderRadius:20,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)" }}>
          <h2 style={{ fontSize:isMobile?28:36,fontWeight:700,color:"#FFFFFF",marginBottom:16,fontFamily:theme.font,letterSpacing:"-0.03em" }}>Quote Smarter. Chase Less. Win More.</h2>
          <p style={{ fontSize:16,color:"rgba(255,255,255,0.4)",marginBottom:32,lineHeight:1.6 }}>Let AI handle the quoting and automated follow-ups handle the chasing — while you stay on the tools.</p>
          <button onClick={() => dispatch({ type:"SET_SCREEN",payload:"signup" })} style={{ fontFamily:theme.font,fontSize:15,fontWeight:600,padding:"14px 40px",borderRadius:10,background:theme.accent,color:"#000",border:"none",cursor:"pointer",transition:"all 0.2s",boxShadow:`0 0 24px rgba(20,184,166,0.3), 0 0 60px rgba(20,184,166,0.1)` }}
            onMouseEnter={e=>{e.currentTarget.style.background="#5EEAD4";e.currentTarget.style.transform="translateY(-2px)";}}
            onMouseLeave={e=>{e.currentTarget.style.background=theme.accent;e.currentTarget.style.transform="translateY(0)";}}>
            Start Your Free Trial <ArrowRight size={16} style={{ display:"inline",verticalAlign:"middle",marginLeft:8 }} />
          </button>
        </div>
      </FadeIn>
    </div>
    <Footer dispatch={dispatch} />
  </div>
  );
};

const PricingPage = ({ dispatch }) => {
  const isMobile = useIsMobile();
  const plans = [
    {name:"Starter",price:"29",desc:"AI quoting & automated follow-ups to win more jobs",features:["AI photo quote generator","Unlimited quotes","1 automated follow-up sequence","Customer quote request page","One-click Accept / Decline","File attachments","Quote dashboard & analytics","Email support"],highlighted:true,active:true,link:"https://buy.stripe.com/bJecN5cNf6gD70L1A973G00"},
    {name:"Pro",price:"49",desc:"The full AI-powered toolkit for serious tradies",features:["Everything in Starter","Unlimited follow-up sequences","Custom follow-up messages","Advanced analytics & insights","Custom email branding","Team access (up to 3 users)","Priority support"],highlighted:false,active:true,link:"https://buy.stripe.com/9B6cN500t6gD2Kv92B73G01"},
  ];
  const faqs = [{q:"How does the AI quote generator work?",a:"Take photos on the job site, add a few details about the work, and Wynflow's AI analyses everything — your trade, your rates, the scope of work — to generate an itemised quote with materials, labour, and pricing. Review it, tweak if needed, and send."},{q:"Is there really a free trial?",a:"Yep. 14 days, full access including AI quoting, no credit card needed. Send real quotes from day one."},{q:"Can I cancel anytime?",a:"Absolutely. No lock-in contracts, no cancellation fees. But most tradies stay."},{q:"Do my customers know it's automated?",a:"Nope. Emails come from Wynflow on behalf of your business name. They look professional and personal — your customers just think you're on the ball."},{q:"What if I already use Xero / Tradify / Fergus?",a:"Keep using them for your invoicing. Wynflow is specifically for AI-powered quoting and automated follow-ups — it fills the gap most trade software misses."},{q:"How long does it take to set up?",a:"About 30 seconds. Sign up, enter your business details, and generate your first AI quote. The default follow-up sequence is ready to go."}];
  return (
  <div style={{ background:theme.bg,minHeight:"100vh" }}>
    <div style={{ padding:isMobile?"100px 20px 60px":"140px 48px 80px",textAlign:"center",position:"relative" }}>
      <div style={{ position:"absolute",top:0,left:0,right:0,bottom:0,background:`radial-gradient(ellipse at 50% 20%,rgba(20,184,166,0.08) 0%,transparent 50%)`,pointerEvents:"none" }} />
      <FadeIn>
        <h1 style={{ fontSize:isMobile?36:56,fontWeight:700,color:"#FFFFFF",marginBottom:20,fontFamily:theme.font,letterSpacing:"-0.03em",position:"relative" }}>Simple, Honest Pricing</h1>
        <p style={{ fontSize:isMobile?16:18,color:"rgba(255,255,255,0.4)",maxWidth:500,margin:"0 auto",lineHeight:1.7,position:"relative" }}>No hidden fees. No lock-in contracts. Less than the cost of one lost job.</p>
      </FadeIn>
    </div>
    <div style={{ height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.06) 50%,transparent)" }} />
    <div style={{ padding:isMobile?"40px 20px 60px":"60px 48px 100px" }}>
      <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:isMobile?20:32,maxWidth:800,margin:"0 auto" }}>
        {plans.map((plan,i) => (
          <FadeIn key={i} delay={i * 0.15}>
            <div style={{ padding:isMobile?28:40,borderRadius:20,background:plan.highlighted?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.03)",border:`${plan.highlighted?"2px":"1px"} solid ${plan.highlighted?"rgba(20,184,166,0.3)":"rgba(255,255,255,0.06)"}`,position:"relative",transform:plan.highlighted && !isMobile?"scale(1.03)":"none",boxShadow:plan.highlighted?"0 0 60px rgba(20,184,166,0.12)":"none",transition:"all 0.3s ease",height:"100%" }}>
              {plan.highlighted && <div style={{ position:"absolute",top:-14,left:"50%",transform:"translateX(-50%)",padding:"6px 20px",borderRadius:20,background:theme.accent,color:"#000",fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:1 }}>Most Popular</div>}
              <h3 style={{ fontSize:22,fontWeight:700,color:"#FFFFFF",marginBottom:8,fontFamily:theme.font,letterSpacing:"-0.02em" }}>{plan.name}</h3>
              <p style={{ fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:24,lineHeight:1.6 }}>{plan.desc}</p>
              <div style={{ marginBottom:32 }}><span style={{ fontSize:52,fontWeight:800,color:"#FFFFFF",fontFamily:theme.font,letterSpacing:"-0.03em" }}>${plan.price}</span><span style={{ fontSize:16,color:"rgba(255,255,255,0.35)" }}>/month</span></div>
              {plan.active && (
                <button onClick={() => window.open(plan.link, "_blank")}
                  style={{ width:"100%",padding:"14px 24px",marginBottom:32,borderRadius:10,fontSize:15,fontWeight:600,fontFamily:theme.font,cursor:"pointer",border:"none",transition:"all 0.2s",
                    background:plan.highlighted?theme.accent:"rgba(255,255,255,0.06)",
                    color:plan.highlighted?"#000":"#FFFFFF",
                    boxShadow:plan.highlighted?"0 0 24px rgba(20,184,166,0.3)":"none",
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";if(plan.highlighted)e.currentTarget.style.background="#5EEAD4";else e.currentTarget.style.background="rgba(255,255,255,0.1)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";if(plan.highlighted)e.currentTarget.style.background=theme.accent;else e.currentTarget.style.background="rgba(255,255,255,0.06)";}}>
                  {plan.highlighted ? "Start Free Trial" : "Upgrade to Pro"}
                </button>
              )}
              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>{plan.features.map((f,j) => <div key={j} style={{ display:"flex",alignItems:"center",gap:10,fontSize:14,color:"rgba(255,255,255,0.5)" }}><Check size={14} color={theme.accent} strokeWidth={2.5} /> {f}</div>)}</div>
            </div>
          </FadeIn>
        ))}
      </div>
    </div>
    <div style={{ height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.06) 50%,transparent)" }} />
    <div style={{ padding:isMobile?"60px 20px":"80px 48px" }}>
      <FadeIn>
        <div style={{ maxWidth:700,margin:"0 auto" }}>
          <h2 style={{ fontSize:isMobile?28:36,fontWeight:700,color:"#FFFFFF",marginBottom:48,textAlign:"center",fontFamily:theme.font,letterSpacing:"-0.03em" }}>Frequently Asked Questions</h2>
          {faqs.map((faq,i) => (
            <div key={i} style={{ padding:"24px 0",borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
              <h3 style={{ fontSize:16,fontWeight:600,color:"#FFFFFF",marginBottom:8,letterSpacing:"-0.01em" }}>{faq.q}</h3>
              <p style={{ fontSize:14,color:"rgba(255,255,255,0.4)",lineHeight:1.7 }}>{faq.a}</p>
            </div>
          ))}
        </div>
      </FadeIn>
    </div>
    <div style={{ height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.06) 50%,transparent)" }} />
    <div style={{ padding:isMobile?"60px 20px":"80px 48px",textAlign:"center",position:"relative" }}>
      <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"60%",height:"80%",background:"radial-gradient(circle, rgba(20,184,166,0.06) 0%, transparent 60%)",pointerEvents:"none" }} />
      <FadeIn>
        <div style={{ position:"relative",zIndex:1,maxWidth:600,margin:"0 auto",padding:isMobile?"48px 24px":"64px 48px",borderRadius:20,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)" }}>
          <h2 style={{ fontSize:isMobile?28:36,fontWeight:700,color:"#FFFFFF",marginBottom:16,fontFamily:theme.font,letterSpacing:"-0.03em" }}>Still Not Sure?</h2>
          <p style={{ fontSize:16,color:"rgba(255,255,255,0.4)",marginBottom:32,lineHeight:1.6 }}>Start your free trial — generate your first AI quote in under a minute.</p>
          <button onClick={() => dispatch({ type:"SET_SCREEN",payload:"signup" })} style={{ fontFamily:theme.font,fontSize:15,fontWeight:600,padding:"14px 40px",borderRadius:10,background:theme.accent,color:"#000",border:"none",cursor:"pointer",transition:"all 0.2s",boxShadow:"0 0 24px rgba(20,184,166,0.3), 0 0 60px rgba(20,184,166,0.1)" }}
            onMouseEnter={e=>{e.currentTarget.style.background="#5EEAD4";e.currentTarget.style.transform="translateY(-2px)";}}
            onMouseLeave={e=>{e.currentTarget.style.background=theme.accent;e.currentTarget.style.transform="translateY(0)";}}>
            Start Free Trial <ArrowRight size={16} style={{ display:"inline",verticalAlign:"middle",marginLeft:8 }} />
          </button>
        </div>
      </FadeIn>
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

const TRADE_CATEGORIES = [
  "Plumber", "Electrician", "Builder", "Painter", "Roofer", "Landscaper",
  "Carpet Layer", "Tiler", "Cleaner", "Handyman", "Mechanic", "Fencer",
  "Locksmith", "Gasfitter", "Drainlayer", "Plasterer", "Concreter",
  "Pest Control", "Arborist", "Interior Designer", "Other",
];

// ─── Reset Password Screen ───
const ResetPasswordScreen = ({ dispatch }) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    if (!password || password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${supabase.token}` },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error("Failed to update password");
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: `radial-gradient(ellipse at 30% 20%, rgba(20,184,166,0.08) 0%, transparent 50%), ${theme.bg}`,
      fontFamily: theme.font, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <WynflowLogo size={48} />
            <span style={{ fontSize: 28, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font, letterSpacing: "-0.02em" }}>Wynflow</span>
          </div>
        </div>
        <Card style={{ padding: 32 }}>
          {success ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <CheckCircle2 size={48} color={theme.green} style={{ marginBottom: 16 }} />
              <h3 style={{ fontSize: 18, fontWeight: 600, color: theme.text, margin: "0 0 8px" }}>Password Updated</h3>
              <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.6, margin: "0 0 20px" }}>Your password has been reset successfully.</p>
              <Button onClick={() => { supabase.token = null; dispatch({ type: "SET_SCREEN", payload: "login" }); }}
                style={{ width: "100%", justifyContent: "center" }}>Sign In →</Button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: theme.text, margin: "0 0 8px" }}>Set New Password</h3>
                <p style={{ fontSize: 14, color: theme.textMuted }}>Enter your new password below</p>
              </div>
              <Input label="New Password *" value={password} onChange={setPassword} type="password" />
              <Input label="Confirm Password *" value={confirm} onChange={setConfirm} type="password" />
              {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: theme.redSoft, color: theme.red, fontSize: 13 }}>{error}</div>}
              <Button onClick={handleReset} disabled={loading}
                style={{ width: "100%", justifyContent: "center", padding: "14px 24px" }}>
                {loading ? "Updating..." : "Reset Password →"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

const AuthScreen = ({ dispatch, isSignup }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [trade, setTrade] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [calloutFee, setCalloutFee] = useState("");
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
        body: JSON.stringify({ email, gotrue_meta_security: {}, code_challenge_method: "", redirect_to: "https://www.wynflow.co.nz" }),
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
          trade_category: trade || null,
          hourly_rate: parseFloat(hourlyRate) || 0,
          callout_fee: parseFloat(calloutFee) || 0,
          subscription_status: "trialing",
        });
        if (bizErr || !biz || !biz[0]) {
          const { data: existingBiz } = await db("businesses").eq("user_id", authData.user.id).single().select();
          if (existingBiz) {
            dispatch({ type: "SET_USER", payload: authData.user });
            dispatch({ type: "SET_BUSINESS", payload: existingBiz });
            setCookie("wynflow_token", supabase.token, 43200);
            setCookie("wynflow_user", authData.user, 43200);
            setCookie("wynflow_business", existingBiz, 43200);
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
        setCookie("wynflow_token", supabase.token, 43200);
        setCookie("wynflow_user", authData.user, 43200);
        setCookie("wynflow_business", bizRecord, 43200);
        dispatch({ type: "NOTIFY", payload: { message: "Account created! Welcome to Wynflow!", type: "success" } });
        fetch("https://wynfallautomation.app.n8n.cloud/webhook/new-business", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ business_name: businessName, contact_name: contactName, email, trade, hourly_rate: hourlyRate, callout_fee: calloutFee }),
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
        setCookie("wynflow_token", supabase.token, 43200);
        setCookie("wynflow_user", authData.user, 43200);
        setCookie("wynflow_business", biz, 43200);
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
            <span style={{ fontSize: 28, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font, letterSpacing: "-0.02em" }}>Wynflow</span>
          </div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
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
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: theme.textMuted, marginBottom: 6 }}>Trade / Industry *</div>
                  <select value={trade} onChange={e => setTrade(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#F1F3F7", fontSize: 14, fontFamily: theme.font, outline: "none", appearance: "auto" }}>
                    <option value="">Select your trade...</option>
                    {TRADE_CATEGORIES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}><Input label="Hourly Rate ($)" value={hourlyRate} onChange={setHourlyRate} type="number" placeholder="e.g. 85" /></div>
                  <div style={{ flex: 1 }}><Input label="Callout Fee ($)" value={calloutFee} onChange={setCalloutFee} type="number" placeholder="e.g. 50" /></div>
                </div>
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
    { id: "help", label: "Help", icon: HelpCircle },
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
        background: "rgba(10,14,23,0.85)", borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", justifyContent: "space-around", padding: "6px 4px env(safe-area-inset-bottom, 8px)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
          <div key={item.id} onClick={() => dispatch({ type: "SET_SCREEN", payload: item.id })}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
              cursor: "pointer", padding: "4px 6px",
              color: screen === item.id ? theme.accent : "rgba(255,255,255,0.35)",
            }}>
            <Icon size={18} />
            <span style={{ fontSize: 9, fontWeight: 600 }}>{item.label}</span>
          </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{
      width: 260, background: "rgba(255,255,255,0.02)", borderRight: "1px solid rgba(255,255,255,0.06)",
      display: "flex", flexDirection: "column", padding: "24px 16px", flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 36 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, overflow: "hidden" }}><WynflowLogo size={36} /></div>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font, letterSpacing: "-0.02em" }}>Wynflow</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
          <div key={item.id} onClick={() => dispatch({ type: "SET_SCREEN", payload: item.id })}
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
              borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 500,
              background: screen === item.id ? "rgba(20,184,166,0.1)" : "transparent",
              color: screen === item.id ? theme.accent : "rgba(255,255,255,0.4)",
              transition: "all 0.2s ease",
            }}>
            <Icon size={18} />
            {item.label}
          </div>
          );
        })}
      </div>
      <div style={{
        padding: "16px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#FFFFFF", marginBottom: 2 }}>{business?.business_name}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{business?.email}</div>
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
  const [alertDismissed, setAlertDismissed] = useState(false);
  const requested = quotes.filter((q) => q.status === "requested").length;
  const total = quotes.length;
  const pending = quotes.filter((q) => q.status === "sent" || q.status === "pending" || q.status === "opened").length;
  const accepted = quotes.filter((q) => q.status === "accepted").length;
  const booked = quotes.filter((q) => q.status === "booked").length;
  const declined = quotes.filter((q) => q.status === "declined").length;
  const won = accepted + booked;
  const responded = won + declined;
  const revenue = quotes.filter((q) => q.status === "accepted" || q.status === "booked").reduce((sum, q) => sum + parseFloat(q.amount || 0), 0);
  const winRate = responded > 0 ? Math.round((won / responded) * 100) : 0;
  const avgQuoteValue = won > 0 ? Math.round(revenue / won) : 0;
  const recentQuotes = [...quotes].slice(0, 8);

  // Response time
  const responseTimes = quotes.filter(q => q.sent_at && q.responded_at).map(q => {
    const s = new Date(q.sent_at); const r = new Date(q.responded_at);
    return Math.round((r - s) / (1000 * 60 * 60 * 24));
  });
  const avgResponseDays = responseTimes.length > 0 ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : null;

  // Monthly data
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
  const months = Object.entries(monthlyData).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

  // Follow-up effectiveness
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

  return (
    <div>
      <div style={{ marginBottom: isMobile ? 16 : 32 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>Dashboard</h1>
        <p style={{ fontSize: isMobile ? 13 : 14, color: theme.textMuted, margin: "4px 0 0" }}>Here's what's happening with your quotes</p>
      </div>
      {requested > 0 && (
        <div onClick={() => dispatch({ type: "SET_SCREEN", payload: "quotes" })}
          style={{
            padding: "14px 20px", borderRadius: 10, marginBottom: 12, cursor: "pointer",
            background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.25)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
          <MessageSquare size={18} color="#14B8A6" />
          <span style={{ fontSize: 14, color: "#14B8A6", fontWeight: 500 }}>
            {requested} new quote request{requested > 1 ? "s" : ""} — review and send a quote!
          </span>
        </div>
      )}
      {accepted > 0 && !alertDismissed && (
        <div style={{
            padding: "14px 20px", borderRadius: 10, marginBottom: 12,
            background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
          <Clock size={18} color="#F59E0B" />
          <span onClick={() => dispatch({ type: "SET_SCREEN", payload: "quotes" })}
            style={{ fontSize: 14, color: "#F59E0B", fontWeight: 500, flex: 1, cursor: "pointer" }}>
            {accepted} accepted quote{accepted > 1 ? "s" : ""} need{accepted === 1 ? "s" : ""} to be booked in — call your customer{accepted > 1 ? "s" : ""}!
          </span>
          <button onClick={() => setAlertDismissed(true)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#F59E0B", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: isMobile ? 16 : 24, overflowX: isMobile ? "auto" : "visible", WebkitOverflowScrolling: "touch", paddingBottom: isMobile ? 4 : 0 }}>
        <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "aiQuote" })} size={isMobile ? "sm" : "md"} style={{ background: "rgba(20,184,166,0.12)", color: "#14B8A6", whiteSpace: "nowrap", flexShrink: 0 }}><Cpu size={14} /> AI Quote</Button>
        <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "newQuote" })} variant="secondary" size={isMobile ? "sm" : "md"} style={{ whiteSpace: "nowrap", flexShrink: 0 }}><Plus size={14} /> Manual Quote</Button>
        <Button variant="secondary" size={isMobile ? "sm" : "md"} onClick={() => dispatch({ type: "SET_SCREEN", payload: "sequences" })} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>Manage Follow-Ups</Button>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr 1fr", gap: isMobile ? 8 : 12, marginBottom: isMobile ? 16 : 24 }}>
        <Stat label="Total" value={total} icon={FileText} />
        <Stat label="Awaiting" value={pending} accent={theme.accent} icon={Clock} />
        <Stat label="Accepted" value={accepted} accent="#F59E0B" icon={CheckCircle2} />
        <Stat label="Booked" value={booked} accent={theme.green} icon={Check} />
        <Stat label="Revenue" value={`$${revenue.toLocaleString()}`} accent={theme.green} icon={DollarSign} />
      </div>

      {/* Two-column layout: Analytics + Recent Quotes */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 24 }}>

        {/* Left column: Analytics (on mobile, renders second via order) */}
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 24, order: isMobile ? 2 : 1 }}>

          {/* Win rate ring */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div style={{ position: "relative", width: 100, height: 100, flexShrink: 0 }}>
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke={theme.surfaceLight} strokeWidth="8" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke={winRate >= 50 ? theme.green : winRate >= 25 ? "#F59E0B" : theme.red} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${winRate * 2.64} ${264 - winRate * 2.64}`} strokeDashoffset="66"
                    style={{ transition: "stroke-dasharray 0.8s ease" }} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: theme.text, fontFamily: theme.fontDisplay, lineHeight: 1 }}>{winRate}%</span>
                  <span style={{ fontSize: 10, color: theme.textDim, marginTop: 2 }}>win rate</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, margin: "0 0 12px" }}>Quote Performance</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: theme.textMuted }}>Won</span>
                    <span style={{ color: theme.green, fontWeight: 600 }}>{won}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: theme.textMuted }}>Declined</span>
                    <span style={{ color: theme.red, fontWeight: 600 }}>{declined}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: theme.textMuted }}>Avg Quote</span>
                    <span style={{ color: theme.text, fontWeight: 600 }}>${avgQuoteValue.toLocaleString()}</span>
                  </div>
                  {avgResponseDays !== null && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: theme.textMuted }}>Avg Response</span>
                      <span style={{ color: theme.accent, fontWeight: 600 }}>{avgResponseDays} day{avgResponseDays !== 1 ? "s" : ""}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Quote funnel mini bars */}
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Quote Funnel</h3>
            {[
              { label: "Sent", value: total, color: theme.accent },
              { label: "Opened", value: quotes.filter(q => q.status === "opened").length, color: theme.blue },
              { label: "Accepted", value: accepted, color: "#F59E0B" },
              { label: "Booked", value: booked, color: theme.green },
              { label: "Declined", value: declined, color: theme.red },
            ].map((bar, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>
                  <span>{bar.label}</span><span style={{ fontWeight: 600, color: theme.text }}>{bar.value}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: theme.surfaceLight, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${total > 0 ? (bar.value / total) * 100 : 0}%`, borderRadius: 3, background: bar.color, transition: "width 0.6s ease" }} />
                </div>
              </div>
            ))}
          </Card>

          {/* Monthly sparkline */}
          {months.length > 1 && (
            <Card>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, margin: "0 0 4px" }}>Monthly Revenue</h3>
              <p style={{ fontSize: 12, color: theme.textDim, margin: "0 0 16px" }}>Last {months.length} month{months.length > 1 ? "s" : ""}</p>
              {(() => {
                const maxRev = Math.max(...months.map(m => m[1].revenue), 1);
                const barWidth = Math.max(Math.floor((100 - months.length * 2) / months.length), 8);
                return (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
                    {months.map(([month, data], i) => (
                      <div key={month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{
                          width: "100%", maxWidth: 40, borderRadius: 4,
                          height: `${Math.max((data.revenue / maxRev) * 64, 4)}px`,
                          background: i === months.length - 1 ? theme.accent : theme.accentSoft,
                          transition: "height 0.5s ease",
                        }} />
                        <span style={{ fontSize: 9, color: theme.textDim }}>{new Date(month + "-01").toLocaleDateString("en-NZ", { month: "short" })}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, padding: "10px 0 0", borderTop: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: 12, color: theme.textMuted }}>This month</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: theme.green }}>${(months[months.length - 1]?.[1]?.revenue || 0).toLocaleString()}</span>
              </div>
            </Card>
          )}

          {/* Follow-up effectiveness */}
          {stepData.length > 0 && (
            <Card>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, margin: "0 0 4px" }}>Follow-Up Effectiveness</h3>
              <p style={{ fontSize: 12, color: theme.textDim, margin: "0 0 14px" }}>When customers accept your quotes</p>
              {stepData.map(([label, count]) => {
                const maxStep = Math.max(...stepData.map(s => s[1]));
                return (
                  <div key={label} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>
                      <span>{label}</span><span style={{ fontWeight: 600, color: theme.text }}>{count}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: theme.surfaceLight, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(count / maxStep) * 100}%`, borderRadius: 3, background: theme.accent, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                );
              })}
            </Card>
          )}

          <div onClick={() => dispatch({ type: "SET_SCREEN", payload: "analytics" })}
            style={{ padding: "12px 16px", borderRadius: 10, background: theme.surface, border: `1px solid ${theme.border}`, cursor: "pointer", textAlign: "center", fontSize: 13, color: theme.accent, fontWeight: 500 }}>
            View Full Analytics →
          </div>
        </div>

        {/* Right column: Recent Quotes (on mobile, renders first via order) */}
        <Card style={{ alignSelf: "start", order: isMobile ? 1 : 2, padding: isMobile ? 14 : 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, margin: 0 }}>Recent Quotes</h3>
            <span onClick={() => dispatch({ type: "SET_SCREEN", payload: "quotes" })}
              style={{ fontSize: 13, color: theme.accent, cursor: "pointer", fontWeight: 500 }}>View all →</span>
          </div>
          {recentQuotes.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: theme.textMuted, fontSize: 13 }}>
              No quotes yet — create your first one!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {recentQuotes.map((q) => (
                <div key={q.id}
                  onClick={() => dispatch({ type: "SET_SCREEN", payload: "quoteDetail:" + q.id })}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = theme.surfaceLight)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: theme.surfaceLight,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, color: theme.accent, flexShrink: 0,
                    }}>
                      {q.customer_name?.charAt(0) || "?"}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.customer_name}</div>
                      <div style={{ fontSize: 11, color: theme.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.job_title}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>${parseFloat(q.amount || 0).toLocaleString()}</span>
                    <Badge status={q.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

// ─── Quotes List ───
const QuotesList = ({ quotes, dispatch, sequences }) => {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [stepCounts, setStepCounts] = useState({});

  // Load step counts for all sequences to detect "no response" quotes
  useEffect(() => {
    if (!sequences || sequences.length === 0) return;
    const loadCounts = async () => {
      const counts = {};
      for (const seq of sequences) {
        try {
          const { data } = await db("sequence_steps").eq("sequence_id", seq.id).select();
          counts[seq.id] = data ? data.length : 0;
        } catch (e) { counts[seq.id] = 0; }
      }
      setStepCounts(counts);
    };
    loadCounts();
  }, [sequences]);

  // Determine if a quote has exhausted all follow-ups with no response
  const isNoResponse = (q) => {
    if (q.status !== "sent" && q.status !== "opened") return false;
    if (!q.sequence_id) return false;
    const totalSteps = stepCounts[q.sequence_id] || 0;
    return totalSteps > 0 && (q.current_step || 0) >= totalSteps;
  };

  // Build activity feed from quote events
  const buildActivity = () => {
    const events = [];
    quotes.forEach(q => {
      if (q.status === "requested" && q.created_at) {
        events.push({ type: "requested", quote: q, date: q.created_at, text: `${q.customer_name} requested a quote for "${q.job_title}"` });
      }
      if (q.sent_at) {
        events.push({ type: "sent", quote: q, date: q.sent_at, text: `Quote sent to ${q.customer_name} — $${parseFloat(q.amount || 0).toLocaleString()}` });
      }
      if ((q.status === "accepted" || q.status === "booked") && q.responded_at) {
        events.push({ type: "accepted", quote: q, date: q.responded_at, text: `${q.customer_name} accepted your quote — $${parseFloat(q.amount || 0).toLocaleString()}` });
      }
      if (q.status === "declined" && q.responded_at) {
        events.push({ type: "declined", quote: q, date: q.responded_at, text: `${q.customer_name} declined — ${q.decline_reason || "no reason given"}` });
      }
      if (q.status === "booked" && q.booked_at) {
        events.push({ type: "booked", quote: q, date: q.booked_at, text: `${q.customer_name} booked in — $${parseFloat(q.amount || 0).toLocaleString()}` });
      }
    });
    return events.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30);
  };

  const activityIcons = {
    requested: { icon: MessageSquare, color: theme.accent },
    sent: { icon: Send, color: theme.blue },
    accepted: { icon: CheckCircle2, color: "#F59E0B" },
    declined: { icon: XCircle, color: theme.red },
    booked: { icon: Check, color: theme.green },
  };

  // Filter logic
  const filtered = quotes.filter((q) => {
    if (filter === "activity") return false; // Activity tab renders separately
    if (filter === "noResponse") return isNoResponse(q);
    if (filter !== "all" && filter !== "noResponse") {
      // For "sent" filter, exclude no-response quotes (they have their own tab)
      if (filter === "sent") return (q.status === "sent" || q.status === "opened") && !isNoResponse(q);
      if (q.status !== filter) return false;
    }
    if (search && !q.customer_name?.toLowerCase().includes(search.toLowerCase()) && !q.job_title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Tab counts
  const counts = {
    all: quotes.length,
    requested: quotes.filter(q => q.status === "requested").length,
    accepted: quotes.filter(q => q.status === "accepted").length,
    sent: quotes.filter(q => (q.status === "sent" || q.status === "opened") && !isNoResponse(q)).length,
    booked: quotes.filter(q => q.status === "booked").length,
    declined: quotes.filter(q => q.status === "declined").length,
    noResponse: quotes.filter(q => isNoResponse(q)).length,
  };

  // Tabs in priority hierarchy
  const tabs = [
    { key: "all", label: "All" },
    { key: "requested", label: "Requested", count: counts.requested, dot: counts.requested > 0 },
    { key: "accepted", label: "Accepted", count: counts.accepted },
    { key: "sent", label: "Sent", count: counts.sent },
    { key: "booked", label: "Booked", count: counts.booked },
    { key: "declined", label: "Declined", count: counts.declined },
    { key: "noResponse", label: "No Response", count: counts.noResponse },
    { key: "activity", label: "Activity" },
  ];

  // Follow-up step label for a quote
  const getFollowUpLabel = (q) => {
    if (q.status !== "sent" && q.status !== "opened") return null;
    const step = q.current_step || 0;
    const total = q.sequence_id ? (stepCounts[q.sequence_id] || 0) : 0;
    if (total === 0) return null;
    if (step >= total) return "All sent";
    return `Follow-up ${step}/${total}`;
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", marginBottom: isMobile ? 16 : 28, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>Quotes</h1>
          <p style={{ fontSize: isMobile ? 13 : 14, color: theme.textMuted, margin: "4px 0 0" }}>{quotes.length} total quotes</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "aiQuote" })} size={isMobile ? "sm" : "md"} style={{ background: "rgba(20,184,166,0.12)", color: "#14B8A6" }}><Cpu size={14} /> AI Quote</Button>
          <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "newQuote" })} variant="secondary" size={isMobile ? "sm" : "md"}><Plus size={14} /> Manual</Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: isMobile ? 12 : 20, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 4, flexWrap: "nowrap", alignItems: "center" }}>
        {tabs.map((tab) => (
          <span key={tab.key} onClick={() => setFilter(tab.key)}
            style={{
              padding: isMobile ? "6px 10px" : "8px 14px", borderRadius: 8, fontSize: isMobile ? 11 : 13, fontWeight: 500, cursor: "pointer",
              background: filter === tab.key ? theme.accentSoft : theme.surfaceLight,
              color: filter === tab.key ? theme.accent : theme.textMuted,
              border: `1px solid ${filter === tab.key ? theme.accent + "33" : theme.border}`,
              whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
            }}>
            {tab.label}
            {tab.dot && <span style={{ width: 6, height: 6, borderRadius: 3, background: theme.accent, flexShrink: 0 }} />}
            {tab.count > 0 && !tab.dot && <span style={{ fontSize: isMobile ? 10 : 11, fontWeight: 600, color: filter === tab.key ? theme.accent : theme.textDim }}>{tab.count}</span>}
          </span>
        ))}
      </div>

      {/* Search (hidden on Activity tab) */}
      {filter !== "activity" && (
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search quotes..."
          style={{
            fontFamily: theme.font, fontSize: 13, padding: isMobile ? "10px 14px" : "8px 16px", borderRadius: isMobile ? 10 : 8, width: isMobile ? "100%" : 200,
            background: theme.surfaceLight, border: `1px solid ${theme.border}`, color: theme.text, outline: "none", marginBottom: isMobile ? 12 : 16,
          }} />
      )}

      {/* Activity tab */}
      {filter === "activity" ? (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: isMobile ? "12px 14px" : "14px 20px", borderBottom: `1px solid ${theme.border}` }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>Recent Activity</span>
          </div>
          {buildActivity().length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: theme.textMuted, fontSize: 14 }}>No activity yet</div>
          ) : buildActivity().map((event, i) => {
            const cfg = activityIcons[event.type] || { icon: FileText, color: theme.textMuted };
            const IconComp = cfg.icon;
            return (
              <div key={i}
                onClick={() => dispatch({ type: "SET_SCREEN", payload: "quoteDetail:" + event.quote.id })}
                style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: isMobile ? "10px 14px" : "12px 20px", borderBottom: `1px solid ${theme.border}08`, cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.surfaceLight)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: cfg.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <IconComp size={16} color={cfg.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: theme.text, lineHeight: 1.5 }}>{event.text}</div>
                  <div style={{ fontSize: 11, color: theme.textDim, marginTop: 2 }}>{timeAgo(event.date)}</div>
                </div>
              </div>
            );
          })}
        </Card>
      ) : (
        /* Quote list */
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
          {filtered.map((q) => {
            const followUpLabel = getFollowUpLabel(q);
            return (
            <div key={q.id}
              onClick={() => dispatch({ type: "SET_SCREEN", payload: "quoteDetail:" + q.id })}
              style={isMobile ? {
                padding: "12px 14px", borderBottom: `1px solid ${theme.border}08`, cursor: "pointer",
              } : {
                display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 80px",
                padding: "16px 20px", borderBottom: `1px solid ${theme.border}08`, cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = theme.surfaceLight)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {isMobile ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.customer_name}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.job_title}</div>
                    {followUpLabel && <div style={{ fontSize: 10, color: theme.accent, fontWeight: 500, marginTop: 2 }}>{followUpLabel}</div>}
                    {isNoResponse(q) && <div style={{ fontSize: 10, color: theme.red, fontWeight: 500, marginTop: 2 }}>No response — all follow-ups sent</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>${parseFloat(q.amount || 0).toLocaleString()}</span>
                    <Badge status={q.status} />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{q.customer_name}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted }}>{q.customer_email}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ fontSize: 14, color: theme.text }}>{q.job_title}</div>
                    {followUpLabel && <div style={{ fontSize: 11, color: theme.accent, fontWeight: 500, marginTop: 2 }}>{followUpLabel}</div>}
                    {isNoResponse(q) && <div style={{ fontSize: 11, color: theme.red, fontWeight: 500, marginTop: 2 }}>No response — all follow-ups sent</div>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: theme.text, display: "flex", alignItems: "center" }}>${parseFloat(q.amount || 0).toLocaleString()}</div>
                  <div style={{ display: "flex", alignItems: "center" }}><Badge status={q.status} /></div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 18, color: theme.textDim }}>→</span>
                  </div>
                </>
              )}
            </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: 48, textAlign: "center", color: theme.textMuted, fontSize: 14 }}>
              {quotes.length === 0 ? "No quotes yet — create your first one!" : filter === "noResponse" ? "No unresponsive quotes — nice!" : "No quotes match this filter"}
            </div>
          )}
        </Card>
      )}
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
      <div style={{ marginBottom: isMobile ? 16 : 32 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>Analytics</h1>
        <p style={{ fontSize: isMobile ? 13 : 14, color: theme.textMuted, margin: "4px 0 0" }}>See how your quotes are performing</p>
      </div>

      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: isMobile ? 8 : 12, marginBottom: isMobile ? 16 : 24 }}>
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
        <Card style={{ marginBottom: 24 }}>
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

      {/* Decline reasons */}
      {(() => {
        const declinedQuotes = quotes.filter(q => q.status === "declined" && q.decline_reason);
        if (declinedQuotes.length === 0) return null;
        const reasonCounts = {};
        declinedQuotes.forEach(q => { reasonCounts[q.decline_reason] = (reasonCounts[q.decline_reason] || 0) + 1; });
        const reasonData = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);
        const maxCount = Math.max(...reasonData.map(r => r[1]));
        return (
          <Card>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 8px" }}>Why Customers Decline</h3>
            <p style={{ fontSize: 13, color: theme.textMuted, margin: "0 0 20px" }}>Feedback from {declinedQuotes.length} declined quote{declinedQuotes.length > 1 ? "s" : ""}</p>
            {reasonData.map(([reason, count]) => (
              <BarSimple key={reason} label={reason} value={count} max={maxCount} color={theme.red} count={count} />
            ))}
          </Card>
        );
      })()}
    </div>
  );
};

// ─── AI Quote Form ───
const AIQuoteForm = ({ dispatch, business, sequences, quotes }) => {
  const isMobile = useIsMobile();
  const [form, setForm] = useState({ customerName: "", customerEmail: "", customerPhone: "", jobTitle: "", description: "" });
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [siteNotes, setSiteNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [sending, setSending] = useState(false);

  const [showPreview, setShowPreview] = useState(false);

  const QuotePreview = () => (
    <div onClick={() => setShowPreview(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto", borderRadius: 12, background: "#fff", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "32px 40px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#0A0E17", fontFamily: theme.fontDisplay }}>{business.business_name}</div>
              {editForm?.showBusinessDetails && business.address && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{business.address}</div>}
              {business.phone && <div style={{ fontSize: 13, color: "#6b7280", marginTop: editForm?.showBusinessDetails && business.address ? 0 : 4 }}>{business.phone}</div>}
              {business.email && <div style={{ fontSize: 13, color: "#6b7280" }}>{business.email}</div>}
              {editForm?.showBusinessDetails && (business.gst_number || business.license_number) && (
                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                  {business.gst_number && <div style={{ fontSize: 11, color: "#9ca3af" }}>GST: {business.gst_number}</div>}
                  {business.license_number && <div style={{ fontSize: 11, color: "#9ca3af" }}>{business.license_number}</div>}
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1 }}>Quote</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}</div>
            </div>
          </div>
          <div style={{ borderBottom: "3px solid #14B8A6", marginBottom: 24 }} />
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>Prepared For</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>{form.customerName}</div>
            {form.customerEmail && <div style={{ fontSize: 13, color: "#6b7280" }}>{form.customerEmail}</div>}
            {form.customerPhone && <div style={{ fontSize: 13, color: "#6b7280" }}>{form.customerPhone}</div>}
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>Job</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{form.jobTitle}</div>
          </div>
          {editForm?.scope && <div style={{ marginBottom: 24 }}><div style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>Scope of Work</div><div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-line" }}>{editForm.scope}</div></div>}
          {editForm?.materials && <div style={{ marginBottom: 24 }}><div style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>Materials</div><div style={{ fontSize: 14, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-line" }}>{editForm.materials}</div></div>}
          <div style={{ background: "#f9fafb", borderRadius: 10, padding: 20, marginBottom: 24 }}>
            {editForm?.showBreakdown && (<>
              {parseFloat(editForm?.materialsCost) > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 14, color: "#6b7280" }}>Materials</span><span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>${parseFloat(editForm.materialsCost).toLocaleString()}</span></div>}
              {editForm?.labourHours && business.hourly_rate && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 14, color: "#6b7280" }}>Labour ({editForm.labourHours} hrs @ ${business.hourly_rate}/hr)</span><span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>${(parseFloat(editForm.labourHours) * parseFloat(business.hourly_rate)).toLocaleString()}</span></div>}
              {editForm?.includeCallout && parseFloat(business.callout_fee) > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 14, color: "#6b7280" }}>Callout Fee</span><span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>${parseFloat(business.callout_fee).toLocaleString()}</span></div>}
            </>)}
            <div style={{ borderTop: editForm?.showBreakdown ? "2px solid #111827" : "none", paddingTop: editForm?.showBreakdown ? 12 : 0, marginTop: editForm?.showBreakdown ? 12 : 0, display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>Total (incl. GST)</span><span style={{ fontSize: 24, fontWeight: 800, color: "#14B8A6" }}>${parseFloat(editForm?.amount || 0).toLocaleString()}</span></div>
          </div>
          {editForm?.notes && <div style={{ marginBottom: 24 }}><div style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>Terms & Conditions</div><div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, whiteSpace: "pre-line" }}>{editForm.notes}</div></div>}
          {editForm?.showBusinessDetails && business.quote_footer && <div style={{ marginBottom: 24, padding: "14px 16px", borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb" }}><div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, whiteSpace: "pre-line" }}>{business.quote_footer}</div></div>}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ fontSize: 11, color: "#9ca3af" }}>Powered by <span style={{ color: "#14B8A6", fontWeight: 600 }}>Wynflow</span></div><div style={{ fontSize: 11, color: "#9ca3af" }}>Valid for 30 days</div></div>
        </div>
        <div style={{ padding: "16px 40px 24px", background: "#f9fafb", borderTop: "1px solid #e5e7eb", display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={() => setShowPreview(false)}>Close</Button>
          <Button onClick={() => { setShowPreview(false); sendQuote(); }} disabled={sending}><Send size={16} /> Send Quote</Button>
        </div>
      </div>
    </div>
  );

  const update = (key, val) => setForm({ ...form, [key]: val });

  const handlePhotoAdd = (e) => {
    const files = Array.from(e.target.files).slice(0, 5 - photos.length);
    setPhotos(prev => [...prev, ...files]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreviews(prev => [...prev, ev.target.result]);
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (i) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== i));
    setPhotoPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const compressImage = (file, maxSize = 1200) => new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) { if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; } else { w = Math.round(w * maxSize / h); h = maxSize; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  const generateQuote = async () => {
    if (!form.customerName || !form.customerEmail || !form.customerPhone || !form.jobTitle) {
      dispatch({ type: "NOTIFY", payload: { message: "Please fill in customer name, email, phone, and job title", type: "error" } });
      return;
    }
    setGenerating(true);
    try {
      const photoData = [];
      for (const photo of photos) {
        const compressed = await compressImage(photo);
        photoData.push({ name: photo.name, type: "image/jpeg", data: compressed });
      }
      // Build recent quote history for AI learning (last 20 sent/accepted quotes)
      const quoteHistory = quotes
        .filter(q => ["sent", "accepted", "booked", "opened"].includes(q.status) && q.amount)
        .slice(0, 20)
        .map(q => ({ job_title: q.job_title, description: q.description, amount: q.amount, status: q.status }));
      const res = await fetch("https://wynfallautomation.app.n8n.cloud/webhook/generate-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: business.id,
          job_title: form.jobTitle,
          description: form.description,
          customer_name: form.customerName,
          site_notes: siteNotes,
          site_photos: photoData,
          customer_photos: [],
          trade: business.trade,
          trade_category: business.trade_category,
          hourly_rate: business.hourly_rate,
          callout_fee: business.callout_fee,
          price_list: business.price_list || [],
          quote_history: quoteHistory,
        }),
      });
      const result = await res.json();
      if (result.quote) {
        setGenerated(result.quote);
        const hours = parseFloat(result.quote.estimated_hours) || 0;
        const rate = parseFloat(business.hourly_rate) || 0;
        const total = parseFloat(result.quote.total) || 0;
        const labourCost = hours * rate;
        const callout = parseFloat(business.callout_fee) || 0;
        const matCost = Math.max(0, total - labourCost - callout);
        setEditForm({
          scope: result.quote.scope_of_work || "",
          materials: result.quote.materials_breakdown || "",
          labourHours: result.quote.estimated_hours || "",
          materialsCost: matCost ? String(Math.round(matCost * 100) / 100) : "",
          amount: result.quote.total || "",
          notes: result.quote.notes || "",
          showBreakdown: true,
          includeCallout: parseFloat(business.callout_fee) > 0,
          showBusinessDetails: !!(business.address || business.gst_number || business.license_number),
        });
      } else {
        dispatch({ type: "NOTIFY", payload: { message: "AI generation failed — try again", type: "error" } });
      }
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to generate quote", type: "error" } });
    } finally {
      setGenerating(false);
    }
  };

  const recalcTotal = (fields) => {
    const hours = parseFloat(fields.labourHours) || 0;
    const rate = parseFloat(business.hourly_rate) || 0;
    const matCost = parseFloat(fields.materialsCost) || 0;
    const callout = fields.includeCallout ? (parseFloat(business.callout_fee) || 0) : 0;
    return String(Math.round((matCost + (hours * rate) + callout) * 100) / 100);
  };

  const updatePricing = (key, val) => {
    setEditForm(prev => {
      const updated = { ...prev, [key]: val };
      updated.amount = recalcTotal(updated);
      return updated;
    });
  };

  const sendQuote = async () => {
    if (!editForm.amount || !form.customerEmail) {
      dispatch({ type: "NOTIFY", payload: { message: "Please set an amount and customer email", type: "error" } });
      return;
    }
    setSending(true);
    try {
      const seqId = sequences.find(s => s.is_default)?.id || sequences[0]?.id || null;
      let nextFollowUp = null;
      if (seqId) {
        const { data: seqSteps } = await db("sequence_steps").eq("sequence_id", seqId).order("step_order").limit(1).select();
        if (seqSteps && seqSteps[0]) { const d = new Date(); d.setDate(d.getDate() + seqSteps[0].delay_days); nextFollowUp = d.toISOString(); }
      }
      const breakdown = {
        scope: editForm.scope,
        materials: editForm.materials,
        materialsCost: editForm.materialsCost,
        labourHours: editForm.labourHours,
        labourRate: business.hourly_rate,
        includeCallout: editForm.includeCallout,
        calloutFee: business.callout_fee,
        showBreakdown: editForm.showBreakdown,
        showBusinessDetails: editForm.showBusinessDetails,
        notes: editForm.notes,
      };
      const { data: newQuote, error: quoteErr } = await db("quotes").insert({
        business_id: business.id, quote_number: "", customer_name: form.customerName,
        customer_email: form.customerEmail, customer_phone: form.customerPhone,
        job_title: form.jobTitle, description: editForm.scope + (editForm.materials ? "\n\nMaterials:\n" + editForm.materials : "") + (editForm.notes ? "\n\nNotes:\n" + editForm.notes : ""),
        amount: parseFloat(editForm.amount), status: "sent", sent_at: new Date().toISOString(),
        sequence_id: seqId, next_follow_up_at: nextFollowUp, current_step: 0, follow_up_paused: false,
        ai_estimate: parseFloat(editForm.amount), ai_estimate_notes: JSON.stringify(breakdown),
      });
      if (quoteErr) throw new Error("Failed to create quote");
      await fetch("https://wynfallautomation.app.n8n.cloud/webhook/send-quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_id: newQuote[0].id, breakdown }),
      });
      dispatch({ type: "ADD_QUOTE", payload: newQuote[0] });
      dispatch({ type: "NOTIFY", payload: { message: `Quote sent to ${form.customerName}! Follow-ups scheduled.`, type: "success" } });
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: err.message, type: "error" } });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: isMobile ? 16 : 24 }}>
        <span onClick={() => dispatch({ type: "GO_BACK" })} style={{ fontSize: 14, color: theme.textMuted, cursor: "pointer" }}>← Back</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(20,184,166,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><Cpu size={18} color="#14B8A6" /></div>
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>AI Quote Generator</h1>
        </div>
      </div>

      {!generated ? (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 24 }}>
          <Card style={isMobile ? { padding: 16 } : {}}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, margin: "0 0 12px" }}>Customer Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Input label="Customer Name *" value={form.customerName} onChange={v => update("customerName", v)} />
              <Input label="Email *" value={form.customerEmail} onChange={v => update("customerEmail", v)} type="email" />
              <Input label="Phone *" value={form.customerPhone} onChange={v => update("customerPhone", v)} />
            </div>
          </Card>
          <Card style={isMobile ? { padding: 16 } : {}}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, margin: "0 0 12px" }}>Job Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Input label="Job Title *" value={form.jobTitle} onChange={v => update("jobTitle", v)} placeholder="e.g. Fix leaking tap, bathroom reno" />
              <Input label="Description" value={form.description} onChange={v => update("description", v)} textarea placeholder="What needs doing?" />
              <Input label="Your Site Notes" value={siteNotes} onChange={setSiteNotes} textarea placeholder="e.g. Access is tight, old pipework, customer wants premium..." />
            </div>
          </Card>
          <Card style={{ ...(isMobile ? { padding: 16 } : {}), gridColumn: "1 / -1" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, margin: "0 0 8px" }}>Site Photos</h3>
            <p style={{ fontSize: 12, color: theme.textDim, margin: "0 0 12px" }}>Photos help AI generate more accurate quotes with specific materials and quantities</p>
            {photoPreviews.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {photoPreviews.map((src, i) => (
                  <div key={i} style={{ position: "relative", width: 80, height: 80, borderRadius: 8, overflow: "hidden", border: `1px solid ${theme.border}` }}>
                    <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, borderRadius: 10, background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                ))}
              </div>
            )}
            {photos.length < 5 && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: `1px dashed ${theme.border}`, cursor: "pointer", color: theme.textMuted, fontSize: 13 }}>
                <Upload size={16} /> Add Photos
                <input type="file" accept="image/*" multiple onChange={handlePhotoAdd} style={{ display: "none" }} />
              </label>
            )}
          </Card>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => dispatch({ type: "GO_BACK" })}>Cancel</Button>
            <Button onClick={generateQuote} disabled={generating} style={{ background: "#14B8A6", padding: "14px 32px" }}>
              <Cpu size={16} /> {generating ? "AI is generating..." : "Generate Quote"}
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 24 }}>
          <Card style={{ gridColumn: "1 / -1", background: "rgba(20,184,166,0.04)", border: "1px solid rgba(20,184,166,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <CheckCircle2 size={16} color={theme.green} />
              <span style={{ fontSize: 14, fontWeight: 600, color: theme.green }}>Quote Generated for {form.customerName}</span>
              {generated.confidence && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, marginLeft: 8,
                  color: generated.confidence === "high" ? theme.green : generated.confidence === "medium" ? "#F59E0B" : theme.red,
                  background: (generated.confidence === "high" ? theme.green : generated.confidence === "medium" ? "#F59E0B" : theme.red) + "18",
                }}>{generated.confidence.charAt(0).toUpperCase() + generated.confidence.slice(1)} Confidence</span>
              )}
            </div>
            <p style={{ fontSize: 12, color: theme.textMuted }}>Review and edit below, then send to your customer</p>
          </Card>
          <Card style={isMobile ? { padding: 16 } : {}}>
            <Input label="Scope of Work" value={editForm.scope} onChange={v => setEditForm(prev => ({ ...prev, scope: v }))} textarea />
            <div style={{ marginTop: 12 }}><Input label="Materials Description" value={editForm.materials} onChange={v => setEditForm(prev => ({ ...prev, materials: v }))} textarea /></div>
          </Card>
          <Card style={isMobile ? { padding: 16 } : {}}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: theme.text, margin: 0 }}>Pricing Breakdown</h3>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: theme.textMuted }}>
                <input type="checkbox" checked={editForm.showBreakdown} onChange={e => { const c = e.target.checked; setEditForm(prev => ({ ...prev, showBreakdown: c })); }} style={{ accentColor: theme.accent }} />
                Show on invoice
              </label>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {editForm.showBreakdown && (<>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}><Input label="Materials Cost ($)" value={editForm.materialsCost} onChange={v => updatePricing("materialsCost", v)} type="number" /></div>
                <div style={{ flex: 1 }}><Input label="Labour Hours" value={editForm.labourHours} onChange={v => updatePricing("labourHours", v)} type="number" /></div>
              </div>
              {business.hourly_rate && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: -4 }}>Labour: {editForm.labourHours || 0} hrs × ${business.hourly_rate}/hr = ${((parseFloat(editForm.labourHours) || 0) * parseFloat(business.hourly_rate)).toLocaleString()}</div>}
              {parseFloat(business.callout_fee) > 0 && (
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: theme.textMuted }}>
                  <input type="checkbox" checked={editForm.includeCallout} onChange={e => updatePricing("includeCallout", e.target.checked)} style={{ accentColor: theme.accent }} />
                  Include callout fee (${parseFloat(business.callout_fee).toLocaleString()})
                </label>
              )}
              </>)}
              <div style={{ borderTop: editForm.showBreakdown ? `1px solid ${theme.border}` : "none", paddingTop: editForm.showBreakdown ? 10 : 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>Total (incl. GST)</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: theme.accent }}>${parseFloat(editForm.amount || 0).toLocaleString()}</span>
              </div>
              <div style={{ marginTop: -4 }}><Input label="Override Total ($)" value={editForm.amount} onChange={v => setEditForm(prev => ({ ...prev, amount: v }))} type="number" /></div>
            </div>
            <div style={{ marginTop: 12 }}><Input label="Notes / Terms" value={editForm.notes} onChange={v => setEditForm(prev => ({ ...prev, notes: v }))} textarea placeholder="e.g. Valid for 30 days, 25% deposit required..." /></div>
            <div style={{ marginTop: 12 }}><Input label="Customer Email *" value={form.customerEmail} onChange={v => update("customerEmail", v)} type="email" /></div>
            {(business.address || business.gst_number || business.license_number || business.quote_footer) && (
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: theme.surfaceLight, border: `1px solid ${theme.border}` }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={editForm.showBusinessDetails} onChange={e => { const c = e.target.checked; setEditForm(prev => ({ ...prev, showBusinessDetails: c })); }} style={{ accentColor: theme.accent }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: theme.text }}>Show business details on quote</div>
                    <div style={{ fontSize: 11, color: theme.textDim }}>Address, GST, license number, custom footer</div>
                  </div>
                </label>
              </div>
            )}
          </Card>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => { setGenerated(null); setEditForm(null); }}>Regenerate</Button>
            <Button variant="secondary" onClick={() => setShowPreview(true)}><FileText size={16} /> Preview</Button>
            <Button onClick={sendQuote} disabled={sending} style={{ padding: "14px 32px" }}>
              <Send size={16} /> {sending ? "Sending..." : "Send Quote to " + form.customerName.split(" ")[0]}
            </Button>
          </div>
        </div>
      )}
      {showPreview && <QuotePreview />}
    </div>
  );
};

// ─── Manual Quote Form ───
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
    if (!form.customerName || !form.customerEmail || !form.customerPhone || !form.jobTitle || !form.amount) {
      dispatch({ type: "NOTIFY", payload: { message: "Please fill in all required fields (name, email, phone, job title, and amount)", type: "error" } });
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
        customer_phone: form.customerPhone,
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
      <div style={{ marginBottom: isMobile ? 16 : 32 }}>
        <span onClick={() => dispatch({ type: "GO_BACK" })}
          style={{ fontSize: 14, color: theme.textMuted, cursor: "pointer" }}>← Back</span>
        <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: theme.text, margin: "8px 0 0", fontFamily: theme.fontDisplay }}>Manual Quote</h1>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 24 }}>
        <Card style={isMobile ? { padding: 16 } : {}}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, margin: "0 0 12px" }}>Customer Details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input label="Customer Name *" value={form.customerName} onChange={(v) => update("customerName", v)} />
            <Input label="Email *" value={form.customerEmail} onChange={(v) => update("customerEmail", v)} type="email" />
            <Input label="Phone *" value={form.customerPhone} onChange={(v) => update("customerPhone", v)} />
          </div>
        </Card>
        <Card style={isMobile ? { padding: 16 } : {}}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, margin: "0 0 12px" }}>Job Details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input label="Job Title *" value={form.jobTitle} onChange={(v) => update("jobTitle", v)} />
            <Input label="Description" value={form.description} onChange={(v) => update("description", v)} textarea />
            <Input label="Quote Amount ($) *" value={form.amount} onChange={(v) => update("amount", v)} type="number" />
          </div>
        </Card>
        <Card style={isMobile ? { padding: 16 } : {}}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, margin: "0 0 10px" }}>Quote File</h3>
          <Input label="Upload File" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onFileChange={(e) => setPdfFile(e.target.files[0])} />
          {pdfFile && (
            <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: theme.greenSoft, color: theme.green, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Paperclip size={12} /> {pdfFile.name}
            </div>
          )}
        </Card>
        <Card style={isMobile ? { padding: 16 } : {}}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, margin: "0 0 10px" }}>Follow-Up Sequence</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {sequences.map((seq) => (
              <div key={seq.id} onClick={() => update("sequenceId", seq.id)}
                style={{
                  padding: "10px 16px", borderRadius: 10, cursor: "pointer",
                  background: form.sequenceId === seq.id ? theme.accentSoft : theme.surfaceLight,
                  border: `1px solid ${form.sequenceId === seq.id ? theme.accent + "44" : theme.border}`,
                }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: form.sequenceId === seq.id ? theme.accent : theme.text }}>{seq.name}</div>
              </div>
            ))}
            <div onClick={() => update("sequenceId", "")}
              style={{
                padding: "10px 16px", borderRadius: 10, cursor: "pointer",
                background: !form.sequenceId ? theme.redSoft : theme.surfaceLight,
                border: `1px solid ${!form.sequenceId ? theme.red + "44" : theme.border}`,
              }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: !form.sequenceId ? theme.red : theme.text }}>No Follow-Up</div>
            </div>
          </div>
        </Card>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: isMobile ? 16 : 24, justifyContent: "flex-end" }}>
        <Button variant="secondary" onClick={() => dispatch({ type: "SET_SCREEN", payload: "quotes" })}>Cancel</Button>
        <Button onClick={handleCreate} disabled={loading}>
          {loading ? "Sending..." : isMobile ? "Send Quote →" : "Send Quote & Start Follow-Ups →"}
        </Button>
      </div>
    </div>
  );
};

// ─── AI Quote Generator ───
const QuoteGenerator = ({ quote, business, dispatch, sequences, quotes }) => {
  const isMobile = useIsMobile();
  const [sitePhotos, setSitePhotos] = useState([]);
  const [sitePhotoPreviews, setSitePhotoPreviews] = useState([]);
  const [siteNotes, setSiteNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [sending, setSending] = useState(false);

  const handlePhotoAdd = (e) => {
    const files = Array.from(e.target.files).slice(0, 5 - sitePhotos.length);
    setSitePhotos(prev => [...prev, ...files]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => setSitePhotoPreviews(prev => [...prev, ev.target.result]);
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index) => {
    setSitePhotos(prev => prev.filter((_, i) => i !== index));
    setSitePhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const compressImage = (file, maxSize = 1200) => new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  const generateQuote = async () => {
    setGenerating(true);
    try {
      const photoData = [];
      for (const photo of sitePhotos) {
        const compressed = await compressImage(photo);
        photoData.push({ name: photo.name, type: "image/jpeg", data: compressed });
      }
      // Also include customer's original photos if they're base64
      const customerPhotos = (quote.photos || []).filter(p => typeof p === "string" && p.startsWith("data:")).map((p, i) => ({ name: `customer-${i}.jpg`, type: "image/jpeg", data: p }));

      // Build recent quote history for AI learning (last 20 sent/accepted quotes)
      const quoteHistory = (quotes || [])
        .filter(q => ["sent", "accepted", "booked", "opened"].includes(q.status) && q.amount && q.id !== quote.id)
        .slice(0, 20)
        .map(q => ({ job_title: q.job_title, description: q.description, amount: q.amount, status: q.status }));
      const res = await fetch("https://wynfallautomation.app.n8n.cloud/webhook/generate-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_id: quote.id,
          business_id: business.id,
          job_title: quote.job_title,
          description: quote.description,
          customer_name: quote.customer_name,
          site_notes: siteNotes,
          site_photos: photoData,
          customer_photos: customerPhotos,
          trade: business.trade,
          trade_category: business.trade_category,
          hourly_rate: business.hourly_rate,
          callout_fee: business.callout_fee,
          price_list: business.price_list || [],
          quote_history: quoteHistory,
        }),
      });
      const result = await res.json();
      if (result.quote) {
        setGenerated(result.quote);
        const hours = parseFloat(result.quote.estimated_hours) || 0;
        const rate = parseFloat(business.hourly_rate) || 0;
        const total = parseFloat(result.quote.total) || 0;
        const labourCost = hours * rate;
        const callout = parseFloat(business.callout_fee) || 0;
        const matCost = Math.max(0, total - labourCost - callout);
        setEditForm({
          scope: result.quote.scope_of_work || "",
          materials: result.quote.materials_breakdown || "",
          labourHours: result.quote.estimated_hours || "",
          materialsCost: matCost ? String(Math.round(matCost * 100) / 100) : "",
          amount: result.quote.total || "",
          notes: result.quote.notes || "",
          showBreakdown: true,
          includeCallout: parseFloat(business.callout_fee) > 0,
          showBusinessDetails: !!(business.address || business.gst_number || business.license_number),
        });
      } else {
        dispatch({ type: "NOTIFY", payload: { message: "AI generation failed — try again", type: "error" } });
      }
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to generate quote", type: "error" } });
    } finally {
      setGenerating(false);
    }
  };

  const recalcTotal = (fields) => {
    const hours = parseFloat(fields.labourHours) || 0;
    const rate = parseFloat(business.hourly_rate) || 0;
    const matCost = parseFloat(fields.materialsCost) || 0;
    const callout = fields.includeCallout ? (parseFloat(business.callout_fee) || 0) : 0;
    return String(Math.round((matCost + (hours * rate) + callout) * 100) / 100);
  };

  const updatePricing = (key, val) => {
    setEditForm(prev => {
      const updated = { ...prev, [key]: val };
      updated.amount = recalcTotal(updated);
      return updated;
    });
  };

  const sendQuote = async () => {
    if (!editForm.amount) {
      dispatch({ type: "NOTIFY", payload: { message: "Please set a quote amount", type: "error" } });
      return;
    }
    setSending(true);
    try {
      const seqId = sequences.find(s => s.is_default)?.id || sequences[0]?.id || null;
      let nextFollowUp = null;
      if (seqId) {
        const { data: seqSteps } = await db("sequence_steps").eq("sequence_id", seqId).order("step_order").limit(1).select();
        if (seqSteps && seqSteps[0]) {
          const d = new Date();
          d.setDate(d.getDate() + seqSteps[0].delay_days);
          nextFollowUp = d.toISOString();
        }
      }
      const breakdown = {
        scope: editForm.scope,
        materials: editForm.materials,
        materialsCost: editForm.materialsCost,
        labourHours: editForm.labourHours,
        labourRate: business.hourly_rate,
        includeCallout: editForm.includeCallout,
        calloutFee: business.callout_fee,
        showBreakdown: editForm.showBreakdown,
        showBusinessDetails: editForm.showBusinessDetails,
        notes: editForm.notes,
      };
      await db("quotes").eq("id", quote.id).update({
        amount: parseFloat(editForm.amount),
        description: editForm.scope + (editForm.materials ? "\n\nMaterials:\n" + editForm.materials : "") + (editForm.notes ? "\n\nNotes:\n" + editForm.notes : ""),
        status: "sent",
        sent_at: new Date().toISOString(),
        sequence_id: seqId,
        next_follow_up_at: nextFollowUp,
        current_step: 0,
        follow_up_paused: false,
        ai_estimate: parseFloat(editForm.amount), ai_estimate_notes: JSON.stringify(breakdown),
      });
      await fetch("https://wynfallautomation.app.n8n.cloud/webhook/send-quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_id: quote.id, breakdown }),
      });
      dispatch({ type: "UPDATE_QUOTE", payload: { id: quote.id, amount: parseFloat(editForm.amount), status: "sent", sent_at: new Date().toISOString() } });
      dispatch({ type: "NOTIFY", payload: { message: `Quote sent to ${quote.customer_name}! Follow-ups scheduled.`, type: "success" } });
      dispatch({ type: "GO_BACK" });
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to send quote", type: "error" } });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card style={{ gridColumn: "1 / -1", border: `2px solid #14B8A6`, background: "rgba(20,184,166,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(20,184,166,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Cpu size={20} color="#14B8A6" />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: 0 }}>AI Quote Generator</h3>
          <p style={{ fontSize: 12, color: theme.textMuted, margin: 0 }}>Generate a professional quote from photos and job details</p>
        </div>
      </div>

      {!generated ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: theme.textMuted, marginBottom: 8 }}>Your site photos (optional)</div>
            <p style={{ fontSize: 12, color: theme.textDim, margin: "0 0 10px" }}>Add your own photos from the job site for a more accurate quote</p>
            {sitePhotoPreviews.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {sitePhotoPreviews.map((src, i) => (
                  <div key={i} style={{ position: "relative", width: 72, height: 72, borderRadius: 8, overflow: "hidden", border: `1px solid ${theme.border}` }}>
                    <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, borderRadius: 10, background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                ))}
              </div>
            )}
            {sitePhotos.length < 5 && (
              <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 16px", borderRadius: 10, border: `1px dashed ${theme.border}`, cursor: "pointer", color: theme.textMuted, fontSize: 13 }}>
                <Upload size={16} /> Add Site Photos
                <input type="file" accept="image/*" multiple onChange={handlePhotoAdd} style={{ display: "none" }} />
              </label>
            )}
          </div>
          <Input label="Site notes (optional)" value={siteNotes} onChange={setSiteNotes} textarea placeholder="e.g. Access is tight, need to replace the whole unit, customer wants premium fixtures..." />
          <Button onClick={generateQuote} disabled={generating} style={{ background: "#14B8A6", justifyContent: "center", padding: "14px 24px" }}>
            <Cpu size={16} /> {generating ? "AI is generating your quote..." : "Generate Quote"}
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: 16, borderRadius: 10, background: theme.surfaceLight, border: `1px solid ${theme.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <CheckCircle2 size={16} color={theme.green} />
              <span style={{ fontSize: 13, fontWeight: 600, color: theme.green }}>Quote Generated</span>
            </div>
            {generated.confidence && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                color: generated.confidence === "high" ? theme.green : generated.confidence === "medium" ? "#F59E0B" : theme.red,
                background: (generated.confidence === "high" ? theme.green : generated.confidence === "medium" ? "#F59E0B" : theme.red) + "18",
              }}>{generated.confidence.charAt(0).toUpperCase() + generated.confidence.slice(1)} Confidence</span>
            )}
          </div>

          <Input label="Scope of Work" value={editForm.scope} onChange={v => setEditForm(prev => ({ ...prev, scope: v }))} textarea />
          <Input label="Materials Description" value={editForm.materials} onChange={v => setEditForm(prev => ({ ...prev, materials: v }))} textarea />
          <div style={{ padding: 14, borderRadius: 10, background: theme.surfaceLight, border: `1px solid ${theme.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>Pricing Breakdown</div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: theme.textMuted }}>
                <input type="checkbox" checked={editForm.showBreakdown} onChange={e => { const c = e.target.checked; setEditForm(prev => ({ ...prev, showBreakdown: c })); }} style={{ accentColor: theme.accent }} />
                Show on invoice
              </label>
            </div>
            {editForm.showBreakdown && (<>
            <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
              <div style={{ flex: 1 }}><Input label="Materials Cost ($)" value={editForm.materialsCost} onChange={v => updatePricing("materialsCost", v)} type="number" /></div>
              <div style={{ flex: 1 }}><Input label="Labour Hours" value={editForm.labourHours} onChange={v => updatePricing("labourHours", v)} type="number" /></div>
            </div>
            {business.hourly_rate && <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>Labour: {editForm.labourHours || 0} hrs × ${business.hourly_rate}/hr = ${((parseFloat(editForm.labourHours) || 0) * parseFloat(business.hourly_rate)).toLocaleString()}</div>}
            {parseFloat(business.callout_fee) > 0 && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>
                <input type="checkbox" checked={editForm.includeCallout} onChange={e => updatePricing("includeCallout", e.target.checked)} style={{ accentColor: theme.accent }} />
                Include callout fee (${parseFloat(business.callout_fee).toLocaleString()})
              </label>
            )}
            </>)}
            <div style={{ borderTop: editForm.showBreakdown ? `1px solid ${theme.border}` : "none", paddingTop: editForm.showBreakdown ? 10 : 0, marginTop: editForm.showBreakdown ? 8 : 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>Total (incl. GST)</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: theme.accent }}>${parseFloat(editForm.amount || 0).toLocaleString()}</span>
            </div>
            <div style={{ marginTop: 8 }}><Input label="Override Total ($)" value={editForm.amount} onChange={v => setEditForm(prev => ({ ...prev, amount: v }))} type="number" /></div>
          </div>
          <Input label="Additional Notes" value={editForm.notes} onChange={v => setEditForm(prev => ({ ...prev, notes: v }))} textarea placeholder="Any terms, conditions, or notes for the customer" />

          {(business.address || business.gst_number || business.license_number || business.quote_footer) && (
            <div style={{ padding: "12px 14px", borderRadius: 10, background: theme.surfaceLight, border: `1px solid ${theme.border}` }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={editForm.showBusinessDetails} onChange={e => { const c = e.target.checked; setEditForm(prev => ({ ...prev, showBusinessDetails: c })); }} style={{ accentColor: theme.accent }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: theme.text }}>Show business details on quote</div>
                  <div style={{ fontSize: 11, color: theme.textDim }}>Address, GST, license number, custom footer</div>
                </div>
              </label>
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <Button variant="secondary" onClick={() => { setGenerated(null); setEditForm(null); }} style={{ flex: 1, justifyContent: "center" }}>
              Regenerate
            </Button>
            <Button onClick={sendQuote} disabled={sending} style={{ flex: 2, justifyContent: "center", padding: "14px 24px" }}>
              <Send size={16} /> {sending ? "Sending..." : "Send Quote to " + quote.customer_name.split(" ")[0]}
            </Button>
          </div>
        </div>
      )}
    </Card>
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
    const { error } = await db("quotes").eq("id", quote.id).update(updates);
    if (error) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to update — try again", type: "error" } });
      return;
    }
    dispatch({ type: "UPDATE_QUOTE", payload: { id: quote.id, ...updates } });
    const messages = {
      accepted: "Quote marked as accepted — now call and book it in!",
      booked: "Job booked! Nice one.",
      declined: "Quote marked as declined",
    };
    dispatch({ type: "NOTIFY", payload: { message: messages[status] || `Quote marked as ${status}`, type: "success" } });
    if (status === "booked" || status === "declined") {
      setTimeout(() => dispatch({ type: "GO_BACK" }), 300);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: isMobile ? 16 : 32 }}>
        <span onClick={() => dispatch({ type: "GO_BACK" })}
          style={{ fontSize: 13, color: theme.textMuted, cursor: "pointer", display: "block", marginBottom: 6 }}>← Back</span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 8 : 0 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 20 : 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>{quote.job_title}</h1>
            <p style={{ fontSize: isMobile ? 12 : 14, color: theme.textMuted, margin: "4px 0 0" }}>Quote {quote.quote_number} • {new Date(quote.created_at).toLocaleDateString()}{quote.sent_at ? ` • Sent ${new Date(quote.sent_at).toLocaleDateString()}` : ""}</p>
          </div>
          <Badge status={quote.status} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 24 }}>
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
            {quote.ai_estimate && (
              <div style={{ padding: 16, borderRadius: 10, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: "#14B8A6", fontWeight: 600 }}>AI Estimate</div>
                  {quote.ai_estimate_notes && (() => {
                    const notes = quote.ai_estimate_notes || "";
                    const isHigh = notes.startsWith("HIGH");
                    const isMed = notes.startsWith("MEDIUM");
                    const color = isHigh ? theme.green : isMed ? "#F59E0B" : theme.red;
                    const label = isHigh ? "High Confidence" : isMed ? "Medium Confidence" : notes.startsWith("LOW") ? "Low Confidence" : null;
                    return label ? <span style={{ fontSize: 11, fontWeight: 600, color, padding: "3px 8px", borderRadius: 6, background: color + "18" }}>{label}</span> : null;
                  })()}
                </div>
                <div style={{ fontSize: 22, color: "#14B8A6", fontWeight: 700 }}>
                  ${quote.ai_estimate_range_low?.toLocaleString()} — ${quote.ai_estimate_range_high?.toLocaleString()}
                </div>
                {quote.ai_estimate_notes && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 8, lineHeight: 1.5 }}>{quote.ai_estimate_notes.replace(/^(HIGH|MEDIUM|LOW) CONFIDENCE: /i, "")}</div>}
              </div>
            )}
            {quote.description && <div><div style={{ fontSize: 12, color: theme.textMuted }}>Description</div><div style={{ fontSize: 14, color: theme.text, lineHeight: 1.5 }}>{quote.description}</div></div>}
            {quote.photos && quote.photos.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8 }}>Customer Photos</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {quote.photos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener" style={{ display: "block", width: 80, height: 80, borderRadius: 8, overflow: "hidden", border: `1px solid ${theme.border}` }}>
                      <img src={url} alt={`Photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </a>
                  ))}
                </div>
              </div>
            )}
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
        {quote.status === "declined" && (
        <Card style={{ gridColumn: "1 / -1", background: theme.redSoft, border: `1px solid ${theme.red}33` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: quote.decline_reason ? 16 : 0 }}>
            <XCircle size={24} color={theme.red} />
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.red, margin: 0 }}>Quote Declined</h3>
              <p style={{ fontSize: 13, color: theme.textMuted, margin: "4px 0 0" }}>
                {quote.responded_at ? `Declined on ${new Date(quote.responded_at).toLocaleDateString()}` : "This quote was declined."}
              </p>
            </div>
          </div>
          {quote.decline_reason && (
            <div style={{ padding: 16, borderRadius: 10, background: theme.surfaceLight, marginTop: 8 }}>
              <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>Reason</div>
              <div style={{ fontSize: 14, color: theme.text, fontWeight: 500 }}>{quote.decline_reason}</div>
              {quote.decline_comment && (
                <>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6, marginTop: 12 }}>Comment</div>
                  <div style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.5, fontStyle: "italic" }}>"{quote.decline_comment}"</div>
                </>
              )}
            </div>
          )}
        </Card>
        )}
        {quote.status !== "accepted" && quote.status !== "declined" && quote.status !== "booked" && quote.status !== "requested" && (
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
        {quote.status === "requested" && (
        <QuoteGenerator quote={quote} business={business} dispatch={dispatch} sequences={sequences} quotes={quotes} />
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
    try {
      const { data } = await db("sequence_steps").eq("sequence_id", seqId).order("step_order").select();
      setSteps((prev) => ({ ...prev, [seqId]: data || [] }));
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to load sequence steps", type: "error" } });
    }
  };

  useEffect(() => {
    sequences.forEach((s) => loadSteps(s.id));
  }, [sequences.length]);

  const toggleSequence = async (seq) => {
    try {
      const { error } = await db("follow_up_sequences").eq("id", seq.id).update({ is_active: !seq.is_active });
      if (error) throw error;
      dispatch({ type: "UPDATE_SEQUENCE", payload: { id: seq.id, is_active: !seq.is_active } });
      dispatch({ type: "NOTIFY", payload: { message: seq.is_active ? "Sequence paused" : "Sequence activated!", type: "success" } });
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to update sequence", type: "error" } });
    }
  };

  const startEdit = (step) => {
    setEditingStep(step.id);
    setEditForm({ delay_days: step.delay_days, email_subject: step.email_subject, email_body: step.email_body });
    setAdding(null);
  };

  const saveEdit = async (stepId) => {
    if (!editForm.email_body.includes("{name}")) {
      dispatch({ type: "NOTIFY", payload: { message: "Email body must include {name} — click the tag below to re-add it", type: "error" } });
      return;
    }
    setSaving(true);
    try {
      const { error } = await db("sequence_steps").eq("id", stepId).update({
        delay_days: parseInt(editForm.delay_days),
        email_subject: editForm.email_subject,
        email_body: editForm.email_body,
      });
      if (error) throw error;
      const seqId = Object.keys(steps).find(k => steps[k].some(s => s.id === stepId));
      if (seqId) {
        setSteps(prev => ({
          ...prev,
          [seqId]: prev[seqId].map(s => s.id === stepId ? { ...s, ...editForm, delay_days: parseInt(editForm.delay_days) } : s)
        }));
      }
      setEditingStep(null);
      dispatch({ type: "NOTIFY", payload: { message: "Step updated!", type: "success" } });
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to save step", type: "error" } });
    }
    setSaving(false);
  };

  const insertPlaceholder = (field, tag) => {
    if (field === "subject") {
      setEditForm(prev => ({ ...prev, email_subject: prev.email_subject + tag }));
    } else if (field === "body") {
      setEditForm(prev => ({ ...prev, email_body: prev.email_body + tag }));
    } else if (field === "new_subject") {
      setNewStep(prev => ({ ...prev, subject: prev.subject + tag }));
    } else if (field === "new_body") {
      setNewStep(prev => ({ ...prev, body: prev.body + tag }));
    }
  };

  const PlaceholderButtons = ({ field }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
      {["{name}", "{job}", "{amount}", "{business_name}"].map(tag => (
        <button key={tag} onClick={() => insertPlaceholder(field, tag)}
          style={{ padding: "3px 8px", borderRadius: 4, fontSize: 11, fontFamily: "monospace", background: theme.accentSoft, color: theme.accent, border: "none", cursor: "pointer" }}>
          + {tag}
        </button>
      ))}
    </div>
  );

  const deleteStep = async (seqId, stepId) => {
    try {
      const { error } = await db("sequence_steps").eq("id", stepId).delete();
      if (error) throw error;
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
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to delete step", type: "error" } });
    }
  };

  const moveStep = async (seqId, index, direction) => {
    const current = [...(steps[seqId] || [])];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= current.length) return;
    [current[index], current[newIndex]] = [current[newIndex], current[index]];
    try {
      for (let i = 0; i < current.length; i++) {
        current[i].step_order = i + 1;
        await db("sequence_steps").eq("id", current[i].id).update({ step_order: i + 1 });
      }
      setSteps(prev => ({ ...prev, [seqId]: current }));
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to reorder steps", type: "error" } });
      loadSteps(seqId); // reload to get correct order from DB
    }
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
    try {
      const { data, error } = await db("sequence_steps").insert({
        sequence_id: seqId,
        step_order: currentSteps.length + 1,
        delay_days: parseInt(newStep.delay),
        email_subject: newStep.subject,
        email_body: newStep.body,
      });
      if (error) throw error;
      if (data) {
        setSteps(prev => ({ ...prev, [seqId]: [...(prev[seqId] || []), data[0]] }));
        setNewStep({ delay: "", subject: "", body: "" });
        setAdding(null);
        dispatch({ type: "NOTIFY", payload: { message: "Step added!", type: "success" } });
      }
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to add step", type: "error" } });
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
      <div style={{ marginBottom: isMobile ? 16 : 32 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>Follow-Up Sequences</h1>
        <p style={{ fontSize: isMobile ? 13 : 14, color: theme.textMuted, margin: "4px 0 0" }}>Customise the automated emails that chase your quotes. Up to {MAX_STEPS} steps per sequence.</p>
      </div>

      <Card style={{ marginBottom: 24, padding: isMobile ? 16 : 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, margin: "0 0 12px" }}>How Follow-Ups Work</h3>
        <p style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.7, margin: "0 0 16px" }}>
          When you send a quote, Wynflow automatically sends follow-up emails if the customer doesn't respond.
          Each step below is one email in the sequence — you control the timing and the message.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: theme.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 700, color: theme.accent }}>1</div>
            <p style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.6, margin: 0 }}><strong style={{ color: theme.text }}>Delay</strong> — how many days after the previous email to send this one. E.g. "2 days" means the customer gets this email 2 days after the quote was sent (or 2 days after the last follow-up).</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: theme.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 700, color: theme.accent }}>2</div>
            <p style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.6, margin: 0 }}><strong style={{ color: theme.text }}>Subject & Body</strong> — write your email message. Use the placeholder buttons to insert customer details that get filled in automatically.</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: theme.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 700, color: theme.accent }}>3</div>
            <p style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.6, margin: 0 }}><strong style={{ color: theme.text }}>Placeholders</strong> — these are the tags like <code style={{ padding: "1px 5px", borderRadius: 3, background: theme.accentSoft, color: theme.accent, fontSize: 12, fontFamily: "monospace" }}>{"{name}"}</code> that automatically become the customer's first name, <code style={{ padding: "1px 5px", borderRadius: 3, background: theme.accentSoft, color: theme.accent, fontSize: 12, fontFamily: "monospace" }}>{"{job}"}</code> becomes the job title, and so on. Click the buttons below each field to insert them.</p>
          </div>
        </div>
        <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: theme.surfaceLight, border: `1px solid ${theme.border}` }}>
          <p style={{ fontSize: 12, color: theme.textDim, margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: theme.textMuted }}>Example:</strong> If your email says "Hi {"{name}"}, just following up on {"{job}"}" and the customer is Kim with a Bathroom Reno quote — they'll receive "Hi Kim, just following up on Bathroom Reno".
          </p>
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
                          <div style={{ flex: 1 }}>
                            <Input label="Subject Line" value={editForm.email_subject} onChange={v => setEditForm({ ...editForm, email_subject: v })} />
                            <PlaceholderButtons field="subject" />
                          </div>
                        </div>
                        <div>
                          <Input label="Email Body" value={editForm.email_body} onChange={v => setEditForm({ ...editForm, email_body: v })} textarea />
                          <PlaceholderButtons field="body" />
                        </div>
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
                      <div style={{ flex: 1 }}>
                        <Input label="Subject Line" value={newStep.subject} onChange={v => setNewStep({ ...newStep, subject: v })} placeholder="e.g. Following up on your quote for {job}" />
                        <PlaceholderButtons field="new_subject" />
                      </div>
                    </div>
                    <div>
                      <Input label="Email Body" value={newStep.body} onChange={v => setNewStep({ ...newStep, body: v })} textarea placeholder="e.g. Hi {name}, just checking in on the quote for {job}. Cheers, {business_name}" />
                      <PlaceholderButtons field="new_body" />
                    </div>
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
// ─── Help Centre ───
const HELP_ARTICLES = [
  { category: "Getting Started", items: [
    { q: "What is Wynflow and why should I use it?", a: "Wynflow is a quote management tool built for NZ trades and service businesses. When you send a quote, most customers don't respond straight away — research shows 80% of deals need 5+ follow-ups. Wynflow automates that entire process so you're not spending your evenings chasing emails." },
    { q: "How do I send my first quote?", a: "Click 'AI Quote' on your Dashboard to generate a quote from photos and job details, or 'Manual Quote' to enter everything yourself. Add your customer's name, email, job title, and amount. Attach a PDF if you have one, choose your follow-up sequence, and hit send. Your customer gets a branded email with an 'Accept Quote' button within seconds." },
    { q: "What does the customer actually see?", a: "They receive a clean email from your business name with the job details, amount, and your PDF attached. There's a big green 'Accept Quote' button and a subtle 'No thanks' link underneath. No clutter, no confusion — just a simple way to respond." },
    { q: "Do I need to install anything?", a: "No. Wynflow runs entirely in your browser — just log in at wynflow.co.nz from your phone, tablet, or computer. There's nothing to download or install." },
  ]},
  { category: "How Quotes Work", items: [
    { q: "What happens after I send a quote?", a: "Your customer gets the email immediately. If they accept, you get notified and the quote moves to 'Accepted' — you'll see an amber alert reminding you to call and book the job. If they don't respond, Wynflow starts sending your follow-up emails automatically based on your schedule." },
    { q: "What are the different quote statuses?", a: "Sent means it's been emailed and waiting for a response. Accepted means the customer clicked Accept — you need to call them and book the job. Booked means you've confirmed it. Declined means they said no and gave you feedback on why." },
    { q: "How do I mark a quote as booked?", a: "Open the accepted quote and click 'Mark as Booked'. This confirms you've spoken to the customer and locked in the job. It moves from Accepted to Booked in your pipeline and updates your revenue figures." },
    { q: "Why do accepted quotes show an amber alert?", a: "Because accepting online doesn't mean the job is locked in — you still need to call the customer, confirm the details, and book a date. The alert is a reminder to make that call. Once you do, mark it as Booked and the alert clears." },
    { q: "Can I attach a PDF quote?", a: "Yes. When creating a quote, click the upload area to attach your PDF. It gets sent as an attachment in the email. If you don't have a PDF, no worries — the email still shows the job title, amount, and response buttons." },
    { q: "Can I send a follow-up manually?", a: "Yes — open the quote and click 'Send Follow-Up Now'. This sends the next email in your sequence immediately, skipping the scheduled wait. Useful if you've just spoken to someone and want to nudge them." },
  ]},
  { category: "Follow-Up Sequences", items: [
    { q: "Why do I need follow-ups?", a: "Only 2% of sales happen on first contact. Most customers are busy and forget to respond — not because they're not interested. A well-timed follow-up email can be the difference between winning the job and losing it to a competitor who chased harder." },
    { q: "How do follow-up sequences work?", a: "A sequence is a series of emails sent automatically over time. For example: Day 2 (friendly check-in), Day 5 (gentle reminder), Day 10 (final nudge). You set the timing and write the messages. Wynflow sends them for you — no manual work required." },
    { q: "Do follow-ups stop when someone responds?", a: "Yes, immediately. The moment a customer clicks Accept or No thanks, all future follow-ups for that quote are cancelled. You'll never accidentally email someone who's already responded." },
    { q: "What are placeholders and how do I use them?", a: "Placeholders are tags like {name}, {job}, {amount}, and {business_name} that get automatically replaced with real data when the email sends. So 'Hi {name}, following up on {job}' becomes 'Hi Kim, following up on Bathroom Reno'. Use the + buttons below each field to insert them." },
    { q: "How many follow-up steps can I have?", a: "Up to 5 per sequence on the Starter plan. Most businesses find 3 steps is the sweet spot. A common pattern: Day 2 (checking in), Day 5 (gentle nudge with value add), Day 10 (last chance / offer to answer questions)." },
    { q: "Can I edit the email content?", a: "Yes — go to the Follow-Ups tab, click Edit on any step, and change the subject line, body, or timing. You'll see a live preview showing exactly what the customer will receive. The system validates that you haven't accidentally removed the {name} placeholder." },
  ]},
  { category: "Feedback & Responses", items: [
    { q: "What happens when a customer clicks 'No thanks'?", a: "They see a feedback questionnaire asking why — options like 'Too expensive', 'Went with someone else', etc. They can also leave a comment. This feedback shows up in your quote detail and Analytics so you can learn from it." },
    { q: "Can I customise the feedback options?", a: "Yes — go to Settings → Feedback Questionnaire. You can add, remove, and reorder up to 8 options. Common ones include pricing concerns, timing, went with a competitor, or changed plans. Hit Save Changes when you're done." },
    { q: "Where can I see the feedback?", a: "Open any declined quote to see the reason and comment. The Analytics tab also has a 'Why Customers Decline' chart showing the most common reasons across all your quotes — great for spotting patterns." },
    { q: "Do I get notified when someone responds?", a: "Yes. When a customer accepts or declines, you receive an email with their details, the quote amount, and (for declines) the reason they gave. You can also check your dashboard anytime." },
  ]},
  { category: "Analytics", items: [
    { q: "What does the win rate mean?", a: "It's the percentage of customers who responded and accepted (or booked). If 10 customers responded and 7 said yes, your win rate is 70%. It only counts quotes that have had a response, not ones still waiting." },
    { q: "What does 'When Do Customers Accept?' show?", a: "It tells you which follow-up email triggers the most acceptances. If most people accept after Follow-Up 2, you know your second email is doing the heavy lifting — and that follow-ups genuinely work for your business." },
    { q: "How is revenue calculated?", a: "Revenue is the total amount from all accepted and booked quotes. It helps you see the dollar value of jobs you're winning through Wynflow." },
    { q: "Why should I care about decline reasons?", a: "If 60% of declines are 'Too expensive', you might need to revisit your pricing or better communicate value upfront. If most say 'Went with someone else', your follow-ups might need to be faster. Data helps you improve." },
  ]},
  { category: "Settings & Account", items: [
    { q: "How do I update my business details?", a: "Go to Settings and edit your business name, contact name, email, phone, and trade. Your business name appears in every email your customers receive, so keep it accurate." },
    { q: "What email address do my quotes come from?", a: "All emails are sent from quotes@wynflow.co.nz on behalf of your business name. When a customer hits reply, it goes to the email address you've set in Settings." },
    { q: "How do I reset my password?", a: "Log out and click 'Forgot password' on the login screen. You'll get a reset link via email. If you're not receiving it, check your spam folder." },
    { q: "Is my data secure?", a: "Yes. Wynflow uses bank-grade encryption for all data. Your customer details and quotes are isolated to your account and never shared with anyone." },
  ]},
  { category: "Billing", items: [
    { q: "How does the free trial work?", a: "You get full access to all Starter plan features — no credit card, no commitment. Send unlimited quotes, set up follow-up sequences, and track everything from day one." },
    { q: "What's included in the Starter plan ($29/mo)?", a: "Unlimited quotes, 1 follow-up sequence with up to 5 steps, PDF attachments, customer response buttons with feedback questionnaire, full analytics dashboard, and email support." },
    { q: "What extra does Pro give me ($49/mo)?", a: "Everything in Starter plus unlimited sequences, custom email messages, advanced analytics, custom email branding, team access for up to 3 users, and priority support." },
  ]},
];

const HelpCentre = () => {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [openItem, setOpenItem] = useState(null);

  const filtered = searchQuery.trim()
    ? HELP_ARTICLES.map(cat => ({
        ...cat,
        items: cat.items.filter(item =>
          item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(cat => cat.items.length > 0)
    : HELP_ARTICLES;

  const totalResults = filtered.reduce((sum, cat) => sum + cat.items.length, 0);

  return (
    <div>
      <div style={{ marginBottom: isMobile ? 16 : 32 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>Help Centre</h1>
        <p style={{ fontSize: isMobile ? 13 : 14, color: theme.textMuted, margin: "4px 0 0" }}>Find answers to common questions</p>
      </div>

      <div style={{ position: "relative", marginBottom: 24 }}>
        <Search size={18} style={{ position: "absolute", left: 14, top: 13, color: theme.textDim }} />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search for help... e.g. 'follow-up', 'booked', 'placeholder'"
          style={{
            width: "100%", padding: "12px 14px 12px 42px", borderRadius: 10,
            background: theme.surface, border: `1px solid ${theme.border}`,
            color: theme.text, fontSize: 14, outline: "none", fontFamily: theme.font,
          }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")}
            style={{ position: "absolute", right: 14, top: 12, background: "none", border: "none", cursor: "pointer", color: theme.textDim, fontSize: 16 }}>×</button>
        )}
      </div>

      {searchQuery && (
        <p style={{ fontSize: 13, color: theme.textMuted, marginBottom: 16 }}>
          {totalResults} result{totalResults !== 1 ? "s" : ""} for "{searchQuery}"
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {filtered.map((cat) => (
          <Card key={cat.category}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.accent, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 0.5, fontSize: 12 }}>{cat.category}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {cat.items.map((item, i) => {
                const itemKey = cat.category + i;
                const isOpen = openItem === itemKey;
                return (
                  <div key={i}>
                    <div onClick={() => setOpenItem(isOpen ? null : itemKey)}
                      style={{
                        padding: "14px 0", cursor: "pointer",
                        borderBottom: i < cat.items.length - 1 ? `1px solid ${theme.border}08` : "none",
                        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                      }}>
                      <span style={{ fontSize: 14, color: theme.text, fontWeight: 500, flex: 1 }}>{item.q}</span>
                      <span style={{ fontSize: 18, color: theme.textDim, transition: "transform 0.2s", transform: isOpen ? "rotate(45deg)" : "none", flexShrink: 0 }}>+</span>
                    </div>
                    {isOpen && (
                      <div style={{ padding: "0 0 16px", fontSize: 13, color: theme.textMuted, lineHeight: 1.7 }}>
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 48 }}>
          <HelpCircle size={32} color={theme.textDim} style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: theme.textMuted }}>No results found. Try different keywords.</p>
          <p style={{ fontSize: 13, color: theme.textDim, marginTop: 8 }}>Still stuck? Email us at <a href="mailto:jesse@wynflow.co.nz" style={{ color: theme.accent }}>jesse@wynflow.co.nz</a></p>
        </div>
      )}

      <div style={{ marginTop: 24, padding: 20, borderRadius: 12, background: theme.surface, border: `1px solid ${theme.border}`, textAlign: "center" }}>
        <p style={{ fontSize: 14, color: theme.textMuted, margin: 0 }}>
          Can't find what you need? Email us at <a href="mailto:jesse@wynflow.co.nz" style={{ color: theme.accent, fontWeight: 500 }}>jesse@wynflow.co.nz</a> and we'll get back to you.
        </p>
      </div>
    </div>
  );
};

const DEFAULT_DECLINE_REASONS = ["Too expensive", "Went with someone else", "Changed my mind", "Timing isn't right", "Other"];

const Settings = ({ business, dispatch }) => {
  const isMobile = useIsMobile();
  const [businessName, setBusinessName] = useState(business?.business_name || "");
  const [contactName, setContactName] = useState(business?.contact_name || "");
  const [email, setEmail] = useState(business?.email || "");
  const [trade, setTrade] = useState(business?.trade || "");
  const [tradeCategory, setTradeCategory] = useState(business?.trade_category || business?.trade || "");
  const [phone, setPhone] = useState(business?.phone || "");
  const [hourlyRate, setHourlyRate] = useState(business?.hourly_rate || "");
  const [calloutFee, setCalloutFee] = useState(business?.callout_fee || "");

  const [priceList, setPriceList] = useState(business?.price_list || []);
  const [newItem, setNewItem] = useState({ name: "", unit: "each", cost: "" });
  const [bankName, setBankName] = useState(business?.bank_name || "");
  const [bankAccountName, setBankAccountName] = useState(business?.bank_account_name || "");
  const [bankAccountNumber, setBankAccountNumber] = useState(business?.bank_account_number || "");
  const [depositPercentage, setDepositPercentage] = useState(business?.deposit_percentage || 25);
  const [requireDeposit, setRequireDeposit] = useState(business?.require_deposit || false);
  const [address, setAddress] = useState(business?.address || "");
  const [gstNumber, setGstNumber] = useState(business?.gst_number || "");
  const [licenseNumber, setLicenseNumber] = useState(business?.license_number || "");
  const [quoteFooter, setQuoteFooter] = useState(business?.quote_footer || "");
  const [saving, setSaving] = useState(false);
  const [declineReasons, setDeclineReasons] = useState(business?.decline_reasons || DEFAULT_DECLINE_REASONS);
  const [newReason, setNewReason] = useState("");

  const saveSettings = async () => {
    setSaving(true);
    const updates = {
      business_name: businessName,
      contact_name: contactName,
      email: email,
      trade: tradeCategory || trade,
      trade_category: tradeCategory,
      phone: phone,
      hourly_rate: parseFloat(hourlyRate) || 0,
      callout_fee: parseFloat(calloutFee) || 0,
      price_list: priceList,
      decline_reasons: declineReasons,
      bank_name: bankName,
      bank_account_name: bankAccountName,
      bank_account_number: bankAccountNumber,
      deposit_percentage: parseFloat(depositPercentage) || 25,
      require_deposit: requireDeposit,
      address: address,
      gst_number: gstNumber,
      license_number: licenseNumber,
      quote_footer: quoteFooter,
    };
    try {
      const { error } = await db("businesses").eq("id", business.id).update(updates);
      if (error) throw error;
      dispatch({ type: "SET_BUSINESS", payload: { ...business, ...updates } });
      dispatch({ type: "NOTIFY", payload: { message: "Settings saved!", type: "success" } });
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to save settings. Please try again.", type: "error" } });
    }
    setSaving(false);
  };

  const addPriceItem = () => {
    if (!newItem.name || !newItem.cost) return;
    setPriceList([...priceList, { name: newItem.name, unit: newItem.unit, cost: parseFloat(newItem.cost) }]);
    setNewItem({ name: "", unit: "each", cost: "" });
  };

  const removePriceItem = (index) => setPriceList(priceList.filter((_, i) => i !== index));

  const addReason = () => {
    if (!newReason.trim() || declineReasons.length >= 8) return;
    setDeclineReasons([...declineReasons, newReason.trim()]);
    setNewReason("");
  };

  const removeReason = (index) => {
    setDeclineReasons(declineReasons.filter((_, i) => i !== index));
  };

  const moveReason = (index, direction) => {
    const arr = [...declineReasons];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= arr.length) return;
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    setDeclineReasons(arr);
  };

  return (
    <div>
      <div style={{ marginBottom: isMobile ? 16 : 32 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>Settings</h1>
        <p style={{ fontSize: isMobile ? 13 : 14, color: theme.textMuted, margin: "4px 0 0" }}>Manage your business profile</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 10 : 24 }}>
        <Card style={isMobile ? { padding: 16 } : {}}>
          <h3 style={{ fontSize: isMobile ? 15 : 16, fontWeight: 600, color: theme.text, margin: "0 0 14px" }}>Business Profile</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 10 : 16 }}>
            <Input label="Business Name" value={businessName} onChange={setBusinessName} />
            <Input label="Contact Name" value={contactName} onChange={setContactName} />
            <Input label="Email" value={email} onChange={setEmail} type="email" />
            <Input label="Phone" value={phone} onChange={setPhone} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: theme.textMuted, marginBottom: 6 }}>Trade / Industry</div>
              <select value={tradeCategory} onChange={e => setTradeCategory(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: theme.surfaceLight, border: `1px solid ${theme.border}`, color: theme.text, fontSize: 14, fontFamily: theme.font, outline: "none", appearance: "auto" }}>
                <option value="">Select your trade...</option>
                {TRADE_CATEGORIES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <Button onClick={saveSettings} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </div>
        </Card>
        <Card style={isMobile ? { padding: 16 } : {}}>
          <h3 style={{ fontSize: isMobile ? 15 : 16, fontWeight: 600, color: theme.text, margin: "0 0 8px" }}>Quote Details</h3>
          <p style={{ fontSize: 12, color: theme.textMuted, margin: "0 0 12px" }}>Add your business details to display on quotes. Toggle them on/off per quote when sending.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 10 : 14 }}>
            <Input label="Business Address" value={address} onChange={setAddress} placeholder="e.g. 12 Queen St, Auckland 1010" />
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 10 : 12 }}>
              <div style={{ flex: 1 }}><Input label="GST Number" value={gstNumber} onChange={setGstNumber} placeholder="e.g. 123-456-789" /></div>
              <div style={{ flex: 1 }}><Input label="License / Rego Number" value={licenseNumber} onChange={setLicenseNumber} placeholder="e.g. LBP 12345" /></div>
            </div>
            <Input label="Custom Quote Footer" value={quoteFooter} onChange={setQuoteFooter} textarea placeholder="e.g. All work guaranteed for 12 months. Pricing valid for 30 days." />
          </div>
        </Card>
        <Card style={isMobile ? { padding: 16 } : {}}>
          <h3 style={{ fontSize: isMobile ? 15 : 16, fontWeight: 600, color: theme.text, margin: "0 0 8px" }}>Pricing & AI Estimates</h3>
          <p style={{ fontSize: 12, color: theme.textMuted, margin: "0 0 12px" }}>Set your rates so AI can estimate quotes from photos.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 10 : 14 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}><Input label="Hourly Rate ($)" value={hourlyRate} onChange={setHourlyRate} type="number" /></div>
              <div style={{ flex: 1 }}><Input label="Callout Fee ($)" value={calloutFee} onChange={setCalloutFee} type="number" /></div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: theme.textMuted, marginBottom: 4 }}>Your Price List</div>
              <p style={{ fontSize: 11, color: theme.textDim, margin: "0 0 10px" }}>Add materials, services, and costs. AI uses this to price quotes.</p>
              {priceList.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 10 }}>
                  {priceList.map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "6px 10px" : "8px 12px", borderRadius: 8, background: theme.surfaceLight, border: `1px solid ${theme.border}`, marginBottom: 6 }}>
                      <span style={{ flex: 1, fontSize: 13, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                      {!isMobile && <span style={{ fontSize: 11, color: theme.textDim, padding: "2px 8px", borderRadius: 4, background: theme.bg }}>{item.unit}</span>}
                      <span style={{ fontSize: 13, color: theme.accent, fontWeight: 600, flexShrink: 0 }}>${item.cost}{isMobile ? `/${item.unit}` : ""}</span>
                      <button onClick={() => removePriceItem(i)} style={{ background: "none", border: "none", cursor: "pointer", color: theme.red, fontSize: 16, lineHeight: 1, flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {priceList.length === 0 && (
                <div style={{ padding: 12, borderRadius: 8, background: theme.surfaceLight, border: `1px dashed ${theme.border}`, textAlign: "center", marginBottom: 10 }}>
                  <p style={{ fontSize: 12, color: theme.textDim, margin: 0 }}>No items yet. Add materials or services to improve AI accuracy.</p>
                </div>
              )}
              {isMobile ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <Input label="" value={newItem.name} onChange={v => setNewItem({ ...newItem, name: v })} placeholder="e.g. 15mm copper pipe" />
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <select value={newItem.unit} onChange={e => setNewItem({ ...newItem, unit: e.target.value })} style={{ width: "100%", padding: "10px 8px", borderRadius: 8, background: theme.surfaceLight, border: `1px solid ${theme.border}`, color: theme.text, fontSize: 13, fontFamily: theme.font }}>
                        <option value="each">each</option><option value="per metre">per metre</option><option value="per sqm">per sqm</option><option value="per hour">per hour</option><option value="per day">per day</option><option value="per roll">per roll</option><option value="per sheet">per sheet</option><option value="per bag">per bag</option><option value="per litre">per litre</option><option value="fixed">fixed</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}><Input label="" value={newItem.cost} onChange={v => setNewItem({ ...newItem, cost: v })} type="number" placeholder="$" /></div>
                    <Button size="sm" onClick={addPriceItem} style={{ alignSelf: "flex-end" }}><Plus size={14} /></Button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 2 }}><Input label="" value={newItem.name} onChange={v => setNewItem({ ...newItem, name: v })} placeholder="e.g. 15mm copper pipe" /></div>
                  <div style={{ flex: 1 }}>
                    <select value={newItem.unit} onChange={e => setNewItem({ ...newItem, unit: e.target.value })} style={{ width: "100%", padding: "10px 8px", borderRadius: 8, background: theme.surfaceLight, border: `1px solid ${theme.border}`, color: theme.text, fontSize: 13, fontFamily: theme.font }}>
                      <option value="each">each</option><option value="per metre">per metre</option><option value="per sqm">per sqm</option><option value="per hour">per hour</option><option value="per day">per day</option><option value="per roll">per roll</option><option value="per sheet">per sheet</option><option value="per bag">per bag</option><option value="per litre">per litre</option><option value="fixed">fixed</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}><Input label="" value={newItem.cost} onChange={v => setNewItem({ ...newItem, cost: v })} type="number" placeholder="$" /></div>
                  <Button size="sm" onClick={addPriceItem} style={{ alignSelf: "flex-end" }}><Plus size={14} /></Button>
                </div>
              )}
              <p style={{ fontSize: 11, color: theme.textDim, margin: "6px 0 0" }}>{priceList.length} item{priceList.length !== 1 ? "s" : ""} in your price list</p>
            </div>
          </div>
        </Card>
        <Card style={isMobile ? { padding: 16 } : {}}>
          <h3 style={{ fontSize: isMobile ? 15 : 16, fontWeight: 600, color: theme.text, margin: "0 0 8px" }}>Deposit & Bank Details</h3>
          <p style={{ fontSize: 12, color: theme.textMuted, margin: "0 0 12px" }}>Show bank details on acceptance page so customers can pay a deposit.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 10 : 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: isMobile ? "10px 12px" : "12px 16px", borderRadius: 10, background: theme.surfaceLight, border: `1px solid ${theme.border}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 500, color: theme.text }}>Require deposit</div>
                <div style={{ fontSize: 11, color: theme.textDim }}>Show bank details when quote is accepted</div>
              </div>
              <div onClick={() => setRequireDeposit(!requireDeposit)} style={{ width: 44, height: 24, borderRadius: 12, background: requireDeposit ? theme.accent : theme.border, cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                <div style={{ width: 20, height: 20, borderRadius: 10, background: "#fff", position: "absolute", top: 2, left: requireDeposit ? 22 : 2, transition: "left 0.2s" }} />
              </div>
            </div>
            {requireDeposit && (
              <>
                <Input label="Bank Name" value={bankName} onChange={setBankName} placeholder="e.g. ANZ, ASB, BNZ, Westpac" />
                <Input label="Account Name" value={bankAccountName} onChange={setBankAccountName} placeholder="e.g. Smith's Plumbing Ltd" />
                <Input label="Account Number" value={bankAccountNumber} onChange={setBankAccountNumber} placeholder="e.g. 01-0123-0123456-00" />
                <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}><Input label="Deposit %" value={depositPercentage} onChange={setDepositPercentage} type="number" /></div>
                  <div style={{ fontSize: 13, color: theme.textDim, paddingBottom: 12 }}>of quote total</div>
                </div>
              </>
            )}
          </div>
        </Card>
        <Card style={isMobile ? { padding: 16 } : {}}>
          <h3 style={{ fontSize: isMobile ? 15 : 16, fontWeight: 600, color: theme.text, margin: "0 0 14px" }}>Email Configuration</h3>
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
        <Card style={{ gridColumn: "1 / -1", ...(isMobile ? { padding: 16 } : {}) }}>
          <h3 style={{ fontSize: isMobile ? 15 : 16, fontWeight: 600, color: theme.text, margin: "0 0 8px" }}>Your Quote Request Link</h3>
          <p style={{ fontSize: 12, color: theme.textMuted, margin: "0 0 12px" }}>Customers use this link to request a quote. Their request lands in your dashboard.</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <div style={{ flex: 1, padding: isMobile ? "10px 12px" : "12px 16px", borderRadius: 8, background: theme.surfaceLight, border: `1px solid ${theme.border}`, fontSize: isMobile ? 11 : 13, color: theme.accent, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {`wynflow.co.nz/request/${business.id.slice(0, 8)}...`}
            </div>
            <Button size="sm" onClick={() => { navigator.clipboard.writeText(`https://www.wynflow.co.nz/request/${business.id}`); dispatch({ type: "NOTIFY", payload: { message: "Link copied!", type: "success" } }); }}>Copy</Button>
          </div>
          <div style={{ padding: isMobile ? 12 : 16, borderRadius: 12, background: theme.bg, border: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 10 }}>How to use this link</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Facebook & Instagram", tip: "Add to your bio or paste in posts when customers ask for a quote" },
                { label: "Google Business", tip: "Add as your booking link so customers can request a quote from search" },
                { label: "Your website", tip: "Add a \"Request a Quote\" button — works on any website builder" },
                { label: "TikTok & YouTube", tip: "Drop in your bio or video description for viewers to request quotes" },
                { label: "Email signature", tip: "Add to your email footer for easy quote requests" },
              ].map((item, i) => (
                <div key={i} style={{ fontSize: isMobile ? 11 : 12, color: theme.textMuted, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 600, color: theme.text }}>{item.label}:</span> {item.tip}
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card style={{ gridColumn: "1 / -1", ...(isMobile ? { padding: 16 } : {}) }}>
          <h3 style={{ fontSize: isMobile ? 15 : 16, fontWeight: 600, color: theme.text, margin: "0 0 8px" }}>Feedback Questionnaire</h3>
          <p style={{ fontSize: 12, color: theme.textMuted, margin: "0 0 14px" }}>When a customer declines, they'll see these options.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {declineReasons.map((reason, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "8px 10px" : "10px 14px", borderRadius: 8, background: theme.surfaceLight, border: `1px solid ${theme.border}` }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {i > 0 && <button onClick={() => moveReason(i, -1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, color: theme.textMuted, lineHeight: 1 }}>↑</button>}
                  {i < declineReasons.length - 1 && <button onClick={() => moveReason(i, 1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12, color: theme.textMuted, lineHeight: 1 }}>↓</button>}
                </div>
                <span style={{ flex: 1, fontSize: 13, color: theme.text }}>{reason}</span>
                <button onClick={() => removeReason(i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: theme.red, fontSize: 16, lineHeight: 1, flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
          {declineReasons.length < 8 && (
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}><Input label="" value={newReason} onChange={setNewReason} placeholder="Add a new reason..." /></div>
              <Button size="sm" onClick={addReason} style={{ alignSelf: "flex-end" }}><Plus size={14} /> Add</Button>
            </div>
          )}
          {declineReasons.length >= 8 && <div style={{ fontSize: 12, color: theme.textDim }}>Maximum 8 reasons</div>}
          <p style={{ fontSize: 11, color: theme.textDim, margin: "10px 0 0" }}>Customers can also leave a comment. Hit "Save Changes" above to update.</p>
        </Card>
        <Card style={{ gridColumn: "1 / -1", ...(isMobile ? { padding: 16 } : {}) }}>
          <h3 style={{ fontSize: isMobile ? 15 : 16, fontWeight: 600, color: theme.text, margin: "0 0 12px" }}>Subscription</h3>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: business?.subscription_status === "trialing" ? 12 : 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 600, color: theme.text }}>
                {business?.subscription_status === "trialing" ? "Free Trial" : business?.subscription_status === "active" ? "Wynflow Active" : "Wynflow"}
              </div>
              <div style={{ fontSize: isMobile ? 12 : 13, color: theme.textMuted }}>
                {business?.subscription_status === "trialing"
                  ? "Upgrade anytime to keep your quotes flowing"
                  : "Unlimited quotes • follow-ups • support"}
              </div>
            </div>
            <div style={{
              padding: isMobile ? "6px 12px" : "8px 16px", borderRadius: 8, flexShrink: 0,
              background: business?.subscription_status === "active" ? theme.greenSoft : theme.accentSoft,
              color: business?.subscription_status === "active" ? theme.green : theme.accent,
              fontSize: 12, fontWeight: 600, textTransform: "capitalize",
            }}>
              {business?.subscription_status || "trialing"}
            </div>
          </div>
          {business?.subscription_status === "trialing" && (
            <div style={{ display: "flex", gap: 10 }}>
              <Button onClick={() => window.open("https://buy.stripe.com/bJecN5cNf6gD70L1A973G00", "_blank")} size={isMobile ? "sm" : "md"} style={{ flex: 1, justifyContent: "center" }}>Starter — $29/mo</Button>
              <Button variant="secondary" onClick={() => window.open("https://buy.stripe.com/9B6cN500t6gD2Kv92B73G01", "_blank")} size={isMobile ? "sm" : "md"} style={{ flex: 1, justifyContent: "center" }}>Pro — $49/mo</Button>
            </div>
          )}
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
    { title: "Step 1: Send a Quote", desc: "Click 'AI Quote' or 'Manual Quote' to get started", icon: "📤", content: "Use AI Quote to generate a quote from photos and job details, or Manual Quote to enter everything yourself. Add your customer's details, the job title, and the amount. Hit send and the customer gets a branded email with your quote." },
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
    try {
      const [quotesRes, seqRes] = await Promise.all([
        db("quotes").eq("business_id", business.id).order("created_at", { ascending: false }).select(),
        db("follow_up_sequences").eq("business_id", business.id).select(),
      ]);
      if (quotesRes.data) dispatch({ type: "SET_QUOTES", payload: quotesRes.data });
      if (seqRes.data) dispatch({ type: "SET_SEQUENCES", payload: seqRes.data });
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to load data. Please refresh.", type: "error" } });
    }
    dispatch({ type: "SET_LOADING", payload: false });
  }, [business?.id]);

  // Restore session on mount
  useEffect(() => {
    // Check for password recovery token in URL hash
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      const params = new URLSearchParams(hash.replace("#", ""));
      const accessToken = params.get("access_token");
      if (accessToken) {
        supabase.token = accessToken;
        dispatch({ type: "SET_SCREEN", payload: "resetPassword" });
        window.history.replaceState(null, "", "/");
        return;
      }
    }

    const path = window.location.pathname.replace(/^\//, "").toLowerCase();
    if (path.startsWith("request/")) {
      const bizId = window.location.pathname.split("/request/")[1];
      if (bizId) dispatch({ type: "SET_SCREEN", payload: "requestQuote:" + bizId });
      return;
    }
    const savedToken = getCookie("wynflow_token");
    const savedUser = getCookie("wynflow_user");
    const savedBusiness = getCookie("wynflow_business");
    if (savedToken && savedUser && savedBusiness) {
      supabase.token = savedToken;
      supabase.user = savedUser;
      dispatch({ type: "SET_USER", payload: savedUser });
      dispatch({ type: "SET_BUSINESS", payload: savedBusiness });
      // Validate token is still valid, refresh cookie expiry on success
      supabase.auth_getUser().then(res => {
        if (res.error || !res.data) {
          supabase.token = null;
          supabase.user = null;
          clearCookies();
          dispatch({ type: "LOGOUT" });
        } else {
          // Refresh cookies so they don't expire while user is active
          setCookie("wynflow_token", savedToken, 43200);
          setCookie("wynflow_user", savedUser, 43200);
          setCookie("wynflow_business", savedBusiness, 43200);
        }
      }).catch(() => {});
    } else {
      const routes = { "about": "about", "pricing": "pricing", "login": "login", "signup": "signup" };
      if (routes[path]) {
        dispatch({ type: "SET_SCREEN", payload: routes[path] });
      }
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
    if (business) {
      let seen = false;
      try { seen = localStorage.getItem("wynflow_onboarded_" + business.id) === "true"; } catch(e) {}
      if (!seen && !getCookie("wynflow_onboarded")) {
        setShowOnboarding(true);
      }
    }
  }, [business?.id]);

  useEffect(() => {
    if (business && (screen === "dashboard" || screen === "quotes")) {
      loadData();
    }
  }, [screen, business, loadData]);

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
    ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08);border-radius:3px; }
    @keyframes slideIn { from{transform:translateX(100px);opacity:0} to{transform:translateX(0);opacity:1} }
    @keyframes spin { to{transform:rotate(360deg)} }
    @media (max-width: 767px) {
      .mobile-stack { grid-template-columns: 1fr !important; }
      .mobile-hide { display: none !important; }
      .mobile-full { grid-column: 1 / -1 !important; }
      body { -webkit-text-size-adjust: 100%; }
      input, textarea, select { font-size: 16px !important; }
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

  if (activeScreen === "requestQuote" && detailId) {
    return (
      <>
        <style>{globalStyles}</style>
        <RequestQuotePage businessId={detailId} />
      </>
    );
  }

  if (!business) {
    if (screen === "resetPassword") {
      return (
        <>
          <style>{globalStyles}</style>
          {notification && <Toast message={notification.message} type={notification.type} onClose={() => dispatch({ type: "CLEAR_NOTIFY" })} />}
          <ResetPasswordScreen dispatch={dispatch} />
        </>
      );
    }
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
      case "quotes": return <QuotesList quotes={quotes} dispatch={dispatch} sequences={sequences} />;
      case "analytics": return <Analytics quotes={quotes} />;
      case "newQuote": return <NewQuoteForm dispatch={dispatch} business={business} sequences={sequences} />;
      case "aiQuote": return <AIQuoteForm dispatch={dispatch} business={business} sequences={sequences} quotes={quotes} />;
      case "sequences": return <SequencesManager sequences={sequences} business={business} dispatch={dispatch} />;
      case "quoteDetail": return <QuoteDetail quoteId={detailId} quotes={quotes} sequences={sequences} dispatch={dispatch} business={business} />;
      case "help": return <HelpCentre />;
      case "settings": return <Settings business={business} dispatch={dispatch} />;
      default: return <Dashboard quotes={quotes} dispatch={dispatch} />;
    }
  };

  return (
    <>
      <style>{globalStyles}</style>
      {notification && <Toast message={notification.message} type={notification.type} onClose={() => dispatch({ type: "CLEAR_NOTIFY" })} />}
      {showOnboarding && <OnboardingTutorial business={business} onComplete={() => { setShowOnboarding(false); try { localStorage.setItem("wynflow_onboarded_" + business.id, "true"); } catch(e) {} setCookie("wynflow_onboarded", "true", 525600); }} />}
      <div style={{ display: "flex", height: "100vh", fontFamily: theme.font, color: "#F1F3F7", background: theme.bg, overflow: "hidden", flexDirection: isMobile ? "column" : "row" }}>
        <Sidebar screen={activeScreen} dispatch={dispatch} business={business} />
        <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "16px 14px 90px" : "32px 40px", WebkitOverflowScrolling: "touch" }}>
          {renderContent()}
        </div>
      </div>
    </>
  );
}
