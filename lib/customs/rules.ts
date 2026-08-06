/**
 * Customs Package Automation — rules engine (single source of truth).
 *
 * Pure TypeScript (no mongoose / no React) so it can be shared by API routes
 * and the wizard UI. Encodes the route matrix, package types, document
 * requirement matrix, deadline calculators, filename classification and email
 * subject templates from the "ERP Customs Package Automation" spec v2.0.
 *
 * HARD RULES (spec):
 *  - The ERP never invents PARS/CCN or PAPS/SCN (carrier-provided only).
 *  - Unknown values stay blank and become tasks — no guessing.
 *  - FSVP and FDA Prior Notice are independent determinations.
 *  - Border mode is never overwritten by the inland mode (ocean + rail coexist).
 */

export const RULESET_VERSION = "2026-08-06.1";

/* ─────────────────────────── Route dimensions ─────────────────────────── */

export type CountryOfImport = "CA" | "US";
export type BorderMode = "OCEAN" | "TRUCK" | "RAIL" | "AIR";
export type InlandMode = "NONE" | "TRUCK" | "RAIL";
export type ShipmentStage =
  | "PRE_DEPARTURE"
  | "IN_TRANSIT"
  | "PRE_ARRIVAL"
  | "ARRIVED"
  | "DELIVERED";

export interface CustomsRoute {
  countryOfImport: CountryOfImport;
  borderMode: BorderMode;
  inlandMode: InlandMode;
  stage: ShipmentStage;
}

export const STAGES: { value: ShipmentStage; label: string }[] = [
  { value: "PRE_DEPARTURE", label: "Pre-departure" },
  { value: "IN_TRANSIT", label: "In transit" },
  { value: "PRE_ARRIVAL", label: "Pre-arrival" },
  { value: "ARRIVED", label: "Arrived / available" },
  { value: "DELIVERED", label: "Delivered" },
];

const STAGE_ORDER: Record<ShipmentStage, number> = {
  PRE_DEPARTURE: 0,
  IN_TRANSIT: 1,
  PRE_ARRIVAL: 2,
  ARRIVED: 3,
  DELIVERED: 4,
};

export function stageAtLeast(stage: ShipmentStage, min: ShipmentStage): boolean {
  return STAGE_ORDER[stage] >= STAGE_ORDER[min];
}

/* ─────────────────────────── Broker profiles ─────────────────────────── */

export interface BrokerProfile {
  code: string;
  name: string;
  country: CountryOfImport;
  /** Configurable — placeholder recipients until real profile is entered */
  defaultEmails: string[];
  ackFollowUpHours: number;
}

export const BROKERS: Record<CountryOfImport, BrokerProfile> = {
  CA: {
    code: "DSV",
    name: "DSV Air & Sea (Canada)",
    country: "CA",
    defaultEmails: [],
    ackFollowUpHours: 4,
  },
  US: {
    code: "PCB",
    name: "Pacific Customs Brokers (USA)",
    country: "US",
    defaultEmails: [],
    ackFollowUpHours: 4,
  },
};

/* ─────────────────────────── Package types ─────────────────────────── */

export type PackageType =
  | "CA_TRUCK_PARS"
  | "CA_OCEAN_ENTRY"
  | "CA_ENTRY"
  | "US_ISF"
  | "US_ENTRY"
  | "US_TRUCK_PAPS"
  | "TRANSPORT_ADDENDUM";

export const PACKAGE_TYPE_LABELS: Record<PackageType, string> = {
  CA_TRUCK_PARS: "Canada Truck Clearance (PARS)",
  CA_OCEAN_ENTRY: "Canada Ocean Entry",
  CA_ENTRY: "Canada Entry",
  US_ISF: "U.S. ISF 10+2 (early filing)",
  US_ENTRY: "U.S. Entry",
  US_TRUCK_PAPS: "U.S. Truck Entry (PAPS)",
  TRANSPORT_ADDENDUM: "Transport Addendum (arrival / rail)",
};

