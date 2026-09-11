# Private Google Sheets daily summaries

The sheet owner opens Google Sheets on a computer and chooses **ยอดขายร้าน > ดึงสรุปวันนี้** or **ดึงสรุปตามวันที่**. No Apps Script web app deployment is needed. No doGet/doPost public entry points exist. This is manual, not scheduled; re-pull a date after cancelling an older bill.

The bound script sends an HMAC-SHA256 signed read request to the POS over HTTPS. The signature covers the fixed spreadsheet ID, action, date and five-minute timestamp. The dedicated key grants access only to daily aggregates. It cannot list bills, change menus or create/cancel sales. D1 remains the primary record of bills. One row per Bangkok calendar day is upserted under a script lock; stale responses are rejected. Satang is converted to baht only for spreadsheet display.

## Setup
1. Copy Code.gs into the bound Apps Script project. Keep it unpublished.
2. The owner runs setup once, then reloads the sheet. Existing WEBHOOK_SECRET is reused; a new installation generates it in Script Properties.
3. Store the same value as the POS server secret GOOGLE_SHEETS_PULL_SECRET and publish the POS. Never put it in GitHub or spreadsheet cells. Anyone who can edit the bound script can read its properties, so only trusted shop administrators should have sheet edit access.
4. On the first pull, Google asks the owner to authorize spreadsheet access and external requests to the POS. Approve in the Google UI. This does not enable billing or require a paid Google Workspace account.

The custom menu is available in the desktop web editor; Google Sheets mobile apps do not support this custom menu. The POS itself remains usable on mobile.

Tests: node tests/daily-summary.mjs; node tests/sheets-access.mjs (local TEST_PULL_SECRET configured); TypeScript and production build.

References: https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app and https://developers.google.com/apps-script/guides/services/quotas
