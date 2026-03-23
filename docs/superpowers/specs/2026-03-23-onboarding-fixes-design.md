# Onboarding Fixes — Design Spec

## Overview

Fix 6 onboarding issues: simplify signup form, redesign the tutorial into a setup wizard that saves data as you go, fix cross-device data loss, prevent tutorial re-showing on new devices, add empty dashboard guidance, and guard AI quoting against missing profile data.

## Problem

The current onboarding has several friction points:
1. Signup form has 10 fields — hourly rate, callout fee, and materials margin could wait
2. OnboardingTutorial is a passive walkthrough showing screenshots — the tradie watches but doesn't do anything
3. Cross-device email confirmation loses all signup data (localStorage-based)
4. Returning users on new devices see the tutorial again (localStorage/cookie-scoped)
5. Skipping the tutorial leaves an empty dashboard with no guidance
6. Tradies with missing rates can attempt AI quoting, producing bad results

## Fix 1: Simplify Signup Form

**Current:** 10 fields (business name, contact name, phone, trade, hourly rate, callout fee, materials margin, auto-follow-ups toggle, email, password)

**New:** 6 fields:
- Business Name (required)
- Your Name (required)
- Phone (required)
- Trade (required, dropdown)
- Email (required)
- Password (required)

**Removed from signup:** hourly rate, callout fee, materials margin, auto-follow-ups toggle. These move into the onboarding wizard (Fix 2). Auto-follow-ups defaults to `true` in the business record insert — no need to ask.

**Changes to `wynflow_pending_signup` localStorage:** Remove `hourlyRate`, `calloutFee`, `materialsMargin`, `autoFollowUps` fields. Only store: `businessName`, `contactName`, `email`, `phone`, `trade`, `plan`.

**Changes to business insert (both instant signup and email confirmation paths):** Default `hourly_rate: 0`, `callout_fee: 0`, `materials_margin: 0`, `auto_follow_ups: true`. These get updated during onboarding.

## Fix 2: Onboarding Wizard (replaces OnboardingTutorial)

Replace the passive 5-step walkthrough with a 4-step interactive setup wizard. Each step saves real data to the `businesses` table on "Next".

### Step 0: Welcome
- Title: "Welcome, [first name]!" (from `business.contact_name`)
- Subtitle: "Let's get you quoting in 2 minutes"
- Content: Brief paragraph about what Wynflow does. Same animated 5-icon flow diagram (Photos → AI Quote → Send → Follow-Up → Won) from the current tutorial — this visual is good, keep it.
- Button: "Let's Go →"

### Step 1: Your Rates
- Title: "Set Your Rates"
- Subtitle: "So AI quotes are accurate from day one"
- Fields (all optional, can skip):
  - **Hourly Rate ($)** — number input, placeholder "e.g. 85", helper: "Your standard hourly charge"
  - **Callout Fee ($)** — number input, placeholder "e.g. 50", helper: "One-off charge for showing up"
  - **Materials Markup %** — number input, placeholder "e.g. 20", helper: "Applied automatically to material costs in AI quotes"
- **Save on Next:** Update `businesses` table with any non-empty values. Fields left blank stay at 0. After saving, also update local state via `dispatch({ type: "SET_BUSINESS", payload: updatedBiz })` AND refresh the `wynflow_business` cookie with `setCookie("wynflow_business", updatedBiz, 43200)` — otherwise the session restore on next page load will hydrate stale rates.
- **Skip behaviour:** "Skip for now" link below Next button. Leaves rates at 0 — they can set them in Settings later.
- Button: "Next →"

### Step 2: Your Quote Request Link
- Title: "Your Quote Request Link"
- Subtitle: "Let customers come to you"
- Content: Same as current Step 4 — shows the live URL (`https://www.wynflow.co.nz/request/[business.id]`), functional Copy button, and the 4 sharing suggestion cards (Google Business, Facebook/Instagram, Website, Email signature).
- Button: "Next →"

### Step 3: Create Your First Quote
- Title: "You're All Set!"
- Subtitle: "Time to create your first quote"
- Content: Brief encouragement copy. Mention that AI generates quotes from photos + notes.
- Primary button: "Create My First Quote" (teal, prominent) — navigates to `aiQuote` screen, then calls `onComplete`
- Secondary link: "I'll explore first" — calls `onComplete`, stays on dashboard

### Wizard chrome
- Same modal overlay style as current tutorial (backdrop blur, centered card)
- Progress dots at top (4 dots, clickable)
- Back button from step 1 onward
- Step transitions use same CSS animations as current tutorial

### On complete
- Call `onComplete()` FIRST (sets `showOnboarding = false`, removing the modal), THEN navigate if applicable. This prevents the wizard being visible during screen transition.
- `onComplete` handler: update `businesses` set `onboarded = true`, dispatch `SET_BUSINESS` with updated business, refresh `wynflow_business` cookie
- Also set localStorage and cookie as fallback fast-check cache

## Fix 3: Device-Independent Onboarding Flag

**Problem:** Tutorial check uses localStorage + cookie — both device-scoped.

**New approach:** Add `onboarded` boolean column to `businesses` table (default `false`).

**Migration:** `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS onboarded boolean DEFAULT false;`

