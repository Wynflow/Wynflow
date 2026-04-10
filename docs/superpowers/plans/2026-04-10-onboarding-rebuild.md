# Onboarding Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Wynflow's 70% signup-to-first-quote drop-off by replacing the passive 5-slide walkthrough with an interactive demo-quote flow, shrinking the signup form to 3 fields, and lazy-collecting profile data on first real Send.

**Architecture:** All changes live in the existing single-file React SPA (`src/App.jsx`). One new Supabase column (`businesses.demo_completed_at`). No new files outside the React app itself. The demo uses hardcoded sample quotes per scenario (not real AI) for v0 to avoid the existing AI webhook's required-field constraints.

**Tech Stack:** React 19, Vite 7, custom Supabase REST client (`db()`), inline styles with theme object, lucide-react icons. No test suite — verification is `npx vite build` + manual code review per task.

**Spec:** `docs/superpowers/specs/2026-04-10-onboarding-rebuild.md`

---

## File Structure

| Path | What changes | Why |
|---|---|---|
| `supabase/migrations/011_add_demo_completed_at.sql` | **NEW** — add `demo_completed_at timestamptz NULL` to `businesses` | Track demo completion for analytics + rescue banner suppression |
| `src/App.jsx` — `AuthScreen` component (line 2622) | **MODIFY** — remove contact_name, trade, phone inputs; default `contact_name = businessName` on insert | Shrink signup from 7 fields to 3 |
| `src/App.jsx` — top of file (near line ~120) | **ADD** — `DEMO_SCENARIOS` const, `TRADE_TO_SCENARIO` map, `getDemoScenario()` helper | Demo data |
| `src/App.jsx` — `OnboardingTutorial` component (line 9645) | **DELETE** entirely | Replaced by `DemoOnboarding` |
| `src/App.jsx` — NEW `DemoOnboarding` component | **ADD** — full-screen 4-step modal: trade pick → preview → "generating" → result | The new flow |
| `src/App.jsx` — `WynflowApp` onboarding trigger (line 10164) | **MODIFY** — logic to check `demo_completed_at`, render `DemoOnboarding` instead of `OnboardingTutorial` | Wire up new component |
| `src/App.jsx` — NEW `LazyProfileModal` component | **ADD** — small modal asking for `contact_name` + `phone` on first real Send | Lazy profile collection |
| `src/App.jsx` — `AIQuoteForm.sendQuote` (line 5252) | **MODIFY** — check for missing `contact_name`/`phone` before sending, show `LazyProfileModal` if needed | Wire modal into Send flow |
| `src/App.jsx` — `Dashboard` empty state (around line 3496) | **MODIFY** — add "try the demo" rescue banner for users with 0 quotes and null `demo_completed_at` | Rescue the 9 stuck users |

---

## Task 1: Create and apply migration 011

**Files:**
- Create: `supabase/migrations/011_add_demo_completed_at.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/011_add_demo_completed_at.sql` with exactly this content:

```sql
-- Track when a user has completed (or dismissed) the demo onboarding flow.
-- Used for (a) analytics on the signup → demo → first-quote funnel,
-- (b) suppressing the dashboard rescue banner for users who've seen the demo.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS demo_completed_at timestamptz;
```

- [ ] **Step 2: Apply to live Supabase via MCP**

Use the `mcp__supabase__apply_migration` tool:
- `project_id`: `hlqbjomeomahoocexljp`
- `name`: `add_demo_completed_at`
- `query`: the SQL from Step 1

Expected result: `{"success": true}`

- [ ] **Step 3: Verify column exists**

