import { readdir, readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? walk(`${path}/${e.name}`) : `${path}/${e.name}`,
      ),
    )
  ).flat();
}
const files = await walk("extension");
for (const file of files.filter((f) => f.endsWith(".js")))
  execFileSync(process.execPath, ["--check", file]);
const m = JSON.parse(await readFile("extension/manifest.json", "utf8"));
if (m.manifest_version !== 3) throw new Error("Manifest V3 required");
for (const path of [
  m.background.service_worker,
  m.action.default_popup,
  ...Object.values(m.icons),
])
  await stat(`extension/${path}`);
for (const html of files.filter((f) => f.endsWith(".html"))) {
  const text = await readFile(html, "utf8");
  if (/<script[^>]+src=["']https?:|\son\w+=["']/i.test(text))
    throw new Error(`Remote/inline script in ${html}`);
  for (const [, ref] of text.matchAll(/(?:src|href)="([^"#]+)"/g))
    if (!/^https?:/.test(ref)) await stat(`extension/${ref}`);
}
if (m.permissions.includes("tabs") || m.host_permissions.includes("<all_urls>"))
  throw new Error("Unexpected broad permission");
console.log(
  `Validated manifest, packaged resources, CSP-compatible HTML and ${files.filter((f) => f.endsWith(".js")).length} JavaScript modules.`,
);
