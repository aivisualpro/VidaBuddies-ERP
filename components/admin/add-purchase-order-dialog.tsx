"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useUserDataStore } from "@/store/useUserDataStore";

export function AddPurchaseOrderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { purchaseOrders, refetchPurchaseOrders } = useUserDataStore();
  const [formData, setFormData] = useState({
    vbpoNo: "",
    orderType: "",
    category: "",
    createdBy: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (open) {
      // Auto-generate next VB PO #
      let nextVbpoNo = "VB1";
      if (purchaseOrders && purchaseOrders.length > 0) {
        const numbers = purchaseOrders
          .map((item: any) => {
            const match = item.vbpoNo?.match(/^VB(\d+)$/i);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter((n: number) => n > 0);
        if (numbers.length > 0) {
          const maxNum = Math.max(...numbers);
          nextVbpoNo = `VB${maxNum + 1}`;
        }
      }
      setFormData({
        vbpoNo: nextVbpoNo,
        orderType: "",
        category: "",
        createdBy: "",
        date: new Date().toISOString().split("T")[0],
      });
    }
  }, [open, purchaseOrders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/admin/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save");

      toast.success("Purchase Order created");
      onOpenChange(false);
      refetchPurchaseOrders();
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add Purchase Order</DialogTitle>
          <DialogDescription className="sr-only">
            Create a new purchase order
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="vbpoNo">VB PO #</Label>
              <div className="relative">
                <ShoppingCart className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="vbpoNo"
                  className="pl-9"
                  value={formData.vbpoNo}
                  onChange={(e) =>
                    setFormData({ ...formData, vbpoNo: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="date"
                  type="date"
                  className="pl-9"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  required
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="orderType">Order Type</Label>
              <select
                id="orderType"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={formData.orderType}
                onChange={(e) =>
                  setFormData({ ...formData, orderType: e.target.value })
                }
                required
              >
                <option value="" disabled>
                  Select type...
                </option>
                <option value="Export">Export</option>
                <option value="Import">Import</option>
                <option value="Dropship">Dropship</option>
                <option value="Inventory">Inventory</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                required
              >
                <option value="" disabled>
                  Select category...
                </option>
                <option value="CONVENTIONAL">Conventional</option>
                <option value="ORGANIC">Organic</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create PO</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
