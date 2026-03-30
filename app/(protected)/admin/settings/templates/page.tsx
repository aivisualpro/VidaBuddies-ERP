"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  FileText, CheckCircle, Clock, Plus, Trash2, Save, ChevronDown, ChevronRight,
  GripVertical, ArrowLeft, Loader2, X, Pencil, Settings2, Copy
} from "lucide-react";

interface SurveyField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'radio' | 'checklist';
  options?: string[];
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  helpText?: string;
  gridCols?: number;
}

interface SurveySection {
  title: string;
  subtitle?: string;
  description?: string;
  highlight?: boolean;
  fields: SurveyField[];
}

interface SurveyPage {
  title: string;
  icon: string;
  sections: SurveySection[];
}

interface Template {
  _id?: string;
  templateId: string;
  name: string;
  docNo: string;
  revNo: string;
  status: string;
  description: string;
  pages: SurveyPage[];
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text Input' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'date', label: 'Date Picker' },
  { value: 'radio', label: 'Radio (Yes/No)' },
  { value: 'checklist', label: 'Checklist' },
];

function FieldEditor({ field, onChange, onRemove }: { field: SurveyField; onChange: (f: SurveyField) => void; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [newOption, setNewOption] = useState("");

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold truncate block">{field.label || 'Untitled Field'}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest">{field.type} · {field.key}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {field.required && <span className="text-red-500 text-[9px] font-bold">REQ</span>}
          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500/50 hover:text-red-500 hover:bg-red-500/10" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
            <Trash2 className="h-3 w-3" />
          </Button>
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="p-3 space-y-3 border-t border-border">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Key</label>
              <Input value={field.key} onChange={e => onChange({ ...field, key: e.target.value })} className="h-8 text-xs bg-foreground/5 border-transparent" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Type</label>
              <select value={field.type} onChange={e => onChange({ ...field, type: e.target.value as any })} className="h-8 w-full rounded-md border border-border bg-foreground/5 px-2 text-xs">
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Label</label>
            <Input value={field.label} onChange={e => onChange({ ...field, label: e.target.value })} className="h-8 text-xs bg-foreground/5 border-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Placeholder</label>
              <Input value={field.placeholder || ''} onChange={e => onChange({ ...field, placeholder: e.target.value })} className="h-8 text-xs bg-foreground/5 border-transparent" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Help Text</label>
              <Input value={field.helpText || ''} onChange={e => onChange({ ...field, helpText: e.target.value })} className="h-8 text-xs bg-foreground/5 border-transparent" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!field.required} onChange={e => onChange({ ...field, required: e.target.checked })} className="rounded border-border" />
              <span className="text-xs font-medium">Required</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!field.disabled} onChange={e => onChange({ ...field, disabled: e.target.checked })} className="rounded border-border" />
              <span className="text-xs font-medium">Disabled</span>
            </label>
          </div>

          {(field.type === 'radio' || field.type === 'checklist') && (
            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Options</label>
              <div className="space-y-1">
                {(field.options || []).map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-1">
                    <Input
                      value={opt}
                      onChange={e => {
                        const newOpts = [...(field.options || [])];
                        newOpts[oi] = e.target.value;
                        onChange({ ...field, options: newOpts });
                      }}
                      className="h-7 text-xs bg-foreground/5 border-transparent flex-1"
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500/50 hover:text-red-500" onClick={() => {
                      const newOpts = (field.options || []).filter((_, i) => i !== oi);
                      onChange({ ...field, options: newOpts });
                    }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-1">
                <Input
                  placeholder="New option..."
                  value={newOption}
                  onChange={e => setNewOption(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newOption.trim()) {
                      onChange({ ...field, options: [...(field.options || []), newOption.trim()] });
                      setNewOption("");
                    }
                  }}
                  className="h-7 text-xs bg-foreground/5 border-transparent flex-1"
                />
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => {
                  if (newOption.trim()) {
                    onChange({ ...field, options: [...(field.options || []), newOption.trim()] });
                    setNewOption("");
                  }
                }}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionEditor({ section, onChange, onRemove }: { section: SurveySection; onChange: (s: SurveySection) => void; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const addField = () => {
    const key = `field_${Date.now()}`;
    onChange({
      ...section,
      fields: [...section.fields, { key, label: "New Field", type: "text", gridCols: 1 }],
    });
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-black uppercase tracking-widest truncate block">{section.title || 'Untitled Section'}</span>
          <span className="text-[9px] text-muted-foreground">{section.fields.length} fields</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500/50 hover:text-red-500 hover:bg-red-500/10" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
            <Trash2 className="h-3 w-3" />
          </Button>
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="p-3 space-y-3 border-t border-border">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Section Title</label>
              <Input value={section.title} onChange={e => onChange({ ...section, title: e.target.value })} className="h-8 text-xs bg-foreground/5 border-transparent" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Subtitle</label>
              <Input value={section.subtitle || ''} onChange={e => onChange({ ...section, subtitle: e.target.value })} className="h-8 text-xs bg-foreground/5 border-transparent" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Description</label>
            <Textarea value={section.description || ''} onChange={e => onChange({ ...section, description: e.target.value })} className="text-xs bg-foreground/5 border-transparent min-h-[50px]" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!section.highlight} onChange={e => onChange({ ...section, highlight: e.target.checked })} className="rounded border-border" />
            <span className="text-xs font-medium">Highlight Section (special styling)</span>
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Fields</span>
              <Button variant="outline" size="sm" className="h-6 text-[9px] font-bold uppercase tracking-widest gap-1" onClick={addField}>
                <Plus className="h-3 w-3" /> Add Field
              </Button>
            </div>
            {section.fields.map((field, fi) => (
              <FieldEditor
                key={fi}
                field={field}
                onChange={(f) => {
                  const newFields = [...section.fields];
                  newFields[fi] = f;
                  onChange({ ...section, fields: newFields });
                }}
                onRemove={() => onChange({ ...section, fields: section.fields.filter((_, i) => i !== fi) })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [activePage, setActivePage] = useState(0);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/admin/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        if (data.length === 0) {
          // Auto-seed if no templates
          await fetch("/api/admin/templates/seed", { method: "POST" });
          const res2 = await fetch("/api/admin/templates");
          if (res2.ok) setTemplates(await res2.json());
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const saveTemplate = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/templates/${editing.templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      if (res.ok) {
        toast.success("Template saved!");
        fetchTemplates();
      }
    } catch { toast.error("Failed to save template."); }
    finally { setSaving(false); }
  };

  const addPage = () => {
    if (!editing) return;
    setEditing({
      ...editing,
      pages: [...editing.pages, { title: "New Page", icon: "FileText", sections: [] }],
    });
    setActivePage(editing.pages.length);
  };

  const addSection = () => {
    if (!editing) return;
    const pages = [...editing.pages];
    pages[activePage] = {
      ...pages[activePage],
      sections: [...pages[activePage].sections, { title: "New Section", fields: [] }],
    };
    setEditing({ ...editing, pages });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // --- EDITOR VIEW ---
  if (editing) {
    const currentPage = editing.pages[activePage];

    return (
      <div className="space-y-4">
        {/* Editor Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight">Edit Template</h3>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">{editing.name}</p>
            </div>
          </div>
          <Button size="sm" className="h-8 text-xs font-bold uppercase tracking-widest gap-1.5" onClick={saveTemplate} disabled={saving}>
            <Save className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {/* Template Metadata */}
        <Card className="border-border">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Template Name</label>
                <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="h-9 text-sm bg-foreground/5 border-transparent" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Doc No.</label>
                  <Input value={editing.docNo} onChange={e => setEditing({ ...editing, docNo: e.target.value })} className="h-9 text-sm bg-foreground/5 border-transparent" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Rev No.</label>
                  <Input value={editing.revNo} onChange={e => setEditing({ ...editing, revNo: e.target.value })} className="h-9 text-sm bg-foreground/5 border-transparent" />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Description</label>
              <Textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} className="text-xs bg-foreground/5 border-transparent min-h-[60px]" />
            </div>
          </CardContent>
        </Card>

        {/* Page Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {editing.pages.map((p, pi) => (
            <button
              key={pi}
              onClick={() => setActivePage(pi)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                activePage === pi ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border'
              }`}
            >
              <FileText className="h-3 w-3" />
              {p.title}
            </button>
          ))}
          <button onClick={addPage} className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider text-primary border border-dashed border-primary/30 hover:bg-primary/5">
            <Plus className="h-3 w-3" /> Add Page
          </button>
        </div>

        {/* Page Editor */}
        {currentPage && (
          <Card className="border-border">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-2 gap-2 flex-1">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Page Title</label>
                    <Input
                      value={currentPage.title}
                      onChange={e => {
                        const pages = [...editing.pages];
                        pages[activePage] = { ...pages[activePage], title: e.target.value };
                        setEditing({ ...editing, pages });
                      }}
                      className="h-8 text-xs bg-foreground/5 border-transparent"
                    />
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 shrink-0 ml-2" onClick={() => {
                  if (editing.pages.length <= 1) return;
                  setEditing({ ...editing, pages: editing.pages.filter((_, i) => i !== activePage) });
                  setActivePage(Math.max(0, activePage - 1));
                }} title="Remove Page">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sections</span>
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold uppercase tracking-widest gap-1" onClick={addSection}>
                    <Plus className="h-3 w-3" /> Add Section
                  </Button>
                </div>
                {currentPage.sections.map((section, si) => (
                  <SectionEditor
                    key={si}
                    section={section}
                    onChange={(s) => {
                      const pages = [...editing.pages];
                      const sections = [...pages[activePage].sections];
                      sections[si] = s;
                      pages[activePage] = { ...pages[activePage], sections };
                      setEditing({ ...editing, pages });
                    }}
                    onRemove={() => {
                      const pages = [...editing.pages];
                      pages[activePage] = {
                        ...pages[activePage],
                        sections: pages[activePage].sections.filter((_, i) => i !== si),
                      };
                      setEditing({ ...editing, pages });
                    }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-black uppercase tracking-tight">Survey Templates</h3>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">
          Manage supplier survey forms and templates
        </p>
      </div>

      <div className="grid gap-4">
        {templates.map((template) => (
          <Card key={template.templateId} className="bg-card border-border hover:border-primary/30 transition-colors overflow-hidden cursor-pointer" onClick={() => { setEditing(template); setActivePage(0); }}>
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row">
                <div className="w-full md:w-20 bg-primary/5 flex items-center justify-center py-6 md:py-0 border-b md:border-b-0 md:border-r border-border">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1 p-4 md:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-tight text-foreground leading-tight flex items-center gap-2">
                        {template.name}
                        <Pencil className="h-3.5 w-3.5 text-primary/40" />
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{template.description}</p>
                    </div>
                    <Badge variant="secondary" className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 ${template.status === 'active' ? 'bg-green-600 text-white border-green-700' : 'bg-muted text-muted-foreground'}`}>
                      {template.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <span className="text-primary">#</span> {template.docNo}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <Clock className="h-3 w-3 text-primary" /> Rev {template.revNo}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <FileText className="h-3 w-3 text-primary" /> {template.pages.length} Pages
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
