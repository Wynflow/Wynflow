# Onboarding Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 onboarding issues — simplify signup, convert tutorial into interactive setup wizard, fix cross-device data loss, device-independent onboarding flag, empty dashboard guidance, and AI quote generation guards.

**Architecture:** Modify existing AuthScreen, OnboardingTutorial, Dashboard, and AI quote components in the single-file App.jsx. Add one DB migration for the `onboarded` column. The OnboardingTutorial is rewritten from a passive walkthrough into a 4-step interactive wizard that saves real data.

**Tech Stack:** React 19, Supabase (custom REST client), inline styles, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-03-23-onboarding-fixes-design.md`

**Important context:**
- Entire app is `src/App.jsx` (~9900+ lines). All components live here.
- No test framework. Verification is manual.
- The `Input` component's `onChange` passes the VALUE directly (not an event). Use `onChange={setFoo}` or `onChange={(val) => ...}`.
- The `db()` query builder `.insert()` returns `{ data, error }` with `data` as an array. It does NOT support `.select()` chaining after `.insert()`.
- `setCookie(name, value, minutes)` and `getCookie(name)` are helper functions available globally.

---

### Task 1: Database Migration — Add `onboarded` Column

**Files:**
- Create: `supabase/migrations/009_add_onboarded_column.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Add onboarded flag to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS onboarded boolean DEFAULT false;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/009_add_onboarded_column.sql
git commit -m "feat: add onboarded column to businesses table"
```

---

### Task 2: Simplify Signup Form

**Files:**
- Modify: `src/App.jsx` — AuthScreen component (~line 2613-2908)

- [ ] **Step 1: Remove state variables for removed fields**

Find lines 2621-2624 in AuthScreen. Remove these useState declarations:
```javascript
const [hourlyRate, setHourlyRate] = useState("");
const [calloutFee, setCalloutFee] = useState("");
const [autoFollowUps, setAutoFollowUps] = useState(true);
const [materialsMargin, setMaterialsMargin] = useState("");
```

- [ ] **Step 2: Remove form fields from the JSX**

Find the signup-only fields section (~line 2833-2868). Remove:
- The hourly rate + callout fee row (lines 2846-2849): `<div style={{ display: "flex"...` containing both inputs
- The materials margin section (lines 2850-2853): Input + helper text
- The auto follow-ups toggle section (lines 2854-2867): entire bordered card with toggle

Keep: Business Name, Your Name, Mobile Number, Trade dropdown.

- [ ] **Step 3: Update pending signup localStorage**

Find line 2668 where `wynflow_pending_signup` is saved. Change from:
```javascript
JSON.stringify({ businessName, contactName, email, phone, trade, hourlyRate, calloutFee, plan, autoFollowUps, materialsMargin })
```
to:
```javascript
JSON.stringify({ businessName, contactName, email, phone, trade, plan })
```

- [ ] **Step 4: Update business insert (instant signup path)**

Find the `db("businesses").insert()` at line 2679. Change the hourly_rate, callout_fee, materials_margin, and auto_follow_ups to use hardcoded defaults:
```javascript
hourly_rate: 0,
callout_fee: 0,
subscription_status: "trialing",
trial_ends_at: trialEnd,
auto_follow_ups: true,
materials_margin: 0,
```

- [ ] **Step 5: Update N8N webhook payloads**

Find the N8N `new-business` webhook calls (~lines 2672-2675 and 2735-2738). Remove `hourly_rate` and `callout_fee` from the payload since they're always 0 now:
```javascript
body: JSON.stringify({ business_name: businessName, contact_name: contactName, email, phone, trade }),
```

- [ ] **Step 6: Update email confirmation business insert**

Find the business insert in the email confirmation handler (~line 9605). Change to use defaults:
```javascript
hourly_rate: 0,
callout_fee: 0,
auto_follow_ups: true,
materials_margin: 0,
```

Remove references to `pending.hourlyRate`, `pending.calloutFee`, `pending.autoFollowUps`, `pending.materialsMargin`.

- [ ] **Step 7: Verify and commit**

```bash
npx vite build 2>&1 | tail -5
git add src/App.jsx
git commit -m "feat: simplify signup form — remove pricing fields"
```

---

### Task 3: Rewrite OnboardingTutorial as Interactive Wizard

**Files:**
- Modify: `src/App.jsx` — OnboardingTutorial component (~line 9113-9515)

This is the biggest task. The entire OnboardingTutorial component is replaced. It keeps the same component signature `({ business, dispatch, onComplete })` and the same modal overlay styling, but the 5 passive steps become 4 interactive steps.

- [ ] **Step 1: Replace the OnboardingTutorial component**

Replace the entire `OnboardingTutorial` function (from `const OnboardingTutorial = ({ business, dispatch, onComplete }) => {` to its closing `};`) with the new wizard. The new component:

```javascript
const OnboardingTutorial = ({ business, dispatch, onComplete }) => {
  const [step, setStep] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(String(business?.hourly_rate || ""));
  const [calloutFee, setCalloutFee] = useState(String(business?.callout_fee || ""));
  const [materialsMargin, setMaterialsMargin] = useState(String(business?.materials_margin || ""));
  const [savingRates, setSavingRates] = useState(false);
  const isMobile = useIsMobile();
  const requestLink = `https://www.wynflow.co.nz/request/${business?.id || ""}`;
  const firstName = (business?.contact_name || "").split(" ")[0] || "legend";

  const saveRates = async () => {
    setSavingRates(true);
    const updates = {};
    if (hourlyRate) updates.hourly_rate = parseFloat(hourlyRate) || 0;
    if (calloutFee) updates.callout_fee = parseFloat(calloutFee) || 0;
    if (materialsMargin) updates.materials_margin = Math.max(0, Math.min(200, parseFloat(materialsMargin) || 0));
    if (Object.keys(updates).length > 0) {
      const { error } = await db("businesses").eq("id", business.id).update(updates);
      if (!error) {
        const updatedBiz = { ...business, ...updates };
        dispatch({ type: "SET_BUSINESS", payload: updatedBiz });
        setCookie("wynflow_business", updatedBiz, 43200);
      }
    }
    setSavingRates(false);
  };

  const handleComplete = async (navigateTo) => {
    // Mark as onboarded in DB
    await db("businesses").eq("id", business.id).update({ onboarded: true });
    const updatedBiz = { ...business, onboarded: true };
    dispatch({ type: "SET_BUSINESS", payload: updatedBiz });
    setCookie("wynflow_business", updatedBiz, 43200);
    // Cache locally too
    try { localStorage.setItem("wynflow_onboarded_" + business.id, "true"); } catch(e) {}
    setCookie("wynflow_onboarded", "true", 525600);
    // Close wizard first, then navigate
    onComplete();
    if (navigateTo) {
      dispatch({ type: "SET_SCREEN", payload: navigateTo });
    }
  };

  const steps = [
    // Step 0: Welcome
    {
      icon: Sparkles, iconBg: "rgba(20,184,166,0.15)", iconColor: "#14B8A6",
      title: `Welcome, ${firstName}!`,
      subtitle: "Let's get you quoting in 2 minutes",
      content: (
        <div>
          <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.7, margin: "0 0 20px" }}>
            Wynflow generates professional quotes from your job site photos using AI — scope, materials, labour, the lot. Then automated follow-ups chase your customers until they say yes.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: isMobile ? 8 : 16, padding: "16px 0", flexWrap: "wrap" }}>
            {[
              { icon: Camera, label: "Photos", delay: "0s" },
              { icon: Cpu, label: "AI Quote", delay: "0.15s" },
              { icon: Send, label: "Send", delay: "0.3s" },
              { icon: RefreshCw, label: "Follow-Up", delay: "0.45s" },
              { icon: CheckCircle2, label: "Won", delay: "0.6s" },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, animation: `onb-step-in 0.4s ${s.delay} ease both` }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(20,184,166,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <s.icon size={20} color={theme.accent} />
                </div>
                <span style={{ fontSize: 11, color: theme.textMuted }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    // Step 1: Your Rates
    {
      icon: DollarSign, iconBg: "rgba(20,184,166,0.15)", iconColor: "#14B8A6",
      title: "Set Your Rates",
      subtitle: "So AI quotes are accurate from day one",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Input label="Hourly Rate ($)" value={hourlyRate} onChange={setHourlyRate} type="number" placeholder="e.g. 85" />
              <div style={{ fontSize: 11, color: theme.textDim, marginTop: 2 }}>Your standard hourly charge</div>
            </div>
            <div style={{ flex: 1 }}>
              <Input label="Callout Fee ($)" value={calloutFee} onChange={setCalloutFee} type="number" placeholder="e.g. 50" />
              <div style={{ fontSize: 11, color: theme.textDim, marginTop: 2 }}>One-off charge for showing up</div>
            </div>
          </div>
          <div>
            <Input label="Materials Markup %" value={materialsMargin} onChange={setMaterialsMargin} type="number" placeholder="e.g. 20" />
            <div style={{ fontSize: 11, color: theme.textDim, marginTop: 2 }}>Applied automatically to material costs in AI quotes</div>
          </div>
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.12)", fontSize: 12, color: theme.textMuted, lineHeight: 1.5 }}>
            You can always change these later in Settings. If you're not sure, skip this step — you can set them before your first quote.
          </div>
        </div>
      ),
    },
    // Step 2: Quote Request Link
    {
      icon: Link, iconBg: "rgba(34,197,94,0.15)", iconColor: "#22C55E",
      title: "Your Quote Request Link",
      subtitle: "Let customers come to you",
      content: (
        <div>
          <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.7, margin: "0 0 16px" }}>
            Share this link anywhere — customers fill in their details and Wynflow notifies you instantly.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 16 }}>
            <span style={{ flex: 1, fontSize: 13, color: theme.accent, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{requestLink}</span>
            <button onClick={() => {
              navigator.clipboard.writeText(requestLink).then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); });
            }} style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", flexShrink: 0,
              background: linkCopied ? theme.green : theme.accent, color: "#fff", fontFamily: theme.font,
              display: "flex", alignItems: "center", gap: 4,
            }}>
              {linkCopied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { title: "Google Business", desc: "Add as your booking link" },
              { title: "Facebook & Instagram", desc: "Pop it in your bio" },
              { title: "Your website", desc: "Add a 'Request a Quote' button" },
              { title: "Email signature", desc: "Add to your footer" },
            ].map((s, i) => (
              <div key={i} style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: theme.text }}>{s.title}</div>
                <div style={{ fontSize: 11, color: theme.textDim, marginTop: 2 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    // Step 3: All Set
    {
      icon: CheckCircle2, iconBg: "rgba(34,197,94,0.15)", iconColor: "#22C55E",
      title: "You're All Set!",
      subtitle: "Time to create your first quote",
      content: (
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.7, margin: "0 0 20px" }}>
            Take some job site photos, add your notes, and let the AI generate a professional quote in seconds. You can edit everything before sending.
          </p>
        </div>
      ),
    },
  ];

  const s = steps[step];
  const Icon = s.icon;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      <style>{`
        @keyframes onb-step-in { from { transform: scale(0.8) translateY(10px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes onb-slide-in { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
      <div style={{
        width: isMobile ? "95%" : 520, maxHeight: "90vh", overflow: "auto",
        background: "rgba(17,24,39,0.98)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20, boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
      }}>
        {/* Header with icon + title */}
        <div style={{ padding: isMobile ? "24px 20px 16px" : "32px 36px 20px", background: "linear-gradient(180deg, rgba(20,184,166,0.06) 0%, transparent 100%)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={24} color={s.iconColor} />
            </div>
            <div>
              <h2 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: theme.text, margin: 0, fontFamily: theme.fontHeading, lineHeight: 1.2 }}>{s.title}</h2>
              <p style={{ fontSize: 13, color: theme.textMuted, margin: "4px 0 0", fontWeight: 500 }}>{s.subtitle}</p>
            </div>
          </div>
          {/* Progress dots */}
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            {steps.map((_, i) => (
              <div key={i} onClick={() => { if (i < step) setStep(i); }}
                style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, background: i === step ? theme.accent : i < step ? "rgba(20,184,166,0.4)" : "rgba(255,255,255,0.08)", transition: "all 0.3s ease", cursor: i < step ? "pointer" : "default" }} />
            ))}
          </div>
        </div>

        {/* Content */}
        <div key={step} style={{ padding: isMobile ? "8px 20px 20px" : "8px 36px 28px", maxHeight: isMobile ? "52vh" : "48vh", overflowY: "auto", animation: "onb-slide-in 0.35s ease" }}>
          {s.content}
        </div>

        {/* Navigation */}
        <div style={{ padding: isMobile ? "0 20px 24px" : "0 36px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 14, fontFamily: theme.font, display: "flex", alignItems: "center", gap: 4 }}>
                <ChevronLeft size={16} /> Back
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            {step === steps.length - 1 ? (
              <>
                <Button onClick={() => handleComplete("aiQuote")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Cpu size={16} /> Create My First Quote
                </Button>
                <button onClick={() => handleComplete(null)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 12, fontFamily: theme.font }}>
                  I'll explore first
                </button>
              </>
            ) : (
              <>
                <Button onClick={async () => {
                  if (step === 1) await saveRates();
                  setStep(step + 1);
                }} disabled={savingRates}>
                  {savingRates ? "Saving..." : "Next →"}
                </Button>
                {step === 1 && (
                  <button onClick={() => setStep(step + 1)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: 12, fontFamily: theme.font, textDecoration: "underline" }}>
                    Skip for now
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify and commit**

```bash
npx vite build 2>&1 | tail -5
git add src/App.jsx
git commit -m "feat: rewrite OnboardingTutorial as interactive setup wizard"
```

---

### Task 4: Device-Independent Onboarding Flag + Trigger Logic

**Files:**
- Modify: `src/App.jsx` — onboarding trigger useEffect (~line 9744-9752), onComplete handler (~line 9914)

- [ ] **Step 1: Update the onboarding trigger useEffect**

Find the onboarding trigger (~line 9744):
```javascript
useEffect(() => {
  if (business) {
    let seen = false;
    try { seen = localStorage.getItem("wynflow_onboarded_" + business.id) === "true"; } catch(e) {}
    if (!seen && !getCookie("wynflow_onboarded")) {
      setShowOnboarding(true);
    }
  }
}, [business?.id]);
```

Replace with:
```javascript
useEffect(() => {
  if (!business || !dataLoaded) return; // Wait for quotes to load
  // Fast-check: localStorage/cookie cache
  let cached = false;
  try { cached = localStorage.getItem("wynflow_onboarded_" + business.id) === "true"; } catch(e) {}
  if (cached || getCookie("wynflow_onboarded")) return;
  // DB check: onboarded flag
  if (business.onboarded) {
    // DB says onboarded but cache missed (new device) — update cache
    try { localStorage.setItem("wynflow_onboarded_" + business.id, "true"); } catch(e) {}
    setCookie("wynflow_onboarded", "true", 525600);
    return;
  }
  // Backward compat: existing user with quotes but no onboarded flag
  if (quotes.length > 0) {
    // Auto-mark as onboarded
    db("businesses").eq("id", business.id).update({ onboarded: true });
    try { localStorage.setItem("wynflow_onboarded_" + business.id, "true"); } catch(e) {}
    setCookie("wynflow_onboarded", "true", 525600);
    return;
  }
  // New user — show wizard
  setShowOnboarding(true);
}, [business?.id, dataLoaded]);
```

Make sure `dataLoaded` and `quotes` are accessible in this scope (they should be — they're in `WynflowAppInner`).

- [ ] **Step 2: Update the onComplete handler**

Find line 9914 where `onComplete` is passed to OnboardingTutorial:
```javascript
{showOnboarding && <OnboardingTutorial business={business} dispatch={dispatch} onComplete={() => { setShowOnboarding(false); try { localStorage.setItem("wynflow_onboarded_" + business.id, "true"); } catch(e) {} setCookie("wynflow_onboarded", "true", 525600); }} />}
```

Simplify to just close the modal — the wizard's `handleComplete` now handles the DB update, cookie, and localStorage:
```javascript
{showOnboarding && <OnboardingTutorial business={business} dispatch={dispatch} onComplete={() => setShowOnboarding(false)} />}
```

- [ ] **Step 3: Verify and commit**

```bash
npx vite build 2>&1 | tail -5
git add src/App.jsx
git commit -m "feat: device-independent onboarding flag with backward compat"
```

---

### Task 5: Empty Dashboard "Get Started" Card

**Files:**
- Modify: `src/App.jsx` — Dashboard component (~line 3358)

- [ ] **Step 1: Add Get Started card**

In the Dashboard component, find the "Today's Jobs" card area (~line 3543, after the automation activity feed strip). Add this BEFORE the pipeline cards, right after the automation strip (or where the Today's Jobs card is):

```javascript
{/* Get Started card — only shows when no quotes exist */}
{quotes.length === 0 && (
  <div style={{
    padding: 24, borderRadius: 14, marginBottom: 20,
    background: "linear-gradient(135deg, rgba(20,184,166,0.08) 0%, rgba(20,184,166,0.02) 100%)",
    border: "1px solid rgba(20,184,166,0.15)",
    textAlign: "center",
  }}>
    <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(20,184,166,0.12)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
      <Cpu size={28} color={theme.accent} />
    </div>
    <h3 style={{ fontSize: 18, fontWeight: 700, color: theme.text, margin: "0 0 8px", fontFamily: theme.fontHeading }}>Create your first AI quote</h3>
    <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.6, margin: "0 0 18px", maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
      Snap some job site photos, add your notes, and let Wynflow's AI generate a professional quote in seconds.
    </p>
    <Button onClick={() => dispatch({ type: "SET_SCREEN", payload: "aiQuote" })} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <Cpu size={16} /> Create AI Quote
    </Button>
  </div>
)}
```

- [ ] **Step 2: Verify and commit**

```bash
npx vite build 2>&1 | tail -5
git add src/App.jsx
git commit -m "feat: add Get Started card to empty Dashboard"
```

---

### Task 6: Guard AI Quoting Against Missing Profile

**Files:**
- Modify: `src/App.jsx` — AIQuoteForm generate handler (~line 5074), QuoteGenerator generate handler (~line 6110)

- [ ] **Step 1: Add guard to AIQuoteForm**

Find the AI quote generation handler in AIQuoteForm. Search for the first `webhook/generate-quote` fetch call (~line 5074). Just BEFORE the fetch call, add:

```javascript
if (!business.trade) {
  dispatch({ type: "NOTIFY", payload: { message: "Please set your trade in Settings before generating a quote.", type: "error" } });
  setGenerating(false);
  return;
}
if (!business.hourly_rate || parseFloat(business.hourly_rate) === 0) {
  dispatch({ type: "NOTIFY", payload: { message: "Heads up — your hourly rate isn't set. Labour costs will be $0. Set your rate in Settings.", type: "warning" } });
}
```

Note: The trade check blocks generation. The hourly rate check is a soft warning — it does NOT block.

Find the `setGenerating` state variable name — it might be `setLoading` or `setGenerating`. Read the surrounding code to find the right state setter and the early return pattern.

- [ ] **Step 2: Add same guard to QuoteGenerator**

Find the second `webhook/generate-quote` fetch call (~line 6110) in QuoteGenerator. Add the identical guard before it. The state setter may have a different name here — check the component's state.

- [ ] **Step 3: Verify and commit**

```bash
npx vite build 2>&1 | tail -5
git add src/App.jsx
git commit -m "feat: guard AI quote generation against missing trade/rates"
```

---

### Task 7: Cross-Device Profile Completion Modal

**Files:**
- Modify: `src/App.jsx` — email confirmation handler (~line 9605), add ProfileCompletionModal component

- [ ] **Step 1: Add ProfileCompletionModal component**

Add this component before the OnboardingTutorial component:

```javascript
// ========================
// PROFILE COMPLETION MODAL (cross-device email confirmation edge case)
// ========================

function ProfileCompletionModal({ business, dispatch, onComplete }) {
  const isMobile = useIsMobile();
  const [businessName, setBusinessName] = useState(business?.business_name === "My Business" ? "" : (business?.business_name || ""));
  const [phone, setPhone] = useState(business?.phone || "");
  const [trade, setTrade] = useState(business?.trade || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!businessName.trim() || !phone.trim() || !trade) {
      return; // All fields required
    }
    setSaving(true);
    const updates = {
      business_name: businessName.trim(),
      phone: phone.trim(),
      trade: trade,
      trade_category: trade,
    };
    const { error } = await db("businesses").eq("id", business.id).update(updates);
    if (!error) {
      const updatedBiz = { ...business, ...updates };
      dispatch({ type: "SET_BUSINESS", payload: updatedBiz });
      setCookie("wynflow_business", updatedBiz, 43200);
      onComplete();
    }
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      <div style={{
        width: isMobile ? "95%" : 440, background: "rgba(17,24,39,0.98)",
        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 32,
        boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: theme.text, margin: "0 0 6px", fontFamily: theme.fontHeading }}>Complete Your Profile</h2>
        <p style={{ fontSize: 14, color: theme.textMuted, margin: "0 0 20px", lineHeight: 1.5 }}>
          Looks like you confirmed your email on a different device. Just fill in these details to get started.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Business Name *" value={businessName} onChange={setBusinessName} placeholder="e.g. Smith Plumbing" />
          <Input label="Mobile Number *" value={phone} onChange={setPhone} type="tel" placeholder="e.g. 021 123 4567" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: theme.textMuted, marginBottom: 6 }}>Trade / Industry *</div>
            <select value={trade} onChange={e => setTrade(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#F1F3F7", fontSize: 14, fontFamily: theme.font, outline: "none", appearance: "auto" }}>
              <option value="">Select your trade...</option>
              {TRADE_CATEGORIES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || !businessName.trim() || !phone.trim() || !trade}
          style={{ width: "100%", marginTop: 20, justifyContent: "center" }}>
          {saving ? "Saving..." : "Save & Continue"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add state and rendering for profile completion**

In `WynflowAppInner`, find where `showOnboarding` state is defined. Add:
```javascript
const [showProfileCompletion, setShowProfileCompletion] = useState(false);
```

In the render section (~line 9914), add BEFORE the onboarding tutorial:
```javascript
{showProfileCompletion && (
  <ProfileCompletionModal
    business={business}
    dispatch={dispatch}
    onComplete={() => setShowProfileCompletion(false)}
  />
)}
```

- [ ] **Step 3: Trigger profile completion after email confirmation**

Find the email confirmation handler's success path (~line 9631-9639, after `dispatch({ type: "SET_BUSINESS", payload: bizRecord })`). After setting the business but BEFORE dispatching to dashboard, add a check:

```javascript
// Check if profile is incomplete (cross-device edge case)
if (!bizRecord.trade || bizRecord.business_name === "My Business") {
  setShowProfileCompletion(true);
}
```

- [ ] **Step 4: Verify and commit**

```bash
npx vite build 2>&1 | tail -5
git add src/App.jsx
git commit -m "feat: add profile completion modal for cross-device signup"
```

---

## Summary

| Task | What it does |
|------|-------------|
| 1 | DB migration — `onboarded` column on businesses |
| 2 | Simplify signup form — remove pricing fields |
| 3 | Rewrite OnboardingTutorial as 4-step interactive wizard |
| 4 | Device-independent onboarding flag + backward compat |
| 5 | Empty Dashboard "Get Started" card |
| 6 | Guard AI quoting against missing trade/rates |
| 7 | Cross-device profile completion modal |
