# Onboarding Rebuild — Interactive Demo Quote + Signup Shrink

**Date:** 2026-04-10
**Status:** Design — awaiting user review
**Track:** B (from Wynflow improvement roadmap)

## Problem

70% of real Wynflow signups never create a single quote. Of 36 real users (excluding test accounts), only 11 have activated. The current onboarding does not actually activate users — it educates them, then abandons them on a blank dashboard.

### Data (Supabase query, 2026-04-10)

| Metric | Value |
|---|---|
| Real signups | 36 |
| Activated (≥1 quote) | 11 (30%) |
| Never quoted (drop-offs) | 25 (70%) |
| Drop-offs who filled `trade` | 25 / 25 (100%) |
| Drop-offs who filled `hourly_rate` | 21 / 25 (84%) |
| Drop-offs who filled `price_list` | 0 / 25 (0%) |
| Drop-offs who marked `onboarded = true` | 9 / 25 (36%) |
| Drop-offs signed up in last 7 days | 0 |

### Five root causes

1. **Signup form is too heavy.** 5 required business fields + email + password = 7 fields for "free trial, no card". Every field is a drop-off.
2. **Current walkthrough is passive marketing, not activation.** `OnboardingTutorial` is a 5-slide carousel showing phone mockups. 9 drop-offs finished it and still never quoted.
3. **"Create your first AI quote" assumes the user has a real job to photograph.** A brand-new tradie at 9pm on the couch does not. Empty uploader → cold feet → bail.
4. **Price list in Settings is a dead zone.** 0 of 25 drop-offs filled it in.
5. **No bridge from "finished onboarding" to "first action".** The walkthrough ends with 3 nav cards. No continuous arc into doing something.

## Goals

- **Primary:** Reduce drop-off rate from 70% → below 40% (so 60%+ activate vs current 30%).
- **Primary:** Get new users to see an AI-generated quote with their own business name on it within 90 seconds of landing on the signup page.
- **Secondary:** Reduce signup form friction from 7 fields to 3.
- **Secondary:** Rescue existing never-activated users with a one-time "try the new demo" banner on their dashboard.

## Non-goals

- No change to the public landing pages (home, pricing, about).
- No change to the quote generation AI, the price list feature, the Settings UI, or the follow-up system.
- No new Supabase schema changes (only re-use existing nullable columns).
- No demo data for rare trades — we ship 5 scenarios covering the most common trades; less common trades see a generic demo.

## Approach — Interactive Demo Quote + Signup Shrink

### High-level flow

**Old flow:**
```
Signup form (7 fields) → email verify → Dashboard → [modal] 5-slide walkthrough → Dashboard (blank)
```

**New flow:**
```
Signup form (3 fields) → email verify → Demo screen: "What do you do?" (trade picker) →
Demo scenario auto-picked → Pre-loaded photos shown → "Generate AI Quote" button →
Real AI quote generated with user's business name → "Send to yourself" / "Make a real one" →
Dashboard (now has 1 demo quote in history, so not empty)
```

The key insight: **the user's first action inside Wynflow is using the core product**, not watching a marketing video.

### Detailed flow

1. **Signup screen** — collects only:
   - Business name (required)
   - Email (required)
   - Password (required)

   Dropped from signup: contact_name, trade, phone. These become nullable deferred fields.

