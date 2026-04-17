"use client";

import React, { useState, useEffect, use, useMemo, useCallback } from "react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserDataStore } from "@/store/useUserDataStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { FileText, FlaskConical, ExternalLink, Loader2, Plus, Search, Trash2, Edit, Download, Calendar } from "lucide-react";

export default function SupplierSpecsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { setActions, setLeftContent } = useHeaderActions();
  const { products, suppliers } = useUserDataStore();
  const supplier = useMemo(() => suppliers.find(s => s._id === id), [suppliers, id]);
  
  const [specs, setSpecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search state mapping to both Spec Name, Products, and Extracted Data
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  // Selection
  const [selectedSpec, setSelectedSpec] = useState<any | null>(null);

  // Form States
  const [uploading, setUploading] = useState(false);
  const [formName, setFormName] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
  }, [products, productSearch]);

  const fetchSpecs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/suppliers/${id}/specs`);
      if (res.ok) {
        const data = await res.json();
        setSpecs(data);
        if (data.length > 0) {
          // Keep selection alive if it still exists, otherwise select first
          setSelectedSpec((prev: any) => data.find((s: any) => s._id === prev?._id) || data[0]);
        } else {
          setSelectedSpec(null);
        }
      }
    } catch (e) {
      toast.error("Failed to fetch specs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecs();
  }, [id]);

  useEffect(() => {
    if (supplier) {
      setLeftContent(
        <h1 className="text-xl font-black tracking-tight uppercase bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
          <span className="hidden md:inline">{supplier.name} <span className="text-primary/40">/</span></span> <span className="text-primary/40 md:text-primary/40">SPECS</span>
        </h1>
      );
    }
    return () => setLeftContent(null);
  }, [setLeftContent, supplier]);

  useEffect(() => {
    const actions = (
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search all specs..." 
            className="pl-9 h-9 rounded-full bg-background border-muted-foreground/20 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="rounded-full shadow-md font-semibold shrink-0 h-9">
          <Plus className="h-4 w-4 mr-1.5" /> Add Spec
        </Button>
      </div>
    );
    // Important: We safely use a timeout or let it run properly since React 18 handles setState safely now inside effect
    setActions(actions);
    
    // Clear on unmount
    return () => setActions(null);
  }, [setActions, searchQuery]);

  const handleProductToggle = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(p => p !== productId) 
        : [...prev, productId]
    );
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !file) {
      toast.error("Name and PDF file are required.");
      return;
    }

    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file.");
      return;
    }

    setUploading(true);
    toast.info("Uploading and extracting PDF...");
    const formData = new FormData();
    formData.append("name", formName.trim());
    formData.append("products", JSON.stringify(selectedProducts));
    formData.append("file", file);

    try {
      const res = await fetch(`/api/admin/suppliers/${id}/specs`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      toast.success("Specification extracted successfully!");
      setIsAddOpen(false);
      resetForm();
      fetchSpecs();
    } catch (error) {
      console.error(error);
      toast.error("An error occurred during upload and extraction.");
    } finally {
      setUploading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !selectedSpec) return;

    setUploading(true);
    try {
      const res = await fetch(`/api/admin/suppliers/${id}/specs/${selectedSpec._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          products: selectedProducts
        })
      });

      if (!res.ok) throw new Error("Edit failed");
      
      toast.success("Specification updated successfully!");
      setIsEditOpen(false);
      fetchSpecs();
    } catch (e) {
      toast.error("Failed to update specification");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, specId: string) => {
    e.stopPropagation();
    
    toast("Are you sure you want to permanently delete this specification?", {
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const res = await fetch(`/api/admin/suppliers/${id}/specs/${specId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Deletion failed");
            
            toast.success("Deleted successfully");
            if (selectedSpec?._id === specId) setSelectedSpec(null);
            fetchSpecs();
          } catch(error) {
            toast.error("Failed to delete");
          }
        }
      }
    });
  };

  const openEditModal = (e: React.MouseEvent, spec: any) => {
    e.stopPropagation();
    setSelectedSpec(spec);
    setFormName(spec.name);
    setSelectedProducts(spec.products?.map((p:any) => p._id) || []);
    setProductSearch("");
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setFormName("");
    setSelectedProducts([]);
    setProductSearch("");
    setFile(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const triggerDownload = (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    if (!fileId) {
      toast.error("File ID missing, cannot download.");
      return;
    }
    const link = document.createElement("a");
    link.href = `https://drive.google.com/uc?export=download&id=${fileId}`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter Search
  const displaySpecs = useMemo(() => {
    if (!searchQuery.trim()) return specs;
    const lowerQ = searchQuery.toLowerCase();
    return specs.filter(s => {
      if (s.name.toLowerCase().includes(lowerQ)) return true;
      if (s.products?.some((p:any) => p.name.toLowerCase().includes(lowerQ))) return true;
      if (s.extractedData?.some((d:any) => d.key.toLowerCase().includes(lowerQ) || d.value.toLowerCase().includes(lowerQ))) return true;
      return false;
    });
  }, [specs, searchQuery]);

  return (
    <div className="w-full h-full flex flex-col pt-2">
      
      {/* Two Columns Layout */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-6">
        
        {/* LEFT COLUMN: Records List */}
        <div className="w-full md:w-[400px] flex flex-col gap-3 overflow-y-auto pr-1 pb-4 scrollbar-thin">
          {loading ? (
            <div className="p-10 flex w-full justify-center text-muted-foreground">
               <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : displaySpecs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground bg-background rounded-xl border border-dashed">
               <p className="text-sm">No specifications found.</p>
            </div>
          ) : (
            displaySpecs.map(spec => (
              <Card 
                key={spec._id} 
                onClick={() => setSelectedSpec(spec)}
                className={`relative cursor-pointer transition-all border-l-[6px] shadow-sm hover:shadow-md ${selectedSpec?._id === spec._id ? 'border-l-primary bg-primary/[0.02]' : 'border-l-muted/30 hover:border-l-primary/30'} group`}
              >
                <div className="p-4 flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-4">
                    <h4 className="font-bold text-[15px] leading-tight line-clamp-2 text-foreground/90">{spec.name}</h4>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background p-1 rounded-md shadow-sm border">
                       <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:bg-blue-50" onClick={(e) => openEditModal(e, spec)}>
                         <Edit className="h-3.5 w-3.5" />
                       </Button>
                       <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-50" onClick={(e) => handleDelete(e, spec._id)}>
                         <Trash2 className="h-3.5 w-3.5" />
                       </Button>
                       <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50" onClick={(e) => triggerDownload(e, spec.pdfFileId)}>
                         <Download className="h-3.5 w-3.5" />
                       </Button>
                    </div>
                  </div>
                  
                  {spec.products && spec.products.length > 0 && (
                    <div className="flex flex-col gap-0.5 mt-1">
                      {spec.products.map((p:any) => (
                        <span key={p._id} className="text-[11px] font-medium text-muted-foreground truncate w-full">
                          • {p.name}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-2 font-medium uppercase tracking-wider">
                     <Calendar className="h-3 w-3" />
                     {new Date(spec.uploadedAt).toLocaleDateString()}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* RIGHT COLUMN: Output Display */}
        <div className="flex-1 h-full min-h-[400px] overflow-hidden">
           {selectedSpec ? (
             <Card className="h-full flex flex-col border shadow-sm bg-background">
               <ScrollArea className="flex-1 p-6 h-full pb-10">
                 {(!selectedSpec.extractedData || selectedSpec.extractedData.length === 0) ? (
                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                      <FlaskConical className="h-12 w-12 mb-3 opacity-30" />
                      <p>No specifications were detected during PDF scan.</p>
                      {selectedSpec.pdfUrl && (
                        <a href={selectedSpec.pdfUrl} target="_blank" rel="noreferrer" className="text-sm mt-4 font-semibold text-blue-600 hover:underline">
                          View Uploaded File
                        </a>
                      )}
                    </div>
                 ) : (
                    <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                      {selectedSpec.extractedData.map((specItem: any, idx: number) => (
                        <div key={idx} className="flex flex-col border-l-2 pl-4 border-primary/20 py-1">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                            {specItem.key}
                          </span>
                          <span className="text-sm font-semibold text-foreground/90 leading-snug">
                             {specItem.value}
                          </span>
                        </div>
                      ))}
                      {selectedSpec.pdfUrl && (
                        <div className="flex flex-col border-l-2 pl-4 border-primary/20 py-1">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
                            Document
                          </span>
                          <a href={selectedSpec.pdfUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-600 hover:underline inline-flex items-center">
                            View File <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </div>
                      )}
                    </div>
                 )}
               </ScrollArea>
             </Card>
           ) : (
             <div className="h-full flex flex-col items-center justify-center bg-background/50 border-dashed border-2 rounded-xl text-muted-foreground opacity-70">
                <FileText className="h-16 w-16 mb-4 stroke-[1.5]" />
                <p className="text-lg font-medium">Select a Specification</p>
                <p className="text-sm">Click on any card to view its deeply extracted parameters.</p>
             </div>
           )}
        </div>

      </div>

      {/* Add Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Specification</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="grid gap-5 py-2">
            <div className="grid gap-2">
              <Label htmlFor="specName">File Name</Label>
              <Input 
                id="specName" 
                value={formName} 
                onChange={e => setFormName(e.target.value)} 
                placeholder="e.g. Pineapple Juice Specs 2026"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Link Products</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search products..."
                  className="pl-9 h-9"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>
              <div className="border rounded-md p-2 bg-muted/30">
                <ScrollArea className="h-40 w-full rounded-md">
                  <div className="space-y-1 p-2">
                    {filteredProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No products found.</p>
                    ) : (
                      filteredProducts.map((product) => (
                        <div key={product._id} className="flex items-center space-x-2 py-1.5 px-2 hover:bg-muted rounded-md transition-colors cursor-pointer" onClick={(e) => {
                          e.preventDefault();
                          handleProductToggle(product._id);
                        }}>
                          <input 
                            type="checkbox"
                            id={`prod-${product._id}`} 
                            checked={selectedProducts.includes(product._id)}
                            onChange={() => handleProductToggle(product._id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded-sm border-gray-300 text-primary focus:ring-primary shadow-sm"
                          />
                          <label
                            htmlFor={`prod-${product._id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                            onClick={(e) => e.preventDefault()}
                          >
                            {product.name}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Upload PDF</Label>
              <div className="relative group w-full">
                <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploading ? 'opacity-50 cursor-not-allowed border-primary/50' : 'hover:bg-muted/50 border-border hover:border-primary/50'}`}>
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {file ? (
                       <FileText className="h-8 w-8 text-primary mb-2" />
                    ) : (
                       <Plus className="h-8 w-8 text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                    )}
                    <p className="mb-1 text-sm font-semibold text-foreground text-center px-4 truncate w-full">
                      {file ? file.name : "Select PDF Document"}
                    </p>
                    <p className="text-xs text-muted-foreground">PDF files only</p>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".pdf" 
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} disabled={uploading}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {uploading ? "Extracting..." : "Upload & Extract"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Specification Record</DialogTitle>
            <DialogDescription>
              Update the mapped file name or linked products for this record.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="grid gap-5 py-2">
            <div className="grid gap-2">
              <Label htmlFor="editSpecName">File Name</Label>
              <Input 
                id="editSpecName" 
                value={formName} 
                onChange={e => setFormName(e.target.value)} 
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Link Products</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search products..."
                  className="pl-9 h-9"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>
              <div className="border rounded-md p-2 bg-muted/30">
                <ScrollArea className="h-40 w-full rounded-md">
                  <div className="space-y-1 p-2">
                    {filteredProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No products found.</p>
                    ) : (
                      filteredProducts.map((product) => (
                        <div key={product._id} className="flex items-center space-x-2 py-1.5 px-2 hover:bg-muted rounded-md transition-colors cursor-pointer" onClick={(e) => {
                          e.preventDefault();
                          handleProductToggle(product._id);
                        }}>
                          <input 
                            type="checkbox"
                            id={`edit-prod-${product._id}`} 
                            checked={selectedProducts.includes(product._id)}
                            onChange={() => handleProductToggle(product._id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded-sm border-gray-300 text-primary focus:ring-primary shadow-sm"
                          />
                          <label
                            htmlFor={`edit-prod-${product._id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                            onClick={(e) => e.preventDefault()}
                          >
                            {product.name}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={uploading}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {uploading ? "Updating..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
