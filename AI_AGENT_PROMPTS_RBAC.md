# Enterprise RBAC for vidaBuddiesERP — Flaws + AI Agent Prompts (step by step)

Feed each prompt to your AI coding agent **one at a time**. Run the app, click around as a non-admin, eyeball the result, then paste the next prompt.

---

## Part A — Flaws in the current setup (from a deep-dive of your repo)

Files I read: `lib/models/VidaAppRole.ts`, `app/(protected)/admin/settings/roles/page.tsx`, `app/(protected)/admin/settings/roles/[id]/page.tsx`, `app/api/admin/roles/route.ts`, `app/api/admin/roles/[id]/route.ts`, `components/app-sidebar.tsx`, `app/(protected)/layout.tsx`, `middleware.ts`, plus a sample of `/api/admin/*` routes (e.g. `app/api/admin/purchase-orders/route.ts`).

**Critical / security**

1. **Zero server-side enforcement.** `/api/admin/*` routes call `getSession()` only to stamp `createdBy`. There is no `assertCan(...)` anywhere. A regular user can `curl POST /api/admin/purchase-orders` and create records. The whole roles UI is cosmetic — only the sidebar reads it.
2. **`/api/admin/roles` is wide open.** Any authenticated user (even non-admins) can hit `POST /api/admin/roles` and edit any role.
3. **Schema defaults are open by default.** `VidaAppRole.permissions[*].actions.{view,create,edit,delete,approve,download}` all default to `true`. A freshly created role can do everything until an admin remembers to turn things off — that's a footgun, not RBAC.
4. **Roles join users by name string.** `VidaUser.AppRole` stores `"Manager"`, not a role `_id`. Renaming a role silently detaches every user.
5. **Permissions are baked at layout render time.** `app/(protected)/layout.tsx` fetches the role doc on first page load and passes it to `AppSidebar` as `initialPermissions`. Updating a role does NOT propagate to logged-in users until they hard-refresh. This directly contradicts "should work right away without refresh".

**Coverage gaps**

6. **Hard-coded `SYSTEM_MODULES` list** in the role editor. New menu items you add to the sidebar do not appear in the editor — exactly the symptom you described ("menu items are not there when we create after").
7. **Sidebar and role-editor names must match by raw string.** A typo (`"Purchase Orders"` vs `"Purchase orders"`) silently breaks the link.
8. **No sub-menu / tab level.** Only one level (module). You can't lock tabs like "Customer POs → List vs Card" or "Sales → Quote Builder vs Supplier Pricing".
9. **Field-level visibility is a stub.** Schema has `fieldScope: Map<String, Boolean>` but no server enforcement and no client consumer. The dialog mock-toggles fields only for a hard-coded subset `['Users', 'Customers', 'Products', 'Suppliers']`; everything else says "No fields".
10. **`MODULE_FIELDS` is hand-typed labels.** Storage keys are `field.toLowerCase().replace(/\s+/g, '_')` — collides across modules and drifts from the actual Mongoose schemas.
11. **No record-level scope.** No notion of "this role can only see records they created" vs "team's records" vs "all records".
12. **`approve` and `download` flags are stored but never enforced.**
13. **No audit log.** Permission changes leave no trace.
14. **No role clone / template / inheritance.** Every role starts from scratch.

**UX / polish**

15. The role-editor "Manage Fields" button mocks the dialog UI but does not persist non-`['Users','Customers','Products','Suppliers']` modules properly.
16. No "preview as this role" / impersonation for testing.
17. No bulk "apply this role to users".

---

## Part B — Prompts

### STEP 0 — Deep analysis (no code yet)

