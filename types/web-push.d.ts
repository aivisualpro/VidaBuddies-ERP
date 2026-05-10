declare module "web-push" {
  interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  interface SendResult {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  }

  interface RequestOptions {
    TTL?: number;
    urgency?: "very-low" | "low" | "normal" | "high";
    topic?: string;
    headers?: Record<string, string>;
  }

  interface VapidKeys {
    publicKey: string;
    privateKey: string;
  }

  function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string
  ): void;

  function generateVAPIDKeys(): VapidKeys;

  function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer | null,
    options?: RequestOptions
  ): Promise<SendResult>;

  export {
    setVapidDetails,
    generateVAPIDKeys,
    sendNotification,
    PushSubscription,
    SendResult,
    RequestOptions,
    VapidKeys,
  };

  export default {
    setVapidDetails,
    generateVAPIDKeys,
    sendNotification,
  };
}
