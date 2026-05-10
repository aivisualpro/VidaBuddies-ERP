# Bell Icon + Reminders + Pusher + Email — AI Agent Prompts

Feed these to your AI coding agent (Claude / Cursor / Windsurf) **one step at a time**.
Wait for each step to finish, run the app, eyeball it, then paste the next prompt.

Stack the agent must respect (already detected in your repo):

- Next.js 16 (app router) + React 19 + TypeScript
- MongoDB via Mongoose (`@/lib/db` + models in `@/lib/models/...`)
- Auth: custom JWT cookie `vb_session` via `jose` — `getSession()` returns `{ id, name, email, role }`
- UI: shadcn/ui (Radix) + Tailwind v4 + `lucide-react` + `@tabler/icons-react`
- Toasts: `sonner`
- Header: `components/site-header.tsx` with `useHeaderActions` provider
- Existing notification model: `lib/models/VidaNotification.ts`
- Existing reminder data: `lib/models/VidaTimeline.ts` (`status`, `reminder` fields)
- Email: nodemailer SMTP (already wired in `app/api/admin/send-email/route.ts`) + `resend` is also installed
- PWA folder already exists at `components/pwa/`

---

## STEP 0 — Deep Project Analysis (paste this first, do not write any code yet)

```
You are working in a Next.js 16 + TypeScript ERP app called vidaBuddiesERP. 
Before writing ANY code, deeply analyze the project and produce a written report.

DO THIS:
1. Read package.json and list all relevant dependencies (UI, DB, email, realtime, PWA).
2. Open and summarize:
   - components/site-header.tsx
   - components/providers/header-actions-provider.tsx
   - components/app-sidebar.tsx
   - lib/auth.ts and lib/auth-utils.ts (how getSession works, what fields exist)
   - lib/models/VidaUser.ts (note the AppRole field and that "Super Admin" is a role)
   - lib/models/VidaTimeline.ts (note status + reminder fields)
   - lib/models/VidaNotification.ts
   - app/api/admin/timeline/route.ts
   - app/api/admin/notifications/route.ts
   - app/api/admin/send-email/route.ts (existing nodemailer setup)
   - app/(protected)/admin/active-actions/page.tsx
3. Tell me:
   - which UI primitives are already available in components/ui/* (sheet, tabs, scroll-area, badge, button, dropdown-menu, popover, tooltip)
   - whether Pusher is installed (it is NOT — we will install it)
   - the exact shape returned by /api/admin/timeline (note _VBNumberDisplay etc.)
   - how the header right-side currently renders ThemeSelector and ModeSwitcher
4. Output a 1-page plan describing what you will build in steps 1–6 below, 
   listing every file you will create or modify with a one-line purpose.

Do NOT generate code yet. Only the report + plan.
```

---

## STEP 1 — Foundation: install deps, env vars, helper libs

```
Implement step 1 only. Stop after this and wait for me.

GOAL: install Pusher, add env keys, create reusable server + client helpers.

1. Install packages:
   npm i pusher pusher-js
   npm i -D @types/pusher-js   (skip if not needed)

2. Add to .env.local (do not commit). Print exactly which keys to set:
   PUSHER_APP_ID=
   PUSHER_KEY=
   PUSHER_SECRET=
   PUSHER_CLUSTER=
   NEXT_PUBLIC_PUSHER_KEY=
   NEXT_PUBLIC_PUSHER_CLUSTER=
   NOTIFY_EMAIL_FROM="VidaBuddies <noreply@vidabuddies.com>"
   APP_URL=http://localhost:3000

3. Create lib/pusher/server.ts:
   - exports a singleton `pusherServer = new Pusher({...})` using server env keys
   - exports `triggerNotification(channel, event, payload)` helper

4. Create lib/pusher/client.ts:
   - "use client" safe singleton `getPusherClient()` using NEXT_PUBLIC_* keys
   - returns null on the server (typeof window === "undefined")

5. Create lib/notifications/types.ts with shared TS types:
   export type NotificationKind = "reminder" | "shipment" | "system";
   export interface BellNotification {
     id: string;
     kind: NotificationKind;
     title: string;
     message: string;
     link?: string;
     read: boolean;
     createdAt: string;       // ISO
     meta?: Record<string, unknown>;
   }

6. Extend lib/models/VidaNotification.ts (only add, don't break existing):
   - add fields: kind ("reminder" | "shipment" | "system" | legacy enum still allowed),
     userEmail (string, indexed) so we can target Super Admins,
     sourceId (string) — the related VidaTimeline._id for de-dup,
     dedupKey (string, indexed, unique sparse) — formatted like
     `reminder:<timelineId>:<YYYY-MM-DD>` so we never insert the same
     reminder twice in one day.
   - keep backwards compatibility with existing docs.

OUTPUT: exact diff of every file changed/created and the npm command run.
Do not touch the bell icon, header, or UI yet.
```