2. **After email verification** → land on new `DemoOnboarding` screen (replaces `OnboardingTutorial`):

   **Step 1: Pick trade** (5 seconds)
   - Single question: "What do you do?"
   - Dropdown of TRADE_CATEGORIES
   - Used to pick a matching demo scenario
   - Saved to `business.trade` immediately

   **Step 2: Demo quote preview** (one screen, no carousel)
   - Pre-loaded photos (3 scenario photos bundled in `public/demo-photos/<scenario>/`)
   - Pre-filled customer: "Sam Tester" — email "demo@wynflow.co.nz" (clear disclaimer: "This is a demo customer")
   - Pre-filled job title: e.g. "Bathroom renovation" / "Fence repair" / "Panel upgrade"
   - Pre-filled notes: 2-3 sentences describing the scenario
   - **Big button: "Generate AI quote →"**

   **Step 3: "Generate" the demo quote** (shows brief spinner for effect)
   - **v0 design decision:** Uses a **hardcoded sample quote** per scenario, not a real AI call. The hardcoded sample is interpolated with the user's actual `business_name` so it feels personal.
   - **Why hardcoded, not real AI for v0:** The existing `/webhook/generate-quote` endpoint requires `customer_email`, `customer_phone`, `hourly_rate`, `trade`, `quote_history`, `price_list` and more — fields the brand-new user hasn't filled in yet. Forcing the AI to work around these gaps introduces risk, cost, and edge cases that would delay shipping. A hardcoded sample is (a) zero cost, (b) 100% reliable, (c) instant, (d) clearly labeled as "Sample" (honest), (e) unblocks v0 immediately.
   - **Labeling:** The demo result is labeled clearly at the top: **"SAMPLE QUOTE"** badge + subtitle "This is what Wynflow produces from a job photo and notes. Your real quotes will use our AI."
   - **v1 upgrade path:** Once the user has set their hourly rate (via the lazy profile modal or Settings), we can add an opt-in "Generate a REAL sample using AI" button that calls the real webhook. Out of scope for v0.
   - **Not saved to the quotes table.** The sample lives only in component state. A `demo_completed_at` column on `businesses` will track completion for analytics (see schema change below).

   **Step 4: See the result** (the "aha")
   - Full quote preview shown on screen (reuses existing `QuotePreview` component where possible)
   - Two CTAs:
     - **Primary: "Great — let me make a real one →"** → navigates to `aiQuote` screen (the real quote flow)
     - **Secondary: "Skip for now →"** → dashboard
   - No "send to my email" option in v0 — keeps the implementation simple. Can be added in v1 if demand exists.

3. **First real quote** — when the user hits Send on their first real quote (not demo), show a small inline modal: "One last thing — what's your mobile and full name? Customers need this to reach you." Collects `contact_name` and `phone` lazily. This avoids re-creating the same 5-field signup form.

4. **Existing user rescue** (simpler path): for users with `quotes.length === 0`, dashboard shows a one-time dismissible banner: "Try the new 30-second demo quote →" pointing to the DemoOnboarding flow. Dismissed state is stored in localStorage + business row (`demo_banner_dismissed` — new nullable column, OR just localStorage-only for v1 simplicity).

### Demo scenarios

Bundled in `public/demo-photos/<scenario>/` — 2-3 JPEGs per scenario, ~200-400 KB each, sourced from Pexels (free, commercial license).

| Trade category | Scenario | Job title | Notes |
|---|---|---|---|
| Plumber, Gasfitter, Drainlayer | bathroom-reno | Bathroom renovation | Full reno — tiling, new vanity, shower regrout, toilet replacement |
| Electrician | panel-upgrade | Switchboard upgrade | Replace old fuse board with new 24-way RCD board + rewire mains |
| Builder, Carpet Layer, Painter, Tiler, Plasterer, Concreter | deck-build | Deck construction | Build 4x3m timber deck off back door, includes stairs and railing |
| Landscaper, Fencer | fence-replace | Fence replacement | Remove old 20m colorsteel fence, install new timber post-and-rail |
| Roofer, Handyman, Cleaner, Carpenter (other) | roof-repair | Roof repair | Replace 6 cracked concrete tiles, reseal ridge line |
| *Any other / fallback* | bathroom-reno | Bathroom renovation | (Safe default most tradies understand) |

Scenario picker: `const scenario = DEMO_SCENARIOS[trade] || DEMO_SCENARIOS.default;`

### Data model — one small schema change

