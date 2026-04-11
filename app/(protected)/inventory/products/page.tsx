"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useUserDataStore } from "@/store/useUserDataStore";
import { SimpleDataTable } from "@/components/admin/simple-data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash, Package, Layers, ChevronDown, ChevronRight, Warehouse, Building, ArrowUpDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import { ProductFormDialog } from "@/components/admin/product-form-dialog";
import { ProductsPageSkeleton } from "@/components/skeletons";

interface Product {
  _id: string;
  vbId: string;
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  relatedProducts?: string[];
  tags?: string[];
  costPrice?: number;
  salePrice?: number;
  coverImage?: string;
  primaryImage?: string;
  showCase?: string[];
  otherInfo?: { title: string; tags: string[] }[];
  isOnWebsite?: boolean;
  sNo?: string;
}

interface Category {
  _id: string;
  category: string;
  subcategories: { subcategory: string }[];
}




export default function ProductsPage() {
  const router = useRouter();
  
  const { 
    products: data, 
    categories, 
    isLoading,
    refetchProducts,
    purchaseOrders,
    releaseRequests,
    warehouses
  } = useUserDataStore();

  const whMap = useMemo(() => {
    const map = new Map<string, any>();
    if (Array.isArray(warehouses)) {
      warehouses.forEach((w: any) => {
        if (w._id) map.set(w._id.toString(), w);
        if (w.name) map.set(w.name, w);
      });
    }
    return map;
  }, [warehouses]);

  const stockBalances = useMemo(() => {
    const balances: Record<string, Record<string, number>> = {};

    if (Array.isArray(purchaseOrders)) {
      purchaseOrders.forEach(po => {
        if (po.isArchived || (po.orderType !== 'Inventory' && po.orderType !== 'INVENTORY')) return;
        (po.customerPO || []).forEach((cpo: any) => {
           if (cpo.product && cpo.warehouse) {
              const pid = typeof cpo.product === 'object' ? cpo.product._id : String(cpo.product);
              const wid = typeof cpo.warehouse === 'object' ? cpo.warehouse._id || cpo.warehouse.name : String(cpo.warehouse);
              if (!balances[pid]) balances[pid] = {};
              balances[pid][wid] = (balances[pid][wid] || 0) + (Number(cpo.qtyOrdered) || 0);
           }
        });
      });
    }

    if (Array.isArray(releaseRequests)) {
       releaseRequests.forEach(rr => {
         const wid = typeof rr.warehouse === 'object' ? rr.warehouse._id || rr.warehouse.name : String(rr.warehouse);
         if (wid) {
           (rr.releaseOrderProducts || []).forEach((rop: any) => {
             const pid = typeof rop.product === 'object' ? rop.product._id : String(rop.product);
             if (pid) {
                if (!balances[pid]) balances[pid] = {};
                balances[pid][wid] = (balances[pid][wid] || 0) - (Number(rop.qty) || 0);
             }
           });
         }
       });
    }

    return balances;
  }, [purchaseOrders, releaseRequests]);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);


  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      toast.success("Product deleted");
      refetchProducts();
    } catch (error) {
      toast.error("Failed to delete product");
    }
  };

  const openAddSheet = () => {
    setEditingItem(null);
    setIsSheetOpen(true);
  };

  const openEditSheet = (item: Product) => {
    setEditingItem(item);
    setIsSheetOpen(true);
  };

  // Sidebar Logic
  const handleCategoryClick = (catName: string) => {
    if (selectedCategory === catName) {
      // Toggle expansion
      if (expandedCategories.includes(catName)) {
        setExpandedCategories(prev => prev.filter(c => c !== catName));
      } else {
        setExpandedCategories(prev => [...prev, catName]);
      }
      // Ensure it is selected (already is)
      setSelectedSubcategory(null); 
    } else {
      // Select new category
      setSelectedCategory(catName);
      setSelectedSubcategory(null);
      // Auto expand
      if (!expandedCategories.includes(catName)) {
        setExpandedCategories(prev => [...prev, catName]);
      }
    }
  };

  const filteredData = data.filter(item => {
    if (selectedSubcategory) return item.subcategory === selectedSubcategory;
    if (selectedCategory) return item.category === selectedCategory;
    return true;
  });

  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: "primaryImage",
      header: "Image",
      cell: ({ row }) => (
        <div className="relative h-10 w-10 overflow-hidden rounded-md border bg-muted/50">
          {row.original.primaryImage ? (
            // eslint-disable-next-line @next/next/no-img-element
             <img 
               src={row.original.primaryImage} 
               alt={row.original.name}
               className="h-full w-full object-cover" 
             />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
               <Package className="h-4 w-4 text-muted-foreground opacity-50" />
            </div>
          )}
        </div>
      )
    },
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
           <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 -ml-2 text-xs font-semibold hover:bg-muted/50"
          >
            Name
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        )
      },
      cell: ({ row }) => <span>{row.original.name}</span>
    },
    {
      id: "balances",
      accessorFn: (row) => {
        const pBalances = stockBalances[row._id] || {};
        return Object.values(pBalances).reduce((sum, qty) => sum + qty, 0);
      },
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 -ml-2 text-xs font-semibold hover:bg-muted/50"
          >
            Stock by Warehouse
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const item = row.original;
        const pBalances = stockBalances[item._id] || {};
        
        const mergedBalances = new Map<string, number>();
        Object.entries(pBalances).forEach(([wid, qty]) => {
           let finalName = wid;
           const whObj = whMap.get(wid);
           if (whObj && whObj.name) finalName = whObj.name;
           
           mergedBalances.set(finalName, (mergedBalances.get(finalName) || 0) + qty);
        });

        const activeBalances = Array.from(mergedBalances.entries()).filter(([_, qty]) => qty !== 0);

        if (activeBalances.length === 0) return <span className="text-muted-foreground">-</span>;
        
        return (
          <div className="flex flex-wrap items-center gap-2">
            {activeBalances.map(([wName, qty], i) => (
               <Badge key={i} variant="outline" className="flex items-center gap-1 font-mono text-[10px] bg-muted/30">
                 <Warehouse className="h-3 w-3 text-primary opacity-70" />
                 <span className="truncate max-w-[80px]" title={wName}>{wName}</span>
                 <span className={`font-bold ${qty > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                   {qty}
                 </span>
               </Badge>
            ))}
          </div>
        );
      }
    },
    {
      accessorKey: "salePrice",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 -ml-2 text-xs font-semibold hover:bg-muted/50"
          >
            Sale Price
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const val = row.getValue("salePrice");
        return val ? `$${Number(val).toFixed(2)}` : "-";
      }
    },
    {
      accessorKey: "isOnWebsite",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 -ml-2 text-xs font-semibold hover:bg-muted/50"
          >
            Status
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <Badge variant={row.original.isOnWebsite ? "default" : "secondary"}>
          {row.original.isOnWebsite ? "On Website" : "Hidden"}
        </Badge>
      )
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEditSheet(item)}
              className="h-8 w-8 p-0"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDelete(item._id)}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Delete"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  if (isLoading) {
    return <ProductsPageSkeleton />;
  }

  return (
    <div className="w-full h-full flex gap-4 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 flex-none border rounded-lg bg-card flex flex-col overflow-hidden h-full">
        <div className="h-12 flex items-center px-4 border-b bg-card shadow-sm z-10">
           <h2 className="font-semibold flex items-center gap-2 text-sm">
             <Layers className="h-4 w-4" />
             Categories
           </h2>
        </div>
        <ScrollArea className="flex-1">
           <div className="p-2 space-y-1">
              {/* All Products */}
              <Button
                 variant="ghost"
                 className={`w-full justify-between font-normal ${
                    !selectedCategory 
                    ? "bg-primary/10 text-primary hover:bg-primary/20" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                 }`}
                 onClick={() => { setSelectedCategory(null); setSelectedSubcategory(null); }}
              >
                 <span>All Products</span>
                 <Badge 
                    variant="secondary" 
                    className={`ml-auto text-xs h-5 px-1.5 min-w-[1.25rem] justify-center rounded-full ${
                        !selectedCategory 
                        ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                        : "bg-muted text-muted-foreground"
                    }`}
                 >
                    {data.length}
                 </Badge>
              </Button>

              {categories.map(cat => {
                 const catCount = data.filter(p => p.category === cat.category).length;
                 const isCatActive = selectedCategory === cat.category && !selectedSubcategory;
                 
                 return (
                   <div key={cat._id} className="space-y-1">
                      <Button
                         variant="ghost"
                         className={`w-full justify-between font-normal group ${
                            selectedCategory === cat.category 
                            ? "text-primary font-medium" 
                            : "text-muted-foreground"
                         } ${isCatActive ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-muted"}`}
                         onClick={() => handleCategoryClick(cat.category)}
                      >
                         <span className="truncate">{cat.category}</span>
                         <div className="flex items-center gap-2">
                           <Badge 
                              variant="secondary" 
                              className={`text-xs h-5 px-1.5 min-w-[1.25rem] justify-center rounded-full ${
                                isCatActive 
                                ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                                : "bg-muted text-muted-foreground group-hover:bg-background"
                              }`}
                           >
                              {catCount}
                           </Badge>
                           {expandedCategories.includes(cat.category) ? (
                             <ChevronDown className={`h-4 w-4 opacity-50 ${selectedCategory === cat.category ? "text-primary" : ""}`} />
                           ) : (
                             <ChevronRight className={`h-4 w-4 opacity-50 ${selectedCategory === cat.category ? "text-primary" : ""}`} />
                           )}
                         </div>
                      </Button>
                      
                      {expandedCategories.includes(cat.category) && (
                        <div className="pl-4 space-y-1 border-l ml-4 border-border/50">
                           {cat.subcategories?.map((sub: any, idx: number) => {
                             const subCount = data.filter(p => p.category === cat.category && p.subcategory === sub.subcategory).length;
                             const isSubActive = selectedSubcategory === sub.subcategory;
                             
                             return (
                               <Button
                                 key={idx}
                                 variant="ghost"
                                 className={`w-full justify-between h-8 text-sm font-normal ${
                                    isSubActive 
                                    ? "bg-primary/10 text-primary hover:bg-primary/20" 
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                 }`}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setSelectedCategory(cat.category);
                                   setSelectedSubcategory(sub.subcategory);
                                 }}
                               >
                                 <span className="truncate">{sub.subcategory}</span>
                                 <Badge 
                                    variant="secondary" 
                                    className={`ml-auto text-[10px] h-4 px-1 min-w-[1rem] justify-center rounded-full ${
                                       isSubActive 
                                       ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                                       : "bg-muted/50 text-muted-foreground"
                                    }`}
                                 >
                                    {subCount}
                                 </Badge>
                               </Button>
                             );
                           })}
                        </div>
                      )}
                   </div>
                 );
              })}
           </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col h-full">
        <SimpleDataTable
          columns={columns}
          data={filteredData}
          searchKey="name"
          onAdd={openAddSheet}
          title={selectedSubcategory || selectedCategory || "All Products"}
          showColumnToggle={false}
          onRowClick={(item) => router.push(`/inventory/products/${item._id}`)}
        />
      </div>

      <ProductFormDialog 
        open={isSheetOpen} 
        onOpenChange={setIsSheetOpen} 
        initialData={editingItem} 
        categories={categories}
        allProducts={data}
        onSuccess={refetchProducts}
      />
    </div>
  );
}