```
You are working in vidaBuddiesERP (Next.js 16 + React 19 + TS + Mongoose + Tailwind v4 + shadcn/ui).
Before writing ANY code, deeply analyze the existing RBAC and produce a written report.

DO THIS:
1. Read and summarize:
   - lib/models/VidaAppRole.ts
   - lib/models/VidaUser.ts (note AppRole is a string, not a ref)
   - app/(protected)/layout.tsx (how permissions are loaded at layout time)
   - components/app-sidebar.tsx (filterItems + initialPermissions wiring)
   - app/(protected)/admin/settings/roles/page.tsx
   - app/(protected)/admin/settings/roles/[id]/page.tsx (note SYSTEM_MODULES, MODULE_FIELDS, the gated 'Manage Fields' dialog)
   - app/api/admin/roles/route.ts and [id]/route.ts (note: no auth gate)
   - middleware.ts
   - 3 sample API routes under app/api/admin/* and confirm none call any RBAC check

2. Output a report covering:
   a) Every security flaw (server enforcement, open POST role, default-true permissions, role-by-name join).
   b) Every UX gap (hard-coded SYSTEM_MODULES, hard-coded MODULE_FIELDS, single-level menus, no scope, etc).
   c) An inventory of every navigation item rendered by components/app-sidebar.tsx (so we can compare against SYSTEM_MODULES).
   d) A list of all files you will create or modify in steps 1–9 with a one-line purpose each.
   e) A diagram (as ASCII or markdown bullets) of the new permission shape we're going to build:
      module → subModule → action → field → scope.

Do NOT write any code yet. Wait for me to paste STEP 1.
```

---

### STEP 1 — Single source of truth: the RBAC registry

```
Implement step 1 only.

GOAL: one file describes every module / sub-module / action / field / scope in the app.
Everything else (sidebar, role-editor UI, server enforcement) reads from it. Adding a new
menu item later is one entry — it appears in the roles UI automatically.

1. Create lib/rbac/registry.ts:

   export type ActionKey =
     | "view" | "create" | "edit" | "delete"
     | "approve" | "download" | "export" | "import";

   export type ScopeKey = "all" | "team" | "own" | "none";

   export interface FieldDef {
     key: string;           // canonical machine key (e.g. "costPrice")
     label: string;         // human label (e.g. "Cost Price")
     /** if true, this field is considered sensitive — defaults to hidden for new roles */
     sensitive?: boolean;
   }

   export interface SubModuleDef {
     key: string;           // e.g. "list"
     label: string;         // e.g. "List View"
     path?: string;         // optional href
     actions: ActionKey[];  // which actions are meaningful here
     fields?: FieldDef[];   // fields toggleable for this sub-module
     /** if true, this sub-module supports record scoping (own/team/all) */
     scopeable?: boolean;
     ownerField?: string;   // e.g. "createdBy" — required if scopeable
   }

   export interface ModuleDef {
     key: string;           // canonical module key (e.g. "purchaseOrders")
     label: string;         // human label (e.g. "Purchase Orders")
     group: "Admin" | "Inventory" | "Management" | "Sales" | "Reports" | "Settings";
     icon?: string;         // optional tabler/lucide icon name
     path?: string;
     actions: ActionKey[];
     fields?: FieldDef[];
     scopeable?: boolean;
     ownerField?: string;
     subModules?: SubModuleDef[];
   }

   export const RBAC_MODULES: ModuleDef[] = [ /* see step 2 below */ ];

2. Fill RBAC_MODULES with every module currently in components/app-sidebar.tsx. For each,
   list its real sub-modules (tabs/pages under it). Use these field lists for the modules
   that already exist — read the actual Mongoose schemas under lib/models/* and pull the
   field names from there, NOT a hand-written list. If a model has nested subdocs, expose
   them as dotted keys (e.g. "shipping.containerNo"). Mark these as `sensitive`:
   - VidaProduct: costPrice, salePrice
   - VidaUser: password (must be sensitive: true)
   - VidaSupplier: any pricing
   - any *.cost, *.price, *.margin field

3. Create a tiny script scripts/rbac-coverage.ts that:
   - imports the sidebar's nav config and RBAC_MODULES
   - prints any sidebar item that doesn't have a matching ModuleDef
   - prints any ModuleDef whose `path` does not exist in the sidebar
   Add an npm script "rbac:coverage" that runs it. The agent should run it and ensure 0
   mismatches before declaring this step done.

4. Add lib/rbac/types.ts re-exporting the public types so the rest of the codebase imports from one place.

OUTPUT: full text of registry.ts (long, that's expected) + coverage script + the npm script
exit-0 proof. Do NOT touch the role editor or sidebar yet.
```

---

### STEP 2 — Data model v2 + migration + role-by-id join

