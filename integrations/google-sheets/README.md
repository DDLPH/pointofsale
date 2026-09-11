# Google Sheets daily summary

The admin selects a date in the POS report and clicks **ส่งสรุปไป Google Sheets**. This is a manual export, not a scheduled job. Re-export after cancelling an old bill to update that date. D1 remains the primary record of every bill.

The server calculates totals for 00:00–24:00 Asia/Bangkok from D1, excluding cancelled bills from revenue. It sends only date, paid bill count, cash/transfer revenue, cancelled count and snapshot timestamp. Amounts are integer satang in transit and baht in the sheet. The Apps Script upserts one row per date under a script lock and rejects older exports. The request is signed with HMAC-SHA256 and expires after five minutes.

## One-time setup by the sheet owner

1. Copy `Code.gs` into the bound Apps Script project of the destination sheet.
2. Run `setup` and authorize its spreadsheet access. This creates the **สรุปรายวัน** tab and a random `WEBHOOK_SECRET` in Script Properties. Do not publish the secret or commit it. Re-running setup preserves it.
3. In Apps Script, deploy a **Web app**, execute as the owner, access **Anyone**. Only correctly signed POST requests can write; there is no public read endpoint. This does not require purchasing Google Workspace or enabling Google Cloud billing.
4. Copy the `/exec` deployment URL to the POS server environment `GOOGLE_SHEETS_WEBHOOK_URL`. Copy the Script Property `WEBHOOK_SECRET` to the secret environment variable `GOOGLE_SHEETS_WEBHOOK_SECRET`. Apply through Sites runtime configuration, then publish the saved POS version.
5. Test a daily export, export the same day twice and confirm one row. Never enter test sales into the live store solely to test the integration.

The provided spreadsheet ID is fixed in both components; changing destination requires updating both. Keep the destination sheet restricted to appropriate shop users: its sharing permissions control who can read exported sales and who can edit its bound script. Keep column headers and the hidden timestamp column unchanged.

Apps Script has daily quotas and execution limits; failures show a retryable error in the POS rather than reporting success. No paid services or automatic billing are configured by this integration.

Validation: `node tests/daily-summary.mjs` and `node node_modules/typescript/bin/tsc --noEmit`.

Google references: https://developers.google.com/apps-script/guides/web and https://developers.google.com/apps-script/guides/services/quotas