**Onboarding trigger logic:**
```
if (!business.onboarded) → show wizard
```

**On complete:** Update `businesses` set `onboarded = true`. Also keep localStorage/cookie writes as fast-check cache so we don't flash the wizard while waiting for the DB read.

**Backward compat for existing users:** Existing businesses have `onboarded = NULL` (column default is false). On first login, the check `!business.onboarded` would show the wizard to existing users. To prevent this: the onboarding trigger logic must **wait for `dataLoaded === true`** before evaluating, so quotes are available. Then check if the business has any quotes:

```
// CRITICAL: This check must run AFTER dataLoaded === true (quotes fetched)
// Place inside the useEffect that depends on [business?.id, dataLoaded]
if (!dataLoaded) return; // Wait for quotes to load first
if (!business.onboarded && quotes.length > 0) {
  // Existing user with quotes, auto-skip
  markOnboarded();
} else if (!business.onboarded) {
  // New user (no quotes), show wizard
  setShowOnboarding(true);
}
```

The existing onboarding `useEffect` (keyed on `business?.id`) must add `dataLoaded` as a dependency to avoid racing against async quote loading.

## Fix 4: Cross-Device Email Confirmation

**Problem:** If `wynflow_pending_signup` localStorage is missing when the email link is clicked, business gets placeholder data.

**Fix:** The simplified signup form (Fix 1) means the most critical fields (business name, trade, phone) are always stored in `wynflow_pending_signup`. If localStorage IS missing on the confirmation device, the email confirmation handler falls back to:
- `businessName: "My Business"` (existing fallback)
- `trade: ""`, `phone: ""` (existing fallback)

To catch this case: after business creation in the email confirmation handler, if `business.trade` is empty or `business.business_name === "My Business"`, show a **"Complete Your Profile" prompt** before the onboarding wizard. This is a simple modal with:
- Business Name (pre-filled if available)
- Phone
- Trade (dropdown)
- "Save & Continue" button

This modal only appears in the cross-device edge case. It blocks until filled in. Then the normal onboarding wizard starts.

**Detection:** Check `!business.trade || business.business_name === "My Business"` after email confirmation creates the business. If true, set a flag `needsProfileCompletion = true` and show the profile modal before the wizard.

## Fix 5: Empty Dashboard Guidance

**Problem:** Skipping the wizard or completing it without creating a quote leaves an empty dashboard.

**Fix:** When `quotes.length === 0`, show a **"Get Started" card** at the top of the Dashboard (above the pipeline cards, in the alerts area):

- **Background:** Teal soft glow (`rgba(20,184,166,0.06)`)
- **Icon:** `Sparkles` or `Cpu` (teal)
- **Heading:** "Create your first AI quote"
- **Copy:** "Snap some job site photos, add your notes, and let Wynflow's AI generate a professional quote in seconds."
- **Button:** "Create AI Quote" → navigates to `aiQuote`
- **Dismiss:** No explicit dismiss — card disappears once `quotes.length > 0`

Also update the existing empty states:
- **QuotesList:** Keep "No quotes yet — create your first one!" but make it a link/button to `aiQuote`
- **Schedule:** Already has good empty state, no change needed

## Fix 6: Guard AI Quoting Against Missing Profile

**Problem:** Tradie with no hourly rate or trade attempts AI generation — produces bad results.

**Fix:** In the AI quote generation handler (both `AIQuoteForm` and `QuoteGenerator`), before calling the N8N webhook:

```javascript
if (!business.trade) {
  dispatch({ type: "NOTIFY", payload: { message: "Please set your trade in Settings before generating a quote.", type: "error" } });
  return;
}
```

Don't block on missing hourly rate — AI can still generate material-only quotes. But do show a **soft warning** (non-blocking toast) if hourly rate is 0:
```
"Heads up — your hourly rate isn't set yet. Labour costs will be $0. Set your rate in Settings."
```

This warns but doesn't block — the tradie might be sending a materials-only quote intentionally.

## Files to Modify

| File | Changes |
|------|---------|
| `src/App.jsx` — AuthScreen | Remove hourly rate, callout fee, materials margin, auto-follow-ups from signup form. Update pending signup localStorage. |
| `src/App.jsx` — OnboardingTutorial | Replace passive walkthrough with interactive 4-step wizard. Step 1 saves rates to DB. |
| `src/App.jsx` — WynflowAppInner | Update onboarding trigger to check `business.onboarded` + quotes count. Add profile completion modal for cross-device edge case. |
| `src/App.jsx` — Dashboard | Add "Get Started" card when `quotes.length === 0`. |
| `src/App.jsx` — AIQuoteForm | Add trade check + hourly rate warning before generation. |
| `src/App.jsx` — QuoteGenerator | Same trade check + hourly rate warning. |
| `src/App.jsx` — email confirmation handler | Check for incomplete profile after business creation. |
| `supabase/migrations/009_add_onboarded_column.sql` | Add `onboarded` boolean column to businesses. |

## Not in Scope

- Redesigning the signup page layout/visuals
- Changing the email confirmation flow itself (Supabase-managed)
- Adding a progress bar to Settings
- Multi-step signup (all fields stay on one page)
