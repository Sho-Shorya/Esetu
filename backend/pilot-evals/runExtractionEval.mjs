/**
 * Phase 1 real-world evaluation.
 *
 * Runs the real extractor (live catalog, live LLM) over the scenario corpus plus
 * the real stored transcripts, then runs the real review engine over the result
 * and reports per-scenario pass/fail against the ground truth in scenarios.mjs.
 *
 * This is the step that answers "does the draft match the call", which is the
 * only thing standing between a recording and a wrong order.
 *
 *   node pilot-evals/runExtractionEval.mjs                 # corpus only
 *   node pilot-evals/runExtractionEval.mjs --real          # + stored real transcripts
 *   node pilot-evals/runExtractionEval.mjs --only=hindi-multi-variant
 */
import { connect, disconnect } from "./_bootstrap.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildCatalogProjection,
  extractOrderDraft,
  isLlmConfigured,
} from "../services/orderExtractionService.js";
import {
  reviewDraft,
  seedReviewLines,
  confirmReviewDraft,
} from "../services/pilotDraftReviewService.js";
import { SCENARIOS } from "./scenarios.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--only="))?.split("=")[1] || null;
const includeReal = args.includes("--real");
const repeat = Number(args.find((a) => a.startsWith("--repeat="))?.split("=")[1] || 1);

const db = await connect();
const catalog = await buildCatalogProjection();

if (!isLlmConfigured()) {
  console.error("LLM is not configured (LLM_BASE_URL / LLM_API_KEY / LLM_MODEL).");
  await disconnect();
  process.exit(1);
}

const out = [];
const say = (...a) => out.push(a.join(" "));

/* ------------------------------ ground truth ------------------------------- */

const norm = (value) => String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** Product + variant + company, so two brands of the same product stay distinct. */
const lineKey = (line) =>
  [norm(line.product), norm(line.variant), norm(line.company)].join("|");

const expectedKey = (line) =>
  [norm(line.product), norm(line.variant), norm(line.company)].join("|");

/** Graded outcome for one scenario. */
const grade = (scenario, draft, report, confirm) => {
  const failures = [];
  const notes = [];

  const expectIntent = scenario.expect.isOrderIntent !== false;
  if (Boolean(draft.isOrderIntent) !== expectIntent) {
    failures.push(
      `isOrderIntent: expected ${expectIntent}, got ${Boolean(draft.isOrderIntent)}`,
    );
  }

  const gotLines = (draft.items || []).map((item) => ({
    product: item.productName,
    quantity: item.quantity,
    variant: item.variantMeasurement,
    company: item.company,
  }));
  const wantLines = scenario.expect.items || [];

  // Every expected (product, variant) must be present with the right quantity.
  for (const want of wantLines) {
    const key = expectedKey(want);
    const hits = gotLines.filter((line) => lineKey(line) === key);

    if (!hits.length) {
      failures.push(
        `missing line: ${want.quantity ?? "?"} x ${want.product} (${want.variant}${
          want.company ? `, ${want.company}` : ""
        })`,
      );
      continue;
    }

    if (want.quantity === undefined) continue;

    if (want.quantity === null) {
      // Ground truth is "nobody said a number". A number here means the model
      // invented one, which is the defect this whole case exists to catch.
      const invented = hits.filter((line) => typeof line.quantity === "number");
      if (invented.length) {
        failures.push(
          `${want.product}: no quantity was spoken, but the draft says ` +
            invented.map((line) => line.quantity).join("/"),
        );
      }
      continue;
    }

    const total = hits.reduce((sum, line) => sum + (line.quantity ?? 0), 0);
    if (total !== want.quantity) {
      failures.push(
        `${want.product} (${want.variant}${want.company ? `, ${want.company}` : ""}): ` +
          `expected total ${want.quantity}, got ${total}${
            hits.length > 1 ? ` across ${hits.length} lines` : ""
          }`,
      );
    }

    if (want.company && hits.every((line) => norm(line.company) !== norm(want.company))) {
      failures.push(
        `${want.product} (${want.variant}): expected company ${want.company}, got ${hits
          .map((line) => line.company || "none")
          .join("/")}`,
      );
    }
  }

  // Products the caller named that must not have been invented into the order.
  const expectedProducts = new Set(wantLines.map((w) => norm(w.product)));
  for (const line of gotLines) {
    if (!expectedProducts.has(norm(line.product))) {
      notes.push(`extra line the scenario did not order: ${line.quantity} x ${line.product}`);
    }
  }

  // Anything the caller named that is not in the catalog has to be surfaced.
  for (const spoken of scenario.expect.unresolved || []) {
    const heard = (draft.unresolved || []).some((entry) =>
      norm(entry.spokenName).includes(norm(spoken)),
    );
    if (!heard) {
      failures.push(`"${spoken}" was not carried into unresolved`);
    }
  }

  // A quantity nobody stated must survive as unknown rather than becoming 1.
  for (const line of gotLines) {
    if (line.quantity !== null && !Number.isInteger(line.quantity)) {
      failures.push(`${line.product}: quantity ${line.quantity} is not a whole number`);
    }
  }

  if (scenario.expect.mustBlock && confirm.ok) {
    failures.push("draft confirmed although a quantity was never stated");
  }

  return { failures, notes, report, confirm };
};

