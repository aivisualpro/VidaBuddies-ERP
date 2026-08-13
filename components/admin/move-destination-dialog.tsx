"use client";

/**
 * MoveDestinationDialog — Google-Drive-grade "Move to" picker.
 *
 * Shows the record's FULL folder tree (root → all nested folders) so files can
 * be moved across any folders, not just the ones visible in the current view.
 * Tap-first design (works without drag & drop), search, expand/collapse,
 * current-location awareness, invalid-target protection (no folder into
 * itself/descendants) and inline "new folder in destination".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Loader2,
  Search,
  X,
  CornerDownRight,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TreeFolder {
  id: string;
  name: string;
  parentId: string;
  depth: number;
  fileCount?: number;
}

export interface MoveRecordTarget {
  id: string;
  label: string;
  count: number;
}

interface MoveDestinationDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Record's root Drive folder */
  rootId: string | null;
  rootLabel: string;
  /** Where the selected items currently live (badged + disabled) */
  currentLocationId?: string | null;
  /** Drive ids of the SELECTED folders (they and their descendants are invalid targets) */
  selectedFolderIds?: string[];
  itemCount: number;
  moving?: boolean;
  onMove: (targetId: string, targetName: string) => void | Promise<void>;
  /** Optional "move to another record" section (root view only) */
  records?: MoveRecordTarget[];
  onPickRecord?: (recordId: string) => void;
  /**
   * Folders the file manager already shows for this record. Guarantees the
   * tree includes them even if their physical Drive parent drifted (legacy),
   * and doubles as an offline fallback if the tree endpoint is unavailable.
   */
  seedFolders?: { id: string; name: string }[];
}

