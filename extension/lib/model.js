export const DEFAULT_COLLECTION = "Commonplace";
export const SOURCE_URL = "https://github.com/Malanaa/quotemark";
export function safeUrl(value) {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return "";
    url.username = "";
    url.password = "";
    return url.href;
  } catch {
    return "";
  }
}
export function cleanText(value, max = 20000) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}
export function makeQuote(input, accountId = null, now = new Date()) {
  const text = cleanText(input.text);
  if (!text) throw new Error("Highlight some text first, or paste a quote.");
  return {
    id: crypto.randomUUID(),
    text,
    title: cleanText(input.title, 500) || "Untitled source",
    url: safeUrl(input.url),
    collection: cleanText(input.collection, 60) || DEFAULT_COLLECTION,
    note: cleanText(input.note, 2000),
    createdAt: now.toISOString(),
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    favorite: false,
    status: "pending",
    accountId,
    attempts: 0,
    nextAttemptAt: 0,
  };
}
export function monthLabel(month) {
  const [year, number] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, number - 1)));
}
export function exportMarkdown(quotes) {
  return (
    "# Quotemark\n\n" +
    quotes
      .map(
        (q) =>
          `## ${q.collection}\n\n${q.text
            .split("\n")
            .map((line) => `> ${line}`)
            .join(
              "\n",
            )}\n\n${q.title}${q.url ? ` — ${q.url}` : ""}\n\nSaved ${q.createdAt}${q.note ? `\n\n${q.note}` : ""}\n`,
      )
      .join("\n---\n\n")
  );
}
export function markerName(quote) {
  return `quotemark_${quote.id.replace(/-/g, "")}`;
}
export function hasMarker(doc, quote) {
  return Boolean(doc.namedRanges?.[markerName(quote)]);
}
export function buildAppend(doc, quote) {
  const index = (doc.body?.content?.at(-1)?.endIndex ?? 2) - 1;
  const header =
    index === 1
      ? `${quote.collection}\n${monthLabel(quote.month)} · Collected with Quotemark\n\n`
      : "";
  const date = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(quote.createdAt));
  const quoteText = `“${quote.text}”\n`;
  const source = `${quote.title}\n`;
  const detail = `Saved ${date}${quote.note ? `\n${quote.note}` : ""}\n\n`;
  const text = header + quoteText + source + detail;
  const start = index + header.length;
  const sourceStart = start + quoteText.length;
  const range = (s, e) => ({ startIndex: s, endIndex: e });
  const green = { color: { rgbColor: { red: 0.13, green: 0.29, blue: 0.23 } } };
  const requests = [
    { insertText: { location: { index }, text } },
    {
      updateTextStyle: {
        range: range(index, index + text.length),
        textStyle: {
          weightedFontFamily: { fontFamily: "Georgia" },
          fontSize: { magnitude: 12, unit: "PT" },
          foregroundColor: {
            color: { rgbColor: { red: 0.15, green: 0.18, blue: 0.16 } },
          },
          bold: false,
          italic: false,
        },
        fields: "weightedFontFamily,fontSize,foregroundColor,bold,italic,link",
      },
    },
    {
      updateParagraphStyle: {
        range: range(index, index + text.length),
        paragraphStyle: {
          namedStyleType: "NORMAL_TEXT",
          spaceAbove: { magnitude: 0, unit: "PT" },
          spaceBelow: { magnitude: 8, unit: "PT" },
        },
        fields: "namedStyleType,spaceAbove,spaceBelow",
      },
    },
    {
      updateTextStyle: {
        range: range(start, sourceStart),
        textStyle: {
          fontSize: { magnitude: 15, unit: "PT" },
          foregroundColor: green,
        },
        fields: "fontSize,foregroundColor",
      },
    },
    {
      updateTextStyle: {
        range: range(sourceStart, sourceStart + source.length - 1),
        textStyle: {
          fontSize: { magnitude: 10, unit: "PT" },
          bold: true,
          ...(quote.url ? { link: { url: quote.url } } : {}),
        },
        fields: quote.url ? "fontSize,bold,link" : "fontSize,bold",
      },
    },
    {
      updateTextStyle: {
        range: range(sourceStart + source.length, index + text.length),
        textStyle: { fontSize: { magnitude: 9, unit: "PT" } },
        fields: "fontSize",
      },
    },
    {
      createNamedRange: {
        name: markerName(quote),
        range: range(start, sourceStart),
      },
    },
  ];
  if (header)
    requests.push({
      updateParagraphStyle: {
        range: range(index, index + quote.collection.length),
        paragraphStyle: { namedStyleType: "TITLE" },
        fields: "namedStyleType",
      },
    });
  return { requests, writeControl: { requiredRevisionId: doc.revisionId } };
}