```
Implement step 2 only.

GOAL: replace the loose VidaAppRole shape with a hierarchical, deny-by-default schema and
join users to roles by ObjectId (not by name).

1. Update lib/models/VidaAppRole.ts:

   export interface IActionFlags {
     view: boolean; create: boolean; edit: boolean; delete: boolean;
     approve: boolean; download: boolean; export: boolean; import: boolean;
   }

   export interface ISubModulePermission {
     actions: Partial<IActionFlags>;
     /** field key → visible? (absent = inherit from parent; explicit false = hidden) */
     fields: Record<string, boolean>;
     scope?: "all" | "team" | "own" | "none";
   }

   export interface IModulePermission {
     actions: Partial<IActionFlags>;
     fields: Record<string, boolean>;
     scope?: "all" | "team" | "own" | "none";
     subModules: Record<string, ISubModulePermission>;
   }

   export interface IVidaAppRole extends Document {
     name: string;
     description?: string;
     /** if true: super-admin, bypasses all checks (only one allowed) */
     isSystem?: boolean;
     /** baseline: "deny-all" (recommended) or "inherit-from" another roleId */
     baseline: "deny-all" | "allow-all" | { inheritFromId: ObjectId };
     modules: Record<string, IModulePermission>;  // keyed by ModuleDef.key
     updatedBy?: ObjectId;
     createdAt: Date;
     updatedAt: Date;
   }

   Schema: store all action flags with default FALSE (deny-by-default), with the single
   exception of the seeded "Super Admin" role (isSystem: true).

2. Add a `roleId: ObjectId` field to VidaUser (ref VidaAppRole). Keep `AppRole` (the name
   string) for backwards-compat but mark it deprecated in the schema comments.

3. Migration script scripts/rbac-migrate.ts:
   a) Ensure a "Super Admin" role exists with isSystem=true and modules={} (bypass).
   b) For each existing role doc, convert legacy permissions[] into modules{} using
      the RBAC_MODULES registry. Unknown legacy module names go into a "_legacy" key
      that the UI surfaces as a warning until cleaned up.
   c) For each VidaUser, look up roleId by name from VidaAppRole and write it.
   d) Print a summary.

4. Create lib/rbac/policy.ts:
   - export `RolePolicy` class that wraps a IVidaAppRole doc and exposes:
       can(moduleKey, action, opts?: { subModule?, recordOwnerId?, currentUserId? }): boolean
       canField(moduleKey, fieldKey, opts?): boolean
       scopeFor(moduleKey, opts?): "all"|"team"|"own"|"none"
     Implements the resolution rules: subModule overrides module overrides baseline,
     sensitive fields default to FALSE unless explicitly allowed, isSystem=true short-circuits to true.

5. Add lib/models/RoleAuditLog.ts:
   { roleId, actor: { id, name, email }, diff: object, at: Date, ip?: string, userAgent?: string }
   Indexed by { roleId: 1, at: -1 }.

OUTPUT: model diffs + migration script + RolePolicy with unit tests in
tests/rbac/policy.test.ts using a tiny in-memory fixture. Run them and paste output.
```

---

### STEP 3 — Server-side enforcement (the heart of security)

