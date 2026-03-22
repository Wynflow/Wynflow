# Job Scheduling — Design Spec

## Overview

Add job scheduling to Wynflow. When a tradie books a quote, they schedule it onto a built-in calendar. Week view with drag-to-move, drag-to-resize, employee tags, job status tracking, and a detail panel. Internal tool only — customers don't see the calendar.

## Problem

After a customer accepts a quote, the tradie taps "Mark as Booked" and Wynflow records `booked_at = now`. That's it. There's no way to schedule when the job actually happens. Tradies have to remember dates in their head or use a separate calendar app. There's no visibility into upcoming workload, no way to assign crew, and no way to track job progress.

## Solution: Built-in Calendar + Quote Integration

### Data Model

**New `jobs` table:**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid, PK, default gen_random_uuid() | |
| `business_id` | uuid, FK → businesses.id | |
| `quote_id` | uuid, FK → quotes.id, nullable | Links to source quote (null for standalone jobs) |
| `title` | text | Job title (copied from quote or manually entered) |
| `customer_name` | text | |
| `customer_phone` | text, nullable | |
| `customer_email` | text, nullable | |
| `address` | text, nullable | Job site address |
| `starts_at` | timestamptz | When the job starts |
| `ends_at` | timestamptz | When the job ends |
| `all_day` | boolean, default false | When true, job has no specific times — renders in the all-day row spanning full calendar days. When false, job uses `starts_at`/`ends_at` times and renders on the hour grid (even if it spans multiple days) |
| `status` | text, default 'scheduled' | `scheduled` → `in_progress` → `completed` (also `cancelled`) |
| `assigned_to` | text[], default '{}' | Employee name tags (simple strings) |
| `notes` | text, nullable | Tradie's private job notes |
| `color` | text, nullable | Optional custom colour override |
| `amount` | numeric, nullable | Copied from quote for reference |
| `completed_at` | timestamptz, nullable | When job was marked complete |
| `created_at` | timestamptz, default now() | |

**`businesses` table — one new column:**
- `employee_tags` (text[], default '{}') — autocomplete list of previously used employee names

**Why a separate `jobs` table?** Quotes are about pricing and customer communication. Jobs are about scheduling and execution. A quote can exist without a job (declined quotes). A job can exist without a quote (ad-hoc work, phone calls). Keeping them separate avoids bloating the quotes table.

**RLS policy:** `business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())` — matches the pattern used by other tables. Jobs are only visible to their owning business.

**Indexes:**
- `(business_id, starts_at)` — primary calendar query (load jobs for a date range)
- `(quote_id)` — lookup whether a booked quote has a linked job

**Migration file:** `supabase/migrations/008_create_jobs_table.sql` — must include table creation, RLS enable, RLS policy, indexes, and the `employee_tags` column addition to `businesses`.

### Mobile Navigation Redesign

The current mobile bottom tab bar has 6 items (Dashboard, Quotes, Analytics, Follow-Ups, Help, Settings). Adding Schedule makes 7 — too crowded for mobile.

**New mobile nav: Hamburger + 3 bottom shortcuts**

**Bottom tab bar (3 items only):**
- Dashboard (lucide `LayoutDashboard`)
- Quotes (lucide `FileText`)
- Schedule (lucide `CalendarDays`)

These are the highest-frequency screens. Same frosted glass style as current bottom bar.

**Hamburger menu (everything else):**
- Trigger: hamburger icon (lucide `Menu`) in the top header bar, right side
- Opens: slide-out drawer from the right
- Style: frosted glass panel (`rgba(255,255,255,0.03)` + `backdropFilter: blur(16px)`), dark overlay backdrop (`rgba(0,0,0,0.5)`)
- Items: Dashboard, Quotes, Schedule, Analytics, Follow-Ups, Help, Settings — stacked vertically with icons
- Close: tap backdrop, tap X button, or swipe right on panel
- Current screen highlighted with teal accent

**Desktop sidebar unchanged** — this change is mobile-only. Desktop sidebar gets "Schedule" added between Quotes and Analytics.

### Calendar View