/** Package routing matrix (spec §3). Border mode decides; inland rail adds addendum. */
export function packageTypesFor(route: CustomsRoute): PackageType[] {
  const { countryOfImport: c, borderMode: b, inlandMode: i } = route;
  if (c === "CA") {
    if (b === "TRUCK") return ["CA_TRUCK_PARS"];
    if (b === "OCEAN")
      return i === "RAIL" ? ["CA_OCEAN_ENTRY", "TRANSPORT_ADDENDUM"] : ["CA_OCEAN_ENTRY"];
    return ["CA_ENTRY"]; // rail / air mode-specific
  }
  // US
  if (b === "OCEAN")
    return i === "RAIL"
      ? ["US_ISF", "US_ENTRY", "TRANSPORT_ADDENDUM"]
      : ["US_ISF", "US_ENTRY"];
  if (b === "TRUCK") return ["US_TRUCK_PAPS"];
  return ["US_ENTRY"]; // rail / air — no ISF unless first entry by vessel
}

/** Plain-language route summary shown before continuing (spec §2). */
export function routeSummary(route: CustomsRoute): string {
  const country = route.countryOfImport === "CA" ? "Canada" : "the United States";
  const border =
    route.borderMode === "OCEAN"
      ? "by ocean vessel"
      : route.borderMode === "TRUCK"
      ? "by highway truck"
      : route.borderMode === "RAIL"
      ? "by rail"
      : "by air";
  const inland =
    route.inlandMode === "RAIL"
      ? ", then continues inland by rail"
      : route.inlandMode === "TRUCK"
      ? ", then final delivery by truck"
      : "";
  const stage = STAGES.find((s) => s.value === route.stage)?.label || route.stage;
  return `Goods enter ${country} ${border}${inland}. Current stage: ${stage}.`;
}

/* ──────────────────── Document types & classification ──────────────────── */

export type DocType =
  | "COMMERCIAL_INVOICE"
  | "PACKING_LIST"
  | "BOL"
  | "BOOKING_CONFIRMATION"
  | "ARRIVAL_NOTICE"
  | "RAIL_MANIFEST"
  | "DELIVERY_ORDER"
  | "PARS_EVIDENCE"
  | "PAPS_EVIDENCE"
  | "CERT_ORIGIN"
  | "COA"
  | "ISF_FORM"
  | "PRIOR_NOTICE"
  | "PERMIT"
  | "BROKER_ACK"
  | "CUSTOMS_RELEASE"
  | "CUSTOMER_PO"
  | "SUPPLIER_PO"
  | "OTHER";

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  COMMERCIAL_INVOICE: "Commercial invoice",
  PACKING_LIST: "Packing list / pick slip",
  BOL: "Bill of lading / waybill",
  BOOKING_CONFIRMATION: "Booking confirmation",
  ARRIVAL_NOTICE: "Arrival notice",
  RAIL_MANIFEST: "Rail manifest / inland routing",
  DELIVERY_ORDER: "Delivery order",
  PARS_EVIDENCE: "PARS / CCN evidence",
  PAPS_EVIDENCE: "PAPS / SCN evidence",
  CERT_ORIGIN: "Certificate / proof of origin",
  COA: "Certificate of analysis (COA)",
  ISF_FORM: "ISF form / acceptance",
  PRIOR_NOTICE: "FDA Prior Notice evidence",
  PERMIT: "Permit / licence",
  BROKER_ACK: "Broker acknowledgement",
  CUSTOMS_RELEASE: "Customs release",
  CUSTOMER_PO: "Customer PO (reference only)",
  SUPPLIER_PO: "Supplier PO (reference only)",
  OTHER: "Other document",
};