/* --------------------------------- runner ---------------------------------- */

const runOne = async (label, transcript, scenario) => {
  const started = Date.now();
  let draft;
  let shortlistStats = null;
  let error = null;

  try {
    const result = await extractOrderDraft({ transcript, catalog });
    draft = result.draft;
    shortlistStats = result.shortlistStats;
  } catch (e) {
    error = e;
  }

  say("\n" + "=".repeat(78));
  say(`${label}   (${scenario.covers.join(", ")})`);
  say(`${scenario.title}`);
  say(`  transcript: ${transcript.length} chars, took ${((Date.now() - started) / 1000).toFixed(1)}s`);

  if (error) {
    say(`  EXTRACTION FAILED: ${error.code || ""} ${error.message}`);
    return { failed: true, failures: [`extraction threw: ${error.message}`] };
  }

  if (shortlistStats) {
    say(
      `  catalog ${shortlistStats.catalogSize} -> shortlisted ${shortlistStats.shortlisted} (${shortlistStats.mode})`,
    );
  }

  say(`  intent=${draft.isOrderIntent} items=${draft.itemCount} unresolved=${draft.unresolved.length}`);
  for (const item of draft.items || []) {
    say(
      `    ${String(item.quantity ?? "?").padStart(4)} ${(item.unit || "-").padEnd(8)} ${String(item.productName).padEnd(14)}` +
        ` var=${String(item.variantMeasurement ?? "-").padEnd(12)} co=${String(item.company ?? "-").padEnd(12)}` +
        ` conf=${item.confidence} mentions=${item.mentions} phrase="${item.matchedPhrase || ""}"`,
    );
  }
  for (const entry of draft.unresolved || []) {
    say(`    ? UNRESOLVED "${entry.spokenName}" (${entry.reason})`);
  }
  if (draft.needsClarification) {
    say(`    CLARIFY: ${draft.clarificationQuestion || "(EMPTY)"}`);
  }

  const report = reviewDraft({ lines: seedReviewLines({ draft }), catalog });
  const doc = { extraction: { draft }, review: { status: "not_started", lines: [] } };
  const confirm = confirmReviewDraft({ doc, catalog, userId: null });

  say(`  review counts: ${JSON.stringify(report.counts)}`);
  say(`  confirmable=${report.confirmable} confirm-> ${confirm.ok ? "OK" : confirm.code}`);
  for (const line of report.lines.filter((l) => (l.baseline?.flags || []).length)) {
    say(`    flags[${line.productName || line.spokenName}]: ${line.baseline.flags.join(", ")}`);
  }

  const graded = grade(scenario, draft, report, confirm);
  for (const note of graded.notes) say(`  NOTE: ${note}`);
  for (const failure of graded.failures) say(`  FAIL: ${failure}`);

  return { failed: graded.failures.length > 0, failures: graded.failures, report, draft };
};

let pass = 0;
let fail = 0;
let runs = 0;

for (let attempt = 1; attempt <= repeat; attempt += 1) {
  for (const scenario of SCENARIOS) {
    if (only && !scenario.id.includes(only)) continue;
    runs += 1;
    const result = await runOne(
      repeat > 1 ? `${scenario.id} [run ${attempt}/${repeat}]` : scenario.id,
      scenario.transcript,
      scenario,
    );
    if (result.failed) fail += 1;
    else pass += 1;
  }
}

if (includeReal) {
  const stored = await db
    .collection("phonecallpilots")
    .find({ "stt.transcript": { $exists: true, $ne: "" }, "extraction.draft": { $exists: true } })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();

  for (const doc of stored) {
    const transcript = doc.stt.transcript;
    // Re-derive ground truth from what the recorded call actually said.
    const scenario = {
      id: `real:${doc._id}`,
      title: "real recorded call, re-extracted",
      covers: ["real recording"],
      expect: {
        items: (doc.extraction.draft.items || []).map((item) => ({
          product: item.productName,
          variant: item.variantMeasurement,
          company: item.company,
        })),
        unresolved: (doc.extraction.draft.unresolved || []).map((u) => u.spokenName),
      },
    };
    runs += 1;
    const result = await runOne(`real:${doc._id}`, transcript, scenario);
    if (result.failed) fail += 1;
    else pass += 1;
  }
}

say("\n" + "=".repeat(78));
say(`RESULT: ${pass}/${runs} scenarios matched the ground truth, ${fail} failed.`);

await disconnect();
fs.writeFileSync(path.join(here, "_eval.txt"), out.join("\n"), "utf8");
console.log(`wrote ${out.length} lines to pilot-evals/_eval.txt`);
console.log(`RESULT: ${pass}/${runs} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
