"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Plus,
  Trash,
  Save,
  ClipboardList,
  GripVertical,
  Pencil,
  X,
  Check,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SpecItem {
  label: string;
  value: string;
}

export default function SupplierSpecsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [specs, setSpecs] = useState<SpecItem[]>([]);
  const [specsNotes, setSpecsNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editValue, setEditValue] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [originalData, setOriginalData] = useState<{ specs: SpecItem[]; notes: string } | null>(null);

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const res = await fetch(`/api/admin/suppliers/${id}`);
        if (res.ok) {
          const data = await res.json();
          const s = data.specs || [];
          const n = data.specsNotes || "";
          setSpecs(s);
          setSpecsNotes(n);
          setOriginalData({ specs: s, notes: n });
        }
      } catch {
        toast.error("Failed to load specifications");
      } finally {
        setLoading(false);
      }
    };
    fetchSupplier();
  }, [id]);

  // Track dirty state
  useEffect(() => {
    if (!originalData) return;
    const dirty =
      JSON.stringify(specs) !== JSON.stringify(originalData.specs) ||
      specsNotes !== originalData.notes;
    setIsDirty(dirty);
  }, [specs, specsNotes, originalData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specs, specsNotes }),
      });
      if (!res.ok) throw new Error("Failed");
      setOriginalData({ specs: [...specs], notes: specsNotes });
      toast.success("Specifications saved successfully");
    } catch {
      toast.error("Failed to save specifications");
    } finally {
      setSaving(false);
    }
  };

  const handleAddSpec = () => {
    if (!newLabel.trim()) {
      toast.error("Label is required");
      return;
    }
    setSpecs(prev => [...prev, { label: newLabel.trim(), value: newValue.trim() }]);
    setNewLabel("");
    setNewValue("");
    setShowAddForm(false);
  };

  const handleDeleteSpec = (idx: number) => {
    setSpecs(prev => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditLabel(specs[idx].label);
    setEditValue(specs[idx].value);
  };

  const confirmEdit = () => {
    if (editingIdx === null) return;
    if (!editLabel.trim()) {
      toast.error("Label is required");
      return;
    }
    setSpecs(prev =>
      prev.map((s, i) => (i === editingIdx ? { label: editLabel.trim(), value: editValue.trim() } : s))
    );
    setEditingIdx(null);
  };

  const cancelEdit = () => {
    setEditingIdx(null);
  };

  const moveSpec = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= specs.length) return;
    const newSpecs = [...specs];
    [newSpecs[idx], newSpecs[targetIdx]] = [newSpecs[targetIdx], newSpecs[idx]];
    setSpecs(newSpecs);
    if (editingIdx === idx) setEditingIdx(targetIdx);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-14rem)]">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-10rem)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0 px-1">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ClipboardList className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Specifications</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
              {specs.length} specification{specs.length !== 1 ? 's' : ''} defined
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!showAddForm && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[10px] font-bold uppercase tracking-widest gap-1.5"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Spec
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 text-[10px] font-bold uppercase tracking-widest gap-1.5"
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Spec Table */}
          <div className="lg:col-span-2 space-y-2">

            {/* Add New Spec Form */}
            {showAddForm && (
              <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.03] p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2 mb-1">
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">New Specification</span>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  <div className="col-span-2">
                    <Input
                      placeholder="Label (e.g. BRIX)"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      className="h-9 text-xs font-bold uppercase bg-background"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSpec()}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      placeholder="Value (e.g. 66.0±1°Brix)"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="h-9 text-xs bg-background"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSpec()}
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-9 flex-1 text-[10px] font-bold uppercase" onClick={handleAddSpec}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-9 px-2.5" onClick={() => { setShowAddForm(false); setNewLabel(""); setNewValue(""); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Spec Rows */}
            {specs.length === 0 && !showAddForm ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-2xl bg-accent/5">
                <ClipboardList className="h-10 w-10 text-muted-foreground/20 mb-4" />
                <p className="font-black uppercase text-[10px] tracking-[0.3em] text-muted-foreground/50 mb-2">No Specifications</p>
                <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest mb-4">Click "Add Spec" to start building</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[10px] font-bold uppercase tracking-widest gap-1.5"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add First Specification
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-border overflow-hidden bg-card">
                {/* Table Header */}
                <div className="grid grid-cols-12 bg-muted/40 border-b border-border px-4 py-2.5">
                  <div className="col-span-1"></div>
                  <div className="col-span-4">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Label</span>
                  </div>
                  <div className="col-span-6">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Value</span>
                  </div>
                  <div className="col-span-1"></div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-border/50">
                  {specs.map((spec, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "group grid grid-cols-12 items-center px-4 py-0 transition-colors",
                        editingIdx === idx ? "bg-primary/[0.03]" : "hover:bg-muted/20"
                      )}
                    >
                      {/* Drag Handle / Index */}
                      <div className="col-span-1 flex items-center gap-1">
                        <div className="flex flex-col">
                          <button
                            className="h-3 w-5 flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                            onClick={() => moveSpec(idx, -1)}
                            disabled={idx === 0}
                          >
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor"><path d="M5 0L10 6H0z"/></svg>
                          </button>
                          <button
                            className="h-3 w-5 flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                            onClick={() => moveSpec(idx, 1)}
                            disabled={idx === specs.length - 1}
                          >
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor"><path d="M5 6L0 0h10z"/></svg>
                          </button>
                        </div>
                      </div>

                      {editingIdx === idx ? (
                        <>
                          <div className="col-span-4 py-2 pr-2">
                            <Input
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              className="h-8 text-xs font-bold uppercase bg-background"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
                            />
                          </div>
                          <div className="col-span-6 py-2 pr-2">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-8 text-xs bg-background"
                              onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
                            />
                          </div>
                          <div className="col-span-1 flex items-center justify-end gap-0.5">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10" onClick={confirmEdit}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={cancelEdit}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="col-span-4 py-3 pr-4">
                            <span className="text-xs font-black uppercase tracking-wider text-foreground/80">{spec.label}</span>
                          </div>
                          <div className="col-span-6 py-3">
                            <span className="text-xs text-foreground/90 leading-relaxed">{spec.value || <span className="text-muted-foreground/40 italic">—</span>}</span>
                          </div>
                          <div className="col-span-1 flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg" onClick={() => startEdit(idx)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => handleDeleteSpec(idx)}>
                              <Trash className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Notes */}
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b border-border">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Notes & Declarations</span>
              </div>
              <div className="p-4">
                <Textarea
                  placeholder="Add compliance notes, declarations, certifications..."
                  value={specsNotes}
                  onChange={(e) => setSpecsNotes(e.target.value)}
                  className="min-h-[300px] text-xs leading-relaxed bg-transparent border-none shadow-none resize-none focus-visible:ring-0 p-0"
                />
              </div>
            </div>

            {/* Quick Add Common Specs */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b border-border">
                <Plus className="h-3.5 w-3.5 text-primary" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Quick Add</span>
              </div>
              <div className="p-3 flex flex-wrap gap-1.5">
                {[
                  "PRODUCT", "BRIX", "BRIX: Acid Ratio", "COLOR", "FLAVOR",
                  "ABSENCE OF DEFECTS", "FREE AND SUSPENDED PULP", "FOREIGN MATERIAL",
                  "MICROBIOLOGICAL", "CONTAINER SIZE", "NET WEIGHT", "SHELF LIFE",
                  "STORAGE CONDITIONS", "ORIGIN", "CERTIFICATIONS"
                ].filter(label => !specs.some(s => s.label.toUpperCase() === label.toUpperCase()))
                .map(label => (
                  <button
                    key={label}
                    className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary border border-border/50 hover:border-primary/20 transition-all"
                    onClick={() => {
                      setSpecs(prev => [...prev, { label, value: "" }]);
                      // Auto-start editing the new item
                      setTimeout(() => {
                        setEditingIdx(specs.length);
                        setEditLabel(label);
                        setEditValue("");
                      }, 50);
                    }}
                  >
                    + {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
