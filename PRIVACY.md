# Quotemark privacy policy

Effective October 17, 2026.

Quotemark is an open-source Chrome extension maintained at https://github.com/Malanaa/quotemark. Its single purpose is to save text you select and, if you choose, archive it to formatted Google Docs in your Google Drive.

## What the extension stores

Quotemark stores quotes you deliberately save, their source page titles and URLs, dates, collection names, optional notes, favorite state, sync status, and Google document/folder IDs in `chrome.storage.local` on your device. It also stores the connected Google account’s display name, email address when provided, and Drive permission identifier to display the connection and keep accounts separate. Local extension storage is not end-to-end encrypted by Quotemark.

The extension reads the current selection and page title/URL only when you use its toolbar capture button, keyboard shortcut, or right-click save action. It does not continuously monitor pages or collect browsing history. Source URLs can include query parameters and fragments; remove sensitive source information before saving, or use Paste and omit the source URL.

## Google account access

Google sign-in is optional. Without it, quotes stay locally on your device. After you explicitly connect, pending unassigned quotes and quotes associated with that account are uploaded directly to Google Drive and Google Docs. New captures made while connected are also synced automatically. Uploaded data consists of the selected quote text, source title and URL, capture date, collection name, and note. Favorites remain local.

Quotemark requests only `https://www.googleapis.com/auth/drive.file`. This allows access to files created or explicitly opened with the app. It does not request unrestricted access to your Drive. Quotemark creates a folder and monthly collection documents and uses named ranges inside them to avoid duplicate uploads. It does not change file-sharing permissions. Documents inherit your Google Drive account’s applicable sharing and organizational settings.

Google OAuth tokens are handled by Chrome Identity and used in HTTPS authorization headers. Quotemark does not store tokens in its quote database, export them, or send them to the developer. Google and Chrome process information under their own privacy policies.

## No developer data collection

There is no Quotemark backend, analytics, advertising, tracking SDK, or remote executable code. The developer does not receive, sell, rent, or use your quotes, account information, or Google data for advertising or AI training. Google user data is used only for the user-facing quote-saving and Drive-archiving features. Use of information received from Google APIs adheres to the Google API Services User Data Policy, including Limited Use requirements.

Opening a GitHub, source, or Google Docs link navigates to that service, which is governed by its own policies. The extension does not fetch source pages in the background. Exports create local downloads under your control.

## Retention and deletion

Local records remain until you remove them or uninstall the extension. Use the library’s Remove action to delete individual local records. Uninstalling removes the extension’s local storage; export a backup first. Removing local records does not delete their Google Docs copies. Delete the documents or the Quotemark folder in Google Drive to remove the cloud copies using Google’s normal deletion and retention controls.

Disconnecting stops future uploads and clears cached Chrome Identity tokens for Quotemark while preserving local quotes and cloud documents. To revoke the authorization grant itself, remove Quotemark from your Google account’s third-party connections. Previously account-bound pending quotes require the original Google account to sync.

## Contact and changes

Ask questions or report privacy issues at https://github.com/Malanaa/quotemark/issues. Do not include private quote content or credentials in public issues. Policy updates will be published in this repository with an updated effective date.
