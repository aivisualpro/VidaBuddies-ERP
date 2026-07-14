import mongoose, { Schema } from "mongoose";

/**
 * EmailAutomation — recurring shipment-status email schedules.
 *
 * Created from the Live Tracking panel ("Email Automations" button).
 * A cron job (/api/cron/email-automations) evaluates these every hour and
 * sends a rich HTML snapshot of the shipment to the recipients at the
 * configured local time. Automations auto-deactivate once the shipment
 * is delivered (after sending a final delivery notice).
 */
export interface IEmailAutomation {
  containerNo: string;
  shippingId?: mongoose.Types.ObjectId | null; // VBshipping._id
  recipients: string[];
  frequencyDays: 1 | 2 | 3;
  sendTime: string;   // "HH:mm" 24h — local to `timezone`
  timezone: string;   // IANA, e.g. "America/Toronto"
  active: boolean;
  lastSentAt?: Date | null;
  deliveredNoticeSent?: boolean;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const EmailAutomationSchema = new Schema<IEmailAutomation>(
  {
    containerNo: { type: String, required: true, index: true },
    shippingId: { type: Schema.Types.ObjectId, ref: "VBshipping", default: null },
    recipients: {
      type: [String],
      required: true,
      validate: [(v: string[]) => v.length > 0, "At least one recipient required"],
    },
    frequencyDays: { type: Number, enum: [1, 2, 3], default: 1 },
    sendTime: { type: String, default: "09:00" },
    timezone: { type: String, default: "America/Toronto" },
    active: { type: Boolean, default: true, index: true },
    lastSentAt: { type: Date, default: null },
    deliveredNoticeSent: { type: Boolean, default: false },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export default (mongoose.models.EmailAutomation as mongoose.Model<IEmailAutomation>) ||
  mongoose.model<IEmailAutomation>("EmailAutomation", EmailAutomationSchema);
