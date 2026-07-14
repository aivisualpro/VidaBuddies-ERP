"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Ship,
  Truck,
  ChevronDown,
  Pencil,
  Trash,
  Paperclip,
  Clock,
  MapPin,
  DollarSign,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  Weight,
  BellRing,
} from "lucide-react";
import { EmailAutomationDialog } from "@/components/admin/email-automation-dialog";

export interface ShippingCardShip {
  _id?: string;
  VBShipmentNumber?: string;
  svbid?: string;
  status?: string;
  containerNo?: string;
  BOLNumber?: string;
  carrier?: string;
  carrierBookingRef?: string;
  portOfLading?: string;
  portOfEntryShipTo?: string;
  dateOfLanding?: string;
  ETA?: string;
  updatedETA?: string;
  supplier?: string;
  supplierLocation?: string;
  supplierPO?: string;
  supplierPoDate?: string;
  _displaySupplier?: string;
  _displaySupplierLocation?: string;
  products?: string[];
  drums?: number;
  pallets?: number;
  gallons?: number;
  netWeightKG?: number;
  grossWeightKG?: number;
  invValue?: number;
  estTrumpDuties?: number;
  feesAmount?: number;
  estimatedDuties?: number;
  isArrivalNotice?: boolean;
  isGensetRequired?: boolean;
  gensetEmailed?: boolean;
  gensetInv?: string;
  isCollectFeesPaid?: boolean;
  isDOCreated?: boolean;
  isSupplierInvoice?: boolean;
  isManufacturerSecurityISF?: boolean;
  isVidaBuddiesISFFiling?: boolean;
  isPackingList?: boolean;
  isCertificateOfAnalysis?: boolean;
  isCertificateOfOrigin?: boolean;
  IsBillOfLading?: boolean;
  isBillOfLading?: boolean;
  isAllDocumentsProvidedToCustomsBroker?: boolean;
  isCustomsStatus?: boolean;
  IsDrayageAssigned?: boolean;
  truckerNotifiedDate?: string;
  isTruckerReceivedDeliveryOrder?: boolean;
  createdBy?: string;
  updateShipmentTracking?: string;
  [key: string]: any;
}

