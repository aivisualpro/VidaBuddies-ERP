# WhatsApp-grade Chat for vidaBuddiesERP — AI Agent Prompts (step by step)

Feed each prompt to your AI coding agent **one step at a time**. Run the app and verify after every step before pasting the next.

What I already verified is in your repo (the agent should respect this):

- `app/(protected)/admin/chat/page.tsx` — current naive 1-on-1 chat that polls `/api/admin/chat` and `/api/admin/chat/messages` every 3–10s.
- `lib/models/VidaConversation.ts` — participants[], lastMessage, lastSender, lastMessageAt.
- `lib/models/VidaMessage.ts` — conversationId, senderId, text, isRead, timestamps.
- `components/admin/shipment-group-sidebar.tsx` — the tree pattern (VBNumber → VBSerialNumber) we'll mirror with a 3-level tree (adds VBShipmentNumber).
- Card pattern on every list page: `components/admin/timeline-modal.tsx` + `components/attachments-modal.tsx` opened by Clock + Paperclip icon buttons in the row (see `app/(protected)/admin/purchase-orders/list/page.tsx` lines ~452–498). We'll add a Chat icon next to those.
- Auth: `getSession()` returns `{ id, name, email, role }` from cookie `vb_session`.
- Models that map IDs → display: `VidaPO.vbpoNo/VBNumber`, `VBcustomerPO.VBSerialNumber/poNo`, `VBshipping.VBShipmentNumber/svbid` (see `app/api/admin/timeline/route.ts` for the lookup pattern — reuse it).
- Global store: `store/useUserDataStore.ts` already has `purchaseOrders`, `users`, `customers`, etc.
- Realtime: **Pusher is NOT installed**. We will install it (same as in the bell-icon plan).
- Cloudinary is already installed for uploads.

---

## STEP 0 — Deep Analysis (no code yet)

```
You are working in vidaBuddiesERP (Next.js 16 + React 19 + TS + Mongoose + Tailwind v4 + shadcn/ui).
Before any code, deeply analyze the existing chat system and produce a written report.

DO THIS:
1. Read and summarize:
   - app/(protected)/admin/chat/page.tsx
   - app/api/admin/chat/route.ts
   - app/api/admin/chat/messages/route.ts
   - lib/models/VidaConversation.ts
   - lib/models/VidaMessage.ts
   - components/admin/shipment-group-sidebar.tsx (pattern for our tree)
   - components/admin/timeline-modal.tsx and components/attachments-modal.tsx (modal patterns)
   - app/(protected)/admin/purchase-orders/list/page.tsx around the Timeline & Attachments columns
   - app/(protected)/admin/customer-pos/list/page.tsx
   - app/(protected)/admin/shipments/list/page.tsx
   - app/api/admin/timeline/route.ts (the VBNumber/VBSerial/VBShipment ID→display resolver)
   - lib/auth.ts, lib/auth-utils.ts
   - lib/models/VidaUser.ts (AppRole field, "Super Admin")
   - store/useUserDataStore.ts

2. Output a 1-page report with:
   a) Limitations of the current chat (DM-only, polling, no tags, no mentions, no realtime, no read receipts, no attachments, no groups, no presence, no reactions).
   b) The exact ID resolution pattern used in app/api/admin/timeline/route.ts and confirm we will reuse it.
   c) A list of every file you will create or modify in steps 1–9 below, with one-line purpose each.
   d) A data-model diff for VidaConversation and VidaMessage with the new fields we'll add (kind, refs[], mentions[], attachments[], reactions[], readBy[], replyTo, deletedAt, editedAt, pinnedAt).
   e) Confirm Pusher is not installed and that we will install it.

Do NOT write any code yet.
```

---

## STEP 1 — Data Model Upgrade (server only)

