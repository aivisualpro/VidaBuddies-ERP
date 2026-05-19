"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Building2,
  Globe,
  MapPin,
  Hash,
  Layers,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface CustomerLocation {
  vbId?: string;
  locationName?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  fullAddress?: string;
  website?: string;
  imageUrl?: string;
}

interface CustomerData {
  _id: string;
  vbId: string;
  name: string;
  location: CustomerLocation[];
}

interface CustomerInfoPanelProps {
  customerId: string | null;
  open: boolean;
  onClose: () => void;
}

export function CustomerInfoPanel({ customerId, open, onClose }: CustomerInfoPanelProps) {
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !customerId) {
      setCustomer(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/admin/customers/${customerId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((d) => setCustomer(d))
      .catch(() => setError("Failed to load customer information."))
      .finally(() => setLoading(false));
  }, [customerId, open]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto p-0">
        {/* Header gradient banner */}
        <div className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-transparent px-6 pt-8 pb-6 border-b">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 border border-primary/20 shrink-0">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-lg font-bold leading-tight">
                  {loading ? (
                    <span className="text-muted-foreground text-base">Loading…</span>
                  ) : customer ? (
                    customer.name
                  ) : (
                    "Customer"
                  )}
                </SheetTitle>
                {customer && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    ID: {customer.vbId}
                  </p>
                )}
              </div>
            </div>
          </SheetHeader>
        </div>

        <div className="px-6 py-5">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Customer info */}
          {!loading && customer && (
            <div className="space-y-6">
              {/* Meta row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                    <Hash className="h-3 w-3" /> VB ID
                  </p>
                  <p className="text-sm font-mono font-medium">{customer.vbId || "—"}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                    <Layers className="h-3 w-3" /> Locations
                  </p>
                  <p className="text-sm font-medium">{customer.location?.length ?? 0}</p>
                </div>
              </div>

              {/* Locations */}
              {customer.location && customer.location.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    Locations
                  </h3>
                  {customer.location.map((loc, i) => (
                    <div
                      key={i}
                      className="rounded-xl border bg-card overflow-hidden transition-all duration-200 hover:border-primary/30 hover:shadow-sm"
                    >
                      {/* Location image */}
                      {loc.imageUrl && (
                        <div className="h-28 w-full overflow-hidden bg-muted">
                          <img
                            src={loc.imageUrl}
                            alt={loc.locationName || "Location"}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className="px-4 py-3 space-y-2">
                        {/* Location name */}
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm leading-tight">
                            {loc.locationName || `Location ${i + 1}`}
                          </p>
                          {loc.vbId && (
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                              {loc.vbId}
                            </span>
                          )}
                        </div>

                        {/* Address */}
                        {(loc.fullAddress || loc.street || loc.city) && (
                          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/70" />
                            <span className="leading-relaxed">
                              {loc.fullAddress ||
                                [loc.street, loc.city, loc.state, loc.zip, loc.country]
                                  .filter(Boolean)
                                  .join(", ")}
                            </span>
                          </div>
                        )}

                        {/* Website */}
                        {loc.website && (
                          <a
                            href={loc.website.startsWith("http") ? loc.website : `https://${loc.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                          >
                            <Globe className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{loc.website}</span>
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center">
                  <MapPin className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No locations on file</p>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
