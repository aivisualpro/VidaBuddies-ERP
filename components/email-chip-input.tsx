"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { X, Users, Clock } from "lucide-react";

/* ─── Types ─── */

export interface EmailContact {
    email: string;
    name: string;
    source: "team" | "recent";
}

interface EmailChipInputProps {
    value: string[];
    onChange: (emails: string[]) => void;
    contacts: EmailContact[];
    placeholder?: string;
    readOnly?: boolean;
    id?: string;
}

/* ─── Helpers ─── */

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

/* ─── Component ─── */

export function EmailChipInput({
    value,
    onChange,
    contacts,
    placeholder = "Enter email addresses...",
    readOnly = false,
    id,
}: EmailChipInputProps) {
    const [inputValue, setInputValue] = useState("");
    const [focused, setFocused] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Filter suggestions based on input & already-selected emails
    const filteredSuggestions = inputValue.trim().length > 0
        ? contacts.filter((c) => {
            const alreadyAdded = value.some(
                (v) => v.toLowerCase() === c.email.toLowerCase()
            );
            if (alreadyAdded) return false;
            const q = inputValue.toLowerCase();
            return (
                c.email.toLowerCase().includes(q) ||
                c.name.toLowerCase().includes(q)
            );
        })
        : [];

    // Reset highlighted index when suggestions change
    useEffect(() => {
        setHighlightedIndex(-1);
    }, [filteredSuggestions.length]);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setShowSuggestions(false);
                // Auto-add whatever is typed if it looks like an email
                commitCurrentInput();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [inputValue, value]);

    const commitCurrentInput = useCallback(() => {
        const raw = inputValue.trim();
        if (!raw) return;
        // Split by comma/semicolon/space for multi-paste
        const parts = raw.split(/[,;\s]+/).filter(Boolean);
        const newEmails: string[] = [];
        for (const part of parts) {
            const clean = part.replace(/^<|>$/g, "").trim();
            if (
                isValidEmail(clean) &&
                !value.some((v) => v.toLowerCase() === clean.toLowerCase())
            ) {
                newEmails.push(clean);
            }
        }
        if (newEmails.length > 0) {
            onChange([...value, ...newEmails]);
        }
        setInputValue("");
        setShowSuggestions(false);
    }, [inputValue, value, onChange]);

    const addEmail = (email: string) => {
        const clean = email.trim().toLowerCase();
        if (!clean) return;
        if (value.some((v) => v.toLowerCase() === clean)) return;
        onChange([...value, clean]);
        setInputValue("");
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    const removeEmail = (email: string) => {
        onChange(value.filter((v) => v.toLowerCase() !== email.toLowerCase()));
        inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
                addEmail(filteredSuggestions[highlightedIndex].email);
            } else {
                commitCurrentInput();
            }
        } else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
            // Remove last chip
            removeEmail(value[value.length - 1]);
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((prev) =>
                prev < filteredSuggestions.length - 1 ? prev + 1 : 0
            );
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((prev) =>
                prev > 0 ? prev - 1 : filteredSuggestions.length - 1
            );
        } else if (e.key === "Escape") {
            setShowSuggestions(false);
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text");
        const parts = text.split(/[,;\s\n]+/).filter(Boolean);
        const newEmails: string[] = [];
        for (const part of parts) {
            const clean = part.replace(/^<|>$/g, "").trim();
            if (
                isValidEmail(clean) &&
                !value.some((v) => v.toLowerCase() === clean.toLowerCase())
            ) {
                newEmails.push(clean);
            }
        }
        if (newEmails.length > 0) {
            onChange([...value, ...newEmails]);
        }
    };

    // Scroll highlighted suggestion into view
    useEffect(() => {
        if (highlightedIndex >= 0 && suggestionsRef.current) {
            const items = suggestionsRef.current.querySelectorAll("[data-suggestion]");
            items[highlightedIndex]?.scrollIntoView({ block: "nearest" });
        }
    }, [highlightedIndex]);

    // Find contact info for a chip
    const getContactForEmail = (email: string) =>
        contacts.find((c) => c.email.toLowerCase() === email.toLowerCase());

    if (readOnly) {
        return (
            <div className="flex items-center flex-wrap gap-1.5 min-h-[44px] px-2 py-1.5">
                {value.length > 0 ? (
                    value.map((email) => {
                        const contact = getContactForEmail(email);
                        return (
                            <span
                                key={email}
                                className="inline-flex items-center gap-1.5 bg-muted/60 border border-border/40 rounded-full px-2.5 py-1 text-xs font-medium"
                            >
                                {contact?.name ? (
                                    <span className="h-4.5 w-4.5 rounded-full bg-primary/10 text-primary text-[8px] font-bold flex items-center justify-center">
                                        {getInitials(contact.name)}
                                    </span>
                                ) : null}
                                {email}
                            </span>
                        );
                    })
                ) : (
                    <span className="text-sm text-muted-foreground/40">—</span>
                )}
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative flex-1">
            {/* Chip container + input */}
            <div
                className={cn(
                    "flex items-center flex-wrap gap-1.5 min-h-[44px] px-2 py-1.5 cursor-text transition-all",
                    focused && "ring-0"
                )}
                onClick={() => inputRef.current?.focus()}
            >
                {/* Chips */}
                {value.map((email) => {
                    const contact = getContactForEmail(email);
                    return (
                        <span
                            key={email}
                            className="group inline-flex items-center gap-1 bg-primary/5 border border-primary/15 rounded-full pl-1.5 pr-1 py-0.5 text-xs font-medium text-foreground animate-in fade-in zoom-in-95 duration-150"
                        >
                            {contact?.name ? (
                                <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[8px] font-bold flex items-center justify-center shrink-0">
                                    {getInitials(contact.name)}
                                </span>
                            ) : (
                                <span className="h-5 w-5 rounded-full bg-muted text-muted-foreground text-[8px] font-bold flex items-center justify-center shrink-0">
                                    @
                                </span>
                            )}
                            <span className="truncate max-w-[180px]">
                                {contact?.name ? (
                                    <>
                                        <span className="font-semibold">{contact.name}</span>
                                        <span className="text-muted-foreground/50 ml-1">{email}</span>
                                    </>
                                ) : (
                                    email
                                )}
                            </span>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeEmail(email);
                                }}
                                className="h-4 w-4 rounded-full flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all ml-0.5 shrink-0"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </span>
                    );
                })}

                {/* Input */}
                <input
                    ref={inputRef}
                    id={id}
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onFocus={() => {
                        setFocused(true);
                        if (inputValue.trim()) setShowSuggestions(true);
                    }}
                    onBlur={() => setFocused(false)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={value.length === 0 ? placeholder : "Add more..."}
                    autoComplete="off"
                    className="flex-1 min-w-[120px] h-7 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground/40"
                />
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
                <div
                    ref={suggestionsRef}
                    className="absolute left-0 right-0 top-full z-50 mt-1 bg-popover border border-border/60 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                >
                    <div className="max-h-[200px] overflow-y-auto py-1">
                        {filteredSuggestions.slice(0, 8).map((contact, i) => (
                            <div
                                key={contact.email}
                                data-suggestion
                                role="option"
                                aria-selected={i === highlightedIndex}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors",
                                    i === highlightedIndex
                                        ? "bg-primary/5 text-foreground"
                                        : "hover:bg-muted/50"
                                )}
                                onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent blur
                                    addEmail(contact.email);
                                }}
                                onMouseEnter={() => setHighlightedIndex(i)}
                            >
                                {/* Avatar */}
                                <div
                                    className={cn(
                                        "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold",
                                        contact.source === "team"
                                            ? "bg-primary/10 text-primary"
                                            : "bg-amber-500/10 text-amber-600"
                                    )}
                                >
                                    {contact.name ? getInitials(contact.name) : "@"}
                                </div>

                                {/* Info */}
                                <div className="min-w-0 flex-1">
                                    {contact.name ? (
                                        <>
                                            <p className="text-xs font-semibold truncate">
                                                {contact.name}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground/60 truncate">
                                                {contact.email}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-xs font-medium truncate">
                                            {contact.email}
                                        </p>
                                    )}
                                </div>

                                {/* Source badge */}
                                <div
                                    className={cn(
                                        "flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
                                        contact.source === "team"
                                            ? "bg-primary/5 text-primary/60"
                                            : "bg-amber-500/5 text-amber-500/60"
                                    )}
                                >
                                    {contact.source === "team" ? (
                                        <Users className="h-2.5 w-2.5" />
                                    ) : (
                                        <Clock className="h-2.5 w-2.5" />
                                    )}
                                    {contact.source === "team" ? "Team" : "Recent"}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