```
Implement step 1 only.

GOAL: extend chat data model so it can hold groups, # refs (VBNumber/VBSerialNumber/VBShipmentNumber), @ mentions, attachments, reactions, read receipts, replies, edits, deletes — without breaking existing 1-on-1 chats.

1. Update lib/models/VidaConversation.ts (add fields, keep current ones):
   - kind: "dm" | "group" | "ref"   default "dm"
       * "dm" = 2 participants
       * "group" = N participants, has name
       * "ref" = auto-conversation tied to a record (VBNumber/VBSerial/VBShipment)
   - name?: string                    (group/ref only)
   - icon?: string                    (group avatar URL)
   - createdBy: ObjectId              (ref VidaUser)
   - admins: ObjectId[]               (ref VidaUser)
   - refs: [{
        kind: "VBNumber" | "VBSerialNumber" | "VBShipmentNumber",
        refId: string,                // raw stored id (matches VidaTimeline schema)
        display: string               // resolved at write-time (e.g. vbpoNo)
     }]                                // a conversation can be linked to many records
   - pinned: ObjectId[]               (refs VidaMessage)
   - mutedBy: ObjectId[]              (users who muted)
   - archivedBy: ObjectId[]
   - lastMessageBy?: ObjectId
   - unreadBy: Map<ObjectId, number>  (userId → count, used to show badge fast)
   - typing: Map<ObjectId, Date>      (transient; cleaned up by ttl cron or on socket events)
   Indexes:
   - { participants: 1 }
   - { "refs.kind": 1, "refs.refId": 1 }
   - { lastMessageAt: -1 }
   For "ref" kind, enforce uniqueness: at most one conversation per (kind+refId) pair.

2. Update lib/models/VidaMessage.ts (add fields):
   - kind: "text" | "image" | "file" | "audio" | "system"   default "text"
   - text: string (now optional if kind != "text")
   - mentions: [{ userId: ObjectId, name: string }]    // @ mentions
   - refs: [{ kind, refId, display }]                  // # tags resolved at send-time
   - attachments: [{ url, name, mime, size, width?, height?, durationMs? }]
   - replyTo?: ObjectId (ref VidaMessage)              // quoted reply
   - reactions: [{ emoji: string, userId: ObjectId }]
   - readBy: [{ userId: ObjectId, at: Date }]           // per-user read receipts
   - deliveredTo: [{ userId: ObjectId, at: Date }]
   - editedAt?: Date
   - deletedAt?: Date                                   // soft-delete
   Indexes:
   - { conversationId: 1, createdAt: -1 }
   - { "mentions.userId": 1, createdAt: -1 }
   - { "refs.kind": 1, "refs.refId": 1, createdAt: -1 }

3. Create lib/chat/resolveRefs.ts:
   - export `resolveRefDisplay(kind, refId): Promise<string>`
   - export `resolveRefsBatch(refs: {kind,refId}[]): Promise<{kind,refId,display}[]>`
   - Reuse the same approach as app/api/admin/timeline/route.ts:
       VidaPO._id        → vbpoNo || VBNumber
       VBcustomerPO._id  → VBSerialNumber || poNo
       VBshipping._id    → VBShipmentNumber || svbid
   - Cache lookups in-memory per request via a tiny LRU (Map) so a single chat panel render doesn't hit Mongo 200x.

4. Create a tiny migration: scripts/chat-migrate.ts that:
   - sets kind="dm" on all existing VidaConversation rows missing kind
   - back-fills createdBy = participants[0]
   - leaves messages alone

OUTPUT: full diff of model files + resolver + migration. No UI changes yet.
```

---

## STEP 2 — Realtime: Pusher server + client + presence channels

```
Implement step 2 only.

GOAL: install Pusher and add the wiring we'll use everywhere.

1. npm i pusher pusher-js

2. .env.local keys (print exactly): PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER, NEXT_PUBLIC_PUSHER_KEY, NEXT_PUBLIC_PUSHER_CLUSTER.

3. lib/pusher/server.ts — singleton `pusherServer`. Helpers:
   - triggerToConversation(conversationId, event, payload)   → channel `private-conv-<id>`
   - triggerToUser(userId, event, payload)                   → channel `private-user-<id>`
   - triggerPresence(conversationId, event, payload)         → channel `presence-conv-<id>`

4. lib/pusher/client.ts — `getPusherClient()` SSR-safe singleton.

5. app/api/pusher/auth/route.ts — Pusher auth endpoint:
   - reads vb_session via getSession()
   - allows subscribe to:
       private-user-<self.id>
       private-conv-<id>     iff user is a participant of that conversation
       presence-conv-<id>    same check, returns user_info { id, name, email, avatar }
   - rejects everything else with 403.

6. lib/pusher/events.ts — string constants:
   MESSAGE_NEW, MESSAGE_EDIT, MESSAGE_DELETE, MESSAGE_REACT, READ, TYPING, MENTION, CONV_UPDATE.

OUTPUT: file diffs, npm command, env keys to set. No UI yet.
```

---

## STEP 3 — Sub-sidebar grouped exactly like the shipments list

