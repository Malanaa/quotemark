import { makeQuote, safeUrl } from "./lib/model.js";
import { readState, transaction, patchQuote } from "./lib/store.js";
import {
  configured,
  token,
  accountInfo,
  ensureDocument,
  appendQuote,
} from "./lib/google.js";
let syncTail = Promise.resolve();
function enqueueJob(fn) {
  const next = syncTail.then(fn);
  syncTail = next.catch(() => {});
  return next;
}
async function badge() {
  const { quotes, account } = await readState();
  const pending = quotes.filter((q) => q.status !== "synced").length;
  await chrome.action.setBadgeBackgroundColor({ color: "#245640" });
  await chrome.action.setBadgeText({ text: pending ? String(pending) : "" });
  await chrome.action.setTitle({
    title: pending
      ? `${pending} quote${pending === 1 ? "" : "s"} saved locally${account ? ", waiting to sync" : " — connect Drive to sync"}`
      : "Quotemark — saved and up to date",
  });
}
async function sync(force = false) {
  const startedAt = Date.now();
  const state = await readState();
  if (!state.account || !configured()) return;
  const eligible = state.quotes.some(
    (q) =>
      q.status !== "synced" &&
      (!q.accountId || q.accountId === state.account.id) &&
      (force || ((q.attempts || 0) < 8 && q.nextAttemptAt <= Date.now())),
  );
  if (!eligible) return;
  let actual;
  try {
    actual = await accountInfo();
  } catch (error) {
    await transaction((s) => {
      s.account.error = error.message;
    });
    return;
  }
  if (actual.id !== state.account.id) {
    await transaction((s) => {
      s.account.error =
        "Your Chrome account changed. Disconnect and reconnect Drive before syncing.";
    });
    return;
  }
  await transaction((s) => {
    if (s.account) delete s.account.error;
  });
  for (const original of state.quotes) {
    if (Date.now() - startedAt > 20000) break;
    if (
      original.status === "synced" ||
      (original.accountId && original.accountId !== actual.id) ||
      (!force &&
        (original.nextAttemptAt > Date.now() || (original.attempts || 0) >= 8))
    )
      continue;
    // Check current state to respect edits/removals queued before this upload.
    const quote = (await readState()).quotes.find((q) => q.id === original.id);
    if (!quote || quote.status === "synced") continue;
    await patchQuote(quote.id, { status: "syncing", accountId: actual.id });
    try {
      const target = quote.documentId
        ? { documentId: quote.documentId, folderId: quote.folderId }
        : await ensureDocument(quote);
      await patchQuote(quote.id, target);
      await appendQuote(target.documentId, quote);
      await patchQuote(quote.id, {
        status: "synced",
        syncedAt: new Date().toISOString(),
        error: "",
        nextAttemptAt: 0,
      });
    } catch (error) {
      const attempts = (quote.attempts || 0) + 1;
      await patchQuote(quote.id, {
        status: "error",
        error: error.message,
        attempts,
        nextAttemptAt:
          Date.now() +
          Math.min(30 * 60000, 2 ** Math.min(attempts, 10) * 30000) +
          Math.floor(Math.random() * 1000),
      });
      if ([401, 403, 429].includes(error.status) || !error.status) break;
    }
  }
  await badge();
}
export function queueSync(force = false) {
  return enqueueJob(() => sync(force));
}
async function save(input) {
  const quote = await transaction((s) => {
    const quote = makeQuote(
      { ...input, collection: input.collection || s.settings.collection },
      s.account?.id,
    );
    const duplicate = s.quotes.find(
      (q) =>
        q.text === quote.text &&
        q.url === quote.url &&
        q.collection === quote.collection,
    );
    if (duplicate) return { ...duplicate, duplicate: true };
    s.quotes.unshift(quote);
    return quote;
  });
  await badge();
  void queueSync();
  return quote;
}
async function capture(tab) {
  if (!tab?.id || !safeUrl(tab.url))
    throw new Error(
      "Open a regular web page, highlight some text, and try again.",
    );
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const el = document.activeElement;
      const input =
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLInputElement &&
          ["text", "search", "url", "email", "tel"].includes(el.type));
      const text =
        input && el.selectionStart !== null
          ? el.value.slice(el.selectionStart, el.selectionEnd)
          : window.getSelection()?.toString();
      return { text, title: document.title, url: location.href };
    },
  });
  return result?.result;
}
async function setup() {
  await chrome.storage.local.setAccessLevel({
    accessLevel: "TRUSTED_CONTEXTS",
  });
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: "save-quote",
    title: "Save quote to Quotemark",
    contexts: ["selection"],
    documentUrlPatterns: ["http://*/*", "https://*/*"],
  });
  await chrome.alarms.create("sync", { periodInMinutes: 1 });
  await badge();
}
chrome.runtime.onInstalled.addListener(() => {
  void setup();
});
chrome.runtime.onStartup.addListener(() => {
  void setup().then(() => queueSync());
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sync") void queueSync();
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "save-quote") return;
  void save({
    text: info.selectionText,
    title: tab?.title,
    url: info.frameUrl || info.pageUrl,
  }).catch(showFailure);
});
function showFailure(error) {
  void chrome.action.setBadgeText({ text: "!" });
  void chrome.action.setTitle({ title: `Quotemark: ${error.message}` });
}
chrome.commands.onCommand.addListener((command) => {
  if (command === "save-quote")
    void (async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      await save(await capture(tab));
    })().catch(showFailure);
});
async function handle(message) {
  switch (message.type) {
    case "state":
      return { ...(await readState()), configured: configured() };
    case "capture": {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      return capture(tab);
    }
    case "save":
      return save(message.quote);
    case "connect":
      return enqueueJob(async () => {
        const accessToken = await token(true);
        const account = await accountInfo(accessToken);
        await transaction((s) => {
          s.account = account;
          for (const quote of s.quotes)
            if (!quote.accountId && quote.status !== "synced")
              quote.accountId = account.id;
        });
        void queueSync(true);
        return account;
      });
    case "disconnect":
      return enqueueJob(async () => {
        await chrome.identity.clearAllCachedAuthTokens();
        await transaction((s) => {
          s.account = null;
        });
        return null;
      });
    case "sync":
      await queueSync(true);
      return null;
    case "collection":
      return transaction((s) => {
        s.settings.collection = makeQuote({
          text: "_",
          collection: message.collection,
        }).collection;
      });
    case "favorite":
      return patchQuote(message.id, { favorite: Boolean(message.value) });
    case "remove":
      return enqueueJob(async () => {
        await transaction((s) => {
          s.quotes = s.quotes.filter((q) => q.id !== message.id);
        });
        await badge();
        return null;
      });
    default:
      throw new Error("Unknown request.");
  }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    sender.id !== chrome.runtime.id ||
    !sender.url?.startsWith(chrome.runtime.getURL(""))
  )
    return false;
  handle(message).then(
    (data) => respond({ ok: true, data }),
    (error) => respond({ ok: false, error: error.message }),
  );
  return true;
});