/** Filename keyword classifier — deterministic, order matters (first match wins). */
const CLASSIFY_RULES: { type: DocType; re: RegExp }[] = [
  { type: "ISF_FORM", re: /\bisf\b|10\+2|importer.?security/i },
  { type: "PARS_EVIDENCE", re: /\bpars\b|\bccn\b|cargo.?control/i },
  { type: "PAPS_EVIDENCE", re: /\bpaps\b|\bscn\b|shipment.?control/i },
  { type: "ARRIVAL_NOTICE", re: /arrival.?notice|notice.?of.?arrival|\ban\b[-_ ]?notice/i },
  { type: "RAIL_MANIFEST", re: /rail.?manifest|rail.?billing|in.?bond|\bit\b.?number|inland.?rail/i },
  { type: "DELIVERY_ORDER", re: /delivery.?order|\bd\.?o\.?\b.*(order)?/i },
  { type: "BROKER_ACK", re: /acknowledg|broker.?confirm/i },
  { type: "CUSTOMS_RELEASE", re: /release|rns\b|cbsa.?release|entry.?summary/i },
  { type: "PRIOR_NOTICE", re: /prior.?notice|\bpn\b.?confirm|pnsi/i },
  { type: "COA", re: /\bcoa\b|cert(ificate)?.?of.?analysis|analysis.?cert/i },
  { type: "CERT_ORIGIN", re: /origin|cusma|usmca|\bfta\b|certificate.?of.?origin|\bco\b[-_ ]?cert/i },
  { type: "PACKING_LIST", re: /packing|pick.?slip|\bpl\b[-_ .]|packlist/i },
  { type: "BOL", re: /\bbol\b|\bb\/l\b|bill.?of.?lading|waybill|\bhbl\b|\bmbl\b|sea.?waybill/i },
  { type: "BOOKING_CONFIRMATION", re: /booking/i },
  { type: "COMMERCIAL_INVOICE", re: /invoice|\bci\b[-_ .]|\bcinv\b|commercial.?inv/i },
  { type: "PERMIT", re: /permit|licen[cs]e/i },
  { type: "CUSTOMER_PO", re: /customer.?po|cust.?po/i },
  { type: "SUPPLIER_PO", re: /supplier.?po|purchase.?order|\bpo\b[-_ .]?\d/i },
];

export function classifyFileName(name: string): DocType {
  for (const rule of CLASSIFY_RULES) if (rule.re.test(name)) return rule.type;
  return "OTHER";
}

/** Folder-name → default include/exclude behaviour (spec §4). */
export function folderScanPolicy(folderName: string): "INCLUDE" | "REFERENCE" | "EXCLUDE" {
  const n = folderName.toUpperCase();
  if (n.includes("EXPENSE")) return "EXCLUDE";
  if (n.includes("CUSTOMER P.O") || n.includes("CUSTOMER PO")) return "REFERENCE";
  if (n.includes("MANUFACTURER") || n.includes("SUPPLIER")) return "REFERENCE";
  if (n.includes("GENERATED CUSTOMS")) return "EXCLUDE"; // never feed output back in
  return "INCLUDE"; // C.O.A PACKING LIST, CUSTOMS & LOGISTICS, root, etc.
}

/* ──────────────── Document requirement matrix per route ──────────────── */

export type DocState =
  | "RECEIVED"
  | "NOT_YET_EXPECTED"
  | "REQUESTED"
  | "MISSING"
  | "OVERDUE"
  | "NOT_APPLICABLE";

export type Readiness =
  | "CRITICAL"
  | "TRUCK_BLOCKER"
  | "OCEAN_CRITICAL"
  | "STAGED"
  | "CONDITIONAL"
  | "SUPPORTING"
  | "CONTROL";

export interface DocRequirement {
  docType: DocType;
  label: string;
  readiness: Readiness;
  /** Stage at which a STAGED doc becomes expected (before that: NOT_YET_EXPECTED) */
  expectedFromStage?: ShipmentStage;
  note?: string;
}