```
Implement step 3 only.

GOAL: in /admin/chat replace the current contact list with a left "sub-sidebar" that mirrors the look + UX of components/admin/shipment-group-sidebar.tsx but with THREE levels: VBNumber → VBSerialNumber → VBShipmentNumber, plus a "Direct messages" section underneath, plus a "Mentions" section pinned at the top.

1. Create components/chat/chat-tree-sidebar.tsx ("use client"):
   - props: { activeConvId: string | null, onSelect: (conv) => void }
   - Fetches GET /api/admin/chat/conversations (we'll build it next) which returns:
        groups: { byVBNumber: { [vbId]: { display, conversations: ConvSummary[],
                  bySerial: { [serId]: { display, conversations: ConvSummary[],
                  byShipment: { [shipId]: { display, conversations: ConvSummary[] } } } } } }
        dms: ConvSummary[]
        mentionsCount: number
   - ConvSummary = { _id, name, kind, lastMessage, lastMessageAt, unread, refs[] }
   - Tree visual rules (copy spirit of shipment-group-sidebar.tsx):
        sticky search input at top
        section "📌 Mentions (N)" — opens a virtual conversation showing all messages where current user is @mentioned
        section "Direct Messages"
        section "Shipments / Records" — three-level tree:
            VBNumber row (chevron, count of total conversations under it)
            └─ VBSerialNumber row (smaller chevron)
               └─ VBShipmentNumber row (no chevron)
        Each leaf shows: avatar (or icon), name (resolved display), tiny last-message preview, time-ago, unread badge.
        Active row = primary/10 bg + left border 2px primary.
   - Auto-expand the tree to the active conversation.
   - Width 280px, full height, border-r, bg-muted/20, scrollbar-thin.

2. Create app/api/admin/chat/conversations/route.ts (GET):
   - getSession; 401 if missing
   - returns user's conversations split as above
   - resolves all refs.display via lib/chat/resolveRefs.ts
   - computes per-conversation unread = unreadBy.get(userId) || 0
   - sort conversations by lastMessageAt desc within each leaf

3. Replace the left column of app/(protected)/admin/chat/page.tsx with <ChatTreeSidebar />. Keep existing right side for now (we redo it next step).

ACCEPTANCE: I see VBNumber → Serial → Shipment tree, exactly the same hover/active/expand feel as the shipments list sidebar, plus Direct Messages and Mentions. Clicking a leaf sets activeConvId.
```

---

## STEP 4 — WhatsApp-grade chat thread (right pane)

