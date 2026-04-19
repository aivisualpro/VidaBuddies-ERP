"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  IconSearch, 
  IconPhone, 
  IconVideo, 
  IconDotsVertical, 
  IconMoodSmile, 
  IconPaperclip, 
  IconSend, 
  IconMicrophone,
  IconCheck,
  IconChecks
} from "@tabler/icons-react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";

export default function ChatPage() {
  const { setActions } = useHeaderActions();
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const [syncData, setSyncData] = useState<any>(null);
  const [isLoadingSync, setIsLoadingSync] = useState(true);
  const [messageData, setMessageData] = useState<{messages: any[]}>({ messages: [] });
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setActions(null);
  }, [setActions]);

  // 1. Fetch Users Master List
  const fetchSyncData = async () => {
    try {
      const res = await fetch('/api/admin/chat');
      if (res.ok) {
        const data = await res.json();
        setSyncData(data);
      }
    } catch(err) {
      console.error(err);
    } finally {
      setIsLoadingSync(false);
    }
  };

  useEffect(() => {
    fetchSyncData();
    const interval = setInterval(fetchSyncData, 10000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Active Conversation Messages
  const fetchMessages = useCallback(async () => {
    if (!activeContactId) return;
    try {
      const res = await fetch(`/api/admin/chat/messages?peerId=${activeContactId}`);
      if (res.ok) {
        const data = await res.json();
        setMessageData(data);
      }
    } catch(err) {
      console.error(err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [activeContactId]);

  useEffect(() => {
    if (activeContactId) {
      setIsLoadingMessages(true);
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [activeContactId, fetchMessages]);

  // Auto-scroll to bottom of messages without shifting global layout
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [messageData.messages]);

  // Set default active contact
  useEffect(() => {
    if (syncData?.users?.length > 0 && !activeContactId) {
      setActiveContactId(syncData.users[0]._id);
    }
  }, [syncData, activeContactId]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!messageText.trim() || !activeContactId || isSending) return;
    
    setIsSending(true);
    try {
       const res = await fetch('/api/admin/chat/messages', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ peerId: activeContactId, text: messageText.trim() })
       });
       if (res.ok) {
          setMessageText("");
          await fetchMessages();
          await fetchSyncData();
       }
    } catch(err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const users = syncData?.users || [];
  const conversations = syncData?.conversations || [];
  const currentUser = syncData?.currentUser;
  
  const activeContact = users.find((u: any) => u._id === activeContactId);
  const messages = messageData?.messages || [];

  return (
    <div className="flex-1 h-full min-h-0 w-full overflow-hidden flex border border-black/5 dark:border-white/5 shadow-2xl rounded-2xl bg-white dark:bg-zinc-950">
        
        {/* SUB-SIDEBAR: Contacts List */}
        <div className="w-[320px] lg:w-[380px] flex-shrink-0 border-r border-black/5 dark:border-white/5 flex flex-col bg-slate-50/80 dark:bg-zinc-900/40 relative z-10">
          
          {/* Header */}
          <div className="p-5 pb-4 bg-transparent">
            <h2 className="text-2xl font-black tracking-tight mb-5 flex items-center text-zinc-900 dark:text-zinc-100 justify-between">
              Messages
              <span className="flex items-center justify-center bg-blue-600 shadow-md shadow-blue-600/20 text-white font-bold text-[11px] h-6 w-6 rounded-full">{users.length}</span>
            </h2>
            <div className="relative group">
              <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors w-4 h-4" />
              <Input 
                className="pl-10 bg-white dark:bg-zinc-950 border border-black/5 dark:border-white/5 rounded-xl text-sm h-11 shadow-sm focus-visible:ring-1 focus-visible:ring-blue-500 font-medium" 
                placeholder="Search teammates..." 
              />
            </div>
          </div>

          <ScrollArea className="flex-1 px-3 pb-4">
            <div className="flex flex-col gap-1.5 mt-2">
              {isLoadingSync ? (
                <div className="p-6 text-center text-sm text-zinc-400 font-medium">Syncing directory...</div>
              ) : users.map((contact: any) => {
                
                // Find matching conversation
                const convo = conversations.find((c: any) => c.participants.some((p:any) => p._id === contact._id));
                const lastMsg = convo?.lastMessage || "Click to start chatting";
                const timeStr = convo?.lastMessageAt ? new Date(convo.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' }) : "";

                const isActive = activeContactId === contact._id;

                return (
                  <div 
                    key={contact._id}
                    onClick={() => setActiveContactId(contact._id)}
                    className={`flex items-start gap-4 p-3.5 rounded-2xl cursor-pointer transition-all border border-transparent
                      ${isActive 
                         ? 'bg-white dark:bg-zinc-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border-black/5 dark:border-white/5 relative' 
                         : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }
                    `}
                  >
                    {isActive && (
                       <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full" />
                    )}

                    <div className="relative">
                      <Avatar className="h-12 w-12 border-0 shadow-sm ring-2 ring-white dark:ring-zinc-900">
                        {contact.profilePicture && contact.profilePicture.length > 0 && <AvatarImage src={contact.profilePicture} />}
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold">{contact.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {contact.isActive && (
                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-zinc-800 rounded-full flex-shrink-0" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className={`text-[15px] font-bold truncate ${isActive ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300'}`}>
                          {contact.name}
                        </h3>
                        <span className={`text-[11px] font-bold flex-shrink-0 ml-2 ${isActive ? 'text-blue-600' : 'text-zinc-400'}`}>{timeStr}</span>
                      </div>
                      <p className={`text-[13px] truncate font-medium ${isActive ? 'text-zinc-600 dark:text-zinc-400' : 'text-zinc-500 dark:text-zinc-500'}`}>
                        {lastMsg}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT AREA: Chat Interface */}
        <div className="flex-1 flex flex-col min-w-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed relative">
          
          {/* Subtle noise overlay */}
          <div className="absolute inset-0 bg-slate-50/95 dark:bg-zinc-950/95 z-0" />
          
          {activeContact ? (
            <div className="flex-col flex flex-1 w-full relative z-10">
              {/* Header */}
              <div className="h-[76px] px-8 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md border-b border-black/5 dark:border-white/5 flex items-center justify-between flex-shrink-0 shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative z-20">
                <div className="flex items-center gap-4">
                  <Avatar className="h-11 w-11 shadow-md ring-2 ring-white dark:ring-zinc-900">
                    {activeContact.profilePicture && activeContact.profilePicture.length > 0 && <AvatarImage src={activeContact.profilePicture} />}
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold">{activeContact.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-[16px] font-black tracking-tight text-zinc-900 dark:text-zinc-100">{activeContact.name}</h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`h-2 w-2 rounded-full ${activeContact.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`}></span>
                      <span className="text-[12px] text-zinc-500 font-bold tracking-wide uppercase">{activeContact.isActive ? "Online" : "Offline"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-100/50 dark:bg-zinc-900/50 p-1 rounded-full border border-black/5 dark:border-white/5">
                  <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-blue-600 rounded-full w-9 h-9">
                    <IconPhone size={20} stroke={2} />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-blue-600 rounded-full w-9 h-9">
                    <IconVideo size={20} stroke={2} />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-zinc-900 rounded-full w-9 h-9">
                    <IconDotsVertical size={20} stroke={2} />
                  </Button>
                </div>
              </div>

              {/* Chat Messages */}
              <ScrollArea className="flex-1 px-8 py-6">
                <div className="flex flex-col justify-end min-h-full">
                  
                  {isLoadingMessages && messages.length === 0 ? (
                    <div className="text-center text-sm font-bold tracking-wide uppercase text-zinc-400 my-auto pb-10">Decrypting channel...</div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center my-auto pb-10">
                       <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 border-4 border-white dark:border-zinc-900 shadow-xl">
                          <IconMoodSmile className="text-blue-600 dark:text-blue-400" size={32} />
                       </div>
                       <p className="text-sm font-black text-zinc-800 dark:text-zinc-200">Start the conversation</p>
                       <p className="text-xs text-zinc-500 mt-1">Say hi to {activeContact.name} over secure channels.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-5">
                        {messages.map((msg: any, i: number) => {
                          const isMe = msg.senderId === currentUser?.id;
                          const showAvatar = i === 0 || messages[i-1].senderId !== msg.senderId;

                          return (
                            <div key={msg._id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} gap-3 max-w-full drop-shadow-sm`}>
                              
                              {!isMe && (
                                <div className="w-8 flex-shrink-0 flex items-end mb-1">
                                  {showAvatar && (
                                      <Avatar className="h-8 w-8 shadow-md ring-2 ring-white dark:ring-zinc-900">
                                        {activeContact.profilePicture && activeContact.profilePicture.length > 0 && <AvatarImage src={activeContact.profilePicture} />}
                                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-xs">{activeContact.name.charAt(0)}</AvatarFallback>
                                      </Avatar>
                                  )}
                                </div>
                              )}

                              <div className={`flex flex-col max-w-[70%] xl:max-w-[55%] ${!isMe && !showAvatar ? 'ml-11' : ''}`}>
                                  <div 
                                    className={`px-5 py-3.5 text-[14.5px] leading-relaxed relative flex flex-col gap-1.5
                                      ${isMe 
                                        ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-3xl rounded-br-sm' 
                                        : 'bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 text-zinc-800 dark:text-zinc-200 rounded-3xl rounded-bl-sm'
                                      }
                                    `}
                                  >
                                      {!isMe && showAvatar && (
                                         <span className="text-[11px] font-black uppercase tracking-wider text-indigo-500 dark:text-indigo-400">{activeContact.name}</span>
                                      )}
                                      <span className="font-medium">{msg.text}</span>
                                      <span className={`text-[10.5px] font-bold ${isMe ? 'text-blue-200 self-end' : 'text-zinc-400 self-start'} flex items-center gap-1.5`}>
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {isMe && <IconChecks size={14} stroke={3} className="text-indigo-300" />}
                                      </span>
                                  </div>
                              </div>

                            </div>
                          )
                        })}
                        <div ref={scrollRef} />
                    </div>
                  )}

                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="px-8 py-5 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md border-t border-black/5 dark:border-white/5 z-20 shrink-0">
                <form 
                    onSubmit={handleSendMessage}
                    className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.04)] rounded-full p-1.5 pr-2 h-[60px]"
                >
                    <div className="flex gap-1 pl-2">
                      <Button type="button" variant="ghost" size="icon" className="w-10 h-10 rounded-full text-zinc-400 hover:text-blue-600 transition-colors bg-slate-50 dark:bg-zinc-800">
                        <IconMoodSmile size={22} stroke={1.5} />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="w-10 h-10 rounded-full text-zinc-400 hover:text-blue-600 transition-colors bg-slate-50 dark:bg-zinc-800">
                        <IconPaperclip size={22} stroke={1.5} />
                      </Button>
                    </div>
                    
                    <Input 
                      className="flex-1 border-none shadow-none focus-visible:ring-0 bg-transparent px-3 text-[15px] font-medium h-full rounded-none placeholder:text-zinc-400"
                      placeholder="Type a secure message..."
                      value={messageText}
                      onChange={e => setMessageText(e.target.value)}
                      disabled={isSending}
                    />

                    <div className="flex items-center">
                      {messageText.length === 0 ? (
                        <Button type="button" variant="ghost" size="icon" className="w-11 h-11 rounded-full text-zinc-400 bg-slate-50 dark:bg-zinc-800 hover:text-zinc-900">
                          <IconMicrophone size={22} stroke={1.5} />
                        </Button>
                      ) : (
                        <Button 
                            type="submit" 
                            size="icon" 
                            disabled={isSending}
                            className="w-11 h-11 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/30 transition-all scale-animation"
                        >
                          <IconSend size={20} stroke={2} className="translate-x-[1px] -translate-y-[1px]" />
                        </Button>
                      )}
                    </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 relative z-10">
               <div className="h-24 w-24 rounded-full bg-white dark:bg-zinc-900 shadow-2xl flex items-center justify-center mb-6 border border-black/5 dark:border-white/5">
                 <IconSend size={44} stroke={1.5} className="-translate-x-1 translate-y-1 text-blue-600 dark:text-blue-400" />
               </div>
               <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mb-2 tracking-tight">Active Comms Array</h3>
               <p className="text-[15px] font-medium text-zinc-500 max-w-sm">
                 Select a team member from the directory panel to initiate an encrypted conversational channel.
               </p>
            </div>
          )}
        </div>

    </div>
  );
}