export function requiredDocsFor(route: CustomsRoute): DocRequirement[] {
  const { countryOfImport: c, borderMode: b, inlandMode: i } = route;
  const reqs: DocRequirement[] = [
    {
      docType: "COMMERCIAL_INVOICE",
      label: DOC_TYPE_LABELS.COMMERCIAL_INVOICE,
      readiness: "CRITICAL",
      note: "Vendor commercial invoice (or CI1-equivalent data for Canada).",
    },
    {
      docType: "PACKING_LIST",
      label: DOC_TYPE_LABELS.PACKING_LIST,
      readiness: "CRITICAL",
      note: "Packages, quantities, weights and lots must reconcile.",
    },
    {
      docType: "BOL",
      label: DOC_TYPE_LABELS.BOL,
      readiness: "CRITICAL",
      note: "Mode-specific transport document / cargo control reference.",
    },
    {
      docType: "CERT_ORIGIN",
      label: DOC_TYPE_LABELS.CERT_ORIGIN,
      readiness: "CRITICAL",
      note: "Line-level origin support. Unsupported preferential claims are blocked.",
    },
    {
      docType: "COA",
      label: DOC_TYPE_LABELS.COA,
      readiness: "SUPPORTING",
      note: "Include only lot-matched COAs.",
    },
  ];

  if (c === "CA" && b === "TRUCK") {
    reqs.push({
      docType: "PARS_EVIDENCE",
      label: "PARS / CCN + Canadian port of entry",
      readiness: "TRUCK_BLOCKER",
      note: "Carrier-provided. Blocks Ready to Send. The ERP never generates PARS.",
    });
  }
  if (c === "US" && b === "TRUCK") {
    reqs.push({
      docType: "PAPS_EVIDENCE",
      label: "PAPS / SCN + U.S. port of entry",
      readiness: "TRUCK_BLOCKER",
      note: "Carrier-provided. Blocks Ready to Send. The ERP never generates PAPS.",
    });
    reqs.push({
      docType: "PRIOR_NOTICE",
      label: DOC_TYPE_LABELS.PRIOR_NOTICE,
      readiness: "CONDITIONAL",
      note: "Food lines only. Independent from FSVP.",
    });
  }
  if (c === "US" && b === "OCEAN") {
    reqs.push({
      docType: "ISF_FORM",
      label: "ISF filing / acceptance evidence",
      readiness: "OCEAN_CRITICAL",
      note: "ISF is due before lading — do not wait for arrival documents.",
    });
  }
  if (b === "OCEAN") {
    reqs.push({
      docType: "ARRIVAL_NOTICE",
      label: DOC_TYPE_LABELS.ARRIVAL_NOTICE,
      readiness: "STAGED",
      expectedFromStage: "PRE_ARRIVAL",
      note: "Usually issued later — Not Yet Expected until the pre-arrival window.",
    });
  }
  if (i === "RAIL" || b === "RAIL") {
    reqs.push({
      docType: "RAIL_MANIFEST",
      label: DOC_TYPE_LABELS.RAIL_MANIFEST,
      readiness: "STAGED",
      expectedFromStage: "IN_TRANSIT",
      note: "Rail carrier / steamship inland routing, ramps and in-bond reference.",
    });
  }
  reqs.push({
    docType: "BROKER_ACK",
    label: DOC_TYPE_LABELS.BROKER_ACK,
    readiness: "CONTROL",
    expectedFromStage: "PRE_ARRIVAL",
    note: "Sent is not complete — track acknowledgement and release.",
  });
  return reqs;
}

/** Default state for a requirement given the current stage (before any file matches). */
export function defaultDocState(req: DocRequirement, stage: ShipmentStage): DocState {
  if (req.readiness === "STAGED" || req.readiness === "CONTROL") {
    if (req.expectedFromStage && !stageAtLeast(stage, req.expectedFromStage)) {
      return "NOT_YET_EXPECTED";
    }
  }
  return "MISSING";
}

/* ─────────────────────────── Deadline engine ─────────────────────────── */

export type DeadlineSeverity = "info" | "amber" | "red";

export interface DeadlineInput {
  /** ISO strings or Date — all optional; missing anchors → deadline omitted or estimated */
  etd?: string | Date | null;
  ladingDate?: string | Date | null;
  eta?: string | Date | null;
  borderEta?: string | Date | null;
  lastFreeDay?: string | Date | null;
  sentAt?: string | Date | null;
}

export interface ComputedDeadline {
  key: string;
  label: string;
  dueAt: string | null; // ISO
  severity: DeadlineSeverity;
  basis: string;
  estimated?: boolean;
  owner?: string;
}

const HOUR = 3600000;
const DAY = 24 * HOUR;

function toDate(v?: string | Date | null): Date | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  return isNaN(d.getTime()) ? null : d;
}
const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
const minus = (d: Date | null, ms: number): Date | null => (d ? new Date(d.getTime() - ms) : null);