export default function MoveDestinationDialog({
  open,
  onOpenChange,
  rootId,
  rootLabel,
  currentLocationId,
  selectedFolderIds = [],
  itemCount,
  moving = false,
  onMove,
  records = [],
  onPickRecord,
  seedFolders = [],
}: MoveDestinationDialogProps) {
  const [folders, setFolders] = useState<TreeFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dest, setDest] = useState<{ id: string; name: string } | null>(null);
  const [query, setQuery] = useState("");
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const loadTree = useCallback(async () => {
    if (!rootId) return;
    setLoading(true);
    // The folder cards visible in the app — always a valid fallback tree.
    const fallback: TreeFolder[] = seedFolders.map((s) => ({ id: s.id, name: s.name, parentId: rootId, depth: 1 }));
    try {
      const seedsParam = seedFolders.length
        ? `&seeds=${encodeURIComponent(seedFolders.map((s) => s.id).join(","))}`
        : "";
      const res = await fetch(`/api/admin/drive/folder-tree?folderId=${rootId}${seedsParam}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const list: TreeFolder[] = (data.folders || []).length > 0 ? data.folders : fallback;
      setFolders(list);
      // Expand root + first level by default
      const first = new Set<string>([rootId]);
      list.filter((f: TreeFolder) => f.depth === 1).forEach((f: TreeFolder) => first.add(f.id));
      setExpanded(first);
    } catch (e: any) {
      if (fallback.length > 0) {
        // Endpoint unavailable (e.g. server not restarted yet) → still usable
        setFolders(fallback);
        setExpanded(new Set([rootId]));
      } else {
        toast.error("Could not load folders", { description: e.message });
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId, seedFolders.map((s) => s.id).join(",")]);

  useEffect(() => {
    if (open) {
      setDest(null);
      setQuery("");
      setNewFolderMode(false);
      setNewFolderName("");
      loadTree();
    }
  }, [open, loadTree]);

  /* ── derived structures ── */
  const childrenOf = useMemo(() => {
    const m = new Map<string, TreeFolder[]>();
    for (const f of folders) {
      const arr = m.get(f.parentId) || [];
      arr.push(f);
      m.set(f.parentId, arr);
    }
    return m;
  }, [folders]);

  /** Invalid targets: the selected folders themselves + all their descendants. */
  const invalidIds = useMemo(() => {
    const bad = new Set<string>(selectedFolderIds);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of folders) {
        if (bad.has(f.parentId) && !bad.has(f.id)) {
          bad.add(f.id);
          grew = true;
        }
      }
    }
    return bad;
  }, [folders, selectedFolderIds]);

  const pathOf = useCallback(
    (id: string): string => {
      const byId = new Map(folders.map((f) => [f.id, f]));
      const parts: string[] = [];
      let cur = byId.get(id);
      while (cur) {
        parts.unshift(cur.name);
        cur = byId.get(cur.parentId);
      }
      return parts.join(" / ");
    },
    [folders]
  );

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return folders.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 40);
  }, [query, folders]);

  const createFolderHere = async () => {
    const name = newFolderName.trim();
    const parent = dest?.id || rootId;
    if (!name || !parent) return;
    setCreatingFolder(true);
    try {
      const res = await fetch(
        `/api/admin/drive?folderId=${parent}&ensureChildren=${encodeURIComponent(name)}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const created = (data.files || []).find(
        (f: any) => f.mimeType === "application/vnd.google-apps.folder" && f.name === name
      );
      await loadTree();
      if (created) {
        setDest({ id: created.id, name: created.name });
        setExpanded((prev) => new Set([...prev, parent]));
      }
      setNewFolderMode(false);
      setNewFolderName("");
      toast.success(`Folder "${name}" created`);
    } catch (e: any) {
      toast.error("Could not create folder", { description: e.message });
    } finally {
      setCreatingFolder(false);
    }
  };

  /* ── row renderer ── */
  const Row = ({
    id,
    name,
    depth,
    isRoot = false,
    fileCount,
  }: {
    id: string;
    name: string;
    depth: number;
    isRoot?: boolean;
    fileCount?: number;
  }) => {
    const kids = childrenOf.get(id) || [];
    const hasKids = kids.length > 0;
    const isExpanded = expanded.has(id);
    const isCurrent = currentLocationId === id;
    const isInvalid = invalidIds.has(id);
    const isDest = dest?.id === id;
    const disabled = isCurrent || isInvalid || moving;

    return (
      <div key={id}>
        <div
          className={cn(
            "group flex items-center gap-1 rounded-lg pr-2 transition-all",
            isDest
              ? "bg-amber-500/15 ring-1 ring-amber-500/50"
              : !disabled && "hover:bg-muted/50"
          )}
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
        >
          {/* expand / collapse */}
          <button
            type="button"
            className={cn(
              "h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground shrink-0",
              hasKids ? "hover:bg-muted hover:text-foreground" : "opacity-0 pointer-events-none"
            )}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((prev) => {
                const n = new Set(prev);
                if (n.has(id)) n.delete(id);
                else n.add(id);
                return n;
              });
            }}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>

          {/* select destination */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setDest({ id, name })}
            onDoubleClick={() => !disabled && onMove(id, name)}
            className={cn(
              "flex-1 min-w-0 flex items-center gap-2 py-1.5 text-left text-xs rounded-md",
              disabled ? "opacity-45 cursor-not-allowed" : "cursor-pointer"
            )}
            title={isInvalid ? "Cannot move a folder into itself" : isCurrent ? "Items are already here" : name}
          >
            {isRoot ? (
              <HardDrive className="h-4 w-4 text-primary shrink-0" />
            ) : isExpanded && hasKids ? (
              <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-amber-500 shrink-0" />
            )}
            <span className={cn("truncate font-medium", isRoot && "text-foreground/90")}>{name}</span>
            {isCurrent && (
              <span className="text-[9px] font-bold text-sky-500 bg-sky-500/10 border border-sky-500/25 px-1.5 py-0.5 rounded-full shrink-0">
                Current location
              </span>
            )}
            <span className="ml-auto flex items-center gap-1.5 shrink-0">
              {typeof fileCount === "number" && !isRoot && (
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                  fileCount > 0 ? "bg-muted/60 text-muted-foreground" : "text-muted-foreground/50"
                )}>
                  {fileCount > 0 ? `${fileCount} file${fileCount !== 1 ? "s" : ""}` : "empty"}
                </span>
              )}
              {isDest && <Check className="h-3.5 w-3.5 text-amber-500" />}
            </span>
          </button>
        </div>
        {isExpanded && kids.map((k) => <Row key={k.id} id={k.id} name={k.name} depth={depth + 1} fileCount={k.fileCount} />)}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-amber-500/15 border border-amber-500/30">
              <ArrowRightLeft className="h-3.5 w-3.5 text-amber-500" />
            </span>
            Move {itemCount} item{itemCount !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            Choose a destination folder — double-click to move instantly.
          </DialogDescription>
          {/* Search */}
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search folders…"
              className="h-8 w-full rounded-lg border border-border/60 bg-muted/30 pl-8 pr-8 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </DialogHeader>

        {/* Tree / search results */}
        <div className="max-h-[340px] min-h-[180px] overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="space-y-2 px-2 py-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-7 rounded-lg bg-muted/40 animate-pulse" style={{ width: `${88 - i * 9}%`, marginLeft: `${i * 14}px` }} />
              ))}
            </div>
          ) : searchResults ? (
            searchResults.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No folders match “{query}”</p>
            ) : (
              <div className="space-y-0.5">
                {searchResults.map((f) => {
                  const isInvalid = invalidIds.has(f.id);
                  const isCurrent = currentLocationId === f.id;
                  const disabled = isInvalid || isCurrent || moving;
                  const isDest = dest?.id === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => setDest({ id: f.id, name: f.name })}
                      onDoubleClick={() => !disabled && onMove(f.id, f.name)}
                      className={cn(
                        "w-full flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-all",
                        isDest ? "bg-amber-500/15 ring-1 ring-amber-500/50" : !disabled && "hover:bg-muted/50",
                        disabled && "opacity-45 cursor-not-allowed"
                      )}
                    >
                      <Folder className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <span className="min-w-0">
                        <span className="block font-medium truncate">{f.name}</span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                          <CornerDownRight className="h-2.5 w-2.5 shrink-0" /> {rootLabel} / {pathOf(f.id)}
                        </span>
                      </span>
                      <span className="ml-auto flex items-center gap-1.5 shrink-0 mt-0.5">
                        {typeof f.fileCount === "number" && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
                            {f.fileCount > 0 ? `${f.fileCount} file${f.fileCount !== 1 ? "s" : ""}` : "empty"}
                          </span>
                        )}
                        {isDest && <Check className="h-3.5 w-3.5 text-amber-500" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <>
              {rootId && <Row id={rootId} name={`${rootLabel} — record root`} depth={0} isRoot />}
              {/* Other records (root view only) */}
              {records.length > 0 && (
                <div className="mt-3 pt-2 border-t border-border/40">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-2 pb-1">
                    Move to another record
                  </p>
                  <div className="space-y-0.5">
                    {records.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        disabled={moving}
                        onClick={() => onPickRecord?.(r.id)}
                        className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-muted/50 transition-all"
                      >
                        <HardDrive className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate font-medium">{r.label}</span>
                        <span className="ml-auto text-[10px] font-bold bg-muted/60 px-1.5 py-0.5 rounded-full shrink-0">{r.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/60 px-4 py-3 space-y-2">
          {newFolderMode ? (
            <div className="flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-amber-500 shrink-0" />
              <input
                ref={newFolderInputRef}
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createFolderHere();
                  if (e.key === "Escape") setNewFolderMode(false);
                }}
                placeholder={`New folder in ${dest?.name || rootLabel}…`}
                className="h-8 flex-1 rounded-lg border border-border/60 bg-muted/30 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={createFolderHere} disabled={creatingFolder || !newFolderName.trim()}>
                {creatingFolder ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setNewFolderMode(true)}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-amber-500 transition-colors"
                disabled={moving}
              >
                <FolderPlus className="h-3.5 w-3.5" /> New folder
              </button>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onOpenChange(false)} disabled={moving}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={!dest || moving}
                  onClick={() => dest && onMove(dest.id, dest.name)}
                >
                  {moving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
                  Move here
                </Button>
              </div>
            </div>
          )}
          {dest && !newFolderMode && (
            <p className="text-[10px] text-muted-foreground truncate">
              Destination: <span className="font-semibold text-foreground/80">{dest.name}</span>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
