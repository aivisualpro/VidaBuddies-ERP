import mongoose, { Schema, Document, Model } from 'mongoose';
import type { IChatRef, RefKind } from './VidaConversation';

/* ─── Sub-doc interfaces ─── */

export interface IMsgMention {
  userId: mongoose.Types.ObjectId;
  name: string;
}

export interface IMsgAttachment {
  url: string;
  name?: string;
  mime?: string;
  size?: number;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface IMsgReaction {
  emoji: string;
  userId: mongoose.Types.ObjectId;
}

export interface IStampedUser {
  userId: mongoose.Types.ObjectId;
  at: Date;
}

/* ─── Document interface ─── */

export interface IVidaMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  kind: 'text' | 'image' | 'file' | 'audio' | 'system';
  text?: string;
  mentions: IMsgMention[];
  refs: IChatRef[];
  attachments: IMsgAttachment[];
  replyTo?: mongoose.Types.ObjectId;
  reactions: IMsgReaction[];
  readBy: IStampedUser[];
  deliveredTo: IStampedUser[];
  editedAt?: Date;
  deletedAt?: Date;
  // Legacy compat — kept so old queries don't crash
  isRead?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/* ─── Shared sub-schemas ─── */

const ChatRefSubSchema = new Schema(
  {
    kind: { type: String, enum: ['VBNumber', 'VBSerialNumber', 'VBShipmentNumber'], required: true },
    refId: { type: String, required: true },
    display: { type: String, default: '' },
  },
  { _id: false }
);

const StampedUserSubSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'VidaUser', required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

/* ─── Schema ─── */

const VidaMessageSchema: Schema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'VidaConversation',
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'VidaUser',
      required: true,
    },

    kind: {
      type: String,
      enum: ['text', 'image', 'file', 'audio', 'system'],
      default: 'text',
    },

    text: { type: String },

    // @mentions — resolved at send-time so UI never needs a lookup
    mentions: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'VidaUser', required: true },
        name: { type: String, required: true },
        _id: false,
      },
    ],

    // # entity tags — resolved at send-time
    refs: [ChatRefSubSchema],

    // Attachments (Cloudinary / Drive / presigned)
    attachments: [
      {
        url: { type: String, required: true },
        name: { type: String },
        mime: { type: String },
        size: { type: Number },
        width: { type: Number },
        height: { type: Number },
        durationMs: { type: Number },
        _id: false,
      },
    ],

    // Quoted reply
    replyTo: { type: Schema.Types.ObjectId, ref: 'VidaMessage' },

    // Flat reaction list — one row per (emoji, userId)
    reactions: [
      {
        emoji: { type: String, required: true },
        userId: { type: Schema.Types.ObjectId, ref: 'VidaUser', required: true },
        _id: false,
      },
    ],

    // Per-user read receipts
    readBy: [StampedUserSubSchema],

    // Per-user delivery receipts
    deliveredTo: [StampedUserSubSchema],

    // Edit & soft-delete
    editedAt: { type: Date },
    deletedAt: { type: Date },

    // Legacy compat — old rows had this; new code uses readBy[]
    isRead: { type: Boolean },
  },
  { timestamps: true }
);

/* ─── Indexes ─── */

VidaMessageSchema.index({ conversationId: 1, createdAt: -1 });
VidaMessageSchema.index({ 'mentions.userId': 1, createdAt: -1 });
VidaMessageSchema.index({ 'refs.kind': 1, 'refs.refId': 1, createdAt: -1 });

/* ─── Model ─── */

const VidaMessage: Model<IVidaMessage> =
  mongoose.models.VidaMessage ||
  mongoose.model<IVidaMessage>('VidaMessage', VidaMessageSchema);

export default VidaMessage;
