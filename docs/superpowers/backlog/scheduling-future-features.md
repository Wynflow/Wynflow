# Scheduling — Future Features Backlog

Features identified during scheduling brainstorm (2026-03-23). Each should get its own spec → plan cycle when prioritised.

## Small (add-ons to scheduling v1)
- **Customer notifications** — email via N8N when job is scheduled/rescheduled. Simple webhook call.
- **iCal export** — generate .ics feed URL from jobs table. "Copy calendar link" button in Settings.

## Medium (standalone features)
- **Recurring jobs** — recurrence rules (weekly, fortnightly, monthly), auto-generation of future records, "edit this one vs all future" UI.
- **Time tracking** — clock in/out per job, duration tracking, reporting view. Builds on jobs table.
- **Job costing** — track actual material/labour costs against quote estimate. Needs UI for logging actuals.
- **Map view** — geocode job addresses, render on map. Useful for route planning.

## Large (separate projects)
- **Employee logins & permissions** — multi-user auth, role-based access, per-employee views. Rebuilds auth system.
- **Customer self-booking** — public availability page, time slot rules, booking confirmation flow. Almost a separate product.