**New sidebar/tab item: "Schedule"** — between Quotes and Analytics. Icon: `CalendarDays`.

**Week view layout:**
- **Navigation bar:** Left/right arrows to navigate weeks, "Today" button to jump back, week date range displayed (e.g. "17 – 23 Mar 2026")
- **All-day row:** Multi-day jobs sit in a bar across the top spanning their date range
- **Hour grid:** 6am–8pm rows, Mon–Sun columns. Each cell is a 1-hour slot
- **Job blocks:** Coloured rectangles positioned on the grid spanning their start→end time
- **"+" button:** Floating action button (bottom-right on mobile, top-right on desktop) to create a standalone job

**Interactions:**
- **Drag to move** — grab a job block, drop on a different day/time. Updates `starts_at` and `ends_at` (preserving duration)
- **Drag bottom edge to resize** — extend or shorten duration. Updates `ends_at`
- **Tap/click** — opens job detail panel
- **Double-click empty slot** (desktop) / **long-press** (mobile) — quick-create a new job at that time

**Colour coding (filter-based):**

The colour mode is determined by the **active filter pill**, not by whether employees are assigned:

- **"All" filter active (default):** blocks coloured by status
  - Scheduled: teal (`#14B8A6`)
  - In Progress: amber (`#F59E0B`)
  - Completed: green (`#22C55E`) at 50% opacity
  - Cancelled: red (`#EF4444`) at 30% opacity
- **Employee filter active (e.g. "Dave"):** blocks coloured by that employee's assigned colour. Status becomes a small coloured dot in the top-right corner of each block. This lets the tradie see at a glance what Dave's week looks like while still knowing which jobs are in progress vs scheduled.

**Mobile adaptation:**
- Week view compresses to a scrollable day view (swipe left/right between days) with a mini week header showing dots for days with jobs
- Drag-to-move and drag-to-resize are replaced with tap-to-open, then "Move" and "Extend" buttons in the detail panel
- Touch-friendly: job blocks have minimum 44px tap target

**Library:** react-big-calendar (MIT licensed, well-maintained, supports week/day/month views, drag-and-drop via `react-big-calendar/lib/addons/dragAndDrop`). Supports custom event styling via `eventPropGetter`. Works with inline styles.

### Quote → Job Flow

**Current flow:** Tradie taps "Mark as Booked" → `booked_at = now` → toast "Job booked!" → navigate back.

**New flow:**

1. Tradie taps **"Mark as Booked"** on an accepted quote (in QuoteDetail)
2. A **schedule modal** slides up, pre-filled with:
   - **Title:** quote's `job_title`
   - **Customer:** `customer_name`, `customer_phone`, `customer_email` from quote
   - **Date:** defaults to next business day (Mon–Fri)
   - **Time:** defaults to 8:00 AM
   - **Duration:** defaults to 2 hours. Toggle to "Multi-day" switches to start date → end date pickers
   - **Assign to:** tag input with autocomplete from `business.employee_tags`
   - **Address:** empty text input
   - **Notes:** empty textarea
   - **Amount:** shown read-only, pulled from quote
3. Tradie fills in date/time, taps **"Book & Schedule"**
4. Behind the scenes:
   - Quote updated: `status: "booked"`, `booked_at: now`, `follow_up_paused: true`
   - Job inserted: all fields from the modal, `quote_id` linked
   - New employee names added to `business.employee_tags`
5. Toast: "Job booked and scheduled!"
6. Navigate to Schedule view, scrolled to the job's date

**Skip option:** A "Book without scheduling" text link below the main button. Preserves current behaviour — marks quote as booked with no job record. The tradie can schedule later from:
- QuoteDetail (a "Schedule this job" button appears on booked quotes that have no linked job)
- The calendar "+" button (manually, without quote link)

**QuoteDetail booked card changes:**

The existing green "Job Booked!" card in QuoteDetail (~line 6016) updates based on whether a linked job exists:

- **Booked + job exists:** Card shows "Job scheduled for [date] at [time]" with a "View on Calendar →" link that navigates to Schedule view scrolled to that date. Also shows assigned employee tags if any.
- **Booked + no job:** Card shows current "Booked on [date]" text plus a teal "Schedule this job" button that opens the JobFormModal pre-filled from the quote.

