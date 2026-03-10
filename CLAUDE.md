# Wynflow — CLAUDE.md

## What This Project Is
Quote management SaaS for NZ trades businesses (tradies). AI-powered quoting from job site photos, automated follow-up email sequences, and a full analytics dashboard. Solo-founder project (Jesse, Auckland).

**Domain:** wynflow.co.nz (Vercel hosted)

## Tech Stack
- **Frontend:** React 19 (Vite 7) — single-page app, no router
- **Styling:** Inline styles only (no Tailwind, no CSS modules). Theme object in `src/App.jsx`
- **Icons:** lucide-react
- **Fonts:** DM Sans (body) + Playfair Display (headings), loaded via Google Fonts
- **Backend:** Supabase (Postgres, Auth, Storage) — custom REST client in App.jsx, NOT the official Supabase JS SDK
- **Automation:** N8N webhooks (wynfallautomation.app.n8n.cloud) for email sending, AI quote generation, follow-ups
- **Email:** Resend (transactional + open tracking) — triggered via N8N
- **Payments:** Stripe payment links (Starter $29/mo, Pro $49/mo)
- **Hosting:** Vercel with SPA rewrites for `/request/:path*`

## Architecture — IMPORTANT

### Single-file app
The entire frontend lives in **`src/App.jsx`** (~4120 lines). There are no other component files. Everything is in this one file:
- Custom Supabase client (`supabase` object + `db()` query builder)
- State management (useReducer with `appReducer`)
- All components (public pages, auth, dashboard, forms, settings, etc.)
- Theme/design tokens
- Global CSS (injected via `<style>` tag)

### Custom Supabase Client (DO NOT replace)
The project uses a hand-rolled Supabase REST client instead of `@supabase/supabase-js`. It's defined at the top of App.jsx:
- `supabase` object — handles auth (signUp, signIn, signOut, getUser), file uploads, signed URLs
- `db(table)` function — chainable query builder (`.eq()`, `.order()`, `.limit()`, `.single()`, `.select()`, `.insert()`, `.update()`, `.delete()`)
- Auth tokens stored as cookies (`wynflow_token`, `wynflow_user`, `wynflow_business`)

### State Management
Uses `useReducer` with actions: `SET_USER`, `SET_BUSINESS`, `SET_LOADING`, `LOGOUT`, `SET_SCREEN`, `GO_BACK`, `SET_QUOTES`, `ADD_QUOTE`, `UPDATE_QUOTE`, `SET_SEQUENCES`, `ADD_SEQUENCE`, `UPDATE_SEQUENCE`, `NOTIFY`, `CLEAR_NOTIFY`

### Navigation
Screen-based routing via `state.screen` string. No React Router. Supports colon-delimited params (e.g. `"quoteDetail:uuid"`, `"requestQuote:uuid"`). URL path routing only for public pages and `/request/:id`.

## Supabase Tables (inferred from code)
- `businesses` — user_id, business_name, contact_name, email, phone, trade, trade_category, hourly_rate, callout_fee, price_list (jsonb), subscription_status, decline_reasons (jsonb), bank details, address, gst_number, license_number, quote_footer, require_deposit, deposit_percentage
- `quotes` — business_id, quote_number, customer_name, customer_email, customer_phone, job_title, description, amount, status, pdf_url, pdf_filename, sent_at, responded_at, booked_at, sequence_id, next_follow_up_at, current_step, follow_up_paused, ai_estimate, ai_estimate_range_low/high, ai_estimate_notes, photos (jsonb), decline_reason, decline_comment
- `follow_up_sequences` — business_id, name, is_active, is_default
- `sequence_steps` — sequence_id, step_order, delay_days, email_subject, email_body
- `quote_responses` — quote_id, response_type, feedback_text, responded_at
- `follow_up_logs` — quote_id, sent_at
- **Storage bucket:** `quote-pdfs`

**DO NOT** modify table structure without confirming with Jesse first.

## N8N Webhook Endpoints
- `POST /webhook/generate-quote` — AI quote generation (sends photos, business rates, trade, quote history)
- `POST /webhook/send-quote` — sends quote email to customer
- `POST /webhook/send-follow-up` — sends manual follow-up email
- `POST /webhook/quote-request` — public quote request form submission
- `GET /webhook/get-business-name?id=` — fetches business name for public request page
- `POST /webhook/new-business` — notification when new business signs up

## Quote Statuses
`draft` → `pending` → `requested` → `sent` → `opened` → `accepted` → `booked` → `declined` (+ `feedback`)

## All Components (in order of appearance in App.jsx)

### Hooks
- `useSEO(screen)` — sets document title, meta description, canonical, OG tags for public pages
- `useIsMobile()` — responsive breakpoint hook (768px)
- `useInView(threshold)` — IntersectionObserver for scroll animations

### Utility Components
- `Badge` — status pill with color dot
- `Button` — primary/secondary/ghost/danger variants, sm/md/lg sizes
- `Input` — text/email/password/number/file/textarea input with label
- `Card` — bordered container with hover effect
- `Stat` — dashboard stat card with icon
- `Spinner` — loading spinner
- `Toast` — auto-dismissing notification (3s)
- `FadeIn` — scroll-triggered fade-in animation wrapper

### Public Pages
- `Navbar` — responsive nav with transparent/scrolled states, mobile hamburger menu
- `Footer` — site footer with links
- `HomePage` — hero, features grid (6), how-it-works (3 steps), CTA
- `AboutPage` — origin story, follow-up statistics, problem/solution, founder bio
- `PricingPage` — 2-tier pricing (Starter/Pro) with glass plan cards, FadeIn animations, gradient dividers, radial gradient hero, Check icons, glow CTA, FAQ accordion
- `RequestQuotePage` — public form for customers to request quotes (name, email, phone, job title, description, up to 5 photos with compression)
- `EmailPreviewModal` — static email preview modal (demo)

