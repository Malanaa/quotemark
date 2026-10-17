let tail = Promise.resolve();
export function transaction(fn) {
  const next = tail.then(async () => {
    const state = await readState();
    const result = await fn(state);
    await chrome.storage.local.set(state);
    return result;
  });
  tail = next.catch(() => {});
  return next;
}
export async function readState() {
  const data = await chrome.storage.local.get([
    "quotes",
    "settings",
    "account",
  ]);
  return {
    quotes: data.quotes ?? [],
    settings: { collection: "Commonplace", ...data.settings },
    account: data.account ?? null,
  };
}
export async function patchQuote(id, patch) {
  return transaction((state) => {
    const quote = state.quotes.find((q) => q.id === id);
    if (quote) Object.assign(quote, patch);
    return quote;
  });
}