---

## STEP 2 — Bell icon in header + slide-out panel with 3 tabs

```
Implement step 2 only.

GOAL: a beautiful bell icon at the far right of the main header that opens a 
slide-over from the LEFT side of the screen with 3 tabs.

1. Create components/notifications/notification-bell.tsx ("use client"):
   - Bell icon using lucide-react `Bell`
   - Animated red dot + count badge (top-right) when unreadCount > 0
   - On click, opens the panel (controlled by zustand store, see step 4)
   - Subtle `animate-pulse` only when there are NEW unread items (not just any unread)
   - Tooltip via components/ui/tooltip on hover ("Notifications")
   - Keyboard shortcut: pressing "n" while not in an input opens it

2. Create components/notifications/notification-panel.tsx ("use client"):
   - Use components/ui/sheet with `side="left"` (slides in from the LEFT)
   - Width: w-[420px] sm:w-[460px], full-height
   - Header inside the sheet: large title "Notifications" + a "Mark all read" button
   - Use components/ui/tabs with three triggers in this exact order:
        Tab 1: "Reminders"           value="reminders"
        Tab 2: "Shipment updates"    value="shipments"
        Tab 3: "Notifications"       value="all"
   - Each tab body is a components/ui/scroll-area, vertical, full remaining height
   - Pretty empty state per tab (icon + title + helper line) — do not leave blank
   - For now Reminders shows a placeholder list, the other two say
     "Coming soon — we'll wire this up next."
   - Persist selected tab in zustand so it survives reopen.

3. Create lib/stores/notification-store.ts (zustand — already in package.json):
   export interface NotificationState {
     open: boolean;
     activeTab: "reminders" | "shipments" | "all";
     items: BellNotification[];
     unreadCount: number;
     setOpen: (v: boolean) => void;
     setActiveTab: (t: ...) => void;
     setItems: (items: BellNotification[]) => void;
     markAllRead: () => Promise<void>;
     markRead: (id: string) => Promise<void>;
     pushIncoming: (n: BellNotification) => void;  // called by Pusher subscriber
   }

4. Mount the bell + panel in components/site-header.tsx:
   - Render <NotificationBell /> immediately BEFORE <ThemeSelector /> in the
     ml-auto cluster (so the order from left→right inside that cluster is:
     headerCtx.actions → BELL → ThemeSelector → ModeSwitcher).
   - Render <NotificationPanel /> as a sibling at the bottom of <header> 
     (sheet portals, doesn't matter where).

5. Visual polish:
   - Bell button: ghost variant, h-9 w-9 rounded-full, subtle hover ring
   - Badge: absolute -top-0.5 -right-0.5, h-4 min-w-[16px], rounded-full,
     bg gradient from rose-500 to red-600, white text, text-[10px], font-bold,
     ring-2 ring-background
   - When unreadCount > 99 show "99+"
   - Light + dark mode both look great (use existing semantic Tailwind tokens
     like bg-background, border, muted-foreground)

ACCEPTANCE: I can click the bell, panel slides in from the LEFT, all three
tabs render with empty states, no console errors, looks beautiful in both
light and dark mode. Stop here.
```

---

## STEP 3 — Reminders tab: API + UI + Super Admin gating + daily de-dup