### Job Detail Panel

Opens when a tradie taps a job on the calendar. **Slide-over panel** — from right on desktop (calendar stays visible), from bottom on mobile.

**Contents:**
- **Header:** Job title + status badge (coloured pill matching calendar colours)
- **Customer card:** Name, phone (`tel:` link), email (`mailto:` link), address
- **Schedule card:** Date, time, duration — all editable inline. Multi-day toggle.
- **Assigned to:** Tag pills with tap-to-edit
- **Notes:** Editable textarea with save button
- **Quote link:** "View Quote →" button (if `quote_id` is set). Opens QuoteDetail with back navigation to calendar
- **Amount:** Read-only reference from quote (if linked)

**Action buttons (bottom of panel):**

| Current Status | Actions |
|---|---|
| Scheduled | "Start Job" (→ in_progress), "Cancel Job" (→ cancelled) |
| In Progress | "Mark Complete" (→ completed, sets `completed_at`), "Back to Scheduled" |
| Completed | "Reopen" (→ scheduled), "Generate Invoice" (if linked to quote) |
| Cancelled | "Reschedule" (→ scheduled) |

**"Generate Invoice"** navigates to the existing invoice creation flow (`createInvoice:quoteId`), same as the current button on QuoteDetail. Only appears when `quote_id` is set. **Standalone jobs (no quote) cannot generate invoices in v1** — the invoice system requires a quote as its data source.

### Employee Tags

Simple string-based tagging — no employee records, no logins.

**How it works:**
- Tradie types a name in the "Assign to" field on any job
- Autocomplete suggests from `business.employee_tags`
- New names are appended to `business.employee_tags` on first use
- No dedicated management UI — tags emerge from usage

**Calendar filtering:**
- Row of pills above the calendar: "All" + each unique tag from `business.employee_tags`
- Tap to filter — only that person's jobs show
- "All" shows everyone

**Colour assignment:**
- Each employee tag gets a colour from a preset palette, assigned by index in `employee_tags` array:
  - `["#3B82F6", "#F97316", "#A855F7", "#EC4899", "#06B6D4", "#84CC16", "#EAB308", "#6366F1"]`
- Job block background uses the first assigned employee's colour
- If multiple employees, a small "+N" badge shows on the block
- Status is indicated by a small dot in the top-right corner of the block

### Standalone Jobs (No Quote)

Tap "+" on the calendar or double-click/long-press an empty slot:
- Same form as the booking modal but all fields empty
- `quote_id` is null
- No amount field (or optional manual entry)
- No "View Quote" link in the detail panel

### State Management

Add to `appReducer`:
- `SET_JOBS` — initial load
- `ADD_JOB` — new job created
- `UPDATE_JOB` — job edited, moved, resized, status changed, or cancelled (cancellation is a status update, not a delete)

No `DELETE_JOB` action. Jobs are never hard-deleted — cancelled jobs stay in the DB with `status: "cancelled"` so they remain visible on the calendar (faded). If we ever need hard-delete (e.g. accidental creation), that's a future consideration.

**Job loading:** On auth/business load, fetch jobs with `starts_at` within a rolling window: 30 days in the past to 90 days ahead. When the tradie navigates the calendar beyond this window, fetch the new range on demand. This prevents unbounded growth in `state.jobs`.

Jobs stored in `state.jobs` array.

### Edge Cases