```
Implement step 4 only.

GOAL: rebuild the right pane to feel like WhatsApp Web.

Components to create:
- components/chat/chat-thread.tsx
- components/chat/chat-header.tsx
- components/chat/chat-composer.tsx
- components/chat/message-bubble.tsx
- components/chat/message-actions.tsx (hover toolbar: reply, react, copy, edit, delete, pin)
- components/chat/typing-indicator.tsx
- components/chat/day-separator.tsx
- components/chat/avatar-stack.tsx
- components/chat/empty-state.tsx

Visual + UX rules:
1. Header (sticky):
   - left: avatar + name + presence dot ("online" / "last seen Xm ago")
   - subline: for "ref" conversations show chips like  #VB-1023  /  #SR-441  /  #SHP-77
   - right: search-in-conversation icon, pin icon, mute icon, info icon (opens drawer)

2. Messages area:
   - vertical, padded, alternating left/right bubbles
   - my bubbles: bg-primary text-primary-foreground rounded-2xl rounded-br-sm
   - others:    bg-muted/60 rounded-2xl rounded-bl-sm
   - max-w-[68%] on desktop, max-w-[85%] on mobile
   - sender avatar shown only on the FIRST message in a streak (consecutive sender + within 5 min)
   - sender name shown only in groups, only on first of streak, in the bubble color
   - timestamp: tiny, muted, bottom-right inside bubble
   - status ticks (only for my messages) on bottom-right:
       sent (single grey ✓), delivered (double grey ✓✓), read (double blue ✓✓)
   - day separators ("Today", "Yesterday", "Mar 12, 2026")
   - reply preview rendered as a thin left-border quote inside the bubble
   - reactions row under the bubble: aggregated counts, click to toggle yours
   - hover toolbar appears on each bubble (top-right): 😊 react, ↩ reply, ✏ edit (mine), 🗑 delete (mine), 📌 pin (admins)
   - virtualization: use a simple windowing approach (limit to 200 visible, load older on scroll-up)

3. Composer (sticky bottom):
   - components/ui/textarea autosize, placeholder "Type a message…  Use # to tag a record, @ to mention someone"
   - left: emoji picker button (lazy-load a library of your choice or a simple grid), attachment button (paperclip → image, file)
   - right: send button (disabled when empty), shift+enter = new line, enter = send
   - Voice note button (mic) — recorded via MediaRecorder API, uploaded as audio/webm to Cloudinary; show waveform placeholder
   - Reply preview banner above the composer when replying

4. Pusher subscriptions on mount (channel `private-conv-<id>`):
   - MESSAGE_NEW   → append message, scroll to bottom if user is near bottom
   - MESSAGE_EDIT  → patch in place
   - MESSAGE_DELETE→ replace text with italic "This message was deleted"
   - MESSAGE_REACT → update reactions array
   - READ          → update tick status on my messages
   - TYPING        → show "<name> is typing…" (debounced 3s)

5. Hooks:
   - useChat(conversationId): manages messages list, optimistic send, mark-as-read on view
   - usePresence(conversationId): subscribes to `presence-conv-<id>` and exposes online users

6. APIs (create now, used by the UI):
   - POST   /api/admin/chat/conversations              create dm/group/ref
   - GET    /api/admin/chat/conversations/[id]         metadata
   - GET    /api/admin/chat/conversations/[id]/messages?cursor=...  paginated, newest-first then reversed in UI
   - POST   /api/admin/chat/conversations/[id]/messages  send (parses #/@ from text — see step 5)
   - PATCH  /api/admin/chat/messages/[id]              edit text
   - DELETE /api/admin/chat/messages/[id]              soft-delete (set deletedAt)
   - POST   /api/admin/chat/messages/[id]/react        { emoji }
   - POST   /api/admin/chat/conversations/[id]/read    marks last N as read
   - POST   /api/admin/chat/conversations/[id]/typing  fires presence event
   Each mutation triggers the corresponding Pusher event.

ACCEPTANCE: open two browser windows logged in as different users; messages appear instantly without any refresh, ticks transition sent→delivered→read, reactions/edits/deletes/replies all work, typing indicator shows.
```

---

## STEP 5 — # and @ tag system (the killer feature)

```
Implement step 5 only.

GOAL: while typing in the composer, "#" pops a record picker (VBNumber, VBSerialNumber, VBShipmentNumber) and "@" pops an employee picker. Selected items render as styled chips inside the message and are stored as structured refs/mentions.

1. Create components/chat/mention-popover.tsx ("use client"):
   - Triggered by typing # or @ after a whitespace or at the start of input.
   - Floats above the caret with a max-h-72 overflow-y-auto list.
   - For #: Tabs at the top → "VB#" | "Serial#" | "Shipment#" | "All"
       data: useUserDataStore (purchaseOrders, ...) for VB#, fetch /api/admin/vb-customer-po?fields=_id,VBSerialNumber,poNo for Serial#,
       fetch /api/admin/vb-shipping?fields=_id,VBShipmentNumber,svbid for Shipment#.
       cache the lookups in zustand to avoid refetch.
       fuzzy filter the typed query against display names.
       each row: icon (Package / FileCheck / Ship), display name, faint sub (raw id).
   - For @: list users from store (excluding self), filtered by typed query,
       each row: avatar, name, designation.

2. Composer integration:
   - Treat the textarea contents as plain text, but maintain a parallel "tokens" list that records inserted chips with their positions, so on submit we send:
        text: "Please review #VB-1023 with @Alice tomorrow"
        refs: [{ kind: "VBNumber", refId: "...", display: "VB-1023" }]
        mentions: [{ userId, name: "Alice" }]
     The server re-validates and persists this on the message.
   - Render chips in the textarea via a contenteditable div (use lexical-style controlled rendering, or a thin custom solution: invisible spans tracked by character offset).
   - Style chips:
        # chip: rounded-md px-1.5 py-0.5 text-[12px] font-semibold border
                VBNumber → indigo, Serial# → emerald, Shipment# → violet
        @ chip: rounded-md px-1.5 py-0.5 text-[12px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30
   - Backspace at chip boundary deletes the whole chip.
   - Pasting plain text containing "#abc" or "@xyz" does NOT auto-resolve; only the popover does.

3. Render in message-bubble.tsx:
   - When rendering text, walk text + refs + mentions, splice the chips back into the right positions, and wrap them with:
        # chip → <Link href="/admin/...whichever list...?focus=<refId>"> opens the matching list page filtered to that record
        @ chip → small popover on hover with the user's profile card
   - When my message contains a #ref, also link the ref id back to its detail page if available (PO detail / CPO detail / Shipment detail).

4. Auto-thread for refs:
   - On send, if the message contains any refs[] AND the conversation is a DM (kind="dm"), DO NOT change the dm. Just store the refs on the message — the dm stays a dm.
   - Separately, ensure for each ref a dedicated "ref" conversation exists (one per kind+refId). Append a SHADOW copy of this message into that ref-conversation so the record's chat thread accumulates everything that mentioned it. (Server-side fan-out only; the message id can be reused with a `mirrorOf` field, or a fresh insert with `mirrorOf: original._id`.)

5. Mentions inbox:
   - The "Mentions" virtual conversation in step 3 sidebar = a server query:
        VidaMessage.find({ "mentions.userId": me, deletedAt: null }).sort({ createdAt: -1 })
   - Pusher: triggerToUser(mentionedUserId, "MENTION", payload) on send.

ACCEPTANCE: typing "#" inside the composer instantly opens the picker, selecting an item inserts a chip; the message renders chips beautifully on both sides; mentioned users get a real-time toast + the bell-icon mention counter increments (uses our existing notification bell pattern).
```

