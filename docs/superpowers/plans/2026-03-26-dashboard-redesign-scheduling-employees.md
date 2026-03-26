# Dashboard Redesign + Job Scheduling + Employee Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the dashboard to an action-oriented "workbench", add team member management, and connect quotes → jobs → schedule with employee assignments.

**Architecture:** All changes are in `src/App.jsx` (single-file app). New Supabase tables for `team_members`, `job_assignments`, `job_notes`. Auth uses existing Supabase Auth with role-based UI rendering. The `jobs` table already has `quote_id`, `assigned_to` (text[]), `starts_at`, `ends_at`, `status`, `address`, etc. The existing `assigned_to` + `employee_tags` system will be migrated to use `team_members` + `job_assignments` as the source of truth. The old `assigned_to` field stays for backwards compat but new assignments go through `job_assignments`.

**Tech Stack:** React 19 (Vite 7), Supabase (Postgres + Auth + Storage), inline styles with `theme` object, N8N webhooks for invite emails.

---

## File Map

All changes are in one file:
- **Modify:** `src/App.jsx` — Dashboard component rewrite (lines 3332–3757), Schedule component updates (~line 4685+), new components added before WynflowApp
- **Migration:** Supabase — 3 new tables (`team_members`, `job_assignments`, `job_notes`), RLS policies, 2 security-definer functions
- **Modify:** `vercel.json` — add `/invite/:path*` rewrite

---

## Phase 1: Dashboard Redesign

### Task 1: Supabase migrations — new tables

**Purpose:** Create the foundation tables for employees and job assignments.

- [ ] **Step 1: Apply migration for team_members table**

```sql
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'field',
  hourly_rate NUMERIC(10,2),
  color TEXT,
  status TEXT NOT NULL DEFAULT 'invited',
  invite_token UUID DEFAULT gen_random_uuid(),
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, email)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Owners can manage their business's team members
CREATE POLICY "team_select_own" ON public.team_members
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );
CREATE POLICY "team_insert_own" ON public.team_members
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );
CREATE POLICY "team_update_own" ON public.team_members
  FOR UPDATE USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );
CREATE POLICY "team_delete_own" ON public.team_members
  FOR DELETE USING (
    business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())
  );

-- Field staff can read their own team_member record
CREATE POLICY "team_select_self" ON public.team_members
  FOR SELECT USING (user_id = auth.uid());

-- Field staff can update their own record (needed for invite acceptance)
CREATE POLICY "team_update_self" ON public.team_members
  FOR UPDATE USING (user_id = auth.uid());
```

Run via `mcp__supabase__apply_migration`.

- [ ] **Step 2: Apply migration for job_assignments table**

```sql
CREATE TABLE public.job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, team_member_id, scheduled_date)
);

ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignments_select_own_biz" ON public.job_assignments
  FOR SELECT USING (
    job_id IN (
      SELECT id FROM jobs WHERE business_id IN (
        SELECT id FROM businesses WHERE user_id = auth.uid()
      )
    )
  );
CREATE POLICY "assignments_insert_own_biz" ON public.job_assignments
  FOR INSERT WITH CHECK (
    job_id IN (
      SELECT id FROM jobs WHERE business_id IN (
        SELECT id FROM businesses WHERE user_id = auth.uid()
      )
    )
  );
CREATE POLICY "assignments_update_own_biz" ON public.job_assignments
  FOR UPDATE USING (
    job_id IN (
      SELECT id FROM jobs WHERE business_id IN (
        SELECT id FROM businesses WHERE user_id = auth.uid()
      )
    )
  );
CREATE POLICY "assignments_delete_own_biz" ON public.job_assignments
  FOR DELETE USING (
    job_id IN (
      SELECT id FROM jobs WHERE business_id IN (
        SELECT id FROM businesses WHERE user_id = auth.uid()
      )
    )
  );

-- Field staff can see and update their own assignments
CREATE POLICY "assignments_select_self" ON public.job_assignments
  FOR SELECT USING (
    team_member_id IN (SELECT id FROM team_members WHERE user_id = auth.uid())
  );
CREATE POLICY "assignments_update_self" ON public.job_assignments
  FOR UPDATE USING (
    team_member_id IN (SELECT id FROM team_members WHERE user_id = auth.uid())
  );
```

- [ ] **Step 3: Apply migration for job_notes table**

