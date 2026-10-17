import { safeUrl, exportMarkdown } from "./lib/model.js";
const $ = (selector) => document.querySelector(selector);
const isLibrary = document.body.classList.contains("library");
let state = {
  quotes: [],
  settings: { collection: "Commonplace" },
  account: null,
};
let favoritesOnly = false;
let toastTimer;
function element(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}
async function send(type, extra = {}) {
  const result = await chrome.runtime.sendMessage({ type, ...extra });
  if (!result?.ok)
    throw new Error(
      result?.error || "The extension could not respond. Please reload it.",
    );
  return result.data;
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 6500);
}
async function action(button, fn) {
  button.disabled = true;
  try {
    await fn();
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
}
function button(text, cls, fn) {
  const b = element("button", cls, text);
  b.type = "button";
  b.addEventListener("click", () => action(b, fn));
  return b;
}
function link(text, url, cls) {
  const a = element("a", cls, text);
  a.href = url;
  a.target = "_blank";
  a.rel = "noreferrer";
  return a;
}
function renderConnection() {
  const host = $("#connection");
  host.replaceChildren();
  host.classList.toggle("connected", Boolean(state.account));
  const copy = element("div", "connection-copy");
  const waiting = state.quotes.filter(
    (q) =>
      q.status !== "synced" &&
      (!q.accountId || q.accountId === state.account?.id),
  ).length;
  copy.append(
    element(
      "strong",
      "",
      state.account
        ? state.account.error
          ? "Drive needs attention"
          : "Google Drive"
        : "Google Drive",
    ),
  );
  copy.append(
    element(
      "p",
      "",
      state.account
        ? state.account.error ||
            `${state.account.email || state.account.name} · ${waiting ? `${waiting} waiting to sync` : "Synced"}`
        : "Not connected",
    ),
  );
  host.append(copy);
  host.append(
    button(
      state.account ? "Sync now" : "Connect Drive",
      "text-button",
      async () => {
        if (!state.configured && !state.account) {
          await openSettings();
          toast(
            "Google OAuth setup is needed. Follow the Google setup guide in Settings.",
          );
          return;
        }
        await send(state.account ? "sync" : "connect");
        await refresh();
        toast(
          state.account
            ? "Drive connection refreshed. Check quote status below."
            : "Saved locally.",
        );
      },
    ),
  );
  const settings = $("#settings-connection");
  settings.replaceChildren();
  if (state.account) {
    settings.append(
      element(
        "p",
        "",
        `Connected as ${state.account.email || state.account.name}`,
      ),
    );
    settings.append(
      button("Disconnect Google Drive", "secondary", async () => {
        await send("disconnect");
        await refresh();
        toast("Drive disconnected. Your quotes are still here.");
      }),
    );
    const folder = state.quotes.find(
      (q) => q.folderId && q.accountId === state.account.id,
    )?.folderId;
    if (folder && /^[\w-]+$/.test(folder))
      settings.append(
        link(
          " Open Drive folder ↗",
          `https://drive.google.com/drive/folders/${folder}`,
        ),
      );
  } else {
    settings.append(
      button("Connect Google Drive", "primary", async () => {
        await send("connect");
        await refresh();
        toast("Google Drive connected. Your saved quotes are syncing.");
      }),
    );
    if (!state.configured)
      settings.append(
        element(
          "p",
          "",
          "This build saves quotes locally. The publisher must configure a Google OAuth client before Drive sign-in is available. See Google setup below.",
        ),
      );
  }
}
function filteredQuotes() {
  const search = $("#search")?.value.toLocaleLowerCase() || "";
  const collection = $("#filter-collection")?.value || "";
  return state.quotes.filter(
    (q) =>
      (!favoritesOnly || q.favorite) &&
      (!collection || q.collection === collection) &&
      (!search ||
        [q.text, q.title, q.note, q.collection, q.url]
          .join(" ")
          .toLocaleLowerCase()
          .includes(search)),
  );
}
function renderQuotes() {
  const matches = filteredQuotes();
  $("#count").textContent = String(matches.length);
  const host = $("#quotes");
  host.replaceChildren();
  if (!matches.length) {
    const empty = element("div", "empty");
    empty.append(
      element(
        "h3",
        "",
        state.quotes.length ? "No quotes found" : "No quotes yet",
      ),
    );
    empty.append(
      element(
        "p",
        "",
        state.quotes.length
          ? "Try another search or collection."
          : "Highlight text and right-click to save, or add a quote.",
      ),
    );
    host.append(empty);
    return;
  }
  for (const q of isLibrary ? matches : matches.slice(0, 2)) {
    const card = element("article", "quote-card");
    const top = element("div", "quote-top");
    const star = button(q.favorite ? "★" : "☆", "favorite", async () => {
      await send("favorite", { id: q.id, value: !q.favorite });
      await refresh();
    });
    star.setAttribute(
      "aria-label",
      q.favorite ? "Remove from favorites" : "Add to favorites",
    );
    star.setAttribute("aria-pressed", String(q.favorite));
    top.append(element("span", "collection-tag", q.collection), star);
    card.append(top, element("blockquote", "", q.text));
    const source = element("div", "source");
    const url = safeUrl(q.url);
    source.append(url ? link(q.title, url) : element("span", "", q.title));
    card.append(source);
    if (q.note) card.append(element("p", "note", q.note));
    const bottom = element("div", "quote-bottom");
    const otherAccount = q.accountId && q.accountId !== state.account?.id;
    const status =
      q.status === "synced"
        ? "In Google Docs"
        : otherAccount
          ? "Saved · reconnect original account"
          : q.status === "syncing"
            ? "Syncing…"
            : q.status === "error"
              ? "Sync failed"
              : "Saved locally";
    bottom.append(
      element(
        "span",
        `quote-status ${q.status === "error" ? "error" : ""}`,
        status,
      ),
    );
    const date = element(
      "time",
      "",
      new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
        new Date(q.createdAt),
      ),
    );
    date.dateTime = q.createdAt;
    bottom.append(date);
    const tools = element("div", "quote-tools");
    if (q.documentId && /^[\w-]+$/.test(q.documentId))
      tools.append(
        link(
          "Doc ↗",
          `https://docs.google.com/document/d/${q.documentId}/edit`,
        ),
      );
    if (isLibrary) {
      tools.append(
        button("Copy", "", async () => {
          await navigator.clipboard.writeText(q.text);
          toast("Quote copied.");
        }),
      );
      tools.append(
        button("Remove", "", async () => {
          if (
            !confirm(
              "Remove this quote from this device? Any Google Doc copy will stay in Drive.",
            )
          )
            return;
          await send("remove", { id: q.id });
          await refresh();
          toast("Removed from this device.");
        }),
      );
    }
    bottom.append(tools);
    card.append(bottom);
    if (q.status === "error")
      card.append(
        element("p", "error-detail", q.error || "Try Sync now to retry."),
      );
    host.append(card);
  }
}
async function refresh() {
  state = await send("state");
  const filter = $("#filter-collection");
  if (filter) {
    const selected = filter.value;
    filter.replaceChildren(
      new Option("All collections", ""),
      ...Array.from(new Set(state.quotes.map((q) => q.collection)))
        .sort()
        .map((c) => new Option(c, c)),
    );
    filter.value = Array.from(filter.options).some((o) => o.value === selected)
      ? selected
      : "";
  }
  renderConnection();
  renderQuotes();
}
async function openSettings() {
  $("#default-collection").value = state.settings.collection;
  $("#settings-dialog").showModal();
}
function compose(quote = {}) {
  const form = $("#quote-form");
  form.reset();
  for (const [key, value] of Object.entries({
    ...quote,
    collection: state.settings.collection,
  }))
    if (form.elements[key]) form.elements[key].value = value || "";
  $("#compose-dialog").showModal();
}
$("#settings").addEventListener("click", () => openSettings());
$("#compose").addEventListener("click", () => compose());
for (const close of document.querySelectorAll(".close-dialog"))
  close.addEventListener("click", () => close.closest("dialog").close());
