"use client";

import { MessageCircle } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-5 border">
        <MessageCircle className="h-9 w-9 text-primary" />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-1">
        VidaBuddies Messenger
      </h3>
      <p className="text-sm text-muted-foreground max-w-[260px]">
        Select a conversation from the sidebar to start messaging.
      </p>
    </div>
  );
}
