/**
 * Phase 1 dev tool. Dumps the live catalog projection exactly as
 * orderExtractionService.buildCatalogProjection() sees it, so a
 * "not in catalog" verdict can be checked against reality.
 *
 *   node pilot-evals/dumpCatalog.mjs           # full
 *   node pilot-evals/dumpCatalog.mjs --names   # one line per product
 *   node pilot-evals/dumpCatalog.mjs --find दूध
 */
import { connect, disconnect } from "./_bootstrap.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildCatalogProjection } from "../services/orderExtractionService.js";

const here = path.dirname(fileURLToPath(import.meta.url));
await connect();

const catalog = await buildCatalogProjection();
const products = Array.isArray(catalog) ? catalog : catalog.products || [];

const findIdx = process.argv.indexOf("--find");
const target = findIdx !== -1 ? process.argv[findIdx + 1] : null;

const lines = [];
lines.push(`catalogSize=${products.length}`);

if (target) {
  const needle = target.toLowerCase();
  lines.push(`\n=== products matching "${target}" ===`);
  for (const p of products) {
    const hay = [p.ref, p.name, p.hinglishName, ...(p.aliases || [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (hay.includes(needle)) {
      lines.push(`  ${p.ref} | ${p.name} | hinglish=${p.hinglishName || "-"}`);
      lines.push(`      aliases=${JSON.stringify(p.aliases || [])}`);
      for (const v of p.variants || []) {
        lines.push(`      variant: ${v.measurement || "-"} | company=${v.company || "-"}`);
      }
    }
  }
} else if (process.argv.includes("--names")) {
  for (const p of products) {
    const vars = (p.variants || [])
      .map((v) => `${v.measurement || "?"}/${v.company || "?"}`)
      .join(" ; ");
    lines.push(`${p.ref.padEnd(5)} ${p.name} [${p.hinglishName || "-"}] aliases=${JSON.stringify(p.aliases || [])}`);
    if (vars) lines.push(`      ${vars}`);
  }
} else {
  lines.push(JSON.stringify(catalog, null, 2));
}

await disconnect();
fs.writeFileSync(path.join(here, "_catalog.txt"), lines.join("\n"), "utf8");
console.log(`wrote ${lines.length} lines to pilot-evals/_catalog.txt`);