```
Implement step 3 only.

GOAL: every /api/admin/* route is gated by RBAC. No exceptions. Default = 403.

1. Create lib/rbac/server.ts:
   - export `getActorPolicy()`: reads session, loads VidaUser → roleId → VidaAppRole, returns RolePolicy.
   - export `assertCan(actorPolicy, moduleKey, action, opts?)` → throws RbacForbidden if not allowed.
   - export `withRbac(handler, { module, action, subModule?, scopeable? })` → a tiny wrapper
     for Next.js route handlers (App Router). On 401/403 it returns a JSON error with the
     exact module/action that failed (so the audit log is rich).

2. Wrap every existing route in app/api/admin/** with withRbac(...). Use the registry to
   map URL paths to (module, action). Examples:
     POST   /api/admin/purchase-orders        → ("purchaseOrders", "create")
     PUT    /api/admin/purchase-orders/[id]   → ("purchaseOrders", "edit")
     DELETE /api/admin/purchase-orders/[id]   → ("purchaseOrders", "delete")
     GET    /api/admin/purchase-orders        → ("purchaseOrders", "view")
     POST   /api/admin/roles                  → ("settings.roles", "create")
   For any route that doesn't map cleanly, leave it and produce a "TODO RBAC" list at the
   end of the step. Do not silently skip.

3. Scope enforcement:
   - For GET list endpoints on `scopeable` modules: server uses policy.scopeFor(...) and
     applies a Mongo filter (e.g. `{ createdBy: session.email }` for "own").
   - For GET-by-id, edit, delete endpoints: load the record, check the ownerField against
     scopeFor; reject 403 if out of scope.

4. Field-level enforcement:
   - Read: pipe the response through `scrubFields(doc, policy, moduleKey, subModuleKey?)`.
     Sensitive fields the user can't see are deleted from the JSON.
   - Write (POST/PUT/PATCH): before saving, drop any keys the user is not allowed to write
     (or 422 if the user explicitly sent a value for a hidden field — your call; recommend
     silent drop with a structured warning header `X-Rbac-Dropped: costPrice,salePrice`).

5. Audit log: every grant/deny/save on a role writes to RoleAuditLog. Apply specifically to
   /api/admin/roles* routes. Non-role mutations don't audit (would be noisy).

6. Hardening:
   - The /api/admin/roles routes themselves require module="settings.roles" action="edit".
   - Super Admin role is undeletable (isSystem). The migration ensures at least one user
     has it; the API returns 409 if you try to demote the last Super Admin.

OUTPUT: full diff of lib/rbac/server.ts, the wrapped routes (don't paste every route — paste
3 examples and the TODO list), and a short script POST /api/dev/rbac-probe?role=Manager
that returns the matrix of (module, action) → allow/deny for the given role for manual
sanity-check (NODE_ENV !== production only).
```

---

### STEP 4 — Real-time invalidation: changes apply WITHOUT refresh

```
Implement step 4 only.

GOAL: when an admin saves a role, every active user in that role sees the new menu / hidden
fields / disabled buttons instantly. No page refresh.

We already have Pusher wired (lib/pusher/server.ts + auth route). Reuse it.

1. Permission channel:
   - Channel `private-role-<roleId>` — every user subscribed to their own role broadcasts.
   - Channel `private-user-<userId>`  — for cases where one user gets their role swapped.
   - Update /api/pusher/auth/route.ts to authorize subscription to `private-role-<roleId>`
     only if the caller's session.roleId === that roleId.

2. Trigger on save:
   - In PUT /api/admin/roles/[id], after the doc is saved:
       triggerToRole(roleId, "permissions:updated", { roleId, version, updatedAt })
   - Increment a `version` integer on every save (cheap optimistic-concurrency token).

3. Trigger on user role change:
   - When an admin changes VidaUser.roleId via /api/admin/users/[id]:
       triggerToUser(userId, "role:changed", { newRoleId, version })

4. Client store lib/stores/permissions-store.ts (zustand):
   - state: { policy: RolePolicySnapshot | null, version: number, ready: boolean }
   - actions: hydrate() (initial fetch /api/me/permissions), invalidate() (refetch), apply(payload)
   - sets ready=true after first hydrate

5. Endpoint GET /api/me/permissions:
   - returns { roleId, name, isSystem, version, modules } shaped exactly like RolePolicy.snapshot()
   - low-cardinality cache headers: no-store

6. Provider components/providers/permissions-provider.tsx ("use client"):
   - On mount: hydrate the store.
   - Subscribe to `private-role-<roleId>` and `private-user-<userId>`.
   - On "permissions:updated" or "role:changed": call invalidate(); show a tiny sonner toast
     "Your permissions were updated".
   - Wrap inside app/(protected)/layout.tsx around children.

7. Stop baking permissions into the layout's server render:
   - layout.tsx still does the initial fetch (so the very first page paint isn't a flash)
     but the AppSidebar, route gates, and Can components ALL read from the zustand store
     after the first paint.

ACCEPTANCE: open two browsers — admin in one, target user in the other. In admin, toggle
"Purchase Orders → view" off and save. Within ~1 second the target user's sidebar removes
the "Purchase Orders" link and any open PO page redirects to /403 (we add that page in
step 6). No refresh, no console error.
```

---

### STEP 5 — Client primitives: <Can />, useCan, <Visible />