- `businesses.demo_completed_at timestamptz NULL` — **new column, new migration 011**. Set when the user finishes the demo AI quote (or dismisses the demo). Used to (a) know when NOT to show the rescue banner to existing stuck users, (b) track activation funnel for analytics.
- `businesses.contact_name` — **already NOT NULL**. To defer this, we default it to `business_name` at signup time (so the DB constraint is satisfied without asking the user). User can edit later in Settings.
- `businesses.phone` — already nullable, no change.
- `businesses.trade` — already nullable, no change.
- `quotes.source` — NOT used for demo quotes in v0, since demo quotes are not saved to the DB at all.

Optional v2: add `businesses.demo_banner_dismissed boolean` for cross-device dismissal. Not in v1 — localStorage is fine for the dismissal state.

### UI components

**Changes to existing components (`src/App.jsx`):**

1. **`AuthScreen`** (line 2622) — remove the `contact_name`, `trade`, `phone` inputs and their validation. Keep only `business_name`, `email`, `password`. On signup insert, default `contact_name = business_name`.

2. **`OnboardingTutorial`** (line 9645) — replaced entirely by `DemoOnboarding`. The old component is deleted.

3. **`WynflowApp`** (around line 10164) — the `showOnboarding` trigger logic stays the same (business not onboarded + no quotes), but renders the new component.

4. **`Dashboard`** — add the one-time "try the demo" banner for never-activated users. Simple conditional card.

**New component (in App.jsx, same pattern as existing):**

5. **`DemoOnboarding`** — a full-screen modal with 4 steps (pick trade → preview → generate → result). Uses inline styles matching existing glass/teal aesthetic.

6. **`LazyProfileModal`** — a small modal that prompts for contact_name + phone on first real Send. Only shows if those fields are still null/empty.

**Helper additions:**

7. **`DEMO_SCENARIOS` constant** — mapping of trade category → scenario key.
8. **`demoScenarioData(scenarioKey, businessName)`** — returns `{ photos, customerName, customerEmail, jobTitle, description }` ready to feed into the quote generation flow.

### Public assets

- `public/demo-photos/bathroom-reno/{1,2,3}.jpg`
- `public/demo-photos/panel-upgrade/{1,2,3}.jpg`
- `public/demo-photos/deck-build/{1,2,3}.jpg`
- `public/demo-photos/fence-replace/{1,2,3}.jpg`
- `public/demo-photos/roof-repair/{1,2,3}.jpg`

Total: 15 JPEGs, ~3-6 MB bundled. Served as static assets, no external dependencies.

**Note:** I will NOT download and bundle these photos in v1 implementation — I will use **colored gradient placeholders with emoji icons** (e.g. 🚿 for bathroom) as a v0 to validate the flow works, then swap in real photos in a follow-up commit. This keeps the initial PR focused on code logic, not asset curation.

### Error handling

- **AI generation fails during demo:** Show an error card — "Our AI is having a moment. Try again, or skip to the dashboard." Track failure to N8N error webhook.
- **Network offline during signup:** Standard existing handling (signup fails, user retries).
- **User already has `trade` set (from old signup flow):** Skip the trade-picker step, go straight to demo preview with their existing trade's scenario.
- **User has no matching demo scenario:** Fall back to `bathroom-reno` as the safe default.
- **Demo photos fail to load:** Show a camera icon placeholder; AI generation still proceeds with just the notes.

### Rollout

