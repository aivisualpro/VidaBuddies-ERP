import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * CustomsPackage — one shipment-scoped customs compliance record (spec v2).
 * The shipment is the parent; never built at the customer-PO level.
 * Versions are immutable once SENT — corrections create a new version.
 */

export interface ICustomsDoc {
  docType: string;
  label: string;
  readiness: string;
  state: string; // RECEIVED | NOT_YET_EXPECTED | REQUESTED | MISSING | OVERDUE | NOT_APPLICABLE
  included: boolean;
  fileId?: string;
  fileName?: string;
  webViewLink?: string;
  folderName?: string;
  matchedAt?: Date;
  note?: string;
}

export interface ICustomsField {
  key: string;
  label: string;
  group: string;
  value?: string;
  source: string; // ERP | TRACKING | DOCUMENT | MANUAL
  sourceDetail?: string;
  status: string; // verified | review | conflict | missing | waived
}

export interface ICustomsDeadline {
  key: string;
  label: string;
  dueAt: Date;
  severity: string;
  basis: string;
  estimated?: boolean;
  owner?: string;
}

export interface ICustomsPackage extends Document {
  shipmentId: mongoose.Types.ObjectId;
  shipNumber: string;
  vbNumber?: string;
  containerNo?: string;

  route: {
    countryOfImport: "CA" | "US";
    borderMode: "OCEAN" | "TRUCK" | "RAIL" | "AIR";
    inlandMode: "NONE" | "TRUCK" | "RAIL";
    stage: string;
  };
  packageTypes: string[];

  brokerCode?: string;
  brokerName?: string;
  brokerEmails: string[];
  importerName?: string;

  etd?: Date;
  ladingDate?: Date;
  eta?: Date;
  borderEta?: Date;
  lastFreeDay?: Date;

  documents: ICustomsDoc[];
  extraFiles: { fileId: string; fileName: string; webViewLink?: string; docType: string; folderName?: string; included: boolean }[];
  fields: ICustomsField[];
  deadlines: ICustomsDeadline[];

  compliance: {
    parsNumber?: string;
    papsNumber?: string;
    portOfEntry?: string;
    isFood?: boolean;
    fsvpStatus?: string;
    fsvpImporterName?: string;
    fsvpImporterEmail?: string;
    fsvpDuns?: string;
    fsvpExemptionBasis?: string;
    priorNoticeRequired?: boolean;
    priorNoticeResponsible?: string;
    priorNoticeConfirmation?: string;
  };

  status: string; // DRAFT | READY_FOR_REVIEW | APPROVED | SENT | ACKNOWLEDGED | RELEASED | SUPERSEDED
  version: number;
  rulesetVersion: string;

  generated: {
    packageType: string;
    fileName: string;
    driveFileId?: string;
    webViewLink?: string;
    version: number;
    at: Date;
  }[];
  sends: {
    at: Date;
    to: string[];
    subject: string;
    messageId?: string;
    packageVersion: number;
  }[];
  audit: { at: Date; user?: string; action: string; detail?: string }[];

  createdAt: Date;
  updatedAt: Date;
}

const CustomsPackageSchema: Schema = new Schema(
  {
    shipmentId: { type: Schema.Types.ObjectId, ref: "VBshipping", index: true, required: true },
    shipNumber: { type: String, required: true, index: true },
    vbNumber: { type: String },
    containerNo: { type: String },

    route: {
      countryOfImport: { type: String, enum: ["CA", "US"], default: "CA" },
      borderMode: { type: String, enum: ["OCEAN", "TRUCK", "RAIL", "AIR"], default: "OCEAN" },
      inlandMode: { type: String, enum: ["NONE", "TRUCK", "RAIL"], default: "NONE" },
      stage: { type: String, default: "PRE_DEPARTURE" },
    },
    packageTypes: [{ type: String }],

    brokerCode: { type: String },
    brokerName: { type: String },
    brokerEmails: [{ type: String }],
    importerName: { type: String, default: "Vida Buddies Inc." },

    etd: { type: Date },
    ladingDate: { type: Date },
    eta: { type: Date },
    borderEta: { type: Date },
    lastFreeDay: { type: Date },

    documents: [
      {
        docType: String,
        label: String,
        readiness: String,
        state: String,
        included: { type: Boolean, default: true },
        fileId: String,
        fileName: String,
        webViewLink: String,
        folderName: String,
        matchedAt: Date,
        note: String,
      },
    ],
    extraFiles: [
      {
        fileId: String,
        fileName: String,
        webViewLink: String,
        docType: String,
        folderName: String,
        included: { type: Boolean, default: false },
      },
    ],
    fields: [
      {
        key: String,
        label: String,
        group: String,
        value: String,
        source: String,
        sourceDetail: String,
        status: String,
      },
    ],
    deadlines: [
      {
        key: String,
        label: String,
        dueAt: Date,
        severity: String,
        basis: String,
        estimated: Boolean,
        owner: String,
      },
    ],

    compliance: {
      parsNumber: String,
      papsNumber: String,
      portOfEntry: String,
      isFood: { type: Boolean, default: true },
      fsvpStatus: { type: String, default: "UNKNOWN" },
      fsvpImporterName: String,
      fsvpImporterEmail: String,
      fsvpDuns: String,
      fsvpExemptionBasis: String,
      priorNoticeRequired: { type: Boolean, default: true },
      priorNoticeResponsible: String,
      priorNoticeConfirmation: String,
    },

    status: { type: String, default: "DRAFT", index: true },
    version: { type: Number, default: 1 },
    rulesetVersion: { type: String },

    generated: [
      {
        packageType: String,
        fileName: String,
        driveFileId: String,
        webViewLink: String,
        version: Number,
        at: Date,
      },
    ],
    sends: [
      {
        at: Date,
        to: [String],
        subject: String,
        messageId: String,
        packageVersion: Number,
      },
    ],
    audit: [{ at: Date, user: String, action: String, detail: String }],
  },
  { timestamps: true }
);

CustomsPackageSchema.index({ shipmentId: 1, status: 1 });

const CustomsPackage: Model<ICustomsPackage> =
  mongoose.models.CustomsPackage ||
  mongoose.model<ICustomsPackage>("CustomsPackage", CustomsPackageSchema);

export default CustomsPackage;
