"use client";

import React, { useState, useEffect } from "react";
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
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

const TYPE_OPTIONS = ["Notes", "Shipping", "Action Required"];

const CATEGORY_OPTIONS = [
  "Arrival Notice", "Trucker Notified Date", "Supplier Invoice", "Packing List",
  "Certificate Of Origin", "Bill Of Lading", "Drayage Assigned",
  "Certificate Of Analysis", "Customs Status", "Manufacturer Security ISF",
  "VB ISF Filing", "Documents To Broker", "Delivery Order Created",
  "Genset Required", "Collect Fees Paid",
];

export interface TimelineEntryData {
  _id?: string;
  type: string;
  category?: string;
  comments?: string;
  date?: string;
  reminder?: string;
  status?: string;
  VBNumber?: string;
  VBSerialNumber?: string;
  VBShipmentNumber?: string;
}

interface TimelineEntryDialogProps {
  open: boolean;
  onClose: () => void;
  /** If provided, we are editing. Otherwise creating. */
  entry?: TimelineEntryData | null;
  /** Required for create mode — these IDs are attached to the new entry. */
  parentIds?: {
    VBNumber?: string;
    VBSerialNumber?: string;
    VBShipmentNumber?: string;
  };
  onSaved: () => void;
  /** If provided, show delete button. */
  onDelete?: (id: string) => void;
}

export function TimelineEntryDialog({
  open,
  onClose,
  entry,
  parentIds,
  onSaved,
  onDelete,
}: TimelineEntryDialogProps) {
  const isEdit = !!entry?._id;

  const [formType, setFormType] = useState("Notes");
  const [formCategory, setFormCategory] = useState("");
  const [formComments, setFormComments] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formReminder, setFormReminder] = useState("");
  const [formStatus, setFormStatus] = useState("Open");
  const [saving, setSaving] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomCategory, setShowCustomCategory] = useState(false);

  useEffect(() => {
    if (open && entry) {
      setFormType(entry.type || "Notes");
      setFormCategory(entry.category || "");
      setFormComments(entry.comments || "");
      setFormDate(entry.date ? new Date(entry.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
      setFormReminder(entry.reminder ? new Date(entry.reminder).toISOString().split("T")[0] : "");
      setFormStatus(entry.status || "Open");
      setShowCustomCategory(false);
      setCustomCategory("");
    } else if (open && !entry) {
      // Reset for create mode
      setFormType("Notes");
      setFormCategory("");
      setFormComments("");
      setFormDate(new Date().toISOString().split("T")[0]);
      setFormReminder("");
      setFormStatus("Open");
      setShowCustomCategory(false);
      setCustomCategory("");
    }
  }, [open, entry]);

  const resolvedCategory = showCustomCategory ? customCategory : formCategory;

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        type: formType,
        category: resolvedCategory,
        comments: formComments,
        date: formDate || undefined,
        reminder: formReminder || undefined,
        status: formStatus,
      };

      if (isEdit) {
        // Update
        const res = await fetch(`/api/admin/timeline/${entry!._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        toast.success("Entry updated");
      } else {
        // Create
        if (parentIds?.VBNumber) body.VBNumber = parentIds.VBNumber;
        if (parentIds?.VBSerialNumber) body.VBSerialNumber = parentIds.VBSerialNumber;
        if (parentIds?.VBShipmentNumber) body.VBShipmentNumber = parentIds.VBShipmentNumber;
        const res = await fetch("/api/admin/timeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        toast.success("Entry added");
      }

      onSaved();
      onClose();
    } catch {
      toast.error(isEdit ? "Failed to update" : "Failed to add entry");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!entry?._id || !onDelete) return;
    if (!confirm("Delete this timeline entry?")) return;
    onDelete(entry._id);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[700px] p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-sm flex items-center gap-2">
            {isEdit ? (
              <><Pencil className="h-4 w-4 text-primary" /> Edit Timeline Entry</>
            ) : (
              <><Plus className="h-4 w-4 text-primary" /> Add Timeline Entry</>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? "Modify the details of this timeline entry" : "Create a new timeline entry"}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4">
          <div className="grid grid-cols-2 gap-5">
            {/* Left column — Comments */}
            <div className="space-y-1 flex flex-col">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Comments</Label>
              <textarea
                value={formComments}
                onChange={(e) => setFormComments(e.target.value)}
                placeholder="Add details, notes, or context..."
                className="flex-1 min-h-[200px] w-full border rounded-md px-3 py-2 text-xs bg-background resize-y"
              />
            </div>

            {/* Right column — Fields */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Type</Label>
                <select value={formType} onChange={(e) => setFormType(e.target.value)} className="w-full h-8 border rounded-md px-2 text-xs bg-background">
                  {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category</Label>
                {showCustomCategory ? (
                  <div className="flex gap-1">
                    <Input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Custom category..." className="h-8 text-xs" />
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[10px]" onClick={() => { setShowCustomCategory(false); setCustomCategory(""); }}>✕</Button>
                  </div>
                ) : (
                  <select
                    value={formCategory}
                    onChange={(e) => { if (e.target.value === "__add_new__") { setShowCustomCategory(true); setFormCategory(""); } else { setFormCategory(e.target.value); } }}
                    className="w-full h-8 border rounded-md px-2 text-xs bg-background"
                  >
                    <option value="">Select...</option>
                    {formCategory && !CATEGORY_OPTIONS.includes(formCategory) && (
                      <option value={formCategory}>{formCategory}</option>
                    )}
                    {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="__add_new__">＋ Add New...</option>
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</Label>
                <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} className="w-full h-8 border rounded-md px-2 text-xs bg-background">
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</Label>
                  <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reminder</Label>
                  <Input type="date" value={formReminder} onChange={(e) => setFormReminder(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-5 pb-4 pt-2 border-t">
          <div className="flex w-full items-center justify-between">
            {isEdit && onDelete ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
              <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving || !formComments.trim()}>
                {saving ? "Saving..." : isEdit ? "Update" : "Add Entry"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
