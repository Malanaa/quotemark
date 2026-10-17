import test from "node:test";
import assert from "node:assert/strict";
let database = {};
let apiAccount = "account-a";
let failAfterCommit = false;
let appendCalls = 0;
let createCount = 0;
let unauthenticatedOnce = false;
const listeners = {};
const docs = new Map();
const files = [];
const event = (name) => ({
  addListener: (fn) => {
    listeners[name] = fn;
  },
});
globalThis.chrome = {
  runtime: {
    id: "quotemark-test",
    getURL: (path) => `chrome-extension://quotemark-test/${path}`,
    getManifest: () => ({ oauth2: { client_id: "test" } }),
    onMessage: event("message"),
    onInstalled: event("install"),
    onStartup: event("startup"),
  },
  storage: {
    local: {
      get: async () => structuredClone(database),
      set: async (s) => {
        database = { ...database, ...structuredClone(s) };
      },
      setAccessLevel: async () => {},
    },
  },
  identity: {
    getAuthToken: async () => ({ token: "fake-token" }),
    removeCachedAuthToken: async () => {},
    clearAllCachedAuthTokens: async () => {},
  },
  action: {
    setBadgeText: async () => {},
    setBadgeBackgroundColor: async () => {},
    setTitle: async () => {},
  },
  contextMenus: {
    onClicked: event("context"),
    removeAll: async () => {},
    create: () => {},
  },
  alarms: { onAlarm: event("alarm"), create: async () => {} },
  commands: { onCommand: event("command") },
  tabs: { query: async () => [{ id: 1, url: "https://example.org" }] },
  scripting: {
    executeScript: async () => [
      {
        result: {
          text: "Captured quote",
          url: "https://example.org",
          title: "Example",
        },
      },
    ],
  },
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
globalThis.fetch = async (value, init = {}) => {
  const url = new URL(value);
  const body = init.body ? JSON.parse(init.body) : null;
  if (unauthenticatedOnce) {
    unauthenticatedOnce = false;
    return json({ error: { message: "Token expired" } }, 401);
  }
  if (url.pathname.endsWith("/about"))
    return json({
      user: {
        permissionId: apiAccount,
        displayName: "Test person",
        emailAddress: "test@example.org",
      },
    });
  if (url.pathname.endsWith("/files") && !init.method?.includes("POST")) {
    const q = url.searchParams.get("q");
    const kind = q.match(/value='(folder|document)'/)[1];
    const key = q.match(/quotemarkKey' and value='([^']+)'/)[1];
    return json({
      files: files.filter(
        (f) =>
          f.appProperties.quotemarkKind === kind &&
          f.appProperties.quotemarkKey === key &&
          f.owner === apiAccount,
      ),
    });
  }
  if (url.pathname.endsWith("/files") && init.method === "POST") {
    const file = { ...body, id: `file-${++createCount}`, owner: apiAccount };
    files.push(file);
    if (body.mimeType === "application/vnd.google-apps.document")
      docs.set(file.id, {
        revisionId: "1",
        body: { content: [{ endIndex: 2 }] },
        namedRanges: {},
        text: "",
      });
    return json({ id: file.id, name: file.name });
  }
  const id = url.pathname.split("/").at(-1).replace(":batchUpdate", "");
  const doc = docs.get(id);
  if (url.pathname.endsWith(":batchUpdate")) {
    appendCalls++;
    if (body.writeControl.requiredRevisionId !== doc.revisionId)
      return json({ error: { message: "Revision changed" } }, 400);
    doc.text += body.requests[0].insertText.text;
    const marker = body.requests.find(
      (r) => r.createNamedRange,
    ).createNamedRange;
    doc.namedRanges[marker.name] = { namedRanges: [{ range: marker.range }] };
    doc.revisionId = String(Number(doc.revisionId) + 1);
    doc.body.content = [{ endIndex: doc.text.length + 2 }];
    if (failAfterCommit) {
      failAfterCommit = false;
      throw new Error("Connection lost after server committed");
    }
    return json({});
  }
  if (doc) return json(doc);
  throw new Error(`Unexpected API request ${value}`);
};
const { queueSync } = await import("../extension/background.js");
async function message(type, extra = {}) {
  return new Promise((resolve, reject) => {
    listeners.message(
      { type, ...extra },
      { id: chrome.runtime.id, url: chrome.runtime.getURL("library.html") },
      (result) =>
        result.ok ? resolve(result.data) : reject(new Error(result.error)),
    );
  });
}
test("capture → local queue → Drive document; retries avoid duplicates and accounts stay isolated", async () => {
  const q = await message("save", {
    quote: {
      text: "A sentence worth remembering.",
      title: "Example",
      url: "https://example.org",
    },
  });
  assert.equal(database.quotes[0].status, "pending");
  assert.equal(createCount, 0);
  await message("connect");
  await queueSync();
  assert.equal(database.quotes[0].status, "synced");
  assert.equal(files.length, 2);
  assert.equal(appendCalls, 1);
  const dupe = await message("save", {
    quote: { text: q.text, title: q.title, url: q.url },
  });
  await queueSync();
  assert.equal(dupe.duplicate, true);
  assert.equal(database.quotes.length, 1);
  assert.equal(appendCalls, 1);
  failAfterCommit = true;
  await message("save", {
    quote: { text: "A second quote 🪴", title: "Other" },
  });
  await queueSync();
  assert.equal(database.quotes[0].status, "error");
  assert.equal(appendCalls, 2);
  await message("sync");
  assert.equal(database.quotes[0].status, "synced");
  assert.equal(
    appendCalls,
    2,
    "lost-response retry must find the committed named range",
  );
  assert.equal(
    docs.values().next().value.text.split("A second quote").length - 1,
    1,
  );
  // A silent Chrome account switch cannot upload pending captures into the other account.
  apiAccount = "account-b";
  await message("save", { quote: { text: "Only for account A" } });
  await queueSync();
  assert.equal(database.quotes[0].status, "pending");
  assert.match(database.account.error, /account changed/);
  await message("disconnect");
  await message("connect");
  await queueSync();
  assert.equal(database.account.id, "account-b");
  assert.equal(database.quotes[0].status, "pending");
  assert.equal(database.quotes[0].accountId, "account-a");
  // Quotes captured while disconnected are assigned at the next deliberate connection.
  await message("disconnect");
  await message("save", { quote: { text: "For my next connected account" } });
  await message("connect");
  await queueSync();
  assert.equal(database.quotes[0].status, "synced");
  assert.equal(database.quotes[0].accountId, "account-b");
  unauthenticatedOnce = true;
  await message("sync");
  assert.equal(database.account.error, undefined);
  assert.equal(database.quotes.length, 4);
  const userData = await message("state");
  assert.equal(userData.configured, true);
});
test("untrusted page senders cannot trigger extension actions", () => {
  assert.equal(
    listeners.message(
      { type: "save", quote: { text: "bad" } },
      { id: chrome.runtime.id, url: "https://evil.example/" },
      () => {},
    ),
    false,
  );
});