/** FDA Prior Notice minimum lead time by mode into the U.S. (spec §7.2 / R6). */
export function priorNoticeHours(borderMode: BorderMode): number {
  switch (borderMode) {
    case "TRUCK":
      return 2;
    case "RAIL":
    case "AIR":
      return 4;
    case "OCEAN":
      return 8;
  }
}

/**
 * Compute the deadline plan for a route (spec §8). Internal targets are
 * intentionally earlier than official minimums.
 */
export function computeDeadlines(route: CustomsRoute, d: DeadlineInput): ComputedDeadline[] {
  const out: ComputedDeadline[] = [];
  const { countryOfImport: c, borderMode: b, inlandMode: i } = route;

  const lading = toDate(d.ladingDate);
  const etd = toDate(d.etd);
  const eta = toDate(d.eta);
  const borderEta = toDate(d.borderEta) || (b === "TRUCK" ? eta : null);
  const lfd = toDate(d.lastFreeDay);
  const sentAt = toDate(d.sentAt);

  if (c === "US" && b === "OCEAN") {
    const anchor = lading || etd;
    const estimated = !lading && !!etd;
    out.push({
      key: "ISF_INTERNAL",
      label: "ISF internal target (48h before lading)",
      dueAt: iso(minus(anchor, 48 * HOUR)),
      severity: "amber",
      basis: estimated ? "Estimated from ETD — update when lading date is known" : "Vida internal target",
      estimated,
      owner: "Logistics",
    });
    out.push({
      key: "ISF_OFFICIAL",
      label: "ISF official deadline (24h before lading)",
      dueAt: iso(minus(anchor, 24 * HOUR)),
      severity: "red",
      basis: "CBP ISF 10+2 [R1]",
      estimated,
      owner: "Logistics",
    });
  }

  if (c === "CA" && b === "TRUCK") {
    out.push({
      key: "PARS_INTERNAL",
      label: "PARS package to DSV (24h before border ETA)",
      dueAt: iso(minus(borderEta, 24 * HOUR)),
      severity: "amber",
      basis: "Vida internal target",
      owner: "Customs",
    });
    out.push({
      key: "PARS_OFFICIAL",
      label: "PARS critical — invoice/BOL to broker (2h before arrival)",
      dueAt: iso(minus(borderEta, 2 * HOUR)),
      severity: "red",
      basis: "CBSA stated PARS process [R4]",
      owner: "Customs",
    });
  }

  if (c === "US" && b === "TRUCK") {
    out.push({
      key: "PAPS_INTERNAL",
      label: "PAPS package to broker (24h before border ETA)",
      dueAt: iso(minus(borderEta, 24 * HOUR)),
      severity: "amber",
      basis: "Vida internal target",
      owner: "Customs",
    });
    out.push({
      key: "EMANIFEST_RISK",
      label: "Carrier eManifest window (≈1h before arrival — carrier files)",
      dueAt: iso(minus(borderEta, 1 * HOUR)),
      severity: "red",
      basis: "CBP ACE truck guidance [R5] — carrier responsibility, ERP tracks only",
      owner: "Carrier",
    });
  }

  if (c === "US") {
    const pnAnchor = b === "TRUCK" ? borderEta : eta;
    const hrs = priorNoticeHours(b);
    out.push({
      key: "PRIOR_NOTICE",
      label: `FDA Prior Notice minimum (${hrs}h before arrival — food lines only)`,
      dueAt: iso(minus(pnAnchor, hrs * HOUR)),
      severity: "red",
      basis: "FDA Prior Notice guidance [R6] — only when required",
      owner: "Customs",
    });
  }

  if (b === "OCEAN") {
    out.push({
      key: "ARRIVAL_NOTICE_EXPECTED",
      label: "Arrival notice expected window opens (10 days before ETA)",
      dueAt: iso(minus(eta, 10 * DAY)),
      severity: "info",
      basis: "Configurable steamship-line window (internal default)",
      owner: "Logistics",
    });
  }

  if (i === "RAIL" || b === "RAIL") {
    out.push({
      key: "RAIL_MANIFEST_EXPECTED",
      label: "Rail manifest / inland routing expected (14 days before ETA)",
      dueAt: iso(minus(eta, 14 * DAY)),
      severity: "info",
      basis: "Vida lane practice (~2 weeks) — configurable, not a legal deadline",
      owner: "Logistics",
    });
  }

  if (sentAt) {
    out.push({
      key: "BROKER_ACK",
      label: "Broker acknowledgement follow-up (4h after send)",
      dueAt: iso(new Date(sentAt.getTime() + 4 * HOUR)),
      severity: "amber",
      basis: "Broker profile follow-up window",
      owner: "Customs",
    });
  }

  if (lfd) {
    out.push({
      key: "LFD_48",
      label: "Last free day — 48h escalation",
      dueAt: iso(minus(lfd, 48 * HOUR)),
      severity: "amber",
      basis: "Demurrage / storage cost prevention",
      owner: "Logistics manager",
    });
    out.push({
      key: "LFD_24",
      label: "Last free day — 24h critical",
      dueAt: iso(minus(lfd, 24 * HOUR)),
      severity: "red",
      basis: "Demurrage / storage cost prevention",
      owner: "Logistics manager + Finance",
    });
  }

  return out.filter((x) => x.dueAt !== null);
}

