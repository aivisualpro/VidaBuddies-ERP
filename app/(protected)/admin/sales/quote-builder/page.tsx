"use client";

import React, { useState, useEffect } from "react";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { IconPlus, IconDeviceFloppy, IconEdit, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { useUserDataStore } from "@/store/useUserDataStore"; 

export default function QuoteBuilderPage() {
  const { setActions } = useHeaderActions();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Data stores for dropdowns
  const { products } = useUserDataStore();

  const INIT_QUOTE = {
    quoteNumber: "",
    revisionNumber: 0,
    salesRep: "",
    branch: "",
    customer: "",
    incoterm: "",
    currency: "USD",
    effectiveDate: "",
    date: new Date().toISOString().slice(0, 10),
    
    products: [],
    supplier: "",
    origin: "",
    quantity: 0,
    uom: "kg",
    supplierCost: 0,
    additionalCharges: 0,
    targetSalePrice: 0,
    margin: 0,

    pickupLocation: "",
    deliveryLocation: "",
    warehouse: "",
    appointmentNotes: "",
    palletCount: 0,
    weight: 0,
    requiredEquipment: "",
    temperature: "",
    customsRequired: false,

    carrierRequestStatus: "Pending",
    carrierResponses: "",
    selectedCarrier: "",
    bookedFreightValue: 0,
    inlandFreight: 0,
    surchargeCapture: 0,
  };

  const [formData, setFormData] = useState<any>(INIT_QUOTE);

  const fetchQuotes = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/sales/quotes');
      if (res.ok) setQuotes(await res.json());
    } catch(err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
    
    if (typeof window !== 'undefined') {
      const isNew = new URLSearchParams(window.location.search).get("new");
      if (isNew === "true") {
        setIsFormOpen(true);
        window.history.replaceState({}, '', '/admin/sales/quote-builder');
      }
    }
  }, []);

  // Configure Header Actions securely
  useEffect(() => {
     setActions(
         <Button onClick={() => { setFormData(INIT_QUOTE); setIsFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
           <IconPlus className="mr-2" size={16} /> New Quote
         </Button>
     );
  }, [setActions]);

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSelectChange = (name: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const isEdit = !!formData._id;
      const url = isEdit ? `/api/admin/sales/quotes/${formData._id}` : '/api/admin/sales/quotes';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) throw new Error("Failed to save quote");
      
      toast.success(`Quote successfully ${isEdit ? 'updated' : 'created'}!`);
      await fetchQuotes();
      setIsFormOpen(false);
    } catch(err: any) {
      toast.error(err.message || 'Error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    toast("Confirm Deletion", {
      description: "Are you sure you want to permanently delete this quote?",
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const res = await fetch(`/api/admin/sales/quotes/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error("Delete failed");
            toast.success("Quote permanently deleted.");
            fetchQuotes();
          } catch(err: any) {
            toast.error(err.message);
          }
        }
      },
      cancel: { label: "Cancel", onClick: () => {} }
    });
  };

  const editQuote = (qt: any) => {
    setFormData({...qt, effectiveDate: qt.effectiveDate ? new Date(qt.effectiveDate).toISOString().slice(0,10) : '', date: qt.date ? new Date(qt.date).toISOString().slice(0,10) : ''});
    setIsFormOpen(true);
  };

  return (
    <>
      <Card className="shadow-sm border">
        <CardContent className="p-0">
           {isLoading ? (
             <div className="text-center py-10 text-zinc-500">Loading quotes...</div>
           ) : quotes.length === 0 ? (
             <div className="text-center py-10 m-6 bg-slate-50 dark:bg-zinc-900 rounded-lg text-zinc-500 border border-dashed">
               No quotes found. Click "New Quote" to create your first deal footprint.
             </div>
           ) : (
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-wider">
                     <tr>
                       <th className="px-6 py-4 rounded-tl">Quote #</th>
                       <th className="px-6 py-4">Customer</th>
                       <th className="px-6 py-4">Rep</th>
                       <th className="px-6 py-4">Target Price</th>
                       <th className="px-6 py-4">Status</th>
                       <th className="px-6 py-4 text-right rounded-tr">Actions</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                     {quotes.map(q => (
                       <tr key={q._id} className="hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition-colors">
                          <td className="px-6 py-3 font-semibold text-blue-600 whitespace-nowrap">
                             {q.quoteNumber || "Draft"} 
                             <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded ml-2">Rev {q.revisionNumber}</span>
                          </td>
                          <td className="px-6 py-3 max-w-[200px] truncate">{q.customer}</td>
                          <td className="px-6 py-3">{q.salesRep}</td>
                          <td className="px-6 py-3 font-bold whitespace-nowrap">{q.currency} {q.targetSalePrice?.toLocaleString()}</td>
                          <td className="px-6 py-3">
                             <span className="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 text-xs rounded-full font-semibold">{q.carrierRequestStatus}</span>
                          </td>
                          <td className="px-6 py-3 text-right flex justify-end gap-2">
                             <Button variant="ghost" size="icon" onClick={() => editQuote(q)} className="h-8 w-8 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full transition-colors"><IconEdit size={16} /></Button>
                             <Button variant="ghost" size="icon" onClick={() => handleDelete(q._id)} className="h-8 w-8 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors"><IconTrash size={16} /></Button>
                          </td>
                       </tr>
                     ))}
                  </tbody>
               </table>
             </div>
           )}
        </CardContent>
      </Card>

      {/* Quote Form Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-0 shadow-2xl rounded-xl">
          <DialogHeader className="bg-slate-50 dark:bg-zinc-950 px-6 py-4 border-b border-black/5 dark:border-white/5 sticky top-0 z-10 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                {formData._id ? `Edit Quote: ${formData.quoteNumber}` : 'Deploy New Commercial Quote'}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
               <Button variant="outline" onClick={() => setIsFormOpen(false)} disabled={isSaving}>Cancel</Button>
               <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 font-bold px-6">
                 {isSaving ? "Publishing..." : <><IconDeviceFloppy className="mr-2 h-4 w-4" /> Save Quote</>}
               </Button>
            </div>
          </DialogHeader>

          <div className="p-6 bg-white dark:bg-zinc-900 pb-12">
            <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-8 bg-slate-100/60 dark:bg-zinc-950/50 h-12 rounded-lg">
                  <TabsTrigger value="info" className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 font-bold text-[11px] tracking-wider uppercase rounded-md">1. Quote Info</TabsTrigger>
                  <TabsTrigger value="commercial" className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 font-bold text-[11px] tracking-wider uppercase rounded-md">2. Commercial</TabsTrigger>
                  <TabsTrigger value="logistics" className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 font-bold text-[11px] tracking-wider uppercase rounded-md">3. Logistics</TabsTrigger>
                  <TabsTrigger value="freight" className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 font-bold text-[11px] tracking-wider uppercase rounded-md">4. Freight</TabsTrigger>
                </TabsList>
                
                {/* Apply min-h-[550px] to all TabsContent to normalize form height across all tabs without jitter */}
                <TabsContent value="info" className="space-y-6 min-h-[550px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 px-1">
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Quote Number</Label>
                        <Input name="quoteNumber" value={formData.quoteNumber} onChange={handleChange} placeholder="Auto-generated if empty" disabled={!!formData._id} className="bg-slate-50 disabled:opacity-75 focus-visible:ring-1" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Revision</Label>
                        <Input name="revisionNumber" type="number" value={formData.revisionNumber} onChange={handleChange} className="focus-visible:ring-1" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Sales Rep</Label>
                        <Input name="salesRep" value={formData.salesRep} onChange={handleChange} className="focus-visible:ring-1" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Branch</Label>
                        <Input name="branch" value={formData.branch} onChange={handleChange} className="focus-visible:ring-1" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Customer</Label>
                        <Input name="customer" value={formData.customer} onChange={handleChange} placeholder="Enter Client ID or Name" className="focus-visible:ring-1" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Incoterm</Label>
                        <Select value={formData.incoterm} onValueChange={(val) => handleSelectChange('incoterm', val)}>
                          <SelectTrigger className="focus:ring-1"><SelectValue placeholder="Select term" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FOB">FOB (Free On Board)</SelectItem>
                            <SelectItem value="EXW">EXW (Ex Works)</SelectItem>
                            <SelectItem value="CIF">CIF (Cost, Insurance, Freight)</SelectItem>
                            <SelectItem value="DDP">DDP (Delivered Duty Paid)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Currency</Label>
                        <Input name="currency" value={formData.currency} onChange={handleChange} className="focus-visible:ring-1" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Creation Date</Label>
                        <Input type="date" name="date" value={formData.date} onChange={handleChange} className="focus-visible:ring-1" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Effective Till</Label>
                        <Input type="date" name="effectiveDate" value={formData.effectiveDate} onChange={handleChange} className="focus-visible:ring-1" />
                      </div>
                  </div>
                </TabsContent>

                <TabsContent value="commercial" className="space-y-6 min-h-[550px]">
                    <div className="col-span-full space-y-2 mb-8 px-1">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Target Products Setup</Label>
                        <div className="border border-indigo-100 dark:border-indigo-900/30 p-6 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/10 transition-colors hover:border-indigo-200">
                          <Label className="text-sm font-semibold mb-3 block text-indigo-900 dark:text-indigo-200">Link Product Master Data (VBID) (Combobox UI Pending)</Label>
                          <Input name="products" value={formData.products?.join(", ") || ""} onChange={(e) => handleSelectChange('products', e.target.value.split(','))} placeholder="Enter Product Names or VBIDs seperated by comma" className="bg-white dark:bg-zinc-950 focus-visible:ring-indigo-500/50 shadow-sm" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 px-1">
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Supplier Name</Label>
                        <Input name="supplier" value={formData.supplier} onChange={handleChange} className="focus-visible:ring-1" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Origin Region</Label>
                        <Input name="origin" value={formData.origin} onChange={handleChange} className="focus-visible:ring-1" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Quantity</Label>
                        <Input type="number" name="quantity" value={formData.quantity} onChange={handleChange} className="focus-visible:ring-1" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Unit of Measure (UOM)</Label>
                        <Input name="uom" value={formData.uom} onChange={handleChange} className="focus-visible:ring-1" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Supplier Base Cost</Label>
                        <Input type="number" name="supplierCost" value={formData.supplierCost} onChange={handleChange} placeholder="0.00" className="focus-visible:ring-1" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Additional Surcharges</Label>
                        <Input type="number" name="additionalCharges" value={formData.additionalCharges} onChange={handleChange} placeholder="0.00" className="focus-visible:ring-1" />
                      </div>
                      <div className="space-y-2 col-span-full border-t border-black/5 dark:border-white/5 my-2" />
                      <div className="space-y-2 bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-blue-600 block mb-2">Target Sale Price</Label>
                        <Input type="number" name="targetSalePrice" value={formData.targetSalePrice} onChange={handleChange} className="border-blue-200 dark:border-blue-800 bg-white dark:bg-zinc-950 font-bold text-lg h-12 shadow-sm focus-visible:ring-blue-500" />
                      </div>
                      <div className="space-y-2 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-emerald-600 block mb-2">Calculated Margin (%)</Label>
                        <Input type="number" name="margin" value={formData.margin} onChange={handleChange} className="border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-950 font-bold text-lg h-12 shadow-sm focus-visible:ring-emerald-500" />
                      </div>
                  </div>
                </TabsContent>

                <TabsContent value="logistics" className="space-y-6 min-h-[550px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 px-1">
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Pickup Location Address</Label>
                        <Input name="pickupLocation" value={formData.pickupLocation} onChange={handleChange} className="focus-visible:ring-1" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Delivery Destination Address</Label>
                        <Input name="deliveryLocation" value={formData.deliveryLocation} onChange={handleChange} className="focus-visible:ring-1" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Associated Warehouse</Label>
                        <Input name="warehouse" value={formData.warehouse} onChange={handleChange} className="focus-visible:ring-1" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Mandatory Handling Equipment</Label>
                        <Input name="requiredEquipment" placeholder="e.g. Forklift, Crane, Liftgate..." value={formData.requiredEquipment} onChange={handleChange} className="focus-visible:ring-1" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Pallet Count</Label>
                          <Input type="number" name="palletCount" value={formData.palletCount} onChange={handleChange} className="focus-visible:ring-1" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Gross Weight (LBS/KG)</Label>
                          <Input type="number" name="weight" value={formData.weight} onChange={handleChange} className="focus-visible:ring-1" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Temperature Control Limits</Label>
                        <Input name="temperature" placeholder="e.g. Ambient, Frozen -20C..." value={formData.temperature} onChange={handleChange} className="focus-visible:ring-1" />
                      </div>
                      <div className="col-span-full space-y-2 border-t border-black/5 dark:border-white/5 pt-6 mt-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500 block">Appointment / Facility Notes</Label>
                        <Input name="appointmentNotes" placeholder="Special facility notes for driver..." value={formData.appointmentNotes} onChange={handleChange} className="focus-visible:ring-1" />
                      </div>
                      <div className="col-span-full p-4 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Checkbox id="customsRequired" checked={formData.customsRequired} onCheckedChange={(c) => handleSelectChange('customsRequired', c)} className="border-red-300 data-[state=checked]:bg-red-600" />
                          <label htmlFor="customsRequired" className="text-sm font-bold text-red-700 dark:text-red-400 leading-none cursor-pointer">
                            Customs Brokerage Documentation Mandatory for execution of freight
                          </label>
                        </div>
                      </div>
                  </div>
                </TabsContent>

                <TabsContent value="freight" className="space-y-6 min-h-[550px]">
                  <div className="p-5 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-l-amber-500 rounded-r-xl rounded-l-sm mb-8 flex gap-8 items-end shadow-sm">
                      <div className="flex-1">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-amber-700 dark:text-amber-500 mb-2 block">Carrier Routing Status</Label>
                        <Select value={formData.carrierRequestStatus} onValueChange={(val) => handleSelectChange('carrierRequestStatus', val)}>
                          <SelectTrigger className="border-amber-200 dark:border-amber-800 bg-white dark:bg-zinc-950 font-semibold shadow-sm focus:ring-amber-500 h-11"><SelectValue placeholder="Status..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">Pending Audit</SelectItem>
                            <SelectItem value="Requested">Quotes Requested</SelectItem>
                            <SelectItem value="Received">Quotes Received</SelectItem>
                            <SelectItem value="Awarded">Awarded / Booked</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-emerald-700 dark:text-emerald-500 mb-2 block">Awarded Carrier Identity</Label>
                        <Input name="selectedCarrier" placeholder="Carrier Name..." value={formData.selectedCarrier} onChange={handleChange} className="border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-950 font-semibold shadow-sm focus-visible:ring-emerald-500 h-11" />
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-1 pb-6 border-b border-black/5 dark:border-white/5">
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Base Inland Freight Cost</Label>
                        <Input type="number" name="inlandFreight" value={formData.inlandFreight} onChange={handleChange} placeholder="$0.00" className="focus-visible:ring-1" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500">Captured Surcharges</Label>
                        <Input type="number" name="surchargeCapture" value={formData.surchargeCapture} onChange={handleChange} placeholder="$0.00" className="focus-visible:ring-1" />
                      </div>
                      <div className="space-y-2 bg-purple-50/50 dark:bg-purple-900/10 p-4 -mt-4 rounded-xl border border-purple-100 dark:border-purple-900/30">
                        <Label className="text-[11px] uppercase font-black tracking-widest text-purple-600 block mb-2">Total Booked Freight Output</Label>
                        <Input type="number" name="bookedFreightValue" value={formData.bookedFreightValue} onChange={handleChange} className="bg-white dark:bg-zinc-950 border-purple-200 dark:border-purple-800 font-bold text-lg h-12 shadow-sm focus-visible:ring-purple-500" placeholder="$0.00" />
                      </div>
                  </div>

                  <div className="space-y-2 pt-2 px-1">
                      <Label className="text-[11px] uppercase font-black tracking-widest text-zinc-500 block mb-3">Aggregated Carrier Responses Log</Label>
                      <textarea 
                        name="carrierResponses" 
                        value={formData.carrierResponses} 
                        onChange={handleChange} 
                        placeholder="Dump raw notes on carrier bids, transit times, and stipulations here..."
                        className="w-full min-h-[160px] rounded-lg border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-sm shadow-inner focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 font-medium"
                      />
                  </div>
                </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