---

## STEP 6 — Attachments (image / file / voice) + lightbox

```
Implement step 6 only.

GOAL: rich media in chat, uploaded to Cloudinary (already in package.json).

1. Reuse cloudinary util — create lib/cloudinary/upload.ts if missing.
2. POST /api/admin/chat/upload  (multipart) → returns { url, name, mime, size, width?, height?, durationMs? }.
3. Composer:
   - Paperclip menu: Image, File, Camera (mobile only via input capture).
   - Drag-and-drop onto thread area uploads.
   - Show a preview row above the composer for queued attachments before send (thumbnails + remove "x").
   - Voice note: hold mic to record; on release upload + auto-send.
4. Bubbles render attachments above text:
   - Image: rounded-xl, max 360x360, object-cover, click → lightbox (use components/ui/dialog or new component) with prev/next arrows, ESC closes.
   - File: pill with icon by mime type, name, size; click to open in a new tab.
   - Audio: <audio> with custom thin player + duration label.
5. Show paperclip+count summary in conversation header; opening it shows a media grid (simple 4-column).

ACCEPTANCE: dragging an image into the thread uploads, optimistic placeholder shows, then real URL replaces it. Voice notes play.
```

---

## STEP 7 — Embed chat icon in PO / CPO / Shipment cards

```
Implement step 7 only.

GOAL: a chat icon next to the existing Timeline + Attachments icons on each row, with an unread count badge. Clicking it opens a slide-over with the chat thread for that exact record (kind="ref").

1. Create components/chat/record-chat-drawer.tsx ("use client"):
   - props: { open, onClose, refKind: "VBNumber"|"VBSerialNumber"|"VBShipmentNumber", refId: string, display: string }
   - On open, GET /api/admin/chat/conversations/by-ref?kind=...&refId=... → returns the auto "ref" conversation (creates one if missing)
   - Renders <ChatThread conversationId={conv._id} /> from step 4 inside a right-side <Sheet> 480–540px wide.
   - Header shows the resolved display name and a small "Open in chat" link → /admin/chat?conv=<id>.

2. Edit app/(protected)/admin/purchase-orders/list/page.tsx:
   - Import RecordChatDrawer.
   - In the columns array, add a NEW column "id: chat" right after "timeline":
       cell: a button that mirrors the timeline button styling (rounded pill, MessageCircle icon),
       count = unread for that VBNumber from a /api/admin/chat/unread-by-refs endpoint (built below),
       onClick: setChatOpen({ refKind: "VBNumber", refId: row.original._id, display: row.original.vbpoNo })
   - Mount the drawer at the bottom of the page (controlled by chatOpen state).

3. Edit app/(protected)/admin/customer-pos/list/page.tsx the same way:
   - column "chat" using refKind="VBSerialNumber", refId=row._id, display=row.VBSerialNumber

4. Edit app/(protected)/admin/shipments/list/page.tsx the same way:
   - column "chat" using refKind="VBShipmentNumber", refId=row._id, display=row.VBShipmentNumber

5. Server: GET /api/admin/chat/unread-by-refs?kind=VBNumber  → returns { [refId]: unreadCount } for the current user. Used to feed the row badges. Cache on the client for 30s; bust on Pusher MESSAGE_NEW for a matching ref.

ACCEPTANCE: I open /admin/purchase-orders/list, click the chat icon on any row, the drawer slides in showing exactly the chat for that VB number. Other users sending messages there make my badge count tick up live.
```