Use `mcp__supabase__execute_sql` with:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'businesses' AND column_name = 'demo_completed_at';
```

Expected: one row with `demo_completed_at | timestamp with time zone | YES`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/011_add_demo_completed_at.sql
git commit -m "feat: add demo_completed_at column to businesses

Track when users finish (or dismiss) the new demo onboarding flow.
Used to suppress the rescue banner for users who've already seen
the demo, and for activation funnel analytics.

Applied to live DB via Supabase MCP.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Shrink the AuthScreen signup form

**Files:**
- Modify: `src/App.jsx` — `AuthScreen` component, lines ~2622–2891

- [ ] **Step 1: Remove unused state variables**

Find lines 2626-2629:
```js
const [businessName, setBusinessName] = useState("");
const [contactName, setContactName] = useState("");
const [trade, setTrade] = useState("");
const [phone, setPhone] = useState("");
```

Replace with:
```js
const [businessName, setBusinessName] = useState("");
```

- [ ] **Step 2: Simplify the signup validation**

Find line 2657:
```js
if (isSignup && (!businessName || !contactName || !trade || !phone.trim())) { setError("Please fill in all required fields"); return; }
```

Replace with:
```js
if (isSignup && !businessName.trim()) { setError("Please enter your business name"); return; }
```

- [ ] **Step 3: Update the pending signup localStorage payload**

Find line 2673:
```js
try { localStorage.setItem("wynflow_pending_signup", JSON.stringify({ businessName, contactName, email, phone, trade, plan })); } catch(e) {}
```

Replace with:
```js
try { localStorage.setItem("wynflow_pending_signup", JSON.stringify({ businessName, email, plan })); } catch(e) {}
```

- [ ] **Step 4: Update the first N8N new-business notification**

Find lines 2677-2680:
```js
fetch("https://wynfallautomation.app.n8n.cloud/webhook/new-business", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ business_name: businessName, contact_name: contactName, email, phone, trade }),
}).catch(() => {});
```

Replace with:
```js
fetch("https://wynfallautomation.app.n8n.cloud/webhook/new-business", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ business_name: businessName, contact_name: businessName, email, phone: null, trade: null }),
}).catch(() => {});
```

- [ ] **Step 5: Update the businesses insert to default `contact_name = businessName`**

Find lines 2684-2698:
```js
const { data: biz, error: bizErr } = await db("businesses").insert({
  user_id: authData.user.id,
  business_name: businessName,
  contact_name: contactName,
  email: email,
  phone: phone.trim(),
  trade: trade || null,
  trade_category: trade || null,
  hourly_rate: 0,
  callout_fee: 0,
  subscription_status: "trialing",
  trial_ends_at: trialEnd,
  auto_follow_ups: true,
  materials_margin: 0,
});
```

Replace with:
```js
const { data: biz, error: bizErr } = await db("businesses").insert({
  user_id: authData.user.id,
  business_name: businessName,
  contact_name: businessName,  // defaulted — user can edit in Settings or via LazyProfileModal on first send
  email: email,
  phone: null,  // deferred, collected via LazyProfileModal on first real quote send
  trade: null,  // deferred, asked in the demo onboarding flow
  trade_category: null,
  hourly_rate: 0,
  callout_fee: 0,
  subscription_status: "trialing",
  trial_ends_at: trialEnd,
  auto_follow_ups: true,
  materials_margin: 0,
});
```

- [ ] **Step 6: Update the second N8N new-business notification**

Find lines 2740-2743:
```js
fetch("https://wynfallautomation.app.n8n.cloud/webhook/new-business", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ business_name: businessName, contact_name: contactName, email, phone, trade }),
}).catch(() => {});
```

Replace with:
```js
fetch("https://wynfallautomation.app.n8n.cloud/webhook/new-business", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ business_name: businessName, contact_name: businessName, email, phone: null, trade: null }),
}).catch(() => {});
```

- [ ] **Step 7: Remove the 3 inputs from the signup JSX**

Find lines 2838-2852 (inside the `{isSignup && (` block):
```jsx
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
  </>
)}
```

Replace with:
```jsx
{isSignup && (
  <Input label="Business Name *" value={businessName} onChange={setBusinessName} />
)}
```

- [ ] **Step 8: Verify build**

Run: `npx vite build 2>&1 | tail -20`
Expected: `✓ built in Xs` with no new errors or warnings.

- [ ] **Step 9: Manual code review — check for dead references**

Run: `grep -n "contactName\|setContactName\|setTrade\|setPhone" src/App.jsx | head -20`
Expected: Only references inside functions that are NOT `AuthScreen`. AuthScreen should have zero references to `contactName`, `setContactName`, `setTrade`, `setPhone`, or the `trade`/`phone` signup state.

If any stray references remain inside AuthScreen, fix them.

- [ ] **Step 10: Commit**

```bash
git add src/App.jsx
git commit -m "feat: shrink signup form from 7 fields to 3

Drops contact_name, trade, phone from the signup form. Business
name, email, password are the only remaining required fields.
Defaults contact_name to business_name at insert time to satisfy
the NOT NULL constraint. Trade is collected in the demo
onboarding step; contact_name + phone are collected lazily on
first real quote Send via LazyProfileModal.

Part of the Track B onboarding rebuild — addressing the 70%
signup drop-off. Shortens the path from landing page to in-app
by removing 4 required fields.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add DEMO_SCENARIOS constant and helper

**Files:**
- Modify: `src/App.jsx` — add near the top of the file, just after `ERROR_WEBHOOK` definition (around line 16-48 area)

- [ ] **Step 1: Find the insertion point**

Run: `grep -n "^// ─── Safe Fetch" src/App.jsx`
Expected: One line like `92:// ─── Safe Fetch (with error reporting) ───`

The DEMO_SCENARIOS constant should be inserted **just before** this line.

- [ ] **Step 2: Insert the DEMO_SCENARIOS data**

Insert immediately before `// ─── Safe Fetch (with error reporting) ───`:

