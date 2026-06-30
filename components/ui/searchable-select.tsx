"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  name?: string;
  allowClear?: boolean;
  allowCreate?: boolean;
}

const BATCH_SIZE = 20;

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
  name,
  allowClear = false,
  allowCreate = false,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [visibleCount, setVisibleCount] = React.useState(BATCH_SIZE);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((opt) => opt.value === value)?.label || (allowCreate ? value : undefined);

  // Filter options by search
  const filtered = React.useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, search]);

  // Check if search query exactly matches an existing option
  const hasExactMatch = React.useMemo(() => {
    if (!search.trim()) return true;
    return options.some(opt => opt.label.toLowerCase() === search.trim().toLowerCase());
  }, [options, search]);

  // Items to render (lazy batch)
  const visible = React.useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  // Reset visible count when search changes or popover opens
  React.useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [search, open]);

  // Handle scroll to load more
  const handleScroll = React.useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filtered.length));
    }
  }, [filtered.length]);

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between h-9 px-3 text-sm font-normal bg-background",
              !value && "text-muted-foreground",
              className
            )}
          >
            <span className="truncate">
              {selectedLabel || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col">
            {/* Search input */}
            <div className="flex items-center border-b px-3">
              <svg className="mr-2 h-4 w-4 shrink-0 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground p-1">
                  <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              )}
            </div>

            {/* Options list */}
            <div
              ref={listRef}
              onScroll={handleScroll}
              className="max-h-[200px] overflow-y-auto overflow-x-hidden scrollbar-thin"
            >
              {/* Allow clear option */}
              {allowClear && value && !search && (
                <button
                  onClick={() => { onChange(""); setOpen(false); }}
                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground text-muted-foreground italic"
                >
                  Clear selection
                </button>
              )}

              {/* Add custom option */}
              {allowCreate && search.trim() && !hasExactMatch && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(search.trim());
                    setOpen(false);
                  }}
                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground text-primary font-semibold border-b border-border/40"
                >
                  <Plus className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">Add "{search.trim()}"</span>
                </button>
              )}

              {visible.length === 0 ? (
                (!allowCreate || !search.trim()) && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {emptyMessage}
                  </div>
                )
              ) : (
                visible.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onChange(option.value === value ? "" : option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                      value === option.value && "bg-accent"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </button>
                ))
              )}

              {/* Load more indicator */}
              {visible.length < filtered.length && (
                <div className="py-2 text-center text-[10px] text-muted-foreground/60">
                  Scroll for more · {visible.length} of {filtered.length}
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
