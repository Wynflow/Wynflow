# Materials Margin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add materials markup/margin to the quoting system so tradies can automatically mark up material costs on AI-generated and manual quotes.

**Architecture:** Single new column `materials_margin` on the `businesses` table. Line items gain a `costPrice` field alongside the existing `price`. Margin auto-applies after AI generation; tradies can override per-item. Customer-facing output only shows `price`.

**Tech Stack:** React 19 (Vite 7), single-file app (`src/App.jsx`), Supabase Postgres, inline styles

**Spec:** `docs/superpowers/specs/2026-03-23-materials-margin-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/007_add_materials_margin.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Add materials_margin column to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS materials_margin numeric DEFAULT 0;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Run the migration against the Supabase project. Verify the column exists by querying:
```sql
SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'materials_margin';
```
Expected: `materials_margin | numeric | 0`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/007_add_materials_margin.sql
git commit -m "feat: add materials_margin column to businesses table"
```

---

### Task 2: Settings — Add Materials Markup Field

**Files:**
- Modify: `src/App.jsx` — Settings component (~line 7662 for useState, ~line 7692 for saveSettings)

- [ ] **Step 1: Add useState for materialsMargin**

After the `calloutFee` state declaration (~line 7660), add:

```javascript
const [materialsMargin, setMaterialsMargin] = useState(business?.materials_margin || 0);
```

- [ ] **Step 2: Add materialsMargin to saveSettings updates object**

In the `saveSettings` function (~line 7683), add to the `updates` object after `callout_fee`:

```javascript
materials_margin: Math.max(0, Math.min(200, parseFloat(materialsMargin) || 0)),
```

- [ ] **Step 3: Add the UI field in the Pricing & AI Estimates section**

Find the callout fee input in the Settings component's Pricing section. After it, add:

```jsx
<Input label="Default Materials Markup %" value={materialsMargin} onChange={v => setMaterialsMargin(v)} type="number" placeholder="e.g. 20" />
<div style={{ fontSize: 12, color: theme.textDim, marginTop: -4 }}>How much do you mark up materials? Applied automatically to AI quotes.</div>
```

- [ ] **Step 4: Verify in browser**

Open Settings → Pricing section. Confirm the new field shows, saves, and persists on reload.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add materials markup % to Settings"
```

---

### Task 3: Signup — Add Materials Markup Field

**Files:**
- Modify: `src/App.jsx` — AuthScreen component (~line 2591)

- [ ] **Step 1: Add useState for materialsMargin in AuthScreen**

After the `autoFollowUps` state (~line 2601), add:

```javascript
const [materialsMargin, setMaterialsMargin] = useState("");
```

- [ ] **Step 2: Add field to the signup form UI**

In the signup form, after the callout fee field and before the auto follow-ups toggle, add:

```jsx
<Input label="Materials Markup %" value={materialsMargin} onChange={setMaterialsMargin} type="number" placeholder="e.g. 20" />
<div style={{ fontSize: 12, color: theme.textDim, marginTop: -4, marginBottom: 12 }}>How much do you mark up materials? Applied automatically to AI quotes.</div>
```

- [ ] **Step 3: Add materialsMargin to direct signup business insert**

In the direct signup path (~line 2656), add to the `db("businesses").insert({...})` object:

```javascript
materials_margin: Math.max(0, Math.min(200, parseFloat(materialsMargin) || 0)),
```

- [ ] **Step 4: Add materialsMargin to pending signup localStorage**

At ~line 2645, update the `localStorage.setItem("wynflow_pending_signup", ...)` call to include `materialsMargin`:

```javascript
try { localStorage.setItem("wynflow_pending_signup", JSON.stringify({ businessName, contactName, email, phone, trade, hourlyRate, calloutFee, plan, autoFollowUps, materialsMargin })); } catch(e) {}
```

- [ ] **Step 5: Add materialsMargin to email-confirmation business creation**

At ~line 8556, in the deferred business creation from pending signup, add to the insert object:

```javascript
materials_margin: Math.max(0, Math.min(200, parseFloat(pending.materialsMargin) || 0)),
```

- [ ] **Step 6: Verify in browser**

Test the signup form — confirm the field renders. Don't need to create an actual account; visual check is fine.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add materials markup % to signup form"
```