```
Implement step 5 only.

GOAL: a tiny, pleasant API for guarding UI in pages.

1. lib/rbac/client.ts (re-exports a slim subset of types for client use).

2. hooks/use-can.ts ("use client"):
   - export function useCan(moduleKey, action, opts?) → boolean
   - export function useScope(moduleKey, opts?) → "all"|"team"|"own"|"none"
   - export function useFieldVisible(moduleKey, fieldKey, opts?) → boolean
   - All read from the zustand permissions store; if !ready, return false (safe default).
   - opts.subModule supported everywhere.

3. components/rbac/can.tsx — <Can module="..." action="..." subModule="..." fallback={null}>
   children only render if the check passes. Renders fallback otherwise.

4. components/rbac/visible.tsx — <Visible module="..." field="..." />, same pattern but for
   one field. Use in forms and table cells to conditionally render labels/inputs/values.

5. components/rbac/forbidden.tsx — pretty 403 page (use in app/forbidden/page.tsx).

6. Refactor app-sidebar.tsx:
   - delete the local `permissions` state.
   - replace filterItems with one call to useCan(module.key, "view") per nav item.
   - if no module key on a nav item, default-deny.
   - while !ready: render the existing skeleton so we don't flash links.

7. Refactor 5 representative pages to use the new primitives — pick ones that show real
   value: Purchase Orders list (hide row Actions when no edit), Users (hide cost columns
   for non-finance roles), Products (hide costPrice/salePrice fields), Settings → Roles
   (only visible to roles with settings.roles.view), Active Actions.

OUTPUT: the primitives, the sidebar refactor, the 5 refactored pages. Show a 60-second
demo plan I can follow to verify all 5.
```

---

### STEP 6 — Roles UI v2: auto-generated from the registry

```
Implement step 6 only.

GOAL: redesign /admin/settings/roles/[id] to render the registry tree (Module → SubModule →
Actions / Fields / Scope). New menu items appear automatically; nothing is hard-coded.

1. Replace SYSTEM_MODULES + MODULE_FIELDS with RBAC_MODULES from the registry.

2. Page layout (in 3 columns):
   - Left rail (240px): groups (Admin / Inventory / Management / Sales / Reports / Settings)
     each expanding to module names. Click a module to focus.
   - Middle (flexible): tabs for the focused module:
       Tab 1: Actions      — toggles for view/create/edit/delete/approve/download/export/import
       Tab 2: Sub-modules  — table per sub-module with the same action toggles
       Tab 3: Fields       — list every FieldDef under module + sub-modules, with toggles
       Tab 4: Scope        — radio: all / team / own / none (only shown if scopeable)
   - Right rail (320px): live preview "What this role can do" — generated by
     RolePolicy.snapshot() so what the admin sees IS what the user will get.

3. UX:
   - "Copy from another role" button — picks an existing role and overlays its permissions.
   - "Reset to deny-all" button — clears the modules{} map.
   - Bulk row actions per group: enable/disable view for all items in a group.
   - Sticky save bar at the top with a diff badge ("3 changes — Save").
   - Save is disabled if there are zero changes. Save sends only the diff (smaller payload).

4. Validation:
   - Cannot save a role that grants edit/delete without view (server also checks; UI catches
     it earlier with an inline warning).
   - Cannot save settings.roles.* permission to any role except Super Admin (configurable
     allowlist in registry).

5. New menu items: when a developer adds an entry to RBAC_MODULES, this page picks it up
   on next render. No admin action needed to make it appear in the editor.

6. List page (/admin/settings/roles/page.tsx):
   - Show user-count + last-modified-by + last-modified-at.
   - "Audit" button → drawer showing RoleAuditLog for that role with diffs.

OUTPUT: a screenshot-quality description, then the code, then a one-paragraph user guide
suitable to drop into /admin/settings/help.
```

---

### STEP 7 — Record scope: own / team / all

