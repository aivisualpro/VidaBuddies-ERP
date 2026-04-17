"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Save, Send, Download, CheckCircle,
  FileText, Building2, ClipboardCheck, Shield, Package, Leaf, Loader2, Share2, Plus, X, Mail
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// templateId is now a prop

const ICON_MAP: Record<string, any> = {
  Building2, ClipboardCheck, Shield, FileText, Leaf, Package,
};

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

interface TemplateData {
  templateId: string;
  name: string;
  docNo: string;
  revNo: string;
  pages: SurveyPage[];
}

function RadioGroup({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => onChange(opt)} className="flex items-center gap-2 cursor-pointer text-sm font-medium">
          <div className={`h-[18px] w-[18px] rounded-full border-2 flex items-center justify-center transition-colors ${value === opt ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`}>
            {value === opt && <div className="h-2 w-2 rounded-full bg-white" />}
          </div>
          {opt}
        </button>
      ))}
    </div>
  );
}

function CheckItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-start gap-3 cursor-pointer group py-1.5 text-left w-full">
      <div className={`h-[18px] w-[18px] rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${checked ? 'border-primary bg-primary' : 'border-muted-foreground/30 group-hover:border-primary/50'}`}>
        {checked && <CheckCircle className="h-3 w-3 text-white" />}
      </div>
      <span className="text-sm font-medium leading-tight">{label}</span>
    </button>
  );
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="border-b border-border pb-2 mb-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-foreground">{children}</h3>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function FieldRow({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

// Render a single field based on its type
function DynamicField({ field, value, onChange }: { field: SurveyField; value: any; onChange: (v: any) => void }) {
  switch (field.type) {
    case 'text':
      return (
        <FieldRow label={field.label} required={field.required}>
          <Input
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            disabled={field.disabled}
            placeholder={field.placeholder}
            className={`h-10 ${field.disabled ? 'bg-muted/30 border-transparent opacity-70' : 'bg-foreground/5 border-transparent focus-visible:ring-1'}`}
          />
          {field.helpText && <p className="text-[10px] text-muted-foreground mt-0.5">{field.helpText}</p>}
        </FieldRow>
      );

    case 'textarea':
      return (
        <FieldRow label={field.label} required={field.required}>
          <Textarea
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="bg-foreground/5 border-transparent focus-visible:ring-1 min-h-[60px]"
          />
        </FieldRow>
      );

    case 'date':
      return (
        <FieldRow label={field.label} required={field.required}>
          <Input
            type="date"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            className="h-10 bg-foreground/5 border-transparent focus-visible:ring-1"
          />
        </FieldRow>
      );

    case 'radio':
      return (
        <div className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-sm font-bold">{field.label}</p>
          {field.helpText && <p className="text-xs text-muted-foreground leading-relaxed">{field.helpText}</p>}
          <RadioGroup value={value || ''} onChange={onChange} options={field.options || ['Yes', 'No']} />
        </div>
      );

    case 'checklist':
      return (
        <div className="rounded-xl border border-border p-4 space-y-1">
          {(field.options || []).map((item, i) => (
            <CheckItem
              key={i}
              label={item}
              checked={!!(value && value[i])}
              onChange={v => {
                const newVal = { ...(value || {}) };
                newVal[i] = v;
                onChange(newVal);
              }}
            />
          ))}
        </div>
      );

    default:
      return null;
  }
}

export function SupplierSurvey({ supplierId, isSupplierView = false, templateId = "qfs-manufacturing-survey", tabLabel = "Q&F SAFETY SURVEY" }: { supplierId: string; isSupplierView?: boolean; templateId?: string; tabLabel?: string }) {
  const { setLeftContent } = useHeaderActions();
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<TemplateData | null>(null);

  const [supplierEmails, setSupplierEmails] = useState<string[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [customEmail, setCustomEmail] = useState("");
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  const set = (key: string, val: any) => setAnswers(p => ({ ...p, [key]: val }));
  const get = (key: string, fallback: any = '') => answers[key] ?? fallback;

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch template
        const tplRes = await fetch(`/api/admin/templates/${templateId}`);
        if (tplRes.ok) {
          setTemplate(await tplRes.json());
        } else {
          // Seed and retry if not found
          await fetch("/api/admin/templates/seed", { method: "POST" });
          const tplRes2 = await fetch(`/api/admin/templates/${templateId}`);
          if (tplRes2.ok) setTemplate(await tplRes2.json());
        }

        // Fetch supplier data
        const res = await fetch(`/api/admin/suppliers/${supplierId}/survey`);
        if (res.ok) {
          const data = await res.json();
          setSupplierName(data.name || '');

          const commEmail = data.communicationEmail || '';
          const ctcEmails = (data.contacts || []).flatMap((c: any) => c.emails || []);
          const allSuppEmails = Array.from(new Set([commEmail, ...ctcEmails].filter(Boolean)));
          setSupplierEmails(allSuppEmails);

          const today = new Date().toISOString().split('T')[0];
          const prefill: Record<string, any> = {
            companyName: data.name || '',
            ss_companyName: data.name || '',
            address: data.manufacturingAddress || '',
            ss_address: data.manufacturingAddress || '',
            country: data.country || '',
            ss_country: data.country || '',
            contactName: data.primaryContactName || '',
            email: data.communicationEmail || '',
            phone: data.phone || '',
            surveyDate: today,
            ss_date: today,
            auth_date: today,
            ss_auth_date: today,
          };
          if (data.surveyResponses?.length) {
            const existing = data.surveyResponses.find((r: any) => r.templateId === templateId);
            if (existing) {
              setAnswers({ ...prefill, ...existing.answers });
              if (existing.status === 'submitted') setSubmitted(true);
            } else {
              setAnswers(prefill);
            }
          } else {
            setAnswers(prefill);
          }
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [supplierId]);

  useEffect(() => {
    setLeftContent(
      <h1 className="text-xl font-black tracking-tight uppercase bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
        <span className="hidden md:inline">{supplierName} <span className="text-primary/40">/</span></span> <span className="text-primary/40 md:text-primary/40">{tabLabel}</span>
      </h1>
    );
  }, [supplierName, setLeftContent]);

  const saveDraft = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}/survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: templateId, answers, status: 'draft' }),
      });
      if (res.ok) toast.success("Draft saved!");
    } catch { toast.error("Failed to save draft."); }
    finally { setSaving(false); }
  };

  const submitSurvey = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}/survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: templateId, answers, status: 'submitted' }),
      });
      if (res.ok) {
        setSubmitted(true);
        toast.success("Survey submitted successfully!");
      }
    } catch { toast.error("Failed to submit."); }
    finally { setSubmitting(false); }
  };

  const shareSurvey = async () => {
    if (selectedEmails.length === 0) {
      toast.error("Please select at least one email or add a custom one");
      return;
    }
    setSharing(true);
    try {
      const routePath = templateId === 'qfs-manufacturing-survey' ? 'survey' : 'supply-survey';
      const link = `${window.location.origin}/share/${routePath}/${supplierId}`;
      const emailBody = `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #0ea5e9;">${template?.name}</h2>
          <p>Hello,</p>
          <p>Please click the button below to complete the <strong>${template?.name}</strong>.</p>
          <div style="margin: 30px 0;">
            <a href="${link}" style="background-color: #0ea5e9; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Open Survey Form
            </a>
          </div>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p><a href="${link}">${link}</a></p>
          <p>Thank you!</p>
        </div>
      `;

      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedEmails.join(","),
          subject: `Action Required: ${template?.name}`,
          body: emailBody
        }),
      });

      if (res.ok) {
        toast.success("Survey link shared successfully!");
        setIsShareOpen(false);
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to send email");
      }
    } catch (e) {
      toast.error("Error sending email");
    } finally {
      setSharing(false);
    }
  };

  if (loading || !template) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const TOTAL_PAGES = template.pages.length;
  const progress = Math.round(((page + 1) / TOTAL_PAGES) * 100);
  const currentPage = template.pages[page];

  return (
    <div className="w-full h-[calc(100vh-160px)] min-h-[500px] flex flex-col">
      <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col flex-1">
        {/* Header */}
        <div className="bg-muted/50 px-4 md:px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-tight">{template.name}</h2>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Doc. No.: {template.docNo} | Rev {template.revNo}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isSupplierView && (
                <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest gap-1.5 border-primary/20 text-primary hover:bg-primary/10">
                      <Share2 className="h-3.5 w-3.5" /> Share Form
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-black uppercase tracking-tight text-primary flex items-center gap-2">
                        <Share2 className="h-5 w-5" /> Share Survey
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <p className="text-xs text-muted-foreground">Select supplier contacts to send a direct link to fill out this survey.</p>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Selected Recipients</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {selectedEmails.length === 0 && <span className="text-xs text-muted-foreground italic">No emails selected</span>}
                          {selectedEmails.map(email => (
                            <div key={email} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                              {email}
                              <button onClick={() => setSelectedEmails(p => p.filter(e => e !== email))} className="hover:text-destructive">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {supplierEmails.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Supplier Contacts</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto pr-2">
                            {supplierEmails.map(email => (
                              <label key={email} className="flex items-center gap-2 text-sm p-1.5 hover:bg-muted/50 rounded-md cursor-pointer border border-transparent hover:border-border transition-colors">
                                <input 
                                  type="checkbox" 
                                  className="rounded border-primary/50 text-primary focus:ring-primary h-4 w-4"
                                  checked={selectedEmails.includes(email)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedEmails(p => [...p, email]);
                                    else setSelectedEmails(p => p.filter(x => x !== email));
                                  }}
                                />
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="font-medium text-foreground">{email}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Add Custom Email</label>
                        <div className="flex gap-2">
                          <Input 
                            type="email" 
                            value={customEmail} 
                            onChange={e => setCustomEmail(e.target.value)} 
                            placeholder="Enter email address" 
                            className="h-9 text-xs flex-1"
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (customEmail.includes('@') && !selectedEmails.includes(customEmail)) {
                                  setSelectedEmails(p => [...p, customEmail]);
                                  setCustomEmail("");
                                }
                              }
                            }}
                          />
                          <Button 
                            type="button" 
                            variant="outline" 
                            className="h-9 px-3" 
                            onClick={() => {
                              if (customEmail.includes('@') && !selectedEmails.includes(customEmail)) {
                                setSelectedEmails(p => [...p, customEmail]);
                                setCustomEmail("");
                              }
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <Button className="w-full h-10 mt-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20" onClick={shareSurvey} disabled={sharing || selectedEmails.length === 0}>
                        {sharing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                        {sharing ? 'Sending Email...' : 'Send Survey Link'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {submitted && (
                <>
                  <div className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-full ml-1">
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Submitted</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-bold uppercase tracking-widest gap-1.5 border-primary/20 hover:bg-primary hover:text-primary-foreground"
                    onClick={() => window.open(`/api/admin/suppliers/${supplierId}/survey/pdf?templateId=${templateId}`, '_blank')}
                  >
                    <Download className="h-3.5 w-3.5" /> Download PDF
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Page Navigation */}
        <div className="px-4 md:px-6 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {template.pages.map((p, i) => {
              const Icon = ICON_MAP[p.icon] || FileText;
              return (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                    page === i
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span className="hidden md:inline">{p.title}</span>
                  <span className="md:hidden">{i + 1}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">
              <span>Page {page + 1} of {TOTAL_PAGES}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </div>

        {/* Dynamic Page Content */}
        <div className="px-4 md:px-6 py-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
          {currentPage.sections.map((section, si) => (
            <div key={si} className="space-y-4">
              <SectionTitle sub={section.subtitle}>{section.title}</SectionTitle>
              {section.description && (
                <p className="text-xs text-muted-foreground leading-relaxed -mt-2 mb-4">{section.description}</p>
              )}

              {section.highlight ? (
                <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 space-y-4">
                  <p className="text-xs font-bold text-primary uppercase tracking-widest">Authorized person filling out this form</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {section.fields.filter(f => f.key !== 'supplierId').map((field, fi) => (
                      <DynamicField key={fi} field={field} value={get(field.key)} onChange={v => set(field.key, v)} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className={section.fields.some(f => f.type === 'text' || f.type === 'date') && !section.fields.some(f => f.type === 'checklist') ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-3"}>
                  {section.fields.filter(f => f.key !== 'supplierId').map((field, fi) => (
                    <DynamicField key={fi} field={field} value={get(field.key)} onChange={v => set(field.key, v)} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Navigation */}
        <div className="px-4 md:px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between gap-3 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs font-bold uppercase tracking-widest gap-1.5"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>

          <div className="flex items-center gap-2">
            {submitted && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs font-bold uppercase tracking-widest gap-1.5 border-green-500/30 text-green-600 hover:bg-green-500/10"
                onClick={() => window.open(`/api/admin/suppliers/${supplierId}/survey/pdf?templateId=${templateId}`, '_blank')}
              >
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
            )}

            {!submitted && isSupplierView && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs font-bold uppercase tracking-widest gap-1.5 border-primary/20 hover:bg-primary/10"
                onClick={saveDraft}
                disabled={saving}
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save Draft'}
              </Button>
            )}

            {page === TOTAL_PAGES - 1 && !submitted && isSupplierView ? (
              <Button
                size="sm"
                className="h-9 text-xs font-bold uppercase tracking-widest gap-1.5 shadow-lg shadow-primary/20"
                onClick={submitSurvey}
                disabled={submitting}
              >
                <Send className="h-3.5 w-3.5" />
                {submitting ? 'Submitting...' : 'Submit Survey'}
              </Button>
            ) : page < TOTAL_PAGES - 1 ? (
              <Button
                size="sm"
                className="h-9 text-xs font-bold uppercase tracking-widest gap-1.5"
                onClick={() => setPage(p => Math.min(TOTAL_PAGES - 1, p + 1))}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