| Scenario | Behaviour |
|---|---|
| Quote booked but not scheduled | No job record created. Quote shows "booked" status. QuoteDetail shows "Schedule this job" button |
| Job cancelled from calendar | Job status → `cancelled`. Quote status stays `booked` — cancelling schedule doesn't un-book the quote |
| Job dragged to new time | `starts_at` and `ends_at` updated, duration preserved |
| Job resized | `ends_at` updated |
| Multi-day job dragged | Entire block shifts by same offset |
| Overlapping jobs | Allowed — tradies may have crew on multiple jobs. Blocks render side-by-side |
| Completed jobs on calendar | Shown with green tint at 50% opacity. Not hidden — tradies may reference past work |
| Quote deleted while job exists | Job persists. `quote_id` is dangling — detail panel hides "View Quote" link (query returns null) |
| Business with no jobs | Calendar empty state: "No jobs scheduled yet. Book a quote or tap + to add one." |
| Multi-day toggle mid-edit | Switching to multi-day: `ends_at` becomes end of start date → tradie picks end date. Switching back: `ends_at` calculated from start + duration |
| Employee tag deleted from a job | Tag removed from job's `assigned_to`. Tag stays in `business.employee_tags` for future autocomplete |
| Very long job title | Truncated with ellipsis on calendar block. Full title in detail panel |

### Dashboard Integration

**New "Today's Jobs" card** — positioned in the action alerts area (below stats row, above recent quotes):
- Shows today's jobs as a compact list: time, title, customer name, status badge
- Tap a job to navigate to Schedule view with that job's detail panel open
- If no jobs today: "No jobs scheduled today"
- If jobs exist tomorrow but not today: "Next job: [title] tomorrow at [time]"

**Stats row addition:**
- New stat card: "This Week" — count of scheduled + in-progress jobs for the current week. Icon: `CalendarDays`. Tapping navigates to Schedule.

**Existing "booked" stat unchanged** — it still counts quotes with `status: "booked"`. The job/scheduling system is a separate concept. A quote can be booked without being scheduled (the skip option).

### Implementation Notes

**react-big-calendar CSS:** The library ships its own CSS. Since Wynflow uses inline styles exclusively (no CSS imports), the library CSS must be injected as a `<style>` tag in the global styles section (same pattern as the existing global CSS injection at the top of App.jsx). Calendar event styling uses `eventPropGetter` and `slotPropGetter` for inline overrides to match the glass aesthetic.

**Postgres array operations:** The custom `db()` query builder may not support Postgres array operators (`@>`, `array_append`). For `assigned_to` filtering and `employee_tags` updates, use the existing `supabase` fetch wrapper with raw query strings if needed, or extend `db()` with a `.contains()` method.

**Desktop sidebar order:** Dashboard, Quotes, Schedule, Analytics, Follow-Ups, Help, Settings. (Schedule inserted after Quotes.)

### Customer-Facing Impact

**None.** The calendar, jobs table, employee tags, and all scheduling UI are tradie-only. No changes to:
- Quote emails
- Customer response pages
- Public request form
- PDF invoices
- N8N webhook payloads

### Files to Modify

| File | Changes |
|------|---------|
| `src/App.jsx` — Sidebar | Add "Schedule" nav item between Quotes and Analytics |
| `src/App.jsx` — Mobile nav | Replace bottom tab bar with 3-item bar + hamburger drawer |
| `src/App.jsx` — WynflowApp | Add `jobs` to state, load on auth, handle new reducer actions |
| `src/App.jsx` — appReducer | Add SET_JOBS, ADD_JOB, UPDATE_JOB actions |
| `src/App.jsx` — New: ScheduleView | Calendar component using react-big-calendar, week view, drag-and-drop |
| `src/App.jsx` — New: JobDetailPanel | Slide-over panel for viewing/editing a job |
| `src/App.jsx` — New: JobFormModal | Schedule modal for booking a quote or creating standalone job |
| `src/App.jsx` — QuoteDetail | Modify "Mark as Booked" to open JobFormModal. Add "Schedule this job" for booked quotes without a job |
| `src/App.jsx` — Dashboard | Add "Today's Jobs" card and "This Week" stat (see Dashboard Integration section) |
| `package.json` | Add `react-big-calendar` dependency |
| `supabase/migrations/` | Create `jobs` table, add `employee_tags` to businesses |

### Not in Scope (v1)

See `docs/superpowers/backlog/scheduling-future-features.md` for the full future features list:
- Customer notifications on schedule/reschedule
- Employee logins or permissions
- Recurring/repeating jobs
- Time tracking or timesheets
- Google Calendar sync / iCal export
- Job costing (quoted vs actual)
- Map view of job locations
- Customer self-booking / availability