```
Implement step 3 only.

GOAL: Tab 1 (Reminders) shows VidaTimeline entries where 
status ∈ {"Open","In Progress"} AND reminder is set AND reminder <= today, 
visible ONLY to users whose AppRole is "Super Admin", with one notification 
per reminder per day.

1. Create app/api/notifications/reminders/route.ts:
   GET:
     - await getSession(); if no session → 401
     - load VidaUser by session.email; if user.AppRole !== "Super Admin" → return []
     - connect DB
     - query VidaTimeline:
         status: { $in: ["Open", "In Progress"] }
         reminder: { $ne: null, $lte: endOfToday() }   // due today or overdue
       sort: reminder ascending (overdue first)
     - enrich with the same display-name lookups used in 
       app/api/admin/timeline/route.ts (factor a small helper if clean)
     - map to BellNotification shape:
         id: timeline._id
         kind: "reminder"
         title: `Reminder: ${type} ${VBNumberDisplay || ""}`.trim()
         message: comments || "—"
         link: "/admin/active-actions"
         read: false
         createdAt: reminder ISO
         meta: { status, category, VBSerialNumber, VBShipmentNumber }
     - return JSON array

2. Create app/api/notifications/reminders/sync/route.ts (POST):
   - same auth + Super Admin check
   - for each due reminder, upsert into VidaNotification using dedupKey 
     `reminder:<timelineId>:<YYYY-MM-DD-of-today>` so running this multiple 
     times the same day creates ZERO duplicates
   - for each NEW upsert, call triggerNotification(
        `private-user-${user._id}`, "notification:new", bellNotification)
   - return { created: n, skipped: m }

3. Wire the Reminders tab in components/notifications/notification-panel.tsx:
   - On panel open AND on tab=reminders: fetch /api/notifications/reminders
   - Render each as a card row:
        left: amber-tinted CalendarClock icon in a soft circle
        title: bold, line-clamp-1
        message: muted, line-clamp-2
        bottom row: small chips for status + category + the VB number,
                    plus a relative time ("Due 2h ago" / "Due in 4h")
        right: small "Open" link → entry.link
   - Hover: subtle bg-muted/30, cursor-pointer; click marks read + navigates
   - Show a header inside the tab: "X due today" with a refresh icon button
     that re-runs the sync endpoint and re-fetches.

4. Hide the bell entirely if the current user is not Super Admin:
   - Add a small /api/me endpoint OR pass session to a NotificationGate
     server component that conditionally renders the bell.
   - If not Super Admin → render nothing (no bell, no shortcut, no panel mount).

ACCEPTANCE: as a Super Admin I see the reminders; as any other role the bell
does not appear. Reminders that are due today or overdue and Open/In Progress
appear; Done items never appear. Refreshing twice in a day creates no dupes.
Stop here.
```

---

## STEP 4 — Daily auto-trigger (cron) + Pusher realtime

```
Implement step 4 only.

GOAL: every day at 8:00 AM server time, fan out reminders to all Super Admins
via Pusher (in-app live) AND email; also fire instantly when a user opens the
panel for entries newly due.

1. Create app/api/cron/reminders/route.ts (GET):
   - protected with header "x-cron-secret" === process.env.CRON_SECRET
   - load all VidaUser where AppRole === "Super Admin" AND isActive
   - for each due VidaTimeline (same query as step 3), upsert VidaNotification
     per user with dedupKey `reminder:<timelineId>:<YYYY-MM-DD>:<userId>`
   - on each newly created row:
       a) pusherServer.trigger(`private-user-${user._id}`, "notification:new", payload)
       b) enqueue email (step 5)
   - return { fanned: n }

2. Add scheduling:
   - If deploying on Vercel: add vercel.json with a cron entry
       { "crons": [{ "path": "/api/cron/reminders", "schedule": "0 8 * * *" }] }
     and document setting CRON_SECRET in env.
   - Locally: add a npm script "cron:reminders" that curls the endpoint with
     the secret header, plus a README note.

3. Pusher subscribe on the client:
   - In components/notifications/notification-bell.tsx (or a parent provider):
        on mount, if user logged in:
            const p = getPusherClient();
            const channel = p.subscribe(`private-user-${userId}`);
            channel.bind("notification:new", (n: BellNotification) => {
                useNotificationStore.getState().pushIncoming(n);
                // toast via sonner with bell icon, action "Open"
            });
   - On unmount: unbind + unsubscribe.
   - Add app/api/pusher/auth/route.ts for private-channel auth using
     pusherServer.authorizeChannel + the session userId.

4. UX:
   - When a new notification arrives:
       * bump unreadCount
       * play a soft 1-shot sound (public/sounds/bell.mp3 — use an existing
         royalty-free file or keep silent if unavailable; degrade gracefully)
       * show sonner toast (top-right) with title + "View"
       * the bell icon does a one-time ring animation (200ms shake)

ACCEPTANCE: when I curl the cron endpoint locally with the secret, all 
Super Admins instantly see a sonner toast and the bell badge increments
without a page refresh. Stop here.
```

---

## STEP 5 — Beautiful email template + delivery

