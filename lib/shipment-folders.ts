/**
 * Standard directory structure created inside every shipment's Drive folder.
 * Keep this as the single source of truth so auto-creation (on new shipment)
 * and the "Directory Structure" button always agree.
 */
export const SHIPMENT_STANDARD_FOLDERS = [
  "C.O.A PACKING LIST",
  "CUSTOMER P.O",
  "CUSTOMS & LOGISTICS",
  "EXPENSES AND INVOICES",
  "VIDA BUDDIES P.O TO MANUFACTURER OR SUPPLIER",
] as const;
