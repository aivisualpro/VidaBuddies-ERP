"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, X, Save, FileType, Calendar, Clock, CheckCircle, AlertTriangle, ExternalLink, Loader2, Paperclip, MessageSquare } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const REQUIRED_DOCS = [
  { category: "Company & Legal Documentation", name: "Product Liability Insurance Certificate" },
  { category: "Company & Legal Documentation", name: "Letter of Continuing Guarantee / Food Safety Commitment" },
  { category: "Company & Legal Documentation", name: "Ethical Code / Code of Conduct Policy" },
  { category: "Company & Legal Documentation", name: "Supplier & Manufacturing Questionnaire" },
  { category: "Food Safety Certifications", name: "BRCGS Food Safety Certificate & Audit Report" },
  { category: "Food Safety Certifications", name: "IFS Food Certificate & Audit Report" },
  { category: "Food Safety Certifications", name: "Organic Certification (if applicable)" },
  { category: "Product Technical Documents", name: "Product Specification Sheet" },
  { category: "Product Technical Documents", name: "Ingredient Statement" },
  { category: "Product Technical Documents", name: "Allergen Declaration" },
  { category: "Product Technical Documents", name: "5-Log Reduction / Pasteurization Validation" },
  { category: "Product Technical Documents", name: "Nutritional Information" },
  { category: "Quality & HACCP Documentation", name: "HACCP Plan - Juice Extraction & Concentration" },
  { category: "Quality & HACCP Documentation", name: "HACCP Plan - Fruit / Grape Processing" },
  { category: "Quality & HACCP Documentation", name: "Allergen & Cross-Contamination Program" },
  { category: "Quality & HACCP Documentation", name: "Quality Risk Assessment / Food Defense Plan" },
  { category: "Packaging & Material Compliance", name: "Food Contact Compliance Declaration" },
  { category: "Packaging & Material Compliance", name: "Packaging Migration Test Report" },
  { category: "Packaging & Material Compliance", name: "Aseptic Bag Specification" },
  { category: "Packaging & Material Compliance", name: "Drum / Packaging Stacking Compliance" },
  { category: "Regulatory & Safety Documentation", name: "Safety Data Sheet (SDS / MSDS)" },
  { category: "Regulatory & Safety Documentation", name: "Proposition 65 Statement (if applicable)" },
  { category: "Regulatory & Safety Documentation", name: "FDA / EU Food Compliance Statement" },
  { category: "Regulatory & Safety Documentation", name: "Non-GMO Declaration" },
  { category: "Logistics & Traceability", name: "Batch Coding & Labeling Example" },
  { category: "Logistics & Traceability", name: "Shipping & Transport Compliance Documents" },
  { category: "Food Safety Certifications", name: "FSSC 22000 Food Safety Certification Audit Report" },
  { category: "Food Safety Certifications", name: "SMETA / SEDEX Ethical Trade Audit Report" },
  { category: "Food Safety Certifications", name: "EU Organic Certification" },
  { category: "Food Safety Certifications", name: "USDA NOP Organic Certification" },
  { category: "Quality & HACCP Documentation", name: "OPRP Monitoring / Hazard Control Plan" },
  { category: "Quality & HACCP Documentation", name: "Food Allergen Control Program" },
  { category: "Regulatory & Safety Documentation", name: "Insurance Policy - Fire & Special Perils" },
  { category: "Regulatory & Safety Documentation", name: "US FDA Food Facility Registration" },
  { category: "Regulatory & Safety Documentation", name: "Kosher Certification" },
  { category: "Regulatory & Safety Documentation", name: "Halal Certification" },
  { category: "Regulatory & Safety Documentation", name: "SGF / IRMA Participation Confirmation" },
  { category: "Food Safety Certifications", name: "FSSC 22000 Certificate (Valid to 2027)" },
  { category: "Quality & HACCP Documentation", name: "HACCP CCP Plan Sheet" },
  { category: "Quality & HACCP Documentation", name: "Batch Coding Procedure" }
];

interface LogEntry {
  action: string;
  by: string;
  date: string;
}

interface DocumentData {
  name: string;
  fileId?: string;
  fileLink?: string;
  expiryDate?: string;
  supplierNotes?: string;
  adminNotes?: string;
  isVerified?: boolean;
  logs?: LogEntry[];
}