```
Implement step 5 only.

GOAL: when step 4 fans out a reminder, also email the Super Admin with a
gorgeous, brand-consistent HTML template.

1. Create lib/email/send.ts:
   - Try `resend` first if RESEND_API_KEY is present, else fall back to
     the existing nodemailer SMTP transporter pattern from
     app/api/admin/send-email/route.ts. Export `sendMail({to,subject,html,text})`.

2. Create lib/email/templates/reminder.ts that exports
   `renderReminderEmail(input: {
       userName: string;
       items: Array<{ title: string; comments?: string;
                      vbNumber?: string; vbSerial?: string;
                      vbShipment?: string; reminder: Date;
                      status: string; link: string; }>;
       appUrl: string;
   }): { subject: string; html: string; text: string }`

   Design rules for the HTML:
   - Width 600px, centered, table-based for email-client compatibility.
   - System font stack (San Francisco / Segoe UI / Inter fallback).
   - Top: brand bar — solid background, 56px tall, brand color #0F172A,
     white logo word "VidaBuddies" left-aligned, a small bell glyph right.
   - Hero card (rounded 12px, subtle shadow, border #E2E8F0):
       headline: "You have N reminders due today"
       subhead: "<friendly date string>"
   - Each item rendered as a row:
       left: small colored pill (Open=amber #F59E0B, In Progress=blue #3B82F6)
       center: bold title, comments below (max 140 chars + ellipsis)
       right: button "Open" → link
       chips: VB#, Serial#, Shipment# in a small grey font
   - CTA button at bottom: "View all in Active Actions" → /admin/active-actions
   - Footer: muted #64748B, "You're receiving this because you're a Super Admin
     in VidaBuddies. Manage in Settings." (link to /admin/settings)
   - Dark-mode safe: use prefers-color-scheme media query inline.
   - Plain-text fallback mirrors structure.

3. Hook into step 4: after creating notifications for a user, batch their
   items and call sendMail with the rendered template. One email per user
   per day max (use a separate dedupKey on VidaNotification or a small
   EmailLog model).

4. Add a dev-only route GET /api/dev/preview-email/reminder that renders
   the HTML in the browser using mock data. Gate it on
   process.env.NODE_ENV !== "production".

ACCEPTANCE: hitting the preview route shows the full beautiful email; cron
run results in exactly one styled email per Super Admin per day. Stop here.
```

---

## STEP 6 — Push notifications (desktop + mobile PWA) via Web Push

```
Implement step 6 only.

GOAL: when Pusher fires "notification:new" the user also gets an OS-level
push (works on desktop Chrome/Edge/Safari and on installed PWA on Android/iOS).

Note: use the Web Push API + a service worker. Pusher Beams is NOT required.

1. Generate VAPID keys (npm run script using web-push) and store:
   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY.

2. Extend public/sw.js (or the existing PWA service worker registered by
   components/pwa/service-worker-registration.tsx) to handle:
   - push event → showNotification with icon /icons/bell-192.png, badge,
     vibrate [100,50,100], data.url
   - notificationclick → focus or open data.url

3. Create lib/models/PushSubscription.ts (userId, endpoint unique, keys).

4. Routes:
   - POST /api/push/subscribe — saves subscription against current user
   - POST /api/push/unsubscribe
   - The cron in step 4 also iterates each Super Admin's subscriptions
     and calls webpush.sendNotification with a small JSON payload.

5. UI:
   - In notification-panel.tsx header add a small "Enable push" pill button
     when Notification.permission === "default". Clicking requests permission
     and registers a subscription. If denied, show a tooltip explaining how
     to re-enable in browser settings.

ACCEPTANCE: I click "Enable push", grant permission, run the cron, and a
native notification appears on my desktop AND on the installed PWA. Stop here.
```

---

## STEP 7 — Polish + QA pass

```
Implement step 7 only.

GOAL: make the experience feel premium and battle-test it.

1. Skeletons: while reminders are loading show 3 shimmer rows
   (use components/skeletons.tsx patterns).
2. Empty states with illustrations (simple inline SVG, not an external file):
   - Reminders empty: "All caught up! You'll see reminders here when they're due."
   - Shipments empty: "No shipment updates yet."
   - All empty: "Inbox zero. Nice."
3. Mark-as-read:
   - Click a row → PATCH /api/notifications/<id> { read: true }, optimistic update.
   - "Mark all read" button → POST /api/notifications/mark-all-read.
4. Filtering chips at top of Reminders tab: All / Overdue / Today, plus a
   small text search.
5. Accessibility:
   - aria-label on bell button, aria-live="polite" on the panel,
     focus trap inside the sheet, ESC closes.
6. Performance:
   - Don't fetch on every open — cache for 30s in the zustand store; refresh
     button forces re-fetch.
7. Tests / smoke:
   - Add a /api/dev/seed-reminders route (NODE_ENV !== production) that
     inserts 5 fake VidaTimeline entries with mixed statuses + reminder dates.
   - Document: how to log in as Super Admin, hit seed, hit cron, see the
     bell light up + email + push.

OUTPUT a CHECKLIST.md at the repo root with every acceptance criterion 
from steps 1–7 and tick boxes I can manually verify.
```

---

## Tips for vibe-coding this safely

- After each step, run `npm run dev` and click around before pasting the next prompt.
- If the agent goes off-script, paste: *"Stop. Revert the last change. Re-read STEP X and only do that."*
- Keep a separate git branch: `git checkout -b feat/notifications-bell`. Commit after each step.
- If Pusher feels heavy, you can swap it for SSE (`/api/notifications/stream`) — same UI, same store, different transport. Tell the agent that and it can refactor in a single pass.
