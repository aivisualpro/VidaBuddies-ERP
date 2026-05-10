# Chat System — QA Checklist

> **Generated**: 2026-05-11  
> **Covers**: Steps 1–9 of the chat modernization project

---

## Step 1 — Data Model Upgrade

- [ ] `VidaConversation` schema includes: `kind`, `name`, `icon`, `participants`, `admins`, `refs[]`, `pinned[]`, `mutedBy[]`, `archivedBy[]`, `unreadBy`, `typing`
- [ ] `VidaMessage` schema includes: `conversationId`, `senderId`, `kind`, `text`, `mentions[]`, `refs[]`, `attachments[]`, `replyTo`, `reactions[]`, `readBy[]`, `deliveredTo[]`, `editedAt`, `deletedAt`, `mirrorOf`
- [ ] Compound indexes exist on both collections (check via `db.vidamessages.getIndexes()` in Compass)
- [ ] `VidaUser` has `lastSeen: Date` and `chatSettings` sub-document

---

## Step 2 — Realtime (Pusher)

- [ ] Pusher keys set in `.env.local`: `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`
- [ ] `lib/pusher/server.ts` exports `triggerToConversation()`, `triggerToUser()`, `triggerPresence()`
- [ ] `lib/pusher/client.ts` exports SSR-safe `getPusherClient()` singleton
- [ ] `POST /api/pusher/auth` authorizes: `private-user-<id>`, `private-conv-<id>`, `presence-conv-<id>`, `presence-online`
- [ ] Membership check: unauthorized user on a conversation channel → 403

---

## Step 3 — Sub-sidebar (Tree)

- [ ] `ChatTreeSidebar` renders three-level tree: VBNumber → VBSerialNumber → VBShipmentNumber
- [ ] Direct Messages section lists DMs and group conversations
- [ ] Mentions section shows at top with unread badge count
- [ ] Search filters conversations in real-time
- [ ] Expand/collapse state auto-opens to active conversation
- [ ] `onNewChat` callback triggers group creation dialog

---

## Step 4 — WhatsApp-grade Chat Thread

- [ ] `ChatHeader` shows avatar + name + presence dot
- [ ] "last seen Xm ago" shows when user is offline (falls back to `lastSeen`)
- [ ] Ref chips appear as colored pills below the name
- [ ] Messages alternate left/right with correct bubble styles
- [ ] Streaks detected: avatar shown only on first msg in 5-min window
- [ ] `DaySeparator` renders between day groups
- [ ] `TypingIndicator` shows when others are typing
- [ ] Auto-scroll to bottom on new messages (respects `prefers-reduced-motion`)
- [ ] Scroll to top loads older messages (cursor-based, not skip)
- [ ] `EmptyState` shown when no conversation is selected

---

## Step 5 — # and @ Tag System

- [ ] Typing `@` in composer triggers employee picker popover
- [ ] Typing `#` triggers record picker with tabs: VB# / Serial# / Shipment# / All
- [ ] Selected mentions render as styled chips in the input
- [ ] Selected refs render as colored entity chips
- [ ] Mentions and refs stored in message document as structured data
- [ ] Fuzzy filtering works on the typed query

---

## Step 6 — Attachments

- [ ] Paperclip button shows Image / File options
- [ ] Drag-and-drop onto thread area uploads files
- [ ] Preview row above composer shows queued attachments with remove "x"
- [ ] Images render as rounded thumbnails in bubbles; click opens lightbox
- [ ] Files render as downloadable pills with icon + size
- [ ] Audio attachments render with `<audio>` player
- [ ] `POST /api/admin/chat/upload` returns Cloudinary URL + metadata

---

## Step 7 — Chat Icon on PO / CPO / Shipment Cards

- [ ] Chat column added to Purchase Orders list with unread badge
- [ ] Chat column added to Customer POs list with unread badge
- [ ] Chat column added to Shipments list with unread badge
- [ ] Clicking chat icon opens `RecordChatDrawer` (Sheet, 520px)
- [ ] Drawer shows "Open in chat" link → `/admin/chat?conv=<id>`
- [ ] `GET /api/admin/chat/unread-by-refs` returns aggregated unread counts
- [ ] `GET /api/admin/chat/conversations/by-ref` auto-creates ref conversations

---

## Step 8 — Notifications (Bell + Email + Push)

