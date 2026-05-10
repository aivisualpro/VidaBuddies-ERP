/**
 * Shared notification types used across server APIs, Pusher events,
 * and client-side stores/components.
 */

export type NotificationKind = "reminder" | "shipment" | "system" | "chat" | "mention";

export interface BellNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string; // ISO 8601
  meta?: Record<string, unknown>;
}
