import { create } from "zustand";

interface UserDataState {
  isInitialized: boolean;
  isLoading: boolean;
  
  purchaseOrders: any[];
  releaseRequests: any[];
  products: any[];
  categories: any[];
  warehouses: any[];
  suppliers: any[];
  customers: any[];
  users: any[];
  carriers: any[];
  andresTracker: any[];
  liveShipments: any[];

  // Action methods
  fetchInitialData: () => Promise<void>;
  refreshData: () => Promise<void>;
  resetStore: () => void;
  
  // Specific refetch methods if they only want to update one entity type after a mutation
  refetchPurchaseOrders: () => Promise<void>;
  refetchReleaseRequests: () => Promise<void>;
  refetchProducts: () => Promise<void>;
  refetchCategories: () => Promise<void>;
  refetchWarehouses: () => Promise<void>;
  refetchSuppliers: () => Promise<void>;
  refetchCustomers: () => Promise<void>;
  refetchUsers: () => Promise<void>;
  refetchCarriers: () => Promise<void>;
  refetchAndresTracker: () => Promise<void>;
  refetchLiveShipments: () => Promise<void>;
}

export const useUserDataStore = create<UserDataState>((set, get) => ({
  isInitialized: false,
  isLoading: false,
  
  purchaseOrders: [],
  releaseRequests: [],
  products: [],
  categories: [],
  warehouses: [],
  suppliers: [],
  customers: [],
  users: [],
  carriers: [],
  andresTracker: [],
  liveShipments: [],

  resetStore: () => set({
    isInitialized: false,
    isLoading: false,
    purchaseOrders: [],
    releaseRequests: [],
    products: [],
    categories: [],
    warehouses: [],
    suppliers: [],
    customers: [],
    users: [],
    carriers: [],
    andresTracker: [],
    liveShipments: [],
  }),

  fetchInitialData: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true });
    try {
      // Parallelize to be instant
      const [pos, releases, prods, cats, stores, sups, custs, usrs, cars, andres, live] = await Promise.all([
        fetch("/api/admin/purchase-orders").then(r => r.json()),
        fetch("/api/admin/release-requests").then(r => r.json()),
        fetch("/api/admin/products").then(r => r.json()),
        fetch("/api/admin/categories").then(r => r.json()),
        fetch("/api/admin/warehouse").then(r => r.json()),
        fetch("/api/admin/suppliers").then(r => r.json()),
        fetch("/api/admin/customers").then(r => r.json()),
        fetch("/api/admin/users").then(r => r.json()),
        fetch("/api/admin/carriers").then(r => r.ok ? r.json() : []), // Handle 404s gracefully just in case
        fetch("/api/admin/andres-tracker").then(r => r.ok ? r.json() : []),
        fetch("/api/admin/live-shipments").then(r => r.ok ? r.json() : [])
      ]);
      set({
        purchaseOrders: pos,
        releaseRequests: releases,
        products: prods,
        categories: cats,
        warehouses: stores,
        suppliers: sups,
        customers: custs,
        users: usrs,
        carriers: cars,
        andresTracker: andres,
        liveShipments: live,
        isInitialized: true,
        isLoading: false
      });
    } catch (error) {
       console.error("Store init failed", error);
       set({ isLoading: false }); 
    }
  },

  refreshData: async () => {
    set({ isLoading: true });
    try {
      const [pos, releases, prods, cats, stores, sups, custs, usrs, cars, andres, live] = await Promise.all([
        fetch("/api/admin/purchase-orders").then(r => r.json()),
        fetch("/api/admin/release-requests").then(r => r.json()),
        fetch("/api/admin/products").then(r => r.json()),
        fetch("/api/admin/categories").then(r => r.json()),
        fetch("/api/admin/warehouse").then(r => r.json()),
        fetch("/api/admin/suppliers").then(r => r.json()),
        fetch("/api/admin/customers").then(r => r.json()),
        fetch("/api/admin/users").then(r => r.json()),
        fetch("/api/admin/carriers").then(r => r.ok ? r.json() : []),
        fetch("/api/admin/andres-tracker").then(r => r.ok ? r.json() : []),
        fetch("/api/admin/live-shipments").then(r => r.ok ? r.json() : [])
      ]);
      set({
        purchaseOrders: pos,
        releaseRequests: releases,
        products: prods,
        categories: cats,
        warehouses: stores,
        suppliers: sups,
        customers: custs,
        users: usrs,
        carriers: cars,
        andresTracker: andres,
        liveShipments: live,
        isLoading: false
      });
    } catch (error) {
       console.error("Store refresh failed", error);
       set({ isLoading: false });
    }
  },

  refetchPurchaseOrders: async () => {
    const data = await fetch("/api/admin/purchase-orders").then(r => r.json());
    set({ purchaseOrders: data });
  },
  refetchReleaseRequests: async () => {
    const data = await fetch("/api/admin/release-requests").then(r => r.json());
    set({ releaseRequests: data });
  },
  refetchProducts: async () => {
    const data = await fetch("/api/admin/products").then(r => r.json());
    set({ products: data });
  },
  refetchCategories: async () => {
    const data = await fetch("/api/admin/categories").then(r => r.json());
    set({ categories: data });
  },
  refetchWarehouses: async () => {
    const data = await fetch("/api/admin/warehouse").then(r => r.json());
    set({ warehouses: data });
  },
  refetchSuppliers: async () => {
    const data = await fetch("/api/admin/suppliers").then(r => r.json());
    set({ suppliers: data });
  },
  refetchCustomers: async () => {
    const data = await fetch("/api/admin/customers").then(r => r.json());
    set({ customers: data });
  },
  refetchUsers: async () => {
    const data = await fetch("/api/admin/users").then(r => r.json());
    set({ users: data });
  },
  refetchCarriers: async () => {
    const res = await fetch("/api/admin/carriers");
    if (res.ok) set({ carriers: await res.json() });
  },
  refetchAndresTracker: async () => {
    const res = await fetch("/api/admin/andres-tracker");
    if (res.ok) set({ andresTracker: await res.json() });
  },
  refetchLiveShipments: async () => {
    const res = await fetch("/api/admin/live-shipments");
    if (res.ok) set({ liveShipments: await res.json() });
  }
}));