- [ ] `VidaNotification` kind enum includes `chat` and `mention`
- [ ] Bell panel has a **Chat** tab with `MessageCircle` icon
- [ ] Chat tab loads notifications via `GET /api/notifications/chat`
- [ ] `ChatNotifCard` renders with blue (message) or amber (mention) icon
- [ ] Clicking a chat notification navigates to `/admin/chat?conv=<id>` and marks read
- [ ] Real-time: bell badge increments when `notification:new` fires on Pusher
- [ ] Sonner toast appears for incoming chat notifications
- [ ] Email sent for DMs (rate-limited: 5min per conv per user)
- [ ] Email sent for @mentions (rate-limited: 1min per conv per user)
- [ ] Email template renders: brand bar, hero, quoted message, ref chips, CTA
- [ ] Web push fires for @mentions only (tag prevents stacking)
- [ ] `dedupKey = chat:<convId>:<msgId>:<userId>` prevents duplicate notifications

---

## Step 9 — Polish

### 9.1 Presence

- [ ] Green dot shows on avatar when user is online via `presence-conv-<id>` or `presence-online`
- [ ] "last seen Xm ago" computed from `VidaUser.lastSeen`
- [ ] `lastSeen` updates on Pusher `subscription_succeeded`
- [ ] `POST /api/admin/chat/presence` endpoint updates timestamp

### 9.2 In-conversation Search

- [ ] Search icon in header toggles slide-down search bar
- [ ] Typing + Enter searches messages via `/api/admin/chat/conversations/[id]/messages/search`
- [ ] Results count shows (e.g., "3/12")
- [ ] Prev/Next buttons navigate through results
- [ ] `onSearchMatch` callback scrolls to matched message
- [ ] ESC closes search bar and clears results

### 9.3 Group Create

- [ ] "+" button in sidebar header opens create group dialog
- [ ] Dialog has: group name input, user search, multi-select with chips
- [ ] `POST /api/admin/chat/conversations` creates `kind="group"` conversation
- [ ] Creator is auto-added as participant and admin

### 9.4 Pinned Messages Strip

- [ ] Strip renders under chat header when `conversation.pinned.length > 0`
- [ ] Each pinned message shown as clickable "📌 Pinned #N" chip
- [ ] Clicking chip scrolls to the pinned message

### 9.5 Mute / Archive / Leave

- [ ] Mute button in header toggles muted state (bell icon switches)
- [ ] `POST /api/admin/chat/conversations/[id]/mute` toggles `mutedBy[]`
- [ ] Archive action in info drawer toggles `archivedBy[]`
- [ ] `POST /api/admin/chat/conversations/[id]/archive` toggles archive
- [ ] Leave action removes user from all arrays (participants, admins, etc.)
- [ ] `POST /api/admin/chat/conversations/[id]/leave` removes user
- [ ] Info drawer shows member list with online dots

### 9.6 Per-user Settings

- [ ] `GET /api/admin/chat/settings` returns current settings (notifyOn, soundOn, emailOn)
- [ ] `POST /api/admin/chat/settings` updates settings
- [ ] Default: `notifyOn: "all"`, `soundOn: true`, `emailOn: true`

### 9.7 Accessibility

- [ ] All buttons have `aria-label` attributes
- [ ] Messages area has `role="log"` + `aria-live="polite"`
- [ ] Focus trap works inside drawers (Sheet component handles this)
- [ ] `prefers-reduced-motion` respected: auto-scroll uses `behavior: 'auto'` instead of `'smooth'`
- [ ] Search input has `aria-label`
- [ ] Keyboard navigation: Enter to search, ESC to close

### 9.8 Performance

- [ ] **Server indexes**:
  - `VidaMessage`: `{conversationId: 1, createdAt: -1}`, `{mentions.userId: 1, createdAt: -1}`, `{refs.kind: 1, refs.refId: 1, createdAt: -1}`, `{conversationId: 1, text: 'text'}`, `{mirrorOf: 1}`
  - `VidaConversation`: `{participants: 1}`, `{refs.kind: 1, refs.refId: 1}`, `{lastMessageAt: -1}`, unique partial `{kind, refs.kind, refs.refId}`
  - `VidaNotification`: `{userEmail: 1, createdAt: -1}`, `{dedupKey: 1}` unique sparse, `{kind: 1, createdAt: -1}`
- [ ] All queries use `.lean()` and projection where possible
- [ ] Messages paginated with cursor (`_id`-based), not `skip()`
- [ ] Only active conversation subscribes to `private-conv-<id>` channel
- [ ] Other conversations use lightweight `private-user-<id>` nudge for sidebar counts

### 9.9 Smoke Tests

- [ ] `npx ts-node scripts/chat-seed.ts` creates 3 users + 5 conversations + 30 messages
- [ ] `npx ts-node scripts/chat-load.ts` fires 100 messages across 5 conversations in ~5s
- [ ] Load test reports throughput (msg/s)
- [ ] No errors in console during either script

---

## Cross-cutting Checks

- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] Dev server runs without warnings
- [ ] Dark mode renders correctly on all chat components
- [ ] Mobile viewport (≤768px) — sidebar collapses, thread fills width
- [ ] No `console.error` in production build