```sql
CREATE TABLE public.job_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  team_member_id UUID REFERENCES team_members(id),
  note TEXT,
  photos JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.job_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_select_own_biz" ON public.job_notes
  FOR SELECT USING (
    job_id IN (
      SELECT id FROM jobs WHERE business_id IN (
        SELECT id FROM businesses WHERE user_id = auth.uid()
      )
    )
  );
CREATE POLICY "notes_insert_own_biz" ON public.job_notes
  FOR INSERT WITH CHECK (
    job_id IN (
      SELECT id FROM jobs WHERE business_id IN (
        SELECT id FROM businesses WHERE user_id = auth.uid()
      )
    )
  );
-- Field staff can add notes to their assigned jobs
CREATE POLICY "notes_insert_self" ON public.job_notes
  FOR INSERT WITH CHECK (
    team_member_id IN (SELECT id FROM team_members WHERE user_id = auth.uid())
  );
CREATE POLICY "notes_select_self" ON public.job_notes
  FOR SELECT USING (
    team_member_id IN (SELECT id FROM team_members WHERE user_id = auth.uid())
  );
```

- [ ] **Step 4: Apply migration for anon invite lookup function**

```sql
CREATE OR REPLACE FUNCTION public.get_invite(token uuid)
RETURNS TABLE(id uuid, business_id uuid, name text, email text, business_name text)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT tm.id, tm.business_id, tm.name, tm.email, b.business_name
  FROM team_members tm
  JOIN businesses b ON b.id = tm.business_id
  WHERE tm.invite_token = token AND tm.status = 'invited';
$$;

GRANT EXECUTE ON FUNCTION public.get_invite(uuid) TO anon;
```

- [ ] **Step 5: Commit**

```
feat: add team_members, job_assignments, job_notes tables with RLS
```

---

### Task 2: Reducer + loadData changes

**Files:**
- Modify: `src/App.jsx` — `initialState` (~line 379), `appReducer` (~line 383), `loadData` (~line 9416), screen-change effect (~line 9651)

**Purpose:** Add new state fields and data loading before any UI work. Must be done as a single unit so LOGOUT clears everything.

- [ ] **Step 1: Add to initialState**

```javascript
teamMembers: [],
role: "owner",    // "owner" or "field"
member: null,     // current user's team_member record
```

- [ ] **Step 2: Add reducer actions**

```javascript
case "SET_TEAM_MEMBERS": return { ...state, teamMembers: action.payload };
case "SET_ROLE": return { ...state, role: action.payload };
case "SET_MEMBER": return { ...state, member: action.payload };
```

Note: `LOGOUT` already returns `{ ...initialState }` which will clear these fields since they're in `initialState`.

- [ ] **Step 3: Add team_members to loadData Promise.all**

In `loadData` (~line 9421), add to the existing `Promise.all`:

```javascript
db("team_members").eq("business_id", business.id).order("created_at").select()
```

And dispatch: `if (teamRes.data) dispatch({ type: "SET_TEAM_MEMBERS", payload: teamRes.data });`

- [ ] **Step 4: Add "settings" and "schedule" to screen-change data refresh**

At line 9651, change:
```javascript
if (business && (screen === "dashboard" || screen === "quotes" || screen === "invoices")) {
```
to:
```javascript
if (business && (screen === "dashboard" || screen === "quotes" || screen === "invoices" || screen === "settings" || screen === "schedule")) {
```

- [ ] **Step 5: Build and verify**

Run: `npm run build`

- [ ] **Step 6: Commit**

```
feat: add teamMembers, role, member to reducer + loadData
```

---

### Task 3: Replace Dashboard component

**Files:**
- Modify: `src/App.jsx:3332-3757` (replace entire Dashboard component, inclusive of closing `};`)

**Purpose:** Replace analytics-heavy dashboard with action-oriented workbench. All analytics charts already exist in the Analytics screen.

**IMPORTANT:** The Dashboard component signature must change to accept `business`:
```javascript
const Dashboard = ({ quotes, dispatch, invoices = [], jobs = [], business }) => {
```
The parent call site that renders `<Dashboard>` must also pass `business={business}`.

- [ ] **Step 1: Replace the Dashboard component (lines 3332–3757)**

The new Dashboard has these sections in order:

1. **Greeting + Primary CTA**
   - Time-aware greeting: `const hour = new Date().getHours()` → "Morning"/"Afternoon"/"Evening" + `business.contact_name`
   - One-line weekly summary: count quotes created this week + revenue from won quotes this week
   - Full-width "Generate AI Quote" button: 56px height, teal with glow, Camera icon, `onClick → SET_SCREEN "aiQuote"`
   - 3 quick-action chips below: "New Quote" (→ newQuote), "New Invoice" (→ newInvoice), "Schedule" (→ schedule). Each 48px height, ghost/secondary style.

2. **Notification bell** — keep existing bell code (lines 3420-3486), move into the greeting header row

3. **Automation activity strip** — keep existing (lines 3491-3503), no changes

4. **Empty state for new users** — keep existing (lines 3505-3524), no changes

5. **Needs Attention** — only renders if there are action items:
   - `requested > 0`: red dot, "{N} new quote requests", tappable → quotes screen
   - `accepted > 0`: amber dot, "{N} accepted — ready to book", tappable → quotes screen
   - Follow-ups due today: `quotes.filter(q => q.next_follow_up_at && !q.follow_up_paused && new Date(q.next_follow_up_at) <= endOfToday)` — amber dot, tappable
   - `overdueInvoices > 0`: red dot, "{N} overdue invoices", tappable → invoices screen
   - If no items, section doesn't render at all (no "All clear!" placeholder)

6. **Today's Jobs** — keep existing (lines 3526-3581) but enhance:
   - Add tappable address: wrap address in `<a href="https://maps.google.com/?q=..." target="_blank">`
   - Show assigned team members as small colored dots after customer name

7. **Recent Quotes** — last 5 quotes as glass cards:
   - Status dot (color from existing Badge logic), customer name, job title, `$amount`, relative time ("2d ago", "Just now")
   - Each card tappable → `SET_SCREEN "quoteDetail:{id}"`
   - "View all →" link → quotes screen

8. **Quick Stats** — 3 numbers only in a row:
   - Quotes this month (count), Revenue this month ($), Win rate (%)
   - "View analytics →" link → analytics screen