```js
// ─── Demo Onboarding Scenarios ───
// Used by DemoOnboarding to show new users a realistic sample quote
// matching their trade. These are HARDCODED samples, not AI-generated,
// because the real AI webhook requires fields a new user hasn't set yet
// (hourly_rate, price_list, quote_history, etc.). v1 can upgrade this
// to a real AI call once the user has minimum rate data.
const DEMO_SCENARIOS = {
  "bathroom-reno": {
    jobTitle: "Bathroom renovation",
    customerName: "Sarah Thompson",
    description: "Full bathroom renovation — remove existing vanity, retile floor and walls, new shower screen, install heated towel rail, replumb sink and toilet.",
    icon: "🚿",
    accent: "#3B82F6",
    lineItems: [
      { desc: "Demolition & removal of existing fittings", amount: 850 },
      { desc: "Plumbing rough-in (sink, toilet, shower)", amount: 1400 },
      { desc: "Wall & floor tiling (materials + labour)", amount: 2200 },
      { desc: "New vanity, tapware, shower screen", amount: 1650 },
      { desc: "Heated towel rail + install", amount: 380 },
      { desc: "Labour — 12 hrs @ $85/hr", amount: 1020 },
    ],
    notes: "2-week job. Includes waste removal. Tiles selected from showroom sample.",
    total: 7500,
  },
  "panel-upgrade": {
    jobTitle: "Switchboard upgrade",
    customerName: "Mike Harrison",
    description: "Replace old fuse board with new 24-way RCD switchboard. Bring mains into compliance. Issue Certificate of Compliance.",
    icon: "⚡",
    accent: "#F59E0B",
    lineItems: [
      { desc: "New 24-way RCD switchboard", amount: 680 },
      { desc: "Wiring, fittings & conduit", amount: 340 },
      { desc: "Main supply upgrade to 63A", amount: 580 },
      { desc: "Testing & compliance certificate", amount: 240 },
      { desc: "Labour — 8 hrs @ $95/hr", amount: 760 },
    ],
    notes: "Requires 4-hour power shutdown. Certificate of Compliance issued within 5 working days.",
    total: 2600,
  },
  "deck-build": {
    jobTitle: "Backyard deck build",
    customerName: "James Wilson",
    description: "Build 4x3m kwila timber deck off back door. Includes steps down to lawn and safety railing.",
    icon: "🔨",
    accent: "#8B5CF6",
    lineItems: [
      { desc: "Kwila timber & joists", amount: 1850 },
      { desc: "Concrete posts & footings", amount: 420 },
      { desc: "Stainless fixings & brackets", amount: 280 },
      { desc: "Steps & railing timber", amount: 640 },
      { desc: "Stain & weatherproofing", amount: 180 },
      { desc: "Labour — 22 hrs @ $85/hr", amount: 1870 },
    ],
    notes: "3-day job. Timber delivered direct to site. 10-year workmanship guarantee.",
    total: 5240,
  },
  "fence-replace": {
    jobTitle: "Fence replacement",
    customerName: "Emma Jackson",
    description: "Remove existing 18m colorsteel fence. Install new timber post-and-rail fence. Dispose of old materials.",
    icon: "🪵",
    accent: "#22C55E",
    lineItems: [
      { desc: "Demolition & dump fees", amount: 380 },
      { desc: "Treated pine posts (10x)", amount: 720 },
      { desc: "Rail timber (18m)", amount: 540 },
      { desc: "Concrete post mix", amount: 280 },
      { desc: "Fixings & hardware", amount: 140 },
      { desc: "Labour — 14 hrs @ $80/hr", amount: 1120 },
    ],
    notes: "2-day job. Post holes dug by hand (no auger access).",
    total: 3180,
  },
  "general-service": {
    jobTitle: "Sample job",
    customerName: "Alex Brown",
    description: "Standard trade work — assessment, labour, materials and completion.",
    icon: "🔧",
    accent: "#14B8A6",
    lineItems: [
      { desc: "Site assessment & setup", amount: 180 },
      { desc: "Materials & consumables", amount: 450 },
      { desc: "Specialty items", amount: 320 },
      { desc: "Labour — 6 hrs @ $80/hr", amount: 480 },
      { desc: "Cleanup & disposal", amount: 120 },
    ],
    notes: "Sample quote — real quotes adjust to specific job requirements.",
    total: 1550,
  },
};

const TRADE_TO_SCENARIO = {
  "Plumber": "bathroom-reno",
  "Gasfitter": "bathroom-reno",
  "Drainlayer": "bathroom-reno",
  "Tiler": "bathroom-reno",
  "Electrician": "panel-upgrade",
  "Builder": "deck-build",
  "Plasterer": "deck-build",
  "Concreter": "deck-build",
  "Carpet Layer": "general-service",
  "Painter": "general-service",
  "Roofer": "general-service",
  "Landscaper": "fence-replace",
  "Fencer": "fence-replace",
  "Handyman": "general-service",
  "Cleaner": "general-service",
  "Mechanic": "general-service",
  "Locksmith": "general-service",
  "Pest Control": "general-service",
  "Arborist": "general-service",
  "Interior Designer": "general-service",
  "Other": "general-service",
};

const getDemoScenario = (trade) => {
  const key = TRADE_TO_SCENARIO[trade] || "general-service";
  return { ...DEMO_SCENARIOS[key], scenarioKey: key };
};
```

- [ ] **Step 3: Verify build**

Run: `npx vite build 2>&1 | tail -15`
Expected: `✓ built in Xs`. The constants are referenced later, so they're "dead" for now but must not break the build.

- [ ] **Step 4: Defer commit**

Don't commit yet — Task 4 (DemoOnboarding component) uses these constants. Commit Tasks 3 + 4 + 5 + 6 together at the end of Task 6.

---

## Task 4: Build DemoOnboarding component

**Files:**
- Modify: `src/App.jsx` — insert new component at line ~9645 (replaces `OnboardingTutorial`)

- [ ] **Step 1: Find the insertion point**

Run: `grep -n "^const OnboardingTutorial" src/App.jsx`
Expected: One match, around line 9645 in the original code (may have shifted slightly due to Task 3 additions).

- [ ] **Step 2: Replace the entire OnboardingTutorial component with DemoOnboarding**

Find the component starting at `const OnboardingTutorial = ({ business, dispatch, onComplete }) => {` and ending at its closing `};`. Find the end by looking for the next top-level `const` declaration after it.

Run to find the end:
```bash
grep -n "^const " src/App.jsx | awk -F: '$2 ~ /OnboardingTutorial|WynflowApp/ {print}'
```

This gives you the start line and the line just after OnboardingTutorial ends.

Replace the entire `OnboardingTutorial` component with this new `DemoOnboarding` component:

```jsx
// ─── Demo Onboarding Flow (replaces the old OnboardingTutorial) ───
// 4-step flow: optional trade picker → preview → "generating" → result
// Uses a HARDCODED sample quote per scenario (see DEMO_SCENARIOS near top of file).
const DemoOnboarding = ({ business, dispatch, onComplete }) => {
  const isMobile = useIsMobile();
  // If the user already has a trade (from pre-Task-2 signups), skip the picker step
  const [step, setStep] = useState(business?.trade ? 1 : 0);
  const [selectedTrade, setSelectedTrade] = useState(business?.trade || "");
  const [generating, setGenerating] = useState(false);

  const scenario = getDemoScenario(selectedTrade);
  const businessName = business?.business_name || "Your Business";

  const finishDemo = async (navigateTo) => {
    const now = new Date().toISOString();
    try {
      await db("businesses").eq("id", business.id).update({
        onboarded: true,
        demo_completed_at: now,
        ...(selectedTrade && !business.trade ? { trade: selectedTrade, trade_category: selectedTrade } : {}),
      });
    } catch (e) { /* non-fatal */ }
    const updatedBiz = {
      ...business,
      onboarded: true,
      demo_completed_at: now,
      ...(selectedTrade && !business.trade ? { trade: selectedTrade, trade_category: selectedTrade } : {}),
    };
    dispatch({ type: "SET_BUSINESS", payload: updatedBiz });
    setCookie("wynflow_business", updatedBiz, 43200);
    try { localStorage.setItem("wynflow_onboarded_" + business.id, "true"); } catch(e) {}
    setCookie("wynflow_onboarded", "true", 525600);
    onComplete();
    if (navigateTo) dispatch({ type: "SET_SCREEN", payload: navigateTo });
  };

  const pickTrade = () => {
    if (!selectedTrade) {
      dispatch({ type: "NOTIFY", payload: { message: "Pick your trade so we can show you a matching example", type: "error" } });
      return;
    }
    setStep(1);
  };

  const startGenerate = () => {
    setStep(2);
    setGenerating(true);
    // Brief delay for the "aha" effect — feels like the AI is working
    setTimeout(() => {
      setGenerating(false);
      setStep(3);
    }, 1800);
  };

  // Shared shell wrapper
  const shell = (content) => (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", padding: isMobile ? 12 : 20 }}>
      <div style={{ width: isMobile ? "100%" : 520, maxHeight: "94vh", background: theme.bg, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, overflow: "hidden", boxShadow: "0 40px 120px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column", position: "relative" }}>
        {/* Skip link — always available except during "generating" */}
        {!generating && (
          <div onClick={() => finishDemo(null)}
            style={{ position: "absolute", top: 14, right: 18, fontSize: 12, color: theme.textMuted, cursor: "pointer", zIndex: 2, padding: 6 }}
            onMouseEnter={e => e.currentTarget.style.color = theme.text}
            onMouseLeave={e => e.currentTarget.style.color = theme.textMuted}>
            Skip
          </div>
        )}
        {content}
      </div>
    </div>
  );

  // STEP 0: Trade picker
  if (step === 0) {
    return shell(
      <div style={{ padding: isMobile ? "40px 24px 24px" : "52px 40px 36px" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-flex", padding: "4px 12px", borderRadius: 100, fontSize: 11, fontWeight: 600, color: theme.accent, background: "rgba(20,184,166,0.08)", marginBottom: 14 }}>Quick question</div>
          <h2 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, margin: "0 0 10px", color: theme.text }}>What do you do?</h2>
          <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.5, margin: 0 }}>We'll show you a sample quote that matches your trade.</p>
        </div>
        <select value={selectedTrade} onChange={e => setSelectedTrade(e.target.value)}
          style={{ width: "100%", padding: "14px 16px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: theme.text, fontSize: 15, fontFamily: theme.font, outline: "none", appearance: "auto", marginBottom: 20 }}>
          <option value="">Choose your trade...</option>
          {TRADE_CATEGORIES.map(t => <option key={t} value={t} style={{ background: "#1A2235" }}>{t}</option>)}
        </select>
        <Button onClick={pickTrade} style={{ width: "100%", justifyContent: "center", padding: "14px 24px" }}>Continue →</Button>
      </div>
    );
  }

  // STEP 1: Preview the scenario
  if (step === 1) {
    return shell(
      <div style={{ padding: isMobile ? "40px 20px 24px" : "52px 36px 32px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-flex", padding: "4px 12px", borderRadius: 100, fontSize: 11, fontWeight: 600, color: theme.accent, background: "rgba(20,184,166,0.08)", marginBottom: 14 }}>Try it now</div>
          <h2 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, margin: "0 0 8px", color: theme.text }}>Here's a sample {scenario.jobTitle.toLowerCase()}</h2>
          <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.5, margin: 0 }}>Hit the button and Wynflow will show you what your quote would look like.</p>
        </div>
        {/* Fake "photo" card with emoji placeholder */}
        <div style={{ background: `linear-gradient(135deg, ${scenario.accent}22, ${scenario.accent}08)`, border: `1px solid ${scenario.accent}33`, borderRadius: 14, padding: "28px 20px", textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{scenario.icon}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{scenario.jobTitle}</div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>Customer: {scenario.customerName}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px", marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Job notes</div>
          <div style={{ fontSize: 13, color: theme.text, lineHeight: 1.5 }}>{scenario.description}</div>
        </div>
        <Button onClick={startGenerate} style={{ width: "100%", justifyContent: "center", padding: "14px 24px", fontSize: 15 }}>
          <Sparkles size={16} style={{ marginRight: 6 }} /> Generate Sample Quote →
        </Button>
      </div>
    );
  }

  // STEP 2: "Generating" — brief spinner for effect
  if (step === 2) {
    return shell(
      <div style={{ padding: "80px 40px", textAlign: "center" }}>
        <div style={{ marginBottom: 20 }}>
          <Spinner />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: theme.text, margin: "0 0 8px" }}>Wynflow is reading the job...</h3>
        <p style={{ fontSize: 13, color: theme.textMuted, margin: 0 }}>Pricing materials and labour...</p>
      </div>
    );
  }

  // STEP 3: Result — show the sample quote
  return shell(
    <div style={{ display: "flex", flexDirection: "column", maxHeight: "94vh" }}>
      <div style={{ padding: isMobile ? "32px 20px 16px" : "40px 36px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "inline-flex", padding: "4px 11px", borderRadius: 100, fontSize: 10, fontWeight: 700, color: "#F59E0B", background: "rgba(245,158,11,0.1)", letterSpacing: "0.06em", marginBottom: 10 }}>SAMPLE QUOTE</div>
        <h2 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, margin: "0 0 4px", color: theme.text }}>{scenario.jobTitle}</h2>
        <p style={{ fontSize: 12, color: theme.textMuted, margin: 0 }}>From <strong style={{ color: theme.text }}>{businessName}</strong> to {scenario.customerName}</p>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "20px" : "24px 36px" }}>
        {scenario.lineItems.map((item, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < scenario.lineItems.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
            <span style={{ fontSize: 13, color: theme.textMuted, flex: 1, paddingRight: 12 }}>{item.desc}</span>
            <span style={{ fontSize: 13, color: theme.text, fontWeight: 600, whiteSpace: "nowrap" }}>${item.amount.toLocaleString()}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 14, marginTop: 8, borderTop: `2px solid ${theme.accent}33` }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>Total</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: theme.accent }}>${scenario.total.toLocaleString()}</span>
        </div>
        <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Notes</div>
          <div style={{ fontSize: 12, color: theme.text, lineHeight: 1.5 }}>{scenario.notes}</div>
        </div>
        <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.12)", fontSize: 11, color: theme.textMuted, lineHeight: 1.5, textAlign: "center" }}>
          This is a sample to show you how Wynflow structures a quote. Your real quotes will be AI-generated from your own photos and job notes.
        </div>
      </div>
      <div style={{ padding: isMobile ? "16px 20px 24px" : "20px 36px 28px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10 }}>
        <Button onClick={() => finishDemo("aiQuote")} style={{ flex: 1, justifyContent: "center", padding: "14px 20px" }}>
          <Camera size={16} style={{ marginRight: 6 }} /> Make a real one →
        </Button>
        <Button variant="ghost" onClick={() => finishDemo(null)} style={{ justifyContent: "center", padding: "14px 20px" }}>
          Skip for now
        </Button>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Verify build**

Run: `npx vite build 2>&1 | tail -15`
Expected: `✓ built in Xs`. May see unused variable warnings for `DemoOnboarding` — that's expected until Task 5 wires it up.

- [ ] **Step 4: Defer commit** — continue to Task 5.

---

## Task 5: Rewire WynflowApp to use DemoOnboarding

**Files:**
- Modify: `src/App.jsx` — around line 10164 (the `showOnboarding` trigger effect) and line 10355 (the render)

- [ ] **Step 1: Update the onboarding trigger effect**

Find lines 10164-10186:
```js
  // Show onboarding for new users (device-independent via DB flag)
  useEffect(() => {
    if (!business || !dataLoaded) return;
    // Fast-check: localStorage/cookie cache
    let cached = false;
    try { cached = localStorage.getItem("wynflow_onboarded_" + business.id) === "true"; } catch(e) {}
    if (cached || getCookie("wynflow_onboarded")) return;
    // DB check
    if (business.onboarded) {
      try { localStorage.setItem("wynflow_onboarded_" + business.id, "true"); } catch(e) {}
      setCookie("wynflow_onboarded", "true", 525600);
      return;
    }
    // Backward compat: existing user with quotes
    if (quotes.length > 0) {
      db("businesses").eq("id", business.id).update({ onboarded: true });
      try { localStorage.setItem("wynflow_onboarded_" + business.id, "true"); } catch(e) {}
      setCookie("wynflow_onboarded", "true", 525600);
      return;
    }
    // New user — show wizard
    setShowOnboarding(true);
  }, [business?.id, dataLoaded]);