---

### Task 4: AIQuoteForm — Margin Logic in Line Items

**Files:**
- Modify: `src/App.jsx` — AIQuoteForm (~line 4112)

This is the core task. The AIQuoteForm has its own copies of `recalcTotal`, `updatePricing`, `updateLineItem`, `addLineItem`, `removeLineItem` at ~lines 4355-4398.

- [ ] **Step 1: Helper function — applyMargin**

Add a helper function near the top of the AIQuoteForm component (after the state declarations), before `recalcTotal`:

```javascript
const marginPct = parseFloat(business.materials_margin) || 0;
const applyMargin = (costPrice) => {
  const cp = parseFloat(costPrice) || 0;
  return marginPct > 0 ? Math.round(cp * (1 + marginPct / 100) * 100) / 100 : cp;
};
```

- [ ] **Step 2: Update AI generation handler to produce costPrice line items**

In the generate handler (~line 4319), after parsing line items from AI response, update to add `costPrice`:

Change the line item mapping from:
```javascript
return { description: desc, price };
```
To:
```javascript
return { description: desc, costPrice: price, price: String(applyMargin(price)) };
```

Also update the fallback line items (~line 4327). Change from:
```javascript
const lineItems = parsedItems.length > 0 ? parsedItems : [{ description: materialsText || "Materials", price: matCost ? String(Math.round(matCost * 100) / 100) : "" }];
```
To:
```javascript
const lineItems = parsedItems.length > 0 ? parsedItems : [{ description: materialsText || "Materials", costPrice: matCost ? String(Math.round(matCost * 100) / 100) : "", price: matCost ? String(applyMargin(matCost)) : "" }];
```

- [ ] **Step 3: Recalculate materialsCost and total AFTER margin is applied (CRITICAL)**

After building the margin-applied `lineItems` (~line 4329), the total must be recalculated to include marked-up prices. The existing code sets `amount: result.quote.total` which is the AI's original total WITHOUT margin. This will be wrong.

After the `lineItems` construction and before `setEditForm`, recalculate:

```javascript
// Recalculate with marked-up prices
const markedUpMatCost = lineItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
const markedUpTotal = Math.round((markedUpMatCost + labourCost + callout) * 100) / 100;
```

Then in `setEditForm`, use:
```javascript
materialsCost: String(Math.round(markedUpMatCost * 100) / 100),
amount: String(markedUpTotal),
```

Instead of the original `finalMatCost` and `result.quote.total`.

- [ ] **Step 4: Verify recalcTotal is consistent**

`recalcTotal` (~line 4355) already sums `item.price`:
```javascript
const matCost = (fields.lineItems || []).reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
```
This is correct — it uses the customer price. No change needed.

Also verify `updatePricing` (~line 4363) — it syncs `materialsCost` from `item.price` which is the customer price. Correct, no change needed.

- [ ] **Step 5: Update updateLineItem to handle costPrice edits**

Replace the existing `updateLineItem` (~line 4373) with:

```javascript
const updateLineItem = (index, field, value) => {
  setEditForm(prev => {
    const items = [...(prev.lineItems || [])];
    items[index] = { ...items[index], [field]: value };
    // If costPrice changed, re-apply margin to get new customer price
    if (field === "costPrice") {
      items[index].price = String(applyMargin(value));
    }
    const matCost = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    const updated = { ...prev, lineItems: items, materialsCost: String(matCost) };
    updated.amount = recalcTotal(updated);
    return updated;
  });
};
```

- [ ] **Step 6: Update addLineItem to include costPrice**

Replace the existing `addLineItem` (~line 4384):

```javascript
const addLineItem = () => {
  setEditForm(prev => ({
    ...prev,
    lineItems: [...(prev.lineItems || []), { description: "", costPrice: "", price: "" }]
  }));
};
```

- [ ] **Step 7: Update removeLineItem — no structural change needed**

The existing `removeLineItem` (~line 4391) already recalculates from `item.price`. Verify it still works — `costPrice` is just along for the ride. No change needed.

- [ ] **Step 8: Verify AI quote generation in browser**

