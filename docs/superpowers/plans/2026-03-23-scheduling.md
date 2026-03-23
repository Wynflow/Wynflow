# Job Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a built-in job scheduling calendar to Wynflow so tradies can schedule, track, and manage jobs after booking quotes.

**Architecture:** New `jobs` table in Supabase linked to quotes via `quote_id`. Calendar UI built with react-big-calendar in the existing single-file App.jsx. Mobile navigation redesigned from 7-item bottom tab bar to 3-item bottom bar + hamburger drawer. Quote→Job flow integrated into the existing "Mark as Booked" action.

**Tech Stack:** React 19, react-big-calendar + react-big-calendar/lib/addons/dragAndDrop, Supabase (custom REST client), inline styles, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-03-23-scheduling-design.md`

**Important context:**
- The entire app is a single file: `src/App.jsx` (~9100 lines). All components, state, and styling live here.
- No test framework is configured. Verification is manual (run `npm run dev`, check in browser).
- Styling is 100% inline using a `theme` object. No CSS files except library CSS injected via `<style>` tags.
- The custom `db(table)` query builder returns `{ data, error }` tuples. It does NOT support Postgres array operators.
- State management uses `useReducer` with `appReducer`. Navigation is via `dispatch({ type: "SET_SCREEN", payload: "screenName" })`.

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/008_create_jobs_table.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Create jobs table for scheduling
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  title text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  address text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean DEFAULT false,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  assigned_to text[] DEFAULT '{}',
  notes text,
  color text,
  amount numeric,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- RLS policy: jobs visible only to their business owner
CREATE POLICY "Users can manage their own business jobs"
  ON jobs FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- Indexes for calendar queries
CREATE INDEX idx_jobs_business_starts ON jobs(business_id, starts_at);
CREATE INDEX idx_jobs_quote ON jobs(quote_id);

-- Add employee_tags to businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS employee_tags text[] DEFAULT '{}';
```

- [ ] **Step 2: Apply the migration**

Run via Supabase dashboard or MCP tool. Verify the `jobs` table exists and `employee_tags` column was added to `businesses`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/008_create_jobs_table.sql
git commit -m "feat: add jobs table and employee_tags column"
```

---

### Task 2: Install react-big-calendar and Add State Management

**Files:**
- Modify: `package.json`
- Modify: `src/App.jsx` — imports (~line 1-3), initialState (~line 360-371), appReducer (~line 373-436)

- [ ] **Step 1: Install react-big-calendar**

```bash
npm install react-big-calendar date-fns
```

`react-big-calendar` needs a date localizer — `date-fns` is lightweight and already commonly used. No `moment.js`.

- [ ] **Step 2: Add imports to App.jsx**

At the top of `src/App.jsx` (after existing imports around line 3), add:

```javascript
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay, addDays, startOfDay, endOfDay, addHours, isSameDay, startOfISOWeek, endOfISOWeek, subDays } from "date-fns";
```

Also add `CalendarDays` and `Menu` and `X` to the lucide-react import (line 2). Check what's already imported — `X` may already be there.

- [ ] **Step 3: Add date-fns localizer setup**

Place this right after the imports, before the error boundary code (~line 5):

```javascript
const locales = { "en-NZ": undefined };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1 }), getDay, locales });
const DnDCalendar = withDragAndDrop(Calendar);
```

Week starts on Monday (weekStartsOn: 1) — standard for NZ.

- [ ] **Step 4: Add `jobs` to initialState**

In the `initialState` object (~line 360), add `jobs: []` alongside the existing `quotes`, `sequences`, and `invoices` arrays. Do NOT replace the entire object — just add the one field:

```javascript
// Inside initialState, after invoices: []
jobs: [],
```

- [ ] **Step 5: Add reducer actions for jobs**

In `appReducer` (~line 373), add these cases after the `CLEAR_NOTIFY` case (~line 432):

```javascript
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
```

- [ ] **Step 6: Add jobs to data loading**

In the `loadData` function inside `WynflowAppInner` (~line 8738), add jobs fetch to the `Promise.all`:

```javascript
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
```

Note: The spec says to use a rolling window (30 days past to 90 days ahead). For v1, loading all jobs is fine — tradies won't have thousands. Windowed loading can be added later if performance becomes an issue. The index on `(business_id, starts_at)` supports range queries when needed.

- [ ] **Step 7: Verify**

Run `npm run dev`. App should load without errors. Check browser console for no import errors. The `jobs` array in state should be empty (no jobs exist yet).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/App.jsx
git commit -m "feat: install react-big-calendar, add jobs state management"
```

---

### Task 3: Mobile Navigation Redesign

**Files:**
- Modify: `src/App.jsx` — Sidebar component (~line 3107-3243), global styles (~line 8961-8980), main layout (~line 9082-9095)

This task replaces the 7-item mobile bottom tab bar with a 3-item bar (Dashboard, Quotes, Schedule) plus a hamburger slide-out drawer for all other navigation.

- [ ] **Step 1: Add `CalendarDays` and `Menu` to the Sidebar component's nav items**

Find the `mainNav` array in Sidebar (~line 3109). Insert a Schedule item after Quotes:

```javascript
const mainNav = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "quotes", label: "Quotes", icon: FileText },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "invoices", label: "Invoices", icon: Receipt },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "sequences", label: "Follow-Ups", icon: RefreshCw },
];
```

- [ ] **Step 2: Rewrite the mobile nav section**