```

Replace with (keeps the same trigger logic, just renamed the flag):
```js
  // Show the demo onboarding for new users who haven't completed it yet.
  // Triggered by: no cached onboarded flag + business.onboarded=false + no quotes.
  useEffect(() => {
    if (!business || !dataLoaded) return;
    // Fast-check: localStorage/cookie cache
    let cached = false;
    try { cached = localStorage.getItem("wynflow_onboarded_" + business.id) === "true"; } catch(e) {}
    if (cached || getCookie("wynflow_onboarded")) return;
    // DB check
    if (business.onboarded) {
      try { localStorage.setItem("wynflow_onboarded_" + business.id, "true"); } catch(e) {}
      setCookie("wynflow_onboarded", "true", 525600);
      return;
    }
    // Backward compat: existing user with quotes — mark onboarded silently
    if (quotes.length > 0) {
      db("businesses").eq("id", business.id).update({ onboarded: true });
      try { localStorage.setItem("wynflow_onboarded_" + business.id, "true"); } catch(e) {}
      setCookie("wynflow_onboarded", "true", 525600);
      return;
    }
    // New user — show the demo onboarding
    setShowOnboarding(true);
  }, [business?.id, dataLoaded]);
```

(This is effectively the same code with updated comments — the trigger behaviour doesn't change.)

- [ ] **Step 2: Update the render to use DemoOnboarding**

Find line 10355:
```jsx
{showOnboarding && <OnboardingTutorial business={business} dispatch={dispatch} onComplete={() => setShowOnboarding(false)} />}
```

Replace with:
```jsx
{showOnboarding && <DemoOnboarding business={business} dispatch={dispatch} onComplete={() => setShowOnboarding(false)} />}
```

- [ ] **Step 3: Verify build**

Run: `npx vite build 2>&1 | tail -15`
Expected: `✓ built in Xs` with no errors. Since `OnboardingTutorial` was replaced by `DemoOnboarding` in Task 4 (same spot in the file), there should be no dangling reference to the old name.

- [ ] **Step 4: Check for stray references**

Run: `grep -n "OnboardingTutorial" src/App.jsx`
Expected: Zero matches.

If any match, delete the stray reference.

- [ ] **Step 5: Commit Tasks 3 + 4 + 5 together**

```bash
git add src/App.jsx
git commit -m "feat: interactive demo onboarding replaces 5-slide walkthrough

