import { cp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { generateKeyPairSync, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const root = new URL("../", import.meta.url);
const config = await readFile(new URL("config.local.json", root), "utf8")
  .then(JSON.parse)
  .catch(() => ({}));
const manifest = JSON.parse(
  await readFile(new URL("extension/manifest.json", root), "utf8"),
);
if (config.clientId && !process.argv.includes("--local")) {
  if (!/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(config.clientId))
    throw new Error("Invalid Google OAuth client ID");
  manifest.oauth2 = {
    client_id: config.clientId,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  };
}
if (process.argv.includes("--release") && !manifest.oauth2)
  throw new Error(
    "Release blocked: configure a real Google Chrome Extension OAuth client in config.local.json first.",
  );
let publicKey = config.publicKey;
if (!publicKey) {
  // Only the public key is retained; unpacked installs get a stable development ID.
  const existing = await readFile(new URL("extension-key.json", root), "utf8")
    .then(JSON.parse)
    .catch(() => null);
  publicKey =
    existing?.publicKey ??
    generateKeyPairSync("rsa", { modulusLength: 2048 })
      .publicKey.export({ type: "spki", format: "der" })
      .toString("base64");
  if (!existing)
    await writeFile(
      new URL("extension-key.json", root),
      JSON.stringify({ publicKey }, null, 2) + "\n",
    );
}
manifest.key = publicKey;
const extensionId = createHash("sha256")
  .update(Buffer.from(publicKey, "base64"))
  .digest("hex")
  .slice(0, 32)
  .replace(/[0-9a-f]/g, (c) => String.fromCharCode(97 + parseInt(c, 16)));
const dist = new URL("dist/", root);
await mkdir(dist, { recursive: true });
await rm(new URL("quotemark/", dist), { recursive: true, force: true });
await cp(new URL("extension/", root), new URL("quotemark/", dist), {
  recursive: true,
});
await writeFile(
  new URL("quotemark/manifest.json", dist),
  JSON.stringify(manifest, null, 2) + "\n",
);
await cp(new URL("LICENSE", root), new URL("quotemark/LICENSE", dist));
const filename = `quotemark-${manifest.version}${manifest.oauth2 ? "" : "-local"}.zip`;
await rm(new URL(filename, dist), { force: true });
execFileSync("zip", ["-q", "-r", new URL(filename, dist).pathname, "."], {
  cwd: new URL("quotemark/", dist),
});
console.log(
  JSON.stringify(
    {
      package: `dist/${filename}`,
      loadUnpacked: "dist/quotemark",
      extensionId,
      googleDriveConfigured: Boolean(manifest.oauth2),
    },
    null,
    2,
  ),
);
