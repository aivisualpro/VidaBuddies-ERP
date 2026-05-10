import { create } from "zustand";

export interface ChatConversation {
  _id: string;
  kind: "dm" | "group" | "ref";
  name?: string;
  icon?: string;
  participants: any[];
  createdBy?: string;
  admins: string[];
  refs: { kind: string; refId: string; display: string }[];
  pinned: string[];           // message IDs
  mutedBy: string[];
  archivedBy: string[];
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageBy?: string;
  unreadBy?: Record<string, number>;
}

export interface ChatMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  kind: "text" | "image" | "file" | "audio" | "system";
  text?: string;
  mentions: { userId: string; name: string }[];
  attachments: {
    url: string;
    name?: string;
    mime?: string;
    size?: number;
    width?: number;
    height?: number;
    durationMs?: number;
  }[];
  reactions: { emoji: string; userId: string }[];
  readBy: { userId: string; at: string }[];
  deliveredTo: { userId: string; at: string }[];
  replyTo?: string;
  refs: { kind: string; refId: string; display: string }[];
  deletedAt?: string;
  editedAt?: string;
  createdAt: string;
  // Resolved fields (enriched by API)
  _replyToMessage?: ChatMessage;
  _senderName?: string;
  _senderAvatar?: string;
}

interface ChatState {
  // Data
  conversations: ChatConversation[];
  activeConversationId: string | null;
  messages: ChatMessage[];
  typingUsers: { userId: string; name: string }[];
  
  // UI state
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  searchQuery: string;
  sidebarFilter: "all" | "dm" | "group" | "ref";
  detailPanelOpen: boolean;
  replyingTo: ChatMessage | null;
  
  // Current user
  currentUser: { id: string; name: string; email: string } | null;

  // Actions
  setActiveConversation: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setSidebarFilter: (f: "all" | "dm" | "group" | "ref") => void;
  setDetailPanelOpen: (open: boolean) => void;
  setReplyingTo: (msg: ChatMessage | null) => void;
  setTypingUsers: (users: { userId: string; name: string }[]) => void;
  
  // API actions
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (data: {
    text?: string;
    attachments?: any[];
    mentions?: string[];
    replyTo?: string;
    refs?: { refType: string; refId: string }[];
  }) => Promise<void>;
  createConversation: (data: {
    kind: "dm" | "group" | "ref";
    participants: string[];
    name?: string;
  }) => Promise<string | null>;
  
  // Realtime handlers
  addRealtimeMessage: (msg: ChatMessage) => void;
  updateRealtimeMessage: (msg: ChatMessage) => void;
  removeRealtimeMessage: (msgId: string) => void;
  updateConversationLastMessage: (convoId: string, text: string, senderId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  typingUsers: [],
  isLoadingConversations: false,
  isLoadingMessages: false,
  isSending: false,
  searchQuery: "",
  sidebarFilter: "all",
  detailPanelOpen: false,
  replyingTo: null,
  currentUser: null,

  setActiveConversation: (id) => {
    set({ activeConversationId: id, messages: [], replyingTo: null, typingUsers: [] });
    if (id) get().fetchMessages(id);
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setSidebarFilter: (f) => set({ sidebarFilter: f }),
  setDetailPanelOpen: (open) => set({ detailPanelOpen: open }),
  setReplyingTo: (msg) => set({ replyingTo: msg }),
  setTypingUsers: (users) => set({ typingUsers: users }),

  fetchConversations: async () => {
    set({ isLoadingConversations: true });
    try {
      const res = await fetch("/api/admin/chat");
      if (res.ok) {
        const data = await res.json();
        set({
          conversations: data.conversations || [],
          currentUser: data.currentUser || null,
        });
      }
    } catch (err) {
      console.error("[ChatStore] Failed to fetch conversations:", err);
    } finally {
      set({ isLoadingConversations: false });
    }
  },

  fetchMessages: async (conversationId: string) => {
    set({ isLoadingMessages: true });
    try {
      const res = await fetch(`/api/admin/chat/messages?conversationId=${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        set({ messages: data.messages || [] });
      }
    } catch (err) {
      console.error("[ChatStore] Failed to fetch messages:", err);
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  sendMessage: async (data) => {
    const { activeConversationId } = get();
    if (!activeConversationId) return;

    set({ isSending: true });
    try {
      const res = await fetch("/api/admin/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId,
          ...data,
        }),
      });
      if (res.ok) {
        const msg = await res.json();
        // Optimistic: add immediately (Pusher will dedupe)
        set((s) => ({
          messages: [...s.messages, msg],
          replyingTo: null,
        }));
        // Update conversation preview
        get().updateConversationLastMessage(
          activeConversationId,
          data.text || (data.attachments?.length ? "📎 Attachment" : ""),
          get().currentUser?.id || ""
        );
      }
    } catch (err) {
      console.error("[ChatStore] Failed to send message:", err);
    } finally {
      set({ isSending: false });
    }
  },

  createConversation: async (data) => {
    try {
      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const convo = await res.json();
        await get().fetchConversations();
        set({ activeConversationId: convo._id });
        return convo._id;
      }
    } catch (err) {
      console.error("[ChatStore] Failed to create conversation:", err);
    }
    return null;
  },

  // Realtime handlers — called by Pusher events
  addRealtimeMessage: (msg) => {
    set((s) => {
      // Dedupe: don't add if already present (optimistic send)
      if (s.messages.some((m) => m._id === msg._id)) return s;
      // Only add if it belongs to the active conversation
      if (msg.conversationId !== s.activeConversationId) return s;
      return { messages: [...s.messages, msg] };
    });
  },

  updateRealtimeMessage: (msg) => {
    set((s) => ({
      messages: s.messages.map((m) => (m._id === msg._id ? { ...m, ...msg } : m)),
    }));
  },

  removeRealtimeMessage: (msgId) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m._id === msgId ? { ...m, deletedAt: new Date().toISOString(), text: "" } : m
      ),
    }));
  },

  updateConversationLastMessage: (convoId, text, senderId) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c._id === convoId
          ? { ...c, lastMessage: text, lastMessageBy: senderId, lastMessageAt: new Date().toISOString() }
          : c
      ),
    }));
  },
}));
