import mongoose from "mongoose";

const PushSubscriptionSchema = new mongoose.Schema(
  {
    /** The user's MongoDB _id (string) */
    userId: {
      type: String,
      required: true,
      index: true,
    },
    /** The user's email (for convenience) */
    userEmail: {
      type: String,
    },
    /** The push endpoint URL — unique per browser/device */
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },
    /** Encryption keys from the browser */
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    /** User-Agent for debugging */
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: "push_subscriptions",
  }
);

// Compound index for quick lookup per user
PushSubscriptionSchema.index({ userId: 1, endpoint: 1 });

export default mongoose.models.PushSubscription ||
  mongoose.model("PushSubscription", PushSubscriptionSchema);