export type DeadlineStatus = "ok" | "amber" | "red" | "overdue";

/** Live status of a deadline relative to now. */
export function deadlineStatus(dueAtIso: string, severity: DeadlineSeverity, now = new Date()): DeadlineStatus {
  const due = new Date(dueAtIso).getTime();
  const diff = due - now.getTime();
  if (diff < 0) return "overdue";
  if (diff < 24 * HOUR) return severity === "info" ? "amber" : "red";
  if (diff < 72 * HOUR) return "amber";
  return "ok";
}

/** Human countdown, e.g. "in 2d 4h" / "3h overdue". */
export function countdownLabel(dueAtIso: string, now = new Date()): string {
  let diff = new Date(dueAtIso).getTime() - now.getTime();
  const overdue = diff < 0;
  diff = Math.abs(diff);
  const days = Math.floor(diff / DAY);
  const hours = Math.floor((diff % DAY) / HOUR);
  const mins = Math.floor((diff % HOUR) / 60000);
  const core = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  return overdue ? `${core} overdue` : `in ${core}`;
}

/* ─────────────────────────── Canonical fields ─────────────────────────── */

export type FieldSource = "ERP" | "TRACKING" | "DOCUMENT" | "MANUAL";
export type FieldStatus = "verified" | "review" | "conflict" | "missing" | "waived";

export interface CanonicalFieldDef {
  key: string;
  label: string;
  group: "Parties" | "Transport" | "Route & Ports" | "Values & Weights" | "References";
}

export const CANONICAL_FIELDS: CanonicalFieldDef[] = [
  { key: "importerName", label: "Importer of record", group: "Parties" },
  { key: "supplierName", label: "Supplier / vendor", group: "Parties" },
  { key: "consigneeName", label: "Consignee", group: "Parties" },
  { key: "shipToName", label: "Ship-to / final delivery", group: "Parties" },
  { key: "carrier", label: "Carrier / SCAC", group: "Transport" },
  { key: "vessel", label: "Vessel / voyage", group: "Transport" },
  { key: "containerNo", label: "Container number(s)", group: "Transport" },
  { key: "bolNumber", label: "BOL / waybill number", group: "Transport" },
  { key: "bookingRef", label: "Booking reference", group: "Transport" },
  { key: "portOfLading", label: "Port of lading", group: "Route & Ports" },
  { key: "portOfArrival", label: "First port of arrival / unlading", group: "Route & Ports" },
  { key: "portOfEntry", label: "Customs port of entry / release", group: "Route & Ports" },
  { key: "railTerminal", label: "Inland rail destination terminal", group: "Route & Ports" },
  { key: "product", label: "Product / customs description", group: "Values & Weights" },
  { key: "invoiceValue", label: "Invoice value", group: "Values & Weights" },
  { key: "netWeightKG", label: "Net weight (kg)", group: "Values & Weights" },
  { key: "grossWeightKG", label: "Gross weight (kg)", group: "Values & Weights" },
  { key: "packages", label: "Packages (drums / pallets)", group: "Values & Weights" },
  { key: "supplierPO", label: "Supplier PO", group: "References" },
  { key: "customerPO", label: "Customer PO", group: "References" },
];