$("#save-settings").addEventListener("click", (event) =>
  action(event.target, async () => {
    await send("collection", { collection: $("#default-collection").value });
    $("#settings-dialog").close();
    await refresh();
    toast("Default collection saved.");
  }),
);
$("#quote-form").addEventListener("submit", (event) => {
  event.preventDefault();
  action(event.submitter, async () => {
    const quote = Object.fromEntries(new FormData(event.target));
    const result = await send("save", { quote });
    $("#compose-dialog").close();
    await refresh();
    toast(
      result.duplicate
        ? "Already in your collection."
        : "Quote saved.",
    );
  });
});
$("#capture")?.addEventListener("click", (event) =>
  action(event.currentTarget, async () => {
    const quote = await send("capture");
    if (!quote?.text?.trim()) {
      compose(quote);
      toast("No highlight found. You can paste a quote here.");
      return;
    }
    const saved = await send("save", { quote });
    await refresh();
    toast(
      saved.duplicate
        ? "Already in your collection."
        : "Highlighted text saved.",
    );
  }),
);
$("#search")?.addEventListener("input", renderQuotes);
$("#filter-collection")?.addEventListener("change", renderQuotes);
$("#favorites")?.addEventListener("click", () => {
  favoritesOnly = !favoritesOnly;
  $("#favorites").setAttribute("aria-pressed", String(favoritesOnly));
  renderQuotes();
});
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("#export-md")?.addEventListener("click", () =>
  download("quotemark.md", exportMarkdown(filteredQuotes()), "text/markdown"),
);
$("#export-json")?.addEventListener("click", () =>
  download(
    "quotemark-backup.json",
    JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        quotes: state.quotes,
      },
      null,
      2,
    ),
    "application/json",
  ),
);
chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === "local" &&
    (changes.quotes || changes.account || changes.settings)
  )
    void refresh().catch((error) => toast(error.message));
});
void refresh().catch((error) => toast(error.message));
