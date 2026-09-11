declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    POS_BOOTSTRAP_USERS?: string;
    GOOGLE_SHEETS_WEBHOOK_URL?: string;
    GOOGLE_SHEETS_WEBHOOK_SECRET?: string;
    BUCKET?: R2Bucket;
  }
}

