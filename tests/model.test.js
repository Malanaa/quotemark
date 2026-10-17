import test from "node:test";
import assert from "node:assert/strict";
import {
  makeQuote,
  safeUrl,
  buildAppend,
  hasMarker,
  markerName,
  exportMarkdown,
  monthLabel,
} from "../extension/lib/model.js";

test("quotes preserve useful Unicode, strip controls, and use the capture month", () => {
  const quote = makeQuote(
    {
      text: "  A thought 🪴\u0000\r\nworth saving  ",
      url: "https://name:secret@example.com/article#passage",
      collection: " Books ",
    },
    "account",
    new Date("2026-10-17T19:00:00Z"),
  );
  assert.equal(quote.text, "A thought 🪴\nworth saving");
  assert.equal(quote.url, "https://example.com/article#passage");
  assert.equal(quote.collection, "Books");
  assert.equal(quote.month, "2026-10");
  assert.equal(quote.accountId, "account");
  assert.throws(() => makeQuote({ text: " \u0000 " }), /Highlight/);
  assert.equal(makeQuote({ text: "x".repeat(30000) }).text.length, 20000);
});
test("source links reject active or internal schemes", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,bad",
    "chrome://settings",
    "file:///etc/passwd",
    "not a url",
  ])
    assert.equal(safeUrl(url), "");
  assert.equal(
    safeUrl("https://example.org/a?q=b"),
    "https://example.org/a?q=b",
  );
});
test("Google Docs batches use UTF-16 indexes and an atomic deduplication marker", () => {
  const q = makeQuote(
    {
      text: "Small 🌿 ideas.\nBig days.",
      title: "A source",
      url: "https://example.org",
      note: "Remember this.",
    },
    null,
    new Date("2026-10-17"),
  );
  const batch = buildAppend(
    { revisionId: "rev1", body: { content: [{ endIndex: 2 }] } },
    q,
  );
  const inserted = batch.requests[0].insertText;
  assert.equal(inserted.location.index, 1);
  assert.match(inserted.text, /Commonplace\nOctober 2026/);
  assert.match(inserted.text, /Remember this/);
  const marker = batch.requests.find(
    (r) => r.createNamedRange,
  ).createNamedRange;
  assert.equal(
    inserted.text.slice(marker.range.startIndex - 1, marker.range.endIndex - 1),
    `“${q.text}”\n`,
  );
  const linked = batch.requests.find(
    (r) => r.updateTextStyle?.textStyle.link,
  ).updateTextStyle;
  assert.equal(
    inserted.text.slice(linked.range.startIndex - 1, linked.range.endIndex - 1),
    "A source",
  );
  assert.deepEqual(batch.writeControl, { requiredRevisionId: "rev1" });
  for (const req of batch.requests) {
    const range =
      req.updateTextStyle?.range ||
      req.updateParagraphStyle?.range ||
      req.createNamedRange?.range;
    if (range)
      assert.ok(
        range.endIndex <= inserted.text.length + 1 &&
          range.endIndex > range.startIndex,
      );
  }
  assert.equal(
    hasMarker({ namedRanges: { [markerName(q)]: { namedRanges: [{}] } } }, q),
    true,
  );
});
test("appending to an existing document preserves earlier text and omits a second header", () => {
  const q = makeQuote({ text: "Keep going." });
  const batch = buildAppend(
    { revisionId: "rev2", body: { content: [{ endIndex: 91 }] } },
    q,
  );
  assert.equal(batch.requests[0].insertText.location.index, 90);
  assert.ok(batch.requests[0].insertText.text.startsWith("“Keep going.”"));
  assert.equal(
    batch.requests.some((r) => r.deleteContentRange),
    false,
  );
});
test("portable Markdown retains multiline quotes, notes, and source URLs", () => {
  const q = makeQuote({
    text: "Line one\nLine two",
    note: "A note",
    url: "https://example.org",
    title: "Source",
  });
  const md = exportMarkdown([q]);
  assert.match(md, /> Line one\n> Line two/);
  assert.match(md, /https:\/\/example.org/);
  assert.match(md, /A note/);
  assert.equal(monthLabel("2026-10"), "October 2026");
});
