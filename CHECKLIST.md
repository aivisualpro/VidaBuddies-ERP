# ✅ Notification System — Acceptance Checklist

> Steps 1–7 acceptance criteria. Check each box after manual verification.
> All tests assume you are logged in as a **Super Admin**.

---

## 🧪 Quick Test Flow

```bash
# 1. Seed test data (dev only)
curl http://localhost:3000/api/dev/seed-reminders

# 2. Trigger the cron (fans out to all Super Admins)
npm run cron:reminders

# 3. Open the app → Bell should light up + toast appears
```

---

## Step 1 — Foundation

- [ ] `pusher` and `pusher-js` are in `package.json` dependencies
- [ ] `web-push` is in `package.json` dependencies
- [ ] `.env` contains all 6 Pusher keys: `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`
- [ ] `lib/pusher/server.ts` exports `triggerNotification()` — degrades silently when keys missing
- [ ] `lib/pusher/client.ts` exports `getPusherClient()` — returns `null` on server or when keys missing
- [ ] No crash on page load when Pusher env vars are absent

## Step 2 — Bell Icon + Slide-out Panel

- [ ] Bell icon visible at far-right of the main header (Super Admin only)
- [ ] Red dot + count badge appears on bell when `unreadCount > 0`
- [ ] `animate-pulse` on bell when `hasNewSinceLastOpen` is true
- [ ] Tooltip "Notifications" appears on hover
- [ ] Pressing `N` key (not in an input) toggles the panel
- [ ] Panel slides in from the **left** side
- [ ] Panel has 3 tabs: Reminders, Shipment updates, Notifications
- [ ] "Mark all read" button visible when unread items exist
- [ ] Panel width is `420px` / `460px` on sm+

## Step 3 — Reminders Tab + Super Admin Gating

- [ ] `GET /api/notifications/reminders` returns items for Super Admins only
- [ ] Non-Super-Admins get empty `[]` (no error)
- [ ] Reminders sorted by reminder date ascending (overdue first)
- [ ] Each reminder card shows: title, comments, status pill (Open=amber, In Progress=blue)
- [ ] VB#, Serial#, Shipment# chips shown when present
- [ ] Relative time label (e.g., "Due 3h ago", "Due in 2h")
- [ ] `POST /api/notifications/reminders/sync` upserts with dedupKey, no duplicates
- [ ] Bell icon completely hidden for non-Super-Admin users

## Step 4 — Cron + Pusher Realtime

- [ ] `GET /api/cron/reminders` protected by `x-cron-secret` header
- [ ] Returns `{ fanned, emailsSent, pushesSent, superAdmins, dueReminders }`
- [ ] First run creates notifications; second run returns `fanned: 0` (dedup works)
- [ ] Pusher trigger fires `notification:new` on `private-user-{id}` channel
- [ ] `POST /api/pusher/auth` validates session and channel ownership
- [ ] Client receives realtime event → `pushIncoming()` → badge increments
- [ ] Sonner toast appears with "View" action on new notification
- [ ] Bell sound plays (degrades silently if file missing)
- [ ] `vercel.json` has cron `0 8 * * *` for `/api/cron/reminders`
- [ ] `npm run cron:reminders` script works locally

## Step 5 — Email Template + Delivery

- [ ] `lib/email/send.ts` tries Resend, falls back to SMTP (nodemailer)
- [ ] Email template is 600px, table-based, renders in email clients
- [ ] Brand bar: #0F172A background, "VidaBuddies" white text, 🔔 bell glyph
- [ ] Hero card: "You have N reminders due today" + friendly date
- [ ] Per-item rows: colored status pill (Open=amber, In Progress=blue)
- [ ] VB#, Serial#, Shipment# chips in grey
- [ ] Comments truncated at 140 chars + ellipsis
- [ ] CTA button: "View all in Active Actions →" links to `/admin/active-actions`
- [ ] Footer: Super Admin explanation + Settings link
- [ ] Dark-mode safe: `prefers-color-scheme` media query present
- [ ] Plain-text fallback mirrors HTML structure
- [ ] `GET /api/dev/preview-email/reminder` renders in browser (dev only)
- [ ] Cron sends exactly **one digest email per Super Admin per day** (dedup)
- [ ] Blocked in production: returns 404

## Step 6 — Web Push