The mobile bottom tab bar is at ~lines 3133-3160. Replace the entire mobile return block with:

Note: `drawerOpen` state must be declared BEFORE the `if (isMobile)` check to obey React's Rules of Hooks. Add it at the top of the Sidebar component body, alongside other state:

```javascript
const [drawerOpen, setDrawerOpen] = React.useState(false);
```

Then in the mobile return block:

```javascript
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
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }}
          />
          {/* Panel */}
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
```

- [ ] **Step 3: Add slideInRight animation to global styles**

In the `globalStyles` string (~line 8961), add this animation:

```css
@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes slideIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
```

Note: `slideIn` is the bottom-up slide used by mobile modals (JobFormModal, JobDetailPanel). `slideInRight` is used by the hamburger drawer. Check if `slideIn` already exists in the globalStyles — if so, skip adding it. The existing codebase may already define it.

- [ ] **Step 4: Update main layout padding for new mobile header**

In the main layout div (~line 9082-9095), the mobile content area needs top padding for the new fixed header bar. Find the content div's padding:

```javascript
padding: isMobile ? "16px 14px 90px" : "28px 36px"
```

Change to:

```javascript
padding: isMobile ? "56px 14px 90px" : "28px 36px"
```

The 56px accounts for the fixed header bar height (~44px + some breathing room).

- [ ] **Step 5: Verify on mobile**

Run `npm run dev`. Open Chrome DevTools in mobile mode (375px width). Check:
- Fixed header bar at top with business name and hamburger icon
- 3-item bottom tab bar (Dashboard, Quotes, Schedule)
- Tapping hamburger opens slide-out drawer from right
- All 7 nav items visible in drawer
- Tapping a drawer item navigates and closes drawer
- Tapping backdrop closes drawer
- Active item highlighted in teal
- Desktop sidebar unchanged (check at 1024px+ width)

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: redesign mobile nav — 3-tab bottom bar + hamburger drawer"
```

---

### Task 4: Schedule View (Calendar Component)

**Files:**
- Modify: `src/App.jsx` — add ScheduleView component, add react-big-calendar CSS to global styles, add "schedule" case to screen routing

This is the largest task. It creates the calendar view with week layout, event rendering, drag-and-drop, and employee filtering.

**IMPORTANT:** This task references `JobDetailPanel` (Task 6) and `JobFormModal` (Task 5). Before implementing this task, add temporary stub components so the app compiles:

```javascript
function JobDetailPanel() { return null; }
function JobFormModal() { return null; }
```

These stubs will be replaced by the real implementations in Tasks 5 and 6. Remove them when those tasks are complete.

- [ ] **Step 1: Add react-big-calendar CSS to global styles**

In the `globalStyles` string (~line 8961), append the react-big-calendar base CSS. Since the app uses inline styles exclusively, we inject the library CSS as a string. Read the CSS from:

```javascript
import "react-big-calendar/lib/css/react-big-calendar.css";
```

Actually — since Vite supports CSS imports, add this import at the top of App.jsx (after other imports):

```javascript
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
```

Then override the calendar's default styles in the `globalStyles` string to match the dark glass theme:

```css
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
```

- [ ] **Step 2: Create the ScheduleView component**

Add this component in `src/App.jsx` after the Analytics component (~line 4116) and before AIQuoteForm. This keeps scheduling-related components grouped near the dashboard/list views.

```javascript
// ========================
// SCHEDULE VIEW
// ========================

const EMPLOYEE_COLORS = ["#3B82F6", "#F97316", "#A855F7", "#EC4899", "#06B6D4", "#84CC16", "#EAB308", "#6366F1"];
const JOB_STATUS_COLORS = {
  scheduled: "#14B8A6",
  in_progress: "#F59E0B",
  completed: "#22C55E",
  cancelled: "#EF4444",
};