### Auth
- `AuthScreen` — login/signup form with password reset flow. Signup creates business + default follow-up sequence (3 steps)
- `ResetPasswordScreen` — password reset form (accessed via Supabase recovery URL hash)

### Dashboard (authenticated)
- `Sidebar` — desktop: glass sidebar (`rgba(255,255,255,0.02)`) with subtle border; mobile: frosted glass bottom tab bar with blur backdrop. Nav items: Dashboard, Quotes, Analytics, Follow-Ups, Help, Settings
- `Dashboard` — stats row (total, awaiting, accepted, booked, revenue), action alerts (new requests, accepted needing booking), win rate ring chart, quote funnel bars, monthly revenue sparkline, follow-up effectiveness, recent quotes list
- `QuotesList` — filterable/searchable quotes table with status filter tabs
- `Analytics` — win rate, revenue, avg quote value, avg response time, quote funnel, follow-up effectiveness chart, monthly overview table, decline reasons chart
- `AIQuoteForm` — standalone AI quote form (customer details → job details → site photos → generate → edit scope/materials/pricing → preview → send)
- `QuotePreview` — professional quote preview modal (rendered inside AIQuoteForm)
- `NewQuoteForm` — manual quote form with PDF upload, sequence selection
- `QuoteGenerator` — inline AI quote generator for "requested" quotes (embedded in QuoteDetail)
- `QuoteDetail` — full quote view with customer info, amount, AI estimate display, customer photos, PDF attachment, follow-up timeline, customer responses, action buttons (mark accepted/declined/booked, send follow-up)
- `SequencesManager` — edit follow-up sequences and steps (up to 5 steps), placeholder system ({name}, {job}, {amount}, {business_name}), live email preview, reorder/add/delete steps
- `HelpCentre` — searchable FAQ accordion with 7 categories (~30 articles)
- `Settings` — business profile, quote details (address, GST, license, footer), pricing & AI estimates (hourly rate, callout fee, price list), deposit & bank details, email configuration, quote request link, feedback questionnaire editor (up to 8 decline reasons), subscription management
- `OnboardingTutorial` — 4-step modal tutorial for new users

### Main App Component
- `WynflowApp` — root component, manages session restoration from cookies, URL routing (public pages, `/request/:id`, recovery hash), data loading, screen rendering

## Design Language — Linear-Inspired Glass UI
The app uses a **Linear-inspired dark glass aesthetic** throughout. Key patterns:
- **Glass backgrounds** — components use `rgba(255,255,255,0.03-0.06)` instead of solid colors
- **Subtle borders** — `rgba(255,255,255,0.06-0.08)` with teal hover accents `rgba(20,184,166,0.2)`
- **Frosted glass** — mobile bottom bar and navbar use `backdropFilter: "blur(16px)"` with `rgba` backgrounds
- **Gradient dividers** — `linear-gradient(90deg, transparent, rgba(...), transparent)` between sections
- **Radial gradient orbs** — decorative background glows on public pages
- **FadeIn scroll animations** — `useInView` + CSS transitions on public page sections
- **Glow accents** — teal box-shadows on CTAs (`0 0 24px rgba(20,184,166,0.3)`)

When adding new components, maintain these glass/rgba patterns. Don't use solid `theme.surface` or `theme.surfaceLight` for card backgrounds — use `rgba(255,255,255,0.04)` with `rgba(255,255,255,0.06)` borders.

## Theme Colors
- Background: `#0A0E17`
- Surface: `#111827`, `#1A2235` (used in theme object, but components prefer rgba glass equivalents)
- Accent (teal): `#14B8A6`, hover: `#0D9488`, glow: `rgba(20,184,166,0.25)`
- Green: `#22C55E`, Red: `#EF4444`, Blue: `#3B82F6`
- AI features use the teal accent (`#14B8A6`) to match the logo
- Text: `#F1F3F7` (primary), `#8B95A8` (muted), `#5C6578` (dim)
- All status colors have soft `rgba` bg variants (e.g. `theme.greenSoft`, `theme.redSoft`)

## Trade Categories
Plumber, Electrician, Builder, Painter, Roofer, Landscaper, Carpet Layer, Tiler, Cleaner, Handyman, Mechanic, Fencer, Locksmith, Gasfitter, Drainlayer, Plasterer, Concreter, Pest Control, Arborist, Interior Designer, Other

## Key Conventions
- All styling is inline — use the `theme` object for colors/fonts
- Mobile-first responsive design — always check `useIsMobile()` for layout adjustments
- NZ-friendly plain English copy (tradies, not "contractors")
- React functional components + hooks only
- Simple > clever
- Don't create new Supabase client instances — use the existing `supabase` and `db()` objects
- Image compression before upload (max 1200px, JPEG 0.7 quality)
- Follow-up emails use placeholder tags: `{name}`, `{job}`, `{amount}`, `{business_name}`
- Confirm before any large structural changes or Supabase schema modifications

## Files
```
src/App.jsx          — entire app (4120 lines)
src/main.jsx         — React entry point
src/index.css        — empty
src/App.css          — empty
index.html           — HTML shell with meta tags, Google site verification
vercel.json          — SPA rewrites for /request/*
vite.config.js       — standard Vite + React config
public/              — logo.png, favicons, og-image.png, robots.txt, sitemap.xml
```
