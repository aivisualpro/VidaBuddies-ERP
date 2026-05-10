/**
 * lib/pusher/events.ts
 *
 * Canonical event-name constants used by both the server (trigger)
 * and the client (bind). Import these everywhere — never hard-code
 * event strings.
 */

/* ─── Message lifecycle ─── */
export const MESSAGE_NEW = "message:new";
export const MESSAGE_EDIT = "message:edit";
export const MESSAGE_DELETE = "message:delete";
export const MESSAGE_REACT = "message:react";

/* ─── Read / delivery ─── */
export const READ = "read";

/* ─── Presence ─── */
export const TYPING = "typing";

/* ─── Mentions ─── */
export const MENTION = "mention";

/* ─── Conversation-level updates (name change, member add/remove, etc.) ─── */
export const CONV_UPDATE = "conv:update";
