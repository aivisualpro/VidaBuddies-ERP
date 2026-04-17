"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, X, Save, FileType, Calendar, Clock, CheckCircle, AlertTriangle, ExternalLink, Loader2, Paperclip, MessageSquare, Search, FolderOpen, Ban, Info, Undo2, Leaf, Trash, Download } from "lucide-react";
import Image from "next/image";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  { category: "Quality & HACCP Documentation", name: "Batch Coding Procedure" },
  { category: "Organic Certificate", name: "Organic Certificate" },
];

// Extract unique categories preserving order
const CATEGORIES = [...new Set(REQUIRED_DOCS.map(d => d.category))];

interface FileEntry {
  _id?: string;
  fileName: string;
  fileId: string;
  fileLink: string;
  isVerified?: boolean;
  createdBy: string;
  createdAt: string;
  products?: string[];
}

interface LogEntry {
  _id?: string;
  action: string;
  by: string;
  date: string;
  fileId?: string;
  fileLink?: string;
  isVerified?: boolean;
  products?: string[];
}

interface DocumentData {
  name: string;
  fileId?: string;
  fileLink?: string;
  expiryDate?: string;
  supplierNotes?: string;
  adminNotes?: string;
  isVerified?: boolean;
  isNA?: boolean;
  files?: FileEntry[];
  logs?: LogEntry[];
}