export function SupplierDocumentsGrid({ supplierId, isSupplierView = false }: { supplierId: string, isSupplierView?: boolean }) {
  const [docStates, setDocStates] = useState<Record<string, DocumentData>>({});
  const savedStates = useRef<Record<string, DocumentData>>({});
  const { setLeftContent } = useHeaderActions();
  const [supplierName, setSupplierName] = useState<string>("");
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const [activeLogs, setActiveLogs] = useState<LogEntry[]>([]);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [activeDocName, setActiveDocName] = useState("");
  const [activeFileLink, setActiveFileLink] = useState<string | undefined>(undefined);
  const [activeLogType, setActiveLogType] = useState<'attachments' | 'notes'>('attachments');

  const loadDocuments = async () => {
    try {
      const response = await fetch(`/api/admin/suppliers/${supplierId}`);
      if (response.ok) {
        const data = await response.json();
        setSupplierName(data.name || "");
        
        const statesMap: Record<string, DocumentData> = {};
        if (data.documents) {
          data.documents.forEach((d: any) => {
            // Need to cleanly format the date for input typical YYYY-MM-DD
            if (d.expiryDate) {
              d.expiryDate = new Date(d.expiryDate).toISOString().split('T')[0];
            }
            statesMap[d.name] = d;
          });
        }
        setDocStates(statesMap);
        savedStates.current = JSON.parse(JSON.stringify(statesMap));
      }
    } catch (error) {
      console.error("Failed to fetch supplier details:", error);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [supplierId]);

  useEffect(() => {
    if (supplierName) {
      setLeftContent(
        <h1 className="text-xl font-black tracking-tight uppercase bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
          {supplierName} <span className="text-primary/40">/ DOCUMENTS</span>
        </h1>
      );
    }
  }, [supplierName, setLeftContent]);

  const updateDocumentData = async (docName: string, updates: Partial<DocumentData>, logAction?: string) => {
    // Optimistic update
    setDocStates(prev => ({
      ...prev,
      [docName]: {
        ...(prev[docName] || { name: docName }),
        ...updates
      }
    }));

    try {
      const payload = { docName, logAction, ...updates };
      const response = await fetch(`/api/admin/suppliers/${supplierId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) throw new Error("Update failed");
      const updatedDocs = await response.json();
      
      const statesMap: Record<string, DocumentData> = {};
      updatedDocs.forEach((d: any) => {
        if (d.expiryDate) d.expiryDate = new Date(d.expiryDate).toISOString().split('T')[0];
        statesMap[d.name] = d;
      });
      setDocStates(statesMap);
      
    } catch (error) {
      toast.error("Failed to save changes");
      loadDocuments(); // Revert on failure
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(docName);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("docName", docName);

    try {
      const response = await fetch(`/api/admin/suppliers/${supplierId}/documents/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      
      const updatedDocs = await response.json();
      const statesMap: Record<string, DocumentData> = {};
      updatedDocs.forEach((d: any) => {
        if (d.expiryDate) d.expiryDate = new Date(d.expiryDate).toISOString().split('T')[0];
        statesMap[d.name] = d;
      });
      setDocStates(statesMap);
      toast.success("Document uploaded successfully!");
    } catch (error) {
      toast.error("File upload failed.");
    } finally {
      setUploadingDoc(null);
      if (fileInputRefs.current[docName]) {
        fileInputRefs.current[docName]!.value = ''; // Reset input
      }
    }
  };

  const verifyDoc = (docName: string) => {
    updateDocumentData(docName, { isVerified: true }, "Marked as Verified");
    toast.success("Document verified!");
  };

  const getStatus = (docData?: DocumentData) => {
    if (!docData || !docData.fileId) return { label: "NO", color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/20" };
    if (docData.isVerified) return { label: "VERIFIED", color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" };
    
    if (docData.expiryDate) {
      const expDate = new Date(docData.expiryDate);
      const today = new Date();
      if (expDate < today) {
        return { label: "EXPIRED", color: "text-red-500", bg: "bg-red-500/10 border-red-500/20" };
      }
    }
    return { label: "YES", color: "text-green-500", bg: "bg-green-500/10 border-green-500/20" };
  };

  const openLogs = (docName: string, logs?: LogEntry[], fileLink?: string, type: 'attachments' | 'notes' = 'attachments') => {
    setActiveDocName(docName);
    setActiveFileLink(fileLink);
    setActiveLogType(type);
    const allLogs = logs ? [...logs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];
    if (type === 'attachments') {
      setActiveLogs(allLogs.filter(l => l.action.startsWith('Uploaded') || l.action.startsWith('Marked as Verified')));
    } else {
      setActiveLogs(allLogs.filter(l => l.action.includes('Notes') || l.action.includes('Expiry')));
    }
    setIsLogsOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black tracking-tight uppercase">Document Submission Form</h2>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto shadow-sm pb-8">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/40 uppercase text-[10px] font-black tracking-widest text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3 min-w-[200px]">Category</th>
              <th className="px-4 py-3 min-w-[300px]">Document Name</th>
              <th className="px-4 py-3 min-w-[120px]">Status</th>
              <th className="px-4 py-3 min-w-[150px]">Expiry Date</th>
              <th className="px-4 py-3 min-w-[250px]">Notes</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {REQUIRED_DOCS.map((doc, i) => {
              const state = docStates[doc.name] || { name: doc.name };
              const statusInfo = getStatus(state);
              
              return (
                <tr key={i} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-2 text-[11px] font-bold text-muted-foreground uppercase">{doc.category}</td>
                  <td className="px-4 py-2 font-medium text-foreground">
                    {state.fileLink ? (
                      <a href={state.fileLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        {doc.name}
                      </a>
                    ) : (
                      doc.name
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className={`inline-flex px-2 py-1 rounded-md border text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${statusInfo.bg} ${statusInfo.color}`}>
                      {statusInfo.label}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="relative">
                      <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="date"
                        className="h-9 pl-8 text-xs bg-foreground/5 border-transparent focus-visible:ring-1"
                        value={state.expiryDate || ""}
                        onChange={(e) => setDocStates(p => ({ ...p, [doc.name]: { ...state, expiryDate: e.target.value } }))}
                        onBlur={() => {
                          const saved = savedStates.current[doc.name];
                          if ((state.expiryDate || "") !== (saved?.expiryDate || "")) {
                            savedStates.current[doc.name] = { ...savedStates.current[doc.name], expiryDate: state.expiryDate };
                            updateDocumentData(doc.name, { expiryDate: state.expiryDate }, `Updated Expiry Date: ${state.expiryDate || 'Cleared'}`);
                          }
                        }}
                        disabled={!isSupplierView && !!state.isVerified}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="space-y-1">
                      <Input
                        placeholder="Supplier Note..."
                        className={`h-8 text-[11px] font-medium border-transparent focus-visible:ring-1 placeholder:uppercase placeholder:tracking-widest placeholder:text-[9px] ${isSupplierView ? 'bg-foreground/5' : 'bg-transparent border-b-border rounded-none'}`}
                        value={state.supplierNotes || ""}
                        onChange={(e) => setDocStates(p => ({ ...p, [doc.name]: { ...state, supplierNotes: e.target.value } }))}
                        onBlur={() => {
                          const saved = savedStates.current[doc.name];
                          if ((state.supplierNotes || "") !== (saved?.supplierNotes || "")) {
                            savedStates.current[doc.name] = { ...savedStates.current[doc.name], supplierNotes: state.supplierNotes };
                            updateDocumentData(doc.name, { supplierNotes: state.supplierNotes }, "Updated Supplier Notes");
                          }
                        }}
                        disabled={!isSupplierView}
                      />
                      <Input
                        placeholder="Admin Note..."
                        className={`h-8 text-[11px] font-medium border-transparent focus-visible:ring-1 placeholder:uppercase placeholder:tracking-widest placeholder:text-[9px] ${!isSupplierView ? 'bg-primary/5 text-primary' : 'bg-transparent border-b-border rounded-none'}`}
                        value={state.adminNotes || ""}
                        onChange={(e) => setDocStates(p => ({ ...p, [doc.name]: { ...state, adminNotes: e.target.value } }))}
                        onBlur={() => {
                          const saved = savedStates.current[doc.name];
                          if ((state.adminNotes || "") !== (saved?.adminNotes || "")) {
                            savedStates.current[doc.name] = { ...savedStates.current[doc.name], adminNotes: state.adminNotes };
                            updateDocumentData(doc.name, { adminNotes: state.adminNotes }, "Updated Admin Notes");
                          }
                        }}
                        disabled={isSupplierView}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Attachment History" onClick={() => openLogs(doc.name, state.logs, state.fileLink, 'attachments')}>
                         <Paperclip className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Notes History" onClick={() => openLogs(doc.name, state.logs, state.fileLink, 'notes')}>
                         <MessageSquare className="h-3.5 w-3.5" />
                      </Button>

                      {isSupplierView ? (
                        <>
                          <input 
                            type="file" 
                            className="hidden" 
                            ref={el => { fileInputRefs.current[doc.name] = el; }}
                            onChange={(e) => handleFileUpload(e, doc.name)}
                          />
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-primary hover:text-primary-foreground border-primary/20"
                            onClick={() => fileInputRefs.current[doc.name]?.click()}
                            disabled={uploadingDoc === doc.name}
                          >
                            {uploadingDoc === doc.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          </Button>
                        </>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-[10px] uppercase font-bold tracking-widest text-muted-foreground hover:text-blue-500"
                          onClick={() => verifyDoc(doc.name)}
                          disabled={!state.fileId || !!state.isVerified}
                        >
                          Verify
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={isLogsOpen} onOpenChange={setIsLogsOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl border-primary/20 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">
              {activeLogType === 'attachments' ? 'Attachment History' : 'Notes History'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-[10px] tracking-widest font-bold uppercase pt-1">
              {activeDocName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 mt-4 inline-flex flex-col w-full text-sm">
            {activeLogs.length > 0 ? (
              activeLogs.map((log, i) => (
                <div key={i} className="flex flex-col gap-1 border-b border-border/50 pb-3 last:border-0">
                  {log.action.startsWith('Uploaded') && activeFileLink ? (
                    <a href={activeFileLink} target="_blank" rel="noopener noreferrer" className="font-bold text-xs uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      {log.action}
                    </a>
                  ) : (
                    <span className="font-bold text-xs uppercase tracking-widest">{log.action}</span>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                    <span>By: <span className="text-primary">{log.by}</span></span>
                    <span>{new Date(log.date).toLocaleString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 border border-dashed rounded-xl bg-accent/5 font-black uppercase text-[10px] tracking-widest text-muted-foreground/50">
                No activity logged yet
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
