import { useState, useEffect, useReducer, useCallback, Component } from "react";
import { jsPDF } from "jspdf";
import { LayoutDashboard, FileText, RefreshCw, Settings as SettingsIcon, Upload, Send, Bot, ClipboardList, Paperclip, CheckCircle2, BarChart3, Lock, Clock, DollarSign, ChevronLeft, ChevronRight, Menu, X, ArrowRight, Star, Mail, Plus, Search, Check, XCircle, MessageSquare, Globe, Cpu, Wrench, HelpCircle, Camera, UserCheck, Zap, Link, Copy, Sparkles, Bell, Receipt, CreditCard, AlertTriangle, Download, Trash2, History, Eye, CalendarDays } from "lucide-react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { format, parse, startOfWeek, getDay, addDays, startOfDay, endOfDay, addHours, isSameDay, startOfISOWeek, endOfISOWeek, subDays } from "date-fns";

// ─── Calendar Localizer (react-big-calendar) ───
const locales = { "en-NZ": undefined };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1 }), getDay, locales });
const DnDCalendar = withDragAndDrop(Calendar);

// ─── Error Tracking System ───
const ERROR_WEBHOOK = "https://wynfallautomation.app.n8n.cloud/webhook/error-report";

const reportError = (error, context = {}) => {
  const payload = {
    message: error?.message || String(error),
    stack: error?.stack?.split("\n").slice(0, 5).join("\n") || "",
    context: typeof context === "string" ? context : JSON.stringify(context),
    url: window.location.href,
    screen: window.__wynflow_screen || "unknown",
    user_email: window.__wynflow_user_email || "anonymous",
    business_id: window.__wynflow_business_id || "",
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
  };
  // Send to N8N webhook (fire-and-forget)
  fetch(ERROR_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {}); // Don't let error reporting cause more errors
  // Also log locally
  console.error(`[Wynflow Error] ${payload.message}`, { context, error });
};

// Global error handlers
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    reportError(event.error || event.message, "global_error");
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, "unhandled_promise_rejection");
  });
}

// React Error Boundary
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    reportError(error, { type: "react_crash", componentStack: errorInfo?.componentStack?.split("\n").slice(0, 8).join("\n") });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0E17", fontFamily: "'DM Sans', sans-serif", padding: 24 }}>
          <div style={{ textAlign: "center", maxWidth: 440 }}>
            <div style={{ width: 72, height: 72, borderRadius: 18, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
              <AlertTriangle size={32} color="#EF4444" />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 32 }}>
              An unexpected error occurred. This has been automatically reported. Try refreshing the page.
            </p>
            <button onClick={() => window.location.reload()} style={{
              padding: "14px 32px", borderRadius: 10, background: "#14B8A6", color: "#000",
              fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit",
            }}>Refresh Page</button>
            <details style={{ marginTop: 32, textAlign: "left" }}>
              <summary style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", cursor: "pointer" }}>Error details</summary>
              <pre style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 8, padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 8, overflow: "auto", maxHeight: 200, whiteSpace: "pre-wrap" }}>
                {this.state.error?.message}{"\n"}{this.state.error?.stack}
              </pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Safe Fetch (with error reporting) ───
const safeFetch = async (url, options = {}, context = "") => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      reportError(new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`), { context: context || url, status: res.status });
    }
    return res;
  } catch (err) {
    reportError(err, { context: context || url, type: "fetch_error" });
    throw err;
  }
};

// ─── SEO Helper ───
const SEO_CONFIG = {
  home: {
    title: "Wynflow — AI Quote Generator for NZ Tradies | Plumber, Electrician & Builder Quoting Software",
    description: "Generate accurate quotes from job site photos with AI. Automated follow-up emails chase customers so you don't have to. Free 14-day trial. Built for New Zealand plumbers, electricians, builders and tradies.",
    canonical: "https://www.wynflow.co.nz",
  },
  about: {
    title: "About Wynflow — AI-Powered Quoting Software Built in New Zealand for Kiwi Tradies",
    description: "Born from watching a Napier carpet layer lose $47,000 in jobs to forgotten follow-ups. Wynflow combines AI photo quoting with automated follow-up emails so NZ tradies never lose a job to silence again.",
    canonical: "https://www.wynflow.co.nz/about",
  },
  pricing: {
    title: "Wynflow Pricing — AI Quote Generator from $29/mo NZD | Free 14-Day Trial",
    description: "AI-powered quote generation, unlimited quotes, automated follow-up sequences, and analytics from $29/mo NZD. No credit card required. 14-day free trial for New Zealand tradies.",
    canonical: "https://www.wynflow.co.nz/pricing",
  },
};
const useSEO = (screen) => {
  useEffect(() => {
    const config = SEO_CONFIG[screen];
    if (!config) return;
    document.title = config.title;
    // Meta description
    const setMeta = (attr, key, val) => { let el = document.querySelector(`meta[${attr}="${key}"]`); if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); } el.setAttribute("content", val); };
    setMeta("name", "description", config.description);
    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.setAttribute("rel", "canonical"); document.head.appendChild(canonical); }
    canonical.setAttribute("href", config.canonical);
    // Open Graph
    setMeta("property", "og:title", config.title);
    setMeta("property", "og:description", config.description);
    setMeta("property", "og:url", config.canonical);
    const ogTitle = { home: "AI-Powered Quote Management", about: "Built in NZ for Kiwi Tradies", pricing: "Plans from $29/mo NZD" }[screen] || "AI-Powered Quote Management";
    const ogSubtitle = { home: "Generate quotes from photos. Chase customers automatically. Win more jobs.", about: "Born from watching a tradie lose $47K to forgotten follow-ups.", pricing: "AI quoting, unlimited quotes, automated follow-ups. Free 14-day trial." }[screen] || "";
    const ogImage = `https://www.wynflow.co.nz/api/og?title=${encodeURIComponent(ogTitle)}&subtitle=${encodeURIComponent(ogSubtitle)}`;
    setMeta("property", "og:image", ogImage);
    setMeta("property", "og:image:width", "1200");
    setMeta("property", "og:image:height", "630");
    setMeta("property", "og:type", "website");
    setMeta("property", "og:site_name", "Wynflow");
    setMeta("property", "og:locale", "en_NZ");
    // Twitter Card
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", config.title);
    setMeta("name", "twitter:description", config.description);
    setMeta("name", "twitter:image", ogImage);
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
    if (data.error) {
      const msg = (data.error.message || data.msg || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists") || msg.includes("unique"))
        throw new Error("An account with this email already exists. Try signing in instead.");
      throw new Error(data.error.message || data.msg || "Signup failed — please try again");
    }
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

  async auth_refreshSession(refreshToken) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.access_token) {
      this.token = data.access_token;
      this.user = data.user;
    }
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
  screenHistory: [],
  quotes: [],
  sequences: [],
  invoices: [],
  jobs: [],
  notification: null,
  loading: false,
};

function appReducer(state, action) {
  switch (action.type) {
    case "SET_USER":
      return { ...state, user: action.payload };
    case "SET_BUSINESS":
      return { ...state, business: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "LOGOUT":
      return { ...initialState };
    case "SET_SCREEN": {
      const history = [...(state.screenHistory || []), state.screen].slice(-10);
      return { ...state, screen: action.payload, prevScreen: state.screen, screenHistory: history };
    }
    case "GO_BACK": {
      const history = [...(state.screenHistory || [])];
      const prev = history.pop() || "dashboard";
      return { ...state, screen: prev, prevScreen: state.screen, screenHistory: history };
    }
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
    case "DELETE_QUOTE":
      return { ...state, quotes: state.quotes.filter(q => q.id !== action.payload), screen: "quotes" };
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
    case "SET_INVOICES":
      return { ...state, invoices: action.payload };
    case "ADD_INVOICE":
      return { ...state, invoices: [action.payload, ...state.invoices], screen: "invoices" };
    case "UPDATE_INVOICE":
      return {
        ...state,
        invoices: state.invoices.map((inv) =>
          inv.id === action.payload.id ? { ...inv, ...action.payload } : inv
        ),
      };
    case "DELETE_INVOICE":
      return { ...state, invoices: state.invoices.filter(inv => inv.id !== action.payload), screen: "invoices" };
    case "NOTIFY":
      return { ...state, notification: action.payload };
    case "CLEAR_NOTIFY":
      return { ...state, notification: null };
    case "SET_JOBS":
      return { ...state, jobs: action.payload };
    case "ADD_JOB":
      return { ...state, jobs: [action.payload, ...state.jobs] };
    case "UPDATE_JOB":
      return {
        ...state,
        jobs: state.jobs.map((j) =>
          j.id === action.payload.id ? { ...j, ...action.payload } : j
        ),
      };
    default:
      return state;
  }
}

// ─── Logo ───
const WYNFLOW_LOGO = "/logo.png";
const WYNFLOW_WORD_LOGO = "/wynflow-word-logo.png";

const WynflowLogo = ({ size = 36, showText = false, textSize, textColor = "#FFFFFF" }) => {
  if (!showText) return <img src={WYNFLOW_LOGO} alt="Wynflow" style={{ height: size, width: "auto", objectFit: "contain", display: "block" }} />;
  const fontSize = textSize || Math.round(size * 0.56);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: Math.round(size * 0.25) }}>
      <img src={WYNFLOW_LOGO} alt="Wynflow" style={{ height: size, width: "auto", objectFit: "contain", display: "block", flexShrink: 0 }} />
      <span style={{ fontSize, fontWeight: 700, color: textColor, fontFamily: theme.font, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>Wynflow</span>
    </div>
  );
};

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
  sent: { label: "Awaiting Response", color: theme.accent, bg: theme.accentSoft },
  opened: { label: "Opened", color: theme.accentBlue, bg: theme.accentBlueSoft },
  accepted: { label: "Accepted", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  booked: { label: "Booked", color: theme.green, bg: theme.greenSoft },
  declined: { label: "Declined", color: theme.red, bg: theme.redSoft },
  feedback: { label: "Feedback", color: theme.blue, bg: theme.blueSoft },
};

const invoiceStatusConfig = {
  draft: { label: "Draft", color: theme.textMuted, bg: "rgba(139,149,168,0.12)" },
  sent: { label: "Sent", color: theme.accent, bg: theme.accentSoft },
  viewed: { label: "Viewed", color: theme.accentBlue, bg: theme.accentBlueSoft },
  overdue: { label: "Overdue", color: theme.red, bg: theme.redSoft },
  paid: { label: "Paid", color: theme.green, bg: theme.greenSoft },
};

// ─── Invoice Settings Validation ───
const isInvoiceSettingsComplete = (business) => {
  if (!business) return { complete: false, missing: ["Business profile"] };
  const missing = [];
  if (!business.business_name?.trim()) missing.push("Business name");
  if (!business.email?.trim()) missing.push("Email");
  if (!business.phone?.trim()) missing.push("Phone");
  if (!business.address?.trim()) missing.push("Business address");
  if (!business.bank_name?.trim()) missing.push("Bank name");
  if (!business.bank_account_name?.trim()) missing.push("Bank account name");
  if (!business.bank_account_number?.trim()) missing.push("Bank account number");
  return { complete: missing.length === 0, missing };
};

// ─── Invoice PDF Generator (NZ-compliant) ───
const fmtNZD = (n) => "$" + parseFloat(n || 0).toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => new Date(d).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });

const generateInvoicePDF = ({ business, invoice, breakdown }) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = 210, lm = 20, rm = 20, cw = pw - lm - rm;
  let y = 20;
  const isGST = !!business.gst_number;
  const amount = parseFloat(invoice.amount || 0);
  const gst = parseFloat(invoice.gst_amount || 0);
  const total = amount + gst;

  // Helper: check page overflow
  const checkPage = (needed = 20) => { if (y + needed > 275) { doc.addPage(); y = 20; } };

  // Helper: draw text
  const txt = (x, yy, text, opts = {}) => {
    doc.setFontSize(opts.size || 10);
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setTextColor(opts.color || "#374151");
    if (opts.align === "right") doc.text(text, x, yy, { align: "right" });
    else doc.text(text, x, yy);
  };

  // Helper: section label
  const label = (text) => {
    checkPage(15);
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor("#9ca3af");
    doc.text(text.toUpperCase(), lm, y);
    y += 5;
  };

  // ── Header ──
  // Business info (left)
  txt(lm, y, business.business_name, { size: 20, bold: true, color: "#0A0E17" }); y += 7;
  if (business.address) { txt(lm, y, business.address, { size: 9, color: "#6b7280" }); y += 4; }
  if (business.phone) { txt(lm, y, business.phone, { size: 9, color: "#6b7280" }); y += 4; }
  if (business.email) { txt(lm, y, business.email, { size: 9, color: "#6b7280" }); y += 4; }
  if (isGST) { txt(lm, y, "GST: " + business.gst_number, { size: 8, color: "#9ca3af" }); y += 4; }
  if (business.license_number) { txt(lm, y, business.license_number, { size: 8, color: "#9ca3af" }); y += 4; }

  // Invoice info (right)
  const ry = 20;
  txt(pw - rm, ry, isGST ? "TAX INVOICE" : "INVOICE", { size: 14, bold: true, color: "#14B8A6", align: "right" });
  txt(pw - rm, ry + 7, invoice.invoice_number, { size: 12, bold: true, color: "#111827", align: "right" });
  txt(pw - rm, ry + 13, fmtDate(invoice.sent_at || new Date()), { size: 9, color: "#6b7280", align: "right" });
  txt(pw - rm, ry + 18, "Due: " + fmtDate(invoice.due_date), { size: 9, bold: true, color: "#111827", align: "right" });

  y = Math.max(y, ry + 24);

  // Teal accent line
  doc.setDrawColor("#14B8A6"); doc.setLineWidth(1);
  doc.line(lm, y, pw - rm, y); y += 8;

  // ── Bill To ──
  label("Bill To");
  txt(lm, y, invoice.customer_name, { size: 12, bold: true, color: "#111827" }); y += 5;
  if (invoice.customer_email) { txt(lm, y, invoice.customer_email, { size: 9, color: "#6b7280" }); y += 4; }
  if (invoice.customer_phone) { txt(lm, y, invoice.customer_phone, { size: 9, color: "#6b7280" }); y += 4; }
  y += 6;

  // ── Job ──
  label("Job");
  txt(lm, y, invoice.job_title || "", { size: 13, bold: true, color: "#111827" }); y += 7;

  // ── Scope of Work ──
  if (invoice.description) {
    label("Scope of Work");
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor("#374151");
    const lines = doc.splitTextToSize(invoice.description, cw);
    lines.forEach(line => { checkPage(5); doc.text(line, lm, y); y += 4; });
    y += 4;
  }

  // ── Line Items Table ──
  checkPage(30);
  label("Items");
  // Table header
  doc.setFillColor("#f3f4f6"); doc.rect(lm, y - 3, cw, 8, "F");
  txt(lm + 2, y + 2, "Description", { size: 8, bold: true, color: "#6b7280" });
  txt(pw - rm - 2, y + 2, "Amount", { size: 8, bold: true, color: "#6b7280", align: "right" });
  y += 9;

  const addRow = (desc, amt) => {
    checkPage(8);
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor("#374151");
    const wrapped = doc.splitTextToSize(desc, cw - 45);
    wrapped.forEach((line, i) => { doc.text(line, lm + 2, y); if (i === 0 && amt !== undefined) { txt(pw - rm - 2, y, fmtNZD(amt), { size: 9, color: "#111827", align: "right" }); } y += 4.5; });
    doc.setDrawColor("#e5e7eb"); doc.setLineWidth(0.2); doc.line(lm, y, pw - rm, y); y += 2;
  };

  // Parse breakdown
  let bd = null;
  if (breakdown) {
    if (typeof breakdown === "string") {
      try { bd = JSON.parse(breakdown); } catch { bd = null; }
    } else { bd = breakdown; }
  }
  let hasRows = false;

  if (bd && bd.lineItems) {
    bd.lineItems.filter(i => i.description?.trim()).forEach(item => { hasRows = true; addRow(item.description, item.price); });
  }
  if (bd && bd.materialsCost && parseFloat(bd.materialsCost) > 0) { hasRows = true; addRow("Materials", bd.materialsCost); }
  if (bd && bd.labourHours && bd.labourRate) { hasRows = true; addRow("Labour (" + bd.labourHours + " hrs @ $" + bd.labourRate + "/hr)", parseFloat(bd.labourHours) * parseFloat(bd.labourRate)); }
  if (bd && bd.includeCallout && bd.calloutFee && parseFloat(bd.calloutFee) > 0) { hasRows = true; addRow("Callout Fee", bd.calloutFee); }
  if (invoice.is_deposit) { addRow("Deposit (" + (invoice.deposit_percentage || 0) + "%" + (invoice.linkedQuoteAmount ? " of " + fmtNZD(invoice.linkedQuoteAmount) : "") + ")", amount); hasRows = true; }
  if (!hasRows && !invoice.is_deposit) { addRow(invoice.job_title || "Services", amount); }

  y += 4;

  // ── Totals ──
  checkPage(30);
  const tx = pw - rm - 2, tl = pw - rm - 60;
  if (isGST) {
    txt(tl, y, "Subtotal (ex GST)", { size: 9, color: "#6b7280" }); txt(tx, y, fmtNZD(amount), { size: 9, color: "#111827", align: "right" }); y += 6;
    txt(tl, y, "GST (15%)", { size: 9, color: "#6b7280" }); txt(tx, y, fmtNZD(gst), { size: 9, color: "#111827", align: "right" }); y += 2;
    doc.setDrawColor("#111827"); doc.setLineWidth(0.5); doc.line(tl, y, pw - rm, y); y += 6;
  }
  txt(tl, y, isGST ? "Total (incl. GST)" : "Total", { size: 13, bold: true, color: "#111827" });
  txt(tx, y, fmtNZD(total), { size: 15, bold: true, color: "#14B8A6", align: "right" }); y += 6;

  if (invoice.is_deposit && invoice.linkedQuoteAmount) {
    txt(tl, y, "Balance remaining", { size: 8, color: "#9ca3af" });
    txt(tx, y, fmtNZD(parseFloat(invoice.linkedQuoteAmount) - amount), { size: 8, color: "#6b7280", align: "right" }); y += 5;
  }

  if (!isGST) { txt(lm, y, "This business is not registered for GST", { size: 7, color: "#9ca3af" }); y += 5; }
  y += 6;

  // ── Payment Details (teal box) ──
  if (business.bank_account_number) {
    checkPage(35);
    doc.setFillColor(240, 253, 250); doc.setDrawColor("#ccfbf1"); doc.setLineWidth(0.3);
    doc.roundedRect(lm, y - 2, cw, 34, 3, 3, "FD"); y += 3;
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor("#0d9488");
    doc.text("PAYMENT DETAILS", lm + 6, y); y += 5;
    const payRow = (lbl, val, bold) => { txt(lm + 6, y, lbl, { size: 9, color: "#6b7280" }); txt(pw - rm - 6, y, val, { size: 9, color: "#111827", align: "right", bold }); y += 5; };
    if (business.bank_name) payRow("Bank", business.bank_name);
    if (business.bank_account_name) payRow("Account Name", business.bank_account_name);
    payRow("Account Number", business.bank_account_number, true);
    payRow("Reference", invoice.invoice_number);
    y += 6;
  }

  // ── Payment Terms ──
  checkPage(15);
  txt(lm, y, "Payment Terms: " + (invoice.payment_terms || "7 days") + "  •  Due: " + fmtDate(invoice.due_date), { size: 8, color: "#6b7280" }); y += 8;

  // ── Notes ──
  if (invoice.notes) {
    checkPage(15); label("Notes");
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor("#6b7280");
    doc.splitTextToSize(invoice.notes, cw).forEach(line => { checkPage(4); doc.text(line, lm, y); y += 3.5; });
    y += 4;
  }

  // ── Custom footer from settings ──
  if (business.quote_footer) {
    checkPage(15);
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor("#6b7280");
    doc.splitTextToSize(business.quote_footer, cw).forEach(line => { checkPage(4); doc.text(line, lm, y); y += 3.5; });
    y += 4;
  }

  // ── Footer ──
  checkPage(20);
  doc.setDrawColor("#e5e7eb"); doc.setLineWidth(0.3); doc.line(lm, y, pw - rm, y); y += 6;
  txt(lm, y, "Thank you for your business", { size: 9, bold: true, color: "#374151" }); y += 4;
  txt(lm, y, business.business_name + (isGST ? "  •  GST: " + business.gst_number : ""), { size: 8, color: "#9ca3af" });
  txt(pw - rm, y, "Powered by Wynflow", { size: 7, color: "#9ca3af", align: "right" });

  return doc.output("blob");
};

const InvoiceBadge = ({ status, dueDate }) => {
  // Compute overdue display state
  const displayStatus = (status === "sent" || status === "viewed") && dueDate && new Date(dueDate) < new Date() ? "overdue" : status;
  const config = invoiceStatusConfig[displayStatus] || invoiceStatusConfig.draft;
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

const fonts = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Playfair+Display:wght@700;800&display=swap');`;

// ─── Utility Components ───
const Badge = ({ status, size = "md" }) => {
  const config = statusConfig[status] || statusConfig.pending;
  const isSm = size === "sm";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: isSm ? 4 : 5, padding: isSm ? "3px 8px" : "4px 10px",
      borderRadius: 6, fontSize: isSm ? 10 : 11, fontWeight: 600, letterSpacing: 0.3,
      color: config.color, background: config.bg, border: `1px solid ${config.color}15`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: config.color, flexShrink: 0 }} />
      {config.label}
    </span>
  );
};

const Button = ({ children, variant = "primary", size = "md", onClick, style = {}, disabled }) => {
  const base = {
    fontFamily: theme.font, fontWeight: 600, border: "none", cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 7,
    transition: "all 0.15s ease", opacity: disabled ? 0.5 : 1, letterSpacing: "0.01em",
    fontSize: size === "sm" ? 12 : size === "lg" ? 15 : 13,
    padding: size === "sm" ? "7px 14px" : size === "lg" ? "14px 28px" : "10px 20px",
  };
  const variants = {
    primary: { background: theme.accent, color: "#000", boxShadow: `0 0 16px ${theme.accentGlow}` },
    secondary: { background: "rgba(255,255,255,0.05)", color: "#F1F3F7", border: "1px solid rgba(255,255,255,0.08)" },
    ghost: { background: "transparent", color: theme.textMuted },
    danger: { background: theme.redSoft, color: theme.red, border: `1px solid ${theme.red}15` },
  };
  return <button onClick={onClick} disabled={disabled}
    onMouseEnter={e => { if (!disabled) { e.currentTarget.style.transform = "translateY(-1px)"; if (variant === "primary") e.currentTarget.style.boxShadow = `0 4px 20px ${theme.accentGlow}`; if (variant === "secondary") e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}}
    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; if (variant === "primary") e.currentTarget.style.boxShadow = `0 0 16px ${theme.accentGlow}`; if (variant === "secondary") e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
    style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
};

const Input = ({ label, value, onChange, type = "text", placeholder, textarea, style = {}, accept, onFileChange }) => {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === "password";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, ...style }}>
      {label && <label style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.35)", letterSpacing: 0.3 }}>{label}</label>}
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          style={{
            fontFamily: theme.font, fontSize: 14, padding: "10px 14px", borderRadius: 8,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#F1F3F7",
            outline: "none", resize: "vertical", minHeight: 100, transition: "border-color 0.15s ease",
          }} />
      ) : type === "file" ? (
        <input type="file" accept={accept} onChange={onFileChange}
          style={{
            fontFamily: theme.font, fontSize: 14, padding: "10px 14px", borderRadius: 8,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#F1F3F7", outline: "none",
          }} />
      ) : (
        <div style={{ position: "relative" }}>
          <input type={isPassword && showPw ? "text" : type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
            style={{
              fontFamily: theme.font, fontSize: 14, padding: "10px 14px", paddingRight: isPassword ? 42 : 14, borderRadius: 8,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#F1F3F7", outline: "none",
              transition: "border-color 0.15s ease", width: "100%", boxSizing: "border-box",
            }} />
          {isPassword && (
            <button type="button" onClick={() => setShowPw(!showPw)}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: "rgba(255,255,255,0.35)", fontSize: 12, fontFamily: theme.font }}>
              {showPw ? "Hide" : "Show"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12,
    padding: 20, transition: "all 0.2s ease", cursor: onClick ? "pointer" : "default", ...style,
  }}
  onMouseEnter={onClick ? (e) => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.2)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; } : undefined}
  onMouseLeave={onClick ? (e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; } : undefined}>
    {children}
  </div>
);

const Stat = ({ label, value, accent, icon: Icon, sub }) => {
  const mob = typeof window !== "undefined" && window.innerWidth < 768;
  return (
    <div style={{
      flex: 1, minWidth: 0, padding: mob ? 14 : 18, borderRadius: 10,
      background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)",
      transition: "border-color 0.2s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: mob ? 8 : 10 }}>
        {Icon && <div style={{ width: 28, height: 28, borderRadius: 7, background: accent ? `${accent}12` : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={14} color={accent || theme.textDim} /></div>}
        <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500, letterSpacing: "0.02em" }}>{label}</span>
      </div>
      <div style={{ fontSize: mob ? 20 : 24, fontWeight: 700, color: accent || theme.text, fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: theme.textDim, marginTop: 4 }}>{sub}</div>}
    </div>
  );
};

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
  const [hoveredLink, setHoveredLink] = useState(null);
  const isMobile = useIsMobile();
  useEffect(() => {
    if (!transparent) return;
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [transparent]);

  // Press feedback handlers (matches HomePage pattern)
  const pressDown = (e) => { e.currentTarget.style.transform = "scale(0.97)"; };
  const pressUp = (e) => { e.currentTarget.style.transform = "scale(1)"; };

  const navBg = transparent ? (scrolled ? "rgba(10,14,23,0.92)" : "transparent") : theme.surface;
  const navBorder = transparent ? (scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent") : "1px solid rgba(255,255,255,0.06)";
  const navLinks = [["home","Home"],["about","About"],["pricing","Pricing"]];

  return (
    <nav style={{ position: transparent ? "fixed" : "relative", top: 0, left: 0, right: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "16px 24px" : "16px 48px", background: navBg, borderBottom: navBorder, fontFamily: theme.font, backdropFilter: transparent && scrolled ? "blur(20px) saturate(180%)" : "none", WebkitBackdropFilter: transparent && scrolled ? "blur(20px) saturate(180%)" : "none", transition: "all 0.35s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{ cursor: "pointer", transition: "opacity 0.2s ease-out" }} onClick={() => dispatch({ type: "SET_SCREEN", payload: "home" })} onMouseEnter={e => e.currentTarget.style.opacity = "0.8"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
        <WynflowLogo size={38} showText textSize={22} />
      </div>
      {isMobile ? (
        <>
          <div onClick={() => setMenuOpen(!menuOpen)} style={{ color: theme.text, cursor: "pointer", padding: 8, borderRadius: 8, background: menuOpen ? "rgba(255,255,255,0.06)" : "transparent", transition: "all 0.2s ease-out" }}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </div>
          {menuOpen && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "rgba(10,14,23,0.98)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "24px 24px", display: "flex", flexDirection: "column", gap: 8, zIndex: 200, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
              {navLinks.map(([id, label], i) => (
                <span key={id} onClick={() => { dispatch({ type: "SET_SCREEN", payload: id }); setMenuOpen(false); }} style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: "12px 16px", borderRadius: 10, transition: "all 0.2s ease-out", opacity: 1, transform: "translateX(0)", animation: `navSlideIn 0.25s ease-out ${i * 0.06}s both` }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; e.currentTarget.style.background = "transparent"; }}>{label}</span>
              ))}
              <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)", margin: "8px 0" }} />
              <span onClick={() => { dispatch({ type: "SET_SCREEN", payload: "login" }); setMenuOpen(false); }} style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: "12px 16px", borderRadius: 10, transition: "all 0.2s ease-out", animation: `navSlideIn 0.25s ease-out ${navLinks.length * 0.06}s both` }}
                onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; e.currentTarget.style.background = "transparent"; }}>Log In</span>
              <button onClick={() => { dispatch({ type: "SET_SCREEN", payload: "signup" }); setMenuOpen(false); }}
                onMouseDown={pressDown} onMouseUp={pressUp}
                style={{ fontFamily: theme.font, fontSize: 15, fontWeight: 600, padding: "16px 24px", borderRadius: 10, background: theme.accent, color: "#000", border: "none", cursor: "pointer", transition: "all 0.2s ease-out", letterSpacing: "0.01em", marginTop: 8, boxShadow: "0 0 20px rgba(20,184,166,0.2)", animation: `navSlideIn 0.25s ease-out ${(navLinks.length + 1) * 0.06}s both` }}>
                Get Started Free
              </button>
              <style>{`@keyframes navSlideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }`}</style>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {navLinks.map(([id, label]) => (
            <span key={id} onClick={() => dispatch({ type: "SET_SCREEN", payload: id })}
              onMouseEnter={() => setHoveredLink(id)}
              onMouseLeave={() => setHoveredLink(null)}
              style={{ fontSize: 13, fontWeight: 500, color: hoveredLink === id ? theme.text : theme.textMuted, cursor: "pointer", transition: "color 0.2s ease-out", letterSpacing: "0.01em", position: "relative", paddingBottom: 4 }}>
              {label}
              <span style={{ position: "absolute", bottom: 0, left: "50%", transform: hoveredLink === id ? "translateX(-50%) scaleX(1)" : "translateX(-50%) scaleX(0)", width: "100%", height: 1.5, background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`, transition: "transform 0.2s ease-out", transformOrigin: "center" }} />
            </span>
          ))}
          <span onClick={() => dispatch({ type: "SET_SCREEN", payload: "login" })}
            onMouseEnter={(e) => { setHoveredLink("login"); e.currentTarget.style.color = theme.text; }}
            onMouseLeave={(e) => { setHoveredLink(null); e.currentTarget.style.color = theme.textMuted; }}
            style={{ fontSize: 13, fontWeight: 500, color: theme.textMuted, cursor: "pointer", transition: "color 0.2s ease-out", position: "relative", paddingBottom: 4 }}>
            Log In
            <span style={{ position: "absolute", bottom: 0, left: "50%", transform: hoveredLink === "login" ? "translateX(-50%) scaleX(1)" : "translateX(-50%) scaleX(0)", width: "100%", height: 1.5, background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`, transition: "transform 0.2s ease-out", transformOrigin: "center" }} />
          </span>
          <button onClick={() => dispatch({ type: "SET_SCREEN", payload: "signup" })}
            onMouseDown={pressDown} onMouseUp={pressUp}
            onMouseEnter={e => { e.currentTarget.style.background = "#5EEAD4"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(20,184,166,0.35)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = theme.accent; e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 0 20px rgba(20,184,166,0.2)"; }}
            style={{ fontFamily: theme.font, fontSize: 13, fontWeight: 600, padding: "8px 24px", borderRadius: 10, background: theme.accent, color: "#000", border: "none", cursor: "pointer", transition: "all 0.2s ease-out", letterSpacing: "0.01em", boxShadow: "0 0 20px rgba(20,184,166,0.2)" }}>
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
  <footer style={{ padding: isMobile ? "48px 24px 32px" : "80px 48px 40px", background: theme.bg, borderTop: "1px solid rgba(255,255,255,0.06)", fontFamily: theme.font, position: "relative", overflow: "hidden" }}>
    {/* Subtle gradient orb in background */}
    <div style={{ position: "absolute", bottom: "-30%", left: "50%", transform: "translateX(-50%)", width: "60%", height: "60%", background: "radial-gradient(circle, rgba(20,184,166,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />

    <div style={{ display: "flex", justifyContent: "space-between", maxWidth: 1100, margin: "0 auto", flexWrap: "wrap", gap: isMobile ? 32 : 56, flexDirection: isMobile ? "column" : "row", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 320 }}>
        <div style={{ marginBottom: 16 }}>
          <WynflowLogo size={28} showText textSize={17} />
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.75, margin: "0 0 24px" }}>AI-powered quoting and automated follow-ups for NZ tradies. Send quotes, chase customers, win more jobs — on autopilot.</p>
        {/* Trade-themed decorative element */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 100, background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.1)" }}>
          <Wrench size={13} color={theme.accent} strokeWidth={1.5} />
          <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(20,184,166,0.7)", letterSpacing: "0.04em" }}>Built for NZ tradies</span>
        </div>
      </div>
      <div>
        <h4 style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.12em" }}>Product</h4>
        {["home", "pricing", "about"].map(p => (
          <div key={p} onClick={() => dispatch({ type: "SET_SCREEN", payload: p })}
            style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", cursor: "pointer", marginBottom: 16, textTransform: "capitalize", transition: "all 0.2s ease-out", paddingLeft: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = theme.accent; e.currentTarget.style.paddingLeft = "4px"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; e.currentTarget.style.paddingLeft = "0px"; }}>{p}</div>
        ))}
      </div>
      <div>
        <h4 style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.12em" }}>Company</h4>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Globe size={13} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
          Auckland, New Zealand
        </div>
        <div style={{ fontSize: 14, color: theme.accent, transition: "all 0.2s ease-out", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
          onMouseEnter={e => { e.currentTarget.style.color = "#5EEAD4"; e.currentTarget.style.paddingLeft = "4px"; }}
          onMouseLeave={e => { e.currentTarget.style.color = theme.accent; e.currentTarget.style.paddingLeft = "0px"; }}>
          <Mail size={13} strokeWidth={1.5} />
          jesse@wynflow.co.nz
        </div>
      </div>
    </div>

    {/* Bottom bar with gradient divider */}
    <div style={{ maxWidth: 1100, margin: "48px auto 0", position: "relative", zIndex: 1 }}>
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(20,184,166,0.2), rgba(255,255,255,0.06), rgba(20,184,166,0.2), transparent)" }} />
      <div style={{ paddingTop: 24, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.2)", letterSpacing: "0.03em" }}>
        2026 Wynflow. All rights reserved.
      </div>
      <p style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.12)", marginTop: 12, lineHeight: 1.6, maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}>
        AI-generated quotes are estimates only and should be reviewed before sending. Wynflow is a quoting tool — all quotes, pricing, and business decisions remain the responsibility of the business owner. Wynflow accepts no liability for the accuracy of AI-generated content.
      </p>
    </div>
  </footer>
  );
};

const EmailPreviewModal = ({ onClose }) => {
  const isMobile = useIsMobile();
  return (
    <div onClick={onClose} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
        <div style={{ background: "#ffffff", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ background: "#ffffff", padding: "32px 32px", textAlign: "center", borderBottom: "3px solid #14B8A6" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><WynflowLogo size={36} showText textSize={20} textColor="#0A0E17" /></div>
            <h1 style={{ color: "#0A0E17", margin: 0, fontSize: 22, fontWeight: 700 }}>Quote from Smith's Plumbing</h1>
          </div>
          <div style={{ padding: 32 }}>
            <p style={{ fontSize: 16, color: "#374151", margin: "0 0 8px" }}>Hi Sarah,</p>
            <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.6, margin: "0 0 24px" }}>Please find attached our quote for <strong>Bathroom Renovation</strong>.</p>
            <div style={{ background: "#f9fafb", borderRadius: 10, padding: 24, margin: "0 0 24px" }}>
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

// ─── Product Demo Walkthrough ───
const ProductDemo = () => {
  const isMobile = useIsMobile();
  const [active, setActive] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const demoSteps = [
    { label: "Snap Photos", icon: Camera, accent: "#14B8A6" },
    { label: "AI Quote", icon: Sparkles, accent: "#8B5CF6" },
    { label: "Send Email", icon: Send, accent: "#3B82F6" },
    { label: "Follow-Up", icon: RefreshCw, accent: "#F59E0B" },
    { label: "Get Paid", icon: Receipt, accent: "#22C55E" },
  ];

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => setActive(p => (p + 1) % 5), 4000);
    return () => clearInterval(timer);
  }, [isAutoPlaying]);

  const handleStepClick = (i) => { setActive(i); setIsAutoPlaying(false); };

  const screens = [
    // Step 1: Snap Photos
    <div key="photos" style={{ padding: isMobile ? 16 : 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>Step 1 — On Site</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { caption: "Bathroom — tiled, no vanity yet", img: "/demo-photo-1.jpg" },
          { caption: "Exposed pipework — hot & cold roughed in", img: "/demo-photo-2.jpg" },
          { caption: "Bath surround — tiling complete", img: "/demo-photo-3.jpg" },
          { caption: "Ceiling & walls — gibbed, ready for paint", img: "/demo-photo-4.jpg" },
        ].map((photo, i) => (
          <div key={i} style={{ borderRadius: 10, overflow: "hidden", position: "relative" }}>
            <img src={photo.img} alt={photo.caption} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} loading="lazy" />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 8px", background: "linear-gradient(transparent, rgba(0,0,0,0.7))", fontSize: 10, color: "rgba(255,255,255,0.7)" }}>{photo.caption}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 8, fontWeight: 500 }}>Job Notes</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>Bathroom reno — replace vanity, fix water damage to subfloor, install new mixer tap. Tight access behind wall panel. Customer wants it done within 2 weeks.</div>
      </div>
    </div>,

    // Step 2: AI Quote
    <div key="quote" style={{ padding: isMobile ? 16 : 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#8B5CF6" }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>Step 2 — AI generates your quote</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Quote #WF-0047</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>Bathroom Renovation — Smith Residence</div>
        </div>
        <div style={{ padding: "4px 12px", borderRadius: 20, background: "rgba(139,92,246,0.15)", color: "#8B5CF6", fontSize: 11, fontWeight: 600 }}>AI Generated</div>
      </div>
      {[
        { item: "Remove existing vanity & dispose", qty: "1", price: "$180" },
        { item: "Repair water-damaged subfloor", qty: "1.5m\u00B2", price: "$420" },
        { item: "Supply & install new vanity unit", qty: "1", price: "$1,850" },
        { item: "Supply & install mixer tap", qty: "1", price: "$380" },
        { item: "Labour — plumbing & fitout", qty: "6 hrs", price: "$510" },
      ].map((row, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{row.item}</div>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", width: 60, textAlign: "center" }}>{row.qty}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", width: 70, textAlign: "right" }}>{row.price}</div>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>Total (incl. GST)</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#14B8A6" }}>$3,340.00</span>
      </div>
    </div>,

    // Step 3: Send Email
    <div key="email" style={{ padding: isMobile ? 16 : 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3B82F6" }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>Step 3 — Customer receives email</span>
      </div>
      <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "16px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
          <Mail size={14} color="rgba(255,255,255,0.3)" />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>From: <span style={{ color: "rgba(255,255,255,0.6)" }}>quotes@wynflow.co.nz</span></span>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 16 }}>Your quote for Bathroom Renovation</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 24 }}>
            Hi Sarah,<br /><br />
            Thanks for having me out to take a look at the bathroom. I've put together a detailed quote for the work we discussed — vanity replacement, subfloor repair, and new mixer tap.<br /><br />
            <strong style={{ color: "rgba(255,255,255,0.7)" }}>Total: $3,340.00 (incl. GST)</strong>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, padding: "12px 16px", borderRadius: 8, background: "#22C55E", textAlign: "center", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "default" }}>Accept Quote</div>
            <div style={{ flex: 1, padding: "12px 16px", borderRadius: 8, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.2)", textAlign: "center", fontSize: 14, fontWeight: 600, color: "#EF4444", cursor: "default" }}>Decline</div>
          </div>
        </div>
      </div>
    </div>,

    // Step 4: Auto Follow-up
    <div key="followup" style={{ padding: isMobile ? 16 : 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B" }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>Step 4 — Wynflow chases for you</span>
      </div>
      <div style={{ position: "relative", paddingLeft: 24 }}>
        <div style={{ position: "absolute", left: 7, top: 8, bottom: 8, width: 2, background: "linear-gradient(to bottom, rgba(245,158,11,0.4), rgba(245,158,11,0.05))" }} />
        {[
          { day: "Day 0", title: "Quote sent", desc: "Bathroom Renovation — $3,340", status: "sent", color: "#3B82F6" },
          { day: "Day 1", title: "Email opened", desc: "Sarah opened your quote at 8:14am", status: "opened", color: "#8B5CF6" },
          { day: "Day 3", title: "Follow-up #1 sent", desc: "\"Hi Sarah, just checking in on the quote I sent through...\"", status: "auto", color: "#F59E0B" },
          { day: "Day 6", title: "Follow-up #2 sent", desc: "\"Any questions about the bathroom quote?\"", status: "auto", color: "#F59E0B" },
          { day: "Day 7", title: "Quote accepted!", desc: "Sarah clicked Accept — time to book the job", status: "won", color: "#22C55E" },
        ].map((event, i) => (
          <div key={i} style={{ display: "flex", gap: 16, marginBottom: i < 4 ? 24 : 0, position: "relative" }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: event.color, border: "3px solid #0A0E17", position: "absolute", left: -24, top: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {event.status === "won" && <Check size={8} color="#fff" strokeWidth={3} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600, minWidth: 40 }}>{event.day}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: event.status === "won" ? "#22C55E" : "#fff" }}>{event.title}</span>
                {event.status === "auto" && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(245,158,11,0.12)", color: "#F59E0B", fontWeight: 600 }}>AUTO</span>}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{event.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>,

    // Step 5: Get Paid
    <div key="invoice" style={{ padding: isMobile ? 16 : 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>Step 5 — Job done, get paid</span>
      </div>
      <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>INVOICE #INV-0023</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>Bathroom Renovation</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Sarah Smith • 14 March 2026</div>
          </div>
          <div style={{ padding: "4px 12px", borderRadius: 20, background: "rgba(34,197,94,0.12)", color: "#22C55E", fontSize: 11, fontWeight: 600 }}>Paid</div>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 0 16px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Subtotal</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>$2,904.35</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>GST (15%)</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>$435.65</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Total Paid</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#22C55E" }}>$3,340.00</span>
        </div>
        <div style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.1)", display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={14} color="#22C55E" />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Payment received via bank transfer • 20 March 2026</span>
        </div>
      </div>
    </div>,
  ];

  return (
    <div style={{ padding: isMobile ? "80px 24px" : "120px 48px", position: "relative" }}>
      <div style={{ position: "absolute", top: "30%", left: "-10%", width: "40%", height: "50%", background: `radial-gradient(circle, ${demoSteps[active].accent}11 0%, transparent 70%)`, pointerEvents: "none", transition: "background 0.6s ease" }} />
      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: isMobile ? 40 : 56 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 16 }}>See it in action</p>
            <h2 style={{ fontSize: isMobile ? 28 : 44, fontWeight: 700, color: "#FFFFFF", marginBottom: 16, fontFamily: theme.font, letterSpacing: "-0.03em", lineHeight: 1.15 }}>From photos to payment<br />in five steps</h2>
          </div>
        </FadeIn>

        <div style={{ display: "flex", gap: isMobile ? 4 : 8, marginBottom: isMobile ? 24 : 32, justifyContent: "center", flexWrap: "wrap" }}>
          {demoSteps.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === active;
            return (
              <button key={i} onClick={() => handleStepClick(i)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "8px 16px" : "8px 16px", borderRadius: 10,
                  background: isActive ? `${step.accent}18` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isActive ? `${step.accent}40` : "rgba(255,255,255,0.06)"}`,
                  color: isActive ? step.accent : "rgba(255,255,255,0.4)",
                  cursor: "pointer", transition: "all 0.3s ease", fontFamily: theme.font, fontSize: isMobile ? 11 : 13, fontWeight: 600,
                  transform: isActive ? "translateY(-2px)" : "none",
                  boxShadow: isActive ? `0 4px 20px ${step.accent}20` : "none",
                }}>
                <Icon size={isMobile ? 12 : 14} strokeWidth={2} />
                {step.label}
              </button>
            );
          })}
        </div>

        <div style={{ maxWidth: 600, margin: "0 auto 24px", height: 2, background: "rgba(255,255,255,0.04)", borderRadius: 1, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${((active + 1) / 5) * 100}%`, background: `linear-gradient(90deg, ${demoSteps[0].accent}, ${demoSteps[active].accent})`, borderRadius: 1, transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)" }} />
        </div>

        <div style={{ maxWidth: 600, margin: "0 auto", position: "relative" }}>
          <div style={{
            borderRadius: 16, overflow: "hidden",
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${demoSteps[active].accent}25`,
            boxShadow: `0 0 80px ${demoSteps[active].accent}08, 0 20px 60px rgba(0,0,0,0.3)`,
            transition: "border-color 0.6s ease, box-shadow 0.6s ease",
          }}>
            <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginLeft: 8 }}>wynflow.co.nz</span>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <WynflowLogo size={16} showText textSize={11} textColor="rgba(255,255,255,0.35)" />
              </div>
            </div>

            <div style={{ minHeight: isMobile ? 320 : 380, position: "relative" }}>
              {screens.map((screen, i) => (
                <div key={i} style={{
                  position: i === active ? "relative" : "absolute",
                  top: 0, left: 0, right: 0,
                  opacity: i === active ? 1 : 0,
                  transform: i === active ? "translateX(0)" : i < active ? "translateX(-20px)" : "translateX(20px)",
                  transition: "opacity 0.4s ease, transform 0.4s ease",
                  pointerEvents: i === active ? "auto" : "none",
                }}>
                  {screen}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const HomePage = ({ dispatch }) => {
  const isMobile = useIsMobile();

  // Animated counter hook — counts from 0 to target over ~2s when visible
  const useCounter = (target, suffix = "", duration = 2000) => {
    const [ref, isVisible] = useInView(0.3);
    const [count, setCount] = useState(0);
    const [hasRun, setHasRun] = useState(false);
    useEffect(() => {
      if (!isVisible || hasRun) return;
      setHasRun(true);
      const startTime = Date.now();
      const tick = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, [isVisible, hasRun, target, duration]);
    return [ref, count, suffix];
  };

  // Bento grid features — 4 cards in asymmetric layout
  const features = [
    { Icon: Cpu, title: "AI Quote Generation", desc: "Snap photos on site, add your notes, and get an accurate itemised quote in seconds. Materials, labour, scope — all handled by AI trained on your trade.", large: true, stat: "< 30 sec", statLabel: "avg quote time" },
    { Icon: RefreshCw, title: "Automated Follow-ups", desc: "Wynflow chases your customers on autopilot — day 2, day 5, day 10. Personalised emails that sound like you.", large: false },
    { Icon: Globe, title: "Live Quote Request Link", desc: "Share your personal link on socials, Google Business, or your website. Customers request quotes directly — no phone tag.", large: false },
    { Icon: BarChart3, title: "Analytics & Feedback", desc: "Track conversion rates, revenue, and response times. When customers decline, they tell you why — so you can adjust pricing and win more next time.", large: true, stat: "2x", statLabel: "more jobs won" },
  ];

  const steps = [
    { num: "01", Icon: Camera, title: "Snap Photos & Add Notes", desc: "Take photos on site and add your notes — access issues, customer preferences, anything relevant. Wynflow's AI analyses everything to generate an accurate, itemised quote." },
    { num: "02", Icon: Send, title: "Review & Send", desc: "Check the AI-generated quote, tweak anything you want, and hit send. Your customer gets a professional email with one-click Accept or Decline buttons." },
    { num: "03", Icon: Bot, title: "Auto Follow-Ups", desc: "If they don't respond, Wynflow chases automatically. Personalised emails that sound like you, not a robot. You're on the tools, not on your phone." },
  ];

  // Stats strip data
  const [statRef1, count1] = useCounter(100000, "+");
  const [statRef2, count2] = useCounter(73, "%");
  const [statRef3, count3] = useCounter(2, "x");

  // Button press handlers
  const pressDown = (e) => { e.currentTarget.style.transform = "scale(0.97)"; };
  const pressUp = (e) => { e.currentTarget.style.transform = "scale(1)"; };

  return (
  <div style={{ background: theme.bg, overflowX: "hidden" }}>

    {/* ── Keyframe animations ── */}
    <style>{`
      @keyframes spin-slow { to { transform: rotate(360deg) } }
      @keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
      @keyframes float-delayed { 0%,100% { transform: translateY(-5px) } 50% { transform: translateY(5px) } }
      @keyframes pulse-glow { 0%,100% { opacity: 0.6 } 50% { opacity: 1 } }
      @keyframes timeline-dot { 0%,100% { box-shadow: 0 0 0 0 rgba(20,184,166,0.4) } 50% { box-shadow: 0 0 0 8px rgba(20,184,166,0) } }
    `}</style>

    {/* ── Hero ── */}
    <div style={{ position: "relative", minHeight: isMobile ? "auto" : "100vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: isMobile ? "120px 24px 80px" : "160px 48px 120px" }}>
      {/* Gradient orbs */}
      <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "60%", height: "60%", background: "radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "50%", height: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Floating trade tool icons */}
      {!isMobile && <>
        <div style={{ position: "absolute", top: "18%", left: "8%", animation: "float 6s ease-in-out infinite", pointerEvents: "none", opacity: 0.12 }}>
          <Wrench size={48} color={theme.accent} strokeWidth={1} />
        </div>
        <div style={{ position: "absolute", top: "30%", right: "10%", animation: "float-delayed 7s ease-in-out infinite", pointerEvents: "none", opacity: 0.08 }}>
          <Camera size={40} color={theme.accent} strokeWidth={1} />
        </div>
        <div style={{ position: "absolute", bottom: "25%", left: "12%", animation: "float 8s ease-in-out infinite 1s", pointerEvents: "none", opacity: 0.06 }}>
          <Zap size={36} color="#5EEAD4" strokeWidth={1} />
        </div>
      </>}

      <div style={{ maxWidth: 720, position: "relative", zIndex: 1 }}>
        <FadeIn>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 100, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)", marginBottom: isMobile ? 24 : 32 }}>
            <Wrench size={14} color={theme.accent} style={{ animation: "spin-slow 8s linear infinite" }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: theme.accent, letterSpacing: "0.02em" }}>AI-Powered Quoting for NZ Tradies</span>
          </div>
        </FadeIn>
        <FadeIn delay={0.08}>
          <h1 style={{ fontSize: isMobile ? 40 : 72, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.05, marginBottom: isMobile ? 24 : 32, fontFamily: theme.font, letterSpacing: "-0.03em" }}>
            Quote Faster. Chase Smarter.<br /><span style={{ background: `linear-gradient(135deg, ${theme.accent}, #5EEAD4)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Win More Jobs.</span>
          </h1>
        </FadeIn>
        <FadeIn delay={0.16}>
          <p style={{ fontSize: isMobile ? 16 : 19, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: 560, margin: "0 auto 48px", fontWeight: 400, letterSpacing: "0.01em" }}>Wynflow's AI generates accurate quotes from your job site photos and notes — scope, materials, labour, the lot. Then automated follow-ups chase your customers until they say yes. You stay on the tools, we handle the paperwork.</p>
        </FadeIn>
        <FadeIn delay={0.24}>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexDirection: isMobile ? "column" : "row", alignItems: "center" }}>
            <button onClick={() => dispatch({ type: "SET_SCREEN", payload: "signup" })}
              onMouseDown={pressDown} onMouseUp={pressUp}
              onMouseEnter={e => { e.currentTarget.style.background = "#5EEAD4"; e.currentTarget.style.boxShadow = "0 4px 32px rgba(20,184,166,0.4), 0 0 80px rgba(20,184,166,0.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = theme.accent; e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 0 24px rgba(20,184,166,0.3), 0 0 60px rgba(20,184,166,0.1)"; }}
              style={{ fontFamily: theme.font, fontSize: 15, fontWeight: 600, padding: isMobile ? "16px 32px" : "16px 40px", borderRadius: 10, background: theme.accent, color: "#000", border: "none", cursor: "pointer", transition: "all 0.2s ease-out", boxShadow: "0 0 24px rgba(20,184,166,0.3), 0 0 60px rgba(20,184,166,0.1)", letterSpacing: "0.01em", width: isMobile ? "100%" : "auto" }}>
              Start Free Trial
              <ArrowRight size={16} style={{ display: "inline", verticalAlign: "middle", marginLeft: 8 }} />
            </button>
            <button onClick={() => dispatch({ type: "SET_SCREEN", payload: "pricing" })}
              onMouseDown={pressDown} onMouseUp={pressUp}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "scale(1)"; }}
              style={{ fontFamily: theme.font, fontSize: 15, fontWeight: 500, padding: isMobile ? "16px 32px" : "16px 40px", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", transition: "all 0.2s ease-out", letterSpacing: "0.01em", width: isMobile ? "100%" : "auto" }}>
              View Pricing
            </button>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 24, letterSpacing: "0.04em" }}>No credit card required  ·  14-day free trial  ·  Cancel anytime</p>
        </FadeIn>
      </div>

      {/* Bottom gradient fade */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 120, background: "linear-gradient(to bottom, transparent, #0A0E17)", pointerEvents: "none" }} />
    </div>

    {/* ── Divider line ── */}
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 48px" }}>
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(20,184,166,0.3), transparent)" }} />
    </div>

    {/* ── Product Demo ── */}
    <ProductDemo />

    {/* ── Divider ── */}
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 48px" }}>
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
    </div>

    {/* ── Features Bento Grid ── */}
    <div style={{ padding: isMobile ? "80px 24px" : "120px 48px", position: "relative" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: isMobile ? 48 : 72 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 16 }}>Features</p>
            <h2 style={{ fontSize: isMobile ? 30 : 44, fontWeight: 700, color: "#FFFFFF", marginBottom: 16, fontFamily: theme.font, letterSpacing: "-0.03em", lineHeight: 1.15 }}>Everything you need to<br />win more jobs</h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "rgba(255,255,255,0.45)", maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>AI smarts meets tradie simplicity. No complicated setup, no fluff.</p>
          </div>
        </FadeIn>

        {/* Top row: large left, small right */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: isMobile ? 16 : 24, marginBottom: isMobile ? 16 : 24 }}>
          {features.slice(0, 2).map((f, i) => {
            const FIcon = f.Icon;
            return (
              <FadeIn key={i} delay={0.05 * i}>
                <div style={{ padding: isMobile ? 24 : 32, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", transition: "all 0.2s ease-out", height: "100%", cursor: "default", position: "relative", overflow: "hidden" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(20,184,166,0.25)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
                    <FIcon size={22} color={theme.accent} strokeWidth={1.5} />
                  </div>
                  <h3 style={{ fontSize: isMobile ? 17 : 19, fontWeight: 600, color: "#FFFFFF", marginBottom: 8, fontFamily: theme.font, letterSpacing: "-0.01em" }}>{f.title}</h3>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.65, margin: 0, maxWidth: f.large ? 440 : 320 }}>{f.desc}</p>
                  {/* Large card extra visual: stat badge */}
                  {f.large && f.stat && (
                    <div style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 16, padding: "16px 24px", borderRadius: 12, background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.12)" }}>
                      <span style={{ fontSize: 28, fontWeight: 700, color: theme.accent, fontFamily: theme.font, letterSpacing: "-0.02em" }}>{f.stat}</span>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.3 }}>{f.statLabel}</span>
                    </div>
                  )}
                </div>
              </FadeIn>
            );
          })}
        </div>

        {/* Bottom row: small left, large right */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr", gap: isMobile ? 16 : 24 }}>
          {features.slice(2, 4).map((f, i) => {
            const FIcon = f.Icon;
            return (
              <FadeIn key={i + 2} delay={0.05 * (i + 2)}>
                <div style={{ padding: isMobile ? 24 : 32, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", transition: "all 0.2s ease-out", height: "100%", cursor: "default", position: "relative", overflow: "hidden" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(20,184,166,0.25)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
                    <FIcon size={22} color={theme.accent} strokeWidth={1.5} />
                  </div>
                  <h3 style={{ fontSize: isMobile ? 17 : 19, fontWeight: 600, color: "#FFFFFF", marginBottom: 8, fontFamily: theme.font, letterSpacing: "-0.01em" }}>{f.title}</h3>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.65, margin: 0, maxWidth: f.large ? 440 : 320 }}>{f.desc}</p>
                  {f.large && f.stat && (
                    <div style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 16, padding: "16px 24px", borderRadius: 12, background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.12)" }}>
                      <span style={{ fontSize: 28, fontWeight: 700, color: theme.accent, fontFamily: theme.font, letterSpacing: "-0.02em" }}>{f.stat}</span>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.3 }}>{f.statLabel}</span>
                    </div>
                  )}
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

    {/* ── Social Proof / Stats Strip ── */}
    <div style={{ padding: isMobile ? "64px 24px" : "80px 48px", position: "relative" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: isMobile ? 32 : 48, textAlign: "center" }}>
          {/* Stat 1 */}
          <FadeIn delay={0}>
            <div ref={statRef1}>
              <div style={{ fontSize: isMobile ? 40 : 52, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font, letterSpacing: "-0.03em", lineHeight: 1 }}>
                {count1.toLocaleString()}+
              </div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginTop: 8, lineHeight: 1.5 }}>Businesses need<br />better quoting</p>
            </div>
          </FadeIn>

          {/* Stat 2 */}
          <FadeIn delay={0.05}>
            <div ref={statRef2} style={{ position: "relative" }}>
              {!isMobile && <div style={{ position: "absolute", left: 0, top: "10%", bottom: "10%", width: 1, background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.08), transparent)" }} />}
              <div style={{ fontSize: isMobile ? 40 : 52, fontWeight: 700, color: theme.accent, fontFamily: theme.font, letterSpacing: "-0.03em", lineHeight: 1 }}>
                {count2}%
              </div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginTop: 8, lineHeight: 1.5 }}>of quotes go unfollowed<br />— jobs lost to silence</p>
              {!isMobile && <div style={{ position: "absolute", right: 0, top: "10%", bottom: "10%", width: 1, background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.08), transparent)" }} />}
            </div>
          </FadeIn>

          {/* Stat 3 */}
          <FadeIn delay={0.1}>
            <div ref={statRef3}>
              <div style={{ fontSize: isMobile ? 40 : 52, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font, letterSpacing: "-0.03em", lineHeight: 1 }}>
                {count3}x
              </div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginTop: 8, lineHeight: 1.5 }}>more jobs won<br />with automated follow-ups</p>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>

    {/* ── Divider ── */}
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 48px" }}>
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
    </div>

    {/* ── How It Works — Horizontal Timeline ── */}
    <div style={{ padding: isMobile ? "80px 24px" : "120px 48px", position: "relative" }}>
      {/* Subtle gradient orb */}
      <div style={{ position: "absolute", top: "20%", right: "-5%", width: "40%", height: "60%", background: "radial-gradient(circle, rgba(20,184,166,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: isMobile ? 48 : 72 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 16 }}>How it works</p>
            <h2 style={{ fontSize: isMobile ? 30 : 44, fontWeight: 700, color: "#FFFFFF", marginBottom: 16, fontFamily: theme.font, letterSpacing: "-0.03em", lineHeight: 1.15 }}>From site visit to signed quote<br />in minutes — not hours</h2>
          </div>
        </FadeIn>

        {isMobile ? (
          /* Mobile: vertical timeline */
          <div style={{ position: "relative", paddingLeft: 32 }}>
            {/* Vertical line */}
            <div style={{ position: "absolute", left: 11, top: 0, bottom: 0, width: 2, background: "linear-gradient(180deg, rgba(20,184,166,0.3), rgba(20,184,166,0.05))" }} />
            {steps.map((step, i) => {
              const StepIcon = step.Icon;
              return (
                <FadeIn key={i} delay={0.1 * i}>
                  <div style={{ position: "relative", marginBottom: i < steps.length - 1 ? 32 : 0 }}>
                    {/* Timeline dot */}
                    <div style={{ position: "absolute", left: -32, top: 0, width: 24, height: 24, borderRadius: "50%", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(20,184,166,0.4)", animation: "timeline-dot 3s ease-in-out infinite", animationDelay: `${i * 0.5}s` }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: theme.accent }} />
                    </div>
                    <div style={{ padding: 24, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: theme.accent, fontFamily: theme.font }}>{step.num}</span>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <StepIcon size={18} color={theme.accent} strokeWidth={1.5} />
                        </div>
                      </div>
                      <h3 style={{ fontSize: 18, fontWeight: 600, color: "#FFFFFF", marginBottom: 8, fontFamily: theme.font, letterSpacing: "-0.01em" }}>{step.title}</h3>
                      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, margin: 0 }}>{step.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        ) : (
          /* Desktop: horizontal timeline */
          <div style={{ position: "relative" }}>
            {/* Horizontal connecting line */}
            <div style={{ position: "absolute", top: 36, left: "8%", right: "8%", height: 2, background: "linear-gradient(90deg, rgba(20,184,166,0.05), rgba(20,184,166,0.3), rgba(20,184,166,0.3), rgba(20,184,166,0.05))", zIndex: 0 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 32, position: "relative", zIndex: 1 }}>
              {steps.map((step, i) => {
                const StepIcon = step.Icon;
                return (
                  <FadeIn key={i} delay={0.12 * i}>
                    <div style={{ textAlign: "center" }}>
                      {/* Number badge with animated dot */}
                      <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(10,14,23,0.95)", border: "2px solid rgba(20,184,166,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 32px", position: "relative", animation: "timeline-dot 3s ease-in-out infinite", animationDelay: `${i * 0.6}s` }}>
                        <span style={{ fontSize: 22, fontWeight: 700, color: theme.accent, fontFamily: theme.font }}>{step.num}</span>
                      </div>
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                        <StepIcon size={22} color={theme.accent} strokeWidth={1.5} />
                      </div>
                      <h3 style={{ fontSize: 20, fontWeight: 600, color: "#FFFFFF", marginBottom: 8, fontFamily: theme.font, letterSpacing: "-0.01em" }}>{step.title}</h3>
                      <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, margin: 0, maxWidth: 300, marginLeft: "auto", marginRight: "auto" }}>{step.desc}</p>
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ── CTA ── */}
    <div style={{ padding: isMobile ? "80px 24px" : "120px 48px", textAlign: "center", position: "relative" }}>
      {/* Glow behind CTA */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "80%", height: "80%", background: "radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 60%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto" }}>
        <FadeIn>
          <div style={{ padding: isMobile ? "48px 24px" : "72px 64px", borderRadius: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {/* Pulsing wrench icon */}
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 16, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)", marginBottom: 24, animation: "pulse-glow 3s ease-in-out infinite" }}>
              <Wrench size={26} color={theme.accent} strokeWidth={1.5} style={{ animation: "spin-slow 10s linear infinite" }} />
            </div>
            <h2 style={{ fontSize: isMobile ? 28 : 40, fontWeight: 700, color: "#FFFFFF", marginBottom: 16, fontFamily: theme.font, letterSpacing: "-0.03em", lineHeight: 1.15 }}>Snap a Photo. Get a Quote.<br />Win the Job.</h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "rgba(255,255,255,0.45)", marginBottom: 16, lineHeight: 1.6 }}>Join NZ tradies using AI to turn job site photos and notes into accurate quotes in minutes — then close more jobs on autopilot.</p>
            <p style={{ fontSize: 13, color: "rgba(20,184,166,0.6)", marginBottom: 32, fontWeight: 500 }}>Built for tradies, by a Kiwi who gets it.</p>
            <button onClick={() => dispatch({ type: "SET_SCREEN", payload: "signup" })}
              onMouseDown={pressDown} onMouseUp={pressUp}
              onMouseEnter={e => { e.currentTarget.style.background = "#5EEAD4"; e.currentTarget.style.boxShadow = "0 4px 32px rgba(20,184,166,0.4), 0 0 80px rgba(20,184,166,0.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = theme.accent; e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 0 24px rgba(20,184,166,0.3), 0 0 60px rgba(20,184,166,0.1)"; }}
              style={{ fontFamily: theme.font, fontSize: 15, fontWeight: 600, padding: "16px 40px", borderRadius: 10, background: theme.accent, color: "#000", border: "none", cursor: "pointer", transition: "all 0.2s ease-out", boxShadow: "0 0 24px rgba(20,184,166,0.3), 0 0 60px rgba(20,184,166,0.1)", letterSpacing: "0.01em" }}>
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
      if (!res.ok) {
        setError("Something went wrong — please try again or contact the business directly.");
        return;
      }
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
            <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.text, margin: "0 0 16px", fontFamily: theme.fontDisplay }}>Request Sent!</h1>
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
        <div style={{ padding: "32px 32px", textAlign: "center", borderBottom: `3px solid ${theme.accent}` }}>
          <div style={{ display: "flex", justifyContent: "center" }}><WynflowLogo size={36} showText textSize={22} textColor="#0A0E17" /></div>
          {businessName && <h1 style={{ fontSize: 20, fontWeight: 700, color: theme.text, margin: "16px 0 0", fontFamily: theme.fontDisplay }}>Request a Quote from {businessName}</h1>}
          <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 8 }}>Fill in your details, add photos if you can, and we'll get back to you</p>
        </div>
        <div style={{ padding: isMobile ? 24 : 32 }}>
          {error && error !== "Business not found" && <div style={{ padding: "8px 16px", borderRadius: 8, background: theme.redSoft, color: theme.red, fontSize: 13, marginBottom: 16 }}>{error}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Your Name *" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Kim Smith" />
            <Input label="Email *" value={form.email} onChange={v => setForm({ ...form, email: v })} type="email" placeholder="e.g. kim@email.com" />
            <Input label="Phone *" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="e.g. 021 123 4567" />
            <Input label="What do you need done? *" value={form.jobTitle} onChange={v => setForm({ ...form, jobTitle: v })} placeholder="e.g. Bathroom renovation, fix leaking tap, etc." />
            <Input label="Extra details *" value={form.description} onChange={v => setForm({ ...form, description: v })} textarea placeholder="e.g. Size of area, urgency, specific requirements..." />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: theme.textMuted, marginBottom: 8 }}>Photos (optional, up to 5)</div>
              <p style={{ fontSize: 12, color: theme.textDim, margin: "0 0 8px" }}>Photos help us scope the job and get you a more accurate quote faster</p>
              {photoPreviews.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: photoPreviews.length === 1 ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {photoPreviews.map((src, i) => (
                    <div key={i} style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: `1px solid ${theme.border}`, aspectRatio: "4/3" }}>
                      <img src={src} alt={`Photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length < 5 && (
                <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "16px 24px", borderRadius: 12, border: `2px dashed ${theme.border}`, cursor: "pointer", color: theme.textMuted, fontSize: 14, transition: "border-color 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = theme.accent}
                  onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}>
                  <Upload size={18} /> {photos.length > 0 ? "Add More Photos" : "Add Photos"}
                  <input type="file" accept="image/*" multiple onChange={handlePhotoAdd} style={{ display: "none" }} />
                </label>
              )}
            </div>
            <Button onClick={handleSubmit} disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "16px 24px", marginTop: 8 }}>
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

  // Animated counter hook — counts from 0 to target over ~2s when visible
  const useCounter = (target, suffix = "", duration = 2000) => {
    const [ref, isVisible] = useInView(0.3);
    const [count, setCount] = useState(0);
    const [hasRun, setHasRun] = useState(false);
    useEffect(() => {
      if (!isVisible || hasRun) return;
      setHasRun(true);
      const startTime = Date.now();
      const tick = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, [isVisible, hasRun, target, duration]);
    return [ref, count, suffix];
  };

  // Button press handlers
  const pressDown = (e) => { e.currentTarget.style.transform = "scale(0.97)"; };
  const pressUp = (e) => { e.currentTarget.style.transform = "scale(1)"; };

  // Animated counters for stats
  const [statRef1, count1] = useCounter(2, "%");
  const [statRef2, count2] = useCounter(80, "%");
  const [statRef3, count3] = useCounter(44, "%");
  const [statRef4, count4] = useCounter(50, "%");
  const [statRef5, count5] = useCounter(70, "%");

  const stats = [
    { value: count1, suffix: "%", label: "of sales happen on first contact", color: theme.red, ref: statRef1 },
    { value: count2, suffix: "%", label: "of deals need 5+ follow-ups to close", color: theme.accent, ref: statRef2 },
    { value: count3, suffix: "%", label: "of salespeople give up after just one follow-up", color: theme.red, ref: statRef3 },
    { value: count4, suffix: "%", label: "boost in replies from just one follow-up email", color: theme.green, ref: statRef4 },
  ];

  return (
  <div style={{ background: theme.bg, overflowX: "hidden" }}>

    {/* Keyframe animations */}
    <style>{`
      @keyframes about-spin-slow { to { transform: rotate(360deg) } }
      @keyframes about-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
      @keyframes about-float-delayed { 0%,100% { transform: translateY(-5px) } 50% { transform: translateY(5px) } }
      @keyframes about-pulse-glow { 0%,100% { opacity: 0.6 } 50% { opacity: 1 } }
    `}</style>

    {/* Hero */}
    <div style={{ position: "relative", minHeight: isMobile ? "auto" : "70vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: isMobile ? "120px 24px 80px" : "160px 48px 120px" }}>
      {/* Gradient orbs */}
      <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "60%", height: "60%", background: "radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "50%", height: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Floating trade tool icons */}
      {!isMobile && <>
        <div style={{ position: "absolute", top: "18%", left: "8%", animation: "about-float 6s ease-in-out infinite", pointerEvents: "none", opacity: 0.12 }}>
          <Wrench size={48} color={theme.accent} strokeWidth={1} />
        </div>
        <div style={{ position: "absolute", top: "30%", right: "10%", animation: "about-float-delayed 7s ease-in-out infinite", pointerEvents: "none", opacity: 0.08 }}>
          <Camera size={40} color={theme.accent} strokeWidth={1} />
        </div>
        <div style={{ position: "absolute", bottom: "25%", left: "12%", animation: "about-float 8s ease-in-out infinite 1s", pointerEvents: "none", opacity: 0.06 }}>
          <Zap size={36} color="#5EEAD4" strokeWidth={1} />
        </div>
        <div style={{ position: "absolute", bottom: "30%", right: "8%", animation: "about-float-delayed 9s ease-in-out infinite 0.5s", pointerEvents: "none", opacity: 0.07 }}>
          <Mail size={32} color={theme.accent} strokeWidth={1} />
        </div>
      </>}

      <div style={{ maxWidth: 720, position: "relative", zIndex: 1 }}>
        <FadeIn>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 100, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)", marginBottom: isMobile ? 24 : 32 }}>
            <Wrench size={14} color={theme.accent} style={{ animation: "about-spin-slow 8s linear infinite" }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: theme.accent, letterSpacing: "0.02em" }}>Our Story</span>
          </div>
        </FadeIn>
        <FadeIn delay={0.08}>
          <h1 style={{ fontSize: isMobile ? 40 : 64, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.05, marginBottom: isMobile ? 24 : 32, fontFamily: theme.font, letterSpacing: "-0.03em" }}>
            The Story Behind<br /><span style={{ background: `linear-gradient(135deg, ${theme.accent}, #5EEAD4)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Wynflow</span>
          </h1>
        </FadeIn>
        <FadeIn delay={0.16}>
          <p style={{ fontSize: isMobile ? 16 : 19, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: 560, margin: "0 auto", fontWeight: 400, letterSpacing: "0.01em" }}>Built from a real problem, by someone who watched it happen every day.</p>
        </FadeIn>
      </div>

      {/* Bottom gradient fade */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 120, background: "linear-gradient(to bottom, transparent, #0A0E17)", pointerEvents: "none" }} />
    </div>

    {/* Divider */}
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 48px" }}>
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(20,184,166,0.3), transparent)" }} />
    </div>

    {/* Origin Story — Bento layout */}
    <div style={{ padding: isMobile ? "64px 24px" : "96px 48px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr", gap: isMobile ? 24 : 32 }}>

          {/* Left: main story card (tall) */}
          <FadeIn>
            <div style={{ padding: isMobile ? 24 : 48, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", height: "100%", transition: "all 0.2s ease-out" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}>
              <div style={{ marginBottom: 24 }}><WynflowLogo size={48} showText textSize={28} /></div>
              <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "#FFFFFF", marginBottom: 24, fontFamily: theme.font, letterSpacing: "-0.02em", lineHeight: 1.3 }}>It started with my dad's carpet shop.</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.8, margin: 0 }}>My dad ran a flooring business in Napier for years. Great at his trade, terrible at admin. I'd watch him spend his evenings at the kitchen table — measuring jobs, working out pricing, sending off quotes.</p>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.8, margin: 0 }}>Then nothing. If the customer didn't respond straight away, the quote would just sit there. He'd get busy with the next job, the next measure, the next customer. By the time he thought about following up, he either couldn't find the quote or the customer had already gone with someone else.</p>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.8, margin: 0 }}>One Christmas he told me: <span style={{ color: "#FFFFFF", fontWeight: 500 }}>"If you want to get me something, get me a robot that does my quoting."</span> He was joking — but it stuck with me.</p>
              </div>
            </div>
          </FadeIn>

          {/* Right: stacked cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 24 : 32 }}>
            <FadeIn delay={0.1}>
              <div style={{ padding: isMobile ? 24 : 32, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", transition: "all 0.2s ease-out" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Search size={18} color={theme.accent} strokeWidth={1.5} />
                </div>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.8, margin: 0 }}>I started digging into it and realised it wasn't just him. Across every trade, every industry, the data tells the same story: businesses don't lose work because they're too expensive. They lose it because they're too slow to follow up.</p>
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div style={{ padding: isMobile ? 24 : 32, borderRadius: 16, background: "rgba(20,184,166,0.04)", border: "1px solid rgba(20,184,166,0.12)", transition: "all 0.2s ease-out" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.12)"; }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Zap size={18} color={theme.accent} strokeWidth={1.5} />
                </div>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.8, margin: 0 }}>That's where Wynflow came from — a system that sends your quotes, chases your customers automatically, and lets you track every single one from sent to booked.</p>
                <div style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 100, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)" }}>
                  <Bot size={14} color={theme.accent} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: theme.accent }}>AI + Automation</span>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </div>

    {/* Divider */}
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 48px" }}>
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
    </div>

    {/* Stats Section with animated counters */}
    <div style={{ padding: isMobile ? "64px 24px" : "96px 48px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: isMobile ? 48 : 72 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 16 }}>The Data</p>
            <h2 style={{ fontSize: isMobile ? 30 : 44, fontWeight: 700, color: "#FFFFFF", marginBottom: 16, fontFamily: theme.font, letterSpacing: "-0.03em", lineHeight: 1.15 }}>The Data Doesn't Lie</h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "rgba(255,255,255,0.45)", maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>The research is clear: following up is the single biggest thing you can do to win more work.</p>
          </div>
        </FadeIn>

        {/* Animated stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: isMobile ? 16 : 24, marginBottom: isMobile ? 32 : 64 }}>
          {stats.map((s, i) => (
            <FadeIn key={i} delay={0.05 * i}>
              <div ref={s.ref} style={{ padding: isMobile ? 24 : 32, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center", height: "100%", transition: "all 0.2s ease-out", cursor: "default" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(20,184,166,0.25)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                <div style={{ fontSize: isMobile ? 32 : 44, fontWeight: 700, color: s.color, fontFamily: theme.font, letterSpacing: "-0.03em", marginBottom: 8, lineHeight: 1 }}>
                  {s.value}{s.suffix}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{s.label}</div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Hero stat — 70% with animated counter */}
        <FadeIn delay={0.25}>
          <div ref={statRef5} style={{ padding: isMobile ? 32 : 56, borderRadius: 20, background: "rgba(20,184,166,0.04)", border: "1px solid rgba(20,184,166,0.12)", textAlign: "center", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "60%", height: "100%", background: "radial-gradient(circle, rgba(20,184,166,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: isMobile ? 64 : 96, fontWeight: 700, background: `linear-gradient(135deg, ${theme.accent}, #5EEAD4)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", fontFamily: theme.font, letterSpacing: "-0.04em", lineHeight: 1 }}>
                {count5}%
              </div>
              <p style={{ fontSize: isMobile ? 15 : 17, color: "rgba(255,255,255,0.4)", marginTop: 16, maxWidth: 500, margin: "16px auto 0", lineHeight: 1.6 }}>increase in conversion rates just by making a few extra follow-up attempts. Most businesses leave this on the table.</p>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>

    {/* Divider */}
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 48px" }}>
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
    </div>

    {/* Problem / Solution — Bento asymmetric */}
    <div style={{ padding: isMobile ? "64px 24px" : "96px 48px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Top row: Problem (large) + Speed stat (small) */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: isMobile ? 16 : 24, marginBottom: isMobile ? 16 : 24 }}>
          <FadeIn>
            <div style={{ padding: isMobile ? 24 : 40, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", height: "100%", transition: "all 0.2s ease-out" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.25)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
                <XCircle size={22} color={theme.red} strokeWidth={1.5} />
              </div>
              <h3 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "#FFFFFF", marginBottom: 16, fontFamily: theme.font, letterSpacing: "-0.02em" }}>The Problem</h3>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", lineHeight: 1.8, margin: 0, maxWidth: 520 }}>Service businesses spend hours scoping jobs and writing quotes — only to let them die in someone's inbox. Research shows that 92% of people stop following up after just four attempts, even though most deals need five or more touchpoints. The first person to follow up wins the job 35-50% of the time.</p>
            </div>
          </FadeIn>
          <FadeIn delay={0.05}>
            <div style={{ padding: isMobile ? 24 : 32, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", transition: "all 0.2s ease-out" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(20,184,166,0.25)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Clock size={22} color={theme.accent} strokeWidth={1.5} />
              </div>
              <div style={{ fontSize: isMobile ? 28 : 36, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font, letterSpacing: "-0.03em", marginBottom: 8 }}>5 mins</div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>Responding within 5 minutes makes you 9x more likely to convert a lead</p>
            </div>
          </FadeIn>
        </div>

        {/* Bottom row: Speed stats (small) + Solution (large) */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr", gap: isMobile ? 16 : 24 }}>
          <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: isMobile ? 16 : 24 }}>
            <FadeIn delay={0.1}>
              <div style={{ padding: isMobile ? 24 : 28, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", transition: "all 0.2s ease-out" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(20,184,166,0.25)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Mail size={18} color={theme.accent} strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font, letterSpacing: "-0.03em", marginBottom: 8 }}>3 emails</div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, margin: 0 }}>Three follow-up emails hit the sweet spot with a 9.2% reply rate</p>
              </div>
            </FadeIn>
            <FadeIn delay={0.15}>
              <div style={{ padding: isMobile ? 24 : 28, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", transition: "all 0.2s ease-out" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(20,184,166,0.25)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <BarChart3 size={18} color={theme.accent} strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font, letterSpacing: "-0.03em", marginBottom: 8 }}>35-50%</div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, margin: 0 }}>of jobs go to the vendor who responds first — speed wins</p>
              </div>
            </FadeIn>
          </div>
          <FadeIn delay={0.1}>
            <div style={{ padding: isMobile ? 24 : 40, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", height: "100%", transition: "all 0.2s ease-out" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(34,197,94,0.25)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
                <CheckCircle2 size={22} color={theme.green} strokeWidth={1.5} />
              </div>
              <h3 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "#FFFFFF", marginBottom: 16, fontFamily: theme.font, letterSpacing: "-0.02em" }}>The Solution</h3>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", lineHeight: 1.8, margin: 0, maxWidth: 520 }}>Wynflow uses AI to generate quotes from job site photos — scope, materials, labour, all calculated from your rates and your trade. Then our automated system follows up at exactly the right intervals — professional, consistent, and hands-free. You get notified the moment a customer responds. No more lost jobs from slow quoting or forgotten follow-ups.</p>
              <div style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 16, padding: "16px 24px", borderRadius: 12, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.12)" }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: theme.green, fontFamily: theme.font, letterSpacing: "-0.02em" }}>2x</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.3 }}>more jobs won<br />with follow-ups</span>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>

    {/* Divider */}
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 48px" }}>
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
    </div>

    {/* Founder Bio — Side-by-side bento */}
    <div style={{ padding: isMobile ? "64px 24px" : "96px 48px", position: "relative" }}>
      <div style={{ position: "absolute", top: "20%", right: "-5%", width: "40%", height: "60%", background: "radial-gradient(circle, rgba(20,184,166,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: isMobile ? 40 : 64 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 16 }}>The Founder</p>
            <h2 style={{ fontSize: isMobile ? 30 : 44, fontWeight: 700, color: "#FFFFFF", marginBottom: 16, fontFamily: theme.font, letterSpacing: "-0.03em", lineHeight: 1.15 }}>Built by a Kiwi, for<br />Kiwi Businesses</h2>
          </div>
        </FadeIn>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 24 }}>
          {/* Left: Bio text card */}
          <FadeIn delay={0.05}>
            <div style={{ padding: isMobile ? 24 : 40, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", height: "100%", transition: "all 0.2s ease-out" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <UserCheck size={26} color={theme.accent} strokeWidth={1.5} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "#FFFFFF", fontFamily: theme.font }}>Jesse</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Founder, Auckland NZ</div>
                </div>
              </div>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.8, margin: "0 0 16px" }}>I'm Jesse — a young Kiwi based in Auckland. I built Wynflow because I saw firsthand how much time and money small businesses waste on things that should be automatic.</p>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.8, margin: 0 }}>Wynflow is built specifically for how NZ businesses actually work. No complicated setup, no enterprise pricing, no fluff. Snap photos, get an AI-generated quote, send it, and let automated follow-ups do the chasing.</p>
            </div>
          </FadeIn>

          {/* Right: NZ stats + badges stacked */}
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 24 }}>
            <FadeIn delay={0.1}>
              <div style={{ padding: isMobile ? 24 : 32, borderRadius: 16, background: "rgba(20,184,166,0.04)", border: "1px solid rgba(20,184,166,0.12)", transition: "all 0.2s ease-out" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.12)"; }}>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.8, margin: 0 }}>New Zealand has over <span style={{ color: "#FFFFFF", fontWeight: 600 }}>600,000 small businesses</span> — 97% of all businesses in the country. Most of them are too busy doing the work to chase the paperwork. That's what Wynflow is for.</p>
              </div>
            </FadeIn>
            <FadeIn delay={0.15}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: isMobile ? 16 : 16 }}>
                {[{ icon: Globe, label: "100% NZ Built" }, { icon: Cpu, label: "AI-Powered" }, { icon: Wrench, label: "Made for Tradies" }].map((b, i) => {
                  const BIcon = b.icon;
                  return (
                  <div key={i} style={{ padding: isMobile ? 16 : 20, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", transition: "all 0.2s ease-out" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(20,184,166,0.25)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                      <BIcon size={20} color={theme.accent} strokeWidth={1.5} />
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>{b.label}</div>
                  </div>
                  );
                })}
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </div>

    {/* CTA */}
    <div style={{ padding: isMobile ? "80px 24px" : "120px 48px", textAlign: "center", position: "relative" }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "80%", height: "80%", background: "radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 60%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto" }}>
        <FadeIn>
          <div style={{ padding: isMobile ? "48px 24px" : "72px 64px", borderRadius: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 16, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)", marginBottom: 24, animation: "about-pulse-glow 3s ease-in-out infinite" }}>
              <Wrench size={26} color={theme.accent} strokeWidth={1.5} style={{ animation: "about-spin-slow 10s linear infinite" }} />
            </div>
            <h2 style={{ fontSize: isMobile ? 28 : 40, fontWeight: 700, color: "#FFFFFF", marginBottom: 16, fontFamily: theme.font, letterSpacing: "-0.03em", lineHeight: 1.15 }}>Quote Smarter. Chase Less.<br />Win More.</h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "rgba(255,255,255,0.45)", marginBottom: 16, lineHeight: 1.6 }}>Let AI handle the quoting and automated follow-ups handle the chasing — while you stay on the tools.</p>
            <p style={{ fontSize: 13, color: "rgba(20,184,166,0.6)", marginBottom: 32, fontWeight: 500 }}>Built for tradies, by a Kiwi who gets it.</p>
            <button onClick={() => dispatch({ type: "SET_SCREEN", payload: "signup" })}
              onMouseDown={pressDown} onMouseUp={pressUp}
              onMouseEnter={e => { e.currentTarget.style.background = "#5EEAD4"; e.currentTarget.style.boxShadow = "0 4px 32px rgba(20,184,166,0.4), 0 0 80px rgba(20,184,166,0.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = theme.accent; e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 0 24px rgba(20,184,166,0.3), 0 0 60px rgba(20,184,166,0.1)"; }}
              style={{ fontFamily: theme.font, fontSize: 15, fontWeight: 600, padding: "16px 40px", borderRadius: 10, background: theme.accent, color: "#000", border: "none", cursor: "pointer", transition: "all 0.2s ease-out", boxShadow: "0 0 24px rgba(20,184,166,0.3), 0 0 60px rgba(20,184,166,0.1)", letterSpacing: "0.01em" }}>
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

const PricingPage = ({ dispatch }) => {
  const isMobile = useIsMobile();
  const [openFaq, setOpenFaq] = useState(null);

  const plans = [
    {name:"Starter",price:"29",desc:"AI quoting & automated follow-ups to win more jobs",features:["AI photo quote generator","Unlimited quotes","1 automated follow-up sequence","Customer quote request page","One-click Accept / Decline","File attachments","Quote dashboard & analytics","Email support"],highlighted:true,active:true,link:"https://buy.stripe.com/eVqfZhaF76gDcl57Yx73G02"},
    {name:"Pro",price:"49",desc:"The full AI-powered toolkit for serious tradies",features:[],highlighted:false,active:false,comingSoon:true,link:"https://buy.stripe.com/7sY3cv7sVawT1Gr6Ut73G03"},
  ];
  const faqs = [{q:"How does the AI quote generator work?",a:"Take photos on the job site, add a few details about the work, and Wynflow's AI analyses everything — your trade, your rates, the scope of work — to generate an itemised quote with materials, labour, and pricing. Review it, tweak if needed, and send."},{q:"Is there really a free trial?",a:"Yep. 14 days, full access including AI quoting, no credit card needed. Send real quotes from day one."},{q:"Can I cancel anytime?",a:"Absolutely. No lock-in contracts, no cancellation fees. But most tradies stay."},{q:"Do my customers know it's automated?",a:"Nope. Emails come from Wynflow on behalf of your business name. They look professional and personal — your customers just think you're on the ball."},{q:"What if I already use Xero / Tradify / Fergus?",a:"Keep using them for your invoicing. Wynflow is specifically for AI-powered quoting and automated follow-ups — it fills the gap most trade software misses."},{q:"How long does it take to set up?",a:"About 30 seconds. Sign up, enter your business details, and generate your first AI quote. The default follow-up sequence is ready to go."}];

  // Button press handlers (matching HomePage pattern)
  const pressDown = (e) => { e.currentTarget.style.transform = "scale(0.97)"; };
  const pressUp = (e) => { e.currentTarget.style.transform = "scale(1)"; };

  return (
  <div style={{ background: theme.bg, minHeight: "100vh", overflowX: "hidden" }}>

    {/* Keyframe animations */}
    <style>{`
      @keyframes pricing-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
      @keyframes pricing-float-delayed { 0%,100% { transform: translateY(-5px) } 50% { transform: translateY(5px) } }
      @keyframes pricing-pulse-glow { 0%,100% { opacity: 0.6 } 50% { opacity: 1 } }
      @keyframes pricing-badge-glow { 0%,100% { box-shadow: 0 0 8px rgba(20,184,166,0.3) } 50% { box-shadow: 0 0 20px rgba(20,184,166,0.5), 0 0 40px rgba(20,184,166,0.2) } }
      @keyframes pricing-spin-slow { to { transform: rotate(360deg) } }
    `}</style>

    {/* Hero */}
    <div style={{ position: "relative", padding: isMobile ? "120px 24px 80px" : "160px 48px 96px", textAlign: "center" }}>
      {/* Gradient orbs */}
      <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "60%", height: "60%", background: "radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "50%", height: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Floating trade tool icons */}
      {!isMobile && <>
        <div style={{ position: "absolute", top: "18%", left: "8%", animation: "pricing-float 6s ease-in-out infinite", pointerEvents: "none", opacity: 0.12 }}>
          <DollarSign size={48} color={theme.accent} strokeWidth={1} />
        </div>
        <div style={{ position: "absolute", top: "28%", right: "10%", animation: "pricing-float-delayed 7s ease-in-out infinite", pointerEvents: "none", opacity: 0.08 }}>
          <Camera size={40} color={theme.accent} strokeWidth={1} />
        </div>
        <div style={{ position: "absolute", bottom: "22%", left: "12%", animation: "pricing-float 8s ease-in-out infinite 1s", pointerEvents: "none", opacity: 0.06 }}>
          <Zap size={36} color="#5EEAD4" strokeWidth={1} />
        </div>
        <div style={{ position: "absolute", top: "40%", right: "6%", animation: "pricing-float-delayed 9s ease-in-out infinite 0.5s", pointerEvents: "none", opacity: 0.07 }}>
          <Wrench size={32} color="#5EEAD4" strokeWidth={1} />
        </div>
      </>}

      <div style={{ maxWidth: 640, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <FadeIn>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 100, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)", marginBottom: isMobile ? 24 : 32 }}>
            <Wrench size={14} color={theme.accent} style={{ animation: "pricing-spin-slow 8s linear infinite" }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: theme.accent, letterSpacing: "0.02em" }}>Less than the cost of one lost job</span>
          </div>
        </FadeIn>
        <FadeIn delay={0.08}>
          <h1 style={{ fontSize: isMobile ? 38 : 64, fontWeight: 700, color: "#FFFFFF", marginBottom: isMobile ? 16 : 24, fontFamily: theme.font, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Simple, <span style={{ background: "linear-gradient(135deg, " + theme.accent + ", #5EEAD4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Honest</span> Pricing
          </h1>
        </FadeIn>
        <FadeIn delay={0.16}>
          <p style={{ fontSize: isMobile ? 16 : 19, color: "rgba(255,255,255,0.45)", maxWidth: 480, margin: "0 auto", lineHeight: 1.7, fontWeight: 400, letterSpacing: "0.01em" }}>No hidden fees. No lock-in contracts. Start free for 14 days, no credit card needed.</p>
        </FadeIn>
      </div>

      {/* Bottom gradient fade */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "linear-gradient(to bottom, transparent, " + theme.bg + ")", pointerEvents: "none" }} />
    </div>

    {/* Divider */}
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 48px" }}>
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(20,184,166,0.3), transparent)" }} />
    </div>

    {/* Pricing Cards */}
    <div style={{ padding: isMobile ? "64px 24px 80px" : "80px 48px 120px" }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 24 : 32, maxWidth: 840, margin: "0 auto" }}>
        {plans.map((plan, i) => (
          <FadeIn key={i} delay={0.1 + i * 0.15}>
            <div style={{
              padding: isMobile ? 32 : 40,
              borderRadius: 20,
              background: plan.highlighted ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)",
              border: (plan.highlighted ? "2px" : "1px") + " solid " + (plan.highlighted ? "rgba(20,184,166,0.3)" : "rgba(255,255,255,0.06)"),
              position: "relative",
              transform: plan.highlighted && !isMobile ? "scale(1.03)" : "none",
              boxShadow: plan.highlighted ? "0 0 60px rgba(20,184,166,0.12)" : "none",
              transition: "all 0.3s ease-out",
              height: "100%",
              overflow: "hidden"
            }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = plan.highlighted && !isMobile ? "scale(1.05) translateY(-4px)" : "translateY(-4px)";
                e.currentTarget.style.borderColor = plan.highlighted ? "rgba(20,184,166,0.5)" : "rgba(255,255,255,0.12)";
                e.currentTarget.style.boxShadow = plan.highlighted ? "0 8px 80px rgba(20,184,166,0.2), 0 0 60px rgba(20,184,166,0.12)" : "0 8px 40px rgba(0,0,0,0.3)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = plan.highlighted && !isMobile ? "scale(1.03)" : "none";
                e.currentTarget.style.borderColor = plan.highlighted ? "rgba(20,184,166,0.3)" : "rgba(255,255,255,0.06)";
                e.currentTarget.style.boxShadow = plan.highlighted ? "0 0 60px rgba(20,184,166,0.12)" : "none";
              }}>

              {/* Corner glow for highlighted card */}
              {plan.highlighted && <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, background: "radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />}

              {/* Most Popular badge — hidden for now */}

              {/* Plan icon */}
              <div style={{ width: 44, height: 44, borderRadius: 12, background: plan.highlighted ? "rgba(20,184,166,0.1)" : "rgba(255,255,255,0.04)", border: "1px solid " + (plan.highlighted ? "rgba(20,184,166,0.15)" : "rgba(255,255,255,0.06)"), display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
                {plan.highlighted
                  ? <Zap size={22} color={theme.accent} strokeWidth={1.5} />
                  : <Sparkles size={22} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />}
              </div>

              <h3 style={{ fontSize: 22, fontWeight: 700, color: "#FFFFFF", marginBottom: 8, fontFamily: theme.font, letterSpacing: "-0.02em" }}>{plan.name}</h3>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 24, lineHeight: 1.6 }}>{plan.desc}</p>

              <div style={{ marginBottom: 32 }}>
                {plan.highlighted && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 100, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", marginBottom: 16 }}>
                    <Zap size={13} color={theme.green} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: theme.green, letterSpacing: "0.02em" }}>Free for 14 days</span>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  {plan.highlighted ? (
                    <>
                      <span style={{ fontSize: 32, fontWeight: 600, color: "rgba(255,255,255,0.25)", fontFamily: theme.font, textDecoration: "line-through", textDecorationColor: "rgba(239,68,68,0.5)", marginRight: 8 }}>${plan.price}</span>
                      <span style={{ fontSize: 52, fontWeight: 800, color: "#FFFFFF", fontFamily: theme.font, letterSpacing: "-0.03em" }}>$0</span>
                      <span style={{ fontSize: 16, color: "rgba(255,255,255,0.35)" }}>/first 14 days</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 52, fontWeight: 800, color: "#FFFFFF", fontFamily: theme.font, letterSpacing: "-0.03em" }}>${plan.price}</span>
                      <span style={{ fontSize: 16, color: "rgba(255,255,255,0.35)" }}>/month</span>
                    </>
                  )}
                </div>
                {plan.highlighted && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>Then ${plan.price}/mo — cancel anytime</div>}
              </div>

              {plan.comingSoon ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 20, background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.12)", color: theme.accent, fontSize: 13, fontWeight: 600, marginBottom: 16, letterSpacing: "0.02em" }}>
                    <Clock size={13} /> Coming Soon
                  </div>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>We're building something special for tradies who want the full toolkit. Stay tuned.</p>
                </div>
              ) : (
                <>
                  {plan.active && (
                    <button onClick={() => dispatch({ type: "SET_SCREEN", payload: plan.highlighted ? "signup:starter" : "signup:pro" })}
                      onMouseDown={pressDown} onMouseUp={pressUp}
                      onMouseEnter={e => {
                        if (plan.highlighted) { e.currentTarget.style.background = "#5EEAD4"; e.currentTarget.style.boxShadow = "0 4px 32px rgba(20,184,166,0.4), 0 0 80px rgba(20,184,166,0.15)"; }
                        else { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = "scale(1)";
                        if (plan.highlighted) { e.currentTarget.style.background = theme.accent; e.currentTarget.style.boxShadow = "0 0 24px rgba(20,184,166,0.3)"; }
                        else { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }
                      }}
                      style={{
                        width: "100%", padding: "16px 24px", marginBottom: 32, borderRadius: 10,
                        fontSize: 15, fontWeight: 600, fontFamily: theme.font, cursor: "pointer",
                        border: "none", transition: "all 0.2s ease-out", letterSpacing: "0.01em",
                        background: plan.highlighted ? theme.accent : "rgba(255,255,255,0.06)",
                        color: plan.highlighted ? "#000" : "#FFFFFF",
                        boxShadow: plan.highlighted ? "0 0 24px rgba(20,184,166,0.3)" : "none",
                      }}>
                      {plan.highlighted ? "Start Free Trial" : "Get Pro"}
                      <ArrowRight size={15} style={{ display: "inline", verticalAlign: "middle", marginLeft: 8 }} />
                    </button>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {plan.features.map((f, j) => (
                      <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
                        <div style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Check size={12} color={theme.accent} strokeWidth={2.5} />
                        </div>
                        {f}
                      </div>
                    ))}
                  </div>
                  {plan.active && (
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 24, textAlign: "center", letterSpacing: "0.04em" }}>No credit card required</p>
                  )}
                </>
              )}
            </div>
          </FadeIn>
        ))}
      </div>
    </div>

    {/* Divider */}
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 48px" }}>
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
    </div>

    {/* FAQ Section */}
    <div style={{ padding: isMobile ? "80px 24px" : "96px 48px", position: "relative" }}>
      {/* Subtle orb */}
      <div style={{ position: "absolute", top: "30%", left: "-10%", width: "40%", height: "60%", background: "radial-gradient(circle, rgba(20,184,166,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 700, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: isMobile ? 40 : 56 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 16 }}>FAQ</p>
            <h2 style={{ fontSize: isMobile ? 28 : 40, fontWeight: 700, color: "#FFFFFF", marginBottom: 16, fontFamily: theme.font, letterSpacing: "-0.03em", lineHeight: 1.15 }}>Frequently Asked Questions</h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "rgba(255,255,255,0.4)", maxWidth: 440, margin: "0 auto", lineHeight: 1.6 }}>Everything you need to know before getting started.</p>
          </div>
        </FadeIn>

        {faqs.map((faq, i) => (
          <FadeIn key={i} delay={0.03 * i}>
            <div style={{
              marginBottom: 8, borderRadius: 16,
              background: openFaq === i ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
              border: "1px solid " + (openFaq === i ? "rgba(20,184,166,0.2)" : "rgba(255,255,255,0.06)"),
              transition: "all 0.3s ease-out",
              overflow: "hidden"
            }}
              onMouseEnter={e => { if (openFaq !== i) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; } }}
              onMouseLeave={e => { if (openFaq !== i) { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; } }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{
                width: "100%", padding: "24px 24px", background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, textAlign: "left"
              }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: openFaq === i ? "#FFFFFF" : "rgba(255,255,255,0.8)", transition: "color 0.2s", letterSpacing: "-0.01em" }}>{faq.q}</span>
                <ChevronRight size={16} color={openFaq === i ? theme.accent : "rgba(255,255,255,0.3)"} style={{
                  transition: "all 0.3s ease-out", flexShrink: 0,
                  transform: openFaq === i ? "rotate(90deg)" : "rotate(0deg)"
                }} />
              </button>
              <div style={{
                maxHeight: openFaq === i ? 200 : 0,
                opacity: openFaq === i ? 1 : 0,
                transition: "all 0.3s ease-out",
                overflow: "hidden"
              }}>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, padding: "0 24px 24px", margin: 0 }}>{faq.a}</p>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </div>

    {/* Divider */}
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 48px" }}>
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
    </div>

    {/* Bottom CTA */}
    <div style={{ padding: isMobile ? "80px 24px" : "120px 48px", textAlign: "center", position: "relative" }}>
      {/* Glow behind CTA */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "80%", height: "80%", background: "radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 60%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto" }}>
        <FadeIn>
          <div style={{ padding: isMobile ? "48px 24px" : "72px 64px", borderRadius: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {/* Pulsing wrench icon */}
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 16, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)", marginBottom: 24, animation: "pricing-pulse-glow 3s ease-in-out infinite" }}>
              <Wrench size={26} color={theme.accent} strokeWidth={1.5} style={{ animation: "pricing-spin-slow 10s linear infinite" }} />
            </div>
            <h2 style={{ fontSize: isMobile ? 28 : 40, fontWeight: 700, color: "#FFFFFF", marginBottom: 16, fontFamily: theme.font, letterSpacing: "-0.03em", lineHeight: 1.15 }}>Still Not Sure?</h2>
            <p style={{ fontSize: isMobile ? 15 : 17, color: "rgba(255,255,255,0.45)", marginBottom: 16, lineHeight: 1.6 }}>Start your free trial — generate your first AI quote in under a minute.</p>
            <p style={{ fontSize: 13, color: "rgba(20,184,166,0.6)", marginBottom: 32, fontWeight: 500 }}>No credit card. No lock-in. Just smarter quoting.</p>
            <button onClick={() => dispatch({ type: "SET_SCREEN", payload: "signup" })}
              onMouseDown={pressDown} onMouseUp={pressUp}
              onMouseEnter={e => { e.currentTarget.style.background = "#5EEAD4"; e.currentTarget.style.boxShadow = "0 4px 32px rgba(20,184,166,0.4), 0 0 80px rgba(20,184,166,0.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = theme.accent; e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 0 24px rgba(20,184,166,0.3), 0 0 60px rgba(20,184,166,0.1)"; }}
              style={{ fontFamily: theme.font, fontSize: 15, fontWeight: 600, padding: "16px 40px", borderRadius: 10, background: theme.accent, color: "#000", border: "none", cursor: "pointer", transition: "all 0.2s ease-out", boxShadow: "0 0 24px rgba(20,184,166,0.3), 0 0 60px rgba(20,184,166,0.1)", letterSpacing: "0.01em" }}>
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
  document.cookie = "wynflow_refresh=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
};

const TRADE_CATEGORIES = [
  "Plumber", "Electrician", "Builder", "Painter", "Roofer", "Landscaper",
  "Carpet Layer", "Tiler", "Cleaner", "Handyman", "Mechanic", "Fencer",
  "Locksmith", "Gasfitter", "Drainlayer", "Plasterer", "Concreter",
  "Pest Control", "Arborist", "Scaffolding", "Interior Designer", "Other",
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
          <div style={{ display: "inline-flex", marginBottom: 16 }}>
            <WynflowLogo size={48} showText textSize={28} />
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

const STRIPE_LINKS = {
  starter: "https://buy.stripe.com/eVqfZhaF76gDcl57Yx73G02",
  pro: "https://buy.stripe.com/7sY3cv7sVawT1Gr6Ut73G03",
};

const AuthScreen = ({ dispatch, isSignup, plan = "starter" }) => {
  const isMobile = useIsMobile();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [trade, setTrade] = useState("");
  const [phone, setPhone] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [calloutFee, setCalloutFee] = useState("");
  const [autoFollowUps, setAutoFollowUps] = useState(true);
  const [materialsMargin, setMaterialsMargin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

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
    if (isSignup && (!businessName || !contactName || !trade || !phone.trim())) { setError("Please fill in all required fields"); return; }
    setLoading(true);
    setError("");
    try {
      if (isSignup) {
        const authData = await supabase.auth_signUp(email, password);
        if (!authData.user) throw new Error("Signup failed — please try again");
        // With email confirmation enabled, Supabase returns user but no token until confirmed
        // If user already exists, identities array will be empty
        if (!authData.access_token && authData.user.identities && authData.user.identities.length === 0) {
          throw new Error("An account with this email already exists. Try signing in instead.");
        }
        // If we have a token, user confirmed instantly (e.g. confirmation disabled) — proceed normally
        // If no token but user exists with identities, email confirmation is pending
        if (!authData.access_token) {
          // Store signup details temporarily so we can create business after email confirmation
          try { localStorage.setItem("wynflow_pending_signup", JSON.stringify({ businessName, contactName, email, phone, trade, hourlyRate, calloutFee, plan, autoFollowUps, materialsMargin })); } catch(e) {}
          setEmailSent(true);
          setLoading(false);
          // Notify N8N about new signup
          fetch("https://wynfallautomation.app.n8n.cloud/webhook/new-business", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ business_name: businessName, contact_name: contactName, email, phone, trade, hourly_rate: hourlyRate, callout_fee: calloutFee }),
          }).catch(() => {});
          return;
        }
        const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data: biz, error: bizErr } = await db("businesses").insert({
          user_id: authData.user.id,
          business_name: businessName,
          contact_name: contactName,
          email: email,
          phone: phone.trim(),
          trade: trade || null,
          trade_category: trade || null,
          hourly_rate: parseFloat(hourlyRate) || 0,
          callout_fee: parseFloat(calloutFee) || 0,
          subscription_status: "trialing",
          trial_ends_at: trialEnd,
          auto_follow_ups: autoFollowUps,
          materials_margin: Math.max(0, Math.min(200, parseFloat(materialsMargin) || 0)),
        });
        if (bizErr || !biz || !biz[0]) {
          const { data: existingBiz } = await db("businesses").eq("user_id", authData.user.id).single().select();
          if (existingBiz) {
            dispatch({ type: "SET_USER", payload: authData.user });
            dispatch({ type: "SET_BUSINESS", payload: existingBiz });
            setCookie("wynflow_token", supabase.token, 43200);
            if (authData.refresh_token) setCookie("wynflow_refresh", authData.refresh_token, 43200);
            setCookie("wynflow_user", authData.user, 43200);
            setCookie("wynflow_business", existingBiz, 43200);
            dispatch({ type: "NOTIFY", payload: { message: "Welcome to Wynflow!", type: "success" } });
            dispatch({ type: "SET_SCREEN", payload: "dashboard" });
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
        if (authData.refresh_token) setCookie("wynflow_refresh", authData.refresh_token, 43200);
        setCookie("wynflow_user", authData.user, 43200);
        setCookie("wynflow_business", bizRecord, 43200);
        dispatch({ type: "NOTIFY", payload: { message: "Account created! Welcome to Wynflow.", type: "success" } });
        dispatch({ type: "SET_SCREEN", payload: "dashboard" });
        fetch("https://wynfallautomation.app.n8n.cloud/webhook/new-business", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ business_name: businessName, contact_name: contactName, email, phone, trade, hourly_rate: hourlyRate, callout_fee: calloutFee }),
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
        if (authData.refresh_token) setCookie("wynflow_refresh", authData.refresh_token, 43200);
        setCookie("wynflow_user", authData.user, 43200);
        setCookie("wynflow_business", biz, 43200);
        dispatch({ type: "SET_SCREEN", payload: "dashboard" });
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
          <div style={{ display: "inline-flex", marginBottom: 16 }}>
            <WynflowLogo size={48} showText textSize={28} />
          </div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
            {isSignup ? "Start your free 14-day trial — no credit card needed" : "Welcome back — your quotes are waiting"}
          </div>
        </div>
        <Card style={{ padding: 32 }}>
          {emailSent ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <Mail size={48} color={theme.accent} style={{ marginBottom: 16 }} />
              <h3 style={{ fontSize: 18, fontWeight: 600, color: theme.text, margin: "0 0 8px" }}>Verify Your Email</h3>
              <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.6, margin: "0 0 8px" }}>
                We've sent a verification link to <strong style={{ color: theme.text }}>{email}</strong>.
              </p>
              <p style={{ fontSize: 13, color: theme.textDim, lineHeight: 1.6, margin: "0 0 24px" }}>
                Click the link in your email to activate your account, then come back and sign in.
              </p>
              <Button onClick={() => { setEmailSent(false); dispatch({ type: "SET_SCREEN", payload: "login" }); }}
                style={{ width: "100%", justifyContent: "center" }}>Go to Sign In</Button>
              <div style={{ marginTop: 16 }}>
                <span onClick={() => setEmailSent(false)}
                  style={{ fontSize: 13, color: theme.textMuted, cursor: "pointer" }}>Didn't receive it? Try again</span>
              </div>
            </div>
          ) : resetMode ? (
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
                <Input label="Mobile Number *" value={phone} onChange={setPhone} type="tel" placeholder="e.g. 021 123 4567" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: theme.textMuted, marginBottom: 6 }}>Trade / Industry *</div>
                  <select value={trade} onChange={e => setTrade(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#F1F3F7", fontSize: 14, fontFamily: theme.font, outline: "none", appearance: "auto" }}>
                    <option value="">Select your trade...</option>
                    {TRADE_CATEGORIES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 10 : 12 }}>
                  <div style={{ flex: 1 }}><Input label="Hourly Rate ($)" value={hourlyRate} onChange={setHourlyRate} type="number" placeholder="e.g. 85" /></div>
                  <div style={{ flex: 1 }}><Input label="Callout Fee ($)" value={calloutFee} onChange={setCalloutFee} type="number" placeholder="e.g. 50" /></div>
                </div>
                <div>
                  <Input label="Materials Markup %" value={materialsMargin} onChange={setMaterialsMargin} type="number" placeholder="e.g. 20" />
                  <div style={{ fontSize: 12, color: theme.textDim, marginTop: -4, marginBottom: 12 }}>How much do you mark up materials? Applied automatically to AI quotes.</div>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: theme.text }}>Automatic follow-up emails</div>
                      <div style={{ fontSize: 12, color: theme.textDim, marginTop: 3, lineHeight: 1.4 }}>
                        {autoFollowUps ? "We'll chase customers who haven't responded to your quotes" : "You'll follow up with customers manually"}
                      </div>
                    </div>
                    <div onClick={() => setAutoFollowUps(!autoFollowUps)}
                      style={{ width: 44, height: 24, borderRadius: 12, background: autoFollowUps ? theme.accent : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 10, background: "#fff", position: "absolute", top: 2, left: autoFollowUps ? 22 : 2, transition: "left 0.2s" }} />
                    </div>
                  </div>
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
              {loading ? "Please wait..." : isSignup ? "Start Free Trial →" : "Sign In →"}
            </Button>
            {isSignup && (
              <p style={{ fontSize: 10, color: theme.textDim, textAlign: "center", lineHeight: 1.6, marginTop: 8 }}>
                By signing up you agree that AI-generated quotes are estimates only and that you are responsible for reviewing all quotes before sending them to customers.
              </p>
            )}
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

// ─── Trial Paywall & Banner ───
const getTrialDaysRemaining = (business) => {
  if (!business || !business.trial_ends_at) return null;
  const now = new Date();
  const end = new Date(business.trial_ends_at);
  const diff = end - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// ─── Payment Success Screen ───
const PaymentSuccess = ({ dispatch, business }) => {
  const isMobile = useIsMobile();
  const [countdown, setCountdown] = useState(5);

  const goToDashboard = useCallback(() => {
    // Update local business state to active so trial paywall doesn't block
    if (business) {
      const updatedBiz = { ...business, subscription_status: "active", trial_ends_at: null };
      dispatch({ type: "SET_BUSINESS", payload: updatedBiz });
      setCookie("wynflow_business", updatedBiz, 43200);
    }
    window.history.replaceState(null, "", "/");
    dispatch({ type: "SET_SCREEN", payload: "dashboard" });
  }, [dispatch, business]);

  useEffect(() => {
    // Also update the DB directly via our custom client (best-effort, webhook should also handle this)
    if (business?.id) {
      db("businesses").eq("id", business.id).update({ subscription_status: "active", trial_ends_at: null }).then(() => {}).catch(() => {});
    }
  }, [business?.id]);

  useEffect(() => {
    const timer = setInterval(() => setCountdown(c => c - 1), 1000);
    const redirect = setTimeout(goToDashboard, 5000);
    return () => { clearInterval(timer); clearTimeout(redirect); };
  }, [goToDashboard]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(ellipse at 50% 30%, rgba(34,197,94,0.08) 0%, transparent 50%), ${theme.bg}`, fontFamily: theme.font, padding: 20 }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{ width: 80, height: 80, borderRadius: 20, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 32, animation: "successPop 0.5s cubic-bezier(0.16,1,0.3,1)" }}>
          <CheckCircle2 size={40} color="#22C55E" />
        </div>
        <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 700, color: "#FFFFFF", marginBottom: 12, letterSpacing: "-0.02em" }}>You're all set!</h1>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 8 }}>Payment confirmed — your Wynflow subscription is now active.</p>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", marginBottom: 40 }}>Redirecting to your dashboard in {countdown}s...</p>
        <Button onClick={goToDashboard} style={{ minWidth: 200 }}>
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
};

const isTrialExpired = (business) => {
  if (!business) return false;
  const status = business.subscription_status;
  if (status === "expired" || status === "cancelled") return true;
  if (status === "trialing" && business.trial_ends_at) {
    return new Date(business.trial_ends_at) < new Date();
  }
  return false;
};

const TrialPaywall = ({ business, dispatch }) => {
  const isMobile = useIsMobile();
  const stripeUrl = STRIPE_LINKS.starter + "?prefilled_email=" + encodeURIComponent(business?.email || "");

  const handleSignOut = async () => {
    await supabase.auth_signOut();
    supabase.token = null;
    supabase.user = null;
    clearCookies();
    dispatch({ type: "LOGOUT" });
    window.history.replaceState(null, "", "/");
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(10, 14, 23, 0.92)",
      backdropFilter: "blur(12px)",
      fontFamily: theme.font,
    }}>
      <div style={{
        width: isMobile ? "calc(100% - 32px)" : 440,
        maxWidth: 440,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: isMobile ? "32px 24px" : "40px 36px",
        textAlign: "center",
      }}>
        {/* Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: "rgba(239, 68, 68, 0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
        }}>
          <Lock size={24} color={theme.red} />
        </div>

        {/* Heading */}
        <h2 style={{
          fontSize: isMobile ? 22 : 26, fontWeight: 700,
          color: theme.text, margin: "0 0 10px",
          fontFamily: theme.fontDisplay,
        }}>
          Your free trial has ended
        </h2>

        {/* Message */}
        <p style={{
          fontSize: isMobile ? 14 : 15, color: theme.textMuted,
          lineHeight: 1.6, margin: "0 0 28px",
        }}>
          Subscribe to keep sending quotes, tracking follow-ups, and growing your business with Wynflow.
        </p>

        {/* Price */}
        <div style={{
          display: "inline-flex", alignItems: "baseline", gap: 4,
          margin: "0 0 24px",
        }}>
          <span style={{ fontSize: 36, fontWeight: 700, color: theme.text }}>$29</span>
          <span style={{ fontSize: 15, color: theme.textMuted }}>/mo</span>
        </div>

        {/* Features */}
        <div style={{
          display: "flex", flexDirection: "column", gap: 8,
          textAlign: "left", margin: "0 0 28px",
          padding: "16px 20px",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          {["Unlimited AI quotes", "Automated follow-up emails", "Full analytics dashboard"].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Check size={15} color={theme.accent} />
              <span style={{ fontSize: 13, color: theme.textMuted }}>{f}</span>
            </div>
          ))}
        </div>

        {/* Subscribe button */}
        <a href={stripeUrl} style={{
          display: "block", width: "100%",
          padding: "14px 24px", borderRadius: 10,
          background: theme.accent, color: "#fff",
          fontSize: 15, fontWeight: 600,
          textDecoration: "none", textAlign: "center",
          boxShadow: "0 0 24px rgba(20,184,166,0.3)",
          transition: "background 0.15s",
        }}>
          Subscribe Now — $29/mo
        </a>

        {/* Divider */}
        <div style={{
          height: 1, margin: "20px 0",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
        }} />

        {/* Sign out */}
        <button onClick={handleSignOut} style={{
          background: "none", border: "none", cursor: "pointer",
          color: theme.textMuted, fontSize: 13, fontWeight: 500,
          padding: "4px 8px",
        }}>
          Sign out
        </button>
      </div>
    </div>
  );
};

const TrialBanner = ({ business }) => {
  const isMobile = useIsMobile();
  const daysLeft = getTrialDaysRemaining(business);
  if (daysLeft === null || daysLeft > 3 || daysLeft < 0) return null;
  if (business?.subscription_status !== "trialing") return null;

  const stripeUrl = STRIPE_LINKS.starter + "?prefilled_email=" + encodeURIComponent(business?.email || "");
  const urgent = daysLeft <= 1;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 12, flexWrap: "wrap",
      padding: isMobile ? "10px 14px" : "10px 20px",
      marginBottom: isMobile ? 12 : 20,
      borderRadius: 10,
      background: urgent ? "rgba(239, 68, 68, 0.10)" : "rgba(245, 158, 11, 0.10)",
      border: `1px solid ${urgent ? "rgba(239, 68, 68, 0.20)" : "rgba(245, 158, 11, 0.20)"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {urgent ? <AlertTriangle size={16} color={theme.red} /> : <Clock size={16} color="#F59E0B" />}
        <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: theme.text }}>
          {daysLeft <= 0 ? "Your trial ends today" : daysLeft === 1 ? "1 day left in your trial" : `${daysLeft} days left in your trial`}
        </span>
      </div>
      <a href={stripeUrl} target="_blank" rel="noopener noreferrer" style={{
        padding: isMobile ? "6px 14px" : "6px 16px",
        borderRadius: 8, fontSize: 12, fontWeight: 600,
        background: theme.accent, color: "#fff",
        textDecoration: "none", whiteSpace: "nowrap",
        flexShrink: 0,
      }}>
        Subscribe — $29/mo
      </a>
    </div>
  );
};

// ─── Sidebar ───
const Sidebar = ({ screen, dispatch, business }) => {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const mainNav = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "quotes", label: "Quotes", icon: FileText },
    { id: "schedule", label: "Schedule", icon: CalendarDays },
    { id: "invoices", label: "Invoices", icon: Receipt },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "sequences", label: "Follow-Ups", icon: RefreshCw },
  ];
  const secondaryNav = [
    { id: "help", label: "Help", icon: HelpCircle },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];
  const allNav = [...mainNav, ...secondaryNav];

  const handleLogout = async () => {
    await supabase.auth_signOut();
    supabase.token = null;
    supabase.user = null;
    clearCookies();
    dispatch({ type: "LOGOUT" });
    window.history.replaceState(null, "", "/");
  };

  const initials = (business?.contact_name || business?.business_name || "W").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  if (isMobile) {
    const bottomTabs = [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "quotes", label: "Quotes", icon: FileText },
      { id: "schedule", label: "Schedule", icon: CalendarDays },
    ];
    const allNav = [...mainNav, ...secondaryNav];

    return (
      <>
        {/* Hamburger header bar */}
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 1001,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px",
          background: "rgba(10,14,23,0.85)",
          backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <span style={{ fontFamily: theme.fontHeading, fontSize: 18, color: theme.text, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {business?.business_name || "Wynflow"}
          </span>
          <button onClick={() => setDrawerOpen(true)} style={{
            background: "none", border: "none", color: theme.textMuted, cursor: "pointer", padding: 6,
          }}>
            <Menu size={22} />
          </button>
        </div>

        {/* Slide-out drawer */}
        {drawerOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 2000 }}>
            <div
              onClick={() => setDrawerOpen(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }}
            />
            <div style={{
              position: "absolute", top: 0, right: 0, bottom: 0, width: 280,
              background: "rgba(17,24,39,0.97)",
              backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              borderLeft: "1px solid rgba(255,255,255,0.06)",
              padding: "20px 0",
              animation: "slideInRight 0.2s ease-out",
            }}>
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 16px 16px" }}>
                <button onClick={() => setDrawerOpen(false)} style={{
                  background: "none", border: "none", color: theme.textMuted, cursor: "pointer", padding: 4,
                }}>
                  <X size={20} />
                </button>
              </div>
              {allNav.map((item) => {
                const Icon = item.icon;
                const isActive = screen === item.id || screen?.startsWith(item.id + ":");
                return (
                  <button
                    key={item.id}
                    onClick={() => { dispatch({ type: "SET_SCREEN", payload: item.id }); setDrawerOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      width: "100%", padding: "14px 24px",
                      background: isActive ? "rgba(20,184,166,0.08)" : "transparent",
                      border: "none", cursor: "pointer",
                      color: isActive ? theme.accent : theme.textMuted,
                      fontSize: 15, fontFamily: theme.font,
                      borderLeft: isActive ? `3px solid ${theme.accent}` : "3px solid transparent",
                    }}
                  >
                    <Icon size={18} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom tab bar — 3 items only */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000,
          display: "flex", justifyContent: "space-around", alignItems: "center",
          padding: `8px 0 calc(8px + env(safe-area-inset-bottom, 6px))`,
          background: "rgba(10,14,23,0.85)",
          backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          {bottomTabs.map((item) => {
            const Icon = item.icon;
            const isActive = screen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => dispatch({ type: "SET_SCREEN", payload: item.id })}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  background: "none", border: "none", cursor: "pointer",
                  color: isActive ? theme.accent : theme.textDim,
                  fontSize: 10, fontFamily: theme.font, padding: "4px 16px",
                  position: "relative",
                }}
              >
                {isActive && (
                  <div style={{
                    position: "absolute", top: -8, width: 20, height: 3,
                    background: theme.accent, borderRadius: 2,
                  }} />
                )}
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div style={{
      width: 240, background: "rgba(255,255,255,0.015)", borderRight: "1px solid rgba(255,255,255,0.06)",
      display: "flex", flexDirection: "column", padding: "20px 12px", flexShrink: 0,
    }}>
      <div onClick={() => dispatch({ type: "SET_SCREEN", payload: "dashboard" })} style={{ padding: "4px 12px", marginBottom: 32, cursor: "pointer" }}>
        <WynflowLogo size={36} showText textSize={20} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {mainNav.map((item) => {
          const Icon = item.icon;
          const isActive = screen === item.id;
          return (
          <div key={item.id} onClick={() => dispatch({ type: "SET_SCREEN", payload: item.id })}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500,
              background: isActive ? "rgba(20,184,166,0.08)" : "transparent",
              color: isActive ? theme.accent : "rgba(255,255,255,0.45)",
              transition: "all 0.15s ease",
              position: "relative",
            }}
            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}}
            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}}>
            {isActive && <div style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: "0 2px 2px 0", background: theme.accent }} />}
            <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
            {item.label}
          </div>
          );
        })}
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)", margin: "12px 12px" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {secondaryNav.map((item) => {
          const Icon = item.icon;
          const isActive = screen === item.id;
          return (
          <div key={item.id} onClick={() => dispatch({ type: "SET_SCREEN", payload: item.id })}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500,
              background: isActive ? "rgba(20,184,166,0.08)" : "transparent",
              color: isActive ? theme.accent : "rgba(255,255,255,0.35)",
              transition: "all 0.15s ease",
              position: "relative",
            }}
            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}}
            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}}>
            {isActive && <div style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: "0 2px 2px 0", background: theme.accent }} />}
            <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
            {item.label}
          </div>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{
        padding: "14px 12px", borderRadius: 10, background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 700, color: theme.accent, letterSpacing: "0.02em" }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{business?.business_name}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{business?.email}</div>
        </div>
        <div onClick={handleLogout} title="Sign out"
          style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.25)", transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = theme.red; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.25)"; }}>
          <Lock size={14} />
        </div>
      </div>
    </div>
  );
};

// ─── Dashboard ───
const Dashboard = ({ quotes, dispatch, invoices = [] }) => {
  const isMobile = useIsMobile();
  const [bellOpen, setBellOpen] = useState(false);
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

  // Invoice stats
  const overdueInvoices = invoices.filter(i => (i.status === "sent" || i.status === "viewed") && i.due_date && new Date(i.due_date) < new Date()).length;
  const outstandingAmount = invoices.filter(i => i.status === "sent" || i.status === "viewed").reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);

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

  // Activity feed data
  const followUpsSentToday = quotes.filter(q => q.current_step > 0 && q.next_follow_up_at).length;
  const openedRecently = quotes.filter(q => q.status === "opened").length;
  const acceptedAfterFollowUp = acceptedQuotes.filter(q => (q.current_step || 0) > 0).length;

  // Pipeline columns
  const pipeline = [
    { key: "requested", label: "New Requests", color: theme.accent, count: requested, icon: MessageSquare },
    { key: "sent", label: "Awaiting", color: "#F59E0B", count: pending, icon: Clock },
    { key: "accepted", label: "Accepted", color: "#22C55E", count: accepted, icon: CheckCircle2 },
    { key: "booked", label: "Booked", color: theme.green, count: booked, icon: Check },
  ];

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isMobile ? 20 : 28 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: theme.text, margin: 0, letterSpacing: "-0.02em" }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: theme.textMuted, margin: "4px 0 0" }}>Here's what's happening with your quotes</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "aiQuote" })} size="sm" style={{ background: "rgba(20,184,166,0.1)", color: "#14B8A6", border: "1px solid rgba(20,184,166,0.15)" }}><Cpu size={13} /> AI Quote</Button>
          {!isMobile && <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "newQuote" })} variant="secondary" size="sm"><Plus size={13} /> Manual</Button>}
          {/* Notification bell */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setBellOpen(!bellOpen)}
              style={{ width: 36, height: 36, borderRadius: 8, background: bellOpen ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", transition: "all 0.15s" }}>
              <Bell size={16} color={(requested + accepted + overdueInvoices) > 0 ? theme.text : theme.textDim} />
              {(requested + accepted + overdueInvoices) > 0 && (
                <div style={{ position: "absolute", top: -3, right: -3, width: 16, height: 16, borderRadius: 8, background: overdueInvoices > 0 ? theme.red : theme.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", border: "2px solid #0A0E17" }}>
                  {requested + accepted + overdueInvoices}
                </div>
              )}
            </button>
            {bellOpen && (
              <>
                <div onClick={() => setBellOpen(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 98 }} />
                <div style={{ position: "absolute", top: 44, right: 0, width: isMobile ? "calc(100vw - 72px)" : 320, maxWidth: 320, background: "rgba(17,24,39,0.97)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, boxShadow: "0 16px 48px rgba(0,0,0,0.5)", zIndex: 99, overflow: "hidden", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
                  <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: theme.text, letterSpacing: "0.02em" }}>Activity</div>
                  </div>
                  <div style={{ maxHeight: 280, overflowY: "auto" }}>
                    {requested > 0 && (
                      <div onClick={() => { dispatch({ type: "SET_SCREEN", payload: "quotes" }); setBellOpen(false); }}
                        style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(20,184,166,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <MessageSquare size={13} color="#14B8A6" />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: theme.text }}>{requested} new quote request{requested > 1 ? "s" : ""}</div>
                          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>Review and send a quote</div>
                        </div>
                      </div>
                    )}
                    {accepted > 0 && (
                      <div onClick={() => { dispatch({ type: "SET_SCREEN", payload: "quotes" }); setBellOpen(false); }}
                        style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Clock size={13} color="#F59E0B" />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: theme.text }}>{accepted} accepted — ready to book</div>
                          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>Call your customer{accepted > 1 ? "s" : ""} to confirm</div>
                        </div>
                      </div>
                    )}
                    {overdueInvoices > 0 && (
                      <div onClick={() => { dispatch({ type: "SET_SCREEN", payload: "invoices" }); setBellOpen(false); }}
                        style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <AlertTriangle size={13} color={theme.red} />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: theme.text }}>{overdueInvoices} overdue invoice{overdueInvoices > 1 ? "s" : ""}</div>
                          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>Chase up payment</div>
                        </div>
                      </div>
                    )}
                    {requested === 0 && accepted === 0 && overdueInvoices === 0 && (
                      <div style={{ padding: "20px 16px", textAlign: "center" }}>
                        <Bell size={18} color={theme.textDim} style={{ marginBottom: 6 }} />
                        <div style={{ fontSize: 12, color: theme.textDim }}>No new activity</div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Automation activity feed strip */}
      {(followUpsSentToday > 0 || openedRecently > 0 || acceptedAfterFollowUp > 0) && (
        <div style={{
          display: "flex", alignItems: "center", gap: isMobile ? 10 : 16, padding: isMobile ? "10px 12px" : "10px 16px",
          borderRadius: 8, background: "rgba(20,184,166,0.04)", border: "1px solid rgba(20,184,166,0.08)",
          marginBottom: isMobile ? 16 : 20, overflowX: "auto", flexWrap: isMobile ? "nowrap" : "wrap",
        }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: theme.accent, flexShrink: 0, animation: "pulse 2s ease-in-out infinite", boxShadow: `0 0 8px ${theme.accentGlow}` }} />
          {followUpsSentToday > 0 && <span style={{ fontSize: 12, color: theme.textMuted, whiteSpace: "nowrap" }}><strong style={{ color: theme.accent }}>{followUpsSentToday}</strong> follow-up{followUpsSentToday > 1 ? "s" : ""} active</span>}
          {openedRecently > 0 && <><span style={{ color: "rgba(255,255,255,0.1)" }}>·</span><span style={{ fontSize: 12, color: theme.textMuted, whiteSpace: "nowrap" }}><strong style={{ color: theme.accentBlue }}>{openedRecently}</strong> quote{openedRecently > 1 ? "s" : ""} opened</span></>}
          {acceptedAfterFollowUp > 0 && <><span style={{ color: "rgba(255,255,255,0.1)" }}>·</span><span style={{ fontSize: 12, color: theme.textMuted, whiteSpace: "nowrap" }}><strong style={{ color: theme.green }}>{acceptedAfterFollowUp}</strong> won via follow-up</span></>}
        </div>
      )}

      {/* Pipeline overview */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : `repeat(${pipeline.length}, 1fr)`, gap: isMobile ? 8 : 10, marginBottom: isMobile ? 16 : 20 }}>
        {pipeline.map(col => (
          <div key={col.key} onClick={() => dispatch({ type: "SET_SCREEN", payload: "quotes" })}
            style={{ padding: isMobile ? 12 : 14, borderRadius: 10, background: "rgba(255,255,255,0.025)", border: `1px solid ${col.color}12`, cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${col.color}30`; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = `${col.color}12`; e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500 }}>{col.label}</span>
              <col.icon size={14} color={col.color} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: col.count > 0 ? col.color : theme.textDim, letterSpacing: "-0.02em" }}>{col.count}</div>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 8 : 10, marginBottom: isMobile ? 16 : 20 }}>
        <Stat label="Win Rate" value={`${winRate}%`} accent={winRate >= 50 ? theme.green : winRate >= 25 ? "#F59E0B" : theme.red} icon={BarChart3} />
        <Stat label="Revenue" value={`$${revenue.toLocaleString()}`} accent={theme.green} icon={DollarSign} />
        <Stat label="Avg Quote" value={`$${avgQuoteValue.toLocaleString()}`} icon={FileText} />
        {avgResponseDays !== null ? (
          <Stat label="Avg Response" value={`${avgResponseDays}d`} accent={theme.accent} icon={Clock} />
        ) : outstandingAmount > 0 ? (
          <Stat label="Outstanding" value={`$${outstandingAmount.toLocaleString()}`} accent={overdueInvoices > 0 ? theme.red : "#F59E0B"} icon={Receipt} />
        ) : (
          <Stat label="Total Quotes" value={total} icon={FileText} />
        )}
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 16 }}>

        {/* Left: Charts */}
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 16, order: isMobile ? 2 : 1 }}>

          {/* Quote funnel */}
          <Card style={{ padding: isMobile ? 16 : 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, margin: "0 0 14px", letterSpacing: "0.01em" }}>Quote Funnel</h3>
            {[
              { label: "Sent", value: total, color: theme.accent },
              { label: "Opened", value: quotes.filter(q => q.status === "opened").length, color: theme.blue },
              { label: "Accepted", value: accepted, color: "#F59E0B" },
              { label: "Booked", value: booked, color: theme.green },
              { label: "Declined", value: declined, color: theme.red },
            ].map((bar, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: theme.textMuted, marginBottom: 3 }}>
                  <span>{bar.label}</span><span style={{ fontWeight: 600, color: theme.text, fontFamily: "'DM Sans', sans-serif" }}>{bar.value}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${total > 0 ? (bar.value / total) * 100 : 0}%`, borderRadius: 3, background: bar.color, transition: "width 0.6s ease" }} />
                </div>
              </div>
            ))}
          </Card>

          {/* Monthly sparkline */}
          {months.length > 1 && (
            <Card style={{ padding: isMobile ? 16 : 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, margin: "0 0 3px", letterSpacing: "0.01em" }}>Monthly Revenue</h3>
              <p style={{ fontSize: 11, color: theme.textDim, margin: "0 0 14px" }}>Last {months.length} months</p>
              {(() => {
                const maxRev = Math.max(...months.map(m => m[1].revenue), 1);
                return (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 72 }}>
                    {months.map(([month, data], i) => (
                      <div key={month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{
                          width: "100%", maxWidth: 36, borderRadius: 4,
                          height: `${Math.max((data.revenue / maxRev) * 56, 3)}px`,
                          background: i === months.length - 1 ? theme.accent : "rgba(20,184,166,0.15)",
                          transition: "height 0.5s ease",
                        }} />
                        <span style={{ fontSize: 9, color: theme.textDim }}>{new Date(month + "-01").toLocaleDateString("en-NZ", { month: "short" })}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, padding: "8px 0 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 11, color: theme.textMuted }}>This month</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: theme.green }}>${(months[months.length - 1]?.[1]?.revenue || 0).toLocaleString()}</span>
              </div>
            </Card>
          )}

          {/* Follow-up effectiveness */}
          {stepData.length > 0 && (
            <Card style={{ padding: isMobile ? 16 : 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, margin: "0 0 3px", letterSpacing: "0.01em" }}>Follow-Up Effectiveness</h3>
              <p style={{ fontSize: 11, color: theme.textDim, margin: "0 0 12px" }}>When customers respond</p>
              {stepData.map(([label, count]) => {
                const maxStep = Math.max(...stepData.map(s => s[1]));
                return (
                  <div key={label} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: theme.textMuted, marginBottom: 3 }}>
                      <span>{label}</span><span style={{ fontWeight: 600, color: theme.text }}>{count}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(count / maxStep) * 100}%`, borderRadius: 3, background: theme.accent, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                );
              })}
            </Card>
          )}

          <div onClick={() => dispatch({ type: "SET_SCREEN", payload: "analytics" })}
            style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", cursor: "pointer", textAlign: "center", fontSize: 12, color: theme.accent, fontWeight: 500, transition: "all 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(20,184,166,0.2)"} onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"}>
            View Full Analytics →
          </div>
        </div>

        {/* Right: Recent Quotes */}
        <Card style={{ alignSelf: "start", order: isMobile ? 1 : 2, padding: isMobile ? 14 : 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, margin: 0, letterSpacing: "0.01em" }}>Recent Quotes</h3>
            <span onClick={() => dispatch({ type: "SET_SCREEN", payload: "quotes" })}
              style={{ fontSize: 12, color: theme.accent, cursor: "pointer", fontWeight: 500 }}>View all →</span>
          </div>
          {recentQuotes.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20, color: theme.textMuted, fontSize: 12 }}>
              No quotes yet — create your first one!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {recentQuotes.map((q) => (
                <div key={q.id}
                  onClick={() => dispatch({ type: "SET_SCREEN", payload: "quoteDetail:" + q.id })}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "9px 10px", borderRadius: 7, cursor: "pointer", transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 7, background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, color: theme.accent, flexShrink: 0,
                    }}>
                      {q.customer_name?.charAt(0) || "?"}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.customer_name}</div>
                      <div style={{ fontSize: 11, color: theme.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.job_title}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: theme.text, fontFamily: "'DM Sans', sans-serif" }}>${parseFloat(q.amount || 0).toLocaleString()}</span>
                    <Badge status={q.status} size="sm" />
                    <span onClick={(e) => { e.stopPropagation(); dispatch({ type: "SET_SCREEN", payload: "quoteDetail:" + q.id }); }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 500, color: theme.accent, padding: "3px 8px", borderRadius: 5, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.12)", cursor: "pointer" }}
                    ><Eye size={10} /> View</span>
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
const QuotesList = ({ quotes, dispatch, sequences, invoices = [] }) => {
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
        events.push({ type: "accepted", quote: q, date: q.responded_at, text: `${q.customer_name} responded — accepted $${parseFloat(q.amount || 0).toLocaleString()}` });
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

  // Archived = booked, declined, or manually completed
  const isArchived = (q) => q.status === "booked" || q.status === "declined" || q.manually_completed;
  // Active quotes = not archived
  const activeQuotes = quotes.filter(q => !isArchived(q));
  const archivedQuotes = quotes.filter(q => isArchived(q));

  // Filter logic
  const filtered = (filter === "archived" ? archivedQuotes : activeQuotes).filter((q) => {
    if (filter === "activity") return false;
    if (filter === "archived") {
      if (search && !q.customer_name?.toLowerCase().includes(search.toLowerCase()) && !q.job_title?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }
    if (filter === "noResponse") return isNoResponse(q);
    if (filter !== "all" && filter !== "noResponse") {
      if (filter === "sent") return (q.status === "sent" || q.status === "opened") && !isNoResponse(q);
      if (q.status !== filter) return false;
    }
    if (search && !q.customer_name?.toLowerCase().includes(search.toLowerCase()) && !q.job_title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Tab counts (active only, except archived)
  const counts = {
    all: activeQuotes.length,
    requested: activeQuotes.filter(q => q.status === "requested").length,
    accepted: activeQuotes.filter(q => q.status === "accepted").length,
    sent: activeQuotes.filter(q => (q.status === "sent" || q.status === "opened") && !isNoResponse(q)).length,
    noResponse: activeQuotes.filter(q => isNoResponse(q)).length,
    archived: archivedQuotes.length,
  };

  // Tabs in priority hierarchy
  const tabs = [
    { key: "all", label: "All" },
    { key: "requested", label: "Requested", count: counts.requested, dot: counts.requested > 0 },
    { key: "accepted", label: "Accepted", count: counts.accepted },
    { key: "sent", label: "Awaiting", count: counts.sent },
    { key: "noResponse", label: "No Response", count: counts.noResponse },
    { key: "activity", label: "Activity" },
    { key: "archived", label: "Archived", count: counts.archived },
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

  // Urgency color: red = needs action, amber = follow up, green = all good
  const getUrgencyColor = (q) => {
    if (q.status === "requested") return theme.red;
    if (q.status === "accepted") return "#F59E0B";
    if (isNoResponse(q)) return theme.red;
    if (q.status === "sent" || q.status === "opened") return "#F59E0B";
    if (q.status === "booked") return theme.green;
    return null;
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", marginBottom: isMobile ? 16 : 24, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: theme.text, margin: 0, letterSpacing: "-0.02em" }}>Quotes</h1>
          <p style={{ fontSize: 13, color: theme.textMuted, margin: "4px 0 0" }}>{activeQuotes.length} active{archivedQuotes.length > 0 ? ` · ${archivedQuotes.length} archived` : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "aiQuote" })} size="sm" style={{ background: "rgba(20,184,166,0.1)", color: "#14B8A6", border: "1px solid rgba(20,184,166,0.15)" }}><Cpu size={13} /> AI Quote</Button>
          <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "newQuote" })} variant="secondary" size="sm"><Plus size={13} /> Manual</Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: isMobile ? 12 : 16, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 4, flexWrap: "nowrap", alignItems: "center" }}>
        {tabs.map((tab) => (
          <span key={tab.key} onClick={() => setFilter(tab.key)}
            style={{
              padding: isMobile ? "5px 10px" : "6px 12px", borderRadius: 6, fontSize: isMobile ? 11 : 12, fontWeight: 500, cursor: "pointer",
              background: filter === tab.key ? "rgba(20,184,166,0.1)" : "transparent",
              color: filter === tab.key ? theme.accent : theme.textMuted,
              border: `1px solid ${filter === tab.key ? "rgba(20,184,166,0.2)" : "transparent"}`,
              whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
              transition: "all 0.15s",
            }}>
            {tab.label}
            {tab.dot && <span style={{ width: 5, height: 5, borderRadius: 3, background: theme.accent, flexShrink: 0 }} />}
            {tab.count > 0 && !tab.dot && <span style={{ fontSize: 10, fontWeight: 600, color: filter === tab.key ? theme.accent : theme.textDim }}>{tab.count}</span>}
          </span>
        ))}
      </div>

      {/* Search */}
      {filter !== "activity" && (
        <div style={{ position: "relative", marginBottom: isMobile ? 12 : 16, maxWidth: isMobile ? "100%" : 240 }}>
          <Search size={14} color={theme.textDim} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quotes..."
            style={{
              fontFamily: theme.font, fontSize: 13, padding: "8px 12px 8px 34px", borderRadius: 8, width: "100%",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: theme.text, outline: "none",
              boxSizing: "border-box",
            }} />
        </div>
      )}

      {/* Activity tab */}
      {filter === "activity" ? (
        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ padding: isMobile ? "10px 14px" : "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: theme.text, letterSpacing: "0.01em" }}>Recent Activity</span>
          </div>
          {buildActivity().length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: theme.textDim, fontSize: 13 }}>No activity yet</div>
          ) : buildActivity().map((event, i) => {
            const cfg = activityIcons[event.type] || { icon: FileText, color: theme.textMuted };
            const IconComp = cfg.icon;
            return (
              <div key={i}
                onClick={() => dispatch({ type: "SET_SCREEN", payload: "quoteDetail:" + event.quote.id })}
                style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: isMobile ? "10px 14px" : "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer", transition: "background 0.1s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ width: 28, height: 28, borderRadius: 7, background: cfg.color + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <IconComp size={14} color={cfg.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: theme.text, lineHeight: 1.5 }}>{event.text}</div>
                  <div style={{ fontSize: 10, color: theme.textDim, marginTop: 2 }}>{timeAgo(event.date)}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Quote list */
        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          {!isMobile && (
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 70px",
            padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 11,
            fontWeight: 600, color: theme.textDim, textTransform: "uppercase", letterSpacing: 0.5,
          }}>
            <span>Customer</span><span>Job</span><span>Amount</span><span>Status</span><span></span>
          </div>
          )}
          {filtered.map((q) => {
            const followUpLabel = getFollowUpLabel(q);
            const urgency = getUrgencyColor(q);
            return (
            <div key={q.id}
              onClick={() => dispatch({ type: "SET_SCREEN", payload: "quoteDetail:" + q.id })}
              style={isMobile ? {
                padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer",
                borderLeft: urgency ? `3px solid ${urgency}` : "3px solid transparent",
                transition: "background 0.1s",
              } : {
                display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 70px",
                padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer",
                borderLeft: urgency ? `3px solid ${urgency}` : "3px solid transparent",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {isMobile ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.customer_name}</div>
                      <div style={{ fontSize: 11, color: theme.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.job_title}</div>
                      {followUpLabel && <div style={{ fontSize: 10, color: theme.accent, fontWeight: 500, marginTop: 2 }}>{followUpLabel}</div>}
                      {isNoResponse(q) && <div style={{ fontSize: 10, color: theme.red, fontWeight: 500, marginTop: 2 }}>No response — all follow-ups sent</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>${parseFloat(q.amount || 0).toLocaleString()}</span>
                      <Badge status={q.status} size="sm" />
                      <span onClick={(e) => { e.stopPropagation(); dispatch({ type: "SET_SCREEN", payload: "quoteDetail:" + q.id }); }}
                        style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 500, color: theme.accent, padding: "3px 8px", borderRadius: 5, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.12)", cursor: "pointer" }}
                      ><Eye size={10} /> View</span>
                    </div>
                  </div>
                  {filter === "archived" && <ArchiveAction quote={q} invoices={invoices} dispatch={dispatch} />}
                </div>
              ) : (
                <>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{q.customer_name}</div>
                    <div style={{ fontSize: 11, color: theme.textDim }}>{q.customer_email}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ fontSize: 13, color: theme.text }}>{q.job_title}</div>
                    {followUpLabel && <div style={{ fontSize: 10, color: theme.accent, fontWeight: 500, marginTop: 2 }}>{followUpLabel}</div>}
                    {isNoResponse(q) && <div style={{ fontSize: 10, color: theme.red, fontWeight: 500, marginTop: 2 }}>No response — all follow-ups sent</div>}
                    {filter === "archived" && <ArchiveAction quote={q} invoices={invoices} dispatch={dispatch} />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, display: "flex", alignItems: "center", fontFamily: "'DM Sans', sans-serif" }}>${parseFloat(q.amount || 0).toLocaleString()}</div>
                  <div style={{ display: "flex", alignItems: "center" }}><Badge status={q.status} /></div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                    <span onClick={(e) => { e.stopPropagation(); dispatch({ type: "SET_SCREEN", payload: "quoteDetail:" + q.id }); }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, color: theme.accent, padding: "4px 10px", borderRadius: 6, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.12)", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(20,184,166,0.15)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(20,184,166,0.08)"; }}
                    ><Eye size={12} /> View</span>
                  </div>
                </>
              )}
            </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: theme.textDim, fontSize: 13 }}>
              {quotes.length === 0 ? "No quotes yet — create your first one!" : filter === "archived" ? "No archived jobs yet" : filter === "noResponse" ? "No unresponsive quotes — nice!" : "No quotes match this filter"}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Archive action row — shows invoice status for booked quotes
const ArchiveAction = ({ quote, invoices, dispatch }) => {
  const linkedInvoice = invoices.find(inv => inv.quote_id === quote.id);
  const [marking, setMarking] = useState(false);

  const markDoneManually = async (e) => {
    e.stopPropagation();
    setMarking(true);
    await db("quotes").eq("id", quote.id).update({ manually_completed: true });
    dispatch({ type: "UPDATE_QUOTE", payload: { id: quote.id, manually_completed: true } });
    dispatch({ type: "NOTIFY", payload: { message: "Marked as done", type: "success" } });
    setMarking(false);
  };

  if (quote.status === "declined") return null;
  if (quote.manually_completed) {
    return (
      <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
        <Check size={12} color={theme.textDim} />
        <span style={{ fontSize: 11, color: theme.textDim }}>Done manually</span>
      </div>
    );
  }
  if (linkedInvoice) {
    return (
      <div onClick={e => { e.stopPropagation(); dispatch({ type: "SET_SCREEN", payload: "invoiceDetail:" + linkedInvoice.id }); }}
        style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, cursor: "pointer" }}>
        <Receipt size={12} color={linkedInvoice.status === "paid" ? theme.green : theme.accent} />
        <span style={{ fontSize: 11, color: linkedInvoice.status === "paid" ? theme.green : theme.accent, fontWeight: 500 }}>
          Invoice {linkedInvoice.status === "paid" ? "paid" : linkedInvoice.status === "sent" || linkedInvoice.status === "viewed" ? "sent" : "draft"}
        </span>
      </div>
    );
  }
  // Booked but no invoice
  return (
    <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
      <span onClick={() => dispatch({ type: "SET_SCREEN", payload: "createInvoice:" + quote.id })}
        style={{ fontSize: 11, fontWeight: 600, color: theme.accent, cursor: "pointer", padding: "3px 8px", borderRadius: 6, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)", transition: "all 0.15s" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(20,184,166,0.15)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(20,184,166,0.08)"; }}>
        <Receipt size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 4, marginTop: -1 }} />Create Invoice
      </span>
      <span onClick={markDoneManually}
        style={{ fontSize: 11, fontWeight: 500, color: theme.textDim, cursor: "pointer", padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", transition: "all 0.15s" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}>
        {marking ? "..." : "Done Manually"}
      </span>
    </div>
  );
};

// ─── Analytics ───
const Analytics = ({ quotes, invoices = [] }) => {
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
  const avgQuoteValue = won > 0 ? Math.round(totalRevenue / won) : 0;

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
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: theme.textMuted, marginBottom: 3 }}>
        <span>{label}</span><span style={{ fontWeight: 600, color: theme.text, fontFamily: "'DM Sans', sans-serif" }}>{count}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${max > 0 ? (value / max) * 100 : 0}%`, borderRadius: 3, background: color, transition: "width 0.5s" }} />
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: isMobile ? 16 : 24 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: theme.text, margin: 0, letterSpacing: "-0.02em" }}>Analytics</h1>
        <p style={{ fontSize: 13, color: theme.textMuted, margin: "4px 0 0" }}>See how your quotes are performing</p>
      </div>

      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 8 : 10, marginBottom: isMobile ? 16 : 20 }}>
        <Stat label="Win Rate" value={`${winRate}%`} accent={winRate >= 50 ? theme.green : winRate >= 25 ? "#F59E0B" : theme.red} icon={BarChart3} />
        <Stat label="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} accent={theme.green} icon={DollarSign} />
        <Stat label="Avg Quote Value" value={`$${avgQuoteValue.toLocaleString()}`} accent={theme.accent} icon={DollarSign} />
        {avgResponseDays !== null && <Stat label="Avg Response" value={`${avgResponseDays}d`} accent={theme.accent} icon={Clock} />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 16, marginBottom: isMobile ? 12 : 16 }}>
        <Card style={{ padding: isMobile ? 16 : 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, margin: "0 0 16px", letterSpacing: "0.01em" }}>Quote Funnel</h3>
          <BarSimple label="Total Sent" value={total} max={total} color={theme.accent} count={total} />
          <BarSimple label="Awaiting Response" value={sent} max={total} color={theme.blue} count={sent} />
          <BarSimple label="Accepted" value={accepted} max={total} color="#F59E0B" count={accepted} />
          <BarSimple label="Booked" value={booked} max={total} color={theme.green} count={booked} />
          <BarSimple label="Declined" value={declined} max={total} color={theme.red} count={declined} />
        </Card>

        <Card style={{ padding: isMobile ? 16 : 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, margin: "0 0 6px", letterSpacing: "0.01em" }}>When Do Customers Respond?</h3>
          <p style={{ fontSize: 11, color: theme.textDim, margin: "0 0 16px" }}>Which follow-up triggered the response</p>
          {stepData.length > 0 ? (
            stepData.map(([label, count]) => (
              <BarSimple key={label} label={label} value={count} max={Math.max(...stepData.map(s => s[1]))} color={theme.accent} count={count} />
            ))
          ) : (
            <p style={{ fontSize: 13, color: theme.textDim, textAlign: "center", padding: 16 }}>No responses yet</p>
          )}
        </Card>
      </div>

      {/* Monthly trend */}
      {months.length > 0 && (
        <Card style={{ marginBottom: isMobile ? 12 : 16, padding: isMobile ? 16 : 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, margin: "0 0 16px", letterSpacing: "0.01em" }}>Monthly Overview</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Month", "Sent", "Won", "Declined", "Revenue"].map(h => (
                    <th key={h} style={{ textAlign: h === "Month" ? "left" : "right", padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: theme.textDim, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map(([month, data]) => (
                  <tr key={month}>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.03)", color: theme.text, fontWeight: 500, fontSize: 12 }}>{new Date(month + "-01").toLocaleDateString("en-NZ", { month: "short", year: "numeric" })}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.03)", color: theme.textMuted, textAlign: "right", fontSize: 12 }}>{data.sent}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.03)", color: theme.green, textAlign: "right", fontWeight: 600, fontSize: 12 }}>{data.won}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.03)", color: theme.red, textAlign: "right", fontSize: 12 }}>{data.declined}</td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.03)", color: theme.green, textAlign: "right", fontWeight: 600, fontSize: 12 }}>${data.revenue.toLocaleString()}</td>
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
          <Card style={{ padding: isMobile ? 16 : 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, margin: "0 0 6px", letterSpacing: "0.01em" }}>Why Customers Decline</h3>
            <p style={{ fontSize: 11, color: theme.textDim, margin: "0 0 16px" }}>Feedback from {declinedQuotes.length} declined quote{declinedQuotes.length > 1 ? "s" : ""}</p>
            {reasonData.map(([reason, count]) => (
              <BarSimple key={reason} label={reason} value={count} max={maxCount} color={theme.red} count={count} />
            ))}
          </Card>
        );
      })()}

      {/* Invoicing analytics */}
      {invoices.length > 0 && (() => {
        const invoiced = invoices.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
        const collected = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
        const outstanding = invoices.filter(i => i.status === "sent" || i.status === "viewed").reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
        const paidInvoices = invoices.filter(i => i.status === "paid" && i.sent_at && i.paid_at);
        const avgPayDays = paidInvoices.length > 0
          ? Math.round(paidInvoices.reduce((sum, i) => sum + Math.round((new Date(i.paid_at) - new Date(i.sent_at)) / (1000 * 60 * 60 * 24)), 0) / paidInvoices.length)
          : null;
        const paidCount = invoices.filter(i => i.status === "paid").length;
        const overdueCount = invoices.filter(i => (i.status === "sent" || i.status === "viewed") && i.due_date && new Date(i.due_date) < new Date()).length;
        const collectionRate = (paidCount + overdueCount) > 0 ? Math.round((paidCount / (paidCount + overdueCount)) * 100) : 100;
        return (
          <Card style={{ marginTop: isMobile ? 12 : 16, padding: isMobile ? 16 : 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 7, letterSpacing: "0.01em" }}><Receipt size={15} /> Invoicing</h3>
            <p style={{ fontSize: 11, color: theme.textDim, margin: "0 0 16px" }}>{invoices.length} invoice{invoices.length !== 1 ? "s" : ""} total</p>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
              {[
                { label: "Invoiced", value: `$${invoiced.toLocaleString()}`, color: theme.accent },
                { label: "Collected", value: `$${collected.toLocaleString()}`, color: theme.green },
                { label: "Outstanding", value: `$${outstanding.toLocaleString()}`, color: outstanding > 0 ? "#F59E0B" : theme.textDim },
                { label: "Collection", value: `${collectionRate}%`, color: collectionRate >= 80 ? theme.green : collectionRate >= 50 ? "#F59E0B" : theme.red },
              ].map((item, i) => (
                <div key={i} style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: item.color, letterSpacing: "-0.02em" }}>{item.value}</div>
                  <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 3 }}>{item.label}</div>
                </div>
              ))}
            </div>
            {avgPayDays !== null && (
              <div style={{ fontSize: 12, color: theme.textMuted }}>Average payment time: <strong style={{ color: theme.text }}>{avgPayDays} day{avgPayDays !== 1 ? "s" : ""}</strong></div>
            )}
          </Card>
        );
      })()}
    </div>
  );
};

// ─── Schedule View ───

// ========================
// JOB FORM MODAL
// ========================

function JobFormModal({ business, dispatch, defaults, quote, onClose, onBooked }) {
  const isMobile = useIsMobile();
  const [form, setForm] = React.useState({
    title: quote?.job_title || defaults?.title || "",
    customer_name: quote?.customer_name || defaults?.customer_name || "",
    customer_phone: quote?.customer_phone || defaults?.customer_phone || "",
    customer_email: quote?.customer_email || defaults?.customer_email || "",
    address: defaults?.address || "",
    date: defaults?.starts_at ? format(new Date(defaults.starts_at), "yyyy-MM-dd") : format(addDays(new Date(), 1), "yyyy-MM-dd"),
    time: defaults?.starts_at ? format(new Date(defaults.starts_at), "HH:mm") : "08:00",
    duration: "2",
    allDay: false,
    endDate: defaults?.ends_at ? format(new Date(defaults.ends_at), "yyyy-MM-dd") : "",
    assignedTo: "",
    assignedTags: [],
    notes: "",
  });
  const [saving, setSaving] = React.useState(false);
  const employeeTags = business?.employee_tags || [];
  const [tagSuggestions, setTagSuggestions] = React.useState([]);

  const handleAssignedInput = (val) => {
    setForm((f) => ({ ...f, assignedTo: val }));
    if (val.length > 0) {
      setTagSuggestions(employeeTags.filter((t) => t.toLowerCase().includes(val.toLowerCase()) && !form.assignedTags.includes(t)));
    } else {
      setTagSuggestions([]);
    }
  };

  const addTag = (tag) => {
    setForm((f) => ({ ...f, assignedTags: [...f.assignedTags, tag], assignedTo: "" }));
    setTagSuggestions([]);
  };

  const removeTag = (tag) => {
    setForm((f) => ({ ...f, assignedTags: f.assignedTags.filter((t) => t !== tag) }));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && form.assignedTo.trim()) {
      e.preventDefault();
      addTag(form.assignedTo.trim());
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.customer_name.trim() || !form.date) {
      dispatch({ type: "NOTIFY", payload: { message: "Title, customer name, and date are required", type: "error" } });
      return;
    }
    setSaving(true);
    let starts_at, ends_at;
    if (form.allDay) {
      starts_at = startOfDay(new Date(form.date)).toISOString();
      ends_at = form.endDate ? endOfDay(new Date(form.endDate)).toISOString() : endOfDay(new Date(form.date)).toISOString();
    } else {
      const [hours, mins] = form.time.split(":").map(Number);
      const start = new Date(form.date);
      start.setHours(hours, mins, 0, 0);
      starts_at = start.toISOString();
      ends_at = addHours(start, parseFloat(form.duration) || 2).toISOString();
    }
    const jobData = {
      business_id: business.id, quote_id: quote?.id || null,
      title: form.title.trim(), customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone || null, customer_email: form.customer_email || null,
      address: form.address || null, starts_at, ends_at, all_day: form.allDay,
      assigned_to: form.assignedTags, notes: form.notes || null,
      amount: quote ? parseFloat(quote.amount) || null : null, status: "scheduled",
    };
    const { data, error } = await db("jobs").insert([jobData]).select();
    if (error) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to create job", type: "error" } });
      setSaving(false);
      return;
    }
    if (data && data[0]) dispatch({ type: "ADD_JOB", payload: data[0] });
    const newTags = form.assignedTags.filter((t) => !employeeTags.includes(t));
    if (newTags.length > 0) {
      const updatedTags = [...employeeTags, ...newTags];
      await db("businesses").eq("id", business.id).update({ employee_tags: updatedTags });
      dispatch({ type: "SET_BUSINESS", payload: { ...business, employee_tags: updatedTags } });
    }
    if (quote && onBooked) await onBooked();
    dispatch({ type: "NOTIFY", payload: { message: quote ? "Job booked and scheduled!" : "Job created!", type: "success" } });
    onClose();
    if (!quote) dispatch({ type: "SET_SCREEN", payload: "schedule" });
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
      <div style={{
        position: "relative", width: isMobile ? "100%" : 480,
        maxHeight: isMobile ? "85vh" : "80vh", overflow: "auto",
        background: "rgba(17,24,39,0.98)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: isMobile ? "16px 16px 0 0" : 16, padding: 24,
        animation: isMobile ? "slideIn 0.2s ease-out" : undefined,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontFamily: theme.fontHeading, fontSize: 20, color: theme.text, margin: 0 }}>
            {quote ? "Book & Schedule" : "New Job"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer" }}><X size={20} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Job Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Input label="Customer Name" value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Phone" value={form.customer_phone} onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))} />
            <Input label="Email" value={form.customer_email} onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))} />
          </div>
          <Input label="Address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Job site address" />
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: theme.textMuted, fontSize: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={form.allDay} onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))} />
            Multi-day job (full days, no specific times)
          </label>
          {form.allDay ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Start Date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              <Input label="End Date" type="date" value={form.endDate || form.date} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Input label="Date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              <Input label="Time" type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
              <Input label="Hours" type="number" value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 13, color: theme.textMuted, marginBottom: 4, display: "block" }}>Assign To</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
              {form.assignedTags.map((tag) => (
                <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 12, fontSize: 13, background: "rgba(20,184,166,0.12)", color: theme.accent, border: "1px solid rgba(20,184,166,0.2)" }}>
                  {tag}
                  <button onClick={() => removeTag(tag)} style={{ background: "none", border: "none", color: theme.accent, cursor: "pointer", padding: 0, fontSize: 14 }}>×</button>
                </span>
              ))}
            </div>
            <input value={form.assignedTo} onChange={(e) => handleAssignedInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Type a name and press Enter" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: theme.text, fontFamily: theme.font, outline: "none" }} />
            {tagSuggestions.length > 0 && (
              <div style={{ marginTop: 4, background: "rgba(17,24,39,0.98)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
                {tagSuggestions.map((s) => (
                  <button key={s} onClick={() => addTag(s)} style={{ display: "block", width: "100%", padding: "8px 12px", fontSize: 13, background: "transparent", border: "none", color: theme.text, cursor: "pointer", textAlign: "left", fontFamily: theme.font }}
                    onMouseOver={(e) => e.target.style.background = "rgba(255,255,255,0.06)"} onMouseOut={(e) => e.target.style.background = "transparent"}>{s}</button>
                ))}
              </div>
            )}
          </div>
          <Input label="Notes" type="textarea" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Private job notes..." />
          {quote && (
            <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: 13, color: theme.textMuted }}>Quote Amount: </span>
              <span style={{ fontSize: 15, color: theme.text, fontWeight: 600 }}>${parseFloat(quote.amount || 0).toLocaleString()}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
          <Button onClick={handleSave} disabled={saving} style={{ width: "100%" }}>
            {saving ? "Saving..." : quote ? "Book & Schedule" : "Create Job"}
          </Button>
          {quote && (
            <button onClick={async () => { if (onBooked) await onBooked(); dispatch({ type: "NOTIFY", payload: { message: "Job booked! Nice one.", type: "success" } }); onClose(); }}
              style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 13, fontFamily: theme.font, textDecoration: "underline", padding: 4 }}>
              Book without scheduling
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ========================
// JOB DETAIL PANEL
// ========================

function JobDetailPanel({ job, business, dispatch, onClose, onEdit, quotes }) {
  const isMobile = useIsMobile();
  const [editingNotes, setEditingNotes] = React.useState(false);
  const [notes, setNotes] = React.useState(job.notes || "");
  const [saving, setSaving] = React.useState(false);
  const linkedQuote = job.quote_id ? quotes.find((q) => q.id === job.quote_id) : null;

  const statusConfig = {
    scheduled: { label: "Scheduled", color: "#14B8A6", bg: "rgba(20,184,166,0.12)" },
    in_progress: { label: "In Progress", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
    completed: { label: "Completed", color: "#22C55E", bg: "rgba(34,197,94,0.12)" },
    cancelled: { label: "Cancelled", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  };
  const sc = statusConfig[job.status] || statusConfig.scheduled;

  const updateJobStatus = async (newStatus) => {
    setSaving(true);
    const updates = { status: newStatus };
    if (newStatus === "completed") updates.completed_at = new Date().toISOString();
    if (newStatus === "scheduled") updates.completed_at = null;
    const { error } = await db("jobs").eq("id", job.id).update(updates);
    if (error) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to update job", type: "error" } });
    } else {
      const updated = { ...job, ...updates };
      dispatch({ type: "UPDATE_JOB", payload: updated });
      onEdit(updated);
      const messages = { in_progress: "Job started!", completed: "Job marked complete!", scheduled: "Job reopened.", cancelled: "Job cancelled." };
      dispatch({ type: "NOTIFY", payload: { message: messages[newStatus] || "Job updated", type: "success" } });
    }
    setSaving(false);
  };

  const saveNotes = async () => {
    const { error } = await db("jobs").eq("id", job.id).update({ notes });
    if (!error) {
      dispatch({ type: "UPDATE_JOB", payload: { id: job.id, notes } });
      onEdit({ ...job, notes });
      setEditingNotes(false);
    }
  };

  const formatJobTime = () => {
    if (job.all_day) {
      const start = format(new Date(job.starts_at), "EEE d MMM");
      const end = format(new Date(job.ends_at), "EEE d MMM");
      return start === end ? start : `${start} → ${end}`;
    }
    const start = new Date(job.starts_at);
    const end = new Date(job.ends_at);
    const duration = Math.round((end - start) / (1000 * 60 * 60) * 10) / 10;
    return `${format(start, "EEE d MMM")} · ${format(start, "h:mm a")} – ${format(end, "h:mm a")} (${duration}h)`;
  };

  const panelStyle = isMobile
    ? { position: "fixed", bottom: 0, left: 0, right: 0, maxHeight: "80vh", borderRadius: "16px 16px 0 0" }
    : { position: "fixed", top: 0, right: 0, bottom: 0, width: 400 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
      <div style={{
        ...panelStyle, background: "rgba(17,24,39,0.98)",
        borderLeft: isMobile ? "none" : "1px solid rgba(255,255,255,0.06)",
        borderTop: isMobile ? "1px solid rgba(255,255,255,0.06)" : "none",
        overflow: "auto", padding: 24, zIndex: 1,
        animation: isMobile ? "slideIn 0.2s ease-out" : "slideInRight 0.2s ease-out",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h3 style={{ fontFamily: theme.fontHeading, fontSize: 20, color: theme.text, margin: "0 0 8px" }}>{job.title}</h3>
            <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 500, background: sc.bg, color: sc.color }}>{sc.label}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", padding: 4 }}><X size={20} /></button>
        </div>

        <div style={{ padding: 14, background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 14 }}>
          <p style={{ fontSize: 15, color: theme.text, fontWeight: 500, margin: "0 0 6px" }}>{job.customer_name}</p>
          {job.customer_phone && <a href={`tel:${job.customer_phone}`} style={{ display: "block", fontSize: 13, color: theme.accent, textDecoration: "none", marginBottom: 4 }}>{job.customer_phone}</a>}
          {job.customer_email && <a href={`mailto:${job.customer_email}`} style={{ display: "block", fontSize: 13, color: theme.accent, textDecoration: "none", marginBottom: 4 }}>{job.customer_email}</a>}
          {job.address && <p style={{ fontSize: 13, color: theme.textMuted, margin: 0 }}>{job.address}</p>}
        </div>

        <div style={{ padding: 14, background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 14 }}>
          <p style={{ fontSize: 13, color: theme.textMuted, margin: "0 0 4px" }}>Scheduled</p>
          <p style={{ fontSize: 15, color: theme.text, margin: 0 }}>{formatJobTime()}</p>
        </div>

        {/* Assigned to — editable */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13, color: theme.textMuted, margin: "0 0 6px" }}>Assigned To</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            {(job.assigned_to || []).map((tag) => (
              <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 12, fontSize: 13, background: "rgba(20,184,166,0.12)", color: theme.accent, border: "1px solid rgba(20,184,166,0.2)" }}>
                {tag}
                <button onClick={async () => {
                  const updatedTags = (job.assigned_to || []).filter((t) => t !== tag);
                  const { error } = await db("jobs").eq("id", job.id).update({ assigned_to: updatedTags });
                  if (!error) {
                    const updated = { ...job, assigned_to: updatedTags };
                    dispatch({ type: "UPDATE_JOB", payload: updated });
                    onEdit(updated);
                  }
                }} style={{ background: "none", border: "none", color: theme.accent, cursor: "pointer", padding: 0, fontSize: 14 }}>×</button>
              </span>
            ))}
          </div>
          <input placeholder="Add team member..." onKeyDown={async (e) => {
            if (e.key === "Enter" && e.target.value.trim()) {
              const name = e.target.value.trim();
              const updatedTags = [...(job.assigned_to || []), name];
              const { error } = await db("jobs").eq("id", job.id).update({ assigned_to: updatedTags });
              if (!error) {
                const updated = { ...job, assigned_to: updatedTags };
                dispatch({ type: "UPDATE_JOB", payload: updated });
                onEdit(updated);
                const empTags = business?.employee_tags || [];
                if (!empTags.includes(name)) {
                  const newEmpTags = [...empTags, name];
                  await db("businesses").eq("id", business.id).update({ employee_tags: newEmpTags });
                  dispatch({ type: "SET_BUSINESS", payload: { ...business, employee_tags: newEmpTags } });
                }
              }
              e.target.value = "";
            }
          }} style={{ width: "100%", padding: "6px 10px", borderRadius: 8, fontSize: 13, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: theme.text, fontFamily: theme.font, outline: "none" }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <p style={{ fontSize: 13, color: theme.textMuted, margin: 0 }}>Notes</p>
            {!editingNotes && <button onClick={() => setEditingNotes(true)} style={{ background: "none", border: "none", color: theme.accent, cursor: "pointer", fontSize: 12 }}>Edit</button>}
          </div>
          {editingNotes ? (
            <div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: theme.text, fontFamily: theme.font, outline: "none", resize: "vertical" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Button onClick={saveNotes} size="sm">Save</Button>
                <Button onClick={() => { setEditingNotes(false); setNotes(job.notes || ""); }} variant="ghost" size="sm">Cancel</Button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 14, color: notes ? theme.text : theme.textDim, margin: 0 }}>{notes || "No notes"}</p>
          )}
        </div>

        {job.amount && (
          <div style={{ padding: 14, background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: theme.textMuted }}>Quote Amount: </span>
            <span style={{ fontSize: 17, color: theme.text, fontWeight: 600 }}>${parseFloat(job.amount).toLocaleString()}</span>
          </div>
        )}

        {linkedQuote && (
          <button onClick={() => { onClose(); dispatch({ type: "SET_SCREEN", payload: `quoteDetail:${linkedQuote.id}` }); }}
            style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "10px 14px", marginBottom: 14, borderRadius: 8, background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.15)", color: theme.accent, cursor: "pointer", fontSize: 14, fontFamily: theme.font }}>
            <FileText size={16} /> View Quote →
          </button>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {job.status === "scheduled" && (
            <>
              <Button onClick={() => updateJobStatus("in_progress")} disabled={saving} style={{ background: "#F59E0B", color: "#fff", width: "100%" }}>Start Job</Button>
              <Button onClick={() => updateJobStatus("cancelled")} disabled={saving} variant="danger" style={{ width: "100%" }}>Cancel Job</Button>
            </>
          )}
          {job.status === "in_progress" && (
            <>
              <Button onClick={() => updateJobStatus("completed")} disabled={saving} style={{ background: theme.green, color: "#fff", width: "100%" }}><Check size={16} /> Mark Complete</Button>
              <Button onClick={() => updateJobStatus("scheduled")} disabled={saving} variant="ghost" style={{ width: "100%" }}>Back to Scheduled</Button>
            </>
          )}
          {job.status === "completed" && (
            <>
              <Button onClick={() => updateJobStatus("scheduled")} disabled={saving} variant="ghost" style={{ width: "100%" }}>Reopen Job</Button>
              {linkedQuote && <Button onClick={() => { onClose(); dispatch({ type: "SET_SCREEN", payload: `createInvoice:${linkedQuote.id}` }); }} style={{ width: "100%" }}>Generate Invoice</Button>}
            </>
          )}
          {job.status === "cancelled" && (
            <Button onClick={() => updateJobStatus("scheduled")} disabled={saving} style={{ width: "100%" }}>Reschedule</Button>
          )}
        </div>
      </div>
    </div>
  );
}

const EMPLOYEE_COLORS = ["#3B82F6", "#F97316", "#A855F7", "#EC4899", "#06B6D4", "#84CC16", "#EAB308", "#6366F1"];
const JOB_STATUS_COLORS = {
  scheduled: "#14B8A6",
  in_progress: "#F59E0B",
  completed: "#22C55E",
  cancelled: "#EF4444",
};

function ScheduleView({ jobs, dispatch, business, quotes, focusDate }) {
  const isMobile = useIsMobile();
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobForm, setShowJobForm] = useState(false);
  const [jobFormDefaults, setJobFormDefaults] = useState(null);
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [currentDate, setCurrentDate] = useState(focusDate ? new Date(focusDate) : new Date());

  const employeeTags = business?.employee_tags || [];

  const getEmployeeColor = (name) => {
    const idx = employeeTags.indexOf(name);
    return idx >= 0 ? EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length] : "#8B95A8";
  };

  const filteredJobs = employeeFilter === "all"
    ? jobs
    : jobs.filter((j) => (j.assigned_to || []).includes(employeeFilter));

  const events = filteredJobs.map((job) => ({
    id: job.id,
    title: job.title,
    start: new Date(job.starts_at),
    end: new Date(job.ends_at),
    allDay: job.all_day || false,
    resource: job,
  }));

  const eventPropGetter = (event) => {
    const job = event.resource;
    let bgColor;
    let opacity = 1;
    if (employeeFilter !== "all") {
      const firstAssigned = (job.assigned_to || [])[0];
      bgColor = firstAssigned ? getEmployeeColor(firstAssigned) : "#8B95A8";
    } else {
      bgColor = JOB_STATUS_COLORS[job.status] || "#8B95A8";
    }
    if (job.status === "completed") opacity = 0.5;
    if (job.status === "cancelled") opacity = 0.3;
    return {
      style: {
        backgroundColor: bgColor, opacity, color: "#fff", border: "none",
        borderRadius: 6, fontSize: 12, fontFamily: "'DM Sans', sans-serif",
        padding: "2px 6px", position: "relative",
      },
    };
  };

  const EventComponent = ({ event }) => {
    const job = event.resource;
    const assignedCount = (job.assigned_to || []).length;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4, overflow: "hidden" }}>
        {employeeFilter !== "all" && (
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: JOB_STATUS_COLORS[job.status] || "#8B95A8", flexShrink: 0 }} />
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{event.title}</span>
        {assignedCount > 1 && <span style={{ fontSize: 10, opacity: 0.7, flexShrink: 0 }}>+{assignedCount - 1}</span>}
      </div>
    );
  };

  const handleEventDrop = async ({ event, start, end }) => {
    const job = event.resource;
    const updates = { starts_at: start.toISOString(), ends_at: end.toISOString() };
    dispatch({ type: "UPDATE_JOB", payload: { id: job.id, ...updates } });
    const { error } = await db("jobs").eq("id", job.id).update(updates);
    if (error) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to move job", type: "error" } });
      dispatch({ type: "UPDATE_JOB", payload: { id: job.id, starts_at: job.starts_at, ends_at: job.ends_at } });
    }
  };

  const handleEventResize = async ({ event, start, end }) => {
    const job = event.resource;
    const updates = { starts_at: start.toISOString(), ends_at: end.toISOString() };
    dispatch({ type: "UPDATE_JOB", payload: { id: job.id, ...updates } });
    const { error } = await db("jobs").eq("id", job.id).update(updates);
    if (error) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to resize job", type: "error" } });
      dispatch({ type: "UPDATE_JOB", payload: { id: job.id, starts_at: job.starts_at, ends_at: job.ends_at } });
    }
  };

  const handleSelectEvent = (event) => setSelectedJob(event.resource);

  const handleSelectSlot = ({ start }) => {
    const endTime = addHours(start, 2);
    setJobFormDefaults({ starts_at: start.toISOString(), ends_at: endTime.toISOString() });
    setShowJobForm(true);
  };

  const handleNewJob = () => {
    const tomorrow = addDays(new Date(), 1);
    const start = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 8, 0);
    const end = addHours(start, 2);
    setJobFormDefaults({ starts_at: start.toISOString(), ends_at: end.toISOString() });
    setShowJobForm(true);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontSize: isMobile ? 22 : 26, fontFamily: theme.fontHeading, color: theme.text, margin: 0 }}>Schedule</h2>
        <Button onClick={handleNewJob} style={{ display: "flex", alignItems: "center", gap: 6 }}><Plus size={16} /> New Job</Button>
      </div>

      {employeeTags.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => setEmployeeFilter("all")} style={{
            padding: "5px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer", fontFamily: theme.font, border: "1px solid",
            background: employeeFilter === "all" ? "rgba(20,184,166,0.15)" : "rgba(255,255,255,0.04)",
            color: employeeFilter === "all" ? theme.accent : theme.textMuted,
            borderColor: employeeFilter === "all" ? "rgba(20,184,166,0.3)" : "rgba(255,255,255,0.08)",
          }}>All</button>
          {employeeTags.map((tag, idx) => {
            const color = EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length];
            const isActive = employeeFilter === tag;
            return (
              <button key={tag} onClick={() => setEmployeeFilter(isActive ? "all" : tag)} style={{
                padding: "5px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer", fontFamily: theme.font,
                border: "1px solid", display: "flex", alignItems: "center", gap: 6,
                background: isActive ? `${color}22` : "rgba(255,255,255,0.04)",
                color: isActive ? color : theme.textMuted,
                borderColor: isActive ? `${color}55` : "rgba(255,255,255,0.08)",
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                {tag}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ height: isMobile ? "calc(100vh - 240px)" : "calc(100vh - 200px)", minHeight: 400 }}>
        <DnDCalendar
          localizer={localizer} events={events}
          defaultView={isMobile ? "day" : "week"} views={isMobile ? ["day"] : ["week", "day"]}
          date={currentDate} onNavigate={(date) => setCurrentDate(date)}
          min={new Date(2026, 0, 1, 6, 0)} max={new Date(2026, 0, 1, 20, 0)}
          step={30} timeslots={2} selectable resizable
          onEventDrop={handleEventDrop} onEventResize={handleEventResize}
          onSelectEvent={handleSelectEvent} onSelectSlot={handleSelectSlot}
          eventPropGetter={eventPropGetter} components={{ event: EventComponent }}
          formats={{
            dayHeaderFormat: (date) => format(date, "EEE d MMM"),
            dayRangeHeaderFormat: ({ start, end }) => `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`,
            timeGutterFormat: (date) => format(date, "h a"),
          }}
          style={{ height: "100%" }}
        />
      </div>

      {jobs.length === 0 && (
        <p style={{ textAlign: "center", color: theme.textDim, fontSize: 13, padding: "8px 0" }}>
          No jobs yet — book a quote or tap "New Job" to get started.
        </p>
      )}

      {selectedJob && (
        <JobDetailPanel job={selectedJob} business={business} dispatch={dispatch}
          onClose={() => setSelectedJob(null)} onEdit={(updatedJob) => setSelectedJob(updatedJob)} quotes={quotes} />
      )}

      {showJobForm && (
        <JobFormModal business={business} dispatch={dispatch} defaults={jobFormDefaults}
          onClose={() => { setShowJobForm(false); setJobFormDefaults(null); }} />
      )}
    </div>
  );
}

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

  const [hasDraft, setHasDraft] = useState(false);
  const [savedDraft, setSavedDraft] = useState(null);

  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem("wynflow_quote_draft") || "null");
      if (draft && (draft.form?.customerName || draft.editForm?.scope)) {
        setSavedDraft(draft);
        setHasDraft(true);
      }
    } catch (e) {}
  }, []);

  const QuotePreview = () => (
    <div onClick={() => setShowPreview(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? 12 : 20, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto", borderRadius: 12, background: "#fff", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", position: "relative" }}>
        <button onClick={() => setShowPreview(false)} style={{ position: "sticky", top: 0, right: 0, float: "right", margin: "12px 12px 0 0", width: 32, height: 32, borderRadius: 8, background: "rgba(0,0,0,0.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#6b7280", zIndex: 1 }}>×</button>
        <div style={{ padding: isMobile ? "20px 20px" : "32px 40px", marginTop: -32 }}>
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
          {editForm?.showBreakdown && editForm?.materials && <div style={{ marginBottom: 24 }}><div style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>Materials</div><div style={{ fontSize: 14, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-line" }}>{editForm.materials}</div></div>}
          <div style={{ background: "#f9fafb", borderRadius: 10, padding: 20, marginBottom: 24 }}>
            {editForm?.showBreakdown && (<>
              {parseFloat(editForm?.materialsCost) > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 14, color: "#6b7280" }}>Materials</span><span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>${parseFloat(editForm.materialsCost).toLocaleString()}</span></div>}
              {editForm?.labourHours && business.hourly_rate && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 14, color: "#6b7280" }}>Labour ({editForm.labourHours} hrs @ ${business.hourly_rate}/hr)</span><span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>${(parseFloat(editForm.labourHours) * parseFloat(business.hourly_rate)).toLocaleString()}</span></div>}
              {editForm?.includeCallout && parseFloat(business.callout_fee) > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 14, color: "#6b7280" }}>Callout Fee</span><span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>${parseFloat(business.callout_fee).toLocaleString()}</span></div>}
            </>)}
            {editForm?.showGST && business.gst_number ? (() => {
              const amt = parseFloat(editForm?.amount || 0);
              const isInc = business.gst_inclusive !== false;
              const subtotal = isInc ? Math.round((amt / 1.15) * 100) / 100 : amt;
              const gst = isInc ? Math.round((amt - subtotal) * 100) / 100 : Math.round(amt * 0.15 * 100) / 100;
              const total = isInc ? amt : Math.round((amt + gst) * 100) / 100;
              return (<>
                <div style={{ borderTop: editForm?.showBreakdown ? "2px solid #111827" : "none", paddingTop: editForm?.showBreakdown ? 12 : 0, marginTop: editForm?.showBreakdown ? 12 : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 14, color: "#6b7280" }}>Subtotal (excl. GST)</span><span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 14, color: "#6b7280" }}>GST (15%)</span><span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>${gst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #111827", paddingTop: 10 }}><span style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>Total (incl. GST)</span><span style={{ fontSize: 24, fontWeight: 800, color: "#14B8A6" }}>${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                </div>
              </>);
            })() : (
              <div style={{ borderTop: editForm?.showBreakdown ? "2px solid #111827" : "none", paddingTop: editForm?.showBreakdown ? 12 : 0, marginTop: editForm?.showBreakdown ? 12 : 0, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>Total</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "#14B8A6" }}>${parseFloat(editForm?.amount || 0).toLocaleString()}</span>
              </div>
            )}
          </div>
          {editForm?.notes && <div style={{ marginBottom: 24 }}><div style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>Terms & Conditions</div><div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, whiteSpace: "pre-line" }}>{editForm.notes}</div></div>}
          {editForm?.showBusinessDetails && business.quote_footer && <div style={{ marginBottom: 24, padding: "14px 16px", borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb" }}><div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, whiteSpace: "pre-line" }}>{business.quote_footer}</div></div>}
          {business.require_deposit && business.bank_account_number && (
            <div style={{ marginBottom: 24, padding: "16px 20px", borderRadius: 10, background: "#f0fdfa", border: "1px solid #ccfbf1" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Deposit Required — {business.deposit_percentage || 25}%</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 14, color: "#0d9488", fontWeight: 600 }}>Deposit Amount</span><span style={{ fontSize: 16, fontWeight: 700, color: "#0d9488" }}>${(parseFloat(editForm?.amount || 0) * (parseFloat(business.deposit_percentage || 25) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
              <div style={{ borderTop: "1px solid #ccfbf1", paddingTop: 10, marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Payment Details</div>
                {business.bank_name && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 13, color: "#6b7280" }}>Bank</span><span style={{ fontSize: 13, color: "#111827" }}>{business.bank_name}</span></div>}
                {business.bank_account_name && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 13, color: "#6b7280" }}>Account Name</span><span style={{ fontSize: 13, color: "#111827" }}>{business.bank_account_name}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 13, color: "#6b7280" }}>Account Number</span><span style={{ fontSize: 13, color: "#111827", fontWeight: 600 }}>{business.bank_account_number}</span></div>
              </div>
            </div>
          )}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ fontSize: 11, color: "#9ca3af" }}>Powered by <span style={{ color: "#14B8A6", fontWeight: 600 }}>Wynflow</span></div><div style={{ fontSize: 11, color: "#9ca3af" }}>Valid for 30 days</div></div>
        </div>
        <div style={{ padding: isMobile ? "16px 20px 24px" : "16px 40px 24px", background: "#f9fafb", borderTop: "1px solid #e5e7eb", display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={() => setShowPreview(false)}>Close</Button>
          <Button onClick={() => { setShowPreview(false); sendQuote(); }} disabled={sending}><Send size={16} /> Send Quote</Button>
        </div>
      </div>
    </div>
  );

  const resumeDraft = () => {
    if (savedDraft) {
      setForm(savedDraft.form || form);
      if (savedDraft.editForm) {
        setEditForm(savedDraft.editForm);
        setGenerated(savedDraft.hasGenerated ? {} : null);
      }
      setHasDraft(false);
      setSavedDraft(null);
      localStorage.removeItem("wynflow_quote_draft");
    }
  };

  const discardDraft = () => {
    setHasDraft(false);
    setSavedDraft(null);
    localStorage.removeItem("wynflow_quote_draft");
  };

  useEffect(() => {
    return () => {
      if (form.customerName || form.customerEmail || editForm?.scope) {
        try {
          localStorage.setItem("wynflow_quote_draft", JSON.stringify({ form, editForm, hasGenerated: !!generated }));
        } catch (e) {}
      }
    };
  }, [form, editForm, generated]);

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
    if (!form.customerName || !form.customerEmail || !form.customerPhone || !form.jobTitle || !form.description.trim()) {
      dispatch({ type: "NOTIFY", payload: { message: "Please fill in all fields including the job description — the more detail, the better the quote", type: "error" } });
      return;
    }
    setGenerating(true);
    try {
      const photoData = [];
      for (const photo of photos) {
        const compressed = await compressImage(photo);
        photoData.push({ name: photo.name, type: "image/jpeg", data: compressed });
      }
      // Build smart quote history for AI learning — prioritise won quotes, include decline reasons
      const allQuotesWithAmount = quotes.filter(q => q.amount && q.id);
      const wonQuotes = allQuotesWithAmount.filter(q => ["accepted", "booked"].includes(q.status));
      const sentQuotes = allQuotesWithAmount.filter(q => ["sent", "opened"].includes(q.status));
      const declinedQuotes = allQuotesWithAmount.filter(q => q.status === "declined");
      // Prioritise: won first (AI learns winning prices), then declined (learns what lost), then pending
      const sortedHistory = [...wonQuotes, ...declinedQuotes, ...sentQuotes].slice(0, 50);
      const quoteHistory = sortedHistory.map(q => ({
        job_title: q.job_title, description: q.description, amount: q.amount,
        status: q.status, source: q.source || "wynflow",
        date: q.sent_at || q.created_at || null,
        ...(q.decline_reason ? { decline_reason: q.decline_reason } : {}),
        ...(q.photos && q.photos.length > 0 ? { has_photos: true } : {}),
      }));
      // Find similar past quotes with photos — send up to 3 reference photos so AI learns visually
      const jobWords = form.jobTitle.toLowerCase().split(/\s+/);
      const similarWithPhotos = allQuotesWithAmount
        .filter(q => q.photos && q.photos.length > 0 && q.photos[0] && typeof q.photos[0] === "string" && q.photos[0].startsWith("http"))
        .map(q => ({ ...q, score: jobWords.filter(w => (q.job_title || "").toLowerCase().includes(w)).length }))
        .filter(q => q.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      const referencePhotos = similarWithPhotos.map(q => ({
        job_title: q.job_title, amount: q.amount, status: q.status, date: q.sent_at || q.created_at || null, photo_urls: q.photos.slice(0, 2),
      }));
      // Calculate win rate so AI can calibrate pricing aggressiveness
      const responded = wonQuotes.length + declinedQuotes.length;
      const winRate = responded > 0 ? Math.round((wonQuotes.length / responded) * 100) : null;
      const avgWonAmount = wonQuotes.length > 0 ? Math.round(wonQuotes.reduce((s, q) => s + parseFloat(q.amount), 0) / wonQuotes.length) : null;
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
          ai_pricing_mode: business.ai_pricing_mode || "flexible",
          quote_history: quoteHistory,
          reference_photos: referencePhotos,
          learning_context: { win_rate: winRate, avg_won_amount: avgWonAmount, total_quotes: allQuotesWithAmount.length, total_won: wonQuotes.length, total_declined: declinedQuotes.length },
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
        // Parse materials breakdown into individual line items
        const materialsText = result.quote.materials_breakdown || "";
        const parsedItems = materialsText.split("\n").filter(l => l.trim()).map(line => {
          // Try to extract price from end of line (e.g. "Pipe fittings - $45" or "Cement x2 $30")
          const priceMatch = line.match(/\$?([\d,.]+)\s*$/);
          const price = priceMatch ? priceMatch[1].replace(",", "") : "";
          const desc = priceMatch ? line.replace(priceMatch[0], "").replace(/[-–—:]\s*$/, "").trim() : line.trim();
          return { description: desc, costPrice: price, price: String(applyMargin(price)) };
        });
        // If no items parsed or no prices found, create one item with the total materials cost
        const lineItems = parsedItems.length > 0 ? parsedItems : [{ description: materialsText || "Materials", costPrice: matCost ? String(Math.round(matCost * 100) / 100) : "", price: matCost ? String(applyMargin(matCost)) : "" }];
        // Calculate marked-up materials cost and total from customer-facing prices
        const markedUpMatCost = lineItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
        const markedUpTotal = Math.round((markedUpMatCost + labourCost + callout) * 100) / 100;
        const materialsTextWithMargin = lineItems.filter(i => i.description?.trim()).map(i => i.description + (i.price ? " — $" + i.price : "")).join("\n");
        setEditForm({
          scope: result.quote.scope_of_work || "",
          materials: materialsTextWithMargin,
          lineItems,
          labourHours: result.quote.estimated_hours || "",
          materialsCost: String(Math.round(markedUpMatCost * 100) / 100),
          amount: String(markedUpTotal),
          notes: result.quote.notes || "",
          showBreakdown: business.default_show_breakdown !== undefined ? business.default_show_breakdown : true,
          showGST: !!business.gst_number,
          includeCallout: parseFloat(business.callout_fee) > 0,
          showBusinessDetails: !!(business.address || business.gst_number || business.license_number),
        });
      } else {
        dispatch({ type: "NOTIFY", payload: { message: "AI generation failed — try again", type: "error" } });
      }
    } catch (err) {
      reportError(err, "ai_quote_generation");
      dispatch({ type: "NOTIFY", payload: { message: "Failed to generate quote", type: "error" } });
    } finally {
      setGenerating(false);
    }
  };

  const marginPct = parseFloat(business.materials_margin) || 0;
  const applyMargin = (costPrice) => {
    const cp = parseFloat(costPrice) || 0;
    return marginPct > 0 ? Math.round(cp * (1 + marginPct / 100) * 100) / 100 : cp;
  };

  const recalcTotal = (fields) => {
    const hours = parseFloat(fields.labourHours) || 0;
    const rate = parseFloat(business.hourly_rate) || 0;
    const matCost = (fields.lineItems || []).reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    const callout = fields.includeCallout ? (parseFloat(business.callout_fee) || 0) : 0;
    return String(Math.round((matCost + (hours * rate) + callout) * 100) / 100);
  };

  const updatePricing = (key, val) => {
    setEditForm(prev => {
      const updated = { ...prev, [key]: val };
      // Sync materialsCost from line items
      updated.materialsCost = String((updated.lineItems || []).reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0));
      updated.amount = recalcTotal(updated);
      return updated;
    });
  };

  const updateLineItem = (index, field, value) => {
    setEditForm(prev => {
      const items = [...(prev.lineItems || [])];
      items[index] = { ...items[index], [field]: value };
      if (field === "costPrice") {
        items[index].price = String(applyMargin(value));
      }
      const matCost = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
      const updated = { ...prev, lineItems: items, materialsCost: String(matCost) };
      updated.amount = recalcTotal(updated);
      return updated;
    });
  };

  const addLineItem = () => {
    setEditForm(prev => ({
      ...prev,
      lineItems: [...(prev.lineItems || []), { description: "", costPrice: "", price: "" }]
    }));
  };

  const removeLineItem = (index) => {
    setEditForm(prev => {
      const items = (prev.lineItems || []).filter((_, i) => i !== index);
      const matCost = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
      const updated = { ...prev, lineItems: items, materialsCost: String(matCost) };
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
      const materialsText = (editForm.lineItems || []).filter(i => i.description.trim()).map(i => i.description + (i.price ? " — $" + i.price : "")).join("\n");
      const breakdown = {
        scope: editForm.scope,
        materials: materialsText,
        lineItems: editForm.lineItems,
        materialsCost: editForm.materialsCost,
        labourHours: editForm.labourHours,
        labourRate: business.hourly_rate,
        includeCallout: editForm.includeCallout,
        calloutFee: business.callout_fee,
        showBreakdown: editForm.showBreakdown,
        showGST: editForm.showGST,
        showBusinessDetails: editForm.showBusinessDetails,
        notes: editForm.notes,
        requireDeposit: business.require_deposit,
        depositPercentage: business.deposit_percentage,
        depositAmount: business.require_deposit ? parseFloat(editForm.amount || 0) * (parseFloat(business.deposit_percentage || 25) / 100) : null,
        bankName: business.bank_name,
        bankAccountName: business.bank_account_name,
        bankAccountNumber: business.bank_account_number,
        quoteFooter: business.quote_footer,
        businessAddress: business.address,
        gstNumber: business.gst_number,
        gstInclusive: business.gst_inclusive !== false,
        licenseNumber: business.license_number,
        businessPhone: business.phone,
        businessEmail: business.email,
      };
      const { data: newQuote, error: quoteErr } = await db("quotes").insert({
        business_id: business.id, quote_number: "", customer_name: form.customerName,
        customer_email: form.customerEmail, customer_phone: form.customerPhone,
        job_title: form.jobTitle, description: editForm.scope + (materialsText ? "\n\nMaterials:\n" + materialsText : "") + (editForm.notes ? "\n\nNotes:\n" + editForm.notes : ""),
        amount: parseFloat(editForm.amount), status: "sent", sent_at: new Date().toISOString(),
        sequence_id: business.auto_follow_ups !== false ? seqId : null,
        next_follow_up_at: business.auto_follow_ups !== false ? nextFollowUp : null,
        current_step: 0, follow_up_paused: business.auto_follow_ups === false,
        ai_estimate: parseFloat(editForm.amount), ai_estimate_notes: JSON.stringify(breakdown),
      });
      if (quoteErr || !newQuote?.[0]) throw new Error("Failed to create quote");
      const sendRes = await fetch("https://wynfallautomation.app.n8n.cloud/webhook/send-quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_id: newQuote[0].id, breakdown }),
      });
      dispatch({ type: "ADD_QUOTE", payload: newQuote[0] });
      try { localStorage.removeItem("wynflow_quote_draft"); } catch (e) {}
      if (!sendRes.ok) {
        dispatch({ type: "NOTIFY", payload: { message: "Quote saved but email failed to send. Try resending from quote details.", type: "error" } });
      } else {
        dispatch({ type: "NOTIFY", payload: { message: `Quote sent to ${form.customerName}!${business.auto_follow_ups !== false ? " Follow-ups scheduled." : ""}`, type: "success" } });
      }
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: err.message, type: "error" } });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      {hasDraft && (
        <div style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>You have a draft quote</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{savedDraft?.form?.customerName ? `For ${savedDraft.form.customerName}` : "Resume where you left off?"}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button size="sm" onClick={resumeDraft}>Resume</Button>
            <Button size="sm" variant="ghost" onClick={discardDraft}>Discard</Button>
          </div>
        </div>
      )}
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
              <Input label="Job Description *" value={form.description} onChange={v => update("description", v)} textarea placeholder="Give as much detail as possible! e.g. Replace shower mixer, retile 3m² floor, new vanity install..." />
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
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 24, alignItems: "start" }}>
          {/* Status banner */}
          <Card style={{ gridColumn: "1 / -1", background: "rgba(20,184,166,0.04)", border: "1px solid rgba(20,184,166,0.2)", ...(isMobile ? { padding: 16 } : {}) }}>
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
            <p style={{ fontSize: 12, color: theme.textMuted }}>Edit on the left — {isMobile ? "preview below" : "live preview on the right"}</p>
            <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", display: "flex", alignItems: "flex-start", gap: 8 }}>
              <AlertTriangle size={14} color="#F59E0B" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.5 }}>AI-generated quotes are estimates only. Always review all items, quantities, and pricing before sending. You are responsible for the final quote.</p>
            </div>
          </Card>

          {/* Left column: Edit form */}
          <Card style={isMobile ? { padding: 16 } : {}}>
            <Input label="Description" value={editForm.scope} onChange={v => setEditForm(prev => ({ ...prev, scope: v }))} textarea />

            {/* Pricing section — always visible for editing */}
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: theme.text, margin: 0 }}>Pricing</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {business.gst_number && (
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: theme.textMuted }}>
                      <input type="checkbox" checked={editForm.showGST} onChange={e => setEditForm(prev => ({ ...prev, showGST: e.target.checked }))} style={{ accentColor: theme.accent }} />
                      Show GST
                    </label>
                  )}
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: theme.textMuted }}>
                    <input type="checkbox" checked={editForm.showBreakdown} onChange={e => {
                      const c = e.target.checked;
                      setEditForm(prev => ({ ...prev, showBreakdown: c }));
                      if (confirm(c ? "Always show pricing breakdown on future quotes?" : "Always hide pricing breakdown on future quotes?")) {
                        db("businesses").eq("id", business.id).update({ default_show_breakdown: c });
                      }
                    }} style={{ accentColor: theme.accent }} />
                    Show breakdown
                  </label>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {marginPct === 0 && editForm.lineItems?.some(i => i.costPrice || i.price) && (
                  <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, color: "rgba(234,179,8,0.9)" }}>No materials markup set — these prices are at cost.</div>
                    <button onClick={() => dispatch({ type: "SET_SCREEN", payload: "settings" })} style={{ fontSize: 12, color: theme.accent, background: "none", border: "none", cursor: "pointer", fontFamily: theme.font, fontWeight: 600, whiteSpace: "nowrap", textDecoration: "underline" }}>Set in Settings</button>
                  </div>
                )}
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Line Items</div>
                {marginPct > 0 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 4 }}>
                    <div style={{ flex: 1, fontSize: 11, color: theme.textDim }}>Description</div>
                    <div style={{ width: isMobile ? 80 : 100, fontSize: 11, color: theme.textDim, textAlign: "right" }}>Cost</div>
                    <span style={{ fontSize: 12, color: "transparent" }}>→</span>
                    <div style={{ width: isMobile ? 80 : 100, fontSize: 11, color: theme.textDim, textAlign: "right" }}>Customer</div>
                    <div style={{ width: 30 }} />
                  </div>
                )}
                {(editForm.lineItems || []).map((item, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <input value={item.description} onChange={e => updateLineItem(idx, "description", e.target.value)} placeholder="Item description"
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: theme.text, fontSize: 14, fontFamily: theme.font, outline: "none" }}
                        onFocus={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"; }}
                        onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }} />
                    </div>
                    {marginPct > 0 ? (
                      <>
                        <div style={{ width: isMobile ? 80 : 100 }}>
                          <input value={item.costPrice || ""} onChange={e => updateLineItem(idx, "costPrice", e.target.value)} placeholder="Cost" type="number"
                            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: theme.textMuted, fontSize: 13, fontFamily: theme.font, outline: "none", textAlign: "right" }}
                            onFocus={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"; }}
                            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }} />
                        </div>
                        <span style={{ fontSize: 12, color: theme.textDim }}>→</span>
                        <div style={{ width: isMobile ? 80 : 100 }}>
                          <input value={item.price} onChange={e => updateLineItem(idx, "price", e.target.value)} placeholder="$0" type="number"
                            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: theme.text, fontSize: 14, fontFamily: theme.font, outline: "none", textAlign: "right" }}
                            onFocus={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"; }}
                            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }} />
                        </div>
                      </>
                    ) : (
                      <div style={{ width: isMobile ? 90 : 110 }}>
                        <input value={item.price} onChange={e => updateLineItem(idx, "price", e.target.value)} placeholder="$0" type="number"
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: theme.text, fontSize: 14, fontFamily: theme.font, outline: "none", textAlign: "right" }}
                          onFocus={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"; }}
                          onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }} />
                      </div>
                    )}
                    {(editForm.lineItems || []).length > 1 && (
                      <button onClick={() => removeLineItem(idx)} style={{ padding: "8px", background: "none", border: "none", color: theme.textDim, cursor: "pointer", fontSize: 16, lineHeight: 1, flexShrink: 0, borderRadius: 6, transition: "all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = theme.textDim; e.currentTarget.style.background = "none"; }}>×</button>
                    )}
                  </div>
                ))}
                <button onClick={addLineItem} style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.1)", color: theme.textMuted, fontSize: 13, cursor: "pointer", fontFamily: theme.font, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"; e.currentTarget.style.color = theme.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = theme.textMuted; }}>
                  <Plus size={14} /> Add line item
                </button>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: theme.textMuted }}>Materials subtotal</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>${parseFloat(editForm.materialsCost || 0).toLocaleString()}</span>
                </div>
                {marginPct > 0 && (editForm.lineItems || []).some(i => parseFloat(i.costPrice) > 0) && (() => {
                  const markupTotal = (editForm.lineItems || []).reduce((sum, item) => sum + ((parseFloat(item.price) || 0) - (parseFloat(item.costPrice) || 0)), 0);
                  return markupTotal > 0 ? (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                      <span style={{ fontSize: 12, color: theme.accent }}>Materials markup</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: theme.accent }}>+${Math.round(markupTotal).toLocaleString()}</span>
                    </div>
                  ) : null;
                })()}
                <div style={{ marginTop: 4 }}><Input label="Labour Hours" value={editForm.labourHours} onChange={v => updatePricing("labourHours", v)} type="number" /></div>
                {business.hourly_rate && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: -4 }}>Labour: {editForm.labourHours || 0} hrs × ${business.hourly_rate}/hr = ${((parseFloat(editForm.labourHours) || 0) * parseFloat(business.hourly_rate)).toLocaleString()}</div>}
                {parseFloat(business.callout_fee) > 0 && (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: theme.textMuted }}>
                    <input type="checkbox" checked={editForm.includeCallout} onChange={e => updatePricing("includeCallout", e.target.checked)} style={{ accentColor: theme.accent }} />
                    Include callout fee (${parseFloat(business.callout_fee).toLocaleString()})
                  </label>
                )}
                {business.gst_number ? (() => {
                  const amt = parseFloat(editForm.amount || 0);
                  const isInc = business.gst_inclusive !== false;
                  const subtotal = isInc ? Math.round((amt / 1.15) * 100) / 100 : amt;
                  const gst = isInc ? Math.round((amt - subtotal) * 100) / 100 : Math.round(amt * 0.15 * 100) / 100;
                  const total = isInc ? amt : Math.round((amt + gst) * 100) / 100;
                  return (
                    <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 12, marginTop: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: theme.textMuted }}>Subtotal (excl. GST)</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: theme.text }}>${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: theme.textMuted }}>GST (15%)</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: theme.text }}>${gst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${theme.border}`, paddingTop: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>Total (incl. GST)</span>
                        <span style={{ fontSize: 22, fontWeight: 700, color: theme.accent }}>${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  );
                })() : (
                <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 12, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>Total</span>
                  <span style={{ fontSize: 22, fontWeight: 700, color: theme.accent }}>${parseFloat(editForm.amount || 0).toLocaleString()}</span>
                </div>
                )}
                <div style={{ marginTop: -4 }}><Input label="Override Total ($)" value={editForm.amount} onChange={v => setEditForm(prev => ({ ...prev, amount: v }))} type="number" /></div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}><Input label="Notes / Terms" value={editForm.notes} onChange={v => setEditForm(prev => ({ ...prev, notes: v }))} textarea placeholder="e.g. Valid for 30 days, 25% deposit required..." /></div>
            <div style={{ marginTop: 12 }}><Input label="Customer Email *" value={form.customerEmail} onChange={v => update("customerEmail", v)} type="email" /></div>
            {(business.address || business.gst_number || business.license_number || business.quote_footer) && (
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
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

          {/* Right column: Live preview (desktop) / Preview button trigger (mobile) */}
          <div style={{ position: isMobile ? "static" : "sticky", top: isMobile ? "auto" : 32 }}>
            {isMobile && (
              <Button variant="secondary" onClick={() => setShowPreview(true)} style={{ width: "100%", justifyContent: "center", marginBottom: 12 }}><FileText size={16} /> Preview Quote</Button>
            )}
            {!isMobile && (
              <div style={{ borderRadius: 12, background: "#fff", boxShadow: "0 4px 24px rgba(0,0,0,0.15)", overflow: "hidden" }}>
                <div style={{ padding: "6px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 }}>Live Preview</span>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: "#22C55E" }} />
                </div>
                <div style={{ padding: "24px 28px", maxHeight: "70vh", overflowY: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#0A0E17", fontFamily: theme.fontDisplay }}>{business.business_name}</div>
                      {editForm?.showBusinessDetails && business.address && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{business.address}</div>}
                      {business.phone && <div style={{ fontSize: 11, color: "#6b7280", marginTop: editForm?.showBusinessDetails && business.address ? 0 : 3 }}>{business.phone}</div>}
                      {business.email && <div style={{ fontSize: 11, color: "#6b7280" }}>{business.email}</div>}
                      {editForm?.showBusinessDetails && (business.gst_number || business.license_number) && (
                        <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                          {business.gst_number && <div style={{ fontSize: 10, color: "#9ca3af" }}>GST: {business.gst_number}</div>}
                          {business.license_number && <div style={{ fontSize: 10, color: "#9ca3af" }}>{business.license_number}</div>}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 9, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1 }}>Quote</div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}</div>
                    </div>
                  </div>
                  <div style={{ borderBottom: "2px solid #14B8A6", marginBottom: 18 }} />
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>Prepared For</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{form.customerName}</div>
                    {form.customerEmail && <div style={{ fontSize: 11, color: "#6b7280" }}>{form.customerEmail}</div>}
                    {form.customerPhone && <div style={{ fontSize: 11, color: "#6b7280" }}>{form.customerPhone}</div>}
                  </div>
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>Job</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{form.jobTitle}</div>
                  </div>
                  {editForm?.scope && <div style={{ marginBottom: 18 }}><div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>Scope of Work</div><div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-line" }}>{editForm.scope}</div></div>}
                  {editForm?.showBreakdown && editForm?.lineItems?.some(i => i.description.trim()) && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>Materials</div>
                      {editForm.lineItems.filter(i => i.description.trim()).map((item, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f3f4f6" }}>
                          <span style={{ fontSize: 12, color: "#374151" }}>{item.description}</span>
                          {item.price && <span style={{ fontSize: 12, color: "#111827", fontWeight: 500 }}>${parseFloat(item.price).toLocaleString()}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ background: "#f9fafb", borderRadius: 8, padding: 14, marginBottom: 18 }}>
                    {editForm?.showBreakdown && (<>
                      {parseFloat(editForm?.materialsCost) > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 12, color: "#6b7280" }}>Materials</span><span style={{ fontSize: 12, color: "#111827", fontWeight: 500 }}>${parseFloat(editForm.materialsCost).toLocaleString()}</span></div>}
                      {editForm?.labourHours && business.hourly_rate && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 12, color: "#6b7280" }}>Labour ({editForm.labourHours} hrs @ ${business.hourly_rate}/hr)</span><span style={{ fontSize: 12, color: "#111827", fontWeight: 500 }}>${(parseFloat(editForm.labourHours) * parseFloat(business.hourly_rate)).toLocaleString()}</span></div>}
                      {editForm?.includeCallout && parseFloat(business.callout_fee) > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 12, color: "#6b7280" }}>Callout Fee</span><span style={{ fontSize: 12, color: "#111827", fontWeight: 500 }}>${parseFloat(business.callout_fee).toLocaleString()}</span></div>}
                    </>)}
                    {editForm?.showGST && business.gst_number ? (() => {
                      const amt = parseFloat(editForm?.amount || 0);
                      const isInc = business.gst_inclusive !== false;
                      const subtotal = isInc ? Math.round((amt / 1.15) * 100) / 100 : amt;
                      const gst = isInc ? Math.round((amt - subtotal) * 100) / 100 : Math.round(amt * 0.15 * 100) / 100;
                      const total = isInc ? amt : Math.round((amt + gst) * 100) / 100;
                      return (
                        <div style={{ borderTop: editForm?.showBreakdown ? "2px solid #111827" : "none", paddingTop: editForm?.showBreakdown ? 8 : 0, marginTop: editForm?.showBreakdown ? 8 : 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 11, color: "#6b7280" }}>Subtotal (excl. GST)</span><span style={{ fontSize: 11, color: "#111827", fontWeight: 500 }}>${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 11, color: "#6b7280" }}>GST (15%)</span><span style={{ fontSize: 11, color: "#111827", fontWeight: 500 }}>${gst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #111827", paddingTop: 6 }}><span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Total (incl. GST)</span><span style={{ fontSize: 16, fontWeight: 800, color: "#14B8A6" }}>${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                        </div>
                      );
                    })() : (
                      <div style={{ borderTop: editForm?.showBreakdown ? "2px solid #111827" : "none", paddingTop: editForm?.showBreakdown ? 10 : 0, marginTop: editForm?.showBreakdown ? 8 : 0, display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Total</span><span style={{ fontSize: 18, fontWeight: 800, color: "#14B8A6" }}>${parseFloat(editForm?.amount || 0).toLocaleString()}</span></div>
                    )}
                  </div>
                  {editForm?.notes && <div style={{ marginBottom: 18 }}><div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>Terms & Conditions</div><div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5, whiteSpace: "pre-line" }}>{editForm.notes}</div></div>}
                  {editForm?.showBusinessDetails && business.quote_footer && <div style={{ marginBottom: 18, padding: "10px 12px", borderRadius: 6, background: "#f9fafb", border: "1px solid #e5e7eb" }}><div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5, whiteSpace: "pre-line" }}>{business.quote_footer}</div></div>}
                  {business.require_deposit && business.bank_account_number && (
                    <div style={{ marginBottom: 18, padding: "12px 14px", borderRadius: 8, background: "#f0fdfa", border: "1px solid #ccfbf1" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#0d9488", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Deposit Required — {business.deposit_percentage || 25}%</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 11, color: "#0d9488", fontWeight: 600 }}>Deposit Amount</span><span style={{ fontSize: 12, fontWeight: 700, color: "#0d9488" }}>${(parseFloat(editForm?.amount || 0) * (parseFloat(business.deposit_percentage || 25) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                      <div style={{ borderTop: "1px solid #ccfbf1", paddingTop: 8, marginTop: 8 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Payment Details</div>
                        {business.bank_name && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span style={{ fontSize: 11, color: "#6b7280" }}>Bank</span><span style={{ fontSize: 11, color: "#111827" }}>{business.bank_name}</span></div>}
                        {business.bank_account_name && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span style={{ fontSize: 11, color: "#6b7280" }}>Account Name</span><span style={{ fontSize: 11, color: "#111827" }}>{business.bank_account_name}</span></div>}
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 11, color: "#6b7280" }}>Account Number</span><span style={{ fontSize: 11, color: "#111827", fontWeight: 600 }}>{business.bank_account_number}</span></div>
                      </div>
                    </div>
                  )}
                  <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ fontSize: 9, color: "#9ca3af" }}>Powered by <span style={{ color: "#14B8A6", fontWeight: 600 }}>Wynflow</span></div><div style={{ fontSize: 9, color: "#9ca3af" }}>Valid for 30 days</div></div>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => { setGenerated(null); setEditForm(null); }}>Regenerate</Button>
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
    jobTitle: "", description: "", sequenceId: sequences.find(s => s.is_default)?.id || sequences[0]?.id || "",
  });
  const [lineItems, setLineItems] = useState([{ description: "", costPrice: "", price: "" }]);
  const [showBreakdown, setShowBreakdown] = useState(business.default_show_breakdown !== undefined ? business.default_show_breakdown : true);
  const [pdfFile, setPdfFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const update = (key, val) => setForm({ ...form, [key]: val });

  const marginPct = parseFloat(business.materials_margin) || 0;
  const applyMargin = (costPrice) => {
    const cp = parseFloat(costPrice) || 0;
    return marginPct > 0 ? Math.round(cp * (1 + marginPct / 100) * 100) / 100 : cp;
  };

  const totalAmount = lineItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

  const updateLineItem = (index, field, value) => {
    setLineItems(prev => {
      const items = [...prev];
      items[index] = { ...items[index], [field]: value };
      if (field === "costPrice") {
        items[index].price = String(applyMargin(value));
      }
      return items;
    });
  };

  const addLineItem = () => setLineItems(prev => [...prev, { description: "", costPrice: "", price: "" }]);

  const removeLineItem = (index) => setLineItems(prev => prev.filter((_, i) => i !== index));

  const handleCreate = async () => {
    const filledItems = lineItems.filter(i => i.description.trim());
    if (!form.customerName || !form.customerEmail || !form.customerPhone || !form.jobTitle || filledItems.length === 0) {
      dispatch({ type: "NOTIFY", payload: { message: "Please fill in all required fields (name, email, phone, job title, and at least one line item)", type: "error" } });
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
      const materialsText = filledItems.map(i => i.description + (i.price ? " — $" + i.price : "")).join("\n");
      const breakdown = {
        scope: form.description || "",
        materials: materialsText,
        lineItems: filledItems,
        materialsCost: String(totalAmount),
        showBreakdown: showBreakdown,
        showBusinessDetails: !!(business.address || business.gst_number || business.license_number),
        notes: "",
        requireDeposit: business.require_deposit,
        depositPercentage: business.deposit_percentage,
        depositAmount: business.require_deposit ? totalAmount * (parseFloat(business.deposit_percentage || 25) / 100) : null,
        bankName: business.bank_name,
        bankAccountName: business.bank_account_name,
        bankAccountNumber: business.bank_account_number,
        quoteFooter: business.quote_footer,
        businessAddress: business.address,
        gstNumber: business.gst_number,
        gstInclusive: business.gst_inclusive !== false,
        licenseNumber: business.license_number,
        businessPhone: business.phone,
        businessEmail: business.email,
      };
      const { data: newQuote, error: quoteErr } = await db("quotes").insert({
        business_id: business.id,
        quote_number: "",
        customer_name: form.customerName,
        customer_email: form.customerEmail,
        customer_phone: form.customerPhone,
        job_title: form.jobTitle,
        description: (form.description ? form.description + "\n\n" : "") + "Items:\n" + materialsText,
        amount: totalAmount,
        pdf_url: pdfUrl,
        pdf_filename: pdfFilename,
        status: "sent",
        sent_at: new Date().toISOString(),
        sequence_id: business.auto_follow_ups !== false ? (form.sequenceId || null) : null,
        next_follow_up_at: business.auto_follow_ups !== false ? nextFollowUp : null,
        current_step: 0,
        follow_up_paused: business.auto_follow_ups === false,
        ai_estimate_notes: JSON.stringify(breakdown),
      });
      if (quoteErr || !newQuote?.[0]) throw new Error("Failed to create quote");
      const sendRes = await fetch("https://wynfallautomation.app.n8n.cloud/webhook/send-quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_id: newQuote[0].id, breakdown }),
      });
      dispatch({ type: "ADD_QUOTE", payload: newQuote[0] });
      if (!sendRes.ok) {
        dispatch({ type: "NOTIFY", payload: { message: "Quote saved but email failed to send. Try resending from quote details.", type: "error" } });
      } else {
        dispatch({ type: "NOTIFY", payload: { message: `Quote sent to ${form.customerName}!${business.auto_follow_ups !== false ? " Follow-ups scheduled." : ""}`, type: "success" } });
      }
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
          </div>
        </Card>
        <Card style={{ ...(isMobile ? { padding: 16 } : {}), gridColumn: isMobile ? "1" : "1 / -1" }}>
          {marginPct === 0 && lineItems.some(i => i.costPrice || i.price) && (
            <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: "rgba(234,179,8,0.9)" }}>No materials markup set — these prices are at cost.</div>
              <button onClick={() => dispatch({ type: "SET_SCREEN", payload: "settings" })} style={{ fontSize: 12, color: theme.accent, background: "none", border: "none", cursor: "pointer", fontFamily: theme.font, fontWeight: 600, whiteSpace: "nowrap", textDecoration: "underline" }}>Set in Settings</button>
            </div>
          )}
          <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, margin: "0 0 12px" }}>Line Items *</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {marginPct > 0 && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 4 }}>
                <div style={{ flex: 1, fontSize: 11, color: theme.textDim }}>Description</div>
                <div style={{ width: isMobile ? 80 : 100, fontSize: 11, color: theme.textDim, textAlign: "right" }}>Cost</div>
                <span style={{ fontSize: 12, color: "transparent" }}>→</span>
                <div style={{ width: isMobile ? 80 : 100, fontSize: 11, color: theme.textDim, textAlign: "right" }}>Customer</div>
                <div style={{ width: 30 }} />
              </div>
            )}
            {lineItems.map((item, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <input value={item.description} onChange={e => updateLineItem(idx, "description", e.target.value)} placeholder="Item description"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: theme.text, fontSize: 14, fontFamily: theme.font, outline: "none" }}
                    onFocus={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }} />
                </div>
                {marginPct > 0 ? (
                  <>
                    <div style={{ width: isMobile ? 80 : 100 }}>
                      <input value={item.costPrice || ""} onChange={e => updateLineItem(idx, "costPrice", e.target.value)} placeholder="Cost" type="number"
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: theme.textMuted, fontSize: 13, fontFamily: theme.font, outline: "none", textAlign: "right" }}
                        onFocus={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"; }}
                        onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }} />
                    </div>
                    <span style={{ fontSize: 12, color: theme.textDim }}>→</span>
                    <div style={{ width: isMobile ? 80 : 100 }}>
                      <input value={item.price} onChange={e => updateLineItem(idx, "price", e.target.value)} placeholder="$0" type="number"
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: theme.text, fontSize: 14, fontFamily: theme.font, outline: "none", textAlign: "right" }}
                        onFocus={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"; }}
                        onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }} />
                    </div>
                  </>
                ) : (
                  <div style={{ width: isMobile ? 90 : 120 }}>
                    <input value={item.price} onChange={e => updateLineItem(idx, "price", e.target.value)} placeholder="$0" type="number"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: theme.text, fontSize: 14, fontFamily: theme.font, outline: "none", textAlign: "right" }}
                      onFocus={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }} />
                  </div>
                )}
                {lineItems.length > 1 && (
                  <button onClick={() => removeLineItem(idx)} style={{ padding: "8px", background: "none", border: "none", color: theme.textDim, cursor: "pointer", fontSize: 16, lineHeight: 1, flexShrink: 0, borderRadius: 6, transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = theme.textDim; e.currentTarget.style.background = "none"; }}>×</button>
                )}
              </div>
            ))}
            <button onClick={addLineItem} style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.1)", color: theme.textMuted, fontSize: 13, cursor: "pointer", fontFamily: theme.font, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"; e.currentTarget.style.color = theme.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = theme.textMuted; }}>
              <Plus size={14} /> Add line item
            </button>
            {business.gst_number ? (() => {
              const isInc = business.gst_inclusive !== false;
              const subtotal = isInc ? Math.round((totalAmount / 1.15) * 100) / 100 : totalAmount;
              const gst = isInc ? Math.round((totalAmount - subtotal) * 100) / 100 : Math.round(totalAmount * 0.15 * 100) / 100;
              const total = isInc ? totalAmount : Math.round((totalAmount + gst) * 100) / 100;
              return (
                <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 12, marginTop: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: theme.textMuted }}>Subtotal (excl. GST)</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: theme.textMuted }}>GST (15%)</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: theme.text }}>${gst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${theme.border}`, paddingTop: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: theme.text }}>Total (incl. GST)</span>
                    <span style={{ fontSize: 24, fontWeight: 700, color: theme.accent }}>${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              );
            })() : (
            <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 12, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: theme.text }}>Total</span>
              <span style={{ fontSize: 24, fontWeight: 700, color: theme.accent }}>${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            )}
            {marginPct > 0 && lineItems.some(i => parseFloat(i.costPrice) > 0) && (() => {
              const markupTotal = lineItems.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) - (parseFloat(item.costPrice) || 0)), 0);
              return markupTotal > 0 ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                  <span style={{ fontSize: 12, color: theme.accent }}>Materials markup</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.accent }}>+${Math.round(markupTotal).toLocaleString()}</span>
                </div>
              ) : null;
            })()}
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: theme.textMuted, marginTop: 12 }}>
              <input type="checkbox" checked={showBreakdown} onChange={e => {
                setShowBreakdown(e.target.checked);
              }} style={{ accentColor: theme.accent }} />
              Show breakdown on quote
            </label>
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
        <Button variant="secondary" onClick={() => {
          if (!form.customerName || !form.jobTitle || lineItems.filter(i => i.description.trim()).length === 0) { dispatch({ type: "NOTIFY", payload: { message: "Fill in customer name, job title, and at least one line item to preview", type: "error" } }); return; }
          setShowPreview(true);
        }} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Eye size={16} /> Preview</Button>
        <Button onClick={handleCreate} disabled={loading}>
          {loading ? "Sending..." : isMobile ? "Send Quote →" : "Send Quote & Start Follow-Ups →"}
        </Button>
      </div>
      {showPreview && (
        <div onClick={() => setShowPreview(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? 12 : 20, backdropFilter: "blur(4px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto", borderRadius: 12, background: "#fff", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", position: "relative" }}>
            <button onClick={() => setShowPreview(false)} style={{ position: "sticky", top: 0, right: 0, float: "right", margin: "12px 12px 0 0", width: 32, height: 32, borderRadius: 8, background: "rgba(0,0,0,0.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#6b7280", zIndex: 1 }}>×</button>
            <div style={{ padding: isMobile ? "20px 20px" : "32px 40px", marginTop: -32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#0A0E17", fontFamily: theme.fontDisplay }}>{business.business_name}</div>
                  {business.address && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{business.address}</div>}
                  {business.phone && <div style={{ fontSize: 13, color: "#6b7280" }}>{business.phone}</div>}
                  {business.email && <div style={{ fontSize: 13, color: "#6b7280" }}>{business.email}</div>}
                  {(business.gst_number || business.license_number) && (
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
              {form.description && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>Description</div>
                  <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-line" }}>{form.description}</div>
                </div>
              )}
              <div style={{ background: "#f9fafb", borderRadius: 10, padding: 20, marginBottom: 24 }}>
                {showBreakdown && lineItems.filter(i => i.description.trim()).map((item, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingBottom: 8, borderBottom: idx < lineItems.filter(i => i.description.trim()).length - 1 ? "1px solid #e5e7eb" : "none" }}>
                    <span style={{ fontSize: 14, color: "#374151" }}>{item.description}</span>
                    <span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>{parseFloat(item.price) ? "$" + parseFloat(item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</span>
                  </div>
                ))}
                {business.gst_number ? (() => {
                  const isInc = business.gst_inclusive !== false;
                  const subtotal = isInc ? Math.round((totalAmount / 1.15) * 100) / 100 : totalAmount;
                  const gst = isInc ? Math.round((totalAmount - subtotal) * 100) / 100 : Math.round(totalAmount * 0.15 * 100) / 100;
                  const total = isInc ? totalAmount : Math.round((totalAmount + gst) * 100) / 100;
                  return (<>
                    <div style={{ borderTop: showBreakdown ? "2px solid #111827" : "none", paddingTop: showBreakdown ? 12 : 0, marginTop: showBreakdown ? 4 : 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 14, color: "#6b7280" }}>Subtotal (excl. GST)</span><span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 14, color: "#6b7280" }}>GST (15%)</span><span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>${gst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #111827", paddingTop: 10 }}><span style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>Total (incl. GST)</span><span style={{ fontSize: 24, fontWeight: 800, color: "#14B8A6" }}>${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                    </div>
                  </>);
                })() : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: showBreakdown ? "2px solid #111827" : "none", paddingTop: showBreakdown ? 12 : 0, marginTop: showBreakdown ? 4 : 0 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>Total</span>
                    <span style={{ fontSize: 24, fontWeight: 800, color: "#14B8A6" }}>${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
              {business.require_deposit && business.bank_account_number && (
                <div style={{ marginBottom: 24, padding: "16px 20px", borderRadius: 10, background: "#f0fdfa", border: "1px solid #ccfbf1" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Deposit Required — {business.deposit_percentage || 25}%</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 14, color: "#0d9488", fontWeight: 600 }}>Deposit Amount</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#0d9488" }}>${(totalAmount * (parseFloat(business.deposit_percentage || 25) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ borderTop: "1px solid #ccfbf1", paddingTop: 10, marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Payment Details</div>
                    {business.bank_name && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 13, color: "#6b7280" }}>Bank</span><span style={{ fontSize: 13, color: "#111827" }}>{business.bank_name}</span></div>}
                    {business.bank_account_name && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 13, color: "#6b7280" }}>Account Name</span><span style={{ fontSize: 13, color: "#111827" }}>{business.bank_account_name}</span></div>}
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 13, color: "#6b7280" }}>Account Number</span><span style={{ fontSize: 13, color: "#111827", fontWeight: 600 }}>{business.bank_account_number}</span></div>
                  </div>
                </div>
              )}
              {business.quote_footer && (
                <div style={{ marginBottom: 24, padding: "14px 16px", borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, whiteSpace: "pre-line" }}>{business.quote_footer}</div>
                </div>
              )}
              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>Powered by <span style={{ color: "#14B8A6", fontWeight: 600 }}>Wynflow</span></div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>Valid for 30 days</div>
              </div>
            </div>
            <div style={{ padding: isMobile ? "16px 20px 24px" : "16px 40px 24px", background: "#f9fafb", borderTop: "1px solid #e5e7eb", display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Button variant="secondary" onClick={() => setShowPreview(false)}>Close</Button>
              <Button onClick={() => { setShowPreview(false); handleCreate(); }} disabled={loading}><Send size={16} /> Send Quote</Button>
            </div>
          </div>
        </div>
      )}
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

  const marginPct = parseFloat(business.materials_margin) || 0;
  const applyMargin = (costPrice) => {
    const cp = parseFloat(costPrice) || 0;
    return marginPct > 0 ? Math.round(cp * (1 + marginPct / 100) * 100) / 100 : cp;
  };

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

      // Build smart quote history for AI learning — prioritise won quotes, include decline reasons
      const allQ = (quotes || []).filter(q => q.amount && q.id && q.id !== quote.id);
      const wonQ = allQ.filter(q => ["accepted", "booked"].includes(q.status));
      const sentQ = allQ.filter(q => ["sent", "opened"].includes(q.status));
      const declinedQ = allQ.filter(q => q.status === "declined");
      const sortedHistory = [...wonQ, ...declinedQ, ...sentQ].slice(0, 50);
      const quoteHistory = sortedHistory.map(q => ({
        job_title: q.job_title, description: q.description, amount: q.amount,
        status: q.status, source: q.source || "wynflow",
        date: q.sent_at || q.created_at || null,
        ...(q.decline_reason ? { decline_reason: q.decline_reason } : {}),
        ...(q.photos && q.photos.length > 0 ? { has_photos: true } : {}),
      }));
      // Find similar past quotes with photos — send up to 3 reference photos so AI learns visually
      const jobWords = (quote.job_title || "").toLowerCase().split(/\s+/);
      const similarWithPhotos = allQ
        .filter(q => q.photos && q.photos.length > 0 && q.photos[0] && typeof q.photos[0] === "string" && q.photos[0].startsWith("http"))
        .map(q => ({ ...q, score: jobWords.filter(w => (q.job_title || "").toLowerCase().includes(w)).length }))
        .filter(q => q.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      const referencePhotos = similarWithPhotos.map(q => ({
        job_title: q.job_title, amount: q.amount, status: q.status, date: q.sent_at || q.created_at || null, photo_urls: q.photos.slice(0, 2),
      }));
      const responded = wonQ.length + declinedQ.length;
      const winRate = responded > 0 ? Math.round((wonQ.length / responded) * 100) : null;
      const avgWonAmount = wonQ.length > 0 ? Math.round(wonQ.reduce((s, q) => s + parseFloat(q.amount), 0) / wonQ.length) : null;
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
          ai_pricing_mode: business.ai_pricing_mode || "flexible",
          quote_history: quoteHistory,
          reference_photos: referencePhotos,
          learning_context: { win_rate: winRate, avg_won_amount: avgWonAmount, total_quotes: allQ.length, total_won: wonQ.length, total_declined: declinedQ.length },
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
        // Parse materials breakdown into individual line items
        const materialsText = result.quote.materials_breakdown || "";
        const parsedItems = materialsText.split("\n").filter(l => l.trim()).map(line => {
          const priceMatch = line.match(/\$?([\d,.]+)\s*$/);
          const price = priceMatch ? priceMatch[1].replace(",", "") : "";
          const desc = priceMatch ? line.replace(priceMatch[0], "").replace(/[-–—:]\s*$/, "").trim() : line.trim();
          return { description: desc, costPrice: price, price: String(applyMargin(price)) };
        });
        const lineItems = parsedItems.length > 0 ? parsedItems : [{ description: materialsText || "Materials", costPrice: matCost ? String(Math.round(matCost * 100) / 100) : "", price: matCost ? String(applyMargin(matCost)) : "" }];
        const markedUpMatCost = lineItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
        const markedUpTotal = Math.round((markedUpMatCost + labourCost + callout) * 100) / 100;
        const materialsTextWithMargin = lineItems.filter(i => i.description?.trim()).map(i => i.description + (i.price ? " — $" + i.price : "")).join("\n");
        setEditForm({
          scope: result.quote.scope_of_work || "",
          materials: materialsTextWithMargin,
          lineItems,
          labourHours: result.quote.estimated_hours || "",
          materialsCost: String(Math.round(markedUpMatCost * 100) / 100),
          amount: String(markedUpTotal),
          notes: result.quote.notes || "",
          showBreakdown: business.default_show_breakdown !== undefined ? business.default_show_breakdown : true,
          showGST: !!business.gst_number,
          includeCallout: parseFloat(business.callout_fee) > 0,
          showBusinessDetails: !!(business.address || business.gst_number || business.license_number),
        });
      } else {
        dispatch({ type: "NOTIFY", payload: { message: "AI generation failed — try again", type: "error" } });
      }
    } catch (err) {
      reportError(err, "ai_quote_generation");
      dispatch({ type: "NOTIFY", payload: { message: "Failed to generate quote", type: "error" } });
    } finally {
      setGenerating(false);
    }
  };

  const recalcTotal = (fields) => {
    const hours = parseFloat(fields.labourHours) || 0;
    const rate = parseFloat(business.hourly_rate) || 0;
    const matCost = (fields.lineItems || []).reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    const callout = fields.includeCallout ? (parseFloat(business.callout_fee) || 0) : 0;
    return String(Math.round((matCost + (hours * rate) + callout) * 100) / 100);
  };

  const updatePricing = (key, val) => {
    setEditForm(prev => {
      const updated = { ...prev, [key]: val };
      updated.materialsCost = String((updated.lineItems || []).reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0));
      updated.amount = recalcTotal(updated);
      return updated;
    });
  };

  const updateLineItem = (index, field, value) => {
    setEditForm(prev => {
      const items = [...(prev.lineItems || [])];
      items[index] = { ...items[index], [field]: value };
      if (field === "costPrice") {
        items[index].price = String(applyMargin(value));
      }
      const matCost = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
      const updated = { ...prev, lineItems: items, materialsCost: String(matCost) };
      updated.amount = recalcTotal(updated);
      return updated;
    });
  };

  const addLineItem = () => {
    setEditForm(prev => ({ ...prev, lineItems: [...(prev.lineItems || []), { description: "", costPrice: "", price: "" }] }));
  };

  const removeLineItem = (index) => {
    setEditForm(prev => {
      const items = (prev.lineItems || []).filter((_, i) => i !== index);
      const matCost = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
      const updated = { ...prev, lineItems: items, materialsCost: String(matCost) };
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
      const materialsText = (editForm.lineItems || []).filter(i => i.description.trim()).map(i => i.description + (i.price ? " — $" + i.price : "")).join("\n");
      const breakdown = {
        scope: editForm.scope,
        materials: materialsText,
        lineItems: editForm.lineItems,
        materialsCost: editForm.materialsCost,
        labourHours: editForm.labourHours,
        labourRate: business.hourly_rate,
        includeCallout: editForm.includeCallout,
        calloutFee: business.callout_fee,
        showBreakdown: editForm.showBreakdown,
        showGST: editForm.showGST,
        showBusinessDetails: editForm.showBusinessDetails,
        notes: editForm.notes,
        requireDeposit: business.require_deposit,
        depositPercentage: business.deposit_percentage,
        depositAmount: business.require_deposit ? parseFloat(editForm.amount || 0) * (parseFloat(business.deposit_percentage || 25) / 100) : null,
        bankName: business.bank_name,
        bankAccountName: business.bank_account_name,
        bankAccountNumber: business.bank_account_number,
        quoteFooter: business.quote_footer,
        businessAddress: business.address,
        gstNumber: business.gst_number,
        gstInclusive: business.gst_inclusive !== false,
        licenseNumber: business.license_number,
        businessPhone: business.phone,
        businessEmail: business.email,
      };
      const quoteUpdates = {
        amount: parseFloat(editForm.amount),
        description: editForm.scope + (materialsText ? "\n\nMaterials:\n" + materialsText : "") + (editForm.notes ? "\n\nNotes:\n" + editForm.notes : ""),
        status: "sent",
        sent_at: new Date().toISOString(),
        sequence_id: business.auto_follow_ups !== false ? seqId : null,
        next_follow_up_at: business.auto_follow_ups !== false ? nextFollowUp : null,
        current_step: 0,
        follow_up_paused: business.auto_follow_ups === false,
        ai_estimate: parseFloat(editForm.amount), ai_estimate_notes: JSON.stringify(breakdown),
      };
      const { error: updateErr } = await db("quotes").eq("id", quote.id).update(quoteUpdates);
      if (updateErr) throw new Error("Failed to update quote");
      const sendRes = await fetch("https://wynfallautomation.app.n8n.cloud/webhook/send-quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_id: quote.id, breakdown }),
      });
      dispatch({ type: "UPDATE_QUOTE", payload: { id: quote.id, ...quoteUpdates } });
      if (!sendRes.ok) {
        dispatch({ type: "NOTIFY", payload: { message: "Quote saved but email failed to send. Try resending from quote details.", type: "error" } });
      } else {
        dispatch({ type: "NOTIFY", payload: { message: `Quote sent to ${quote.customer_name}!${business.auto_follow_ups !== false ? " Follow-ups scheduled." : ""}`, type: "success" } });
      }
      dispatch({ type: "GO_BACK" });
    } catch (err) {
      reportError(err, "send_quote");
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

          <Input label="Description" value={editForm.scope} onChange={v => setEditForm(prev => ({ ...prev, scope: v }))} textarea />
          <div style={{ padding: 14, borderRadius: 10, background: theme.surfaceLight, border: `1px solid ${theme.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>Pricing</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {business.gst_number && (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: theme.textMuted }}>
                    <input type="checkbox" checked={editForm.showGST} onChange={e => setEditForm(prev => ({ ...prev, showGST: e.target.checked }))} style={{ accentColor: theme.accent }} />
                    Show GST
                  </label>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: theme.textMuted }}>
                  <input type="checkbox" checked={editForm.showBreakdown} onChange={e => {
                    const c = e.target.checked;
                    setEditForm(prev => ({ ...prev, showBreakdown: c }));
                    if (confirm(c ? "Always show pricing breakdown on future quotes?" : "Always hide pricing breakdown on future quotes?")) {
                      db("businesses").eq("id", business.id).update({ default_show_breakdown: c });
                    }
                  }} style={{ accentColor: theme.accent }} />
                  Show breakdown
                </label>
              </div>
            </div>
            {editForm.showBreakdown && (<>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {marginPct === 0 && editForm.lineItems?.some(i => i.costPrice || i.price) && (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                  <div style={{ fontSize: 13, color: "rgba(234,179,8,0.9)" }}>No materials markup set — these prices are at cost.</div>
                  <button onClick={() => dispatch({ type: "SET_SCREEN", payload: "settings" })} style={{ fontSize: 12, color: theme.accent, background: "none", border: "none", cursor: "pointer", fontFamily: theme.font, fontWeight: 600, whiteSpace: "nowrap", textDecoration: "underline" }}>Set in Settings</button>
                </div>
              )}
              <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Materials</div>
              {marginPct > 0 && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 4 }}>
                  <div style={{ flex: 1, fontSize: 11, color: theme.textDim }}>Description</div>
                  <div style={{ width: isMobile ? 80 : 100, fontSize: 11, color: theme.textDim, textAlign: "right" }}>Cost</div>
                  <span style={{ fontSize: 12, color: "transparent" }}>→</span>
                  <div style={{ width: isMobile ? 80 : 100, fontSize: 11, color: theme.textDim, textAlign: "right" }}>Customer</div>
                  <div style={{ width: 30 }} />
                </div>
              )}
              {(editForm.lineItems || []).map((item, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <input value={item.description} onChange={e => updateLineItem(idx, "description", e.target.value)} placeholder="Item description"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: theme.text, fontSize: 14, fontFamily: theme.font, outline: "none" }}
                      onFocus={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }} />
                  </div>
                  {marginPct > 0 ? (
                    <>
                      <div style={{ width: isMobile ? 80 : 100 }}>
                        <input value={item.costPrice || ""} onChange={e => updateLineItem(idx, "costPrice", e.target.value)} placeholder="Cost" type="number"
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: theme.textMuted, fontSize: 13, fontFamily: theme.font, outline: "none", textAlign: "right" }}
                          onFocus={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"; }}
                          onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }} />
                      </div>
                      <span style={{ fontSize: 12, color: theme.textDim }}>→</span>
                      <div style={{ width: isMobile ? 80 : 100 }}>
                        <input value={item.price} onChange={e => updateLineItem(idx, "price", e.target.value)} placeholder="$0" type="number"
                          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: theme.text, fontSize: 14, fontFamily: theme.font, outline: "none", textAlign: "right" }}
                          onFocus={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"; }}
                          onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }} />
                      </div>
                    </>
                  ) : (
                    <div style={{ width: isMobile ? 90 : 110 }}>
                      <input value={item.price} onChange={e => updateLineItem(idx, "price", e.target.value)} placeholder="$0" type="number"
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: theme.text, fontSize: 14, fontFamily: theme.font, outline: "none", textAlign: "right" }}
                        onFocus={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"; }}
                        onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }} />
                    </div>
                  )}
                  {(editForm.lineItems || []).length > 1 && (
                    <button onClick={() => removeLineItem(idx)} style={{ padding: "8px", background: "none", border: "none", color: theme.textDim, cursor: "pointer", fontSize: 16, lineHeight: 1, flexShrink: 0, borderRadius: 6, transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = theme.textDim; e.currentTarget.style.background = "none"; }}>×</button>
                  )}
                </div>
              ))}
              <button onClick={addLineItem} style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.1)", color: theme.textMuted, fontSize: 13, cursor: "pointer", fontFamily: theme.font, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"; e.currentTarget.style.color = theme.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = theme.textMuted; }}>
                <Plus size={14} /> Add item
              </button>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 4 }}>
                <span style={{ fontSize: 12, color: theme.textMuted }}>Materials subtotal</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>${parseFloat(editForm.materialsCost || 0).toLocaleString()}</span>
              </div>
              {marginPct > 0 && (editForm.lineItems || []).some(i => parseFloat(i.costPrice) > 0) && (() => {
                const markupTotal = (editForm.lineItems || []).reduce((sum, item) => sum + ((parseFloat(item.price) || 0) - (parseFloat(item.costPrice) || 0)), 0);
                return markupTotal > 0 ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                    <span style={{ fontSize: 12, color: theme.accent }}>Materials markup</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: theme.accent }}>+${Math.round(markupTotal).toLocaleString()}</span>
                  </div>
                ) : null;
              })()}
            </div>
            <div style={{ marginBottom: 8 }}><Input label="Labour Hours" value={editForm.labourHours} onChange={v => updatePricing("labourHours", v)} type="number" /></div>
            {business.hourly_rate && <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>Labour: {editForm.labourHours || 0} hrs × ${business.hourly_rate}/hr = ${((parseFloat(editForm.labourHours) || 0) * parseFloat(business.hourly_rate)).toLocaleString()}</div>}
            {parseFloat(business.callout_fee) > 0 && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>
                <input type="checkbox" checked={editForm.includeCallout} onChange={e => updatePricing("includeCallout", e.target.checked)} style={{ accentColor: theme.accent }} />
                Include callout fee (${parseFloat(business.callout_fee).toLocaleString()})
              </label>
            )}
            </>)}
            {business.gst_number ? (() => {
              const amt = parseFloat(editForm.amount || 0);
              const isInc = business.gst_inclusive !== false;
              const subtotal = isInc ? Math.round((amt / 1.15) * 100) / 100 : amt;
              const gst = isInc ? Math.round((amt - subtotal) * 100) / 100 : Math.round(amt * 0.15 * 100) / 100;
              const total = isInc ? amt : Math.round((amt + gst) * 100) / 100;
              return (
                <div style={{ borderTop: editForm.showBreakdown ? `1px solid ${theme.border}` : "none", paddingTop: editForm.showBreakdown ? 10 : 0, marginTop: editForm.showBreakdown ? 8 : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: theme.textMuted }}>Subtotal (excl. GST)</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: theme.text }}>${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: theme.textMuted }}>GST (15%)</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: theme.text }}>${gst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${theme.border}`, paddingTop: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>Total (incl. GST)</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: theme.accent }}>${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              );
            })() : (
            <div style={{ borderTop: editForm.showBreakdown ? `1px solid ${theme.border}` : "none", paddingTop: editForm.showBreakdown ? 10 : 0, marginTop: editForm.showBreakdown ? 8 : 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>Total</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: theme.accent }}>${parseFloat(editForm.amount || 0).toLocaleString()}</span>
            </div>
            )}
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
const QuoteDetail = ({ quoteId, quotes, sequences, dispatch, business, invoices = [] }) => {
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

  const linkedInvoices = invoices.filter(inv => inv.quote_id === quote.id);

  const deleteQuote = async () => {
    if (linkedInvoices.length > 0) {
      dispatch({ type: "NOTIFY", payload: { message: "Can't delete — this quote has a linked invoice. Delete the invoice first.", type: "error" } });
      return;
    }
    if (!window.confirm("Are you sure you want to delete this quote? This cannot be undone.")) return;
    const { error } = await db("quotes").eq("id", quote.id).delete();
    if (error) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to delete quote", type: "error" } });
      return;
    }
    dispatch({ type: "DELETE_QUOTE", payload: quote.id });
    dispatch({ type: "NOTIFY", payload: { message: "Quote deleted", type: "success" } });
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
            {quote.ai_estimate && (() => {
              let bd = null;
              if (quote.ai_estimate_notes) {
                try { bd = typeof quote.ai_estimate_notes === "string" ? JSON.parse(quote.ai_estimate_notes) : quote.ai_estimate_notes; } catch {}
              }
              const estimate = parseFloat(quote.ai_estimate) || 0;
              const rangeLow = quote.ai_estimate_range_low || Math.round(estimate * 0.85);
              const rangeHigh = quote.ai_estimate_range_high || Math.round(estimate * 1.15);
              return (
                <div style={{ padding: 16, borderRadius: 10, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)" }}>
                  <div style={{ fontSize: 13, color: "#14B8A6", fontWeight: 600, marginBottom: 8 }}>AI Estimate</div>
                  <div style={{ fontSize: 22, color: "#14B8A6", fontWeight: 700 }}>
                    ${rangeLow.toLocaleString()} — ${rangeHigh.toLocaleString()}
                  </div>
                  {bd && (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      {bd.scope && <div><div style={{ fontSize: 11, color: theme.textDim, textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>Scope</div><div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{bd.scope}</div></div>}
                      {bd.lineItems && bd.lineItems.length > 0 && bd.lineItems.some(i => i.description?.trim()) && (
                        <div>
                          <div style={{ fontSize: 11, color: theme.textDim, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Line Items</div>
                          {bd.lineItems.filter(i => i.description?.trim()).map((item, idx) => (
                            <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: theme.textMuted, padding: "3px 0", borderBottom: `1px solid ${theme.border}` }}>
                              <span>{item.description}</span>
                              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                {item.costPrice && parseFloat(item.costPrice) !== parseFloat(item.price) && (
                                  <span style={{ color: theme.textDim, fontSize: 12 }}>${parseFloat(item.costPrice).toLocaleString()} →</span>
                                )}
                                {item.price && <span style={{ color: theme.text, fontWeight: 500 }}>${parseFloat(item.price).toLocaleString()}</span>}
                              </span>
                            </div>
                          ))}
                          {bd.lineItems && bd.lineItems.some(i => i.costPrice && parseFloat(i.costPrice) !== parseFloat(i.price)) && (() => {
                            const markupTotal = bd.lineItems.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) - (parseFloat(item.costPrice) || parseFloat(item.price) || 0)), 0);
                            return markupTotal > 0 ? (
                              <div style={{ fontSize: 12, color: theme.accent, marginTop: 4 }}>Materials markup: +${Math.round(markupTotal).toLocaleString()}</div>
                            ) : null;
                          })()}
                        </div>
                      )}
                      {(bd.labourHours || bd.materialsCost) && (
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                          {bd.labourHours && <div><div style={{ fontSize: 11, color: theme.textDim, textTransform: "uppercase", fontWeight: 600 }}>Labour</div><div style={{ fontSize: 13, color: theme.textMuted }}>{bd.labourHours}hrs @ ${bd.labourRate}/hr</div></div>}
                          {bd.materialsCost && <div><div style={{ fontSize: 11, color: theme.textDim, textTransform: "uppercase", fontWeight: 600 }}>Materials</div><div style={{ fontSize: 13, color: theme.textMuted }}>${parseFloat(bd.materialsCost).toLocaleString()}</div></div>}
                          {bd.includeCallout && bd.calloutFee && <div><div style={{ fontSize: 11, color: theme.textDim, textTransform: "uppercase", fontWeight: 600 }}>Callout</div><div style={{ fontSize: 13, color: theme.textMuted }}>${parseFloat(bd.calloutFee).toLocaleString()}</div></div>}
                        </div>
                      )}
                      {bd.notes && <div><div style={{ fontSize: 11, color: theme.textDim, textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>Notes</div><div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{bd.notes}</div></div>}
                    </div>
                  )}
                </div>
              );
            })()}
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
            {linkedInvoices.length > 0 ? (
              <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "invoiceDetail:" + linkedInvoices[0].id })} style={{ background: theme.accentSoft, color: theme.accent, display: "inline-flex", alignItems: "center", gap: 6 }}><Receipt size={16} /> View Invoice</Button>
            ) : (
              <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "createInvoice:" + quote.id })} style={{ background: theme.accentSoft, color: theme.accent, display: "inline-flex", alignItems: "center", gap: 6 }}><Receipt size={16} /> Generate Invoice</Button>
            )}
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
          {linkedInvoices.length > 0 ? (
            <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "invoiceDetail:" + linkedInvoices[0].id })} style={{ marginTop: 16, background: theme.accentSoft, color: theme.accent, display: "inline-flex", alignItems: "center", gap: 6 }}><Receipt size={16} /> View Invoice</Button>
          ) : (
            <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "createInvoice:" + quote.id })} style={{ marginTop: 16, background: theme.accentSoft, color: theme.accent, display: "inline-flex", alignItems: "center", gap: 6 }}><Receipt size={16} /> Generate Invoice</Button>
          )}
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
            <Button onClick={deleteQuote} variant="danger" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.08)", color: theme.red }}><Trash2 size={16} /> Delete Quote</Button>
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
        {/* Delete quote — available for all statuses */}
        {(quote.status === "accepted" || quote.status === "booked" || quote.status === "declined" || quote.status === "requested") && (
          <div style={{ gridColumn: "1 / -1", textAlign: "right" }}>
            <Button onClick={deleteQuote} variant="danger" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.08)", color: theme.red }}><Trash2 size={16} /> Delete Quote</Button>
          </div>
        )}

        {/* Linked invoices */}
        {invoices.filter(inv => inv.quote_id === quote.id).length > 0 && (
          <Card style={{ gridColumn: "1 / -1" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}><Receipt size={18} /> Invoices</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {invoices.filter(inv => inv.quote_id === quote.id).map(inv => (
                <div key={inv.id} onClick={() => dispatch({ type: "SET_SCREEN", payload: "invoiceDetail:" + inv.id })}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(20,184,166,0.2)"} onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>#{inv.invoice_number}</span>
                    <span style={{ fontSize: 13, color: theme.textMuted, marginLeft: 8 }}>${parseFloat(inv.amount || 0).toLocaleString()}</span>
                    {inv.is_deposit && <span style={{ fontSize: 11, color: theme.accent, marginLeft: 8 }}>Deposit</span>}
                  </div>
                  <InvoiceBadge status={inv.status} dueDate={inv.due_date} />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

// ─── Invoices List ───
const InvoicesList = ({ invoices, dispatch, quotes = [], business }) => {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showFromQuote, setShowFromQuote] = useState(false);

  const isOverdue = (inv) => (inv.status === "sent" || inv.status === "viewed") && inv.due_date && new Date(inv.due_date) < new Date();

  // Active invoices = not paid; Archived = paid
  const activeInvoices = invoices.filter(i => i.status !== "paid");
  const archivedInvoices = invoices.filter(i => i.status === "paid");

  const filtered = (filter === "archived" ? archivedInvoices : activeInvoices).filter((inv) => {
    if (filter === "archived") {
      if (search && !inv.customer_name?.toLowerCase().includes(search.toLowerCase()) && !inv.job_title?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }
    if (filter === "overdue") return isOverdue(inv);
    if (filter !== "all" && inv.status !== filter) return false;
    if (search && !inv.customer_name?.toLowerCase().includes(search.toLowerCase()) && !inv.job_title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: activeInvoices.length,
    draft: activeInvoices.filter(i => i.status === "draft").length,
    sent: activeInvoices.filter(i => i.status === "sent" || i.status === "viewed").length,
    overdue: activeInvoices.filter(i => isOverdue(i)).length,
    archived: archivedInvoices.length,
  };

  const tabs = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft", count: counts.draft },
    { key: "sent", label: "Sent", count: counts.sent },
    { key: "overdue", label: "Overdue", count: counts.overdue, dot: counts.overdue > 0 },
    { key: "archived", label: "Archived", count: counts.archived },
  ];

  const daysUntilDue = (dueDate) => {
    if (!dueDate) return null;
    const diff = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    if (diff === 0) return "Due today";
    return `${diff}d left`;
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", marginBottom: isMobile ? 16 : 24, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: theme.text, margin: 0, letterSpacing: "-0.02em" }}>Invoices</h1>
          <p style={{ fontSize: 13, color: theme.textMuted, margin: "4px 0 0" }}>{activeInvoices.length} active{archivedInvoices.length > 0 ? ` · ${archivedInvoices.length} paid` : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 8, position: "relative" }}>
          {(() => {
            const invoiceable = quotes.filter(q => (q.status === "accepted" || q.status === "booked") && !invoices.some(inv => inv.quote_id === q.id));
            return invoiceable.length > 0 && (
              <div style={{ position: "relative" }}>
                <Button onClick={() => setShowFromQuote(!showFromQuote)} size="sm" variant="secondary">
                  <FileText size={13} /> From Quote
                </Button>
                {showFromQuote && (
                  <>
                    <div onClick={() => setShowFromQuote(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 98 }} />
                    <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, minWidth: 280, maxHeight: 300, overflowY: "auto", borderRadius: 10, background: "rgba(17,24,39,0.98)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 99, padding: 6 }}>
                      <div style={{ fontSize: 11, color: theme.textDim, padding: "6px 10px", textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5 }}>Accepted quotes without invoices</div>
                      {invoiceable.map(q => (
                        <div key={q.id} onClick={() => { setShowFromQuote(false); dispatch({ type: "SET_SCREEN", payload: "createInvoice:" + q.id }); }}
                          style={{ padding: "10px 12px", borderRadius: 6, cursor: "pointer", transition: "background 0.1s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{q.customer_name}</div>
                          <div style={{ fontSize: 12, color: theme.textMuted }}>{q.job_title} — ${parseFloat(q.amount || 0).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
          <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "createInvoice" })} size="sm" style={{ background: "rgba(20,184,166,0.1)", color: "#14B8A6", border: "1px solid rgba(20,184,166,0.15)" }}><Plus size={13} /> New Invoice</Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: isMobile ? 12 : 16, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 4, flexWrap: "nowrap", alignItems: "center" }}>
        {tabs.map((tab) => (
          <span key={tab.key} onClick={() => setFilter(tab.key)}
            style={{
              padding: isMobile ? "5px 10px" : "6px 12px", borderRadius: 6, fontSize: isMobile ? 11 : 12, fontWeight: 500, cursor: "pointer",
              background: filter === tab.key ? "rgba(20,184,166,0.1)" : "transparent",
              color: filter === tab.key ? theme.accent : theme.textMuted,
              border: `1px solid ${filter === tab.key ? "rgba(20,184,166,0.2)" : "transparent"}`,
              whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
              transition: "all 0.15s",
            }}>
            {tab.label}
            {tab.dot && <span style={{ width: 5, height: 5, borderRadius: 3, background: theme.red, flexShrink: 0 }} />}
            {tab.count > 0 && !tab.dot && <span style={{ fontSize: 10, fontWeight: 600, color: filter === tab.key ? theme.accent : theme.textDim }}>{tab.count}</span>}
          </span>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: isMobile ? 12 : 16, maxWidth: isMobile ? "100%" : 240 }}>
        <Search size={14} color={theme.textDim} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoices..."
          style={{
            width: "100%", padding: "8px 12px 8px 34px", borderRadius: 8, fontSize: 13,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            color: theme.text, outline: "none", fontFamily: theme.font,
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Invoice list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Receipt size={32} color={theme.textDim} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: theme.textDim }}>No invoices{filter !== "all" ? ` with status "${filter}"` : ""}</div>
          {invoices.length === 0 && (
            <p style={{ fontSize: 13, color: theme.textDim, marginTop: 8 }}>Create your first invoice from an accepted quote or start a new one</p>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((inv) => (
            <div key={inv.id} onClick={() => dispatch({ type: "SET_SCREEN", payload: "invoiceDetail:" + inv.id })}
              style={{
                padding: isMobile ? "12px 14px" : "16px 20px", borderRadius: 12, cursor: "pointer",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(20,184,166,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: isMobile ? 14 : 15, fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.customer_name}</span>
                    {inv.invoice_number && <span style={{ fontSize: 11, color: theme.textDim }}>#{inv.invoice_number}</span>}
                  </div>
                  <div style={{ fontSize: isMobile ? 12 : 13, color: theme.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.job_title}</div>
                  {inv.due_date && inv.status !== "paid" && inv.status !== "draft" && (
                    <div style={{ fontSize: 11, marginTop: 4, color: isOverdue(inv) ? theme.red : theme.textDim, fontWeight: isOverdue(inv) ? 600 : 400 }}>
                      {daysUntilDue(inv.due_date)}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: theme.accent }}>${parseFloat(inv.amount || 0).toLocaleString()}</span>
                  <InvoiceBadge status={inv.status} dueDate={inv.due_date} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Create Invoice Form ───
const CreateInvoiceForm = ({ dispatch, business, quotes, sequences, invoices, quoteId, editInvoice }) => {
  const isMobile = useIsMobile();
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Check invoice settings are complete
  const { complete: settingsComplete, missing: settingsMissing } = isInvoiceSettingsComplete(business);

  // Block if settings incomplete (unless editing existing)
  if (!settingsComplete && !editInvoice) {
    return (
      <div>
        <div style={{ marginBottom: isMobile ? 16 : 32 }}>
          <span onClick={() => dispatch({ type: "GO_BACK" })}
            style={{ fontSize: 13, color: theme.textMuted, cursor: "pointer", display: "block", marginBottom: 6 }}>← Back</span>
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>New Invoice</h1>
        </div>
        <Card style={{ maxWidth: 520 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <AlertTriangle size={24} color="#F59E0B" />
            <h3 style={{ fontSize: 18, fontWeight: 600, color: "#F59E0B", margin: 0 }}>Complete Invoice Settings First</h3>
          </div>
          <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.6, margin: "0 0 16px" }}>
            Before you can create invoices, you need to fill in your business and payment details. These appear on every invoice you send.
          </p>
          <div style={{ padding: "12px 16px", borderRadius: 8, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.12)", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 6 }}>Missing:</div>
            {settingsMissing.map((item, i) => (
              <div key={i} style={{ fontSize: 13, color: theme.textMuted, paddingLeft: 12, marginBottom: 2 }}>• {item}</div>
            ))}
          </div>
          <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "settings" })} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <SettingsIcon size={16} /> Go to Settings
          </Button>
        </Card>
      </div>
    );
  }

  // Editing an existing draft or creating new
  const isEditing = !!editInvoice;

  // Find linked quote if creating from a quote
  const linkedQuote = quoteId ? quotes?.find(q => q.id === quoteId) : null;

  // Duplicate prevention — check if this quote already has an invoice
  const existingInvoice = linkedQuote ? (invoices || []).find(inv => inv.quote_id === linkedQuote.id) : null;
  if (existingInvoice && !isEditing) {
    return (
      <div>
        <div style={{ marginBottom: isMobile ? 16 : 32 }}>
          <span onClick={() => dispatch({ type: "GO_BACK" })}
            style={{ fontSize: 13, color: theme.textMuted, cursor: "pointer", display: "block", marginBottom: 6 }}>← Back</span>
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>Invoice Already Exists</h1>
        </div>
        <Card style={{ maxWidth: 520 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <Receipt size={24} color={theme.accent} />
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: 0 }}>Invoice #{existingInvoice.invoice_number}</h3>
              <p style={{ fontSize: 13, color: theme.textMuted, margin: "4px 0 0" }}>An invoice has already been created for this quote.</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "invoiceDetail:" + existingInvoice.id })}>
              View Invoice
            </Button>
            <Button variant="secondary" onClick={() => dispatch({ type: "GO_BACK" })}>Go Back</Button>
          </div>
        </Card>
      </div>
    );
  }

  // Parse breakdown from quote's ai_estimate_notes if available
  const parseBreakdown = (quote) => {
    if (!quote?.ai_estimate_notes) return null;
    try {
      const notes = quote.ai_estimate_notes;
      if (typeof notes === "object") return notes;
      return JSON.parse(notes);
    } catch { return null; }
  };

  const breakdown = linkedQuote ? parseBreakdown(linkedQuote) : (isEditing && editInvoice.breakdown ? editInvoice.breakdown : null);

  const [form, setForm] = useState({
    customerName: editInvoice?.customer_name || linkedQuote?.customer_name || "",
    customerEmail: editInvoice?.customer_email || linkedQuote?.customer_email || "",
    customerPhone: editInvoice?.customer_phone || linkedQuote?.customer_phone || "",
    jobTitle: editInvoice?.job_title || linkedQuote?.job_title || "",
    description: editInvoice?.description || linkedQuote?.description || "",
    amount: editInvoice ? String(editInvoice.amount || "") : linkedQuote ? String(linkedQuote.amount || "") : "",
    isDeposit: editInvoice?.is_deposit || false,
    depositPercentage: editInvoice?.deposit_percentage || business?.deposit_percentage || 25,
    paymentTerms: editInvoice?.payment_terms || business?.default_payment_terms || "7 days",
    notes: editInvoice?.notes || "",
    showBreakdown: breakdown?.showBreakdown ?? true,
  });

  // Calculate due date from payment terms
  const getDueDate = (terms) => {
    const d = new Date();
    if (terms === "On receipt") return d.toISOString().split("T")[0];
    if (terms === "20th of month") {
      d.setDate(20);
      if (new Date() > d) d.setMonth(d.getMonth() + 1);
      return d.toISOString().split("T")[0];
    }
    const days = parseInt(terms) || 7;
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  };

  const [dueDate, setDueDate] = useState(editInvoice?.due_date || getDueDate(form.paymentTerms));

  const invoiceAmount = form.isDeposit && linkedQuote
    ? Math.round(parseFloat(linkedQuote.amount || 0) * (form.depositPercentage / 100) * 100) / 100
    : parseFloat(form.amount) || 0;

  // GST: if prices are GST-inclusive, GST is already baked in; if exclusive, add 15%
  const isGstInclusive = business?.gst_inclusive !== false;
  const gstAmount = business?.gst_number
    ? (isGstInclusive ? Math.round(invoiceAmount * 3 / 23 * 100) / 100 : Math.round(invoiceAmount * 0.15 * 100) / 100)
    : 0;
  const totalAmount = isGstInclusive ? invoiceAmount : invoiceAmount + gstAmount;

  // Invoice number: use existing for edits, otherwise derive from highest existing invoice
  const nextNum = isEditing ? null : (() => {
    if (business?.next_invoice_number) return business.next_invoice_number;
    // Derive from highest existing invoice number
    let max = 0;
    (invoices || []).forEach(inv => {
      const match = inv.invoice_number?.match(/INV-(\d+)/);
      if (match) max = Math.max(max, parseInt(match[1]));
    });
    return max + 1;
  })();
  const invoiceNumber = isEditing ? editInvoice.invoice_number : `INV-${String(nextNum).padStart(3, "0")}`;

  const update = (key, val) => setForm({ ...form, [key]: val });

  const buildInvoiceData = (status) => ({
    business_id: business.id,
    quote_id: linkedQuote?.id || editInvoice?.quote_id || null,
    generated_from_quote: !!(linkedQuote?.id),
    invoice_number: invoiceNumber,
    customer_name: form.customerName,
    customer_email: form.customerEmail,
    customer_phone: form.customerPhone,
    job_title: form.jobTitle,
    description: form.description,
    amount: invoiceAmount,
    gst_amount: gstAmount,
    is_deposit: form.isDeposit,
    deposit_percentage: form.isDeposit ? form.depositPercentage : null,
    due_date: dueDate,
    payment_terms: form.paymentTerms,
    status,
    breakdown: breakdown || null,
    notes: form.notes,
  });

  const sendInvoice = async () => {
    if (!form.customerName || !form.customerEmail || (!form.isDeposit && !form.amount)) {
      dispatch({ type: "NOTIFY", payload: { message: "Please fill in customer name, email, and amount", type: "error" } });
      return;
    }
    setSending(true);
    try {
      let invoiceId;
      const invoiceData = { ...buildInvoiceData("sent"), sent_at: new Date().toISOString() };

      if (isEditing) {
        // Update existing draft → sent
        const { error } = await db("invoices").eq("id", editInvoice.id).update(invoiceData);
        if (error) throw new Error("Failed to update invoice");
        invoiceId = editInvoice.id;
        dispatch({ type: "UPDATE_INVOICE", payload: { id: editInvoice.id, ...invoiceData } });
      } else {
        // Create new invoice
        const { data: newInvoice, error } = await db("invoices").insert(invoiceData);
        if (error) throw new Error("Failed to create invoice");
        invoiceId = newInvoice[0].id;
        await db("businesses").eq("id", business.id).update({ next_invoice_number: nextNum + 1 });
        dispatch({ type: "ADD_INVOICE", payload: newInvoice[0] });
        dispatch({ type: "SET_BUSINESS", payload: { ...business, next_invoice_number: nextNum + 1 } });
        // Link quote to invoice (bidirectional)
        if (linkedQuote) {
          await db("quotes").eq("id", linkedQuote.id).update({ invoice_generated: true, generated_invoice_id: invoiceId });
          dispatch({ type: "UPDATE_QUOTE", payload: { id: linkedQuote.id, invoice_generated: true, generated_invoice_id: invoiceId } });
        }
      }

      // Generate PDF and upload to Supabase storage
      const invoiceForPDF = { ...invoiceData, id: invoiceId, invoice_number: invoiceNumber };
      const pdfBlob = generateInvoicePDF({ business, invoice: invoiceForPDF, breakdown: breakdown || null });
      const pdfFilename = `${invoiceNumber}-${Date.now()}.pdf`;
      const uploadPath = `${business.id}/${pdfFilename}`;
      const { error: uploadErr } = await supabase.uploadFile("invoice-pdfs", uploadPath, pdfBlob);
      if (!uploadErr) {
        await db("invoices").eq("id", invoiceId).update({ pdf_url: uploadPath, pdf_filename: pdfFilename });
        dispatch({ type: "UPDATE_INVOICE", payload: { id: invoiceId, pdf_url: uploadPath, pdf_filename: pdfFilename } });
      }

      // Send invoice email via N8N
      await fetch("https://wynfallautomation.app.n8n.cloud/webhook/send-invoice", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });

      dispatch({ type: "NOTIFY", payload: { message: "Invoice sent!", type: "success" } });
    } catch (err) {
      reportError(err, "send_invoice");
      dispatch({ type: "NOTIFY", payload: { message: "Failed to send invoice — try again", type: "error" } });
    }
    setSending(false);
  };

  const saveAsDraft = async () => {
    if (!form.customerName || (!form.isDeposit && !form.amount)) {
      dispatch({ type: "NOTIFY", payload: { message: "Please fill in customer name and amount", type: "error" } });
      return;
    }
    setSending(true);
    try {
      const invoiceData = buildInvoiceData("draft");

      if (isEditing) {
        const { error } = await db("invoices").eq("id", editInvoice.id).update(invoiceData);
        if (error) throw new Error("Failed to update invoice");
        dispatch({ type: "UPDATE_INVOICE", payload: { id: editInvoice.id, ...invoiceData } });
      } else {
        const { data: newInvoice, error } = await db("invoices").insert(invoiceData);
        if (error) throw new Error("Failed to save invoice");
        await db("businesses").eq("id", business.id).update({ next_invoice_number: nextNum + 1 });
        dispatch({ type: "ADD_INVOICE", payload: newInvoice[0] });
        dispatch({ type: "SET_BUSINESS", payload: { ...business, next_invoice_number: nextNum + 1 } });
        // Link quote to invoice (bidirectional)
        if (linkedQuote) {
          const draftInvoiceId = newInvoice[0].id;
          await db("quotes").eq("id", linkedQuote.id).update({ invoice_generated: true, generated_invoice_id: draftInvoiceId });
          dispatch({ type: "UPDATE_QUOTE", payload: { id: linkedQuote.id, invoice_generated: true, generated_invoice_id: draftInvoiceId } });
        }
      }

      dispatch({ type: "NOTIFY", payload: { message: isEditing ? "Invoice updated" : "Invoice saved as draft", type: "success" } });
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to save invoice", type: "error" } });
    }
    setSending(false);
  };

  // Invoice Preview Modal — matches QuotePreview layout
  const InvoicePreviewModal = () => {
    const hasBreakdown = !form.isDeposit && form.showBreakdown && breakdown;
    const dueDateFormatted = new Date(dueDate).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });

    return (
    <div onClick={() => setShowPreview(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto", borderRadius: 12, background: "#fff", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "32px 40px" }}>
          {/* Header — business info left, invoice info right */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#0A0E17", fontFamily: theme.fontDisplay }}>{business.business_name}</div>
              {business.address && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{business.address}</div>}
              {business.phone && <div style={{ fontSize: 13, color: "#6b7280" }}>{business.phone}</div>}
              {business.email && <div style={{ fontSize: 13, color: "#6b7280" }}>{business.email}</div>}
              {(business.gst_number || business.license_number) && (
                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                  {business.gst_number && <div style={{ fontSize: 11, color: "#9ca3af" }}>GST: {business.gst_number}</div>}
                  {business.license_number && <div style={{ fontSize: 11, color: "#9ca3af" }}>{business.license_number}</div>}
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1 }}>{business?.gst_number ? "Tax Invoice" : "Invoice"}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginTop: 2 }}>{invoiceNumber}</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}</div>
              <div style={{ fontSize: 13, color: "#111827", fontWeight: 600, marginTop: 2 }}>Due: {dueDateFormatted}</div>
            </div>
          </div>
          <div style={{ borderBottom: "3px solid #14B8A6", marginBottom: 24 }} />

          {/* Bill To */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>Bill To</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>{form.customerName}</div>
            {form.customerEmail && <div style={{ fontSize: 13, color: "#6b7280" }}>{form.customerEmail}</div>}
            {form.customerPhone && <div style={{ fontSize: 13, color: "#6b7280" }}>{form.customerPhone}</div>}
          </div>

          {/* Job */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>Job</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{form.jobTitle}</div>
          </div>

          {/* Scope of Work */}
          {form.description && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>Scope of Work</div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-line" }}>{form.description}</div>
            </div>
          )}

          {/* Materials list from breakdown */}
          {hasBreakdown && breakdown.materials && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>Materials</div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-line" }}>{breakdown.materials}</div>
            </div>
          )}

          {/* Pricing breakdown */}
          <div style={{ background: "#f9fafb", borderRadius: 10, padding: 20, marginBottom: 24 }}>
            {form.isDeposit && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: "#6b7280" }}>Deposit ({form.depositPercentage}% of ${parseFloat(linkedQuote?.amount || 0).toLocaleString()})</span>
                <span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>${invoiceAmount.toLocaleString()}</span>
              </div>
            )}
            {hasBreakdown && (<>
              {breakdown.lineItems?.filter(i => i.description?.trim()).map((item, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 14, color: "#6b7280" }}>{item.description}</span>
                  {item.price && <span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>${parseFloat(item.price).toLocaleString()}</span>}
                </div>
              ))}
              {parseFloat(breakdown.materialsCost) > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 14, color: "#6b7280" }}>Materials</span><span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>${parseFloat(breakdown.materialsCost).toLocaleString()}</span></div>}
              {breakdown.labourHours && breakdown.labourRate && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 14, color: "#6b7280" }}>Labour ({breakdown.labourHours} hrs @ ${breakdown.labourRate}/hr)</span><span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>${(parseFloat(breakdown.labourHours) * parseFloat(breakdown.labourRate)).toLocaleString()}</span></div>}
              {breakdown.includeCallout && parseFloat(breakdown.calloutFee) > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 14, color: "#6b7280" }}>Callout Fee</span><span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>${parseFloat(breakdown.calloutFee).toLocaleString()}</span></div>}
            </>)}
            {!form.isDeposit && !hasBreakdown && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: "#6b7280" }}>Amount</span>
                <span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>${invoiceAmount.toLocaleString()}</span>
              </div>
            )}
            {gstAmount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb" }}>
                <span style={{ fontSize: 14, color: "#6b7280" }}>GST (15%)</span>
                <span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>${gstAmount.toLocaleString()}</span>
              </div>
            )}
            <div style={{ borderTop: "2px solid #111827", paddingTop: 12, marginTop: 12, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{form.isDeposit ? "Deposit Due" : gstAmount > 0 ? "Total (incl. GST)" : "Total"}</span>
              <span style={{ fontSize: 24, fontWeight: 800, color: "#14B8A6" }}>${totalAmount.toLocaleString()}</span>
            </div>
            {form.isDeposit && linkedQuote && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ fontSize: 13, color: "#9ca3af" }}>Balance remaining</span>
                <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>${(parseFloat(linkedQuote.amount) - invoiceAmount).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Payment terms */}
          <div style={{ marginBottom: 24, padding: "16px 20px", borderRadius: 10, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 10 }}>Payment Terms</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 14, color: "#6b7280" }}>Due Date</span>
              <span style={{ fontSize: 14, color: "#111827", fontWeight: 600 }}>{dueDateFormatted}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, color: "#6b7280" }}>Terms</span>
              <span style={{ fontSize: 14, color: "#111827" }}>{form.paymentTerms}</span>
            </div>
          </div>

          {/* Bank details */}
          {(business.bank_name || business.bank_account_number) && (
            <div style={{ marginBottom: 24, padding: "16px 20px", borderRadius: 10, background: "#f0fdfa", border: "1px solid #ccfbf1" }}>
              <div style={{ fontSize: 12, color: "#0d9488", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 10 }}>Payment Details</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {business.bank_name && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 14, color: "#6b7280" }}>Bank</span><span style={{ fontSize: 14, color: "#111827" }}>{business.bank_name}</span></div>}
                {business.bank_account_name && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 14, color: "#6b7280" }}>Account Name</span><span style={{ fontSize: 14, color: "#111827" }}>{business.bank_account_name}</span></div>}
                {business.bank_account_number && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 14, color: "#6b7280" }}>Account Number</span><span style={{ fontSize: 14, color: "#111827", fontWeight: 600 }}>{business.bank_account_number}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 14, color: "#6b7280" }}>Reference</span><span style={{ fontSize: 14, color: "#111827" }}>{invoiceNumber}</span></div>
              </div>
            </div>
          )}

          {/* Notes */}
          {form.notes && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1, marginBottom: 6 }}>Notes</div>
              <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, whiteSpace: "pre-line" }}>{form.notes}</div>
            </div>
          )}

          {/* Quote footer from settings */}
          {business.quote_footer && (
            <div style={{ marginBottom: 24, padding: "14px 16px", borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, whiteSpace: "pre-line" }}>{business.quote_footer}</div>
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Powered by <span style={{ color: "#14B8A6", fontWeight: 600 }}>Wynflow</span></div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Payment due {dueDateFormatted}</div>
          </div>
        </div>
        <div style={{ padding: "16px 40px 24px", background: "#f9fafb", borderTop: "1px solid #e5e7eb", display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={() => setShowPreview(false)}>Close</Button>
          <Button onClick={() => { setShowPreview(false); sendInvoice(); }} disabled={sending}><Send size={16} /> Send Invoice</Button>
        </div>
      </div>
    </div>
  );};

  return (
    <div>
      <div style={{ marginBottom: isMobile ? 16 : 32 }}>
        <span onClick={() => dispatch({ type: "GO_BACK" })}
          style={{ fontSize: 13, color: theme.textMuted, cursor: "pointer", display: "block", marginBottom: 6 }}>← Back</span>
        <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>
          {isEditing ? "Edit Invoice" : linkedQuote ? "Invoice from Quote" : "New Invoice"}
        </h1>
        <p style={{ fontSize: isMobile ? 13 : 14, color: theme.textMuted, margin: "4px 0 0" }}>{invoiceNumber}</p>
      </div>

      {showPreview && <InvoicePreviewModal />}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 24 }}>
        {/* Customer details */}
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Customer Details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input label="Customer Name *" value={form.customerName} onChange={v => update("customerName", v)} />
            <Input label="Email *" type="email" value={form.customerEmail} onChange={v => update("customerEmail", v)} />
            <Input label="Phone" value={form.customerPhone} onChange={v => update("customerPhone", v)} />
          </div>
        </Card>

        {/* Job details */}
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Job Details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input label="Job Title" value={form.jobTitle} onChange={v => update("jobTitle", v)} />
            <Input label="Description" type="textarea" value={form.description} onChange={v => update("description", v)} />
          </div>
        </Card>

        {/* Pricing */}
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Pricing</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input label="Amount ($) *" type="number" value={form.amount} onChange={v => update("amount", v)} />
            {business?.require_deposit && linkedQuote && (
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={form.isDeposit} onChange={e => update("isDeposit", e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: theme.accent }} />
                <span style={{ fontSize: 14, color: theme.text }}>Deposit invoice ({form.depositPercentage}%)</span>
              </label>
            )}
            {form.isDeposit && (
              <div style={{ padding: 12, borderRadius: 8, background: theme.accentSoft, border: `1px solid ${theme.accent}33` }}>
                <div style={{ fontSize: 13, color: theme.accent }}>Deposit: ${invoiceAmount.toLocaleString()} of ${parseFloat(linkedQuote?.amount || 0).toLocaleString()}</div>
              </div>
            )}
            {gstAmount > 0 && (
              <div style={{ fontSize: 13, color: theme.textMuted }}>+ GST (15%): ${gstAmount.toLocaleString()} — Total: ${totalAmount.toLocaleString()}</div>
            )}
          </div>
        </Card>

        {/* Payment terms */}
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Payment Terms</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, color: theme.textMuted, display: "block", marginBottom: 6 }}>Terms</label>
              <select value={form.paymentTerms} onChange={e => { update("paymentTerms", e.target.value); setDueDate(getDueDate(e.target.value)); }}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: theme.text, fontFamily: theme.font, outline: "none" }}>
                <option value="7 days">7 days</option>
                <option value="14 days">14 days</option>
                <option value="20th of month">20th of month</option>
                <option value="On receipt">On receipt</option>
              </select>
            </div>
            <Input label="Due Date" type="date" value={dueDate} onChange={v => setDueDate(v)} />
            <Input label="Notes" type="textarea" value={form.notes} onChange={v => update("notes", v)} placeholder="Payment instructions, terms, etc." />
          </div>
        </Card>

        {/* Bank details (read-only) */}
        <Card style={{ gridColumn: "1 / -1" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Bank Details (from Settings)</h3>
          {(business?.bank_name || business?.bank_account_number) ? (
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 14, color: theme.textMuted }}>
              {business.bank_name && <div><strong style={{ color: theme.text }}>Bank:</strong> {business.bank_name}</div>}
              {business.bank_account_name && <div><strong style={{ color: theme.text }}>Account:</strong> {business.bank_account_name}</div>}
              {business.bank_account_number && <div><strong style={{ color: theme.text }}>Number:</strong> {business.bank_account_number}</div>}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: theme.red, margin: 0 }}>Add your bank details in Settings so customers know where to pay</p>
          )}
        </Card>

        {/* Actions */}
        <Card style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button onClick={() => setShowPreview(true)} variant="secondary"><Search size={16} /> Preview Invoice</Button>
            <Button onClick={saveAsDraft} variant="secondary" disabled={sending}><FileText size={16} /> {isEditing ? "Save Changes" : "Save as Draft"}</Button>
            <Button onClick={sendInvoice} disabled={sending}><Send size={16} /> {sending ? "Sending..." : "Send Invoice"}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

// ─── Invoice Detail ───
const InvoicePreviewModal = ({ invoice, business, onClose }) => {
  const isMobile = useIsMobile();
  const isGST = !!business.gst_number;
  const amount = parseFloat(invoice.amount || 0);
  const gst = parseFloat(invoice.gst_amount || 0);
  const total = amount + gst;

  let bd = null;
  const raw = invoice.breakdown;
  if (raw) {
    if (typeof raw === "string") { try { bd = JSON.parse(raw); } catch { bd = null; } }
    else bd = raw;
  }

  const lineItems = [];
  if (bd && bd.lineItems) bd.lineItems.filter(i => i.description?.trim()).forEach(i => lineItems.push({ desc: i.description, amt: i.price }));
  if (bd && bd.materialsCost && parseFloat(bd.materialsCost) > 0) lineItems.push({ desc: "Materials", amt: bd.materialsCost });
  if (bd && bd.labourHours && bd.labourRate) lineItems.push({ desc: `Labour (${bd.labourHours} hrs @ $${bd.labourRate}/hr)`, amt: parseFloat(bd.labourHours) * parseFloat(bd.labourRate) });
  if (bd && bd.includeCallout && bd.calloutFee && parseFloat(bd.calloutFee) > 0) lineItems.push({ desc: "Callout Fee", amt: bd.calloutFee });
  if (invoice.is_deposit) lineItems.push({ desc: `Deposit (${invoice.deposit_percentage || 0}%${invoice.linkedQuoteAmount ? " of " + fmtNZD(invoice.linkedQuoteAmount) : ""})`, amt: amount });
  if (lineItems.length === 0 && !invoice.is_deposit) lineItems.push({ desc: invoice.job_title || "Services", amt: amount });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", padding: 16 }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 680, maxHeight: "90vh", overflow: "auto", borderRadius: 16, background: "#ffffff", boxShadow: "0 24px 80px rgba(0,0,0,0.4)" }} onClick={e => e.stopPropagation()}>
        {/* Close button */}
        <div style={{ position: "sticky", top: 0, zIndex: 1, display: "flex", justifyContent: "flex-end", padding: "12px 16px 0" }}>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 16, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        <div style={{ padding: isMobile ? "16px 20px 32px" : "16px 40px 40px", fontFamily: "'DM Sans', Arial, sans-serif" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#0A0E17" }}>{business.business_name}</div>
              {business.address && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{business.address}</div>}
              {business.phone && <div style={{ fontSize: 12, color: "#6b7280" }}>{business.phone}</div>}
              {business.email && <div style={{ fontSize: 12, color: "#6b7280" }}>{business.email}</div>}
              {isGST && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>GST: {business.gst_number}</div>}
              {business.license_number && <div style={{ fontSize: 11, color: "#9ca3af" }}>{business.license_number}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#14B8A6" }}>{isGST ? "TAX INVOICE" : "INVOICE"}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginTop: 2 }}>{invoice.invoice_number}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{fmtDate(invoice.sent_at || invoice.created_at)}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>Due: {fmtDate(invoice.due_date)}</div>
            </div>
          </div>

          {/* Teal line */}
          <div style={{ height: 2, background: "#14B8A6", borderRadius: 1, marginBottom: 24 }} />

          {/* Bill To */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 1, marginBottom: 6 }}>BILL TO</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{invoice.customer_name}</div>
            {invoice.customer_email && <div style={{ fontSize: 12, color: "#6b7280" }}>{invoice.customer_email}</div>}
            {invoice.customer_phone && <div style={{ fontSize: 12, color: "#6b7280" }}>{invoice.customer_phone}</div>}
          </div>

          {/* Job */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 1, marginBottom: 6 }}>JOB</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{invoice.job_title || ""}</div>
          </div>

          {/* Scope */}
          {invoice.description && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 1, marginBottom: 6 }}>SCOPE OF WORK</div>
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{invoice.description}</div>
            </div>
          )}

          {/* Line Items */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 1, marginBottom: 8 }}>ITEMS</div>
            <div style={{ background: "#f3f4f6", borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280" }}>Description</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280" }}>Amount</span>
            </div>
            {lineItems.map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>
                <span style={{ fontSize: 13, color: "#374151", flex: 1, paddingRight: 16 }}>{item.desc}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#111827", whiteSpace: "nowrap" }}>{fmtNZD(item.amt)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginBottom: 24 }}>
            {isGST && (
              <>
                <div style={{ display: "flex", gap: 24, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: "#6b7280" }}>Subtotal (ex GST)</span>
                  <span style={{ fontSize: 13, color: "#111827" }}>{fmtNZD(amount)}</span>
                </div>
                <div style={{ display: "flex", gap: 24, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "#6b7280" }}>GST (15%)</span>
                  <span style={{ fontSize: 13, color: "#111827" }}>{fmtNZD(gst)}</span>
                </div>
                <div style={{ width: 180, height: 1, background: "#111827", marginBottom: 8 }} />
              </>
            )}
            <div style={{ display: "flex", gap: 24, alignItems: "baseline" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{isGST ? "Total (incl. GST)" : "Total"}</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#14B8A6" }}>{fmtNZD(total)}</span>
            </div>
            {invoice.is_deposit && invoice.linkedQuoteAmount && (
              <div style={{ display: "flex", gap: 24, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>Balance remaining</span>
                <span style={{ fontSize: 11, color: "#6b7280" }}>{fmtNZD(parseFloat(invoice.linkedQuoteAmount) - amount)}</span>
              </div>
            )}
            {!isGST && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>This business is not registered for GST</div>}
          </div>

          {/* Payment Details */}
          {business.bank_account_number && (
            <div style={{ background: "#f0fdfa", border: "1px solid #ccfbf1", borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#0d9488", letterSpacing: 1, marginBottom: 10 }}>PAYMENT DETAILS</div>
              {business.bank_name && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 12, color: "#6b7280" }}>Bank</span><span style={{ fontSize: 12, color: "#111827" }}>{business.bank_name}</span></div>}
              {business.bank_account_name && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 12, color: "#6b7280" }}>Account Name</span><span style={{ fontSize: 12, color: "#111827" }}>{business.bank_account_name}</span></div>}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 12, color: "#6b7280" }}>Account Number</span><span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{business.bank_account_number}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 12, color: "#6b7280" }}>Reference</span><span style={{ fontSize: 12, color: "#111827" }}>{invoice.invoice_number}</span></div>
            </div>
          )}

          {/* Payment Terms */}
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 16 }}>
            Payment Terms: {invoice.payment_terms || "7 days"} &nbsp;•&nbsp; Due: {fmtDate(invoice.due_date)}
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 1, marginBottom: 6 }}>NOTES</div>
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{invoice.notes}</div>
            </div>
          )}

          {/* Footer */}
          {business.quote_footer && (
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, whiteSpace: "pre-wrap", marginBottom: 16 }}>{business.quote_footer}</div>
          )}

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Thank you for your business</div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>Powered by Wynflow</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InvoiceDetail = ({ invoiceId, invoices, business, dispatch, sequences }) => {
  const isMobile = useIsMobile();
  const invoice = invoices.find((i) => i.id === invoiceId);
  const [steps, setSteps] = useState([]);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!invoice?.reminder_sequence_id) return;
    db("sequence_steps").eq("sequence_id", invoice.reminder_sequence_id).order("step_order").select()
      .then(({ data }) => setSteps(data || []));
  }, [invoice?.id]);

  if (!invoice) return <div style={{ color: theme.textMuted, padding: 48 }}>Invoice not found</div>;

  const isOverdue = (invoice.status === "sent" || invoice.status === "viewed") && invoice.due_date && new Date(invoice.due_date) < new Date();
  const daysOverdue = isOverdue ? Math.abs(Math.ceil((new Date(invoice.due_date) - new Date()) / (1000 * 60 * 60 * 24))) : 0;

  const updateStatus = async (status, extra = {}) => {
    const updates = { status, ...extra };
    if (status === "paid") {
      updates.paid_at = new Date().toISOString();
      updates.reminders_paused = true;
    }
    const { error } = await db("invoices").eq("id", invoice.id).update(updates);
    if (error) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to update — try again", type: "error" } });
      return;
    }
    dispatch({ type: "UPDATE_INVOICE", payload: { id: invoice.id, ...updates } });
    const messages = { paid: "Invoice marked as paid!", sent: "Invoice resent!" };
    dispatch({ type: "NOTIFY", payload: { message: messages[status] || `Invoice updated`, type: "success" } });
    if (status === "paid") setTimeout(() => dispatch({ type: "GO_BACK" }), 300);
  };

  const sendReminder = async () => {
    if (!window.confirm("Send a payment reminder to " + invoice.customer_name + "?")) return;
    setSending(true);
    try {
      await fetch("https://wynfallautomation.app.n8n.cloud/webhook/send-invoice-reminder", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoice.id, current_step: invoice.current_reminder_step || 0, sequence_id: invoice.reminder_sequence_id }),
      });
      const newStep = (invoice.current_reminder_step || 0) + 1;
      await db("invoices").eq("id", invoice.id).update({ current_reminder_step: newStep });
      dispatch({ type: "UPDATE_INVOICE", payload: { id: invoice.id, current_reminder_step: newStep } });
      dispatch({ type: "NOTIFY", payload: { message: "Payment reminder sent!", type: "success" } });
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to send reminder", type: "error" } });
    }
    setSending(false);
  };

  const deleteInvoice = async () => {
    if (!window.confirm("Are you sure you want to delete this invoice? This cannot be undone.")) return;
    const { error } = await db("invoices").eq("id", invoice.id).delete();
    if (error) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to delete invoice", type: "error" } });
      return;
    }
    dispatch({ type: "DELETE_INVOICE", payload: invoice.id });
    dispatch({ type: "NOTIFY", payload: { message: "Invoice deleted", type: "success" } });
  };

  const resendInvoice = async () => {
    const isDraft = invoice.status === "draft";
    const msg = isDraft ? "Send this invoice to " + invoice.customer_email + "?" : "Resend this invoice to " + invoice.customer_email + "?";
    if (!window.confirm(msg)) return;
    setSending(true);
    try {
      // If draft, update status to sent first
      if (isDraft) {
        const updates = { status: "sent", sent_at: new Date().toISOString() };
        const { error } = await db("invoices").eq("id", invoice.id).update(updates);
        if (error) throw new Error("Failed to update invoice");
        dispatch({ type: "UPDATE_INVOICE", payload: { id: invoice.id, ...updates } });
      }

      // Generate PDF if none exists yet
      if (!invoice.pdf_url) {
        const bd = typeof invoice.breakdown === "string" ? JSON.parse(invoice.breakdown) : invoice.breakdown;
        const pdfBlob = generateInvoicePDF({ business, invoice, breakdown: bd });
        const pdfFilename = `${invoice.invoice_number}-${Date.now()}.pdf`;
        const uploadPath = `${business.id}/${pdfFilename}`;
        const { error: uploadErr } = await supabase.uploadFile("invoice-pdfs", uploadPath, pdfBlob);
        if (!uploadErr) {
          await db("invoices").eq("id", invoice.id).update({ pdf_url: uploadPath, pdf_filename: pdfFilename });
          dispatch({ type: "UPDATE_INVOICE", payload: { id: invoice.id, pdf_url: uploadPath, pdf_filename: pdfFilename } });
        }
      }

      await fetch("https://wynfallautomation.app.n8n.cloud/webhook/send-invoice", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoice.id }),
      });
      dispatch({ type: "NOTIFY", payload: { message: isDraft ? "Invoice sent!" : "Invoice resent!", type: "success" } });
    } catch (err) {
      reportError(err, "resend_invoice");
      dispatch({ type: "NOTIFY", payload: { message: "Failed to send invoice", type: "error" } });
    }
    setSending(false);
  };

  return (
    <div>
      <div style={{ marginBottom: isMobile ? 16 : 32 }}>
        <span onClick={() => dispatch({ type: "GO_BACK" })}
          style={{ fontSize: 13, color: theme.textMuted, cursor: "pointer", display: "block", marginBottom: 6 }}>← Back</span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 8 : 0 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 20 : 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>{invoice.job_title || "Invoice"}</h1>
            <p style={{ fontSize: isMobile ? 12 : 14, color: theme.textMuted, margin: "4px 0 0" }}>Invoice #{invoice.invoice_number} • {new Date(invoice.created_at).toLocaleDateString()}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Button variant="secondary" size="sm" onClick={() => setShowPreview(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Eye size={14} /> View Invoice</Button>
            <InvoiceBadge status={invoice.status} dueDate={invoice.due_date} />
          </div>
        </div>
      </div>

      {showPreview && <InvoicePreviewModal invoice={invoice} business={business} onClose={() => setShowPreview(false)} />}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 24 }}>
        {/* Customer */}
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Customer</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><div style={{ fontSize: 12, color: theme.textMuted }}>Name</div><div style={{ fontSize: 15, color: theme.text, fontWeight: 500 }}>{invoice.customer_name}</div></div>
            <div><div style={{ fontSize: 12, color: theme.textMuted }}>Email</div><div style={{ fontSize: 15, color: theme.text }}>{invoice.customer_email}</div></div>
            {invoice.customer_phone && <div><div style={{ fontSize: 12, color: theme.textMuted }}>Phone</div><div style={{ fontSize: 15, color: theme.text }}>{invoice.customer_phone}</div></div>}
          </div>
        </Card>

        {/* Invoice details */}
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Invoice Details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>{invoice.gst_amount > 0 ? "Total (incl. GST)" : "Amount"}</div>
              <div style={{ fontSize: 28, color: theme.accent, fontWeight: 700, fontFamily: theme.fontDisplay }}>${(parseFloat(invoice.amount || 0) + parseFloat(invoice.gst_amount || 0)).toLocaleString()}</div>
            </div>
            {invoice.gst_amount > 0 && (
              <div style={{ fontSize: 13, color: theme.textMuted }}>Subtotal: ${parseFloat(invoice.amount).toLocaleString()} + GST: ${parseFloat(invoice.gst_amount).toLocaleString()}</div>
            )}
            {invoice.is_deposit && (
              <div style={{ padding: 12, borderRadius: 8, background: theme.accentSoft, border: `1px solid ${theme.accent}33` }}>
                <div style={{ fontSize: 13, color: theme.accent, fontWeight: 600 }}>Deposit Invoice ({invoice.deposit_percentage}%)</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>Due Date</div>
              <div style={{ fontSize: 15, color: isOverdue ? theme.red : theme.text, fontWeight: isOverdue ? 600 : 400 }}>
                {new Date(invoice.due_date).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}
                {isOverdue && ` (${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue)`}
              </div>
            </div>
            <div><div style={{ fontSize: 12, color: theme.textMuted }}>Terms</div><div style={{ fontSize: 15, color: theme.text }}>{invoice.payment_terms}</div></div>
            {invoice.quote_id && (
              <div onClick={() => dispatch({ type: "SET_SCREEN", payload: "quoteDetail:" + invoice.quote_id })}
                style={{ fontSize: 13, color: theme.accent, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={14} /> View linked quote
              </div>
            )}
          </div>
        </Card>

        {/* Reminder timeline */}
        {steps.length > 0 && (
          <Card style={{ gridColumn: "1 / -1" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 20px" }}>Payment Reminder Timeline</h3>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {steps.map((step, i) => {
                const completed = i < (invoice.current_reminder_step || 0);
                const isNext = i === (invoice.current_reminder_step || 0);
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
                        {completed ? "Sent" : isNext ? "Next up" : "Scheduled"} — Day {step.delay_days} after due
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: theme.text, marginTop: 4 }}>
                        {step.email_subject.replace("{job}", invoice.job_title || "").replace("{name}", invoice.customer_name?.split(" ")[0] || "")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Download PDF */}
        {invoice.pdf_url && (
          <Card style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <FileText size={20} color={theme.accent} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>Invoice PDF</div>
                <div style={{ fontSize: 12, color: theme.textMuted }}>{invoice.pdf_filename || "invoice.pdf"}</div>
              </div>
              <Button variant="secondary" onClick={async () => {
                try {
                  const { signedURL } = await supabase.getSignedUrl("invoice-pdfs", invoice.pdf_url, 300);
                  if (signedURL) window.open(signedURL, "_blank");
                } catch { dispatch({ type: "NOTIFY", payload: { message: "Failed to download PDF", type: "error" } }); }
              }} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Download size={16} /> Download PDF
              </Button>
            </div>
          </Card>
        )}

        {/* Overdue warning */}
        {isOverdue && invoice.status !== "paid" && (
          <Card style={{ gridColumn: "1 / -1", background: theme.redSoft, border: `1px solid ${theme.red}33` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <AlertTriangle size={20} color={theme.red} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.red, margin: 0 }}>Payment Overdue</h3>
            </div>
            <p style={{ fontSize: 14, color: theme.textMuted, margin: "0 0 16px", lineHeight: 1.5 }}>
              This invoice is <strong>{daysOverdue} day{daysOverdue !== 1 ? "s" : ""}</strong> overdue. Send a payment reminder or contact {invoice.customer_name}.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button onClick={() => updateStatus("paid")} style={{ background: theme.green, color: "#fff", display: "inline-flex", alignItems: "center", gap: 6 }}><CreditCard size={16} /> Mark as Paid</Button>
              <Button onClick={sendReminder} variant="secondary" disabled={sending}><Mail size={16} /> Send Reminder</Button>
              <Button onClick={resendInvoice} variant="secondary" disabled={sending}><Send size={16} /> Resend Invoice</Button>
              <Button onClick={deleteInvoice} variant="danger" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Trash2 size={16} /> Delete</Button>
            </div>
          </Card>
        )}

        {/* Sent/Viewed actions */}
        {(invoice.status === "sent" || invoice.status === "viewed") && !isOverdue && (
          <Card style={{ gridColumn: "1 / -1" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Actions</h3>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button onClick={() => updateStatus("paid")} style={{ background: theme.green, color: "#fff", display: "inline-flex", alignItems: "center", gap: 6 }}><CreditCard size={16} /> Mark as Paid</Button>
              <Button onClick={sendReminder} variant="secondary" disabled={sending}><Mail size={16} /> Send Reminder</Button>
              <Button onClick={resendInvoice} variant="secondary" disabled={sending}><Send size={16} /> Resend Invoice</Button>
              <Button onClick={deleteInvoice} variant="danger" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Trash2 size={16} /> Delete</Button>
            </div>
          </Card>
        )}

        {/* Draft actions */}
        {invoice.status === "draft" && (
          <Card style={{ gridColumn: "1 / -1" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Actions</h3>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "editInvoice:" + invoice.id })} variant="secondary"><FileText size={16} /> Edit Invoice</Button>
              <Button onClick={resendInvoice} disabled={sending}><Send size={16} /> Send Invoice</Button>
              <Button onClick={deleteInvoice} variant="danger" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Trash2 size={16} /> Delete</Button>
            </div>
          </Card>
        )}

        {/* Paid success */}
        {invoice.status === "paid" && (
          <Card style={{ gridColumn: "1 / -1", background: theme.greenSoft, border: `1px solid ${theme.green}33` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <CheckCircle2 size={24} color={theme.green} />
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.green, margin: 0 }}>Paid!</h3>
                <p style={{ fontSize: 13, color: theme.textMuted, margin: "4px 0 0" }}>
                  {invoice.paid_at ? `Paid on ${new Date(invoice.paid_at).toLocaleDateString()}` : "This invoice has been paid."}
                </p>
              </div>
            </div>
            {/* Create balance invoice if this was a deposit */}
            {invoice.is_deposit && invoice.quote_id && (
              <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "createInvoice:" + invoice.quote_id })}
                variant="secondary" style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Receipt size={16} /> Create Balance Invoice
              </Button>
            )}
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
  const [seqType, setSeqType] = useState("quote");
  const MAX_STEPS = 5;

  const exampleData = { name: "Sarah", job: "Kitchen Renovation", amount: "4,500", business_name: business?.business_name || "Your Business", invoice_number: "INV-001", due_date: "15 April 2026" };

  const previewText = (text) => text
    .replace(/{name}/g, exampleData.name)
    .replace(/{job}/g, exampleData.job)
    .replace(/{amount}/g, exampleData.amount)
    .replace(/{business_name}/g, exampleData.business_name)
    .replace(/{invoice_number}/g, exampleData.invoice_number)
    .replace(/{due_date}/g, exampleData.due_date);

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

  const placeholderTags = seqType === "invoice"
    ? ["{name}", "{job}", "{amount}", "{business_name}", "{invoice_number}", "{due_date}"]
    : ["{name}", "{job}", "{amount}", "{business_name}"];

  const PlaceholderButtons = ({ field }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
      {placeholderTags.map(tag => (
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
        <p style={{ fontSize: isMobile ? 13 : 14, color: theme.textMuted, margin: "4px 0 0" }}>
          {seqType === "quote" ? "Automated emails that chase your quotes" : "Payment reminders for your invoices"}. Up to {MAX_STEPS} steps per sequence.
        </p>
      </div>

      {/* Type toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: isMobile ? 12 : 20 }}>
        {[{ key: "quote", label: "Quote Follow-Ups", icon: FileText }, { key: "invoice", label: "Invoice Reminders", icon: Receipt }].map(tab => (
          <span key={tab.key} onClick={() => setSeqType(tab.key)}
            style={{
              padding: isMobile ? "8px 12px" : "10px 16px", borderRadius: 8, fontSize: isMobile ? 12 : 13, fontWeight: 600, cursor: "pointer",
              background: seqType === tab.key ? theme.accentSoft : "rgba(255,255,255,0.03)",
              color: seqType === tab.key ? theme.accent : theme.textMuted,
              border: `1px solid ${seqType === tab.key ? theme.accent + "33" : "rgba(255,255,255,0.06)"}`,
              display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s",
            }}>
            <tab.icon size={14} /> {tab.label}
          </span>
        ))}
      </div>

      <Card style={{ marginBottom: 24, padding: isMobile ? 16 : 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, margin: "0 0 12px" }}>
          {seqType === "quote" ? "How Follow-Ups Work" : "How Payment Reminders Work"}
        </h3>
        <p style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.7, margin: "0 0 16px" }}>
          {seqType === "quote"
            ? "When you send a quote, Wynflow automatically sends follow-up emails if the customer doesn't respond."
            : "When an invoice passes its due date, Wynflow can automatically send payment reminder emails."}
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
        {sequences.filter(seq => (seq.type || "quote") === seqType).map((seq) => {
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
        {sequences.filter(seq => (seq.type || "quote") === seqType).length === 0 && (
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 14, color: theme.textDim, marginBottom: 8 }}>
              {seqType === "invoice" ? "No invoice reminder sequences yet" : "No follow-up sequences"}
            </div>
            {seqType === "invoice" && (
              <p style={{ fontSize: 13, color: theme.textDim }}>Invoice reminder sequences will be created automatically when you set up invoicing. You can also create them in your Supabase dashboard.</p>
            )}
          </div>
        )}
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
    { q: "What does 'When Do Customers Respond?' show?", a: "It tells you which follow-up email triggers the most responses. If most people respond after Follow-Up 2, you know your second email is doing the heavy lifting — and that follow-ups genuinely work for your business." },
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
            <h3 style={{ fontSize: 12, fontWeight: 600, color: theme.accent, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: 0.5 }}>{cat.category}</h3>
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

// ─── Historical Quotes (AI Training Data) ───
const HistoricalQuotes = ({ business, dispatch, quotes }) => {
  const isMobile = useIsMobile();
  const [form, setForm] = useState({ jobTitle: "", description: "", amount: "", customerName: "", status: "booked" });
  const [saving, setSaving] = useState(false);
  const historicalQuotes = quotes.filter(q => q.source === "historical");

  const update = (key, val) => setForm({ ...form, [key]: val });

  const saveQuote = async () => {
    if (!form.jobTitle || !form.amount) {
      dispatch({ type: "NOTIFY", payload: { message: "Job title and amount are required", type: "error" } });
      return;
    }
    setSaving(true);
    try {
      const quoteData = {
        business_id: business.id,
        job_title: form.jobTitle,
        description: form.description,
        amount: parseFloat(form.amount),
        customer_name: form.customerName || "Historical Customer",
        customer_email: (form.customerName || "historical").toLowerCase().replace(/\s+/g, ".") + "@historical.local",
        status: form.status,
        source: "historical",
        created_at: new Date().toISOString(),
      };
      const { data, error } = await db("quotes").insert(quoteData);
      if (error) throw error;
      dispatch({ type: "ADD_QUOTE", payload: data[0] });
      dispatch({ type: "SET_SCREEN", payload: "historicalQuotes" });
      setForm({ jobTitle: "", description: "", amount: "", customerName: "", status: "booked" });
      dispatch({ type: "NOTIFY", payload: { message: "Historical quote added — AI will use this for future estimates", type: "success" } });
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to save quote", type: "error" } });
    }
    setSaving(false);
  };

  const deleteHistorical = async (id) => {
    if (!window.confirm("Delete this historical quote?")) return;
    const { error } = await db("quotes").eq("id", id).delete();
    if (!error) {
      dispatch({ type: "DELETE_QUOTE", payload: id });
      dispatch({ type: "SET_SCREEN", payload: "historicalQuotes" });
      dispatch({ type: "NOTIFY", payload: { message: "Quote removed", type: "success" } });
    }
  };

  return (
    <div>
      <div style={{ marginBottom: isMobile ? 16 : 32 }}>
        <span onClick={() => dispatch({ type: "SET_SCREEN", payload: "settings" })}
          style={{ fontSize: 13, color: theme.textMuted, cursor: "pointer", display: "block", marginBottom: 6 }}>← Back to Settings</span>
        <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay }}>Historical Quotes</h1>
        <p style={{ fontSize: isMobile ? 13 : 14, color: theme.textMuted, margin: "4px 0 0" }}>Add old quotes so the AI learns from your pricing history</p>
      </div>

      {/* Add new historical quote */}
      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}><Plus size={18} color={theme.accent} /> Add a Past Quote</h3>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
          <Input label="Job Title *" placeholder="e.g. Bathroom reno, 3 Elm St" value={form.jobTitle} onChange={v => update("jobTitle", v)} />
          <Input label="Amount (excl. GST) *" type="number" placeholder="e.g. 4500" value={form.amount} onChange={v => update("amount", v)} />
          <Input label="Customer Name" placeholder="Optional" value={form.customerName} onChange={v => update("customerName", v)} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: theme.textMuted, marginBottom: 6 }}>Outcome</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ value: "booked", label: "Won" }, { value: "declined", label: "Lost" }, { value: "accepted", label: "Accepted" }].map(opt => (
                <div key={opt.value} onClick={() => update("status", opt.value)}
                  style={{ flex: 1, padding: "10px 12px", borderRadius: 8, textAlign: "center", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    background: form.status === opt.value ? theme.accentSoft : "rgba(255,255,255,0.03)",
                    color: form.status === opt.value ? theme.accent : theme.textMuted,
                    border: `1px solid ${form.status === opt.value ? theme.accent + "33" : theme.border}`,
                  }}>{opt.label}</div>
              ))}
            </div>
          </div>
        </div>
        <Input label="Description / Scope" textarea placeholder="Brief description of the job (helps AI learn your pricing patterns)" value={form.description} onChange={v => update("description", v)} style={{ marginTop: 14 }} />
        <Button onClick={saveQuote} disabled={saving} style={{ marginTop: 16 }}><Plus size={14} /> {saving ? "Saving..." : "Add Quote"}</Button>
      </Card>

      {/* Existing historical quotes */}
      {historicalQuotes.length > 0 && (
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: theme.text, margin: "0 0 16px" }}>Your Historical Quotes ({historicalQuotes.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {historicalQuotes.map(q => (
              <div key={q.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.job_title}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{q.customer_name} • ${parseFloat(q.amount || 0).toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <Badge status={q.status} />
                  <Trash2 size={14} color={theme.red} style={{ cursor: "pointer", opacity: 0.6 }} onClick={() => deleteHistorical(q.id)} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {historicalQuotes.length === 0 && (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <History size={32} color={theme.textDim} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 15, color: theme.textMuted, fontWeight: 500, marginBottom: 4 }}>No historical quotes yet</div>
          <div style={{ fontSize: 13, color: theme.textDim }}>Add your past jobs above so the AI can learn your pricing patterns</div>
        </Card>
      )}
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
  const [materialsMargin, setMaterialsMargin] = useState(business?.materials_margin || 0);

  const [priceList, setPriceList] = useState(business?.price_list || []);
  const [newItem, setNewItem] = useState({ name: "", unit: "each", cost: "" });
  const [bankName, setBankName] = useState(business?.bank_name || "");
  const [bankAccountName, setBankAccountName] = useState(business?.bank_account_name || "");
  const [bankAccountNumber, setBankAccountNumber] = useState(business?.bank_account_number || "");
  const [depositPercentage, setDepositPercentage] = useState(business?.deposit_percentage || 25);
  const [requireDeposit, setRequireDeposit] = useState(business?.require_deposit || false);
  const [address, setAddress] = useState(business?.address || "");
  const [gstNumber, setGstNumber] = useState(business?.gst_number || "");
  const [gstInclusive, setGstInclusive] = useState(business?.gst_inclusive !== false);
  const [licenseNumber, setLicenseNumber] = useState(business?.license_number || "");
  const [quoteFooter, setQuoteFooter] = useState(business?.quote_footer || "");
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState(business?.default_payment_terms || "7 days");
  const [aiPricingMode, setAiPricingMode] = useState(business?.ai_pricing_mode || "flexible");
  const [autoFollowUps, setAutoFollowUps] = useState(business?.auto_follow_ups !== false);
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
      materials_margin: Math.max(0, Math.min(200, parseFloat(materialsMargin) || 0)),
      price_list: priceList,
      ai_pricing_mode: aiPricingMode,
      decline_reasons: declineReasons,
      bank_name: bankName,
      bank_account_name: bankAccountName,
      bank_account_number: bankAccountNumber,
      deposit_percentage: parseFloat(depositPercentage) || 25,
      require_deposit: requireDeposit,
      address: address,
      gst_number: gstNumber,
      gst_inclusive: gstInclusive,
      license_number: licenseNumber,
      quote_footer: quoteFooter,
      default_payment_terms: defaultPaymentTerms,
      auto_follow_ups: autoFollowUps,
    };
    try {
      const { error } = await db("businesses").eq("id", business.id).update(updates);
      if (error) throw error;
      const updatedBusiness = { ...business, ...updates };
      dispatch({ type: "SET_BUSINESS", payload: updatedBusiness });
      setCookie("wynflow_business", updatedBusiness, 43200);
      dispatch({ type: "NOTIFY", payload: { message: "Settings saved!", type: "success" } });
    } catch (err) {
      reportError(err, "save_settings");
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: isMobile ? 16 : 24 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: theme.text, margin: 0, letterSpacing: "-0.02em" }}>Settings</h1>
          <p style={{ fontSize: 13, color: theme.textMuted, margin: "4px 0 0" }}>Manage your business profile</p>
        </div>
        {isMobile && (
          <button onClick={async () => { await supabase.auth_signOut(); supabase.token = null; supabase.user = null; clearCookies(); dispatch({ type: "LOGOUT" }); window.history.replaceState(null, "", "/"); }}
            style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: theme.red, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: theme.font, flexShrink: 0 }}>
            Sign Out
          </button>
        )}
      </div>
      {/* Sticky save bar */}
      <div style={{ position: "sticky", top: isMobile ? -16 : 0, zIndex: 10, margin: isMobile ? "0 -14px" : "0 0 0 0", padding: isMobile ? "10px 14px" : "12px 0", background: "rgba(10,14,23,0.92)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", marginBottom: 12 }}>
        <Button onClick={saveSettings} disabled={saving} style={{ width: isMobile ? "100%" : "auto", justifyContent: "center" }}>{saving ? "Saving..." : "Save All Changes"}</Button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 10 : 24 }}>
        <Card style={isMobile ? { padding: 16 } : {}}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, margin: "0 0 14px", letterSpacing: "0.01em" }}>Business Profile</h3>
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
          </div>
        </Card>
        <Card style={isMobile ? { padding: 16 } : {}}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, margin: "0 0 8px", letterSpacing: "0.01em" }}>Quote Details</h3>
          <p style={{ fontSize: 12, color: theme.textMuted, margin: "0 0 12px" }}>Add your business details to display on quotes. Toggle them on/off per quote when sending.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 10 : 14 }}>
            <Input label="Business Address" value={address} onChange={setAddress} placeholder="e.g. 12 Queen St, Auckland 1010" />
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 10 : 12 }}>
              <div style={{ flex: 1 }}><Input label="GST Number" value={gstNumber} onChange={setGstNumber} placeholder="e.g. 123-456-789" /></div>
              <div style={{ flex: 1 }}><Input label="License / Rego Number" value={licenseNumber} onChange={setLicenseNumber} placeholder="e.g. LBP 12345" /></div>
            </div>
            {gstNumber && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: theme.textMuted, marginBottom: 6 }}>GST Display on Quotes</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { id: true, label: "Inclusive", desc: "Prices include GST" },
                    { id: false, label: "Exclusive", desc: "Prices exclude GST" },
                  ].map(opt => (
                    <div key={String(opt.id)} onClick={() => setGstInclusive(opt.id)}
                      style={{
                        flex: 1, padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                        background: gstInclusive === opt.id ? "rgba(20,184,166,0.08)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${gstInclusive === opt.id ? "rgba(20,184,166,0.3)" : "rgba(255,255,255,0.06)"}`,
                      }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: gstInclusive === opt.id ? theme.accent : theme.text }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{opt.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Input label="Custom Quote Footer" value={quoteFooter} onChange={setQuoteFooter} textarea placeholder="e.g. All work guaranteed for 12 months. Pricing valid for 30 days." />
          </div>
        </Card>
        <Card style={isMobile ? { padding: 16 } : {}}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, margin: "0 0 8px", letterSpacing: "0.01em" }}>Pricing & AI Estimates</h3>
          <p style={{ fontSize: 12, color: theme.textMuted, margin: "0 0 12px" }}>Set your rates so AI can estimate quotes from photos.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 10 : 14 }}>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 10 : 12 }}>
              <div style={{ flex: 1 }}><Input label="Hourly Rate ($)" value={hourlyRate} onChange={setHourlyRate} type="number" /></div>
              <div style={{ flex: 1 }}><Input label="Callout Fee ($)" value={calloutFee} onChange={setCalloutFee} type="number" /></div>
            </div>
            <div>
              <Input label="Default Materials Markup %" value={materialsMargin} onChange={v => setMaterialsMargin(v)} type="number" placeholder="e.g. 20" />
              <div style={{ fontSize: 12, color: theme.textDim, marginTop: -4 }}>How much do you mark up materials? Applied automatically to AI quotes.</div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: theme.textMuted, marginBottom: 6 }}>AI Pricing Mode</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { id: "flexible", label: "Flexible", desc: "AI estimates items & pricing based on the job" },
                  { id: "strict", label: "Price List Only", desc: "AI only uses your price list & quote history" },
                ].map(mode => (
                  <div key={mode.id} onClick={() => setAiPricingMode(mode.id)}
                    style={{
                      flex: 1, minWidth: 140, padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                      background: aiPricingMode === mode.id ? "rgba(20,184,166,0.08)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${aiPricingMode === mode.id ? "rgba(20,184,166,0.3)" : "rgba(255,255,255,0.06)"}`,
                      transition: "all 0.15s ease",
                    }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: aiPricingMode === mode.id ? theme.accent : theme.text, marginBottom: 2 }}>{mode.label}</div>
                    <div style={{ fontSize: 11, color: theme.textDim, lineHeight: 1.4 }}>{mode.desc}</div>
                  </div>
                ))}
              </div>
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
            <div onClick={() => dispatch({ type: "SET_SCREEN", payload: "historicalQuotes" })}
              style={{ marginTop: 16, padding: "14px 16px", borderRadius: 10, background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.15)", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(20,184,166,0.3)"} onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(20,184,166,0.15)"}>
              <History size={18} color={theme.accent} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>Historical Quotes</div>
                <div style={{ fontSize: 12, color: theme.textMuted }}>Add old quotes to train the AI on your pricing</div>
              </div>
              <ArrowRight size={16} color={theme.textMuted} style={{ marginLeft: "auto" }} />
            </div>
          </div>
        </Card>
        <Card style={isMobile ? { padding: 16 } : {}}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, margin: "0 0 8px", letterSpacing: "0.01em" }}>Invoice & Payment Settings</h3>
          {(() => {
            const { complete, missing } = isInvoiceSettingsComplete({ business_name: businessName, email, phone, address, bank_name: bankName, bank_account_name: bankAccountName, bank_account_number: bankAccountNumber });
            return !complete ? (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#F59E0B", marginBottom: 4 }}>Complete these to enable invoicing:</div>
                <div style={{ fontSize: 12, color: theme.textMuted }}>{missing.join(", ")}</div>
              </div>
            ) : (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.green, display: "flex", alignItems: "center", gap: 6 }}><Check size={14} /> Invoicing ready</div>
              </div>
            );
          })()}
          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 10 : 14 }}>
            <Input label="Bank Name *" value={bankName} onChange={setBankName} placeholder="e.g. ANZ, ASB, BNZ, Westpac" />
            <Input label="Account Name *" value={bankAccountName} onChange={setBankAccountName} placeholder="e.g. Smith's Plumbing Ltd" />
            <Input label="Account Number *" value={bankAccountNumber} onChange={setBankAccountNumber} placeholder="e.g. 01-0123-0123456-00" />
            <div>
              <label style={{ fontSize: 13, color: theme.textMuted, display: "block", marginBottom: 6 }}>Default Payment Terms</label>
              <select value={defaultPaymentTerms} onChange={e => setDefaultPaymentTerms(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: theme.text, fontFamily: theme.font, outline: "none" }}>
                <option value="7 days">7 days</option>
                <option value="14 days">14 days</option>
                <option value="20th of month">20th of month</option>
                <option value="On receipt">On receipt</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: isMobile ? "10px 12px" : "12px 16px", borderRadius: 10, background: theme.surfaceLight, border: `1px solid ${theme.border}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 500, color: theme.text }}>Require deposit on quotes</div>
                <div style={{ fontSize: 11, color: theme.textDim }}>Show bank details when quote is accepted</div>
              </div>
              <div onClick={() => setRequireDeposit(!requireDeposit)} style={{ width: 44, height: 24, borderRadius: 12, background: requireDeposit ? theme.accent : theme.border, cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                <div style={{ width: 20, height: 20, borderRadius: 10, background: "#fff", position: "absolute", top: 2, left: requireDeposit ? 22 : 2, transition: "left 0.2s" }} />
              </div>
            </div>
            {requireDeposit && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}><Input label="Deposit %" value={depositPercentage} onChange={setDepositPercentage} type="number" /></div>
                <div style={{ fontSize: 13, color: theme.textDim, paddingBottom: 12 }}>of quote total</div>
              </div>
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
          <div style={{ marginTop: 16, padding: "14px 18px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>Automatic follow-up emails</div>
                <div style={{ fontSize: 12, color: theme.textDim, marginTop: 3, lineHeight: 1.4 }}>
                  {autoFollowUps ? "Wynflow will automatically chase customers who haven't responded to your quotes" : "Follow-ups are off — you'll need to chase customers manually"}
                </div>
              </div>
              <div onClick={() => setAutoFollowUps(!autoFollowUps)}
                style={{ width: 44, height: 24, borderRadius: 12, background: autoFollowUps ? theme.accent : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                <div style={{ width: 20, height: 20, borderRadius: 10, background: "#fff", position: "absolute", top: 2, left: autoFollowUps ? 22 : 2, transition: "left 0.2s" }} />
              </div>
            </div>
          </div>
        </Card>
        <Card style={{ gridColumn: "1 / -1", ...(isMobile ? { padding: 16 } : {}) }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, margin: "0 0 8px", letterSpacing: "0.01em" }}>Your Quote Request Link</h3>
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
          <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, margin: "0 0 8px", letterSpacing: "0.01em" }}>Feedback Questionnaire</h3>
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
          <h3 style={{ fontSize: 13, fontWeight: 600, color: theme.text, margin: "0 0 12px", letterSpacing: "0.01em" }}>Subscription</h3>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: business?.subscription_status === "trialing" ? 12 : 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 600, color: theme.text }}>
                {business?.subscription_status === "trialing" ? "Free Trial" : business?.subscription_status === "active" ? "Wynflow Active" : "Wynflow"}
              </div>
              <div style={{ fontSize: isMobile ? 12 : 13, color: theme.textMuted }}>
                {business?.subscription_status === "trialing"
                  ? (getTrialDaysRemaining(business) !== null
                      ? `${Math.max(0, getTrialDaysRemaining(business))} days remaining — subscribe anytime`
                      : "Upgrade anytime to keep your quotes flowing")
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
            <Button onClick={() => window.open(STRIPE_LINKS.starter + "?prefilled_email=" + encodeURIComponent(business?.email || ""), "_blank")} size={isMobile ? "sm" : "md"} style={{ width: "100%", justifyContent: "center" }}>Subscribe — $29/mo</Button>
          )}
        </Card>
      </div>
    </div>
  );
};

// ─── Onboarding Tutorial ───
const OnboardingTutorial = ({ business, dispatch, onComplete }) => {
  const [step, setStep] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const isMobile = useIsMobile();
  const requestLink = `https://www.wynflow.co.nz/request/${business?.id || ""}`;

  // Animated pulsing click indicator
  const ClickPulse = ({ top, left, delay = 0, label }) => (
    <div style={{ position: "absolute", top, left, zIndex: 5, pointerEvents: "none", animation: `onb-click-appear 0.4s ${delay}s ease both` }}>
      <div style={{ position: "relative" }}>
        <div style={{ width: 24, height: 24, borderRadius: 12, background: "rgba(20,184,166,0.35)", border: "2px solid #14B8A6", animation: "onb-pulse 1.5s ease-in-out infinite", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: "#14B8A6" }} />
        </div>
        {label && <div style={{ position: "absolute", top: -24, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: 10, fontWeight: 700, color: "#14B8A6", background: "rgba(20,184,166,0.12)", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(20,184,166,0.2)" }}>{label}</div>}
      </div>
    </div>
  );

  // Mini mock sidebar for desktop demos
  const MockSidebar = ({ activeId }) => (
    <div style={{ width: 56, background: "rgba(255,255,255,0.02)", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", gap: 4 }}>
      {[
        { id: "dashboard", icon: LayoutDashboard },
        { id: "quotes", icon: FileText },
        { id: "invoices", icon: Receipt },
        { id: "analytics", icon: BarChart3 },
        { id: "sequences", icon: RefreshCw },
        { id: "settings", icon: SettingsIcon },
      ].map(item => (
        <div key={item.id} style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: item.id === activeId ? "rgba(20,184,166,0.1)" : "transparent", transition: "all 0.3s" }}>
          <item.icon size={16} color={item.id === activeId ? "#14B8A6" : "rgba(255,255,255,0.25)"} strokeWidth={item.id === activeId ? 2.2 : 1.5} />
        </div>
      ))}
    </div>
  );

  // Mock screen wrapper for animated demos
  const MockScreen = ({ children, activeNav, style: extraStyle }) => (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(10,14,23,0.9)", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", position: "relative", ...extraStyle }}>
      <div style={{ padding: "6px 12px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: 4, background: "#EF4444", opacity: 0.7 }} />
        <div style={{ width: 8, height: 8, borderRadius: 4, background: "#F59E0B", opacity: 0.7 }} />
        <div style={{ width: 8, height: 8, borderRadius: 4, background: "#22C55E", opacity: 0.7 }} />
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginLeft: 8, fontFamily: "monospace" }}>wynflow.co.nz</span>
      </div>
      <div style={{ display: "flex", minHeight: isMobile ? 160 : 200 }}>
        {!isMobile && activeNav && <MockSidebar activeId={activeNav} />}
        <div style={{ flex: 1, padding: 16, position: "relative", overflow: "hidden" }}>
          {children}
        </div>
      </div>
    </div>
  );

  const steps = [
    // 0 — Welcome — emphasis on getting started immediately
    {
      icon: Sparkles, iconBg: "rgba(20,184,166,0.15)", iconColor: "#14B8A6",
      title: `Welcome, ${(business?.contact_name || "").split(" ")[0] || "legend"}`,
      subtitle: "You're ready to send your first quote",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 15, color: theme.textMuted, lineHeight: 1.7, margin: 0 }}>
            Wynflow lets you create a professional AI quote in under a minute — no setup needed. Just add your customer, snap some photos, and hit send.
          </p>
          {/* Animated flow diagram */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: isMobile ? 8 : 12, padding: "20px 0" }}>
            {[
              { icon: Camera, label: "Photos", color: "#14B8A6", delay: 0 },
              { icon: Cpu, label: "AI Quote", color: "#3B82F6", delay: 0.2 },
              { icon: Send, label: "Send", color: "#8B5CF6", delay: 0.4 },
              { icon: RefreshCw, label: "Follow-Up", color: "#F59E0B", delay: 0.6 },
              { icon: CheckCircle2, label: "Won", color: "#22C55E", delay: 0.8 },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 8 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, animation: `onb-step-in 0.5s ${item.delay}s ease both` }}>
                  <div style={{ width: isMobile ? 40 : 48, height: isMobile ? 40 : 48, borderRadius: 12, background: item.color + "15", border: `1px solid ${item.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <item.icon size={isMobile ? 18 : 20} color={item.color} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: item.color, letterSpacing: "0.02em" }}>{item.label}</span>
                </div>
                {i < 4 && <div style={{ width: isMobile ? 12 : 20, height: 2, background: `linear-gradient(90deg, ${item.color}40, ${[
                  "#3B82F6", "#8B5CF6", "#F59E0B", "#22C55E"
                ][i]}40)`, borderRadius: 1, marginBottom: 18, animation: `onb-line-in 0.3s ${item.delay + 0.3}s ease both` }} />}
              </div>
            ))}
          </div>
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.12)", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: theme.accent, margin: 0, fontWeight: 500 }}>No pricing setup required — create your first quote right now</p>
          </div>
        </div>
      ),
    },
    // 1 — Create your first AI quote
    {
      icon: Cpu, iconBg: "rgba(20,184,166,0.15)", iconColor: "#14B8A6",
      title: "Create Your First Quote",
      subtitle: "Customer details + photos = done",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <MockScreen activeNav="quotes">
            {/* Mock form fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ animation: `onb-card-in 0.3s 0.1s ease both` }}>
                <div style={{ fontSize: 9, color: theme.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Customer Name</div>
                <div style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, color: theme.text }}>
                  <span style={{ animation: "onb-typing 2s 0.5s steps(12) both", overflow: "hidden", whiteSpace: "nowrap", display: "inline-block", width: 0 }}>Sarah Johnson</span>
                </div>
              </div>
              <div style={{ animation: `onb-card-in 0.3s 0.3s ease both` }}>
                <div style={{ fontSize: 9, color: theme.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Job Title</div>
                <div style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, color: theme.text }}>
                  <span style={{ animation: "onb-typing 2s 1s steps(16) both", overflow: "hidden", whiteSpace: "nowrap", display: "inline-block", width: 0 }}>Bathroom renovation</span>
                </div>
              </div>
              {/* Mock photo upload area */}
              <div style={{ display: "flex", gap: 6, marginTop: 4, animation: `onb-card-in 0.3s 0.5s ease both` }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ width: 40, height: 40, borderRadius: 6, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)", display: "flex", alignItems: "center", justifyContent: "center", animation: `onb-photo-pop 0.3s ${1.5 + i * 0.2}s ease both`, opacity: 0 }}>
                    <Camera size={14} color="rgba(20,184,166,0.5)" />
                  </div>
                ))}
                <div style={{ width: 40, height: 40, borderRadius: 6, border: "1px dashed rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  <Upload size={14} color={theme.textDim} />
                  <ClickPulse top={-4} left={-4} delay={2} label="Add photos" />
                </div>
              </div>
              {/* Generate button */}
              <div style={{ marginTop: 8, padding: "8px 16px", borderRadius: 8, background: "rgba(20,184,166,0.15)", border: "1px solid rgba(20,184,166,0.25)", display: "inline-flex", alignItems: "center", gap: 6, animation: `onb-card-in 0.4s 0.7s ease both`, position: "relative", alignSelf: "flex-start" }}>
                <Cpu size={13} color="#14B8A6" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#14B8A6" }}>Generate Quote</span>
                <ClickPulse top={-4} left="50%" delay={2.8} label="AI does the rest" />
              </div>
            </div>
          </MockScreen>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { num: "1", text: "Enter customer details" },
              { num: "2", text: "Upload site photos" },
              { num: "3", text: "AI generates the quote" },
              { num: "4", text: "Review, edit & send" },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center", padding: "8px 4px" }}>
                <div style={{ width: 22, height: 22, borderRadius: 11, background: "rgba(20,184,166,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px", fontSize: 11, fontWeight: 700, color: theme.accent }}>{s.num}</div>
                <div style={{ fontSize: 10, color: theme.textMuted, lineHeight: 1.4 }}>{s.text}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.5, margin: 0, textAlign: "center" }}>
            The AI will estimate pricing based on your trade. You can always edit the quote before sending.
          </p>
        </div>
      ),
    },
    // 2 — See the generated quote
    {
      icon: FileText, iconBg: "rgba(59,130,246,0.15)", iconColor: "#3B82F6",
      title: "Your Quote, Ready to Go",
      subtitle: "AI builds a full professional quote for you",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Mock generated quote document */}
          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <div style={{ padding: isMobile ? "14px 16px" : "20px 24px" }}>
              {/* Quote header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, animation: `onb-card-in 0.3s 0.2s ease both` }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0A0E17" }}>{business?.business_name || "Your Business"}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{business?.phone || "021 123 4567"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 1 }}>Quote</div>
                  <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}</div>
                </div>
              </div>
              <div style={{ height: 2, background: "#14B8A6", borderRadius: 1, marginBottom: 14, animation: `onb-line-in 0.4s 0.4s ease both` }} />
              {/* Customer + Job */}
              <div style={{ marginBottom: 12, animation: `onb-card-in 0.3s 0.5s ease both` }}>
                <div style={{ fontSize: 9, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5, marginBottom: 3 }}>Prepared For</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>Sarah Johnson</div>
              </div>
              <div style={{ marginBottom: 12, animation: `onb-card-in 0.3s 0.6s ease both` }}>
                <div style={{ fontSize: 9, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5, marginBottom: 3 }}>Job</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Bathroom renovation</div>
              </div>
              {/* Scope */}
              <div style={{ marginBottom: 12, animation: `onb-card-in 0.3s 0.7s ease both` }}>
                <div style={{ fontSize: 9, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5, marginBottom: 3 }}>Scope of Work</div>
                <div style={{ fontSize: 10, color: "#374151", lineHeight: 1.6 }}>Remove existing shower, retile walls and floor, install new mixer and vanity unit, waterproof membrane...</div>
              </div>
              {/* Line items */}
              <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 12px", marginBottom: 12, animation: `onb-card-in 0.3s 0.9s ease both` }}>
                {[
                  { item: "Tiles (floor & walls)", price: "$680" },
                  { item: "Vanity unit + basin", price: "$520" },
                  { item: "Labour (16 hrs)", price: "$1,250" },
                ].map((row, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: i < 2 ? "1px solid #e5e7eb" : "none" }}>
                    <span style={{ fontSize: 10, color: "#6b7280" }}>{row.item}</span>
                    <span style={{ fontSize: 10, color: "#111827", fontWeight: 600 }}>{row.price}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, marginTop: 6, borderTop: "2px solid #111827" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Total</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#14B8A6" }}>$2,450</span>
                </div>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.5, margin: 0, textAlign: "center" }}>
            The AI breaks down scope, materials, and labour into a professional quote. <strong style={{ color: theme.text }}>Edit anything you like</strong> — it's fully customisable.
          </p>
        </div>
      ),
    },
    // 3 — Happy? Hit send
    {
      icon: Send, iconBg: "rgba(139,92,246,0.15)", iconColor: "#8B5CF6",
      title: "Happy? Hit Send",
      subtitle: "Once you're happy with the quote, send it off",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <MockScreen activeNav="quotes">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Mock quote summary */}
              <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", animation: `onb-card-in 0.3s 0.2s ease both` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: theme.text }}>Bathroom renovation</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: theme.accent }}>$2,450</span>
                </div>
                <div style={{ fontSize: 10, color: theme.textDim }}>Sarah Johnson · 3 line items</div>
              </div>
              {/* Mock send button */}
              <div style={{ display: "flex", gap: 8, animation: `onb-card-in 0.3s 0.5s ease both` }}>
                <div style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                  <Eye size={12} color={theme.textMuted} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted }}>Preview</span>
                </div>
                <div style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "rgba(20,184,166,0.15)", border: "1px solid rgba(20,184,166,0.25)", display: "flex", alignItems: "center", gap: 6, justifyContent: "center", position: "relative", animation: "onb-glow-btn 2s 1s ease-in-out infinite" }}>
                  <Send size={12} color="#14B8A6" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#14B8A6" }}>Send Quote</span>
                  <ClickPulse top={-4} left={-4} delay={1.5} label="Send it!" />
                </div>
              </div>
              {/* What happens next */}
              <div style={{ marginTop: 6, padding: "8px 10px", borderRadius: 8, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.1)", animation: `onb-card-in 0.3s 0.8s ease both` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={12} color="#22C55E" />
                  <span style={{ fontSize: 10, color: "#22C55E", fontWeight: 600 }}>Customer gets a professional email with your quote attached</span>
                </div>
              </div>
            </div>
          </MockScreen>
          {/* Follow-up teaser */}
          <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <RefreshCw size={14} color="#3B82F6" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#3B82F6" }}>Then follow-ups kick in automatically</span>
            </div>
            <p style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.5, margin: 0 }}>
              If the customer doesn't respond, Wynflow sends friendly follow-up emails on your behalf — Day 2, Day 5, Day 10. No chasing needed.
            </p>
          </div>
        </div>
      ),
    },
    // 3 — Share your quote request link
    {
      icon: Link, iconBg: "rgba(34,197,94,0.15)", iconColor: "#22C55E",
      title: "Your Quote Request Link",
      subtitle: "Let customers come to you",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.6, margin: 0 }}>
            Share this link anywhere — customers fill in their details and the request lands straight in your dashboard.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: theme.accent, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {requestLink}
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(requestLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
              style={{ padding: "12px 16px", borderRadius: 10, background: linkCopied ? "rgba(34,197,94,0.15)" : "rgba(20,184,166,0.12)", border: `1px solid ${linkCopied ? "rgba(34,197,94,0.2)" : "rgba(20,184,166,0.2)"}`, color: linkCopied ? "#22C55E" : theme.accent, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: theme.font, display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s", flexShrink: 0 }}
            >
              {linkCopied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>
          <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#22C55E", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Where to share it</div>
            {[
              { label: "Google Business", tip: "Add as your booking link" },
              { label: "Facebook & Instagram", tip: "Pop it in your bio" },
              { label: "Your website", tip: "Add a 'Request a Quote' button" },
              { label: "Email signature", tip: "Add to your footer" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none", animation: `onb-card-in 0.3s ${i * 0.1}s ease both` }}>
                <ArrowRight size={11} color={theme.textDim} />
                <span style={{ fontSize: 13, color: theme.text }}><strong>{item.label}</strong> — <span style={{ color: theme.textMuted }}>{item.tip}</span></span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  const s = steps[step];
  const isLast = step === steps.length - 1;
  const Icon = s.icon;

  const goNext = () => {
    if (isLast) {
      dispatch({ type: "SET_SCREEN", payload: "aiQuote" });
      onComplete();
    } else {
      setStep(step + 1);
      setAnimKey(prev => prev + 1);
    }
  };

  const goBack = () => {
    setStep(step - 1);
    setAnimKey(prev => prev + 1);
  };

  // Onboarding animation keyframes
  const onbStyles = `
    @keyframes onb-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.6); opacity: 0.4; } }
    @keyframes onb-click-appear { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: scale(1); } }
    @keyframes onb-step-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes onb-line-in { from { opacity: 0; width: 0; } to { opacity: 1; } }
    @keyframes onb-card-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes onb-typing { from { width: 0; } to { width: 100%; } }
    @keyframes onb-photo-pop { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
    @keyframes onb-dot-pop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
    @keyframes onb-timeline-fill { from { height: 0; } to { height: 100%; } }
    @keyframes onb-glow-btn { 0%, 100% { box-shadow: 0 0 0 rgba(20,184,166,0); } 50% { box-shadow: 0 0 16px rgba(20,184,166,0.25); } }
    @keyframes onb-slide-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
  `;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? 12 : 20, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
      <style>{onbStyles}</style>
      <div style={{ width: "100%", maxWidth: 560, background: "rgba(17,24,39,0.97)", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.1)" }}>

        {/* Header */}
        <div style={{ padding: isMobile ? "24px 20px 16px" : "32px 36px 20px", background: "linear-gradient(180deg, rgba(20,184,166,0.06) 0%, transparent 100%)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div key={step} style={{ width: 48, height: 48, borderRadius: 14, background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, animation: "onb-step-in 0.3s ease" }}>
              <Icon size={24} color={s.iconColor} />
            </div>
            <div key={`txt-${step}`} style={{ animation: "onb-slide-in 0.3s ease" }}>
              <h2 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontDisplay, lineHeight: 1.2 }}>{s.title}</h2>
              <p style={{ fontSize: 13, color: theme.textMuted, margin: "4px 0 0", fontWeight: 500 }}>{s.subtitle}</p>
            </div>
          </div>
          {/* Progress dots */}
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            {steps.map((_, i) => (
              <div key={i} onClick={() => { setStep(i); setAnimKey(prev => prev + 1); }} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, background: i === step ? theme.accent : i < step ? "rgba(20,184,166,0.4)" : "rgba(255,255,255,0.08)", transition: "all 0.3s ease", cursor: "pointer" }} />
            ))}
          </div>
        </div>

        {/* Content */}
        <div key={animKey} style={{ padding: isMobile ? "8px 20px 20px" : "8px 36px 28px", maxHeight: isMobile ? "52vh" : "48vh", overflowY: "auto", animation: "onb-slide-in 0.35s ease" }}>
          {s.content}
        </div>

        {/* Footer */}
        <div style={{ padding: isMobile ? "0 20px 20px" : "0 36px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 10 }}>
            {step > 0 && (
              <button onClick={goBack}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                style={{ flex: 1, padding: "14px 20px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: theme.textMuted, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: theme.font, transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <ChevronLeft size={16} /> Back
              </button>
            )}
            <button onClick={goNext}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.02)"; if (isLast) e.currentTarget.style.boxShadow = "0 0 32px rgba(20,184,166,0.35)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; if (isLast) e.currentTarget.style.boxShadow = "0 0 20px rgba(20,184,166,0.25)"; }}
              onMouseDown={e => { e.currentTarget.style.transform = "scale(0.97)"; }}
              onMouseUp={e => { e.currentTarget.style.transform = "scale(1.02)"; }}
              style={{ flex: step > 0 ? 2 : 1, padding: "14px 20px", borderRadius: 12, background: isLast ? theme.accent : "rgba(20,184,166,0.15)", border: `1px solid ${isLast ? theme.accent : "rgba(20,184,166,0.25)"}`, color: isLast ? "#000" : theme.accent, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: theme.font, transition: "all 0.2s", boxShadow: isLast ? "0 0 20px rgba(20,184,166,0.25)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {isLast ? <><Cpu size={16} /> Create My First Quote</> : <>Next <ArrowRight size={15} /></>}
            </button>
          </div>
          {!isLast && (
            <div style={{ textAlign: "center" }}>
              <span onClick={onComplete} style={{ fontSize: 12, color: theme.textDim, cursor: "pointer", transition: "color 0.2s" }}
                onMouseEnter={e => e.target.style.color = theme.textMuted} onMouseLeave={e => e.target.style.color = theme.textDim}>
                Skip for now
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main App ───
// ✅ FIX: useIsMobile() is now called at the TOP of WynflowApp,
//    before any conditional returns, to comply with React's Rules of Hooks.
function WynflowAppInner() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { user, business, screen, quotes, sequences, invoices, jobs, notification, loading } = state;

  // Update global error context
  if (typeof window !== "undefined") {
    window.__wynflow_screen = screen;
    window.__wynflow_user_email = business?.email || user?.email || "";
    window.__wynflow_business_id = business?.id || "";
  }

  // ✅ ALL hooks must be called before any conditional returns
  const isMobile = useIsMobile();
  useSEO(screen);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [sessionReady, setSessionReady] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);

  const loadData = useCallback(async (force = false) => {
    if (!business || !sessionReady) return;
    if (!business.id) return;
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const [quotesRes, seqRes, invoicesRes, jobsRes] = await Promise.all([
        db("quotes").eq("business_id", business.id).order("created_at", { ascending: false }).select(),
        db("follow_up_sequences").eq("business_id", business.id).select(),
        db("invoices").eq("business_id", business.id).order("created_at", { ascending: false }).select(),
        db("jobs").eq("business_id", business.id).order("starts_at", { ascending: true }).select(),
      ]);
      if (quotesRes.data) dispatch({ type: "SET_QUOTES", payload: quotesRes.data });
      if (seqRes.data) dispatch({ type: "SET_SEQUENCES", payload: seqRes.data });
      if (invoicesRes.data) dispatch({ type: "SET_INVOICES", payload: invoicesRes.data });
      if (jobsRes.data) dispatch({ type: "SET_JOBS", payload: jobsRes.data });
      setDataLoaded(true);
    } catch (err) {
      reportError(err, "load_dashboard_data");
      dispatch({ type: "NOTIFY", payload: { message: "Failed to load data. Please refresh.", type: "error" } });
    }
    dispatch({ type: "SET_LOADING", payload: false });
  }, [business?.id, sessionReady]);

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
    // Handle email confirmation callback — create business profile from stored signup data
    if (hash && hash.includes("type=signup")) {
      const params = new URLSearchParams(hash.replace("#", ""));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      if (accessToken) {
        supabase.token = accessToken;
        window.history.replaceState(null, "", "/");
        (async () => {
          try {
            const user = await supabase.auth_getUser();
            if (!user) return;
            supabase.user = user;
            // Check if business already exists
            const { data: existingBiz } = await db("businesses").eq("user_id", user.id).single().select();
            if (existingBiz) {
              dispatch({ type: "SET_USER", payload: user });
              dispatch({ type: "SET_BUSINESS", payload: existingBiz });
              setCookie("wynflow_token", accessToken, 43200);
              if (refreshToken) setCookie("wynflow_refresh", refreshToken, 43200);
              setCookie("wynflow_user", user, 43200);
              setCookie("wynflow_business", existingBiz, 43200);
              dispatch({ type: "NOTIFY", payload: { message: "Email verified! Welcome to Wynflow.", type: "success" } });
              dispatch({ type: "SET_SCREEN", payload: "dashboard" });
              return;
            }
            // Create business from pending signup data
            let pending = {};
            try { pending = JSON.parse(localStorage.getItem("wynflow_pending_signup") || "{}"); } catch(e) {}
            const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
            const { data: biz } = await db("businesses").insert({
              user_id: user.id,
              business_name: pending.businessName || "My Business",
              contact_name: pending.contactName || "",
              email: user.email || pending.email || "",
              phone: pending.phone || "",
              trade: pending.trade || null,
              trade_category: pending.trade || null,
              hourly_rate: parseFloat(pending.hourlyRate) || 0,
              callout_fee: parseFloat(pending.calloutFee) || 0,
              subscription_status: "trialing",
              trial_ends_at: trialEnd,
              auto_follow_ups: pending.autoFollowUps !== false,
              materials_margin: Math.max(0, Math.min(200, parseFloat(pending.materialsMargin) || 0)),
            });
            const bizRecord = biz && biz[0];
            if (bizRecord) {
              // Create default follow-up sequence
              const { data: seq } = await db("follow_up_sequences").insert({ business_id: bizRecord.id, name: "Standard Follow-Up", is_active: true, is_default: true });
              if (seq && seq[0]) {
                await db("sequence_steps").insert([
                  { sequence_id: seq[0].id, step_order: 1, delay_days: 2, email_subject: "Following up on your quote", email_body: "Hi {name}, just checking in on the quote I sent through for {job}. Happy to answer any questions. Cheers, {business_name}" },
                  { sequence_id: seq[0].id, step_order: 2, delay_days: 5, email_subject: "Any questions about your quote?", email_body: "Hey {name}, wanted to make sure you received the quote for {job}. Let me know if you'd like to go ahead or if anything needs adjusting. Cheers, {business_name}" },
                  { sequence_id: seq[0].id, step_order: 3, delay_days: 10, email_subject: "Last chance — your quote for {job}", email_body: "Hi {name}, just a final follow-up on your quote for {job} (${amount}). This quote will expire in 5 days. Let me know either way! Cheers, {business_name}" },
                ]);
              }
              dispatch({ type: "SET_USER", payload: user });
              dispatch({ type: "SET_BUSINESS", payload: bizRecord });
              setCookie("wynflow_token", accessToken, 43200);
              if (refreshToken) setCookie("wynflow_refresh", refreshToken, 43200);
              setCookie("wynflow_user", user, 43200);
              setCookie("wynflow_business", bizRecord, 43200);
              try { localStorage.removeItem("wynflow_pending_signup"); } catch(e) {}
              dispatch({ type: "NOTIFY", payload: { message: "Email verified! Welcome to Wynflow.", type: "success" } });
              dispatch({ type: "SET_SCREEN", payload: "dashboard" });
            } else {
              dispatch({ type: "NOTIFY", payload: { message: "Account setup failed — please sign in and try again, or contact support.", type: "error" } });
              dispatch({ type: "SET_SCREEN", payload: "login" });
            }
          } catch(err) {
            dispatch({ type: "NOTIFY", payload: { message: "Email verified! Please sign in to continue.", type: "success" } });
            dispatch({ type: "SET_SCREEN", payload: "login" });
          }
        })();
        return;
      }
    }

    const path = window.location.pathname.replace(/^\//, "").toLowerCase();
    if (path === "success") {
      dispatch({ type: "SET_SCREEN", payload: "paymentSuccess" });
      // Still continue to restore session below so business data loads
    }
    if (path.startsWith("request/")) {
      const bizId = window.location.pathname.split("/request/")[1];
      if (bizId) dispatch({ type: "SET_SCREEN", payload: "requestQuote:" + bizId });
      return;
    }
    const savedToken = getCookie("wynflow_token");
    const savedUser = getCookie("wynflow_user");
    const savedBusiness = getCookie("wynflow_business");
    const savedRefresh = getCookie("wynflow_refresh");
    if (savedToken && savedUser && savedBusiness) {
      supabase.token = savedToken;
      supabase.user = savedUser;
      setSessionReady(false); // Gate loadData until token is validated
      dispatch({ type: "SET_USER", payload: savedUser });
      dispatch({ type: "SET_BUSINESS", payload: savedBusiness });
      // Validate token is still valid — if expired, try refreshing
      supabase.auth_getUser().then(async (res) => {
        if (!res && savedRefresh) {
          // Access token expired — use refresh token to get a new one
          const refreshed = await supabase.auth_refreshSession(savedRefresh);
          if (refreshed && refreshed.access_token) {
            // Fetch fresh business data with the new token
            const { data: freshBiz } = await db("businesses").eq("user_id", refreshed.user.id).single().select();
            const bizData = freshBiz || savedBusiness;
            setCookie("wynflow_token", refreshed.access_token, 43200);
            if (refreshed.refresh_token) setCookie("wynflow_refresh", refreshed.refresh_token, 43200);
            setCookie("wynflow_user", refreshed.user, 43200);
            setCookie("wynflow_business", bizData, 43200);
            dispatch({ type: "SET_USER", payload: refreshed.user });
            dispatch({ type: "SET_BUSINESS", payload: bizData });
            setSessionReady(true);
          } else {
            supabase.token = null;
            supabase.user = null;
            clearCookies();
            dispatch({ type: "LOGOUT" });
          }
        } else if (!res) {
          supabase.token = null;
          supabase.user = null;
          clearCookies();
          dispatch({ type: "LOGOUT" });
        } else {
          // Token still valid — fetch fresh business data from DB
          const { data: freshBiz } = await db("businesses").eq("user_id", savedUser.id).single().select();
          const bizData = freshBiz || savedBusiness;
          setCookie("wynflow_token", savedToken, 43200);
          setCookie("wynflow_refresh", savedRefresh, 43200);
          setCookie("wynflow_user", savedUser, 43200);
          setCookie("wynflow_business", bizData, 43200);
          dispatch({ type: "SET_BUSINESS", payload: bizData });
          setSessionReady(true);
        }
      }).catch(() => {
        // Token validation failed — still allow dashboard with cached data
        setSessionReady(true);
      });
    } else {
      const routes = { "about": "about", "pricing": "pricing", "login": "login", "signup": "signup" };
      if (routes[path]) {
        dispatch({ type: "SET_SCREEN", payload: routes[path] });
      }
    }
    // Also handle public page routes for logged-in users
    const publicRoutes = { "about": "about", "pricing": "pricing" };
    if (publicRoutes[path]) {
      dispatch({ type: "SET_SCREEN", payload: publicRoutes[path] });
    }
  }, []);

  useEffect(() => {
    const publicPages = { home: "/", about: "/about", pricing: "/pricing" };
    if (publicPages[screen] !== undefined && !business) {
      window.history.replaceState(null, "", publicPages[screen]);
    }
  }, [screen, business]);

  // Load data whenever business/session becomes ready, or hasn't loaded yet
  useEffect(() => {
    if (business?.id && sessionReady && !dataLoaded) {
      loadData();
    }
  }, [business?.id, sessionReady, dataLoaded, loadData]);

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
    if (business && (screen === "dashboard" || screen === "quotes" || screen === "invoices")) {
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
    @keyframes slideInRight { from{transform:translateX(100%)} to{transform:translateX(0)} }
    @keyframes spin { to{transform:rotate(360deg)} }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    @keyframes successPop { 0%{transform:scale(0.5);opacity:0} 100%{transform:scale(1);opacity:1} }
    @media (max-width: 767px) {
      .mobile-stack { grid-template-columns: 1fr !important; }
      .mobile-hide { display: none !important; }
      .mobile-full { grid-column: 1 / -1 !important; }
      body { -webkit-text-size-adjust: 100%; }
      input, textarea, select { font-size: 16px !important; }
    }
    .rbc-calendar { background: transparent; font-family: 'DM Sans', sans-serif; color: #F1F3F7; }
    .rbc-toolbar { margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
    .rbc-toolbar button { color: #8B95A8; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 6px 14px; font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
    .rbc-toolbar button:hover { background: rgba(255,255,255,0.08); color: #F1F3F7; }
    .rbc-toolbar button.rbc-active { background: rgba(20,184,166,0.15); color: #14B8A6; border-color: rgba(20,184,166,0.3); }
    .rbc-header { background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.06); color: #8B95A8; font-weight: 500; font-size: 13px; padding: 8px 4px; }
    .rbc-time-view, .rbc-month-view { background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; overflow: hidden; }
    .rbc-time-header { border-bottom: 1px solid rgba(255,255,255,0.06); }
    .rbc-time-content { border-top: none; }
    .rbc-time-slot { border-top: 1px solid rgba(255,255,255,0.03); min-height: 28px; }
    .rbc-timeslot-group { border-bottom: 1px solid rgba(255,255,255,0.06); }
    .rbc-day-slot .rbc-time-slot { border-top-color: rgba(255,255,255,0.03); }
    .rbc-current-time-indicator { background-color: #14B8A6; height: 2px; }
    .rbc-today { background: rgba(20,184,166,0.03); }
    .rbc-off-range-bg { background: rgba(0,0,0,0.15); }
    .rbc-event { border: none !important; border-radius: 6px; padding: 2px 6px; font-size: 12px; cursor: pointer; }
    .rbc-event-label { font-size: 11px; color: rgba(255,255,255,0.7); }
    .rbc-event-content { font-weight: 500; }
    .rbc-addons-dnd .rbc-addons-dnd-resize-ns-icon { display: none; }
    .rbc-addons-dnd .rbc-addons-dnd-resizable { border-bottom: 3px solid rgba(255,255,255,0.3); }
    .rbc-allday-cell { min-height: 30px; }
    .rbc-time-gutter .rbc-label { color: #5C6578; font-size: 11px; padding: 0 8px; }
    .rbc-show-more { color: #14B8A6; font-size: 12px; }
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

  if (screen === "resetPassword") {
    return (
      <>
        <style>{globalStyles}</style>
        {notification && <Toast message={notification.message} type={notification.type} onClose={() => dispatch({ type: "CLEAR_NOTIFY" })} />}
        <ResetPasswordScreen dispatch={dispatch} />
      </>
    );
  }

  if (screen === "paymentSuccess") {
    return (
      <>
        <style>{globalStyles}</style>
        {notification && <Toast message={notification.message} type={notification.type} onClose={() => dispatch({ type: "CLEAR_NOTIFY" })} />}
        <PaymentSuccess dispatch={dispatch} business={business} />
      </>
    );
  }

  if (screen === "login" || activeScreen === "signup") {
    return (
      <>
        <style>{globalStyles}</style>
        {notification && <Toast message={notification.message} type={notification.type} onClose={() => dispatch({ type: "CLEAR_NOTIFY" })} />}
        <AuthScreen dispatch={dispatch} isSignup={activeScreen === "signup"} plan={detailId || "starter"} />
      </>
    );
  }

  if (!business) {
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

  // Trial paywall — blocks access when trial has expired
  if (isTrialExpired(business)) {
    return (
      <>
        <style>{globalStyles}</style>
        {notification && <Toast message={notification.message} type={notification.type} onClose={() => dispatch({ type: "CLEAR_NOTIFY" })} />}
        <TrialPaywall business={business} dispatch={dispatch} />
      </>
    );
  }

  const renderContent = () => {
    if (loading) return <Spinner />;
    switch (activeScreen) {
      case "dashboard": return <Dashboard quotes={quotes} dispatch={dispatch} invoices={invoices} />;
      case "quotes": return <QuotesList quotes={quotes} dispatch={dispatch} sequences={sequences} invoices={invoices} />;
      case "analytics": return <Analytics quotes={quotes} invoices={invoices} />;
      case "schedule": return <ScheduleView jobs={jobs} dispatch={dispatch} business={business} quotes={quotes} focusDate={detailId} />;
      case "newQuote": return <NewQuoteForm dispatch={dispatch} business={business} sequences={sequences} />;
      case "aiQuote": return <AIQuoteForm dispatch={dispatch} business={business} sequences={sequences} quotes={quotes} />;
      case "sequences": return <SequencesManager sequences={sequences} business={business} dispatch={dispatch} />;
      case "quoteDetail": return <QuoteDetail quoteId={detailId} quotes={quotes} sequences={sequences} dispatch={dispatch} business={business} invoices={invoices} />;
      case "invoices": return <InvoicesList invoices={invoices} dispatch={dispatch} quotes={quotes} business={business} />;
      case "createInvoice": return <CreateInvoiceForm dispatch={dispatch} business={business} quotes={quotes} sequences={sequences} invoices={invoices} quoteId={detailId} />;
      case "editInvoice": return <CreateInvoiceForm dispatch={dispatch} business={business} quotes={quotes} sequences={sequences} invoices={invoices} editInvoice={invoices.find(i => i.id === detailId)} />;
      case "invoiceDetail": return <InvoiceDetail invoiceId={detailId} invoices={invoices} business={business} dispatch={dispatch} sequences={sequences} quotes={quotes} />;
      case "help": return <HelpCentre />;
      case "historicalQuotes": return <HistoricalQuotes business={business} dispatch={dispatch} quotes={quotes} />;
      case "settings": return <Settings business={business} dispatch={dispatch} />;
      default: return <Dashboard quotes={quotes} dispatch={dispatch} invoices={invoices} />;
    }
  };

  return (
    <>
      <style>{globalStyles}</style>
      {notification && <Toast message={notification.message} type={notification.type} onClose={() => dispatch({ type: "CLEAR_NOTIFY" })} />}
      {showOnboarding && <OnboardingTutorial business={business} dispatch={dispatch} onComplete={() => { setShowOnboarding(false); try { localStorage.setItem("wynflow_onboarded_" + business.id, "true"); } catch(e) {} setCookie("wynflow_onboarded", "true", 525600); }} />}
      <div style={{ display: "flex", height: "100vh", fontFamily: theme.font, color: "#F1F3F7", background: theme.bg, overflow: "hidden", flexDirection: isMobile ? "column" : "row" }}>
        <Sidebar screen={activeScreen} dispatch={dispatch} business={business} />
        <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "56px 14px 90px" : "28px 36px", WebkitOverflowScrolling: "touch" }}>
          <TrialBanner business={business} />
          {renderContent()}
        </div>
      </div>
    </>
  );
}

export default function WynflowApp() {
  return (
    <ErrorBoundary>
      <WynflowAppInner />
    </ErrorBoundary>
  );
}
