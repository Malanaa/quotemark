# Enable Google Drive sync

Local capture works before this setup. Public distribution needs a publisher-owned Google OAuth client that matches the extension’s ID. A Chrome extension is a public OAuth client: **never add a client secret**.

## 1. Choose a stable extension ID

For local development, run `npm run build`. The output prints a stable development ID derived from `extension-key.json`.

For Chrome Web Store publication, upload an initial local ZIP as a **draft only**. In the developer dashboard, copy the item ID and public key from the Package page. Use that store public key in `config.local.json`; do not use a private signing key. The OAuth client’s item ID must match the ID printed by your configured build and the store item.

Google’s instructions: https://developer.chrome.com/docs/extensions/how-to/integrate/oauth

## 2. Create an unbilled Cloud project

At https://console.cloud.google.com/ create a project for Quotemark. Check its billing status: Google may automatically link an existing billing account. Remove that link for this project before proceeding if you require a strictly unbilled setup. Do not create paid compute resources or enable paid products.

Enable **Google Drive API** and **Google Docs API** in APIs & Services → Library. This extension uses their standard REST endpoints, not agent/MCP products. Standard usage is available without additional charges, subject to Google’s quotas and policies. Keep billing disabled; do not request quota increases or enable overage billing.

References:

- https://developers.google.com/workspace/drive/api/guides/limits
- https://developers.google.com/workspace/docs/api/limits

## 3. Configure Google Auth Platform

1. Set the app name to **Quotemark** and supply your support/contact email.
2. Choose **External** if people outside your organization will install it.
3. Request only `https://www.googleapis.com/auth/drive.file` under Data Access. Do not request unrestricted Drive or Docs scopes.
4. Start in **Testing** and add your Google account as a test user. Follow Google’s current requirements to move to production before public use.
5. Review and accept required Google policy declarations yourself or through an explicitly approved setup flow.

The `drive.file` scope is classified as non-sensitive and works with both Drive and Docs APIs: https://developers.google.com/workspace/drive/api/guides/api-specific-auth

## 4. Create the public OAuth client

Google Auth Platform → Clients → Create client:

- Application type: **Chrome Extension**.
- Name: **Quotemark Chrome**.
- Item ID: your stable extension ID from step 1.

Copy the generated client ID into `config.local.json` in the repository root:

```json
{
  "clientId": "YOUR_REAL_CLIENT_ID.apps.googleusercontent.com",
  "publicKey": "YOUR_EXTENSION_PUBLIC_KEY_BASE64"
}
```

The public key can be copied from `extension-key.json` for development or the Web Store Package page for publication. The local configuration file is ignored by Git. OAuth client IDs and extension public keys are public identifiers, not secrets.

```sh
npm run build:release
```

Confirm `googleDriveConfigured` is true and the printed extension ID matches the OAuth client and the store item. Reload the unpacked extension, or upload the configured ZIP to the draft store item.

## 5. Verify live behavior

1. Open Quotemark and choose **Connect Drive**. Complete the Google consent flow.
2. Save a short synthetic quote, with a source URL and a note.
3. Wait for **In Google Docs**, then open **Doc ↗**.
4. Verify the heading, quote, source link, date, and note.
5. Save another quote to the same collection. Confirm it appends to the same monthly document without overwriting earlier text.
6. Disconnect Drive, save another quote, reconnect, and confirm it uploads once.
7. Verify a failed upload keeps its local copy and can be retried with **Sync now**.

Use a dedicated Chrome profile for OAuth testing where practical. `getAuthToken` uses the Chrome profile’s Google identity. Account switching must be deliberate; old account-bound queued quotes stay associated with their original account.

## Troubleshooting

- **Local-only build:** there is no `oauth2` block until you configure a real client. The extension explains this in Settings.
- **Bad client ID / OAuth2 request failed:** check Chrome Extension client type, exact extension ID, enabled APIs, test users, and consent configuration.
- **Access blocked:** confirm the signed-in Google account is an allowed test user or move the app to production according to Google’s rules.
- **403 / permission denied:** make sure both APIs are enabled and the destination document is accessible to the account that created it.
- **Account changed:** disconnect and reconnect in Quotemark. Old queued quotes require their original account.
- **Deleted destination:** restore the folder or document in Drive, then use Sync now.
- **Rate limit / offline:** quotes remain local. Automatic retries use backoff and stop after eight failed attempts; Sync now permits another manual attempt.
