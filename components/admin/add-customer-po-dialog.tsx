import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { useUserDataStore } from "@/store/useUserDataStore";

export function AddCustomerPODialog({ open, onClose, defaultVbpoId }: { open: boolean; onClose: () => void; defaultVbpoId?: string }) {
  const { purchaseOrders, customers, warehouses, refetchPurchaseOrders } = useUserDataStore();
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedVBPO, setSelectedVBPO] = useState(defaultVbpoId || "");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedVBPO(defaultVbpoId || "");
      setSelectedCustomer("");
      setSelectedLocation("");
      setSelectedWarehouse("");
    }
  }, [open, defaultVbpoId]);

  const vbpoOptions = (purchaseOrders || []).map((po: any) => ({
    value: po._id,
    label: po.vbpoNo || "Unknown VBPO"
  }));

  const customerOptions = (customers || []).map((c: any) => ({
    value: c._id,
    label: c.companyName || c.email || "Unknown Customer"
  }));

  const locationOptions = (() => {
    const selected = (customers || []).find((c: any) => c._id === selectedCustomer);
    if (!selected || !selected.location) return [];
    return selected.location.map((l: any) => ({
      value: l.vbId,
      label: l.locationName || l.vbId
    }));
  })();

  const warehouseOptions = (warehouses || []).map((w: any) => ({
    value: w._id || w.name,
    label: w.name
  }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVBPO) {
      toast.error("Please select an internal PO #");
      return;
    }

    setActionLoading(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    
    const newCPO = {
       _id: Math.random().toString(36).substr(2, 9),
       customerPONo: data.customerPONo || `CPO-${Math.floor(Math.random() * 10000)}`,
       date: data.poDate,
       requestedDelivery: data.requestedDelivery,
       customer: selectedCustomer,
       location: selectedLocation,
       warehouse: selectedWarehouse,
       qtyOrdered: Number(data.qtyOrdered) || 0,
       qtyReceived: 0,
       uom: data.uom,
       shipping: []
    };

    const targetPO = purchaseOrders.find((p: any) => p._id === selectedVBPO);
    if (!targetPO) {
        setActionLoading(false);
        return;
    }
    
    const updatedPO = JSON.parse(JSON.stringify(targetPO));
    if (!updatedPO.customerPO) updatedPO.customerPO = [];
    updatedPO.customerPO.unshift(newCPO);
    
    try {
      const res = await fetch(`/api/admin/purchase-orders/${targetPO._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedPO)
      });
      if (res.ok) {
          toast.success("Customer PO added successfully");
          refetchPurchaseOrders();
          onClose();
      } else {
          toast.error("Failed to add Customer PO");
      }
    } catch(e) {
      toast.error("Error adding Customer PO");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-2xl bg-[#09090b] text-white border-zinc-800">
        <DialogHeader>
          <DialogTitle>Add Customer PO</DialogTitle>
          <DialogDescription className="sr-only">Add a new Customer PO</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>PO # (Internal)</Label>
              <SearchableSelect
                options={vbpoOptions}
                value={selectedVBPO}
                onChange={setSelectedVBPO}
                placeholder="Select Internal PO"
              />
            </div>
            <div className="space-y-2">
              <Label>Customer PO #</Label>
              <Input name="customerPONo" placeholder="e.g. CPO-2024-001" className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Customer Ref</Label>
              <SearchableSelect
                options={customerOptions}
                value={selectedCustomer}
                onChange={setSelectedCustomer}
                placeholder="Select Customer"
              />
            </div>
            <div className="space-y-2">
              <Label>Customer Location</Label>
              <SearchableSelect
                options={locationOptions}
                value={selectedLocation}
                onChange={setSelectedLocation}
                placeholder="Select Location"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Dispatch Warehouse</Label>
              <SearchableSelect
                options={warehouseOptions}
                value={selectedWarehouse}
                onChange={setSelectedWarehouse}
                placeholder="Select Warehouse"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>PO Date</Label>
              <Input name="poDate" type="date" className="bg-zinc-900 border-zinc-800 text-white dark:[color-scheme:dark]" />
            </div>
            <div className="space-y-2">
              <Label>Requested Delivery</Label>
              <Input name="requestedDelivery" type="date" className="bg-zinc-900 border-zinc-800 text-white dark:[color-scheme:dark]" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Qty Ordered</Label>
              <Input name="qtyOrdered" type="number" min="0" className="bg-zinc-900 border-zinc-800 text-white" />
            </div>
            <div className="space-y-2">
              <Label>Received (Auto-computed)</Label>
              <Input value="0" readOnly disabled className="bg-zinc-900/50 border-zinc-800 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Label>UOM</Label>
              <select name="uom" className="w-full h-9 rounded-md bg-zinc-900 border border-zinc-800 px-3 text-sm text-white">
                <option value="">Select UOM</option>
                <option value="Boxes">Boxes</option>
                <option value="Pieces">Pieces</option>
                <option value="Pallets">Pallets</option>
                <option value="Kgs">Kgs</option>
                <option value="Lbs">Lbs</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={actionLoading} className="text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800">Cancel</Button>
            <Button type="submit" disabled={actionLoading} className="bg-blue-600 hover:bg-blue-700 text-white">Save Changes</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