function ScheduleView({ jobs, dispatch, business, quotes, focusDate }) {
  const isMobile = useIsMobile();
  const [selectedJob, setSelectedJob] = React.useState(null);
  const [showJobForm, setShowJobForm] = React.useState(false);
  const [jobFormDefaults, setJobFormDefaults] = React.useState(null);
  const [employeeFilter, setEmployeeFilter] = React.useState("all");
  // focusDate can be passed as an ISO date string via screen param (e.g. "schedule:2026-03-25")
  const [currentDate, setCurrentDate] = React.useState(focusDate ? new Date(focusDate) : new Date());

  const employeeTags = business?.employee_tags || [];

  const getEmployeeColor = (name) => {
    const idx = employeeTags.indexOf(name);
    return idx >= 0 ? EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length] : "#8B95A8";
  };

  // Filter jobs by employee
  const filteredJobs = employeeFilter === "all"
    ? jobs
    : jobs.filter((j) => (j.assigned_to || []).includes(employeeFilter));

  // Convert jobs to react-big-calendar events
  const events = filteredJobs.map((job) => ({
    id: job.id,
    title: job.title,
    start: new Date(job.starts_at),
    end: new Date(job.ends_at),
    allDay: job.all_day || false,
    resource: job,
  }));

  // Event styling
  const eventPropGetter = (event) => {
    const job = event.resource;
    let bgColor;
    let opacity = 1;

    if (employeeFilter !== "all") {
      // Employee filter active — colour by employee
      const firstAssigned = (job.assigned_to || [])[0];
      bgColor = firstAssigned ? getEmployeeColor(firstAssigned) : "#8B95A8";
    } else {
      // Default — colour by status
      bgColor = JOB_STATUS_COLORS[job.status] || "#8B95A8";
    }

    if (job.status === "completed") opacity = 0.5;
    if (job.status === "cancelled") opacity = 0.3;

    return {
      style: {
        backgroundColor: bgColor,
        opacity,
        color: "#fff",
        border: "none",
        borderRadius: 6,
        fontSize: 12,
        fontFamily: "'DM Sans', sans-serif",
        padding: "2px 6px",
        position: "relative",
      },
    };
  };

  // Custom event component to show status dot + employee badge
  const EventComponent = ({ event }) => {
    const job = event.resource;
    const assignedCount = (job.assigned_to || []).length;

    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4, overflow: "hidden" }}>
        {employeeFilter !== "all" && (
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: JOB_STATUS_COLORS[job.status] || "#8B95A8",
            flexShrink: 0,
          }} />
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {event.title}
        </span>
        {assignedCount > 1 && (
          <span style={{ fontSize: 10, opacity: 0.7, flexShrink: 0 }}>+{assignedCount - 1}</span>
        )}
      </div>
    );
  };

  // Drag and drop handlers
  const handleEventDrop = async ({ event, start, end }) => {
    const job = event.resource;
    const updates = { starts_at: start.toISOString(), ends_at: end.toISOString() };
    dispatch({ type: "UPDATE_JOB", payload: { id: job.id, ...updates } });
    const { error } = await db("jobs").eq("id", job.id).update(updates);
    if (error) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to move job", type: "error" } });
      // Revert optimistic update
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

  const handleSelectEvent = (event) => {
    setSelectedJob(event.resource);
  };

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
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontSize: isMobile ? 22 : 26, fontFamily: theme.fontHeading, color: theme.text, margin: 0 }}>
          Schedule
        </h2>
        <Button onClick={handleNewJob} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={16} /> New Job
        </Button>
      </div>

      {/* Employee filter pills */}
      {employeeTags.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button
            onClick={() => setEmployeeFilter("all")}
            style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
              fontFamily: theme.font, border: "1px solid",
              background: employeeFilter === "all" ? "rgba(20,184,166,0.15)" : "rgba(255,255,255,0.04)",
              color: employeeFilter === "all" ? theme.accent : theme.textMuted,
              borderColor: employeeFilter === "all" ? "rgba(20,184,166,0.3)" : "rgba(255,255,255,0.08)",
            }}
          >
            All
          </button>
          {employeeTags.map((tag, idx) => {
            const color = EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length];
            const isActive = employeeFilter === tag;
            return (
              <button
                key={tag}
                onClick={() => setEmployeeFilter(isActive ? "all" : tag)}
                style={{
                  padding: "5px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                  fontFamily: theme.font, border: "1px solid",
                  display: "flex", alignItems: "center", gap: 6,
                  background: isActive ? `${color}22` : "rgba(255,255,255,0.04)",
                  color: isActive ? color : theme.textMuted,
                  borderColor: isActive ? `${color}55` : "rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                {tag}
              </button>
            );
          })}
        </div>
      )}

      {/* Calendar */}
      <div style={{ height: isMobile ? "calc(100vh - 240px)" : "calc(100vh - 200px)", minHeight: 400 }}>
        <DnDCalendar
          localizer={localizer}
          events={events}
          defaultView={isMobile ? "day" : "week"}
          views={isMobile ? ["day"] : ["week", "day"]}
          date={currentDate}
          onNavigate={(date) => setCurrentDate(date)}
          min={new Date(2026, 0, 1, 6, 0)}
          max={new Date(2026, 0, 1, 20, 0)}
          step={30}
          timeslots={2}
          selectable
          resizable
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          eventPropGetter={eventPropGetter}
          components={{ event: EventComponent }}
          formats={{
            dayHeaderFormat: (date) => format(date, "EEE d MMM"),
            dayRangeHeaderFormat: ({ start, end }) => `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`,
            timeGutterFormat: (date) => format(date, "h a"),
          }}
          style={{ height: "100%" }}
        />
      </div>

      {/* Empty state */}
      {jobs.length === 0 && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          textAlign: "center", color: theme.textMuted,
        }}>
          <CalendarDays size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 15, marginBottom: 8 }}>No jobs scheduled yet.</p>
          <p style={{ fontSize: 13, color: theme.textDim }}>Book a quote or tap "New Job" to add one.</p>
        </div>
      )}

      {/* Job Detail Panel — rendered when a job is selected */}
      {selectedJob && (
        <JobDetailPanel
          job={selectedJob}
          business={business}
          dispatch={dispatch}
          onClose={() => setSelectedJob(null)}
          onEdit={(updatedJob) => setSelectedJob(updatedJob)}
          quotes={quotes}
        />
      )}

      {/* Job Form Modal — rendered when creating a new job */}
      {showJobForm && (
        <JobFormModal
          business={business}
          dispatch={dispatch}
          defaults={jobFormDefaults}
          onClose={() => { setShowJobForm(false); setJobFormDefaults(null); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add "schedule" to the screen routing switch**

In the `renderContent` function (~line 9061), add a case for "schedule":

```javascript
case "schedule": return <ScheduleView jobs={jobs} dispatch={dispatch} business={business} quotes={quotes} focusDate={detailId} />;
```

Also make sure `jobs` is destructured from `state` in `WynflowAppInner` alongside `quotes`, `sequences`, `invoices`:

```javascript
const { user, business, loading, screen, quotes, sequences, invoices, jobs, notification } = state;
```

- [ ] **Step 4: Verify**

Run `npm run dev`. Navigate to Schedule from bottom tab bar (mobile) or sidebar (desktop). Should see:
- Empty calendar with week grid (desktop) or day view (mobile)
- "New Job" button in top right
- Empty state message
- No console errors

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add ScheduleView calendar with week grid and drag-and-drop"
```

---

### Task 5: Job Form Modal

**Files:**
- Modify: `src/App.jsx` — add JobFormModal component (before ScheduleView)

This modal is used for two flows: (1) creating a standalone job from the calendar, and (2) booking a quote into a scheduled job (Task 7).

- [ ] **Step 1: Create the JobFormModal component**

Add this before the ScheduleView component:

```javascript
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
      const matches = employeeTags.filter((t) =>
        t.toLowerCase().includes(val.toLowerCase()) && !form.assignedTags.includes(t)
      );
      setTagSuggestions(matches);
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
      business_id: business.id,
      quote_id: quote?.id || null,
      title: form.title.trim(),
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone || null,
      customer_email: form.customer_email || null,
      address: form.address || null,
      starts_at,
      ends_at,
      all_day: form.allDay,
      assigned_to: form.assignedTags,
      notes: form.notes || null,
      amount: quote ? parseFloat(quote.amount) || null : null,
      status: "scheduled",
    };

    const { data, error } = await db("jobs").insert([jobData]).select();
    if (error) {
      dispatch({ type: "NOTIFY", payload: { message: "Failed to create job", type: "error" } });
      setSaving(false);
      return;
    }

    if (data && data[0]) {
      dispatch({ type: "ADD_JOB", payload: data[0] });
    }

    // Save any new employee tags to the business
    const newTags = form.assignedTags.filter((t) => !employeeTags.includes(t));
    if (newTags.length > 0) {
      const updatedTags = [...employeeTags, ...newTags];
      await db("businesses").eq("id", business.id).update({ employee_tags: updatedTags });
      dispatch({ type: "SET_BUSINESS", payload: { ...business, employee_tags: updatedTags } });
    }

    // If booking a quote, also update quote status
    if (quote && onBooked) {
      await onBooked();
    }

    dispatch({ type: "NOTIFY", payload: { message: quote ? "Job booked and scheduled!" : "Job created!", type: "success" } });
    onClose();

    // Navigate to schedule if not already there
    if (!quote) {
      dispatch({ type: "SET_SCREEN", payload: "schedule" });
    }

    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center" }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />

      {/* Modal */}
      <div style={{
        position: "relative", width: isMobile ? "100%" : 480,
        maxHeight: isMobile ? "85vh" : "80vh", overflow: "auto",
        background: "rgba(17,24,39,0.98)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: isMobile ? "16px 16px 0 0" : 16,
        padding: 24,
        animation: isMobile ? "slideIn 0.2s ease-out" : undefined,
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontFamily: theme.fontHeading, fontSize: 20, color: theme.text, margin: 0 }}>
            {quote ? "Book & Schedule" : "New Job"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {/* Form fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Job Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Input label="Customer Name" value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Phone" value={form.customer_phone} onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))} />
            <Input label="Email" value={form.customer_email} onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))} />
          </div>

          <Input label="Address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Job site address" />

          {/* All-day toggle */}
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

          {/* Assigned to — tag input */}
          <div>
            <label style={{ fontSize: 13, color: theme.textMuted, marginBottom: 4, display: "block" }}>Assign To</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
              {form.assignedTags.map((tag) => (
                <span key={tag} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 10px", borderRadius: 12, fontSize: 13,
                  background: "rgba(20,184,166,0.12)", color: theme.accent,
                  border: "1px solid rgba(20,184,166,0.2)",
                }}>
                  {tag}
                  <button onClick={() => removeTag(tag)} style={{ background: "none", border: "none", color: theme.accent, cursor: "pointer", padding: 0, fontSize: 14 }}>×</button>
                </span>
              ))}
            </div>
            <input
              value={form.assignedTo}
              onChange={(e) => handleAssignedInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a name and press Enter"
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 14,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                color: theme.text, fontFamily: theme.font, outline: "none",
              }}
            />
            {tagSuggestions.length > 0 && (
              <div style={{
                marginTop: 4, background: "rgba(17,24,39,0.98)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, overflow: "hidden",
              }}>
                {tagSuggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => addTag(s)}
                    style={{
                      display: "block", width: "100%", padding: "8px 12px", fontSize: 13,
                      background: "transparent", border: "none", color: theme.text,
                      cursor: "pointer", textAlign: "left", fontFamily: theme.font,
                    }}
                    onMouseOver={(e) => e.target.style.background = "rgba(255,255,255,0.06)"}
                    onMouseOut={(e) => e.target.style.background = "transparent"}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Input label="Notes" type="textarea" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Private job notes..." />

          {/* Amount (read-only if from quote) */}
          {quote && (
            <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: 13, color: theme.textMuted }}>Quote Amount: </span>
              <span style={{ fontSize: 15, color: theme.text, fontWeight: 600 }}>${parseFloat(quote.amount || 0).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
          <Button onClick={handleSave} disabled={saving} style={{ width: "100%" }}>
            {saving ? "Saving..." : quote ? "Book & Schedule" : "Create Job"}
          </Button>
          {quote && (
            <button
              onClick={async () => {
                if (onBooked) await onBooked();
                dispatch({ type: "NOTIFY", payload: { message: "Job booked! Nice one.", type: "success" } });
                onClose();
              }}
              style={{
                background: "none", border: "none", color: theme.textMuted, cursor: "pointer",
                fontSize: 13, fontFamily: theme.font, textDecoration: "underline", padding: 4,
              }}
            >
              Book without scheduling
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run `npm run dev`. Go to Schedule view, click "New Job". The modal should appear with:
- Job Title, Customer Name, Phone, Email, Address fields
- Date/Time/Hours inputs
- Multi-day toggle
- Assign To with tag input
- Notes textarea
- "Create Job" button

Fill in a test job and submit. It should appear on the calendar.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add JobFormModal for creating and scheduling jobs"
```

---

### Task 6: Job Detail Panel

**Files:**
- Modify: `src/App.jsx` — add JobDetailPanel component (before JobFormModal)

- [ ] **Step 1: Create the JobDetailPanel component**

Add this before JobFormModal:

```javascript
// ========================
// JOB DETAIL PANEL
// ========================

function JobDetailPanel({ job, business, dispatch, onClose, onEdit, quotes }) {
  const isMobile = useIsMobile();
  const [editingNotes, setEditingNotes] = React.useState(false);
  const [notes, setNotes] = React.useState(job.notes || "");
  const [saving, setSaving] = React.useState(false);

  // Check if linked quote exists
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
      const messages = {
        in_progress: "Job started!",
        completed: "Job marked complete!",
        scheduled: "Job reopened.",
        cancelled: "Job cancelled.",
      };
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
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />

      {/* Panel */}
      <div style={{
        ...panelStyle,
        background: "rgba(17,24,39,0.98)",
        borderLeft: isMobile ? "none" : "1px solid rgba(255,255,255,0.06)",
        borderTop: isMobile ? "1px solid rgba(255,255,255,0.06)" : "none",
        overflow: "auto", padding: 24, zIndex: 1,
        animation: isMobile ? "slideIn 0.2s ease-out" : "slideInRight 0.2s ease-out",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h3 style={{ fontFamily: theme.fontHeading, fontSize: 20, color: theme.text, margin: "0 0 8px" }}>{job.title}</h3>
            <span style={{
              display: "inline-block", padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 500,
              background: sc.bg, color: sc.color,
            }}>
              {sc.label}
            </span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Customer info */}
        <div style={{ padding: 14, background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 14 }}>
          <p style={{ fontSize: 15, color: theme.text, fontWeight: 500, margin: "0 0 6px" }}>{job.customer_name}</p>
          {job.customer_phone && (
            <a href={`tel:${job.customer_phone}`} style={{ display: "block", fontSize: 13, color: theme.accent, textDecoration: "none", marginBottom: 4 }}>
              {job.customer_phone}
            </a>
          )}
          {job.customer_email && (
            <a href={`mailto:${job.customer_email}`} style={{ display: "block", fontSize: 13, color: theme.accent, textDecoration: "none", marginBottom: 4 }}>
              {job.customer_email}
            </a>
          )}
          {job.address && <p style={{ fontSize: 13, color: theme.textMuted, margin: 0 }}>{job.address}</p>}
        </div>

        {/* Schedule */}
        <div style={{ padding: 14, background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 14 }}>
          <p style={{ fontSize: 13, color: theme.textMuted, margin: "0 0 4px" }}>Scheduled</p>
          <p style={{ fontSize: 15, color: theme.text, margin: 0 }}>{formatJobTime()}</p>
        </div>

        {/* Assigned to — editable */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <p style={{ fontSize: 13, color: theme.textMuted, margin: 0 }}>Assigned To</p>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            {(job.assigned_to || []).map((tag) => (
              <span key={tag} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 10px", borderRadius: 12, fontSize: 13,
                background: "rgba(20,184,166,0.12)", color: theme.accent,
                border: "1px solid rgba(20,184,166,0.2)",
              }}>
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
          <input
            placeholder="Add team member..."
            onKeyDown={async (e) => {
              if (e.key === "Enter" && e.target.value.trim()) {
                const name = e.target.value.trim();
                const updatedTags = [...(job.assigned_to || []), name];
                const { error } = await db("jobs").eq("id", job.id).update({ assigned_to: updatedTags });
                if (!error) {
                  const updated = { ...job, assigned_to: updatedTags };
                  dispatch({ type: "UPDATE_JOB", payload: updated });
                  onEdit(updated);
                  // Also add to business employee_tags if new
                  const empTags = business?.employee_tags || [];
                  if (!empTags.includes(name)) {
                    const newEmpTags = [...empTags, name];
                    await db("businesses").eq("id", business.id).update({ employee_tags: newEmpTags });
                    dispatch({ type: "SET_BUSINESS", payload: { ...business, employee_tags: newEmpTags } });
                  }
                }
                e.target.value = "";
              }
            }}
            style={{
              width: "100%", padding: "6px 10px", borderRadius: 8, fontSize: 13,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: theme.text, fontFamily: theme.font, outline: "none",
            }}
          />
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <p style={{ fontSize: 13, color: theme.textMuted, margin: 0 }}>Notes</p>
            {!editingNotes && (
              <button onClick={() => setEditingNotes(true)} style={{
                background: "none", border: "none", color: theme.accent, cursor: "pointer", fontSize: 12,
              }}>
                Edit
              </button>
            )}
          </div>
          {editingNotes ? (
            <div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 14,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  color: theme.text, fontFamily: theme.font, outline: "none", resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Button onClick={saveNotes} size="sm">Save</Button>
                <Button onClick={() => { setEditingNotes(false); setNotes(job.notes || ""); }} variant="ghost" size="sm">Cancel</Button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 14, color: notes ? theme.text : theme.textDim, margin: 0 }}>
              {notes || "No notes"}
            </p>
          )}
        </div>

        {/* Amount */}
        {job.amount && (
          <div style={{ padding: 14, background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: theme.textMuted }}>Quote Amount: </span>
            <span style={{ fontSize: 17, color: theme.text, fontWeight: 600 }}>${parseFloat(job.amount).toLocaleString()}</span>
          </div>
        )}

        {/* Quote link */}
        {linkedQuote && (
          <button
            onClick={() => { onClose(); dispatch({ type: "SET_SCREEN", payload: `quoteDetail:${linkedQuote.id}` }); }}
            style={{
              display: "flex", alignItems: "center", gap: 6, width: "100%",
              padding: "10px 14px", marginBottom: 14, borderRadius: 8,
              background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.15)",
              color: theme.accent, cursor: "pointer", fontSize: 14, fontFamily: theme.font,
            }}
          >
            <FileText size={16} /> View Quote →
          </button>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {job.status === "scheduled" && (
            <>
              <Button onClick={() => updateJobStatus("in_progress")} disabled={saving} style={{ background: "#F59E0B", color: "#fff", width: "100%" }}>
                Start Job
              </Button>
              <Button onClick={() => updateJobStatus("cancelled")} disabled={saving} variant="danger" style={{ width: "100%" }}>
                Cancel Job
              </Button>
            </>
          )}
          {job.status === "in_progress" && (
            <>
              <Button onClick={() => updateJobStatus("completed")} disabled={saving} style={{ background: theme.green, color: "#fff", width: "100%" }}>
                <Check size={16} /> Mark Complete
              </Button>
              <Button onClick={() => updateJobStatus("scheduled")} disabled={saving} variant="ghost" style={{ width: "100%" }}>
                Back to Scheduled
              </Button>
            </>
          )}
          {job.status === "completed" && (
            <>
              <Button onClick={() => updateJobStatus("scheduled")} disabled={saving} variant="ghost" style={{ width: "100%" }}>
                Reopen Job
              </Button>
              {linkedQuote && (
                <Button
                  onClick={() => { onClose(); dispatch({ type: "SET_SCREEN", payload: `createInvoice:${linkedQuote.id}` }); }}
                  style={{ width: "100%" }}
                >
                  Generate Invoice
                </Button>
              )}
            </>
          )}
          {job.status === "cancelled" && (
            <Button onClick={() => updateJobStatus("scheduled")} disabled={saving} style={{ width: "100%" }}>
              Reschedule
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run `npm run dev`. Go to Schedule, create a job via "New Job". Tap/click the job block on the calendar. The detail panel should slide in showing:
- Job title + status badge
- Customer info with tappable phone/email
- Schedule time
- Notes (editable)
- Action buttons (Start Job, Cancel Job)

Test status transitions: Start Job → Mark Complete → Reopen.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add JobDetailPanel with status transitions and notes"
```

---

### Task 7: Quote → Job Integration

**Files:**
- Modify: `src/App.jsx` — QuoteDetail component (~lines 5781-6109)

This task modifies the "Mark as Booked" flow to open the JobFormModal, and updates the booked card to show job info.

- [ ] **Step 1: Add state and job lookup to QuoteDetail**

At the top of the QuoteDetail component (after quote lookup ~line 5783), add:

```javascript
const [showBookingModal, setShowBookingModal] = React.useState(false);
const linkedJob = jobs.find((j) => j.quote_id === quote?.id);
```

Also ensure `jobs` is passed as a prop to QuoteDetail. Find where QuoteDetail is rendered in `renderContent` (~line 9070) and add `jobs={jobs}`:

```javascript
case "quoteDetail": return <QuoteDetail quoteId={detailId} quotes={quotes} sequences={sequences} dispatch={dispatch} business={business} invoices={invoices} jobs={jobs} />;
```

Update the QuoteDetail function signature to accept `jobs`:

```javascript
function QuoteDetail({ quoteId, quotes, sequences, dispatch, business, invoices, jobs }) {
```

- [ ] **Step 2: Replace "Mark as Booked" button**

Find the accepted quote action card (~line 5992-6015). The "Mark as Booked" button (~line 6006) currently calls `updateStatus("booked")`. Replace it to open the modal instead:

```javascript
<Button onClick={() => setShowBookingModal(true)} style={{ background: theme.green, color: "#fff", display: "inline-flex", alignItems: "center", gap: 6 }}>
  <CalendarDays size={16} /> Book & Schedule
</Button>
```

- [ ] **Step 3: Add JobFormModal rendering in QuoteDetail**

At the end of QuoteDetail's return (just before the closing `</div>` or fragment), add:

```javascript
{showBookingModal && (
  <JobFormModal
    business={business}
    dispatch={dispatch}
    defaults={{}}
    quote={quote}
    onClose={() => setShowBookingModal(false)}
    onBooked={async () => {
      const updates = {
        status: "booked",
        booked_at: new Date().toISOString(),
        follow_up_paused: true,
      };
      await db("quotes").eq("id", quote.id).update(updates);
      dispatch({ type: "UPDATE_QUOTE", payload: { id: quote.id, ...updates } });
      dispatch({ type: "SET_SCREEN", payload: "schedule" });
    }}
  />
)}
```

- [ ] **Step 4: Update the green "Job Booked!" card**

Find the booked card section (~line 6016-6033). Replace the entire block with:

```javascript
{quote.status === "booked" && (
  <div style={{
    padding: 16, borderRadius: 12, marginBottom: 16,
    background: theme.greenSoft,
    border: `1px solid ${theme.green}33`,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <CheckCircle2 size={24} color={theme.green} />
      <strong style={{ color: theme.green, fontSize: 16 }}>Job Booked!</strong>
    </div>
    {linkedJob ? (
      <div>
        <p style={{ color: theme.text, fontSize: 14, margin: "0 0 8px" }}>
          Scheduled for {format(new Date(linkedJob.starts_at), linkedJob.all_day ? "EEE d MMM yyyy" : "EEE d MMM yyyy 'at' h:mm a")}
        </p>
        {(linkedJob.assigned_to || []).length > 0 && (
          <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
            {linkedJob.assigned_to.map((tag) => (
              <span key={tag} style={{
                padding: "2px 8px", borderRadius: 10, fontSize: 12,
                background: "rgba(20,184,166,0.12)", color: theme.accent,
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
        <button
          onClick={() => dispatch({ type: "SET_SCREEN", payload: `schedule:${linkedJob.starts_at.split("T")[0]}` })}
          style={{
            background: "none", border: "none", color: theme.accent, cursor: "pointer",
            fontSize: 13, fontFamily: theme.font, padding: 0, textDecoration: "underline",
          }}
        >
          View on Calendar →
        </button>
      </div>
    ) : (
      <div>
        <p style={{ color: theme.textMuted, fontSize: 14, margin: "0 0 10px" }}>
          {quote.booked_at ? `Booked on ${new Date(quote.booked_at).toLocaleDateString()}` : "This job has been confirmed and booked in."}
        </p>
        <Button onClick={() => setShowBookingModal(true)} size="sm" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <CalendarDays size={14} /> Schedule this job
        </Button>
      </div>
    )}
  </div>
)}
```

Note: This uses `format` from date-fns (already imported in Task 2). Also uses `CalendarDays` from lucide-react (already imported in Task 2).

- [ ] **Step 5: Verify**

Run `npm run dev`. Navigate to an accepted quote:
- "Book & Schedule" button should appear (instead of "Mark as Booked")
- Tapping it opens the JobFormModal pre-filled with quote data
- After booking, quote shows "Job Booked!" card with scheduled date and "View on Calendar" link
- "Book without scheduling" link still works — marks as booked with old-style card showing "Schedule this job" button
- Navigating to an old booked quote (no linked job) shows "Schedule this job" button

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: integrate quote booking with job scheduling"
```

---

### Task 8: Dashboard Integration

**Files:**
- Modify: `src/App.jsx` — Dashboard component (~lines 3246-3579)

- [ ] **Step 1: Pass jobs to Dashboard**

Find where Dashboard is rendered in `renderContent` and add `jobs={jobs}`:

```javascript
case "dashboard": return <Dashboard quotes={quotes} dispatch={dispatch} invoices={invoices} jobs={jobs} />;
```

Update the Dashboard function signature:

```javascript
function Dashboard({ quotes, dispatch, invoices, jobs }) {
```

- [ ] **Step 2: Add "This Week" stat**

In the Dashboard stats calculation section (~line 3248), add:

```javascript
const now = new Date();
const weekStart = startOfISOWeek(now);
const weekEnd = endOfISOWeek(now);
const thisWeekJobs = (jobs || []).filter((j) => {
  const start = new Date(j.starts_at);
  return start >= weekStart && start <= weekEnd && j.status !== "cancelled";
}).length;
```

Then in the stats row rendering (~line 3426), add a new Stat card. Find the existing stats and add after the last one:

```javascript
<Stat
  label="This Week"
  value={thisWeekJobs}
  icon={CalendarDays}
  accent={theme.accent}
  onClick={() => dispatch({ type: "SET_SCREEN", payload: "schedule" })}
/>
```

- [ ] **Step 3: Add "Today's Jobs" card**

In the action alerts area (after the notification bell dropdown, before the pipeline/stats ~around line 3400), add:

```javascript
{/* Today's Jobs */}
{(() => {
  const todayJobs = (jobs || []).filter((j) => {
    const start = new Date(j.starts_at);
    return isSameDay(start, new Date()) && j.status !== "cancelled";
  }).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  const tomorrowJobs = (jobs || []).filter((j) => {
    const start = new Date(j.starts_at);
    return isSameDay(start, addDays(new Date(), 1)) && j.status !== "cancelled";
  });

  if (todayJobs.length === 0 && tomorrowJobs.length === 0) return null;

  return (
    <div style={{
      padding: 16, borderRadius: 12, marginBottom: 16,
      background: "rgba(20,184,166,0.04)",
      border: "1px solid rgba(20,184,166,0.12)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <CalendarDays size={18} color={theme.accent} />
        <strong style={{ color: theme.text, fontSize: 15 }}>
          {todayJobs.length > 0 ? "Today's Jobs" : "Tomorrow"}
        </strong>
      </div>
      {todayJobs.length > 0 ? (
        todayJobs.map((j) => (
          <button
            key={j.id}
            onClick={() => dispatch({ type: "SET_SCREEN", payload: "schedule" })}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "8px 10px", marginBottom: 4, borderRadius: 8,
              background: "rgba(255,255,255,0.03)", border: "none", cursor: "pointer",
              color: theme.text, fontFamily: theme.font, textAlign: "left",
            }}
          >
            <span style={{ fontSize: 13, color: theme.accent, fontWeight: 500, minWidth: 60 }}>
              {j.all_day ? "All day" : format(new Date(j.starts_at), "h:mm a")}
            </span>
            <span style={{ fontSize: 14, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {j.title}
            </span>
            <span style={{ fontSize: 12, color: theme.textDim }}>{j.customer_name}</span>
          </button>
        ))
      ) : (
        <p style={{ fontSize: 14, color: theme.textMuted, margin: 0 }}>
          Next job: <strong>{tomorrowJobs[0].title}</strong> tomorrow at{" "}
          {tomorrowJobs[0].all_day ? "all day" : format(new Date(tomorrowJobs[0].starts_at), "h:mm a")}
        </p>
      )}
    </div>
  );
})()}
```

- [ ] **Step 4: Verify**

Run `npm run dev`. Create a job scheduled for today via the calendar. Check Dashboard:
- "Today's Jobs" card appears showing the job with time, title, customer
- "This Week" stat shows the count
- Tapping a job row navigates to Schedule

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add Today's Jobs card and This Week stat to Dashboard"
```

---

### Task 9: Final Polish and Edge Cases

**Files:**
- Modify: `src/App.jsx` — various small fixes

- [ ] **Step 1: Handle empty calendar state properly**

In ScheduleView, the empty state overlay has `position: absolute` which won't work correctly inside the calendar container. Wrap the calendar in a `position: relative` container and only show the empty state when there are truly no events on the current view:

Replace the empty state block in ScheduleView with a conditional that checks `filteredJobs.length === 0`:

```javascript
{filteredJobs.length === 0 && (
  <div style={{
    textAlign: "center", color: theme.textMuted, padding: "60px 20px",
  }}>
    <CalendarDays size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
    <p style={{ fontSize: 15, marginBottom: 8 }}>
      {employeeFilter !== "all" ? `No jobs for ${employeeFilter}` : "No jobs scheduled yet."}
    </p>
    <p style={{ fontSize: 13, color: theme.textDim }}>Book a quote or tap "New Job" to add one.</p>
  </div>
)}
```

And only render the `DnDCalendar` when `filteredJobs.length > 0` (or always render it — react-big-calendar handles empty states fine). Actually, always render the calendar — it shows the time grid which is useful even empty. Remove the empty state overlay entirely and let the calendar's own empty grid be the empty state. Just show a subtle hint below the filter pills:

```javascript
{jobs.length === 0 && (
  <p style={{ textAlign: "center", color: theme.textDim, fontSize: 13, padding: "8px 0" }}>
    No jobs yet — book a quote or tap "New Job" to get started.
  </p>
)}
```

- [ ] **Step 2: Ensure proper date-fns imports**

Check that all date-fns functions used across all new components are in the import statement at the top. The full list needed:

```javascript
import { format, parse, startOfWeek, getDay, addDays, startOfDay, endOfDay, addHours, isSameDay, startOfISOWeek, endOfISOWeek, subDays } from "date-fns";
```

- [ ] **Step 3: Add Stat onClick support**

Check if the existing `Stat` component (~line 794) supports an `onClick` prop. If not, add it:

```javascript
function Stat({ label, value, icon: Icon, color, onClick }) {
  return (
    <div onClick={onClick} style={{
      // ... existing styles ...
      cursor: onClick ? "pointer" : "default",
    }}>
```

- [ ] **Step 4: Verify full flow end-to-end**

Run `npm run dev`. Walk through the complete flow:

1. **Mobile nav:** Hamburger works, 3 bottom tabs work, drawer opens/closes
2. **Schedule tab:** Calendar renders in week (desktop) or day (mobile) view
3. **Create standalone job:** Tap "+", fill form, submit — appears on calendar
4. **Job detail:** Tap job block — panel slides in with all info
5. **Status transitions:** Start → Complete → Reopen, Cancel → Reschedule
6. **Drag and drop** (desktop): Move a job to a different time slot
7. **Resize** (desktop): Drag bottom edge to extend duration
8. **Quote booking:** Navigate to an accepted quote, tap "Book & Schedule", fill schedule, submit
9. **Booked card:** Shows "Scheduled for [date]" with "View on Calendar" link
10. **Book without scheduling:** Link works, shows "Schedule this job" on booked card
11. **Dashboard:** "Today's Jobs" card shows, "This Week" stat shows
12. **Employee tags:** Add tags to jobs, filter pills appear on calendar, filtering works

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: polish scheduling — empty states, edge cases, end-to-end flow"
```

---

## Summary

| Task | What it does |
|------|-------------|
| 1 | Database migration — `jobs` table + `employee_tags` column |
| 2 | Install react-big-calendar, add state management (reducer, data loading) |
| 3 | Mobile nav redesign — 3-tab bottom bar + hamburger drawer |
| 4 | ScheduleView — calendar with week grid, drag-and-drop, employee filtering |
| 5 | JobFormModal — create/schedule jobs (standalone or from quotes) |
| 6 | JobDetailPanel — slide-over with status transitions, notes, quote link |
| 7 | Quote → Job integration — modify "Mark as Booked" flow + booked card |
| 8 | Dashboard — "Today's Jobs" card + "This Week" stat |
| 9 | Polish — empty states, edge cases, end-to-end verification |
