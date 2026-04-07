"use client";

import { useEffect, useState, useMemo } from "react";
import { useUserDataStore } from "@/store/useUserDataStore";
import { ArrowLeft, ArrowRight, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHeaderActions } from "@/components/providers/header-actions-provider";
import { useRouter } from "next/navigation";
import { AddPurchaseOrderDialog } from "@/components/admin/add-purchase-order-dialog";

export default function AndresTrackerPage() {
  const router = useRouter();
  const { setLeftContent, setRightContent } = useHeaderActions();
  const [isAddPOOpen, setIsAddPOOpen] = useState(false);
  const { 
    purchaseOrders, 
    isLoading, 
    products: storeProducts,
    customers: storeCustomers,
    suppliers: storeSuppliers
  } = useUserDataStore();
  
  const [vbpoSort, setVbpoSort] = useState<{
    key: "vbpoNo" | "date" | "containers" | "remaining" | "products";
    dir: "asc" | "desc";
  }>({ key: "date", dir: "desc" });

  const [shipSort, setShipSort] = useState<{
    key: "svbid" | "customer" | "customerPONo" | "supplier" | "productsStr" | "BOLNumber" | "containerNo" | "updatedETA";
    dir: "asc" | "desc";
  }>({ key: "updatedETA", dir: "asc" });

  const [activePOForDrilldown, setActivePOForDrilldown] = useState<any | null>(null);
  const [activeCPOForDrilldown, setActiveCPOForDrilldown] = useState<any | null>(null);

  const sortedPOs = useMemo(() => {
    // fast O(1) map for product ID to Name
    const productMap = new Map();
    if (storeProducts && Array.isArray(storeProducts)) {
      storeProducts.forEach(p => {
        if (p._id && p.name) productMap.set(p._id, p.name);
      });
    }

    let base = [...(purchaseOrders || [])]
      .filter((po) => !po.isArchived)
      .map((po) => {
        let containerCount = 0;
        let remainingCount = 0;
        const productsSet = new Set<string>();

        po.customerPO?.forEach((cpo: any) => {
          if (cpo.shipping && Array.isArray(cpo.shipping)) {
            containerCount += cpo.shipping.length;
            cpo.shipping.forEach((ship: any) => {
              const s = (ship.status || "").toLowerCase().trim();
              if (s !== "delivered" && s !== "arrived") {
                remainingCount++;
              }
              if (ship.products && Array.isArray(ship.products)) {
                ship.products.forEach((pid: string) => {
                  const pName = productMap.get(pid);
                  if (pName) productsSet.add(pName);
                });
              }
            });
          }
        });

        return { 
          ...po, 
          containerCount,
          remainingCount,
          productsStr: Array.from(productsSet).join(", ")
        };
      });

    base.sort((a, b) => {
      let aVal, bVal;
      switch (vbpoSort.key) {
        case "vbpoNo":
          aVal = a.vbpoNo?.toLowerCase() || "";
          bVal = b.vbpoNo?.toLowerCase() || "";
          break;
        case "date":
          aVal = a.date ? new Date(a.date).getTime() : 0;
          bVal = b.date ? new Date(b.date).getTime() : 0;
          break;
        case "containers":
          aVal = (a as any).containerCount;
          bVal = (b as any).containerCount;
          break;
        case "remaining":
          aVal = (a as any).remainingCount;
          bVal = (b as any).remainingCount;
          break;
        case "products":
          aVal = (a as any).productsStr.toLowerCase();
          bVal = (b as any).productsStr.toLowerCase();
          break;
      }
      if (aVal < bVal) return vbpoSort.dir === "asc" ? -1 : 1;
      if (aVal > bVal) return vbpoSort.dir === "asc" ? 1 : -1;
      return 0;
    });

    return base;
  }, [purchaseOrders, vbpoSort, storeProducts]);

  const toggleVbpoSort = (key: typeof vbpoSort.key) => {
    setVbpoSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc"
    }));
  };

  const sortedShippings = useMemo(() => {
    const productMap = new Map();
    if (storeProducts && Array.isArray(storeProducts)) storeProducts.forEach(p => { if (p._id && p.name) productMap.set(p._id, p.name); });
    
    const customerMap = new Map();
    if (storeCustomers && Array.isArray(storeCustomers)) {
      storeCustomers.forEach(c => { 
        if (c._id && c.name) customerMap.set(c._id, c.name); 
        if (c.vbId && c.name) customerMap.set(c.vbId, c.name);
      });
    }
    
    const supplierMap = new Map();
    if (storeSuppliers && Array.isArray(storeSuppliers)) {
      storeSuppliers.forEach(s => { 
        if (s._id && s.name) supplierMap.set(s._id, s.name); 
        if (s.vbId && s.name) supplierMap.set(s.vbId, s.name);
      });
    }

    let flatList: any[] = [];
    
    (purchaseOrders || []).filter(po => !po.isArchived).forEach(po => {
      (po.customerPO || []).forEach((cpo: any) => {
        (cpo.shipping || []).forEach((ship: any) => {
          const status = (ship.status || "").toLowerCase().trim();
          if (status !== "delivered" && status !== "arrived") {
            const cname = customerMap.get(cpo.customer) || cpo.customer || "-";
            const sname = supplierMap.get(ship.supplier) || ship.supplier || "-";
            const pNames = (ship.products && Array.isArray(ship.products)) 
              ? ship.products.map((id:string) => productMap.get(id) || id).join(", ") 
              : "—";
            
            flatList.push({
              ...ship,
              customerName: cname,
              customerPONo: cpo.customerPONo || "-",
              supplierName: sname,
              productsStr: pNames,
              parentPoId: po._id
            });
          }
        });
      });
    });

    flatList.sort((a, b) => {
      let aVal, bVal;
      switch(shipSort.key) {
        case "svbid": aVal = a.svbid?.toLowerCase() || ""; bVal = b.svbid?.toLowerCase() || ""; break;
        case "customer": aVal = a.customerName?.toLowerCase() || ""; bVal = b.customerName?.toLowerCase() || ""; break;
        case "customerPONo": aVal = a.customerPONo?.toLowerCase() || ""; bVal = b.customerPONo?.toLowerCase() || ""; break;
        case "supplier": aVal = a.supplierName?.toLowerCase() || ""; bVal = b.supplierName?.toLowerCase() || ""; break;
        case "productsStr": aVal = a.productsStr?.toLowerCase() || ""; bVal = b.productsStr?.toLowerCase() || ""; break;
        case "BOLNumber": aVal = a.BOLNumber?.toLowerCase() || ""; bVal = b.BOLNumber?.toLowerCase() || ""; break;
        case "containerNo": aVal = a.containerNo?.toLowerCase() || ""; bVal = b.containerNo?.toLowerCase() || ""; break;
        case "updatedETA": 
          aVal = a.updatedETA ? new Date(a.updatedETA).getTime() : 0; 
          bVal = b.updatedETA ? new Date(b.updatedETA).getTime() : 0; 
          break;
      }
      if (aVal < bVal) return shipSort.dir === "asc" ? -1 : 1;
      if (aVal > bVal) return shipSort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return flatList;
  }, [purchaseOrders, shipSort, storeProducts, storeCustomers, storeSuppliers]);

  const toggleShipSort = (key: typeof shipSort.key) => {
    setShipSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc"
    }));
  };

  useEffect(() => {
    setLeftContent(
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Andres Tracker
        </h1>
      </div>
    );

    setRightContent(null);

    return () => {
      setLeftContent(null);
      setRightContent(null);
    };
  }, [setLeftContent, setRightContent, router]);

  return (
    <div className="max-w-[2000px] mx-auto animate-in fade-in duration-500 h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 overflow-hidden">
        
        {/* Column 1: VBPOs */}
        <div className="flex flex-col bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden h-full shadow-sm">
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-primary" />
              <h2 className="font-bold text-sm uppercase tracking-wider">VBPOs</h2>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2 shadow-sm rounded-md border-primary/20 hover:bg-primary/5" onClick={() => setIsAddPOOpen(true)}>
              Add New
            </Button>
          </div>
          <div className="flex-1 overflow-auto bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
            {isLoading ? (
              <div className="text-xs text-muted-foreground text-center py-10 opacity-60">Loading...</div>
            ) : sortedPOs.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-10 opacity-60 italic">No VBPOs found</div>
            ) : (
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800/80 backdrop-blur-md shadow-sm z-10 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-bold cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleVbpoSort("vbpoNo")}>
                      PO # {vbpoSort.key === "vbpoNo" && (vbpoSort.dir === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-3 py-2 font-bold cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleVbpoSort("date")}>
                      Date {vbpoSort.key === "date" && (vbpoSort.dir === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-3 py-2 font-bold cursor-pointer hover:text-foreground transition-colors max-w-[120px]" onClick={() => toggleVbpoSort("products")}>
                      Products {vbpoSort.key === "products" && (vbpoSort.dir === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-3 py-2 font-bold cursor-pointer hover:text-foreground transition-colors text-center" onClick={() => toggleVbpoSort("containers")}>
                      Cont. {vbpoSort.key === "containers" && (vbpoSort.dir === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-3 py-2 font-bold cursor-pointer hover:text-foreground transition-colors text-center" onClick={() => toggleVbpoSort("remaining")}>
                      Balance {vbpoSort.key === "remaining" && (vbpoSort.dir === "asc" ? "↑" : "↓")}
                    </th>
                  </tr>
                </thead>
                <tbody className="text-[10px] sm:text-[11px] divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {sortedPOs.map((po) => {
                    return (
                      <tr key={po._id} onClick={() => { setActivePOForDrilldown(po); setActiveCPOForDrilldown(null); }} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group">
                        <td className="px-3 py-2.5 font-bold text-foreground">
                          {po.vbpoNo || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground font-medium">
                          {po.date ? new Date(po.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "-"}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[120px]" title={(po as any).productsStr}>
                          {(po as any).productsStr || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            {(po as any).containerCount}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`font-bold px-1.5 py-0.5 rounded ${(po as any).remainingCount > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"}`}>
                            {(po as any).remainingCount}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Column 2: Shippments */}
        <div className="flex flex-col bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden h-full shadow-sm">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-blue-500" />
            <h2 className="font-bold text-sm uppercase tracking-wider">Shippments</h2>
          </div>
          <div className="flex-1 overflow-auto bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
            {isLoading ? (
              <div className="text-xs text-muted-foreground text-center py-10 opacity-60">Loading...</div>
            ) : sortedShippings.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-10 opacity-60 italic">No shippings found</div>
            ) : (
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800/80 backdrop-blur-md shadow-sm z-10 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-bold cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleShipSort("svbid")}>
                      SVB {shipSort.key === "svbid" && (shipSort.dir === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-3 py-2 font-bold cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleShipSort("customer")}>
                      Customer {shipSort.key === "customer" && (shipSort.dir === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-3 py-2 font-bold cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleShipSort("customerPONo")}>
                      CPO # {shipSort.key === "customerPONo" && (shipSort.dir === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-3 py-2 font-bold cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleShipSort("supplier")}>
                      Supplier {shipSort.key === "supplier" && (shipSort.dir === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-3 py-2 font-bold cursor-pointer hover:text-foreground transition-colors max-w-[120px]" onClick={() => toggleShipSort("productsStr")}>
                      Products {shipSort.key === "productsStr" && (shipSort.dir === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-3 py-2 font-bold cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleShipSort("BOLNumber")}>
                      BOL {shipSort.key === "BOLNumber" && (shipSort.dir === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-3 py-2 font-bold cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleShipSort("containerNo")}>
                      Container {shipSort.key === "containerNo" && (shipSort.dir === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-3 py-2 font-bold cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleShipSort("updatedETA")}>
                      ETA {shipSort.key === "updatedETA" && (shipSort.dir === "asc" ? "↑" : "↓")}
                    </th>
                  </tr>
                </thead>
                <tbody className="text-[10px] sm:text-[11px] divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {sortedShippings.map((ship, idx) => (
                    <tr key={`${ship.svbid}-${idx}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group">
                      <td className="px-3 py-2.5 font-bold text-blue-600 dark:text-blue-400">
                        {ship.svbid || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-foreground font-medium truncate max-w-[120px]" title={ship.customerName}>
                        {ship.customerName}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-muted-foreground">
                        {ship.customerPONo}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[100px]" title={ship.supplierName}>
                        {ship.supplierName}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground truncate max-w-[120px]" title={ship.productsStr}>
                        {ship.productsStr}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-muted-foreground text-[10px]">
                        {ship.BOLNumber || "-"}
                      </td>
                      <td className="px-3 py-2.5 font-semibold">
                        {ship.containerNo || "-"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded font-bold ${ship.updatedETA && new Date(ship.updatedETA) < new Date() ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                          {ship.updatedETA ? new Date(ship.updatedETA).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "-"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Column 3: Customer POs */}
        <div className="flex flex-col bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden h-full shadow-sm">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-emerald-500" />
            <h2 className="font-bold text-sm uppercase tracking-wider">Customer POs</h2>
          </div>
          <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
            <div className="text-xs text-muted-foreground text-center py-10 opacity-60 italic">
              Awaiting column definitions...
            </div>
          </div>
        </div>

        {/* Column 4: Inventory */}
        <div className="flex flex-col bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden h-full shadow-sm">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-orange-500" />
            <h2 className="font-bold text-sm uppercase tracking-wider">Inventory</h2>
          </div>
          <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
            <div className="text-xs text-muted-foreground text-center py-10 opacity-60 italic">
              Awaiting column definitions...
            </div>
          </div>
        </div>

      </div>
      <AddPurchaseOrderDialog open={isAddPOOpen} onOpenChange={setIsAddPOOpen} />

      {/* Drill-down PO Modal */}
      {activePOForDrilldown && (
        <div className="fixed inset-0 z-50 flex py-10 px-4 items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setActivePOForDrilldown(null)}>
          <div className="bg-white dark:bg-zinc-950 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-full border border-zinc-200 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
            <div className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                {activeCPOForDrilldown && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setActiveCPOForDrilldown(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <div>
                  <h2 className="text-lg font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    {activeCPOForDrilldown ? `Shippings for ${activeCPOForDrilldown.customerPONo || "Un-numbered PO"}` : `Customer POs — ${activePOForDrilldown.vbpoNo}`}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {activeCPOForDrilldown ? `Product: ${activeCPOForDrilldown.product || "Unknown"}` : `Date: ${new Date(activePOForDrilldown.date).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setActivePOForDrilldown(null)}>Close</Button>
            </div>
            
            <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-black p-4">
              {!activeCPOForDrilldown ? (
                // Customer POs Table
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-zinc-950">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground uppercase text-[10px] tracking-wider font-bold">
                      <tr>
                        <th className="px-4 py-3">Cust PO #</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Qty Ordered</th>
                        <th className="px-4 py-3 text-center">Shippings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                      {(!activePOForDrilldown.customerPO || activePOForDrilldown.customerPO.length === 0) ? (
                        <tr><td colSpan={5} className="py-12 text-center text-muted-foreground italic">No Customer POs attached.</td></tr>
                      ) : (
                        activePOForDrilldown.customerPO.map((cpo: any, idx: number) => {
                          const shipCount = cpo.shipping?.length || 0;
                          return (
                            <tr key={idx} onClick={() => setActiveCPOForDrilldown(cpo)} className="hover:bg-primary/5 cursor-pointer transition-colors group">
                              <td className="px-4 py-3 font-semibold text-primary group-hover:underline underline-offset-4">{cpo.customerPONo || "-"}</td>
                              <td className="px-4 py-3 font-medium">{cpo.customer || "-"}</td>
                              <td className="px-4 py-3 text-muted-foreground">{cpo.product || "-"}</td>
                              <td className="px-4 py-3 font-medium bg-zinc-50 dark:bg-zinc-900/40">{cpo.qtyOrdered?.toLocaleString() || "0"}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${shipCount > 0 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-zinc-100 text-zinc-500"}`}>
                                  {shipCount}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                // Shippings Table
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-zinc-950 animate-in slide-in-from-right-4 duration-300">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground uppercase text-[10px] tracking-wider font-bold">
                      <tr>
                        <th className="px-4 py-3">Container #</th>
                        <th className="px-4 py-3">Carrier</th>
                        <th className="px-4 py-3">BOL </th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">ETA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                      {(!activeCPOForDrilldown.shipping || activeCPOForDrilldown.shipping.length === 0) ? (
                        <tr><td colSpan={5} className="py-12 text-center text-muted-foreground italic">No Shippings found for this CPO.</td></tr>
                      ) : (
                        activeCPOForDrilldown.shipping.map((ship: any, idx: number) => {
                          const status = (ship.status || "Pending").replace(/_/g, " ").toUpperCase();
                          const isDelivered = status === "DELIVERED" || status === "ARRIVED";
                          const isTransit = status === "ON WATER" || status === "IN TRANSIT";
                          return (
                            <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                              <td className="px-4 py-3 font-semibold">{ship.container || "-"}</td>
                              <td className="px-4 py-3">{ship.carrier || "-"}</td>
                              <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">{ship.BOLNumber || "-"}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isDelivered ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : isTransit ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                                  {status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-[11px]">
                                {ship.updatedETA ? new Date(ship.updatedETA).toLocaleDateString() : "-"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