Generate an AI quote with a business that has `materials_margin` set. Confirm:
- Line items show `costPrice` values from AI
- `price` values are marked up
- Total reflects customer prices
- Editing costPrice recalculates price and total
- Editing price directly works (costPrice stays)

- [ ] **Step 9: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add margin logic to AIQuoteForm line items"
```

---

### Task 5: AIQuoteForm — Edit Screen UI (Cost vs Customer Price Display)

**Files:**
- Modify: `src/App.jsx` — AIQuoteForm line item rendering (~line 4573)

- [ ] **Step 1: Add no-margin warning banner**

Before the "Line Items" heading (~line 4574), add a warning when margin is 0:

```jsx
{(parseFloat(business.materials_margin) || 0) === 0 && editForm.lineItems?.some(i => i.costPrice || i.price) && (
  <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
    <div style={{ fontSize: 13, color: "rgba(234,179,8,0.9)" }}>No materials markup set — these prices are at cost.</div>
    <button onClick={() => dispatch({ type: "SET_SCREEN", payload: "settings" })} style={{ fontSize: 12, color: theme.accent, background: "none", border: "none", cursor: "pointer", fontFamily: theme.font, fontWeight: 600, whiteSpace: "nowrap", textDecoration: "underline" }}>Set in Settings</button>
  </div>
)}
```

- [ ] **Step 2: Update line item row to show cost → customer price when margin > 0**

Replace the existing line item row (~lines 4575-4594). The key change: when margin > 0, show two price columns (costPrice input + customer price input). When margin is 0, show single price input as today.

Replace the line item mapping block:

```jsx
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
```

- [ ] **Step 3: Add column headers when margin > 0**

Before the line items map, after the "Line Items" label, add column headers:

```jsx
{marginPct > 0 && (
  <div style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 4 }}>
    <div style={{ flex: 1, fontSize: 11, color: theme.textDim }}>Description</div>
    <div style={{ width: isMobile ? 80 : 100, fontSize: 11, color: theme.textDim, textAlign: "right" }}>Cost</div>
    <span style={{ fontSize: 12, color: "transparent" }}>→</span>
    <div style={{ width: isMobile ? 80 : 100, fontSize: 11, color: theme.textDim, textAlign: "right" }}>Customer</div>
    <div style={{ width: 30 }} />
  </div>
)}
```

- [ ] **Step 4: Add materials markup summary row**

After the "Materials subtotal" row (~line 4601), add a markup summary when margin > 0:

```jsx
{marginPct > 0 && (editForm.lineItems || []).some(i => parseFloat(i.costPrice) > 0) && (() => {
  const markupTotal = (editForm.lineItems || []).reduce((sum, item) => sum + ((parseFloat(item.price) || 0) - (parseFloat(item.costPrice) || 0)), 0);
  return markupTotal > 0 ? (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
      <span style={{ fontSize: 12, color: theme.accent }}>Materials markup</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: theme.accent }}>+${Math.round(markupTotal).toLocaleString()}</span>
    </div>
  ) : null;
})()}
```

- [ ] **Step 5: Verify in browser**

Test with margin > 0: see cost + customer columns, arrow, column headers, markup summary.
Test with margin = 0: see single price column, warning banner.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add margin UI to AIQuoteForm edit screen"
```

---

### Task 6: QuoteGenerator — Same Margin Logic

**Files:**
- Modify: `src/App.jsx` — QuoteGenerator component (~line 5130)

The QuoteGenerator has its own copies of the line item logic (~lines 5224-5306). Apply the same changes as Task 4.

- [ ] **Step 1: Add marginPct and applyMargin helper**

At the top of the QuoteGenerator component, after state declarations, add:

```javascript
const marginPct = parseFloat(business.materials_margin) || 0;
const applyMargin = (costPrice) => {
  const cp = parseFloat(costPrice) || 0;
  return marginPct > 0 ? Math.round(cp * (1 + marginPct / 100) * 100) / 100 : cp;
};
```

- [ ] **Step 2: Update AI generation handler**

In the generate handler (~line 5234), update line item creation to include `costPrice`:

Change from:
```javascript
return { description: desc, price };
```
To:
```javascript
return { description: desc, costPrice: price, price: String(applyMargin(price)) };
```

