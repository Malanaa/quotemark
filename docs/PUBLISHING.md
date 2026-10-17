# Publish Quotemark

This repository is MIT-licensed and can be distributed freely as source. A GitHub ZIP release does not install automatically in Chrome or imply approval from the Chrome Web Store.

## Release preparation

- Run `npm test` and `npm run check`.
- Complete [Google setup](GOOGLE-SETUP.md) using the real store extension ID and public key.
- Verify live OAuth, document formatting, append behavior, offline capture, and retry behavior against Google.
- Run `npm run build:release` and inspect the generated `dist/quotemark/manifest.json`.
- Verify no private keys, secrets, tokens, personal data, or preview mocks are packaged.
- Keep Cloud billing disabled. Do not purchase a developer registration or a service on someone else’s behalf without a separate authorization and budget.

## Store listing copy

**Name**

Quotemark — Quotes to Google Docs

**Short description**

Keep the words that stay with you. Save highlighted quotes and sync them to formatted Google Docs in your Drive.

**Detailed description**

Build a little home for the things you underline.

Quotemark saves the sentences you want to remember from articles, essays, and other web pages. Highlight text, right-click, and choose “Save quote to Quotemark.” Your quote is kept locally with its source title, link, and date.

Connect your Google Drive to automatically collect saved quotes into formatted Google Docs. Quotemark creates a folder in your Drive, with a separate monthly document for each collection. Each entry includes the quote, a clickable source title, the date you saved it, and any note you added.

• Save from the right-click menu, toolbar, keyboard shortcut, or Paste.
• Organize quotes into collections and mark favorites.
• Search your local quote library.
• Export to Markdown or back up your local records as JSON.
• Keep saving while offline; sync resumes while Chrome is running.
• Open the original source or its Google Doc with one click.

Privacy comes first. No Quotemark backend, tracking, ads, or AI processing. Google sign-in is optional. The extension requests access only to Google Drive files created or opened with this app. Your quotes travel directly from the extension to Google when you connect.

Open source under the MIT license. Source code, support, and installation instructions: https://github.com/Malanaa/quotemark

Some browser-protected pages and canvas editors do not expose text selection to extensions. Paste a quote in those cases. This is an independent project and is not affiliated with or endorsed by Google.

**Category**: Productivity / Tools (choose the closest available store category).

**Language**: English.

**Website**: https://malanaa.github.io/quotemark/

**Support**: https://github.com/Malanaa/quotemark/issues

**Privacy policy**: https://malanaa.github.io/quotemark/privacy.html

## Permission justifications

| Permission | Why it is needed |
| --- | --- |
| `contextMenus` | Offers Save quote when the user selects text and right-clicks. |
| `storage` | Stores the local quote library, preferences, account binding, and pending sync state. |
| `activeTab` | Temporarily accesses the active page after a toolbar/shortcut user gesture. |
| `scripting` | Reads selected text, page title, and source URL after an explicit capture action; no persistent content scripts. |
| `identity` | Obtains and caches OAuth access through Chrome’s Google sign-in. |
| `alarms` | Retries pending uploads while Chrome is running. |
| `https://www.googleapis.com/*` | Calls Google Drive REST endpoints for account metadata and the app’s own files. |
| `https://docs.googleapis.com/*` | Appends formatted quote entries to app-created Google Docs. |
| OAuth `drive.file` | Creates and updates only files made or explicitly opened with Quotemark. |

## Privacy disclosures

Single purpose: Save user-selected quotes and archive them to the user’s Google Docs.

The extension handles personally identifiable information (connected account name/email), website content (the selected text and source title), and source URLs the user explicitly saves. A source URL may itself reveal browsing activity. Disclose applicable website-content, personally-identifiable-information, and web-history/source-URL categories truthfully in the dashboard. Do not claim that no user data is handled just because no developer server receives it.

No remote executable code. No data sale, advertising use, unrelated data transfer, or creditworthiness use. Google API data is used only for the visible quote-saving and document-sync features, consistent with the Limited Use policy.

## Prepared promotional assets

- [Small tile, 440×280](assets/store/tile-440x280.png)
- [Marquee, 1400×560](assets/store/marquee-1400x560.png)
- App icon: `extension/icons/128.png`

The original artwork is generated from HTML/CSS by `npm run build:store-assets`, then captured using the local preview server at the named dimensions. These are promotional images; real screenshots from an installed extension are still needed for the store listing.

## Required assets and review

Prepare real product screenshots with synthetic quotes at a supported store dimension (for example 1280×800), a 128×128 app icon, and the currently required promotional image sizes. Mark UI-preview screenshots clearly if they are from a mock and do not imply live Google sync has been tested.

Upload the initial ZIP as a draft to obtain its store ID and public key, configure OAuth, and upload the configured ZIP with the matching key. Complete Store listing, Privacy practices, Distribution, and any reviewer instructions required by the current dashboard. Do not submit a local-only package as a Drive-enabled public release.

Before submission, review all declarations for accuracy. Google may require policy acceptance, account verification, or review. Store publication can take time and is only complete once the dashboard reports the item as published and its public listing works.

Chrome’s official publishing guide: https://developer.chrome.com/docs/webstore/publish