- [ ] `npm run vapid:generate` outputs VAPID key pair
- [ ] `.env` contains `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- [ ] `public/sw.js` handles `push` event → `showNotification` with icon, badge, vibrate
- [ ] `notificationclick` → focuses existing tab or opens new window
- [ ] `POST /api/push/subscribe` saves subscription in MongoDB
- [ ] `POST /api/push/unsubscribe` removes subscription
- [ ] "Enable push" pill visible in notification panel header (when permission = default)
- [ ] Clicking "Enable push" requests permission → registers push subscription
- [ ] "Push on" badge shown when permission = granted
- [ ] "Push blocked" with tooltip shown when permission = denied
- [ ] Cron sends OS-level push notification to all registered subscriptions
- [ ] Expired endpoints (404/410) auto-cleaned from database
- [ ] Degrades gracefully when VAPID keys are missing

## Step 7 — Polish + QA

- [ ] **Skeletons**: 3 shimmer rows while reminders are loading
- [ ] **Empty states** (inline SVG, no external files):
  - [ ] Reminders: bell with checkmark + "All caught up!"
  - [ ] Shipments: ship icon + "No shipment updates yet"
  - [ ] All: inbox with checkmark + "Inbox zero. Nice."
- [ ] **Mark as read**:
  - [ ] Click a row → `PATCH /api/notifications/{id}` with `{ read: true }` (optimistic update)
  - [ ] "Mark all read" → `POST /api/notifications/mark-all-read`
- [ ] **Filtering chips**: All / Overdue / Today — filters reminders list
- [ ] **Text search**: search by title, comments, VB#, or category
- [ ] **Accessibility**:
  - [ ] `aria-label` on bell button
  - [ ] `aria-live="polite"` on the panel
  - [ ] `role="button"` + `tabIndex={0}` on reminder cards
  - [ ] Keyboard: Enter/Space activates cards, ESC closes panel
  - [ ] Focus ring visible on keyboard navigation
- [ ] **Performance**:
  - [ ] Cached for 30s — re-opening panel within 30s doesn't re-fetch
  - [ ] Refresh button forces re-fetch (invalidates cache)
- [ ] **Dev seed route**:
  - [ ] `GET /api/dev/seed-reminders` inserts 5 fake timeline entries
  - [ ] Blocked in production

---

## 🔧 Environment Variables Checklist

```env
# Pusher Channels (realtime)
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
NEXT_PUBLIC_PUSHER_KEY=        # same as PUSHER_KEY
NEXT_PUBLIC_PUSHER_CLUSTER=    # same as PUSHER_CLUSTER

# Web Push (VAPID)
VAPID_PUBLIC_KEY=              # generate: npm run vapid:generate
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=  # same as VAPID_PUBLIC_KEY

# Cron protection
CRON_SECRET=vida-refresh-secret-123

# Email
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=notifications@vidabuddies.com
SMTP_PASS=...

# App
APP_URL=http://localhost:3000
```

---

## 📁 Files Created / Modified

### Created
| File | Purpose |
|------|---------|
| `lib/pusher/server.ts` | Pusher server singleton + `triggerNotification()` |
| `lib/pusher/client.ts` | Pusher client singleton (SSR-safe) |
| `lib/push/web-push.ts` | Web Push helper + `sendPushToUser()` |
| `lib/email/send.ts` | Unified email sender (Resend → SMTP) |
| `lib/email/templates/reminder.ts` | Premium HTML email template |
| `lib/notifications/types.ts` | Shared TypeScript types |
| `lib/stores/notification-store.ts` | Zustand store with 30s cache |
| `lib/models/PushSubscription.ts` | MongoDB model for push subs |
| `components/notifications/notification-bell.tsx` | Bell icon with Pusher subscription |
| `components/notifications/notification-panel.tsx` | Full panel with tabs, filters, search |
| `app/api/pusher/auth/route.ts` | Private channel authorization |
| `app/api/push/subscribe/route.ts` | Save push subscription |
| `app/api/push/unsubscribe/route.ts` | Remove push subscription |
| `app/api/notifications/[id]/route.ts` | PATCH mark-as-read |
| `app/api/notifications/mark-all-read/route.ts` | POST bulk mark-all-read |
| `app/api/notifications/reminders/route.ts` | GET due reminders |
| `app/api/notifications/reminders/sync/route.ts` | POST sync with dedup |
| `app/api/cron/reminders/route.ts` | Daily cron (Pusher + Push + Email) |
| `app/api/dev/preview-email/reminder/route.ts` | Dev email preview |
| `app/api/dev/seed-reminders/route.ts` | Dev seed data |
| `app/api/me/route.ts` | User profile endpoint |
| `lib/timeline/lookups.ts` | Shared ID→name resolution |
| `public/sounds/bell.wav` | Notification sound |
| `vercel.json` | Cron schedule |

### Modified
| File | Change |
|------|--------|
| `public/sw.js` | Push + notificationclick handlers |
| `package.json` | web-push dep, vapid:generate + cron scripts |
| `app/api/admin/timeline/route.ts` | Refactored to use shared lookups |