```
Implement step 7 only.

GOAL: a role can be limited to records they created (own), their team (team), or everyone (all).

1. For every ModuleDef marked scopeable=true in the registry, ensure the Mongoose model has
   the ownerField (default "createdBy" — already on most VB models). Add it where missing.

2. For "team" scope: introduce VidaUser.teamId (ObjectId, optional). Owner-vs-team check:
   record.createdBy must be in the same team as the actor. Provide an indexed compound
   {teamId:1, createdBy:1} where it helps.

3. Implement server enforcement (already partially in step 3): every list query gets a
   filter from `policy.scopeFor(moduleKey)`. Every getById/update/delete loads the record
   and rejects 403 if out of scope.

4. UI:
   - In the role editor scope tab, show a small one-line example: "Sales Rep: can edit own
     records — 12 visible to this role today" (server-rendered count via a /preview-count
     endpoint).
   - Pages that list scopeable records show a subtle pill in the header: "Scope: own" /
     "Scope: team" / "Scope: all".

ACCEPTANCE: assign a non-admin user to a role with scope="own" on Purchase Orders. They see
only POs where createdBy === their email. Trying to GET /api/admin/purchase-orders/[id] for
someone else's PO returns 403 even if guessed by ID.
```

---

### STEP 8 — Audit log + impersonate-as + bulk role apply

```
Implement step 8 only.

GOAL: ops + compliance polish.

1. Audit log UI:
   - /admin/settings/roles/audit — table of RoleAuditLog entries: when, who, which role,
     diff (JSON viewer), revert button (re-applies the old snapshot, requires confirmation).
   - Same drawer accessible per-role from the list page.

2. Impersonate-as (Super Admin only, NEVER in production unless ENABLE_IMPERSONATION=1):
   - POST /api/admin/impersonate { userId } → mints a short-lived (10 min) impersonation
     cookie that overrides the resolved role for the next requests.
   - Banner across the top in red: "Impersonating <Name> — End impersonation" while active.
   - Audit-logged on start/end.

3. Bulk apply:
   - In /admin/users/* (the users list), add a "Set role" bulk action: select N users, pick
     a role, server updates roleId on all and emits triggerToUser for each so their
     permissions invalidate live.

4. Safety:
   - Cannot impersonate Super Admin.
   - Bulk apply respects max 500 users per request and is itself rate-limited.

OUTPUT: routes + UI + an /admin/settings/help.md page explaining the model in 1 page (no
fluff) for non-developer admins.
```

---

### STEP 9 — Tests + smoke runbook + checklist

```
Implement step 9 only.

GOAL: prove every step works, with reproducible scripts.

1. Unit tests under tests/rbac/:
   - policy.test.ts — verify can / canField / scopeFor across baseline (deny-all, allow-all,
     inherit), sub-modules, sensitive fields, isSystem bypass.
   - scrub.test.ts — verify scrubFields drops sensitive keys on read, drops disallowed keys
     on write.

2. Integration tests using a tiny supertest-style harness against the running dev server:
   - tests/rbac/api.test.ts — covers 10 representative endpoints with three roles
     (Super Admin, Manager with default deny, Custom "Sales Rep" with create on POs only).
   - Asserts each combination returns the right status code.

3. scripts/rbac-smoke.ts:
   - logs in as 3 seeded users in sequence
   - prints a grid: rows = endpoints, columns = users, cells = pass/fail
   - red row → fail the script with exit 1

4. RBAC_CHECKLIST.md at repo root with checkboxes for every acceptance criterion in steps 1–8.

5. Update README.md with a 1-paragraph section "Permissions model" linking to the registry
   and explaining: deny-by-default, module/sub-module/action/field/scope, real-time
   invalidation via Pusher, audit log, registry as source of truth.

DO NOT mark step 9 done until the smoke script exits 0 and every test passes.
```

---

## Tips for vibe-coding this safely

- Branch: `git checkout -b feat/rbac-v2`. Commit between every step.
- After each step, paste: *"Run the dev server. List the files you changed. Tell me how to test this step in under 60 seconds, then stop."*
- The riskiest step is **3** — wrapping every admin route. If the agent over-wraps and breaks something benign (e.g. file uploads, your chat APIs which are admin-only but per-user), tell it: *"For routes under /api/admin/chat/**, treat them as user-owned not admin-gated — keep them on session-only auth."*
- Step 4 (real-time invalidation) depends on the Pusher env you already set up for the bell + chat. Confirm those env vars are live before pasting it.
- Default to **deny**. If something is silently broken after step 3, your role is missing the relevant permission — not a bug.