Replaces the passive OnboardingTutorial (5 marketing slides with
phone mockups) with DemoOnboarding — an interactive 4-step flow
that shows new users a realistic sample quote matching their
trade, with their actual business name on it.

- 5 pre-written sample scenarios (bathroom-reno, panel-upgrade,
  deck-build, fence-replace, general-service) covering all 21
  trade categories via a lookup table
- Trade picker step only shown if business.trade is empty
  (new signups after Task 2) — existing users skip straight to
  the scenario preview
- Hardcoded sample content for v0 — the real AI webhook requires
  fields a new user hasn't set yet. v1 can upgrade to real AI
- Clearly labeled 'SAMPLE QUOTE' so users understand it's a
  preview of what Wynflow produces, not a real quote
- demo_completed_at set when user completes OR skips the demo

Addresses the 70% signup drop-off by replacing a passive ad with
an immediate 'aha' moment.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Build LazyProfileModal

**Files:**
- Modify: `src/App.jsx` — insert new component just before `DemoOnboarding`

- [ ] **Step 1: Find insertion point**

Run: `grep -n "^const DemoOnboarding" src/App.jsx`
Expected: One match.

Insert the new component immediately **before** that line.

- [ ] **Step 2: Insert LazyProfileModal**

```jsx
// ─── Lazy Profile Modal ───
// Shown before the first real quote Send when contact_name or phone is missing.
// Collects the minimum extra info needed for a professional quote PDF.
const LazyProfileModal = ({ business, dispatch, onSaved, onCancel }) => {
  const isMobile = useIsMobile();
  // Default contact_name = business_name means we treat it as "needs lazy fill"
  // only if it's literally equal to business_name (user never customised it)
  const needsName = !business?.contact_name || business.contact_name === business.business_name;
  const needsPhone = !business?.phone;
  const [contactName, setContactName] = useState(needsName ? "" : business.contact_name);
  const [phone, setPhone] = useState(needsPhone ? "" : business.phone);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!contactName.trim() || !phone.trim()) {
      dispatch({ type: "NOTIFY", payload: { message: "We need both your name and mobile for customers to reach you", type: "error" } });
      return;
    }
    setSaving(true);
    try {
      await db("businesses").eq("id", business.id).update({
        contact_name: contactName.trim(),
        phone: phone.trim(),
      });
      const updatedBiz = { ...business, contact_name: contactName.trim(), phone: phone.trim() };
      dispatch({ type: "SET_BUSINESS", payload: updatedBiz });
      setCookie("wynflow_business", updatedBiz, 43200);
      onSaved(updatedBiz);
    } catch (err) {
      dispatch({ type: "NOTIFY", payload: { message: "Couldn't save — try again", type: "error" } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", padding: 16 }}>
      <div style={{ width: isMobile ? "100%" : 420, background: theme.bg, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, boxShadow: "0 40px 120px rgba(0,0,0,0.7)", padding: isMobile ? "32px 24px" : "36px 32px" }}>
        <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: theme.text, margin: "0 0 6px" }}>One last thing</h3>
        <p style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.5, margin: "0 0 22px" }}>
          Your customer needs to know who to contact. We'll add these to all your quotes going forward.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 22 }}>
          <Input label="Your Name *" value={contactName} onChange={setContactName} placeholder="e.g. Jesse Smith" />
          <Input label="Mobile Number *" value={phone} onChange={setPhone} type="tel" placeholder="e.g. 021 123 4567" />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="ghost" onClick={onCancel} disabled={saving} style={{ padding: "12px 18px" }}>Cancel</Button>
          <Button onClick={save} disabled={saving} style={{ flex: 1, justifyContent: "center", padding: "12px 18px" }}>
            {saving ? "Saving..." : "Save & Send Quote →"}
          </Button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Verify build**

Run: `npx vite build 2>&1 | tail -15`
Expected: `✓ built in Xs`. `LazyProfileModal` will be reported as unused until Task 7 wires it up.

- [ ] **Step 4: Defer commit** — continue to Task 7.

---

## Task 7: Wire LazyProfileModal into the AI quote Send flow

**Files:**
- Modify: `src/App.jsx` — `AIQuoteForm` component, `sendQuote` function around line 5252

- [ ] **Step 1: Add state for the lazy profile modal inside AIQuoteForm**

Find the state declarations at the top of `AIQuoteForm` (around line 4904-4920). Add this new state variable alongside the others:

```js
const [showLazyProfile, setShowLazyProfile] = useState(false);
```

Place this near the existing `const [sending, setSending] = useState(false);` declaration.

- [ ] **Step 2: Gate `sendQuote` with the lazy profile check**

Find line 5252:
```js
  const sendQuote = async () => {
    if (!editForm.amount || !form.customerEmail) {
      dispatch({ type: "NOTIFY", payload: { message: "Please set an amount and customer email", type: "error" } });
      return;
    }
    setSending(true);
```

Replace with:
```js
  const sendQuote = async (skipLazyCheck = false) => {
    if (!editForm.amount || !form.customerEmail) {
      dispatch({ type: "NOTIFY", payload: { message: "Please set an amount and customer email", type: "error" } });
      return;
    }
    // Lazy profile check: if contact_name was defaulted to business_name or phone is missing,
    // block the send and prompt the user to fill them in.
    if (!skipLazyCheck) {
      const needsName = !business?.contact_name || business.contact_name === business.business_name;
      const needsPhone = !business?.phone;
      if (needsName || needsPhone) {
        setShowLazyProfile(true);
        return;
      }
    }
    setSending(true);
```

- [ ] **Step 3: Render LazyProfileModal conditionally**

Find the top of `AIQuoteForm`'s return statement (the outer `<div>` that wraps everything — around line 5322). Add the modal conditionally right inside that div, near the top so it renders as an overlay:

Find:
```jsx
  return (
    <div>
      {hasDraft && (
```

Replace with:
```jsx
  return (
    <div>
      {showLazyProfile && (
        <LazyProfileModal
          business={business}
          dispatch={dispatch}
          onSaved={() => { setShowLazyProfile(false); sendQuote(true); }}
          onCancel={() => setShowLazyProfile(false)}
        />
      )}
      {hasDraft && (
```

- [ ] **Step 4: Verify build**

Run: `npx vite build 2>&1 | tail -15`
Expected: `✓ built in Xs` with no errors.

- [ ] **Step 5: Commit Tasks 6 + 7**

```bash
git add src/App.jsx
git commit -m "feat: lazy profile collection on first real quote send

Adds LazyProfileModal — a small blocking modal that asks for the
tradie's full name and mobile number before they send their first
real quote. Only shown when contact_name is still defaulted to
business_name (from the shrunk signup flow) or phone is null.

Rationale: tradies who just signed up skipped filling in their
name and phone to get into the app faster. Those fields are not
needed until they're actually about to send a quote to a real
customer — at which point they're motivated enough to fill in 2
small fields.

Wires into AIQuoteForm.sendQuote() via a skipLazyCheck flag so
the modal's Save callback can recursively proceed with the send
once the profile is complete.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Add rescue banner to Dashboard for stuck users

**Files:**
- Modify: `src/App.jsx` — `Dashboard` component empty state, around line 3496

- [ ] **Step 1: Find the empty state block**

Run: `grep -n '"Get started card for empty state"' src/App.jsx`
Expected: One match near line 3495.

- [ ] **Step 2: Replace the empty state block with a version that includes the rescue banner**

Find lines 3495-3514 (the `{quotes.length === 0 && (...)}` block):

```jsx
      {/* Get started card for empty state */}
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

Replace with:

```jsx
      {/* Rescue banner: for users who already finished old onboarding but never made a quote */}
      {quotes.length === 0 && business?.onboarded && !business?.demo_completed_at && (() => {
        const dismissedKey = "wynflow_rescue_banner_dismissed_" + business.id;
        let dismissed = false;
        try { dismissed = localStorage.getItem(dismissedKey) === "true"; } catch(e) {}
        if (dismissed) return null;
        return (
          <div style={{
            padding: 18, borderRadius: 14, marginBottom: 16,
            background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.02) 100%)",
            border: "1px solid rgba(245,158,11,0.18)",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Sparkles size={18} color="#F59E0B" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>See Wynflow in 30 seconds</div>
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>Try our new demo — we'll show you a sample quote with your business name.</div>
            </div>
            <Button size="sm" onClick={() => dispatch({ type: "SET_SCREEN", payload: "demo" })}>Try it →</Button>
            <div onClick={() => { try { localStorage.setItem(dismissedKey, "true"); } catch(e) {}; dispatch({ type: "NOTIFY", payload: { message: "Dismissed — you can still create your first quote anytime", type: "success" } }); }}
              style={{ fontSize: 11, color: theme.textMuted, cursor: "pointer", padding: 4 }}
              onMouseEnter={e => e.currentTarget.style.color = theme.text}
              onMouseLeave={e => e.currentTarget.style.color = theme.textMuted}>
              Dismiss
            </div>
          </div>
        );
      })()}

      {/* Get started card for empty state */}
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

- [ ] **Step 3: Handle the "demo" screen dispatch**

The rescue banner dispatches `SET_SCREEN` to `"demo"`. We need to add a handler in `WynflowApp` that, when that screen is active, re-shows the `DemoOnboarding` modal.

Find the line `setShowOnboarding(true);` in the onboarding trigger useEffect (line ~10185 after Task 5). Search for screen routing in `WynflowApp`.

Actually, a simpler implementation: instead of a new screen, have the rescue banner directly trigger the existing `showOnboarding` state.

**Simplification:** Lift the banner's action to set `showOnboarding` directly. But `showOnboarding` lives in `WynflowApp`, not `Dashboard`. The cleanest fix: pass a new prop `onShowDemo` to `Dashboard` that wraps `setShowOnboarding(true)`.

Update the rescue banner's button:
```jsx
            <Button size="sm" onClick={() => dispatch({ type: "SET_SCREEN", payload: "demo" })}>Try it →</Button>
```

Replace with:
```jsx
            <Button size="sm" onClick={onShowDemo}>Try it →</Button>
```

Also update the Dashboard component signature at line 3341. Find:
```js
const Dashboard = ({ quotes, dispatch, invoices = [], jobs = [], business }) => {
```

Replace with:
```js
const Dashboard = ({ quotes, dispatch, invoices = [], jobs = [], business, onShowDemo }) => {
```

And find where `<Dashboard ... />` is rendered inside `WynflowApp` (search for `<Dashboard`). Add the `onShowDemo` prop passing a function that sets `showOnboarding`:

Run: `grep -n "<Dashboard " src/App.jsx`

Example expected render line:
```jsx
{activeScreen === "dashboard" && <Dashboard quotes={quotes} dispatch={dispatch} invoices={invoices} jobs={jobs} business={business} />}
```

Replace with:
```jsx
{activeScreen === "dashboard" && <Dashboard quotes={quotes} dispatch={dispatch} invoices={invoices} jobs={jobs} business={business} onShowDemo={() => setShowOnboarding(true)} />}
```

- [ ] **Step 4: Verify build**

Run: `npx vite build 2>&1 | tail -15`
Expected: `✓ built in Xs` with no errors.

- [ ] **Step 5: Verify the rescue banner logic is correct**

Run:
```bash
grep -n "demo_completed_at" src/App.jsx
```
Expected: At least 3 matches — the Dashboard rescue banner check, the DemoOnboarding `finishDemo` update, and the migration file.

- [ ] **Step 6: Commit Task 8**

```bash
git add src/App.jsx
git commit -m "feat: dashboard rescue banner for stuck existing users

Adds a dismissible banner to the Dashboard empty state for users
who have onboarded=true but demo_completed_at is null and
quotes.length is 0. Clicking 'Try it' re-triggers the
DemoOnboarding modal; clicking 'Dismiss' stores a localStorage
flag to hide it permanently on this device.

Targets the 9 existing stuck users who finished the old
5-slide walkthrough but never created a quote. Gives them a
second-chance path to the new interactive demo without being
pushy about it.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run the full build**

Run: `npx vite build 2>&1 | tail -20`
Expected: Clean build, no new warnings, bundle size similar to before (~1.3 MB).

- [ ] **Step 2: Check git log**

Run: `git log --oneline -8`
Expected: 4 new commits since the start of Task 1:
1. `feat: add demo_completed_at column to businesses`
2. `feat: shrink signup form from 7 fields to 3`
3. `feat: interactive demo onboarding replaces 5-slide walkthrough`
4. `feat: lazy profile collection on first real quote send`
5. `feat: dashboard rescue banner for stuck existing users`

(Actually 5 commits. The spec said 4 but that was approximate — 5 is cleaner because it separates the rescue banner from the core demo flow.)

- [ ] **Step 3: Grep for dead references**

```bash
grep -n "OnboardingTutorial" src/App.jsx
```
Expected: zero matches (old component fully replaced).

```bash
grep -n "setContactName\|setTrade" src/App.jsx | head
```
Expected: References only inside the Settings component (where users edit their profile), NOT inside AuthScreen.

- [ ] **Step 4: Verify the migration landed in the DB**

Use `mcp__supabase__execute_sql`:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name='businesses' AND column_name='demo_completed_at';
```
Expected: One row.

- [ ] **Step 5: Ask the user to manually test the flow**

Request the user to test in a browser:
1. Sign up with a new test email → expect only business name, email, password fields
2. After email verify + login → expect DemoOnboarding to show
3. Pick a trade → preview scenario → hit "Generate Sample Quote" → wait 1.8s → see the sample
4. Click "Make a real one →" → should land on AI quote screen
5. Fill in a real quote → hit Send → expect LazyProfileModal to appear asking for name and mobile
6. Fill it in → Send should proceed
7. Log out, sign in as existing user with `onboarded=true` AND 0 quotes → should see rescue banner
8. Click "Try it →" → should re-show DemoOnboarding

---

## Self-Review

### Spec coverage check

| Spec requirement | Implemented in |
|---|---|
| Migration 011 for `demo_completed_at` | Task 1 |
| Shrink signup from 7 → 3 fields | Task 2 |
| Default `contact_name = business_name` | Task 2 Step 5 |
| DEMO_SCENARIOS data | Task 3 |
| Trade picker step (skipped if trade known) | Task 4 (DemoOnboarding Step 0) |
| Scenario preview with emoji placeholder | Task 4 (DemoOnboarding Step 1) |
| "Generating" spinner for aha effect | Task 4 (DemoOnboarding Step 2) |
| Sample quote result with SAMPLE label | Task 4 (DemoOnboarding Step 3) |
| "Make a real one" → aiQuote / "Skip for now" → dashboard | Task 4 |
| `demo_completed_at` set on finish/skip | Task 4 (finishDemo) |
| Old OnboardingTutorial deleted | Task 4 (replaces entire component) |
| WynflowApp renders DemoOnboarding instead | Task 5 |
| LazyProfileModal on first real send | Tasks 6 + 7 |
| Defaulted `contact_name === business_name` triggers lazy modal | Task 7 Step 2 |
| Dashboard rescue banner | Task 8 |
| Banner dismissible via localStorage | Task 8 (dismissedKey) |
| Banner reopens DemoOnboarding | Task 8 (onShowDemo prop) |

All spec requirements covered.

### Placeholder scan

- No "TBD", "TODO", "implement later" anywhere in the plan.
- All code steps contain complete, copy-pasteable code blocks.
- All file paths are absolute and specific.
- All grep/bash commands have expected outputs.

### Type consistency

- `DemoOnboarding` props `{ business, dispatch, onComplete }` — matches the render call in Task 5.
- `LazyProfileModal` props `{ business, dispatch, onSaved, onCancel }` — matches the render call in Task 7.
- `getDemoScenario(trade)` returns object with `jobTitle`, `customerName`, `description`, `icon`, `accent`, `lineItems`, `notes`, `total`, `scenarioKey` — all consumed correctly in `DemoOnboarding` render.
- `Dashboard` prop `onShowDemo` — added in Task 8 Step 3, used in the rescue banner's onClick.

### Risks flagged during planning

- Task 8's "demo" screen approach was initially via `SET_SCREEN: "demo"` but I refactored to a cleaner `onShowDemo` prop. The plan reflects the cleaner version.
- Task 5 Step 1 leaves the trigger logic effectively unchanged — the only difference is the render target. This is intentional: don't fix what isn't broken.

### Scope

Focused on Track B only. Does not touch: AI quote generator, follow-up system, Xero integration, compliance features, landing pages, any other screen.

---

## Execution handoff

Once this plan is approved by the user, invoke the `superpowers:executing-plans` skill to work through the tasks.
