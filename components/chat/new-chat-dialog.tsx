"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IconSearch, IconUsers, IconMessage, IconCheck, IconX } from "@tabler/icons-react";
import { useChatStore } from "@/store/useChatStore";

interface NewChatDialogProps { open: boolean; onClose: () => void; users: any[]; }

export function NewChatDialog({ open, onClose, users }: NewChatDialogProps) {
  const { createConversation, currentUser } = useChatStore();
  const [mode, setMode] = useState<"select"|"group">("select");
  const [search, setSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = users.filter((u: any) => u._id !== currentUser?.id).filter((u: any) => !search || u.name?.toLowerCase().includes(search.toLowerCase()));
  const toggleUser = (id: string) => setSelectedUsers(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleStartDM = async (userId: string) => { setCreating(true); await createConversation({ kind: "dm", participants: [userId] }); setCreating(false); handleClose(); };
  const handleCreateGroup = async () => { if (selectedUsers.length < 2 || !groupName.trim()) return; setCreating(true); await createConversation({ kind: "group", participants: selectedUsers, name: groupName.trim() }); setCreating(false); handleClose(); };
  const handleClose = () => { setMode("select"); setSearch(""); setSelectedUsers([]); setGroupName(""); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-lg font-black flex items-center gap-2">
            {mode === "group" ? <><IconUsers size={20} className="text-emerald-500" /> New Group</> : <><IconMessage size={20} className="text-blue-500" /> New Conversation</>}
          </DialogTitle>
          <DialogDescription className="sr-only">Create a new conversation</DialogDescription>
        </DialogHeader>
        <div className="px-6 py-3 border-b space-y-3">
          <div className="flex gap-2">
            <button onClick={() => { setMode("select"); setSelectedUsers([]); }} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border ${mode === "select" ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-zinc-900 text-zinc-500 border-black/5 dark:border-white/5"}`}><IconMessage size={14} /> Direct Message</button>
            <button onClick={() => setMode("group")} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border ${mode === "group" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white dark:bg-zinc-900 text-zinc-500 border-black/5 dark:border-white/5"}`}><IconUsers size={14} /> Group Chat</button>
          </div>
          {mode === "group" && <Input className="h-10 rounded-xl text-sm font-medium" placeholder="Group name..." value={groupName} onChange={e => setGroupName(e.target.value)} />}
          <div className="relative"><IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" /><Input className="pl-9 h-10 rounded-xl text-sm" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          {mode === "group" && selectedUsers.length > 0 && <div className="flex flex-wrap gap-1.5">{selectedUsers.map(id => { const u = users.find((x:any) => x._id === id); return <span key={id} className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">{u?.name}<button onClick={() => toggleUser(id)}><IconX size={12} /></button></span>; })}</div>}
        </div>
        <ScrollArea className="max-h-[320px]">
          <div className="p-3">{filtered.map((u: any) => {
            const sel = selectedUsers.includes(u._id);
            return <button key={u._id} onClick={() => mode === "select" ? handleStartDM(u._id) : toggleUser(u._id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${sel ? "bg-emerald-50 dark:bg-emerald-900/10" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}>
              <Avatar className="h-10 w-10 shadow-sm">{u.profilePicture && <AvatarImage src={u.profilePicture} />}<AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-xs">{u.name?.charAt(0)}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0 text-left"><p className="text-sm font-bold truncate">{u.name}</p><p className="text-[11px] text-zinc-400 truncate">{u.AppRole || u.email}</p></div>
              {mode === "group" && sel && <div className="h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center"><IconCheck size={14} stroke={3} /></div>}
            </button>;
          })}</div>
        </ScrollArea>
        {mode === "group" && <div className="px-6 py-4 border-t"><Button onClick={handleCreateGroup} disabled={selectedUsers.length < 2 || !groupName.trim() || creating} className="w-full h-10 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-lg">{creating ? "Creating..." : `Create Group (${selectedUsers.length})`}</Button></div>}
      </DialogContent>
    </Dialog>
  );
}
