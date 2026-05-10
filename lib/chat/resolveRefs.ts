import type { RefKind, IChatRef } from '@/lib/models/VidaConversation';
import VidaPO from '@/lib/models/VidaPO';
import VBcustomerPO from '@/lib/models/VBcustomerPO';
import VBshipping from '@/lib/models/VBshipping';

/**
 * Per-request LRU cache.
 *
 * Timeline's `buildLookups()` fetches *every* PO / CPO / Shipping document
 * which is fine for a one-shot API response, but in the chat context a single
 * page render can resolve many different refs across multiple messages.
 *
 * This module provides two helpers:
 * - resolveRefDisplay(kind, refId) — single lookup with LRU
 * - resolveRefsBatch(refs[])       — de-duped batch variant
 *
 * Both share an in-memory Map that lives for the duration of the request
 * (i.e. a single Node.js microtask chain). There's no TTL; the Map is GC'd
 * when the request ends. For long-lived contexts, call `clearRefCache()`.
 */

// ---- Per-request cache (keyed by "kind:refId") ----

const _cache = new Map<string, string>();

function cacheKey(kind: RefKind, refId: string): string {
  return `${kind}:${refId}`;
}

/** Clear the in-memory ref cache (useful between test runs). */
export function clearRefCache(): void {
  _cache.clear();
}

// ---- Single-item resolver ----

/**
 * Resolve one refId to its human-readable display name.
 *
 * Resolution rules (same as `lib/timeline/lookups.ts`):
 *   VBNumber         → VidaPO.vbpoNo          || VidaPO.VBNumber
 *   VBSerialNumber   → VBcustomerPO.VBSerialNumber || VBcustomerPO.poNo
 *   VBShipmentNumber → VBshipping.VBShipmentNumber || VBshipping.svbid
 *
 * Falls back to the raw refId if not found.
 */
export async function resolveRefDisplay(
  kind: RefKind,
  refId: string
): Promise<string> {
  const key = cacheKey(kind, refId);
  if (_cache.has(key)) return _cache.get(key)!;

  let display: string = refId; // fallback

  try {
    switch (kind) {
      case 'VBNumber': {
        const doc = await VidaPO.findById(refId, { vbpoNo: 1, VBNumber: 1 }).lean();
        if (doc) display = (doc as any).vbpoNo || (doc as any).VBNumber || refId;
        break;
      }
      case 'VBSerialNumber': {
        const doc = await VBcustomerPO.findById(refId, { VBSerialNumber: 1, poNo: 1 }).lean();
        if (doc) display = (doc as any).VBSerialNumber || (doc as any).poNo || refId;
        break;
      }
      case 'VBShipmentNumber': {
        const doc = await VBshipping.findById(refId, { VBShipmentNumber: 1, svbid: 1 }).lean();
        if (doc) display = (doc as any).VBShipmentNumber || (doc as any).svbid || refId;
        break;
      }
    }
  } catch {
    // invalid ObjectId, missing doc, etc. — keep fallback
  }

  _cache.set(key, display);
  return display;
}

// ---- Batch resolver ----

/**
 * Resolve an array of `{ kind, refId }` pairs in one shot.
 * De-dupes internally so each unique (kind+refId) hits Mongo at most once.
 * Returns a fully-populated `IChatRef[]` with `display` filled in.
 */
export async function resolveRefsBatch(
  refs: { kind: RefKind; refId: string }[]
): Promise<IChatRef[]> {
  if (!refs.length) return [];

  // Partition by kind and collect uncached IDs
  const uncached: { kind: RefKind; refId: string }[] = [];
  for (const r of refs) {
    if (!_cache.has(cacheKey(r.kind, r.refId))) {
      uncached.push(r);
    }
  }

  if (uncached.length > 0) {
    // Group by kind for batch queries
    const byKind: Record<RefKind, string[]> = {
      VBNumber: [],
      VBSerialNumber: [],
      VBShipmentNumber: [],
    };
    for (const r of uncached) {
      // de-dup within group
      if (!byKind[r.kind].includes(r.refId)) {
        byKind[r.kind].push(r.refId);
      }
    }

    // Parallel queries (only for kinds that have missing IDs)
    const tasks: Promise<void>[] = [];

    if (byKind.VBNumber.length) {
      tasks.push(
        VidaPO.find({ _id: { $in: byKind.VBNumber } }, { vbpoNo: 1, VBNumber: 1 })
          .lean()
          .then((docs) => {
            for (const d of docs as any[]) {
              const id = d._id.toString();
              _cache.set(cacheKey('VBNumber', id), d.vbpoNo || d.VBNumber || id);
            }
            // Anything not found → fall back to raw id
            for (const id of byKind.VBNumber) {
              if (!_cache.has(cacheKey('VBNumber', id))) _cache.set(cacheKey('VBNumber', id), id);
            }
          })
      );
    }

    if (byKind.VBSerialNumber.length) {
      tasks.push(
        VBcustomerPO.find({ _id: { $in: byKind.VBSerialNumber } }, { VBSerialNumber: 1, poNo: 1 })
          .lean()
          .then((docs) => {
            for (const d of docs as any[]) {
              const id = d._id.toString();
              _cache.set(cacheKey('VBSerialNumber', id), d.VBSerialNumber || d.poNo || id);
            }
            for (const id of byKind.VBSerialNumber) {
              if (!_cache.has(cacheKey('VBSerialNumber', id))) _cache.set(cacheKey('VBSerialNumber', id), id);
            }
          })
      );
    }

    if (byKind.VBShipmentNumber.length) {
      tasks.push(
        VBshipping.find({ _id: { $in: byKind.VBShipmentNumber } }, { VBShipmentNumber: 1, svbid: 1 })
          .lean()
          .then((docs) => {
            for (const d of docs as any[]) {
              const id = d._id.toString();
              _cache.set(cacheKey('VBShipmentNumber', id), d.VBShipmentNumber || d.svbid || id);
            }
            for (const id of byKind.VBShipmentNumber) {
              if (!_cache.has(cacheKey('VBShipmentNumber', id))) _cache.set(cacheKey('VBShipmentNumber', id), id);
            }
          })
      );
    }

    await Promise.all(tasks);
  }

  // Build result from cache
  return refs.map((r) => ({
    kind: r.kind,
    refId: r.refId,
    display: _cache.get(cacheKey(r.kind, r.refId)) || r.refId,
  }));
}
