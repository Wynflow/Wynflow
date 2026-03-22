# Materials Margin — Design Spec

## Overview

Add materials markup/margin to Wynflow's quoting system. Tradies set a default markup percentage that auto-applies to AI-generated material costs. Customers only see the marked-up price. Tradies see cost vs customer price when editing quotes.

## Problem

Currently, AI-generated material prices go straight onto quotes with no margin. Tradies make money on materials in the real world but have no way to build that into Wynflow quotes. They'd have to manually inflate each line item every time.

## Solution: Global Default + Per-Item Override

### Data Model

**`businesses` table** — one new column:
- `materials_margin` (numeric, default 0) — global markup percentage (e.g. 20 = 20%)

**Line item structure** — currently `{ description, price }`, changes to:
```
{ description, costPrice, price }
```
- `costPrice` — what the tradie pays (AI-generated or manually entered)
- `price` — what the customer sees: `costPrice * (1 + materials_margin / 100)`

**`breakdown` JSON** (stored in `ai_estimate_notes`) — include `costPrice` per item so margin data persists with the quote.

**No changes to `quotes` table** — `amount` remains the customer-facing total. Margin data lives in the breakdown JSON.

**Backward compatibility:** Old quotes (pre-margin) have line items with `{ description, price }` and no `costPrice`. When parsing these, treat missing `costPrice` as equal to `price` (i.e., zero margin). No migration needed for existing breakdown JSON.

**Validation:** `materials_margin` must be >= 0. Cap at 200 to prevent nonsensical values.

### Signup Form

Add one field (after hourly rate / callout fee area):
- **Label:** "Materials markup %"
- **Type:** number input
- **Placeholder:** "e.g. 20"
- **Helper text:** "How much do you mark up materials? Applied automatically to AI quotes."
- **Saved as:** `materials_margin` on the business record
- **Default:** 0 (no markup)
- **Pending signup path:** Must also be stored in `wynflow_pending_signup` localStorage and restored in the email-confirmation business creation path (same as `autoFollowUps`)

### Settings (Pricing & AI Estimates section)

Add the same field alongside hourly rate and callout fee:
- **Label:** "Default Materials Markup %"
- **Type:** number input
- **Helper text:** "How much do you mark up materials? Applied automatically to AI quotes."
- **Saved with:** `saveSettings` updates — must be added to both the `useState` init and the `updates` object in `saveSettings` (line ~7692)

### AI Quote Generation Flow

After AI returns results (in `AIQuoteForm` generate handler and `QuoteGenerator`):

1. AI returns materials with prices — these become `costPrice` on each line item
2. Read `business.materials_margin` (e.g. 20)
3. Auto-calculate `price` for each item: `Math.round(costPrice * (1 + margin / 100) * 100) / 100`
4. `materialsCost` = sum of customer `price` values (not cost prices)
5. `recalcTotal()` works as before — sums line item prices + labour + callout

When margin is 0 or not set: `costPrice === price`, no behaviour change.

### Recalculation Chain (CRITICAL)

Every edit to any price field must recalculate everything downstream. No orphaned values.

1. **Edit line item customer price** → that item's effective margin updates → `materialsCost` recalculates (sum of all customer prices) → `total` recalculates
2. **Edit line item cost price** → margin re-applies to get new customer price → `materialsCost` recalculates → `total` recalculates
3. **Edit labour hours** → labour cost changes → `total` recalculates
4. **Add/remove line item** → `materialsCost` recalculates → `total` recalculates

The existing `recalcTotal()` handles the final sum. Every edit path through cost prices and customer prices must feed back into it.

### Quote Edit Screen UI

**When margin > 0 and breakdown is shown:**

