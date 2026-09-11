declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    POS_BOOTSTRAP_USERS?: string;
    GOOGLE_SHEETS_PULL_SECRET?: string;
    BUCKET?: R2Bucket;
  }
}

