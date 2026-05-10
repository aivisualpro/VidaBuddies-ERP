"use client";

import { useState, useEffect, useCallback } from "react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { ChatTreeSidebar } from "@/components/chat/chat-tree-sidebar";
import { ChatThread } from "@/components/chat/chat-thread";
import { EmptyState } from "@/components/chat/empty-state";
import { NewChatDialog } from "@/components/chat/new-chat-dialog";

export default function ChatPage() {
  const { setActions } = useHeaderActions();
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  useEffect(() => {
    setActions(null);
  }, [setActions]);

  // Fetch current user + user directory
  useEffect(() => {
    fetch("/api/admin/chat")
      .then((r) => r.json())
      .then((data) => {
        setCurrentUser(data.currentUser || null);
        setAllUsers(data.users || []);
      })
      .catch(() => {});
  }, []);

  // Fetch conversation metadata when active changes
  useEffect(() => {
    if (!activeConvId) {
      setConversation(null);
      return;
    }
    fetch(`/api/admin/chat/conversations/${activeConvId}`)
      .then((r) => r.json())
      .then(setConversation)
      .catch(() => setConversation(null));
  }, [activeConvId]);

  const handleSelect = useCallback(
    (conv: any, mode?: "mentions") => {
      if (mode === "mentions") {
        setActiveConvId(null);
        return;
      }
      if (conv?._id) {
        setActiveConvId(conv._id);
      }
    },
    []
  );

  return (
    <div className="flex-1 h-full min-h-0 w-full overflow-hidden flex bg-background">
      {/* Tree Sidebar */}
      <ChatTreeSidebar
        activeConvId={activeConvId}
        onSelect={handleSelect}
        onNewChat={() => setNewChatOpen(true)}
      />

      {/* Chat Thread (right pane) */}
      {activeConvId && conversation && currentUser ? (
        <ChatThread
          conversationId={activeConvId}
          conversation={conversation}
          currentUserId={currentUser.id}
          users={allUsers}
        />
      ) : (
        <EmptyState />
      )}

      {/* New Chat Dialog */}
      <NewChatDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        users={allUsers}
      />
    </div>
  );
}