1. New users see the new flow immediately.
2. Existing users with `onboarded = true` AND `quotes.length > 0` → no change (they've already activated).
3. Existing users with `onboarded = true` AND `quotes.length === 0` (the 9 stuck users) → show the one-time "try the demo" banner on their dashboard.
4. Existing users with `onboarded = false` → see the new flow on next login.

No database migration needed for rollout — everything is driven by existing columns and runtime checks.

### Success metrics

Measured weekly via Supabase queries:

1. **Signup → first quote sent:** 30% → 60% (2× improvement, primary success criterion)
2. **Median time to first quote:** unknown → under 5 minutes
3. **Signup → AI quote generated:** new metric, target 70%+
4. **Signup field drop-off:** not measurable without client-side analytics (deferred)
5. **Lazy profile completion rate:** (for v2 — how many users finish contact_name + phone on first real send)

### Testing plan

**Manual (in dev):**
- Sign up with a new email → verify → should land on DemoOnboarding
- Pick a trade → demo preview should load with right scenario
- Hit Generate → real AI quote should be generated
- See result → hit "Make a real one" → should land on aiQuote screen
- Go to Dashboard → should see the demo quote in recent quotes
- Log out, sign in as existing user with no quotes → should see banner
- Log out, sign in as existing user with quotes → no banner

**Build / compile:**
- `npx vite build` must pass with no new warnings.

**Database:**
- Verify new users land in `businesses` with `contact_name = business_name` when not provided.
- Verify demo quote has `source = 'demo'` in the quotes table.

**No automated tests in v1** — Wynflow currently has no test suite. Adding tests is in Track F (code quality foundation), out of scope here.

### Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Demo quote looks fake / confuses user | High | Clear "DEMO" label on the quote preview. Confirmation before sending to self. |
| Shrinking signup makes auth harder to debug | Low | Defer fields are still collected at first Send — full profile still ends up complete for active users. |
| Existing users dislike the new UX | Medium | They're not forced into it. Only drop-offs see the banner, and it's dismissible. |
| AI generation from fake photos produces nonsense | Medium | Use placeholder gradients in v0; add real photos in follow-up. Validate AI output before showing. Fallback: show a canned demo quote if AI fails. |
| Users get stuck on the demo screen and never leave | Low | Always have a "Skip for now" button that lands them on dashboard. |
| User expects the demo quote to persist and it doesn't | Low-Medium | Make the flow clearly transitional ("See what Wynflow can do" not "Your first quote"). Button text "Make a real one" implies the demo was not real. |

### Out of scope for this spec

- Real demo photo curation (follow-up commit)
- Changes to the AI quote generator itself
- Changes to follow-up email templates
- Xero integration
- Mobile-specific native features
- Voice-to-quote
- Any compliance features (that's Track E)
- Test automation (Track F)

## Implementation order

Once this spec is approved, the writing-plans skill will break this into concrete tasks. Rough order:

1. Create migration 011 for `demo_completed_at` column, apply to live DB
2. Shrink `AuthScreen` signup form — remove contact_name/trade/phone inputs, default contact_name = business_name on insert
3. Add `DEMO_SCENARIOS` constant + `demoScenarioData()` helper
4. Build `DemoOnboarding` component (biggest chunk — ~250 lines)
5. Rewire `WynflowApp` onboarding trigger to render `DemoOnboarding` instead of `OnboardingTutorial`
6. Delete `OnboardingTutorial` (it's dead code after the rewire)
7. Build `LazyProfileModal` (smaller modal, ~80 lines)
8. Wire `LazyProfileModal` into AI quote Send flow — only show if contact_name missing
9. Add "try the demo" rescue banner to Dashboard empty state
10. Verify `npx vite build` passes with no new warnings
11. Commit plan: one commit per logical chunk (migration, signup shrink, demo onboarding, rescue banner) — 4 commits total

## Self-review notes

**Placeholder scan:** None.

**Internal consistency:** Flow description matches component changes. Data model notes match rollout plan.

**Scope check:** Single cohesive change (onboarding rebuild). Does not mix in unrelated refactors. Good.

**Ambiguity check:**
- "Demo photos" — explicitly says "v0 = gradient placeholders, v1 = real photos as follow-up."
- "Existing user rescue banner" — explicitly says localStorage-only in v1.
- "source='demo'" — disambiguated from 'historical' in risks.

**Resolved ambiguities before final write:** All clear.
