/**
 * Phase 1 dev tool. Dumps every PhoneCallPilot doc so the current real-world
 * baseline (transcript -> draft -> review state) can be inspected by hand.
 *
 *   node pilot-evals/dumpCalls.mjs            # compact
 *   node pilot-evals/dumpCalls.mjs --full     # include review lines
 */
import { connect, disconnect } from "./_bootstrap.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = [];
const say = (...args) => out.push(args.join(" "));

const db = await connect();

const docs = await db
  .collection("phonecallpilots")
  .find({})
  .sort({ createdAt: 1 })
  .toArray();

const full = process.argv.includes("--full");

say(`pilotCalls=${docs.length}\n`);

for (const d of docs) {
  const audio = d.audio || {};
  const stt = d.stt || {};
  const ex = d.extraction || {};
  const rv = d.review || {};

  say("=".repeat(78));
  say(
    `id=${d._id}  src=${d.source}  stage=${d.pipeline?.stage}  err=${d.pipeline?.error?.code || "-"}`,
  );
  say(
    `created=${d.createdAt?.toISOString?.()}  audio=${audio.fileName || "-"} (${audio.bytes || 0}b)`,
  );
  say(`stt: status=${stt.status} model=${stt.model} err=${stt.error || "-"}`);
  say(`extraction: status=${ex.status} model=${ex.model} needsReview=${ex.needsReview}`);
  if (ex.validationErrors?.length) {
    say(`  validationErrors: ${JSON.stringify(ex.validationErrors)}`);
  }

  if (stt.transcript) {
    say(`\n-- TRANSCRIPT (${stt.transcript.length} ch) --`);
    say(stt.transcript);
  } else {
    say("\n-- TRANSCRIPT --\n(none)");
  }

  const draft = ex.draft;
  if (draft) {
    say(`\n-- DRAFT intent=${draft.isOrderIntent} items=${draft.itemCount} --`);
    for (const it of draft.items || []) {
      say(
        `   * ${it.quantity} ${it.unit || ""} ${it.productName || "?"} ` +
          `| var=${it.variantMeasurement || "-"} | co=${it.company || "-"} ` +
          `| spoken="${it.spokenName || ""}" | conf=${it.confidence} | corr=${it.isCorrection} | men=${it.mentions}`,
      );
      say(`     productId=${it.productId}`);
    }
    for (const u of draft.unresolved || []) {
      say(`   ? UNRESOLVED "${u.spokenName}" (${u.reason})`);
    }
    if (draft.customerNote) say(`   note: ${draft.customerNote}`);
    if (draft.needsClarification) {
      say(`   CLARIFY: ${draft.clarificationQuestion}`);
    }
  } else {
    say("\n-- DRAFT --\n(none)");
  }

  say(`\n-- REVIEW status=${rv.status} --`);
  if (rv.report) say(`  report: ${JSON.stringify(rv.report.counts)}`);
  if (rv.report?.blockers?.length) {
    for (const b of rv.report.blockers) {
      say(`  BLOCKER [${b.status}] ${b.productName || b.key}: ${(b.messages || []).join(" | ")}`);
    }
  }
  if (full && rv.lines?.length) {
    for (const l of rv.lines) {
      say(
        `   [${l.status}] ${l.quantity ?? "-"} ${l.unit || ""} ${l.productName || "?"} ` +
          `| var=${l.variantMeasurement || "-"} co=${l.company || "-"} | origin=${l.origin} ` +
          `| blocking=${l.blocking} removed=${!!l.removed} issues=${JSON.stringify(l.issues || [])}`,
      );
    }
  }
  if (rv.confirmed) {
    say(
      `  CONFIRMED at=${rv.confirmed.at} by=${rv.confirmed.by} items=${rv.confirmed.itemCount} ` +
        `orderCreated=${rv.confirmed.orderCreated} orderId=${rv.confirmed.orderId}`,
    );
    say(`  counts: ${JSON.stringify(rv.confirmed.counts)}`);
  }
  say("");
}

await disconnect();

fs.writeFileSync(path.join(here, "_dump.txt"), out.join("\n"), "utf8");
console.log(`wrote ${out.length} lines to pilot-evals/_dump.txt (${docs.length} calls)`);


