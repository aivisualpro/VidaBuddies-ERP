## Rule for the agent — terminal commands

Do NOT run npm install, npm run dev, npm run build, or any other terminal
command yourself. Whenever a step requires a command:

1. Stop.
2. Print the exact command in a code block.
3. Tell me: "Run this in your terminal and reply 'done' when finished."
4. Wait for my reply before continuing with file changes.

I will run all commands manually in my own terminal. This prevents the agent
from hanging on stuck processes.

# VidaBuddies ERP — Performance & Real-Time CRUD Migration

Run these prompts in order. Hand one prompt at a time to your AI agent and
review the diff before moving on.

---

## Rule for the agent — terminal commands

Do NOT run npm install, npm run dev, npm run build, or any other terminal
command yourself. Whenever a step requires a command:

1. Stop.
2. Print the exact command in a code block.
3. Tell me: "Run this in your terminal and reply 'done' when finished."
4. Wait for my reply before continuing with file changes.

I will run all commands manually in my own terminal. This prevents the agent
from hanging on stuck processes.

---

## Context (read first, do not run)

The audit revealed:

- **Root cause of slowness:** `/api/admin/init` loads 10 entities at boot AND
  gets re-called after every PO mutation via `refetchPurchaseOrders()`. Killing
  this pattern is the biggest win.
- **`/api/sync/versions` is a stub** for another app (LagniappePRO) on the same
  port. Ignore it.
- **Chat already has the right architecture** (Pusher + optimistic + presence).
  Do not touch `useChatStore` or chat hooks.
- **Zustand split:** TanStack Query will own server state (POs, products,
  suppliers, etc.). Zustand keeps client/UI state (`useChatStore`,
  `useNotificationStore` stay).
- **Existing good patterns to mimic:** the optimistic-with-rollback in
  `updateShippingField` on the PO detail page is the template for all mutation
  hooks.

---

## Prompt 1 — Install TanStack Query and wire the provider

```
Install TanStack Query (React Query) v5 and wire it up as the global data layer.

Steps:
1. Run: npm install @tanstack/react-query @tanstack/react-query-devtools
2. Create or update app/providers.tsx to wrap children in a QueryClientProvider with these defaults:
   - staleTime: 30_000 (30s — cuts duplicate fetches)
   - gcTime: 5 * 60_000 (5 min)
   - refetchOnWindowFocus: true
   - refetchOnReconnect: true
   - retry: 1
3. Create the QueryClient inside a useState so it's stable across renders.
4. Mount <ReactQueryDevtools initialIsOpen={false} /> inside the provider.
5. Make sure app/layout.tsx (or the protected layout) wraps {children} in this provider.

Do not migrate any existing fetch calls yet. Just confirm npm run dev still works and devtools open in the browser.
```

---

## Prompt 2 — Pilot migration: Purchase Orders only

```
We have a Zustand store useUserDataStore that currently holds 10 entities (POs, products, categories, users, suppliers, customers, carriers, warehouses, etc.) loaded via the single /api/admin/init mega-endpoint. This is the root cause of our 12-second slow boot and gets re-called every time something mutates.

Pilot the migration with Purchase Orders only.

1. Build:
   - hooks/queries/usePurchaseOrders.ts — list query, fetches /api/admin/purchase-orders (NOT /api/admin/init). If this endpoint doesn't exist as a standalone, create it server-side — it must return only POs.
   - hooks/queries/usePurchaseOrder.ts — detail query for /api/admin/purchase-orders/{id}
   - hooks/queries/usePurchaseOrderMutations.ts — useCreatePO, useUpdatePO, useDeletePO with optimistic updates and rollback.

2. Mutation pattern (apply to all three mutations):
   onMutate: async (vars) => {
     await queryClient.cancelQueries({ queryKey: ['purchase-orders'] })
     const previous = queryClient.getQueryData(['purchase-orders'])
     queryClient.setQueryData(['purchase-orders'], (old) => /* optimistic update */)
     return { previous }
   },
   onError: (err, vars, context) => {
     queryClient.setQueryData(['purchase-orders'], context.previous)
     toast.error('Failed — changes reverted')
   },
   onSettled: () => {
     queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
   }

3. Refactor /admin/purchase-orders/list and /admin/purchase-orders/[id] to use these hooks. Remove every fetch() in useEffect for POs. Remove calls to refetchPurchaseOrders() and fetchPO() after mutations — TanStack Query invalidation handles it.

4. The PO detail page currently fires 3 parallel fetches (PO, customer-POs, shipping). Keep them parallel, but each becomes its own useQuery with its own cache key.

5. The existing inline-edit optimistic pattern in updateShippingField is the template — replicate that behavior in the mutation hooks.

6. Do NOT remove the Zustand useUserDataStore yet. Leave it loading the other 9 entities so nothing else breaks.

7. Show me the diff before applying. After approval, verify:
   - Creating a PO updates the list instantly with no flicker.
   - Editing a PO updates the detail page instantly.
   - Deleting a PO removes it from the list instantly.
   - Failed mutations roll back.
   - Opening the same page twice does NOT make duplicate network requests.
```

---

## Prompt 3 — Roll out to remaining 9 resources