Update the fallback (~line 5240) similarly:
```javascript
const lineItems = parsedItems.length > 0 ? parsedItems : [{ description: materialsText || "Materials", costPrice: matCost ? String(Math.round(matCost * 100) / 100) : "", price: matCost ? String(applyMargin(matCost)) : "" }];
```

Then recalculate total with marked-up prices (same as Task 4, Step 3):
```javascript
const markedUpMatCost = lineItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
const markedUpTotal = Math.round((markedUpMatCost + labourCost + callout) * 100) / 100;
```

Use `markedUpMatCost` for `materialsCost` and `markedUpTotal` for `amount` in `setEditForm`.

- [ ] **Step 3: Update updateLineItem for costPrice**

Replace the `updateLineItem` at ~line 5284:

```javascript
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
```

- [ ] **Step 4: Update addLineItem**

Replace at ~line 5295:
```javascript
const addLineItem = () => {
  setEditForm(prev => ({ ...prev, lineItems: [...(prev.lineItems || []), { description: "", costPrice: "", price: "" }] }));
};
```

- [ ] **Step 5: Fix materials text for customer-facing output**

Same as Task 8 Step 1 — rebuild `editForm.materials` with customer prices after margin is applied:
```javascript
const materialsTextWithMargin = lineItems.filter(i => i.description?.trim()).map(i => i.description + (i.price ? " — $" + i.price : "")).join("\n");
```
Use this for `materials` in `setEditForm`.

- [ ] **Step 6: Update the QuoteGenerator's line item UI**

Apply the same UI pattern as Task 5 — cost/customer columns when margin > 0, single column when 0, warning banner, column headers, markup summary. Find the line item rendering section in QuoteGenerator and apply the same JSX pattern.

- [ ] **Step 7: Verify in browser**

Open an existing "requested" quote, generate an AI quote via QuoteGenerator. Confirm margin applies correctly.

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add margin logic to QuoteGenerator"
```

---

### Task 7: NewQuoteForm — Same Margin Logic

**Files:**
- Modify: `src/App.jsx` — NewQuoteForm component (~line 4771)

The NewQuoteForm has its own line item state and functions (~lines 4777-4797).

- [ ] **Step 1: Add marginPct and applyMargin helper**

At the top of NewQuoteForm, after state declarations:

```javascript
const marginPct = parseFloat(business.materials_margin) || 0;
const applyMargin = (costPrice) => {
  const cp = parseFloat(costPrice) || 0;
  return marginPct > 0 ? Math.round(cp * (1 + marginPct / 100) * 100) / 100 : cp;
};
```

- [ ] **Step 2: Update line item initial state**

Change the initial state (~line 4777):
```javascript
const [lineItems, setLineItems] = useState([{ description: "", costPrice: "", price: "" }]);
```

- [ ] **Step 3: Update totalAmount to use customer price**

The existing `totalAmount` (~line 4785) already sums `item.price` — this is correct, no change needed.

- [ ] **Step 4: Update updateLineItem for costPrice**

Replace (~line 4787):
```javascript
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
```

- [ ] **Step 5: Update addLineItem**

Replace (~line 4795):
```javascript
const addLineItem = () => setLineItems(prev => [...prev, { description: "", costPrice: "", price: "" }]);
```

- [ ] **Step 6: Update the NewQuoteForm line item UI**

Apply the same UI pattern — cost/customer columns when margin > 0, warning banner, column headers, markup summary row. The NewQuoteForm has its own line item rendering section; find it and apply the same JSX as Task 5.

- [ ] **Step 7: Ensure sendQuote materialsText uses customer price only**

In `handleCreate` (~line 4824), verify the `materialsText` uses `item.price`:
```javascript
const materialsText = filledItems.map(i => i.description + (i.price ? " — $" + i.price : "")).join("\n");
```
This is correct — `item.price` is the customer price. But also ensure `breakdown.lineItems` stores the full objects (including `costPrice`) for the tradie's QuoteDetail view:

Check that the breakdown at ~line 4825 stores line items. It already does:
```javascript
lineItems: filledItems,
```
This will include `costPrice` since `filledItems` are the full objects. Correct.

- [ ] **Step 8: Verify in browser**

Create a manual quote with margin set. Confirm cost/customer columns work, total is correct.

- [ ] **Step 9: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add margin logic to NewQuoteForm"
```