Each line item row shows:
```
Copper pipe 15mm (3m)     Cost: $45   →   $54
Tap mixer — Methven       Cost: $189  →   $227
```
- Left: description + cost price (muted text, editable)
- Right: customer price (editable — changing it changes that item's effective margin)
- Summary row below materials: "Materials markup: +$47" in muted/teal text
  - Formula: `sum(price - costPrice)` across all line items (NOT `materialsCost * margin / 100`, because individual items may have been manually adjusted)

**When margin is 0:**
- Line items show as today — description and price, no cost column
- Warning banner (amber/info style, non-blocking):
  - Text: "No materials markup set — these prices are at cost."
  - Link: "Set your markup in Settings" → navigates to Settings screen
  - Tradie can still send the quote without margin if they choose

### Customer-Facing Output

**No changes.** Customer sees only the final `price` per item in:
- Quote preview modal
- Sent email
- PDF attachment
- Public quote response page

No cost prices, no margin percentages, no markup info visible to customers anywhere.

### Draft Persistence (Companion Feature)

Prevents losing quote progress when navigating away (e.g. to Settings to set margin).

- **On navigate away from `aiQuote` screen:** save `form` + `editForm` + current step to `localStorage` key `wynflow_quote_draft`
- **On mounting `AIQuoteForm`:** check for saved draft, show "You have a draft quote — resume?" prompt
- **On successful send or explicit discard:** clear the localStorage draft
- **Key format:** `wynflow_quote_draft` (single draft at a time)

### Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Existing users, no margin set | Works exactly as today, margin = 0, costPrice === price |
| Tradie manually edits customer price | costPrice stays, effective margin on that item changes, total recalculates |
| Tradie manually edits cost price | Margin re-applies to get new customer price, total recalculates |
| Tradie adds new line item manually | Tradie types into costPrice field, margin auto-applies to calculate customer price. New item created as `{ description: "", costPrice: "", price: "" }` |
| Margin changed in Settings mid-quote | Only affects future quotes, not the one currently being edited |
| GST interaction | GST calculates on customer price (after margin), same as today |
| Callout fee | No margin applied — it's the tradie's own charge |
| Labour | No margin applied — already the tradie's hourly rate |
| Old quotes (pre-margin) reopened | Missing `costPrice` treated as `costPrice === price`, zero margin display |
| Draft resumed after margin changed in Settings | Draft keeps its saved prices, does NOT re-apply new margin |

### Customer-Facing Data Paths (CRITICAL)

These code paths output data visible to customers. They must ONLY reference `item.price` (customer price), never `item.costPrice`:

- `materialsText` construction in `sendQuote` (line ~4414) — builds description string
- `breakdown.materials` in the quote's `description` field
- `generateInvoicePDF` — PDF line items
- Quote preview modal — line item display
- N8N webhook payloads — quote data sent to email templates

### NewQuoteForm (Manual Quotes)

`NewQuoteForm` also has line items with its own `updateLineItem`, `addLineItem`, `removeLineItem` (~line 4785). It gets the same margin treatment:
- Line items use `{ description, costPrice, price }` structure
- Margin auto-applies when costPrice is entered
- Same cost→price display when margin > 0
- Same no-margin warning banner
- Its own `recalcTotal` must be updated

### Three Code Copies to Update

The codebase has three independent copies of recalc/line-item logic. ALL three must be updated:

1. **AIQuoteForm** (~lines 4355-4398) — `recalcTotal`, `updatePricing`, `updateLineItem`, `addLineItem`, `removeLineItem`
2. **QuoteGenerator** (~lines 5267-5306) — same set of functions
3. **NewQuoteForm** (~lines 4785-4797) — same set of functions

### QuoteDetail View

When a tradie views a sent quote in `QuoteDetail`, the breakdown display should show cost vs customer price (same as the edit screen) so the tradie can see their margin on past quotes. This is tradie-only — not customer-facing.

### Files to Modify

| File | Changes |
|------|---------|
| `src/App.jsx` — AIQuoteForm | Line item structure (costPrice/price), margin application after AI generation, edit UI with cost→price display, no-margin warning banner, draft save/restore |
| `src/App.jsx` — QuoteGenerator | Same margin logic as AIQuoteForm (separate copy of recalc functions) |
| `src/App.jsx` — NewQuoteForm | Same margin logic (separate copy of recalc functions) |
| `src/App.jsx` — recalcTotal / updatePricing / updateLineItem (x3 copies) | All three copies updated for costPrice→price flow |
| `src/App.jsx` — QuotePreview | Only renders customer `price`, no cost info |
| `src/App.jsx` — QuoteDetail | Show cost vs customer price in breakdown for tradie view |
| `src/App.jsx` — generateInvoicePDF | Only uses customer `price` for PDF — audit for costPrice leaks |
| `src/App.jsx` — sendQuote (x3 paths) | `materialsText` must only use `price`, never `costPrice` |
| `src/App.jsx` — AuthScreen (signup) | Add materials markup % field + persist in pending signup localStorage |
| `src/App.jsx` — Settings | Add materials markup % to both useState init and saveSettings updates object |
| `supabase/migrations/` | Add `materials_margin` column to `businesses` |

### Not in Scope

- Per-category margins (e.g. different margins for fixtures vs consumables)
- Margin reporting/analytics
- Margin on labour or callout fees
- Price list integration with margin (future consideration)