/* ─────────────────── Package naming & email templates ─────────────────── */

export function packageFileName(shipNumber: string, pkg: PackageType, version: number, date = new Date()): string {
  const d = date.toISOString().slice(0, 10);
  const safeShip = (shipNumber || "SHIPMENT").replace(/[^\w.-]+/g, "-");
  return `${safeShip}_${pkg}_v${version}_${d}.pdf`;
}

export const GENERATED_FOLDER = "Generated Customs Packages";

/** Outbound email subject templates (Appendix C). */
export function emailSubjectFor(
  pkg: PackageType,
  ctx: { shipNumber: string; pars?: string; paps?: string; poe?: string; hbl?: string; etd?: string; version: number }
): string {
  switch (pkg) {
    case "CA_TRUCK_PARS":
      return `CANADA CUSTOMS CLEARANCE - ${ctx.shipNumber} - PARS ${ctx.pars || "TBD"} - ${ctx.poe || "POE TBD"}`;
    case "US_TRUCK_PAPS":
      return `U.S. TRUCK ENTRY - ${ctx.shipNumber} - PAPS ${ctx.paps || "TBD"} - ${ctx.poe || "POE TBD"}`;
    case "US_ISF":
      return `ISF FILING REQUEST - ${ctx.shipNumber} - HBL ${ctx.hbl || "TBD"} - ETD ${ctx.etd || "TBD"}`;
    case "TRANSPORT_ADDENDUM":
      return `TRANSPORT ADDENDUM v${ctx.version} - ${ctx.shipNumber}`;
    default:
      return `CUSTOMS PACKAGE v${ctx.version} - ${ctx.shipNumber}`;
  }
}

/* ─────────────────────────── Compliance types ─────────────────────────── */

export type FsvpStatus = "SUBJECT" | "EXEMPT" | "MODIFIED" | "NOT_APPLICABLE" | "UNKNOWN";

export const FSVP_LABELS: Record<FsvpStatus, string> = {
  SUBJECT: "Subject to FSVP",
  EXEMPT: "FSVP exempt (basis required)",
  MODIFIED: "Modified requirements",
  NOT_APPLICABLE: "Not a food / not applicable",
  UNKNOWN: "Unknown — blocks send",
};

/**
 * Blockers that prevent "Ready to Send" (spec: hard controls).
 * Returns human-readable blocker strings; empty array = ready.
 */
export function readyToSendBlockers(args: {
  route: CustomsRoute;
  parsNumber?: string;
  papsNumber?: string;
  portOfEntry?: string;
  fsvpStatus?: FsvpStatus;
  fsvpDuns?: string;
  isFood?: boolean;
  priorNoticeResponsible?: string;
  criticalDocsMissing: string[];
}): string[] {
  const b: string[] = [];
  const { route } = args;
  if (route.countryOfImport === "CA" && route.borderMode === "TRUCK") {
    if (!args.parsNumber?.trim()) b.push("Carrier PARS/CCN is missing (carrier-provided — request it, never invent it)");
    if (!args.portOfEntry?.trim()) b.push("Canadian port of entry is missing");
  }
  if (route.countryOfImport === "US" && route.borderMode === "TRUCK") {
    if (!args.papsNumber?.trim()) b.push("Carrier PAPS/SCN is missing (carrier-provided — request it, never invent it)");
    if (!args.portOfEntry?.trim()) b.push("U.S. port of entry is missing");
  }
  if (route.countryOfImport === "US" && args.isFood) {
    if (!args.fsvpStatus || args.fsvpStatus === "UNKNOWN") b.push("FSVP status is Unknown for food lines");
    if (args.fsvpStatus === "SUBJECT" && !args.fsvpDuns?.trim()) b.push("FSVP importer DUNS/UFI is missing for subject food lines");
    if (!args.priorNoticeResponsible?.trim()) b.push("FDA Prior Notice responsible party is not set (independent from FSVP)");
  }
  for (const doc of args.criticalDocsMissing) b.push(`Critical document missing: ${doc}`);
  return b;
}