---

### Task 8: Customer-Facing Output Audit

**Files:**
- Modify: `src/App.jsx` — QuotePreview, generateInvoicePDF, sendQuote paths

Audit all customer-facing data paths to ensure only `item.price` is used, never `item.costPrice`.

- [ ] **Step 1: Fix QuotePreview materials text — cost price leak (CRITICAL)**

At line 4160, the preview renders `editForm.materials` as raw text. This is the AI's original materials breakdown string which contains cost prices (e.g., "Copper pipe 15mm — $45"). When margin is applied, this would leak cost prices to the customer.

**Fix:** When margin > 0, rebuild `editForm.materials` from the line items using customer prices, or hide the raw text and only show the priced line items. The simplest fix is to hide the raw materials text when line items exist with individual prices:

In the AI generation handler, after building margin-applied line items, rebuild the `materials` text with customer prices:
```javascript
const materialsTextWithMargin = lineItems.filter(i => i.description?.trim()).map(i => i.description + (i.price ? " — $" + i.price : "")).join("\n");
```
Then set `materials: materialsTextWithMargin` in `setEditForm` instead of the raw AI text.

Also do the same in the `sendQuote` `materialsText` construction — it already uses `i.price` which is correct, but verify the `editForm.materials` field stored in the breakdown doesn't leak cost prices.

- [ ] **Step 2: Audit generateInvoicePDF**

Check `generateInvoicePDF` (~line 518). It reads `bd.lineItems` and `bd.materialsCost`. Since `materialsCost` is the sum of customer prices and `item.price` is the customer price, this is correct. No changes needed.

- [ ] **Step 3: Audit sendQuote in AIQuoteForm**

Check the `materialsText` construction in AIQuoteForm's `sendQuote` (~line 4414):
```javascript
const materialsText = (editForm.lineItems || []).filter(i => i.description.trim()).map(i => i.description + (i.price ? " — $" + i.price : "")).join("\n");
```
Uses `i.price` — correct. Customer only sees the marked-up price.

- [ ] **Step 4: Audit sendQuote in QuoteGenerator**

Find the equivalent `materialsText` construction in QuoteGenerator's sendQuote. Verify it uses `item.price`. Should be correct since it follows the same pattern.

- [ ] **Step 5: Audit invoice breakdown display**

Check the invoice breakdown display (~line 6369) which renders `breakdown.lineItems`. It uses `item.price` — correct. No `costPrice` leak.

- [ ] **Step 6: Commit (only if changes were needed)**

If any fixes were needed:
```bash
git add src/App.jsx
git commit -m "fix: ensure customer-facing outputs only show customer price"
```

---

### Task 9: QuoteDetail — Show Margin Info to Tradie

**Files:**
- Modify: `src/App.jsx` — QuoteDetail breakdown display (~line 5656)

- [ ] **Step 1: Update line item display to show cost vs customer price**

In QuoteDetail's breakdown display (~line 5659), the line items currently show:
```jsx
<span>{item.description}</span>
{item.price && <span style={{ color: theme.text, fontWeight: 500 }}>${parseFloat(item.price).toLocaleString()}</span>}
```

Update to show cost price when available:
```jsx
<span>{item.description}</span>
<span style={{ display: "flex", alignItems: "center", gap: 6 }}>
  {item.costPrice && parseFloat(item.costPrice) !== parseFloat(item.price) && (
    <span style={{ color: theme.textDim, fontSize: 12 }}>${parseFloat(item.costPrice).toLocaleString()} →</span>
  )}
  {item.price && <span style={{ color: theme.text, fontWeight: 500 }}>${parseFloat(item.price).toLocaleString()}</span>}
</span>
```

This shows "Cost → Customer Price" for items with margin, or just the price for old quotes without `costPrice`.

- [ ] **Step 2: Add markup summary in QuoteDetail breakdown**

After the line items section in QuoteDetail (~line 5665), add a margin summary:

```jsx
{bd.lineItems && bd.lineItems.some(i => i.costPrice && parseFloat(i.costPrice) !== parseFloat(i.price)) && (() => {
  const markupTotal = bd.lineItems.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) - (parseFloat(item.costPrice) || parseFloat(item.price) || 0)), 0);
  return markupTotal > 0 ? (
    <div style={{ fontSize: 12, color: theme.accent, marginTop: 4 }}>Materials markup: +${Math.round(markupTotal).toLocaleString()}</div>
  ) : null;
})()}
```

- [ ] **Step 3: Verify in browser**

View a quote that was sent with margin applied. Confirm the tradie sees cost → customer price on line items and the markup total.

View an old quote (pre-margin). Confirm it displays as before with no cost column.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: show margin info in QuoteDetail for tradie"
```

---

### Task 10: Draft Persistence

**Files:**
- Modify: `src/App.jsx` — AIQuoteForm (~line 4112) and WynflowApp screen rendering

- [ ] **Step 1: Save draft on screen change**

AIQuoteForm uses `generated` state (not a `step` variable) to track whether AI has produced results. Save form state on unmount:

```javascript
useEffect(() => {
  return () => {
    // Save draft on unmount (navigating away)
    if (form.customerName || form.customerEmail || editForm?.scope) {
      try {
        localStorage.setItem("wynflow_quote_draft", JSON.stringify({ form, editForm, hasGenerated: !!generated }));
      } catch (e) {}
    }
  };
}, [form, editForm, generated]);
```

Note: Photos (File objects) cannot be serialized to localStorage. The draft saves form data and editForm (pricing/scope) but not uploaded photos. This is an acknowledged limitation.

- [ ] **Step 2: Restore draft on mount**

At the top of AIQuoteForm, after the state declarations, add draft restoration:

```javascript
const [hasDraft, setHasDraft] = useState(false);
const [savedDraft, setSavedDraft] = useState(null);

useEffect(() => {
  try {
    const draft = JSON.parse(localStorage.getItem("wynflow_quote_draft") || "null");
    if (draft && (draft.form?.customerName || draft.editForm?.scope)) {
      setSavedDraft(draft);
      setHasDraft(true);
    }
  } catch (e) {}
}, []);

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
```

Note: When resuming a draft after margin change in Settings, the saved prices are kept as-is — the new margin does NOT re-apply to the restored draft.

- [ ] **Step 3: Add draft resume prompt UI**

At the top of the AIQuoteForm's render, before the main content:

```jsx
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
```

- [ ] **Step 4: Clear draft on successful send**

In the `sendQuote` function (AIQuoteForm), after successful send, add:

```javascript
try { localStorage.removeItem("wynflow_quote_draft"); } catch (e) {}
```

- [ ] **Step 5: Verify in browser**

1. Start a quote, fill in some details
2. Navigate to Settings
3. Come back to AI Quote
4. Confirm "Resume draft?" prompt appears
5. Click Resume — form is restored
6. Send a quote — draft is cleared

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add draft persistence to AIQuoteForm"
```

---

### Task 11: Final Verification

- [ ] **Step 1: End-to-end test — AI quote with margin**

1. Set materials margin to 20% in Settings
2. Create an AI quote
3. Confirm: line items show Cost → Customer Price columns
4. Confirm: materials markup summary shows correct amount
5. Confirm: total includes marked-up prices
6. Edit a cost price — customer price recalculates
7. Edit a customer price directly — total recalculates
8. Send the quote
9. View in QuoteDetail — margin info visible

- [ ] **Step 2: End-to-end test — manual quote with margin**

1. Create a manual quote via NewQuoteForm
2. Confirm same cost/customer column behaviour
3. Send and verify

- [ ] **Step 3: End-to-end test — zero margin**

1. Set margin to 0 in Settings
2. Create a quote
3. Confirm: single price column, warning banner
4. Confirm: everything works as before

- [ ] **Step 4: End-to-end test — draft persistence**

1. Start a quote, fill details
2. Navigate away (Settings)
3. Come back — resume prompt appears
4. Resume — state is restored

- [ ] **Step 5: Backward compatibility — old quotes**

1. View an existing quote created before this feature
2. Confirm: displays correctly, no errors, no costPrice column

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: materials margin — complete implementation"
```
