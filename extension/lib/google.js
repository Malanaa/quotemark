import { buildAppend, hasMarker, monthLabel } from "./model.js";
export class GoogleError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
export function configured() {
  return Boolean(chrome.runtime.getManifest().oauth2?.client_id);
}
export async function token(interactive = false) {
  if (!configured())
    throw new Error(
      "Google Drive setup is needed. Open Settings for the setup guide. Your quotes are safe locally.",
    );
  const result = await chrome.identity.getAuthToken({ interactive });
  if (!result?.token) throw new Error("Connect Google Drive to start syncing.");
  return result.token;
}
export async function api(
  url,
  { method = "GET", body, accessToken, retry = true } = {},
) {
  const auth = accessToken ?? (await token(false));
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${auth}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new GoogleError(
      "Connection interrupted. Your quote is saved locally; sync will retry.",
      0,
    );
  }
  if (response.status === 401 && retry) {
    await chrome.identity.removeCachedAuthToken({ token: auth });
    return api(url, { method, body, retry: false });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new GoogleError(
      data.error?.message || `Google returned ${response.status}.`,
      response.status,
    );
  return data;
}
export async function accountInfo(accessToken) {
  const { user } = await api(
    "https://www.googleapis.com/drive/v3/about?fields=user(permissionId,displayName,emailAddress)",
    { accessToken },
  );
  if (!user?.permissionId)
    throw new Error("Google did not return a Drive account.");
  return {
    id: user.permissionId,
    name: user.displayName || "Google Drive",
    email: user.emailAddress || "",
  };
}
async function findOrCreate(kind, key, metadata) {
  const q = `trashed = false and appProperties has { key='quotemarkKind' and value='${kind}' } and appProperties has { key='quotemarkKey' and value='${key}' }`;
  const params = new URLSearchParams({
    q,
    fields: "files(id,name)",
    pageSize: "100",
    orderBy: "createdTime",
  });
  const result = await api(
    `https://www.googleapis.com/drive/v3/files?${params}`,
  );
  if (result.files?.length) return result.files[0];
  return api("https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST",
    body: {
      ...metadata,
      appProperties: { quotemarkKind: kind, quotemarkKey: key },
    },
  });
}
export async function ensureDocument(quote) {
  const folder = await findOrCreate("folder", "v1", {
    name: "Quotemark",
    mimeType: "application/vnd.google-apps.folder",
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(quote.collection),
  );
  const collectionHash = Array.from(new Uint8Array(digest))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  const doc = await findOrCreate(
    "document",
    `${quote.month}:${collectionHash}`,
    {
      name: `${quote.collection} — ${monthLabel(quote.month)}`,
      mimeType: "application/vnd.google-apps.document",
      parents: [folder.id],
    },
  );
  return { documentId: doc.id, folderId: folder.id };
}
export async function appendQuote(documentId, quote) {
  const endpoint = `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`;
  // Reading again before every attempt makes retries after a lost response idempotent.
  const doc = await api(endpoint);
  if (hasMarker(doc, quote)) return;
  await api(`${endpoint}:batchUpdate`, {
    method: "POST",
    body: buildAppend(doc, quote),
  });
}