interface ShippingCardProps {
  ship: ShippingCardShip;
  index: number;
  /** id → supplier name */
  supplierNames?: Record<string, string>;
  /** id → supplier location name */
  supplierLocations?: Record<string, string>;
  /** id → product name */
  products?: Record<string, string>;
  /** Whether to show the invoice status indicators */
  hasInvoice?: boolean;
  showInvoiceAlert?: boolean;
  onUpdateField?: (shipId: string, field: string, value: any) => void;
  onEdit?: (ship: ShippingCardShip) => void;
  onDelete?: (ship: ShippingCardShip) => void;
  onAttachments?: (ship: ShippingCardShip) => void;
  onTimeline?: (ship: ShippingCardShip) => void;
  onLiveTracking?: (ship: ShippingCardShip) => void;
  onTransfers?: (ship: ShippingCardShip) => void;
  /** When true, the Transfer Orders button is hidden (direct shipment to customer) */
  isDirectShipment?: boolean;
  /** If true, open by default */
  defaultOpen?: boolean;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export function ShippingCard({
  ship,
  index,
  supplierNames = {},
  supplierLocations = {},
  products = {},
  hasInvoice,
  showInvoiceAlert,
  onUpdateField,
  onEdit,
  onDelete,
  onAttachments,
  onTimeline,
  onLiveTracking,
  onTransfers,
  isDirectShipment = false,
  defaultOpen = false,
}: ShippingCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [emailAutomationsOpen, setEmailAutomationsOpen] = useState(false);

  const shipId = ship._id || String(index);
  const hasTrackableContainer = !!ship.containerNo && !ship.containerNo.toUpperCase().startsWith("TBD");

  // Resolve supplier name
  const supplierName =
    ship._displaySupplier ||
    supplierNames[ship.supplier || ""] ||
    "-";

  // Resolve supplier location name
  const supplierLocationName =
    ship._displaySupplierLocation ||
    supplierLocations[ship.supplierLocation || ""] ||
    supplierLocations[ship.supplier || ""] ||
    "-";

  const productIds: string[] =
    Array.isArray(ship.products) && ship.products.length > 0
      ? ship.products
      : typeof ship.products === "string"
      ? (ship.products as string).split(",").filter(Boolean)
      : [];

  const complianceToggles = [
    { label: "Arrival Notice", field: "isArrivalNotice", value: ship.isArrivalNotice },
    { label: "Genset Req", field: "isGensetRequired", value: ship.isGensetRequired },
    { label: "Genset Email", field: "gensetEmailed", value: ship.gensetEmailed },
    { label: "Collect Fees", field: "isCollectFeesPaid", value: ship.isCollectFeesPaid },
    { label: "DO Created", field: "isDOCreated", value: ship.isDOCreated },
    { label: "Sup Invoice", field: "isSupplierInvoice", value: ship.isSupplierInvoice },
    { label: "Man Sec ISF", field: "isManufacturerSecurityISF", value: ship.isManufacturerSecurityISF },
    { label: "VB ISF", field: "isVidaBuddiesISFFiling", value: ship.isVidaBuddiesISFFiling },
    { label: "Pack List", field: "isPackingList", value: ship.isPackingList },
    { label: "Cert Analysis", field: "isCertificateOfAnalysis", value: ship.isCertificateOfAnalysis },
    { label: "Cert Origin", field: "isCertificateOfOrigin", value: ship.isCertificateOfOrigin },
    { label: "Bill of Lading", field: "IsBillOfLading", value: ship.IsBillOfLading || ship.isBillOfLading },
    { label: "Docs to Broker", field: "isAllDocumentsProvidedToCustomsBroker", value: ship.isAllDocumentsProvidedToCustomsBroker },
    { label: "Customs Stat", field: "isCustomsStatus", value: ship.isCustomsStatus },
    { label: "Drayage Asg", field: "IsDrayageAssigned", value: ship.IsDrayageAssigned },
  ];

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-card text-card-foreground border border-border/60 shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/30">
      {/* ─── HEADER BAR ─── */}
      <div
        className={cn(
          "flex items-center justify-between px-5 py-3 border-b border-border/40 cursor-pointer select-none",
          ship.status === "In Transit" && "bg-blue-500/5 dark:bg-blue-500/10",
          ship.status === "Ordered" && "bg-amber-500/5 dark:bg-amber-500/10",
          ship.status === "Delivered" && "bg-emerald-500/5 dark:bg-emerald-500/10",
          ship.status === "Cancelled" && "bg-red-500/5 dark:bg-red-500/10",
          !ship.status && "bg-muted/30"
        )}
        onClick={() => setIsOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Ship className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight">
              {ship.VBShipmentNumber || ship.svbid || shipId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Invoice indicators */}
          {hasInvoice && (
            <div
              className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.4)] animate-in zoom-in slide-in-from-right-4 duration-500"
              title="Invoice Sent"
            >
              <CheckCircle2 className="h-5 w-5 text-emerald-500 drop-shadow-md" />
            </div>
          )}
          {showInvoiceAlert && (
            <div
              className="flex items-center justify-center h-8 w-8 rounded-full bg-red-500/10 border border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.4)]"
              title="Invoice not sent yet!"
            >
              <AlertTriangle className="h-5 w-5 text-red-500 drop-shadow-md animate-bounce" style={{ animationDuration: "2s" }} />
            </div>
          )}
          {/* Status Badge */}
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border",
              ship.status === "In Transit" && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
              ship.status === "Ordered" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
              ship.status === "Delivered" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
              ship.status === "Cancelled" && "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
              !ship.status && "bg-muted text-muted-foreground border-border"
            )}
          >
            {ship.status || "Pending"}
          </span>
          {/* Actions */}
          <div className="flex items-center gap-0.5">
            {onAttachments && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                onClick={(e) => { e.stopPropagation(); onAttachments(ship); }}
              >
                <Paperclip className="h-3.5 w-3.5" />
              </Button>
            )}
            {onTimeline && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                onClick={(e) => { e.stopPropagation(); onTimeline(ship); }}
              >
                <Clock className="h-3.5 w-3.5" />
              </Button>
            )}
            {onLiveTracking && ship.containerNo && !ship.containerNo.toUpperCase().startsWith("TBD") && ship.status !== "Delivered" && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 rounded-lg"
                title="Live SeaRates Map"
                onClick={(e) => { e.stopPropagation(); onLiveTracking(ship); }}
              >
                <MapPin className="h-3.5 w-3.5" />
              </Button>
            )}
            {onTransfers && !isDirectShipment && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                title="Transfers"
                onClick={(e) => { e.stopPropagation(); onTransfers(ship); }}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
              </Button>
            )}
            {hasTrackableContainer && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 rounded-lg"
                title="Email Automations — schedule or send status emails"
                onClick={(e) => { e.stopPropagation(); setEmailAutomationsOpen(true); }}
              >
                <BellRing className="h-3.5 w-3.5" />
              </Button>
            )}
            {onEdit && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                onClick={(e) => { e.stopPropagation(); onEdit(ship); }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(ship); }}
              >
                <Trash className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-300",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </div>

      {/* ─── BODY (ACCORDION) ─── */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="p-5 space-y-4">
            {/* Row 1: Supplier */}
            <div className="grid grid-cols-4 gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Supplier</p>
                <p className="text-xs font-bold text-foreground truncate" title={supplierName}>{supplierName}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Supplier Location</p>
                <p className="text-xs font-bold text-foreground truncate" title={supplierLocationName}>{supplierLocationName}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Supplier PO</p>
                <p className="text-xs font-bold text-foreground truncate">{ship.supplierPO || "-"}</p>
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
                <p className="text-xs font-bold text-foreground truncate uppercase" title={ship.containerNo || "-"}>{ship.containerNo || "-"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">BOL Number</p>
                <p className="text-xs font-bold text-foreground truncate uppercase" title={ship.BOLNumber || "-"}>{ship.BOLNumber || "-"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Carrier</p>
                <p className="text-xs font-bold text-foreground truncate uppercase" title={ship.carrier || "-"}>{ship.carrier || "-"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Carrier Booking Ref</p>
                <p className="text-xs font-bold text-foreground truncate uppercase" title={ship.carrierBookingRef || "-"}>{ship.carrierBookingRef || "-"}</p>
              </div>
            </div>

            {/* Row 3: Ports & Dates */}
            <div className="grid grid-cols-4 gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Port Of Lading</p>
                <p className="text-xs font-bold text-foreground truncate" title={ship.portOfLading || "-"}>{ship.portOfLading || "-"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider">Port Of Entry</p>
                <p className="text-xs font-bold text-foreground truncate" title={ship.portOfEntryShipTo || "-"}>{ship.portOfEntryShipTo || "-"}</p>
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

            {/* Row 4: Products */}
            <div>
              <p className="text-[9px] font-semibold uppercase text-foreground/60 tracking-wider mb-1.5">Products</p>
              <div className="flex flex-wrap gap-1">
                {productIds.length > 0
                  ? productIds.map((pid, i) => (
                      <span key={i} className="inline-flex items-center text-[10px] font-semibold bg-primary/8 text-primary border border-primary/15 px-2.5 py-1 rounded-lg w-fit">
                        {products[pid] || pid}
                      </span>
                    ))
                  : <span className="text-xs text-muted-foreground">—</span>}
              </div>
            </div>

            {/* Row 5: Weights & Measures */}
            <div className="rounded-xl bg-muted/30 dark:bg-muted/20 border border-border/40 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Weight className="h-3.5 w-3.5 text-primary/70" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Weights & Measures</p>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: "Drums", value: (ship.drums || 0).toLocaleString() },
                  { label: "Pallets", value: (ship.pallets || 0).toLocaleString() },
                  { label: "Gallons", value: (ship.gallons || 0).toLocaleString() },
                  { label: "Net Wt (KG)", value: (ship.netWeightKG || 0).toLocaleString() },
                  { label: "Gross Wt (KG)", value: (ship.grossWeightKG || 0).toLocaleString() },
                ].map((item, i) => (
                  <div key={i} className="text-center bg-background/60 rounded-lg py-1.5 px-1 border border-border/30">
                    <p className="text-xs font-bold text-foreground">{item.value}</p>
                    <p className="text-[7px] font-semibold uppercase text-muted-foreground/50 tracking-wider">{item.label}</p>
                  </div>
                ))}
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
                  { label: "Inv Value", value: `$${(ship.invValue || 0).toLocaleString()}` },
                  { label: "Est. Duties", value: `$${(ship.estTrumpDuties || 0).toLocaleString()}` },
                  { label: "Fees Amount", value: `$${(ship.feesAmount || 0).toLocaleString()}` },
                  { label: "Est Duties (2)", value: `$${(ship.estimatedDuties || 0).toLocaleString()}` },
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
                {complianceToggles.map((item, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <Switch
                      checked={!!item.value}
                      onCheckedChange={(v) => onUpdateField?.(shipId, item.field, v)}
                      className="scale-90 data-[state=checked]:bg-primary"
                    />
                    <p className="text-[9px] font-bold uppercase text-foreground/60 tracking-wide text-center leading-tight">{item.label}</p>
                  </div>
                ))}
              </div>
              {/* Trucker Row */}
              <div className="mt-4 pt-3 border-t border-border/30 grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center gap-1">
                  <Switch
                    checked={!!ship.isTruckerReceivedDeliveryOrder}
                    onCheckedChange={(v) => onUpdateField?.(shipId, "isTruckerReceivedDeliveryOrder", v)}
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
                  <p className="text-[10px] font-bold text-foreground">{ship.gensetInv || "-"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Automations */}
      {hasTrackableContainer && (
        <EmailAutomationDialog
          open={emailAutomationsOpen}
          onClose={() => setEmailAutomationsOpen(false)}
          containerNo={ship.containerNo!}
          shippingId={ship._id || null}
          routeLabel={
            ship.portOfLading && ship.portOfEntryShipTo
              ? `${ship.portOfLading} → ${ship.portOfEntryShipTo}`
              : undefined
          }
        />
      )}
    </div>
  );
}

/** Empty state placeholder for shipping lists */
export function ShippingEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-[2.5rem] bg-accent/5 opacity-50">
      <Truck className="h-10 w-10 text-muted-foreground/30 mb-4" />
      <p className="font-black uppercase text-[10px] tracking-[0.3em] text-muted-foreground">No Shipments Recorded</p>
    </div>
  );
}