export function LogsProductMultiSelect({
  availableProducts,
  selectedProducts,
  onUpdate
}: {
  availableProducts: string[];
  selectedProducts: string[];
  onUpdate: (products: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedCount = selectedProducts.length;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 w-[130px] justify-between px-2 text-[10px] font-medium">
          <span className="truncate">
            {selectedCount > 0 ? `${selectedCount} Product${selectedCount > 1 ? 's' : ''}` : "Select Products"}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 z-[9999]" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Command>
          <CommandInput placeholder="Search products..." className="h-8 text-xs outline-none focus:outline-none ring-0 border-0 shadow-none border-b focus:ring-0" />
          <CommandList className="max-h-[200px]">
            <CommandEmpty>No products found.</CommandEmpty>
            <CommandGroup>
              {availableProducts.map((prod, idx) => (
                <CommandItem
                  key={`${idx}-${prod}`}
                  value={prod}
                  onSelect={() => {
                    if (selectedProducts.includes(prod)) {
                      onUpdate(selectedProducts.filter(p => p !== prod));
                    } else {
                      onUpdate([...selectedProducts, prod]);
                    }
                  }}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3 w-3",
                      selectedProducts.includes(prod) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {prod}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function SupplierDocumentsGrid({ supplierId, isSupplierView = false }: { supplierId: string, isSupplierView?: boolean }) {
  const [docStates, setDocStates] = useState<Record<string, DocumentData>>({});
  const savedStates = useRef<Record<string, DocumentData>>({});
  const { setLeftContent, setActions } = useHeaderActions();
  const [supplierName, setSupplierName] = useState<string>("");
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const [activeFiles, setActiveFiles] = useState<FileEntry[]>([]);
  const [activeLogs, setActiveLogs] = useState<LogEntry[]>([]);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [activeDocName, setActiveDocName] = useState("");
  const [activeLogType, setActiveLogType] = useState<'attachments' | 'notes'>('attachments');

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOrganic, setIsOrganic] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);

  const loadDocuments = async () => {
    try {
      const response = await fetch(`/api/admin/suppliers/${supplierId}`);
      if (response.ok) {
        const data = await response.json();
        setSupplierName(data.name || "");
        setIsOrganic(!!data.isOrganic);
        
        // Also fetch system products so we have a full global list
        const prodRes = await fetch('/api/admin/products').catch(() => null);
        if (prodRes && prodRes.ok) {
          const prods = await prodRes.json();
          setAvailableProducts(prods.map((p: any) => p.name));
        } else {
          setAvailableProducts(data.productsSupplied || []);
        }
        
        const statesMap: Record<string, DocumentData> = {};
        if (data.documents) {
          data.documents.forEach((d: any) => {
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
          <span className="hidden md:inline">{supplierName} <span className="text-primary/40">/</span></span> <span className="text-primary/40 md:text-primary/40">DOCUMENTS</span>
        </h1>
      );

      setActions(
        <Button variant="outline" size="icon" className="h-9 w-9 text-blue-500 hover:text-blue-600 border-blue-500/20 hover:bg-blue-500/10 shadow-sm" onClick={() => setIsInfoOpen(true)}>
          <Info className="h-4 w-4" />
        </Button>
      );
    }
    return () => {
      setLeftContent(null);
      setActions(null);
    };
  }, [supplierName, setLeftContent, setActions]);

  const updateDocumentData = async (docName: string, updates: Partial<DocumentData>, logAction?: string) => {
    setDocStates(prev => ({
      ...prev,
      [docName]: { ...prev[docName], ...updates, name: docName }
    }));

    try {
      const response = await fetch(`/api/admin/suppliers/${supplierId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docName, ...updates, logAction }),
      });

      if (!response.ok) throw new Error("Failed to update document");
      
      const updatedDocs = await response.json();
      const statesMap: Record<string, DocumentData> = {};
      updatedDocs.forEach((d: any) => {
        if (d.expiryDate) d.expiryDate = new Date(d.expiryDate).toISOString().split('T')[0];
        statesMap[d.name] = d;
      });
      setDocStates(statesMap);
      savedStates.current = JSON.parse(JSON.stringify(statesMap));
    } catch (error) {
      toast.error("Failed to save changes.");
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
        fileInputRefs.current[docName]!.value = '';
      }
    }
  };

  const deleteFileEntry = async (docName: string, fileId: string) => {
    try {
      const response = await fetch(`/api/admin/suppliers/${supplierId}/documents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docName, fileId }),
      });

      if (!response.ok) throw new Error("Delete failed");
      
      const updatedDocs = await response.json();
      const statesMap: Record<string, DocumentData> = {};
      updatedDocs.forEach((d: any) => {
        if (d.expiryDate) d.expiryDate = new Date(d.expiryDate).toISOString().split('T')[0];
        statesMap[d.name] = d;
      });
      setDocStates(statesMap);
      
      // Update active files state locally if modal open
      setActiveFiles(prev => prev.filter(f => f._id !== fileId));
      
      toast.success("File deleted successfully!");
    } catch (error) {
      toast.error("Failed to delete file.");
    }
  };

  const updateFileEntry = async (docName: string, fileId: string, isVerified: boolean, newProducts?: string[]) => {
    try {
      const response = await fetch(`/api/admin/suppliers/${supplierId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          docName, 
          fileId: fileId,
          fileIsVerified: isVerified,
          ...(newProducts ? { fileProducts: newProducts } : {})
        }),
      });

      if (!response.ok) throw new Error("Update failed");
      
      const updatedDocs = await response.json();
      const statesMap: Record<string, DocumentData> = {};
      updatedDocs.forEach((d: any) => {
        if (d.expiryDate) d.expiryDate = new Date(d.expiryDate).toISOString().split('T')[0];
        statesMap[d.name] = d;
      });
      setDocStates(statesMap);
      
      setActiveFiles(prev => prev.map(f => f._id === fileId ? { ...f, isVerified, ...(newProducts ? { products: newProducts } : {}) } : f));
      toast.success(newProducts ? "Products updated" : (isVerified ? "File marked as verified." : "File verification removed."));
    } catch (error) {
      toast.error("Failed to update file.");
    }
  };

  const verifyDoc = (docName: string) => {
    updateDocumentData(docName, { isVerified: true }, "Marked as Verified");
    toast.success("Document verified!");
  };

  const getStatus = (docData?: DocumentData) => {
    if (docData?.isNA) return { label: "N/A", color: "text-white", bg: "bg-zinc-500 border-zinc-600" };
    if (!docData || (!docData.fileId && (!docData.files || docData.files.length === 0))) return { label: "NO", color: "text-white", bg: "bg-orange-500 border-orange-600" };
    if (docData.isVerified) return { label: "VERIFIED", color: "text-white", bg: "bg-blue-600 border-blue-700" };
    
    if (docData.expiryDate) {
      const expDate = new Date(docData.expiryDate);
      const today = new Date();
      if (expDate < today) {
        return { label: "EXPIRED", color: "text-white", bg: "bg-red-600 border-red-700" };
      }
    }
    return { label: "YES", color: "text-white", bg: "bg-green-600 border-green-700" };
  };

  const toggleNA = (docName: string) => {
    const state = docStates[docName];
    const newNA = !(state?.isNA);
    updateDocumentData(docName, { isNA: newNA }, newNA ? 'Marked as N/A' : 'Unmarked N/A');
  };

  const openLogs = (docName: string, type: 'attachments' | 'notes' = 'attachments') => {
    const state = docStates[docName];
    setActiveDocName(docName);
    setActiveLogType(type);
    if (type === 'attachments') {
      const files = state?.files ? [...state.files].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];
      setActiveFiles(files);
    } else {
      const allLogs = state?.logs ? [...state.logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];
      setActiveLogs(allLogs.filter(l => l.action.includes('Notes') || l.action.includes('Expiry')));
    }
    setIsLogsOpen(true);
  };

  // Effective docs list: filter out Organic Certificate if supplier is not organic
  const effectiveDocs = useMemo(() => {
    if (isOrganic) return REQUIRED_DOCS;
    return REQUIRED_DOCS.filter(d => d.category !== 'Organic Certificate');
  }, [isOrganic]);

  const effectiveCategories = useMemo(() => {
    return [...new Set(effectiveDocs.map(d => d.category))];
  }, [effectiveDocs]);

  // Filtered docs
  const filteredDocs = useMemo(() => {
    let docs = effectiveDocs;
    if (selectedCategory) {
      docs = docs.filter(d => d.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      docs = docs.filter(d => d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q));
    }
    return docs;
  }, [selectedCategory, searchQuery, effectiveDocs]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, { total: number; completed: number }> = {};
    effectiveCategories.forEach(cat => {
      const catDocs = effectiveDocs.filter(d => d.category === cat);
      counts[cat] = {
        total: catDocs.length,
        completed: catDocs.filter(d => docStates[d.name]?.fileId).length
      };
    });
    return counts;
  }, [docStates, effectiveDocs, effectiveCategories]);

  // Group filtered docs by category, N/A docs pushed to end within each group
  const groupedDocs = useMemo(() => {
    const groups: Record<string, typeof REQUIRED_DOCS> = {};
    filteredDocs.forEach(doc => {
      if (!groups[doc.category]) groups[doc.category] = [];
      groups[doc.category].push(doc);
    });
    // Sort each group: non-NA first, NA last
    Object.keys(groups).forEach(cat => {
      groups[cat].sort((a, b) => {
        const aNA = docStates[a.name]?.isNA ? 1 : 0;
        const bNA = docStates[b.name]?.isNA ? 1 : 0;
        return aNA - bNA;
      });
    });
    return groups;
  }, [filteredDocs, docStates]);

  const renderDocRow = (doc: typeof REQUIRED_DOCS[0], i: number) => {
    const state = docStates[doc.name] || { name: doc.name };
    const statusInfo = getStatus(state);
    const isNA = !!state.isNA;
    
    return (
      <tr key={i} className={`hover:bg-muted/10 transition-colors ${isNA ? 'opacity-40' : ''}`}>
        <td className="px-4 py-2 font-medium text-foreground flex items-center gap-2 mt-2">
          {doc.name}
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
            <Button variant="ghost" size="icon" className={`h-7 w-7 ${isNA ? 'text-zinc-500 hover:text-green-500' : 'text-muted-foreground hover:text-zinc-500'}`} title={isNA ? 'Undo N/A' : 'Mark as N/A'} onClick={() => toggleNA(doc.name)}>
              {isNA ? <Undo2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Attachment History" onClick={() => openLogs(doc.name, 'attachments')}>
               <Paperclip className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Notes History" onClick={() => openLogs(doc.name, 'notes')}>
               <MessageSquare className="h-3.5 w-3.5" />
            </Button>

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

            {!isSupplierView && (
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
  };

  const renderMobileCard = (doc: typeof REQUIRED_DOCS[0], i: number) => {
    const state = docStates[doc.name] || { name: doc.name };
    const statusInfo = getStatus(state);
    
    return (
      <div key={i} className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/80 border-b border-border">
          <span className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">{doc.category}</span>
          <div className={`inline-flex px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${statusInfo.bg} ${statusInfo.color}`}>
            {statusInfo.label}
          </div>
        </div>
        <div className="px-4 py-3 space-y-3">
          <div className="font-semibold text-sm text-foreground leading-tight">
            {doc.name}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground w-16 shrink-0">Expiry</span>
            <div className="relative flex-1">
              <Calendar className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="date"
                className="h-8 pl-8 text-xs bg-foreground/5 border-transparent focus-visible:ring-1"
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
          </div>
          <div className="space-y-1.5">
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
        </div>
        <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-t border-border">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className={`h-8 w-8 ${state.isNA ? 'text-zinc-500 hover:text-green-500' : 'text-muted-foreground hover:text-zinc-500'}`} title={state.isNA ? 'Undo N/A' : 'Mark as N/A'} onClick={() => toggleNA(doc.name)}>
              {state.isNA ? <Undo2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Attachment History" onClick={() => openLogs(doc.name, 'attachments')}>
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Notes History" onClick={() => openLogs(doc.name, 'notes')}>
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <input 
              type="file" 
              className="hidden" 
              ref={el => { if (!fileInputRefs.current[`m_${doc.name}`]) fileInputRefs.current[`m_${doc.name}`] = el; }}
              onChange={(e) => handleFileUpload(e, doc.name)}
            />
            <Button 
              variant="outline" 
              size="sm"
              className="h-8 text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground border-primary/30 gap-1.5"
              onClick={() => (fileInputRefs.current[`m_${doc.name}`] || fileInputRefs.current[doc.name])?.click()}
              disabled={uploadingDoc === doc.name}
            >
              {uploadingDoc === doc.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Upload
            </Button>

            {!isSupplierView && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-blue-500 hover:border-blue-500/30 gap-1.5"
                onClick={() => verifyDoc(doc.name)}
                disabled={!state.fileId || !!state.isVerified}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Verify
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-0 md:h-[calc(100vh-100px)] flex flex-col">
      <div className="flex flex-col md:flex-row gap-0 md:gap-0 md:h-full md:overflow-hidden">
        {/* Category Sidebar - Desktop */}
        <div className="hidden md:flex flex-col w-[220px] shrink-0 border-r border-border pr-0 md:h-full md:overflow-y-auto pb-6">
          <div className="p-3 border-b border-border sticky top-0 bg-background z-10">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-xs bg-foreground/5 border-transparent focus-visible:ring-1 placeholder:text-[10px] placeholder:uppercase placeholder:tracking-widest"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`w-full text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors border-b border-border/50 flex items-center justify-between ${
                !selectedCategory ? 'bg-primary/10 text-primary border-l-2 border-l-primary' : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
              }`}
            >
              <span className="flex items-center gap-2">
                <FolderOpen className="h-3.5 w-3.5" />
                All Documents
              </span>
              <span className="text-[9px] font-black opacity-60">{effectiveDocs.length}</span>
            </button>
            {effectiveCategories.map(cat => {
              const counts = categoryCounts[cat];
              const isOrganic = cat === 'Organic Certificate';
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={`w-full text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-b border-border/50 flex items-center justify-between gap-2 ${
                    selectedCategory === cat 
                      ? isOrganic 
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-l-2 border-l-emerald-500'
                        : 'bg-primary/10 text-primary border-l-2 border-l-primary' 
                      : isOrganic
                        ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                        : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                  }`}
                >
                  <span className="leading-tight flex items-center gap-1.5">
                    {isOrganic && <Image src="/organic certified.png" alt="" width={14} height={14} className="rounded-full" />}
                    {cat}
                  </span>
                  <span className={`text-[9px] font-black shrink-0 ${counts.completed === counts.total ? 'text-green-500' : ''}`}>
                    {counts.completed}/{counts.total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile: Search + Category Pills */}
        <div className="md:hidden space-y-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-10 pl-10 text-sm bg-foreground/5 border-transparent focus-visible:ring-1"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-colors ${
                !selectedCategory ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50'
              }`}
            >
              All ({effectiveDocs.length})
            </button>
            {effectiveCategories.map(cat => {
              const counts = categoryCounts[cat];
              const shortName = cat.split(' ')[0] + (cat.split(' ').length > 1 ? '...' : '');
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-colors ${
                    selectedCategory === cat ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50'
                  }`}
                >
                  {shortName} ({counts.completed}/{counts.total})
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 md:flex md:flex-col md:h-full md:overflow-hidden pb-8 md:pb-0 md:pl-4 mt-4 md:mt-0">
          {/* Desktop Table View */}
          <div className="rounded-r-xl border border-border bg-card shadow-sm hidden md:flex md:flex-col md:flex-1 md:overflow-hidden mb-6">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/95 backdrop-blur-sm uppercase text-[10px] font-black tracking-widest text-muted-foreground border-b border-border sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 min-w-[300px]">Document Name</th>
                    <th className="px-4 py-3 min-w-[100px]">Status</th>
                    <th className="px-4 py-3 min-w-[150px]">Expiry Date</th>
                    <th className="px-4 py-3 min-w-[320px]">Notes</th>
                    <th className="px-4 py-3 text-right min-w-[140px]">Action</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-border/50">
                {Object.entries(groupedDocs).map(([category, docs]) => {
                  const isOrganic = category === 'Organic Certificate';
                  return (
                  <React.Fragment key={category}>
                    <tr>
                      <td colSpan={5} className={`px-4 py-2 border-y border-border ${
                        isOrganic 
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50' 
                          : 'bg-muted/30'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 ${
                            isOrganic ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'
                          }`}>
                            {isOrganic ? (
                              <Image src="/organic certified.png" alt="Organic" width={16} height={16} className="rounded-full" />
                            ) : (
                              <FolderOpen className="h-3.5 w-3.5 text-primary" />
                            )}
                            {category}
                          </span>
                          <span className="text-[9px] font-black text-muted-foreground/50">
                            {categoryCounts[category]?.completed}/{categoryCounts[category]?.total}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {docs.map((doc, i) => renderDocRow(doc, i))}
                  </React.Fragment>
                  );
                })}
                {filteredDocs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="text-muted-foreground/50 font-black uppercase text-[10px] tracking-widest">
                        No documents match your search
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {Object.entries(groupedDocs).map(([category, docs]) => (
              <div key={category} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-2">
                    <FolderOpen className="h-3.5 w-3.5 text-primary" />
                    {category}
                  </span>
                  <span className="text-[9px] font-black text-muted-foreground/50">
                    {categoryCounts[category]?.completed}/{categoryCounts[category]?.total}
                  </span>
                </div>
                {docs.map((doc, i) => renderMobileCard(doc, i))}
              </div>
            ))}
            {filteredDocs.length === 0 && (
              <div className="text-center py-12 border border-dashed rounded-xl bg-accent/5 font-black uppercase text-[10px] tracking-widest text-muted-foreground/50">
                No documents match your search
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isLogsOpen} onOpenChange={setIsLogsOpen}>
        <DialogContent className="sm:max-w-6xl rounded-3xl border-primary/20 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">
              {activeLogType === 'attachments' ? activeDocName : `Notes: ${activeDocName}`}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {activeDocName}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 w-full">
            {activeLogType === 'attachments' ? (
              activeFiles.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm max-h-[400px] overflow-y-auto">
                  <table className="w-full text-left text-sm text-muted-foreground whitespace-nowrap">
                    <thead className="bg-muted text-[10px] uppercase font-black tracking-widest border-b border-border text-foreground sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 min-w-[200px]">File Name</th>
                        <th className="px-4 py-3">Created By</th>
                        <th className="px-4 py-3">Created At</th>
                        <th className="px-4 py-3 min-w-[150px]">Products</th>
                        <th className="px-4 py-3 text-center">Verified</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {activeFiles.map((file, i) => (
                        <tr key={file._id || i} className="hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-3 font-semibold text-foreground overflow-hidden text-ellipsis max-w-[250px] break-words whitespace-normal leading-tight">
                            <span>{file.fileName}</span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-primary">{file.createdBy}</td>
                          <td className="px-4 py-3 text-xs">{new Date(file.createdAt).toLocaleString()}</td>
                          <td className="px-4 py-3 align-middle">
                            <LogsProductMultiSelect 
                              availableProducts={availableProducts}
                              selectedProducts={file.products || []}
                              onUpdate={(newProducts) => updateFileEntry(activeDocName, file._id!, file.isVerified || false, newProducts)}
                            />
                          </td>
                          <td className="px-4 py-3 align-middle text-center">
                            <Switch 
                              checked={!!file.isVerified}
                              onCheckedChange={(val) => updateFileEntry(activeDocName, file._id!, val)}
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                title="Download document" 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => window.open(file.fileLink, '_blank')}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {file._id && (
                                <Button 
                                  title="Delete document" 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => deleteFileEntry(activeDocName, file._id!)} 
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed rounded-xl bg-accent/5 font-black uppercase text-[10px] tracking-widest text-muted-foreground/50">
                  No files uploaded yet
                </div>
              )
            ) : (
              // Notes View (Original Style)
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 inline-flex flex-col w-full text-sm">
                {activeLogs.length > 0 ? (
                  activeLogs.map((log, i) => (
                    <div key={i} className="flex border-b border-border/50 pb-3 last:border-0 items-start justify-between gap-4">
                      <div className="flex flex-col gap-1 flex-1">
                        <span className="font-bold text-xs uppercase tracking-widest text-[#a1a1aa]">{log.action}</span>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-1">
                          <span>By: <span className="text-primary">{log.by}</span></span>
                          <span>{new Date(log.date).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 border border-dashed rounded-xl bg-accent/5 font-black uppercase text-[10px] tracking-widest text-muted-foreground/50">
                    No activity logged yet
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isInfoOpen} onOpenChange={setIsInfoOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600 text-lg font-black uppercase tracking-widest">
               <Info className="h-5 w-5" /> Instructions
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2 text-sm bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50">
             <p className="font-bold text-foreground">Please complete this form and attach all applicable documents listed.</p>
             <ul className="space-y-2.5 text-xs text-muted-foreground mt-3">
               <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">•</span> <span>All certificates must be <span className="font-bold text-foreground">VALID</span> and <span className="font-bold text-foreground">NOT expired</span></span></li>
               <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">•</span> <span>Clearly name files (Example: <span className="font-mono text-[10px] bg-background border px-1.5 py-0.5 rounded shadow-sm text-foreground">ABC_Fruits_FSSC_22000_2025.pdf</span>)</span></li>
               <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">•</span> <span>If a document is not applicable, mark <span className="inline-flex items-center gap-1 font-bold text-zinc-500"><Ban className="h-3 w-3" /> N/A</span></span></li>
               <li className="flex items-start gap-2"><span className="text-blue-500 font-bold mt-0.5">•</span> <span>Incomplete submissions may <span className="font-bold text-orange-500">delay approval</span></span></li>
             </ul>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
