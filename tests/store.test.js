import test from "node:test";
import assert from "node:assert/strict";
let database = {};
globalThis.chrome = {
  storage: {
    local: {
      get: async () => structuredClone(database),
      set: async (s) => {
        database = structuredClone(s);
      },
    },
  },
};
const { transaction, patchQuote, readState } = await import(
  "../extension/lib/store.js"
);
test("concurrent captures do not overwrite each other, even after a failed mutation", async () => {
  await Promise.all(
    Array.from({ length: 40 }, (_, id) =>
      transaction((s) => {
        s.quotes.push({ id: String(id), text: `Quote ${id}` });
      }),
    ),
  );
  assert.equal((await readState()).quotes.length, 40);
  await assert.rejects(
    transaction(() => {
      throw new Error("Failed");
    }),
    /Failed/,
  );
  await patchQuote("12", { favorite: true });
  const state = await readState();
  assert.equal(state.quotes.find((q) => q.id === "12").favorite, true);
  assert.equal(state.quotes.length, 40);
});
