"use client";

import { useState, useEffect } from "react";
import { X, Ship, DollarSign, FileCheck, Loader2, MapPin, Paperclip, Clock, Pencil, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ShipmentDetailPanelProps {
  open: boolean;
  onClose: () => void;
  shipmentId: string | null;
  /** If data is already available, pass it to avoid re-fetching */
  shipmentData?: any;
  /** Callbacks for action buttons — pass these to wire up parent-page dialogs */
  onEdit?: (ship: any) => void;
  onDelete?: (shipId: string) => void;
  onTrack?: (containerNo: string) => void;
  onAttachments?: (ship: any) => void;
  onTimeline?: (ship: any) => void;
}

function formatDate(d: any) {
  if (!d) return '-';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '-';
    return dt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  } catch { return '-'; }
}

export function ShipmentDetailPanel({ open, onClose, shipmentId, shipmentData: initialData, onEdit, onDelete, onTrack, onAttachments, onTimeline }: ShipmentDetailPanelProps) {
  const [ship, setShip] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Display names come pre-resolved from denormalized API (_display* fields)

  useEffect(() => {
    if (!open) { setShip(null); return; }
    if (initialData) { setShip(initialData); return; }
    if (!shipmentId) return;
    setLoading(true);
    fetch(`/api/admin/vb-shipping/${shipmentId}`)
      .then(r => r.json())
      .then(data => { if (!data.error) setShip(data); })
      .catch(() => toast.error('Failed to load shipment'))
      .finally(() => setLoading(false));
  }, [open, shipmentId, initialData]);

  const updateField = async (field: string, value: any) => {
    if (!ship?._id) return;
    try {
      const res = await fetch(`/api/admin/vb-shipping/${ship._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        setShip((prev: any) => ({ ...prev, [field]: value }));
      }
    } catch {
      toast.error('Failed to update');
    }
  };

  if (!open) return null;

  const supplierName = ship?._displaySupplier || ship?.supplier || '-';
  const supplierLocName = ship?._displaySupplierLocation || ship?.supplierLocation || '';
  const statusColor = (s: string) => {
    const st = (s || '').toLowerCase();
    if (st === 'in transit') return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    if (st === 'delivered') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    if (st === 'ordered') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    return 'bg-muted text-muted-foreground border-border';
  };

  return (
    <>
      <div
        className={cn("fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300", open ? "opacity-100" : "opacity-0 pointer-events-none")}
        onClick={onClose}
      />
      <div className={cn(
        "fixed top-0 right-0 z-50 h-full w-[55vw] bg-background border-l border-border shadow-2xl transition-transform duration-500 ease-out flex flex-col",
        open ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Header */}
        <div className={cn(
          "shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/40",
          ship?.status === 'In Transit' && 'bg-blue-500/5 dark:bg-blue-500/10',
          ship?.status === 'Delivered' && 'bg-emerald-500/5 dark:bg-emerald-500/10',
          ship?.status === 'Ordered' && 'bg-amber-500/5 dark:bg-amber-500/10',
        )}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Ship className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight flex items-center gap-2">
                {ship?.VBShipmentNumber || ship?.svbid || 'Shipment Details'}
                <span className="text-[10px] font-medium text-muted-foreground">{ship?.createdByName || ''}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {ship?.status && (
              <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border", statusColor(ship.status))}>
                {ship.status}
              </span>
            )}
            {/* Action buttons */}
            {ship && (
              <div className="flex items-center gap-0.5">
                {onAttachments && (
                  <button
                    onClick={() => { onAttachments(ship); }}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Attachments"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </button>
                )}
                {onTimeline && (
                  <button
                    onClick={() => { onTimeline(ship); }}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Timeline"
                  >
                    <Clock className="h-3.5 w-3.5" />
                  </button>
                )}
                {ship.containerNo && !ship.containerNo.toUpperCase().startsWith('TBD') && ship.status !== 'Delivered' && onTrack && (
                  <button
                    onClick={() => { onTrack(ship.containerNo); onClose(); }}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 transition-colors"
                    title="Live SeaRates Tracking"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                  </button>
                )}
                {onEdit && (
                  <button
                    onClick={() => { onEdit(ship); onClose(); }}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Edit Shipment"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => { onDelete(ship._id); onClose(); }}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete Shipment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
            <button onClick={onClose} className="h-8 w-8 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !ship ? (
            <div className="flex-1 flex items-center justify-center py-20 text-muted-foreground">No data</div>
          ) : (
            <div className="p-5 space-y-4">

              {/* Row 1: Supplier — 4 equal columns */}
              <div className="grid grid-cols-4 gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Supplier</p>
                  <p className="text-xs font-bold text-foreground truncate" title={supplierName}>{supplierName}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Supplier Location</p>
                  <p className="text-xs font-bold text-foreground truncate" title={supplierLocName || '-'}>{supplierLocName || '-'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Supplier PO</p>
                  <p className="text-xs font-bold text-foreground truncate">{ship.supplierPO || '-'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Supplier PO Date</p>
                  <p className="text-xs font-bold text-foreground">{formatDate(ship.supplierPoDate)}</p>
                </div>
              </div>

              {/* Row 2: Container | BOL | Carrier | Booking Ref */}
              <div className="grid grid-cols-4 gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Container No</p>
                  <p className="text-xs font-bold text-foreground truncate uppercase" title={ship.containerNo || '-'}>{ship.containerNo || '-'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">BOL Number</p>
                  <p className="text-xs font-bold text-foreground truncate uppercase" title={ship.BOLNumber || '-'}>{ship.BOLNumber || '-'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Carrier</p>
                  <p className="text-xs font-bold text-foreground truncate uppercase" title={ship.carrier || '-'}>{ship.carrier || '-'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Carrier Booking Ref</p>
                  <p className="text-xs font-bold text-foreground truncate uppercase" title={ship.carrierBookingRef || '-'}>{ship.carrierBookingRef || '-'}</p>
                </div>
              </div>

              {/* Row 3: Ports & Dates */}
              <div className="grid grid-cols-4 gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Port Of Lading</p>
                  <p className="text-xs font-bold text-foreground truncate" title={ship.portOfLading || '-'}>{ship.portOfLading || '-'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Port Of Entry Ship To</p>
                  <p className="text-xs font-bold text-foreground truncate" title={ship.portOfEntryShipTo || '-'}>{ship.portOfEntryShipTo || '-'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Date Of Landing</p>
                  <p className="text-xs font-bold text-foreground">{formatDate(ship.dateOfLanding)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">ETA</p>
                  <p className="text-xs font-bold text-foreground">{formatDate(ship.ETA)}</p>
                </div>
              </div>

              {/* Row 4: Products & Measures */}
              <div className="grid grid-cols-2 gap-4">
                {/* Column 1: Products */}
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider mb-1.5">Products</p>
                  <div className="flex flex-col gap-1">
                    {(() => {
                      const pids = Array.isArray(ship.products) ? ship.products : ship.product ? [ship.product] : [];
                      return pids.length > 0
                        ? pids.map((pid: string, i: number) => (
                          <span key={i} className="inline-flex items-center text-[10px] font-semibold bg-primary/8 text-primary border border-primary/15 px-2.5 py-1 rounded-lg w-fit">
                            {(Array.isArray(ship._displayProducts) && ship._displayProducts.length > 0)
                              ? ship._displayProducts[i] || pid
                              : pid}
                          </span>
                        ))
                        : <span className="text-xs text-muted-foreground">—</span>;
                    })()}
                  </div>
                </div>
                {/* Column 2: Drums / Pallets / Gallons */}
                <div className="flex flex-wrap items-start gap-x-6 gap-y-1 pt-5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Drums</p>
                    <p className="text-xs font-bold text-foreground">{(ship.drums || 0).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Pallets</p>
                    <p className="text-xs font-bold text-foreground">{(ship.pallets || 0).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Gallons</p>
                    <p className="text-xs font-bold text-foreground">{(ship.gallons || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Row 5: Financials */}
              <div className="rounded-xl bg-muted/30 dark:bg-muted/20 border border-border/40 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <DollarSign className="h-3.5 w-3.5 text-primary/70" />
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Financials</p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Inv Value', value: `$${(ship.invValue || 0).toLocaleString()}` },
                    { label: 'Est. Duties', value: `$${(ship.estTrumpDuties || 0).toLocaleString()}` },
                    { label: 'Fees Amount', value: `$${(ship.feesAmount || 0).toLocaleString()}` },
                    { label: 'Est Duties (2)', value: `$${(ship.estimatedDuties || 0).toLocaleString()}` },
                  ].map((item, i) => (
                    <div key={i} className="text-center bg-background/60 rounded-lg py-1.5 px-1 border border-border/30">
                      <p className="text-xs font-bold text-foreground">{item.value}</p>
                      <p className="text-[7px] font-semibold uppercase text-muted-foreground/50 tracking-wider">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 6: Documentation & Compliance */}
              <div className="rounded-xl bg-muted/30 dark:bg-muted/20 border border-border/40 p-3">
                <div className="flex items-center gap-1.5 mb-3">
                  <FileCheck className="h-3.5 w-3.5 text-primary/70" />
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Documentation & Compliance</p>
                </div>
                <div className="grid grid-cols-5 gap-x-4 gap-y-4">
                  {[
                    { label: 'Arrival Notice', field: 'isArrivalNotice', value: ship.isArrivalNotice },
                    { label: 'Genset Req', field: 'isGensetRequired', value: ship.isGensetRequired },
                    { label: 'Genset Email', field: 'gensetEmailed', value: ship.gensetEmailed },
                    { label: 'Collect Fees', field: 'isCollectFeesPaid', value: ship.isCollectFeesPaid },
                    { label: 'DO Created', field: 'isDOCreated', value: ship.isDOCreated },
                    { label: 'Sup Invoice', field: 'isSupplierInvoice', value: ship.isSupplierInvoice },
                    { label: 'Man Sec ISF', field: 'isManufacturerSecurityISF', value: ship.isManufacturerSecurityISF },
                    { label: 'VB ISF', field: 'isVidaBuddiesISFFiling', value: ship.isVidaBuddiesISFFiling },
                    { label: 'Pack List', field: 'isPackingList', value: ship.isPackingList },
                    { label: 'Cert Analysis', field: 'isCertificateOfAnalysis', value: ship.isCertificateOfAnalysis },
                    { label: 'Cert Origin', field: 'isCertificateOfOrigin', value: ship.isCertificateOfOrigin },
                    { label: 'Bill of Lading', field: 'IsBillOfLading', value: ship.IsBillOfLading },
                    { label: 'Docs to Broker', field: 'isAllDocumentsProvidedToCustomsBroker', value: ship.isAllDocumentsProvidedToCustomsBroker },
                    { label: 'Customs Stat', field: 'isCustomsStatus', value: ship.isCustomsStatus },
                    { label: 'Drayage Asg', field: 'IsDrayageAssigned', value: ship.IsDrayageAssigned },
                  ].map((item, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <Switch
                        checked={!!item.value}
                        onCheckedChange={(v) => updateField(item.field, v)}
                        className="scale-90 data-[state=checked]:bg-primary"
                      />
                      <p className="text-[9px] font-bold uppercase text-foreground/60 tracking-wide text-center leading-tight">{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-border/30 grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <Switch
                      checked={!!ship.isTruckerReceivedDeliveryOrder}
                      onCheckedChange={(v) => updateField('isTruckerReceivedDeliveryOrder', v)}
                      className="scale-90 data-[state=checked]:bg-primary"
                    />
                    <p className="text-[9px] font-bold uppercase text-foreground/60 tracking-wide">Trucker DO</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-bold uppercase text-foreground/60 tracking-wider">Trucker Notified</p>
                    <p className="text-[10px] font-bold text-foreground">{formatDate(ship.truckerNotifiedDate)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-bold uppercase text-foreground/60 tracking-wider">Genset Inv</p>
                    <p className="text-[10px] font-bold text-foreground">{ship.gensetInv || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Quick Note */}
              {ship.quickNote && (
                <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
                  <p className="text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400 tracking-wider mb-1">Quick Note</p>
                  <p className="text-xs text-foreground">{ship.quickNote}</p>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </>
  );
}
