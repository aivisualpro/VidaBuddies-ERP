import mongoose, { Schema, Document, Model } from 'mongoose';

/* ─── Shared sub-doc type ─── */

export type RefKind = 'VBNumber' | 'VBSerialNumber' | 'VBShipmentNumber';

export interface IChatRef {
  kind: RefKind;
  refId: string;    // raw ObjectId-string — matches VidaTimeline storage
  display: string;  // resolved at write-time (e.g. "VB412")
}

/* ─── Document interface ─── */

export interface IVidaConversation extends Document {
  kind: 'dm' | 'group' | 'ref';
  name?: string;
  icon?: string;
  participants: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  admins: mongoose.Types.ObjectId[];
  refs: IChatRef[];
  pinned: mongoose.Types.ObjectId[];
  mutedBy: mongoose.Types.ObjectId[];
  archivedBy: mongoose.Types.ObjectId[];
  lastMessage?: string;
  lastMessageAt?: Date;
  lastMessageBy?: mongoose.Types.ObjectId;
  unreadBy: Map<string, number>;
  typing: Map<string, Date>;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ─── Schema ─── */

const ChatRefSubSchema = new Schema(
  {
    kind: { type: String, enum: ['VBNumber', 'VBSerialNumber', 'VBShipmentNumber'], required: true },
    refId: { type: String, required: true },
    display: { type: String, default: '' },
  },
  { _id: false }
);

const VidaConversationSchema: Schema = new Schema(
  {
    kind: {
      type: String,
      enum: ['dm', 'group', 'ref'],
      default: 'dm',
    },
    name: { type: String },
    icon: { type: String },

    participants: [{ type: Schema.Types.ObjectId, ref: 'VidaUser' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'VidaUser' },
    admins: [{ type: Schema.Types.ObjectId, ref: 'VidaUser' }],

    refs: [ChatRefSubSchema],

    pinned: [{ type: Schema.Types.ObjectId, ref: 'VidaMessage' }],
    mutedBy: [{ type: Schema.Types.ObjectId, ref: 'VidaUser' }],
    archivedBy: [{ type: Schema.Types.ObjectId, ref: 'VidaUser' }],

    lastMessage: { type: String },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageBy: { type: Schema.Types.ObjectId, ref: 'VidaUser' },

    // userId → unread count  (fast badge reads, no aggregation needed)
    unreadBy: { type: Map, of: Number, default: {} },

    // userId → last-typed timestamp  (transient; could be cleaned by cron)
    typing: { type: Map, of: Date, default: {} },
  },
  { timestamps: true }
);

/* ─── Indexes ─── */

VidaConversationSchema.index({ participants: 1 });
VidaConversationSchema.index({ 'refs.kind': 1, 'refs.refId': 1 });
VidaConversationSchema.index({ lastMessageAt: -1 });

// For "ref" kind: at most one conversation per (kind+refId) pair.
// Sparse so DM / group rows (that have no refs) are ignored.
VidaConversationSchema.index(
  { kind: 1, 'refs.kind': 1, 'refs.refId': 1 },
  {
    unique: true,
    partialFilterExpression: { kind: 'ref' },
    name: 'unique_ref_conversation',
  }
);

/* ─── Model ─── */

// Prevent duplicate models during hot-reloads
const VidaConversation: Model<IVidaConversation> =
  mongoose.models.VidaConversation ||
  mongoose.model<IVidaConversation>('VidaConversation', VidaConversationSchema);

export default VidaConversation;