Desktop: Greeting/CTA full width, then 2-column (Needs Attention + Today's Jobs | Recent Quotes + Stats).
Mobile: Single column, all sections stacked.

- [ ] **Step 2: Update parent to pass business prop**

Find where `<Dashboard` is rendered and add `business={business}` prop.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`

- [ ] **Step 4: Visual verification**

Run: `npm run dev` and check dashboard on desktop and mobile viewport.

- [ ] **Step 5: Commit**

```
feat: simplify dashboard — action-oriented workbench replacing analytics
```

---

### Task 4: Quote → Job auto-creation

**Files:**
- Modify: `src/App.jsx` — `onBooked` callback at line 6914 (inside QuoteDetail)

**Purpose:** When a quote is booked, automatically create a job linked to it.

**IMPORTANT — two code paths exist:**
1. **"Book & Schedule" button** (line 6758) → opens `JobFormModal` which already creates a job at line 4370-4380, then calls `onBooked` at line 4387 to mark the quote as booked. **Do NOT add job creation here — it already happens.**
2. **"Book without scheduling" button** (line 4468) inside `JobFormModal` → calls `onBooked` directly without creating a job. This is where we need the auto-creation.

The fix goes in the `onBooked` callback (line 6914). After marking the quote as booked, check if a job was already created (by JobFormModal) and if not, create one:

- [ ] **Step 1: Modify the onBooked callback at line 6914**

```javascript
onBooked={async () => {
  const updates = {
    status: "booked",
    booked_at: new Date().toISOString(),
    follow_up_paused: true,
  };
  await db("quotes").eq("id", quote.id).update(updates);
  dispatch({ type: "UPDATE_QUOTE", payload: { id: quote.id, ...updates } });

  // Auto-create job if one doesn't already exist for this quote
  const { data: existingJobs } = await db("jobs").eq("quote_id", quote.id).select();
  if (!existingJobs || existingJobs.length === 0) {
    const jobData = {
      business_id: business.id,
      quote_id: quote.id,
      title: quote.job_title,
      customer_name: quote.customer_name,
      customer_phone: quote.customer_phone || "",
      customer_email: quote.customer_email || "",
      address: "",
      starts_at: new Date().toISOString(),
      ends_at: addHours(new Date(), 2).toISOString(),
      status: "scheduled",
      amount: parseFloat(quote.amount) || 0,
      notes: quote.description || "",
    };
    const { data: newJob } = await db("jobs").insert(jobData);
    if (newJob && newJob[0]) dispatch({ type: "ADD_JOB", payload: newJob[0] });
    dispatch({ type: "NOTIFY", payload: { message: "Job created — schedule it in your calendar", type: "success" } });
  }

  dispatch({ type: "SET_SCREEN", payload: "schedule" });
}}
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`

- [ ] **Step 3: Commit**

```
feat: auto-create job when quote booked without scheduling
```

---

## Phase 2: Team Management

### Task 5: Team Members UI in Settings

**Files:**
- Modify: `src/App.jsx` — Settings component (~line 8702)

**Purpose:** Let the owner add, view, and deactivate team members.

**NOTE:** The N8N webhook `/webhook/invite-team-member` must be created in N8N before invite emails will work. For now, the invite link can be displayed in the UI for the owner to copy/share manually as a fallback.

- [ ] **Step 1: Add teamMembers prop to Settings**

Update Settings signature to accept `teamMembers` and the `loadData` callback (to refresh after adding a member):
```javascript
const Settings = ({ business, dispatch, teamMembers = [], onRefresh }) => {
```

- [ ] **Step 2: Build the Team section inside Settings**

Add a new `<Card>` section after existing cards with:
- Header: "Team" with Users icon from lucide-react
- Subtitle: "Add team members so they can see their assigned jobs"
- List of existing members as rows: name, email, role badge (`owner`/`field`), status badge (`invited`=amber/`active`=green), deactivate button (sets `status: 'deactivated'`)
- "Add Member" form at bottom: name (required), email (required), phone (optional)
- On add: `db("team_members").insert({ business_id: business.id, name, email, phone, role: "field", status: "invited" })`
- After insert: attempt POST to N8N `/webhook/invite-team-member` (fire-and-forget). Also show the invite link in a copy-able text field: `https://www.wynflow.co.nz/invite/{invite_token}`
- Color picker for each member: 8 preset colors in a row (teal, blue, green, amber, red, purple, pink, orange)

- [ ] **Step 3: Build and verify**

Run: `npm run build`

- [ ] **Step 4: Commit**

```
feat: add team member management in Settings
```

---

### Task 6: Auto-create owner team_member on signup

**Files:**
- Modify: `src/App.jsx` — AuthScreen signup flow (~line 2708)

- [ ] **Step 1: After business + follow-up sequence creation (line ~2722), insert owner team_member**

```javascript
await db("team_members").insert({
  business_id: bizRecord.id,
  user_id: authData.user.id,
  name: contactName,
  email: email,
  phone: phone.trim(),
  role: "owner",
  status: "active",
  color: "#14B8A6",
  accepted_at: new Date().toISOString(),
});
```

- [ ] **Step 2: Backfill existing businesses via migration**

```sql
INSERT INTO team_members (business_id, user_id, name, email, phone, role, status, color, accepted_at)
SELECT b.id, b.user_id, b.contact_name, b.email, b.phone, 'owner', 'active', '#14B8A6', now()
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM team_members tm WHERE tm.business_id = b.id AND tm.role = 'owner'
);
```

- [ ] **Step 3: Commit**

```
feat: auto-create owner team_member on signup + backfill existing
```

---

### Task 7: Employee invite flow + role-based rendering

**Files:**
- Modify: `src/App.jsx` — add InviteScreen component, modify session restore in WynflowAppInner
- Modify: `vercel.json` — add `/invite/:path*` rewrite

- [ ] **Step 1: Add vercel.json rewrite**

```json
{ "source": "/invite/:path*", "destination": "/index.html" }
```

- [ ] **Step 2: Add InviteScreen component**

1. Reads invite token from URL path
2. Calls RPC: `fetch(SUPABASE_URL + '/rest/v1/rpc/get_invite', { method: 'POST', body: JSON.stringify({ token }) })` with anon key
3. Shows: "You've been invited to join {business_name} on Wynflow"
4. Form: email (pre-filled, disabled), password, confirm password
5. On submit: `supabase.auth_signUp(email, password)` → then with the new auth token, update team_member: `db("team_members").eq("id", memberId).update({ user_id: newUser.id, status: "active", accepted_at: new Date().toISOString() })`
6. Show success message + "Sign In" button

- [ ] **Step 3: Add URL routing for /invite/ paths**

In `WynflowAppInner` mount effect, add before the cookie restore:
```javascript
if (path.startsWith("invite/")) {
  const token = path.split("invite/")[1];
  if (token) dispatch({ type: "SET_SCREEN", payload: "invite:" + token });
  return;
}
```

In the screen renderer, add:
```javascript
if (activeScreen === "invite") return <InviteScreen token={detailId} />;
```

- [ ] **Step 4: Modify session restore for role detection**

In the session restore, after fetching the user and business, add:

```javascript
// Check if this user is a field staff member
const { data: memberRecord } = await db("team_members")
  .eq("user_id", userId).single().select();
if (memberRecord) {
  dispatch({ type: "SET_MEMBER", payload: memberRecord });
  if (memberRecord.role === "field") {
    dispatch({ type: "SET_ROLE", payload: "field" });
    // For field staff, get their business
    const { data: fieldBiz } = await db("businesses")
      .eq("id", memberRecord.business_id).single().select();
    if (fieldBiz) dispatch({ type: "SET_BUSINESS", payload: fieldBiz });
  }
  // Owners: member is set but role stays "owner" (default from initialState)
}
```

**IMPORTANT:** For owners, `member` will be set (so they can be assigned to jobs) but `role` stays `"owner"`. Components that check for field-staff-only logic must check `role === "field"`, not just `member !== null`.

- [ ] **Step 5: Add role-based screen rendering**

In `WynflowAppInner` render, before the existing Sidebar+Dashboard layout:
```javascript
if (user && role === "field") {
  return <EmployeeApp member={member} business={business} dispatch={dispatch} />;
}
```

- [ ] **Step 6: Build and verify**

Run: `npm run build`

- [ ] **Step 7: Commit**

```
feat: employee invite flow + role-based rendering
```

---

### Task 8: Employee "My Day" view

**Files:**
- Modify: `src/App.jsx` — add EmployeeApp, MyDayView, AddNoteView components

- [ ] **Step 1: Build EmployeeApp shell**

Simple layout:
- Top bar: Wynflow logo + date with prev/next day arrows + logout button
- Bottom: 2 tabs — "My Day" (CalendarDays icon) and "Add Note" (Camera icon)
- Content renders MyDayView or AddNoteView based on active tab

- [ ] **Step 2: Build MyDayView**

Data fetching approach — since the custom `db()` has no `.in()` method, fetch all jobs for the business and filter client-side:

```javascript
// Fetch all assignments for this member on selected date
const { data: assignments } = await db("job_assignments")
  .eq("team_member_id", member.id)
  .eq("scheduled_date", formatDate(selectedDate)) // YYYY-MM-DD
  .order("start_time")
  .select();

// Fetch all jobs for the business (already loaded if owner, need fresh fetch for field)
const { data: allJobs } = await db("jobs")
  .eq("business_id", business.id)
  .select();

// Join client-side
const jobMap = {};
(allJobs || []).forEach(j => { jobMap[j.id] = j; });
const todayJobs = (assignments || []).map(a => ({
  ...a,
  job: jobMap[a.job_id],
})).filter(a => a.job);
```

Each job card:
- Time (from assignment start_time, or "No time set")
- Job title (bold, 16px)
- Customer name (14px, muted)
- Address — tappable `<a>` opens Google Maps: `href={"https://maps.google.com/?q=" + encodeURIComponent(job.address)}`
- Phone — tappable `<a href={"tel:" + job.customer_phone}>`
- Owner's notes (if any, 13px dim text)
- Status buttons row: [En Route] [On Site] [Completed] — big 48px touch targets, updates `db("job_assignments").eq("id", a.id).update({ status })`

Empty state: "No jobs scheduled for today" with CalendarDays icon

- [ ] **Step 3: Build AddNoteView**

- Dropdown: select which job (from today's assignments)
- Textarea for note
- Photo upload: reuse existing image compression logic (canvas resize to 1200px, JPEG 0.7 quality)
- Submit: `db("job_notes").insert({ job_id, team_member_id: member.id, note, photos: uploadedUrls })`
- Success toast + clear form

- [ ] **Step 4: Build and verify**

Run: `npm run build`

- [ ] **Step 5: Commit**

```
feat: employee My Day view with job cards and note adding
```

---

## Phase 3: Owner Schedule Enhancements

### Task 9: Migrate schedule from employee_tags to team_members

**Files:**
- Modify: `src/App.jsx` — Schedule component (~line 4685+), JobFormModal (~line 4303)

**Purpose:** Replace the existing `employee_tags` (text array on businesses) + `assigned_to` (text array on jobs) system with `team_members` + `job_assignments`.

- [ ] **Step 1: Update the employee filter in Schedule**

At line 4687-4696, replace:
```javascript
const employeeTags = business?.employee_tags || [];
const getEmployeeColor = (name) => {
  const idx = employeeTags.indexOf(name);
  return idx >= 0 ? EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length] : "#8B95A8";
};
const filteredJobs = employeeFilter === "all"
  ? jobs
  : jobs.filter((j) => (j.assigned_to || []).includes(employeeFilter));
```

With:
```javascript
const getEmployeeColor = (memberId) => {
  const member = teamMembers.find(m => m.id === memberId);
  return member?.color || "#8B95A8";
};
// For filtering, check job_assignments (loaded alongside jobs)
const filteredJobs = employeeFilter === "all"
  ? jobs
  : jobs.filter(j => (j._assignments || []).some(a => a.team_member_id === employeeFilter));
```

**Data loading:** When loading jobs in `loadData`, also load `job_assignments` and attach them to jobs client-side:
```javascript
const { data: assignmentsData } = await db("job_assignments")
  .eq("business_id is via jobs", ...) // Fetch all for business
  .select();
// Attach to jobs:
const jobsWithAssignments = jobsData.map(j => ({
  ...j,
  _assignments: (assignmentsData || []).filter(a => a.job_id === j.id),
}));
```

Since `job_assignments` doesn't have `business_id`, we'll load all assignments for the business's jobs. Simplest approach: load them client-side by filtering against the already-loaded jobs list.

- [ ] **Step 2: Update employee filter dropdown**

Replace `employeeTags.map(tag => ...)` with `teamMembers.filter(m => m.status === 'active').map(m => ...)`. Use `m.id` as value instead of name strings. Show colored dot using `m.color`.

- [ ] **Step 3: Update JobFormModal assigned_to field**

At line 4303+, replace the freeform tag input with a team member multi-select:
- Show checkboxes for each active team_member
- On save, create `job_assignments` rows instead of setting `assigned_to` text array
- Keep writing `assigned_to` as well for backwards compat (array of names from selected team_members)

- [ ] **Step 4: Update calendar event coloring**

At line 4707-4714, derive color from `job._assignments` → first assigned member's color, instead of from `employee_tags` index.

- [ ] **Step 5: Build and verify**

Run: `npm run build`

- [ ] **Step 6: Commit**

```
feat: migrate schedule from employee_tags to team_members system
```

---

### Task 10: Assign team members to existing jobs

**Files:**
- Modify: `src/App.jsx` — add AssignJobModal

**Purpose:** Owner can assign team members to jobs from the schedule view.

- [ ] **Step 1: Add AssignJobModal**

Opens when clicking a job event in the calendar. Shows:
- Job title and customer name (read-only)
- Date picker (defaults to job's starts_at date)
- Start time / end time pickers
- Team member multi-select (checkboxes with member name + color dot)
- Save: for each selected member, `db("job_assignments").insert({ job_id, team_member_id, scheduled_date, start_time, end_time })`
- Remove: for deselected members, `db("job_assignments").eq("job_id", jobId).eq("team_member_id", memberId).delete()`

- [ ] **Step 2: Show assignments on calendar events**

Modify calendar event rendering to show small colored dots (one per assigned member) below the event title. Max 3 dots + "+N" if more.

- [ ] **Step 3: Build and verify**

Run: `npm run build`

- [ ] **Step 4: Commit**

```
feat: job assignment modal + team member dots on calendar
```

---

## Design Language

All new components use the existing glass UI patterns:
- Card backgrounds: `rgba(255,255,255,0.04)` with `rgba(255,255,255,0.06)` borders
- Hover: `rgba(20,184,166,0.2)` border
- Text: `theme.text`, `theme.textMuted`, `theme.textDim`
- Accent: `theme.accent` (#14B8A6)
- Status dots: same colors as existing Badge component
- Touch targets: 48px minimum, primary CTAs 56px
- Mobile: `useIsMobile()` for responsive layouts
- Tappable links (address/phone): use `theme.accent` color, underline on hover

## What's NOT in MVP (later)
- Week view calendar grid (desktop)
- Push notifications for new assignments
- Time tracking / clock in-out
- GPS auto-check-in
- Recurring jobs
- Admin role (office manager)
- Offline support
- Drag-and-drop schedule editing
- Payroll integration
