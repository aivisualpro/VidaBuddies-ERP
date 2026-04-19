"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
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
  IconMicrophone 
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

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
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
    <div className="h-[calc(100vh-130px)] rounded-[14px]">
      <Card className="h-full w-full overflow-hidden flex border shadow-sm rounded-[14px] bg-background">
        
        {/* LEFT SIDEBAR: Contacts List */}
        <div className="w-[340px] flex-shrink-0 border-r flex flex-col bg-slate-50/50 dark:bg-slate-950/50">
          <div className="p-4 border-b bg-white dark:bg-zinc-950 border-r-0">
            <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
              Chats <span className="flex items-center justify-center bg-blue-100 text-blue-700 text-[10px] h-5 w-5 rounded-full px-1">{users.length}</span>
            </h2>
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                className="pl-9 bg-zinc-100/50 dark:bg-zinc-900 border-none rounded-xl text-sm h-10 shadow-none focus-visible:ring-1" 
                placeholder="Search teammates..." 
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="flex flex-col">
              {isLoadingSync ? (
                <div className="p-6 text-center text-sm text-zinc-400 font-medium">Loading roster...</div>
              ) : users.map((contact: any) => {
                
                // Find matching conversation
                const convo = conversations.find((c: any) => c.participants.some((p:any) => p._id === contact._id));
                const lastMsg = convo?.lastMessage || "No messages yet";
                // Basic time string extraction
                const timeStr = convo?.lastMessageAt ? new Date(convo.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' }) : "";

                return (
                  <div 
                    key={contact._id}
                    onClick={() => setActiveContactId(contact._id)}
                    className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors border-b border-black/5 dark:border-white/5 last:border-b-0
                      ${activeContactId === contact._id ? 'bg-blue-50/70 hover:bg-blue-50 dark:bg-blue-900/10 dark:hover:bg-blue-900/20' : ''}
                    `}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12 border border-black/5 ring-2 ring-white dark:ring-zinc-950">
                        <AvatarImage src={contact.profilePicture} />
                        <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {contact.isActive && (
                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-green-500 border-2 border-white dark:border-zinc-950 rounded-full flex-shrink-0" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className={`text-sm font-semibold truncate ${activeContactId === contact._id ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                          {contact.name}
                        </h3>
                        <span className="text-[10px] text-zinc-400 whitespace-nowrap font-medium flex-shrink-0 ml-2">{timeStr}</span>
                      </div>
                      <p className={`text-[13px] truncate text-zinc-500 dark:text-zinc-400`}>
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
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950 relative">
          
          {/* Header */}
          {activeContact ? (
            <>
              <div className="h-[72px] px-6 border-b flex items-center justify-between flex-shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.02)] z-10 bg-white dark:bg-zinc-950">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10 ring-1 ring-black/5">
                    <AvatarImage src={activeContact.profilePicture} />
                    <AvatarFallback>{activeContact.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{activeContact.name}</h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`h-2 w-2 rounded-full ${activeContact.isActive ? 'bg-green-500' : 'bg-red-400'}`}></span>
                      <span className="text-xs text-zinc-500 font-medium">{activeContact.isActive ? "Active now" : "Offline"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-blue-600 rounded-full w-9 h-9">
                    <IconPhone size={18} />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-blue-600 rounded-full w-9 h-9">
                    <IconVideo size={18} />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-zinc-900 rounded-full w-9 h-9">
                    <IconDotsVertical size={18} />
                  </Button>
                </div>
              </div>

              {/* Chat Messages */}
              <ScrollArea className="flex-1 p-6 bg-slate-50/30 dark:bg-zinc-950/30">
                <div className="flex flex-col justify-end min-h-full">
                  
                  {isLoadingMessages && messages.length === 0 ? (
                    <div className="text-center text-sm font-medium text-zinc-400 my-auto pb-10">Loading conversation...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-xs font-medium text-zinc-400 my-auto pb-10">Say hi to {activeContact.name}!</div>
                  ) : (
                    <div className="flex flex-col gap-4">
                        {messages.map((msg: any, i: number) => {
                          const isMe = msg.senderId === currentUser?.id;
                          const showAvatar = i === 0 || messages[i-1].senderId !== msg.senderId;

                          return (
                            <div key={msg._id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} gap-3 max-w-full group`}>
                              
                              {!isMe && (
                                <div className="w-8 flex-shrink-0 flex items-end mb-1">
                                  {showAvatar && (
                                      <Avatar className="h-8 w-8 shadow-sm">
                                        <AvatarImage src={activeContact.profilePicture} />
                                        <AvatarFallback>{activeContact.name.charAt(0)}</AvatarFallback>
                                      </Avatar>
                                  )}
                                </div>
                              )}

                              <div className={`relative flex flex-col group max-w-[65%] xl:max-w-[50%] ${!isMe && !showAvatar ? 'ml-11' : ''}`}>
                                  <div 
                                    className={`px-4 py-2.5 shadow-sm text-[14.5px] leading-relaxed
                                      ${isMe 
                                        ? 'bg-blue-600 text-white rounded-[20px] rounded-br-[4px]' 
                                        : 'bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/5 text-slate-800 dark:text-slate-200 rounded-[20px] rounded-bl-[4px]'
                                      }
                                    `}
                                  >
                                      {msg.text}
                                  </div>
                                  <span className={`text-[10px] font-medium text-zinc-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'text-right' : 'text-left'}`}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {isMe && <span className="ml-1 text-blue-500 font-bold">✓✓</span>}
                                  </span>
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
              <div className="p-4 bg-white dark:bg-zinc-950 border-t z-10 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
                <form 
                    onSubmit={handleSendMessage}
                    className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-black/5 dark:border-white/10 rounded-full p-1 h-[52px]"
                >
                    <div className="flex gap-0.5 pl-2">
                      <Button type="button" variant="ghost" size="icon" className="w-9 h-9 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200/50">
                        <IconMoodSmile size={20} stroke={1.5} />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="w-9 h-9 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200/50">
                        <IconPaperclip size={20} stroke={1.5} />
                      </Button>
                    </div>
                    
                    <Input 
                      className="flex-1 border-none shadow-none focus-visible:ring-0 bg-transparent px-2 text-[15px] h-full rounded-none"
                      placeholder="Type your message..."
                      value={messageText}
                      onChange={e => setMessageText(e.target.value)}
                      disabled={isSending}
                    />

                    <div className="flex items-center pr-1 gap-1">
                      {messageText.length === 0 ? (
                        <Button type="button" variant="ghost" size="icon" className="w-10 h-10 rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/50">
                          <IconMicrophone size={20} />
                        </Button>
                      ) : (
                        <Button 
                            type="submit" 
                            size="icon" 
                            disabled={isSending}
                            className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all scale-animation"
                        >
                          <IconSend size={18} className="translate-x-[1px] -translate-y-[1px]" />
                        </Button>
                      )}
                    </div>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 dark:bg-zinc-950/50">
               <div className="h-20 w-20 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 mb-6 flex items-center justify-center">
                 <IconSend size={40} stroke={1.5} className="-translate-x-1 translate-y-1" />
               </div>
               <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Internal Chat Active</h3>
               <p className="text-sm text-zinc-500 max-w-sm">
                 Select a team member from the sidebar to start a real-time conversation.
               </p>
            </div>
          )}
        </div>

      </Card>
    </div>
  );
}
