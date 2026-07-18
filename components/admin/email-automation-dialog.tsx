"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  X, Mail, Plus, Trash2, Loader2, Clock, Globe, CalendarClock,
  BellRing, CheckCircle2, PauseCircle, PlayCircle, Sparkles, Send, Eye, Link2,
} from "lucide-react";

interface EmailAutomationDialogProps {
  open: boolean;
  onClose: () => void;
  containerNo: string;
  shippingId?: string | null;
  routeLabel?: string; // e.g. "San Antonio, Chile → Montreal, Canada"
}

const CANADA_TIMEZONES = [
  { value: "America/St_Johns", label: "Newfoundland — St. John's (NT)" },
  { value: "America/Halifax", label: "Atlantic — Halifax (AT)" },
  { value: "America/Toronto", label: "Eastern — Toronto / Montreal (ET)" },
  { value: "America/Winnipeg", label: "Central — Winnipeg (CT)" },
  { value: "America/Regina", label: "Saskatchewan — Regina (CST)" },
  { value: "America/Edmonton", label: "Mountain — Edmonton / Calgary (MT)" },
  { value: "America/Vancouver", label: "Pacific — Vancouver (PT)" },
];

const FREQUENCIES = [
  { value: 1, label: "Every day" },
  { value: 2, label: "Every 2 days" },
  { value: 3, label: "Every 3 days" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailAutomationDialog({
  open,
  onClose,
  containerNo,
  shippingId,
  routeLabel,
}: EmailAutomationDialogProps) {
  // Form state
  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [frequencyDays, setFrequencyDays] = useState<1 | 2 | 3>(3);
  const [sendTime, setSendTime] = useState("09:00");
  const [timezone, setTimezone] = useState("America/Toronto");
  const [saving, setSaving] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Existing automations
  const [automations, setAutomations] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [trackUrl, setTrackUrl] = useState<string | null>(null);

  const fetchAutomations = useCallback(async () => {
    if (!containerNo) return;
    setLoadingList(true);
    try {
      const res = await fetch(`/api/admin/email-automations?containerNo=${encodeURIComponent(containerNo)}`);
      const data = await res.json();
      if (res.ok) {
        setAutomations(data.automations || []);
        setTrackUrl(data.trackUrl || null);
      }
    } catch { /* silent */ } finally {
      setLoadingList(false);
    }
  }, [containerNo]);

  useEffect(() => {
    if (open) {
      fetchAutomations();
      setEmails([]);
      setEmailInput("");
      setFrequencyDays(3);
      setSendTime("09:00");
      setTimezone("America/Toronto");
    }
  }, [open, fetchAutomations]);

  const addEmail = (raw: string) => {
    // Support comma/space separated paste of multiple emails
    const candidates = raw.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (candidates.length === 0) return;
    const invalid = candidates.filter((e) => !EMAIL_RE.test(e));
    if (invalid.length > 0) {
      toast.error(`Invalid email: ${invalid[0]}`);
      return;
    }
    setEmails((prev) => [...new Set([...prev, ...candidates])]);
    setEmailInput("");
  };

  const removeEmail = (email: string) => setEmails((prev) => prev.filter((e) => e !== email));

  /** Collect chips + any email still typed in the input */
  const collectEmails = (): string[] | null => {
    let finalEmails = emails;
    if (emailInput.trim()) {
      if (!EMAIL_RE.test(emailInput.trim().toLowerCase())) {
        toast.error(`Invalid email: ${emailInput.trim()}`);
        return null;
      }
      finalEmails = [...new Set([...emails, emailInput.trim().toLowerCase()])];
    }
    return finalEmails;
  };

  /** Send the shipment snapshot immediately to the emails in the form */
  const handleSendNow = async () => {
    const finalEmails = collectEmails();
    if (finalEmails === null) return;
    if (finalEmails.length === 0) {
      toast.error("Add at least one recipient email");
      inputRef.current?.focus();
      return;
    }
    setSendingNow(true);
    try {
      const res = await fetch("/api/admin/email-automations/send-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ containerNo, recipients: finalEmails }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Shipment snapshot sent", {
          description: `Emailed to ${finalEmails.join(", ")}`,
        });
      } else {
        toast.error("Failed to send", { description: data.error });
      }
    } catch {
      toast.error("Failed to send");
    } finally {
      setSendingNow(false);
    }
  };

  /** Send now using an existing automation's recipients */
  const sendNowForAutomation = async (auto: any) => {
    setBusyId(auto._id);
    try {
      const res = await fetch("/api/admin/email-automations/send-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ containerNo, automationId: auto._id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Shipment snapshot sent", {
          description: `Emailed to ${(auto.recipients || []).join(", ")}`,
        });
        fetchAutomations();
      } else {
        toast.error("Failed to send", { description: data.error });
      }
    } catch {
      toast.error("Failed to send");
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async () => {
    // Include anything still typed in the input
    const finalEmails = collectEmails();
    if (finalEmails === null) return;
    if (finalEmails.length === 0) {
      toast.error("Add at least one recipient email");
      inputRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/email-automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          containerNo,
          shippingId: shippingId || null,
          recipients: finalEmails,
          frequencyDays,
          sendTime,
          timezone,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Email automation created", {
          description: `${finalEmails.length} recipient(s) · ${FREQUENCIES.find((f) => f.value === frequencyDays)?.label} at ${sendTime}`,
        });
        setEmails([]);
        setEmailInput("");
        fetchAutomations();
      } else {
        toast.error("Failed to create automation", { description: data.error });
      }
    } catch {
      toast.error("Failed to create automation");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (auto: any) => {
    setBusyId(auto._id);
    try {
      const res = await fetch("/api/admin/email-automations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: auto._id, updates: { active: !auto.active } }),
      });
      if (res.ok) {
        toast.success(auto.active ? "Automation paused" : "Automation resumed");
        fetchAutomations();
      } else toast.error("Failed to update");
    } catch { toast.error("Failed to update"); }
    finally { setBusyId(null); }
  };

  const deleteAutomation = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/email-automations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast.success("Automation deleted");
        fetchAutomations();
      } else toast.error("Failed to delete");
    } catch { toast.error("Failed to delete"); }
    finally { setBusyId(null); }
  };

  const tzLabel = (tz: string) => CANADA_TIMEZONES.find((t) => t.value === tz)?.label || tz;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-lg max-h-[88vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-zinc-800/80 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <BellRing className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Email Automations</h2>
                <p className="text-[11px] text-zinc-400 font-mono">{containerNo}{routeLabel ? ` · ${routeLabel}` : ""}</p>
              </div>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Recipients */}
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1.5 mb-2">
              <Mail className="h-3 w-3" /> Notify to
            </label>
            <div
              className="min-h-[42px] flex flex-wrap items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-2.5 py-2 cursor-text focus-within:border-blue-500/50 transition-colors"
              onClick={() => inputRef.current?.focus()}
            >
              {emails.map((email) => (
                <span key={email} className="inline-flex items-center gap-1 bg-blue-500/15 border border-blue-500/25 text-blue-300 text-xs font-medium rounded-full pl-2.5 pr-1 py-0.5">
                  {email}
                  <button onClick={(e) => { e.stopPropagation(); removeEmail(email); }} className="h-4 w-4 rounded-full hover:bg-blue-500/30 flex items-center justify-center">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "," || e.key === " ") {
                    e.preventDefault();
                    addEmail(emailInput);
                  } else if (e.key === "Backspace" && !emailInput && emails.length > 0) {
                    removeEmail(emails[emails.length - 1]);
                  }
                }}
                onBlur={() => { if (emailInput.trim()) addEmail(emailInput); }}
                placeholder={emails.length === 0 ? "client@company.com — press Enter to add more" : ""}
                className="flex-1 min-w-[140px] bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none py-0.5"
              />
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1.5 mb-2">
              <CalendarClock className="h-3 w-3" /> Frequency
            </label>
            <div className="grid grid-cols-3 gap-2">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFrequencyDays(f.value as 1 | 2 | 3)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all",
                    frequencyDays === f.value
                      ? "bg-blue-500/15 border-blue-500/40 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                      : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time + Timezone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1.5 mb-2">
                <Clock className="h-3 w-3" /> Send at
              </label>
              <input
                type="time"
                value={sendTime}
                onChange={(e) => setSendTime(e.target.value)}
                className="w-full h-10 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50 transition-colors [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold flex items-center gap-1.5 mb-2">
                <Globe className="h-3 w-3" /> Timezone (Canada)
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full h-10 rounded-xl border border-zinc-800 bg-zinc-900/60 px-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/50 transition-colors"
              >
                {CANADA_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 px-3.5 py-3">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Recipients get a <span className="text-zinc-200 font-medium">live snapshot of this shipment</span> — status,
              route, vessel, event timeline and current position — at the scheduled time.
              Automations <span className="text-emerald-400 font-medium">stop automatically once delivered</span> (a final
              delivery notice is sent).
            </p>
          </div>

          {/* Secure client link */}
          {trackUrl && (
            <div className="flex items-center gap-2 rounded-xl bg-blue-500/[0.06] border border-blue-500/15 px-3.5 py-2.5">
              <Link2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <p className="flex-1 min-w-0 text-[10px] text-zinc-400 truncate font-mono" title={trackUrl}>{trackUrl}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(trackUrl).then(
                    () => toast.success("Secure tracking link copied", { description: "Share it with your client — no login needed." }),
                    () => toast.error("Couldn't copy link")
                  );
                }}
                className="shrink-0 text-[10px] font-bold text-blue-300 hover:text-blue-200 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 rounded-lg px-2.5 py-1 transition-colors"
              >
                Copy
              </button>
            </div>
          )}

          {/* Actions: Preview + Send Now + Create */}
          <div className="grid grid-cols-[auto_1fr_1.4fr] gap-2.5">
            <button
              onClick={() =>
                window.open(
                  `/api/admin/email-automations/preview?containerNo=${encodeURIComponent(containerNo)}`,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              title="Preview the exact email recipients will receive"
              className="h-10 w-10 rounded-xl border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-300 hover:text-white flex items-center justify-center transition-colors"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={handleSendNow}
              disabled={sendingNow || saving}
              title="Send the shipment snapshot immediately to these recipients"
              className="h-10 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-60 text-emerald-300 text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              {sendingNow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Now
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || sendingNow}
              className="h-10 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Automation
            </button>
          </div>

          {/* Existing automations */}
          <div>
            <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-2">
              Active for this container {automations.length > 0 && `(${automations.length})`}
            </h3>
            {loadingList ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
              </div>
            ) : automations.length === 0 ? (
              <p className="text-xs text-zinc-600 py-3 text-center border border-dashed border-zinc-800 rounded-xl">
                No automations yet for this container
              </p>
            ) : (
              <div className="space-y-2">
                {automations.map((auto) => (
                  <div
                    key={auto._id}
                    className={cn(
                      "rounded-xl border px-3.5 py-3 transition-all",
                      auto.active ? "bg-zinc-900/60 border-zinc-800" : "bg-zinc-900/30 border-zinc-800/50 opacity-60"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1">
                          {auto.recipients.map((r: string) => (
                            <span key={r} className="text-[10px] font-medium text-blue-300 bg-blue-500/10 rounded-full px-2 py-0.5">{r}</span>
                          ))}
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1.5 flex items-center gap-1 flex-wrap">
                          <CalendarClock className="h-2.5 w-2.5" />
                          {FREQUENCIES.find((f) => f.value === auto.frequencyDays)?.label || `Every ${auto.frequencyDays} days`}
                          <span className="text-zinc-700">·</span>
                          <Clock className="h-2.5 w-2.5" /> {auto.sendTime}
                          <span className="text-zinc-700">·</span>
                          {tzLabel(auto.timezone)}
                        </p>
                        {auto.lastSentAt && (
                          <p className="text-[9px] text-zinc-600 mt-1 flex items-center gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500/70" />
                            Last sent {new Date(auto.lastSentAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => sendNowForAutomation(auto)}
                          disabled={busyId === auto._id}
                          title="Send now to these recipients"
                          className="h-7 w-7 rounded-lg hover:bg-emerald-500/15 flex items-center justify-center text-zinc-400 hover:text-emerald-400 transition-colors"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => toggleActive(auto)}
                          disabled={busyId === auto._id}
                          title={auto.active ? "Pause" : "Resume"}
                          className="h-7 w-7 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                        >
                          {busyId === auto._id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : auto.active ? (
                            <PauseCircle className="h-3.5 w-3.5" />
                          ) : (
                            <PlayCircle className="h-3.5 w-3.5 text-emerald-400" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteAutomation(auto._id)}
                          disabled={busyId === auto._id}
                          title="Delete"
                          className="h-7 w-7 rounded-lg hover:bg-red-500/15 flex items-center justify-center text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
