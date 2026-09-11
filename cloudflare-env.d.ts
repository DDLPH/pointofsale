declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    POS_BOOTSTRAP_USERS?: string;
    BUCKET?: R2Bucket;
  }
}