---

## STEP 8 — Notifications (in-app + email) for chat

```
Implement step 8 only.

GOAL: when someone DMs me, mentions me, or messages a record I'm subscribed to, I get realtime + bell-icon + (configurable) email.

1. Reuse the bell from your previous Notifications plan. Add a "Chat" sub-tab inside the bell panel OR fold chat events into the existing "Notifications" tab — your call, but the kind="chat" must be tagged on rows.

2. On each new message server-side:
   - For every participant (excluding sender):
       upsert a VidaNotification with dedupKey = `chat:<convId>:<messageId>:<userId>`
       triggerToUser(userId, "notification:new", payload)
   - For every @mentioned userId not already a participant:
       same as above but kind="mention"

3. Email rules (lib/email/send.ts already exists from the bell plan):
   - DM new message: email if recipient is offline (no presence on `presence-conv-<id>`) AND no email sent in the last 5 minutes for that conversation.
   - @mention: email always (rate-limited to 1 per minute per recipient).
   - Use a beautiful template: lib/email/templates/chat.ts modeled after the reminder template — header brand bar, hero "<Sender> mentioned you in <conversation>", quoted message snippet (max 160 chars), refs as colored chips in the email, CTA "Open chat" → /admin/chat?conv=<id>.

4. Push (PWA): if the bell plan's web-push is in place, also fire a push for mentions.

ACCEPTANCE: DM me while I have the tab closed → I get a bell + email. @mention me → bell + email + push.
```

---

## STEP 9 — Polish: presence, search, groups, pinned, settings, accessibility

```
Implement step 9 only.

GOAL: ship-quality finishing touches.

1. Presence dots: green when in any presence-conv-* OR connected to a global `presence-online` channel; "last seen Xm ago" computed from VidaUser.lastSeen (add field, update on Pusher subscription_succeeded).

2. In-conversation search: small slide-down search bar in the chat header that highlights matches inline and offers prev/next navigation.

3. Group create: button in sidebar header → modal: name, icon, participants (multi-select from users store), optional refs[]. Server: kind="group". Use components/ui/dialog.

4. Pinned messages strip: rendered just under the chat header when conversation.pinned.length > 0; each pinned message is a tiny clickable chip that scrolls to the message.

5. Mute / Archive / Leave from header info drawer; persist on conversation.mutedBy / archivedBy.

6. Per-user settings (POST /api/admin/chat/settings): notify-on=all|mentions|none, sound-on, email-on. Read in the bell panel + composer.

7. Accessibility:
   - aria-labels on every button
   - role="log" + aria-live="polite" on messages list
   - focus-trap inside drawers
   - prefers-reduced-motion respected for any animation

8. Performance:
   - Server: ensure compound indexes are present; use lean() and projection; paginate messages with cursor (last _id) not skip.
   - Client: only the active conversation subscribes to its private channel; others use the lightweight `private-user-<id>` channel that just nudges sidebar counts.

9. Smoke test script:
   - scripts/chat-seed.ts that creates 3 dummy users, 5 ref conversations, 30 messages with mentions and refs.
   - scripts/chat-load.ts that fires 100 messages over 5 seconds across 5 conversations to validate Pusher fan-out.

10. Output a CHAT_CHECKLIST.md at repo root summarizing every acceptance criterion from steps 1–9 with check boxes for manual QA.
```

---

## Vibe-coding tips

- One step per commit on a `feat/chat-whatsapp` branch. After each step paste: *"Run the app, write a 5-line summary of what changed and how to test it."*
- If the agent goes off-script, paste: *"Stop. Revert your last edits. Re-read STEP X and only do what it specifies."*
- Step 5 (the # / @ system) is the riskiest — if the contenteditable approach gets messy, tell the agent to switch to a token-array model where the textarea is plain-text and chips are rendered only on display, with `​` zero-width markers in the input to anchor offsets. That's simpler and ships faster.
- Pusher free tier handles this comfortably for small teams. If you hit the connection cap, swap to Server-Sent Events (`/api/admin/chat/stream`) — same payloads, same UI store, drop-in transport.
