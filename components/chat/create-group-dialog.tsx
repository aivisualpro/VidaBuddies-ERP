"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
  users: { _id: string; name: string; profilePicture?: string }[];
  currentUserId: string;
  onCreated: (conversationId: string) => void;
}

export function CreateGroupDialog({
  open,
  onClose,
  users,
  currentUserId,
  onCreated,
}: CreateGroupDialogProps) {
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const toggleUser = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredUsers = users.filter(
    (u) =>
      u._id !== currentUserId &&
      u.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Group name is required");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Add at least one member");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "group",
          name: name.trim(),
          participants: [...selectedIds, currentUserId],
        }),
      });
      if (!res.ok) throw new Error("Failed to create group");
      const data = await res.json();
      toast.success("Group created");
      onCreated(data._id);
      onClose();
      setName("");
      setSelectedIds(new Set());
      setSearch("");
    } catch {
      toast.error("Failed to create group");
    } finally {
      setCreating(false);
    }
  }, [name, selectedIds, currentUserId, onCreated, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-primary" />
            Create group
          </DialogTitle>
          <DialogDescription className="text-xs">
            Name your group and add members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Group name */}
          <div className="space-y-1.5">
            <Label htmlFor="group-name" className="text-xs font-semibold">
              Group name
            </Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Shipping Team"
              className="h-9 text-sm"
              aria-label="Group name"
            />
          </div>

          {/* Selected chips */}
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap gap-1">
              {[...selectedIds].map((id) => {
                const u = users.find((u) => u._id === id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                  >
                    {u?.name || "User"}
                    <button
                      onClick={() => toggleUser(id)}
                      className="hover:text-destructive"
                      aria-label={`Remove ${u?.name || "user"}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* User search + list */}
          <div>
            <Label className="text-xs font-semibold">Members</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users…"
              className="h-8 text-xs mt-1"
              aria-label="Search users to add"
            />
            <div className="mt-2 max-h-48 overflow-y-auto space-y-0.5 scrollbar-thin">
              {filteredUsers.map((u) => {
                const isSelected = selectedIds.has(u._id);
                return (
                  <button
                    key={u._id}
                    onClick={() => toggleUser(u._id)}
                    className={`w-full flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg transition-colors ${
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    }`}
                    aria-label={`${isSelected ? "Remove" : "Add"} ${u.name}`}
                    aria-pressed={isSelected}
                  >
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 text-left truncate font-medium">
                      {u.name}
                    </span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
              {filteredUsers.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-4">
                  No users found
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating}
            className="text-xs gap-1.5"
          >
            {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