```
Apply the exact pattern from hooks/queries/usePurchaseOrder*.ts to every other resource still loaded by useUserDataStore and any other resource fetched directly in useEffect across the app.

Resources to migrate (find any I missed):
- Shipments (/admin/shipments/*)
- Products
- Categories
- Users (admin)
- Suppliers
- Customers
- Carriers
- Warehouses
- Timeline (/api/admin/timeline)
- VB Customer PO
- VB Shipping
- Notifications/reminders (the bell uses Zustand+Pusher — keep that, but add a query hook for the notifications LIST page if one exists)

DO NOT migrate:
- useChatStore
- useNotificationStore (the real-time bell store stays — only migrate notification list page if separate)
- Anything in /chat/* — chat is working correctly

For each resource:
1. Create useXxx (list), useXxxById (detail), useXxxMutations (create/update/delete with optimistic updates).
2. Refactor the corresponding pages and forms to use these hooks.
3. Remove fetch() in useEffect, router.refresh(), and manual refetch calls.
4. Once a resource is fully migrated, delete its slice from useUserDataStore.
5. After each resource, run dev server and verify the page works.

When useUserDataStore has nothing left to load:
- Delete useUserDataStore.
- Delete StoreInitializer.
- Delete /api/admin/init route handler.
- Verify boot is fast and no console errors.

Do one resource at a time. Show me the diff for each before moving to the next.
```

---

## Prompt 4 — URL-driven search & filters

```
Goal: every list/table page in this Next.js 16 app should keep its search input, filters, sort, and pagination state in the URL query string. Back/forward should work, URLs should be shareable, refresh should preserve state.

Pattern (Next 16 App Router):
- Use useSearchParams and useRouter from "next/navigation".
- Build hooks/useUrlState.ts: returns [value, setValue] for a single query param. Updates URL via router.replace(pathname + '?' + params.toString(), { scroll: false }).
- Build hooks/useUrlFilters.ts: takes a defaults object, returns { filters, setFilter, setFilters, resetFilters }. Empty/default values must be stripped from the URL so URLs stay clean.
- Debounce text search inputs by 300ms before pushing to URL — otherwise every keystroke creates a history entry.
- Use router.replace (not push) for filter/search changes so back-button doesn't replay every keystroke.
- Initial state reads FROM the URL on mount — never default to empty if the URL has a value.

Tasks:
1. Create both hooks.
2. Find every page with list/table/search/filter UI. Grep for useState calls paired with words: search, filter, sort, page, status, query.
3. Refactor each page to use the new hooks. Replace local useState for search/filter/sort/page values with useUrlFilters.
4. The TanStack Query hooks from earlier prompts already accept filters as arguments — pass the URL-derived filters straight into them. The queryKey will include filters automatically, so cache works correctly per filter combo.
5. Preserve existing behavior: same filter options, same default sort, same page size.

Pages to cover (find more if I missed any):
- /admin/shipments/list
- /admin/purchase-orders/list
- /admin/live-shipments
- Any /inventory page
- Any admin list page

Test plan:
- Apply a filter → copy URL → open in new tab → same filtered view loads.
- Apply a filter → navigate away → hit back → filter restored.
- Refresh mid-filter → filter persists.
- Clear filter → URL removes the param cleanly (no ?status=).

Show me the diff for /admin/shipments/list first. After I approve the pattern, roll to the rest.
```

---

## Prompt 5 — Real-time CRUD invalidation via Pusher

```
Chat and notifications already use Pusher correctly. Do not touch them.

For the admin CRUD resources migrated to TanStack Query (POs, shipments, products, etc.), wire Pusher events to query invalidation so changes from other users appear without a refresh.

1. On the server, after each successful POST/PUT/DELETE for a resource, trigger a Pusher event on a workspace-wide channel:
   - Channel: private-workspace-{tenantId} (or private-workspace-global if there's no multi-tenant model)
   - Event name: {resource}:changed (e.g. purchase-orders:changed, shipments:changed)
   - Payload: { id, action: 'create' | 'update' | 'delete' }

2. Create components/RealtimeInvalidator.tsx, mounted in the protected layout. Inside:
   - Subscribe once on mount to private-workspace-{tenantId}.
   - For each {resource}:changed event, call queryClient.invalidateQueries({ queryKey: [resource] }) or invalidate the specific id if needed.
   - Unsubscribe on unmount.

3. Clean up the duplicate chat subscription:
   - hooks/use-chat-pusher.ts uses event names (new-message, message-updated) that the server does NOT emit.
   - The active hook is hooks/use-chat.ts (uses message:new, message:edit, etc.).
   - Delete use-chat-pusher.ts after confirming nothing imports it.

Verify: open two browser windows, edit a PO in one, see it update in the other within 1 second.
```

---

## Prompt 6 — Perceived performance polish

```
Make the perceived performance match the new architecture.

1. Top progress bar that shows while any TanStack Query is fetching in the background. Use useIsFetching() from @tanstack/react-query. A 2px bar fixed to the top in the brand color is enough.

2. Toasts on mutation success/error. If a toast library isn't already in use, install sonner. Success toasts: 1.5s. Error toasts: stay until dismissed.

3. Skeleton loaders on FIRST load only. Once data is cached, never show a skeleton again — render cached data immediately, let background refetch update silently. This is the stale-while-revalidate pattern and it's the single biggest perceived-speed win.

4. Wrap each major page section in <Suspense> boundaries so they hydrate independently.

5. Remove every "Refresh" or "Sync" button from list pages. They are not needed anymore. TanStack Query handles refetch on focus, on reconnect, and on Pusher events.

After this, hitting back/forward between pages feels instant because cached data renders immediately.
```

---

## Execution order

1. Prompt 1 — install TanStack Query
2. Prompt 2 — pilot on POs, review diff
3. Prompt 3 — roll out to remaining resources, one at a time
4. Prompt 4 — URL-driven filters
5. Prompt 5 — Pusher invalidation
6. Prompt 6 — UX polish

Do not skip ahead. After Prompt 2 the slowness on PO pages already drops. After
Prompt 3 the 12-second boot disappears. After Prompt 5 the app feels real-time
across users.
